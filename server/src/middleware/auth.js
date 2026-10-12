
import jwt from "jsonwebtoken";
import db from "../db.js";

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer ([^\s]+)$/);

    if (!match || !process.env.JWT_SECRET) {
      return res.status(401).json({ error: "Please log in." });
    }

    const payload = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "phishshield"
    });

    const user = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ?
    `).get(payload.sub);

    if (!user) {
      return res.status(401).json({ error: "Account not found." });
    }

    // Preserve the user ID interface expected by existing routes.
    req.user = { ...user, _id: user.id };
    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired login session."
    });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      error: "Administrator access required."
    });
  }

  next();
}