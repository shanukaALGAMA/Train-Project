import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  const { train_name, password } = req.body;

  if (!train_name || !password) {
    return res.status(400).json({ message: "train_name and password are required" });
  }

  try {
    const [user] = await pool.query(
      "SELECT * FROM trains WHERE train_name = ?",
      [train_name]
    );

    if (user.length > 0) {
      return res.status(400).json({ message: "Train already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO trains (train_name, password) VALUES (?, ?)",
      [train_name, hashedPassword]
    );

    res.json({ message: "Train registered successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { train_name, password } = req.body;

  if (!train_name || !password) {
    return res.status(400).json({ message: "train_name and password required" });
  }

  try {
    const [result] = await pool.query(
      "SELECT * FROM trains WHERE train_name = ?",
      [train_name]
    );

    if (result.length === 0) {
      return res.status(400).json({ message: "Train not found" });
    }

    const user = result[0];
    const validPass = await bcrypt.compare(password, user.password);

    if (!validPass) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { train_id: user.train_id, train_name: user.train_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
