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
      return (b.stats?.time || 0) - (a.stats?.time || 0);
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
  content.innerHTML = `
    <dl>
      <dt>Username</dt><dd>${player.username}</dd>
      <dt>Email</dt><dd>${player.email}</dd>
      <dt>Player ID</dt><dd>${player._id}</dd>
      <dt>Created At</dt><dd>${new Date(player.createdAt).toLocaleString()}</dd>
      <dt>Score</dt><dd>${player.stats?.score ?? 0}</dd>
      <dt>Correct</dt><dd>${player.stats?.correct ?? 0}</dd>
      <dt>Incorrect</dt><dd>${player.stats?.incorrect ?? 0}</dd>
      <dt>Time (s)</dt><dd>${player.stats?.time ?? 0}</dd>
    </dl>
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
