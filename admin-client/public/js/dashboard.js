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
  let freqSessions = "Non calculable";
  if (historyData.length > 1) {
    const firstDate = new Date(historyData[0].pushedAt);
    const lastDate = new Date(historyData[historyData.length - 1].pushedAt);
    const diffWeeks = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7);
    if (diffWeeks > 0.01) {
      freqSessions =
        (historyData.length / diffWeeks).toFixed(1) + " sessions/semaine";
    } else {
      freqSessions = historyData.length + " sessions (moins d'1 semaine)";
    }
  } else if (historyData.length === 1) {
    freqSessions = "1 session unique";
  }

  // Correlation calculation (Pearson loosely) on history (Time spent vs Score)
  let correlationMsg = "Non calculable (trop peu de données)";
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
      if (r > 0.5) correlationMsg = `Forte (r=${r.toFixed(2)})`;
      else if (r > 0.1) correlationMsg = `Positive Faible (r=${r.toFixed(2)})`;
      else if (r > -0.1) correlationMsg = `Nulle (r=${r.toFixed(2)})`;
      else correlationMsg = `Négative (r=${r.toFixed(2)})`;
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
              <td>${st.firstTrySuccess ? "✅ Oui" : "❌ Non"}</td>
              <td>${st.timeSpent ? st.timeSpent + "s" : "-"}</td>
            </tr>
          `,
          )
          .join("");

        questionStatsHtml = `
          <table style="width: 100%; border-collapse: collapse; margin-top: 5px; text-align: left; background: #f9fafb;">
            <thead>
              <tr style="border-bottom: 2px solid #ccc;">
                <th style="padding: 4px;">Question ID</th>
                <th style="padding: 4px;">Correct</th>
                <th style="padding: 4px;">Incorrect</th>
                <th style="padding: 4px;">First Try Success?</th>
                <th style="padding: 4px;">Time Spent (s)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
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
        <div style="margin-top: 15px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 5px;">
          <h3 style="margin-top:0; margin-bottom: 5px; color: #1f2937; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Level: ${levelKey.toUpperCase()}</h3>
          
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0;">
            <div style="background: #fdf2f8; padding: 10px; border-radius: 6px; flex: 1; min-width: 200px;">
              <h4 style="margin: 0 0 5px 0; color: #9d174d;">Performance Académique</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
                <li>Score: <strong>${levelData.score || 0}</strong></li>
                <li>Taux de réussite par niveau (1er coup): <strong>${successRate}%</strong></li>
                <li>Questions réussies (du 1er coup) / Totales: <strong>${firstTryCount} / ${totalQuestions}</strong></li>
              </ul>
            </div>
            
            <div style="background: #eff6ff; padding: 10px; border-radius: 6px; flex: 1; min-width: 200px;">
              <h4 style="margin: 0 0 5px 0; color: #1e3a8a;">Courbe d'Apprentissage</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
                <li>Nb. de tentatives (Morts/Restarts): <strong>${metrics.levelAttempts || 1}</strong></li>
              </ul>
            </div>

            <div style="background: #f0fdf4; padding: 10px; border-radius: 6px; flex: 1; min-width: 200px;">
              <h4 style="margin: 0 0 5px 0; color: #14532d;">Temps & Engagement</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
                <li>Temps d'observation Lames: <strong>${metrics.observationTime || 0}s</strong></li>
                <li>Temps de réponse (moyenne): <strong>${metrics.averageResponseTime || 0}s</strong></li>
                <li>Temps par niveau (Session): <strong>${metrics.sessionDuration || levelData.time || 0}s</strong></li>
              </ul>
            </div>
          </div>
          
          <h4 style="margin: 10px 0 5px 0; color: #374151;">Questions Data</h4>
          ${questionStatsHtml}
        </div>
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
      <h3 style="margin: 0;">Aperçu Global</h3>
      <button id="exportCsvBtn" style="padding: 8px 15px; background: #10b981; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer;">
        📥 Exporter CSV (Historique)
      </button>
    </div>
    <dl style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 20px; background: #fafafa; padding: 10px; border-radius: 5px;">
      <dt style="font-weight: bold;">Username</dt><dd style="margin-left: 0;">${player.username}</dd>
      <dt style="font-weight: bold;">Email</dt><dd style="margin-left: 0;">${player.email}</dd>
      <dt style="font-weight: bold;">Taux de réussite global (1er coup)</dt><dd style="margin-left: 0; color: green; font-weight: bold;">${globalSuccessRate}%</dd>
      <dt style="font-weight: bold;">Taux d'amélioration</dt><dd style="margin-left: 0;">${tauxAmelioration}%</dd>
      <dt style="font-weight: bold;">Vitesse d'apprentissage</dt><dd style="margin-left: 0;">${vitesseApprentissage} pts/session</dd>
      <dt style="font-weight: bold;">Durée de jeu totale</dt><dd style="margin-left: 0;">${player.stats?.time ?? 0}s</dd>
      <dt style="font-weight: bold;">Durée moy. par session</dt><dd style="margin-left: 0;">${averageSessionTime}s</dd>
      <dt style="font-weight: bold;">Fréquence des sessions</dt><dd style="margin-left: 0;">${freqSessions}</dd>
      <dt style="font-weight: bold;">Corrélation (Temps Obs. / Score)</dt><dd style="margin-left: 0;">${correlationMsg}</dd>
    </dl>
    
    <div style="border-top: 2px solid #ccc; padding-top: 15px; margin-top: 20px; margin-bottom: 20px;">
      <h3 style="margin-top: 0;">Graphiques Analytics (Chart.js)</h3>
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 300px; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
           <canvas id="scoreVsTryChart"></canvas>
        </div>
        <div style="flex: 1; min-width: 300px; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
           <canvas id="timeVsDayChart"></canvas>
        </div>
      </div>
    </div>

    <div style="border-top: 2px solid #ccc; padding-top: 15px;">
      <h3 style="margin-top: 0;">Détails par Niveau</h3>
      ${levelStatsHtml}
    </div>
  `;

  // Export button logic
  const exportBtn = document.getElementById("exportCsvBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () =>
      exportPlayerToCSV(player, historyData),
    );
  }

  // Draw Charts
  if (historyData.length > 0) {
    const labelsTries = historyData.map((_, i) => `T${i + 1}`);
    const scoreData = historyData.map((h) => h.score);
    const timeData = historyData.map(
      (h) => h.metrics?.averageResponseTime || 0,
    );
    const labelsDates = historyData.map((h) =>
      new Date(h.pushedAt).toLocaleDateString(),
    );

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

function exportPlayerToCSV(player, historyData) {
  if (!historyData || historyData.length === 0) {
    alert("Aucune donnée d'historique disponible pour cet étudiant.");
    return;
  }

  const formatCell = (val) => {
    if (val === undefined || val === null) return '""';
    let str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const now = new Date();

  // --- NEW: Excel Separator Hint ---
  // This line tells Excel to use the semicolon as the column divider
  const excelHint = "sep=;\n";

  const metadata = [
    [`RAPPORT DE PERFORMANCE ETUDIANT`],
    [`Etudiant`, player.username],
    [`Email`, player.email],
    [`Date d'export`, now.toLocaleString()],
    [`Nombre de sessions`, historyData.length],
    [],
  ]
    .map((row) => row.map(formatCell).join(";"))
    .join("\n");

  const headers = [
    "Date/Heure",
    "Niveau",
    "Score",
    "Réussite (1er coup)",
    "Taux de Succès (%)",
    "Temps Total (s)",
    "Temps Obs. Lames (s)",
    "Temps Rép. Moyen (s)",
    "Tentatives (Morts/Restarts)",
  ]
    .map(formatCell)
    .join(";");

  const rows = historyData
    .map((h) => {
      const metrics = h.metrics || {};
      const totalQ = (h.correct || 0) + (h.incorrect || 0);
      const successRate =
        totalQ > 0
          ? ((metrics.firstTrySuccessCount / totalQ) * 100).toFixed(1)
          : "0";

      return [
        new Date(h.pushedAt).toLocaleString(),
        h.levelKey || "N/A",
        h.score || 0,
        `${metrics.firstTrySuccessCount || 0} / ${totalQ}`,
        `${successRate}%`,
        h.time || 0,
        metrics.observationTime || 0,
        metrics.averageResponseTime || 0,
        metrics.levelAttempts || 1,
      ]
        .map(formatCell)
        .join(";");
    })
    .join("\n");

  // Combine everything: BOM + Hint + Metadata + Headers + Rows
  const csvContent =
    "\uFEFF" + excelHint + metadata + "\n" + headers + "\n" + rows;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const fileName = `Rapport_${player.username.replace(/\s+/g, "_")}_${now.getTime()}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 100);
}
window.createPlayer = createPlayer;
