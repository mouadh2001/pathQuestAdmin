import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import GameData from '../models/gameData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the original static game data
const gameDataPath = path.resolve(__dirname, '../../../Patho Quest final/src/data');

// Helper function to seed data from static files to MongoDB if not exists
const seedGameDataIfNeeded = async (level) => {
  try {
    let existingData = await GameData.findOne({ levelId: level });
    if (!existingData) {
      console.log(`Seeding data for ${level} to MongoDB...`);
      const levelConfigsPath = path.join(gameDataPath, 'levelConfigs.js');
      const questionsPath = path.join(gameDataPath, `${level}Questions.js`);

      if (fs.existsSync(levelConfigsPath) && fs.existsSync(questionsPath)) {
        const timestamp = Date.now();
        const configModule = await import(`file://${levelConfigsPath}?update=${timestamp}`);
        const questionsModule = await import(`file://${questionsPath}?update=${timestamp}`);

        const levelConfigKey = level.trim();
        const levelConfig = configModule.LEVELS[levelConfigKey] || configModule.LEVELS[levelConfigKey + '  '];
        const questionsObjName = `${levelConfigKey}Questions`;
        const questions = questionsModule[questionsObjName];

        if (levelConfig) {
          const newData = new GameData({
            levelId: level,
            title: levelConfig.title,
            backgroundKey: levelConfig.backgroundKey,
            isDeadlyFloor: levelConfig.isDeadlyFloor || false,
            spawn: levelConfig.spawn,
            questionCount: levelConfig.questionCount,
            hint: levelConfig.hint,
            bonusInfo: levelConfig.bonusInfo,
            bonusInfoImgs: [],
            badgeUrl: "",
            platforms: levelConfig.platforms,
            items: levelConfig.items,
            enemies: levelConfig.enemies,
            questions: questions
          });
          await newData.save();
          return newData;
        }
      }
    }
    return existingData;
  } catch (error) {
    console.error(`Error seeding ${level}:`, error);
    return null;
  }
};

export const getGameData = async (req, res) => {
  const { level } = req.params;
  
  try {
    let data = await GameData.findOne({ levelId: level });
    
    // If not found in DB, try to seed from static files
    if (!data) {
      data = await seedGameDataIfNeeded(level);
    }

    if (!data) {
      return res.status(404).json({ message: "Game data not found for this level" });
    }

    res.json({
      hint: data.hint,
      bonusInfo: data.bonusInfo,
      bonusInfoImgs: data.bonusInfoImgs,
      badgeUrl: data.badgeUrl,
      questions: data.questions
    });

  } catch (error) {
    console.error("Error fetching game data:", error);
    res.status(500).json({ message: "Failed to fetch game data", error: error.message });
  }
};

export const updateGameData = async (req, res) => {
  const { level } = req.params;
  const { hint, bonusInfo, bonusInfoImgs, badgeUrl, questions } = req.body;

  try {
    let data = await GameData.findOne({ levelId: level });
    
    if (!data) {
      data = await seedGameDataIfNeeded(level);
      if (!data) {
        return res.status(404).json({ message: "Game data not found for this level" });
      }
    }

    data.hint = hint;
    data.bonusInfo = bonusInfo;
    data.bonusInfoImgs = bonusInfoImgs || [];
    data.badgeUrl = badgeUrl || "";
    data.questions = questions;

    await data.save();

    res.json({ message: "Game data updated successfully" });

  } catch (error) {
    console.error("Error updating game data:", error);
    res.status(500).json({ message: "Failed to update game data", error: error.message });
  }
};

/* --- Public Route for Game Client --- */
export const getPublicGameData = async (req, res) => {
  try {
    // If the DB is completely empty, we might want to seed all 5 levels 
    // to avoid the game breaking on first load before admin touches it.
    const count = await GameData.countDocuments();
    if (count === 0) {
      const levels = ['level1', 'level2', 'level3', 'level4', 'level5'];
      for (let l of levels) {
        await seedGameDataIfNeeded(l);
      }
    }

    const allData = await GameData.find({});
    
    // Reconstruct the LEVELS object shape expected by the game
    const LEVELS = {};
    allData.forEach(levelData => {
      LEVELS[levelData.levelId] = {
        key: levelData.levelId,
        title: levelData.title,
        backgroundKey: levelData.backgroundKey,
        isDeadlyFloor: levelData.isDeadlyFloor,
        spawn: levelData.spawn,
        questionCount: levelData.questionCount,
        hint: levelData.hint,
        bonusInfo: levelData.bonusInfo,
        bonusInfoImgs: levelData.bonusInfoImgs,
        badgeUrl: levelData.badgeUrl,
        platforms: levelData.platforms,
        items: levelData.items,
        enemies: levelData.enemies,
        questionData: levelData.questions // Map to plain object
      };
    });

    res.json({ LEVELS });
  } catch (error) {
    console.error("Error fetching public game data:", error);
    res.status(500).json({ message: "Failed to fetch public game data", error: error.message });
  }
};
