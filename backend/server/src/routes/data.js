import express from "express";
import pool from "../db.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get logged-in train profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT train_id, train_name, created_at FROM trains WHERE train_id = ?",
      [req.user.train_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Train not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
