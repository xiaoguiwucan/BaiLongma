import { renderBrainUiApp } from "./app-shell.js";
import { API } from "./api-client.js";
import { bootstrapACUI } from "./acui/bootstrap.js";
import { initChat } from "./chat.js";
import { initPanelCollapse } from "./panel-collapse.js";
import { ThoughtStream } from "./thought-stream.js";
import { initVoicePanel } from "./voice-panel.js";
import { initHotspot, toggleHotspot, setHotspotMode, moveVoicePanelToBody, restoreVoicePanel } from "./hotspot.js";
import { initPersonCard, setPersonCardMode, showPersonCardByName } from "./person-card.js";
import { initDocPanel, setDocPanelMode } from "./doc.js";
import { initWechatPopup, showWechatPopup } from "./wechat-popup.js";
renderBrainUiApp(document.body);
const THEME_KEY = "jarvis-brain-ui-theme";
const PHYSICS_STORAGE_KEY = "jarvis-brain-ui-physics";
const ACTIVATION_WARMUP_KEY = "bailongma_activation_warmup_until";
const UI_ZOOM_STORAGE_KEY = "bailongma_ui_zoom_factor";
const MAX_CHAT_HISTORY = 60;
const DEFAULT_AGENT_NAME = "Longma";
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
const checkUpdateBtn = document.getElementById("check-update-btn");
const downloadUpdateBtn = document.getElementById("download-update-btn");
const installUpdateBtn = document.getElementById("install-update-btn");
const ignoreVersionBtn = document.getElementById("ignore-version-btn");
const updateStatusEl = document.getElementById("update-status");
const updateCardEl = document.getElementById("update-card");
const updateCloseBtn = document.getElementById("update-close-btn");

const IGNORED_VERSION_KEY = "bailongma_ignored_update_version";
const SUPPRESS_UPDATES_KEY = "bailongma_suppress_update_notifications";

let agentName = DEFAULT_AGENT_NAME;
let removeUpdaterStatusListener = null;
let currentUiZoom = DEFAULT_UI_ZOOM;
let chat = null;

function addMsg(...args) { return chat?.addMsg(...args); }
function openChat(...args) { return chat?.openChat(...args); }
function updateLastJarvisMsg(...args) { return chat?.updateLastJarvisMsg(...args); }
function isTyping() { return chat?.isTyping() || false; }

function defaultInputPlaceholder() {
  return `Message ${agentName}…`;
}

function setUpdateStatus(message, state = "idle") {
  if (!updateStatusEl) return;
  updateStatusEl.textContent = message;
  updateStatusEl.dataset.state = state;
}

function setUpdateCardHidden(hidden) {
  if (!updateCardEl) return;
  updateCardEl.classList.toggle("hidden", Boolean(hidden));
}

function setUpdateButtons({ check = false, checkDisabled = false, checkLabel = "Check for updates", download = false, install = false, ignore = false } = {}) {
  checkUpdateBtn?.classList.toggle("hidden", !check);
  if (checkUpdateBtn) { checkUpdateBtn.disabled = checkDisabled; checkUpdateBtn.textContent = checkLabel; }
  downloadUpdateBtn?.classList.toggle("hidden", !download);
  installUpdateBtn?.classList.toggle("hidden", !install);
  ignoreVersionBtn?.classList.toggle("hidden", !ignore);
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

async function initUpdaterUi() {
  if (!updateStatusEl) return;

  const bridge = window.bailongma;
  if (!bridge?.isElectron) return;

  let pendingVersion = null;

  function isSuppressed() {
    return localStorage.getItem(SUPPRESS_UPDATES_KEY) === "true";
  }

  function getIgnoredVersion() {
    return localStorage.getItem(IGNORED_VERSION_KEY) || null;
  }

  removeUpdaterStatusListener = bridge.onUpdaterStatus?.((payload = {}) => {
    const stage = payload.stage || "idle";
    const ver = payload.version || "";
    const percent = typeof payload.percent === "number" ? Math.round(payload.percent) : null;

    switch (stage) {
      case "checking":
        setUpdateStatus("Checking for updates…", "checking");
        setUpdateButtons({ check: true, checkDisabled: true, checkLabel: "Checking…" });
        break;

      case "available":
        pendingVersion = ver;
        if (isSuppressed() || (ver && getIgnoredVersion() === ver)) break;
        setUpdateCardHidden(false);
        setUpdateStatus(`New version available: ${ver}`, "available");
        setUpdateButtons({ download: true, ignore: true });
        break;

      case "downloading":
        setUpdateCardHidden(false);
        setUpdateStatus(`Downloading${percent !== null ? ` ${percent}%` : "…"}`, "downloading");
        setUpdateButtons({});
        break;

      case "downloaded":
        setUpdateCardHidden(false);
        setUpdateStatus(`Version ${ver} ready — will install on restart`, "ready");
        setUpdateButtons({ install: true });
        break;

      case "up-to-date":
        setUpdateStatus(`Already on latest version ${ver}`, "idle");
        setUpdateButtons({ check: true, checkLabel: "Check for updates" });
        setUpdateCardHidden(true);
        break;

      case "error":
        setUpdateCardHidden(false);
        setUpdateStatus(`Update error: ${payload.message || "Please try again later"}`, "error");
        setUpdateButtons({ check: true, checkLabel: "Retry" });
        break;

      case "dev":
        setUpdateButtons({ check: true, checkDisabled: true, checkLabel: "Dev mode" });
        break;

      default:
        setUpdateButtons({ check: true });
        break;
    }
  }) || null;

  checkUpdateBtn?.addEventListener("click", async () => {
    setUpdateStatus("Checking for updates…", "checking");
    setUpdateButtons({ check: true, checkDisabled: true, checkLabel: "Checking…" });
    try {
      const result = await bridge.checkForUpdates?.();
      if (!result?.ok && result?.message) {
        setUpdateCardHidden(false);
        setUpdateStatus(`Update error: ${result.message}`, "error");
        setUpdateButtons({ check: true, checkLabel: "Retry" });
      }
    } catch (err) {
      setUpdateCardHidden(false);
      setUpdateStatus(`Update error: ${err?.message || "Please try again later"}`, "error");
      setUpdateButtons({ check: true, checkLabel: "Retry" });
    }
  });

  downloadUpdateBtn?.addEventListener("click", async () => {
    setUpdateStatus("Downloading…", "downloading");
    setUpdateButtons({});
    try {
      await bridge.startDownload?.();
    } catch (err) {
      setUpdateCardHidden(false);
      setUpdateStatus(`Download failed: ${err?.message || "Please try again later"}`, "error");
      setUpdateButtons({ check: true, checkLabel: "Retry" });
    }
  });

  installUpdateBtn?.addEventListener("click", () => {
    bridge.quitAndInstall?.();
  });

  ignoreVersionBtn?.addEventListener("click", () => {
    if (pendingVersion) {
      localStorage.setItem(IGNORED_VERSION_KEY, pendingVersion);
      // Sync the settings panel if already mounted
      const ignoredSection = document.getElementById("settings-ignored-section");
      const ignoredVal = document.getElementById("settings-ignored-version-val");
      if (ignoredSection) ignoredSection.style.display = "";
      if (ignoredVal) ignoredVal.textContent = pendingVersion;
    }
    setUpdateCardHidden(true);
    setUpdateButtons({ check: true });
  });

  updateCloseBtn?.addEventListener("click", () => {
    setUpdateCardHidden(true);
  });
}

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
    setConnectionState("Offline", false);
  }
}

function addNewNodes(memories) {
  if (!MEMORY_GRAPH_ENABLED) return;
  const nodeMap = new Map(nodeData.map(n => [n._nid, n]));
  const newNids = [];
  memories.forEach(memory => {
    const nid = memory.id || memory.mem_id;
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
  thinkingLabel: "Thinking…",
  thinkingDoneLabel: "Done thinking",
  toolDetailLength: 140,
});
const L2 = new ThoughtStream("si-l2", "warm", {
  readCSSVar,
  thinkingLabel: "Thinking",
  thinkingDoneLabel: "Done thinking",
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

function connectSSE() {
  setConnectionState("connecting", true);
  const es = new EventSource(`${API}/events`);

  es.onopen = () => setConnectionState("connected", true);

  es.onmessage = event => {
    try { handle(JSON.parse(event.data)); } catch (_) {}
  };

  es.onerror = () => {
    setConnectionState("reconnect", false);
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
      const parsed = parseUserMessageInput(data.input);
      L1.newLine("user message received", {
        content: parsed.content,
        time: parsed.time || undefined,
      });
      break;
    }
    case "tick":
      currentPath = "l2";
      L2.newLine("heartbeat tick");
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
      currentStream().setStatus("LLM busy, retry " + nextAttempt + " in " + delayText, "busy");
      break;
    }
    case "message_requeued": {
      currentStream().startThinkingSession();
      const retryCount = Number(data.retryCount || 1);
      currentStream().setStatus("LLM busy, queued retry " + retryCount + "/3", "busy");
      break;
    }
    case "message_dropped":
      currentStream().startThinkingSession();
      currentStream().setStatus("LLM busy, retry limit reached", "failed");
      break;
    case "error":
      if (isBusyErrorMessage(data.error)) {
        currentStream().startThinkingSession();
        currentStream().setStatus("LLM busy, please retry shortly", "busy");
      }
      break;
    case "injector_result": {
      const nids = [...extractNids(data.matchedMemories), ...extractNids(data.recallMemories)];
      if (nids.length) highlightNodes(nids, 10000);
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
        addMsg("jarvis", data.content);
        openChat(true);
      }
      break;
    case "message_in":
      if (data.from_id && data.from_id !== "ID:000001") {
        addMsg("external", data.content, { label: data.from_id, alert: false });
        openChat(true);
      }
      break;
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
  if (!ttsAudioEl) return;
  const { remaining, spokenUpTo } = calcRemainingText(
    ttsCurrentText,
    ttsAudioEl.currentTime,
    ttsAudioEl.duration,
  );
  // When duration is not yet loaded (NaN): spokenUpTo=0, remaining='', falls back to full text
  ttsInterruptedRemaining = remaining || ttsCurrentText;
  applyTTSInterruption(spokenUpTo);
  ttsAudioEl.pause();
  try { URL.revokeObjectURL(ttsAudioEl.src); } catch {}
  ttsAudioEl = null;
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
  ttsCurrentText = text;
  ttsInterruptedRemaining = '';
  ttsInterruptionApplied = false;
  ttsInterruptedOriginalContent = '';
  try {
    const resp = await fetch(`${API}/tts/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      let errMsg = `HTTP ${resp.status}`;
      try { const j = await resp.json(); errMsg = j.error || errMsg; } catch {}
      throw new Error(errMsg);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    if (ttsAudioEl) { ttsAudioEl.pause(); URL.revokeObjectURL(ttsAudioEl.src); }
    ttsAudioEl = new Audio(url);
    ttsAudioEl.volume = 1.0; // ensure full volume (avoid residual duck state from previous play)
    // Suspend cloud ASR but keep the mic hardware open for interruption detection
    window.bailongmaVoice?.suspendForTTS?.();
    ttsAudioEl.onended = () => {
      URL.revokeObjectURL(url);
      ttsAudioEl = null;
      ttsCurrentText = '';
      window.bailongmaVoice?.resumeAfterMedia();
    };
    ttsAudioEl.onerror = () => {
      ttsAudioEl = null;
      ttsCurrentText = '';
      window.bailongmaVoice?.resumeAfterMedia();
    };
    ttsAudioEl.play().catch(() => {
      window.bailongmaVoice?.resumeAfterMedia();
    });
  } catch {
    ttsCurrentText = '';
    window.bailongmaVoice?.resumeAfterMedia();
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
initUpdaterUi();
chat.unlockAudioOnFirstGesture();

bootstrapACUI();
initPanelCollapse();
initWechatPopup();

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
      if (testStatus) testStatus.textContent = "Saving config…";
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
        await fetch(`${API}/settings/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preBody),
        });
        if (testStatus) testStatus.textContent = "Synthesizing…";
        const ttsResp = await fetch(`${API}/tts/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Hello, this is a voice synthesis test. Is the audio clear and natural?" }),
        });
        if (!ttsResp.ok) {
          let errMsg = `Synthesis failed (HTTP ${ttsResp.status})`;
          try { const j = await ttsResp.json(); errMsg = j.error || errMsg; } catch {}
          if (testStatus) testStatus.textContent = errMsg;
          return;
        }
        const ttsBlob = await ttsResp.blob();
        if (ttsBlob.size === 0) {
          if (testStatus) testStatus.textContent = "Synthesis failed: API returned empty data. Check your key and account settings.";
          return;
        }
        const ttsUrl = URL.createObjectURL(ttsBlob);
        const ttsAudio = new Audio(ttsUrl);
        ttsAudio.onended = () => { URL.revokeObjectURL(ttsUrl); if (testStatus) testStatus.textContent = ""; };
        ttsAudio.onerror = () => { URL.revokeObjectURL(ttsUrl); if (testStatus) testStatus.textContent = "Playback failed"; };
        await ttsAudio.play();
        if (testStatus) testStatus.textContent = "Playing";
        setTimeout(() => { if (testStatus && testStatus.textContent === "Playing") testStatus.textContent = ""; }, 8000);
      } catch {
        if (testStatus) testStatus.textContent = "Failed — check config and API key";
      } finally {
        testBtn.disabled = false;
      }
    });
  }
}

window.addEventListener("beforeunload", () => {
  if (typeof removeUpdaterStatusListener === "function") {
    removeUpdaterStatusListener();
    removeUpdaterStatusListener = null;
  }
});

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
          el.textContent = "● Configured";
          el.className = "settings-platform-status ok";
        } else if (configuredCount > 0) {
          el.textContent = `● Partial (${configuredCount}/${keys.length})`;
          el.className = "settings-platform-status miss";
        } else {
          el.textContent = "○ Not configured";
          el.className = "settings-platform-status miss";
        }
      }
    } catch {}
  }

  const fileSandboxToggle = document.getElementById("security-file-sandbox");
  const execSandboxToggle = document.getElementById("security-exec-sandbox");
  const saveSecurityBtn   = document.getElementById("settings-save-security");
  const securityFeedback  = document.getElementById("settings-security-feedback");

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
          showFeedback(securityFeedback, "Saved — effective immediately");
        } else {
          showFeedback(securityFeedback, data.error || "Save failed", true);
        }
      } catch {
        showFeedback(securityFeedback, "Request failed", true);
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
          showFeedback(socialFeedback, "Saved");
          Object.keys(SOCIAL_FIELD_MAP).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
          });
          loadSocialSettings();
        } else {
          showFeedback(socialFeedback, data.error || "Save failed", true);
        }
      } catch {
        showFeedback(socialFeedback, "Request failed", true);
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
          showFeedback(tempFeedback, `Set to ${data.temperature.toFixed(2)}`);
        } else {
          showFeedback(tempFeedback, data.error || "Save failed", true);
        }
      } catch { showFeedback(tempFeedback, "Request failed", true); }
      finally { saveTempBtn.disabled = false; }
    });
  }

  const VOICE_LANG_KEY       = "bailongma-voice-lang";
  const VOICE_AUTO_SEND_KEY  = "bailongma-voice-auto-send";
  const VOICE_AUTO_MIC_KEY   = "bailongma-voice-auto-mic";
  const VOICE_THRESHOLD_KEY  = "bailongma-voice-threshold";
  const VOICE_PROVIDER_KEY   = "bailongma-voice-provider";

  function applyVoiceProviderUI(provider) {
    const panels = { aliyun: "voice-cred-aliyun", tencent: "voice-cred-tencent", xunfei: "voice-cred-xunfei" };
    for (const [key, id] of Object.entries(panels)) {
      const el = document.getElementById(id);
      if (el) el.style.display = key === provider ? "" : "none";
    }
  }

  const voiceProviderSelect = document.getElementById("voice-provider-select");
  if (voiceProviderSelect) {
    voiceProviderSelect.addEventListener("change", () => applyVoiceProviderUI(voiceProviderSelect.value));
  }

  async function loadVoiceSettings() {
    const langSelect = document.getElementById("voice-lang-select");
    const autoSend   = document.getElementById("voice-auto-send");
    if (langSelect) langSelect.value = localStorage.getItem(VOICE_LANG_KEY) || "zh-CN";
    if (autoSend) autoSend.checked = localStorage.getItem(VOICE_AUTO_SEND_KEY) !== "false";
    const autoMic = document.getElementById("voice-auto-mic");
    if (autoMic) autoMic.checked = localStorage.getItem(VOICE_AUTO_MIC_KEY) === "true";
    const savedThresh = parseFloat(localStorage.getItem(VOICE_THRESHOLD_KEY) || "0.008");
    if (voiceThreshSlider) voiceThreshSlider.value = String(savedThresh);
    if (voiceThreshVal)    voiceThreshVal.textContent = savedThresh.toFixed(3);

    const savedProvider = localStorage.getItem(VOICE_PROVIDER_KEY) || "aliyun";
    if (voiceProviderSelect) voiceProviderSelect.value = savedProvider;
    applyVoiceProviderUI(savedProvider);
  }

  if (voiceThreshSlider && voiceThreshVal) {
    voiceThreshSlider.addEventListener("input", () => {
      voiceThreshVal.textContent = parseFloat(voiceThreshSlider.value).toFixed(3);
    });
  }


  if (saveVoiceBtn) {
    saveVoiceBtn.addEventListener("click", async () => {
      const lang      = document.getElementById("voice-lang-select")?.value || "zh-CN";
      const autoSend  = document.getElementById("voice-auto-send")?.checked ?? true;
      const autoMic   = document.getElementById("voice-auto-mic")?.checked ?? false;
      const threshold = parseFloat(voiceThreshSlider?.value ?? "0.008");
      const provider  = voiceProviderSelect?.value || "aliyun";

      localStorage.setItem(VOICE_LANG_KEY,      lang);
      localStorage.setItem(VOICE_AUTO_SEND_KEY,  String(autoSend));
      localStorage.setItem(VOICE_AUTO_MIC_KEY,   String(autoMic));
      localStorage.setItem(VOICE_THRESHOLD_KEY,  String(threshold));
      localStorage.setItem(VOICE_PROVIDER_KEY,   provider);

      window.dispatchEvent(new CustomEvent("bailongma:voice-threshold", { detail: { threshold } }));

      const body = {};
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
          if (!resp.ok) throw new Error("Save failed");
          ["voice-aliyun-key","voice-tencent-sid","voice-tencent-skey","voice-xunfei-apikey"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
          });
          showFeedback(voiceFeedback, "Saved");
        } catch { showFeedback(voiceFeedback, "Save failed", true); }
        finally { saveVoiceBtn.disabled = false; }
      } else {
        showFeedback(voiceFeedback, "Saved");
      }
    });
  }

  initTTSSettings();

  const memoryGraphToggle = document.getElementById("settings-memory-graph-toggle");
  const memoryGraphFeedback = document.getElementById("settings-memory-graph-feedback");
  if (memoryGraphToggle) {
    memoryGraphToggle.checked = localStorage.getItem(MEMORY_GRAPH_STORAGE_KEY) !== "false";
    memoryGraphToggle.addEventListener("change", () => {
      localStorage.setItem(MEMORY_GRAPH_STORAGE_KEY, String(memoryGraphToggle.checked));
      if (memoryGraphFeedback) {
        memoryGraphFeedback.textContent = "Takes effect on next page reload";
        memoryGraphFeedback.className = "settings-feedback";
        setTimeout(() => { memoryGraphFeedback.textContent = ""; }, 3000);
      }
    });
  }

  function openSettings(tab = null) {
    overlay.hidden = false;
    loadSettings();
    loadVoiceSettings();
    if (tab) {
      overlay.querySelectorAll(".settings-nav-item").forEach(b => {
        b.classList.toggle("active", b.dataset.tab === tab);
      });
      overlay.querySelectorAll(".settings-tab").forEach(t => {
        t.classList.toggle("active", t.dataset.tab === tab);
      });
      if (tab === "social") loadSocialSettings();
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
        showFeedback(llmFeedback, "Please fill in Base URL and model name", true);
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
          showFeedback(llmFeedback, `Connected: ${data.model}`);
          llmKeyInput.value = "";
          loadSettings();
        } else {
          showFeedback(llmFeedback, data.error || "Connection failed", true);
        }
      } catch { showFeedback(llmFeedback, "Request failed", true); }
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
        showFeedback(llmFeedback, "Saved");
        llmKeyInput.value = "";
        loadSettings();
      } else {
        showFeedback(llmFeedback, data.error || "Save failed", true);
      }
    } catch { showFeedback(llmFeedback, "Request failed", true); }
    finally { saveLlmBtn.disabled = false; }
  });

  saveMinimaxBtn?.addEventListener("click", async () => {
    const apiKey = minimaxKeyInput.value.trim();
    if (!apiKey) { showFeedback(minimaxFeedback, "Key cannot be empty", true); return; }
    saveMinimaxBtn.disabled = true;
    try {
      const res = await fetch(`${API}/settings/minimax`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (data.ok) {
        showFeedback(minimaxFeedback, "Saved");
        minimaxKeyInput.value = "";
        loadSettings();
      } else {
        showFeedback(minimaxFeedback, data.error || "Save failed", true);
      }
    } catch { showFeedback(minimaxFeedback, "Request failed", true); }
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
        setClawbotStatus("Connected", true);
        if (clawbotFeedback) showFeedback(clawbotFeedback, "WeChat linked successfully!");
        loadSocialSettings();
      } else if (data.status === "qr_ready" && data.qr_url) {
        if (clawbotQrImg) clawbotQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qr_url)}`;
        if (clawbotQrArea) clawbotQrArea.style.display = "block";
        if (clawbotQrHint) clawbotQrHint.textContent = "Waiting for scan…";
        setClawbotStatus("Waiting for scan", false);
      } else if (data.status === "qr_pending") {
        if (clawbotQrHint) clawbotQrHint.textContent = "Generating QR code…";
      } else if (data.status === "error") {
        stopClawbotPoll();
        if (clawbotQrArea) clawbotQrArea.style.display = "none";
        setClawbotStatus("Connection failed", false);
        if (clawbotFeedback) showFeedback(clawbotFeedback, data.error || "Connection failed", true);
      }
    } catch {}
  }

  if (clawbotConnectBtn) {
    pollClawbotQR();
  }

  clawbotConnectBtn?.addEventListener("click", async () => {
    if (clawbotQrArea) clawbotQrArea.style.display = "none";
    setClawbotStatus("Starting…", false);
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
      setClawbotStatus("Disconnected", false);
      showFeedback(clawbotFeedback, "WeChat disconnected");
    } catch {
      showFeedback(clawbotFeedback, "Request failed", true);
    }
  });

  window.addEventListener("bailongma:social_status", (e) => {
    const d = e.detail;
    if (d?.platform !== "wechat-clawbot") return;
    if (d.status === "connected") {
      stopClawbotPoll();
      if (clawbotQrArea) clawbotQrArea.style.display = "none";
      setClawbotStatus("Connected", true);
    } else if (d.status === "qr_ready") {
      if (!clawbotPollTimer) clawbotPollTimer = setInterval(pollClawbotQR, 2000);
      pollClawbotQR();
    } else if (d.status === "session_expired") {
      stopClawbotPoll();
      setClawbotStatus("Session expired — please scan again", false);
    } else if (d.status === "idle") {
      setClawbotStatus("Not connected", false);
    }
  });

  const settingsCheckUpdateBtn   = document.getElementById("settings-check-update-btn");
  const settingsUpdateFeedback   = document.getElementById("settings-update-feedback");
  const settingsCurrentVersion   = document.getElementById("settings-current-version");
  const settingsSuppressToggle   = document.getElementById("settings-suppress-updates");
  const settingsIgnoredSection   = document.getElementById("settings-ignored-section");
  const settingsIgnoredVersionEl = document.getElementById("settings-ignored-version-val");
  const settingsClearIgnoredBtn  = document.getElementById("settings-clear-ignored-btn");

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
      if (settingsCurrentVersion) settingsCurrentVersion.textContent = "Desktop app only";
      if (settingsCheckUpdateBtn) settingsCheckUpdateBtn.disabled = true;
      return;
    }
    try {
      const ver = await bridge.getVersion?.();
      if (settingsCurrentVersion && ver) settingsCurrentVersion.textContent = ver;
    } catch {}
  }

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
    if (settingsCheckUpdateBtn) { settingsCheckUpdateBtn.disabled = true; settingsCheckUpdateBtn.textContent = "Checking…"; }
    if (settingsUpdateFeedback) settingsUpdateFeedback.textContent = "";
    try {
      const result = await bridge.checkForUpdates?.();
      if (result?.ok === false && result?.message) {
        if (settingsUpdateFeedback) { settingsUpdateFeedback.textContent = `Failed: ${result.message}`; settingsUpdateFeedback.className = "settings-feedback error"; }
      } else {
        if (settingsUpdateFeedback) { settingsUpdateFeedback.textContent = "Check complete"; settingsUpdateFeedback.className = "settings-feedback"; }
        setTimeout(() => { if (settingsUpdateFeedback) settingsUpdateFeedback.textContent = ""; }, 3000);
      }
    } catch (err) {
      if (settingsUpdateFeedback) { settingsUpdateFeedback.textContent = `Failed: ${err?.message || "Please try again later"}`; settingsUpdateFeedback.className = "settings-feedback error"; }
    } finally {
      if (settingsCheckUpdateBtn) { settingsCheckUpdateBtn.disabled = false; settingsCheckUpdateBtn.textContent = "Check for updates"; }
    }
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
  const imageExitBtn  = document.getElementById("image-exit-btn");
  const imageDisplay  = document.getElementById("image-display");
  const imageSurface  = document.getElementById("image-surface");
  const imageTitle    = document.getElementById("image-title");

  let videoStream = null;
  let videoActive = false;
  let imageActive = false;
  let videoKind   = "empty";
  let currentVideoSource = "";
  let currentVideoStart = null;

  function normalizeUrl(url = "") {
    return String(url || "").trim();
  }

  function localPathToUrl(src) {
    const s = String(src || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    // Local path (file:// or absolute) → backend HTTP media endpoint to avoid file:// CORS restriction
    let resolved = s;
    if (/^file:\/\//i.test(s)) {
      resolved = decodeURIComponent(s.replace(/^file:\/\/\//i, "").replace(/^file:\/\//i, ""));
    }
    const filename = resolved.split(/[\\/]/).filter(Boolean).pop() || "";
    if (!filename) return s;
    return "/media/music/" + encodeURIComponent(filename);
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
    } else if (videoKind === "bilibili") {
      reloadFrameAutoplay(false);
    } else if (videoKind === "file") {
      try { videoFeed?.pause?.(); } catch {}
    }
  }

  function resumeCurrentVideo() {
    if (videoKind === "youtube") {
      postFrameCommand("playVideo");
    } else if (videoKind === "bilibili") {
      reloadFrameAutoplay(true);
    } else if (videoKind === "file") {
      videoFeed?.play?.().catch(() => {});
    }
  }

  function resetVideoSurface() {
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
    url = "", title = "Video", autoplay = false,
    muted = false, volume = null, currentTime = null, camera = false,
  } = {}) {
    if (camera) { showCamera({ title, autoplay }); return; }

    const source = normalizeUrl(url);
    if (musicActive) closeMusicPanel();
    setPanelVisible(true);
    resetVideoSurface();
    currentVideoSource = source;
    currentVideoStart = Number.isFinite(Number(currentTime)) ? Math.max(0, Number(currentTime)) : null;
    if (videoTitle) videoTitle.textContent = title || "Video";

    const embedUrl = iframeUrlFor(source, { autoplay, start: currentTime });
    if (embedUrl && videoFrame) {
      videoFrame.hidden = false;
      videoFrame.src = embedUrl;
      videoSurface?.classList.add("has-media");
      videoKind = embedUrl.includes("youtube.com") ? "youtube" : "bilibili";

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
      saveMediaHistory({ url: source, title, kind: "file" });
      if (autoplay) videoFeed.play?.().catch(() => {});
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

    const title  = track.title  || "Unknown track";
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

  window.bailongmaMedia = { handle: handleMediaCommand, showVideo, controlVideo, showImage, showCamera, showMusic, controlMusic };
  window.addEventListener("bailongma:media", (event) => handleMediaCommand(event.detail || {}));

  videoBtn?.addEventListener("click", toggleVideoPanelVisibility);
  videoExitBtn?.addEventListener("click", closeAndDestroyVideo);
  imageExitBtn?.addEventListener("click", () => setImageModeActive(false));

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
