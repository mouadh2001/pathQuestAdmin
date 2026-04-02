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
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `;
      }

      levelStatsHtml += `
        <div style="margin-top: 15px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 5px;">
          <h3 style="margin-top:0; color: #1f2937;">Level: ${levelKey.toUpperCase()}</h3>
          <p style="margin: 5px 0; font-size: 14px;">Score: ${levelData.score || 0} | Correct: ${levelData.correct || 0} | Incorrect: ${levelData.incorrect || 0} | Time: ${levelData.time || 0}s</p>
          ${questionStatsHtml}
        </div>
      `;
    }
  } else {
    levelStatsHtml = "<p style='margin-top: 15px; color: #6b7280;'>No level-specific stats recorded yet.</p>";
  }

  content.innerHTML = `
    <dl>
      <dt>Username</dt><dd>${player.username}</dd>
      <dt>Email</dt><dd>${player.email}</dd>
      <dt>Player ID</dt><dd>${player._id}</dd>
      <dt>Created At</dt><dd>${new Date(player.createdAt).toLocaleString()}</dd>
      <dt>Total Score</dt><dd>${player.stats?.score ?? 0}</dd>
      <dt>Total Correct</dt><dd>${player.stats?.correct ?? 0}</dd>
      <dt>Total Incorrect</dt><dd>${player.stats?.incorrect ?? 0}</dd>
      <dt>Total Time (s)</dt><dd>${player.stats?.time ?? 0}</dd>
    </dl>
    ${levelStatsHtml}
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
