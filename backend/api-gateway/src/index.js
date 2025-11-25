import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import dataRoutes from "./routes/data.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Routes
app.use("/auth", authRoutes);
app.use("/data", dataRoutes);

app.listen(process.env.PORT, () => {
    console.log(`API Gateway running on port ${process.env.PORT}`);
});
