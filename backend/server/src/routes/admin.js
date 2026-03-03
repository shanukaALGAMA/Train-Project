import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";
import { adminMiddleware } from "../middleware/adminMiddleware.js";

const router = express.Router();

// ── TRAINS ──────────────────────────────────────────

// List all trains
router.get("/trains", adminMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT train_id, train_name, created_at FROM trains ORDER BY train_id"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Add a new train
router.post("/trains", adminMiddleware, async (req, res) => {
    const { train_name, password } = req.body;
    if (!train_name || !password)
        return res.status(400).json({ message: "train_name and password required" });

    try {
        const [existing] = await pool.query(
            "SELECT train_id FROM trains WHERE train_name = ?", [train_name]
        );
        if (existing.length > 0)
            return res.status(400).json({ message: "Train already exists" });

        const hashed = await bcrypt.hash(password, 10);
        await pool.query("INSERT INTO trains (train_name, password) VALUES (?, ?)", [train_name, hashed]);
        res.json({ message: "Train added successfully" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Delete a train
router.delete("/trains/:id", adminMiddleware, async (req, res) => {
    try {
        await pool.query("DELETE FROM trains WHERE train_id = ?", [req.params.id]);
        res.json({ message: "Train deleted" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ── ZONES ──────────────────────────────────────────

// List all zones
router.get("/zones", adminMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT zone_id, zone_name, device_code, latitude, longitude, status FROM zones ORDER BY zone_id"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Add a new zone
router.post("/zones", adminMiddleware, async (req, res) => {
    const { zone_name, device_code, latitude, longitude } = req.body;
    if (!zone_name || !device_code)
        return res.status(400).json({ message: "zone_name and device_code required" });

    try {
        await pool.query(
            "INSERT INTO zones (zone_name, device_code, latitude, longitude, status) VALUES (?, ?, ?, ?, 0)",
            [zone_name, device_code, latitude ?? null, longitude ?? null]
        );
        res.json({ message: "Zone added successfully" });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY")
            return res.status(400).json({ message: "Zone name or device code already exists" });
        res.status(500).json({ error: "Server error" });
    }
});

// Update a zone
router.put("/zones/:id", adminMiddleware, async (req, res) => {
    const { zone_name, device_code, latitude, longitude } = req.body;
    try {
        await pool.query(
            "UPDATE zones SET zone_name = ?, device_code = ?, latitude = ?, longitude = ? WHERE zone_id = ?",
            [zone_name, device_code, latitude ?? null, longitude ?? null, req.params.id]
        );
        res.json({ message: "Zone updated" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Delete a zone
router.delete("/zones/:id", adminMiddleware, async (req, res) => {
    try {
        await pool.query("DELETE FROM zones WHERE zone_id = ?", [req.params.id]);
        res.json({ message: "Zone deleted" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
