import db from "../models/db";
import { RowDataPacket } from "mysql2";

export type Granularity = "day" | "week" | "month" | "quarter";

export interface AnalyticsFilters {
  requestingUserId: number;
  isAdmin: boolean;
  userIds?: number[];
  storeIds?: number[];
  startDate?: string;
  endDate?: string;
  company?: string;
  granularity?: Granularity;
}

interface ScopeSql {
  where: string;
  params: Array<string | number>;
}

const VALID_GRANULARITIES = new Set<Granularity>([
  "day",
  "week",
  "month",
  "quarter",
]);

export const normalizeGranularity = (value?: string): Granularity =>
  VALID_GRANULARITIES.has(value as Granularity) ? (value as Granularity) : "day";

/**
 * Builds the shared WHERE clause every analytics query uses, so scoping rules
 * (a non-admin only ever sees their own rows) live in exactly one place.
 *
 * `alias` is the table alias holding user_id/store_id/created_at.
 * `dateColumn` differs per table: work_log_days audits by work_date, while the
 * evidence tables are timestamped by created_at.
 */
const buildScope = (
  filters: AnalyticsFilters,
  alias: string,
  dateColumn = "created_at"
): ScopeSql => {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.isAdmin) {
    if (filters.userIds?.length) {
      where.push(`${alias}.user_id IN (${filters.userIds.map(() => "?").join(",")})`);
      params.push(...filters.userIds);
    }
  } else {
    where.push(`${alias}.user_id = ?`);
    params.push(filters.requestingUserId);
  }

  if (filters.storeIds?.length) {
    where.push(`${alias}.store_id IN (${filters.storeIds.map(() => "?").join(",")})`);
    params.push(...filters.storeIds);
  }

  if (filters.startDate) {
    where.push(`DATE(${alias}.${dateColumn}) >= ?`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    where.push(`DATE(${alias}.${dateColumn}) <= ?`);
    params.push(filters.endDate);
  }

  return {
    where: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
};

// Bucket expression per granularity. Kept as a whitelist-driven lookup rather
// than string interpolation of user input.
const bucketExpression = (
  alias: string,
  dateColumn: string,
  granularity: Granularity
): string => {
  switch (granularity) {
    case "week":
      return `DATE_FORMAT(${alias}.${dateColumn}, '%x-W%v')`;
    case "month":
      return `DATE_FORMAT(${alias}.${dateColumn}, '%Y-%m')`;
    case "quarter":
      return `CONCAT('Q', QUARTER(${alias}.${dateColumn}), '-', YEAR(${alias}.${dateColumn}))`;
    default:
      return `DATE(${alias}.${dateColumn})`;
  }
};

const queryRows = async (sql: string, params: Array<string | number>) => {
  const [rows] = await db.promise().query<RowDataPacket[]>(sql, params);
  return rows;
};

export interface AnalyticsOverview {
  photos: number;
  podravkaFacings: number;
  podravkaFacingsTotal: number;
  competitorFacings: number;
  competitorFacingsTotal: number;
  storesVisited: number;
  activeEmployees: number;
  workDays: number;
  absenceDays: number;
  kilometersDriven: number;
  fuelCost: number;
  fuelLiters: number;
  otherTravelCost: number;
  shareOfShelf: number | null;
}

export const getOverview = async (
  filters: AnalyticsFilters
): Promise<AnalyticsOverview> => {
  const photoScope = buildScope(filters, "rp");
  const podravkaScope = buildScope(filters, "pf");
  const competitorScope = buildScope(filters, "cf");
  // work_log_days has no store_id, so store filtering cannot apply here.
  const workScope = buildScope(
    { ...filters, storeIds: undefined },
    "wld",
    "work_date"
  );

  const companyClause = filters.company
    ? `${photoScope.where ? " AND" : " WHERE"} rp.company = ?`
    : "";
  const photoParams = filters.company
    ? [...photoScope.params, filters.company]
    : photoScope.params;

  const [photoRows, podravkaRows, competitorRows, workRows] = await Promise.all([
    queryRows(
      `
        SELECT
          COUNT(*) AS photo_count,
          COUNT(DISTINCT rp.store_id) AS store_count,
          COUNT(DISTINCT rp.user_id) AS user_count
        FROM report_photos rp
        ${photoScope.where}${companyClause}
      `,
      photoParams
    ),
    queryRows(
      `
        SELECT
          COUNT(*) AS row_count,
          COALESCE(SUM(pf.facings_count), 0) AS facings_total,
          COUNT(DISTINCT pf.store_id) AS store_count,
          COUNT(DISTINCT pf.user_id) AS user_count
        FROM podravka_facings pf
        ${podravkaScope.where}
      `,
      podravkaScope.params
    ),
    queryRows(
      `
        SELECT
          COUNT(*) AS row_count,
          COALESCE(SUM(cf.facings_count), 0) AS facings_total,
          COUNT(DISTINCT cf.store_id) AS store_count,
          COUNT(DISTINCT cf.user_id) AS user_count
        FROM competitor_facings cf
        ${competitorScope.where}
      `,
      competitorScope.params
    ),
    queryRows(
      `
        SELECT
          COUNT(*) AS work_days,
          SUM(CASE WHEN wld.status <> 'planned_work' THEN 1 ELSE 0 END) AS absence_days,
          COALESCE(SUM(wld.kilometers_driven), 0) AS kilometers_driven,
          COALESCE(SUM(wld.fuel_cost), 0) AS fuel_cost,
          COALESCE(SUM(wld.fuel_liters), 0) AS fuel_liters,
          COALESCE(SUM(wld.other_travel_cost), 0) AS other_travel_cost
        FROM work_log_days wld
        ${workScope.where}
      `,
      workScope.params
    ),
  ]);

  const podravkaTotal = Number(podravkaRows[0]?.facings_total || 0);
  const competitorTotal = Number(competitorRows[0]?.facings_total || 0);
  const combined = podravkaTotal + competitorTotal;

  return {
    photos: Number(photoRows[0]?.photo_count || 0),
    podravkaFacings: Number(podravkaRows[0]?.row_count || 0),
    podravkaFacingsTotal: podravkaTotal,
    competitorFacings: Number(competitorRows[0]?.row_count || 0),
    competitorFacingsTotal: competitorTotal,
    storesVisited: Math.max(
      Number(photoRows[0]?.store_count || 0),
      Number(podravkaRows[0]?.store_count || 0),
      Number(competitorRows[0]?.store_count || 0)
    ),
    activeEmployees: Math.max(
      Number(photoRows[0]?.user_count || 0),
      Number(podravkaRows[0]?.user_count || 0),
      Number(competitorRows[0]?.user_count || 0)
    ),
    workDays: Number(workRows[0]?.work_days || 0),
    absenceDays: Number(workRows[0]?.absence_days || 0),
    kilometersDriven: Number(workRows[0]?.kilometers_driven || 0),
    fuelCost: Number(workRows[0]?.fuel_cost || 0),
    fuelLiters: Number(workRows[0]?.fuel_liters || 0),
    otherTravelCost: Number(workRows[0]?.other_travel_cost || 0),
    // Podravka's share of all recorded facings — null when nothing is recorded,
    // so the UI can distinguish "no data" from a genuine 0%.
    shareOfShelf: combined > 0 ? (podravkaTotal / combined) * 100 : null,
  };
};

export interface TimeseriesPoint {
  bucket: string;
  photos: number;
  podravkaFacings: number;
  competitorFacings: number;
  kilometersDriven: number;
}

export const getTimeseries = async (
  filters: AnalyticsFilters
): Promise<TimeseriesPoint[]> => {
  const granularity = normalizeGranularity(filters.granularity);

  const photoScope = buildScope(filters, "rp");
  const podravkaScope = buildScope(filters, "pf");
  const competitorScope = buildScope(filters, "cf");
  const workScope = buildScope(
    { ...filters, storeIds: undefined },
    "wld",
    "work_date"
  );

  const [photoRows, podravkaRows, competitorRows, workRows] = await Promise.all([
    queryRows(
      `
        SELECT ${bucketExpression("rp", "created_at", granularity)} AS bucket,
               COUNT(*) AS value
        FROM report_photos rp
        ${photoScope.where}
        GROUP BY bucket
      `,
      photoScope.params
    ),
    queryRows(
      `
        SELECT ${bucketExpression("pf", "created_at", granularity)} AS bucket,
               COALESCE(SUM(pf.facings_count), 0) AS value
        FROM podravka_facings pf
        ${podravkaScope.where}
        GROUP BY bucket
      `,
      podravkaScope.params
    ),
    queryRows(
      `
        SELECT ${bucketExpression("cf", "created_at", granularity)} AS bucket,
               COALESCE(SUM(cf.facings_count), 0) AS value
        FROM competitor_facings cf
        ${competitorScope.where}
        GROUP BY bucket
      `,
      competitorScope.params
    ),
    queryRows(
      `
        SELECT ${bucketExpression("wld", "work_date", granularity)} AS bucket,
               COALESCE(SUM(wld.kilometers_driven), 0) AS value
        FROM work_log_days wld
        ${workScope.where}
        GROUP BY bucket
      `,
      workScope.params
    ),
  ]);

  const buckets = new Map<string, TimeseriesPoint>();

  const merge = (
    rows: RowDataPacket[],
    key: keyof Omit<TimeseriesPoint, "bucket">
  ) => {
    for (const row of rows) {
      const bucket = String(row.bucket);
      const point =
        buckets.get(bucket) ||
        ({
          bucket,
          photos: 0,
          podravkaFacings: 0,
          competitorFacings: 0,
          kilometersDriven: 0,
        } as TimeseriesPoint);
      point[key] = Number(row.value || 0);
      buckets.set(bucket, point);
    }
  };

  merge(photoRows, "photos");
  merge(podravkaRows, "podravkaFacings");
  merge(competitorRows, "competitorFacings");
  merge(workRows, "kilometersDriven");

  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
};

export interface EmployeeBreakdownRow {
  user_id: number;
  user: string;
  photos: number;
  podravkaFacingsTotal: number;
  competitorFacingsTotal: number;
  storesVisited: number;
  workDays: number;
  absenceDays: number;
  kilometersDriven: number;
  fuelCost: number;
}

export const getEmployeeBreakdown = async (
  filters: AnalyticsFilters
): Promise<EmployeeBreakdownRow[]> => {
  const photoScope = buildScope(filters, "rp");
  const podravkaScope = buildScope(filters, "pf");
  const competitorScope = buildScope(filters, "cf");
  const workScope = buildScope(
    { ...filters, storeIds: undefined },
    "wld",
    "work_date"
  );

  const [photoRows, podravkaRows, competitorRows, workRows, userRows] =
    await Promise.all([
      queryRows(
        `
          SELECT rp.user_id, COUNT(*) AS photos,
                 COUNT(DISTINCT rp.store_id) AS stores
          FROM report_photos rp
          ${photoScope.where}
          GROUP BY rp.user_id
        `,
        photoScope.params
      ),
      queryRows(
        `
          SELECT pf.user_id, COALESCE(SUM(pf.facings_count), 0) AS total
          FROM podravka_facings pf
          ${podravkaScope.where}
          GROUP BY pf.user_id
        `,
        podravkaScope.params
      ),
      queryRows(
        `
          SELECT cf.user_id, COALESCE(SUM(cf.facings_count), 0) AS total
          FROM competitor_facings cf
          ${competitorScope.where}
          GROUP BY cf.user_id
        `,
        competitorScope.params
      ),
      queryRows(
        `
          SELECT
            wld.user_id,
            COUNT(*) AS work_days,
            SUM(CASE WHEN wld.status <> 'planned_work' THEN 1 ELSE 0 END) AS absence_days,
            COALESCE(SUM(wld.kilometers_driven), 0) AS kilometers_driven,
            COALESCE(SUM(wld.fuel_cost), 0) AS fuel_cost
          FROM work_log_days wld
          ${workScope.where}
          GROUP BY wld.user_id
        `,
        workScope.params
      ),
      queryRows(`SELECT user_id, user FROM users`, []),
    ]);

  const names = new Map<number, string>();
  for (const row of userRows) {
    names.set(Number(row.user_id), String(row.user));
  }

  const result = new Map<number, EmployeeBreakdownRow>();

  const ensure = (userId: number): EmployeeBreakdownRow => {
    const existing = result.get(userId);
    if (existing) return existing;

    const created: EmployeeBreakdownRow = {
      user_id: userId,
      user: names.get(userId) || `#${userId}`,
      photos: 0,
      podravkaFacingsTotal: 0,
      competitorFacingsTotal: 0,
      storesVisited: 0,
      workDays: 0,
      absenceDays: 0,
      kilometersDriven: 0,
      fuelCost: 0,
    };
    result.set(userId, created);
    return created;
  };

  for (const row of photoRows) {
    const entry = ensure(Number(row.user_id));
    entry.photos = Number(row.photos || 0);
    entry.storesVisited = Number(row.stores || 0);
  }

  for (const row of podravkaRows) {
    ensure(Number(row.user_id)).podravkaFacingsTotal = Number(row.total || 0);
  }

  for (const row of competitorRows) {
    ensure(Number(row.user_id)).competitorFacingsTotal = Number(row.total || 0);
  }

  for (const row of workRows) {
    const entry = ensure(Number(row.user_id));
    entry.workDays = Number(row.work_days || 0);
    entry.absenceDays = Number(row.absence_days || 0);
    entry.kilometersDriven = Number(row.kilometers_driven || 0);
    entry.fuelCost = Number(row.fuel_cost || 0);
  }

  return [...result.values()].sort((a, b) => b.photos - a.photos);
};

export interface BreakdownRow {
  label: string;
  value: number;
}

/**
 * Photo counts grouped by category. For quarterly photo types the category
 * column holds the reporting quarter, so this doubles as the quarter breakdown.
 */
export const getPhotoCategoryBreakdown = async (
  filters: AnalyticsFilters
): Promise<BreakdownRow[]> => {
  const scope = buildScope(filters, "rp");

  const rows = await queryRows(
    `
      SELECT rp.category AS label, COUNT(*) AS value
      FROM report_photos rp
      ${scope.where}
      GROUP BY rp.category
      ORDER BY value DESC
    `,
    scope.params
  );

  return rows.map((row) => ({
    label: String(row.label),
    value: Number(row.value || 0),
  }));
};

export const getPhotoTypeBreakdown = async (
  filters: AnalyticsFilters
): Promise<BreakdownRow[]> => {
  const scope = buildScope(filters, "rp");

  const rows = await queryRows(
    `
      SELECT rp.photo_type AS label, COUNT(*) AS value
      FROM report_photos rp
      ${scope.where}
      GROUP BY rp.photo_type
      ORDER BY value DESC
    `,
    scope.params
  );

  return rows.map((row) => ({
    label: String(row.label),
    value: Number(row.value || 0),
  }));
};

/**
 * Stores with no recorded activity in the window — the coverage gap list that
 * drives "which shops did we miss this quarter".
 */
export const getStoreCoverage = async (filters: AnalyticsFilters) => {
  const params: Array<string | number> = [];
  const storeWhere: string[] = [];

  if (!filters.isAdmin) {
    storeWhere.push("s.user_id = ?");
    params.push(filters.requestingUserId);
  } else if (filters.userIds?.length) {
    storeWhere.push(`s.user_id IN (${filters.userIds.map(() => "?").join(",")})`);
    params.push(...filters.userIds);
  }

  if (filters.storeIds?.length) {
    storeWhere.push(`s.store_id IN (${filters.storeIds.map(() => "?").join(",")})`);
    params.push(...filters.storeIds);
  }

  const dateParams: Array<string | number> = [];
  const dateFilter = (alias: string) => {
    const clauses: string[] = [];
    if (filters.startDate) {
      clauses.push(`AND DATE(${alias}.created_at) >= ?`);
      dateParams.push(filters.startDate);
    }
    if (filters.endDate) {
      clauses.push(`AND DATE(${alias}.created_at) <= ?`);
      dateParams.push(filters.endDate);
    }
    return clauses.join(" ");
  };

  const photoDates = dateFilter("rp");
  const podravkaDates = dateFilter("pf");

  const rows = await queryRows(
    `
      SELECT
        s.store_id,
        s.store_name,
        s.store_code,
        s.store_category,
        s.user_id,
        COUNT(DISTINCT rp.photo_id) AS photo_count,
        COUNT(DISTINCT pf.podravka_facings_id) AS facing_count,
        GREATEST(
          COALESCE(MAX(DATE(rp.created_at)), '1000-01-01'),
          COALESCE(MAX(DATE(pf.created_at)), '1000-01-01')
        ) AS last_activity
      FROM stores s
      LEFT JOIN report_photos rp ON rp.store_id = s.store_id ${photoDates}
      LEFT JOIN podravka_facings pf ON pf.store_id = s.store_id ${podravkaDates}
      ${storeWhere.length ? `WHERE ${storeWhere.join(" AND ")}` : ""}
      GROUP BY s.store_id, s.store_name, s.store_code, s.store_category, s.user_id
      ORDER BY photo_count ASC, facing_count ASC, s.store_name ASC
    `,
    // JOIN conditions are bound before the WHERE clause, so the date params
    // for the two LEFT JOINs must come first.
    [...dateParams, ...params]
  );

  const stores = rows.map((row) => {
    const lastActivity = String(row.last_activity);
    return {
      store_id: Number(row.store_id),
      store_name: String(row.store_name),
      store_code: row.store_code === null ? null : String(row.store_code),
      store_category: row.store_category === null ? null : String(row.store_category),
      photo_count: Number(row.photo_count || 0),
      facing_count: Number(row.facing_count || 0),
      last_activity: lastActivity === "1000-01-01" ? null : lastActivity,
    };
  });

  const covered = stores.filter(
    (store) => store.photo_count > 0 || store.facing_count > 0
  ).length;

  return {
    stores,
    total: stores.length,
    covered,
    uncovered: stores.length - covered,
    coverageRate: stores.length ? (covered / stores.length) * 100 : null,
  };
};
