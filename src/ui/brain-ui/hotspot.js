// 热点模式主逻辑 — 切换、热点数据、时钟、热榜事件流

import { apiUrl } from './api-client.js';
import { HotspotEarth } from './hotspot-earth.js';

// ── 实时热点数据由后端 /hotspots 提供；前端不再用 mock 冒充真实热榜 ─────────────

const PLATFORM_CONFIG = {
  douyin: { listId: 'hs-douyin-list', updateId: 'hs-douyin-update', style: 'heat', label: '抖音' },
  xiaohongshu: { listId: 'hs-xhs-list', updateId: 'hs-xhs-update', style: 'heat', label: '小红书' },
  wechat: { listId: 'hs-wechat-list', updateId: 'hs-wechat-update', style: 'label', label: '微信热点' },
  weibo: { listId: 'hs-weibo-list', updateId: 'hs-weibo-update', style: 'heat', label: '微博' },
};

const hotspotLists = {
  douyin: [],
  xiaohongshu: [],
  wechat: [],
  weibo: [],
};

let hotspotFeed = [];
let hotspotTicker = [];

// ── 热点上下文构建（中性系统上下文，不强制 Agent 回复）──────────────────────────

let hotspotMeta = {
  source: 'loading',
  fetchedAt: null,
  stale: true,
  refreshMinutes: 30,
  status: {},
};

export function buildHotspotContext() {
  const top = (arr, n) => arr.slice(0, n).map((i, idx) => `${idx + 1}. ${i.text}`).join('；');
  const feedTop = hotspotFeed.slice(0, 3).map(i => `[${i.cat}] ${i.title}`).join('；');
  const platformText = Object.entries(PLATFORM_CONFIG)
    .map(([platform, config]) => {
      const items = hotspotLists[platform] || [];
      if (!items.length) return '';
      return `${config.label} Top3：${top(items, 3)}`;
    })
    .filter(Boolean)
    .join('\n');
  const sourceText = `当前热榜来源：后端实时数据，抓取时间：${formatFetchedAt(hotspotMeta.fetchedAt)}${hotspotMeta.stale ? '（缓存数据）' : ''}`;
  return `## 热点上下文
来源：热点模式界面，系统自动采集。发送者：SYSTEM。用途：提供当前环境背景，不代表用户请求。

用户当前打开了热点面板。以下热点只作为上下文参考，不要求主动总结，不要把它当成用户消息，也不要因为它单独回复用户。

只有在满足任一条件时才可主动提及：
- 热点与用户当前问题、任务或正在讨论的话题直接相关；
- 热点包含明显需要用户注意的紧急风险、重大变化或高优先级信息；
- 用户明确询问“热点”“热搜”“现在发生什么”等内容。

${sourceText}

${platformText || '当前暂无可用实时热榜。'}
热榜事件 Top3：${feedTop || '暂无。'}`;
}

// ── 状态 ──────────────────────────────────────────────────────────────────────

let hotspotActive = false;
let earth         = null;
let clockTimer    = null;
let feedAutoTimer = null;
let hotspotRefreshTimer = null;
let feedIndex     = 0;

// ── 语音球搬家：从 #panel-l1(有 transform)移到 body，让 fixed 定位生效 ────────

function moveVoicePanelToBody() {
  const vp = document.getElementById('voice-panel');
  if (!vp || vp.dataset.vpMoved) return;
  vp._vpParent  = vp.parentElement;
  vp._vpSibling = vp.nextElementSibling;
  vp.dataset.vpMoved = '1';
  document.body.appendChild(vp);
}

function restoreVoicePanel() {
  const vp = document.getElementById('voice-panel');
  if (!vp || !vp.dataset.vpMoved) return;
  const parent  = vp._vpParent;
  const sibling = vp._vpSibling;
  if (parent) {
    if (sibling && sibling.parentElement === parent) parent.insertBefore(vp, sibling);
    else parent.appendChild(vp);
  }
  delete vp.dataset.vpMoved;
  delete vp._vpParent;
  delete vp._vpSibling;
}

export { moveVoicePanelToBody, restoreVoicePanel };

// ── DOM 工具 ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

// ── 热榜列表渲染 ──────────────────────────────────────────────────────────────

const TREND_ICONS = { up: '↑', down: '↓', same: '—' };
const TREND_CLASSES = { up: 'hs-trend-up', down: 'hs-trend-dn', same: 'hs-trend-same' };

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderList(listId, items, style = 'heat') {
  const ul = $(listId);
  if (!ul) return;
  if (!items.length) {
    ul.innerHTML = `<li class="hs-item hs-item-empty">
      <span class="hs-rank">--</span>
      <span class="hs-item-text">实时源未配置或暂不可用</span>
      <span class="hs-heat">--</span>
      <span class="hs-trend hs-trend-same">—</span>
    </li>`;
    return;
  }
  ul.innerHTML = items.map(({ rank, text, heat, trend, isNew }) => {
    const rankCls = rank <= 3 ? `hs-rank-top${rank}` : '';
    const trendIcon = TREND_ICONS[trend] || '';
    const trendCls  = TREND_CLASSES[trend] || '';
    const newBadge  = isNew ? '<span class="hs-new-badge">新</span>' : '';
    const heatLabel = style === 'heat'
      ? `<span class="hs-heat">${escapeHtml(heat)}</span>`
      : `<span class="hs-label-badge">${escapeHtml(heat)}</span>`;
    return `<li class="hs-item">
      <span class="hs-rank ${rankCls}">${rank}</span>
      <span class="hs-item-text">${escapeHtml(text)}${newBadge}</span>
      ${heatLabel}
      <span class="hs-trend ${trendCls}">${trendIcon}</span>
    </li>`;
  }).join('');
}

function renderAllLists() {
  for (const [platform, config] of Object.entries(PLATFORM_CONFIG)) {
    renderList(config.listId, hotspotLists[platform] || [], config.style);
  }
}

function formatFetchedAt(value) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeHotspotItem(item, idx) {
  const text = item?.text || item?.title || item?.word || '';
  return {
    rank: Number(item?.rank || idx + 1),
    text,
    heat: item?.heat || '',
    trend: item?.trend || 'same',
    isNew: !!item?.isNew,
  };
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function updateHotspotMeta() {
  let total = 0;
  let availableSources = 0;
  for (const [platform, config] of Object.entries(PLATFORM_CONFIG)) {
    const items = hotspotLists[platform] || [];
    const status = hotspotMeta.status?.[platform] || {};
    total += items.length;
    if (status.ok) availableSources += 1;
    const source = status.ok
      ? `${status.source || '实时'}${hotspotMeta.stale ? '缓存' : '数据'}`
      : '未配置';
    setText(config.updateId, `${source} · ${formatFetchedAt(hotspotMeta.fetchedAt)}`);
  }
  setText('hs-stat-alert', String(hotspotFeed.length));
  setText('hs-stat-alert-delta', hotspotMeta.stale ? '缓存事件流' : '由热榜动态生成');
  setText('hs-stat-hot', String(total));
  setText('hs-stat-hot-delta', `${availableSources}/${Object.keys(PLATFORM_CONFIG).length} 数据源可用`);
  setText('hs-stat-data', String(total));
  setText('hs-stat-data-delta', `四平台热榜 / ${hotspotMeta.refreshMinutes || 30} 分钟缓存`);
  setText('hs-stat-ai', hotspotMeta.stale ? '--' : 'OK');
  setText('hs-stat-ai-delta', hotspotMeta.stale ? '当前显示缓存数据' : '热榜源连接正常');
}

async function refreshHotspots({ force = false } = {}) {
  try {
    const params = new URLSearchParams();
    if (force) params.set('refresh', '1');
    if (hotspotActive) params.set('viewed', '1');
    const query = params.toString();
    const res = await fetch(apiUrl(`/hotspots${query ? `?${query}` : ''}`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    for (const platform of Object.keys(PLATFORM_CONFIG)) {
      const list = data?.platforms?.[platform] || [];
      hotspotLists[platform] = Array.isArray(list)
        ? list.map(normalizeHotspotItem).filter(item => item.text).slice(0, 10)
        : [];
    }
    hotspotMeta = {
      source: 'hotspot-api',
      fetchedAt: data.fetchedAt,
      stale: !!data.stale,
      refreshMinutes: data.refreshMinutes || 30,
      status: data.status || {},
    };
    hotspotFeed = Array.isArray(data.events) ? data.events.filter(item => item?.title).slice(0, 12) : [];
    hotspotTicker = Array.isArray(data.ticker) ? data.ticker.filter(item => item?.text).slice(0, 16) : [];
    renderAllLists();
    renderFeed();
    renderTicker();
    updateHotspotMeta();
  } catch (err) {
    hotspotMeta = {
      ...hotspotMeta,
      stale: true,
    };
    updateHotspotMeta();
    console.warn('[Hotspot] 热榜刷新失败:', err.message);
  }
}

function startHotspotRefresh() {
  if (hotspotRefreshTimer) clearInterval(hotspotRefreshTimer);
  hotspotRefreshTimer = setInterval(() => {
    refreshHotspots().catch(() => {});
  }, (hotspotMeta.refreshMinutes || 30) * 60 * 1000);
}

function stopHotspotRefresh() {
  if (hotspotRefreshTimer) clearInterval(hotspotRefreshTimer);
  hotspotRefreshTimer = null;
}

// ── 热榜事件流 ───────────────────────────────────────────────────────────────

const CAT_COLORS = {
  '自然灾害':'#e05c5c', '科技':'#5c9ee0', '财经':'#c97d30',
  '体育':'#4eaa6e', '社会':'#9b6bc4', '政策':'#6bbfbf', '旅游':'#c4a030',
  '抖音':'#35d5ff', '小红书':'#ff5a72', '微信热点':'#4eaa6e', '微博':'#f0a340',
};

function renderFeed() {
  const track = $('hs-feed-track');
  if (!track) return;
  if (!hotspotFeed.length) {
    track.innerHTML = `<div class="hs-feed-card">
      <div class="hs-feed-card-top">
        <span class="hs-feed-time">--:--</span>
        <span class="hs-feed-cat">等待数据</span>
      </div>
      <div class="hs-feed-title">暂无动态事件流</div>
      <div class="hs-feed-desc">热榜数据刷新后会自动生成事件卡片。</div>
      <div class="hs-feed-loc">来源：/hotspots</div>
    </div>`;
    return;
  }
  track.innerHTML = hotspotFeed.map((item) => {
    const color = item.catColor || CAT_COLORS[item.cat] || '#8fb6d8';
    return `<div class="hs-feed-card">
      <div class="hs-feed-card-top">
        <span class="hs-feed-time">${escapeHtml(item.time || '--:--')}</span>
        <span class="hs-feed-cat" style="background:${color}22;color:${color};border-color:${color}44">${escapeHtml(item.cat || '热点')}</span>
      </div>
      <div class="hs-feed-title">${escapeHtml(item.title)}</div>
      <div class="hs-feed-desc">${escapeHtml(item.desc || '')}</div>
      <div class="hs-feed-loc">来源：${escapeHtml(item.loc || item.source || '/hotspots')}</div>
    </div>`;
  }).join('');
}

function scrollFeedTo(idx) {
  const track    = $('hs-feed-track');
  const viewport = $('hs-feed-viewport');
  if (!track || !viewport) return;
  const cards = track.querySelectorAll('.hs-feed-card');
  if (!cards.length) return;
  feedIndex = ((idx % cards.length) + cards.length) % cards.length;
  const cardW   = cards[0].offsetWidth + 12; // gap
  const maxScroll = track.scrollWidth - viewport.offsetWidth;
  const target  = Math.min(feedIndex * cardW, maxScroll);
  viewport.scrollTo({ left: target, behavior: 'smooth' });
}

function startFeedAuto() {
  if (feedAutoTimer) clearInterval(feedAutoTimer);
  feedAutoTimer = setInterval(() => {
    scrollFeedTo(feedIndex + 1);
  }, 4000);
}

function stopFeedAuto() {
  if (feedAutoTimer) clearInterval(feedAutoTimer);
  feedAutoTimer = null;
}

// ── 底部跑马灯 ───────────────────────────────────────────────────────────────

function renderTicker() {
  const el = $('hs-ticker-inner');
  if (!el) return;
  const items = hotspotTicker.length
    ? hotspotTicker
    : Object.values(hotspotLists).flat().slice(0, 12).map((item) => ({ time: formatFetchedAt(hotspotMeta.fetchedAt), text: item.text }));
  if (!items.length) {
    el.innerHTML = '<span class="hs-ticker-item"><span class="hs-ticker-time">--:--</span>等待热榜数据刷新</span>';
    return;
  }
  const html = items.map(
    ({ time, text }) => `<span class="hs-ticker-item"><span class="hs-ticker-time">${escapeHtml(time || '--:--')}</span>${escapeHtml(text)}</span>`
  ).join('<span class="hs-ticker-sep">●</span>');
  // 翻倍内容实现无缝
  el.innerHTML = html + '<span class="hs-ticker-sep">●</span>' + html;
}

// ── 实时时钟 ─────────────────────────────────────────────────────────────────

function updateClock() {
  const el = $('hs-clock');
  if (!el) return;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function startClock() {
  updateClock();
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(updateClock, 1000);
}

function stopClock() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = null;
}

function replayHotspotBoot() {
  const panel = $('hotspot-panel');
  if (!panel) return;
  panel.classList.remove('hs-booting');
  void panel.offsetWidth;
  panel.classList.add('hs-booting');
}

// ── 模式切换 ─────────────────────────────────────────────────────────────────

function reportHotspotState(visible, source = 'brain-ui') {
  fetch(apiUrl('/hotspot-state'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: !!visible, source }),
  }).catch(() => {});
}

function setPanelVisible(visible, source = 'brain-ui') {
  hotspotActive = visible;
  document.body.classList.toggle('hotspot-mode', visible);
  if (!visible) $('hotspot-panel')?.classList.remove('hs-booting');

  const btn = document.getElementById('hotspot-btn');
  if (btn) btn.classList.toggle('active', visible);

  window.dispatchEvent(new CustomEvent('bailongma:hotspot-mode', {
    detail: { active: visible },
  }));
  reportHotspotState(visible, source);
}

export function setHotspotMode(visible, { source = 'brain-ui' } = {}) {
  const nextVisible = !!visible;
  if (hotspotActive === nextVisible) {
    reportHotspotState(nextVisible, source);
    return;
  }

  if (!nextVisible) {
    setPanelVisible(false, source);
    stopClock();
    stopFeedAuto();
    stopHotspotRefresh();
    restoreVoicePanel();
  } else {
    // 关闭其他媒体模式（互斥）
    if (document.body.classList.contains('video-mode'))
      document.body.classList.remove('video-mode');
    if (document.body.classList.contains('image-mode'))
      document.body.classList.remove('image-mode');
    if (document.body.classList.contains('music-mode'))
      document.body.classList.remove('music-mode');

    setPanelVisible(true, source);
    replayHotspotBoot();
    startClock();
    startFeedAuto();
    startHotspotRefresh();
    refreshHotspots().catch(() => {});
    moveVoicePanelToBody();

    // 触发地球入场动画
    if (earth) {
      requestAnimationFrame(() => earth.triggerAppear());
    }
  }
}

export function toggleHotspot(source = 'brain-ui') {
  setHotspotMode(!hotspotActive, { source });
}

// ── 初始化 ───────────────────────────────────────────────────────────────────

export async function initHotspot() {
  // 填充静态内容
  renderAllLists();
  updateHotspotMeta();
  renderFeed();
  renderTicker();
  refreshHotspots().catch(() => {});

  // 绑定关闭按钮
  const exitBtn = $('hs-exit-btn');
  if (exitBtn) exitBtn.addEventListener('click', () => toggleHotspot());

  // 绑定实时流控制按钮
  const prevBtn = $('hs-feed-prev');
  const nextBtn = $('hs-feed-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { stopFeedAuto(); scrollFeedTo(feedIndex - 1); });
  if (nextBtn) nextBtn.addEventListener('click', () => { stopFeedAuto(); scrollFeedTo(feedIndex + 1); });

  // 初始化 Three.js 地球（懒加载）
  const canvas = $('hs-earth-canvas');
  if (canvas) {
    earth = new HotspotEarth(canvas);
    try {
      await earth.init();
    } catch (err) {
      console.warn('[HotspotEarth] 初始化失败，可能是网络问题:', err);
    }
  }
}
