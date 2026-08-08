import db from "../models/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export type WorkLogStatus = "planned_work" | "vacation" | "sick_day" | "other";
export type WorkActivityType =
  | "ppl"
  | "photo_report"
  | "store_visit";

export interface WorkLogActivityInput {
  activity_type: WorkActivityType;
  planned?: boolean;
  completed?: boolean;
  note?: string | null;
}

export interface WorkLogDayCityInput {
  city_name: string;
  visit_order?: number | null;
  note?: string | null;
}

export interface WorkLogDayInput {
  work_date: string;
  status?: WorkLogStatus;
  plan?: string | null;
  summary?: string | null;
  absence_reason?: string | null;
  start_kilometers?: number | null;
  end_kilometers?: number | null;
  kilometers_driven?: number | null;
  fuel_cost?: number | null;
  fuel_liters?: number | null;
  other_travel_cost?: number | null;
  activities?: WorkLogActivityInput[];
  cities?: WorkLogDayCityInput[];
}

export interface LatestWorkDayKilometers {
  work_log_day_id: number;
  work_date: string;
  start_kilometers: number | null;
  end_kilometers: number | null;
}

export interface DetailedWorkDayReportRow {
  work_log_day_id: number;
  user_id: number;
  user: string;
  role: string;
  work_date: string;
  status: WorkLogStatus;
  plan: string | null;
  summary: string | null;
  absence_reason: string | null;
  start_kilometers: number | null;
  end_kilometers: number | null;
  kilometers_driven: number | null;
  fuel_cost: number | null;
  fuel_liters: number | null;
  other_travel_cost: number | null;
  report_photo_count: number;
  podravka_facing_count: number;
  competitor_facing_count: number;
  city_count: number;
  activity_count: number;
  cities: Array<{
    city_name: string;
    visit_order: number | null;
    note: string | null;
  }>;
  activities: Array<{
    activity_type: WorkActivityType;
    planned: boolean;
    completed: boolean;
    note: string | null;
  }>;
}

const VALID_STATUSES = new Set<WorkLogStatus>([
  "planned_work",
  "vacation",
  "sick_day",
  "other",
]);

const VALID_ACTIVITY_TYPES = new Set<WorkActivityType>([
  "ppl",
  "photo_report",
  "store_visit",
]);

const normalizeNullableText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const normalizeBoolean = (value: unknown, defaultValue: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return defaultValue;
};

export const validateWorkLogPayload = (payload: WorkLogDayInput): string | null => {
  if (!payload.work_date || Number.isNaN(Date.parse(payload.work_date))) {
    return "work_date is required and must be a valid date";
  }

  if (payload.status && !VALID_STATUSES.has(payload.status)) {
    return "Invalid work log status";
  }

  const numericFields = [
    payload.start_kilometers,
    payload.end_kilometers,
    payload.kilometers_driven,
    payload.fuel_cost,
    payload.fuel_liters,
    payload.other_travel_cost,
  ];

  if (numericFields.some((value) => Number.isNaN(normalizeNullableNumber(value)))) {
    return "Numeric work log fields must contain valid numbers";
  }

  if (numericFields.some((value) => {
    const parsed = normalizeNullableNumber(value);
    return parsed !== null && parsed < 0;
  })) {
    return "Numeric work log fields cannot be negative";
  }

  const startKm = normalizeNullableNumber(payload.start_kilometers);
  const endKm = normalizeNullableNumber(payload.end_kilometers);

  if (startKm !== null && endKm !== null && endKm < startKm) {
    return "end_kilometers cannot be lower than start_kilometers";
  }

  if (payload.activities && !Array.isArray(payload.activities)) {
    return "activities must be an array";
  }

  if (payload.cities && !Array.isArray(payload.cities)) {
    return "cities must be an array";
  }

  for (const activity of payload.activities || []) {
    if (!activity.activity_type || !VALID_ACTIVITY_TYPES.has(activity.activity_type)) {
      return "Invalid activity type";
    }

    if (
      activity.note !== undefined &&
      activity.note !== null &&
      typeof activity.note !== "string"
    ) {
      return "Activity note must be a string";
    }
  }

  for (const city of payload.cities || []) {
    if (!city.city_name || typeof city.city_name !== "string" || !city.city_name.trim()) {
      return "Each city must include a city_name";
    }

    if (
      city.visit_order !== undefined &&
      city.visit_order !== null &&
      !Number.isInteger(Number(city.visit_order))
    ) {
      return "City visit_order must be an integer";
    }

    if (city.note !== undefined && city.note !== null && typeof city.note !== "string") {
      return "City note must be a string";
    }
  }

  return null;
};

// The distance driven is audit data, so it is always derived from the odometer
// readings rather than trusted from the client. Falls back to the submitted
// value only when one of the two readings is missing.
const resolveKilometersDriven = (payload: WorkLogDayInput): number | null => {
  const startKm = normalizeNullableNumber(payload.start_kilometers);
  const endKm = normalizeNullableNumber(payload.end_kilometers);

  if (startKm !== null && endKm !== null) {
    return endKm - startKm;
  }

  return normalizeNullableNumber(payload.kilometers_driven);
};

const mapActivityValues = (workLogDayId: number, activities: WorkLogActivityInput[]) =>
  activities.map((activity) => {
    const now = new Date();

    return [
      workLogDayId,
      activity.activity_type,
      normalizeBoolean(activity.planned, true) ? 1 : 0,
      normalizeBoolean(activity.completed, false) ? 1 : 0,
      normalizeNullableText(activity.note),
      now,
    ];
  });

const mapCityValues = (workLogDayId: number, cities: WorkLogDayCityInput[]) =>
  cities.map((city, index) => [
    workLogDayId,
    city.city_name.trim(),
    city.visit_order ?? index + 1,
    normalizeNullableText(city.note),
  ]);

const loadWorkLogDay = async (workLogDayId: number, requestingUserId?: number, isAdmin?: boolean) => {
  // The filter and its placeholder must be added together, otherwise a missing
  // requestingUserId leaves an unbound "?" in the statement.
  const scopeToUser = !isAdmin;
  const params: Array<number> = [workLogDayId];

  if (scopeToUser) {
    if (!requestingUserId) {
      return null;
    }
    params.push(requestingUserId);
  }

  const accessFilter = scopeToUser ? "AND wld.user_id = ?" : "";

  const [dayRows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT
        wld.work_log_day_id,
        wld.user_id,
        u.user,
        u.role,
        wld.work_date,
        wld.status,
        wld.plan,
        wld.summary,
        wld.absence_reason,
        wld.start_kilometers,
        wld.end_kilometers,
        wld.kilometers_driven,
        wld.fuel_cost,
        wld.fuel_liters,
        wld.other_travel_cost,
        wld.created_at,
        wld.updated_at,
        COUNT(DISTINCT rp.photo_id) AS report_photo_count,
        COUNT(DISTINCT pf.podravka_facings_id) AS podravka_facing_count,
        COUNT(DISTINCT cf.id) AS competitor_facing_count
      FROM work_log_days wld
      JOIN users u ON u.user_id = wld.user_id
      LEFT JOIN report_photos rp ON rp.work_log_day_id = wld.work_log_day_id
      LEFT JOIN podravka_facings pf ON pf.work_log_day_id = wld.work_log_day_id
      LEFT JOIN competitor_facings cf ON cf.work_log_day_id = wld.work_log_day_id
      WHERE wld.work_log_day_id = ? ${accessFilter}
      GROUP BY
        wld.work_log_day_id, wld.user_id, u.user, u.role, wld.work_date, wld.status,
        wld.plan, wld.summary, wld.absence_reason, wld.start_kilometers, wld.end_kilometers,
        wld.kilometers_driven, wld.fuel_cost, wld.fuel_liters, wld.other_travel_cost,
        wld.created_at, wld.updated_at
    `,
    params
  );

  if (!dayRows.length) {
    return null;
  }

  const [activityRows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT
        work_log_activity_id,
        work_log_day_id,
        activity_type,
        planned,
        completed,
        quantity,
        note,
        created_at,
        updated_at
      FROM work_log_activities
      WHERE work_log_day_id = ?
      ORDER BY work_log_activity_id ASC
    `,
    [workLogDayId]
  );

  const [cityRows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT
        work_log_day_city_id,
        work_log_day_id,
        city_name,
        visit_order,
        note,
        created_at
      FROM work_log_day_cities
      WHERE work_log_day_id = ?
      ORDER BY
        CASE WHEN visit_order IS NULL THEN 1 ELSE 0 END,
        visit_order ASC,
        work_log_day_city_id ASC
    `,
    [workLogDayId]
  );

  return {
    ...dayRows[0],
    activities: activityRows,
    cities: cityRows,
  };
};

export const createWorkLogDay = async (userId: number, payload: WorkLogDayInput) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO work_log_days (
          user_id,
          work_date,
          status,
          plan,
          summary,
          absence_reason,
          start_kilometers,
          end_kilometers,
          kilometers_driven,
          fuel_cost,
          fuel_liters,
          other_travel_cost,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        userId,
        payload.work_date,
        payload.status || "planned_work",
        normalizeNullableText(payload.plan),
        normalizeNullableText(payload.summary),
        normalizeNullableText(payload.absence_reason),
        normalizeNullableNumber(payload.start_kilometers),
        normalizeNullableNumber(payload.end_kilometers),
        resolveKilometersDriven(payload),
        normalizeNullableNumber(payload.fuel_cost),
        normalizeNullableNumber(payload.fuel_liters),
        normalizeNullableNumber(payload.other_travel_cost),
      ]
    );

    const workLogDayId = result.insertId;
    const activities = payload.activities || [];
    const cities = payload.cities || [];

    if (activities.length) {
      const values = mapActivityValues(workLogDayId, activities);
      await connection.query(
        `
          INSERT INTO work_log_activities (
            work_log_day_id,
            activity_type,
            planned,
            completed,
            note,
            updated_at
          ) VALUES ?
        `,
        [values]
      );
    }

    if (cities.length) {
      const values = mapCityValues(workLogDayId, cities);
      await connection.query(
        `
          INSERT INTO work_log_day_cities (
            work_log_day_id,
            city_name,
            visit_order,
            note
          ) VALUES ?
        `,
        [values]
      );
    }

    await connection.commit();
    return loadWorkLogDay(workLogDayId, userId, true);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateWorkLogDay = async (
  workLogDayId: number,
  userId: number,
  payload: WorkLogDayInput,
  isAdmin: boolean
) => {
  const existing = await loadWorkLogDay(workLogDayId, userId, isAdmin);
  if (!existing) {
    return null;
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        UPDATE work_log_days
        SET
          work_date = ?,
          status = ?,
          plan = ?,
          summary = ?,
          absence_reason = ?,
          start_kilometers = ?,
          end_kilometers = ?,
          kilometers_driven = ?,
          fuel_cost = ?,
          fuel_liters = ?,
          other_travel_cost = ?
        WHERE work_log_day_id = ?
      `,
      [
        payload.work_date,
        payload.status || "planned_work",
        normalizeNullableText(payload.plan),
        normalizeNullableText(payload.summary),
        normalizeNullableText(payload.absence_reason),
        normalizeNullableNumber(payload.start_kilometers),
        normalizeNullableNumber(payload.end_kilometers),
        resolveKilometersDriven(payload),
        normalizeNullableNumber(payload.fuel_cost),
        normalizeNullableNumber(payload.fuel_liters),
        normalizeNullableNumber(payload.other_travel_cost),
        workLogDayId,
      ]
    );

    if (payload.activities) {
      await connection.execute("DELETE FROM work_log_activities WHERE work_log_day_id = ?", [
        workLogDayId,
      ]);

      if (payload.activities.length) {
        const values = mapActivityValues(workLogDayId, payload.activities);
        await connection.query(
          `
            INSERT INTO work_log_activities (
              work_log_day_id,
              activity_type,
              planned,
              completed,
              note,
              updated_at
            ) VALUES ?
          `,
          [values]
        );
      }
    }

    if (payload.cities) {
      await connection.execute("DELETE FROM work_log_day_cities WHERE work_log_day_id = ?", [
        workLogDayId,
      ]);

      if (payload.cities.length) {
        const values = mapCityValues(workLogDayId, payload.cities);
        await connection.query(
          `
            INSERT INTO work_log_day_cities (
              work_log_day_id,
              city_name,
              visit_order,
              note
            ) VALUES ?
          `,
          [values]
        );
      }
    }

    await connection.commit();
    return loadWorkLogDay(workLogDayId, userId, isAdmin);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const deleteWorkLogDay = async (workLogDayId: number, userId: number, isAdmin: boolean) => {
  const existing = await loadWorkLogDay(workLogDayId, userId, isAdmin);
  if (!existing) {
    return false;
  }

  await db.promise().execute("DELETE FROM work_log_days WHERE work_log_day_id = ?", [workLogDayId]);
  return true;
};

export const getWorkLogDayById = async (workLogDayId: number, userId: number, isAdmin: boolean) =>
  loadWorkLogDay(workLogDayId, userId, isAdmin);

export const getLatestWorkDayKilometers = async ({
  requestingUserId,
  isAdmin,
  targetUserId,
  upToDate,
}: {
  requestingUserId: number;
  isAdmin: boolean;
  targetUserId?: number;
  upToDate?: string;
}): Promise<LatestWorkDayKilometers | null> => {
  const params: Array<string | number> = [];
  const where: string[] = [];

  if (isAdmin) {
    if (targetUserId) {
      where.push("wld.user_id = ?");
      params.push(targetUserId);
    }
  } else {
    where.push("wld.user_id = ?");
    params.push(requestingUserId);
  }

  if (upToDate) {
    where.push("wld.work_date <= ?");
    params.push(upToDate);
  }

  where.push("(wld.end_kilometers IS NOT NULL OR wld.start_kilometers IS NOT NULL)");

  const whereClause = `WHERE ${where.join(" AND ")}`;

  const [rows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT
        wld.work_log_day_id,
        wld.work_date,
        wld.start_kilometers,
        wld.end_kilometers
      FROM work_log_days wld
      ${whereClause}
      ORDER BY wld.work_date DESC, wld.work_log_day_id DESC
      LIMIT 1
    `,
    params
  );

  return rows[0]
    ? {
        work_log_day_id: Number(rows[0].work_log_day_id),
        work_date: String(rows[0].work_date),
        start_kilometers:
          rows[0].start_kilometers === null ? null : Number(rows[0].start_kilometers),
        end_kilometers:
          rows[0].end_kilometers === null ? null : Number(rows[0].end_kilometers),
      }
    : null;
};

export const listWorkLogDays = async ({
  requestingUserId,
  isAdmin,
  targetUserId,
  startDate,
  endDate,
  status,
}: {
  requestingUserId: number;
  isAdmin: boolean;
  targetUserId?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}) => {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (isAdmin) {
    if (targetUserId) {
      where.push("wld.user_id = ?");
      params.push(targetUserId);
    }
  } else {
    where.push("wld.user_id = ?");
    params.push(requestingUserId);
  }

  if (startDate) {
    where.push("wld.work_date >= ?");
    params.push(startDate);
  }

  if (endDate) {
    where.push("wld.work_date <= ?");
    params.push(endDate);
  }

  if (status && VALID_STATUSES.has(status as WorkLogStatus)) {
    where.push("wld.status = ?");
    params.push(status);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT
        wld.work_log_day_id,
        wld.user_id,
        u.user,
        u.role,
        wld.work_date,
        wld.status,
        wld.plan,
        wld.summary,
        wld.absence_reason,
        wld.start_kilometers,
        wld.end_kilometers,
        wld.kilometers_driven,
        wld.fuel_cost,
        wld.fuel_liters,
        wld.other_travel_cost,
        wld.created_at,
        wld.updated_at,
        COUNT(DISTINCT wla.work_log_activity_id) AS activity_count,
        COUNT(DISTINCT wlc.work_log_day_city_id) AS city_count,
        COUNT(DISTINCT rp.photo_id) AS report_photo_count,
        COUNT(DISTINCT pf.podravka_facings_id) AS podravka_facing_count,
        COUNT(DISTINCT cf.id) AS competitor_facing_count
      FROM work_log_days wld
      JOIN users u ON u.user_id = wld.user_id
      LEFT JOIN work_log_activities wla ON wla.work_log_day_id = wld.work_log_day_id
      LEFT JOIN work_log_day_cities wlc ON wlc.work_log_day_id = wld.work_log_day_id
      LEFT JOIN report_photos rp ON rp.work_log_day_id = wld.work_log_day_id
      LEFT JOIN podravka_facings pf ON pf.work_log_day_id = wld.work_log_day_id
      LEFT JOIN competitor_facings cf ON cf.work_log_day_id = wld.work_log_day_id
      ${whereClause}
      GROUP BY
        wld.work_log_day_id, wld.user_id, u.user, u.role, wld.work_date, wld.status,
        wld.plan, wld.summary, wld.absence_reason, wld.start_kilometers, wld.end_kilometers,
        wld.kilometers_driven, wld.fuel_cost, wld.fuel_liters, wld.other_travel_cost,
        wld.created_at, wld.updated_at
      ORDER BY wld.work_date DESC, wld.work_log_day_id DESC
    `,
    params
  );

  return rows;
};

export const getDetailedWorkDayReport = async ({
  requestingUserId,
  isAdmin,
  targetUserIds,
  startDate,
  endDate,
  status,
  limit,
  offset,
}: {
  requestingUserId: number;
  isAdmin: boolean;
  targetUserIds?: number[];
  startDate?: string;
  endDate?: string;
  status?: string;
  limit: number;
  offset: number;
}): Promise<{ data: DetailedWorkDayReportRow[]; total: number }> => {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (isAdmin) {
    if (targetUserIds?.length) {
      where.push(`wld.user_id IN (${targetUserIds.map(() => "?").join(",")})`);
      params.push(...targetUserIds);
    }
  } else {
    where.push("wld.user_id = ?");
    params.push(requestingUserId);
  }

  if (startDate) {
    where.push("wld.work_date >= ?");
    params.push(startDate);
  }

  if (endDate) {
    where.push("wld.work_date <= ?");
    params.push(endDate);
  }

  if (status && VALID_STATUSES.has(status as WorkLogStatus)) {
    where.push("wld.status = ?");
    params.push(status);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [countRows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT COUNT(*) AS total
      FROM work_log_days wld
      ${whereClause}
    `,
    params
  );

  const [rows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT
        wld.work_log_day_id,
        wld.user_id,
        u.user,
        u.role,
        wld.work_date,
        wld.status,
        wld.plan,
        wld.summary,
        wld.absence_reason,
        wld.start_kilometers,
        wld.end_kilometers,
        wld.kilometers_driven,
        wld.fuel_cost,
        wld.fuel_liters,
        wld.other_travel_cost,
        COUNT(DISTINCT rp.photo_id) AS report_photo_count,
        COUNT(DISTINCT pf.podravka_facings_id) AS podravka_facing_count,
        COUNT(DISTINCT cf.id) AS competitor_facing_count,
        COUNT(DISTINCT wlc.work_log_day_city_id) AS city_count,
        COUNT(DISTINCT wla.work_log_activity_id) AS activity_count
      FROM work_log_days wld
      JOIN users u ON u.user_id = wld.user_id
      LEFT JOIN report_photos rp ON rp.work_log_day_id = wld.work_log_day_id
      LEFT JOIN podravka_facings pf ON pf.work_log_day_id = wld.work_log_day_id
      LEFT JOIN competitor_facings cf ON cf.work_log_day_id = wld.work_log_day_id
      LEFT JOIN work_log_day_cities wlc ON wlc.work_log_day_id = wld.work_log_day_id
      LEFT JOIN work_log_activities wla ON wla.work_log_day_id = wld.work_log_day_id
      ${whereClause}
      GROUP BY
        wld.work_log_day_id, wld.user_id, u.user, u.role, wld.work_date, wld.status,
        wld.plan, wld.summary, wld.absence_reason, wld.start_kilometers, wld.end_kilometers,
        wld.kilometers_driven, wld.fuel_cost, wld.fuel_liters, wld.other_travel_cost
      ORDER BY wld.work_date DESC, wld.work_log_day_id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const workLogDayIds = rows.map((row) => Number(row.work_log_day_id));

  if (!workLogDayIds.length) {
    return { data: [], total: Number(countRows[0]?.total || 0) };
  }

  const placeholders = workLogDayIds.map(() => "?").join(",");

  const [activityRows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT work_log_day_id, activity_type, planned, completed, note
      FROM work_log_activities
      WHERE work_log_day_id IN (${placeholders})
      ORDER BY work_log_activity_id ASC
    `,
    workLogDayIds
  );

  const [cityRows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT work_log_day_id, city_name, visit_order, note
      FROM work_log_day_cities
      WHERE work_log_day_id IN (${placeholders})
      ORDER BY
        CASE WHEN visit_order IS NULL THEN 1 ELSE 0 END,
        visit_order ASC,
        work_log_day_city_id ASC
    `,
    workLogDayIds
  );

  const activitiesByDay = new Map<number, DetailedWorkDayReportRow["activities"]>();
  const citiesByDay = new Map<number, DetailedWorkDayReportRow["cities"]>();

  for (const row of activityRows) {
    const dayId = Number(row.work_log_day_id);
    const list = activitiesByDay.get(dayId) || [];
    list.push({
      activity_type: row.activity_type as WorkActivityType,
      planned: Boolean(row.planned),
      completed: Boolean(row.completed),
      note: row.note ?? null,
    });
    activitiesByDay.set(dayId, list);
  }

  for (const row of cityRows) {
    const dayId = Number(row.work_log_day_id);
    const list = citiesByDay.get(dayId) || [];
    list.push({
      city_name: String(row.city_name),
      visit_order: row.visit_order === null ? null : Number(row.visit_order),
      note: row.note ?? null,
    });
    citiesByDay.set(dayId, list);
  }

  return {
    total: Number(countRows[0]?.total || 0),
    data: rows.map((row) => {
      const dayId = Number(row.work_log_day_id);
      return {
        work_log_day_id: dayId,
        user_id: Number(row.user_id),
        user: String(row.user),
        role: String(row.role),
        work_date: String(row.work_date),
        status: row.status as WorkLogStatus,
        plan: row.plan ?? null,
        summary: row.summary ?? null,
        absence_reason: row.absence_reason ?? null,
        start_kilometers: row.start_kilometers === null ? null : Number(row.start_kilometers),
        end_kilometers: row.end_kilometers === null ? null : Number(row.end_kilometers),
        kilometers_driven: row.kilometers_driven === null ? null : Number(row.kilometers_driven),
        fuel_cost: row.fuel_cost === null ? null : Number(row.fuel_cost),
        fuel_liters: row.fuel_liters === null ? null : Number(row.fuel_liters),
        other_travel_cost:
          row.other_travel_cost === null ? null : Number(row.other_travel_cost),
        report_photo_count: Number(row.report_photo_count || 0),
        podravka_facing_count: Number(row.podravka_facing_count || 0),
        competitor_facing_count: Number(row.competitor_facing_count || 0),
        city_count: Number(row.city_count || 0),
        activity_count: Number(row.activity_count || 0),
        cities: citiesByDay.get(dayId) || [],
        activities: activitiesByDay.get(dayId) || [],
      };
    }),
  };
};
