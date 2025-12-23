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

app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// ✅ SERVE FRONTEND
app.use(express.static(path.join(__dirname, "../../frontend")));

// APIs
app.use("/api/v1/users", userRoutes);

const start = async () => {
    const connectionDb = await mongoose.connect(
        "mongodb+srv://pawanmahajan2029_db_user:Mark01%40123@mark01.0yf2dzz.mongodb.net/"
    );

    console.log(`MONGO Connected DB Host: ${connectionDb.connection.host}`);

    server.listen(app.get("port"), () => {
        console.log(`LISTENING ON PORT ${app.get("port")}`);
    });
};

start();
export default app;