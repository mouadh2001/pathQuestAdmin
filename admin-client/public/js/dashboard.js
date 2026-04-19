const API_URL = "/api/player";
if (!localStorage.getItem("adminToken")) {
  window.location.href = "login.html";
}

function getToken() {
  return localStorage.getItem("adminToken");
}

async function createPlayer() {
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const token = getToken();
  if (!token) return alert("Not authorized");

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
      alert("Player created");
      loadPlayers();
    } else {
      alert(data.message || "Error");
    }
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}

let playersCache = [];
let selectedPlayerId = null;
let currentSortKey = "score";

async function loadPlayers() {
  const token = getToken();
  if (!token) return alert("Not authorized");

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

async function renderPlayers() {
  const tbody = document.getElementById("playersTable");
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

async function renderPlayerDetails(player) {
  const details = document.getElementById("playerDetails");
  const content = document.getElementById("detailsContent");

  if (!player) {
    details.classList.add("hidden");
    content.innerHTML = "";
    return;
  }

  details.classList.remove("hidden");

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

  let firstScore = historyData.length > 0 ? historyData[0].score : 0;
  let lastScore =
    historyData.length > 0 ? historyData[historyData.length - 1].score : 0;
  let tauxAmelioration =
    firstScore > 0
      ? (((lastScore - firstScore) / firstScore) * 100).toFixed(1)
      : 0;
  let vitesseApprentissage =
    historyData.length > 1
      ? ((lastScore - firstScore) / (historyData.length - 1)).toFixed(1)
      : 0;

  // Fréquence
  let freqSessions = "Not calculable";
  if (historyData.length > 1) {
    const firstDate = new Date(historyData[0].pushedAt);
    const lastDate = new Date(historyData[historyData.length - 1].pushedAt);
    const diffWeeks = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7);
    if (diffWeeks > 0.01) {
      freqSessions =
        (historyData.length / diffWeeks).toFixed(1) + " sessions/week";
    } else {
      freqSessions = historyData.length + " sessions (under 1 week)";
    }
  } else if (historyData.length === 1) {
    freqSessions = "1 unique session";
  }

  // Correlation calculation (Pearson loosely) on history (Time spent vs Score)
  let correlationMsg = "Not calculable (too few data)";
  if (historyData.length > 2) {
    // array of x (time), y (score)
    const X = historyData.map((h) => h.metrics?.observationTime || 0);
    const Y = historyData.map((h) => h.score || 0);
    const sumX = X.reduce((a, b) => a + b, 0);
    const sumY = Y.reduce((a, b) => a + b, 0);
    const sumXY = X.reduce((a, b, i) => a + b * Y[i], 0);
    const sumX2 = X.reduce((a, b) => a + b * b, 0);
    const sumY2 = Y.reduce((a, b) => a + b * b, 0);
    const n = historyData.length;
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );
    if (denominator !== 0) {
      const r = numerator / denominator;
      if (r > 0.5) correlationMsg = `Strong (r=${r.toFixed(2)})`;
      else if (r > 0.1) correlationMsg = `Weak Positive (r=${r.toFixed(2)})`;
      else if (r > -0.1) correlationMsg = `Zero (r=${r.toFixed(2)})`;
      else correlationMsg = `Negative (r=${r.toFixed(2)})`;
    }
  }

  let levelStatsHtml = "";
  if (player.levelStats && Object.keys(player.levelStats).length > 0) {
    for (const [levelKey, levelData] of Object.entries(player.levelStats)) {
      let questionStatsHtml = "";
      if (
        levelData.questionStats &&
        Object.keys(levelData.questionStats).length > 0
      ) {
        const rows = Object.entries(levelData.questionStats)
          .map(
            ([qId, st]) => `
            <tr>
              <td>${qId}</td>
              <td style="color: green; font-weight: bold;">${st.correct || 0}</td>
              <td style="color: red; font-weight: bold;">${st.wrong || 0}</td>
              <td>${st.firstTrySuccess ? "✅ Yes" : "❌ No"}</td>
              <td>${st.timeSpent ? st.timeSpent + "s" : "-"}</td>
            </tr>
          `,
          )
          .join("");

        questionStatsHtml = `
          <div style="overflow-x: auto;">
            <table class="question-stats">
              <thead>
                <tr>
                  <th>Question ID</th>
                  <th>Correct</th>
                  <th>Incorrect</th>
                  <th>First Try Success?</th>
                  <th>Time Spent (s)</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      }

      const metrics = levelData.metrics || {};
      const totalQuestions = metrics.totalQuestionsAnswered || 0;
      const firstTryCount = metrics.firstTrySuccessCount || 0;
      globalFirstTryCount += firstTryCount;
      globalQuestionsAnswered += totalQuestions;

      const successRate =
        totalQuestions > 0
          ? Math.round((firstTryCount / totalQuestions) * 100)
          : 0;

      levelStatsHtml += `
        <details class="level-details">
          <summary>Level: ${levelKey.toUpperCase()} <span style="font-size: 13px; color: #6b7280; font-weight: normal; margin-left: 10px;">(Score: ${levelData.score || 0})</span></summary>
          
          <div class="level-content">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0;">
              <div style="background: #fdf2f8; padding: 10px; border-radius: 6px; flex: 1; min-width: 200px;">
                <h4 style="margin: 0 0 5px 0; color: #9d174d;">Academic Performance</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
                  <li>Score: <strong>${levelData.score || 0}</strong></li>
                  <li>Success rate per level (1st try): <strong>${successRate}%</strong></li>
                  <li>Successful questions (1st try) / Total: <strong>${firstTryCount} / ${totalQuestions}</strong></li>
                </ul>
              </div>
              
              <div style="background: #eff6ff; padding: 10px; border-radius: 6px; flex: 1; min-width: 200px;">
                <h4 style="margin: 0 0 5px 0; color: #1e3a8a;">Learning Curve</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
                  <li>Number of attempts (Deaths/Restarts): <strong>${metrics.levelAttempts || 1}</strong></li>
                </ul>
              </div>

              <div style="background: #f0fdf4; padding: 10px; border-radius: 6px; flex: 1; min-width: 200px;">
                <h4 style="margin: 0 0 5px 0; color: #14532d;">Time & Engagement</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
                  <li>Observation Time: <strong>${metrics.observationTime || 0}s</strong></li>
                  <li>Avg. Response Time: <strong>${metrics.averageResponseTime || 0}s</strong></li>
                  <li>Time per level (Session): <strong>${metrics.sessionDuration || levelData.time || 0}s</strong></li>
                </ul>
              </div>
            </div>
            
            <h4 style="margin: 10px 0 5px 0; color: #374151;">Questions Data</h4>
            ${questionStatsHtml}
          </div>
        </details>
      `;
    }
  } else {
    levelStatsHtml =
      "<p style='margin-top: 15px; color: #6b7280;'>No level-specific stats recorded yet.</p>";
  }

  const globalSuccessRate =
    globalQuestionsAnswered > 0
      ? Math.round((globalFirstTryCount / globalQuestionsAnswered) * 100)
      : 0;
  const averageSessionTime = player.stats?.totalSessions
    ? Math.round(player.stats.time / player.stats.totalSessions)
    : 0;

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0;">Global Overview</h3>
      <button id="exportCsvBtn" style="padding: 8px 15px; background: #10b981; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer;">
        📥 Export Excel (History)
      </button>
    </div>
    <dl style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 20px; background: #fafafa; padding: 10px; border-radius: 5px;">
      <dt style="font-weight: bold;">Username</dt><dd style="margin-left: 0;">${player.username}</dd>
      <dt style="font-weight: bold;">Email</dt><dd style="margin-left: 0;">${player.email}</dd>
      <dt style="font-weight: bold;">Global Success Rate (1st try)</dt><dd style="margin-left: 0; color: green; font-weight: bold;">${globalSuccessRate}%</dd>
      <dt style="font-weight: bold;">Improvement Rate</dt><dd style="margin-left: 0;">${tauxAmelioration}%</dd>
      <dt style="font-weight: bold;">Learning Speed</dt><dd style="margin-left: 0;">${vitesseApprentissage} pts/session</dd>
      <dt style="font-weight: bold;">Total Playtime</dt><dd style="margin-left: 0;">${player.stats?.time ?? 0}s</dd>
      <dt style="font-weight: bold;">Avg. Session Duration</dt><dd style="margin-left: 0;">${averageSessionTime}s</dd>
      <dt style="font-weight: bold;">Session Frequency</dt><dd style="margin-left: 0;">${freqSessions}</dd>
      <dt style="font-weight: bold;">Correlation (Obs. Time / Score)</dt><dd style="margin-left: 0;">${correlationMsg}</dd>
    </dl>
    
    <div style="border-top: 2px solid #ccc; padding-top: 15px; margin-top: 20px; margin-bottom: 20px;">
      <h3 style="margin-top: 0;">Analytics Charts (Chart.js)</h3>
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 300px; max-width: 400px; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
           <canvas id="scoreVsTryChart"></canvas>
        </div>
        <div style="flex: 1; min-width: 300px; max-width: 400px; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
           <canvas id="timeVsDayChart"></canvas>
        </div>
        <div style="flex: 1; min-width: 300px; max-width: 400px; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
           <canvas id="learningProgressionChart"></canvas>
        </div>
      </div>
    </div>

    <div style="border-top: 2px solid #ccc; padding-top: 15px;">
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
  if (historyData.length > 0) {
    const labelsTries = historyData.map((_, i) => `T\${i + 1}`);
    const scoreData = historyData.map((h) => h.score);
    const timeData = historyData.map(
      (h) => h.metrics?.averageResponseTime || 0,
    );
    const labelsDates = historyData.map((h) =>
      new Date(h.pushedAt).toLocaleDateString(),
    );
    const successRateData = historyData.map((h) => {
      const qAnswered = (h.correct || 0) + (h.incorrect || 0);
      const firstTry = h.metrics?.firstTrySuccessCount || 0;
      return qAnswered > 0 ? ((firstTry / qAnswered) * 100).toFixed(1) : 0;
    });

    new Chart(document.getElementById("scoreVsTryChart"), {
      type: "line",
      data: {
        labels: labelsTries,
        datasets: [
          {
            label: "Score vs Tentative (Progression)",
            data: scoreData,
            borderColor: "#10b981",
            tension: 0.1,
          },
        ],
      },
    });

    new Chart(document.getElementById("timeVsDayChart"), {
      type: "line",
      data: {
        labels: labelsDates,
        datasets: [
          {
            label: "Temps de Rép. Moyen (s)",
            data: timeData,
            borderColor: "#3b82f6",
            tension: 0.1,
          },
          {
            label: "Score Global",
            data: scoreData,
            borderColor: "#8b5cf6",
            tension: 0.1,
          },
        ],
      },
    });

    new Chart(document.getElementById("learningProgressionChart"), {
      type: "line",
      data: {
        labels: labelsTries,
        datasets: [
          {
            label: "Taux de réussite (%) vs Session",
            data: successRateData,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.2)",
            fill: true,
            tension: 0.1,
          },
        ],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  }
}

async function setSort(key) {
  currentSortKey = key;
  await renderPlayers();
}

window.onload = () => {
  document
    .getElementById("sortScoreBtn")
    .addEventListener("click", () => setSort("score"));
  document
    .getElementById("sortTimeBtn")
    .addEventListener("click", () => setSort("time"));
  document
    .getElementById("sortCreatedBtn")
    .addEventListener("click", () => setSort("createdAt"));
  loadPlayers();
};

async function exportPlayerToExcel(player, historyData) {
  if (!historyData || historyData.length === 0) {
    alert("No history data available for this student.");
    return;
  }

  // 1. Initialize Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PathQuest System';
  workbook.created = new Date();

  const styleHeaderRow = (row) => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 25;
  };

  // --- SHEET 1: STUDENT SUMMARY ---
  const ws1 = workbook.addWorksheet('Student Summary');
  ws1.columns = [{ key: 'metric', width: 30 }, { key: 'value', width: 30 }];
  
  ws1.addRow(['STUDENT PERFORMANCE REPORT']).font = { size: 16, bold: true };
  ws1.addRow(['Export Date', new Date().toLocaleString()]);
  ws1.addRow([]);

  const summaryData = [
    ['Metric', 'Value'],
    ['Student Username', player.username],
    ['Student Email', player.email],
    ['Total Registered Sessions', historyData.length],
    ['Total Play Time (s)', player.stats?.time || 0]
  ];
  
  summaryData.forEach((r, i) => {
    const row = ws1.addRow(r);
    if (i === 0) styleHeaderRow(row);
  });

  // --- SHEET 2: SESSION LOGS ---
  const ws2 = workbook.addWorksheet('Session Logs');
  ws2.columns = [
    { header: 'Date/Time', key: 'date', width: 22 },
    { header: 'Level', key: 'level', width: 15 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Success (1st try)', key: 'successCount', width: 18 },
    { header: 'Success Rate', key: 'successRate', width: 15 },
    { header: 'Total Time (s)', key: 'time', width: 15 },
    { header: 'Obs. Time (s)', key: 'obsTime', width: 15 },
    { header: 'Avg. Resp. Time (s)', key: 'avgRespTime', width: 20 },
    { header: 'Attempts', key: 'attempts', width: 12 }
  ];
  
  styleHeaderRow(ws2.getRow(1));

  historyData.forEach(h => {
    const metrics = h.metrics || {};
    const totalQ = (h.correct || 0) + (h.incorrect || 0);
    const successRate = totalQ > 0 ? ((metrics.firstTrySuccessCount / totalQ) * 100).toFixed(1) + '%' : '0%';

    ws2.addRow({
      date: new Date(h.pushedAt).toLocaleString(),
      level: h.levelKey ? h.levelKey.toUpperCase() : "N/A",
      score: h.score || 0,
      successCount: `${metrics.firstTrySuccessCount || 0}/${totalQ}`,
      successRate: successRate,
      time: h.time || 0,
      obsTime: metrics.observationTime || 0,
      avgRespTime: metrics.averageResponseTime || 0,
      attempts: metrics.levelAttempts || 1
    });
  });

  // --- DOWNLOAD ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PathQuest_Report_${player.username.replace(/\s+/g, "_")}_${new Date().getTime()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
window.createPlayer = createPlayer;

function renderGlobalStats(players) {
  const container = document.getElementById("globalStats");
  const content = document.getElementById("globalStatsContent");
  if (!players || players.length === 0) {
    container.classList.add("hidden");
    return;
  }
  
  container.classList.remove("hidden");
  
  // Accumulateur pour les insights par niveau
  const levelAggregates = {};
  
  players.forEach((p) => {
    if (p.levelStats) {
      for (const [levelKey, lStats] of Object.entries(p.levelStats)) {
        if (!levelAggregates[levelKey]) {
          levelAggregates[levelKey] = {
            playersCount: 0,
            totalScore: 0,
            totalTime: 0,
            questions: {}
          };
        }
        levelAggregates[levelKey].playersCount += 1;
        levelAggregates[levelKey].totalScore += lStats.score || 0;
        levelAggregates[levelKey].totalTime += lStats.time || lStats.metrics?.sessionDuration || 0;
        
        if (lStats.questionStats) {
          for (const [qId, qStat] of Object.entries(lStats.questionStats)) {
            if (!levelAggregates[levelKey].questions[qId]) {
              levelAggregates[levelKey].questions[qId] = { attemptedBy: 0, correctAnswers: 0, firstTrySuccesses: 0 };
            }
            levelAggregates[levelKey].questions[qId].attemptedBy += 1;
            if (qStat.correct > 0) {
              levelAggregates[levelKey].questions[qId].correctAnswers += 1;
            }
            if (qStat.firstTrySuccess) {
              levelAggregates[levelKey].questions[qId].firstTrySuccesses += 1;
            }
          }
        }
      }
    }
  });
  
  let insightsHtml = "";
  for (const [lvl, data] of Object.entries(levelAggregates)) {
    const avgLvlScore = (data.totalScore / data.playersCount).toFixed(1);
    const avgLvlTime = (data.totalTime / data.playersCount).toFixed(1);
    
    let qHtml = "";
    if (Object.keys(data.questions).length > 0) {
      const qRows = Object.entries(data.questions).map(([qId, counts]) => {
        return `
          <tr>
            <td>${qId}</td>
            <td style="text-align: center; font-weight: bold; color: #0284c7;">${counts.correctAnswers}</td>
            <td style="text-align: center; font-weight: bold; color: #16a34a;">${counts.firstTrySuccesses}</td>
          </tr>
        `;
      }).join("");
      
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
  
  content.innerHTML = `
    <div style="width: 100%;">
      ${insightsHtml || "<p style='color: #6b7280;'>No level played yet.</p>"}
    </div>
  `;
}

/**
 * Exports player data to a professional, styled Excel workbook.
 * Requires: https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js
 */
async function exportGlobalExcel() {
  if (!playersCache || playersCache.length === 0) {
    alert("No player data available.");
    return;
  }

  // 1. Initialize Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PathQuest System';
  workbook.created = new Date();

  // Helper function to style headers
  const styleHeaderRow = (row) => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 25;
  };

  // --- SHEET 1: COHORT SUMMARY ---
  const ws1 = workbook.addWorksheet('Cohort Summary');
  ws1.columns = [{ key: 'metric', width: 30 }, { key: 'value', width: 25 }];
  
  const totalScore = playersCache.reduce((sum, p) => sum + (p.stats?.score || 0), 0);
  const totalCorrect = playersCache.reduce((sum, p) => sum + (p.stats?.correct || 0), 0);
  const totalIncorrect = playersCache.reduce((sum, p) => sum + (p.stats?.incorrect || 0), 0);
  
  ws1.addRow(['GLOBAL COHORT SUMMARY']).font = { size: 16, bold: true };
  ws1.addRow(['Export Date', new Date().toLocaleString()]);
  ws1.addRow([]);
  
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Players', playersCache.length],
    ['Avg Global Score', (totalScore / playersCache.length).toFixed(1)],
    ['Global Success Rate', totalCorrect + totalIncorrect > 0 ? ((totalCorrect / (totalCorrect + totalIncorrect)) * 100).toFixed(1) + '%' : '0%']
  ];
  
  summaryData.forEach((r, i) => {
    const row = ws1.addRow(r);
    if (i === 0) styleHeaderRow(row);
  });

  // --- SHEET 2: PLAYER DATA ---
  const ws2 = workbook.addWorksheet('Player Data');
  ws2.columns = [
    { header: 'ID', key: 'id', width: 15 },
    { header: 'Username', key: 'username', width: 20 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Reg. Date', key: 'date', width: 15 },
    { header: 'Total Score', key: 'score', width: 12 },
    { header: 'Total Sessions', key: 'sessions', width: 15 },
    { header: 'Success Rate', key: 'sr', width: 12 }
  ];
  
  styleHeaderRow(ws2.getRow(1));
  
  playersCache.forEach(p => {
    const total = (p.stats?.correct || 0) + (p.stats?.incorrect || 0);
    ws2.addRow({
      id: p._id,
      username: p.username,
      email: p.email,
      date: new Date(p.createdAt).toLocaleDateString(),
      score: p.stats?.score || 0,
      sessions: p.stats?.totalSessions || 0,
      sr: total > 0 ? ((p.stats.correct / total) * 100).toFixed(1) + '%' : '0%'
    });
  });

  // --- SHEET 3: LEVEL DETAILS ---
  const ws3 = workbook.addWorksheet('Level Details');
  ws3.columns = [
    { header: 'Username', key: 'username', width: 20 },
    { header: 'Level', key: 'level', width: 15 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Duration (s)', key: 'time', width: 15 },
    { header: 'Attempts', key: 'attempts', width: 10 }
  ];
  
  styleHeaderRow(ws3.getRow(1));
  
  playersCache.forEach(p => {
    if (p.levelStats) {
      Object.entries(p.levelStats).forEach(([levelKey, lStats]) => {
        ws3.addRow({
          username: p.username,
          level: levelKey.toUpperCase(),
          score: lStats.score || 0,
          time: lStats.time || lStats.metrics?.sessionDuration || 0,
          attempts: lStats.metrics?.levelAttempts || 1
        });
      });
    }
  });

  // --- SHEET 4: QUESTION PERFORMANCE ---
  const ws4 = workbook.addWorksheet('Question Performance');
  ws4.columns = [
    { header: 'Level', key: 'level', width: 15 },
    { header: 'Question ID', key: 'qId', width: 20 },
    { header: 'Attempted By (Players)', key: 'attempted', width: 25 },
    { header: 'Correct Answers (Final)', key: 'correct', width: 25 },
    { header: '1st Try Successes', key: 'firstTry', width: 20 }
  ];
  
  styleHeaderRow(ws4.getRow(1));
  
  const levelAggs = {};
  
  playersCache.forEach((p) => {
    if (p.levelStats) {
      for (const [levelKey, lStats] of Object.entries(p.levelStats)) {
        if (!levelAggs[levelKey]) {
          levelAggs[levelKey] = {
            playersCount: 0,
            totalScore: 0,
            totalTime: 0,
            questions: {}
          };
        }
        levelAggs[levelKey].playersCount += 1;
        levelAggs[levelKey].totalScore += lStats.score || 0;
        levelAggs[levelKey].totalTime += lStats.time || lStats.metrics?.sessionDuration || 0;
        if (lStats.questionStats) {
          for (const [qId, qStat] of Object.entries(lStats.questionStats)) {
            if (!levelAggs[levelKey].questions[qId]) {
              levelAggs[levelKey].questions[qId] = { attemptedBy: 0, correctAnswers: 0, firstTrySuccesses: 0 };
            }
            levelAggs[levelKey].questions[qId].attemptedBy += 1;
            if (qStat.correct > 0) {
              levelAggs[levelKey].questions[qId].correctAnswers += 1;
            }
            if (qStat.firstTrySuccess) {
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
        firstTry: counts.firstTrySuccesses
      });
    }
  }

  // --- SHEET 5: LEVEL PERFORMANCE ---
  const ws5 = workbook.addWorksheet('Level Performance');
  ws5.columns = [
    { header: 'Level', key: 'level', width: 20 },
    { header: 'Players Count', key: 'playersCount', width: 15 },
    { header: 'Average Score', key: 'avgScore', width: 15 },
    { header: 'Average Time (s)', key: 'avgTime', width: 20 }
  ];
  
  styleHeaderRow(ws5.getRow(1));
  
  for (const [lvl, data] of Object.entries(levelAggs)) {
    ws5.addRow({
      level: lvl.toUpperCase(),
      playersCount: data.playersCount,
      avgScore: data.playersCount > 0 ? Number((data.totalScore / data.playersCount).toFixed(1)) : 0,
      avgTime: data.playersCount > 0 ? Number((data.totalTime / data.playersCount).toFixed(1)) : 0
    });
  }

  // --- DOWNLOAD ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PathQuest_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

window.exportGlobalExcel = exportGlobalExcel;