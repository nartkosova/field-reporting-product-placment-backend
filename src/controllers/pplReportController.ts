import { Request, Response } from "express";
import { getPplReport, parsePplFilters } from "../services/pplReportService";

export const getPplReportHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    res.json(
      await getPplReport(parsePplFilters(req.query), {
        groupBy: String(req.query.group_by || "entry"),
        sort: String(req.query.sort || ""),
        direction: String(req.query.direction || "desc"),
        limit,
        offset,
        all: req.query.export === "1",
      })
    );
  } catch (error) {
    console.error("Error building PPL report:", error);
    res.status(500).json({ error: "Raporti PPL nuk u ngarkua." });
  }
};
