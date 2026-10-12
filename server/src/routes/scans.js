
import { Router } from "express";
import { randomUUID } from "node:crypto";
import net from "node:net";
import { domainToASCII } from "node:url";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { analyzeUrl } from "../services/analyzer.js";
import { checkReputation } from "../services/reputation.js";

const router = Router();

router.use(requireAuth);

// Validate submitted URLs without visiting the destination.
function validateUrl(input) {
  if (typeof input !== "string" || input.length > 2048) {
    throw new Error(
      "URL must be a string no longer than 2048 characters."
    );
  }

  const value = input.trim();

  if (/[\u0000-\u0020\u007f]/.test(value)) {
    throw new Error("URL contains spaces or control characters.");
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Enter a complete valid URL, including https:// or http://."
    );
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  if (!url.hostname || url.username || url.password) {
    throw new Error(
      "A hostname is required; embedded credentials are not allowed."
    );
  }

  const hostname = domainToASCII(url.hostname).toLowerCase();

  if (
    !hostname ||
    hostname.length > 253 ||
    hostname.split(".").some(label =>
      !label ||
      label.length > 63 ||
      !/^[a-z0-9-]+$/i.test(label) ||
      label.startsWith("-") ||
      label.endsWith("-")
    )
  ) {
    const ipHostname = url.hostname.replace(/^\[|\]$/g, "");

    if (net.isIP(ipHostname) === 0) {
      throw new Error("Hostname format is not supported.");
    }
  }

  return url;
}

// Create a risk category using the updated thresholds.
function calculateRisk(score, reputationStatus) {
  if (reputationStatus === "match" || score >= 75) {
    return "High";
  }

  if (score >= 25) {
    return "Medium";
  }

  return "Low";
}

// Submit a URL for analysis.
router.post("/", async (req, res, next) => {
  try {
    let url;

    try {
      url = validateUrl(req.body?.url);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    // Analyze patterns without opening the submitted website.
    const analysis = analyzeUrl(url);
    const reputation = await checkReputation(url.href);

    // A reputation match receives a minimum score of 90.
    const score = Math.max(
      analysis.score,
      reputation.status === "match" ? 90 : 0
    );

    const risk = calculateRisk(score, reputation.status);

    const reasons = [...analysis.reasons];

    if (reputation.status === "match") {
      reasons.unshift(
        "The configured threat-intelligence provider reported a threat match."
      );
    } else if (reputation.status === "no_match") {
      reasons.push(
        "The provider returned no threat match. This does not establish safety."
      );
    } else {
      reasons.push(
        "Threat-intelligence verification was unavailable."
      );
    }

    // Remove query parameters and fragments to avoid storing possible tokens.
    const storedUrl =
      `${url.protocol}//${url.host}${url.pathname}`;

    const id = randomUUID();

    const checks = {
      ...analysis.checks,
      reputation: reputation.status
    };

    db.prepare(`
      INSERT INTO scans (
        id,
        owner_id,
        url,
        hostname,
        score,
        risk,
        reasons_json,
        checks_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      storedUrl,
      analysis.hostname,
      score,
      risk,
      JSON.stringify(reasons),
      JSON.stringify(checks)
    );

    res.status(201).json({
      id,
      hostname: analysis.hostname,
      score,
      risk,
      reasons,
      checks,
      reputation: {
        status: reputation.status,
        message: reputation.message,
        matches: reputation.matches
      },
      createdAt: new Date().toISOString(),
      disclaimer:
        "This is a risk assessment, not a guarantee that the website is safe or malicious."
    });
  } catch (error) {
    next(error);
  }
});

// Return the signed-in user's scan history.
router.get("/history", (req, res, next) => {
  try {
    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(req.query.limit, 10) || 20
      )
    );

    const rows = db.prepare(`
      SELECT
        id,
        hostname,
        url,
        score,
        risk,
        reasons_json,
        checks_json,
        created_at
      FROM scans
      WHERE owner_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    `).all(req.user.id, limit);

    res.json(
      rows.map(row => ({
        _id: row.id,
        hostname: row.hostname,
        url: row.url,
        score: row.score,
        risk: row.risk,
        reasons: JSON.parse(row.reasons_json),
        checks: JSON.parse(row.checks_json),
        createdAt: row.created_at
      }))
    );
  } catch (error) {
    next(error);
  }
});

// Return dashboard statistics for the signed-in user.
router.get("/stats", (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT risk, COUNT(*) AS count
      FROM scans
      WHERE owner_id = ?
      GROUP BY risk
    `).all(req.user.id);

    const counts = {
      Low: 0,
      Medium: 0,
      High: 0
    };

    for (const row of rows) {
      counts[row.risk] = row.count;
    }

    res.json({
      total: Object.values(counts).reduce(
        (sum, value) => sum + value,
        0
      ),
      counts
    });
  } catch (error) {
    next(error);
  }
});

export default router;