import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import GameData from "../models/gameData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getGameData = async (req, res) => {
  const { level } = req.params;

  try {
    let data = await GameData.findOne({ levelId: level });

    if (!data) {
      return res
        .status(404)
        .json({
          message: "Game data not found for this level in the database.",
        });
    }

    res.json({
      hint: data.hint,
      loupeLink: data.loupeLink,
      bonusInfo: data.bonusInfo,
      badgeUrl: data.badgeUrl,
      questionCount: data.questionCount,
      questions: data.questions,
    });
  } catch (error) {
    console.error("Error fetching game data:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch game data", error: error.message });
  }
};

export const updateGameData = async (req, res) => {
  const { level } = req.params;
  const { hint, loupeLink, bonusInfo, badgeUrl, questions, questionCount } =
    req.body;

  try {
    let data = await GameData.findOne({ levelId: level });

    if (!data) {
      return res
        .status(404)
        .json({ message: "Game data not found for this level" });
    }

    data.hint = hint;
    if (loupeLink !== undefined) data.loupeLink = loupeLink;
    if (bonusInfo !== undefined) data.bonusInfo = bonusInfo;
    if (badgeUrl !== undefined) data.badgeUrl = badgeUrl;
    if (questionCount !== undefined) data.questionCount = Number(questionCount);
    data.questions = questions;

    await data.save();

    res.json({ message: "Game data updated successfully" });
  } catch (error) {
    console.error("Error updating game data:", error);
    res
      .status(500)
      .json({ message: "Failed to update game data", error: error.message });
  }
};

/* --- Public Route for Game Client --- */
export const getPublicGameData = async (req, res) => {
  try {
    const allData = await GameData.find({});

    // Reconstruct the LEVELS object shape with only editable fields
    // OPTIMIZATION: Strip large Base64 images to reduce payload size
    const LEVELS = {};
    allData.forEach((levelData) => {
      const cleanQuestions = {};

      // Process questions to reduce image size
      let questionsObj = {};
      if (levelData.questions) {
        if (typeof levelData.questions.toJSON === "function") {
          questionsObj = levelData.questions.toJSON();
        } else if (levelData.questions instanceof Map) {
          questionsObj = Object.fromEntries(levelData.questions);
        } else {
          questionsObj = levelData.questions;
        }
      }

      if (questionsObj && typeof questionsObj === "object") {
        for (const qKey in questionsObj) {
          const q = questionsObj[qKey];
          cleanQuestions[qKey] = {
            q: q.q || "",
            a: Array.isArray(q.a) ? q.a : [],
            c: Array.isArray(q.c) ? q.c : [0],
            imgs: Array.isArray(q.imgs) ? q.imgs : [],
            feedbacks: Array.isArray(q.feedbacks)
              ? q.feedbacks.map((fb) => ({
                  text: fb.text || "",
                  imgs: Array.isArray(fb.imgs) ? fb.imgs : [],
                  audio: fb.audio || "",
                  lyricsTitle: fb.lyricsTitle || "",
                  lyrics: fb.lyrics || "",
                }))
              : [],
          };
        }
      }

      LEVELS[levelData.levelId] = {
        key: levelData.levelId,
        questionCount: levelData.questionCount,
        hint: levelData.hint,
        loupeLink: levelData.loupeLink,
        bonusInfo: Array.isArray(levelData.bonusInfo)
          ? levelData.bonusInfo.map((page) => ({
              text: page.text || "",
              image: page.image || "",
            }))
          : [],
        badgeUrl: levelData.badgeUrl || "",
        questionData: cleanQuestions,
      };
    });

    res.json({ LEVELS });
  } catch (error) {
    console.error("Error fetching public game data:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch public game data",
        error: error.message,
      });
  }
};

/* --- Push Route for Standalone Script to Force Push Full Data to DB --- */
export const pushGameData = async (req, res) => {
  const { level } = req.params;
  const payload = req.body;

  try {
    console.log(`Pushing data for ${level} from script to MongoDB...`);

    let existingData = await GameData.findOne({ levelId: level });
    if (!existingData) {
      existingData = new GameData({ levelId: level });
    }

    existingData.questionCount = payload.questionCount;
    existingData.hint = payload.hint;
    existingData.loupeLink = payload.loupeLink || "";
    existingData.bonusInfo = payload.bonusInfo || [];
    existingData.badgeUrl = payload.badgeUrl || "";
    existingData.questions = payload.questions;

    await existingData.save();

    res.json({ message: "Game data pushed successfully!", data: existingData });
  } catch (error) {
    console.error(`Error pushing ${level}:`, error);
    res
      .status(500)
      .json({ message: "Failed to push game data", error: error.message });
  }
};
