import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The game data is in the Patho Quest final/src/data folder
const gameDataPath = path.resolve(__dirname, '../../../Patho Quest final/src/data');

export const getGameData = async (req, res) => {
  const { level } = req.params;
  
  try {
    const levelConfigsPath = path.join(gameDataPath, 'levelConfigs.js');
    const questionsPath = path.join(gameDataPath, `${level}Questions.js`);

    if (!fs.existsSync(levelConfigsPath) || !fs.existsSync(questionsPath)) {
      return res.status(404).json({ message: "Game data files not found for this level" });
    }

    // Bypass cache with timestamp
    const timestamp = Date.now();
    const configModule = await import(`file://${levelConfigsPath}?update=${timestamp}`);
    const questionsModule = await import(`file://${questionsPath}?update=${timestamp}`);

    // If level key is like 'level5  ', trim it just in case
    const levelConfig = configModule.LEVELS[level] || configModule.LEVELS[level + '  '];
    const questionsObjName = `${level}Questions`;
    const questions = questionsModule[questionsObjName];

    if (!levelConfig) {
      return res.status(404).json({ message: "Level configuration not found in data" });
    }

    res.json({
      hint: levelConfig.hint,
      bonusInfo: levelConfig.bonusInfo,
      questions: questions
    });

  } catch (error) {
    console.error("Error fetching game data:", error);
    res.status(500).json({ message: "Failed to fetch game data", error: error.message });
  }
};

export const updateGameData = async (req, res) => {
  const { level } = req.params;
  const { hint, bonusInfo, questions } = req.body;

  try {
    const levelConfigsPath = path.join(gameDataPath, 'levelConfigs.js');
    const questionsPath = path.join(gameDataPath, `${level}Questions.js`);

    // 1. Update levelConfigs.js using Regex
    let configsContent = fs.readFileSync(levelConfigsPath, 'utf8');
    
    // Replace hint
    const hintRegex = new RegExp(`(${level}:\\s*{[\\s\\S]*?hint:\\s*)(["'\`][\\s\\S]*?["'\`])(,)`);
    if (hintRegex.test(configsContent)) {
      configsContent = configsContent.replace(hintRegex, `$1${JSON.stringify(hint)}$3`);
    } else {
      console.warn("Could not find hint regex match for", level);
    }

    // Replace bonusInfo
    const bonusRegex = new RegExp(`(${level}:\\s*{[\\s\\S]*?bonusInfo:\\s*)(["'\`][\\s\\S]*?["'\`])(,)`);
    if (bonusRegex.test(configsContent)) {
      configsContent = configsContent.replace(bonusRegex, `$1${JSON.stringify(bonusInfo)}$3`);
    } else {
      console.warn("Could not find bonusInfo regex match for", level);
    }

    fs.writeFileSync(levelConfigsPath, configsContent, 'utf8');

    // 2. Update levelXQuestions.js using JSON stringify
    const questionsObjName = `${level}Questions`;
    const questionsContent = `export const ${questionsObjName} = ${JSON.stringify(questions, null, 2)};\n`;
    fs.writeFileSync(questionsPath, questionsContent, 'utf8');

    res.json({ message: "Game data updated successfully" });

  } catch (error) {
    console.error("Error updating game data:", error);
    res.status(500).json({ message: "Failed to update game data", error: error.message });
  }
};
