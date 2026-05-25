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
    const response = await fetch("/api/admin/globalstats", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch global statistics");
    }

    globalStatsData = await response.json();
    statsContainer.classList.remove("hidden");
    renderGlobalStats(contentContainer, globalStatsData);
  } catch (error) {
    console.error(error);
    showNotification(error.message, "error");
  }
}

function renderGlobalStats(container, data) {
  container.innerHTML = "";

  // Create stat cards for key metrics
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
      label: "Total Questions Answered",
      value: data.totalQuestionsAnswered || 0,
      icon: "❓",
    },
  ];

  statCards.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="stat-icon">${stat.icon}</div>
      <div class="stat-content">
        <div class="stat-label">${stat.label}</div>
        <div class="stat-value">${stat.value}</div>
      </div>
    `;
    container.appendChild(card);
  });

  // Add charts if data is available
  if (data.levelStats && data.levelStats.length > 0) {
    renderLevelStatsChart(container, data.levelStats);
  }
}

function renderLevelStatsChart(container, levelStats) {
  const chartContainer = document.createElement("div");
  chartContainer.className = "chart-container";
  chartContainer.innerHTML = `
    <h3>Performance by Level</h3>
    <canvas id="levelChart"></canvas>
  `;
  container.appendChild(chartContainer);

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

export async function exportGlobalExcel() {
  if (!globalStatsData) {
    showNotification("No data to export", "warning");
    return;
  }

  try {
    const { Workbook } = window.ExcelJS;
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet("Global Stats");

    // Add headers
    worksheet.columns = [
      { header: "Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 15 },
    ];

    // Add data
    worksheet.addRows([
      { metric: "Total Players", value: globalStatsData.totalPlayers },
      { metric: "Average Score", value: globalStatsData.averageScore },
      {
        metric: "Average Success Rate (%)",
        value: globalStatsData.averageSuccessRate,
      },
      {
        metric: "Total Questions Answered",
        value: globalStatsData.totalQuestionsAnswered,
      },
    ]);

    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };

    // Save file
    await workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `global-stats-${new Date().getTime()}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    });

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
