/**
 * HackByte 4.0 — Roulette Spinner · app.js
 * Pure vanilla JS: Canvas wheel, spin animation, confetti, GitHub avatars, REST API.
 */

"use strict";

// ─── Secure random helpers ────────────────────────────────────────────────────
/** Returns a cryptographically secure random float in [0, 1). */
function secureRandom() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / (0xffffffff + 1);
}
/** Returns a secure random integer in [0, max). */
function secureRandomInt(max) {
  return Math.floor(secureRandom() * max);
}

// ─── Segment colours (bright, distinct) ─────────────────────────────────────
const COLORS = [
  "#238636", "#1f6feb", "#a371f7", "#f78166", "#ffa657",
  "#39d353", "#58a6ff", "#db61a2", "#f0883e", "#56d364",
  "#79c0ff", "#ffb347", "#ff6e96", "#7ee787", "#d2a8ff",
  "#ffa198", "#52bcff", "#ffca4e", "#e57fdb", "#63e6be",
];

// ─── State ───────────────────────────────────────────────────────────────────
let participants = [];   // current wheel participants
let winners      = [];   // past winners
let spinning     = false;
let currentAngle = 0;    // radians — current rotation of wheel

// ─── DOM refs ────────────────────────────────────────────────────────────────
const canvas       = document.getElementById("wheelCanvas");
const ctx          = canvas.getContext("2d");
const usernameInput= document.getElementById("usernameInput");
const addBtn       = document.getElementById("addBtn");
const spinBtn      = document.getElementById("spinBtn");
const spinStatus   = document.getElementById("spinStatus");
const participantList = document.getElementById("participantList");
const winnerList      = document.getElementById("winnerList");
const exportBtn    = document.getElementById("exportBtn");
const winnerModal  = document.getElementById("winnerModal");
const winnerAvatar = document.getElementById("winnerAvatar");
const winnerUsername = document.getElementById("winnerUsername");
const nextSpinBtn  = document.getElementById("nextSpinBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const confettiArea = document.getElementById("confettiCanvas");
const bulkInput    = document.getElementById("bulkInput");
const bulkAddBtn   = document.getElementById("bulkAddBtn");

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async function init() {
  try {
    const [p, w] = await Promise.all([fetchParticipants(), fetchWinners()]);
    participants = p;
    winners      = w;
  } catch {
    setStatus("⚠️ Could not reach server – running in offline mode.");
  }
  renderParticipantList();
  renderWinnerList();
  drawWheel();
  updateSpinBtn();
})();

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchParticipants() {
  const r = await fetch("/participants");
  if (!r.ok) throw new Error("fetch participants failed");
  return r.json();
}
async function fetchWinners() {
  const r = await fetch("/winners");
  if (!r.ok) throw new Error("fetch winners failed");
  return r.json();
}
async function apiAddParticipant(username) {
  const r = await fetch("/participants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!r.ok) throw new Error("add participant failed");
  return r.json();
}
async function apiRemoveParticipant(username) {
  const r = await fetch(`/participants/${encodeURIComponent(username)}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error("remove participant failed");
  return r.json();
}
async function apiAddWinner(username) {
  const r = await fetch("/winners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!r.ok) throw new Error("add winner failed");
  return r.json();
}

// ─── Add participant ──────────────────────────────────────────────────────────
addBtn.addEventListener("click", addParticipant);
usernameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") addParticipant();
});
bulkAddBtn.addEventListener("click", addBulkParticipants);

async function addParticipant() {
  const username = usernameInput.value.trim();
  if (!username) return;
  if (participants.includes(username)) {
    setStatus(`⚠️ "${username}" is already in the list.`);
    return;
  }
  addBtn.disabled = true;
  try {
    participants = await apiAddParticipant(username);
  } catch {
    // offline fallback
    if (!participants.includes(username)) participants.push(username);
  }
  usernameInput.value = "";
  renderParticipantList();
  drawWheel();
  updateSpinBtn();
  setStatus(`✅ Added @${username} to the wheel.`);
  addBtn.disabled = false;
  usernameInput.focus();
}

// ─── Bulk add participants ────────────────────────────────────────────────────
async function addBulkParticipants() {
  const raw = bulkInput.value;
  if (!raw.trim()) return;

  // Split on newlines and/or commas, clean up each entry
  const usernames = raw
    .split(/[\n,]+/)
    .map(u => u.trim())
    .filter(u => u.length > 0);

  if (usernames.length === 0) return;

  bulkAddBtn.disabled = true;
  addBtn.disabled = true;
  setStatus(`⏳ Adding ${usernames.length} participant(s)…`);

  let added = 0;
  let skipped = 0;

  for (const username of usernames) {
    if (participants.includes(username)) {
      skipped++;
      continue;
    }
    try {
      participants = await apiAddParticipant(username);
    } catch {
      if (!participants.includes(username)) participants.push(username);
    }
    added++;
  }

  bulkInput.value = "";
  renderParticipantList();
  drawWheel();
  updateSpinBtn();

  const parts = [];
  if (added > 0) parts.push(`✅ Added ${added} participant(s)`);
  if (skipped > 0) parts.push(`⚠️ ${skipped} already in list`);
  setStatus(parts.join(" · "));

  bulkAddBtn.disabled = false;
  addBtn.disabled = false;
  bulkInput.focus();
}

// ─── Remove participant ───────────────────────────────────────────────────────
async function removeParticipant(username) {
  try {
    participants = await apiRemoveParticipant(username);
  } catch {
    participants = participants.filter(p => p !== username);
  }
  renderParticipantList();
  drawWheel();
  updateSpinBtn();
  setStatus(`🗑️ Removed @${username}.`);
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function renderParticipantList() {
  participantList.innerHTML = "";
  if (participants.length === 0) {
    participantList.innerHTML = `<li class="empty-hint">No participants yet. Add some!</li>`;
    return;
  }
  participants.forEach(username => {
    const li = document.createElement("li");
    li.className = "user-item";
    li.innerHTML = `
      <img src="https://github.com/${encodeURIComponent(username)}.png?size=40"
           alt="${username}" loading="lazy" />
      <span class="username">@${username}</span>
      <button class="remove-btn" title="Remove" aria-label="Remove ${username}">×</button>
    `;
    li.querySelector(".remove-btn").addEventListener("click", () => removeParticipant(username));
    participantList.appendChild(li);
  });
}

function renderWinnerList() {
  winnerList.innerHTML = "";
  if (winners.length === 0) {
    winnerList.innerHTML = `<li class="empty-hint">No winners yet.</li>`;
    return;
  }
  winners.forEach(username => {
    const li = document.createElement("li");
    li.className = "user-item winner-item";
    li.innerHTML = `
      <img src="https://github.com/${encodeURIComponent(username)}.png?size=40"
           alt="${username}" loading="lazy" />
      <span class="username">@${username}</span>
    `;
    winnerList.appendChild(li);
  });
}

function updateSpinBtn() {
  spinBtn.disabled = participants.length < 2 || spinning;
  if (participants.length < 2 && !spinning) {
    setStatus("Add at least 2 participants to spin.");
  }
}

function setStatus(msg) {
  spinStatus.textContent = msg;
}

// ─── Canvas wheel drawing ─────────────────────────────────────────────────────
function drawWheel(highlightIndex = -1) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r  = Math.min(cx, cy) - 4;

  ctx.clearRect(0, 0, w, h);

  const n = participants.length;

  if (n === 0) {
    // Empty state
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#161b22";
    ctx.fill();
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#8b949e";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Add participants", cx, cy - 12);
    ctx.fillText("to get started 🎡", cx, cy + 14);
    ctx.restore();
    return;
  }

  const arc = (Math.PI * 2) / n;

  for (let i = 0; i < n; i++) {
    const startAngle = currentAngle + i * arc;
    const endAngle   = startAngle + arc;

    // Segment fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    if (i === highlightIndex) {
      ctx.fillStyle = "#fff";
    }
    ctx.fill();

    // Segment border
    ctx.strokeStyle = "#0d1117";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + arc / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const name = participants[i];
    const maxLen = 14;
    const label = name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
    const fontSize = Math.max(10, Math.min(15, 200 / n));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = i === highlightIndex ? "#0d1117" : "#fff";
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur  = 3;
    ctx.fillText(label, r - 12, 0);
    ctx.restore();
  }

  // Centre hub
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fillStyle = "#0d1117";
  ctx.fill();
  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

// ─── Spin logic ───────────────────────────────────────────────────────────────
spinBtn.addEventListener("click", startSpin);

function startSpin() {
  if (spinning || participants.length < 2) return;
  spinning = true;
  spinBtn.disabled = true;
  setStatus("🎡 Spinning…");

  // Pick a random winner index BEFORE spinning
  const winnerIndex = secureRandomInt(participants.length);

  const n    = participants.length;
  const arc  = (Math.PI * 2) / n;

  // We want the wheel to stop so that winnerIndex segment is under the pointer (top, 270° = -π/2)
  // The pointer sits at angle -π/2 from the canvas origin (top of wheel).
  // A segment i occupies [currentAngle + i*arc, currentAngle + (i+1)*arc].
  // We want the midpoint of that segment to land at -π/2.
  // Desired final rotation: finalAngle such that
  //   finalAngle + winnerIndex*arc + arc/2 ≡ -π/2  (mod 2π)

  const desiredMid   = -Math.PI / 2;
  const targetAngle  = desiredMid - (winnerIndex * arc + arc / 2);
  // Add several full rotations for drama
  const fullSpins    = 5 + secureRandomInt(4); // 5–8 full spins
  const totalRotation= fullSpins * Math.PI * 2 + (targetAngle - (currentAngle % (Math.PI * 2)));

  const startAngle = currentAngle;
  const endAngle   = startAngle + totalRotation;
  const duration   = 4000 + secureRandom() * 1500; // 4–5.5 s

  let startTime = null;

  function easeOut(t) {
    // Cubic ease-out
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const t = Math.min(elapsed / duration, 1);
    currentAngle = startAngle + totalRotation * easeOut(t);

    drawWheel(t === 1 ? winnerIndex : -1);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      currentAngle = endAngle;
      spinning = false;
      onSpinEnd(winnerIndex);
    }
  }

  requestAnimationFrame(frame);
}

async function onSpinEnd(winnerIndex) {
  const winner = participants[winnerIndex];
  setStatus(`🏆 Winner: @${winner}!`);

  // Save winner
  try {
    winners = await apiAddWinner(winner);
  } catch {
    if (!winners.includes(winner)) winners.push(winner);
  }

  // Remove from participants
  try {
    participants = await apiRemoveParticipant(winner);
  } catch {
    participants = participants.filter(p => p !== winner);
  }

  renderParticipantList();
  renderWinnerList();
  drawWheel();
  showWinnerModal(winner);
}

// ─── Winner modal ─────────────────────────────────────────────────────────────
function showWinnerModal(username) {
  winnerAvatar.src = `https://github.com/${encodeURIComponent(username)}.png?size=200`;
  winnerAvatar.alt = username;
  winnerUsername.textContent = `@${username}`;
  winnerModal.classList.remove("hidden");
  launchConfetti();
}

function dismissModal() {
  winnerModal.classList.add("hidden");
  clearConfetti();
  updateSpinBtn();
  if (participants.length < 2) {
    setStatus(participants.length === 1
      ? "Only 1 participant left — add more to spin again."
      : "All participants have won! 🎉");
  } else {
    setStatus(`${participants.length} participants remaining.`);
  }
}

nextSpinBtn.addEventListener("click", dismissModal);
closeModalBtn.addEventListener("click", dismissModal);

// ─── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ["#238636","#58a6ff","#a371f7","#ffa657","#f78166","#56d364","#ffca4e"];
let confettiPieces = [];

function launchConfetti() {
  confettiArea.innerHTML = "";
  confettiPieces = [];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    const size   = 6 + secureRandom() * 8;
    const left   = secureRandom() * 100;
    const delay  = secureRandom() * 1.2;
    const dur    = 1.8 + secureRandom() * 1.5;
    const color  = CONFETTI_COLORS[secureRandomInt(CONFETTI_COLORS.length)];
    const isRect = secureRandom() > 0.5;
    el.style.cssText = `
      left: ${left}%;
      top: -12px;
      width: ${isRect ? size : size / 2}px;
      height: ${isRect ? size * 0.6 : size}px;
      background: ${color};
      border-radius: ${isRect ? "2px" : "50%"};
      animation-delay: ${delay}s;
      animation-duration: ${dur}s;
    `;
    confettiArea.appendChild(el);
    confettiPieces.push(el);
  }
}

function clearConfetti() {
  confettiArea.innerHTML = "";
  confettiPieces = [];
}

// ─── Export winners ───────────────────────────────────────────────────────────
exportBtn.addEventListener("click", async () => {
  try {
    const latest = await fetchWinners();
    winners = latest;
  } catch { /* use cached */ }
  const blob = new Blob([JSON.stringify(winners, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "winners.json";
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Tiny style injection for empty hints ─────────────────────────────────────
(function injectMiscStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .empty-hint {
      color: var(--text-dim, #8b949e);
      font-size: 12px;
      padding: 8px 4px;
      text-align: center;
    }
  `;
  document.head.appendChild(style);
})();
