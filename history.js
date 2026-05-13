// ============================================
//  MindfulMe – history.js
// ============================================

const STORAGE_KEY = 'mindfulme_history';
const STREAK_KEY  = 'mindfulme_streak';

const moodEmojis = { happy:'😊', calm:'😌', tired:'😴', stressed:'😰', sad:'😔', excited:'🤩' };

document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  document.getElementById('clear-btn').addEventListener('click', clearHistory);
});

function getHistory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function renderHistory() {
  const history = getHistory();
  const listEl  = document.getElementById('history-list');
  const emptyEl = document.getElementById('history-empty');
  listEl.innerHTML = '';

  if (history.length === 0) { emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');

  // Streak banner
  const recentHappy = history.slice(0, 7).filter(e => e.mood === 'happy').length;
  if (recentHappy >= 3) {
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#fef9c3;border:1px solid #fde68a;border-left:4px solid #eab308;border-radius:12px;padding:0.85rem 1rem;font-size:0.9rem;color:#92400e;margin-bottom:1rem;';
    banner.innerHTML = '🌟 Great job! You\'ve been happy several days in a row. Your positive habits may be helping!';
    listEl.appendChild(banner);
  }

  history.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'history-entry';

    const doneCount  = entry.habits ? entry.habits.length : 0;
    const formattedDate = formatDate(entry.date);
    const emoji = entry.mood ? (moodEmojis[entry.mood] || '') : '';
    const moodLabel = entry.mood ? capitalize(entry.mood) : 'No mood';

    const habitTagsHTML = (entry.habits || []).map(h =>
      `<span class="htag done">${h}</span>`
    ).join('');

    const extras = [];
    if (entry.water) extras.push(`💧 ${entry.water} glasses`);
    if (entry.sleep) extras.push(`🌙 ${entry.sleep}h sleep`);
    if (entry.moodIntensity) extras.push(`📊 Intensity: ${entry.moodIntensity}/10`);
    const extrasHTML = extras.length > 0
      ? `<div style="font-size:0.78rem;color:#94a3b8;margin-bottom:0.5rem;">${extras.join(' · ')}</div>`
      : '';

    const reflectionHTML = entry.reflection
      ? `<div class="history-note" style="margin-bottom:0.4rem"><strong style="font-size:0.75rem;color:#64748b;">REFLECTION:</strong> "${escapeHTML(entry.reflection)}"</div>`
      : '';

    const noteHTML = entry.note
      ? `<div class="history-note">"${escapeHTML(entry.note)}"</div>`
      : '';

    card.innerHTML = `
      <div class="history-top">
        <span class="history-date">${formattedDate}</span>
        <span class="mood-badge">${emoji} ${moodLabel}</span>
      </div>
      ${extrasHTML}
      <div class="history-habits">${habitTagsHTML || '<span style="font-size:0.82rem;color:#94a3b8">No habits logged</span>'}</div>
      <div class="history-progress-bar-bg">
        <div class="history-progress-bar-fill" style="width:${doneCount > 0 ? Math.min(100, doneCount * 25) : 0}%"></div>
      </div>
      <div style="font-size:0.75rem;color:#94a3b8;margin-top:0.35rem;margin-bottom:${reflectionHTML || noteHTML ? '0.6rem' : '0'}">${doneCount} habit${doneCount !== 1 ? 's' : ''} completed</div>
      ${reflectionHTML}
      ${noteHTML}
    `;

    listEl.appendChild(card);
  });
}

function clearHistory() {
  if (!confirm('Clear all wellness history? This cannot be undone.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STREAK_KEY);
  renderHistory();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function escapeHTML(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
