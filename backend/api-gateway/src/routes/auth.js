import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const SERVER_URL = process.env.SERVER_URL;

// REGISTER
router.post("/register", async (req, res) => {
    try {
        const response = await axios.post(`${SERVER_URL}/auth/register`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data);
    }
});

// LOGIN
router.post("/login", async (req, res) => {
    try {
        const response = await axios.post(`${SERVER_URL}/auth/login`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data);
    }
});

export default router;
