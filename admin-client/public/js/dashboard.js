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

    renderPlayers();
  } catch (err) {
    console.error(err);
  }
}

function renderPlayers() {
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
    renderPlayerDetails(selectedPlayer);
  } else {
    renderPlayerDetails(null);
  }
}

function selectPlayer(id) {
  selectedPlayerId = id;
  renderPlayers();
}

function renderPlayerDetails(player) {
  const details = document.getElementById("playerDetails");
  const content = document.getElementById("detailsContent");

  if (!player) {
    details.classList.add("hidden");
    content.innerHTML = "";
    return;
  }

  details.classList.remove("hidden");

  let levelStatsHtml = "";
  if (player.levelStats && Object.keys(player.levelStats).length > 0) {
    for (const [levelKey, levelData] of Object.entries(player.levelStats)) {
      let questionStatsHtml = "";
      if (levelData.questionStats && Object.keys(levelData.questionStats).length > 0) {
        const rows = Object.entries(levelData.questionStats)
          .map(([qId, st]) => `
            <tr>
              <td>${qId}</td>
              <td style="color: green; font-weight: bold;">${st.correct || 0}</td>
              <td style="color: red; font-weight: bold;">${st.wrong || 0}</td>
              <td>${st.firstTrySuccess ? '✅ Yes' : '❌ No'}</td>
              <td>${st.timeSpent ? st.timeSpent + 's' : '-'}</td>
            </tr>
          `)
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
      const successRate = levelData.correct > 0 || levelData.incorrect > 0 
           ? Math.round((levelData.correct / (levelData.correct + levelData.incorrect)) * 100) 
           : 0;

      levelStatsHtml += `
        <div style="margin-top: 15px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 5px;">
          <h3 style="margin-top:0; margin-bottom: 5px; color: #1f2937; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Level: ${levelKey.toUpperCase()}</h3>
          
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0;">
            <div style="background: #fdf2f8; padding: 10px; border-radius: 6px; flex: 1; min-width: 200px;">
              <h4 style="margin: 0 0 5px 0; color: #9d174d;">Performance Académique</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333;">
                <li>Score: <strong>${levelData.score || 0}</strong></li>
                <li>Taux de réussite global: <strong>${successRate}%</strong></li>
                <li>Questions réussies (du 1er coup): <strong>${metrics.firstTrySuccessCount || 0}</strong></li>
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
                <li>Durée de la session de jeu: <strong>${metrics.sessionDuration || levelData.time || 0}s</strong></li>
              </ul>
            </div>
          </div>
          
          <h4 style="margin: 10px 0 5px 0; color: #374151;">Questions Data</h4>
          ${questionStatsHtml}
        </div>
      `;
    }
  } else {
    levelStatsHtml = "<p style='margin-top: 15px; color: #6b7280;'>No level-specific stats recorded yet.</p>";
  }

  content.innerHTML = `
    <dl style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 20px; background: #fafafa; padding: 10px; border-radius: 5px;">
      <dt style="font-weight: bold;">Username</dt><dd style="margin-left: 0;">${player.username}</dd>
      <dt style="font-weight: bold;">Email</dt><dd style="margin-left: 0;">${player.email}</dd>
      <dt style="font-weight: bold;">Created At</dt><dd style="margin-left: 0;">${new Date(player.createdAt).toLocaleString()}</dd>
      <dt style="font-weight: bold;">Total Sessions Played</dt><dd style="margin-left: 0;">${player.stats?.totalSessions ?? 0}</dd>
      <dt style="font-weight: bold;">Total Score</dt><dd style="margin-left: 0; color: green;">${player.stats?.score ?? 0}</dd>
      <dt style="font-weight: bold;">Total Time (Global)</dt><dd style="margin-left: 0;">${player.stats?.time ?? 0}s</dd>
    </dl>
    <div style="border-top: 2px solid #ccc; padding-top: 15px;">
      <h3 style="margin-top: 0;">Détails par Niveau</h3>
      ${levelStatsHtml}
    </div>
  `;
}

function setSort(key) {
  currentSortKey = key;
  renderPlayers();
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

window.createPlayer = createPlayer;
