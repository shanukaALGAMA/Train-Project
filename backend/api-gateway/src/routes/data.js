import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { injectToken } from "../middleware/injectToken.js";

dotenv.config();

const router = express.Router();
const SERVER_URL = process.env.SERVER_URL;

router.get("/profile", injectToken, async (req, res) => {
    try {
        const response = await axios.get(`${SERVER_URL}/data/profile`, {
            headers: {
                Authorization: req.token
            }
        });

        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data);
    }
});

export default router;
