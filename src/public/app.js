// Initialize Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  document.body.classList.add("telegram");
  
  // Set theme colors if available
  if (tg.colorScheme === 'dark') {
    document.documentElement.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #090614 0%, #110d24 100%)');
  }
}

// State variables
let chatId = "cli_chat_session";
let expenses = [];
let notes = [];
let categoryChart = null;

// Parse Chat ID from URL query parameters or Telegram SDK
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramChatId = urlParams.get("chatId");
  
  if (paramChatId) {
    chatId = paramChatId;
  } else if (tg?.initDataUnsafe?.user?.id) {
    chatId = String(tg.initDataUnsafe.user.id);
  }

  // Set user profile info
  const nameEl = document.getElementById("user-name");
  const avatarEl = document.getElementById("user-avatar");
  
  if (tg?.initDataUnsafe?.user) {
    const user = tg.initDataUnsafe.user;
    const displayName = user.first_name + (user.last_name ? " " + user.last_name : "");
    nameEl.textContent = displayName;
    avatarEl.textContent = user.first_name.charAt(0).toUpperCase();
  } else {
    nameEl.textContent = "Personal Assistant";
    avatarEl.textContent = "P";
  }

  document.getElementById("connection-status").textContent = `Linked Session: ${chatId}`;

  const tab = urlParams.get("tab");
  if (tab) {
    switchTab(tab);
  }

  // Set default date to today
  setDefaultDate();

  // Fetch initial data
  fetchExpenses();
  fetchNotes();
}

function setDefaultDate() {
  const dateEl = document.getElementById("exp-date");
  if (dateEl) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateEl.value = `${yyyy}-${mm}-${dd}`;
  }
}

// Switch navigation tabs
function switchTab(tab) {
  // Update nav buttons active state
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById(`tab-btn-${tab}`).classList.add("active");

  // Update panels visibility
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
}

// Toggle collapsible forms
function toggleForm(formId) {
  const formWrapper = document.getElementById(formId);
  formWrapper.classList.toggle("hidden");
}

// ==========================================
// Expenses logic
// ==========================================
async function fetchExpenses() {
  try {
    const response = await fetch(`/api/expenses?chatId=${chatId}`);
    if (!response.ok) throw new Error("Failed to fetch expenses");
    expenses = await response.json();
    renderExpenses();
  } catch (err) {
    console.error("Fetch expenses error:", err);
  }
}

function renderExpenses() {
  const listEl = document.getElementById("expense-list");
  const totalValEl = document.getElementById("total-amount");
  const totalCountEl = document.getElementById("total-count");

  listEl.innerHTML = "";

  if (expenses.length === 0) {
    listEl.innerHTML = '<p class="placeholder-text">No expenses logged yet.</p>';
    totalValEl.textContent = "$0.00";
    totalCountEl.textContent = "0";
    updateChart({});
    return;
  }

  let totalAmount = 0;
  const categories = {};

  expenses.forEach(exp => {
    totalAmount += exp.amount;
    categories[exp.category] = (categories[exp.category] || 0) + exp.amount;

    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div class="item-left">
        <span class="item-title">${escapeString(exp.description)}</span>
        <span class="item-category">${escapeString(exp.category)}</span>
      </div>
      <div class="item-right">
        <span class="item-amount">$${exp.amount.toFixed(2)}</span>
        <button class="delete-btn" onclick="deleteExpense(${exp.id})">🗑️</button>
      </div>
    `;
    listEl.appendChild(item);
  });

  totalValEl.textContent = `$${totalAmount.toFixed(2)}`;
  totalCountEl.textContent = expenses.length;

  updateChart(categories);
}

async function submitExpense(event) {
  event.preventDefault();

  const amount = parseFloat(document.getElementById("exp-amount").value);
  const category = document.getElementById("exp-category").value;
  const description = document.getElementById("exp-desc").value;
  const date = document.getElementById("exp-date").value;

  try {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, amount, category, description, date })
    });
    if (!res.ok) throw new Error("Failed to save expense");
    
    // Reset form and reload
    document.getElementById("expense-form").reset();
    setDefaultDate();
    toggleForm("expense-form-wrapper");
    fetchExpenses();
    
    if (tg) tg.HapticFeedback?.notificationOccurred('success');
  } catch (err) {
    console.error("Submit expense error:", err);
  }
}

async function deleteExpense(id) {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  try {
    const res = await fetch("/api/expenses/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, chatId })
    });
    if (!res.ok) throw new Error("Failed to delete expense");
    fetchExpenses();
    if (tg) tg.HapticFeedback?.impactOccurred('medium');
  } catch (err) {
    console.error("Delete expense error:", err);
  }
}

function updateChart(categoryData) {
  const ctx = document.getElementById("categoryChart").getContext("2d");
  
  const labels = Object.keys(categoryData);
  const data = Object.values(categoryData);

  if (categoryChart) {
    categoryChart.destroy();
  }

  if (labels.length === 0) {
    return;
  }

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#a78bfa', // violet
          '#34d399', // green
          '#60a5fa', // blue
          '#fb7185', // rose
          '#fbbf24', // amber
          '#9ca3af'  // grey
        ],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#9ca3af',
            font: {
              family: 'Outfit',
              size: 11
            }
          }
        }
      }
    }
  });
}

// ==========================================
// Notes logic
// ==========================================
async function fetchNotes() {
  try {
    const response = await fetch(`/api/notes?chatId=${chatId}`);
    if (!response.ok) throw new Error("Failed to fetch notes");
    notes = await response.json();
    renderNotes();
  } catch (err) {
    console.error("Fetch notes error:", err);
  }
}

function renderNotes() {
  const notesEl = document.getElementById("notes-list");
  notesEl.innerHTML = "";

  if (notes.length === 0) {
    notesEl.innerHTML = '<p class="placeholder-text">No research notes saved yet.</p>';
    return;
  }

  notes.forEach(note => {
    const dateStr = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : "";
    const card = document.createElement("div");
    card.className = "note-card";
    card.innerHTML = `
      <div class="note-header">
        <span class="note-title">${escapeString(note.title)}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="note-date">${dateStr}</span>
          <button class="delete-btn" style="font-size:0.9rem;" onclick="deleteNote(${note.id})">🗑️</button>
        </div>
      </div>
      <div class="note-body">${escapeString(note.content)}</div>
    `;
    notesEl.appendChild(card);
  });
}

async function submitNote(event) {
  event.preventDefault();

  const title = document.getElementById("note-title").value;
  const content = document.getElementById("note-content").value;

  try {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, title, content })
    });
    if (!res.ok) throw new Error("Failed to save note");
    
    document.getElementById("note-form").reset();
    toggleForm("note-form-wrapper");
    fetchNotes();
    
    if (tg) tg.HapticFeedback?.notificationOccurred('success');
  } catch (err) {
    console.error("Submit note error:", err);
  }
}

async function deleteNote(id) {
  if (!confirm("Are you sure you want to delete this research note?")) return;

  try {
    const res = await fetch(`/api/notes/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, chatId })
    });
    // Add deletion handler directly inside the API in telegram.ts later
    fetchNotes();
    if (tg) tg.HapticFeedback?.impactOccurred('medium');
  } catch (err) {
    console.error("Delete note error:", err);
  }
}

// Helpers
function escapeString(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Bootstrap
window.onload = init;
