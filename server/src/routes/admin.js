
import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/stats", (_req, res, next) => {
  try {
    const totalScans = db.prepare(
      "SELECT COUNT(*) AS count FROM scans"
    ).get().count;

    const totalUsers = db.prepare(
      "SELECT COUNT(*) AS count FROM users"
    ).get().count;

    const byRisk = db.prepare(`
      SELECT risk, COUNT(*) AS count
      FROM scans
      GROUP BY risk
    `).all();

    const riskCounts = { Low: 0, Medium: 0, High: 0 };
    for (const item of byRisk) {
      riskCounts[item.risk] = item.count;
    }

    const dailyScans = db.prepare(`
      SELECT date(created_at) AS _id, COUNT(*) AS count
      FROM scans
      WHERE datetime(created_at) >= datetime('now', '-6 days')
      GROUP BY date(created_at)
      ORDER BY _id ASC
    `).all();

    const allScans = db.prepare(
      "SELECT reasons_json FROM scans"
    ).all();

    const indicatorCounts = new Map();

    for (const scan of allScans) {
      let reasons;

      try {
        reasons = JSON.parse(scan.reasons_json);
      } catch {
        reasons = [];
      }

      for (const reason of reasons) {
        indicatorCounts.set(
          reason,
          (indicatorCounts.get(reason) || 0) + 1
        );
      }
    }

    const topIndicators = [...indicatorCounts.entries()]
      .map(([indicator, count]) => ({
        _id: indicator,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      totalScans,
      totalUsers,
      riskCounts,
      dailyScans,
      topIndicators
    });
  } catch (error) {
    next(error);
  }
});

router.get("/recent", (_req, res, next) => {
  try {
    const scans = db.prepare(`
      SELECT id AS _id, hostname, score, risk, created_at AS createdAt
      FROM scans
      ORDER BY created_at DESC, rowid DESC
      LIMIT 20
    `).all();

    res.json(scans);
  } catch (error) {
    next(error);
  }
});

export default router;