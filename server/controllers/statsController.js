import Player from "../models/player.js";
import PlayerStat from "../models/playerStat.js";

/**
 * Calculate global statistics across all players
 */
export async function getGlobalStats(req, res) {
  try {
    const players = await Player.find();
    const playerStats = await PlayerStat.find();

    if (!players || players.length === 0) {
      return res.json({
        totalPlayers: 0,
        averageScore: 0,
        averageTimeSpent: 0,
        averageSuccessRate: 0,
        totalQuestionsAnswered: 0,
        levelStats: [],
      });
    }

    // Calculate aggregated stats
    let totalScore = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalTime = 0;
    let totalQuestionsAnswered = 0;
    const levelStatsMap = {};

    players.forEach((player) => {
      totalScore += player.stats?.score || 0;
      totalCorrect += player.stats?.correct || 0;
      totalIncorrect += player.stats?.incorrect || 0;
      totalTime += player.stats?.time || 0;
      totalQuestionsAnswered +=
        (player.stats?.correct || 0) + (player.stats?.incorrect || 0);

      // Calculate level stats
      const levelStatsObj = player.levelStats instanceof Map ? Object.fromEntries(player.levelStats) : (player.levelStats || {});
      if (levelStatsObj && typeof levelStatsObj === "object") {
        Object.entries(levelStatsObj).forEach(([levelKey, levelStat]) => {
          if (!levelStatsMap[levelKey]) {
            levelStatsMap[levelKey] = {
              levelName: levelKey.replace("level", "Level "),
              totalScore: 0,
              totalCorrect: 0,
              totalIncorrect: 0,
              totalFirstTry: 0,
              totalTime: 0,
              playerCount: 0,
            };
          }
          levelStatsMap[levelKey].totalScore += levelStat?.score || 0;
          levelStatsMap[levelKey].totalCorrect += levelStat?.correct || 0;
          levelStatsMap[levelKey].totalIncorrect += levelStat?.incorrect || 0;
          levelStatsMap[levelKey].totalFirstTry += levelStat?.firstTryCorrectAnswers || 0;
          levelStatsMap[levelKey].totalTime += levelStat?.time || 0;
          levelStatsMap[levelKey].playerCount += 1;
        });
      }
    });

    // Calculate averages
    const averageScore =
      players.length > 0 ? (totalScore / players.length).toFixed(2) : 0;
    const averageTimeSpent =
      players.length > 0 ? (totalTime / players.length).toFixed(1) : 0;
    const totalQuestionsAnsweredCount = totalCorrect + totalIncorrect;
    const averageSuccessRate =
      totalQuestionsAnsweredCount > 0
        ? ((totalCorrect / totalQuestionsAnsweredCount) * 100).toFixed(1)
        : 0;

    // Calculate level stats averages
    const levelStats = Object.values(levelStatsMap).map((ls) => {
      const totalQ = ls.totalCorrect + ls.totalIncorrect;
      const successRate = totalQ > 0 ? ((ls.totalFirstTry / totalQ) * 100).toFixed(1) : 0;
      return {
        levelName: ls.levelName,
        playerCount: ls.playerCount,
        averageScore: ls.playerCount > 0 ? (ls.totalScore / ls.playerCount).toFixed(1) : "0.0",
        averageTime: ls.playerCount > 0 ? (ls.totalTime / ls.playerCount).toFixed(1) : "0.0",
        averageCorrect: ls.playerCount > 0 ? (ls.totalCorrect / ls.playerCount).toFixed(1) : "0.0",
        averageIncorrect: ls.playerCount > 0 ? (ls.totalIncorrect / ls.playerCount).toFixed(1) : "0.0",
        averageSuccessRate: parseFloat(successRate),
      };
    });

    res.json({
      totalPlayers: players.length,
      averageScore: parseFloat(averageScore),
      averageTimeSpent: parseFloat(averageTimeSpent),
      averageSuccessRate: parseFloat(averageSuccessRate),
      totalQuestionsAnswered: totalQuestionsAnsweredCount,
      totalCorrectAnswers: totalCorrect,
      totalIncorrectAnswers: totalIncorrect,
      levelStats,
    });
  } catch (error) {
    console.error("Error fetching global stats:", error);
    res.status(500).json({
      message: "Failed to fetch global statistics",
      error: error.message,
    });
  }
}

/**
 * Export global stats as CSV
 */
export async function exportGlobalStatsCSV(req, res) {
  try {
    const players = await Player.find();

    if (!players || players.length === 0) {
      return res.status(404).json({ message: "No player data to export" });
    }

    // Calculate stats
    let totalScore = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalTime = 0;

    players.forEach((player) => {
      totalScore += player.stats?.score || 0;
      totalCorrect += player.stats?.correct || 0;
      totalIncorrect += player.stats?.incorrect || 0;
      totalTime += player.stats?.time || 0;
    });

    const averageScore = (totalScore / players.length).toFixed(2);
    const averageTimeSpent = (totalTime / players.length).toFixed(1);
    const totalQuestioned = totalCorrect + totalIncorrect;
    const averageSuccessRate =
      totalQuestioned > 0
        ? ((totalCorrect / totalQuestioned) * 100).toFixed(1)
        : 0;

    // Create CSV content
    let csvContent = `Global Statistics Report
Generated: ${new Date().toISOString()}

Metric,Value
Total Players,${players.length}
Average Score,${averageScore}
Average Time Spent (s),${averageTimeSpent}
Total Correct Answers,${totalCorrect}
Total Incorrect Answers,${totalIncorrect}
Average Success Rate (%),${averageSuccessRate}

Level Performance
Level,Players,Avg Score,Avg Time Spent (s),Avg Correct,Avg Incorrect,Avg Success Rate (%)`;

    // Calculate level stats
    const levelStatsMap = {};
    players.forEach((player) => {
      const levelStatsObj = player.levelStats instanceof Map ? Object.fromEntries(player.levelStats) : (player.levelStats || {});
      if (levelStatsObj && typeof levelStatsObj === "object") {
        Object.entries(levelStatsObj).forEach(([levelKey, levelStat]) => {
          if (!levelStatsMap[levelKey]) {
            levelStatsMap[levelKey] = {
              levelName: levelKey.replace("level", "Level "),
              totalScore: 0,
              totalCorrect: 0,
              totalIncorrect: 0,
              totalFirstTry: 0,
              totalTime: 0,
              playerCount: 0,
            };
          }
          levelStatsMap[levelKey].totalScore += levelStat?.score || 0;
          levelStatsMap[levelKey].totalCorrect += levelStat?.correct || 0;
          levelStatsMap[levelKey].totalIncorrect += levelStat?.incorrect || 0;
          levelStatsMap[levelKey].totalFirstTry += levelStat?.firstTryCorrectAnswers || 0;
          levelStatsMap[levelKey].totalTime += levelStat?.time || 0;
          levelStatsMap[levelKey].playerCount += 1;
        });
      }
    });

    Object.values(levelStatsMap).forEach((ls) => {
      const avgScore = (ls.totalScore / ls.playerCount).toFixed(2);
      const avgTime = (ls.totalTime / ls.playerCount).toFixed(1);
      const avgCorrect = (ls.totalCorrect / ls.playerCount).toFixed(1);
      const avgIncorrect = (ls.totalIncorrect / ls.playerCount).toFixed(1);
      const totalQ = ls.totalCorrect + ls.totalIncorrect;
      const successRate = totalQ > 0 ? ((ls.totalFirstTry / totalQ) * 100).toFixed(1) : 0;
      csvContent += `\n${ls.levelName},${ls.playerCount},${avgScore},${avgTime},${avgCorrect},${avgIncorrect},${successRate}`;
    });

    // Send CSV file
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=global-stats.csv",
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting global stats:", error);
    res.status(500).json({
      message: "Failed to export global statistics",
      error: error.message,
    });
  }
}

/**
 * Export all players stats as CSV
 */
export async function exportPlayersStatsCSV(req, res) {
  try {
    const players = await Player.find();

    if (!players || players.length === 0) {
      return res.status(404).json({ message: "No player data to export" });
    }

    // Create CSV header
    const csvLines = [
      "Username,Email,Total Score,Correct Answers,Incorrect Answers,Total Time Spent (s),Sessions,Created At",
    ];

    // Add player rows
    players.forEach((player) => {
      const score = player.stats?.score || 0;
      const correct = player.stats?.correct || 0;
      const incorrect = player.stats?.incorrect || 0;
      const timeSpent = Math.round(player.stats?.time || 0);
      const sessions = player.stats?.totalSessions || 0;
      const createdAt = new Date(player.createdAt).toISOString().split("T")[0];

      // Escape commas and quotes in strings
      const username = `"${(player.username || "").replace(/"/g, '""')}"`;
      const email = `"${(player.email || "").replace(/"/g, '""')}"`;

      csvLines.push(
        `${username},${email},${score},${correct},${incorrect},${timeSpent},${sessions},${createdAt}`,
      );
    });

    const csvContent = csvLines.join("\n");

    // Send CSV file
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=players-stats.csv",
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting player stats:", error);
    res.status(500).json({
      message: "Failed to export player statistics",
      error: error.message,
    });
  }
}

/**
 * Get detailed player statistics
 */
export async function getPlayersStats(req, res) {
  try {
    const players = await Player.find().select(
      "username email stats levelStats createdAt",
    );

    if (!players || players.length === 0) {
      return res.json({ players: [] });
    }

    res.json({ players });
  } catch (error) {
    console.error("Error fetching players stats:", error);
    res.status(500).json({
      message: "Failed to fetch player statistics",
      error: error.message,
    });
  }
}
