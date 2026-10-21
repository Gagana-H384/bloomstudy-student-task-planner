const $ = (id) => document.getElementById(id);
const form = $("taskForm");
const titleInput = $("taskTitle");
const subjectInput = $("taskSubject");
const priorityInput = $("taskPriority");
const dateInput = $("taskDate");
const timeInput = $("taskTime");
const notesInput = $("taskNotes");
const taskList = $("taskList");
let tasks = loadTasks();
let filter = "all";
let editingId = null;
let toastTimer = null;
let timerSeconds = 25 * 60;
let timerInterval = null;
let timerRunning = false;

function loadTasks() {
  try {
    const data = JSON.parse(localStorage.getItem("bloomstudy-tasks"));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function saveTasks() {
  try { localStorage.setItem("bloomstudy-tasks", JSON.stringify(tasks)); }
  catch { showToast("Browser storage is unavailable."); }
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function showToast(message) {
  const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
function todayISO() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10);
}
function formatDate(date) {
  if (!date) return "No due date";
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"});
}
function dueLabel(task) {
  if (!task.date) return {text:"No due date", cls:""};
  if (task.completed) return {text:"Due " + formatDate(task.date), cls:""};
  if (task.date < todayISO()) return {text:"⚠ Overdue · " + formatDate(task.date), cls:"overdue"};
  if (task.date === todayISO()) return {text:"☀ Due today", cls:"due-soon"};
  return {text:"Due " + formatDate(task.date), cls:""};
}
function priorityRank(p) { return ({High:0,Medium:1,Low:2})[p] ?? 1; }
function render() {
  const done = tasks.filter(t => t.completed).length;
  const pending = tasks.length - done;
  const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  $("totalTasks").textContent = tasks.length;
  $("pendingTasks").textContent = pending;
  $("completedTasks").textContent = done;
  $("progressLabel").textContent = percent + "%";
  $("progressPercent").textContent = percent + "%";
  $("progressBar").style.width = percent + "%";
  $("progressMessage").textContent = tasks.length === 0 ? "Add a task and start making progress!" : percent === 100 ? "Amazing! You completed everything. Take a little bow! 🎉" : `${done} of ${tasks.length} tasks completed. Keep blooming!`;
  $("allCount").textContent = tasks.length;
  $("pendingCount").textContent = pending;
  $("doneCount").textContent = done;

  const search = $("searchInput").value.trim().toLowerCase();
  let shown = tasks.filter(t => {
    const matchesFilter = filter === "all" || (filter === "pending" && !t.completed) || (filter === "completed" && t.completed);
    const haystack = `${t.title} ${t.subject} ${t.notes || ""} ${t.priority}`.toLowerCase();
    return matchesFilter && haystack.includes(search);
  });
  const sort = $("sortSelect").value;
  shown.sort((a,b) => {
    if (sort === "due") return (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
    if (sort === "priority") return priorityRank(a.priority) - priorityRank(b.priority);
    if (sort === "alphabetical") return a.title.localeCompare(b.title);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  taskList.innerHTML = shown.map(t => {
    const due = dueLabel(t);
    return `<article class="task-item ${t.completed ? "is-completed" : ""}">
      <input class="task-check" type="checkbox" data-action="toggle" data-id="${escapeHTML(t.id)}" aria-label="Mark task complete" ${t.completed ? "checked" : ""}>
      <div class="task-info">
        <div class="task-title">${escapeHTML(t.title)}</div>
        <div class="task-meta"><span class="tag">${escapeHTML(t.subject)}</span><span class="tag priority-${escapeHTML((t.priority || "Medium").toLowerCase())}">${escapeHTML(t.priority)} priority</span></div>
        ${t.notes ? `<div class="task-notes">${escapeHTML(t.notes)}</div>` : ""}
        <div class="task-date ${due.cls}">${escapeHTML(due.text)}${t.time ? " · " + escapeHTML(t.time) : ""}</div>
      </div>
      <div class="task-actions"><button class="small-action" type="button" data-action="edit" data-id="${escapeHTML(t.id)}" title="Edit task" aria-label="Edit task">✎</button><button class="small-action" type="button" data-action="delete" data-id="${escapeHTML(t.id)}" title="Delete task" aria-label="Delete task">×</button></div>
    </article>`;
  }).join("");
  $("emptyHint").hidden = shown.length > 0;
  $("visibleCount").textContent = `${shown.length} ${shown.length === 1 ? "task" : "tasks"}`;
}
function resetForm() {
  form.reset(); editingId = null; $("formHeading").textContent = "Plant a new goal 🌱";
  $("submitTask").textContent = "＋ Add to my list"; $("cancelEdit").hidden = true;
}
form.addEventListener("submit", e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); return; }
  const existing = editingId ? tasks.find(t => t.id === editingId) : null;
  const item = {
    id: editingId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    title, subject: subjectInput.value, priority: priorityInput.value,
    date: dateInput.value, time: timeInput.value, notes: notesInput.value.trim(),
    completed: existing ? existing.completed : false,
    createdAt: existing ? existing.createdAt : Date.now()
  };
  if (editingId) tasks = tasks.map(t => t.id === editingId ? item : t);
  else tasks.unshift(item);
  saveTasks(); render(); resetForm(); showToast(editingId ? "Task updated ✨" : "A new goal planted 🌱");
});
$("cancelEdit").addEventListener("click", resetForm);
taskList.addEventListener("change", e => {
  const box = e.target.closest('[data-action="toggle"]'); if (!box) return;
  tasks = tasks.map(t => t.id === box.dataset.id ? {...t, completed:box.checked} : t);
  saveTasks(); render(); showToast(box.checked ? "Lovely work! Task completed 🌷" : "Task moved back to your list");
});
taskList.addEventListener("click", e => {
  const button = e.target.closest("[data-action]"); if (!button) return;
  const task = tasks.find(t => t.id === button.dataset.id); if (!task) return;
  if (button.dataset.action === "delete") {
    tasks = tasks.filter(t => t.id !== task.id); saveTasks(); render(); showToast("Task removed");
  } else if (button.dataset.action === "edit") {
    editingId = task.id; titleInput.value = task.title; subjectInput.value = task.subject;
    priorityInput.value = task.priority; dateInput.value = task.date || ""; timeInput.value = task.time || ""; notesInput.value = task.notes || "";
    $("formHeading").textContent = "Edit your goal ✏️"; $("submitTask").textContent = "Save changes"; $("cancelEdit").hidden = false;
    $("addTask").scrollIntoView({behavior:"smooth",block:"start"}); titleInput.focus();
  }
});
document.querySelectorAll("[data-filter]").forEach(btn => btn.addEventListener("click", () => {
  filter = btn.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === btn));
  render();
}));
$("searchInput").addEventListener("input", render);
$("sortSelect").addEventListener("change", render);
$("clearCompleted").addEventListener("click", () => {
  const count = tasks.filter(t => t.completed).length;
  if (!count) { showToast("No completed tasks to clear"); return; }
  if (confirm(`Delete ${count} completed task${count === 1 ? "" : "s"}?`)) {
    tasks = tasks.filter(t => !t.completed); saveTasks(); render(); showToast("Completed tasks cleared");
  }
});
$("exportButton").addEventListener("click", () => {
  if (!tasks.length) { showToast("Add a task before exporting"); return; }
  const header = ["Task","Subject","Priority","Due date","Time","Notes","Completed"];
  const rows = tasks.map(t => [t.title,t.subject,t.priority,t.date,t.time,t.notes,t.completed ? "Yes" : "No"]);
  const csv = [header,...rows].map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a"); a.href = url; a.download = "bloomstudy-tasks.csv"; a.click(); URL.revokeObjectURL(url); showToast("Tasks exported as CSV ⇩");
});
$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  $("themeToggle").textContent = dark ? "☀️" : "🌙";
  try { localStorage.setItem("bloomstudy-dark", dark ? "yes" : "no"); } catch {}
});
try {
  if (localStorage.getItem("bloomstudy-dark") === "yes") { document.body.classList.add("dark"); $("themeToggle").textContent = "☀️"; }
} catch {}
const quotes = ["Progress, not perfection.","You are allowed to learn one step at a time.","Small steps still move you forward.","Your future self will thank you.","You can do hard things. Take a breath and begin."];
$("dailyQuote").textContent = quotes[new Date().getDate() % quotes.length];
$("headerDate").textContent = new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});

// Focus timer
function updateTimerDisplay() {
  $("timerDisplay").textContent = `${String(Math.floor(timerSeconds/60)).padStart(2,"0")}:${String(timerSeconds%60).padStart(2,"0")}`;
}
function stopTimer() { clearInterval(timerInterval); timerInterval = null; timerRunning = false; $("timerStart").textContent = "▶ Start"; }
function startTimer() {
  if (timerRunning) { stopTimer(); return; }
  timerRunning = true; $("timerStart").textContent = "Ⅱ Pause";
  timerInterval = setInterval(() => {
    timerSeconds--; updateTimerDisplay();
    if (timerSeconds <= 0) { stopTimer(); showToast("Focus session complete! Take a little break 🌸"); }
  },1000);
}
$("focusButton").addEventListener("click", () => { $("timerModal").hidden = false; });
$("closeTimer").addEventListener("click", () => { $("timerModal").hidden = true; stopTimer(); });
$("timerModal").addEventListener("click", e => { if (e.target === $("timerModal")) { $("timerModal").hidden = true; stopTimer(); } });
$("timerStart").addEventListener("click", startTimer);
$("timerReset").addEventListener("click", () => { stopTimer(); timerSeconds = Number(document.querySelector(".timer-presets .selected").dataset.minutes) * 60; updateTimerDisplay(); });
document.querySelectorAll("[data-minutes]").forEach(btn => btn.addEventListener("click", () => {
  stopTimer(); document.querySelectorAll("[data-minutes]").forEach(b => b.classList.toggle("selected", b === btn));
  timerSeconds = Number(btn.dataset.minutes) * 60; updateTimerDisplay();
}));
updateTimerDisplay();
render();
