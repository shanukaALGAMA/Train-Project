import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import dataRoutes from "./routes/data.js";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Server is running...");
});

// Routes
app.use("/auth", authRoutes);
app.use("/data", dataRoutes);

// Start server
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
