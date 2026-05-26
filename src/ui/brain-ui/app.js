import { renderBrainUiApp } from "./app-shell.js";
import { API } from "./api-client.js";
import { bootstrapACUI } from "./acui/bootstrap.js";
import { initChat, friendlyChannelLabel } from "./chat.js";
import { initPanelCollapse } from "./panel-collapse.js";
import { ThoughtStream } from "./thought-stream.js";
import { initVoicePanel } from "./voice-panel.js";
import { emitVoiceEvent, VOICE_EVENT_TYPES } from "../../voice/voice-events.js";
import { initHotspot, toggleHotspot, setHotspotMode, moveVoicePanelToBody, restoreVoicePanel } from "./hotspot.js";
import { enrichVisiblePersonCardFromText, initPersonCard, setPersonCardMode, showPersonCardByName } from "./person-card.js";
import { initDocPanel, setDocPanelMode } from "./doc.js";
import { initWechatPopup, showWechatPopup } from "./wechat-popup.js";
renderBrainUiApp(document.body);
const THEME_KEY = "jarvis-brain-ui-theme";
const PHYSICS_STORAGE_KEY = "jarvis-brain-ui-physics";
const ACTIVATION_WARMUP_KEY = "bailongma_activation_warmup_until";
const UI_ZOOM_STORAGE_KEY = "bailongma_ui_zoom_factor";
const MAX_CHAT_HISTORY = 60;
const DEFAULT_AGENT_NAME = "小白龙";
const DEFAULT_UI_ZOOM = 1.1;
const MIN_UI_ZOOM = 0.8;
const MAX_UI_ZOOM = 1.8;
const UI_ZOOM_STEP = 0.1;
const UI_ZOOM_WHEEL_STEP = 0.05;
const MEMORY_GRAPH_STORAGE_KEY = "bailongma-memory-graph-enabled";
const MEMORY_GRAPH_ENABLED = localStorage.getItem(MEMORY_GRAPH_STORAGE_KEY) !== "false";

const themeSwitcher = document.getElementById("theme-switcher");
const resetViewBtn = document.getElementById("reset-view-btn");
const physicsControl = document.getElementById("physics-control");
const physicsToggle = document.getElementById("physics-toggle");
const gravitySlider = document.getElementById("gravity-slider");
const repulsionSlider = document.getElementById("repulsion-slider");
const nodeSizeSlider = document.getElementById("node-size-slider");
const gravityValue = document.getElementById("gravity-value");
const repulsionValue = document.getElementById("repulsion-value");
const nodeSizeValue = document.getElementById("node-size-value");
const brandNameEl = document.getElementById("agent-brand-name");
const graphEl = document.getElementById("graph");
const focusBlockEl = document.getElementById("focus-block");
const focusStackEl = document.getElementById("focus-stack");
const focusDepthEl = document.getElementById("focus-depth");

const IGNORED_VERSION_KEY = "bailongma_ignored_update_version";
const SUPPRESS_UPDATES_KEY = "bailongma_suppress_update_notifications";

let agentName = DEFAULT_AGENT_NAME;
let currentUiZoom = DEFAULT_UI_ZOOM;
let chat = null;

function addMsg(...args) { return chat?.addMsg(...args); }
function openChat(...args) { return chat?.openChat(...args); }
function updateLastJarvisMsg(...args) { return chat?.updateLastJarvisMsg(...args); }
function isTyping() { return chat?.isTyping() || false; }

function defaultInputPlaceholder() {
  return `向 ${agentName} 发消息…`;
}

function clampZoomFactor(factor) {
  return Math.min(MAX_UI_ZOOM, Math.max(MIN_UI_ZOOM, Number(factor) || DEFAULT_UI_ZOOM));
}

function saveUiZoom(factor) {
  try {
    localStorage.setItem(UI_ZOOM_STORAGE_KEY, String(factor));
  } catch {}
}

function loadSavedUiZoom() {
  try {
    const raw = Number(localStorage.getItem(UI_ZOOM_STORAGE_KEY));
    if (Number.isFinite(raw)) return clampZoomFactor(raw);
  } catch {}
  return DEFAULT_UI_ZOOM;
}

function applyUiZoom(factor, { persist = true } = {}) {
  const nextZoom = clampZoomFactor(factor);
  currentUiZoom = nextZoom;

  const bridge = window.bailongma;
  if (bridge?.isElectron && typeof bridge.setZoomFactor === "function") {
    bridge.setZoomFactor(nextZoom);
  } else {
    document.documentElement.style.zoom = String(nextZoom);
  }

  if (persist) saveUiZoom(nextZoom);
}

function stepUiZoom(delta) {
  const nextZoom = Math.round((currentUiZoom + delta) * 100) / 100;
  applyUiZoom(nextZoom);
}

function initUiZoom() {
  const bridge = window.bailongma;
  const initialZoom = loadSavedUiZoom();

  if (!bridge?.isElectron) {
    applyUiZoom(initialZoom, { persist: false });
  } else {
    try {
      const bridgeZoom = bridge.getZoomFactor?.();
      if (typeof bridgeZoom === "number" && Number.isFinite(bridgeZoom)) {
        currentUiZoom = clampZoomFactor(bridgeZoom);
      }
    } catch {}
    applyUiZoom(initialZoom, { persist: false });
  }

  window.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    stepUiZoom(event.deltaY < 0 ? UI_ZOOM_WHEEL_STEP : -UI_ZOOM_WHEEL_STEP);
  }, { passive: false, capture: true });

  window.addEventListener("keydown", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;

    const key = event.key;
    if (key === "+" || key === "=" || key === "Add") {
      event.preventDefault();
      stepUiZoom(UI_ZOOM_STEP);
      return;
    }

    if (key === "-" || key === "_" || key === "Subtract") {
      event.preventDefault();
      stepUiZoom(-UI_ZOOM_STEP);
      return;
    }

    if (key === "0") {
      event.preventDefault();
      applyUiZoom(DEFAULT_UI_ZOOM);
    }
  });
}

function setAgentName(nextName) {
  const normalized = String(nextName || "").trim() || DEFAULT_AGENT_NAME;
  agentName = normalized;
  document.title = `${normalized} · Cognitive Surface`;
  if (brandNameEl) brandNameEl.textContent = `${normalized} AI Agent`;
  if (graphEl) graphEl.setAttribute("aria-label", `${normalized} memory graph`);
  const input = document.getElementById("msg-input");
  if (input && !chat?.isComposerLocked?.()) input.placeholder = defaultInputPlaceholder();
  document.querySelectorAll(".msg-jarvis .msg-label").forEach((el) => {
    el.textContent = normalized;
  });
}

async function loadAgentProfile() {
  try {
    const res = await fetch(`${API}/agent-profile`);
    if (!res.ok) return;
    const data = await res.json();
    setAgentName(data.name);
  } catch {}
}

const physicsSettings = {
  gravity: 1,
  repulsion: 1.35,
  nodeSize: 1,
};

requestAnimationFrame(() => {
  themeSwitcher.classList.add("visible");
  resetViewBtn.classList.add("visible");
  physicsControl.classList.add("visible");
});

function readCSSVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function readPhysicsSettings() {
  try {
    const raw = localStorage.getItem(PHYSICS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.gravity === "number") physicsSettings.gravity = parsed.gravity;
      if (typeof parsed.repulsion === "number") physicsSettings.repulsion = parsed.repulsion;
      if (typeof parsed.nodeSize === "number") physicsSettings.nodeSize = parsed.nodeSize;
    }
  } catch {}
}

function savePhysicsSettings() {
  try {
    localStorage.setItem(PHYSICS_STORAGE_KEY, JSON.stringify(physicsSettings));
  } catch {}
}

function updatePhysicsReadout() {
  gravitySlider.value = String(physicsSettings.gravity);
  repulsionSlider.value = String(physicsSettings.repulsion);
  nodeSizeSlider.value = String(physicsSettings.nodeSize);
  gravityValue.textContent = `${physicsSettings.gravity.toFixed(2)}x`;
  repulsionValue.textContent = `${physicsSettings.repulsion.toFixed(2)}x`;
  nodeSizeValue.textContent = `${physicsSettings.nodeSize.toFixed(2)}x`;
}

let themeColors = {};
function refreshThemeColors() {
  themeColors = {
    cool: readCSSVar("--cool"),
    warm: readCSSVar("--warm"),
    nodeLow: readCSSVar("--node-low"),
    nodeHigh: readCSSVar("--node-high"),
    dim: readCSSVar("--dim"),
    ink2: readCSSVar("--ink2"),
    linkStroke: readCSSVar("--link-stroke"),
    bg0: readCSSVar("--bg0"),
  };
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  document.querySelectorAll(".theme-dot").forEach(el => {
    el.classList.toggle("active", el.dataset.t === theme);
  });
  setTimeout(() => {
    refreshThemeColors();
    renderLegend();
    if (MEMORY_GRAPH_ENABLED && nodeSel && !nodeSel.empty()) {
      refreshNodeVisuals();
      linkSel.attr("stroke", themeColors.linkStroke);
    }
  }, 20);
}

(function initTheme() {
  let saved = "midnight";
  try { saved = localStorage.getItem(THEME_KEY) || "midnight"; } catch {}
  applyTheme(saved);
})();

themeSwitcher.querySelectorAll(".theme-dot").forEach(el => {
  el.addEventListener("click", () => applyTheme(el.dataset.t));
});

physicsToggle.addEventListener("click", () => {
  const nextOpen = !physicsControl.classList.contains("open");
  physicsControl.classList.toggle("open", nextOpen);
  physicsToggle.setAttribute("aria-expanded", String(nextOpen));
});

gravitySlider.addEventListener("input", () => {
  physicsSettings.gravity = Number(gravitySlider.value);
  applyPhysicsSettings();
});

repulsionSlider.addEventListener("input", () => {
  physicsSettings.repulsion = Number(repulsionSlider.value);
  applyPhysicsSettings();
});

nodeSizeSlider.addEventListener("input", () => {
  physicsSettings.nodeSize = Number(nodeSizeSlider.value);
  applyPhysicsSettings();
});

let W = window.innerWidth;
let H = window.innerHeight;

const svg = d3.select("#graph").attr("width", W).attr("height", H);
const tip = d3.select("#tip");

const defs = svg.append("defs");
defs.html(`
  <filter id="neb-glow" x="-70%" y="-70%" width="240%" height="240%">
    <feGaussianBlur stdDeviation="3.2" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
`);

const world = svg.append("g");
const gLink = world.append("g").attr("stroke-linecap", "round");
const gNode = world.append("g");

const zoom = d3.zoom()
  .scaleExtent([0.1, 5])
  .filter(event => event.type === "wheel")
  .on("zoom", event => world.attr("transform", event.transform));

svg.call(zoom);
svg.on("wheel.zoom", null);
svg.on("dblclick.zoom", null);

svg.node().addEventListener("wheel", event => {
  event.preventDefault();
  const current = d3.zoomTransform(svg.node());
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  const nextScale = Math.max(0.1, Math.min(5, current.k * factor));
  const k = nextScale / current.k;
  const px = W / 2, py = H / 2;
  const nextX = px - (px - current.x) * k;
  const nextY = py - (py - current.y) * k;
  svg.call(zoom.transform, d3.zoomIdentity.translate(nextX, nextY).scale(nextScale));
}, { passive: false });

function resetZoom() {
  svg.transition().duration(420).call(
    zoom.transform,
    d3.zoomIdentity
  );
}

const glowSet = new Map();
const usePulseSet = new Map();
let linkData = [];
let nodeData = [];
let linkSel = gLink.selectAll("line");
let nodeSel = gNode.selectAll("circle");

const nodeCountEl = document.getElementById("node-count");
const linkCountEl = document.getElementById("link-count");
const connStateEl = document.getElementById("conn-state");

function updateStats() {
  nodeCountEl.textContent = String(nodeData.length);
  linkCountEl.textContent = String(linkData.length);
}

function setConnectionState(text, live = true) {
  connStateEl.innerHTML = live
    ? `<span class="live-dot"></span>${text}`
    : text;
  connStateEl.classList.toggle("live", live);
}

function isGlowing(nid) {
  const expiry = glowSet.get(nid);
  if (!expiry) return false;
  if (Date.now() > expiry) { glowSet.delete(nid); return false; }
  return true;
}

function highlightNodes(nids, duration = 2400) {
  if (!MEMORY_GRAPH_ENABLED || !sim) return;
  if (!nids || !nids.length) return;
  const now = Date.now();
  const expiry = now + duration;
  nids.forEach(nid => {
    const key = String(nid);
    glowSet.set(key, expiry);
    usePulseSet.set(key, { start: now, end: expiry });
  });
  refreshNodeVisuals();
  sim.alpha(Math.max(sim.alpha(), 2)).restart();
  setTimeout(() => {
    nids.forEach(nid => {
      const key = String(nid);
      glowSet.delete(key);
      usePulseSet.delete(key);
    });
    refreshNodeVisuals();
  }, duration + 80);
}

function nodeUseProgress(nid) {
  const key = String(nid);
  const pulse = usePulseSet.get(key);
  if (!pulse) return 0;
  const now = Date.now();
  if (now >= pulse.end) {
    usePulseSet.delete(key);
    return 0;
  }
  const total = Math.max(1, pulse.end - pulse.start);
  return 1 - ((now - pulse.start) / total);
}

function nodeStrength(d) {
  if (typeof d._strength !== "number") {
    const deg = Math.min(1, (d._deg || 0) / 12);
    d._strength = 0.35 + deg * 0.55;
  }
  return d._strength;
}

function nodeColor(d) {
  if (d._core) return themeColors.warm || "#d39872";
  const age = (Date.now() - (d._ts || Date.now())) / 18000;
  const fade = Math.max(0.25, 1 - age);
  const t = 0.18 + nodeStrength(d) * 0.5 * fade;
  const interp = d3.interpolateRgb(themeColors.nodeLow || "#3a556e", themeColors.nodeHigh || "#cfe3f5");
  let color = interp(Math.min(1, t));
  const base = d3.color(color);
  if (base) color = base.darker(0.55) + "";
  const useBoost = nodeUseProgress(d._nid);
  if (isGlowing(d._nid) || useBoost > 0) {
    const c = d3.color(color);
    if (c) return c.brighter(2 + useBoost * 2) + "";
  }
  return color;
}

function nodeRadius(d) {
  const base = d._core ? 9 : 3.4 + Math.min((d._deg || 0) * 0.9, 5.4);
  const childScale = 1 + Math.min(1.5, (d._childCount || 0) * 0.18);
  const useBoost = nodeUseProgress(d._nid);
  const glowScale = isGlowing(d._nid) ? 1.08 : 1;
  const pulseScale = 1 + (Math.sin((1 - useBoost) * Math.PI * 3) * 0.04 + useBoost * 0.12);
  const scaledBase = base * physicsSettings.nodeSize;
  return Math.min(scaledBase * 2.5, scaledBase * childScale * glowScale * Math.max(1, pulseScale));
}

const sim = MEMORY_GRAPH_ENABLED
  ? d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d._nid))
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(W / 2, H / 2 - 10))
    .force("x", d3.forceX(W / 2))
    .force("y", d3.forceY(H / 2 - 10))
    .force("radial", d3.forceRadial(180, W / 2, H / 2 - 10))
    .force("collision", d3.forceCollide())
    .alphaDecay(0.028)
    .velocityDecay(0.3)
    .on("tick", tick)
  : null;

function linkDistance(link) {
  const countFactor = Math.min(34, Math.sqrt(Math.max(1, nodeData.length)) * 4.2);
  if (link._kind === "visual_parent") return 82 + countFactor * 0.45;
  if (link._kind === "visual_random") return 108 + countFactor;
  return 76 + countFactor * 0.55;
}

function linkStrength(link) {
  if (link._kind === "visual_parent") return 0.2;
  if (link._kind === "visual_random") return 0.035;
  return 0.16;
}

function chargeStrength(node) {
  const countBoost = Math.min(76, Math.sqrt(Math.max(1, nodeData.length)) * 3.5);
  const baseCharge = -92 - countBoost * 0.4 - (node._deg || 0) * 2.4 - (node._childCount || 0) * 1.2;
  return baseCharge * physicsSettings.repulsion;
}

function radialStrength() {
  const baseSpread = nodeData.length > 36 ? 0.1 : 0.1;
  return baseSpread * physicsSettings.gravity;
}

function centerPullStrength() {
  const basePull = nodeData.length > 36 ? 0.04 : 0.055;
  return basePull * physicsSettings.gravity;
}

function collisionRadius(node) {
  const countPadding = nodeData.length > 36 ? 6 : 4;
  return nodeRadius(node) + countPadding;
}

function updateSimulationForces() {
  if (!MEMORY_GRAPH_ENABLED || !sim) return;
  sim.force("link")
    .distance(linkDistance)
    .strength(linkStrength);

  sim.force("charge")
    .strength(chargeStrength);

  sim.force("x")
    .x(W / 2)
    .strength(centerPullStrength());

  sim.force("y")
    .y(H / 2 - 10)
    .strength(centerPullStrength());

  sim.force("radial")
    .radius(Math.min(Math.max(24, Math.sqrt(Math.max(1, nodeData.length)) * 6), 64))
    .x(W / 2)
    .y(H / 2 - 10)
    .strength(radialStrength());

  sim.force("collision")
    .radius(collisionRadius)
    .strength(0.82)
    .iterations(nodeData.length > 40 ? 2 : 1);
}

function applyPhysicsSettings(restartAlpha = 2) {
  updatePhysicsReadout();
  if (!MEMORY_GRAPH_ENABLED || !sim) {
    savePhysicsSettings();
    return;
  }
  updateSimulationForces();
  refreshNodeVisuals();
  sim.alpha(Math.max(sim.alpha(), restartAlpha)).restart();
  savePhysicsSettings();
}

function refreshNodeVisuals() {
  if (!MEMORY_GRAPH_ENABLED) return;
  if (!nodeSel || nodeSel.empty()) return;
  nodeSel
    .attr("r", nodeRadius)
    .attr("fill", nodeColor)
    .attr("filter", d => (d._core || isGlowing(d._nid) || nodeUseProgress(d._nid) > 0) ? "url(#neb-glow)" : null)
    .style("animation", d => nodeUseProgress(d._nid) > 0 ? "neb-node-use 10s ease-out" : null);
}

function dampTangentialMotion() {
  if (!MEMORY_GRAPH_ENABLED || !sim) return;
  const cx = W / 2;
  const cy = H / 2 - 10;
  const twitching = sim.alpha() > 0.45;

  nodeData.forEach(node => {
    if (!node || node.fx != null || node.fy != null) return;

    const dx = (node.x ?? cx) - cx;
    const dy = (node.y ?? cy) - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;

    const rx = dx / dist;
    const ry = dy / dist;
    const tx = -ry;
    const ty = rx;
    const vx = node.vx || 0;
    const vy = node.vy || 0;
    const radialVelocity = vx * rx + vy * ry;
    const tangentialVelocity = vx * tx + vy * ty;
    const tangentialDamping = twitching ? 0.14 : 0.24;

    node.vx = radialVelocity * rx + tangentialVelocity * tangentialDamping * tx;
    node.vy = radialVelocity * ry + tangentialVelocity * tangentialDamping * ty;
  });
}

function naturalTwitch() {
  if (!MEMORY_GRAPH_ENABLED || !sim) return;
  if (nodeData.length < 2) {
    sim.alpha(1).restart();
    return;
  }

  const nodeById = new Map(nodeData.map(node => [String(node._nid), node]));
  const anchorMap = new Map();
  linkData.forEach(link => {
    if (link._kind !== "visual_parent" && link._kind !== "visual_random") return;
    const sourceId = typeof link.source === "object" ? String(link.source._nid) : String(link.source);
    const targetId = typeof link.target === "object" ? String(link.target._nid) : String(link.target);
    if (!anchorMap.has(sourceId) && nodeById.has(targetId)) {
      anchorMap.set(sourceId, nodeById.get(targetId));
    }
  });

  const twitchCount = Math.max(6, Math.floor(nodeData.length * 0.3));
  const candidates = shuffleArray(nodeData.filter(node => !node._core)).slice(0, twitchCount);

  candidates.forEach(node => {
    const anchor = anchorMap.get(String(node._nid)) || nodeData[deterministicIndex(node._nid, nodeData.length)];
    if (!anchor) return;

    const anchorX = anchor.x ?? (W / 2);
    const anchorY = anchor.y ?? (H / 2 - 10);
    const angle = Math.random() * Math.PI * 2;
    const offset = 36 + Math.random() * 52;
    const nextX = anchorX + Math.cos(angle) * offset;
    const nextY = anchorY + Math.sin(angle) * offset;
    const currentX = node.x ?? nextX;
    const currentY = node.y ?? nextY;

    node.x = currentX * 0.7 + nextX * 0.3;
    node.y = currentY * 0.7 + nextY * 0.3;
    node.vx = (node.vx || 0) + (nextX - currentX) * 0.14;
    node.vy = (node.vy || 0) + (nextY - currentY) * 0.14;
  });

  sim.alpha(0.85).restart();
}

function tick() {
  if (!MEMORY_GRAPH_ENABLED) return;
  dampTangentialMotion();

  linkSel
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  nodeSel
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);
}

function computeDegrees() {
  const nodeById = new Map(nodeData.map(n => [n._nid, n]));
  nodeData.forEach(n => {
    n._deg = 0;
    n._childCount = 0;
  });
  linkData.forEach(l => {
    const s = typeof l.source === "object" ? l.source : nodeById.get(String(l.source));
    const t = typeof l.target === "object" ? l.target : nodeById.get(String(l.target));
    if (s) s._deg = (s._deg || 0) + 1;
    if (t) t._deg = (t._deg || 0) + 1;
  });

  nodeData.forEach(node => {
    const childTargets = semanticChildTargets(node);
    if (childTargets.size) {
      node._childCount = childTargets.size;
      return;
    }

    const selfId = String(node._nid || "");
    node._childCount = nodeData.reduce((count, candidate) => (
      candidate.parent_id != null && String(candidate.parent_id) === selfId ? count + 1 : count
    ), 0);
  });
}

function showTip(event, d) {
  const label = d.title || (d.content || "").slice(0, 120) || d._nid;
  const type = d._core ? "self" : (d.event_type || "memory");
  tip
    .style("display", "block")
    .style("left", `${event.clientX + 14}px`)
    .style("top", `${event.clientY + 12}px`)
    .html(`<span class="tip-type">${type}</span><div>${label}</div>`);
}

function parseEntities(raw) {
  try {
    const p = typeof raw === "string" ? JSON.parse(raw || "[]") : (raw || []);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

function parseLinks(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw || "[]") : (raw || []);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function semanticChildTargets(node) {
  const targets = new Set();
  parseLinks(node.links).forEach(link => {
    if (!link || typeof link !== "object") return;
    const relation = String(link.relation || "").toLowerCase();
    const targetId = String(link.target_id || link.targetId || "").trim();
    if (relation === "parent_of" && targetId) targets.add(targetId);
  });
  return targets;
}

function markCore() {
  nodeData.forEach(n => { n._core = false; });
  const core = nodeData.find(n => parseEntities(n.entities).includes("agent:jarvis"))
    || nodeData[0];
  if (core) core._core = true;
}

function renderLegend() {
  const el = document.getElementById("legend");
  if (!el) return;
  const total = nodeData.length;
  const active = nodeData.filter(n => (Date.now() - (n._ts || 0)) < 15000).length;
  const known = Math.max(0, total - active - 1);
  const decayed = nodeData.filter(n => (Date.now() - (n._ts || 0)) > 60000).length;

  const items = [
    { name: "Constraint", count: 1, color: themeColors.warm },
    { name: "Memory", count: total, color: themeColors.nodeHigh },
    { name: "Knowledge", count: known, color: themeColors.cool },
    { name: "Decayed", count: decayed, color: themeColors.dim },
  ];

  el.innerHTML = items.map(i =>
    `<div class="legend-item">
      <span class="legend-dot" style="background:${i.color}"></span>
      <span class="legend-name">${i.name}</span>
      <span class="legend-count">${i.count}</span>
    </div>`
  ).join("");
}

function renderGraph(restartAlpha = 2) {
  if (!MEMORY_GRAPH_ENABLED || !sim) {
    updateStats();
    renderLegend();
    return;
  }
  computeDegrees();
  markCore();
  updateStats();
  renderLegend();

  linkSel = linkSel.data(linkData, d => d._lid);
  linkSel.exit().remove();
  linkSel = linkSel.enter().append("line")
    .attr("stroke", themeColors.linkStroke || "rgba(143,182,216,0.18)")
    .attr("stroke-width", 0.6)
    .merge(linkSel);

  nodeSel = nodeSel.data(nodeData, d => d._nid);
  nodeSel.exit().transition().duration(280).attr("r", 0).remove();

  const enter = nodeSel.enter().append("circle")
    .attr("r", 0)
    .attr("fill", nodeColor)
    .style("cursor", "pointer")
    .call(d3.drag()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(2).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x; d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      }))
    .on("mouseover", showTip)
    .on("mousemove", event => {
      tip.style("left", `${event.clientX + 14}px`)
         .style("top", `${event.clientY + 12}px`);
    })
    .on("mouseout", () => tip.style("display", "none"))
    .on("click", (event, d) => {
      d._ts = Date.now();
      d._strength = Math.min(1, (d._strength || 0.5) + 0.25);
      highlightNodes([d._nid], 900);
    });

  enter.transition().duration(360).attr("r", nodeRadius);
  nodeSel = enter.merge(nodeSel);

  sim.nodes(nodeData);
  sim.force("link").links(linkData);
  updateSimulationForces();
  sim.alpha(0.5).restart();
  refreshNodeVisuals();
}

function deterministicIndex(seed, mod) {
  let hash = 2166136261;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % mod;
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createVisualOrder(nodes) {
  const coreNode = nodes.find(n => n._core || parseEntities(n.entities).includes("agent:jarvis")) || null;
  const rest = shuffleArray(nodes.filter(n => !coreNode || n._nid !== coreNode._nid));
  return coreNode ? [coreNode, ...rest] : rest;
}

function chooseVisualParent(child, candidates, childCounts) {
  if (!candidates.length) return null;
  const weighted = [];
  candidates.forEach(candidate => {
    const currentChildren = childCounts.get(candidate._nid) || 0;
    const maxChildren = maxVisualChildren(candidate);
    const recencyBias = Math.max(0, 400000 - Math.abs((child._ts || 0) - (candidate._ts || 0))) / 100000;
    const coreBias = candidate._core ? 1.4 : 0;
    const strengthBias = (candidate._strength || 0.4) * 0.8;
    const remainingCapacity = Math.max(0, maxChildren - currentChildren);
    const capacityBias = currentChildren === 0 ? 1.2 : 0.35 + remainingCapacity * 0.25;
    const entryCount = 1 + Math.max(0, Math.round((recencyBias + coreBias + strengthBias + capacityBias) * 2));
    for (let w = 0; w < entryCount; w++) {
      weighted.push(candidate);
    }
  });
  if (!weighted.length) return candidates[Math.floor(Math.random() * candidates.length)] || null;
  return weighted[Math.floor(Math.random() * weighted.length)] || null;
}

function getCurrentVisualChildCounts(nodes) {
  const counts = new Map(nodes.map(n => [n._nid, 0]));
  linkData.forEach(link => {
    if (link._kind !== "visual_parent") return;
    const parentId = typeof link.target === "object" ? String(link.target._nid) : String(link.target);
    counts.set(parentId, (counts.get(parentId) || 0) + 1);
  });
  return counts;
}

function maxVisualChildren(node) {
  if (!node) return 2;
  if (node._core) return 4;
  const degree = node._deg || 0;
  const strength = node._strength || 0;
  return (degree >= 4 || strength >= 0.72) ? 4 : 2;
}

function addSupplementalVisualLinks(linkSet, childCounts) {
  const ordered = createVisualOrder(nodeData);
  const extraLinks = Math.min(18, Math.max(2, Math.floor(nodeData.length / 5)));
  let added = 0;

  for (let i = 1; i < ordered.length && added < extraLinks; i++) {
    const source = ordered[i];
    const candidates = shuffleArray(
      ordered.slice(0, i).filter(node => {
        if (node._nid === source._nid) return false;
        return (childCounts.get(node._nid) || 0) < maxVisualChildren(node);
      })
    );

    const target = candidates[0];
    if (!target) continue;

    const lid = `visual-extra:${source._nid}=>${target._nid}`;
    const rev = `visual-extra:${target._nid}=>${source._nid}`;
    const base = `visual:${source._nid}=>${target._nid}`;
    const baseRev = `visual:${target._nid}=>${source._nid}`;
    if (linkSet.has(lid) || linkSet.has(rev) || linkSet.has(base) || linkSet.has(baseRev)) continue;

    linkSet.add(lid);
    linkData.push({ source: source._nid, target: target._nid, _lid: lid, _kind: "visual_random" });
    childCounts.set(target._nid, (childCounts.get(target._nid) || 0) + 1);
    added += 1;
  }
}

function addRandomVisualLinks(linkSet) {
  if (nodeData.length < 2) return;

  const ordered = createVisualOrder(nodeData);
  const childCounts = new Map(ordered.map(n => [n._nid, 0]));

  for (let i = 1; i < ordered.length; i++) {
    const child = ordered[i];
    const candidates = ordered
      .slice(0, i)
      .filter(node => (childCounts.get(node._nid) || 0) < maxVisualChildren(node));

    const parent = chooseVisualParent(child, candidates, childCounts);
    if (!parent || parent._nid === child._nid) continue;

    const lid = `visual:${child._nid}=>${parent._nid}`;
    const rev = `visual:${parent._nid}=>${child._nid}`;
    if (linkSet.has(lid) || linkSet.has(rev)) continue;

    linkSet.add(lid);
    linkData.push({ source: child._nid, target: parent._nid, _lid: lid, _kind: "visual_parent" });
    childCounts.set(parent._nid, (childCounts.get(parent._nid) || 0) + 1);
  }

  addSupplementalVisualLinks(linkSet, childCounts);
}

function findAnchorNode(memory, nodeMap) {
  const nodes = Array.from(nodeMap.values());
  const childCounts = getCurrentVisualChildCounts(nodes);
  const candidates = createVisualOrder(nodes)
    .filter(node => (childCounts.get(node._nid) || 0) < maxVisualChildren(node));
  return chooseVisualParent(memory, candidates, childCounts)
    || nodeData.find(n => n._core)
    || nodeData[0]
    || null;
}

async function loadMemories() {
  if (!MEMORY_GRAPH_ENABLED) return;
  try {
    const rows = await fetch(`${API}/memories?limit=120`).then(r => r.json());
    if (!Array.isArray(rows)) return;

    const prevPositions = new Map(nodeData.map(n => [n._nid, {
      x: n.x, y: n.y, vx: n.vx, vy: n.vy, fx: n.fx, fy: n.fy,
    }]));

    nodeData = rows.map(row => {
      const nid = row.mem_id || String(row.id);
      const prev = prevPositions.get(nid);
      return {
        ...row,
        _nid: nid,
        _ts: prev ? Date.now() : Date.now() - Math.random() * 8000,
        x: prev ? prev.x : W / 2 + (Math.random() - 0.5) * 180,
        y: prev ? prev.y : H / 2 + (Math.random() - 0.5) * 180,
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0,
        fx: prev ? prev.fx : null,
        fy: prev ? prev.fy : null,
      };
    });

    const linkSet = new Set();
    linkData = [];
    addRandomVisualLinks(linkSet);

    renderGraph(1.1);
  } catch (error) {
    console.warn("[graph] load failed:", error.message);
    setConnectionState("未连接", false);
  }
}

function addNewNodes(memories) {
  if (!MEMORY_GRAPH_ENABLED) return;
  const nodeMap = new Map(nodeData.map(n => [n._nid, n]));
  const newNids = [];
  memories.forEach(memory => {
    const nid = memory.mem_id || memory.id;
    if (!nid || nodeMap.has(String(nid))) return;
    const anchor = findAnchorNode(memory, nodeMap);
    const anchorX = anchor?.x ?? W / 2;
    const anchorY = anchor?.y ?? (H / 2 - 10);
    const node = {
      ...memory,
      _nid: String(nid),
      mem_id: String(nid),
      event_type: memory.event_type || memory.type || "fact",
      _ts: Date.now(),
      _strength: 0.85,
      x: anchorX + (Math.random() - 0.5) * 72,
      y: anchorY + (Math.random() - 0.5) * 72,
      vx: 0, vy: 0,
    };
    nodeData.push(node);
    nodeMap.set(node._nid, node);
    newNids.push(node._nid);
  });
  if (!newNids.length) return;

  const linkSet = new Set();
  linkData = [];
  addRandomVisualLinks(linkSet);
  renderGraph(2);
  highlightNodes(newNids, 10000);
}

if (MEMORY_GRAPH_ENABLED) {
  setInterval(() => naturalTwitch(), 6000);
  setInterval(() => { nodeData.forEach(n => { if (n._strength) n._strength *= 0.97; }); }, 2500);
}

function parseUserMessageInput(raw) {
  const text = String(raw || "");
  const match = text.match(/^\[([^\]]+)\]\s+(\S+)\s+\[([^\]]+)\]\s+([\s\S]*)$/);
  if (!match) return { content: text.trim(), time: null };
  return { fromId: match[1], timestamp: match[2], channel: match[3], content: match[4].trim(), time: formatMsgTime(match[2]) };
}

function formatMsgTime(stamp) {
  if (!stamp) return null;
  const m = String(stamp).match(/T(\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}:${m[3]}`;
  const m2 = String(stamp).match(/(\d{2}):(\d{2}):(\d{2})/);
  if (m2) return `${m2[1]}:${m2[2]}:${m2[3]}`;
  return null;
}

const L1 = new ThoughtStream("si-l1", "cool", {
  readCSSVar,
  thinkingLabel: "思考中…",
  thinkingDoneLabel: "思考完成",
  toolDetailLength: 140,
});
const L2 = new ThoughtStream("si-l2", "warm", {
  readCSSVar,
  thinkingLabel: "思考中",
  thinkingDoneLabel: "思考完成",
  toolDetailLength: 220,
});

// L1 = processing flow triggered by user messages; L2 = processing flow triggered by TICK.
// stream_*/tool_call events emitted by the backend carry no path tag;
// routing to the correct panel is determined by the most recent message_received / tick event.
let currentPath = "l2";
function currentStream() { return currentPath === "l1" ? L1 : L2; }

function isBusyErrorMessage(message = "") {
  return /(429|rate limit|too many requests|busy|overload|temporarily unavailable|server busy|resource exhausted)/i.test(String(message || ""));
}

function formatRetryDelay(ms) {
  if (!ms || ms < 1000) return `${ms || 0}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

let tokenAccum = 0;
let tokenWindow = Date.now();
const tokRateEl = document.getElementById("tok-rate");

function bumpTokens(text) {
  tokenAccum += (text || "").length / 3.4;
  const now = Date.now();
  if (now - tokenWindow > 700) {
    const rate = tokenAccum / ((now - tokenWindow) / 1000);
    tokRateEl.textContent = rate.toFixed(1);
    tokenAccum = 0;
    tokenWindow = now;
    setTimeout(() => { if (tokRateEl.textContent !== "—" && tokenAccum === 0) tokRateEl.textContent = "—"; }, 4000);
  }
}

// ── 专注帧观察面板 (focus stack) ────────────────────────────────
// 设计文档 7.5：用户必须看得见 Agent 此刻在专注什么。
// 纯事件驱动：focus_frame → 全量重渲染；focus_compressed → 在栈顶尾部追加 conclusion 并淡入。

function escapeFocusText(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncateConclusion(text, max = 60) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + "…";
}

function renderFocusFrame(frame, { isTop }) {
  const conclusions = Array.isArray(frame?.conclusions) ? frame.conclusions : [];

  // 主行显示策略（progressive disclosure）：
  //   1. 有 conclusion → 显示最新一条（这是子帧 pop 时压缩出的 1-2 句话结论）
  //   2. 无 conclusion 但有 topic → 显示 topic（v0 是 ngram，几百 ms 后被 LLM refine 成人类可读短语）
  //   3. 都没 → 返回空主行（上层 renderFocusStack 会进一步过滤）
  // 早期 conclusion 作为弱化辅助行（栈顶帧才显示，避免视觉过载）
  const latest = conclusions.length > 0 ? conclusions[conclusions.length - 1] : "";
  const earlier = conclusions.length > 1 ? conclusions.slice(0, -1) : [];
  const topicSummary = Array.isArray(frame?.topic) && frame.topic.length > 0
    ? frame.topic.slice(0, 3).join(" · ")
    : "";

  let mainHTML = "";
  if (latest) {
    mainHTML = `<div class="focus-frame-main">${escapeFocusText(truncateConclusion(latest, isTop ? 120 : 80))}</div>`;
  } else if (topicSummary) {
    mainHTML = `<div class="focus-frame-main focus-frame-main-fallback">${escapeFocusText(truncateConclusion(topicSummary, isTop ? 60 : 40))}</div>`;
  }

  const earlierHTML = earlier.map((c) =>
    `<div class="focus-frame-conclusion focus-frame-conclusion-earlier">${escapeFocusText(truncateConclusion(c, isTop ? 100 : 60))}</div>`
  ).join("");

  // 该帧既无 conclusion 也无 topic（极短暂的"刚 push 还没赋 topic"状态），不渲染外层壳
  if (!mainHTML && !earlierHTML) return "";

  return (
    `<div class="focus-frame${isTop ? " top" : ""}">` +
      mainHTML +
      earlierHTML +
    `</div>`
  );
}

function renderFocusStack(stack) {
  if (!focusStackEl || !focusBlockEl) return;
  const list = Array.isArray(stack) ? stack : [];
  if (focusDepthEl) focusDepthEl.textContent = String(list.length);

  if (list.length === 0) {
    focusBlockEl.dataset.state = "empty";
    focusStackEl.innerHTML = `<div class="focus-empty">无专注</div>`;
    return;
  }

  focusBlockEl.dataset.state = "active";
  // 渲染策略：只渲染"有 conclusion 的帧 + 栈顶帧"。
  // 非栈顶 + 无 conclusion 的帧静默隐藏——这种帧是"已 push 但还没 pop"的活帧，
  // conclusion 永远空着，渲染出来只是占位文字（"…"），堆叠多了视觉很噪。
  // depth 数字仍然显示真实栈深度，让用户知道还有未压缩的帧挂着。
  // 栈底 → 栈顶；视觉上栈顶在最下（最近一次最强），跟终端 / 思考流方向一致。
  const html = list.map((frame, i) => {
    const isTop = i === list.length - 1;
    const hasConclusion = Array.isArray(frame?.conclusions) && frame.conclusions.length > 0;
    if (!isTop && !hasConclusion) return "";
    return renderFocusFrame(frame, { isTop });
  }).filter(Boolean).join("");
  focusStackEl.innerHTML = html;
}

function flashFocusCompressed() {
  if (!focusBlockEl) return;
  // 让栈顶帧的主行（最新 conclusion）走淡入动画；同时整块做一次柔和高光。
  focusBlockEl.classList.remove("focus-compress-pulse");
  // 强制 reflow 让动画重启
  void focusBlockEl.offsetWidth;
  focusBlockEl.classList.add("focus-compress-pulse");

  const topFrame = focusStackEl?.querySelector(".focus-frame.top");
  const mainEl = topFrame?.querySelector(".focus-frame-main");
  if (mainEl) {
    mainEl.classList.remove("just-added");
    void mainEl.offsetWidth;
    mainEl.classList.add("just-added");
  }
}

function connectSSE() {
  setConnectionState("连接中", true);
  const es = new EventSource(`${API}/events`);

  es.onopen = () => setConnectionState("已连接", true);

  es.onmessage = event => {
    try { handle(JSON.parse(event.data)); } catch (_) {}
  };

  es.onerror = () => {
    setConnectionState("重连中", false);
    es.close();
    setTimeout(connectSSE, 3000);
  };
}

function extractNids(memList) {
  return (memList || [])
    .map(m => m.mem_id || (m.id != null ? String(m.id) : null))
    .filter(Boolean);
}

function handle({ type, data = {} }) {
  switch (type) {
    case "message_received": {
      currentPath = "l1";
      L1.beginRound();
      const parsed = parseUserMessageInput(data.input);
      L1.newLine("user message received", {
        content: parsed.content,
        time: parsed.time || undefined,
      });
      // Immediately show a "thinking" indicator so the gap between message_received
      // and the first stream_start (injector + LLM TTFT, often 3–30s) doesn't look frozen.
      L1.startThinkingSession();
      break;
    }
    case "tick":
      currentPath = "l2";
      L2.beginRound();
      L2.newLine("heartbeat tick");
      L2.startThinkingSession();
      break;
    case "stream_start":
      currentStream().startThinkingSession();
      break;
    case "stream_chunk":
      // No longer rendering thought content — only drives the token-rate indicator
      currentStream().clearStatus();
      bumpTokens(data.text);
      break;
    case "stream_end":
      currentStream().stopThinking();
      break;
    case "tool_preparing": {
      // 思考动画已停，但工具尚未真正执行 —— 给一个占位状态避免 UI 死寂
      const stream = currentStream();
      const label = data.name ? stream.toolLabel(data.name) : "";
      stream.setStatus(label ? `准备调用 ${label}…` : "准备工具调用…", "busy");
      break;
    }
    case "tool_executing": {
      const stream = currentStream();
      const label = data.name ? stream.toolLabel(data.name) : "工具";
      stream.setStatus(`正在执行 ${label}…`, "busy");
      break;
    }
    case "tool_call":
      currentStream().tool(data.name, data.args, data.result, data.ok);
      break;
    case "response":
      // Round complete — stop all animations
      currentStream().end();
      break;
    case "llm_retry": {
      currentStream().startThinkingSession();
      const nextAttempt = Number(data.nextAttempt || 2);
      const delayText = formatRetryDelay(Number(data.delayMs || 0));
      currentStream().setStatus("LLM 繁忙，第 " + nextAttempt + " 次重试将于 " + delayText + " 后开始", "busy");
      break;
    }
    case "message_requeued": {
      currentStream().startThinkingSession();
      const retryCount = Number(data.retryCount || 1);
      currentStream().setStatus("LLM 繁忙，已入队重试 " + retryCount + "/3", "busy");
      break;
    }
    case "message_dropped":
      currentStream().startThinkingSession();
      currentStream().setStatus("LLM 繁忙，重试次数已达上限", "failed");
      break;
    case "error":
      if (isBusyErrorMessage(data.error)) {
        currentStream().startThinkingSession();
        currentStream().setStatus("LLM 繁忙，请稍后重试", "busy");
      }
      break;
    case "injector_result": {
      const nids = [...extractNids(data.matchedMemories), ...extractNids(data.recallMemories)];
      if (nids.length) highlightNodes(nids, 10000);
      break;
    }
    case "focus_frame": {
      renderFocusStack(data.focusStack);
      break;
    }
    case "focus_compressed": {
      // 后端 emit 顺序：先 focus_frame（栈已 pop 完）→ 异步压缩完再 focus_compressed。
      // 触发时栈顶帧的 conclusions 数组在后端已被追加，但前端 DOM 里还是旧的。
      // 新布局：把新 conclusion 写入「主行」(.focus-frame-main)；
      // 若主行原本是 fallback（暂无沉淀结论），就把它升级为正常主行。
      // 若主行已有旧 conclusion，把旧值降级追加到「早期 conclusion」列表里，再覆盖主行。
      // 下一次 focus_frame 事件会带最新 conclusions 全量覆盖，所以即使错位也很快收敛。
      const topFrame = focusStackEl?.querySelector(".focus-frame.top");
      if (topFrame && data.conclusion) {
        const mainEl = topFrame.querySelector(".focus-frame-main");
        const newText = truncateConclusion(data.conclusion, 120);
        if (mainEl) {
          const wasFallback = mainEl.classList.contains("focus-frame-main-fallback");
          if (!wasFallback && mainEl.textContent) {
            const earlier = document.createElement("div");
            earlier.className = "focus-frame-conclusion focus-frame-conclusion-earlier";
            earlier.textContent = mainEl.textContent;
            topFrame.appendChild(earlier);
          }
          mainEl.classList.remove("focus-frame-main-fallback");
          mainEl.innerHTML = "";
          mainEl.textContent = newText;
        }
      }
      flashFocusCompressed();
      break;
    }
    case "memories_written":
      if (Array.isArray(data.memories) && data.memories.length) {
        addNewNodes(data.memories);
      }
      break;
    case "message":
      if (data.from === "consciousness") {
        lastJarvisContent = data.content;
        const viaLabel = friendlyChannelLabel(data.channel);
        const content = viaLabel ? `_→ ${viaLabel}_  \n${data.content}` : data.content;
        addMsg("jarvis", content);
        enrichVisiblePersonCardFromText(data.content, { source: 'assistant_message' });
        openChat(true);
      }
      break;
    case "message_in": {
      // 外部渠道判定：channel 非空且非本地，或 from_id 仍带外部前缀（兼容连接器直接 emit 的事件）
      const ch = String(data.channel || "").toUpperCase();
      const isExternal =
        (ch && ch !== "TUI" && ch !== "API" && ch !== "SYSTEM" && ch !== "REMINDER" && ch !== "APP_SIGNAL" && ch !== "VOICE" && ch !== "语音识别")
        || (data.from_id && /^(wechat|discord|feishu|wecom):/i.test(data.from_id));
      if (isExternal) {
        const label = friendlyChannelLabel(data.channel) || data.from_id || "External";
        addMsg("external", data.content, { label, alert: false });
        openChat(true);
      }
      break;
    }
    case "agent_name_updated":
      setAgentName(data.name);
      break;
    case "media_mode":
      window.dispatchEvent(new CustomEvent("bailongma:media", { detail: data }));
      break;
    case "hotspot_mode":
      setHotspotMode(!!data.active || data.action === "show" || data.action === "open", { source: "agent_event" });
      break;
    case "doc_panel_mode":
      setDocPanelMode(!!data.active || data.action === "open", { topicId: data.topic || null, source: "agent_event" });
      break;
    case "person_card_mode":
      setPersonCardMode(!!data.active || data.action === "show" || data.action === "open" || data.action === "update", { source: "agent_event", card: data.card || null });
      break;
    case "social_status":
      window.dispatchEvent(new CustomEvent("bailongma:social_status", { detail: data }));
      break;
    case "show_wechat_popup":
      showWechatPopup();
      break;
    case "audio_created":
      if (data.autoPlay && data.path) {
        const audioUrl = `${API}/${data.path}`;
        const audioEl = new Audio(audioUrl);
        audioEl.play().catch(() => {});
      }
      break;
    case "tts_reply":
      if (data.text) playTTSReply(data.text);
      break;
    case "key_configured":
      chat.deleteLastUserMsg();
      if (data.service === 'tts' && data.ttsText) playTTSReply(data.ttsText);
      break;
    case "startup_self_check_started":
      playJarvisStartupSound();
      setTimeout(() => playTTSReply("System starting, running self-check"), 1500);
      break;
    default:
      break;
  }
}

// ── Jarvis-style startup self-check sound ────────────────────────────────────
function playJarvisStartupSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;

    // Layer 1: low-frequency mechanical hum (sawtooth, simulates power-on)
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const droneFilter = ctx.createBiquadFilter();
    drone.type = "sawtooth";
    drone.frequency.setValueAtTime(50, t);
    drone.frequency.linearRampToValueAtTime(90, t + 0.5);
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 350;
    droneFilter.Q.value = 3;
    droneGain.gain.setValueAtTime(0, t);
    droneGain.gain.linearRampToValueAtTime(0.09, t + 0.06);
    droneGain.gain.linearRampToValueAtTime(0.06, t + 0.4);
    droneGain.gain.linearRampToValueAtTime(0, t + 0.65);
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(ctx.destination);
    drone.start(t);
    drone.stop(t + 0.7);

    // Layer 2: system-online frequency sweep (sine, low to high)
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = "sine";
    sweep.frequency.setValueAtTime(280, t + 0.12);
    sweep.frequency.exponentialRampToValueAtTime(2800, t + 1.0);
    sweepGain.gain.setValueAtTime(0, t + 0.12);
    sweepGain.gain.linearRampToValueAtTime(0.13, t + 0.22);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 1.05);
    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweep.start(t + 0.12);
    sweep.stop(t + 1.1);

    // Layer 3: three confirmation beeps (square wave, self-check passed)
    [[880, 1.15], [1100, 1.28], [1320, 1.41]].forEach(([freq, bt]) => {
      const beep = ctx.createOscillator();
      const beepGain = ctx.createGain();
      const beepFilter = ctx.createBiquadFilter();
      beep.type = "square";
      beep.frequency.value = freq;
      beepFilter.type = "bandpass";
      beepFilter.frequency.value = freq;
      beepFilter.Q.value = 8;
      beepGain.gain.setValueAtTime(0.14, t + bt);
      beepGain.gain.exponentialRampToValueAtTime(0.001, t + bt + 0.075);
      beep.connect(beepFilter);
      beepFilter.connect(beepGain);
      beepGain.connect(ctx.destination);
      beep.start(t + bt);
      beep.stop(t + bt + 0.09);
    });

    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch (_) {
    // silently ignore if browser does not support AudioContext
  }
}

// ── TTS reply playback ────────────────────────────────────────────────────────
let ttsAudioEl = null;
let ttsSessionId = null;
let ttsQueueGeneration = 0;
let ttsSegmentQueue = [];
let ttsPlayedSegments = [];
let ttsCurrentText = '';
let ttsInterruptedRemaining = '';
let lastJarvisContent = '';
let ttsInterruptedOriginalContent = '';
let ttsInterruptionApplied = false;
let ttsInterruptionDbTimer = null;

// Estimate spoken char count from audio progress, snapping to a sentence boundary
function calcRemainingText(text, currentTime, duration) {
  if (!text || !duration || duration <= 0) return { remaining: '', spokenUpTo: 0 };
  const progress = Math.min(1, currentTime / duration);
  const spokenChars = Math.floor(text.length * progress);
  const BOUNDARIES = /[。！？，.!?,\n]/g;
  let bestPos = spokenChars;
  let match;
  BOUNDARIES.lastIndex = Math.max(0, spokenChars - 10);
  while ((match = BOUNDARIES.exec(text)) !== null) {
    if (match.index >= spokenChars) {
      bestPos = match.index + 1;
      break;
    }
  }
  return { remaining: text.slice(bestPos).trim(), spokenUpTo: bestPos };
}

// Estimate cut position in original markdown based on spoken ratio in TTS plain text
function findMarkdownCutPos(markdown, ttsFullLen, ttsSpokenUpTo) {
  if (!markdown || ttsFullLen <= 0) return 0;
  const ratio = ttsSpokenUpTo / ttsFullLen;
  const approxPos = Math.floor(markdown.length * ratio);
  const BOUNDARIES = /[。！？\n.!?]/g;
  let bestPos = approxPos;
  BOUNDARIES.lastIndex = Math.max(0, approxPos - 15);
  let match;
  while ((match = BOUNDARIES.exec(markdown)) !== null) {
    if (match.index >= approxPos) { bestPos = match.index + 1; break; }
  }
  return bestPos;
}

// Apply interruption marker to chat UI; delay DB write so false triggers can be undone
function applyTTSInterruption(spokenUpTo) {
  const originalContent = lastJarvisContent || ttsCurrentText;
  if (!originalContent) return;
  ttsInterruptedOriginalContent = originalContent;
  ttsInterruptionApplied = true;

  const cutPos = findMarkdownCutPos(originalContent, ttsCurrentText.length, spokenUpTo);
  const spokenMarkdown = originalContent.slice(0, cutPos).trimEnd();
  const displayText = spokenMarkdown ? spokenMarkdown + ' ✋' : '✋';
  const dbContent = spokenMarkdown || '✋';

  updateLastJarvisMsg(displayText);

  if (ttsInterruptionDbTimer) clearTimeout(ttsInterruptionDbTimer);
  ttsInterruptionDbTimer = setTimeout(() => {
    ttsInterruptionDbTimer = null;
    fetch(`${API}/tts/interrupted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spokenContent: dbContent }),
    }).catch(() => {});
  }, 4000);
}

// Called by voice-panel interruption detection: stop current TTS and record cut point
window.stopTTS = () => {
  if (!ttsAudioEl && !ttsSessionId) return;
  emitVoiceEvent(VOICE_EVENT_TYPES.INTERRUPT, { source: "stopTTS", sessionId: ttsSessionId });
  const { remaining, spokenUpTo } = calcRemainingText(
    ttsCurrentText,
    ttsAudioEl?.currentTime || 0,
    ttsAudioEl?.duration || 0,
  );
  ttsInterruptedRemaining = remaining || ttsSegmentQueue.join('') || ttsCurrentText;
  applyTTSInterruption(spokenUpTo);
  ttsQueueGeneration += 1;
  if (ttsSessionId) {
    fetch(`${API}/tts/session/${encodeURIComponent(ttsSessionId)}/cancel`, { method: "POST" }).catch(() => {});
  }
  ttsSessionId = null;
  ttsSegmentQueue = [];
  if (ttsAudioEl) {
    ttsAudioEl.pause();
    try { URL.revokeObjectURL(ttsAudioEl.src); } catch {}
    ttsAudioEl = null;
  }
};

// Called by voice-panel on impact noise: duck TTS volume without stopping
window.duckTTS = () => {
  if (ttsAudioEl) ttsAudioEl.volume = 0.15;
};

// Called by voice-panel after confirming noise: restore original volume
window.unduckTTS = () => {
  if (ttsAudioEl) ttsAudioEl.volume = 1.0;
};

// Called by voice-panel on false-positive noise: resume TTS from interruption point and restore chat
window.resumeTTSIfNoSpeech = () => {
  const text = ttsInterruptedRemaining;
  ttsInterruptedRemaining = '';
  if (!text) return;
  // Cancel the pending DB write and restore chat UI
  if (ttsInterruptionDbTimer) { clearTimeout(ttsInterruptionDbTimer); ttsInterruptionDbTimer = null; }
  if (ttsInterruptionApplied && ttsInterruptedOriginalContent) {
    updateLastJarvisMsg(ttsInterruptedOriginalContent);
  }
  ttsInterruptionApplied = false;
  ttsInterruptedOriginalContent = '';
  playTTSReply(text);
};

async function playTTSReply(text) {
  ttsQueueGeneration += 1;
  const generation = ttsQueueGeneration;
  ttsCurrentText = text;
  ttsInterruptedRemaining = '';
  ttsInterruptionApplied = false;
  ttsInterruptedOriginalContent = '';
  ttsPlayedSegments = [];
  ttsSegmentQueue = [];
  if (ttsAudioEl) { try { ttsAudioEl.pause(); URL.revokeObjectURL(ttsAudioEl.src); } catch {} ttsAudioEl = null; }
  if (ttsSessionId) fetch(`${API}/tts/session/${encodeURIComponent(ttsSessionId)}/cancel`, { method: "POST" }).catch(() => {});

  try {
    const sessionResp = await fetch(`${API}/tts/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!sessionResp.ok) throw new Error(`HTTP ${sessionResp.status}`);
    const session = await sessionResp.json();
    if (!session.ok || !session.sessionId || !Array.isArray(session.segments)) throw new Error(session.error || "TTS session failed");
    if (generation !== ttsQueueGeneration) return;
    ttsSessionId = session.sessionId;
    ttsSegmentQueue = session.segments.slice();
    emitVoiceEvent(VOICE_EVENT_TYPES.TTS_START, { sessionId: ttsSessionId, segmentCount: ttsSegmentQueue.length });
    window.bailongmaVoice?.suspendForTTS?.();
    await playNextTTSSegment(generation, 0);
  } catch {
    ttsCurrentText = '';
    ttsSessionId = null;
    ttsSegmentQueue = [];
    window.bailongmaVoice?.resumeAfterMedia();
  }
}

async function playNextTTSSegment(generation, index) {
  if (generation !== ttsQueueGeneration || !ttsSessionId) return;
  if (index >= ttsSegmentQueue.length) {
    ttsSessionId = null;
    ttsCurrentText = '';
    ttsSegmentQueue = [];
    emitVoiceEvent(VOICE_EVENT_TYPES.TTS_STOP, { reason: 'completed' });
    window.bailongmaVoice?.resumeAfterMedia();
    return;
  }
  const segmentText = ttsSegmentQueue[index] || '';
  const segmentAudioPath = `/tts/session/${encodeURIComponent(ttsSessionId)}/audio/${index}`;
  const segmentAudioUrl = `${API}${segmentAudioPath}`;
  emitVoiceEvent(VOICE_EVENT_TYPES.TTS_SENTENCE_START, { sessionId: ttsSessionId, index, text: segmentText });
  emitVoiceEvent(VOICE_EVENT_TYPES.TTS_AUDIO_READY, {
    sessionId: ttsSessionId,
    index,
    text: segmentText,
    url: segmentAudioPath,
    absoluteUrl: segmentAudioUrl,
    contentType: "audio/mpeg",
  });
  try {
    const resp = await fetch(segmentAudioUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    if (generation !== ttsQueueGeneration) return;
    const url = URL.createObjectURL(blob);
    if (ttsAudioEl) { try { ttsAudioEl.pause(); URL.revokeObjectURL(ttsAudioEl.src); } catch {} }
    ttsAudioEl = new Audio(url);
    ttsAudioEl.volume = 1.0;
    ttsAudioEl.onended = () => {
      URL.revokeObjectURL(url);
      ttsPlayedSegments.push(segmentText);
      emitVoiceEvent(VOICE_EVENT_TYPES.TTS_SENTENCE_END, { sessionId: ttsSessionId, index, text: segmentText });
      ttsAudioEl = null;
      playNextTTSSegment(generation, index + 1);
    };
    ttsAudioEl.onerror = () => {
      try { URL.revokeObjectURL(url); } catch {}
      ttsAudioEl = null;
      playNextTTSSegment(generation, index + 1);
    };
    await ttsAudioEl.play();
  } catch {
    if (generation === ttsQueueGeneration) playNextTTSSegment(generation, index + 1);
  }
}

resetViewBtn.addEventListener("click", resetZoom);

document.querySelectorAll(".panel, .console, .theme-switcher, .reset-view").forEach(el => {
  el.addEventListener("wheel", event => event.stopPropagation(), { passive: true });
});

physicsControl.addEventListener("wheel", event => event.stopPropagation(), { passive: true });

window.addEventListener("resize", () => {
  W = window.innerWidth;
  H = window.innerHeight;
  svg.attr("width", W).attr("height", H);
  if (!MEMORY_GRAPH_ENABLED || !sim) return;
  sim.force("center", d3.forceCenter(W / 2, H / 2 - 10))
     .force("x", d3.forceX(W / 2))
     .force("y", d3.forceY(H / 2 - 10))
     .force("radial", d3.forceRadial(180, W / 2, H / 2 - 10));
  updateSimulationForces();
  sim.alpha(5).restart();
});

let _lastVisualRefresh = 0;
d3.timer(() => {
  if (!MEMORY_GRAPH_ENABLED) return true;
  if (glowSet.size === 0 && usePulseSet.size === 0) return;
  const now = Date.now();
  if (now - _lastVisualRefresh < 48) return;
  _lastVisualRefresh = now;
  refreshNodeVisuals();
});

function extractPersonCardQuery(text = "") {
  const value = String(text || "").trim();
  if (!value || /热点|热搜/.test(value)) return "";

  const patterns = [
    /^谁是\s*([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9·.\-\s]{1,40})[？?]?$/,
    /^([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9·.\-\s]{1,40})\s*(?:是谁|是誰|是什么人|是什麼人|是干嘛的|简介|介绍|资料|履历)[？?]?$/,
    /^(?:介绍一下|介绍下|查一下|了解一下|认识一下)\s*([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9·.\-\s]{1,40})[？?]?$/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    const name = match?.[1]?.trim();
    if (name) return name.replace(/[，,。.!！：:；;]+$/g, "").trim();
  }
  return "";
}

setAgentName(DEFAULT_AGENT_NAME);
initUiZoom();
readPhysicsSettings();
updatePhysicsReadout();
refreshThemeColors();
chat = initChat({
  apiBase: API,
  maxHistory: MAX_CHAT_HISTORY,
  activationWarmupKey: ACTIVATION_WARMUP_KEY,
  getAgentName: () => agentName,
  defaultInputPlaceholder,
  onUserMessage: (text) => {
    if (document.body.classList.contains('hotspot-mode') && /关闭|退出|关掉|隐藏/.test(text)) {
      toggleHotspot();
      return;
    }
    if (document.body.classList.contains('person-card-mode') && /关闭|退出|关掉|隐藏/.test(text)) {
      setPersonCardMode(false, { source: 'chat_input' });
      return;
    }
    if (/热点|热搜/.test(text) && !document.body.classList.contains('hotspot-mode')) {
      toggleHotspot();
    }
    const personQuery = extractPersonCardQuery(text);
    if (personQuery) {
      showPersonCardByName(personQuery, { source: 'chat_input' });
    }
  },
});
chat.applyActivationWarmupLock();
if (MEMORY_GRAPH_ENABLED) {
  if (graphEl) graphEl.style.display = "block";
  loadMemories();
  setInterval(() => {
    loadMemories();
  }, 5 * 60 * 1000);
}
connectSSE();
loadAgentProfile();
initPersonCard();
initDocPanel().catch((err) => console.warn('[DocPanel] init failed:', err));
chat.restoreChatHistory();
chat.unlockAudioOnFirstGesture();

bootstrapACUI();
initPanelCollapse();
initWechatPopup();


function formatVoiceClientSeenAt(value) {
  const ts = Number(value || 0);
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 1000) return "刚刚";
  if (diff < 60000) return `${Math.round(diff / 1000)} 秒前`;
  if (diff < 3600000) return `${Math.round(diff / 60000)} 分钟前`;
  return new Date(ts).toLocaleString();
}

function renderVoiceClientTags(capabilities = []) {
  const safeCaps = Array.isArray(capabilities) ? capabilities : [];
  if (!safeCaps.length) return '<span class="voice-client-tag">no capabilities</span>';
  return safeCaps.map(cap => `<span class="voice-client-tag">${escapeFocusText(cap)}</span>`).join("");
}


function voiceClientAdvice(client = {}) {
  if (Array.isArray(client.advice) && client.advice.length) return client.advice;
  if (Array.isArray(client.health?.advice) && client.health.advice.length) return client.health.advice;
  return ["链路状态未知"];
}

function renderVoiceClientAdvice(client = {}) {
  const level = client.health?.level || "info";
  return voiceClientAdvice(client).map(item => `<span class="voice-client-advice voice-client-advice-${escapeFocusText(level)}">${escapeFocusText(item)}</span>`).join("");
}

function renderVoiceClientCard(client = {}) {
  const identity = client.identity || {};
  const negotiated = client.negotiated || {};
  const title = identity.clientId || identity.device || identity.app || "unknown-client";
  const subtitle = [identity.device, identity.platform, identity.version].filter(Boolean).join(" · ") || identity.app || "未登记设备信息";
  const audioState = client.audio ? (client.binaryAudio ? "binary subscribed" : "base64 subscribed") : "not subscribed";
  return `
    <article class="voice-client-card">
      <div class="voice-client-head">
        <div>
          <div class="voice-client-title">${escapeFocusText(title)}</div>
          <div class="voice-client-subtitle">${escapeFocusText(subtitle)}</div>
        </div>
        <div class="voice-client-mode">${escapeFocusText(negotiated.audioMode || "none")}</div>
      </div>
      <div class="voice-client-grid">
        <div class="voice-client-kv"><span>App</span><strong>${escapeFocusText(identity.app || "—")}</strong></div>
        <div class="voice-client-kv"><span>Audio</span><strong>${escapeFocusText(audioState)}</strong></div>
        <div class="voice-client-kv"><span>Last Seen</span><strong>${escapeFocusText(formatVoiceClientSeenAt(identity.lastSeenAt || identity.updatedAt || identity.connectedAt))}</strong></div>
        <div class="voice-client-kv"><span>Negotiated</span><strong>${escapeFocusText(negotiated.reason || "—")}</strong></div>
        <div class="voice-client-kv"><span>Health</span><strong>${escapeFocusText(client.health?.level || "unknown")}</strong></div>
      </div>
      <div class="voice-client-tags">${renderVoiceClientTags(identity.capabilities)}</div>
      <div class="voice-client-advice-row">${renderVoiceClientAdvice(client)}</div>
    </article>`;
}


function formatVoiceEventTime(value) {
  const ts = Number(value || 0);
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}


function voiceWakeRejectAdvice(reason = "") {
  if (reason === "command too short") return "建议降低最短指令字数，或说完整命令。";
  if (reason === "wake confidence too low") return "建议让唤醒词位于句首，或降低唤醒置信度阈值。";
  if (reason === "wake cooldown") return "建议缩短唤醒冷却时间，或等待冷却结束。";
  if (reason === "speaker verification required for wake") return "建议重录声纹、降低声纹严格度，或关闭唤醒声纹联动。";
  if (reason === "wake not at prefix") return "严格模式要求以唤醒词开头。";
  if (reason === "wake missing") return "没有检测到唤醒词，请检查唤醒词列表。";
  return "查看置信度、阈值和声纹状态后调整设置。";
}

function renderWakeRejectMeta(event = {}) {
  const bits = [];
  if (Number.isFinite(Number(event.confidence))) bits.push(`confidence:${Number(event.confidence).toFixed(2)}`);
  if (Number.isFinite(Number(event.threshold))) bits.push(`threshold:${Number(event.threshold).toFixed(2)}`);
  if (Number.isFinite(Number(event.minCommandChars))) bits.push(`min:${event.minCommandChars}字`);
  if (Number.isFinite(Number(event.remainingMs))) bits.push(`cooldown:${Math.max(0, Number(event.remainingMs) / 1000).toFixed(1)}s`);
  return bits;
}

function voiceEventLabel(item = {}) {
  const event = item.event || {};
  const mapped = item.xiaozhi || {};
  const type = event.type || item.type || mapped.type || "unknown";
  if (type === "asr:final" || mapped.state === "final") return `识别完成：${event.text || mapped.text || "—"}`;
  if (type === "asr:partial" || mapped.state === "partial") return `识别中：${event.text || mapped.text || "—"}`;
  if (type === "wake:accepted") return `唤醒成功：${event.word || mapped.word || "—"}`;
  if (type === "wake:rejected") return `唤醒拒绝：${event.reason || mapped.reason || "未命中"} · ${voiceWakeRejectAdvice(event.reason || mapped.reason || "")}`;
  if (type === "tts:start") return `TTS 开始：${event.text || mapped.text || `${event.segments || mapped.segments || 0} 段`}`;
  if (type === "tts:stop") return `TTS 结束：${event.reason || mapped.reason || "completed"}`;
  if (type === "interrupt") return `中断：${event.source || mapped.source || "unknown"}`;
  return `${type}${event.text ? `：${event.text}` : ""}`;
}

function voiceEventTone(type = "") {
  if (type.includes("rejected") || type === "interrupt") return "warn";
  if (type.includes("asr")) return "asr";
  if (type.includes("wake")) return "wake";
  if (type.includes("tts")) return "tts";
  return "info";
}

function renderVoiceEventHistoryItem(item = {}) {
  const event = item.event || {};
  const mapped = item.xiaozhi || {};
  const type = event.type || item.type || mapped.type || "unknown";
  const tone = voiceEventTone(type);
  const rejectMeta = type === "wake:rejected" ? renderWakeRejectMeta(event) : [];
  const meta = [mapped.type && `xiaozhi:${mapped.type}`, mapped.state && `state:${mapped.state}`, event.roundId && `round:${event.roundId}`, ...rejectMeta].filter(Boolean).join(" · ");
  return `
    <article class="voice-event-item voice-event-item-${escapeFocusText(tone)}">
      <div class="voice-event-dot"></div>
      <div class="voice-event-main">
        <div class="voice-event-row"><strong>${escapeFocusText(voiceEventLabel(item))}</strong><code>${escapeFocusText(type)}</code></div>
        <div class="voice-event-meta"><span>${escapeFocusText(formatVoiceEventTime(event.ts || item.ts))}</span>${meta ? `<span>${escapeFocusText(meta)}</span>` : ""}</div>
      </div>
    </article>`;
}


function renderVoiceLinkSummary(summary = {}) {
  const level = summary.level || "unknown";
  const status = summary.status || {};
  const recent = summary.recent || {};
  const suggestions = Array.isArray(summary.suggestions) ? summary.suggestions : [];
  const issues = Array.isArray(summary.issues) ? summary.issues : [];
  const wakeDetails = Array.isArray(recent.wakeRejectedDetails) ? recent.wakeRejectedDetails : [];
  const speakerDetails = Array.isArray(recent.speakerRejectedDetails) ? recent.speakerRejectedDetails : [];
  const levelText = level === "ok" ? "链路正常" : level === "offline" ? "未连接" : "需要注意";
  return `
    <div class="voice-link-summary-head">
      <div>
        <div class="voice-link-summary-title">语音链路总控</div>
        <div class="voice-link-summary-sub">最近 ${Math.round((summary.windowMs || 60000) / 1000)} 秒 · ${escapeFocusText(new Date(summary.checkedAt || Date.now()).toLocaleTimeString())}</div>
      </div>
      <div class="voice-link-badge voice-link-badge-${escapeFocusText(level)}">${escapeFocusText(levelText)}</div>
    </div>
    <div class="voice-link-metrics">
      <div><span>客户端</span><strong>${escapeFocusText(status.clients ?? 0)}</strong></div>
      <div><span>音频订阅</span><strong>${escapeFocusText(status.audioSubscribers ?? 0)}</strong></div>
      <div><span>二进制</span><strong>${escapeFocusText(status.binaryAudioSubscribers ?? 0)}</strong></div>
      <div><span>事件</span><strong>${escapeFocusText(recent.total ?? 0)}</strong></div>
      <div><span>唤醒成功</span><strong>${escapeFocusText(recent.wakeAccepted ?? 0)}</strong></div>
      <div><span>声纹通过</span><strong>${escapeFocusText(recent.speakerAccepted ?? 0)}</strong></div>
      <div><span>声纹拒绝</span><strong>${escapeFocusText(recent.speakerRejected ?? 0)}</strong></div>
      <div><span>识别完成</span><strong>${escapeFocusText(recent.asrFinal ?? 0)}</strong></div>
      <div><span>TTS</span><strong>${escapeFocusText(`${recent.ttsStart ?? 0}/${recent.ttsStop ?? 0}`)}</strong></div>
      <div><span>中断</span><strong>${escapeFocusText(recent.interrupt ?? 0)}</strong></div>
    </div>
    ${wakeDetails.length ? `<div class="voice-link-wake-rejects">
      ${wakeDetails.slice(-4).map(item => `<span><strong>${escapeFocusText(item.reason || "unknown")}</strong>${escapeFocusText(item.advice || voiceWakeRejectAdvice(item.reason || ""))}${Number.isFinite(Number(item.confidence)) ? `<code>${escapeFocusText(Number(item.confidence).toFixed(2))}</code>` : ""}</span>`).join("")}
    </div>` : ""}
    ${speakerDetails.length ? `<div class="voice-link-wake-rejects">
      ${speakerDetails.slice(-4).map(item => `<span><strong>声纹拒绝</strong>${escapeFocusText(item.advice || "建议降低声纹严格度或重新录入声纹。")}${Number.isFinite(Number(item.score)) ? `<code>${escapeFocusText(Number(item.score).toFixed(2))}/${escapeFocusText(Number(item.threshold ?? 0).toFixed(2))}</code>` : ""}</span>`).join("")}
    </div>` : ""}
    <div class="voice-link-suggestions">
      ${suggestions.map(item => `<span>${escapeFocusText(item)}</span>`).join("")}
      ${issues.length ? `<code>${escapeFocusText(issues.join(" · "))}</code>` : ""}
    </div>
    <div id="voice-wake-tuning-actions" class="voice-wake-tuning-actions"></div>`;
}

function voiceTuningFieldLabel(key = "") {
  const labels = {
    wakeConfidenceThreshold: "唤醒置信度",
    wakeMinCommandChars: "最短指令字数",
    wakeCooldownMs: "唤醒冷却",
    wakeRequireSpeakerWhenEnabled: "唤醒声纹联动",
    wakeMode: "唤醒模式",
    wakeRepeatSuppression: "重复抑制",
    speakerThreshold: "声纹严格度",
  };
  return labels[key] || key;
}

function formatVoiceTuningValue(key = "", value) {
  if (value === true) return "开启";
  if (value === false) return "关闭";
  if (key === "wakeCooldownMs" && Number.isFinite(Number(value))) return `${(Number(value) / 1000).toFixed(1)}s`;
  if ((key === "wakeConfidenceThreshold" || key === "speakerThreshold") && Number.isFinite(Number(value))) return Number(value).toFixed(2);
  if (key === "wakeMinCommandChars" && Number.isFinite(Number(value))) return `${Math.round(Number(value))}字`;
  return String(value ?? "—");
}

function renderVoiceTuningDiffChips(record = {}) {
  const applied = record.applied && typeof record.applied === "object" ? record.applied : {};
  const before = record.before && typeof record.before === "object" ? record.before : {};
  const after = record.after && typeof record.after === "object" ? record.after : {};
  const keys = Object.keys(applied);
  if (!keys.length) return "";
  return `<div class="voice-wake-tuning-diff">${keys.map(key => `<span><strong>${escapeFocusText(voiceTuningFieldLabel(key))}</strong>${escapeFocusText(formatVoiceTuningValue(key, before[key]))} → ${escapeFocusText(formatVoiceTuningValue(key, after[key] ?? applied[key]))}</span>`).join("")}</div>`;
}


function renderVoiceLinkCheck(check = {}) {
  const statusText = check.overall === "ok" ? "全部通过" : check.overall === "warn" ? "需要处理" : check.overall === "pending" ? "等待接入" : "存在错误";
  const steps = Array.isArray(check.steps) ? check.steps : [];
  const actions = Array.isArray(check.nextActions) ? check.nextActions : [];
  const localCommand = check.commands?.local || "";
  const lanCommand = check.commands?.lan || "";
  return `
    <div class="voice-link-check-head">
      <div>
        <div class="voice-link-check-title">一键语音链路自检</div>
        <div class="voice-link-check-sub">${escapeFocusText(new Date(check.checkedAt || Date.now()).toLocaleTimeString())} · ${escapeFocusText(statusText)}</div>
      </div>
      <div class="voice-link-badge voice-link-badge-${escapeFocusText(check.overall || "pending")}">${escapeFocusText(statusText)}</div>
    </div>
    <div class="voice-link-check-steps">
      ${steps.map(step => `
        <div class="voice-link-check-step voice-link-check-step-${escapeFocusText(step.status || "pending")}">
          <span>${escapeFocusText(step.status || "pending")}</span>
          <strong>${escapeFocusText(step.label || step.id || "step")}</strong>
          <em>${escapeFocusText(step.detail || "")}</em>
        </div>`).join("")}
    </div>
    <div class="voice-link-check-actions">
      ${actions.map(item => `<p><strong>${escapeFocusText(item.label || item.id || "下一步")}</strong>${escapeFocusText(item.action || "")}</p>`).join("")}
    </div>
    ${localCommand || lanCommand ? `<div class="voice-link-check-commands">${localCommand ? `<code>${escapeFocusText(localCommand)}</code>` : ""}${lanCommand ? `<code>${escapeFocusText(lanCommand)}</code>` : ""}</div>` : ""}`;
}


function renderVoiceOnboardingPackage(pkg = {}) {
  const files = pkg.files || {};
  const fileNames = Object.keys(files);
  return `
    <div class="voice-package-head">
      <div>
        <div class="voice-package-title">设备接入包</div>
        <div class="voice-package-sub">${escapeFocusText(pkg.profile?.clientId || "esp32-test")} · ${escapeFocusText(pkg.profile?.device || "xiaozhi-esp32")}</div>
      </div>
      <button class="settings-save-btn" id="voice-package-copy-readme" type="button">复制 README</button>
    </div>
    <div class="voice-package-grid">
      <div><span>WebSocket</span><code>${escapeFocusText(pkg.urls?.lanWebSocket || "—")}</code></div>
      <div><span>本机调试</span><code>${escapeFocusText(pkg.commands?.local || "—")}</code></div>
      <div><span>文件</span><strong>${escapeFocusText(fileNames.join(" · ") || "—")}</strong></div>
      <div><span>能力</span><strong>${escapeFocusText((pkg.profile?.capabilities || []).join(" · ") || "—")}</strong></div>
    </div>
    <div class="voice-package-files">
      ${fileNames.map(name => `
        <details>
          <summary>${escapeFocusText(name)}</summary>
          <pre>${escapeFocusText(files[name])}</pre>
        </details>`).join("")}
    </div>
    <div class="voice-package-checklist">
      ${(pkg.checklist || []).map(item => `<span>${escapeFocusText(item)}</span>`).join("")}
    </div>`;
}

function initVoiceClientsPanel() {
  const listEl = document.getElementById("voice-clients-list");
  if (!listEl) return;
  const countEl = document.getElementById("voice-clients-count");
  const audioCountEl = document.getElementById("voice-clients-audio-count");
  const binaryCountEl = document.getElementById("voice-clients-binary-count");
  const feedbackEl = document.getElementById("voice-clients-feedback");
  const refreshBtn = document.getElementById("voice-clients-refresh-btn");
  const checkBtn = document.getElementById("voice-link-check-btn");
  const packageBtn = document.getElementById("voice-package-btn");
  const protocolBtn = document.getElementById("voice-clients-protocol-btn");
  const copyBtn = document.getElementById("voice-clients-copy-btn");
  const diagnosticsEl = document.getElementById("voice-clients-diagnostics");
  const summaryEl = document.getElementById("voice-link-summary");
  let latestWakeTuningActions = [];
  const checkEl = document.getElementById("voice-link-check");
  const packageEl = document.getElementById("voice-package-panel");
  const guideEl = document.getElementById("voice-clients-guide");
  const autoEl = document.getElementById("voice-clients-auto-refresh");
  const historyListEl = document.getElementById("voice-events-history-list");
  const historyFilterEl = document.getElementById("voice-events-history-filter");
  const historyRefreshBtn = document.getElementById("voice-events-history-refresh-btn");
  let timer = null;

  let latestProtocol = null;
  function voiceClientConnectCommand(protocol = latestProtocol || {}) {
    const wsPath = protocol.endpoints?.websocket || "/voice/events";
    return `npm run voice:events -- listen --url ws://127.0.0.1:3721${wsPath} --audio --binary --client-id mac-debug --device mac --platform ${navigator.platform || "mac"} --capability binary_audio --capability wake --capability display`;
  }


  function likelyLanHost() {
    const host = window.location?.hostname || "127.0.0.1";
    if (!host || host === "localhost") return "<Mac局域网IP>";
    if (host === "127.0.0.1" || host === "::1") return "<Mac局域网IP>";
    return host;
  }

  function voiceClientLanCommand(protocol = latestProtocol || {}) {
    const wsPath = protocol.endpoints?.websocket || "/voice/events";
    return `npm run voice:events -- listen --url ws://${likelyLanHost()}:3721${wsPath} --audio --binary --client-id esp32-test --device xiaozhi-esp32 --platform esp32 --capability binary_audio --capability wake --capability display`;
  }

  function renderDeviceHandshakeExample() {
    return JSON.stringify({
      type: "client:hello",
      clientId: "esp32-living-room",
      device: "xiaozhi-esp32",
      app: "bailongma-bridge",
      version: "0.1.0",
      platform: "esp32",
      capabilities: ["binary_audio", "tts_speak", "wake", "display"],
    }, null, 2);
  }

  function renderProtocolDiagnostics(protocol = {}) {
    if (!diagnosticsEl) return;
    latestProtocol = protocol;
    const endpoints = protocol.endpoints || {};
    const caps = Array.isArray(protocol.capabilities) ? protocol.capabilities : [];
    const modes = protocol.negotiation?.audioModes || [];
    const onboarding = protocol.onboarding || null;
    const command = onboarding?.commands?.local || voiceClientConnectCommand(protocol);
    const lanCommand = onboarding?.commands?.lan || voiceClientLanCommand(protocol);
    const handshake = JSON.stringify(onboarding?.messages?.clientHello || JSON.parse(renderDeviceHandshakeExample()), null, 2);
    diagnosticsEl.hidden = false;
    diagnosticsEl.innerHTML = `
      <div class="voice-diagnostic-line"><span>WebSocket</span><code>${escapeFocusText(endpoints.websocket || "—")}</code></div>
      <div class="voice-diagnostic-line"><span>Clients</span><code>${escapeFocusText(endpoints.clients || "—")}</code></div>
      <div class="voice-diagnostic-line"><span>History</span><code>${escapeFocusText(endpoints.history || "/voice/events/history")}</code></div>
      <div class="voice-diagnostic-line"><span>Summary</span><code>${escapeFocusText(endpoints.summary || "/voice/events/summary")}</code></div>
      <div class="voice-diagnostic-line"><span>Check</span><code>${escapeFocusText(endpoints.check || "/voice/events/check")}</code></div>
      <div class="voice-diagnostic-line"><span>Package</span><code>${escapeFocusText(endpoints.package || "/voice/events/package")}</code></div>
      <div class="voice-diagnostic-line"><span>Audio Modes</span><code>${escapeFocusText(modes.join(" / ") || "—")}</code></div>
      <div class="voice-diagnostic-line"><span>Capabilities</span><code>${escapeFocusText(caps.filter(c => ["client_identity", "audio_negotiation", "client_diagnostics", "tts_speak"].includes(c)).join(" · ") || "—")}</code></div>
    `;
    if (guideEl) {
      guideEl.hidden = false;
      guideEl.innerHTML = `
        <div class="voice-guide-title">本机调试接入命令</div>
        <code>${escapeFocusText(command)}</code>
        <div class="voice-guide-title voice-guide-title-spaced">局域网/设备接入命令</div>
        <code>${escapeFocusText(lanCommand)}</code>
        <div class="voice-guide-title voice-guide-title-spaced">设备握手 JSON</div>
        <code>${escapeFocusText(handshake)}</code>
        <p>局域网设备需用 Mac 的局域网 IP 替换占位符；如启用 token，连接 URL 追加 <code>?token=...</code>。设备连上后先发送 client:hello，再根据 negotiated.audioMode 决定 subscribe 参数。</p>
      `;
    }
  }

  async function refreshProtocolDiagnostics() {
    if (feedbackEl) feedbackEl.textContent = "协议自检中…";
    try {
      const res = await fetch(`${API}/voice/events/protocol`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const protocol = await res.json();
      try {
        const onboardingRes = await fetch(`${API}/voice/events/onboarding`);
        if (onboardingRes.ok) protocol.onboarding = await onboardingRes.json();
      } catch {}
      renderProtocolDiagnostics(protocol);
      if (feedbackEl) feedbackEl.textContent = "协议正常";
    } catch (err) {
      if (diagnosticsEl) {
        diagnosticsEl.hidden = false;
        diagnosticsEl.innerHTML = `<div class="voice-clients-error">协议自检失败：${escapeFocusText(err.message || err)}</div>`;
      }
      if (feedbackEl) feedbackEl.textContent = "协议失败";
    }
  }

  function renderWakeTuningActions(actions = [], history = []) {
    const host = document.getElementById("voice-wake-tuning-actions");
    if (!host) return;
    const safeActions = Array.isArray(actions) ? actions.filter(item => item.safe !== false && item.patch && Object.keys(item.patch).length) : [];
    const tuningHistory = Array.isArray(history) ? history : [];
    latestWakeTuningActions = safeActions;
    const latest = tuningHistory[tuningHistory.length - 1];
    if (!safeActions.length && !latest) {
      host.innerHTML = `<div class="voice-wake-auto-panel" id="voice-wake-auto-panel"></div>`;
      refreshWakeAutoTuning();
      return;
    }
    host.innerHTML = `
      <div class="voice-wake-auto-panel" id="voice-wake-auto-panel"></div>
      ${safeActions.length ? `<div class="voice-wake-tuning-title">可一键应用的调参建议</div>
      ${safeActions.map((item, index) => `<button class="voice-wake-tuning-action" data-index="${index}" type="button"><strong>${escapeFocusText(item.label || item.reason)}</strong><span>${escapeFocusText(item.reason || "")}</span></button>`).join("")}` : ""}
      ${latest ? `<div class="voice-wake-tuning-history"><span>最近调参：${escapeFocusText(latest.label || latest.reason || latest.id)}</span><span class="voice-wake-tuning-verdict voice-wake-tuning-verdict-${escapeFocusText(latest.evaluation?.advice?.level || latest.evaluation?.verdict || "pending")}">${escapeFocusText(latest.evaluation?.verdict || "pending")}</span><button class="voice-wake-tuning-rollback" data-id="${escapeFocusText(latest.id || "")}" type="button">回滚</button><button class="voice-wake-tuning-clear" type="button">清空历史</button></div>${renderVoiceTuningDiffChips(latest)}${latest.evaluation ? `<div class="voice-wake-tuning-eval"><span>应用前拒绝 ${escapeFocusText(latest.evaluation.before?.wakeRejected ?? 0)} / 成功 ${escapeFocusText(latest.evaluation.before?.wakeAccepted ?? 0)}</span><span>应用后拒绝 ${escapeFocusText(latest.evaluation.after?.wakeRejected ?? 0)} / 成功 ${escapeFocusText(latest.evaluation.after?.wakeAccepted ?? 0)}</span><span>声纹拒绝 ${escapeFocusText(latest.evaluation.before?.speakerRejected ?? 0)} → ${escapeFocusText(latest.evaluation.after?.speakerRejected ?? 0)}</span></div><div class="voice-wake-tuning-advice voice-wake-tuning-advice-${escapeFocusText(latest.evaluation.advice?.level || "pending")}"><span>${escapeFocusText(latest.evaluation.advice?.text || "继续观察调参效果。")}</span>${latest.evaluation.advice?.action === "rollback" ? `<button class="voice-wake-tuning-rollback" data-id="${escapeFocusText(latest.id || "")}" type="button">建议回滚</button>` : ""}</div>` : ""}` : ""}`;
    host.querySelectorAll(".voice-wake-tuning-action").forEach(btn => {
      btn.addEventListener("click", () => applyWakeTuningAction(Number(btn.dataset.index || -1)));
    });
    host.querySelector(".voice-wake-tuning-rollback")?.addEventListener("click", (event) => rollbackWakeTuning(event.currentTarget?.dataset?.id || ""));
    host.querySelector(".voice-wake-tuning-clear")?.addEventListener("click", () => clearWakeTuningHistory());
    refreshWakeAutoTuning();
  }

  async function refreshWakeAutoTuning() {
    const panel = document.getElementById("voice-wake-auto-panel");
    if (!panel) return;
    try {
      const res = await fetch(`${API}/voice/wake/tuning/auto?windowMs=60000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const blocked = Array.isArray(data.blocked) ? data.blocked : [];
      panel.innerHTML = `
        <div class="voice-wake-auto-head"><strong>安全自动调参</strong><span>${data.enabled ? "已开启" : "未开启"}</span></div>
        <div class="voice-wake-auto-meta">${data.topReason ? `主要原因 ${escapeFocusText(data.topReason.reason)} × ${escapeFocusText(data.topReason.count)}` : "等待足够样本"} · ${data.eligible ? "可自动应用" : escapeFocusText(blocked.join(" · ") || "观察中")}</div>
        <div class="voice-wake-auto-actions">
          <button class="voice-wake-auto-toggle" type="button">${data.enabled ? "关闭自动模式" : "开启自动模式"}</button>
          ${data.eligible ? '<button class="voice-wake-auto-apply" type="button">自动应用一次</button>' : ""}
        </div>`;
      panel.querySelector(".voice-wake-auto-toggle")?.addEventListener("click", () => setWakeAutoTuning(!data.enabled));
      panel.querySelector(".voice-wake-auto-apply")?.addEventListener("click", () => applyWakeAutoTuning());
    } catch (err) {
      panel.innerHTML = `<div class="voice-clients-error">读取自动调参策略失败：${escapeFocusText(err.message || err)}</div>`;
    }
  }

  async function setWakeAutoTuning(enabled) {
    if (feedbackEl) feedbackEl.textContent = enabled ? "开启自动调参…" : "关闭自动调参…";
    try {
      const res = await fetch(`${API}/voice/wake/tuning/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (feedbackEl) feedbackEl.textContent = enabled ? "自动调参已开启" : "自动调参已关闭";
      refreshWakeAutoTuning();
    } catch (err) {
      if (feedbackEl) feedbackEl.textContent = `自动调参失败：${err.message || err}`;
    }
  }

  async function applyWakeAutoTuning() {
    if (feedbackEl) feedbackEl.textContent = "自动调参应用中…";
    try {
      const res = await fetch(`${API}/voice/wake/tuning/auto/apply`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const voice = data.voice || {};
      if (voice.wakeConfidenceThreshold != null) localStorage.setItem("bailongma-voice-wake-confidence-threshold", String(voice.wakeConfidenceThreshold));
      if (voice.wakeMinCommandChars != null) localStorage.setItem("bailongma-voice-wake-min-command-chars", String(voice.wakeMinCommandChars));
      if (voice.wakeCooldownMs != null) localStorage.setItem("bailongma-voice-wake-cooldown-ms", String(voice.wakeCooldownMs));
      if (voice.wakeRequireSpeakerWhenEnabled != null) localStorage.setItem("bailongma-voice-wake-require-speaker", String(voice.wakeRequireSpeakerWhenEnabled));
      if (voice.speakerThreshold != null) localStorage.setItem("bailongma-voice-speaker-threshold", String(voice.speakerThreshold));
      if (feedbackEl) feedbackEl.textContent = "自动调参已应用";
      refreshVoiceLinkSummary({ quiet: true });
    } catch (err) {
      if (feedbackEl) feedbackEl.textContent = `自动调参未应用：${err.message || err}`;
      refreshWakeAutoTuning();
    }
  }

  async function refreshWakeTuningActions() {
    const host = document.getElementById("voice-wake-tuning-actions");
    if (!host) return;
    try {
      const res = await fetch(`${API}/voice/wake/tuning?windowMs=60000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderWakeTuningActions(data.actions || [], data.history || []);
    } catch (err) {
      host.innerHTML = `<div class="voice-clients-error">读取 /voice/wake/tuning 失败：${escapeFocusText(err.message || err)}</div>`;
    }
  }

  async function applyWakeTuningAction(index) {
    const action = latestWakeTuningActions[index];
    if (!action?.patch) return;
    if (feedbackEl) feedbackEl.textContent = "应用唤醒调参中…";
    try {
      const res = await fetch(`${API}/voice/wake/tuning/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch: action.patch, reason: action.reason, label: action.label }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const voice = data.voice || {};
      if (voice.wakeConfidenceThreshold != null) localStorage.setItem("bailongma-voice-wake-confidence-threshold", String(voice.wakeConfidenceThreshold));
      if (voice.wakeMinCommandChars != null) localStorage.setItem("bailongma-voice-wake-min-command-chars", String(voice.wakeMinCommandChars));
      if (voice.wakeCooldownMs != null) localStorage.setItem("bailongma-voice-wake-cooldown-ms", String(voice.wakeCooldownMs));
      if (voice.wakeRequireSpeakerWhenEnabled != null) localStorage.setItem("bailongma-voice-wake-require-speaker", String(voice.wakeRequireSpeakerWhenEnabled));
      if (voice.speakerThreshold != null) localStorage.setItem("bailongma-voice-speaker-threshold", String(voice.speakerThreshold));
      if (voice.wakeMode) localStorage.setItem("bailongma-voice-wake-mode", voice.wakeMode);
      if (voice.wakeRepeatSuppression != null) localStorage.setItem("bailongma-voice-wake-repeat-suppression", String(voice.wakeRepeatSuppression));
      if (feedbackEl) feedbackEl.textContent = "唤醒调参已应用";
      refreshVoiceLinkSummary({ quiet: true });
    } catch (err) {
      if (feedbackEl) feedbackEl.textContent = `应用失败：${err.message || err}`;
    }
  }

  async function rollbackWakeTuning(id = "") {
    if (feedbackEl) feedbackEl.textContent = "回滚唤醒调参中…";
    try {
      const res = await fetch(`${API}/voice/wake/tuning/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const voice = data.voice || {};
      if (voice.wakeConfidenceThreshold != null) localStorage.setItem("bailongma-voice-wake-confidence-threshold", String(voice.wakeConfidenceThreshold));
      if (voice.wakeMinCommandChars != null) localStorage.setItem("bailongma-voice-wake-min-command-chars", String(voice.wakeMinCommandChars));
      if (voice.wakeCooldownMs != null) localStorage.setItem("bailongma-voice-wake-cooldown-ms", String(voice.wakeCooldownMs));
      if (voice.wakeRequireSpeakerWhenEnabled != null) localStorage.setItem("bailongma-voice-wake-require-speaker", String(voice.wakeRequireSpeakerWhenEnabled));
      if (voice.speakerThreshold != null) localStorage.setItem("bailongma-voice-speaker-threshold", String(voice.speakerThreshold));
      if (voice.wakeMode) localStorage.setItem("bailongma-voice-wake-mode", voice.wakeMode);
      if (voice.wakeRepeatSuppression != null) localStorage.setItem("bailongma-voice-wake-repeat-suppression", String(voice.wakeRepeatSuppression));
      if (feedbackEl) feedbackEl.textContent = "唤醒调参已回滚";
      refreshVoiceLinkSummary({ quiet: true });
    } catch (err) {
      if (feedbackEl) feedbackEl.textContent = `回滚失败：${err.message || err}`;
    }
  }

  async function clearWakeTuningHistory() {
    if (feedbackEl) feedbackEl.textContent = "清空调参历史中…";
    try {
      const res = await fetch(`${API}/voice/wake/tuning/clear`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (feedbackEl) feedbackEl.textContent = `已清空 ${data.cleared || 0} 条调参历史`;
      refreshVoiceLinkSummary({ quiet: true });
    } catch (err) {
      if (feedbackEl) feedbackEl.textContent = `清空失败：${err.message || err}`;
    }
  }

  async function refreshVoiceLinkSummary({ quiet = false } = {}) {
    if (!summaryEl) return;
    try {
      const res = await fetch(`${API}/voice/events/summary?windowMs=60000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      summaryEl.hidden = false;
      summaryEl.innerHTML = renderVoiceLinkSummary(data.summary || data);
      refreshWakeTuningActions();
    } catch (err) {
      summaryEl.hidden = false;
      summaryEl.innerHTML = `<div class="voice-clients-error">读取 /voice/events/summary 失败：${escapeFocusText(err.message || err)}</div>`;
      if (!quiet && feedbackEl) feedbackEl.textContent = "总控读取失败";
    }
  }

  async function loadVoiceOnboardingPackage() {
    if (!packageEl) return;
    if (feedbackEl) feedbackEl.textContent = "生成接入包中…";
    packageEl.hidden = false;
    packageEl.innerHTML = '<div class="voice-clients-empty">正在生成 README、环境变量、client:hello 和示例代码…</div>';
    try {
      const res = await fetch(`${API}/voice/events/package?clientId=esp32-test&device=xiaozhi-esp32&platform=esp32`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pkg = await res.json();
      packageEl.innerHTML = renderVoiceOnboardingPackage(pkg);
      packageEl.querySelector('#voice-package-copy-readme')?.addEventListener('click', async () => {
        const text = pkg.files?.['README.md'] || JSON.stringify(pkg, null, 2);
        try {
          await navigator.clipboard?.writeText(text);
          if (feedbackEl) feedbackEl.textContent = "README 已复制";
        } catch {
          if (feedbackEl) feedbackEl.textContent = "复制失败，请展开 README 手动复制";
        }
      });
      if (feedbackEl) feedbackEl.textContent = "接入包已生成";
    } catch (err) {
      packageEl.innerHTML = `<div class="voice-clients-error">读取 /voice/events/package 失败：${escapeFocusText(err.message || err)}</div>`;
      if (feedbackEl) feedbackEl.textContent = "接入包失败";
    }
  }

  async function runVoiceLinkCheck() {
    if (!checkEl) return;
    if (feedbackEl) feedbackEl.textContent = "语音链路自检中…";
    checkEl.hidden = false;
    checkEl.innerHTML = '<div class="voice-clients-empty">正在检查协议、客户端、订阅、事件闭环…</div>';
    try {
      const res = await fetch(`${API}/voice/events/check?windowMs=60000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      checkEl.innerHTML = renderVoiceLinkCheck(data);
      if (feedbackEl) feedbackEl.textContent = data.overall === "ok" ? "自检通过" : "自检完成";
      if (data.summary && summaryEl) {
        summaryEl.hidden = false;
        summaryEl.innerHTML = renderVoiceLinkSummary(data.summary);
        refreshWakeTuningActions();
      }
    } catch (err) {
      checkEl.innerHTML = `<div class="voice-clients-error">读取 /voice/events/check 失败：${escapeFocusText(err.message || err)}</div>`;
      if (feedbackEl) feedbackEl.textContent = "自检失败";
    }
  }

  async function refreshVoiceClients({ quiet = false } = {}) {
    if (!quiet && feedbackEl) feedbackEl.textContent = "刷新中…";
    try {
      const res = await fetch(`${API}/voice/events/clients`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const clients = Array.isArray(data.clientDetails) ? data.clientDetails : [];
      if (countEl) countEl.textContent = String(data.clients ?? clients.length);
      if (audioCountEl) audioCountEl.textContent = String(clients.filter(c => c.audio).length);
      if (binaryCountEl) binaryCountEl.textContent = String(clients.filter(c => c.binaryAudio).length);
      if (!clients.length) {
        listEl.innerHTML = '<div class="voice-clients-empty">暂无外部客户端连接。可运行 <code>npm run voice:events -- listen --audio --client-id mac-debug</code> 测试。</div>';
      } else {
        listEl.innerHTML = clients.map(renderVoiceClientCard).join("");
      }
      if (feedbackEl) feedbackEl.textContent = quiet ? "" : "已刷新";
    } catch (err) {
      listEl.innerHTML = `<div class="voice-clients-error">读取 /voice/events/clients 失败：${escapeFocusText(err.message || err)}</div>`;
      if (feedbackEl) feedbackEl.textContent = "读取失败";
    }
  }


  async function refreshVoiceEventsHistory({ quiet = false } = {}) {
    if (!historyListEl) return;
    if (!quiet && feedbackEl) feedbackEl.textContent = "读取事件中…";
    const type = String(historyFilterEl?.value || "").trim();
    const query = new URLSearchParams({ limit: "20" });
    if (type) query.set("type", type);
    try {
      const res = await fetch(`${API}/voice/events/history?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = Array.isArray(data.events) ? data.events.slice().reverse() : [];
      if (!events.length) {
        historyListEl.innerHTML = '<div class="voice-clients-empty">暂无匹配语音事件。触发一次唤醒/识别/TTS 后会显示在这里。</div>';
      } else {
        historyListEl.innerHTML = events.map(renderVoiceEventHistoryItem).join("");
      }
      if (!quiet && feedbackEl) feedbackEl.textContent = "事件已刷新";
    } catch (err) {
      historyListEl.innerHTML = `<div class="voice-clients-error">读取 /voice/events/history 失败：${escapeFocusText(err.message || err)}</div>`;
      if (feedbackEl) feedbackEl.textContent = "事件读取失败";
    }
  }

  function restartTimer() {
    if (timer) clearInterval(timer);
    timer = null;
    if (autoEl?.checked) timer = setInterval(() => {
      refreshVoiceClients({ quiet: true });
      refreshVoiceEventsHistory({ quiet: true });
      refreshVoiceLinkSummary({ quiet: true });
    }, 5000);
  }

  refreshBtn?.addEventListener("click", () => { refreshVoiceClients(); refreshVoiceEventsHistory({ quiet: true }); refreshVoiceLinkSummary({ quiet: true }); });
  checkBtn?.addEventListener("click", () => runVoiceLinkCheck());
  packageBtn?.addEventListener("click", () => loadVoiceOnboardingPackage());
  historyRefreshBtn?.addEventListener("click", () => refreshVoiceEventsHistory());
  historyFilterEl?.addEventListener("change", () => refreshVoiceEventsHistory());
  protocolBtn?.addEventListener("click", () => refreshProtocolDiagnostics());
  copyBtn?.addEventListener("click", async () => {
    const command = voiceClientConnectCommand();
    try {
      await navigator.clipboard?.writeText(command);
      if (feedbackEl) feedbackEl.textContent = "命令已复制";
    } catch {
      if (feedbackEl) feedbackEl.textContent = command;
    }
  });
  autoEl?.addEventListener("change", restartTimer);
  refreshProtocolDiagnostics();
  refreshVoiceClients({ quiet: true });
  refreshVoiceLinkSummary({ quiet: true });
  refreshVoiceEventsHistory({ quiet: true });
  restartTimer();
}

// ── TTS settings panel init ───────────────────────────────────────────────────
function initTTSSettings() {
  const providerSel = document.getElementById("tts-provider-select");
  const voiceSel    = document.getElementById("tts-voice-select");
  const testBtn     = document.getElementById("tts-test-btn");
  const testStatus  = document.getElementById("tts-test-status");
  if (!providerSel) return;

  let allVoices = {};

  const credSections = {
    doubao:     document.getElementById("tts-creds-doubao"),
    minimax:    document.getElementById("tts-creds-minimax"),
    openai:     document.getElementById("tts-creds-openai"),
    elevenlabs: document.getElementById("tts-creds-elevenlabs"),
    volcano:    document.getElementById("tts-creds-volcano"),
  };

  function showCredSection(provider) {
    Object.entries(credSections).forEach(([k, el]) => {
      if (el) el.style.display = k === provider ? "" : "none";
    });
  }

  function updateVoiceOptions(provider, savedId) {
    if (!voiceSel) return;
    const voices = allVoices[provider] || [];
    voiceSel.innerHTML = voices.map(v =>
      `<option value="${v.id}">${v.label}</option>`
    ).join("");
    if (savedId && voices.some(v => v.id === savedId)) {
      voiceSel.value = savedId;
    }
  }

  providerSel.addEventListener("change", () => {
    showCredSection(providerSel.value);
    updateVoiceOptions(providerSel.value);
  });

  fetch(`${API}/settings/tts`).then(r => r.json()).then(({ tts, voices }) => {
    if (voices) allVoices = voices;
    const provider = tts?.ttsProvider || "doubao";
    if (tts?.ttsProvider) providerSel.value = tts.ttsProvider;
    else providerSel.value = "doubao";
    updateVoiceOptions(provider, tts?.ttsVoiceId);
    const appidEl = document.getElementById("tts-volcano-appid");
    if (appidEl && tts?.volcanoAppId?.value) appidEl.value = tts.volcanoAppId.value;
    const baseurlEl = document.getElementById("tts-openai-baseurl");
    if (baseurlEl && tts?.openaiTtsBaseURL) baseurlEl.value = tts.openaiTtsBaseURL;
    const maxCharsEl = document.getElementById("tts-speak-max-chars");
    if (maxCharsEl && Number.isFinite(Number(tts?.voiceEventsTtsSpeakMaxTextChars))) maxCharsEl.value = String(tts.voiceEventsTtsSpeakMaxTextChars);
    const cooldownEl = document.getElementById("tts-speak-cooldown-ms");
    if (cooldownEl && Number.isFinite(Number(tts?.voiceEventsTtsSpeakCooldownMs))) cooldownEl.value = String(tts.voiceEventsTtsSpeakCooldownMs);
    showCredSection(provider);
  }).catch(() => {});

  showCredSection(providerSel.value);

  const origSaveBtn = document.getElementById("settings-save-voice");
  if (origSaveBtn) {
    origSaveBtn.addEventListener("click", () => {
      const ttsBody = { ttsProvider: providerSel.value };
      const voiceId  = voiceSel?.value?.trim();
      if (voiceId) ttsBody.ttsVoiceId = voiceId;
      const minimaxKey = document.getElementById("tts-minimax-key")?.value?.trim();
      if (minimaxKey) ttsBody.minimaxKey = minimaxKey;
      const doubaoKey = document.getElementById("tts-doubao-key")?.value?.trim();
      if (doubaoKey) ttsBody.doubaoKey = doubaoKey;
      const openaiKey = document.getElementById("tts-openai-key")?.value?.trim();
      if (openaiKey) ttsBody.openaiTtsKey = openaiKey;
      const baseURL = document.getElementById("tts-openai-baseurl")?.value?.trim();
      if (baseURL) ttsBody.openaiTtsBaseURL = baseURL;
      const elevenKey = document.getElementById("tts-elevenlabs-key")?.value?.trim();
      if (elevenKey) ttsBody.elevenLabsKey = elevenKey;
      const volcanoAppId = document.getElementById("tts-volcano-appid")?.value?.trim();
      if (volcanoAppId) ttsBody.volcanoAppId = volcanoAppId;
      const volcanoToken = document.getElementById("tts-volcano-token")?.value?.trim();
      if (volcanoToken) ttsBody.volcanoToken = volcanoToken;
      const maxChars = Number(document.getElementById("tts-speak-max-chars")?.value);
      if (Number.isFinite(maxChars)) ttsBody.voiceEventsTtsSpeakMaxTextChars = maxChars;
      const cooldownMs = Number(document.getElementById("tts-speak-cooldown-ms")?.value);
      if (Number.isFinite(cooldownMs)) ttsBody.voiceEventsTtsSpeakCooldownMs = cooldownMs;

      fetch(`${API}/settings/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ttsBody),
      }).then(() => {
        ["tts-minimax-key", "tts-doubao-key", "tts-openai-key", "tts-elevenlabs-key", "tts-volcano-token"].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = "";
        });
      }).catch(() => {});
    });
  }

  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      testBtn.disabled = true;
      if (testStatus) testStatus.textContent = "保存配置中…";
      try {
        const preBody = { ttsProvider: providerSel.value };
        const currentVoice = voiceSel?.value?.trim();
        if (currentVoice) preBody.ttsVoiceId = currentVoice;
        const minimaxKey2 = document.getElementById("tts-minimax-key")?.value?.trim();
        if (minimaxKey2) preBody.minimaxKey = minimaxKey2;
        const doubaoKey = document.getElementById("tts-doubao-key")?.value?.trim();
        if (doubaoKey) preBody.doubaoKey = doubaoKey;
        const openaiKey = document.getElementById("tts-openai-key")?.value?.trim();
        if (openaiKey) preBody.openaiTtsKey = openaiKey;
        const elevenKey = document.getElementById("tts-elevenlabs-key")?.value?.trim();
        if (elevenKey) preBody.elevenLabsKey = elevenKey;
        const volcanoAppId = document.getElementById("tts-volcano-appid")?.value?.trim();
        if (volcanoAppId) preBody.volcanoAppId = volcanoAppId;
        const volcanoToken = document.getElementById("tts-volcano-token")?.value?.trim();
        if (volcanoToken) preBody.volcanoToken = volcanoToken;
        const maxChars = Number(document.getElementById("tts-speak-max-chars")?.value);
        if (Number.isFinite(maxChars)) preBody.voiceEventsTtsSpeakMaxTextChars = maxChars;
        const cooldownMs = Number(document.getElementById("tts-speak-cooldown-ms")?.value);
        if (Number.isFinite(cooldownMs)) preBody.voiceEventsTtsSpeakCooldownMs = cooldownMs;
        await fetch(`${API}/settings/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preBody),
        });
        if (testStatus) testStatus.textContent = "合成中…";
        const ttsResp = await fetch(`${API}/tts/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "你好，这是一段语音合成测试，听起来清晰自然吗？" }),
        });
        if (!ttsResp.ok) {
          let errMsg = `合成失败（HTTP ${ttsResp.status}）`;
          try { const j = await ttsResp.json(); errMsg = j.error || errMsg; } catch {}
          if (testStatus) testStatus.textContent = errMsg;
          return;
        }
        const ttsBlob = await ttsResp.blob();
        if (ttsBlob.size === 0) {
          if (testStatus) testStatus.textContent = "合成失败：接口返回空数据，请检查 API Key 和账户配置。";
          return;
        }
        const ttsUrl = URL.createObjectURL(ttsBlob);
        const ttsAudio = new Audio(ttsUrl);
        ttsAudio.onended = () => { URL.revokeObjectURL(ttsUrl); if (testStatus) testStatus.textContent = ""; };
        ttsAudio.onerror = () => { URL.revokeObjectURL(ttsUrl); if (testStatus) testStatus.textContent = "播放失败"; };
        await ttsAudio.play();
        if (testStatus) testStatus.textContent = "播放中";
        setTimeout(() => { if (testStatus && testStatus.textContent === "播放中") testStatus.textContent = ""; }, 8000);
      } catch {
        if (testStatus) testStatus.textContent = "失败 — 请检查配置和 API Key";
      } finally {
        testBtn.disabled = false;
      }
    });
  }
}

// ── Settings modal ──
(function initSettings() {
  const settingsBtn     = document.getElementById("settings-btn");
  const overlay         = document.getElementById("settings-overlay");
  const closeBtn        = document.getElementById("settings-close");
  const providerSelect  = document.getElementById("settings-provider-select");
  const modelSelect     = document.getElementById("settings-model-select");
  const llmKeyInput     = document.getElementById("settings-llm-key");
  const saveLlmBtn      = document.getElementById("settings-save-llm");
  const llmFeedback     = document.getElementById("settings-llm-feedback");
  const tempSlider      = document.getElementById("settings-temperature");
  const tempVal         = document.getElementById("settings-temperature-val");
  const saveTempBtn     = document.getElementById("settings-save-temperature");
  const tempFeedback    = document.getElementById("settings-temperature-feedback");
  const minimaxKeyInput = document.getElementById("settings-minimax-key");
  const saveMinimaxBtn  = document.getElementById("settings-save-minimax");
  const minimaxFeedback = document.getElementById("settings-minimax-feedback");
  const saveSocialBtn   = document.getElementById("settings-save-social");
  const socialFeedback  = document.getElementById("settings-social-feedback");
  const saveVoiceBtn    = document.getElementById("settings-save-voice");
  const voiceFeedback   = document.getElementById("settings-voice-feedback");
  const voiceThreshSlider = document.getElementById("settings-voice-threshold");
  const voiceThreshVal    = document.getElementById("settings-voice-threshold-val");

  if (!settingsBtn || !overlay) return;

  let cachedProviders = null;

  overlay.querySelectorAll(".settings-nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      overlay.querySelectorAll(".settings-nav-item").forEach(b => b.classList.remove("active"));
      overlay.querySelectorAll(".settings-tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      overlay.querySelector(`.settings-tab[data-tab="${tab}"]`)?.classList.add("active");
      if (tab === "social") loadSocialSettings();
      if (tab === "security") loadSecuritySettings();
      if (tab === "web-search") loadWebSearchSettings();
      if (tab === "update") loadUpdateSettings();
    });
  });

  function showFeedback(el, msg, isError = false) {
    if (!el) return;
    el.textContent = msg;
    el.className = "settings-feedback" + (isError ? " error" : "");
    setTimeout(() => { el.textContent = ""; el.className = "settings-feedback"; }, 3000);
  }

  function refreshConfigSummary({ llm, minimax }) {
    const cfgLlm = document.getElementById("settings-cfg-llm");
    const cfgLlmDot = document.getElementById("settings-cfg-llm-dot");
    const cfgMedia = document.getElementById("settings-cfg-media");
    const cfgMediaDot = document.getElementById("settings-cfg-media-dot");
    if (cfgLlm) cfgLlm.textContent = `${llm.provider || "—"} · ${llm.model || "—"}`;
    if (cfgLlmDot) {
      cfgLlmDot.textContent = "●";
      cfgLlmDot.className = `settings-config-dot ${llm.activated ? "active" : "inactive"}`;
      cfgLlmDot.title = llm.activated ? "Running" : "Inactive";
    }
    if (cfgMedia) cfgMedia.textContent = `minimax · ${minimax.configured ? "configured" : "not configured"}`;
    if (cfgMediaDot) {
      cfgMediaDot.textContent = "●";
      cfgMediaDot.className = `settings-config-dot ${minimax.configured ? "active" : "inactive"}`;
    }
  }

  function populateModelSelect(models, current) {
    if (!modelSelect || !models) return;
    modelSelect.innerHTML = models
      .map(m => `<option value="${m.id}"${m.deprecated ? " data-deprecated" : ""}>${m.label}</option>`)
      .join("");
    if (current) modelSelect.value = current;
  }

  function populateProviderSelect(providers, current) {
    if (!providerSelect || !providers) return;
    const selected = current || providerSelect.value || "auto";
    const options = [`<option value="auto">Auto-detect</option>`]
      .concat(Object.entries(providers).map(([id, provider]) => {
        const label = provider.label || id;
        return `<option value="${id}">${label}</option>`;
      }));
    providerSelect.innerHTML = options.join("");
    providerSelect.value = providers[selected] || selected === "auto" ? selected : "auto";
  }

  function applyCustomProviderUI(llm) {
    const customSection = document.getElementById("settings-custom-llm-section");
    const modelRow = document.getElementById("settings-model-row");
    if (llm?.provider === "custom") {
      if (customSection) customSection.style.display = "";
      if (modelRow) modelRow.style.display = "none";
      const baseUrlEl = document.getElementById("settings-custom-baseurl");
      const modelEl = document.getElementById("settings-custom-model");
      if (baseUrlEl && llm.baseURL) baseUrlEl.value = llm.baseURL;
      if (modelEl && llm.model) modelEl.value = llm.model;
    } else {
      if (customSection) customSection.style.display = "none";
      if (modelRow) modelRow.style.display = "";
    }
  }

  async function loadSettings() {
    try {
      const data = await fetch(`${API}/settings`).then(r => r.json());
      const { llm, minimax, providers } = data;
      if (providers) cachedProviders = providers;
      refreshConfigSummary({ llm, minimax });
      populateProviderSelect(providers, llm.provider || "auto");
      if (providerSelect && llm.provider) providerSelect.value = llm.provider;
      applyCustomProviderUI(llm);
      if (llm.provider !== "custom") populateModelSelect(llm.models, llm.model);
      if (typeof llm.temperature === "number" && tempSlider) {
        tempSlider.value = String(llm.temperature);
        if (tempVal) tempVal.textContent = llm.temperature.toFixed(2);
      }
    } catch {}
  }

  const SOCIAL_FIELD_MAP = {
    "social-discord-token":  "DISCORD_BOT_TOKEN",
    "social-feishu-appid":   "FEISHU_APP_ID",
    "social-feishu-secret":  "FEISHU_APP_SECRET",
    "social-feishu-token":   "FEISHU_VERIFICATION_TOKEN",
    "social-wechat-appid":   "WECHAT_OFFICIAL_APP_ID",
    "social-wechat-secret":  "WECHAT_OFFICIAL_APP_SECRET",
    "social-wechat-token":   "WECHAT_OFFICIAL_TOKEN",
    "social-wecom-botkey":   "WECOM_BOT_KEY",
    "social-wecom-token":    "WECOM_INCOMING_TOKEN",
  };

  const SOCIAL_PLATFORM_STATUS = {
    "social-status-discord": ["DISCORD_BOT_TOKEN"],
    "social-status-feishu":  ["FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_VERIFICATION_TOKEN"],
    "social-status-wechat":  ["WECHAT_OFFICIAL_APP_ID", "WECHAT_OFFICIAL_APP_SECRET", "WECHAT_OFFICIAL_TOKEN"],
    "social-status-wecom":   ["WECOM_BOT_KEY", "WECOM_INCOMING_TOKEN"],
  };

  async function loadSocialSettings() {
    try {
      const { social } = await fetch(`${API}/settings/social`).then(r => r.json());
      for (const [statusId, keys] of Object.entries(SOCIAL_PLATFORM_STATUS)) {
        const el = document.getElementById(statusId);
        if (!el) continue;
        const configuredCount = keys.filter(k => social[k]?.configured).length;
        if (configuredCount === keys.length) {
          el.textContent = "● 已配置";
          el.className = "settings-platform-status ok";
        } else if (configuredCount > 0) {
          el.textContent = `● 部分配置 (${configuredCount}/${keys.length})`;
          el.className = "settings-platform-status miss";
        } else {
          el.textContent = "○ 未配置";
          el.className = "settings-platform-status miss";
        }
      }
    } catch {}
  }

  const fileSandboxToggle = document.getElementById("security-file-sandbox");
  const execSandboxToggle = document.getElementById("security-exec-sandbox");
  const saveSecurityBtn   = document.getElementById("settings-save-security");
  const securityFeedback  = document.getElementById("settings-security-feedback");

  async function loadWebSearchSettings() {
    try {
      const { webSearch } = await fetch(`${API}/settings/web-search`).then(r => r.json());
      const urlEl = document.getElementById("websearch-searxng-url");
      if (urlEl) urlEl.value = webSearch?.searxngUrl || "";
      const setStatus = (id, configured, fromEnv, extra) => {
        const el = document.getElementById(id);
        if (!el) return;
        const truncated = extra && extra.length > 60 ? extra.slice(0, 60) + "…" : extra;
        if (configured) {
          el.textContent = `已配置${fromEnv ? "（环境变量）" : ""}${truncated ? ` · ${truncated}` : ""}`;
          el.style.color = "var(--ok, #4caf50)";
        } else {
          el.textContent = "未配置（兜底链中跳过）";
          el.style.color = "var(--ink2)";
        }
      };
      setStatus("websearch-status-serper",  !!webSearch?.serperConfigured, !!webSearch?.serperFromEnv);
      setStatus("websearch-status-jina",    !!webSearch?.jinaConfigured,   !!webSearch?.jinaFromEnv);
      const searxngConfigured = !!webSearch?.searxngUrl || !!webSearch?.searxngFromEnv;
      setStatus("websearch-status-searxng", searxngConfigured, !!webSearch?.searxngFromEnv, webSearch?.effectiveSearxngUrl || "");
    } catch {}
  }

  const saveWebSearchBtn = document.getElementById("settings-save-web-search");
  const webSearchFeedback = document.getElementById("settings-web-search-feedback");
  if (saveWebSearchBtn) {
    saveWebSearchBtn.addEventListener("click", async () => {
      const updates = {};
      const serperEl  = document.getElementById("websearch-serper-key");
      const jinaEl    = document.getElementById("websearch-jina-key");
      const searxngEl = document.getElementById("websearch-searxng-url");
      const serperVal  = serperEl?.value?.trim();
      const jinaVal    = jinaEl?.value?.trim();
      const searxngVal = searxngEl?.value?.trim();
      if (serperVal)  updates.serperKey  = serperVal;
      if (jinaVal)    updates.jinaKey    = jinaVal;
      // SearXNG URL：空字符串也要传，让用户能清掉
      if (searxngEl)  updates.searxngUrl = searxngVal || "";
      saveWebSearchBtn.disabled = true;
      try {
        const res = await fetch(`${API}/settings/web-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (data.ok) {
          showFeedback(webSearchFeedback, "已保存");
          if (serperEl) serperEl.value = "";
          if (jinaEl)   jinaEl.value = "";
          loadWebSearchSettings();
        } else {
          showFeedback(webSearchFeedback, data.error || "保存失败", true);
        }
      } catch {
        showFeedback(webSearchFeedback, "请求失败", true);
      } finally {
        saveWebSearchBtn.disabled = false;
      }
    });
  }

  async function loadSecuritySettings() {
    try {
      const { security } = await fetch(`${API}/settings/security`).then(r => r.json());
      if (fileSandboxToggle) fileSandboxToggle.checked = security.fileSandbox !== false;
      if (execSandboxToggle) execSandboxToggle.checked = security.execSandbox !== false;
      document.querySelectorAll(".security-blocked-tool").forEach(cb => {
        cb.checked = (security.blockedTools || []).includes(cb.value);
      });
    } catch {}
  }

  if (saveSecurityBtn) {
    saveSecurityBtn.addEventListener("click", async () => {
      const blockedTools = [...document.querySelectorAll(".security-blocked-tool")]
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      const body = {
        fileSandbox: fileSandboxToggle ? fileSandboxToggle.checked : true,
        execSandbox: execSandboxToggle ? execSandboxToggle.checked : true,
        blockedTools,
      };
      saveSecurityBtn.disabled = true;
      try {
        const res = await fetch(`${API}/settings/security`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.ok) {
          showFeedback(securityFeedback, "已保存 — 立即生效");
        } else {
          showFeedback(securityFeedback, data.error || "保存失败", true);
        }
      } catch {
        showFeedback(securityFeedback, "请求失败", true);
      } finally {
        saveSecurityBtn.disabled = false;
      }
    });
  }

  if (saveSocialBtn) {
    saveSocialBtn.addEventListener("click", async () => {
      const updates = {};
      for (const [fieldId, envKey] of Object.entries(SOCIAL_FIELD_MAP)) {
        const val = document.getElementById(fieldId)?.value?.trim() || "";
        if (val) updates[envKey] = val;
      }
      saveSocialBtn.disabled = true;
      try {
        const res = await fetch(`${API}/settings/social`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (data.ok) {
          showFeedback(socialFeedback, "已保存");
          Object.keys(SOCIAL_FIELD_MAP).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
          });
          loadSocialSettings();
        } else {
          showFeedback(socialFeedback, data.error || "保存失败", true);
        }
      } catch {
        showFeedback(socialFeedback, "请求失败", true);
      } finally {
        saveSocialBtn.disabled = false;
      }
    });
  }

  if (tempSlider && tempVal) {
    tempSlider.addEventListener("input", () => {
      tempVal.textContent = parseFloat(tempSlider.value).toFixed(2);
    });
  }
  if (saveTempBtn) {
    saveTempBtn.addEventListener("click", async () => {
      const temperature = parseFloat(tempSlider?.value ?? "0.5");
      saveTempBtn.disabled = true;
      try {
        const res = await fetch(`${API}/settings/temperature`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ temperature }),
        });
        const data = await res.json();
        if (data.ok) {
          showFeedback(tempFeedback, `已设为 ${data.temperature.toFixed(2)}`);
        } else {
          showFeedback(tempFeedback, data.error || "保存失败", true);
        }
      } catch { showFeedback(tempFeedback, "请求失败", true); }
      finally { saveTempBtn.disabled = false; }
    });
  }

  const VOICE_LANG_KEY       = "bailongma-voice-lang";
  const VOICE_AUTO_SEND_KEY  = "bailongma-voice-auto-send";
  const VOICE_AUTO_MIC_KEY   = "bailongma-voice-auto-mic";
  const VOICE_THRESHOLD_KEY  = "bailongma-voice-threshold";
  const VOICE_PROVIDER_KEY   = "bailongma-voice-provider";
  const VOICE_WHISPER_MODEL_KEY = "bailongma-voice-whisper-model"; // 兼容旧版本
  const VOICE_LOCAL_ASR_MODEL_KEY = "bailongma-voice-local-asr-model";
  const VOICE_ASR_PROFILE_KEY = "bailongma-voice-asr-profile";
  const VOICE_WAKE_ENABLED_KEY = "bailongma-voice-wake-enabled";
  const VOICE_WAKE_DETECTION_PROVIDER_KEY = "bailongma-voice-wake-detection-provider";
  const VOICE_KWS_ENGINE_KEY = "bailongma-voice-kws-engine";
  const VOICE_KWS_MODEL_PATH_KEY = "bailongma-voice-kws-model-path";
  const VOICE_KWS_THRESHOLD_KEY = "bailongma-voice-kws-threshold";
  const VOICE_WAKE_WORDS_KEY = "bailongma-voice-wake-words";
  const VOICE_WAKE_MODE_KEY = "bailongma-voice-wake-mode";
  const VOICE_WAKE_WINDOW_KEY = "bailongma-voice-wake-window-seconds";
  const VOICE_WAKE_REPEAT_SUPPRESS_KEY = "bailongma-voice-wake-repeat-suppression";
  const VOICE_WAKE_CONFIDENCE_KEY = "bailongma-voice-wake-confidence-threshold";
  const VOICE_WAKE_MIN_COMMAND_KEY = "bailongma-voice-wake-min-command-chars";
  const VOICE_WAKE_COOLDOWN_KEY = "bailongma-voice-wake-cooldown-ms";
  const VOICE_WAKE_REQUIRE_SPEAKER_KEY = "bailongma-voice-wake-require-speaker";
  const VOICE_SPEAKER_VERIFY_KEY = "bailongma-voice-speaker-verify";
  const VOICE_SPEAKER_THRESHOLD_KEY = "bailongma-voice-speaker-threshold";
  const VOICE_VIDEO_DUCK_KEY = "bailongma-voice-video-duck";
  const VOICE_VIDEO_PTT_KEY = "bailongma-voice-video-ptt";
  const VOICE_VIDEO_DUCK_LEVEL_KEY = "bailongma-voice-video-duck-level";
  const VOICE_VIDEO_DUCK_HOLD_KEY = "bailongma-voice-video-duck-hold";
  const VOICE_VIDEO_AEC_KEY = "bailongma-voice-video-aec";
  const VOICE_VIDEO_DUCK_SENSITIVITY_KEY = "bailongma-voice-video-duck-sensitivity";
  const VOICE_VIDEO_PREROLL_ENABLED_KEY = "bailongma-voice-video-preroll-enabled";
  const VOICE_VIDEO_PREROLL_MS_KEY = "bailongma-voice-video-preroll-ms";
  const VOICE_DEBUG_ENABLED_KEY = "bailongma-voice-debug-enabled";
  const VOICE_LOCAL_DEFAULT_MIGRATION_KEY = "bailongma-voice-local-default-v1";

  function applyVoiceProviderUI(provider) {
    const panels = { local: "voice-cred-local", aliyun: "voice-cred-aliyun", tencent: "voice-cred-tencent", xunfei: "voice-cred-xunfei" };
    for (const [key, id] of Object.entries(panels)) {
      const el = document.getElementById(id);
      if (el) el.style.display = key === provider ? "" : "none";
    }
  }

  const voiceProviderSelect = document.getElementById("voice-provider-select");
  if (voiceProviderSelect) {
    voiceProviderSelect.addEventListener("change", () => {
      applyVoiceProviderUI(voiceProviderSelect.value);
      refreshVoiceLocalDoctor();
    });
  }
  document.getElementById("voice-local-doctor-refresh")?.addEventListener("click", refreshVoiceLocalDoctor);
  document.getElementById("voice-readiness-apply")?.addEventListener("click", applyVoiceReadinessWizard);
  document.getElementById("voice-self-test-start")?.addEventListener("click", startVoiceSelfTest);
  document.getElementById("voice-local-overview-actions")?.addEventListener("click", handleVoiceOverviewAction);
  document.getElementById("voice-local-stop")?.addEventListener("click", stopLocalVoiceService);
  document.getElementById("voice-kws-refresh")?.addEventListener("click", refreshVoiceKwsStatus);
  document.getElementById("voice-kws-install-openwakeword")?.addEventListener("click", installOpenWakeWordRuntime);
  document.getElementById("voice-kws-apply-openwakeword")?.addEventListener("click", applyOpenWakeWordConfig);
  document.getElementById("voice-local-restart")?.addEventListener("click", restartLocalVoiceService);
  document.getElementById("voice-diagnostics-export")?.addEventListener("click", exportLocalVoiceDiagnostics);
  document.getElementById("voice-calibrate-speaker")?.addEventListener("click", () => refreshSpeakerCalibration({ apply: false }));
  let voiceSelfTestSince = 0;


  function renderVoiceKwsStatus(status = {}) {
    if (!status || status.ok === false) return `<div class="voice-readiness-step voice-readiness-step-warn"><span>warn</span><div><strong>KWS 状态</strong><em>${escapeFocusText(status?.error || "无法读取 KWS 状态")}</em></div></div>`;
    const dep = status.dependency?.openwakeword || {};
    const rows = [
      { status: status.runtimeReady ? "ok" : status.enabled ? "warn" : "info", label: "运行状态", detail: status.runtimeReady ? "openWakeWord 本地 KWS 已准备好。" : status.nextAction || "当前未启用 KWS。" },
      { status: status.modelExists ? "ok" : status.configuredPath ? "warn" : "info", label: "模型文件", detail: status.configuredPath ? `${status.configuredPath}${status.modelExists ? " · 已找到" : " · 不存在"}` : "尚未填写模型路径。" },
      { status: dep.ok ? "ok" : status.engine === "openwakeword" ? "warn" : "info", label: "openWakeWord 依赖", detail: dep.ok ? `可用：${dep.python || "python"}` : (dep.error || "未检测或未选择 openWakeWord。") },
    ];
    return rows.map(item => `<div class="voice-readiness-step voice-readiness-step-${escapeFocusText(item.status)}"><span>${escapeFocusText(item.status)}</span><div><strong>${escapeFocusText(item.label)}</strong><em>${escapeFocusText(item.detail)}</em></div></div>`).join("");
  }

  async function refreshVoiceKwsStatus() {
    const el = document.getElementById("voice-kws-status");
    if (!el) return null;
    el.innerHTML = '<div class="voice-clients-empty">正在检测 KWS…</div>';
    try {
      const resp = await fetch(`${API}/voice/local/kws/status`);
      const data = await resp.json();
      if (!resp.ok || data?.ok === false) throw new Error(data?.error || "KWS 检测失败");
      el.innerHTML = renderVoiceKwsStatus(data);
      return data;
    } catch (err) {
      el.innerHTML = renderVoiceKwsStatus({ ok: false, error: err?.message || "KWS 检测失败" });
      return null;
    }
  }

  async function installOpenWakeWordRuntime() {
    const btn = document.getElementById("voice-kws-install-openwakeword");
    const fb = document.getElementById("voice-kws-feedback");
    if (btn) btn.disabled = true;
    showFeedback(fb, "正在安装 openWakeWord/onnxruntime，可能需要几分钟…");
    try {
      const resp = await fetch(`${API}/voice/local/kws/install-openwakeword`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok || data?.ok === false) throw new Error(data?.stderr || data?.error || "安装失败");
      showFeedback(fb, "openWakeWord 依赖已安装，请配置 .onnx 模型路径后检测。");
      await refreshVoiceKwsStatus();
    } catch (err) {
      showFeedback(fb, err?.message || "安装失败", true);
      await refreshVoiceKwsStatus();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function applyOpenWakeWordConfig() {
    const btn = document.getElementById("voice-kws-apply-openwakeword");
    const fb = document.getElementById("voice-kws-feedback");
    const modelPath = document.getElementById("voice-kws-model-path")?.value?.trim() || "";
    const threshold = Math.max(0.10, Math.min(0.99, Number(document.getElementById("voice-kws-threshold")?.value || 0.50) || 0.50));
    if (btn) btn.disabled = true;
    showFeedback(fb, "正在保存 openWakeWord KWS 配置…");
    try {
      const resp = await fetch(`${API}/voice/local/kws/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "hybrid", modelPath, threshold }),
      });
      const data = await resp.json();
      if (!resp.ok || data?.ok === false) throw new Error(data?.error || "保存失败");
      if (data.voice) hydrateVoiceControlsFromConfig(data.voice);
      showFeedback(fb, data.status?.runtimeReady ? "KWS 配置已可用" : "KWS 配置已保存，请按提示补齐依赖/模型");
      await refreshVoiceKwsStatus();
    } catch (err) {
      showFeedback(fb, err?.message || "保存失败", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderVoiceOverview(overview = {}) {
    const panel = document.getElementById("voice-local-overview");
    const title = document.getElementById("voice-local-overview-title");
    const level = document.getElementById("voice-local-overview-level");
    const summary = document.getElementById("voice-local-overview-summary");
    const actions = document.getElementById("voice-local-overview-actions");
    if (!panel || !title || !level || !summary || !actions) return;
    panel.hidden = false;
    panel.className = `voice-local-overview voice-local-overview-${escapeFocusText(overview.level || "pending")}`;
    title.textContent = overview.title || "本地语音总览";
    level.textContent = overview.level || "pending";
    summary.textContent = overview.summary || "暂无状态。";
    const issueHtml = Array.isArray(overview.issues) && overview.issues.length ? `<div class="voice-local-overview-issues">${overview.issues.slice(0, 3).map(item => `<span>${escapeFocusText(item)}</span>`).join("")}</div>` : "";
    const mic = window.bailongmaVoice?.getMicMonitor?.() || window.bailongmaVoiceMicMonitor || null;
    const micHtml = mic ? renderVoiceOverviewMicStatus(mic) : "";
    const action = overview.primaryAction || {};
    const buttonHtml = action.id && action.id !== "ready" ? `<button class="voice-readiness-action" data-overview-action="${escapeFocusText(action.id)}" type="button">${escapeFocusText(action.label || "处理")}</button>` : `<span class="voice-local-overview-ready">${escapeFocusText(action.label || "可以使用")}</span>`;
    actions.innerHTML = `${issueHtml}${micHtml}${buttonHtml}<em>${escapeFocusText(action.action || "")}</em>`;
  }

  function renderVoiceOverviewMicStatus(mic = {}) {
    const threshold = Math.max(0.002, Math.min(0.04, Number(mic.threshold || localStorage.getItem("bailongma-voice-threshold") || 0.008) || 0.008));
    const peak = Math.max(0, Number(mic.peak || mic.current || 0) || 0);
    const current = Math.max(0, Number(mic.current || 0) || 0);
    const stale = !mic.updatedAt || Date.now() - Number(mic.updatedAt) > 5000;
    let level = "pending";
    let text = "麦克风：等待自检";
    if (!mic.active && stale) {
      level = "warn";
      text = "麦克风：未开启/无实时音量";
    } else if (peak >= threshold || current >= threshold) {
      level = "ok";
      text = `麦克风：已听见你（峰值 ${peak.toFixed(3)} / 阈值 ${threshold.toFixed(3)}）`;
    } else if (peak > 0) {
      level = "warn";
      text = `麦克风：低于阈值（峰值 ${peak.toFixed(3)} / 阈值 ${threshold.toFixed(3)}）`;
    }
    return `<div class="voice-local-overview-mic voice-local-overview-mic-${level}">${escapeFocusText(text)}</div>`;
  }

  async function refreshVoiceOverview() {
    try {
      const resp = await fetch(`${API}/voice/local/overview?windowMs=60000`);
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "本地语音总览失败");
      renderVoiceOverview(data);
    } catch (err) {
      renderVoiceOverview({ level: "warn", title: "本地语音总览失败", summary: err?.message || "读取失败", issues: [err?.message || "读取失败"], primaryAction: { id: "prepare", label: "一键准备", action: "尝试重新准备本地语音。" } });
    }
  }

  function handleVoiceOverviewAction(event) {
    const action = event.target?.dataset?.overviewAction;
    if (!action) return;
    if (action === "prepare") document.getElementById("voice-readiness-apply")?.click();
    else if (action === "self_test") document.getElementById("voice-self-test-start")?.click();
    else if (action === "enroll_speaker") document.getElementById("voice-enroll-speaker")?.click();
  }

  async function exportLocalVoiceDiagnostics() {
    const btn = document.getElementById("voice-diagnostics-export");
    const fb = document.getElementById("voice-diagnostics-feedback");
    if (btn) btn.disabled = true;
    showFeedback(fb, "正在生成本地语音诊断包…");
    try {
      const resp = await fetch(`${API}/voice/local/diagnostics/package?windowMs=60000`);
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "诊断包生成失败");
      const text = JSON.stringify(data, null, 2);
      window.__lastVoiceDiagnosticsPackage = text;
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch (_) {}
      }
      if (!copied) {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "readonly");
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          copied = document.execCommand?.("copy") !== false;
          ta.remove();
        } catch (_) {}
      }
      if (copied) {
        showFeedback(fb, `诊断包已复制：${data.app?.version || "unknown"} · ${data.events?.recent?.length || 0} 条事件`);
      } else {
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        showFeedback(fb, "诊断包已打开新窗口，请复制保存");
      }
    } catch (err) {
      showFeedback(fb, err?.message || "诊断包导出失败", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function stopLocalVoiceService() {
    const btn = document.getElementById("voice-local-stop");
    const fb = document.getElementById("voice-local-service-feedback");
    if (btn) btn.disabled = true;
    showFeedback(fb, "正在停止或取消跟踪本地服务…");
    try {
      const resp = await fetch(`${API}/voice/local/stop`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "停止失败");
      showFeedback(fb, data.external ? "已取消跟踪复用服务" : "本地语音服务已停止");
      await refreshVoiceOverview();
      await refreshVoiceReadinessWizard();
      await refreshVoiceOverview();
      await refreshVoiceLocalDoctor();
      await refreshSpeakerStatus();
      await refreshVoiceSelfTest();
    } catch (err) {
      showFeedback(fb, err?.message || "停止失败", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function restartLocalVoiceService() {
    const btn = document.getElementById("voice-local-restart");
    const fb = document.getElementById("voice-local-service-feedback");
    if (btn) btn.disabled = true;
    showFeedback(fb, "正在按当前模型重启本地服务…");
    try {
      const model = document.getElementById("voice-local-asr-model")?.value || localStorage.getItem(VOICE_LOCAL_ASR_MODEL_KEY) || "sensevoice-small";
      const profile = document.getElementById("voice-asr-profile")?.value || localStorage.getItem(VOICE_ASR_PROFILE_KEY) || "balanced";
      const resp = await fetch(`${API}/voice/local/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localAsrModel: model, model, asrProfile: profile }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "重启失败");
      showFeedback(fb, data.requiresManualStop ? "已取消跟踪复用服务；请先停止旧的 3723 服务后再启动当前模型" : `已请求重启：${data.engineLabel || data.engine || model}`);
      setTimeout(refreshVoiceOverview, 700);
      setTimeout(refreshVoiceReadinessWizard, 800);
      setTimeout(refreshVoiceLocalDoctor, 1000);
      setTimeout(refreshSpeakerStatus, 1100);
    } catch (err) {
      showFeedback(fb, err?.message || "重启失败", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderVoiceSelfTest(test = {}) {
    const steps = Array.isArray(test.steps) ? test.steps : [];
    if (!steps.length) return '<div class="voice-clients-empty">还没有开始实测。</div>';
    const header = `<div class="voice-readiness-helper">${escapeFocusText(test.instruction || "请说：龙马，测试一下")}</div>`;
    const external = test.local?.external ? '<div class="voice-readiness-helper voice-readiness-external">本地服务：复用已运行服务。</div>' : "";
    const eventHint = Array.isArray(test.events) && test.events.length ? `<div class="voice-self-test-events">最近事件：${test.events.slice(-5).map(item => escapeFocusText(item.event?.type || item.type || "event")).join(" / ")}</div>` : "";
    return header + external + steps.map(item => `<div class="voice-readiness-step voice-readiness-step-${escapeFocusText(item.status || "pending")}">
      <span>${escapeFocusText(item.status || "pending")}</span>
      <div><strong>${escapeFocusText(item.label || item.id || "检查项")}</strong><em>${escapeFocusText(item.detail || item.action || "")}</em></div>
    </div>`).join("") + eventHint;
  }

  async function refreshVoiceSelfTest() {
    const panel = document.getElementById("voice-self-test");
    const list = document.getElementById("voice-self-test-list");
    if (!panel || !list) return;
    panel.hidden = false;
    try {
      const since = voiceSelfTestSince || (Date.now() - 60000);
      const resp = await fetch(`${API}/voice/local/self-test?since=${encodeURIComponent(String(since))}`);
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "语音实测失败");
      list.innerHTML = renderVoiceSelfTest(data);
      const fb = document.getElementById("voice-self-test-feedback");
      if (fb) fb.textContent = data.level === "ok" ? "闭环通过" : data.level === "warn" ? "部分通过，请看提示" : "等待你说唤醒词";
      refreshVoiceOverview();
    } catch (err) {
      list.innerHTML = `<div class="voice-clients-error">${escapeFocusText(err?.message || "语音实测失败")}</div>`;
    }
  }

  async function startVoiceSelfTest() {
    const btn = document.getElementById("voice-self-test-start");
    const fb = document.getElementById("voice-self-test-feedback");
    if (btn) btn.disabled = true;
    showFeedback(fb, "实测已开始，请说：龙马，测试一下");
    try {
      const resp = await fetch(`${API}/voice/local/self-test/start`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "开始实测失败");
      voiceSelfTestSince = Number(data.since || Date.now());
      const list = document.getElementById("voice-self-test-list");
      if (list) list.innerHTML = renderVoiceSelfTest(data.selfTest || {});
      setTimeout(refreshVoiceSelfTest, 2500);
      setTimeout(refreshVoiceSelfTest, 7000);
    } catch (err) {
      showFeedback(fb, err?.message || "开始实测失败", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderVoiceReadinessWizard(readiness = {}) {
    const steps = Array.isArray(readiness.steps) ? readiness.steps : [];
    if (!steps.length) return '<div class="voice-clients-empty">暂无一键准备检查数据。</div>';
    const preset = readiness.recommendedPreset;
    const helper = preset?.label ? `<div class="voice-readiness-helper">推荐基线：${escapeFocusText(preset.label)} · ${escapeFocusText(preset.reason || "先建立稳定语音基线，再微调声纹。")}</div>` : "";
    const external = readiness.local?.external ? '<div class="voice-readiness-helper voice-readiness-external">本地服务：复用已运行服务。不会重复启动；如需切换模型，请先停止旧服务。</div>' : "";
    return helper + external + steps.map(item => `<div class="voice-readiness-step voice-readiness-step-${escapeFocusText(item.status || "pending")}">
      <span>${escapeFocusText(item.status || "pending")}</span>
      <div><strong>${escapeFocusText(item.label || item.id || "步骤")}</strong><em>${escapeFocusText(item.detail || item.action || "")}</em></div>
      ${item.uiAction === "enroll_speaker" ? '<button class="voice-readiness-action" data-action="enroll_speaker" type="button">去录入</button>' : ""}
      ${item.uiAction === "test_speaker" ? '<button class="voice-readiness-action" data-action="test_speaker" type="button">测试声纹</button>' : ""}
      ${item.fixAction === "disable_speaker_gate" ? '<button class="voice-readiness-action" data-action="disable_speaker_gate" type="button">关闭防锁死</button>' : ""}
    </div>`).join("");
  }

  function bindVoiceReadinessActions() {
    document.querySelectorAll(".voice-readiness-action").forEach(btn => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.action || "";
        if (action === "enroll_speaker") {
          document.getElementById("voice-enroll-speaker")?.click();
          return;
        }
        if (action === "test_speaker") {
          document.getElementById("voice-test-speaker")?.click();
          return;
        }
        if (action === "disable_speaker_gate") {
          btn.disabled = true;
          btn.textContent = "处理中…";
          try {
            const resp = await fetch(`${API}/voice/local/doctor/fix`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "disable_speaker_gate" }),
            });
            const data = await resp.json();
            if (!resp.ok || !data?.ok) throw new Error(data?.error || "关闭失败");
            if (data.voice) hydrateVoiceControlsFromConfig(data.voice);
            await refreshVoiceReadinessWizard();
            await refreshVoiceLocalDoctor();
            await refreshSpeakerStatus();
          } catch (err) {
            btn.textContent = err?.message || "关闭失败";
            setTimeout(() => { btn.textContent = "关闭防锁死"; btn.disabled = false; }, 2500);
          }
        }
      });
    });
  }

  async function refreshVoiceReadinessWizard() {
    const panel = document.getElementById("voice-readiness-wizard");
    const list = document.getElementById("voice-readiness-list");
    if (!panel || !list) return;
    panel.hidden = false;
    list.innerHTML = '<div class="voice-clients-empty">正在生成语音准备清单…</div>';
    try {
      const resp = await fetch(`${API}/voice/local/readiness?windowMs=60000`);
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "语音准备检查失败");
      list.innerHTML = renderVoiceReadinessWizard(data);
      bindVoiceReadinessActions();
      const fb = document.getElementById("voice-readiness-feedback");
      if (fb) fb.textContent = data.level === "ok" ? "语音基础链路已准备好" : "建议点击一键准备补齐基础项";
    } catch (err) {
      list.innerHTML = `<div class="voice-clients-error">${escapeFocusText(err?.message || "语音准备检查失败")}</div>`;
    }
  }

  async function applyVoiceReadinessWizard() {
    const btn = document.getElementById("voice-readiness-apply");
    const fb = document.getElementById("voice-readiness-feedback");
    if (btn) btn.disabled = true;
    showFeedback(fb, "正在应用本地语音稳定基线…");
    try {
      const resp = await fetch(`${API}/voice/local/readiness/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: "balanced", enableSpeaker: false }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "一键准备失败");
      if (data.voice) hydrateVoiceControlsFromConfig(data.voice);
      await refreshVoiceOverview();
      await refreshVoiceReadinessWizard();
      showFeedback(fb, data.speaker?.skipped ? `已应用本地语音基线：${data.started?.engineLabel || data.started?.engine || "SenseVoice"}；声纹未录入，已保持关闭防锁死` : `已应用本地语音基线：${data.started?.engineLabel || data.started?.engine || "SenseVoice"}`);
      await refreshVoiceLocalDoctor();
      await refreshSpeakerStatus();
      await refreshVoiceSelfTest();
      await loadVoiceStabilityPresets();
    } catch (err) {
      showFeedback(fb, err?.message || "一键准备失败", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }


  function renderVoiceLocalDoctor(doctor = {}) {
    const checks = Array.isArray(doctor.checks) ? doctor.checks : [];
    if (!checks.length) return '<div class="voice-clients-empty">暂无本地语音体检数据。</div>';
    const checkHtml = checks.map(item => `<div class="voice-local-doctor-item voice-local-doctor-item-${escapeFocusText(item.status || "pending")}">
      <span>${escapeFocusText(item.status || "pending")}</span>
      <div><strong>${escapeFocusText(item.label || item.id || "检查项")}</strong><em>${escapeFocusText(item.detail || "")}${item.action ? ` · ${escapeFocusText(item.action)}` : ""}</em></div>
      ${item.fixAction ? `<button class="voice-local-doctor-fix" data-action="${escapeFocusText(item.fixAction)}" type="button">一键修复</button>` : ""}
    </div>`).join("");
    const speaker = doctor.speakerStatus;
    const local = doctor.local || {};
    const localHtml = local.external ? `<div class="voice-local-speaker-runtime"><strong>本地服务来源</strong><span>复用中</span><em>检测到 127.0.0.1:${escapeFocusText(local.port || 3723)} 已有语音服务，当前不会重复启动。切换模型前请先停止旧服务。</em></div>` : "";
    const speakerHtml = speaker ? `<div class="voice-local-speaker-runtime"><strong>声纹服务</strong><span>${escapeFocusText(speaker.reachable === false ? "不可达" : speaker.configured ? "已录入" : "未录入")}</span><em>${escapeFocusText(speaker.detail || "")}</em></div>` : "";
    const fixes = Array.isArray(doctor.recentFixes) ? doctor.recentFixes : [];
    const fixHtml = fixes.length ? `<div class="voice-local-doctor-history"><strong>最近修复</strong>${fixes.map((item, index) => `<span>${escapeFocusText(item.label || item.action || "修复")} · ${escapeFocusText(new Date(item.at || Date.now()).toLocaleTimeString())}${index === 0 && item.before && Object.keys(item.before).length ? `<button class="voice-local-doctor-rollback" data-id="${escapeFocusText(item.id || "")}" type="button">回滚</button>` : ""}</span>`).join("")}</div>` : "";
    return checkHtml + localHtml + speakerHtml + fixHtml;
  }

  function bindVoiceLocalDoctorFixes() {
    document.querySelectorAll(".voice-local-doctor-fix").forEach(btn => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.action || "";
        if (!action) return;
        btn.disabled = true;
        btn.textContent = "修复中…";
        try {
          const resp = await fetch(`${API}/voice/local/doctor/fix`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
          const data = await resp.json();
          if (!resp.ok || !data?.ok) throw new Error(data?.error || "修复失败");
          if (data.voice) hydrateVoiceControlsFromConfig(data.voice);
          await refreshVoiceLocalDoctor();
        } catch (err) {
          btn.textContent = err?.message || "修复失败";
          setTimeout(() => { btn.textContent = "一键修复"; btn.disabled = false; }, 2500);
        }
      });
    });
  }


  function bindVoiceLocalDoctorRollbacks() {
    document.querySelectorAll(".voice-local-doctor-rollback").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id || "";
        btn.disabled = true;
        btn.textContent = "回滚中…";
        try {
          const resp = await fetch(`${API}/voice/local/doctor/rollback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const data = await resp.json();
          if (!resp.ok || !data?.ok) throw new Error(data?.error || "回滚失败");
          if (data.voice) hydrateVoiceControlsFromConfig(data.voice);
          await refreshVoiceLocalDoctor();
        } catch (err) {
          btn.textContent = err?.message || "回滚失败";
          setTimeout(() => { btn.textContent = "回滚"; btn.disabled = false; }, 2500);
        }
      });
    });
  }

  async function refreshVoiceLocalDoctor() {
    const panel = document.getElementById("voice-local-doctor");
    const list = document.getElementById("voice-local-doctor-list");
    if (!panel || !list) return;
    panel.hidden = false;
    list.innerHTML = '<div class="voice-clients-empty">正在检查本地语音服务…</div>';
    try {
      const resp = await fetch(`${API}/voice/local/doctor?windowMs=60000`);
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "本地语音体检失败");
      list.innerHTML = renderVoiceLocalDoctor(data);
      bindVoiceLocalDoctorFixes();
      bindVoiceLocalDoctorRollbacks();
    } catch (err) {
      list.innerHTML = `<div class="voice-clients-error">${escapeFocusText(err?.message || "本地语音体检失败")}</div>`;
    }
  }

  async function loadVoiceSettings() {
    let serverVoice = null;
    try {
      const resp = await fetch(`${API}/settings/voice`);
      const data = await resp.json();
      if (data?.ok && data.voice) serverVoice = data.voice;
    } catch {}

    const langSelect = document.getElementById("voice-lang-select");
    const autoSend   = document.getElementById("voice-auto-send");
    if (langSelect) langSelect.value = localStorage.getItem(VOICE_LANG_KEY) || "zh-CN";
    if (autoSend) autoSend.checked = localStorage.getItem(VOICE_AUTO_SEND_KEY) !== "false";
    const autoMic = document.getElementById("voice-auto-mic");
    if (autoMic) autoMic.checked = localStorage.getItem(VOICE_AUTO_MIC_KEY) === "true";
    const savedThresh = parseFloat(localStorage.getItem(VOICE_THRESHOLD_KEY) || "0.008");
    if (voiceThreshSlider) voiceThreshSlider.value = String(savedThresh);
    if (voiceThreshVal)    voiceThreshVal.textContent = savedThresh.toFixed(3);

    if (!localStorage.getItem(VOICE_LOCAL_DEFAULT_MIGRATION_KEY)) {
      localStorage.setItem(VOICE_PROVIDER_KEY, "local");
      localStorage.setItem(VOICE_LOCAL_DEFAULT_MIGRATION_KEY, "1");
    }
    let savedProvider = serverVoice?.asrProvider || localStorage.getItem(VOICE_PROVIDER_KEY) || "local";
    if (!["local", "aliyun", "tencent", "xunfei"].includes(savedProvider)) savedProvider = "local";
    if (voiceProviderSelect) voiceProviderSelect.value = savedProvider;
    const localAsrModelSelect = document.getElementById("voice-local-asr-model");
    const asrProfileSelect = document.getElementById("voice-asr-profile");
    const savedLocalModel = serverVoice?.localAsrModel || localStorage.getItem(VOICE_LOCAL_ASR_MODEL_KEY) || "sensevoice-small";
    if (localAsrModelSelect) localAsrModelSelect.value = savedLocalModel;
    const savedAsrProfile = ["speed", "balanced", "accuracy"].includes(serverVoice?.asrProfile) ? serverVoice.asrProfile : (localStorage.getItem(VOICE_ASR_PROFILE_KEY) || "balanced");
    if (asrProfileSelect) asrProfileSelect.value = savedAsrProfile;
    localStorage.setItem(VOICE_PROVIDER_KEY, savedProvider);
    localStorage.setItem(VOICE_LOCAL_ASR_MODEL_KEY, savedLocalModel);
    localStorage.setItem(VOICE_ASR_PROFILE_KEY, savedAsrProfile);
    const wakeEnabled = document.getElementById("voice-wake-enabled");
    const wakeWords = document.getElementById("voice-wake-words");
    const wakeDetectionProvider = document.getElementById("voice-wake-detection-provider");
    const kwsEngine = document.getElementById("voice-kws-engine");
    const kwsModelPath = document.getElementById("voice-kws-model-path");
    const kwsThreshold = document.getElementById("voice-kws-threshold");
    const kwsThresholdVal = document.getElementById("voice-kws-threshold-val");
    const wakeMode = document.getElementById("voice-wake-mode");
    const wakeWindow = document.getElementById("voice-wake-window");
    const wakeWindowVal = document.getElementById("voice-wake-window-val");
    const wakeRepeatSuppression = document.getElementById("voice-wake-repeat-suppression");
    const wakeConfidence = document.getElementById("voice-wake-confidence");
    const wakeConfidenceVal = document.getElementById("voice-wake-confidence-val");
    const wakeMinCommand = document.getElementById("voice-wake-min-command");
    const wakeMinCommandVal = document.getElementById("voice-wake-min-command-val");
    const wakeCooldown = document.getElementById("voice-wake-cooldown");
    const wakeCooldownVal = document.getElementById("voice-wake-cooldown-val");
    const wakeRequireSpeaker = document.getElementById("voice-wake-require-speaker");
    const speakerVerify = document.getElementById("voice-speaker-verify");
    const speakerThreshold = document.getElementById("voice-speaker-threshold");
    const speakerThresholdVal = document.getElementById("voice-speaker-threshold-val");
    const videoDuck = document.getElementById("voice-video-duck");
    const videoPtt = document.getElementById("voice-video-ptt");
    const videoAec = document.getElementById("voice-video-aec");
    const videoDuckLevel = document.getElementById("voice-video-duck-level");
    const videoDuckLevelVal = document.getElementById("voice-video-duck-level-val");
    const videoDuckHold = document.getElementById("voice-video-duck-hold");
    const videoDuckHoldVal = document.getElementById("voice-video-duck-hold-val");
    const videoDuckSensitivity = document.getElementById("voice-video-duck-sensitivity");
    const videoDuckSensitivityVal = document.getElementById("voice-video-duck-sensitivity-val");
    const videoPreRoll = document.getElementById("voice-video-preroll");
    const videoPreRollMs = document.getElementById("voice-video-preroll-ms");
    const videoPreRollMsVal = document.getElementById("voice-video-preroll-ms-val");
    const voiceDebugEnabled = document.getElementById("voice-debug-enabled");
    const voiceDebugPanel = document.getElementById("voice-debug-panel");
    const savedWakeEnabled = typeof serverVoice?.wakeWordEnabled === "boolean" ? serverVoice.wakeWordEnabled : localStorage.getItem(VOICE_WAKE_ENABLED_KEY) !== "false";
    const savedWakeWords = Array.isArray(serverVoice?.wakeWords) ? serverVoice.wakeWords.join("，") : (localStorage.getItem(VOICE_WAKE_WORDS_KEY) || "小龙马，龙马，白龙马");
    if (wakeEnabled) wakeEnabled.checked = savedWakeEnabled;
    if (wakeWords) wakeWords.value = savedWakeWords;
    const savedWakeDetectionProvider = ["text", "hybrid", "kws"].includes(serverVoice?.wakeDetectionProvider) ? serverVoice.wakeDetectionProvider : (["text", "hybrid", "kws"].includes(localStorage.getItem(VOICE_WAKE_DETECTION_PROVIDER_KEY)) ? localStorage.getItem(VOICE_WAKE_DETECTION_PROVIDER_KEY) : "text");
    const savedKwsEngine = ["none", "sherpa-onnx", "openwakeword"].includes(serverVoice?.wakeKwsEngine) ? serverVoice.wakeKwsEngine : (["none", "sherpa-onnx", "openwakeword"].includes(localStorage.getItem(VOICE_KWS_ENGINE_KEY)) ? localStorage.getItem(VOICE_KWS_ENGINE_KEY) : "none");
    const savedKwsModelPath = typeof serverVoice?.wakeKwsModelPath === "string" ? serverVoice.wakeKwsModelPath : (localStorage.getItem(VOICE_KWS_MODEL_PATH_KEY) || "");
    const savedKwsThreshold = Math.max(0.10, Math.min(0.99, Number(serverVoice?.wakeKwsThreshold ?? localStorage.getItem(VOICE_KWS_THRESHOLD_KEY) ?? 0.50) || 0.50));
    if (wakeDetectionProvider) wakeDetectionProvider.value = savedWakeDetectionProvider;
    if (kwsEngine) kwsEngine.value = savedKwsEngine;
    if (kwsModelPath) kwsModelPath.value = savedKwsModelPath;
    if (kwsThreshold) kwsThreshold.value = String(savedKwsThreshold);
    if (kwsThresholdVal) kwsThresholdVal.textContent = savedKwsThreshold.toFixed(2);
    const savedWakeMode = ["loose", "strict"].includes(serverVoice?.wakeMode) ? serverVoice.wakeMode : (localStorage.getItem(VOICE_WAKE_MODE_KEY) || "strict");
    const savedWakeWindow = Math.max(3, Math.min(30, Number(serverVoice?.wakeWindowSeconds || localStorage.getItem(VOICE_WAKE_WINDOW_KEY) || 8) || 8));
    const savedWakeRepeatSuppression = typeof serverVoice?.wakeRepeatSuppression === "boolean" ? serverVoice.wakeRepeatSuppression : localStorage.getItem(VOICE_WAKE_REPEAT_SUPPRESS_KEY) !== "false";
    if (wakeMode) wakeMode.value = savedWakeMode;
    if (wakeWindow) wakeWindow.value = String(savedWakeWindow);
    if (wakeWindowVal) wakeWindowVal.textContent = `${savedWakeWindow}s`;
    if (wakeRepeatSuppression) wakeRepeatSuppression.checked = savedWakeRepeatSuppression;
    const savedWakeConfidence = Math.max(0.50, Math.min(0.98, Number(serverVoice?.wakeConfidenceThreshold || localStorage.getItem(VOICE_WAKE_CONFIDENCE_KEY) || 0.72) || 0.72));
    const savedWakeMinCommand = Math.max(0, Math.min(20, Math.round(Number(serverVoice?.wakeMinCommandChars ?? localStorage.getItem(VOICE_WAKE_MIN_COMMAND_KEY) ?? 2) || 0)));
    const savedWakeCooldown = Math.max(0, Math.min(15000, Math.round(Number(serverVoice?.wakeCooldownMs ?? localStorage.getItem(VOICE_WAKE_COOLDOWN_KEY) ?? 1200) || 0)));
    const savedWakeRequireSpeaker = typeof serverVoice?.wakeRequireSpeakerWhenEnabled === "boolean" ? serverVoice.wakeRequireSpeakerWhenEnabled : localStorage.getItem(VOICE_WAKE_REQUIRE_SPEAKER_KEY) !== "false";
    if (wakeConfidence) wakeConfidence.value = String(savedWakeConfidence);
    if (wakeConfidenceVal) wakeConfidenceVal.textContent = savedWakeConfidence.toFixed(2);
    if (wakeMinCommand) wakeMinCommand.value = String(savedWakeMinCommand);
    if (wakeMinCommandVal) wakeMinCommandVal.textContent = `${savedWakeMinCommand}字`;
    if (wakeCooldown) wakeCooldown.value = String(savedWakeCooldown);
    if (wakeCooldownVal) wakeCooldownVal.textContent = `${(savedWakeCooldown / 1000).toFixed(1)}s`;
    if (wakeRequireSpeaker) wakeRequireSpeaker.checked = savedWakeRequireSpeaker;
    const savedSpeakerVerify = typeof serverVoice?.speakerVerificationEnabled === "boolean" ? serverVoice.speakerVerificationEnabled : localStorage.getItem(VOICE_SPEAKER_VERIFY_KEY) === "true";
    if (speakerVerify) speakerVerify.checked = savedSpeakerVerify;
    localStorage.setItem(VOICE_WAKE_ENABLED_KEY, String(savedWakeEnabled));
    localStorage.setItem(VOICE_WAKE_WORDS_KEY, savedWakeWords);
    localStorage.setItem(VOICE_WAKE_DETECTION_PROVIDER_KEY, savedWakeDetectionProvider);
    localStorage.setItem(VOICE_KWS_ENGINE_KEY, savedKwsEngine);
    localStorage.setItem(VOICE_KWS_MODEL_PATH_KEY, savedKwsModelPath);
    localStorage.setItem(VOICE_KWS_THRESHOLD_KEY, String(savedKwsThreshold));
    localStorage.setItem(VOICE_WAKE_MODE_KEY, savedWakeMode);
    localStorage.setItem(VOICE_WAKE_WINDOW_KEY, String(savedWakeWindow));
    localStorage.setItem(VOICE_WAKE_REPEAT_SUPPRESS_KEY, String(savedWakeRepeatSuppression));
    localStorage.setItem(VOICE_WAKE_CONFIDENCE_KEY, String(savedWakeConfidence));
    localStorage.setItem(VOICE_WAKE_MIN_COMMAND_KEY, String(savedWakeMinCommand));
    localStorage.setItem(VOICE_WAKE_COOLDOWN_KEY, String(savedWakeCooldown));
    localStorage.setItem(VOICE_WAKE_REQUIRE_SPEAKER_KEY, String(savedWakeRequireSpeaker));
    localStorage.setItem(VOICE_SPEAKER_VERIFY_KEY, String(savedSpeakerVerify));
    const savedSpeakerThreshold = Math.max(0.45, Math.min(0.80, Number(serverVoice?.speakerThreshold ?? localStorage.getItem(VOICE_SPEAKER_THRESHOLD_KEY) ?? 0.55) || 0.55));
    if (speakerThreshold) speakerThreshold.value = String(savedSpeakerThreshold);
    if (speakerThresholdVal) speakerThresholdVal.textContent = savedSpeakerThreshold.toFixed(2);
    localStorage.setItem(VOICE_SPEAKER_THRESHOLD_KEY, String(savedSpeakerThreshold));
    const savedVideoDuck = typeof serverVoice?.videoVoiceDuckEnabled === "boolean" ? serverVoice.videoVoiceDuckEnabled : localStorage.getItem(VOICE_VIDEO_DUCK_KEY) !== "false";
    const savedVideoPtt = typeof serverVoice?.videoVoicePttEnabled === "boolean" ? serverVoice.videoVoicePttEnabled : localStorage.getItem(VOICE_VIDEO_PTT_KEY) !== "false";
    const savedVideoAec = typeof serverVoice?.videoVoiceAecEnabled === "boolean" ? serverVoice.videoVoiceAecEnabled : localStorage.getItem(VOICE_VIDEO_AEC_KEY) !== "false";
    if (videoDuck) videoDuck.checked = savedVideoDuck;
    if (videoPtt) videoPtt.checked = savedVideoPtt;
    if (videoAec) videoAec.checked = savedVideoAec;
    const savedDuckLevel = Math.max(0.02, Math.min(0.50, Number(serverVoice?.videoVoiceDuckLevel ?? localStorage.getItem(VOICE_VIDEO_DUCK_LEVEL_KEY) ?? 0.10) || 0.10));
    const savedDuckHold = Math.max(800, Math.min(8000, Number(serverVoice?.videoVoiceDuckHoldMs ?? localStorage.getItem(VOICE_VIDEO_DUCK_HOLD_KEY) ?? 2200) || 2200));
    const savedDuckSensitivity = Math.max(0.55, Math.min(1.60, Number(serverVoice?.videoVoiceDuckSensitivity ?? localStorage.getItem(VOICE_VIDEO_DUCK_SENSITIVITY_KEY) ?? 1.0) || 1.0));
    if (videoDuckLevel) videoDuckLevel.value = String(savedDuckLevel);
    if (videoDuckLevelVal) videoDuckLevelVal.textContent = `${Math.round(savedDuckLevel * 100)}%`;
    if (videoDuckHold) videoDuckHold.value = String(savedDuckHold);
    if (videoDuckHoldVal) videoDuckHoldVal.textContent = `${(savedDuckHold / 1000).toFixed(1)}s`;
    if (videoDuckSensitivity) videoDuckSensitivity.value = String(savedDuckSensitivity);
    if (videoDuckSensitivityVal) videoDuckSensitivityVal.textContent = savedDuckSensitivity.toFixed(2);
    const savedPreRollEnabled = typeof serverVoice?.videoVoicePreRollEnabled === "boolean" ? serverVoice.videoVoicePreRollEnabled : localStorage.getItem(VOICE_VIDEO_PREROLL_ENABLED_KEY) !== "false";
    const savedPreRollMs = Math.max(800, Math.min(4000, Number(serverVoice?.videoVoicePreRollMs ?? localStorage.getItem(VOICE_VIDEO_PREROLL_MS_KEY) ?? 2600) || 2600));
    if (videoPreRoll) videoPreRoll.checked = savedPreRollEnabled;
    if (videoPreRollMs) videoPreRollMs.value = String(savedPreRollMs);
    if (videoPreRollMsVal) videoPreRollMsVal.textContent = `${(savedPreRollMs / 1000).toFixed(1)}s`;
    localStorage.setItem(VOICE_VIDEO_DUCK_KEY, String(savedVideoDuck));
    localStorage.setItem(VOICE_VIDEO_PTT_KEY, String(savedVideoPtt));
    localStorage.setItem(VOICE_VIDEO_AEC_KEY, String(savedVideoAec));
    localStorage.setItem(VOICE_VIDEO_DUCK_LEVEL_KEY, String(savedDuckLevel));
    localStorage.setItem(VOICE_VIDEO_DUCK_HOLD_KEY, String(savedDuckHold));
    localStorage.setItem(VOICE_VIDEO_DUCK_SENSITIVITY_KEY, String(savedDuckSensitivity));
    localStorage.setItem(VOICE_VIDEO_PREROLL_ENABLED_KEY, String(savedPreRollEnabled));
    localStorage.setItem(VOICE_VIDEO_PREROLL_MS_KEY, String(savedPreRollMs));
    renderMicMeter();
    const debugEnabled = localStorage.getItem(VOICE_DEBUG_ENABLED_KEY) !== "false";
    if (voiceDebugEnabled) voiceDebugEnabled.checked = debugEnabled;
    if (voiceDebugPanel) voiceDebugPanel.style.display = debugEnabled ? "grid" : "none";

    applyVoiceProviderUI(savedProvider);
    refreshVoiceOverview();
    refreshVoiceReadinessWizard();
    refreshVoiceSelfTest();
    refreshVoiceLocalDoctor();
    refreshVoiceKwsStatus();
  }

  function hydrateVoiceControlsFromConfig(voice = {}) {
    if (!voice || typeof voice !== "object") return false;
    const hasServerField = [
      "wakeMode", "wakeDetectionProvider", "wakeKwsEngine", "wakeKwsModelPath", "wakeKwsThreshold", "wakeRepeatSuppression", "wakeRequireSpeakerWhenEnabled",
      "speakerVerificationEnabled", "speakerThreshold", "wakeConfidenceThreshold",
      "wakeMinCommandChars", "wakeCooldownMs", "videoVoiceDuckEnabled",
      "videoVoicePttEnabled", "videoVoiceAecEnabled", "videoVoiceDuckLevel",
      "videoVoiceDuckHoldMs", "videoVoiceDuckSensitivity", "videoVoicePreRollEnabled",
      "videoVoicePreRollMs",
    ].some(field => voice[field] !== undefined && voice[field] !== null);
    if (!hasServerField) return false;
    if (["text", "hybrid", "kws"].includes(voice.wakeDetectionProvider)) localStorage.setItem(VOICE_WAKE_DETECTION_PROVIDER_KEY, voice.wakeDetectionProvider);
    if (["none", "sherpa-onnx", "openwakeword"].includes(voice.wakeKwsEngine)) localStorage.setItem(VOICE_KWS_ENGINE_KEY, voice.wakeKwsEngine);
    if (typeof voice.wakeKwsModelPath === "string") localStorage.setItem(VOICE_KWS_MODEL_PATH_KEY, voice.wakeKwsModelPath);
    if (voice.wakeKwsThreshold !== undefined && voice.wakeKwsThreshold !== null && Number.isFinite(Number(voice.wakeKwsThreshold))) localStorage.setItem(VOICE_KWS_THRESHOLD_KEY, String(voice.wakeKwsThreshold));
    if (["loose", "strict"].includes(voice.wakeMode)) localStorage.setItem(VOICE_WAKE_MODE_KEY, voice.wakeMode);
    if (typeof voice.wakeRepeatSuppression === "boolean") localStorage.setItem(VOICE_WAKE_REPEAT_SUPPRESS_KEY, String(voice.wakeRepeatSuppression));
    if (typeof voice.wakeRequireSpeakerWhenEnabled === "boolean") localStorage.setItem(VOICE_WAKE_REQUIRE_SPEAKER_KEY, String(voice.wakeRequireSpeakerWhenEnabled));
    if (typeof voice.speakerVerificationEnabled === "boolean") localStorage.setItem(VOICE_SPEAKER_VERIFY_KEY, String(voice.speakerVerificationEnabled));
    if (typeof voice.videoVoiceDuckEnabled === "boolean") localStorage.setItem(VOICE_VIDEO_DUCK_KEY, String(voice.videoVoiceDuckEnabled));
    if (typeof voice.videoVoicePttEnabled === "boolean") localStorage.setItem(VOICE_VIDEO_PTT_KEY, String(voice.videoVoicePttEnabled));
    if (typeof voice.videoVoiceAecEnabled === "boolean") localStorage.setItem(VOICE_VIDEO_AEC_KEY, String(voice.videoVoiceAecEnabled));
    if (typeof voice.videoVoicePreRollEnabled === "boolean") localStorage.setItem(VOICE_VIDEO_PREROLL_ENABLED_KEY, String(voice.videoVoicePreRollEnabled));
    [
      ["wakeKwsThreshold", VOICE_KWS_THRESHOLD_KEY],
      ["wakeConfidenceThreshold", VOICE_WAKE_CONFIDENCE_KEY],
      ["wakeMinCommandChars", VOICE_WAKE_MIN_COMMAND_KEY],
      ["wakeCooldownMs", VOICE_WAKE_COOLDOWN_KEY],
      ["speakerThreshold", VOICE_SPEAKER_THRESHOLD_KEY],
      ["videoVoiceDuckLevel", VOICE_VIDEO_DUCK_LEVEL_KEY],
      ["videoVoiceDuckHoldMs", VOICE_VIDEO_DUCK_HOLD_KEY],
      ["videoVoiceDuckSensitivity", VOICE_VIDEO_DUCK_SENSITIVITY_KEY],
      ["videoVoicePreRollMs", VOICE_VIDEO_PREROLL_MS_KEY],
    ].forEach(([field, key]) => {
      const value = voice[field];
      if (value !== undefined && value !== null && Number.isFinite(Number(value))) localStorage.setItem(key, String(value));
    });
    syncVoiceConfigToSettingsUi(voice);
    return true;
  }

  function syncVoiceConfigToSettingsUi(voice = {}) {
    if (!voice || typeof voice !== "object") return;
    const setChecked = (id, value) => {
      const el = document.getElementById(id);
      if (el && typeof value === "boolean") el.checked = value;
    };
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null) el.value = String(value);
    };
    const wakeDetectionProvider = ["text", "hybrid", "kws"].includes(voice.wakeDetectionProvider) ? voice.wakeDetectionProvider : null;
    const wakeKwsEngine = ["none", "sherpa-onnx", "openwakeword"].includes(voice.wakeKwsEngine) ? voice.wakeKwsEngine : null;
    if (wakeDetectionProvider) {
      setValue("voice-wake-detection-provider", wakeDetectionProvider);
      localStorage.setItem(VOICE_WAKE_DETECTION_PROVIDER_KEY, wakeDetectionProvider);
    }
    if (wakeKwsEngine) {
      setValue("voice-kws-engine", wakeKwsEngine);
      localStorage.setItem(VOICE_KWS_ENGINE_KEY, wakeKwsEngine);
    }
    if (typeof voice.wakeKwsModelPath === "string") {
      setValue("voice-kws-model-path", voice.wakeKwsModelPath);
      localStorage.setItem(VOICE_KWS_MODEL_PATH_KEY, voice.wakeKwsModelPath);
    }
    const wakeMode = ["loose", "strict"].includes(voice.wakeMode) ? voice.wakeMode : null;
    if (wakeMode) {
      setValue("voice-wake-mode", wakeMode);
      localStorage.setItem(VOICE_WAKE_MODE_KEY, wakeMode);
    }
    setChecked("voice-wake-repeat-suppression", voice.wakeRepeatSuppression);
    setChecked("voice-wake-require-speaker", voice.wakeRequireSpeakerWhenEnabled);
    setChecked("voice-speaker-verify", voice.speakerVerificationEnabled);
    setChecked("voice-video-duck", voice.videoVoiceDuckEnabled);
    setChecked("voice-video-ptt", voice.videoVoicePttEnabled);
    setChecked("voice-video-aec", voice.videoVoiceAecEnabled);
    setChecked("voice-video-preroll", voice.videoVoicePreRollEnabled);
    if (typeof voice.wakeRepeatSuppression === "boolean") localStorage.setItem(VOICE_WAKE_REPEAT_SUPPRESS_KEY, String(voice.wakeRepeatSuppression));
    if (typeof voice.wakeRequireSpeakerWhenEnabled === "boolean") localStorage.setItem(VOICE_WAKE_REQUIRE_SPEAKER_KEY, String(voice.wakeRequireSpeakerWhenEnabled));
    if (typeof voice.speakerVerificationEnabled === "boolean") localStorage.setItem(VOICE_SPEAKER_VERIFY_KEY, String(voice.speakerVerificationEnabled));
    if (typeof voice.videoVoiceDuckEnabled === "boolean") localStorage.setItem(VOICE_VIDEO_DUCK_KEY, String(voice.videoVoiceDuckEnabled));
    if (typeof voice.videoVoicePttEnabled === "boolean") localStorage.setItem(VOICE_VIDEO_PTT_KEY, String(voice.videoVoicePttEnabled));
    if (typeof voice.videoVoiceAecEnabled === "boolean") localStorage.setItem(VOICE_VIDEO_AEC_KEY, String(voice.videoVoiceAecEnabled));
    if (typeof voice.videoVoicePreRollEnabled === "boolean") localStorage.setItem(VOICE_VIDEO_PREROLL_ENABLED_KEY, String(voice.videoVoicePreRollEnabled));
    const numericBindings = [
      ["wakeKwsThreshold", "voice-kws-threshold", "voice-kws-threshold-val", VOICE_KWS_THRESHOLD_KEY, v => Number(v).toFixed(2)],
      ["wakeConfidenceThreshold", "voice-wake-confidence", "voice-wake-confidence-val", VOICE_WAKE_CONFIDENCE_KEY, v => Number(v).toFixed(2)],
      ["wakeMinCommandChars", "voice-wake-min-command", "voice-wake-min-command-val", VOICE_WAKE_MIN_COMMAND_KEY, v => `${Math.round(Number(v) || 0)}字`],
      ["wakeCooldownMs", "voice-wake-cooldown", "voice-wake-cooldown-val", VOICE_WAKE_COOLDOWN_KEY, v => `${(Math.round(Number(v) || 0) / 1000).toFixed(1)}s`],
      ["speakerThreshold", "voice-speaker-threshold", "voice-speaker-threshold-val", VOICE_SPEAKER_THRESHOLD_KEY, v => Number(v).toFixed(2)],
      ["videoVoiceDuckLevel", "voice-video-duck-level", "voice-video-duck-level-val", VOICE_VIDEO_DUCK_LEVEL_KEY, v => `${Math.round(Number(v) * 100)}%`],
      ["videoVoiceDuckHoldMs", "voice-video-duck-hold", "voice-video-duck-hold-val", VOICE_VIDEO_DUCK_HOLD_KEY, v => `${(Number(v) / 1000).toFixed(1)}s`],
      ["videoVoiceDuckSensitivity", "voice-video-duck-sensitivity", "voice-video-duck-sensitivity-val", VOICE_VIDEO_DUCK_SENSITIVITY_KEY, v => Number(v).toFixed(2)],
      ["videoVoicePreRollMs", "voice-video-preroll-ms", "voice-video-preroll-ms-val", VOICE_VIDEO_PREROLL_MS_KEY, v => `${(Number(v) / 1000).toFixed(1)}s`],
    ];
    numericBindings.forEach(([field, inputId, labelId, storageKey, format]) => {
      const value = voice[field];
      if (value === undefined || value === null || !Number.isFinite(Number(value))) return;
      setValue(inputId, value);
      const label = document.getElementById(labelId);
      if (label) label.textContent = format(value);
      localStorage.setItem(storageKey, String(value));
    });
  }

  function voicePresetPatchSummary(patch = {}) {
    const chips = [];
    if (patch.wakeDetectionProvider) chips.push(`检测:${patch.wakeDetectionProvider === "text" ? "文本" : patch.wakeDetectionProvider === "hybrid" ? "混合" : "KWS"}`);
    if (patch.wakeMode) chips.push(`唤醒:${patch.wakeMode === "strict" ? "严格" : "宽松"}`);
    if (patch.wakeConfidenceThreshold != null) chips.push(`置信:${Number(patch.wakeConfidenceThreshold).toFixed(2)}`);
    if (patch.speakerThreshold != null) chips.push(`声纹:${Number(patch.speakerThreshold).toFixed(2)}`);
    if (patch.videoVoiceDuckEnabled) chips.push("视频降音");
    if (patch.videoVoicePttEnabled) chips.push("按住说话");
    if (patch.videoVoiceAecEnabled) chips.push("AEC");
    return chips.slice(0, 6);
  }

  async function loadVoiceStabilityPresets() {
    const list = document.getElementById("voice-preset-list");
    const feedback = document.getElementById("voice-preset-feedback");
    if (!list) return;
    try {
      const resp = await fetch(`${API}/settings/voice/presets`);
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "读取预设失败");
      const presets = Array.isArray(data.presets) ? data.presets : [];
      if (!presets.length) {
        list.innerHTML = '<div class="voice-clients-empty">暂无可用语音预设。</div>';
        return;
      }
      const currentPreset = data.currentPreset || null;
      const recommended = data.recommended || null;
      const helper = [
        currentPreset?.label ? `当前接近：${currentPreset.label}${currentPreset.exact ? "（完全匹配）" : ""}` : "当前使用自定义语音参数",
        recommended?.label ? `建议：${recommended.label} — ${recommended.reason || "根据最近语音链路自动判断。"}` : "建议：先用均衡推荐作为稳定基线",
      ].filter(Boolean).join(" · ");
      list.innerHTML = `${helper ? `<div class="voice-preset-recommendation">${escapeFocusText(helper)}</div>` : ""}${presets.map(preset => {
        const chips = voicePresetPatchSummary(preset.patch || {}).map(chip => `<span>${escapeFocusText(chip)}</span>`).join("");
        const isCurrent = currentPreset?.id === preset.id;
        const isRecommended = recommended?.id === preset.id;
        return `<button class="voice-preset-card${isCurrent ? " is-current" : ""}${isRecommended ? " is-recommended" : ""}" type="button" data-preset-id="${escapeFocusText(preset.id)}">
          <strong>${escapeFocusText(preset.label || preset.id)}${isCurrent ? `<em>当前</em>` : ""}${isRecommended && !isCurrent ? `<em>推荐</em>` : ""}</strong>
          <p>${escapeFocusText(preset.description || "一键应用这组语音稳定参数。")}</p>
          <div class="voice-preset-patch">${chips}</div>
        </button>`;
      }).join("")}`;
      list.querySelectorAll(".voice-preset-card").forEach(card => {
        card.addEventListener("click", async () => {
          const id = card.dataset.presetId;
          if (!id) return;
          try {
            card.disabled = true;
            const applyResp = await fetch(`${API}/settings/voice/preset/apply`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            });
            const applied = await applyResp.json();
            if (!applyResp.ok || !applied?.ok) throw new Error(applied?.error || "应用预设失败");
            const synced = hydrateVoiceControlsFromConfig(applied.voice || applied.preset?.patch || {});
            if (!synced) syncVoiceConfigToSettingsUi(applied.voice || applied.preset?.patch || {});
            await loadVoiceStabilityPresets();
            showFeedback(feedback, `已应用：${applied.preset?.label || id}`);
          } catch (err) {
            showFeedback(feedback, err?.message || "应用预设失败", true);
          } finally {
            card.disabled = false;
          }
        });
      });
    } catch (err) {
      list.innerHTML = `<div class="voice-clients-error">${escapeFocusText(err?.message || "读取预设失败")}</div>`;
    }
  }

  if (voiceThreshSlider && voiceThreshVal) {
    voiceThreshSlider.addEventListener("input", () => {
      voiceThreshVal.textContent = parseFloat(voiceThreshSlider.value).toFixed(3);
    });
  }

  const kwsThresholdSlider = document.getElementById("voice-kws-threshold");
  const kwsThresholdVal = document.getElementById("voice-kws-threshold-val");
  if (kwsThresholdSlider && kwsThresholdVal) {
    kwsThresholdSlider.addEventListener("input", () => {
      kwsThresholdVal.textContent = Number(kwsThresholdSlider.value || 0.50).toFixed(2);
    });
  }

  const wakeWindowSlider = document.getElementById("voice-wake-window");
  const wakeWindowVal = document.getElementById("voice-wake-window-val");
  if (wakeWindowSlider && wakeWindowVal) {
    wakeWindowSlider.addEventListener("input", () => {
      wakeWindowVal.textContent = `${Math.round(Number(wakeWindowSlider.value) || 8)}s`;
    });
  }
  const wakeConfidenceSlider = document.getElementById("voice-wake-confidence");
  const wakeConfidenceVal = document.getElementById("voice-wake-confidence-val");
  if (wakeConfidenceSlider && wakeConfidenceVal) {
    wakeConfidenceSlider.addEventListener("input", () => {
      wakeConfidenceVal.textContent = Number(wakeConfidenceSlider.value || 0.72).toFixed(2);
    });
  }
  const wakeMinCommandSlider = document.getElementById("voice-wake-min-command");
  const wakeMinCommandVal = document.getElementById("voice-wake-min-command-val");
  if (wakeMinCommandSlider && wakeMinCommandVal) {
    wakeMinCommandSlider.addEventListener("input", () => {
      wakeMinCommandVal.textContent = `${Math.round(Number(wakeMinCommandSlider.value) || 0)}字`;
    });
  }
  const wakeCooldownSlider = document.getElementById("voice-wake-cooldown");
  const wakeCooldownVal = document.getElementById("voice-wake-cooldown-val");
  if (wakeCooldownSlider && wakeCooldownVal) {
    wakeCooldownSlider.addEventListener("input", () => {
      wakeCooldownVal.textContent = `${(Math.round(Number(wakeCooldownSlider.value) || 0) / 1000).toFixed(1)}s`;
    });
  }


  async function ensureLocalAsrForEnrollment() {
    const model = localStorage.getItem(VOICE_LOCAL_ASR_MODEL_KEY) || "sensevoice-small";
    const asrProfile = localStorage.getItem(VOICE_ASR_PROFILE_KEY) || "balanced";
    await fetch(`${API}/voice/local/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localAsrModel: model, model, asrProfile }),
    });
  }

  async function captureSpeakerAudio({ mode = "enroll", seconds = 6500 } = {}) {
    await ensureLocalAsrForEnrollment();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 } });
    const ws = new WebSocket("ws://127.0.0.1:3723");
    let ctx = null;
    let processor = null;
    try {
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = () => reject(new Error("声纹服务连接失败"));
      });
      ws.binaryType = "arraybuffer";
      const done = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(mode === "test" ? "声纹测试超时" : "声纹录入超时")), 18000);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (mode === "test" && msg.type === "speaker_test_result") { clearTimeout(timer); resolve(msg); }
            if (mode !== "test" && msg.type === "speaker_enroll_ok") { clearTimeout(timer); resolve(msg); }
            if (msg.type === "error") { clearTimeout(timer); reject(new Error(msg.message || "声纹处理失败")); }
          } catch {}
        };
      });
      ws.send(JSON.stringify({ type: mode === "test" ? "speaker_test_start" : "speaker_enroll_start" }));
      ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const src = ctx.createMediaStreamSource(stream);
      processor = ctx.createScriptProcessor(4096, 1, 1);
      src.connect(processor);
      processor.connect(ctx.destination);
      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const f32 = e.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
        ws.send(i16.buffer);
      };
      await new Promise(r => setTimeout(r, seconds));
      processor.onaudioprocess = null;
      if (mode === "test") {
        const speakerThreshold = parseFloat(document.getElementById("voice-speaker-threshold")?.value || "0.55");
        ws.send(JSON.stringify({ type: "speaker_test_finish", speakerThreshold }));
      } else {
        ws.send(JSON.stringify({ type: "speaker_enroll_finish" }));
      }
      return await done;
    } finally {
      try { processor?.disconnect(); } catch {}
      try { await ctx?.close(); } catch {}
      try { stream?.getTracks().forEach(t => t.stop()); } catch {}
      try { ws?.close(); } catch {}
    }
  }

  function updateSpeakerStatusActions({ showStart = false, showEnroll = false } = {}) {
    const startBtn = document.getElementById("voice-speaker-start-service");
    const enrollShortcut = document.getElementById("voice-speaker-enroll-shortcut");
    if (startBtn) startBtn.hidden = !showStart;
    if (enrollShortcut) enrollShortcut.hidden = !showEnroll;
  }

  async function refreshSpeakerStatus() {
    const el = document.getElementById("voice-speaker-status");
    if (!el) return;
    el.textContent = "检测中…";
    updateSpeakerStatusActions();
    try {
      const resp = await fetch(`${API}/voice/local/speaker/status`);
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "声纹状态查询失败");
      const speaker = data.speaker || {};
      if (speaker.reachable === false) {
        el.textContent = `服务不可达：${speaker.detail || speaker.reason || "本地语音服务未运行"}`;
        updateSpeakerStatusActions({ showStart: true });
      } else if (speaker.configured) {
        el.textContent = `已录入（${speaker.sampleCount || 1} 个样本，阈值 ${speaker.threshold ?? "—"}${data.local?.external ? "，复用服务" : ""}）`;
        updateSpeakerStatusActions();
      } else {
        el.textContent = data.local?.external ? "未录入（本地服务可达，复用服务）" : "未录入（本地服务可达）";
        updateSpeakerStatusActions({ showEnroll: true });
      }
    } catch (err) {
      el.textContent = err?.message || "状态未知";
      updateSpeakerStatusActions({ showStart: true });
    }
  }


  let lastSpeakerTestResult = null;

  function renderSpeakerCalibration(calibration = {}) {
    const el = document.getElementById("voice-speaker-calibration");
    if (!el) return;
    el.hidden = false;
    const current = Number(calibration.currentThreshold ?? 0.55).toFixed(2);
    const recommended = Number(calibration.recommendedThreshold ?? calibration.currentThreshold ?? 0.55).toFixed(2);
    const changed = Boolean(calibration.changed);
    const recent = calibration.recent || {};
    const test = calibration.test;
    el.className = `voice-speaker-calibration voice-speaker-calibration-${changed ? "warn" : "ok"}`;
    el.innerHTML = `
      <div class="voice-speaker-calibration-head">
        <strong>${changed ? "建议调整声纹严格度" : "声纹阈值看起来稳定"}</strong>
        <span>当前 ${escapeFocusText(current)} → 建议 ${escapeFocusText(recommended)}</span>
      </div>
      <p>${escapeFocusText(calibration.reason || "暂无校准建议。")}</p>
      <div class="voice-speaker-calibration-meta">
        ${test ? `<span>本次分数 ${escapeFocusText(test.score)}</span>` : ""}
        <span>最近通过 ${escapeFocusText(recent.speakerAccepted || 0)}</span>
        <span>最近拒绝 ${escapeFocusText(recent.speakerRejected || 0)}</span>
      </div>
      <div class="voice-speaker-calibration-actions">
        ${changed ? '<button class="voice-readiness-action" id="voice-apply-speaker-calibration" type="button">应用建议阈值</button>' : ''}
        <button class="voice-readiness-action" id="voice-retest-speaker-calibration" type="button">重新测试</button>
      </div>`;
    document.getElementById("voice-apply-speaker-calibration")?.addEventListener("click", () => refreshSpeakerCalibration({ apply: true }));
    document.getElementById("voice-retest-speaker-calibration")?.addEventListener("click", testSpeakerVoice);
  }

  async function refreshSpeakerCalibration({ apply = false, testResult = lastSpeakerTestResult } = {}) {
    const fb = document.getElementById("voice-speaker-feedback");
    const score = Number(testResult?.score);
    const hasScore = Number.isFinite(score);
    const qs = hasScore ? `?score=${encodeURIComponent(String(score))}&passed=${testResult?.passed ? "true" : "false"}&windowMs=600000` : "?windowMs=600000";
    showFeedback(fb, apply ? "正在应用声纹校准…" : "正在分析声纹阈值…");
    try {
      const resp = await fetch(`${API}${apply ? "/voice/local/speaker/calibration/apply" : `/voice/local/speaker/calibration${qs}`}`, apply ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: hasScore ? score : null, passed: Boolean(testResult?.passed), windowMs: 600000 }),
      } : undefined);
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "声纹校准失败");
      const calibration = data.recommendation || data;
      renderSpeakerCalibration(calibration);
      if (data.voice?.speakerThreshold || data.applied?.speakerThreshold) {
        const next = data.voice?.speakerThreshold || data.applied?.speakerThreshold;
        const slider = document.getElementById("voice-speaker-threshold");
        const val = document.getElementById("voice-speaker-threshold-val");
        if (slider) slider.value = String(next);
        if (val) val.textContent = Number(next).toFixed(2);
        localStorage.setItem(VOICE_SPEAKER_THRESHOLD_KEY, String(next));
        const verify = document.getElementById("voice-speaker-verify");
        if (verify && data.voice?.speakerVerificationEnabled) verify.checked = true;
      }
      showFeedback(fb, apply ? `已应用声纹阈值：${Number(calibration.recommendedThreshold || data.voice?.speakerThreshold || 0).toFixed(2)}` : (calibration.changed ? `建议阈值：${Number(calibration.recommendedThreshold).toFixed(2)}` : "声纹阈值无需调整"));
      await refreshSpeakerStatus();
      await refreshVoiceLocalDoctor();
      await refreshVoiceOverview();
    } catch (err) {
      showFeedback(fb, err?.message || "声纹校准失败", true);
    }
  }

  function renderMicMeter(detail = window.bailongmaVoice?.getMicMonitor?.() || window.bailongmaVoiceMicMonitor || {}) {
    const currentEl = document.getElementById("voice-mic-current");
    const peakEl = document.getElementById("voice-mic-peak");
    const noiseEl = document.getElementById("voice-mic-noise");
    const thresholdEl = document.getElementById("voice-mic-threshold-label");
    const stateEl = document.getElementById("voice-mic-meter-state");
    const barEl = document.getElementById("voice-mic-meter-bar");
    const markerEl = document.getElementById("voice-mic-meter-threshold");
    const adviceEl = document.getElementById("voice-mic-meter-advice");
    if (!currentEl || !peakEl || !noiseEl || !thresholdEl || !stateEl || !barEl || !markerEl) return;
    const threshold = Math.max(0.002, Math.min(0.04, Number(detail.threshold || localStorage.getItem("bailongma-voice-threshold") || 0.008) || 0.008));
    const current = Math.max(0, Number(detail.current || 0) || 0);
    const peak = Math.max(0, Number(detail.peak || 0) || 0);
    const noise = Math.max(0, Number(detail.noiseFloor || 0) || 0);
    const scaleMax = Math.max(0.04, threshold * 3, peak * 1.2, current * 1.2);
    currentEl.textContent = current.toFixed(3);
    peakEl.textContent = peak.toFixed(3);
    noiseEl.textContent = noise.toFixed(3);
    thresholdEl.textContent = threshold.toFixed(3);
    barEl.style.width = `${Math.min(100, Math.round((current / scaleMax) * 100))}%`;
    markerEl.style.left = `${Math.min(100, Math.round((threshold / scaleMax) * 100))}%`;
    const stale = !detail.updatedAt || Date.now() - Number(detail.updatedAt) > 2500;
    if (!detail.active && stale) {
      stateEl.textContent = "麦克风未开启";
      if (adviceEl) adviceEl.textContent = "点击主界面麦克风或开始语音实测后，再观察音量是否越过阈值。";
    } else if (current >= threshold) {
      stateEl.textContent = "已超过触发阈值";
      if (adviceEl) adviceEl.textContent = "麦克风能听见你；如果仍无响应，继续看唤醒/声纹/ASR 诊断。";
    } else if (peak > 0 && peak < threshold) {
      stateEl.textContent = "声音低于阈值";
      if (adviceEl) adviceEl.textContent = "说话峰值没有越过阈值：靠近麦克风、降低触发阈值，或使用空格按住说话。";
    } else {
      stateEl.textContent = "等待说话";
      if (adviceEl) adviceEl.textContent = "对着 Mac 说“龙马，测试一下”，观察当前音量和峰值。";
    }
  }

  function recommendMicThreshold(detail = window.bailongmaVoice?.getMicMonitor?.() || window.bailongmaVoiceMicMonitor || {}) {
    const currentThreshold = Math.max(0.002, Math.min(0.04, Number(localStorage.getItem("bailongma-voice-threshold") || detail.threshold || 0.008) || 0.008));
    const peak = Math.max(0, Number(detail.peak || detail.current || 0) || 0);
    const noise = Math.max(0, Number(detail.noiseFloor || 0) || 0);
    if (!peak || peak < 0.003) {
      return { ok: false, reason: "还没有检测到足够清晰的本人声音。请打开麦克风后说：龙马，测试一下。", currentThreshold, recommendedThreshold: currentThreshold, peak, noise };
    }
    const fromPeak = peak * 0.55;
    const fromNoise = noise > 0 ? noise * 2.2 : 0.002;
    const recommended = Math.max(0.002, Math.min(0.04, Number(Math.max(fromNoise, Math.min(fromPeak, peak * 0.75)).toFixed(3))));
    const reason = recommended < currentThreshold
      ? `当前峰值 ${peak.toFixed(3)} 低于/接近阈值，建议把触发阈值降到 ${recommended.toFixed(3)}，更容易听见你。`
      : recommended > currentThreshold * 1.25
        ? `噪声底 ${noise.toFixed(3)} 偏高，建议把阈值提高到 ${recommended.toFixed(3)}，减少视频/环境噪声误触发。`
        : `当前阈值 ${currentThreshold.toFixed(3)} 与峰值 ${peak.toFixed(3)} 基本匹配，可保持或应用 ${recommended.toFixed(3)}。`;
    return { ok: true, reason, currentThreshold, recommendedThreshold: recommended, peak, noise, changed: Math.abs(recommended - currentThreshold) >= 0.001 };
  }

  function calibrateMicThreshold() {
    const adviceEl = document.getElementById("voice-mic-meter-advice");
    const thresholdSlider = document.getElementById("settings-voice-threshold");
    const thresholdVal = document.getElementById("settings-voice-threshold-val");
    const recommendation = recommendMicThreshold();
    if (!recommendation.ok) {
      showFeedback(adviceEl, recommendation.reason, true);
      renderMicMeter();
      return;
    }
    const next = recommendation.recommendedThreshold;
    if (thresholdSlider) thresholdSlider.value = String(next);
    if (thresholdVal) thresholdVal.textContent = next.toFixed(3);
    localStorage.setItem("bailongma-voice-threshold", String(next));
    window.bailongmaVoice?.resetMicMonitor?.();
    renderMicMeter({ current: 0, peak: recommendation.peak, noiseFloor: recommendation.noise, threshold: next, active: Boolean(window.bailongmaVoice?.isActive?.()), updatedAt: Date.now() });
    showFeedback(adviceEl, `已校准触发阈值：${next.toFixed(3)}。${recommendation.reason}`);
  }

  let lastMicOverviewRefreshAt = 0;
  window.addEventListener("bailongma:mic-level", event => {
    renderMicMeter(event.detail || {});
    const now = Date.now();
    if (now - lastMicOverviewRefreshAt > 900) {
      lastMicOverviewRefreshAt = now;
      refreshVoiceOverview();
    }
  });
  document.getElementById("voice-mic-meter-reset")?.addEventListener("click", () => {
    window.bailongmaVoice?.resetMicMonitor?.();
    renderMicMeter();
  });
  document.getElementById("voice-mic-threshold-calibrate")?.addEventListener("click", calibrateMicThreshold);

  async function startSpeakerVoiceService() {
    const btn = document.getElementById("voice-speaker-start-service");
    const fb = document.getElementById("voice-speaker-feedback");
    if (btn) btn.disabled = true;
    showFeedback(fb, "正在启动本地语音服务…");
    try {
      const model = document.getElementById("voice-local-asr-model")?.value || localStorage.getItem(VOICE_LOCAL_ASR_MODEL_KEY) || "sensevoice-small";
      const profile = document.getElementById("voice-asr-profile")?.value || localStorage.getItem(VOICE_ASR_PROFILE_KEY) || "balanced";
      const resp = await fetch(`${API}/voice/local/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localAsrModel: model, model, asrProfile: profile }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.ok === false) throw new Error(data?.error || "启动失败");
      showFeedback(fb, data.external ? `已复用运行中的本地语音服务：${data.engineLabel || data.engine || model}` : `已请求启动：${data.engineLabel || data.engine || model}`);
      setTimeout(refreshSpeakerStatus, 800);
      setTimeout(refreshVoiceLocalDoctor, 1000);
    } catch (err) {
      showFeedback(fb, err?.message || "启动失败", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function enrollSpeakerVoice() {
    const btn = document.getElementById("voice-enroll-speaker");
    const fb = document.getElementById("voice-speaker-feedback");
    if (!btn) return;
    btn.disabled = true;
    showFeedback(fb, "请连续说 6–8 秒，系统会自动拆成多段声纹样本…");
    try {
      const result = await captureSpeakerAudio({ mode: "enroll", seconds: 7500 });
      const calibration = result.calibration || {};
      const recommended = calibration.recommendedThreshold;
      showFeedback(fb, `声纹已录入：${result.embeddingSamples || 1} 个样本，自测均值 ${calibration.selfAvg ?? "—"}${recommended ? `，建议阈值 ${recommended}` : ""}`);
      const speakerVerify = document.getElementById("voice-speaker-verify");
      if (speakerVerify) speakerVerify.checked = true;
      localStorage.setItem(VOICE_SPEAKER_VERIFY_KEY, "true");
      if (recommended) {
        const slider = document.getElementById("voice-speaker-threshold");
        const val = document.getElementById("voice-speaker-threshold-val");
        if (slider) slider.value = String(recommended);
        if (val) val.textContent = Number(recommended).toFixed(2);
        localStorage.setItem(VOICE_SPEAKER_THRESHOLD_KEY, String(recommended));
      }
      await refreshSpeakerStatus();
      try {
        await fetch(`${API}/settings/voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speakerVerificationEnabled: true, ...(recommended ? { speakerThreshold: recommended } : {}) }),
        });
      } catch {}
    } catch (err) {
      showFeedback(fb, err?.message || "声纹录入失败", true);
    } finally {
      btn.disabled = false;
    }
  }

  async function testSpeakerVoice() {
    const btn = document.getElementById("voice-test-speaker");
    const fb = document.getElementById("voice-speaker-feedback");
    if (!btn) return;
    btn.disabled = true;
    showFeedback(fb, "请说 3–4 秒，我会测试当前声纹分数…");
    try {
      const result = await captureSpeakerAudio({ mode: "test", seconds: 4200 });
      lastSpeakerTestResult = result;
      refreshSpeakerCalibration({ apply: false, testResult: result });
      if (!result.configured) {
        showFeedback(fb, "还没有录入声纹，请先录入", true);
      } else if (result.passed) {
        showFeedback(fb, `通过：分数 ${result.score} / 阈值 ${result.threshold}（样本 ${result.sampleCount || 1}）`);
      } else {
        showFeedback(fb, `未通过：分数 ${result.score} / 阈值 ${result.threshold}。建议降低严格度或重新录入`, true);
      }
    } catch (err) {
      showFeedback(fb, err?.message || "声纹测试失败", true);
    } finally {
      btn.disabled = false;
    }
  }


  async function clearSpeakerVoice() {
    const btn = document.getElementById("voice-clear-speaker");
    const fb = document.getElementById("voice-speaker-feedback");
    if (btn) btn.disabled = true;
    showFeedback(fb, "正在清除本机声纹…");
    try {
      const resp = await fetch(`${API}/voice/local/speaker/clear`, { method: "POST" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "清除失败");
      const speakerVerify = document.getElementById("voice-speaker-verify");
      if (speakerVerify) speakerVerify.checked = false;
      localStorage.setItem(VOICE_SPEAKER_VERIFY_KEY, "false");
      showFeedback(fb, data.speaker?.backup ? "声纹已备份并清除，请重新录入" : "声纹已清除，请重新录入");
      await refreshSpeakerBackups();
      await refreshSpeakerStatus();
      try { await refreshVoiceReadinessWizard(); } catch {}
      try { await refreshVoiceLocalDoctor(); } catch {}
    } catch (err) {
      showFeedback(fb, err?.message || "清除失败", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }



  async function refreshSpeakerBackups() {
    const select = document.getElementById("voice-speaker-backup-select");
    if (!select) return;
    try {
      const resp = await fetch(`${API}/voice/local/speaker/backups`);
      const data = await resp.json();
      const backups = Array.isArray(data.backups) ? data.backups : [];
      select.innerHTML = '<option value="">最近备份</option>' + backups.slice().reverse().map(item => `<option value="${escapeFocusText(item.name)}">${escapeFocusText(item.name.replace(/^voiceprint-/, "").replace(/\.json$/, ""))}</option>`).join("");
    } catch {
      select.innerHTML = '<option value="">最近备份</option>';
    }
  }

  async function restoreSpeakerVoice() {
    const btn = document.getElementById("voice-restore-speaker");
    const fb = document.getElementById("voice-speaker-feedback");
    if (btn) btn.disabled = true;
    showFeedback(fb, "正在恢复最近声纹备份…");
    try {
      const selectedBackup = document.getElementById("voice-speaker-backup-select")?.value || "";
      const resp = await fetch(`${API}/voice/local/speaker/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedBackup }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "恢复失败");
      const speakerVerify = document.getElementById("voice-speaker-verify");
      if (speakerVerify) speakerVerify.checked = true;
      localStorage.setItem(VOICE_SPEAKER_VERIFY_KEY, "true");
      showFeedback(fb, `已恢复声纹备份${data.backup?.name ? `：${data.backup.name}` : ""}`);
      await refreshSpeakerBackups();
      await refreshSpeakerStatus();
      try { await refreshVoiceReadinessWizard(); } catch {}
      try { await refreshVoiceLocalDoctor(); } catch {}
    } catch (err) {
      showFeedback(fb, err?.message || "恢复失败", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  const enrollSpeakerBtn = document.getElementById("voice-enroll-speaker");
  if (enrollSpeakerBtn) enrollSpeakerBtn.addEventListener("click", enrollSpeakerVoice);
  document.getElementById("voice-speaker-enroll-shortcut")?.addEventListener("click", () => enrollSpeakerBtn?.click());
  document.getElementById("voice-speaker-start-service")?.addEventListener("click", startSpeakerVoiceService);
  document.getElementById("voice-speaker-refresh-status")?.addEventListener("click", refreshSpeakerStatus);
  const testSpeakerBtn = document.getElementById("voice-test-speaker");
  if (testSpeakerBtn) testSpeakerBtn.addEventListener("click", testSpeakerVoice);
  document.getElementById("voice-clear-speaker")?.addEventListener("click", clearSpeakerVoice);
  document.getElementById("voice-restore-speaker")?.addEventListener("click", restoreSpeakerVoice);
  refreshSpeakerStatus();
  refreshSpeakerBackups();

  const speakerThresholdSlider = document.getElementById("voice-speaker-threshold");
  const speakerThresholdVal = document.getElementById("voice-speaker-threshold-val");
  if (speakerThresholdSlider && speakerThresholdVal) {
    speakerThresholdSlider.addEventListener("input", () => {
      speakerThresholdVal.textContent = parseFloat(speakerThresholdSlider.value).toFixed(2);
    });
  }

  const videoDuckLevelSlider = document.getElementById("voice-video-duck-level");
  const videoDuckLevelVal = document.getElementById("voice-video-duck-level-val");
  if (videoDuckLevelSlider && videoDuckLevelVal) {
    videoDuckLevelSlider.addEventListener("input", () => {
      videoDuckLevelVal.textContent = `${Math.round(Number(videoDuckLevelSlider.value || 0.1) * 100)}%`;
    });
  }
  const videoDuckHoldSlider = document.getElementById("voice-video-duck-hold");
  const videoDuckHoldVal = document.getElementById("voice-video-duck-hold-val");
  if (videoDuckHoldSlider && videoDuckHoldVal) {
    videoDuckHoldSlider.addEventListener("input", () => {
      videoDuckHoldVal.textContent = `${(Number(videoDuckHoldSlider.value || 2200) / 1000).toFixed(1)}s`;
    });
  }
  const videoDuckSensitivitySlider = document.getElementById("voice-video-duck-sensitivity");
  const videoDuckSensitivityVal = document.getElementById("voice-video-duck-sensitivity-val");
  if (videoDuckSensitivitySlider && videoDuckSensitivityVal) {
    videoDuckSensitivitySlider.addEventListener("input", () => {
      videoDuckSensitivityVal.textContent = Number(videoDuckSensitivitySlider.value || 1).toFixed(2);
    });
  }

  if (saveVoiceBtn) {
    saveVoiceBtn.addEventListener("click", async () => {
      const lang      = document.getElementById("voice-lang-select")?.value || "zh-CN";
      const autoSend  = document.getElementById("voice-auto-send")?.checked ?? true;
      const autoMic   = document.getElementById("voice-auto-mic")?.checked ?? false;
      const threshold = parseFloat(voiceThreshSlider?.value ?? "0.008");
      const provider  = voiceProviderSelect?.value || "local";
      const localAsrModel = document.getElementById("voice-local-asr-model")?.value || "sensevoice-small";
      const asrProfile = document.getElementById("voice-asr-profile")?.value || "balanced";
      const whisperModel = localAsrModel === "sensevoice-small" ? (localStorage.getItem(VOICE_WHISPER_MODEL_KEY) || "small") : localAsrModel;
      const wakeEnabled = document.getElementById("voice-wake-enabled")?.checked ?? true;
      const wakeWords = document.getElementById("voice-wake-words")?.value?.trim() || "小龙马，龙马，白龙马";
      const wakeDetectionProviderRaw = document.getElementById("voice-wake-detection-provider")?.value || "text";
      const wakeDetectionProvider = ["text", "hybrid", "kws"].includes(wakeDetectionProviderRaw) ? wakeDetectionProviderRaw : "text";
      const wakeKwsEngineRaw = document.getElementById("voice-kws-engine")?.value || "none";
      const wakeKwsEngine = ["none", "sherpa-onnx", "openwakeword"].includes(wakeKwsEngineRaw) ? wakeKwsEngineRaw : "none";
      const wakeKwsModelPath = (document.getElementById("voice-kws-model-path")?.value || "").trim().slice(0, 500);
      const wakeKwsThreshold = Math.max(0.10, Math.min(0.99, Number(document.getElementById("voice-kws-threshold")?.value || 0.50) || 0.50));
      const wakeMode = document.getElementById("voice-wake-mode")?.value === "loose" ? "loose" : "strict";
      const wakeWindowSeconds = Math.max(3, Math.min(30, Number(document.getElementById("voice-wake-window")?.value || 8) || 8));
      const wakeRepeatSuppression = document.getElementById("voice-wake-repeat-suppression")?.checked ?? true;
      const wakeConfidenceThreshold = Math.max(0.50, Math.min(0.98, Number(document.getElementById("voice-wake-confidence")?.value || 0.72) || 0.72));
      const wakeMinCommandChars = Math.max(0, Math.min(20, Math.round(Number(document.getElementById("voice-wake-min-command")?.value || 2) || 0)));
      const wakeCooldownMs = Math.max(0, Math.min(15000, Math.round(Number(document.getElementById("voice-wake-cooldown")?.value || 1200) || 0)));
      const wakeRequireSpeakerWhenEnabled = document.getElementById("voice-wake-require-speaker")?.checked ?? true;
      const speakerVerify = document.getElementById("voice-speaker-verify")?.checked ?? false;
      const speakerThreshold = parseFloat(document.getElementById("voice-speaker-threshold")?.value || "0.55");
      const videoDuck = document.getElementById("voice-video-duck")?.checked ?? true;
      const videoPtt = document.getElementById("voice-video-ptt")?.checked ?? true;
      const videoAec = document.getElementById("voice-video-aec")?.checked ?? true;
      const videoDuckLevel = Math.max(0.02, Math.min(0.50, Number(document.getElementById("voice-video-duck-level")?.value || 0.10) || 0.10));
      const videoDuckHold = Math.max(800, Math.min(8000, Number(document.getElementById("voice-video-duck-hold")?.value || 2200) || 2200));
      const videoDuckSensitivity = Math.max(0.55, Math.min(1.60, Number(document.getElementById("voice-video-duck-sensitivity")?.value || 1.0) || 1.0));
      const videoPreRollEnabled = document.getElementById("voice-video-preroll")?.checked ?? true;
      const videoPreRollMs = Math.max(800, Math.min(4000, Number(document.getElementById("voice-video-preroll-ms")?.value || 2600) || 2600));
      const voiceDebugEnabled = document.getElementById("voice-debug-enabled")?.checked ?? true;

      localStorage.setItem(VOICE_LANG_KEY,      lang);
      localStorage.setItem(VOICE_AUTO_SEND_KEY,  String(autoSend));
      localStorage.setItem(VOICE_AUTO_MIC_KEY,   String(autoMic));
      localStorage.setItem(VOICE_THRESHOLD_KEY,  String(threshold));
      localStorage.setItem(VOICE_PROVIDER_KEY,   provider);
      localStorage.setItem(VOICE_LOCAL_ASR_MODEL_KEY, localAsrModel);
      localStorage.setItem(VOICE_ASR_PROFILE_KEY, asrProfile);
      localStorage.setItem(VOICE_WHISPER_MODEL_KEY, whisperModel);
      localStorage.setItem(VOICE_WAKE_ENABLED_KEY, String(wakeEnabled));
      localStorage.setItem(VOICE_WAKE_WORDS_KEY, wakeWords);
      localStorage.setItem(VOICE_WAKE_DETECTION_PROVIDER_KEY, wakeDetectionProvider);
      localStorage.setItem(VOICE_KWS_ENGINE_KEY, wakeKwsEngine);
      localStorage.setItem(VOICE_KWS_MODEL_PATH_KEY, wakeKwsModelPath);
      localStorage.setItem(VOICE_KWS_THRESHOLD_KEY, String(wakeKwsThreshold));
      localStorage.setItem(VOICE_WAKE_MODE_KEY, wakeMode);
      localStorage.setItem(VOICE_WAKE_WINDOW_KEY, String(wakeWindowSeconds));
      localStorage.setItem(VOICE_WAKE_REPEAT_SUPPRESS_KEY, String(wakeRepeatSuppression));
      localStorage.setItem(VOICE_WAKE_CONFIDENCE_KEY, String(wakeConfidenceThreshold));
      localStorage.setItem(VOICE_WAKE_MIN_COMMAND_KEY, String(wakeMinCommandChars));
      localStorage.setItem(VOICE_WAKE_COOLDOWN_KEY, String(wakeCooldownMs));
      localStorage.setItem(VOICE_WAKE_REQUIRE_SPEAKER_KEY, String(wakeRequireSpeakerWhenEnabled));
      localStorage.setItem(VOICE_SPEAKER_VERIFY_KEY, String(speakerVerify));
      localStorage.setItem(VOICE_SPEAKER_THRESHOLD_KEY, String(speakerThreshold));
      localStorage.setItem(VOICE_VIDEO_DUCK_KEY, String(videoDuck));
      localStorage.setItem(VOICE_VIDEO_PTT_KEY, String(videoPtt));
      localStorage.setItem(VOICE_VIDEO_AEC_KEY, String(videoAec));
      localStorage.setItem(VOICE_VIDEO_DUCK_LEVEL_KEY, String(videoDuckLevel));
      localStorage.setItem(VOICE_VIDEO_DUCK_HOLD_KEY, String(videoDuckHold));
      localStorage.setItem(VOICE_VIDEO_DUCK_SENSITIVITY_KEY, String(videoDuckSensitivity));
      localStorage.setItem(VOICE_VIDEO_PREROLL_ENABLED_KEY, String(videoPreRollEnabled));
      localStorage.setItem(VOICE_VIDEO_PREROLL_MS_KEY, String(videoPreRollMs));
      localStorage.setItem(VOICE_DEBUG_ENABLED_KEY, String(voiceDebugEnabled));
      localStorage.setItem(VOICE_LOCAL_DEFAULT_MIGRATION_KEY, "1");

      window.dispatchEvent(new CustomEvent("bailongma:voice-threshold", { detail: { threshold } }));

      const body = {
        asrProvider: provider,
        localAsrModel,
        whisperModel,
        asrProfile,
        wakeWordEnabled: wakeEnabled,
        wakeWords: wakeWords.split(/[,，、\s]+/).map(w => w.trim()).filter(Boolean),
        wakeDetectionProvider,
        wakeKwsEngine,
        wakeKwsModelPath,
        wakeKwsThreshold,
        wakeMode,
        wakeWindowSeconds,
        wakeRepeatSuppression,
        wakeConfidenceThreshold,
        wakeMinCommandChars,
        wakeCooldownMs,
        wakeRequireSpeakerWhenEnabled,
        speakerVerificationEnabled: speakerVerify,
        speakerThreshold,
        videoVoiceDuckEnabled: videoDuck,
        videoVoicePttEnabled: videoPtt,
        videoVoiceAecEnabled: videoAec,
        videoVoiceDuckLevel: videoDuckLevel,
        videoVoiceDuckHoldMs: videoDuckHold,
        videoVoiceDuckSensitivity: videoDuckSensitivity,
        videoVoicePreRollEnabled: videoPreRollEnabled,
        videoVoicePreRollMs: videoPreRollMs,
      };
      const aliyunKey = document.getElementById("voice-aliyun-key")?.value?.trim();
      if (aliyunKey) body.aliyunApiKey = aliyunKey;
      const tencentSid = document.getElementById("voice-tencent-sid")?.value?.trim();
      if (tencentSid) body.tencentSecretId = tencentSid;
      const tencentSkey = document.getElementById("voice-tencent-skey")?.value?.trim();
      if (tencentSkey) body.tencentSecretKey = tencentSkey;
      const tencentAppid = document.getElementById("voice-tencent-appid")?.value?.trim();
      if (tencentAppid) body.tencentAppId = tencentAppid;
      const xunfeiAppid = document.getElementById("voice-xunfei-appid")?.value?.trim();
      if (xunfeiAppid) body.xunfeiAppId = xunfeiAppid;
      const xunfeiApikey = document.getElementById("voice-xunfei-apikey")?.value?.trim();
      if (xunfeiApikey) body.xunfeiApiKey = xunfeiApikey;

      if (Object.keys(body).length > 0) {
        try {
          saveVoiceBtn.disabled = true;
          const resp = await fetch("http://127.0.0.1:3721/settings/voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!resp.ok) throw new Error("保存失败");
          ["voice-aliyun-key","voice-tencent-sid","voice-tencent-skey","voice-xunfei-apikey"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
          });
          showFeedback(voiceFeedback, "已保存");
        } catch { showFeedback(voiceFeedback, "保存失败", true); }
        finally { saveVoiceBtn.disabled = false; }
      } else {
        showFeedback(voiceFeedback, "已保存");
      }
    });
  }

  const voiceDebugToggle = document.getElementById("voice-debug-enabled");
  const voiceDebugPanel = document.getElementById("voice-debug-panel");
  const voiceDebugState = document.getElementById("voice-debug-state");
  const voiceDebugReason = document.getElementById("voice-debug-reason");
  const voiceDebugRound = document.getElementById("voice-debug-round");
  const voiceDebugAsr = document.getElementById("voice-debug-asr");
  const voiceDebugTts = document.getElementById("voice-debug-tts");
  const voiceDebugEvent = document.getElementById("voice-debug-event");
  const voiceDebugMic = document.getElementById("voice-debug-mic");
  const voiceDebugWake = document.getElementById("voice-debug-wake");
  const voiceDebugSpeaker = document.getElementById("voice-debug-speaker");
  const voiceDebugMedia = document.getElementById("voice-debug-media");
  const voiceDebugLast = {
    mic: "—",
    wake: "—",
    speaker: "—",
    media: "—",
  };

  function updateVoiceDebugAux() {
    if (voiceDebugMic) voiceDebugMic.textContent = voiceDebugLast.mic;
    if (voiceDebugWake) voiceDebugWake.textContent = voiceDebugLast.wake;
    if (voiceDebugSpeaker) voiceDebugSpeaker.textContent = voiceDebugLast.speaker;
    if (voiceDebugMedia) voiceDebugMedia.textContent = voiceDebugLast.media;
  }

  function formatDebugNumber(value, digits = 3) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : "—";
  }

  function updateVoiceDebugPanel(detail = {}) {
    if (!voiceDebugPanel) return;
    const enabled = localStorage.getItem(VOICE_DEBUG_ENABLED_KEY) !== "false";
    voiceDebugPanel.style.display = enabled ? "grid" : "none";
    if (!enabled) return;
    if (voiceDebugState) voiceDebugState.textContent = detail.state || "idle";
    if (voiceDebugReason) voiceDebugReason.textContent = detail.reason || detail.event || "—";
    if (voiceDebugRound) voiceDebugRound.textContent = detail.roundId || "—";
    if (voiceDebugAsr) voiceDebugAsr.textContent = detail.asrSessionId || "—";
    if (voiceDebugTts) voiceDebugTts.textContent = detail.ttsSessionId || "—";
    updateVoiceDebugAux();
  }

  if (voiceDebugToggle) {
    voiceDebugToggle.addEventListener("change", () => {
      localStorage.setItem(VOICE_DEBUG_ENABLED_KEY, String(voiceDebugToggle.checked));
      updateVoiceDebugPanel(window.bailongmaVoiceState?.getSnapshot?.() || {});
    });
  }
  window.addEventListener("bailongma:voice-state", (event) => updateVoiceDebugPanel(event.detail || {}));
  window.addEventListener("bailongma:voice-event", (event) => {
    const e = event.detail || {};
    const detail = e.detail || {};
    if (voiceDebugEvent) {
      voiceDebugEvent.textContent = `${e.type || "—"} #${e.seq || ""}`.trim();
    }
    if (e.type === "wake:accepted") {
      voiceDebugLast.wake = `通过：${detail.word || detail.reason || "wake"}${detail.confidence != null ? ` · conf ${formatDebugNumber(detail.confidence, 2)}` : ""}`;
    } else if (e.type === "wake:rejected") {
      voiceDebugLast.wake = `拒绝：${detail.reason || "unknown"}${detail.confidence != null ? ` · conf ${formatDebugNumber(detail.confidence, 2)}` : ""}`;
    } else if (e.type === "speaker:accepted") {
      voiceDebugLast.speaker = `通过：${formatDebugNumber(detail.score, 3)} / ${formatDebugNumber(detail.threshold, 2)}`;
    } else if (e.type === "speaker:rejected") {
      voiceDebugLast.speaker = `拒绝：${formatDebugNumber(detail.score, 3)} / ${formatDebugNumber(detail.threshold, 2)} · ${detail.reason || "声纹未通过"}`;
    } else if (e.type === "media:duck") {
      if (detail.phase === "asr_gate_open") {
        voiceDebugLast.media = `ASR门控开 ${Math.round(detail.holdMs || 0)}ms · 预录 ${detail.flushedChunks || 0}/${detail.preRollChunks || 0}块`;
      } else if (detail.phase === "voice_activity") {
        voiceDebugLast.media = `近场人声 vol ${formatDebugNumber(detail.volume, 3)} · 预录${detail.preRollMs || "—"}ms`;
      } else if (detail.active) {
        voiceDebugLast.media = `降音中 ${detail.kind || "media"}${detail.paused ? " · 已暂停" : ""}`;
      } else {
        voiceDebugLast.media = "空闲";
      }
    } else if (e.type === "asr:partial") {
      voiceDebugLast.wake = `识别中：${String(detail.text || "").slice(0, 18)}`;
    } else if (e.type === "asr:final") {
      voiceDebugLast.wake = `识别完成：${String(detail.text || "").slice(0, 18)}`;
    }
    updateVoiceDebugAux();
  });
  window.addEventListener("bailongma:mic-level", (event) => {
    const mic = event.detail || {};
    const pre = window.bailongmaVoice?.getMediaPreRollState?.();
    voiceDebugLast.mic = `cur ${formatDebugNumber(mic.current, 3)} · peak ${formatDebugNumber(mic.peak, 3)} · thr ${formatDebugNumber(mic.threshold, 3)}`;
    if (pre?.enabled) {
      voiceDebugLast.media = pre.gateOpen
        ? `ASR门控开 · 剩余 ${Math.round(pre.gateRemainingMs || 0)}ms · 缓存 ${pre.chunks}块/${pre.preRollMs}ms`
        : `预录待命 · 缓存 ${pre.chunks}块/${pre.preRollMs}ms`;
    }
    updateVoiceDebugAux();
  });
  updateVoiceDebugPanel(window.bailongmaVoiceState?.getSnapshot?.() || {});

  let lastVoiceEventPublishAt = 0;
  window.addEventListener("bailongma:voice-event", (event) => {
    const voiceEvent = event.detail;
    if (!voiceEvent?.type) return;
    // Keep bridge lightweight; do not block UI or voice playback.
    const now = Date.now();
    if (voiceEvent.type === "asr:partial" && now - lastVoiceEventPublishAt < 250) return;
    lastVoiceEventPublishAt = now;
    fetch(`${API}/voice/events/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: voiceEvent }),
    }).catch(() => {});
  });

  initTTSSettings();
  initVoiceClientsPanel();

  const memoryGraphToggle = document.getElementById("settings-memory-graph-toggle");
  const memoryGraphFeedback = document.getElementById("settings-memory-graph-feedback");
  if (memoryGraphToggle) {
    memoryGraphToggle.checked = localStorage.getItem(MEMORY_GRAPH_STORAGE_KEY) !== "false";
    memoryGraphToggle.addEventListener("change", () => {
      localStorage.setItem(MEMORY_GRAPH_STORAGE_KEY, String(memoryGraphToggle.checked));
      if (memoryGraphFeedback) {
        memoryGraphFeedback.textContent = "下次刷新页面后生效";
        memoryGraphFeedback.className = "settings-feedback";
        setTimeout(() => { memoryGraphFeedback.textContent = ""; }, 3000);
      }
    });
  }

  function openSettings(tab = null) {
    overlay.hidden = false;
    loadSettings();
    loadVoiceSettings();
    loadVoiceStabilityPresets();
    if (tab) {
      overlay.querySelectorAll(".settings-nav-item").forEach(b => {
        b.classList.toggle("active", b.dataset.tab === tab);
      });
      overlay.querySelectorAll(".settings-tab").forEach(t => {
        t.classList.toggle("active", t.dataset.tab === tab);
      });
      if (tab === "social") loadSocialSettings();
      if (tab === "web-search") loadWebSearchSettings();
      if (tab === "update") loadUpdateSettings();
    }
  }

  function closeSettings() {
    overlay.hidden = true;
    if (llmKeyInput) llmKeyInput.value = "";
    if (minimaxKeyInput) minimaxKeyInput.value = "";
  }

  settingsBtn.addEventListener("click", () => openSettings());
  closeBtn.addEventListener("click", closeSettings);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeSettings(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) closeSettings(); });

  if (providerSelect) {
    providerSelect.addEventListener("change", () => {
      const provider = providerSelect.value;
      const customSection = document.getElementById("settings-custom-llm-section");
      const modelRow = document.getElementById("settings-model-row");
      if (provider === "custom") {
        if (customSection) customSection.style.display = "";
        if (modelRow) modelRow.style.display = "none";
      } else {
        if (customSection) customSection.style.display = "none";
        if (modelRow) modelRow.style.display = "";
        if (cachedProviders?.[provider]) populateModelSelect(cachedProviders[provider].models, null);
      }
    });
  }

  saveLlmBtn?.addEventListener("click", async () => {
    const provider = providerSelect?.value || "auto";
    const apiKey = llmKeyInput.value.trim();
    saveLlmBtn.disabled = true;

    if (provider === "custom") {
      const baseURL = document.getElementById("settings-custom-baseurl")?.value?.trim();
      const model   = document.getElementById("settings-custom-model")?.value?.trim();
      if (!baseURL || !model) {
        showFeedback(llmFeedback, "请填入 Base URL 和模型名称", true);
        saveLlmBtn.disabled = false;
        return;
      }
      try {
        const res = await fetch(`${API}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "custom", baseURL, model, apiKey: apiKey || "none" }),
        });
        const data = await res.json();
        if (data.ok) {
          showFeedback(llmFeedback, `已连接：${data.model}`);
          llmKeyInput.value = "";
          loadSettings();
        } else {
          showFeedback(llmFeedback, data.error || "连接失败", true);
        }
      } catch { showFeedback(llmFeedback, "请求失败", true); }
      finally { saveLlmBtn.disabled = false; }
      return;
    }

    const model = modelSelect.value;
    try {
      const body = apiKey
        ? { provider, apiKey, ...(provider === "auto" ? {} : { model }) }
        : { model };
      const res = await fetch(apiKey ? `${API}/activate` : `${API}/settings/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        showFeedback(llmFeedback, "已保存");
        llmKeyInput.value = "";
        loadSettings();
      } else {
        showFeedback(llmFeedback, data.error || "保存失败", true);
      }
    } catch { showFeedback(llmFeedback, "请求失败", true); }
    finally { saveLlmBtn.disabled = false; }
  });

  saveMinimaxBtn?.addEventListener("click", async () => {
    const apiKey = minimaxKeyInput.value.trim();
    if (!apiKey) { showFeedback(minimaxFeedback, "API Key 不能为空", true); return; }
    saveMinimaxBtn.disabled = true;
    try {
      const res = await fetch(`${API}/settings/minimax`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (data.ok) {
        showFeedback(minimaxFeedback, "已保存");
        minimaxKeyInput.value = "";
        loadSettings();
      } else {
        showFeedback(minimaxFeedback, data.error || "保存失败", true);
      }
    } catch { showFeedback(minimaxFeedback, "请求失败", true); }
    finally { saveMinimaxBtn.disabled = false; }
  });

  const clawbotConnectBtn = document.getElementById("clawbot-connect-btn");
  const clawbotLogoutBtn  = document.getElementById("clawbot-logout-btn");
  const clawbotQrArea     = document.getElementById("clawbot-qr-area");
  const clawbotQrImg      = document.getElementById("clawbot-qr-img");
  const clawbotQrHint     = document.getElementById("clawbot-qr-hint");
  const clawbotFeedback   = document.getElementById("clawbot-feedback");
  const clawbotStatus     = document.getElementById("social-status-clawbot");
  let clawbotPollTimer    = null;

  function setClawbotStatus(text, ok) {
    if (!clawbotStatus) return;
    clawbotStatus.textContent = ok ? `● ${text}` : `○ ${text}`;
    clawbotStatus.className = `settings-platform-status ${ok ? "ok" : "miss"}`;
  }

  function stopClawbotPoll() {
    if (clawbotPollTimer) { clearInterval(clawbotPollTimer); clawbotPollTimer = null; }
  }

  async function pollClawbotQR() {
    try {
      const data = await fetch(`${API}/social/wechat-clawbot/qr`).then(r => r.json());
      if (data.status === "connected") {
        stopClawbotPoll();
        if (clawbotQrArea) clawbotQrArea.style.display = "none";
        setClawbotStatus("已连接", true);
        if (clawbotFeedback) showFeedback(clawbotFeedback, "微信绑定成功！");
        loadSocialSettings();
      } else if (data.status === "qr_ready" && data.qr_url) {
        if (clawbotQrImg) clawbotQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qr_url)}`;
        if (clawbotQrArea) clawbotQrArea.style.display = "block";
        if (clawbotQrHint) clawbotQrHint.textContent = "等待扫码…";
        setClawbotStatus("等待扫码", false);
      } else if (data.status === "qr_pending") {
        if (clawbotQrHint) clawbotQrHint.textContent = "正在生成二维码…";
      } else if (data.status === "error") {
        stopClawbotPoll();
        if (clawbotQrArea) clawbotQrArea.style.display = "none";
        setClawbotStatus("连接失败", false);
        if (clawbotFeedback) showFeedback(clawbotFeedback, data.error || "连接失败", true);
      }
    } catch {}
  }

  if (clawbotConnectBtn) {
    pollClawbotQR();
  }

  clawbotConnectBtn?.addEventListener("click", async () => {
    if (clawbotQrArea) clawbotQrArea.style.display = "none";
    setClawbotStatus("启动中…", false);
    stopClawbotPoll();
    try {
      await fetch(`${API}/settings/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _clawbot_connect: "1" }),
      });
    } catch {}
    await pollClawbotQR();
    clawbotPollTimer = setInterval(pollClawbotQR, 2000);
  });

  clawbotLogoutBtn?.addEventListener("click", async () => {
    stopClawbotPoll();
    if (clawbotQrArea) clawbotQrArea.style.display = "none";
    try {
      await fetch(`${API}/social/wechat-clawbot/logout`, { method: "POST" });
      setClawbotStatus("已断开", false);
      showFeedback(clawbotFeedback, "微信已断开");
    } catch {
      showFeedback(clawbotFeedback, "请求失败", true);
    }
  });

  window.addEventListener("bailongma:social_status", (e) => {
    const d = e.detail;
    if (d?.platform !== "wechat-clawbot") return;
    if (d.status === "connected") {
      stopClawbotPoll();
      if (clawbotQrArea) clawbotQrArea.style.display = "none";
      setClawbotStatus("已连接", true);
    } else if (d.status === "qr_ready") {
      if (!clawbotPollTimer) clawbotPollTimer = setInterval(pollClawbotQR, 2000);
      pollClawbotQR();
    } else if (d.status === "session_expired") {
      stopClawbotPoll();
      setClawbotStatus("会话已过期 — 请重新扫码", false);
    } else if (d.status === "idle") {
      setClawbotStatus("未连接", false);
    }
  });

  const settingsCheckUpdateBtn     = document.getElementById("settings-check-update-btn");
  const settingsDownloadUpdateBtn  = document.getElementById("settings-download-update-btn");
  const settingsInstallUpdateBtn   = document.getElementById("settings-install-update-btn");
  const settingsIgnoreUpdateBtn    = document.getElementById("settings-ignore-update-btn");
  const settingsUpdateStatusEl     = document.getElementById("settings-update-status");
  const settingsUpdateFeedback     = document.getElementById("settings-update-feedback");
  const settingsCurrentVersion     = document.getElementById("settings-current-version");
  const settingsSuppressToggle     = document.getElementById("settings-suppress-updates");
  const settingsIgnoredSection     = document.getElementById("settings-ignored-section");
  const settingsIgnoredVersionEl   = document.getElementById("settings-ignored-version-val");
  const settingsClearIgnoredBtn    = document.getElementById("settings-clear-ignored-btn");

  let pendingUpdateVersion = null;
  let removeUpdaterListener = null;

  function setUpdateStatusText(text, state = "idle") {
    if (!settingsUpdateStatusEl) return;
    settingsUpdateStatusEl.textContent = text;
    settingsUpdateStatusEl.dataset.state = state;
  }

  function setUpdateFeedback(text, isError = false) {
    if (!settingsUpdateFeedback) return;
    settingsUpdateFeedback.textContent = text || "";
    settingsUpdateFeedback.className = isError ? "settings-feedback error" : "settings-feedback";
  }

  function showUpdateButtons({ check = true, checkDisabled = false, checkLabel = "检查更新", download = false, install = false, ignore = false } = {}) {
    if (settingsCheckUpdateBtn) {
      settingsCheckUpdateBtn.classList.toggle("hidden", !check);
      settingsCheckUpdateBtn.disabled = checkDisabled;
      settingsCheckUpdateBtn.textContent = checkLabel;
    }
    settingsDownloadUpdateBtn?.classList.toggle("hidden", !download);
    settingsInstallUpdateBtn?.classList.toggle("hidden", !install);
    settingsIgnoreUpdateBtn?.classList.toggle("hidden", !ignore);
  }

  function syncUpdateSettings() {
    const ignored = localStorage.getItem(IGNORED_VERSION_KEY) || null;
    const suppressed = localStorage.getItem(SUPPRESS_UPDATES_KEY) === "true";
    if (settingsSuppressToggle) settingsSuppressToggle.checked = suppressed;
    if (settingsIgnoredSection) settingsIgnoredSection.style.display = ignored ? "" : "none";
    if (settingsIgnoredVersionEl && ignored) settingsIgnoredVersionEl.textContent = ignored;
  }

  async function loadUpdateSettings() {
    syncUpdateSettings();
    const bridge = window.bailongma;
    if (!bridge?.isElectron) {
      if (settingsCurrentVersion) settingsCurrentVersion.textContent = "仅桌面端可用";
      if (settingsCheckUpdateBtn) settingsCheckUpdateBtn.disabled = true;
      setUpdateStatusText("仅桌面端可用", "muted");
      return;
    }
    try {
      const ver = await bridge.getVersion?.();
      if (settingsCurrentVersion && ver) settingsCurrentVersion.textContent = ver;
    } catch {}

    removeUpdaterListener = bridge.onUpdaterStatus?.((payload = {}) => {
      const stage = payload.stage || "idle";
      const ver = payload.version || "";
      const percent = typeof payload.percent === "number" ? Math.round(payload.percent) : null;

      switch (stage) {
        case "checking":
          setUpdateStatusText("正在检查更新…", "checking");
          showUpdateButtons({ checkDisabled: true, checkLabel: "检查中…" });
          break;
        case "available":
          pendingUpdateVersion = ver;
          setUpdateStatusText(`发现新版本 ${ver}`, "available");
          showUpdateButtons({ check: false, download: true, ignore: true });
          break;
        case "downloading":
          setUpdateStatusText(`下载中${percent !== null ? ` ${percent}%` : "…"}`, "downloading");
          showUpdateButtons({ check: false });
          break;
        case "downloaded":
          setUpdateStatusText(`版本 ${ver} 已就绪 — 重启后安装`, "ready");
          showUpdateButtons({ check: false, install: true });
          break;
        case "up-to-date":
          setUpdateStatusText(`已是最新版本 ${ver}`, "idle");
          showUpdateButtons({ checkLabel: "检查更新" });
          break;
        case "error":
          setUpdateStatusText(`更新失败：${payload.message || "请稍后再试"}`, "error");
          showUpdateButtons({ checkLabel: "重试" });
          break;
        case "dev":
          setUpdateStatusText("开发模式不检查更新", "muted");
          showUpdateButtons({ checkDisabled: true, checkLabel: "开发模式" });
          break;
        default:
          showUpdateButtons({});
          break;
      }
    }) || null;
  }

  window.addEventListener("beforeunload", () => {
    if (typeof removeUpdaterListener === "function") {
      removeUpdaterListener();
      removeUpdaterListener = null;
    }
  });

  settingsSuppressToggle?.addEventListener("change", () => {
    localStorage.setItem(SUPPRESS_UPDATES_KEY, settingsSuppressToggle.checked ? "true" : "false");
    syncUpdateSettings();
  });

  settingsClearIgnoredBtn?.addEventListener("click", () => {
    localStorage.removeItem(IGNORED_VERSION_KEY);
    syncUpdateSettings();
  });

  settingsCheckUpdateBtn?.addEventListener("click", async () => {
    const bridge = window.bailongma;
    if (!bridge?.isElectron) return;
    setUpdateStatusText("正在检查更新…", "checking");
    setUpdateFeedback("");
    showUpdateButtons({ checkDisabled: true, checkLabel: "检查中…" });
    try {
      const result = await bridge.checkForUpdates?.();
      if (result?.ok === false && result?.message) {
        setUpdateStatusText(`更新失败：${result.message}`, "error");
        showUpdateButtons({ checkLabel: "重试" });
      }
    } catch (err) {
      setUpdateStatusText(`更新失败：${err?.message || "请稍后再试"}`, "error");
      showUpdateButtons({ checkLabel: "重试" });
    }
  });

  settingsDownloadUpdateBtn?.addEventListener("click", async () => {
    const bridge = window.bailongma;
    if (!bridge?.isElectron) return;
    setUpdateStatusText("开始下载…", "downloading");
    showUpdateButtons({ check: false });
    try {
      await bridge.startDownload?.();
    } catch (err) {
      setUpdateStatusText(`下载失败：${err?.message || "请稍后再试"}`, "error");
      showUpdateButtons({ checkLabel: "重试" });
    }
  });

  settingsInstallUpdateBtn?.addEventListener("click", () => {
    window.bailongma?.quitAndInstall?.();
  });

  settingsIgnoreUpdateBtn?.addEventListener("click", () => {
    if (pendingUpdateVersion) {
      localStorage.setItem(IGNORED_VERSION_KEY, pendingUpdateVersion);
      syncUpdateSettings();
    }
    setUpdateStatusText("已忽略此版本", "muted");
    showUpdateButtons({ checkLabel: "检查更新" });
  });
})();

// ── Voice panel ──
initVoicePanel({
  btnId:      "voice-btn",
  panelId:    "voice-panel",
  canvasId:   "voice-canvas",
  statusId:   "voice-status",
  transcriptId: "voice-transcript",
  getChatInput:  () => document.getElementById("msg-input"),
  getSendBtn:    () => document.getElementById("send-btn"),
  getSendMessage: (options) => chat?.send?.(options),
  getLang:       () => localStorage.getItem("bailongma-voice-lang") || "zh-CN",
  getAutoSend:   () => localStorage.getItem("bailongma-voice-auto-send") !== "false",
  getAutoMic:    () => localStorage.getItem("bailongma-voice-auto-mic") === "true",
});

// ── Hotspot mode ──
initHotspot().catch((err) => console.warn('[Hotspot] init failed:', err));

// ── Media modes (video / image) ──
(function initMediaModes() {
  const videoBtn      = document.getElementById("video-btn");
  const videoExitBtn  = document.getElementById("video-exit-btn");
  const videoFeed     = document.getElementById("video-feed");
  const videoFrame    = document.getElementById("video-frame");
  const videoSurface  = document.getElementById("video-surface");
  const videoBackdrop = document.getElementById("video-backdrop");
  const videoTitle    = document.getElementById("video-title");
  const videoUrlInput = document.getElementById("video-url-input");
  const videoOpenBtn  = document.getElementById("video-open-btn");
  const imageExitBtn  = document.getElementById("image-exit-btn");
  const imageDisplay  = document.getElementById("image-display");
  const imageSurface  = document.getElementById("image-surface");
  const imageTitle    = document.getElementById("image-title");

  let videoStream = null;
  let videoActive = false;
  let imageActive = false;
  let videoKind   = "empty";
  let mediaVoiceDuck = null;
  const VOICE_VIDEO_DUCK_KEY = "bailongma-voice-video-duck";
  const VOICE_VIDEO_PTT_KEY = "bailongma-voice-video-ptt";
  let currentVideoSource = "";
  let currentVideoStart = null;
  // wall-clock ms when current play started/resumed; used to estimate elapsed
  // for cross-origin iframes (bilibili) where we can't read currentTime.
  let playResumeAt = null;

  function normalizeUrl(url = "") {
    return String(url || "").trim();
  }

  function localPathToUrl(src) {
    const s = String(src || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (/^(blob:|data:)/i.test(s)) return s;
    // Local path (file:// or absolute) → backend HTTP media endpoint to avoid file:// CORS restriction.
    let resolved = s;
    if (/^file:\/\//i.test(s)) {
      try { resolved = decodeURIComponent(new URL(s).pathname); }
      catch { resolved = decodeURIComponent(s.replace(/^file:\/\/\//i, "/").replace(/^file:\/\//i, "")); }
    }
    if (!/^\/|^[A-Za-z]:[\\/]/.test(resolved)) return s;
    return "/media/video?path=" + encodeURIComponent(resolved);
  }

  function extractYoutubeId(url) {
    return normalizeUrl(url).match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/
    )?.[1] || null;
  }

  function youtubeEmbedUrl(url, { autoplay = false, start = null } = {}) {
    const id = extractYoutubeId(url);
    if (!id) return null;
    const params = new URLSearchParams({
      enablejsapi: "1",
      playsinline: "1",
      rel: "0",
      autoplay: autoplay ? "1" : "0",
    });
    if (Number.isFinite(Number(start))) params.set("start", String(Math.max(0, Math.round(Number(start)))));
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  }

  function extractBilibiliId(url) {
    const raw = normalizeUrl(url);
    return raw.match(/\/video\/(BV[A-Za-z0-9]+)/i)?.[1]
        || raw.match(/\b(BV[A-Za-z0-9]+)\b/i)?.[1]
        || null;
  }

  function bilibiliEmbedUrl(url, { autoplay = false, start = null } = {}) {
    const bvid = extractBilibiliId(url);
    if (!bvid) return null;
    const params = new URLSearchParams({
      bvid,
      autoplay: autoplay ? "1" : "0",
      high_quality: "1",
    });
    if (Number.isFinite(Number(start))) params.set("t", String(Math.max(0, Math.round(Number(start)))));
    return `https://player.bilibili.com/player.html?${params.toString()}`;
  }

  function iframeUrlFor(url, options) {
    return youtubeEmbedUrl(url, options) || bilibiliEmbedUrl(url, options);
  }

  function saveMediaHistory({ url, title, kind, videoId = null, platform = null }) {
    fetch(`${API}/media/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title: title || "", kind, videoId, platform }),
    }).catch(() => {});
  }

  async function validateYoutubeUrl(url) {
    try {
      const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembed, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return null; // network failure — don't block, allow playback to proceed
    }
  }

  function stopCamera() {
    videoStream?.getTracks().forEach(t => t.stop());
    videoStream = null;
  }

  function setPanelVisible(visible) {
    videoActive = Boolean(visible);
    document.body.classList.toggle("video-mode", videoActive);
    videoBtn?.classList.toggle("active", videoActive);
    if (videoActive) moveVoicePanelToBody();
    else restoreVoicePanel();
    window.dispatchEvent(new CustomEvent("bailongma:video-mode", {
      detail: { active: videoActive, kind: videoKind },
    }));
  }

  function pauseCurrentVideo() {
    if (videoKind === "youtube") {
      postFrameCommand("pauseVideo");
      playResumeAt = null;
    } else if (videoKind === "bilibili") {
      // bilibili iframe 跨域读不到 currentTime，用 wall-clock 估算累计进度
      if (playResumeAt) {
        const elapsed = (Date.now() - playResumeAt) / 1000;
        currentVideoStart = (Number(currentVideoStart) || 0) + elapsed;
      }
      playResumeAt = null;
      reloadFrameAutoplay(false);
    } else if (videoKind === "file") {
      try { videoFeed?.pause?.(); } catch {}
      playResumeAt = null;
    }
  }

  function resumeCurrentVideo() {
    if (videoKind === "youtube") {
      postFrameCommand("playVideo");
      playResumeAt = Date.now();
    } else if (videoKind === "bilibili") {
      reloadFrameAutoplay(true);
      playResumeAt = Date.now();
    } else if (videoKind === "file") {
      videoFeed?.play?.().catch(() => {});
      playResumeAt = Date.now();
    }
  }

  function isVideoPlayableActive() {
    return videoActive && videoKind && videoKind !== "empty" && videoKind !== "camera";
  }

  function getMediaDuckLevel() {
    return Math.max(0.02, Math.min(0.50, Number(localStorage.getItem(VOICE_VIDEO_DUCK_LEVEL_KEY) || 0.10) || 0.10));
  }

  function getMediaDuckHoldMs(fallback = 2200) {
    return Math.max(800, Math.min(8000, Number(localStorage.getItem(VOICE_VIDEO_DUCK_HOLD_KEY) || fallback) || fallback));
  }

  function updateMediaDuckStatus(active, detail = {}) {
    emitVoiceEvent(VOICE_EVENT_TYPES.MEDIA_DUCK, { active, ...detail });
    window.dispatchEvent(new CustomEvent("bailongma:media-duck", { detail: { active, ...detail } }));
    const el = document.getElementById("voice-media-duck-status");
    if (el) el.textContent = active ? `已压低视频音量（${detail.kind || videoKind}）` : "空闲";
  }

  function startMediaVoiceDuck({ holdMs = null, pause = false } = {}) {
    if (!isVideoPlayableActive()) return;
    if (localStorage.getItem(VOICE_VIDEO_DUCK_KEY) === "false" && !pause) return;
    holdMs = holdMs == null ? getMediaDuckHoldMs() : holdMs;
    const duckLevel = getMediaDuckLevel();
    const now = Date.now();
    const existing = mediaVoiceDuck;
    if (!existing) {
      mediaVoiceDuck = {
        startedAt: now,
        kind: videoKind,
        fileVolume: videoFeed ? videoFeed.volume : null,
        fileMuted: videoFeed ? videoFeed.muted : null,
        paused: false,
        timer: null,
      };
      if (videoKind === "file" && videoFeed) {
        videoFeed.dataset.voiceDuck = "1";
        videoFeed.volume = Math.min(videoFeed.volume || 1, duckLevel);
        videoFeed.muted = false;
      } else if (videoKind === "youtube") {
        postFrameCommand("setVolume", [Math.round(duckLevel * 100)]);
      } else if (videoKind === "bilibili") {
        pauseCurrentVideo();
        mediaVoiceDuck.paused = true;
      }
    }
    if (pause && mediaVoiceDuck && !mediaVoiceDuck.paused) {
      pauseCurrentVideo();
      mediaVoiceDuck.paused = true;
    }
    updateMediaDuckStatus(true, { kind: videoKind, paused: Boolean(mediaVoiceDuck?.paused), duckLevel, holdMs });
    clearTimeout(mediaVoiceDuck.timer);
    mediaVoiceDuck.timer = setTimeout(() => restoreMediaVoiceDuck(), holdMs);
  }

  function restoreMediaVoiceDuck() {
    const duck = mediaVoiceDuck;
    if (!duck) return;
    clearTimeout(duck.timer);
    mediaVoiceDuck = null;
    if (!videoActive) return;
    if (duck.kind === "file" && videoFeed) {
      if (Number.isFinite(Number(duck.fileVolume))) videoFeed.volume = duck.fileVolume;
      videoFeed.muted = Boolean(duck.fileMuted);
      delete videoFeed.dataset.voiceDuck;
      if (duck.paused) videoFeed.play?.().catch(() => {});
    } else if (duck.kind === "youtube") {
      postFrameCommand("setVolume", [100]);
      if (duck.paused) resumeCurrentVideo();
    } else if (duck.kind === "bilibili") {
      if (duck.paused) resumeCurrentVideo();
    }
    updateMediaDuckStatus(false, { kind: duck.kind });
  }

  function pauseForAssistantVoice() {
    if (!isVideoPlayableActive()) return;
    startMediaVoiceDuck({ holdMs: Math.max(12000, getMediaDuckHoldMs(2200) * 4), pause: true });
  }

  function resetVideoSurface() {
    restoreMediaVoiceDuck();
    stopCamera();
    if (videoFeed) {
      try { videoFeed.pause(); } catch {}
      videoFeed.removeAttribute("src");
      videoFeed.srcObject = null;
      videoFeed.hidden = true;
      videoFeed.load?.();
    }
    if (videoFrame) {
      videoFrame.src = "about:blank";
      videoFrame.hidden = true;
    }
    if (videoBackdrop) videoBackdrop.style.backgroundImage = "";
    videoSurface?.classList.remove("has-media");
    videoKind = "empty";
    currentVideoSource = "";
    currentVideoStart = null;
    playResumeAt = null;
  }

  function toggleVideoPanelVisibility() {
    if (videoActive) {
      pauseCurrentVideo();
      setPanelVisible(false);
    } else {
      if (musicActive) closeMusicPanel();
      setPanelVisible(true);
      if (videoKind !== "empty") resumeCurrentVideo();
    }
  }

  function closeAndDestroyVideo() {
    setPanelVisible(false);
    resetVideoSurface();
  }

  function setVideoModeActive(active) {
    if (!active) {
      closeAndDestroyVideo();
    } else {
      setPanelVisible(true);
    }
  }

  function setBackdrop(kind, url) {
    if (!videoBackdrop) return;
    if (kind === "youtube") {
      const id = extractYoutubeId(url);
      if (id) {
        videoBackdrop.style.backgroundImage =
          `url(https://img.youtube.com/vi/${id}/maxresdefault.jpg)`;
        return;
      }
    }
    // Bilibili / file / camera: solid color fallback (CSS already sets #000 background)
    videoBackdrop.style.backgroundImage = "";
  }

  async function showCamera({ title = "Camera", autoplay = true } = {}) {
    setPanelVisible(true);
    resetVideoSurface();
    if (videoTitle) videoTitle.textContent = title;
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoFeed) {
        videoFeed.hidden = false;
        videoFeed.muted = true;
        videoFeed.srcObject = videoStream;
        if (autoplay) videoFeed.play?.().catch(() => {});
      }
      videoSurface?.classList.add("has-media");
      videoKind = "camera";
    } catch (e) {
      console.warn("Camera access failed:", e);
    }
  }

  async function showVideo({
    url = "", title = "Video", autoplay = true,
    muted = false, volume = null, currentTime = null, camera = false,
  } = {}) {
    if (camera) { showCamera({ title, autoplay }); return; }

    const rawSource = normalizeUrl(url);
    const source = localPathToUrl(rawSource);
    if (musicActive) closeMusicPanel();
    setPanelVisible(true);
    resetVideoSurface();
    currentVideoSource = rawSource || source;
    currentVideoStart = Number.isFinite(Number(currentTime)) ? Math.max(0, Number(currentTime)) : null;
    if (videoTitle) videoTitle.textContent = title || "Video";

    const embedUrl = iframeUrlFor(source, { autoplay, start: currentTime });
    if (embedUrl && videoFrame) {
      videoFrame.hidden = false;
      videoFrame.src = embedUrl;
      videoSurface?.classList.add("has-media");
      videoKind = embedUrl.includes("youtube.com") ? "youtube" : "bilibili";
      if (autoplay) playResumeAt = Date.now();

      setBackdrop(videoKind, source);
      saveMediaHistory({
        url: source,
        title,
        kind: videoKind,
        videoId: videoKind === "youtube" ? extractYoutubeId(source) : extractBilibiliId(source),
        platform: videoKind,
      });

      if (videoKind === "youtube") {
        validateYoutubeUrl(source).then(ok => {
          if (ok === false) console.warn("[Media] YouTube video may not play (region block / private / deleted):", source);
        });
      }
      return;
    }

    if (videoFeed && source) {
      videoFeed.hidden = false;
      videoFeed.src = source;
      videoFeed.muted = Boolean(muted);
      if (Number.isFinite(Number(volume))) videoFeed.volume = Math.max(0, Math.min(1, Number(volume)));
      if (Number.isFinite(Number(currentTime))) videoFeed.currentTime = Math.max(0, Number(currentTime));
      videoSurface?.classList.add("has-media");
      videoKind = "file";
      saveMediaHistory({ url: rawSource || source, title, kind: "file" });
      if (autoplay) {
        videoFeed.play?.().catch(() => {});
        playResumeAt = Date.now();
      }
    }
  }

  function postFrameCommand(command, args = []) {
    if (!videoFrame?.contentWindow || videoFrame.hidden) return;
    if (videoKind === "youtube") {
      videoFrame.contentWindow.postMessage(JSON.stringify({
        event: "command",
        func: command,
        args,
      }), "*");
    }
  }

  function reloadFrameAutoplay(autoplay) {
    if (!videoFrame || videoFrame.hidden || !currentVideoSource) return;
    const nextUrl = iframeUrlFor(currentVideoSource, {
      autoplay,
      start: currentVideoStart,
    });
    if (nextUrl) videoFrame.src = nextUrl;
  }

  function controlVideo({ action, volume, currentTime, autoplay } = {}) {
    const op = action || (autoplay ? "play" : null);
    if (op === "hide" || op === "close") { closeAndDestroyVideo(); return; }
    if (op === "play") resumeCurrentVideo();
    if (op === "pause") pauseCurrentVideo();
    if (Number.isFinite(Number(volume))) {
      const v = Math.max(0, Math.min(1, Number(volume)));
      if (videoFeed) { videoFeed.volume = v; videoFeed.muted = v === 0; }
      postFrameCommand("setVolume", [Math.round(v * 100)]);
    }
    if (Number.isFinite(Number(currentTime))) {
      const t = Math.max(0, Number(currentTime));
      currentVideoStart = t;
      if (videoFeed) videoFeed.currentTime = t;
      postFrameCommand("seekTo", [t, true]);
      // seek 后重置 elapsed 基线，下次 pause 时累计才正确
      if (playResumeAt) playResumeAt = Date.now();
    }
  }

  function setImageModeActive(active) {
    imageActive = Boolean(active);
    document.body.classList.toggle("image-mode", imageActive);
    if (!imageActive && imageDisplay) {
      imageDisplay.removeAttribute("src");
      imageDisplay.alt = "";
      imageSurface?.classList.remove("has-media");
    }
  }

  function showImage({ url = "", title = "Image", alt = "" } = {}) {
    const source = normalizeUrl(url);
    setImageModeActive(true);
    if (imageTitle) imageTitle.textContent = title || "Image";
    if (imageDisplay && source) {
      imageDisplay.src = source;
      imageDisplay.alt = alt || title || "";
      imageSurface?.classList.add("has-media");
    }
  }

  function handleMediaCommand(payload = {}) {
    const mode   = payload.mode || payload.kind;
    const action = payload.action || "show";
    if (mode === "image") {
      if (action === "hide" || action === "close") setImageModeActive(false);
      else showImage(payload);
      return { ok: true, mode: "image", action };
    }
    if (mode === "camera") {
      if (action === "hide" || action === "close") closeAndDestroyVideo();
      else showCamera(payload);
      return { ok: true, mode: "camera", action };
    }
    if (mode === "video") {
      if (action === "show" || payload.url || payload.camera) showVideo(payload);
      else controlVideo(payload);
      return { ok: true, mode: "video", action };
    }
    if (mode === "music") {
      if (action === "show" || payload.src || payload.playlist) showMusic(payload);
      else controlMusic(payload);
      return { ok: true, mode: "music", action };
    }
    return { ok: false, error: "unknown media mode" };
  }

  // ── Music mode ────────────────────────────────────────────────────────────
  const musicBtn       = document.getElementById("music-btn");
  const musicExitBtn   = document.getElementById("music-exit-btn");
  const musicAudio     = document.getElementById("music-audio");
  const musicPlayBtn   = document.getElementById("music-play");
  const musicPrevBtn   = document.getElementById("music-prev");
  const musicNextBtn   = document.getElementById("music-next");
  const musicSeek      = document.getElementById("music-seek");
  const musicVolInput  = document.getElementById("music-vol");
  const musicTimeCur   = document.getElementById("music-time-cur");
  const musicTimeTotal = document.getElementById("music-time-total");
  const musicMetaTitle  = document.getElementById("music-meta-title");
  const musicMetaArtist = document.getElementById("music-meta-artist");
  const musicCoverEl    = document.getElementById("music-cover");
  const musicCoverTitle = document.getElementById("music-cover-title");
  const musicCoverArtist = document.getElementById("music-cover-artist");
  const musicLyricsScroll = document.getElementById("music-lyrics-scroll");
  const musicNoLyrics     = document.getElementById("music-no-lyrics");

  let musicActive  = false;
  let musicPlaying = false;
  let musicWasPlayingBeforeHide = false;
  let lrcLines     = [];
  let playlist     = [];
  let playlistIdx  = 0;
  let isSeeking    = false;

  function parseLrc(text) {
    const lines = [];
    const re = /\[(\d+):(\d{1,2}(?:\.\d+)?)\](.*)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const t = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
      const txt = m[3].trim();
      if (txt) lines.push({ time: t, text: txt });
    }
    return lines.sort((a, b) => a.time - b.time);
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  function setMusicPanelVisible(visible) {
    musicActive = Boolean(visible);
    document.body.classList.toggle("music-mode", musicActive);
    musicBtn?.classList.toggle("active", musicActive);
    window.dispatchEvent(new CustomEvent("bailongma:music-mode", {
      detail: { active: musicActive },
    }));
  }

  function setMusicPlaying(playing) {
    musicPlaying = Boolean(playing);
    document.body.classList.toggle("music-playing", musicPlaying);
    if (musicPlayBtn) musicPlayBtn.textContent = musicPlaying ? "⏸" : "▶";
    if (musicPlaying) {
      musicAudio?.play?.().catch(() => {});
    } else {
      musicAudio?.pause?.();
    }
  }

  function loadLrc(lrcText) {
    lrcLines = lrcText ? parseLrc(lrcText) : [];
    if (musicLyricsScroll) {
      musicLyricsScroll.innerHTML = lrcLines
        .map((l, i) => `<div class="lrc-line" data-idx="${i}">${l.text}</div>`)
        .join("");
    }
    if (musicNoLyrics) musicNoLyrics.hidden = lrcLines.length > 0;
  }

  function syncLyrics(currentTime) {
    if (!lrcLines.length || !musicLyricsScroll) return;
    let active = -1;
    for (let i = 0; i < lrcLines.length; i++) {
      if (lrcLines[i].time <= currentTime + 0.3) active = i;
      else break;
    }
    if (active < 0) return;
    const lines = musicLyricsScroll.querySelectorAll(".lrc-line");
    lines.forEach((el, i) => el.classList.toggle("active", i === active));
    const activeLine = lines[active];
    if (activeLine) {
      const pane = document.getElementById("music-lyrics-pane");
      if (pane) pane.scrollTo({ top: activeLine.offsetTop - pane.clientHeight / 2 + activeLine.clientHeight / 2, behavior: "smooth" });
    }
  }

  function loadTrack(index, autoplay = true) {
    const track = playlist[index];
    if (!track || !musicAudio) return;

    musicAudio.src = localPathToUrl(track.src || "");
    musicAudio.volume = parseFloat(musicVolInput?.value ?? "0.8");

    const title  = track.title  || "未知曲目";
    const artist = track.artist || "";
    if (musicMetaTitle)  musicMetaTitle.textContent  = title;
    if (musicMetaArtist) musicMetaArtist.textContent = artist;
    if (musicCoverTitle)  musicCoverTitle.textContent  = title.slice(0, 14);
    if (musicCoverArtist) musicCoverArtist.textContent = artist;
    if (musicTimeCur)   musicTimeCur.textContent   = "0:00";
    if (musicTimeTotal) musicTimeTotal.textContent = "0:00";
    if (musicSeek)      { musicSeek.value = "0"; musicSeek.max = "100"; }

    if (track.cover && musicCoverEl) {
      musicCoverEl.style.backgroundImage = `url(${track.cover})`;
      musicCoverEl.style.background = "";
    } else if (musicCoverEl) {
      musicCoverEl.style.backgroundImage = "";
      let hash = 0;
      for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
      const hue = Math.abs(hash) % 360;
      musicCoverEl.style.background = `hsl(${hue}, 45%, 32%)`;
    }

    loadLrc(track.lrc || "");
    if (autoplay) setMusicPlaying(true);
  }

  function showMusic({
    src = "", title = "", artist = "", lrc = "", cover = "",
    autoplay = true, playlist: pl = null,
  } = {}) {
    if (videoActive) closeAndDestroyVideo();
    setMusicPanelVisible(true);
    if (pl && pl.length) {
      playlist = pl;
    } else {
      playlist = [{ src, title, artist, lrc, cover }];
    }
    playlistIdx = 0;
    loadTrack(0, autoplay);
  }

  function closeMusicPanel() {
    setMusicPlaying(false);
    setMusicPanelVisible(false);
    if (musicAudio) musicAudio.src = "";
    lrcLines = [];
    if (musicLyricsScroll) musicLyricsScroll.innerHTML = "";
    if (musicNoLyrics) musicNoLyrics.hidden = false;
  }

  function controlMusic({ action, volume, currentTime } = {}) {
    if (action === "hide" || action === "close") { closeMusicPanel(); return; }
    if (action === "play")  setMusicPlaying(true);
    if (action === "pause") setMusicPlaying(false);
    if (Number.isFinite(Number(volume))) {
      const v = Math.max(0, Math.min(1, Number(volume)));
      if (musicAudio) musicAudio.volume = v;
      if (musicVolInput) musicVolInput.value = String(v);
    }
    if (Number.isFinite(Number(currentTime)) && musicAudio) {
      musicAudio.currentTime = Math.max(0, Number(currentTime));
    }
  }

  function toggleMusicPanelVisibility() {
    if (musicActive) {
      musicWasPlayingBeforeHide = musicPlaying;
      setMusicPlaying(false);
      setMusicPanelVisible(false);
    } else if (musicAudio?.src) {
      if (videoActive) closeAndDestroyVideo();
      setMusicPanelVisible(true);
      if (musicWasPlayingBeforeHide) setMusicPlaying(true);
    }
  }

  if (musicAudio) {
    musicAudio.addEventListener("loadedmetadata", () => {
      if (musicTimeTotal) musicTimeTotal.textContent = fmtTime(musicAudio.duration);
      if (musicSeek) musicSeek.max = String(musicAudio.duration || 100);
    });
    musicAudio.addEventListener("timeupdate", () => {
      if (isSeeking) return;
      const t = musicAudio.currentTime;
      if (musicTimeCur) musicTimeCur.textContent = fmtTime(t);
      if (musicSeek && musicAudio.duration) musicSeek.value = String(t);
      syncLyrics(t);
    });
    musicAudio.addEventListener("ended", () => {
      setMusicPlaying(false);
      if (playlistIdx < playlist.length - 1) {
        playlistIdx++;
        loadTrack(playlistIdx, true);
      }
    });
  }

  musicPlayBtn?.addEventListener("click", () => setMusicPlaying(!musicPlaying));
  musicPrevBtn?.addEventListener("click", () => {
    if (playlistIdx > 0) { playlistIdx--; loadTrack(playlistIdx, musicPlaying); }
    else if (musicAudio) musicAudio.currentTime = 0;
  });
  musicNextBtn?.addEventListener("click", () => {
    if (playlistIdx < playlist.length - 1) { playlistIdx++; loadTrack(playlistIdx, musicPlaying); }
  });
  musicVolInput?.addEventListener("input", () => {
    if (musicAudio) musicAudio.volume = parseFloat(musicVolInput.value);
  });
  musicSeek?.addEventListener("mousedown", () => { isSeeking = true; });
  musicSeek?.addEventListener("input", () => {
    if (musicTimeCur) musicTimeCur.textContent = fmtTime(parseFloat(musicSeek.value));
  });
  musicSeek?.addEventListener("change", () => {
    if (musicAudio) musicAudio.currentTime = parseFloat(musicSeek.value);
    isSeeking = false;
  });
  musicExitBtn?.addEventListener("click", closeMusicPanel);
  musicBtn?.addEventListener("click", toggleMusicPanelVisibility);

  window.addEventListener("keydown", (e) => {
    if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA" || e.target?.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggleMusicPanelVisibility();
    }
  });

  window.bailongmaMedia = { handle: handleMediaCommand, showVideo, controlVideo, showImage, showCamera, showMusic, controlMusic, startMediaVoiceDuck, restoreMediaVoiceDuck, pauseForAssistantVoice };
  window.addEventListener("bailongma:media", (event) => handleMediaCommand(event.detail || {}));
  window.addEventListener("bailongma:voice-activity", (event) => startMediaVoiceDuck({ holdMs: getMediaDuckHoldMs(), pause: false, volume: event.detail?.volume }));
  window.addEventListener("bailongma:assistant-wake", () => pauseForAssistantVoice());

  // Push-to-talk：按住空格说话；Agent 正在说话时按下空格直接打断
  (() => {
    let pttHeld = false;
    const isSpace = (e) => e.code === "Space" || e.key === " " || e.key === "Spacebar";
    const isTypingTarget = (t) =>
      !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

    window.addEventListener("keydown", (e) => {
      if (!isSpace(e)) return;
      if (videoActive && localStorage.getItem(VOICE_VIDEO_PTT_KEY) === "false") return;
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      e.preventDefault();
      if (e.repeat) return;
      if (pttHeld) return;
      pttHeld = true;
      // 不论是否在播，stopTTS 内部已做 no-op 守卫；视频中 PTT 先暂停/压低视频，避免盖住人声。
      try { window.stopTTS?.(); } catch {}
      if (videoActive) startMediaVoiceDuck({ holdMs: 30000, pause: true });
      window.bailongmaVoice?.pttStart?.();
    }, { capture: true });

    window.addEventListener("keyup", (e) => {
      if (!isSpace(e)) return;
      if (!pttHeld) return;
      pttHeld = false;
      e.preventDefault();
      window.bailongmaVoice?.pttEnd?.();
      if (videoActive) setTimeout(() => restoreMediaVoiceDuck(), 500);
    }, { capture: true });

    // 切到后台时如果还按着，强制释放，避免 mic 永远不关
    window.addEventListener("blur", () => {
      if (!pttHeld) return;
      pttHeld = false;
      window.bailongmaVoice?.pttEnd?.();
      if (videoActive) restoreMediaVoiceDuck();
    });
  })();

  videoBtn?.addEventListener("click", toggleVideoPanelVisibility);
  videoExitBtn?.addEventListener("click", closeAndDestroyVideo);
  imageExitBtn?.addEventListener("click", () => setImageModeActive(false));
  videoOpenBtn?.addEventListener("click", () => {
    const url = videoUrlInput?.value?.trim();
    if (!url) return;
    showVideo({ url, title: "视频", autoplay: true });
  });
  videoUrlInput?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const url = videoUrlInput.value.trim();
    if (!url) return;
    showVideo({ url, title: "视频", autoplay: true });
  });

  window.addEventListener("keydown", (e) => {
    if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA" || e.target?.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "v" || e.key === "V") {
      e.preventDefault();
      toggleVideoPanelVisibility();
    }
    // H key: toggle hotspot mode
    if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      toggleHotspot();
    }
  });
})();
