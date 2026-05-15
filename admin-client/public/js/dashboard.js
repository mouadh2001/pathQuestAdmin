const API_URL = "/api/player";
if (!localStorage.getItem("adminToken")) {
  window.location.href = "login.html";
}

function getToken() {
  return localStorage.getItem("adminToken");
}

// Professional Notification System
function showNotification(message, type = "success", duration = 4000) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.className = `notification ${type} show`;

  setTimeout(() => {
    notification.classList.remove("show");
  }, duration);
}

async function createPlayer() {
  const btn = document.querySelector('button[onclick="createPlayer()"]');
  if (btn) btn.disabled = true;

  const usernameInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  const username = usernameInput.value;
  const email = emailInput.value;
  const password = passwordInput.value;

  const token = getToken();
  if (!token) {
    if (btn) btn.disabled = false;
    return showNotification("Not authorized", "error");
  }

  try {
    const res = await fetch(`${API_URL}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      showNotification("Player created successfully", "success");
      usernameInput.value = "";
      emailInput.value = "";
      passwordInput.value = "";
      loadPlayers();
    } else {
      showNotification(data.message || "Error creating player", "error");
    }
  } catch (err) {
    console.error(err);
    showNotification("Server error", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

let playersCache = [];
let selectedPlayerId = null;
let currentSortKey = "score";

async function loadPlayers() {
  const token = getToken();
  if (!token) return showNotification("Not authorized", "error");

  try {
    const res = await fetch(`${API_URL}/all`, {
      headers: { Authorization: token },
    });

    const players = await res.json();
    playersCache = Array.isArray(players) ? players : [];

    await renderPlayers();
    renderGlobalStats(playersCache);
  } catch (err) {
    console.error(err);
  }
}

function isPlayerUsingNewStats(player) {
  if (!player || !player.levelStats || Object.keys(player.levelStats).length === 0) {
    return false;
  }

  return Object.values(player.levelStats).every((levelData) =>
    levelData && levelData.attemptsPerQuestion !== undefined,
  );
}

function getRankTypeFromBadge(badge) {
  if (!badge) return null;
  if (badge.rankType) return String(badge.rankType).toLowerCase();
  const name = String(badge.name || "").toLowerCase();
  if (name.includes("diamond")) return "diamond";
  if (name.includes("gold")) return "gold";
  if (name.includes("silver")) return "silver";
  if (name.includes("bronze")) return "bronze";
  return null;
}

function formatBadgeLabel(rankType) {
  if (!rankType) return "None";
  return rankType.charAt(0).toUpperCase() + rankType.slice(1);
}

async function renderPlayers() {
  const tbody = document.getElementById("playersTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sortedPlayers = [...playersCache].sort((a, b) => {
    if (currentSortKey === "time") {
      return (a.stats?.time || 0) - (b.stats?.time || 0);
    }
    if (currentSortKey === "createdAt") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return (b.stats?.score || 0) - (a.stats?.score || 0);
  });

  sortedPlayers.forEach((p) => {
    const tr = document.createElement("tr");
    tr.classList.add("clickable");
    if (p._id === selectedPlayerId) {
      tr.classList.add("selected");
    }

    tr.innerHTML = `
      <td>${p.username}</td>
      <td>${p.email}</td>
      <td>${p.stats?.score ?? 0}</td>
      <td>${p.stats?.time ?? 0}</td>
      <td>${new Date(p.createdAt).toLocaleString()}</td>
      <td>
        <button class="btn-danger btn-sm" onclick="deletePlayer('${p._id}', '${p.username}')" title="Delete Player">Delete</button>
      </td>
    `;

    tr.addEventListener("click", () => selectPlayer(p._id));
    tbody.appendChild(tr);
  });

  if (selectedPlayerId) {
    const selectedPlayer = playersCache.find((p) => p._id === selectedPlayerId);
    await renderPlayerDetails(selectedPlayer);
  } else {
    await renderPlayerDetails(null);
  }
}

async function selectPlayer(id) {
  selectedPlayerId = id;
  await renderPlayers();
}

async function deletePlayer(playerId, username) {
  if (!confirm(`Are you sure you want to delete the player "${username}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const token = getToken();
    const response = await fetch(`/api/admin/players/${playerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': token,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to delete player');
    }

    // Remove from cache
    playersCache = playersCache.filter(p => p._id !== playerId);
    
    // Clear selection if deleted player was selected
    if (selectedPlayerId === playerId) {
      selectedPlayerId = null;
    }

    // Re-render the list
    await renderPlayers();
    
    showNotification(`Player "${username}" deleted successfully`, 'success');
  } catch (error) {
    console.error('Error deleting player:', error);
    showNotification('Failed to delete player: ' + error.message, 'error');
  }
}

async function renderPlayerDetails(player) {
  const details = document.getElementById("playerDetails");
  const content = document.getElementById("detailsContent");

  if (!player) {
    details.classList.add("hidden");
    content.innerHTML = "";
    return;
  }

  details.classList.remove("hidden");

  if (!isPlayerUsingNewStats(player)) {
    content.innerHTML = `
      <div style="padding: 20px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #b45309;">Legacy stats format detected</h3>
        <p style="margin: 0; color: #92400e;">
          This player's stored level stats are in an older format and are not displayed here.
          Only accounts using the new stats format are rendered in the dashboard.
        </p>
      </div>
    `;
    return;
  }

  // Fetch History for advanced charts and metrics
  let historyData = [];
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/admin/player/${player._id}/history`, {
      headers: { Authorization: token },
    });
    if (res.ok) {
      const json = await res.json();
      historyData = json.history || [];
    }
  } catch (e) {
    console.error("Error fetching history");
  }

  let globalFirstTryCount = 0;
  let globalQuestionsAnswered = 0;
  let levelStatsHtml = "";

  const newFormatHistoryData = historyData.filter(
    (h) => h.attemptsPerQuestion !== undefined,
  );

  const levelChartData = {};
  newFormatHistoryData.forEach((h) => {
    if (!levelChartData[h.levelKey]) {
      levelChartData[h.levelKey] = [];
    }
    levelChartData[h.levelKey].push({
      pushedAt: h.pushedAt,
      score: h.levelScore || 0,
      time: h.timeSpent || 0,
    });
  });
  const badgeCounters = { diamond: 0, gold: 0, silver: 0, bronze: 0 };
  if (player.levelStats && Object.keys(player.levelStats).length > 0) {
    for (const [levelKey, levelData] of Object.entries(player.levelStats)) {
      const rankType = getRankTypeFromBadge(levelData?.badges?.rankingBadge);
      if (rankType && badgeCounters[rankType] !== undefined) {
        badgeCounters[rankType] += 1;
      }
    }
  }

  if (player.levelStats && Object.keys(player.levelStats).length > 0) {
    let newFormatLevelsFound = false;
    for (const [levelKey, levelData] of Object.entries(player.levelStats)) {
      if (levelData.attemptsPerQuestion === undefined) {
        continue; // ignore old-format level stats
      }

      newFormatLevelsFound = true;
      const totalQuestions = (levelData.correct || 0) + (levelData.incorrect || 0);
      const firstTryCount = levelData.firstTryCorrectAnswers || 0;
      globalFirstTryCount += firstTryCount;
      globalQuestionsAnswered += totalQuestions;

      const successRate =
        totalQuestions > 0
          ? Math.round((firstTryCount / totalQuestions) * 100)
          : 0;

      const timesPlayed = levelChartData[levelKey]?.length || 0;
      
      // Calculate best performance for this level
      const levelHistoryEntries = newFormatHistoryData.filter(h => h.levelKey === levelKey);
      let bestPerformance = null;
      let lastAttemptBadgeLabel = "None";
      let bestPerformanceBadgeLabel = "None";
      if (levelHistoryEntries.length > 0) {
        bestPerformance = levelHistoryEntries.reduce((best, current) => {
          return (current.levelScore || 0) > (best.levelScore || 0) ? current : best;
        });

        const lastAttempt = levelHistoryEntries
          .slice()
          .sort((a, b) => new Date(b.pushedAt) - new Date(a.pushedAt))[0];
        lastAttemptBadgeLabel = formatBadgeLabel(
          getRankTypeFromBadge(lastAttempt?.badges?.rankingBadge),
        );
        bestPerformanceBadgeLabel = formatBadgeLabel(
          getRankTypeFromBadge(bestPerformance?.badges?.rankingBadge),
        );
      }
      
      const bestPerformanceHTML = bestPerformance ? `
        <div style="background: #f0fdf4; padding: 10px; border-radius: 6px; flex: 1; min-width: 200px;">
          <h4 style="margin: 0 0 5px 0; color: #15803d;">Best Performance</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
            <li>Score: <strong>${bestPerformance.levelScore || 0}</strong></li>
            <li>First-try correct answers: <strong>${bestPerformance.firstTryCorrectAnswers || 0}</strong></li>
            <li>First-try rate: <strong>${bestPerformance.correctAnswers + bestPerformance.incorrectAnswers > 0 ? Math.round((bestPerformance.firstTryCorrectAnswers / (bestPerformance.correctAnswers + bestPerformance.incorrectAnswers)) * 100) : 0}%</strong></li>
            <li>Best badge earned: <strong>${bestPerformanceBadgeLabel}</strong></li>
          </ul>
        </div>
      ` : '';
      
      const levelChartHTML = levelChartData[levelKey]
        ? `
            <div style="margin-top: 15px;">
              <h4 style="margin: 0 0 10px 0; color: #6b7280;">Performance Charts</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                  <canvas id="levelScoreChart-${levelKey}"></canvas>
                </div>
                <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                  <canvas id="levelTimeChart-${levelKey}"></canvas>
                </div>
              </div>
            </div>
          `
        : '';

      levelStatsHtml += `
        <details class="level-details">
          <summary>Level: ${levelKey.toUpperCase()} <span style="font-size: 13px; color: #6b7280; font-weight: normal; margin-left: 10px;">(Score: ${levelData.score || 0})</span></summary>
          <div class="level-content">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0;">
              <div style="background: #fdf2f8; padding: 10px; border-radius: 6px; flex: 1; min-width: 200px;">
                <h4 style="margin: 0 0 5px 0; color: #9d174d;">Last Attempt</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
                  <li>Score: <strong>${levelData.score || 0}</strong></li>
                  <li>First-try correct answers: <strong>${firstTryCount}</strong></li>
                  <li>Times played: <strong>${timesPlayed}</strong></li>
                  <li>First-try rate: <strong>${successRate}%</strong></li>
                  <li>Time spent: <strong>${levelData.time || 0}s</strong></li>
                  <li>Earned badge: <strong>${lastAttemptBadgeLabel}</strong></li>
                </ul>
              </div>
              ${bestPerformanceHTML}
            </div>
            ${levelChartHTML}
          </div>
        </details>
      `;
    }
    if (!newFormatLevelsFound) {
      levelStatsHtml =
        "<p style='margin-top: 15px; color: #6b7280;'>No new-format level stats recorded for this player.</p>";
    }
  } else {
    levelStatsHtml =
      "<p style='margin-top: 15px; color: #6b7280;'>No level-specific stats recorded yet.</p>";
  }

  const globalSuccessRate =
    globalQuestionsAnswered > 0
      ? Math.round((globalFirstTryCount / globalQuestionsAnswered) * 100)
      : 0;

  content.innerHTML = `
    <div style="background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
      <h3 style="margin-top: 0;">Player Overview</h3>
      <dl style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; color: #111827;">
        <dt style="font-weight: 700;">Username</dt><dd style="margin: 0;">${player.username}</dd>
        <dt style="font-weight: 700;">Email</dt><dd style="margin: 0;">${player.email}</dd>
        <dt style="font-weight: 700;">Global success rate (1st try)</dt><dd style="margin: 0; color: #16a34a; font-weight: 700;">${globalSuccessRate}%</dd>
        <dt style="font-weight: 700;">Total playtime</dt><dd style="margin: 0;">${player.stats?.time ?? 0}s</dd>
        <dt style="font-weight: 700;">Diamond badges</dt><dd style="margin: 0;"><strong>${badgeCounters.diamond}</strong></dd>
        <dt style="font-weight: 700;">Golden badges</dt><dd style="margin: 0;"><strong>${badgeCounters.gold}</strong></dd>
        <dt style="font-weight: 700;">Silver badges</dt><dd style="margin: 0;"><strong>${badgeCounters.silver}</strong></dd>
        <dt style="font-weight: 700;">Bronze badges</dt><dd style="margin: 0;"><strong>${badgeCounters.bronze}</strong></dd>
      </dl>
    </div>

    <div style="background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
      <h3 style="margin-top: 0;">Level Details</h3>
      ${levelStatsHtml}
    </div>
  `;

  // Export button logic
  const exportBtn = document.getElementById("exportCsvBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () =>
      exportPlayerToExcel(player, historyData),
    );
  }

  // Draw Charts
  if (newFormatHistoryData.length > 0) {
    Object.entries(levelChartData).forEach(([levelKey, entries]) => {
      const sortedEntries = entries.sort(
        (a, b) => new Date(a.pushedAt) - new Date(b.pushedAt),
      );
      const labels = sortedEntries.map((item) =>
        new Date(item.pushedAt).toLocaleDateString(),
      );
      const scores = sortedEntries.map((item) => item.score);
      const times = sortedEntries.map((item) => item.time);

      const scoreCanvas = document.getElementById(
        `levelScoreChart-${levelKey}`,
      );
      const timeCanvas = document.getElementById(`levelTimeChart-${levelKey}`);

      if (scoreCanvas) {
        new Chart(scoreCanvas, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Score",
                data: scores,
                borderColor: "#3b82f6",
                tension: 0.2,
              },
            ],
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: "Score" },
              },
            },
          },
        });
      }

      if (timeCanvas) {
        new Chart(timeCanvas, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Time Spent (s)",
                data: times,
                borderColor: "#f97316",
                tension: 0.2,
              },
            ],
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: "Time (s)" },
              },
            },
          },
        });
      }
    });
  }
}

async function setSort(key) {
  currentSortKey = key;
  await renderPlayers();
}

window.onload = () => {
  const sortScoreBtn = document.getElementById("sortScoreBtn");
  const sortTimeBtn = document.getElementById("sortTimeBtn");
  const sortCreatedBtn = document.getElementById("sortCreatedBtn");

  if (sortScoreBtn) {
    sortScoreBtn.addEventListener("click", () => setSort("score"));
  }
  if (sortTimeBtn) {
    sortTimeBtn.addEventListener("click", () => setSort("time"));
  }
  if (sortCreatedBtn) {
    sortCreatedBtn.addEventListener("click", () => setSort("createdAt"));
  }

  const globalStatsContainer = document.getElementById("globalStats");
  const playersTable = document.getElementById("playersTable");

  if (globalStatsContainer || playersTable) {
    loadPlayers();
  }

  const hash = window.location.hash;
  if (hash === "#gamedata-tab") {
    const gameDataTab = document.getElementById("gamedata-tab");
    if (gameDataTab) {
      switchTab("gamedata-tab");
    }
  }
};

async function exportPlayerToExcel(player, historyData) {
  if (!historyData || historyData.length === 0) {
    showNotification("No history data available for this student.", "warning");
    return;
  }

  // 1. Initialize Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PathQuest System";
  workbook.created = new Date();

  const styleHeaderRow = (row) => {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F81BD" },
    };
    row.alignment = { vertical: "middle", horizontal: "center" };
    row.height = 25;
  };

  // --- SHEET 1: STUDENT SUMMARY ---
  const ws1 = workbook.addWorksheet("Student Summary");
  ws1.columns = [
    { key: "metric", width: 30 },
    { key: "value", width: 30 },
  ];

  ws1.addRow(["STUDENT PERFORMANCE REPORT"]).font = { size: 16, bold: true };
  ws1.addRow(["Export Date", new Date().toLocaleString()]);
  ws1.addRow([]);

  const summaryData = [
    ["Metric", "Value"],
    ["Student Username", player.username],
    ["Student Email", player.email],
    ["Total Registered Sessions", historyData.length],
    ["Total Play Time (s)", player.stats?.time || 0],
  ];

  summaryData.forEach((r, i) => {
    const row = ws1.addRow(r);
    if (i === 0) styleHeaderRow(row);
  });

  // --- SHEET 2: SESSION LOGS ---
  const ws2 = workbook.addWorksheet("Session Logs");
  ws2.columns = [
    { header: "Date/Time", key: "date", width: 22 },
    { header: "Level", key: "level", width: 15 },
    { header: "Level Score", key: "score", width: 15 },
    { header: "Total Score", key: "totalScore", width: 15 },
    { header: "Success (1st try)", key: "successCount", width: 18 },
    { header: "Success Rate", key: "successRate", width: 15 },
    { header: "Time Spent (s)", key: "time", width: 15 },
  ];

  styleHeaderRow(ws2.getRow(1));

  historyData.forEach((h) => {
    const totalQ = (h.correctAnswers || 0) + (h.incorrectAnswers || 0);
    const firstTry = h.firstTryCorrectAnswers || 0;
    const successRate =
      totalQ > 0
        ? ((firstTry / totalQ) * 100).toFixed(1) + "%"
        : "0%";

    ws2.addRow({
      date: new Date(h.pushedAt).toLocaleString(),
      level: h.levelKey ? h.levelKey.toUpperCase() : "N/A",
      score: h.levelScore || 0,
      totalScore: h.totalScore || 0,
      successCount: `${firstTry}/${totalQ}`,
      successRate: successRate,
      time: h.timeSpent || 0,
    });
  });

  // --- DOWNLOAD ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PathQuest_Report_${player.username.replace(/\s+/g, "_")}_${new Date().getTime()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
window.createPlayer = createPlayer;
window.deletePlayer = deletePlayer;

function renderGlobalStats(players) {
  const container = document.getElementById("globalStats");
  const content = document.getElementById("globalStatsContent");
  if (!container || !content) return;

  if (!players || players.length === 0) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");

  // Accumulateur pour les insights par niveau
  const levelAggregates = {};

  const newPlayers = players.filter(isPlayerUsingNewStats);
  if (newPlayers.length === 0) {
    content.innerHTML = `
      <div style="padding: 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #1e40af;">No new-format player stats available</h3>
        <p style="margin: 0; color: #1e3a8a;">
          The dashboard is currently ignoring legacy-format accounts and will render global statistics only when new-format player stats exist.
        </p>
      </div>
    `;
    return;
  }

  newPlayers.forEach((p) => {
    if (p.levelStats) {
      for (const [levelKey, lStats] of Object.entries(p.levelStats)) {
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
    }
  });

  let insightsHtml = "";
  let chartData = null;

  for (const [lvl, data] of Object.entries(levelAggregates)) {
    const avgLvlScore = (data.totalScore / data.playersCount).toFixed(1);
    const avgLvlTime = (data.totalTime / data.playersCount).toFixed(1);

    let qHtml = "";
    if (Object.keys(data.questions).length > 0) {
      const qRows = Object.entries(data.questions)
        .map(([qId, counts]) => {
          return `
          <tr>
            <td>${qId}</td>
            <td style="text-align: center; font-weight: bold; color: #0284c7;">${counts.correctAnswers}</td>
            <td style="text-align: center; font-weight: bold; color: #16a34a;">${counts.firstTrySuccesses}</td>
          </tr>
        `;
        })
        .join("");

      qHtml = `
        <h4 style="margin: 15px 0 5px 0; color: #374151;">Performance per Question (out of ${data.playersCount} players total who played this level)</h4>
        <div style="overflow-x: auto;">
          <table class="question-stats" style="width: 100%;">
            <thead>
              <tr>
                <th style="text-align: left;">Question</th>
                <th style="text-align: center;">Players who answered correctly (Final)</th>
                <th style="text-align: center;">Players who answered correctly (1st try)</th>
              </tr>
            </thead>
            <tbody>${qRows}</tbody>
          </table>
        </div>
      `;
    }

    insightsHtml += `
      <div style="margin-bottom: 25px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <h3 style="margin-top:0; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Level : ${lvl.toUpperCase()}</h3>
        
        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin: 15px 0;">
          <div class="metric-box" style="background: white;">
            <div class="metric-title">Average Score</div>
            <div class="metric-value">${avgLvlScore}</div>
          </div>
          <div class="metric-box" style="background: white;">
            <div class="metric-title">Average Time (s)</div>
            <div class="metric-value">${avgLvlTime}</div>
          </div>
        </div>
        ${qHtml}
      </div>
    `;
  }

  // Prepare data for global chart
  chartData = prepareGlobalChartData(levelAggregates);

  content.innerHTML = `
    <div style="width: 100%; margin-bottom: 30px;">
      <h3 style="color: #1e3a8a; margin-bottom: 15px;">Global First-Try Success Overview</h3>
      <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <canvas id="global-chart" style="max-height: 400px;"></canvas>
      </div>
    </div>
    <div style="width: 100%;">
      ${insightsHtml || "<p style='color: #6b7280;'>No level played yet.</p>"}
    </div>
  `;

  // Render global chart after DOM is updated
  setTimeout(() => {
    if (chartData && chartData.labels.length > 0) {
      renderGlobalFirstTryChart(chartData);
    }
  }, 0);
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

function renderGlobalFirstTryChart(chartData) {
  const canvas = document.getElementById("global-chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (canvas.chartInstance) {
    canvas.chartInstance.destroy();
  }

  canvas.chartInstance = new Chart(ctx, {
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
      indexAxis: undefined,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            font: { size: 14, weight: "bold" },
            color: "#374151",
            padding: 15,
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleFont: { size: 12, weight: "bold" },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 6,
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
            font: { size: 13, weight: "bold" },
            color: "#374151",
            padding: 10,
          },
          ticks: {
            font: { size: 11 },
            color: "#6b7280",
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Number of Players (First-Try Success)",
            font: { size: 13, weight: "bold" },
            color: "#374151",
            padding: 10,
          },
          ticks: {
            stepSize: 1,
            font: { size: 12 },
            color: "#6b7280",
          },
          grid: { color: "rgba(0, 0, 0, 0.05)", drawBorder: false },
        },
      },
    },
  });

  // Add level labels below the chart
  addLevelLabels(canvas, chartData.levelNames, chartData.labels);
}

function addLevelLabels(canvas, levelNames, labels) {
  const container = canvas.parentElement;
  const existingLabel = container.querySelector(".level-labels");
  if (existingLabel) existingLabel.remove();

  const labelDiv = document.createElement("div");
  labelDiv.className = "level-labels";
  labelDiv.style.cssText = `
    display: flex;
    margin-top: 20px;
    position: relative;
    font-size: 12px;
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
      padding: 0 5px;
    `;
    labelElement.textContent = level.name;
    labelDiv.appendChild(labelElement);
    currentIndex = level.endIndex + 1;
  });

  container.appendChild(labelDiv);
}

function darkenColor(color) {
  // Convert hex to RGB, darken, and return
  const hex = color.replace("#", "");
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 30);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Exports player data to a professional, styled Excel workbook.
 * Requires: https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js
 */
async function exportGlobalExcel() {
  if (!playersCache || playersCache.length === 0) {
    showNotification("No player data available.", "warning");
    return;
  }

  // 1. Initialize Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PathQuest System";
  workbook.created = new Date();

  // Helper function to style headers
  const styleHeaderRow = (row) => {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F81BD" },
    };
    row.alignment = { vertical: "middle", horizontal: "center" };
    row.height = 25;
  };

  // --- SHEET 1: COHORT SUMMARY ---
  const ws1 = workbook.addWorksheet("Cohort Summary");
  ws1.columns = [
    { key: "metric", width: 30 },
    { key: "value", width: 25 },
  ];

  const totalScore = playersCache.reduce(
    (sum, p) => sum + (p.stats?.score || 0),
    0,
  );
  const totalCorrect = playersCache.reduce(
    (sum, p) => sum + (p.stats?.correct || 0),
    0,
  );
  const totalIncorrect = playersCache.reduce(
    (sum, p) => sum + (p.stats?.incorrect || 0),
    0,
  );

  ws1.addRow(["GLOBAL COHORT SUMMARY"]).font = { size: 16, bold: true };
  ws1.addRow(["Export Date", new Date().toLocaleString()]);
  ws1.addRow([]);

  const summaryData = [
    ["Metric", "Value"],
    ["Total Players", playersCache.length],
    ["Avg Global Score", (totalScore / playersCache.length).toFixed(1)],
    [
      "Global Success Rate",
      totalCorrect + totalIncorrect > 0
        ? ((totalCorrect / (totalCorrect + totalIncorrect)) * 100).toFixed(1) +
          "%"
        : "0%",
    ],
  ];

  summaryData.forEach((r, i) => {
    const row = ws1.addRow(r);
    if (i === 0) styleHeaderRow(row);
  });

  // --- SHEET 2: PLAYER DATA ---
  const ws2 = workbook.addWorksheet("Player Data");
  ws2.columns = [
    { header: "ID", key: "id", width: 15 },
    { header: "Username", key: "username", width: 20 },
    { header: "Email", key: "email", width: 25 },
    { header: "Reg. Date", key: "date", width: 15 },
    { header: "Total Score", key: "score", width: 12 },
    { header: "Total Sessions", key: "sessions", width: 15 },
    { header: "Success Rate", key: "sr", width: 12 },
  ];

  styleHeaderRow(ws2.getRow(1));

  playersCache.forEach((p) => {
    const total = (p.stats?.correct || 0) + (p.stats?.incorrect || 0);
    ws2.addRow({
      id: p._id,
      username: p.username,
      email: p.email,
      date: new Date(p.createdAt).toLocaleDateString(),
      score: p.stats?.score || 0,
      sessions: p.stats?.totalSessions || 0,
      sr: total > 0 ? ((p.stats.correct / total) * 100).toFixed(1) + "%" : "0%",
    });
  });

  // --- SHEET 3: LEVEL DETAILS ---
  const ws3 = workbook.addWorksheet("Level Details");
  ws3.columns = [
    { header: "Username", key: "username", width: 20 },
    { header: "Level", key: "level", width: 15 },
    { header: "Score", key: "score", width: 10 },
    { header: "Duration (s)", key: "time", width: 15 },
    { header: "Attempts", key: "attempts", width: 10 },
  ];

  styleHeaderRow(ws3.getRow(1));

  playersCache.forEach((p) => {
    if (p.levelStats) {
      Object.entries(p.levelStats).forEach(([levelKey, lStats]) => {
        ws3.addRow({
          username: p.username,
          level: levelKey.toUpperCase(),
          score: lStats.score || 0,
          time: lStats.time || lStats.metrics?.sessionDuration || 0,
          attempts: lStats.metrics?.levelAttempts || 1,
        });
      });
    }
  });

  // --- SHEET 4: QUESTION PERFORMANCE ---
  const ws4 = workbook.addWorksheet("Question Performance");
  ws4.columns = [
    { header: "Level", key: "level", width: 15 },
    { header: "Question ID", key: "qId", width: 20 },
    { header: "Attempted By (Players)", key: "attempted", width: 25 },
    { header: "Correct Answers (Final)", key: "correct", width: 25 },
    { header: "1st Try Successes", key: "firstTry", width: 20 },
  ];

  styleHeaderRow(ws4.getRow(1));

  const levelAggs = {};

  playersCache.filter(isPlayerUsingNewStats).forEach((p) => {
    if (p.levelStats) {
      for (const [levelKey, lStats] of Object.entries(p.levelStats)) {
        if (!levelAggs[levelKey]) {
          levelAggs[levelKey] = {
            playersCount: 0,
            totalScore: 0,
            totalTime: 0,
            questions: {},
          };
        }
        levelAggs[levelKey].playersCount += 1;
        levelAggs[levelKey].totalScore += lStats.score || 0;
        levelAggs[levelKey].totalTime +=
          lStats.time || lStats.metrics?.sessionDuration || 0;
        if (lStats.attemptsPerQuestion) {
          for (const [qId, attempts] of Object.entries(lStats.attemptsPerQuestion)) {
            if (!levelAggs[levelKey].questions[qId]) {
              levelAggs[levelKey].questions[qId] = {
                attemptedBy: 0,
                correctAnswers: 0,
                firstTrySuccesses: 0,
              };
            }
            levelAggs[levelKey].questions[qId].attemptedBy += 1;
            if (attempts > 0) {
              levelAggs[levelKey].questions[qId].correctAnswers += 1;
            }
            if (attempts === 1) {
              levelAggs[levelKey].questions[qId].firstTrySuccesses += 1;
            }
          }
        }
      }
    }
  });

  for (const [lvl, data] of Object.entries(levelAggs)) {
    for (const [qId, counts] of Object.entries(data.questions)) {
      ws4.addRow({
        level: lvl.toUpperCase(),
        qId: qId,
        attempted: counts.attemptedBy,
        correct: counts.correctAnswers,
        firstTry: counts.firstTrySuccesses,
      });
    }
  }

  // --- SHEET 5: LEVEL PERFORMANCE ---
  const ws5 = workbook.addWorksheet("Level Performance");
  ws5.columns = [
    { header: "Level", key: "level", width: 20 },
    { header: "Players Count", key: "playersCount", width: 15 },
    { header: "Average Score", key: "avgScore", width: 15 },
    { header: "Average Time (s)", key: "avgTime", width: 20 },
  ];

  styleHeaderRow(ws5.getRow(1));

  for (const [lvl, data] of Object.entries(levelAggs)) {
    ws5.addRow({
      level: lvl.toUpperCase(),
      playersCount: data.playersCount,
      avgScore:
        data.playersCount > 0
          ? Number((data.totalScore / data.playersCount).toFixed(1))
          : 0,
      avgTime:
        data.playersCount > 0
          ? Number((data.totalTime / data.playersCount).toFixed(1))
          : 0,
    });
  }

  // --- DOWNLOAD ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PathQuest_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

window.exportGlobalExcel = exportGlobalExcel;
