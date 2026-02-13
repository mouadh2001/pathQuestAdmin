const API_URL = "http://localhost:5000/api/player";

// Get token from localStorage
function getToken() {
  return localStorage.getItem("adminToken");
}

// Create player
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

// Load all players
async function loadPlayers() {
  const token = getToken();
  if (!token) return alert("Not authorized");

  try {
    const res = await fetch(`${API_URL}/all`, {
      headers: { Authorization: token },
    });

    const players = await res.json();

    const tbody = document.getElementById("playersTable");
    tbody.innerHTML = "";

    players.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.username}</td>
        <td>${p.email}</td>
        <td>${new Date(p.createdAt).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

// On load
window.onload = loadPlayers;

// Expose globally
window.createPlayer = createPlayer;
