import { Request, Response } from "express";
import {
  createWorkLogDay,
  deleteWorkLogDay,
  getDetailedWorkDayReport,
  getLatestWorkDayKilometers,
  getWorkLogDayById,
  listWorkLogDays,
  updateWorkLogDay,
  validateWorkLogPayload,
  WorkLogDayInput,
} from "../services/workDayService";

const isAdminRequest = (req: Request): boolean => req.user?.role === "admin";
const getScopedUserId = (req: Request): number | null => req.user?.user_id ?? null;
const canManageAllWorkDays = (req: Request): boolean =>
  isAdminRequest(req) && req.user?.user?.trim().toLocaleLowerCase() !== "florina";

export const createWorkDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getScopedUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    const payload = req.body as WorkLogDayInput;
    const validationError = validateWorkLogPayload(payload);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const workDay = await createWorkLogDay(userId, payload);
    res.status(201).json(workDay);
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "A work log already exists for this date" });
      return;
    }

    console.error("Error creating work day:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getWorkDays = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUserId = getScopedUserId(req);
    if (!requestingUserId) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    const rows = await listWorkLogDays({
      requestingUserId,
      // Florina uses the employee work-day flow while retaining her admin
      // access to reports. Her day picker must therefore only see her days.
      isAdmin: canManageAllWorkDays(req),
      targetUserId: req.query.user_id ? Number(req.query.user_id) : undefined,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      status: req.query.status as string | undefined,
    });

    res.json(rows);
  } catch (error) {
    console.error("Error fetching work days:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getDetailedWorkDaysReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const requestingUserId = getScopedUserId(req);
    if (!requestingUserId) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    const userIds = req.query.user_id
      ? Array.isArray(req.query.user_id)
        ? req.query.user_id.map((value) => Number(value)).filter(Number.isFinite)
        : [Number(req.query.user_id)].filter(Number.isFinite)
      : undefined;
    const rawStatus = Array.isArray(req.query.status)
      ? req.query.status[0]
      : req.query.status;
    const status = typeof rawStatus === "string" ? rawStatus : undefined;

    const limit = Math.max(1, Number(req.query.limit) || 20);
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const report = await getDetailedWorkDayReport({
      requestingUserId,
      isAdmin: isAdminRequest(req),
      targetUserIds: userIds,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      status,
      limit,
      offset,
    });

    res.json(report);
  } catch (error) {
    console.error("Error fetching detailed work-day report:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getWorkDayById = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUserId = getScopedUserId(req);
    if (!requestingUserId) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    const workLogDayId = Number(req.params.work_log_day_id);
    if (!Number.isInteger(workLogDayId)) {
      res.status(400).json({ error: "Invalid work log day id" });
      return;
    }

    const workDay = await getWorkLogDayById(
      workLogDayId,
      requestingUserId,
      canManageAllWorkDays(req)
    );

    if (!workDay) {
      res.status(404).json({ error: "Work log day not found" });
      return;
    }

    res.json(workDay);
  } catch (error) {
    console.error("Error fetching work day:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getLatestKilometers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const requestingUserId = getScopedUserId(req);
    if (!requestingUserId) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    const latest = await getLatestWorkDayKilometers({
      requestingUserId,
      upToDate: req.query.up_to_date as string | undefined,
    });

    res.json(latest);
  } catch (error) {
    console.error("Error fetching latest kilometers:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateWorkDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUserId = getScopedUserId(req);
    if (!requestingUserId) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    const workLogDayId = Number(req.params.work_log_day_id);
    if (!Number.isInteger(workLogDayId)) {
      res.status(400).json({ error: "Invalid work log day id" });
      return;
    }

    const payload = req.body as WorkLogDayInput;
    const validationError = validateWorkLogPayload(payload);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const workDay = await updateWorkLogDay(
      workLogDayId,
      requestingUserId,
      payload,
      canManageAllWorkDays(req)
    );

    if (!workDay) {
      res.status(404).json({ error: "Work log day not found" });
      return;
    }

    res.json(workDay);
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "A work log already exists for this date" });
      return;
    }

    console.error("Error updating work day:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const removeWorkDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUserId = getScopedUserId(req);
    if (!requestingUserId) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    const workLogDayId = Number(req.params.work_log_day_id);
    if (!Number.isInteger(workLogDayId)) {
      res.status(400).json({ error: "Invalid work log day id" });
      return;
    }

    const deleted = await deleteWorkLogDay(
      workLogDayId,
      requestingUserId,
      canManageAllWorkDays(req)
    );

    if (!deleted) {
      res.status(404).json({ error: "Work log day not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting work day:", error);
    res.status(500).json({ error: "Server error" });
  }
};
