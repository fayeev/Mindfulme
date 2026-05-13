// ============================================
//  MindfulMe – calendar.js
// ============================================

const STORAGE_KEY = 'mindfulme_history';

const moodEmojis = { happy:'😊', calm:'😌', tired:'😴', stressed:'😰', sad:'😔', excited:'🤩' };
const categoryIcons = { general:'📌', health:'💪', study:'📚', work:'💼', personal:'🌟' };

const moodAdvice = {
  mostly_happy:   "🌟 You've had a mostly happy month! Your positive habits are clearly working. Keep up the great routines that bring you joy.",
  mostly_calm:    "🧘 You've maintained calm throughout the month — a wonderful achievement. Your mindfulness is paying off.",
  mostly_stressed:"🌿 It looks like you've been stressed this month. Try adding short breathing breaks to your day and make sure sleep and water are consistent habits.",
  mostly_tired:   "💤 You've been quite tired this month. Prioritize sleep, cut screen time before bed, and make sure you're staying hydrated.",
  mostly_sad:     "💙 It seems like it's been a difficult month. That's okay. Reach out to someone you trust, keep up gentle movement, and celebrate every small win.",
  mostly_excited: "🚀 You've been riding high on excitement! Channel that energy into consistent habits so it lasts.",
  balanced:       "⚖️ Your moods have been balanced this month — a mix of everything. Keep listening to yourself and adjusting your habits as needed.",
};

let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth();

document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
  renderMoodSummary();

  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
    renderMoodSummary();
    document.getElementById('day-detail').classList.add('hidden');
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
    renderMoodSummary();
    document.getElementById('day-detail').classList.add('hidden');
  });
});

function getHistory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function renderCalendar() {
  const title   = document.getElementById('cal-title');
  const grid    = document.getElementById('cal-grid');
  const history = getHistory();
  const today   = new Date();

  title.textContent = new Date(currentYear, currentMonth, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' });

  grid.innerHTML = '';

  const firstDay   = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevDays   = new Date(currentYear, currentMonth, 0).getDate();

  // Previous month filler
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = document.createElement('div');
    d.className = 'cal-day other-month';
    d.textContent = prevDays - i;
    grid.appendChild(d);
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const entry = history.find(e => e.date === dateStr);
    const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === d;

    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (isToday) cell.classList.add('today');
    if (entry) {
      cell.classList.add('has-entry');
      if (entry.mood) cell.classList.add('mood-' + entry.mood);
    }
    cell.textContent = d;
    cell.addEventListener('click', () => showDayDetail(dateStr, entry, cell));
    grid.appendChild(cell);
  }

  // Next month filler
  const total = firstDay + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= remaining; i++) {
    const d = document.createElement('div');
    d.className = 'cal-day other-month';
    d.textContent = i;
    grid.appendChild(d);
  }
}

function showDayDetail(dateStr, entry, cell) {
  document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
  cell.classList.add('selected');

  const detailCard = document.getElementById('day-detail');
  const dateEl   = document.getElementById('detail-date');
  const moodEl   = document.getElementById('detail-mood');
  const habitsEl = document.getElementById('detail-habits');
  const noteEl   = document.getElementById('detail-note');

  const [y, m, d] = dateStr.split('-').map(Number);
  const formatted = new Date(y, m-1, d).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  dateEl.textContent = formatted;

  if (!entry) {
    moodEl.textContent   = 'No check-in recorded for this day.';
    habitsEl.innerHTML   = '';
    noteEl.textContent   = '';
    detailCard.classList.remove('hidden');
    return;
  }

  const emoji = entry.mood ? (moodEmojis[entry.mood] || '') : '';
  moodEl.innerHTML = entry.mood
    ? `${emoji} Feeling <strong>${capitalize(entry.mood)}</strong>${entry.moodIntensity ? ` (intensity: ${entry.moodIntensity}/10)` : ''}${entry.sleep ? ` · Slept ${entry.sleep}h` : ''}${entry.water ? ` · 💧${entry.water} glasses` : ''}`
    : 'Mood not recorded.';

  habitsEl.innerHTML = '';
  if (entry.habits && entry.habits.length > 0) {
    entry.habits.forEach(h => {
      const tag = document.createElement('span');
      tag.className = 'htag done';
      tag.textContent = h;
      habitsEl.appendChild(tag);
    });
  }

  noteEl.innerHTML = '';
  if (entry.reflection) {
    noteEl.innerHTML += `<em>"${escapeHTML(entry.reflection)}"</em>`;
  }
  if (entry.note) {
    noteEl.innerHTML += (entry.reflection ? '<br><br>' : '') + escapeHTML(entry.note);
  }
  if (!entry.reflection && !entry.note) {
    noteEl.textContent = 'No notes recorded.';
  }

  detailCard.classList.remove('hidden');
  detailCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderMoodSummary() {
  const history = getHistory();
  const monthKey = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;
  const monthEntries = history.filter(e => e.date && e.date.startsWith(monthKey));

  const summaryGrid = document.getElementById('mood-summary-grid');
  const adviceEl    = document.getElementById('mood-advice');
  summaryGrid.innerHTML = '';

  if (monthEntries.length === 0) {
    summaryGrid.innerHTML = '<p style="color:#94a3b8;font-size:0.88rem;">No entries for this month yet.</p>';
    adviceEl.textContent = 'Start checking in daily to see your mood patterns!';
    return;
  }

  // Count moods
  const counts = {};
  monthEntries.forEach(e => {
    if (e.mood) counts[e.mood] = (counts[e.mood] || 0) + 1;
  });

  Object.entries(counts).sort((a,b) => b[1]-a[1]).forEach(([mood, count]) => {
    const item = document.createElement('div');
    item.className = 'mood-summary-item';
    const emoji = moodEmojis[mood] || '';
    item.innerHTML = `${emoji} ${capitalize(mood)} <strong style="margin-left:4px">${count}x</strong>`;
    summaryGrid.appendChild(item);
  });

  // Advice
  const topMood = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
  const total = Object.values(counts).reduce((a,b) => a+b, 0);
  if (topMood[1] / total >= 0.5) {
    adviceEl.innerHTML = moodAdvice['mostly_' + topMood[0]] || moodAdvice.balanced;
  } else {
    adviceEl.innerHTML = moodAdvice.balanced;
  }
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function escapeHTML(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
