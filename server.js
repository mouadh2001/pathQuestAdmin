import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./server/config/db.js";
import adminRoutes from "./server/routes/adminRoutes.js";
import playerRoutes from "./server/routes/playerRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "admin-client/public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "admin-client/public/login.html"));
});

app.use("/api/admin", adminRoutes);
app.use("/api/player", playerRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
