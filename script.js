/**
 * script.js — Personal Productivity Dashboard
 * ─────────────────────────────────────────────
 * Handles:
 *  • Fetching & rendering tasks from the backend API
 *  • Adding, completing, and deleting tasks
 *  • Progress bar & stat cards
 *  • Streak counter (persisted in localStorage)
 *  • Browser notifications at 11:00 AM and 5:00 PM
 *  • Dark / Light theme toggle
 *  • Chart.js weekly productivity chart
 *  • In-app toast notification system
 */

/* ──────────────────────────────────────────────────────────────
   CONFIG
   ────────────────────────────────────────────────────────────── */
// Base URL of the backend API — change this if your server runs on a different port
const API_BASE = "https://taskbackend-zle9.onrender.com";

/* ──────────────────────────────────────────────────────────────
   STATE
   ────────────────────────────────────────────────────────────── */
let allTasks      = [];   // master copy of tasks from the server
let currentFilter = "all"; // "all" | "pending" | "completed"
let weeklyChart   = null; // Chart.js instance

/* ──────────────────────────────────────────────────────────────
   DOM REFERENCES
   ────────────────────────────────────────────────────────────── */
const taskList        = document.getElementById("taskList");
const loadingState    = document.getElementById("loadingState");
const emptyState      = document.getElementById("emptyState");
const addTaskForm     = document.getElementById("addTaskForm");
const taskInput       = document.getElementById("taskInput");
const inputError      = document.getElementById("inputError");
const progressText    = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressBarFill = document.getElementById("progressBarFill");
const progressBarTrack= document.getElementById("progressBarTrack");
const streakText      = document.getElementById("streakText");
const completedText   = document.getElementById("completedText");
const pendingText     = document.getElementById("pendingText");
const themeToggleBtn  = document.getElementById("themeToggleBtn");
const themeIcon       = document.getElementById("themeIcon");
const notifPermBtn    = document.getElementById("notifPermBtn");
const toastContainer  = document.getElementById("toastContainer");
const footerYear      = document.getElementById("footerYear");
const refreshChartBtn = document.getElementById("refreshChartBtn");
const filterTabs      = document.querySelectorAll(".filter-tab");

/* ──────────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  // Set footer year
  footerYear.textContent = new Date().getFullYear();

  // Restore theme preference
  const savedTheme = localStorage.getItem("theme") || "dark";
  applyTheme(savedTheme);

  // Fetch tasks and chart data
  loadTasks();
  loadWeeklyChart();

  // Schedule browser notifications
  scheduleNotifications();

  // Check streak on load
  checkStreak();
});

/* ──────────────────────────────────────────────────────────────
   THEME TOGGLE
   ────────────────────────────────────────────────────────────── */
themeToggleBtn.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next    = current === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("theme", next);
});

/**
 * Apply a theme ("dark" | "light") to the document root.
 * Also swaps the icon between sun and moon.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // Font Awesome class swap
  themeIcon.className = theme === "dark"
    ? "fa-solid fa-sun"
    : "fa-solid fa-moon";
}

/* ──────────────────────────────────────────────────────────────
   FILTER TABS
   ────────────────────────────────────────────────────────────── */
filterTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    filterTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    renderTasks();
  });
});

/* ──────────────────────────────────────────────────────────────
   API HELPERS
   ────────────────────────────────────────────────────────────── */
/**
 * Generic fetch wrapper with error handling.
 * Returns the parsed JSON or throws an error.
 */
async function apiFetch(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "API error");
  }
  return data;
}

/* ──────────────────────────────────────────────────────────────
   LOAD TASKS
   ────────────────────────────────────────────────────────────── */
/**
 * Fetches all tasks from GET /tasks then renders them.
 */
async function loadTasks() {
  showLoading(true);
  try {
    allTasks = await apiFetch("/tasks");
    renderTasks();
    updateStats();
  } catch (err) {
    showToast("Failed to load tasks. Is the backend running?", "error");
    console.error("loadTasks error:", err);
  } finally {
    showLoading(false);
  }
}

/* ──────────────────────────────────────────────────────────────
   RENDER TASKS
   ────────────────────────────────────────────────────────────── */
/**
 * Filters allTasks based on currentFilter and renders the list.
 */
function renderTasks() {
  // Clear
  taskList.innerHTML = "";

  // Filter
  let filtered = allTasks;
  if (currentFilter === "pending") {
    filtered = allTasks.filter(t => !t.completed);
  } else if (currentFilter === "completed") {
    filtered = allTasks.filter(t => t.completed);
  }

  // Empty state
  emptyState.classList.toggle("hidden", filtered.length > 0);

  // Render each task as a <li>
  filtered.forEach(task => {
    const li = createTaskElement(task);
    taskList.appendChild(li);
  });
}

/**
 * Creates and returns a <li> element for a given task object.
 */
function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = `task-item${task.completed ? " completed-item" : ""}`;
  li.dataset.id = task._id;

  li.innerHTML = `
    <input
      class="task-checkbox"
      type="checkbox"
      id="chk-${task._id}"
      ${task.completed ? "checked" : ""}
      aria-label="Mark task as ${task.completed ? "incomplete" : "complete"}"
    />
    <label class="task-name" for="chk-${task._id}">${escapeHtml(task.task_name)}</label>
    ${task.is_default ? '<span class="task-badge"><i class="fa-solid fa-star"></i> Default</span>' : ""}
    <button
      class="task-delete-btn"
      aria-label="Delete task"
      title="Delete task"
    >
      <i class="fa-solid fa-trash-can"></i>
    </button>
  `;

  // Checkbox — toggle completion
  const checkbox = li.querySelector(".task-checkbox");
  checkbox.addEventListener("change", () => toggleTask(task._id, checkbox.checked));

  // Delete button
  const deleteBtn = li.querySelector(".task-delete-btn");
  deleteBtn.addEventListener("click", () => deleteTask(task._id));

  return li;
}

/* ──────────────────────────────────────────────────────────────
   ADD TASK
   ────────────────────────────────────────────────────────────── */
addTaskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = taskInput.value.trim();

  // Input validation
  if (!name) {
    inputError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Task name cannot be empty.';
    taskInput.focus();
    return;
  }
  inputError.textContent = "";

  // Disable submit briefly
  const btn = document.getElementById("addTaskBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';

  try {
    const newTask = await apiFetch("/tasks", {
      method: "POST",
      body: JSON.stringify({ task_name: name }),
    });

    // Prepend to local array and re-render
    allTasks.push(newTask);
    taskInput.value = "";
    renderTasks();
    updateStats();
    showToast(`Task added: "${newTask.task_name}"`, "success");
  } catch (err) {
    showToast("Failed to add task. Try again.", "error");
    console.error("addTask error:", err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> <span>Add Task</span>';
  }
});

/* ──────────────────────────────────────────────────────────────
   TOGGLE TASK COMPLETION
   ────────────────────────────────────────────────────────────── */
/**
 * Calls PUT /tasks/:id to update the completion status.
 */
async function toggleTask(id, completed) {
  try {
    const updated = await apiFetch(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify({ completed }),
    });

    // Update local state
    const idx = allTasks.findIndex(t => t._id === id);
    if (idx !== -1) allTasks[idx] = updated;

    renderTasks();
    updateStats();
    checkStreak();

    const msg = completed ? "Task marked complete! 🎉" : "Task marked incomplete.";
    showToast(msg, completed ? "success" : "info");
  } catch (err) {
    showToast("Failed to update task.", "error");
    console.error("toggleTask error:", err);
  }
}

/* ──────────────────────────────────────────────────────────────
   DELETE TASK
   ────────────────────────────────────────────────────────────── */
/**
 * Calls DELETE /tasks/:id and removes the task from local state.
 */
async function deleteTask(id) {
  try {
    await apiFetch(`/tasks/${id}`, { method: "DELETE" });

    // Remove from local array
    allTasks = allTasks.filter(t => t._id !== id);
    renderTasks();
    updateStats();
    showToast("Task deleted.", "warning");
  } catch (err) {
    showToast("Failed to delete task.", "error");
    console.error("deleteTask error:", err);
  }
}

/* ──────────────────────────────────────────────────────────────
   UPDATE STATS (Progress, Cards)
   ────────────────────────────────────────────────────────────── */
/**
 * Recalculates and updates:
 *  - Progress bar width and percentage
 *  - Progress text (e.g., "Completed 2 / 5 tasks")
 *  - Stat cards (completed, pending)
 */
function updateStats() {
  const total     = allTasks.length;
  const completed = allTasks.filter(t => t.completed).length;
  const pending   = total - completed;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Progress text
  progressText.textContent  = `${completed} / ${total}`;
  progressPercent.textContent = `${pct}%`;

  // Animate progress bar
  progressBarFill.style.width = `${pct}%`;
  progressBarTrack.setAttribute("aria-valuenow", pct);

  // Stat cards
  completedText.textContent = completed;
  pendingText.textContent   = pending;
}

/* ──────────────────────────────────────────────────────────────
   STREAK COUNTER
   ────────────────────────────────────────────────────────────── */
/**
 * Checks if all tasks are completed. If yes, increments the streak
 * for today (only once per day). Uses localStorage to persist.
 */
function checkStreak() {
  const total     = allTasks.length;
  const completed = allTasks.filter(t => t.completed).length;
  const allDone   = total > 0 && completed === total;

  const today = new Date().toDateString();
  const data  = JSON.parse(localStorage.getItem("streakData") || '{"streak":0,"lastDate":""}');

  if (allDone) {
    if (data.lastDate !== today) {
      // Check if yesterday was also completed (consecutive day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const wasYesterday = data.lastDate === yesterday.toDateString();

      data.streak   = wasYesterday ? data.streak + 1 : 1;
      data.lastDate = today;

      localStorage.setItem("streakData", JSON.stringify(data));

      // Celebrate!
      if (data.streak === 1) {
        showToast("🎉 All tasks done! Your streak has started!", "success");
      } else {
        showToast(`🔥 ${data.streak}-day streak! Keep it up!`, "success");
      }
    }
  }

  // Always display the latest stored streak
  streakText.textContent = `${data.streak} day${data.streak !== 1 ? "s" : ""}`;
}

/* ──────────────────────────────────────────────────────────────
   BROWSER NOTIFICATIONS (Firebase Cloud Messaging)
   ────────────────────────────────────────────────────────────── */

// TODO: Replace this with your actual Firebase config from the console
const firebaseConfig = {
  apiKey: "AIzaSyAHmdgZ-0OBO839mxuuVDBTaN9VKgHxt5U",
  authDomain: "task-54626.firebaseapp.com",
  projectId: "task-54626",
  storageBucket: "task-54626.firebasestorage.app",
  messagingSenderId: "354464483940",
  appId: "1:354464483940:web:96d55d05923f6e68cded71",
  measurementId: "G-V1QTCEDWCY"
};

// Initialize Firebase only if the config is not just a placeholder
let messaging = null;
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  
  // Handle incoming messages while the app is in the foreground
  messaging.onMessage((payload) => {
    console.log("Message received. ", payload);
    showToast(`${payload.notification.title} - ${payload.notification.body}`, "info", 6000);
  });
}

/**
 * Request notification permission and get Firebase Cloud Messaging token.
 */
notifPermBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast("This browser does not support notifications.", "warning");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    
    if (messaging) {
      try {
        notifPermBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Getting token...';
        
        // TODO: Get this VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration
        const token = await messaging.getToken({ vapidKey: 'BP0jppCv27T5HjNNmn1EXCyJVvK9XTupJw0EoFc8XeEjXPhxDSq3yeTKGAFP5GAyGaAZCmGjv2An16WPQpZ7KVA' });
        
        if (token) {
          // Send the token to your server
          await apiFetch("/device-token", {
            method: "POST",
            body: JSON.stringify({ token })
          });
          
          showToast("✅ Notifications enabled! You'll be reminded at 9 AM, 12 PM, 6 PM, and 10:05 PM.", "success");
          notifPermBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> <span class="btn-label">Alerts On</span>';
          notifPermBtn.disabled  = true;
        } else {
          showToast("Failed to generate notification token.", "error");
          notifPermBtn.innerHTML = '<i class="fa-solid fa-bell"></i> <span class="btn-label">Enable Alerts</span>';
        }
      } catch (err) {
        console.error("An error occurred while retrieving token. ", err);
        showToast("Error setting up push notifications.", "error");
        notifPermBtn.innerHTML = '<i class="fa-solid fa-bell"></i> <span class="btn-label">Enable Alerts</span>';
      }
    } else {
      // Fallback if Firebase isn't configured yet
      showToast("Notification permission granted (Firebase config needed).", "info");
      notifPermBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> <span class="btn-label">Alerts On</span>';
      notifPermBtn.disabled  = true;
    }
  } else {
    showToast("Notification permission denied.", "warning");
  }
});

/**
 * Called on page load to check if we already have permission.
 */
function scheduleNotifications() {
  if (Notification.permission === "granted") {
    notifPermBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> <span class="btn-label">Alerts On</span>';
    notifPermBtn.disabled  = true;
    
    // Optionally auto-refresh token here if needed
  }
}

/* ──────────────────────────────────────────────────────────────
   WEEKLY CHART (Chart.js)
   ────────────────────────────────────────────────────────────── */
refreshChartBtn.addEventListener("click", loadWeeklyChart);

/**
 * Fetches weekly analytics from GET /tasks/analytics/weekly
 * and renders (or updates) the Chart.js bar chart.
 */
async function loadWeeklyChart() {
  refreshChartBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    const data   = await apiFetch("/tasks/analytics/weekly");
    const labels = data.map(d => formatChartDate(d.date));
    const counts = data.map(d => d.count);

    const ctx = document.getElementById("weeklyChart").getContext("2d");

    // Colour the bars based on count value
    const barColors = counts.map(c =>
      c === 0
        ? "rgba(124,106,247,0.2)"   // none
        : c < 3
        ? "rgba(247,201,72,0.75)"   // low
        : "rgba(34,211,165,0.8)"    // good
    );

    if (weeklyChart) {
      // Update existing chart in place
      weeklyChart.data.labels          = labels;
      weeklyChart.data.datasets[0].data       = counts;
      weeklyChart.data.datasets[0].backgroundColor = barColors;
      weeklyChart.update();
    } else {
      // Build gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 260);
      gradient.addColorStop(0,   "rgba(124,106,247,0.85)");
      gradient.addColorStop(1,   "rgba(34,211,165,0.3)");

      weeklyChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Completed Tasks",
            data: counts,
            backgroundColor: barColors,
            borderColor: barColors.map(c => c.replace(/[\d.]+\)$/, "1)")),
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#1e2133",
              titleColor: "#eef0f8",
              bodyColor: "#8892b0",
              borderColor: "rgba(124,106,247,0.4)",
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: ctx => `  ${ctx.parsed.y} task${ctx.parsed.y !== 1 ? "s" : ""} completed`,
              },
            },
          },
          scales: {
            x: {
              grid:  { display: false },
              ticks: {
                color: "#8892b0",
                font: { size: 11, family: "Inter" },
              },
              border: { display: false },
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: "#8892b0",
                stepSize: 1,
                font: { size: 11, family: "Inter" },
              },
              grid: {
                color: "rgba(255,255,255,0.05)",
                drawBorder: false,
              },
              border: { display: false },
            },
          },
        },
      });
    }
  } catch (err) {
    showToast("Could not load weekly analytics.", "error");
    console.error("loadWeeklyChart error:", err);
  } finally {
    refreshChartBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> <span class="btn-label">Refresh</span>';
  }
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a short label like "Mon 3".
 */
function formatChartDate(dateStr) {
  const d    = new Date(dateStr + "T00:00:00");
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return `${days[d.getDay()]} ${d.getDate()}`;
}

/* ──────────────────────────────────────────────────────────────
   LOADING STATE HELPER
   ────────────────────────────────────────────────────────────── */
function showLoading(visible) {
  loadingState.style.display = visible ? "flex" : "none";
  if (visible) emptyState.classList.add("hidden");
}

/* ──────────────────────────────────────────────────────────────
   TOAST NOTIFICATION SYSTEM
   ────────────────────────────────────────────────────────────── */
// Map toast types to Font Awesome icon classes
const TOAST_ICONS = {
  success: "fa-solid fa-circle-check",
  error:   "fa-solid fa-circle-xmark",
  warning: "fa-solid fa-triangle-exclamation",
  info:    "fa-solid fa-circle-info",
};

/**
 * Creates and shows an in-app toast message.
 * @param {string} message - The text to display.
 * @param {string} type    - "success" | "error" | "warning" | "info"
 * @param {number} duration - Auto-dismiss duration in ms (default 3500)
 */
function showToast(message, type = "info", duration = 3500) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="toast-icon ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, duration);
}

/* ──────────────────────────────────────────────────────────────
   UTILITY
   ────────────────────────────────────────────────────────────── */
/**
 * Escapes HTML special characters to prevent XSS
 * when injecting user-supplied task names into the DOM.
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
