import { Request, Response } from "express";
import {
  AnalyticsFilters,
  getEmployeeBreakdown,
  getOverview,
  getPhotoCategoryBreakdown,
  getPhotoTypeBreakdown,
  getStoreCoverage,
  getTimeseries,
  normalizeGranularity,
} from "../services/analyticsService";

const toNumberArray = (value: unknown): number[] | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const raw = Array.isArray(value) ? value : String(value).split(",");
  const parsed = raw
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);

  return parsed.length ? parsed : undefined;
};

const toDateString = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  // Reject anything that is not a plain YYYY-MM-DD so a malformed value cannot
  // silently widen the window.
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : undefined;
};

const buildFilters = (req: Request): AnalyticsFilters | null => {
  const requestingUserId = req.user?.user_id;
  if (!requestingUserId) {
    return null;
  }

  const company =
    req.query.company === "podravka" || req.query.company === "competitor"
      ? String(req.query.company)
      : undefined;

  return {
    requestingUserId,
    isAdmin: req.user?.role === "admin",
    userIds: toNumberArray(req.query.user_ids ?? req.query.user_id),
    storeIds: toNumberArray(req.query.store_ids ?? req.query.store_id),
    startDate: toDateString(req.query.start_date),
    endDate: toDateString(req.query.end_date),
    company,
    granularity: normalizeGranularity(req.query.granularity as string),
  };
};

const handle = (
  loader: (filters: AnalyticsFilters) => Promise<unknown>,
  label: string
) => async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = buildFilters(req);
    if (!filters) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    res.json(await loader(filters));
  } catch (error) {
    console.error(`Error building ${label}:`, error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getAnalyticsOverview = handle(getOverview, "analytics overview");
export const getAnalyticsTimeseries = handle(getTimeseries, "analytics timeseries");
export const getAnalyticsByEmployee = handle(
  getEmployeeBreakdown,
  "employee breakdown"
);
export const getAnalyticsPhotoCategories = handle(
  getPhotoCategoryBreakdown,
  "photo category breakdown"
);
export const getAnalyticsPhotoTypes = handle(
  getPhotoTypeBreakdown,
  "photo type breakdown"
);
export const getAnalyticsStoreCoverage = handle(
  getStoreCoverage,
  "store coverage"
);
