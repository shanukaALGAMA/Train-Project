import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { injectToken } from "../middleware/injectToken.js";

dotenv.config();

const router = express.Router();
const SERVER_URL = process.env.SERVER_URL;

// STORE BOTH RELAY STATES
let esp32State = {
  ALARM: "OFF",
  BRAKE: "OFF",
};

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

  esp32State[device] = state;

  res.json({
    message: `${device} set to ${state}`,
    esp32State,
  });
});

//  ESP32 POLLS BOTH RELAY STATES 
router.get("/esp32/command", (req, res) => {
  res.json(esp32State);
});

export default router;
