/**
 * Shared Layout & Navigation Utilities
 * Handles common functionality across all admin pages
 */

export function initializeNavigation() {
  const currentPage = getCurrentPage();
  updateActiveNavLink(currentPage);
}

function getCurrentPage() {
  const pathname = window.location.pathname;
  if (pathname.includes("globalstats.html") || pathname.endsWith("/"))
    return "globalstats";
  if (pathname.includes("gamedata.html")) return "gamedata";
  if (pathname.includes("players.html")) return "players";
  return "globalstats";
}

function updateActiveNavLink(page) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
  });

  const linkMap = {
    globalstats: "nav-globalstats",
    gamedata: "nav-gamedata",
    players: "nav-players",
  };

  const activeLink = document.getElementById(linkMap[page]);
  if (activeLink) {
    activeLink.classList.add("active");
  }
}

export function navigateTo(page) {
  const pageMap = {
    globalstats: "globalstats.html",
    gamedata: "gamedata.html",
    players: "players.html",
  };

  const url = pageMap[page];
  if (url) {
    window.location.href = url;
  }
}

export function logout() {
  localStorage.removeItem("adminToken");
  window.location.href = "login.html";
}

export function showNotification(message, type = "info") {
  let toast = document.getElementById("notification");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "notification";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `notification ${type} show`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

export function checkAuth() {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "login.html";
  }
  return token;
}

// Auto-initialize on load
document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  initializeNavigation();
});
