/**
 * Global Stats Page Logic
 * Handles loading and displaying global statistics across all players
 */

import { showNotification } from "./layout.js";

let globalStatsData = null;

export async function loadGlobalStats() {
  const statsContainer = document.getElementById("globalStats");
  const contentContainer = document.getElementById("globalStatsContent");

  if (!statsContainer || !contentContainer) {
    console.error("Global stats containers not found");
    return;
  }

  try {
    const adminToken = localStorage.getItem("adminToken");
    const [globalRes, playersRes] = await Promise.all([
      fetch("/api/admin/globalstats", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      }),
      fetch("/api/player/all", {
        method: "GET",
        headers: {
          Authorization: adminToken,
        },
      })
    ]);

    if (!globalRes.ok) {
      throw new Error("Failed to fetch global statistics");
    }
    if (!playersRes.ok) {
      throw new Error("Failed to fetch player data");
    }

    globalStatsData = await globalRes.json();
    const players = await playersRes.json();

    statsContainer.classList.remove("hidden");
    renderGlobalStats(contentContainer, globalStatsData, players);
  } catch (error) {
    console.error(error);
    showNotification(error.message, "error");
  }
}

function renderGlobalStats(container, data, players) {
  container.innerHTML = "";

  // 1. Create stat cards for key metrics
  const cardsContainer = document.createElement("div");
  cardsContainer.style.cssText = "display: flex; gap: 15px; flex-wrap: wrap; width: 100%; margin-bottom: 25px;";

  const statCards = [
    {
      label: "Total Players",
      value: data.totalPlayers || 0,
      icon: "👥",
    },
    {
      label: "Avg Score",
      value: (data.averageScore || 0).toFixed(2),
      icon: "🎯",
    },
    {
      label: "Avg Success Rate",
      value: `${(data.averageSuccessRate || 0).toFixed(1)}%`,
      icon: "✅",
    },
    {
      label: "Avg Time Spent",
      value: `${(data.averageTimeSpent || 0).toFixed(1)}s`,
      icon: "⏱️",
    },
  ];

  statCards.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.style.flex = "1 1 200px";
    card.innerHTML = `
      <div class="stat-icon">${stat.icon}</div>
      <div class="stat-content">
        <div class="stat-label">${stat.label}</div>
        <div class="stat-value">${stat.value}</div>
      </div>
    `;
    cardsContainer.appendChild(card);
  });
  container.appendChild(cardsContainer);

  // 2. Create charts row
  const chartsRow = document.createElement("div");
  chartsRow.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 20px; width: 100%; margin-bottom: 30px;";
  container.appendChild(chartsRow);

  // Render level stats chart in chartsRow
  if (data.levelStats && data.levelStats.length > 0) {
    renderLevelStatsChart(chartsRow, data.levelStats);
  }

  // 3. Process players for question-by-question metrics
  const levelAggregates = {};
  players.forEach((p) => {
    if (!p.levelStats) return;
    const levelStatsObj = p.levelStats instanceof Map ? Object.fromEntries(p.levelStats) : p.levelStats;
    if (!levelStatsObj) return;

    for (const [levelKey, lStats] of Object.entries(levelStatsObj)) {
      if (!lStats) continue;

      if (!levelAggregates[levelKey]) {
        levelAggregates[levelKey] = {
          playersCount: 0,
          totalScore: 0,
          totalTime: 0,
          questions: {},
        };
      }
      levelAggregates[levelKey].playersCount += 1;
      levelAggregates[levelKey].totalScore += lStats.score || 0;
      levelAggregates[levelKey].totalTime += lStats.time || 0;

      if (lStats.attemptsPerQuestion) {
        for (const [qId, attempts] of Object.entries(lStats.attemptsPerQuestion)) {
          if (!levelAggregates[levelKey].questions[qId]) {
            levelAggregates[levelKey].questions[qId] = {
              attemptedBy: 0,
              correctAnswers: 0,
              firstTrySuccesses: 0,
            };
          }
          levelAggregates[levelKey].questions[qId].attemptedBy += 1;
          if (attempts > 0) {
            levelAggregates[levelKey].questions[qId].correctAnswers += 1;
          }
          if (attempts === 1) {
            levelAggregates[levelKey].questions[qId].firstTrySuccesses += 1;
          }
        }
      }
    }
  });

  // Render question-by-question first-try success chart in chartsRow
  const chartData = prepareGlobalChartData(levelAggregates);
  if (chartData && chartData.labels.length > 0) {
    renderGlobalFirstTryChart(chartsRow, chartData);
  }

  // 4. Create Level Performance Summary Table
  if (data.levelStats && data.levelStats.length > 0) {
    const levelPerformanceContainer = document.createElement("div");
    levelPerformanceContainer.style.cssText = "width: 100%; margin-bottom: 30px;";
    
    const levelRows = data.levelStats.map((ls) => `
      <tr>
        <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #e2e8f0; color: #1e3a8a;">${ls.levelName}</td>
        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0;">${ls.playerCount}</td>
        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${ls.averageScore}</td>
        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #0284c7;">${ls.averageTime}s</td>
        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #16a34a;">${ls.averageCorrect}</td>
        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #ef4444;">${ls.averageIncorrect}</td>
        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #15803d;">${ls.averageSuccessRate}%</td>
      </tr>
    `).join("");

    levelPerformanceContainer.innerHTML = `
      <h3 style="color: #1e3a8a; margin-top: 0; margin-bottom: 15px;">Level Performance Summary</h3>
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 15px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
              <th style="text-align: left; padding: 12px; color: #475569; font-weight: 600;">Level</th>
              <th style="text-align: center; padding: 12px; color: #475569; font-weight: 600;">Active Players</th>
              <th style="text-align: center; padding: 12px; color: #475569; font-weight: 600;">Avg Score</th>
              <th style="text-align: center; padding: 12px; color: #475569; font-weight: 600;">Avg Time Spent</th>
              <th style="text-align: center; padding: 12px; color: #475569; font-weight: 600;">Avg Correct</th>
              <th style="text-align: center; padding: 12px; color: #475569; font-weight: 600;">Avg Incorrect</th>
              <th style="text-align: center; padding: 12px; color: #475569; font-weight: 600;">Avg Success Rate (1st Try)</th>
            </tr>
          </thead>
          <tbody>
            ${levelRows}
          </tbody>
        </table>
      </div>
    `;
    container.appendChild(levelPerformanceContainer);
  }

  // 5. Create Detailed Tables Section
  const tablesContainer = document.createElement("div");
  tablesContainer.style.cssText = "width: 100%; margin-top: 20px;";
  
  let insightsHtml = "";
  for (const [lvl, lvlData] of Object.entries(levelAggregates).sort()) {
    const avgLvlScore = (lvlData.totalScore / lvlData.playersCount).toFixed(1);
    const avgLvlTime = (lvlData.totalTime / lvlData.playersCount).toFixed(1);

    let qHtml = "";
    if (Object.keys(lvlData.questions).length > 0) {
      const qRows = Object.entries(lvlData.questions)
        .sort()
        .map(([qId, counts]) => {
          return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${qId}</td>
            <td style="text-align: center; font-weight: bold; color: #0284c7; padding: 10px; border-bottom: 1px solid #e2e8f0;">${counts.correctAnswers}</td>
            <td style="text-align: center; font-weight: bold; color: #16a34a; padding: 10px; border-bottom: 1px solid #e2e8f0;">${counts.firstTrySuccesses}</td>
          </tr>
        `;
        })
        .join("");

      qHtml = `
        <h4 style="margin: 15px 0 5px 0; color: #374151;">Performance per Question (out of ${lvlData.playersCount} players total who played this level)</h4>
        <div style="overflow-x: auto;">
          <table class="question-stats" style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="text-align: left; padding: 10px; color: #475569;">Question</th>
                <th style="text-align: center; padding: 10px; color: #475569;">Players who answered correctly (Final)</th>
                <th style="text-align: center; padding: 10px; color: #475569;">Players who answered correctly (1st try)</th>
              </tr>
            </thead>
            <tbody>${qRows}</tbody>
          </table>
        </div>
      `;
    }

    insightsHtml += `
      <div style="margin-bottom: 25px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <h3 style="margin-top:0; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Level: ${lvl.toUpperCase()}</h3>
        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin: 15px 0;">
          <div class="metric-box" style="background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; min-width: 120px;">
            <div class="metric-title" style="font-size: 12px; color: #64748b;">Average Score</div>
            <div class="metric-value" style="font-size: 20px; font-weight: bold; color: #1e293b;">${avgLvlScore}</div>
          </div>
          <div class="metric-box" style="background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; min-width: 120px;">
            <div class="metric-title" style="font-size: 12px; color: #64748b;">Average Time (s)</div>
            <div class="metric-value" style="font-size: 20px; font-weight: bold; color: #1e293b;">${avgLvlTime}</div>
          </div>
        </div>
        ${qHtml}
      </div>
    `;
  }

  tablesContainer.innerHTML = insightsHtml || "<p style='color: #6b7280;'>No level played yet.</p>";
  container.appendChild(tablesContainer);
}

function renderLevelStatsChart(parentContainer, levelStats) {
  const chartContainer = document.createElement("div");
  chartContainer.className = "chart-container";
  chartContainer.style.cssText = "background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);";
  chartContainer.innerHTML = `
    <h3 style="color: #1e3a8a; margin-top: 0; margin-bottom: 15px;">Performance by Level</h3>
    <canvas id="levelChart"></canvas>
  `;
  parentContainer.appendChild(chartContainer);

  // Render chart after DOM update
  setTimeout(() => {
    const ctx = document.getElementById("levelChart");
    if (ctx && window.Chart) {
      new window.Chart(ctx, {
        type: "bar",
        data: {
          labels: levelStats.map((ls) => ls.levelName),
          datasets: [
            {
              label: "Avg Success Rate (%)",
              data: levelStats.map((ls) => ls.averageSuccessRate || 0),
              backgroundColor: "rgba(16, 185, 129, 0.7)",
              borderColor: "rgba(16, 185, 129, 1)",
              borderWidth: 2,
            },
            {
              label: "Avg Score",
              data: levelStats.map((ls) => ls.averageScore || 0),
              backgroundColor: "rgba(14, 165, 233, 0.7)",
              borderColor: "rgba(14, 165, 233, 1)",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              position: "top",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });
    }
  }, 100);
}

function prepareGlobalChartData(levelAggregates) {
  const labels = [];
  const data = [];
  const colors = [];
  const levelNames = [];
  let lastLevelIndex = -1;

  const colorPalette = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#6366f1",
    "#14b8a6",
    "#f97316",
  ];

  Object.entries(levelAggregates)
    .sort()
    .forEach((entry, levelIdx) => {
      const [levelKey, levelData] = entry;
      const questions = Object.keys(levelData.questions).sort();

      questions.forEach((qId) => {
        labels.push(qId);
        data.push(levelData.questions[qId].firstTrySuccesses);
        colors.push(colorPalette[levelIdx % colorPalette.length]);
      });

      lastLevelIndex = labels.length - 1;
      levelNames.push({
        name: levelKey.toUpperCase(),
        endIndex: lastLevelIndex,
      });
    });

  return { labels, data, colors, levelNames };
}

function renderGlobalFirstTryChart(parentContainer, chartData) {
  const chartContainer = document.createElement("div");
  chartContainer.className = "chart-container";
  chartContainer.style.cssText = "background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);";
  chartContainer.innerHTML = `
    <h3 style="color: #1e3a8a; margin-top: 0; margin-bottom: 15px;">Global First-Try Success Overview</h3>
    <canvas id="global-chart" style="max-height: 400px;"></canvas>
  `;
  parentContainer.appendChild(chartContainer);

  setTimeout(() => {
    const canvas = document.getElementById("global-chart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (canvas.chartInstance) {
      canvas.chartInstance.destroy();
    }

    canvas.chartInstance = new window.Chart(ctx, {
      type: "bar",
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: "Players with First-Try Success",
            data: chartData.data,
            backgroundColor: chartData.colors,
            borderColor: chartData.colors.map((c) => darkenColor(c)),
            borderWidth: 2,
            borderRadius: 6,
            hoverBackgroundColor: chartData.colors.map((c) => darkenColor(c)),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              font: { size: 12, weight: "bold" },
              color: "#374151",
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            callbacks: {
              title: function (context) {
                const index = context[0].dataIndex;
                const labels = chartData.labels;
                const levelInfo = chartData.levelNames.find(
                  (l) => index <= l.endIndex,
                );
                return `${levelInfo?.name || ""} - ${labels[index]}`;
              },
              label: function (context) {
                return `${context.dataset.label}: ${context.parsed.y} players`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Questions by Level",
              font: { size: 11, weight: "bold" },
            },
            ticks: { font: { size: 10 } },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Number of Players",
              font: { size: 11, weight: "bold" },
            },
            ticks: { stepSize: 1 },
            grid: { color: "rgba(0, 0, 0, 0.05)" },
          },
        },
      },
    });

    addLevelLabels(canvas, chartData.levelNames, chartData.labels);
  }, 100);
}

function addLevelLabels(canvas, levelNames, labels) {
  const container = canvas.parentElement;
  const existingLabel = container.querySelector(".level-labels");
  if (existingLabel) existingLabel.remove();

  const labelDiv = document.createElement("div");
  labelDiv.className = "level-labels";
  labelDiv.style.cssText = `
    display: flex;
    margin-top: 15px;
    position: relative;
    font-size: 11px;
    font-weight: bold;
    color: #1e3a8a;
  `;

  let currentIndex = 0;
  levelNames.forEach((level) => {
    const questionsInLevel = level.endIndex - currentIndex + 1;
    const labelElement = document.createElement("div");
    labelElement.style.cssText = `
      flex: 0 0 calc(${(questionsInLevel / labels.length) * 100}%);
      text-align: center;
      padding: 0 2px;
    `;
    labelElement.textContent = level.name;
    labelDiv.appendChild(labelElement);
    currentIndex = level.endIndex + 1;
  });

  container.appendChild(labelDiv);
}

function darkenColor(color) {
  const hex = color.replace("#", "");
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 30);
  return `rgb(${r}, ${g}, ${b})`;
}

export async function exportGlobalExcel() {
  if (!globalStatsData) {
    showNotification("No data to export", "warning");
    return;
  }

  try {
    // Download CSV file
    const response = await fetch("/api/admin/export/globalstats", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to export global statistics");
    }

    // Get the CSV content
    const csvContent = await response.text();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `global-stats-${new Date().getTime()}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    showNotification("Global stats exported successfully!", "success");
  } catch (error) {
    console.error(error);
    showNotification("Failed to export data", "error");
  }
}

// Auto-load stats on page load
document.addEventListener("DOMContentLoaded", () => {
  loadGlobalStats();
});

// Export functions to window for HTML onclick handlers
window.loadGlobalStats = loadGlobalStats;
window.exportGlobalExcel = exportGlobalExcel;
