const API_URL = "/api/admin";

function showNotification(message, type = "error", duration = 4000) {
  let notification = document.getElementById("notification");
  if (!notification) {
    notification = document.createElement("div");
    notification.id = "notification";
    document.body.appendChild(notification);
  }

  notification.textContent = message;
  notification.className = `notification ${type} show`;

  setTimeout(() => {
    notification.classList.remove("show");
  }, duration);
}

async function login() {
  const loginButton = document.getElementById("loginButton");
  if (loginButton) {
    loginButton.classList.add("loading");
    loginButton.disabled = true;
  }

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem("adminToken", data.token);
      window.location.href = "dashboard.html";
    } else {
      showNotification(data.message || "Login failed", "error");
    }
  } catch (err) {
    console.error(err);
    showNotification("Server error", "error");
  } finally {
    if (loginButton) {
      loginButton.classList.remove("loading");
      loginButton.disabled = false;
    }
  }
}

window.login = login;
