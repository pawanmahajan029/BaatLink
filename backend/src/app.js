import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import connectToSocket from "./controllers/socketManager.js";
import userRoutes from "./routes/user_routes.js";

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

// FIX FOR ES MODULE __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("port", process.env.PORT || 8000);

// CORS configuration - allow frontend origin
const corsOptions = {
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// ✅ SERVE FRONTEND
const frontendPath = path.join(__dirname, "../../frontend");
console.log("Frontend path:", frontendPath);
app.use(express.static(frontendPath));

// Health check route
app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
});

// APIs
app.use("/api/v1/users", userRoutes);

// Fallback route for SPA - serve home.html for root
app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "home.html"));
});

const start = async () => {
    // Use environment variable for MongoDB connection
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://pawanmahajan2029_db_user:Mark01%40123@mark01.0yf2dzz.mongodb.net/";

    const connectionDb = await mongoose.connect(mongoUri);

    console.log(`MONGO Connected DB Host: ${connectionDb.connection.host}`);

    server.listen(app.get("port"), () => {
        console.log(`LISTENING ON PORT ${app.get("port")}`);
    });
};

start();
export default app;