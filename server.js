import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";

import connectDB from "./server/config/db.js";
import adminRoutes from "./server/routes/adminRoutes.js";
import playerRoutes from "./server/routes/playerRoutes.js";

const app = express();

connectDB();
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

app.use("/api/admin", adminRoutes);
app.use("/api/player", playerRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
