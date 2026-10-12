
import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function createToken(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.JWT_SECRET,
    { expiresIn: "2h", issuer: "phishshield", algorithm: "HS256" }
  );
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 80 ||
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    ) {
      return res.status(400).json({
        error: "Enter a valid name and email, and a password of 12–128 characters."
      });
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(500).json({
        error: "Server authentication is not configured."
      });
    }

    const id = randomUUID();
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    try {
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, 'user')
      `).run(id, name.trim(), normalizedEmail, passwordHash);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({
          error: "Unable to create this account. The email may already be registered."
        });
      }
      throw error;
    }

    const user = {
      id,
      name: name.trim(),
      email: normalizedEmail,
      role: "user"
    };

    res.status(201).json({
      token: createToken(user),
      user: safeUser(user)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      email.length > 254 ||
      typeof password !== "string" ||
      password.length > 128
    ) {
      return res.status(400).json({ error: "Invalid login details." });
    }

    const user = db.prepare(`
      SELECT id, name, email, role, password_hash
      FROM users
      WHERE email = ?
    `).get(email.trim().toLowerCase());

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    res.json({
      token: createToken(user),
      user: safeUser(user)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

export default router;