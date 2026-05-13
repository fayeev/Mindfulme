// ============================================
//  MindfulMe – app.js  (Dashboard)
// ============================================

const STORAGE_KEY   = 'mindfulme_history';
const STREAK_KEY    = 'mindfulme_streak';
const TASKS_KEY     = 'mindfulme_tasks';

// ---- Data ----
const moodColors = { happy:'happy', calm:'calm', tired:'tired', stressed:'stressed', sad:'sad', excited:'excited' };

const moodMessages = {
  happy:   "You're feeling happy today! 🌟 Ride that energy and channel it into your goals.",
  calm:    "Feeling calm is a superpower. 🧘 Use this peace to focus deeply on what matters.",
  tired:   "You seem tired. 💤 Remember to drink water and prioritize rest tonight. Small steps count!",
  stressed:"You seem stressed. 🌿 Take a breath. Completing even one habit can shift your mood.",
  sad:     "It's okay to feel sad sometimes. 💙 Be kind to yourself — even one small habit is a win.",
  excited: "You're excited! 🚀 Channel that energy — today's a great day to push further.",
};

const musicSuggestions = {
  stressed: "🎵 Try listening to <strong>\"Oceans (Where Feet May Fail)\"</strong> by Hillsong United or <strong>\"You Say\"</strong> by Lauren Daigle — calming worship songs that bring peace.",
  sad:      "🎵 Try <strong>\"Graves into Gardens\"</strong> by Elevation Worship or <strong>\"Way Maker\"</strong> — gentle, uplifting music to lift your spirit.",
  tired:    "🎵 Try lo-fi study music or <strong>\"O Come to the Altar\"</strong> by Elevation Worship — soft and soothing.",
};

const contextSuggestions = {
  stressed: ['water','sleep'],
  tired:    ['water','sleep'],
  sad:      ['water','exercise'],
};

const categoryIcons = { general:'📌', health:'💪', study:'📚', work:'💼', personal:'🌟' };

const journalPrompts = [
  "What made you smile today?",
  "What is one thing you are grateful for?",
  "What challenged you today and how did you face it?",
  "Who made a positive impact on your life recently?",
  "What is one habit you want to build this week?",
  "Describe a moment today when you felt at peace.",
  "What did you learn about yourself today?",
  "What would make tomorrow even better?",
];

const motivationalQuotes = [
  "Small steps every day lead to big changes over time.",
  "You don't have to be perfect to be amazing.",
  "Your health is an investment, not an expense.",
  "Every day is a fresh start. Make it count.",
  "Progress, not perfection.",
  "Be gentle with yourself. You are a work in progress.",
  "Consistency beats intensity every time.",
  "The best time to start is now. The second best time is also now.",
  "Your mental health matters just as much as your physical health.",
  "Celebrate small wins — they add up to something great.",
];

const badges = [
  { min:0,  icon:'🌱', label:'Just Starting' },
  { min:3,  icon:'✨', label:'Getting Started' },
  { min:7,  icon:'💪', label:'One Week Strong' },
  { min:14, icon:'🌿', label:'Two Week Warrior' },
  { min:30, icon:'🏆', label:'Wellness Master' },
];

// ---- State ----
let selectedMood = null;
let tasks = [];

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  setGreeting();
  setTodayDate();
  setMotivation();
  setJournalPrompt();
  buildWaterGlasses();
  loadTasks();
  loadTodayData();
  setupMoodButtons();
  setupSlider();
  setupSleepTracker();
  setupAddTask();
  setupNoteCounter();
  document.getElementById('save-btn').addEventListener('click', saveCheckin);
  document.getElementById('popup-close').addEventListener('click', closePopup);
  buildMiniMoodboard();
});

// ---- Greeting ----
function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting-time').textContent = greet;
}

function setTodayDate() {
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', opts);
}

function setMotivation() {
  const day = new Date().getDate();
  const quote = motivationalQuotes[day % motivationalQuotes.length];
  document.getElementById('motivation-text').textContent = `"${quote}"`;
}

function setJournalPrompt() {
  const day = new Date().getDay();
  document.getElementById('prompt-text').textContent = journalPrompts[day % journalPrompts.length];
}

// ---- Streak & Badge ----
function getStreak() {
  const raw = localStorage.getItem(STREAK_KEY);
  return raw ? JSON.parse(raw) : { count: 0, lastDate: null };
}

function refreshStreak() {
  const s = getStreak();
  document.getElementById('streak-count').textContent = s.count;
  const badge = [...badges].reverse().find(b => s.count >= b.min) || badges[0];
  document.getElementById('badge-icon').textContent  = badge.icon;
  document.getElementById('badge-label').textContent = badge.label;
}

function updateStreak() {
  const streak = getStreak();
  const todayKey = getTodayKey();
  const yesterday = getDateKey(-1);
  if (streak.lastDate === todayKey) return;
  if (streak.lastDate === yesterday) { streak.count += 1; }
  else { streak.count = 1; }
  streak.lastDate = todayKey;
  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
}

// ---- Mood Buttons ----
function setupMoodButtons() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = btn.dataset.mood;
      document.body.setAttribute('data-mood', selectedMood);
      showContextMsg(selectedMood);
      showMusicSuggestion(selectedMood);
    });
  });
}

function showContextMsg(mood) {
  const el = document.getElementById('context-msg');
  const txt = document.getElementById('context-text');
  if (!mood) { el.classList.add('hidden'); return; }
  let msg = moodMessages[mood] || '';
  const sugg = contextSuggestions[mood] || [];
  const checkedNames = tasks.filter(t => t.done).map(t => t.name.toLowerCase());
  const missing = sugg.filter(h => !checkedNames.some(n => n.includes(h)));
  if (missing.length > 0) {
    const names = missing.map(h => h.charAt(0).toUpperCase() + h.slice(1)).join(' & ');
    msg += ` Consider adding <strong>${names}</strong> to your tasks today.`;
  }
  txt.innerHTML = msg;
  el.classList.remove('hidden');
}

function showMusicSuggestion(mood) {
  const el = document.getElementById('music-suggestion');
  const txt = document.getElementById('music-text');
  if (musicSuggestions[mood]) {
    txt.innerHTML = musicSuggestions[mood];
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// ---- Slider ----
function setupSlider() {
  const slider = document.getElementById('mood-slider');
  const val = document.getElementById('slider-val');
  slider.addEventListener('input', () => { val.textContent = slider.value; });
}

// ---- Water Glasses ----
function buildWaterGlasses() {
  const container = document.getElementById('water-glasses');
  container.innerHTML = '';
  let waterCount = getTodayWater();
  updateWaterCount(waterCount);
  for (let i = 1; i <= 8; i++) {
    const btn = document.createElement('button');
    btn.className = 'glass-btn' + (i <= waterCount ? ' filled' : '');
    btn.textContent = '💧';
    btn.title = `${i} glass${i > 1 ? 'es' : ''}`;
    btn.addEventListener('click', () => {
      waterCount = i;
      saveTodayWater(waterCount);
      updateWaterCount(waterCount);
      document.querySelectorAll('.glass-btn').forEach((b, idx) => {
        b.classList.toggle('filled', idx < waterCount);
      });
    });
    container.appendChild(btn);
  }
}

function getTodayWater() {
  const h = getHistory();
  const e = h.find(x => x.date === getTodayKey());
  return e ? (e.water || 0) : 0;
}

function saveTodayWater(count) {
  let history = getHistory();
  let e = history.find(x => x.date === getTodayKey());
  if (!e) { e = { date: getTodayKey(), mood: null, habits: [], note: '', reflection: '', water: 0, sleep: 0, moodIntensity: 5 }; history.unshift(e); }
  e.water = count;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  updateWaterCount(count);
}

function updateWaterCount(count) {
  document.getElementById('water-count').textContent = count;
}

// ---- Sleep Tracker ----
function setupSleepTracker() {
  const input = document.getElementById('sleep-hours');
  const feedback = document.getElementById('sleep-feedback');
  const todayEntry = getHistory().find(x => x.date === getTodayKey());
  if (todayEntry && todayEntry.sleep) input.value = todayEntry.sleep;

  input.addEventListener('input', () => {
    const h = parseFloat(input.value);
    if (isNaN(h)) { feedback.textContent = ''; return; }
    if (h < 5)      feedback.textContent = '😴 Try to get more sleep tonight!';
    else if (h < 7) feedback.textContent = '🙂 A bit more sleep would help.';
    else if (h <= 9) feedback.textContent = '✅ Great sleep!';
    else            feedback.textContent = '😌 That\'s a lot of sleep — are you okay?';
  });
}

// ============================================
// TASKS / HABITS CRUD
// ============================================
function loadTasks() {
  const raw = localStorage.getItem(TASKS_KEY + '_' + getTodayKey());
  tasks = raw ? JSON.parse(raw) : getDefaultTasks();
  renderTasks();
}

function getDefaultTasks() {
  return [
    { id: uid(), name: 'Drink Water',  category: 'health',   done: false },
    { id: uid(), name: 'Exercise',     category: 'health',   done: false },
    { id: uid(), name: 'Study',        category: 'study',    done: false },
    { id: uid(), name: 'Sleep Early',  category: 'personal', done: false },
  ];
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY + '_' + getTodayKey(), JSON.stringify(tasks));
}

function renderTasks() {
  const list = document.getElementById('habit-list');
  const empty = document.getElementById('empty-habits');
  list.innerHTML = '';

  if (tasks.length === 0) {
    empty.classList.remove('hidden');
    updateProgress();
    return;
  }
  empty.classList.add('hidden');

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'habit-item' + (task.done ? ' checked' : '');
    li.dataset.id = task.id;

    const icon = categoryIcons[task.category] || '📌';

    li.innerHTML = `
      <div class="habit-row">
        <input type="checkbox" class="habit-check" ${task.done ? 'checked' : ''} />
        <span class="habit-cat-icon">${icon}</span>
        <span class="habit-name">${escapeHTML(task.name)}</span>
        <div class="habit-actions">
          <button class="habit-edit-btn" title="Edit">✏️</button>
          <button class="habit-del-btn" title="Delete">🗑</button>
        </div>
      </div>
      <div class="edit-row hidden">
        <input type="text" class="edit-input" value="${escapeHTML(task.name)}" maxlength="60" />
        <button class="edit-save-btn">Save</button>
      </div>
    `;

    // Checkbox
    li.querySelector('.habit-check').addEventListener('change', e => {
      task.done = e.target.checked;
      li.classList.toggle('checked', task.done);
      saveTasks();
      updateProgress();
      checkHabitCompletion();
    });

    // Edit
    li.querySelector('.habit-edit-btn').addEventListener('click', () => {
      const editRow = li.querySelector('.edit-row');
      editRow.classList.toggle('hidden');
      if (!editRow.classList.contains('hidden')) li.querySelector('.edit-input').focus();
    });

    // Save edit
    li.querySelector('.edit-save-btn').addEventListener('click', () => {
      const newName = li.querySelector('.edit-input').value.trim();
      if (!newName) return;
      task.name = newName;
      li.querySelector('.habit-name').textContent = newName;
      li.querySelector('.edit-row').classList.add('hidden');
      saveTasks();
      showToast('✅ Task updated!');
    });

    // Delete
    li.querySelector('.habit-del-btn').addEventListener('click', () => {
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks();
      renderTasks();
    });

    list.appendChild(li);
  });

  updateProgress();
}

function setupAddTask() {
  const addBtn     = document.getElementById('add-habit-btn');
  const form       = document.getElementById('add-task-form');
  const confirmBtn = document.getElementById('confirm-add-btn');
  const cancelBtn  = document.getElementById('cancel-add-btn');
  const input      = document.getElementById('new-task-input');

  addBtn.addEventListener('click', () => {
    form.classList.remove('hidden');
    input.focus();
  });

  cancelBtn.addEventListener('click', () => {
    form.classList.add('hidden');
    input.value = '';
  });

  confirmBtn.addEventListener('click', addTask);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
}

function addTask() {
  const input    = document.getElementById('new-task-input');
  const category = document.getElementById('task-category').value;
  const name     = input.value.trim();
  if (!name) return;

  tasks.push({ id: uid(), name, category, done: false });
  saveTasks();
  renderTasks();
  input.value = '';
  document.getElementById('add-task-form').classList.add('hidden');
  showToast('✅ Task added!');
}

function updateProgress() {
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('habits-done').textContent  = done;
  document.getElementById('habits-total').textContent = total;
  document.getElementById('progress-fill').style.width = pct + '%';
}

function checkHabitCompletion() {
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  if (done === 0 || total === 0) return;

  if (done === total) {
    showPopup('🎉', 'All Done!', `You completed all ${total} tasks today. That's incredible — keep this momentum going! 🌟`);
  } else if (done === Math.floor(total / 2) && done > 0) {
    showPopup('💪', 'Halfway There!', `You've completed ${done}/${total} tasks. Keep pushing — you're doing great!`);
  }
}

// ============================================
// JOURNAL & NOTES
// ============================================
function setupNoteCounter() {
  const note = document.getElementById('daily-note');
  note.addEventListener('input', () => {
    document.getElementById('char-count').textContent = note.value.length;
  });
}

// ============================================
// VOICE NOTES
// ============================================

const voiceBtn = document.getElementById("voice-btn");
const voiceStatus = document.getElementById("voice-status");
const noteTextarea = document.getElementById("daily-note");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  voiceBtn.addEventListener("click", () => {
    recognition.start();
    voiceStatus.textContent = "Listening...";
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    noteTextarea.value += (noteTextarea.value ? " " : "") + transcript;
    voiceStatus.textContent = "Added to your note.";
  };

  recognition.onerror = () => {
    voiceStatus.textContent = "Voice recognition error. Try again.";
  };

  recognition.onend = () => {
    voiceStatus.textContent = "Tap to record again.";
  };

} else {
  voiceStatus.textContent = "Speech recognition not supported in this browser.";
  voiceBtn.disabled = true;
}

// ============================================
// SAVE CHECK-IN
// ============================================
function saveCheckin() {
  const note       = document.getElementById('daily-note').value.trim();
  const reflection = document.getElementById('reflection-input').value.trim();
  const sleepHours = parseFloat(document.getElementById('sleep-hours').value) || 0;
  const moodInt    = parseInt(document.getElementById('mood-slider').value);
  const doneHabits = tasks.filter(t => t.done).map(t => t.name);
  const todayKey   = getTodayKey();

  const entry = {
    date: todayKey,
    mood: selectedMood,
    moodIntensity: moodInt,
    habits: doneHabits,
    note,
    reflection,
    water: getTodayWater(),
    sleep: sleepHours,
    timestamp: new Date().toISOString(),
  };

  saveToHistory(entry);
  updateStreak();
  refreshStreak();
  buildMiniMoodboard();
  showToast('✅ Check-in saved! Keep it up!');
}

// ============================================
// MINI MOODBOARD (bottom of dashboard)
// ============================================
function buildMiniMoodboard() {
  const container = document.getElementById('mini-moodboard');
  container.innerHTML = '';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = getTodayKey();
  const history  = getHistory();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const entry = history.find(e => e.date === dateStr);
    const div = document.createElement('div');
    div.className = 'mini-day';
    if (entry && entry.mood) div.classList.add('mood-' + entry.mood);
    if (dateStr === todayKey) div.classList.add('today');
    div.title = `${d} ${now.toLocaleString('en',{month:'short'})}${entry ? ' – ' + (entry.mood || 'logged') : ''}`;
    div.textContent = d;
    container.appendChild(div);
  }
}

// ============================================
// LOAD TODAY'S EXISTING DATA
// ============================================
function loadTodayData() {
  refreshStreak();
  const history = getHistory();
  const todayEntry = history.find(e => e.date === getTodayKey());
  if (!todayEntry) return;

  if (todayEntry.mood) {
    selectedMood = todayEntry.mood;
    document.body.setAttribute('data-mood', selectedMood);
    document.querySelectorAll('.mood-btn').forEach(btn => {
      if (btn.dataset.mood === todayEntry.mood) btn.classList.add('selected');
    });
    showContextMsg(todayEntry.mood);
    showMusicSuggestion(todayEntry.mood);
  }

  if (todayEntry.moodIntensity) {
    document.getElementById('mood-slider').value = todayEntry.moodIntensity;
    document.getElementById('slider-val').textContent = todayEntry.moodIntensity;
  }

  if (todayEntry.note) {
    document.getElementById('daily-note').value = todayEntry.note;
    document.getElementById('char-count').textContent = todayEntry.note.length;
  }

  if (todayEntry.reflection) {
    document.getElementById('reflection-input').value = todayEntry.reflection;
  }

  if (todayEntry.sleep) {
    document.getElementById('sleep-hours').value = todayEntry.sleep;
  }
}

// ============================================
// POPUP
// ============================================
function showPopup(emoji, title, msg) {
  document.getElementById('popup-emoji').textContent = emoji;
  document.getElementById('popup-title').textContent = title;
  document.getElementById('popup-msg').textContent   = msg;
  document.getElementById('popup-overlay').classList.remove('hidden');
}
function closePopup() {
  document.getElementById('popup-overlay').classList.add('hidden');
}

// ============================================
// TOAST
// ============================================
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ============================================
// STORAGE HELPERS
// ============================================
function getHistory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveToHistory(entry) {
  let history = getHistory();
  const idx = history.findIndex(e => e.date === entry.date);
  if (idx > -1) history[idx] = entry;
  else history.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function getTodayKey()       { return getDateKey(0); }
function getDateKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function uid() { return Math.random().toString(36).slice(2,9); }

function escapeHTML(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
