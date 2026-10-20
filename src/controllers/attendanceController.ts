import { Request, Response } from "express";
import {
  addStoreVisitPhoto,
  AttendanceError,
  checkInDay,
  checkOutDay,
  endStoreVisit,
  getAttendanceForDay,
  getDayOverview,
  startStoreVisit,
  todayInAppTimezone,
} from "../services/attendanceService";

const isAdminRequest = (req: Request): boolean => req.user?.role === "admin";

const handleError = (res: Response, error: unknown, context: string) => {
  if (error instanceof AttendanceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(`Error ${context}:`, error);
  res.status(500).json({ error: "Server error" });
};

const parseIds = (req: Request, res: Response) => {
  const userId = req.user?.user_id ?? null;
  if (!userId) {
    res.status(401).json({ error: "Nuk jeni te autorizuar" });
    return null;
  }

  const workLogDayId = Number(req.params.work_log_day_id);
  if (!Number.isInteger(workLogDayId)) {
    res.status(400).json({ error: "Invalid work log day id" });
    return null;
  }

  return { userId, workLogDayId };
};

export const getDayAttendance = async (req: Request, res: Response): Promise<void> => {
  const ids = parseIds(req, res);
  if (!ids) return;

  try {
    res.json(await getAttendanceForDay(ids.workLogDayId, ids.userId, isAdminRequest(req)));
  } catch (error) {
    handleError(res, error, "fetching attendance");
  }
};

export const postDayCheckIn = async (req: Request, res: Response): Promise<void> => {
  const ids = parseIds(req, res);
  if (!ids) return;

  try {
    res.json(await checkInDay(ids.workLogDayId, ids.userId));
  } catch (error) {
    handleError(res, error, "checking in");
  }
};

export const postDayCheckOut = async (req: Request, res: Response): Promise<void> => {
  const ids = parseIds(req, res);
  if (!ids) return;

  try {
    res.json(await checkOutDay(ids.workLogDayId, ids.userId));
  } catch (error) {
    handleError(res, error, "checking out");
  }
};

export const postStoreVisit = async (req: Request, res: Response): Promise<void> => {
  const ids = parseIds(req, res);
  if (!ids) return;

  const storeId = Number(req.body?.store_id);
  if (!Number.isInteger(storeId)) {
    res.status(400).json({ error: "store_id is required" });
    return;
  }

  try {
    const visit = await startStoreVisit(ids.workLogDayId, ids.userId, storeId);
    const attendance = await getAttendanceForDay(ids.workLogDayId, ids.userId, false);
    res.status(201).json({ ...attendance, last_action: visit });
  } catch (error) {
    handleError(res, error, "starting store visit");
  }
};

export const postStoreVisitCheckOut = async (req: Request, res: Response): Promise<void> => {
  const ids = parseIds(req, res);
  if (!ids) return;

  const storeVisitId = Number(req.params.store_visit_id);
  if (!Number.isInteger(storeVisitId)) {
    res.status(400).json({ error: "Invalid store visit id" });
    return;
  }

  try {
    const visit = await endStoreVisit(ids.workLogDayId, ids.userId, storeVisitId);
    const attendance = await getAttendanceForDay(ids.workLogDayId, ids.userId, false);
    res.json({ ...attendance, last_action: visit });
  } catch (error) {
    handleError(res, error, "ending store visit");
  }
};

export const postStoreVisitPhoto = async (req: Request, res: Response): Promise<void> => {
  const ids = parseIds(req, res);
  if (!ids) return;

  const storeVisitId = Number(req.params.store_visit_id);
  const file = req.file as Express.Multer.File | undefined;
  if (!Number.isInteger(storeVisitId) || !file?.path) {
    res.status(400).json({ error: "Fotoja mungon." });
    return;
  }

  try {
    await addStoreVisitPhoto(
      ids.workLogDayId,
      ids.userId,
      storeVisitId,
      file.path,
      file.filename || null
    );
    res.status(201).json(await getAttendanceForDay(ids.workLogDayId, ids.userId, false));
  } catch (error) {
    handleError(res, error, "uploading store visit photo");
  }
};

export const getDayOverviewReport = async (req: Request, res: Response): Promise<void> => {
  const rawDate = typeof req.query.date === "string" ? req.query.date : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayInAppTimezone();

  try {
    res.json(await getDayOverview(date));
  } catch (error) {
    handleError(res, error, "fetching day overview");
  }
};
