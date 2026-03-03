import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { injectToken } from "../middleware/injectToken.js";

dotenv.config();

const router = express.Router();
const SERVER_URL = process.env.SERVER_URL;

// ── PER-TRAIN STATE MAP ──
// Key: train_id (number), Value: { ALARM: "ON"|"OFF", BRAKE: "ON"|"OFF" }
const trainStates = new Map();

function getTrainState(train_id) {
  if (!trainStates.has(train_id)) {
    trainStates.set(train_id, { ALARM: "OFF", BRAKE: "OFF" });
  }
  return trainStates.get(train_id);
}

// Decode a JWT payload without verifying the signature (gateway trusts the server issued it)
function decodeJwtPayload(token) {
  try {
    const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
    const payloadB64 = raw.split(".")[1];
    return JSON.parse(Buffer.from(payloadB64, "base64url").toString());
  } catch {
    return null;
  }
}

//  AUTTH 
router.get("/profile", injectToken, async (req, res) => {
  try {
    const response = await axios.get(`${SERVER_URL}/data/profile`, {
      headers: {
        Authorization: req.token,
      },
    });

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data);
  }
});

//  FRONTEND SENDS RELAY COMMANDS 
router.post("/esp32/control", (req, res) => {
  const { device, state } = req.body;

  if (
    !device ||
    !state ||
    !["ALARM", "BRAKE"].includes(device) ||
    !["ON", "OFF"].includes(state)
  ) {
    return res.status(400).json({ message: "Invalid device or state" });
  }

  // Extract train identity from JWT
  const authHeader = req.headers["authorization"];
  const payload = decodeJwtPayload(authHeader);
  if (!payload || !payload.train_id) {
    return res.status(401).json({ message: "Unauthorized: train token required" });
  }

  const trainState = getTrainState(payload.train_id);
  trainState[device] = state;

  console.log(`[SEIDS] Train ${payload.train_id} (${payload.train_name}): ${device} → ${state}`);

  res.json({
    message: `${device} set to ${state} for Train ${payload.train_id}`,
    train_id: payload.train_id,
    train_name: payload.train_name,
    esp32State: trainState,
  });
});

//  ESP32 POLLS ITS OWN RELAY STATE — must supply ?train_id=X 
router.get("/esp32/command", (req, res) => {
  const train_id = parseInt(req.query.train_id);
  if (!train_id) {
    return res.status(400).json({ message: "Missing ?train_id query parameter" });
  }
  res.json(getTrainState(train_id));
});

// APP POLLS ZONE_1 STATUS FROM DB
router.get("/zones/status", async (req, res) => {
  try {
    const response = await axios.get(`${SERVER_URL}/data/zones/status`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: "Failed to fetch zone status" });
  }
});

// APP FETCHES ALL ZONES FOR MAP
router.get("/zones/all", async (req, res) => {
  try {
    const response = await axios.get(`${SERVER_URL}/data/zones/all`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: "Failed to fetch zones" });
  }
});

// ── ADMIN PROXY ROUTES ─────────────────────────────

// Admin login (pass-through, no auth required on gateway)
router.post("/admin/login", async (req, res) => {
  try {
    const response = await axios.post(`${SERVER_URL}/auth/admin/login`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: "Login failed" });
  }
});

// Generic admin proxy helper — forwards request with Authorization header
const adminProxy = (method, path) => async (req, res) => {
  try {
    const opts = { headers: { Authorization: req.headers.authorization } };
    let response;
    if (method === "get") response = await axios.get(`${SERVER_URL}${path}`, opts);
    else if (method === "post") response = await axios.post(`${SERVER_URL}${path}`, req.body, opts);
    else if (method === "put") response = await axios.put(`${SERVER_URL}${path}`, req.body, opts);
    else if (method === "delete") response = await axios.delete(`${SERVER_URL}${path}`, opts);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: "Admin request failed" });
  }
};

// Trains
router.get("/admin/trains", adminProxy("get", "/admin/trains"));
router.post("/admin/trains", adminProxy("post", "/admin/trains"));
router.delete("/admin/trains/:id", async (req, res) => {
  try {
    const response = await axios.delete(`${SERVER_URL}/admin/trains/${req.params.id}`, {
      headers: { Authorization: req.headers.authorization },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed" });
  }
});

// Zones
router.get("/admin/zones", adminProxy("get", "/admin/zones"));
router.post("/admin/zones", adminProxy("post", "/admin/zones"));
router.put("/admin/zones/:id", async (req, res) => {
  try {
    const response = await axios.put(`${SERVER_URL}/admin/zones/${req.params.id}`, req.body, {
      headers: { Authorization: req.headers.authorization },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed" });
  }
});
router.delete("/admin/zones/:id", async (req, res) => {
  try {
    const response = await axios.delete(`${SERVER_URL}/admin/zones/${req.params.id}`, {
      headers: { Authorization: req.headers.authorization },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed" });
  }
});

export default router;
