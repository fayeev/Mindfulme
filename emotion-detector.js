// ============================================================
//  MindfulMe – emotion-detector.js
//  Uses face-api.js (TensorFlow.js backend) to detect emotions
//  from webcam, mirrors the Python/DeepFace logic in-browser.
//
//  Models are loaded from jsDelivr CDN (no local files needed).
//  Works in Chrome/Edge. Requires HTTPS or localhost.
// ============================================================

const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

// Map face-api emotion labels → MindfulMe mood keys
const EMOTION_TO_MOOD = {
  happy:     'happy',
  sad:       'sad',
  angry:     'stressed',
  fearful:   'stressed',
  disgusted: 'stressed',
  surprised: 'excited',
  neutral:   'calm',
};

// Feedback messages (mirrors Python get_feedback)
const EMOTION_FEEDBACK = {
  happy:     "😊 Great! Your positive energy is showing — keep it up!",
  sad:       "💙 You seem sad. Take a short break and be gentle with yourself.",
  angry:     "🌿 Try to relax. Take a few deep breaths.",
  fearful:   "🫂 Stay calm — you're safe. Breathe slowly.",
  disgusted: "😤 Something bothering you? Try the breathing exercise.",
  surprised: "🤩 That's surprising! Channel that energy!",
  neutral:   "😌 You're doing okay — steady and calm.",
};

// ── State (mirrors Python tracking variables) ──
let detectorRunning   = false;
let videoStream       = null;
let detectionInterval = null;
let currentEmotion    = 'neutral';
let emotionStartTime  = Date.now();
let lastChangeTime    = Date.now();
let emotionHistory    = [];           // last 10 changes, like Python
let modelsLoaded      = false;

// ── DOM refs (injected by initEmotionDetector) ──
let videoEl, canvasEl, ctx;
let statusEl, emotionEl, durationEl, consistencyEl, feedbackEl, autoFillNote;

// ============================================================
// INIT — call this once on DOMContentLoaded
// ============================================================
async function initEmotionDetector() {
  injectDetectorPanel();
  bindDetectorButtons();
}

// ============================================================
// INJECT THE UI PANEL INTO THE PAGE
// ============================================================
function injectDetectorPanel() {
  // Find the mood section card to insert before it
  const moodSection = document.querySelector('.mood-section');
  if (!moodSection) return;

  const panel = document.createElement('section');
  panel.className = 'card emotion-detector-section';
  panel.id = 'emotion-detector-section';
  panel.innerHTML = `
    <div class="ed-header">
      <h2 class="section-title" style="margin-bottom:0">
        📸 Emotion Detector
        <span class="ed-badge">AI</span>
      </h2>
      <button class="ed-toggle-btn" id="ed-toggle-btn">Start Camera</button>
    </div>
    <p class="ed-hint">
      Your camera detects your facial emotion and can auto-fill your mood below.
      <br><strong>Nothing is recorded or sent anywhere</strong> — all processing is on your device.
    </p>

    <!-- Camera + Canvas overlay -->
    <div class="ed-video-wrap hidden" id="ed-video-wrap">
      <video id="ed-video" autoplay muted playsinline></video>
      <canvas id="ed-canvas"></canvas>

      <!-- Overlay stats (mirrors Python cv2.putText output) -->
      <div class="ed-overlay-stats">
        <span id="ed-overlay-emotion">Emotion: —</span>
        <span id="ed-overlay-duration">Duration: 0s</span>
        <span id="ed-overlay-consistency">Status: Analyzing...</span>
      </div>
    </div>

    <!-- Status bar -->
    <div class="ed-status-bar" id="ed-status-bar">
      <div class="ed-status-dot" id="ed-status-dot"></div>
      <span id="ed-status-text">Camera off</span>
    </div>

    <!-- Results panel -->
    <div class="ed-results hidden" id="ed-results">
      <div class="ed-result-grid">
        <div class="ed-result-block">
          <div class="ed-result-label">Detected Emotion</div>
          <div class="ed-result-value" id="ed-emotion-val">—</div>
        </div>
        <div class="ed-result-block">
          <div class="ed-result-label">Duration</div>
          <div class="ed-result-value" id="ed-duration-val">0s</div>
        </div>
        <div class="ed-result-block">
          <div class="ed-result-label">Stability</div>
          <div class="ed-result-value" id="ed-consistency-val">Analyzing…</div>
        </div>
      </div>

      <div class="ed-feedback-box" id="ed-feedback-box">
        <span id="ed-feedback-text">Waiting for detection…</span>
      </div>

      <!-- Emotion bar chart (mirrors Python history tracking) -->
      <div class="ed-history-label">Recent emotion history</div>
      <div class="ed-history-bars" id="ed-history-bars"></div>

      <!-- Auto-fill controls -->
      <div class="ed-autofill-row">
        <label class="ed-autofill-label">
          <input type="checkbox" id="ed-autofill-check" checked />
          Auto-fill mood when detected
        </label>
        <button class="ed-apply-btn" id="ed-apply-btn">Apply Mood Now</button>
      </div>
    </div>
  `;

  moodSection.parentNode.insertBefore(panel, moodSection);
}

// ============================================================
// BUTTON BINDINGS
// ============================================================
function bindDetectorButtons() {
  document.addEventListener('click', e => {
    if (e.target.id === 'ed-toggle-btn')  toggleDetector();
    if (e.target.id === 'ed-apply-btn')   applyDetectedMood();
  });
}

// ============================================================
// TOGGLE START / STOP
// ============================================================
async function toggleDetector() {
  if (detectorRunning) {
    stopDetector();
  } else {
    await startDetector();
  }
}

async function startDetector() {
  setStatus('loading', 'Loading AI models…');
  const btn = document.getElementById('ed-toggle-btn');
  btn.disabled = true;

  try {
    await loadModels();
    await startCamera();
    showDetectorUI();
    btn.textContent = 'Stop Camera';
    btn.classList.add('active');
    btn.disabled = false;
    detectorRunning = true;
    runDetectionLoop();
    setStatus('active', 'Detecting emotions…');
  } catch (err) {
    console.error('Emotion detector error:', err);
    setStatus('error', 'Error: ' + (err.message || 'Could not start camera'));
    btn.disabled = false;
    btn.textContent = 'Try Again';
  }
}

function stopDetector() {
  detectorRunning = false;
  clearInterval(detectionInterval);
  detectionInterval = null;

  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }

  document.getElementById('ed-video-wrap').classList.add('hidden');
  document.getElementById('ed-results').classList.add('hidden');
  document.getElementById('ed-toggle-btn').textContent = 'Start Camera';
  document.getElementById('ed-toggle-btn').classList.remove('active');
  setStatus('idle', 'Camera off');

  // Clear canvas
  if (ctx && canvasEl) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
}

// ============================================================
// MODEL LOADING
// ============================================================
async function loadModels() {
  if (modelsLoaded) return;

  setStatus('loading', 'Loading face detection model…');
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);

  setStatus('loading', 'Loading expression model…');
  await faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL);

  modelsLoaded = true;
}

// ============================================================
// CAMERA
// ============================================================
async function startCamera() {
  videoStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  });

  videoEl  = document.getElementById('ed-video');
  canvasEl = document.getElementById('ed-canvas');
  ctx      = canvasEl.getContext('2d');

  videoEl.srcObject = videoStream;

  await new Promise(resolve => { videoEl.onloadedmetadata = resolve; });
  await videoEl.play();

  canvasEl.width  = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
}

function showDetectorUI() {
  document.getElementById('ed-video-wrap').classList.remove('hidden');
  document.getElementById('ed-results').classList.remove('hidden');
}

// ============================================================
// DETECTION LOOP — mirrors the Python while True: loop
// ============================================================
function runDetectionLoop() {
  // Run every 500ms (2fps) — balances accuracy and performance
  detectionInterval = setInterval(async () => {
    if (!detectorRunning || !videoEl) return;
    await detectFrame();
    updateDurationDisplay();
  }, 500);
}

async function detectFrame() {
  if (!videoEl || videoEl.readyState < 2) return;

  // Match Python: detect face + expressions
  const detections = await faceapi
    .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceExpressions();

  // Clear canvas
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  if (detections.length === 0) {
    setOverlay('—', '', '');
    return;
  }

  // Scale detections to canvas size (mirrors cv2.rectangle)
  const dims = { width: canvasEl.width, height: canvasEl.height };
  const resized = faceapi.resizeResults(detections, dims);

  resized.forEach(det => {
    const box = det.detection.box;

    // Draw face box — mirrors cv2.rectangle(frame, (x,y), (x+w,y+h), (0,0,255), 2)
    ctx.strokeStyle = '#F9447F';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, 12);
    ctx.stroke();

    // Get dominant emotion — mirrors result[0]['dominant_emotion']
    const expressions  = det.expressions;
    const dominantEmo  = getDominantEmotion(expressions);
    const confidence   = Math.round(expressions[dominantEmo] * 100);

    // Draw label on canvas (mirrors cv2.putText)
    const label = `${dominantEmo} ${confidence}%`;
    ctx.fillStyle    = 'rgba(26,193,185,0.85)';
    ctx.beginPath();
    ctx.roundRect(box.x, box.y - 32, label.length * 10 + 12, 28, 6);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font      = 'bold 14px Nunito, sans-serif';
    ctx.fillText(label, box.x + 6, box.y - 11);

    // Update tracking (mirrors Python emotion change tracking)
    updateEmotionTracking(dominantEmo);
  });
}

// ============================================================
// EMOTION TRACKING — mirrors Python tracking block exactly
// ============================================================
function updateEmotionTracking(detectedEmotion) {
  if (detectedEmotion !== currentEmotion) {
    // Emotion changed
    currentEmotion   = detectedEmotion;
    emotionStartTime = Date.now();
    lastChangeTime   = Date.now();

    // Track changes — mirrors emotion_history.append / pop(0)
    emotionHistory.push(currentEmotion);
    if (emotionHistory.length > 10) emotionHistory.shift();

    // Auto-fill mood if checkbox is on
    const autoFill = document.getElementById('ed-autofill-check');
    if (autoFill && autoFill.checked) {
      applyDetectedMood();
    }
  }

  // Mirrors: consistency check
  const timeSinceChange = (Date.now() - lastChangeTime) / 1000;
  let consistency;
  if (emotionHistory.length >= 5) {
    consistency = timeSinceChange < 3 ? 'Changing frequently' : 'Stable 🟢';
  } else {
    consistency = 'Analyzing…';
  }

  const duration = Math.round((Date.now() - emotionStartTime) / 1000);
  const feedback = EMOTION_FEEDBACK[currentEmotion] || "You're doing okay.";

  // Update result cards
  document.getElementById('ed-emotion-val').textContent      = capitalize(currentEmotion);
  document.getElementById('ed-duration-val').textContent     = duration + 's';
  document.getElementById('ed-consistency-val').textContent  = consistency;
  document.getElementById('ed-feedback-text').textContent    = feedback;

  // Update overlay (mirrors cv2.putText lines)
  setOverlay(currentEmotion, duration + 's', consistency);

  // Update emotion history bar chart
  renderHistoryBars();
}

function updateDurationDisplay() {
  if (!currentEmotion) return;
  const duration = Math.round((Date.now() - emotionStartTime) / 1000);
  const el = document.getElementById('ed-duration-val');
  if (el) el.textContent = duration + 's';

  const overlayDur = document.getElementById('ed-overlay-duration');
  if (overlayDur) overlayDur.textContent = 'Duration: ' + duration + 's';
}

// ============================================================
// GET DOMINANT EMOTION from expressions object
// (mirrors DeepFace result[0]['dominant_emotion'])
// ============================================================
function getDominantEmotion(expressions) {
  return Object.entries(expressions)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// ============================================================
// APPLY DETECTED MOOD TO MINDFULME MOOD BUTTONS
// ============================================================
function applyDetectedMood() {
  const mindfulMeMood = EMOTION_TO_MOOD[currentEmotion] || 'calm';

  // Click the matching mood button
  const targetBtn = document.querySelector(`.mood-btn[data-mood="${mindfulMeMood}"]`);
  if (targetBtn) {
    targetBtn.click();

    // Visual pulse feedback
    targetBtn.style.transition = 'box-shadow 0.1s';
    targetBtn.style.boxShadow  = '0 0 0 6px rgba(26,193,185,0.4)';
    setTimeout(() => { targetBtn.style.boxShadow = ''; }, 600);
  }

  showToast(`📸 Mood auto-filled: ${capitalize(mindfulMeMood)} (from ${capitalize(currentEmotion)})`);
}

// ============================================================
// EMOTION HISTORY BAR CHART
// (mirrors emotion_history list — last 10 changes)
// ============================================================
const EMOTION_COLORS = {
  happy:     '#FBD160',
  sad:       '#7F95E4',
  angry:     '#FF8017',
  fearful:   '#FCB8D9',
  disgusted: '#F9447F',
  surprised: '#1AC1B9',
  neutral:   '#B8C7F5',
};

function renderHistoryBars() {
  const container = document.getElementById('ed-history-bars');
  if (!container) return;
  container.innerHTML = '';

  if (emotionHistory.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem;color:#9BA4C7;font-weight:700;">No history yet</span>';
    return;
  }

  emotionHistory.forEach((emo, i) => {
    const bar = document.createElement('div');
    bar.className = 'ed-hist-bar';
    bar.style.background = EMOTION_COLORS[emo] || '#B8C7F5';
    bar.style.opacity     = 0.4 + (i / emotionHistory.length) * 0.6;
    bar.title             = capitalize(emo);

    const label = document.createElement('span');
    label.className   = 'ed-hist-label';
    label.textContent = emo.slice(0, 3);

    bar.appendChild(label);
    container.appendChild(bar);
  });
}

// ============================================================
// OVERLAY DISPLAY
// ============================================================
function setOverlay(emotion, duration, consistency) {
  const oe = document.getElementById('ed-overlay-emotion');
  const od = document.getElementById('ed-overlay-duration');
  const oc = document.getElementById('ed-overlay-consistency');
  if (oe) oe.textContent = 'Emotion: ' + (emotion || '—');
  if (od) od.textContent = duration ? 'Duration: ' + duration : '';
  if (oc) oc.textContent = consistency ? 'Status: ' + consistency : '';
}

// ============================================================
// STATUS BAR
// ============================================================
function setStatus(type, text) {
  const dot  = document.getElementById('ed-status-dot');
  const span = document.getElementById('ed-status-text');
  if (!dot || !span) return;
  span.textContent = text;
  dot.className    = 'ed-status-dot ' + type;
}

// ============================================================
// HELPERS
// ============================================================
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ============================================================
// AUTO-INIT on DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Only init if face-api is available
  if (typeof faceapi !== 'undefined') {
    initEmotionDetector();
  } else {
    console.warn('face-api.js not loaded — emotion detector disabled.');
  }
});
