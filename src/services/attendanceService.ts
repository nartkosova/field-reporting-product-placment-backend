import db from "../models/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";

// Field reps are expected on the road between these local times. All checks
// run in the app's timezone because the server itself usually runs in UTC.
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Belgrade";
const WORK_START = process.env.WORK_START || "08:00";
const WORK_END = process.env.WORK_END || "16:00";
const LATE_GRACE_MINUTES = Number(process.env.WORK_LATE_GRACE_MINUTES || 15);
const MIN_VISIT_MINUTES = Number(process.env.MIN_VISIT_MINUTES || 5);
const LONG_GAP_MINUTES = Number(process.env.LONG_GAP_MINUTES || 90);
// Days before attendance tracking existed have no check-ins by design and
// must not be reported as violations.
const ATTENDANCE_START_DATE = process.env.ATTENDANCE_START_DATE || "2026-10-20";
// Uploads a few minutes before check-in or after check-out still count as
// part of the visit (slow networks, forgetting to tap "leave" right away).
const ACTIVITY_SLACK_MS = 10 * 60 * 1000;

export class AttendanceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type VerificationFlag =
  | "no_check_in"
  | "late_check_in"
  | "no_check_out"
  | "early_check_out"
  | "short_day"
  | "no_visits"
  | "open_visit"
  | "short_visit"
  | "activity_outside_visit"
  | "long_gap"
  | "no_arrival_photo";

export interface StoreVisitRow {
  store_visit_id: number;
  work_log_day_id: number;
  store_id: number;
  store_name: string;
  store_code: string;
  check_in_at: string;
  check_out_at: string | null;
  duration_minutes: number | null;
  activity_count: number;
  photos: Array<{ store_visit_photo_id: number; photo_url: string; created_at: string }>;
}

export interface GalleryPhoto {
  photo_url: string;
  kind: "presence" | "report";
  label: string;
  store_name: string | null;
  created_at: string;
}

export interface DayVerification {
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
  in_store_minutes: number;
  longest_gap_minutes: number | null;
  // Past day checked in but never checked out: the last recorded activity
  // (visit, PPL, photo) stands in for the end. Never stored, never a real
  // check-out; reports label it as an estimate.
  estimated_check_out_at: string | null;
  visit_count: number;
  photo_visit_count: number;
  activities_outside_visit: number;
  visits: StoreVisitRow[];
  flags: VerificationFlag[];
  verification_status: "ok" | "warning" | "critical" | "absence" | "legacy";
  gallery: GalleryPhoto[];
  expected_start: string;
  expected_end: string;
}

const toNumberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const toIsoOrNull = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const parseClock = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + (minutes || 0);
};

const minutesInAppTimezone = (date: Date): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
};

export const todayInAppTimezone = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const formatDateOnly = (value: unknown): string => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
};

// Check-ins only make sense live: the owner, today, on a working day.
const loadOwnTodayDay = async (workLogDayId: number, userId: number) => {
  const [rows] = await db.promise().query<RowDataPacket[]>(
    `SELECT work_log_day_id, user_id, work_date, status, check_in_at, check_out_at
     FROM work_log_days
     WHERE work_log_day_id = ? AND user_id = ?
     LIMIT 1`,
    [workLogDayId, userId]
  );

  const day = rows[0];
  if (!day) {
    throw new AttendanceError(404, "Dita e punës nuk u gjet.");
  }

  if (formatDateOnly(day.work_date) !== todayInAppTimezone()) {
    throw new AttendanceError(400, "Check-in lejohet vetëm për ditën e sotme.");
  }

  if (day.status !== "planned_work") {
    throw new AttendanceError(400, "Check-in lejohet vetëm për ditë pune.");
  }

  return day;
};

const loadOpenVisit = async (workLogDayId: number) => {
  const [rows] = await db.promise().query<RowDataPacket[]>(
    `SELECT store_visit_id, store_id
     FROM store_visits
     WHERE work_log_day_id = ? AND check_out_at IS NULL
     ORDER BY check_in_at DESC
     LIMIT 1`,
    [workLogDayId]
  );
  return rows[0] || null;
};

export const checkInDay = async (workLogDayId: number, userId: number) => {
  const day = await loadOwnTodayDay(workLogDayId, userId);

  if (day.check_in_at) {
    throw new AttendanceError(409, "Dita është nisur tashmë.");
  }

  // The time is always taken from the server clock, never from the device.
  await db.promise().execute(
    `UPDATE work_log_days
     SET check_in_at = CURRENT_TIMESTAMP
     WHERE work_log_day_id = ? AND check_in_at IS NULL`,
    [workLogDayId]
  );

  return getAttendanceForDay(workLogDayId, userId, false);
};

export const checkOutDay = async (workLogDayId: number, userId: number) => {
  const day = await loadOwnTodayDay(workLogDayId, userId);

  if (!day.check_in_at) {
    throw new AttendanceError(400, "Fillo ditën para se ta mbyllësh.");
  }

  if (day.check_out_at) {
    throw new AttendanceError(409, "Dita është mbyllur tashmë.");
  }

  if (await loadOpenVisit(workLogDayId)) {
    throw new AttendanceError(409, "Dil nga marketi aktual para se ta mbyllësh ditën.");
  }

  await db.promise().execute(
    `UPDATE work_log_days
     SET check_out_at = CURRENT_TIMESTAMP
     WHERE work_log_day_id = ? AND check_out_at IS NULL`,
    [workLogDayId]
  );

  return getAttendanceForDay(workLogDayId, userId, false);
};

// Undoes an accidental or early check-out on the same day. The original
// start time is kept; the day simply has no end until the next check-out.
export const reopenDay = async (workLogDayId: number, userId: number) => {
  const day = await loadOwnTodayDay(workLogDayId, userId);

  if (!day.check_out_at) {
    throw new AttendanceError(409, "Dita është ende e hapur.");
  }

  await db.promise().execute(
    `UPDATE work_log_days SET check_out_at = NULL
     WHERE work_log_day_id = ? AND check_out_at IS NOT NULL`,
    [workLogDayId]
  );

  return getAttendanceForDay(workLogDayId, userId, false);
};

export const startStoreVisit = async (
  workLogDayId: number,
  userId: number,
  storeId: number
) => {
  const day = await loadOwnTodayDay(workLogDayId, userId);

  if (!day.check_in_at) {
    throw new AttendanceError(400, "Fillo ditën (check-in) para se të hysh në market.");
  }

  if (day.check_out_at) {
    throw new AttendanceError(400, "Dita është mbyllur. Nuk mund të hysh në market.");
  }

  const openVisit = await loadOpenVisit(workLogDayId);
  if (openVisit) {
    throw new AttendanceError(409, "Je ende në një market tjetër. Dil prej tij fillimisht.");
  }

  const [storeRows] = await db.promise().query<RowDataPacket[]>(
    `SELECT store_id FROM stores WHERE store_id = ? LIMIT 1`,
    [storeId]
  );
  if (!storeRows[0]) {
    throw new AttendanceError(404, "Marketi nuk u gjet.");
  }

  const [result] = await db.promise().execute<ResultSetHeader>(
    `INSERT INTO store_visits (work_log_day_id, user_id, store_id, check_in_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [workLogDayId, userId, storeId]
  );

  return { store_visit_id: result.insertId };
};

// Photos are only accepted while the visit is open, so they prove presence
// at the time of the visit rather than being uploaded later from the gallery.
export const addStoreVisitPhoto = async (
  workLogDayId: number,
  userId: number,
  storeVisitId: number,
  photoUrl: string,
  publicId: string | null
) => {
  await loadOwnTodayDay(workLogDayId, userId);

  const [rows] = await db.promise().query<RowDataPacket[]>(
    `SELECT store_visit_id, check_out_at FROM store_visits
     WHERE store_visit_id = ? AND work_log_day_id = ? AND user_id = ?
     LIMIT 1`,
    [storeVisitId, workLogDayId, userId]
  );

  if (!rows[0]) {
    throw new AttendanceError(404, "Vizita nuk u gjet.");
  }

  if (rows[0].check_out_at) {
    throw new AttendanceError(409, "Fotot lejohen vetëm gjatë vizitës.");
  }

  await db.promise().execute(
    `INSERT INTO store_visit_photos (store_visit_id, user_id, photo_url, public_id)
     VALUES (?, ?, ?, ?)`,
    [storeVisitId, userId, photoUrl, publicId]
  );
};

export const endStoreVisit = async (
  workLogDayId: number,
  userId: number,
  storeVisitId: number
) => {
  await loadOwnTodayDay(workLogDayId, userId);

  const [rows] = await db.promise().query<RowDataPacket[]>(
    `SELECT store_visit_id, check_out_at
     FROM store_visits
     WHERE store_visit_id = ? AND work_log_day_id = ? AND user_id = ?
     LIMIT 1`,
    [storeVisitId, workLogDayId, userId]
  );
  const visit = rows[0];

  if (!visit) {
    throw new AttendanceError(404, "Vizita nuk u gjet.");
  }

  if (visit.check_out_at) {
    throw new AttendanceError(409, "Ke dalë tashmë nga ky market.");
  }

  await db.promise().execute(
    `UPDATE store_visits
     SET check_out_at = CURRENT_TIMESTAMP
     WHERE store_visit_id = ? AND check_out_at IS NULL`,
    [storeVisitId]
  );

  return { store_visit_id: storeVisitId };
};

type DayRow = RowDataPacket & {
  work_log_day_id: number;
  status: string;
  work_date?: unknown;
};

// Builds the verification summary (times, visits, red flags) for each day.
export const buildDayVerifications = async (
  days: DayRow[]
): Promise<Map<number, DayVerification>> => {
  const result = new Map<number, DayVerification>();
  const dayIds = days.map((day) => Number(day.work_log_day_id));

  if (!dayIds.length) return result;

  const placeholders = dayIds.map(() => "?").join(",");

  const [[dayRows], [visitRows], [activityRows], [photoRows], [reportPhotoRows]] = await Promise.all([
    db.promise().query<RowDataPacket[]>(
      `SELECT work_log_day_id, work_date, check_in_at, check_out_at
       FROM work_log_days
       WHERE work_log_day_id IN (${placeholders})`,
      dayIds
    ),
    db.promise().query<RowDataPacket[]>(
      `SELECT sv.store_visit_id, sv.work_log_day_id, sv.store_id, sv.check_in_at,
              sv.check_out_at, s.store_name, s.store_code
       FROM store_visits sv
       JOIN stores s ON s.store_id = sv.store_id
       WHERE sv.work_log_day_id IN (${placeholders})
       ORDER BY sv.check_in_at ASC, sv.store_visit_id ASC`,
      dayIds
    ),
    // Every upload is tied to a store and a timestamp, which lets us check it
    // was made while the rep was actually checked in at that store.
    db.promise().query<RowDataPacket[]>(
      `SELECT work_log_day_id, store_id, created_at FROM report_photos
         WHERE work_log_day_id IN (${placeholders})
       UNION ALL
       SELECT work_log_day_id, store_id, MIN(created_at) FROM podravka_facings
         WHERE work_log_day_id IN (${placeholders})
         GROUP BY work_log_day_id, store_id, batch_id
       UNION ALL
       SELECT work_log_day_id, store_id, MIN(created_at) FROM competitor_facings
         WHERE work_log_day_id IN (${placeholders})
         GROUP BY work_log_day_id, store_id, batch_id`,
      [...dayIds, ...dayIds, ...dayIds]
    ),
    db.promise().query<RowDataPacket[]>(
      `SELECT svp.store_visit_photo_id, svp.store_visit_id, svp.photo_url, svp.created_at
       FROM store_visit_photos svp
       JOIN store_visits sv ON sv.store_visit_id = svp.store_visit_id
       WHERE sv.work_log_day_id IN (${placeholders})
       ORDER BY svp.created_at ASC`,
      dayIds
    ),
    db.promise().query<RowDataPacket[]>(
      `SELECT rp.work_log_day_id, rp.photo_url, rp.photo_type, rp.category,
              rp.created_at, s.store_name
       FROM report_photos rp
       LEFT JOIN stores s ON s.store_id = rp.store_id
       WHERE rp.work_log_day_id IN (${placeholders})
       ORDER BY rp.created_at ASC`,
      dayIds
    ),
  ]);

  const reportPhotosByDay = new Map<number, GalleryPhoto[]>();
  for (const row of reportPhotoRows) {
    const dayId = Number(row.work_log_day_id);
    reportPhotosByDay.set(dayId, [
      ...(reportPhotosByDay.get(dayId) || []),
      {
        photo_url: String(row.photo_url),
        kind: "report",
        label: [row.photo_type, row.category].filter(Boolean).join(" · "),
        store_name: row.store_name ?? null,
        created_at: new Date(row.created_at).toISOString(),
      },
    ]);
  }

  const photosByVisit = new Map<number, StoreVisitRow["photos"]>();
  for (const row of photoRows) {
    const visitId = Number(row.store_visit_id);
    photosByVisit.set(visitId, [
      ...(photosByVisit.get(visitId) || []),
      {
        store_visit_photo_id: Number(row.store_visit_photo_id),
        photo_url: String(row.photo_url),
        created_at: new Date(row.created_at).toISOString(),
      },
    ]);
  }

  const dayDetails = new Map(dayRows.map((row) => [Number(row.work_log_day_id), row]));
  const visitsByDay = new Map<number, RowDataPacket[]>();
  for (const row of visitRows) {
    const dayId = Number(row.work_log_day_id);
    visitsByDay.set(dayId, [...(visitsByDay.get(dayId) || []), row]);
  }
  const activitiesByDay = new Map<number, RowDataPacket[]>();
  for (const row of activityRows) {
    const dayId = Number(row.work_log_day_id);
    activitiesByDay.set(dayId, [...(activitiesByDay.get(dayId) || []), row]);
  }

  const startLimit = parseClock(WORK_START);
  const endLimit = parseClock(WORK_END);
  const expectedMinutes = endLimit - startLimit;
  const now = Date.now();

  for (const day of days) {
    const dayId = Number(day.work_log_day_id);
    const detail: RowDataPacket = dayDetails.get(dayId) || ({} as RowDataPacket);
    const checkIn = detail.check_in_at ? new Date(detail.check_in_at) : null;
    const checkOut = detail.check_out_at ? new Date(detail.check_out_at) : null;
    const rawVisits = visitsByDay.get(dayId) || [];
    const activities = activitiesByDay.get(dayId) || [];
    const flags = new Set<VerificationFlag>();

    let activitiesOutside = 0;
    const visitActivityCounts = new Map<number, number>();
    for (const activity of activities) {
      const createdAt = new Date(activity.created_at).getTime();
      const match = rawVisits.find((visit) => {
        if (Number(visit.store_id) !== Number(activity.store_id)) return false;
        const start = new Date(visit.check_in_at).getTime() - ACTIVITY_SLACK_MS;
        const end = visit.check_out_at
          ? new Date(visit.check_out_at).getTime() + ACTIVITY_SLACK_MS
          : Infinity;
        return createdAt >= start && createdAt <= end;
      });

      if (match) {
        const id = Number(match.store_visit_id);
        visitActivityCounts.set(id, (visitActivityCounts.get(id) || 0) + 1);
      } else {
        activitiesOutside += 1;
      }
    }

    const visits: StoreVisitRow[] = rawVisits.map((visit) => {
      const start = new Date(visit.check_in_at);
      const end = visit.check_out_at ? new Date(visit.check_out_at) : null;
      return {
        store_visit_id: Number(visit.store_visit_id),
        work_log_day_id: dayId,
        store_id: Number(visit.store_id),
        store_name: String(visit.store_name),
        store_code: String(visit.store_code),
        check_in_at: start.toISOString(),
        check_out_at: end ? end.toISOString() : null,
        duration_minutes: end ? Math.round((end.getTime() - start.getTime()) / 60000) : null,
        activity_count: visitActivityCounts.get(Number(visit.store_visit_id)) || 0,
        photos: photosByVisit.get(Number(visit.store_visit_id)) || [],
      };
    });

    const inStoreMinutes = visits.reduce((sum, visit) => {
      if (visit.duration_minutes !== null) return sum + visit.duration_minutes;
      return sum;
    }, 0);

    // Longest stretch between check-in, visits and check-out with no store.
    let longestGap: number | null = null;
    if (checkIn) {
      let cursor = checkIn.getTime();
      const endOfDay = checkOut ? checkOut.getTime() : null;
      for (const visit of visits) {
        const start = new Date(visit.check_in_at).getTime();
        longestGap = Math.max(longestGap ?? 0, Math.round((start - cursor) / 60000));
        cursor = visit.check_out_at ? new Date(visit.check_out_at).getTime() : now;
      }
      if (endOfDay) {
        longestGap = Math.max(longestGap ?? 0, Math.round((endOfDay - cursor) / 60000));
      }
    }

    const workedMinutes =
      checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : null;

    const isWorkDay = day.status === "planned_work";

    const isPastDay = formatDateOnly(detail.work_date ?? day.work_date) < todayInAppTimezone();
    let estimatedCheckOut: Date | null = null;
    if (isWorkDay && checkIn && !checkOut && isPastDay) {
      const lastSeen = [
        checkIn.getTime(),
        ...rawVisits.map((visit) =>
          new Date(visit.check_out_at ?? visit.check_in_at).getTime()
        ),
        ...activities.map((activity) => new Date(activity.created_at).getTime()),
        ...[...photosByVisit.entries()]
          .filter(([visitId]) => rawVisits.some((visit) => Number(visit.store_visit_id) === visitId))
          .flatMap(([, photos]) => photos.map((photo) => new Date(photo.created_at).getTime())),
      ];
      estimatedCheckOut = new Date(Math.max(...lastSeen));
    }
    const isLegacy =
      isWorkDay &&
      !checkIn &&
      !visits.length &&
      formatDateOnly(detail.work_date ?? day.work_date) < ATTENDANCE_START_DATE;

    const gallery: GalleryPhoto[] = [
      ...visits.flatMap((visit) =>
        visit.photos.map((photo) => ({
          photo_url: photo.photo_url,
          kind: "presence" as const,
          label: "Foto prezence",
          store_name: visit.store_name,
          created_at: photo.created_at,
        }))
      ),
      ...(reportPhotosByDay.get(dayId) || []),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at));

    if (isWorkDay && !isLegacy) {
      if (!checkIn) {
        flags.add("no_check_in");
      } else if (minutesInAppTimezone(checkIn) > startLimit + LATE_GRACE_MINUTES) {
        flags.add("late_check_in");
      }

      if (checkIn && !checkOut) flags.add("no_check_out");
      if (checkOut && minutesInAppTimezone(checkOut) < endLimit) flags.add("early_check_out");
      if (workedMinutes !== null && workedMinutes < expectedMinutes - LATE_GRACE_MINUTES) {
        flags.add("short_day");
      }

      if (!visits.length) flags.add("no_visits");
      if (visits.some((visit) => !visit.check_out_at)) flags.add("open_visit");
      if (
        visits.some(
          (visit) => visit.duration_minutes !== null && visit.duration_minutes < MIN_VISIT_MINUTES
        )
      ) {
        flags.add("short_visit");
      }
      if (activitiesOutside > 0) flags.add("activity_outside_visit");
      if (visits.some((visit) => visit.check_out_at && !visit.photos.length)) {
        flags.add("no_arrival_photo");
      }
      if (longestGap !== null && longestGap > LONG_GAP_MINUTES) flags.add("long_gap");
    }

    const critical: VerificationFlag[] = [
      "no_check_in",
      "no_visits",
      "activity_outside_visit",
    ];

    result.set(dayId, {
      check_in_at: toIsoOrNull(detail.check_in_at),
      check_out_at: toIsoOrNull(detail.check_out_at),
      worked_minutes: workedMinutes,
      in_store_minutes: inStoreMinutes,
      longest_gap_minutes: longestGap,
      estimated_check_out_at: estimatedCheckOut ? estimatedCheckOut.toISOString() : null,
      visit_count: visits.length,
      photo_visit_count: visits.filter((visit) => visit.photos.length > 0).length,
      activities_outside_visit: activitiesOutside,
      visits,
      flags: [...flags],
      gallery,
      verification_status: !isWorkDay
        ? "absence"
        : isLegacy
        ? "legacy"
        : [...flags].some((flag) => critical.includes(flag))
        ? "critical"
        : flags.size
        ? "warning"
        : "ok",
      expected_start: WORK_START,
      expected_end: WORK_END,
    });
  }

  return result;
};

export const getAttendanceForDay = async (
  workLogDayId: number,
  userId: number,
  isAdmin: boolean
) => {
  const [rows] = await db.promise().query<DayRow[]>(
    `SELECT work_log_day_id, status FROM work_log_days
     WHERE work_log_day_id = ? ${isAdmin ? "" : "AND user_id = ?"}
     LIMIT 1`,
    isAdmin ? [workLogDayId] : [workLogDayId, userId]
  );

  if (!rows.length) {
    throw new AttendanceError(404, "Dita e punës nuk u gjet.");
  }

  const verifications = await buildDayVerifications(rows);
  const verification = verifications.get(workLogDayId)!;
  const openVisit = verification.visits.find((visit) => !visit.check_out_at) || null;

  return {
    ...verification,
    open_visit: openVisit,
  };
};

// UTC instant of local midnight for a YYYY-MM-DD date in the app timezone, so
// "today" counts match what the field team sees on their phones.
const startOfDayUtc = (date: string): Date => {
  const guess = new Date(`${date}T00:00:00Z`);
  const local = new Date(guess.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
};

const shiftDate = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

// Business numbers for the whole field team, from every PPL and photo entered
// that day, whether or not it was linked to a work day.
const getBusinessTotals = async (date: string) => {
  const from = startOfDayUtc(date);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const [[shelfRows], [storeRows]] = await Promise.all([
    db.promise().query<RowDataPacket[]>(
      `SELECT
         (SELECT COALESCE(SUM(facings_count), 0) FROM podravka_facings
            WHERE created_at >= ? AND created_at < ?
              AND (record_type IS NULL OR record_type = 'FACINGS')) AS podravka_facings,
         (SELECT COALESCE(SUM(facings_count), 0) FROM competitor_facings
            WHERE created_at >= ? AND created_at < ?) AS competitor_facings,
         (SELECT COUNT(DISTINCT batch_id) FROM podravka_facings
            WHERE created_at >= ? AND created_at < ?)
         + (SELECT COUNT(DISTINCT batch_id) FROM competitor_facings
            WHERE created_at >= ? AND created_at < ?) AS ppl_batches,
         (SELECT COUNT(*) FROM report_photos
            WHERE created_at >= ? AND created_at < ?) AS photos`,
      [from, to, from, to, from, to, from, to, from, to]
    ),
    db.promise().query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT store_id) AS stores FROM (
         SELECT store_id FROM podravka_facings WHERE created_at >= ? AND created_at < ?
         UNION SELECT store_id FROM competitor_facings WHERE created_at >= ? AND created_at < ?
         UNION SELECT store_id FROM report_photos WHERE created_at >= ? AND created_at < ?
         UNION SELECT store_id FROM store_visits WHERE check_in_at >= ? AND check_in_at < ?
       ) active_stores`,
      [from, to, from, to, from, to, from, to]
    ),
  ]);

  const podravkaFacings = Number(shelfRows[0]?.podravka_facings || 0);
  const competitorFacings = Number(shelfRows[0]?.competitor_facings || 0);
  const totalFacings = podravkaFacings + competitorFacings;

  return {
    ppl_batches: Number(shelfRows[0]?.ppl_batches || 0),
    podravka_facings: podravkaFacings,
    competitor_facings: competitorFacings,
    podravka_share: totalFacings ? (podravkaFacings / totalFacings) * 100 : null,
    stores_covered: Number(storeRows[0]?.stores || 0),
    photos: Number(shelfRows[0]?.photos || 0),
  };
};

export type LiveState =
  | "missing"
  | "absence"
  | "not_started"
  | "in_store"
  | "on_road"
  | "done"
  | "not_closed";

// Lean, query-only snapshot for the admin home page. It skips the per-visit
// verification work so it stays cheap enough to refresh every minute.
export const getDayOverview = async (date: string) => {
  const [rows] = await db.promise().query<RowDataPacket[]>(
    `SELECT
       u.user_id,
       u.user,
       wld.work_log_day_id,
       wld.status,
       wld.check_in_at,
       wld.check_out_at,
       (SELECT COUNT(*) FROM store_visits sv
          WHERE sv.work_log_day_id = wld.work_log_day_id) AS visit_count,
       (SELECT s.store_name FROM store_visits sv
          JOIN stores s ON s.store_id = sv.store_id
          WHERE sv.work_log_day_id = wld.work_log_day_id AND sv.check_out_at IS NULL
          ORDER BY sv.check_in_at DESC LIMIT 1) AS current_store,
       (SELECT COUNT(*) FROM report_photos rp
          WHERE rp.work_log_day_id = wld.work_log_day_id)
       + (SELECT COUNT(*) FROM store_visit_photos svp
          JOIN store_visits sv ON sv.store_visit_id = svp.store_visit_id
          WHERE sv.work_log_day_id = wld.work_log_day_id) AS photo_count,
       (SELECT COUNT(DISTINCT pf.batch_id) FROM podravka_facings pf
          WHERE pf.work_log_day_id = wld.work_log_day_id)
       + (SELECT COUNT(DISTINCT cf.batch_id) FROM competitor_facings cf
          WHERE cf.work_log_day_id = wld.work_log_day_id) AS ppl_count
     FROM users u
     LEFT JOIN work_log_days wld
       ON wld.user_id = u.user_id AND wld.work_date = ?
     WHERE u.role = 'employee' OR wld.work_log_day_id IS NOT NULL
     ORDER BY u.user ASC`,
    [date]
  );

  const lateAfter = parseClock(WORK_START) + LATE_GRACE_MINUTES;

  const [business, previousBusiness] = await Promise.all([
    getBusinessTotals(date),
    getBusinessTotals(shiftDate(date, -1)),
  ]);

  const people = rows.map((row) => {
    const checkIn = row.check_in_at ? new Date(row.check_in_at) : null;
    const checkOut = row.check_out_at ? new Date(row.check_out_at) : null;
    const state: LiveState = !row.work_log_day_id
      ? "missing"
      : row.status !== "planned_work"
      ? "absence"
      : !checkIn
      ? "not_started"
      : checkOut
      ? "done"
      : date < todayInAppTimezone()
      ? "not_closed"
      : row.current_store
      ? "in_store"
      : "on_road";

    return {
      user_id: Number(row.user_id),
      user: String(row.user),
      state,
      check_in_at: checkIn ? checkIn.toISOString() : null,
      check_out_at: checkOut ? checkOut.toISOString() : null,
      late: checkIn ? minutesInAppTimezone(checkIn) > lateAfter : false,
      current_store: row.current_store ?? null,
      visit_count: Number(row.visit_count || 0),
      photo_count: Number(row.photo_count || 0),
      ppl_count: Number(row.ppl_count || 0),
    };
  });

  const count = (predicate: (person: (typeof people)[number]) => boolean) =>
    people.filter(predicate).length;

  return {
    date,
    expected_start: WORK_START,
    expected_end: WORK_END,
    business,
    previous_business: previousBusiness,
    totals: {
      employees: people.length,
      started: count((p) => p.check_in_at !== null),
      late: count((p) => p.late),
      in_store: count((p) => p.state === "in_store"),
      missing: count((p) => p.state === "missing" || p.state === "not_started"),
      absent: count((p) => p.state === "absence"),
      visits: people.reduce((sum, p) => sum + p.visit_count, 0),
      photos: people.reduce((sum, p) => sum + p.photo_count, 0),
      ppl: people.reduce((sum, p) => sum + p.ppl_count, 0),
    },
    people,
  };
};
