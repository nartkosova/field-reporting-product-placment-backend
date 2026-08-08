import db from "../models/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";

// Servers usually run in UTC while the field team works in local time, so
// toISOString() would file anything logged before the UTC rollover under the
// previous day. Resolve "today" in the app's own timezone instead.
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Belgrade";

const todayInAppTimezone = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const normalizeWorkDate = (value?: string | null): string => {
  if (value && !Number.isNaN(Date.parse(value))) {
    return value.slice(0, 10);
  }

  return todayInAppTimezone();
};

export const resolveWorkLogDayId = async ({
  userId,
  workLogDayId,
  workDate,
}: {
  userId: number;
  workLogDayId?: number | null;
  workDate?: string | null;
}): Promise<number> => {
  if (workLogDayId) {
    const [rows] = await db.promise().query<RowDataPacket[]>(
      `
        SELECT work_log_day_id
        FROM work_log_days
        WHERE work_log_day_id = ? AND user_id = ?
        LIMIT 1
      `,
      [workLogDayId, userId]
    );

    if (!rows.length) {
      throw new Error("WORK_LOG_DAY_NOT_FOUND");
    }

    return Number(rows[0].work_log_day_id);
  }

  const normalizedDate = normalizeWorkDate(workDate);

  const [existingRows] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT work_log_day_id
      FROM work_log_days
      WHERE user_id = ? AND work_date = ?
      LIMIT 1
    `,
    [userId, normalizedDate]
  );

  if (existingRows.length) {
    return Number(existingRows[0].work_log_day_id);
  }

  try {
    const [result] = await db.promise().execute<ResultSetHeader>(
      `
        INSERT INTO work_log_days (user_id, work_date, status)
        VALUES (?, ?, 'planned_work')
      `,
      [userId, normalizedDate]
    );

    return result.insertId;
  } catch (error: any) {
    // Concurrent uploads for the same day (photos and facings sync in
    // parallel) can both pass the SELECT above and race on the
    // uniq_user_work_date constraint. The loser re-reads the winner's row.
    if (error?.code !== "ER_DUP_ENTRY") {
      throw error;
    }

    const [rows] = await db.promise().query<RowDataPacket[]>(
      `
        SELECT work_log_day_id
        FROM work_log_days
        WHERE user_id = ? AND work_date = ?
        LIMIT 1
      `,
      [userId, normalizedDate]
    );

    if (!rows.length) {
      throw error;
    }

    return Number(rows[0].work_log_day_id);
  }
};
