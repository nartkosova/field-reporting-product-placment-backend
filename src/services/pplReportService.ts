import db from "../models/db";
import { RowDataPacket } from "mysql2";

const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Belgrade";

export type GroupBy = "entry" | "store" | "category" | "user" | "day";
const GROUPS = new Set<GroupBy>(["entry", "store", "category", "user", "day"]);

const SORT_FIELDS = new Set([
  "date",
  "user",
  "store_name",
  "category",
  "podravka",
  "competitor",
  "total",
  "share",
  "entries",
]);

export interface PplFilters {
  userIds: number[];
  storeIds: number[];
  categories: string[];
  businessUnit: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface PplRow {
  key: string;
  date: string | null;
  user_id: number | null;
  user: string | null;
  store_id: number | null;
  store_name: string | null;
  category: string | null;
  podravka: number;
  competitor: number;
  total: number;
  share: number | null;
  competitors: Record<string, number>;
  entries: number;
  last_at: string | null;
}

interface Entry extends PplRow {
  date: string;
}

const toList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .map(String)
    .filter((item) => item && item !== "all");

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const parsePplFilters = (query: Record<string, unknown>): PplFilters => ({
  userIds: toList(query.user_id).map(Number).filter(Number.isInteger),
  storeIds: toList(query.store_id).map(Number).filter(Number.isInteger),
  categories: toList(query.category),
  businessUnit: toList(query.business_unit)[0] ?? null,
  startDate: isDate(query.start_date) ? query.start_date : null,
  endDate: isDate(query.end_date) ? query.end_date : null,
});

// Minutes the app timezone is ahead of UTC on a given day. Used to bucket
// entries by the local calendar day the field team actually worked.
const utcOffsetMinutes = (date: string): number => {
  const instant = new Date(`${date}T12:00:00Z`);
  const local = new Date(instant.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
  const utc = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local.getTime() - utc.getTime()) / 60000);
};

const todayInAppTimezone = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const daysBetween = (start: string, end: string) =>
  Math.round(
    (new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) /
      86400000
  );

const shareOf = (podravka: number, competitor: number) =>
  podravka + competitor ? (podravka / (podravka + competitor)) * 100 : null;

const resolveCategories = async (filters: PplFilters): Promise<string[] | null> => {
  if (!filters.businessUnit) return filters.categories;

  const [rows] = await db
    .promise()
    .query<RowDataPacket[]>(
      "SELECT DISTINCT category FROM podravka_products WHERE business_unit = ?",
      [filters.businessUnit]
    );
  const unitCategories = rows.map((row) => String(row.category));
  const categories = filters.categories.length
    ? filters.categories.filter((category) => unitCategories.includes(category))
    : unitCategories;

  // A business unit with no matching categories matches nothing.
  return categories.length ? categories : null;
};

// One entry per reporter + store + category + local day, with Podravka and
// every competitor brand summed. Both tables are filtered the same way, and an
// entry with only competitor facings is kept rather than dropped.
const loadEntries = async (
  filters: PplFilters,
  startDate: string | null,
  endDate: string | null
): Promise<Entry[]> => {
  const categories = await resolveCategories(filters);
  if (categories === null) return [];

  const offset = utcOffsetMinutes(startDate || endDate || todayInAppTimezone());

  const buildWhere = (alias: string) => {
    const conditions: string[] = [];
    const values: Array<string | number> = [];

    if (filters.userIds.length) {
      conditions.push(`${alias}.user_id IN (${filters.userIds.map(() => "?").join(",")})`);
      values.push(...filters.userIds);
    }
    if (filters.storeIds.length) {
      conditions.push(`${alias}.store_id IN (${filters.storeIds.map(() => "?").join(",")})`);
      values.push(...filters.storeIds);
    }
    if (categories.length) {
      conditions.push(`${alias}.category IN (${categories.map(() => "?").join(",")})`);
      values.push(...categories);
    }
    if (startDate) {
      conditions.push(`${alias}.created_at >= ? - INTERVAL ? MINUTE`);
      values.push(`${startDate} 00:00:00`, offset);
    }
    if (endDate) {
      conditions.push(`${alias}.created_at < ? - INTERVAL ? MINUTE`);
      values.push(`${shiftDate(endDate, 1)} 00:00:00`, offset);
    }
    return { conditions, values };
  };

  const podravkaWhere = buildWhere("pf");
  podravkaWhere.conditions.unshift("(pf.record_type IS NULL OR pf.record_type = 'FACINGS')");
  const competitorWhere = buildWhere("cf");
  const where = (conditions: string[]) =>
    conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [[podravkaRows], [competitorRows]] = await Promise.all([
    db.promise().query<RowDataPacket[]>(
      `SELECT pf.user_id, u.user, pf.store_id, s.store_name, pf.category,
              DATE(pf.created_at + INTERVAL ? MINUTE) AS day,
              SUM(pf.facings_count) AS facings,
              MAX(pf.created_at) AS last_at
       FROM podravka_facings pf
       JOIN users u ON u.user_id = pf.user_id
       JOIN stores s ON s.store_id = pf.store_id
       ${where(podravkaWhere.conditions)}
       GROUP BY pf.user_id, u.user, pf.store_id, s.store_name, pf.category, day`,
      [offset, ...podravkaWhere.values]
    ),
    db.promise().query<RowDataPacket[]>(
      `SELECT cf.user_id, u.user, cf.store_id, s.store_name, cf.category,
              DATE(cf.created_at + INTERVAL ? MINUTE) AS day,
              COALESCE(cb.brand_name, 'Tjetër') AS brand,
              SUM(cf.facings_count) AS facings,
              MAX(cf.created_at) AS last_at
       FROM competitor_facings cf
       JOIN users u ON u.user_id = cf.user_id
       JOIN stores s ON s.store_id = cf.store_id
       LEFT JOIN competitor_brands cb ON cb.competitor_id = cf.competitor_id
       ${where(competitorWhere.conditions)}
       GROUP BY cf.user_id, u.user, cf.store_id, s.store_name, cf.category, day, brand`,
      [offset, ...competitorWhere.values]
    ),
  ]);

  const entries = new Map<string, Entry>();
  const entryFor = (row: RowDataPacket) => {
    const day = row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10);
    const key = `${row.user_id}|${row.store_id}|${row.category}|${day}`;
    let entry = entries.get(key);
    if (!entry) {
      entry = {
        key,
        date: day,
        user_id: Number(row.user_id),
        user: String(row.user),
        store_id: Number(row.store_id),
        store_name: String(row.store_name),
        category: String(row.category),
        podravka: 0,
        competitor: 0,
        total: 0,
        share: null,
        competitors: {},
        entries: 1,
        last_at: null,
      };
      entries.set(key, entry);
    }
    const lastAt = new Date(row.last_at).toISOString();
    if (!entry.last_at || lastAt > entry.last_at) entry.last_at = lastAt;
    return entry;
  };

  for (const row of podravkaRows) {
    entryFor(row).podravka += Number(row.facings || 0);
  }
  for (const row of competitorRows) {
    const entry = entryFor(row);
    const count = Number(row.facings || 0);
    entry.competitor += count;
    entry.competitors[row.brand] = (entry.competitors[row.brand] || 0) + count;
  }

  return [...entries.values()].map((entry) => ({
    ...entry,
    total: entry.podravka + entry.competitor,
    share: shareOf(entry.podravka, entry.competitor),
  }));
};

const groupEntries = (entries: Entry[], groupBy: GroupBy): PplRow[] => {
  if (groupBy === "entry") return entries;

  const groups = new Map<string, PplRow>();
  for (const entry of entries) {
    const key =
      groupBy === "store"
        ? String(entry.store_id)
        : groupBy === "user"
        ? String(entry.user_id)
        : groupBy === "category"
        ? String(entry.category)
        : entry.date;

    let row = groups.get(key);
    if (!row) {
      row = {
        key,
        date: groupBy === "day" ? entry.date : null,
        user_id: groupBy === "user" ? entry.user_id : null,
        user: groupBy === "user" ? entry.user : null,
        store_id: groupBy === "store" ? entry.store_id : null,
        store_name: groupBy === "store" ? entry.store_name : null,
        category: groupBy === "category" ? entry.category : null,
        podravka: 0,
        competitor: 0,
        total: 0,
        share: null,
        competitors: {},
        entries: 0,
        last_at: null,
      };
      groups.set(key, row);
    }

    row.podravka += entry.podravka;
    row.competitor += entry.competitor;
    row.entries += 1;
    if (entry.last_at && (!row.last_at || entry.last_at > row.last_at)) row.last_at = entry.last_at;
    for (const [brand, count] of Object.entries(entry.competitors)) {
      row.competitors[brand] = (row.competitors[brand] || 0) + count;
    }
  }

  return [...groups.values()].map((row) => ({
    ...row,
    total: row.podravka + row.competitor,
    share: shareOf(row.podravka, row.competitor),
  }));
};

const sortRows = (rows: PplRow[], field: string, direction: "asc" | "desc") => {
  const factor = direction === "asc" ? 1 : -1;
  const valueOf = (row: PplRow) =>
    field === "date" ? row.last_at ?? row.date : (row as unknown as Record<string, unknown>)[field];

  return rows.sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    // Rows without a value (e.g. no share) always sink to the bottom.
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
    return String(left).localeCompare(String(right)) * factor;
  });
};

const summarize = (entries: Entry[]) => {
  const podravka = entries.reduce((sum, entry) => sum + entry.podravka, 0);
  const competitor = entries.reduce((sum, entry) => sum + entry.competitor, 0);
  return {
    podravka,
    competitor,
    share: shareOf(podravka, competitor),
    entries: entries.length,
    stores: new Set(entries.map((entry) => entry.store_id)).size,
    reporters: new Set(entries.map((entry) => entry.user_id)).size,
  };
};

const buildCharts = (entries: Entry[]) => {
  const byDay = new Map<string, { podravka: number; competitor: number }>();
  const byCategory = new Map<string, { podravka: number; competitor: number }>();
  const byBrand = new Map<string, number>();

  for (const entry of entries) {
    const day = byDay.get(entry.date) || { podravka: 0, competitor: 0 };
    day.podravka += entry.podravka;
    day.competitor += entry.competitor;
    byDay.set(entry.date, day);

    const category = byCategory.get(String(entry.category)) || { podravka: 0, competitor: 0 };
    category.podravka += entry.podravka;
    category.competitor += entry.competitor;
    byCategory.set(String(entry.category), category);

    for (const [brand, count] of Object.entries(entry.competitors)) {
      byBrand.set(brand, (byBrand.get(brand) || 0) + count);
    }
  }

  const podravkaTotal = entries.reduce((sum, entry) => sum + entry.podravka, 0);

  return {
    trend: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, ...value, share: shareOf(value.podravka, value.competitor) })),
    categories: [...byCategory.entries()]
      .map(([category, value]) => ({
        category,
        ...value,
        share: shareOf(value.podravka, value.competitor),
      }))
      .sort((a, b) => b.podravka + b.competitor - (a.podravka + a.competitor)),
    // Podravka is ranked alongside the competitor brands it shares shelves with.
    brands: [
      { brand: "Podravka", facings: podravkaTotal, is_podravka: true },
      ...[...byBrand.entries()].map(([brand, facings]) => ({ brand, facings, is_podravka: false })),
    ]
      .filter((item) => item.facings > 0)
      .sort((a, b) => b.facings - a.facings),
  };
};

export const getPplReport = async (
  filters: PplFilters,
  options: {
    groupBy: string;
    sort: string;
    direction: string;
    limit: number;
    offset: number;
    all: boolean;
  }
) => {
  const groupBy: GroupBy = GROUPS.has(options.groupBy as GroupBy)
    ? (options.groupBy as GroupBy)
    : "entry";
  const sortField = SORT_FIELDS.has(options.sort)
    ? options.sort
    : groupBy === "entry" || groupBy === "day"
    ? "date"
    : "total";
  const direction = options.direction === "asc" ? "asc" : "desc";

  // The previous period has the same length and ends the day before.
  const hasRange = filters.startDate && filters.endDate;
  const previousRange = hasRange
    ? {
        start: shiftDate(filters.startDate!, -(daysBetween(filters.startDate!, filters.endDate!) + 1)),
        end: shiftDate(filters.startDate!, -1),
      }
    : null;

  const [entries, previousEntries] = await Promise.all([
    loadEntries(filters, filters.startDate, filters.endDate),
    previousRange ? loadEntries(filters, previousRange.start, previousRange.end) : Promise.resolve(null),
  ]);

  const rows = sortRows(groupEntries(entries, groupBy), sortField, direction);
  const brandColumns = [
    ...new Set(entries.flatMap((entry) => Object.keys(entry.competitors))),
  ].sort((a, b) => a.localeCompare(b));

  return {
    group_by: groupBy,
    sort: sortField,
    direction,
    total: rows.length,
    data: options.all ? rows : rows.slice(options.offset, options.offset + options.limit),
    brands: brandColumns,
    summary: summarize(entries),
    previous_summary: previousEntries ? summarize(previousEntries) : null,
    previous_range: previousRange,
    charts: buildCharts(entries),
  };
};
