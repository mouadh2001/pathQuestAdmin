import express from "express";
import { getPublicGameData } from "../controllers/gameDataController.js";

const router = express.Router();

/* Fetch all game data for the client */
router.get("/gamedata", getPublicGameData);

export default router;
