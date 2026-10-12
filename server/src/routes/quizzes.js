
import { Router } from "express";
import { randomUUID } from "node:crypto";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const questions = [
  {
    id: "q1",
    question: "A bank message unexpectedly asks you to log in using a link. What should you do?",
    options: [
      "Click the link immediately",
      "Open the official bank app or type its known address",
      "Reply with your password"
    ],
    answer: 1,
    explanation: "Use a trusted route to reach your bank instead of the message link."
  },
  {
    id: "q2",
    question: "Does HTTPS guarantee that a website is legitimate?",
    options: [
      "Yes, always",
      "Only on mobile",
      "No, phishing websites can also use HTTPS"
    ],
    answer: 2,
    explanation: "HTTPS protects the connection, not the honesty of the website."
  },
  {
    id: "q3",
    question: "An unexpected email pressures you to open an attachment urgently. What is safest?",
    options: [
      "Verify the request through a trusted channel",
      "Enable macros immediately",
      "Forward it to coworkers to test"
    ],
    answer: 0,
    explanation: "Urgency is a common social-engineering tactic. Verify the request independently."
  },
  {
    id: "q4",
    question: "What does a low PhishShield score mean?",
    options: [
      "The website is guaranteed safe",
      "Configured rules did not identify enough indicators to raise the score",
      "The domain is officially verified"
    ],
    answer: 1,
    explanation: "Detection rules can miss threats. A low score is not a safety certificate."
  }
];

router.get("/", (_req, res) => {
  res.json({
    questions: questions.map(({ answer, ...question }) => question)
  });
});

router.post("/submit", (req, res, next) => {
  try {
    const answers = req.body?.answers;

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(400).json({ error: "Answers must be an object." });
    }

    let score = 0;

    const results = questions.map(question => {
      const correct = answers[question.id] === question.answer;
      if (correct) score++;

      return {
        id: question.id,
        correct,
        explanation: question.explanation
      };
    });

    const id = randomUUID();

    const attempt = db.prepare(`
      INSERT INTO quiz_attempts (id, owner_id, score, total)
      VALUES (?, ?, ?, ?)
    `).run(id, req.user.id, score, questions.length);

    res.json({
      attemptId: id,
      score,
      total: questions.length,
      results
    });
  } catch (error) {
    next(error);
  }
});

router.get("/progress", (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT id, score, total, completed_at
      FROM quiz_attempts
      WHERE owner_id = ?
      ORDER BY completed_at DESC, rowid DESC
      LIMIT 20
    `).all(req.user.id);

    res.json({
      attempts: rows.map(row => ({
        _id: row.id,
        score: row.score,
        total: row.total,
        completedAt: row.completed_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;