import { createVoiceStateMachine, VOICE_STATES } from '../../voice/voice-state-machine.js';

// 声波点云球 + ASR 语音输入面板
// 默认本地 Whisper；也可切换云端 ASR（阿里云/腾讯云/讯飞），通过后端 WebSocket 代理
//
// 点云算法移植自 ACUI (Remix)/Voice Component.html

// ─── 球面采样（Fibonacci） ───
function fibSphere(n, radius) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push({ x: Math.cos(theta) * r * radius, y: y * radius, z: Math.sin(theta) * r * radius });
  }
  return pts;
}

const BASE_PTS  = fibSphere(3200, 1.0);
const BASE_PTS2 = fibSphere(1200, 0.88);

// ─── 正弦噪声 ───
function sn(x, y, z, t) {
  return (
    Math.sin(x * 2.3 + t * 1.1) * Math.cos(y * 1.9 + t * 0.8) * 0.38 +
    Math.sin(y * 3.1 + t * 1.4) * Math.cos(z * 2.7 + t * 0.6) * 0.30 +
    Math.sin(z * 1.7 + t * 0.9) * Math.cos(x * 3.3 + t * 1.2) * 0.30 +
    Math.sin(x * 5.1 + y * 4.3 + t * 2.1) * 0.14
  );
}

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpArr(a, b, t) { return a.map((v, i) => lerp(v, b[i], t)); }

// ─── 状态配置 ───
// idle = 麦克风关闭（灰色）  listening = 麦克风开启待命（白色）
// recognizing = 正在识别（蓝色）  done = 识别完成（绿色，2s 后回 listening）
// speaking = AI 正在说话（紫色，可打断）
const STATE_CFG = {
  idle:        { amp: 0.003, spd: 0.10, r: [50,68,80],    g: [50,68,80],    b: [55,73,85]   },
  listening:   { amp: 0.055, spd: 0.75, r: [185,215,245], g: [185,215,245], b: [195,225,255] },
  recognizing: { amp: 0.55,  spd: 4.50, r: [25,75,165],   g: [95,155,230],  b: [195,230,255] },
  done:        { amp: 0.10,  spd: 1.20, r: [30,105,65],   g: [145,200,135], b: [45,90,60]   },
  processing:  { amp: 0.15,  spd: 1.10, r: [100,60,200],  g: [80,60,180],   b: [220,190,255] },
  error:       { amp: 0.10,  spd: 0.70, r: [200,240,255], g: [20,30,40],    b: [20,30,40]   },
  event:       { amp: 0.60,  spd: 4.00, r: [255,200,50],  g: [200,160,30],  b: [50,80,150]   },
  speaking:    { amp: 0.09,  spd: 1.00, r: [130,95,185],  g: [105,80,170],  b: [225,200,255] },
};

// ─── 打断检测参数 ───
const BARGEIN_WARMUP_MS  = 600  // TTS 开始后前 600ms 不检测（等 AEC 适应）
const BARGEIN_FRAMES     = 8    // 需要连续 8 帧高振幅（约 130ms）才触发
const BARGEIN_THRESHOLD  = 0.09 // 振幅阈值（高于环境噪声和 AEC 残留）
// 4096 samples @ 16kHz = 256ms/块；保留 1500ms ≈ 6 块
const BARGEIN_PRE_BUFFER_MS   = 1500
const BARGEIN_MAX_CHUNKS      = Math.ceil(BARGEIN_PRE_BUFFER_MS * 16000 / 1000 / 4096)

// ─── Duck 模式参数（两阶段检测：先压制音量再判断是否打断） ───
// 检测到高振幅先 duck（降音量），持续高振幅才真正打断；冲击噪音消退后直接恢复音量
const DUCK_TRIGGER_FRAMES  = 3    // 连续 3 帧高振幅 → 进入 duck 模式（≈50ms）
const DUCK_SUSTAIN_FRAMES  = 10   // duck 中再持续 10 帧高振幅 → 判定为语音，触发真正打断
const DUCK_DECAY_FRAMES    = 6    // duck 中连续 6 帧低振幅（≈100ms）→ 判定为噪音，恢复音量
const DUCK_MAX_MS          = 1500 // duck 最长持续时间，超时自动恢复

// ─── 快速非语音检测参数（真正打断后仍保留，用于误打断的快速恢复） ───
const BARGEIN_FAST_WINDOW_MS    = 500
const BARGEIN_FAST_SILENT_THR   = BARGEIN_THRESHOLD * 0.65
const BARGEIN_FAST_SILENT_NEED  = 7

// ─── 声音事件图标映射 ───
const SOUND_EVENT_ICONS = {
  clapping:        '👏',
  finger_snapping: '🤌',
  keyboard_typing: '⌨️',
  typing:          '⌨️',
  writing:         '✍️',
  footsteps:       '👟',
  walking:         '🚶',
  running:         '🏃',
  knock:           '🚪',
  knock_door:      '🚪',
};

const CLOUD_WS_URL  = 'ws://127.0.0.1:3721/voice/cloud';
const LOCAL_WS_URL  = 'ws://127.0.0.1:3723';
const LOCAL_START_URL = 'http://127.0.0.1:3721/voice/local/start';
const VOICE_THRESHOLD_KEY = 'bailongma-voice-threshold';
const VOICE_PROVIDER_KEY = 'bailongma-voice-provider';
const VOICE_WHISPER_MODEL_KEY = 'bailongma-voice-whisper-model'; // 兼容旧版本
const VOICE_LOCAL_ASR_MODEL_KEY = 'bailongma-voice-local-asr-model';
const VOICE_ASR_PROFILE_KEY = 'bailongma-voice-asr-profile';
const VOICE_WAKE_ENABLED_KEY = 'bailongma-voice-wake-enabled';
const VOICE_WAKE_WORDS_KEY = 'bailongma-voice-wake-words';
const VOICE_WAKE_MODE_KEY = 'bailongma-voice-wake-mode';
const VOICE_WAKE_WINDOW_KEY = 'bailongma-voice-wake-window-seconds';
const VOICE_WAKE_REPEAT_SUPPRESS_KEY = 'bailongma-voice-wake-repeat-suppression';
const VOICE_SPEAKER_VERIFY_KEY = 'bailongma-voice-speaker-verify';
const VOICE_SPEAKER_THRESHOLD_KEY = 'bailongma-voice-speaker-threshold';
const VOICE_VIDEO_DUCK_KEY = 'bailongma-voice-video-duck';
const VOICE_VIDEO_AEC_KEY = 'bailongma-voice-video-aec';
const VOICE_VIDEO_DUCK_SENSITIVITY_KEY = 'bailongma-voice-video-duck-sensitivity';

// 从 localStorage 读取灵敏度阈值，支持运行时动态修改
function getVoiceThreshold() {
  return parseFloat(localStorage.getItem(VOICE_THRESHOLD_KEY) || '0.008');
}

// 派生阈值（ambient = near/2.67，和原始比例保持一致）
function getAmbientThreshold() { return getVoiceThreshold() * 0.375; }

export function initVoicePanel({
  btnId, panelId, canvasId, statusId, transcriptId,
  getChatInput, getSendBtn, getSendMessage, getLang, getAutoSend, getAutoMic,
}) {
  const btn        = document.getElementById(btnId);
  const panel      = document.getElementById(panelId);
  const canvas     = document.getElementById(canvasId);
  const transcript = document.getElementById(transcriptId);

  if (!panel || !canvas) return;

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, cx = 0, cy = 0, scale = 0;

  function resizeCanvasToDisplay() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    const nextW = Math.max(1, Math.round(rect.width * dpr));
    const nextH = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    W = nextW; H = nextH; cx = W / 2; cy = H / 2;
    scale = Math.min(W, H) * 0.34;
  }

  const voiceMachine = createVoiceStateMachine();
  window.bailongmaVoiceState = voiceMachine;

  // ─── 渲染状态 ───
  let sk = 'idle';
  let animState = {
    amp: STATE_CFG.idle.amp, spd: STATE_CFG.idle.spd,
    col: [STATE_CFG.idle.r, STATE_CFG.idle.g, STATE_CFG.idle.b],
    t: 0, rotY: 0, rotX: 0.25,
  };
  let rafId = null;
  let eventFlashCount = 0;
  let doneTimer = null;

  function setStatus(newSk, meta = {}) {
    const snap = voiceMachine.transition(newSk, meta);
    sk = snap.state;
  }


  function triggerDone() {
    setStatus(VOICE_STATES.DONE, { reason: 'final transcript accepted' });
    if (doneTimer) clearTimeout(doneTimer);
    doneTimer = setTimeout(() => {
      doneTimer = null;
      if (sk === VOICE_STATES.DONE) setStatus(micActive ? VOICE_STATES.LISTENING : VOICE_STATES.IDLE, { reason: 'done timeout' });
    }, 2000);
  }

  function drawFrame() {
    resizeCanvasToDisplay();
    const cfg = STATE_CFG[sk];
    const s = animState;
    const ls = 0.025;

    s.amp = lerp(s.amp, cfg.amp, ls * 8);
    s.spd = lerp(s.spd, cfg.spd, ls * 6);
    s.col = [
      lerpArr(s.col[0], cfg.r, ls * 1.5),
      lerpArr(s.col[1], cfg.g, ls * 1.5),
      lerpArr(s.col[2], cfg.b, ls * 1.5),
    ];

    if (micData) {
      micData.analyser.getByteFrequencyData(micData.dataArray);
      const sum = micData.dataArray.reduce((a, b) => a + b, 0);
      const vol = (sum / micData.dataArray.length) / 255;

      // 视频播放中：连续检测到近场人声才通知媒体层降音量/暂停，让唤醒词和声纹有机会听清。
      if (mediaModeActive && localStorage.getItem(VOICE_VIDEO_DUCK_KEY) !== 'false') {
        const sensitivity = Math.max(0.55, Math.min(1.6, Number(localStorage.getItem(VOICE_VIDEO_DUCK_SENSITIVITY_KEY) || 1) || 1));
        const mediaDuckThreshold = BARGEIN_THRESHOLD * sensitivity;
        if (vol > mediaDuckThreshold) {
          mediaVoiceFrames += 1;
          mediaVoiceLastVol = vol;
        } else {
          mediaVoiceFrames = Math.max(0, mediaVoiceFrames - 1);
        }
        const now = Date.now();
        if (mediaVoiceFrames >= 3 && now - lastMediaVoiceActivityAt > 900) {
          lastMediaVoiceActivityAt = now;
          mediaVoiceFrames = 0;
          window.dispatchEvent(new CustomEvent('bailongma:voice-activity', { detail: { volume: mediaVoiceLastVol, threshold: mediaDuckThreshold, confirmedFrames: 3 } }));
        }
      }

      // 打断检测：TTS 播放中持续检测用户声音（两阶段：duck → 判断语音/噪音）
      if (suspendedByMedia) {
        const aecReady = Date.now() - ttsStartTime > BARGEIN_WARMUP_MS;
        if (aecReady) {
          if (!duckActive) {
            // 阶段一：等待触发 duck
            if (vol > BARGEIN_THRESHOLD) {
              if (++bargeinFrames >= DUCK_TRIGGER_FRAMES) {
                bargeinFrames = 0;
                duckActive = true;
                duckStartTime = Date.now();
                duckHighFrames = 0;
                duckLowFrames = 0;
                window.duckTTS?.();
              }
            } else {
              bargeinFrames = 0;
            }
          } else {
            // 阶段二：duck 中判断是语音还是冲击噪音
            const duckElapsed = Date.now() - duckStartTime;
            if (vol > BARGEIN_THRESHOLD) {
              duckHighFrames++;
              duckLowFrames = 0;
              if (duckHighFrames >= DUCK_SUSTAIN_FRAMES) {
                // 声音持续高振幅 → 语音 → 真正打断
                duckActive = false;
                duckHighFrames = 0;
                window.stopTTS?.();
                resumeVoiceInputFromMedia(true);
                bargeinFastCheckActive = true;
                bargeinFastCheckStart = Date.now();
                bargeinFastSilentFrames = 0;
              }
            } else {
              duckLowFrames++;
              duckHighFrames = 0;
              if (duckLowFrames >= DUCK_DECAY_FRAMES || duckElapsed >= DUCK_MAX_MS) {
                // 声音迅速消退 → 冲击噪音 → 恢复原音量，TTS 不中断
                duckActive = false;
                duckLowFrames = 0;
                window.unduckTTS?.();
              }
            }
          }
        }
      }

      // 快速非语音检测（仅在真正打断后作为兜底：防止极短语音触发打断后继续重播）
      if (bargeinFastCheckActive) {
        const elapsed = Date.now() - bargeinFastCheckStart;
        if (vol < BARGEIN_FAST_SILENT_THR) {
          if (++bargeinFastSilentFrames >= BARGEIN_FAST_SILENT_NEED) {
            bargeinFastCheckActive = false;
            bargeinFastSilentFrames = 0;
            clearBargeinNoSpeechTimer();
            window.resumeTTSIfNoSpeech?.();
          }
        } else {
          bargeinFastSilentFrames = 0;
        }
        if (elapsed >= BARGEIN_FAST_WINDOW_MS) {
          bargeinFastCheckActive = false;
          bargeinFastSilentFrames = 0;
        }
      }

      if (vol > 0.02) {
        s.amp = lerp(s.amp, 0.08 + vol * 1.2, 0.4);
        s.spd = lerp(s.spd, 1.0 + vol * 5.0, 0.2);
        // speaking 状态下用户开口 → 视觉反馈但不覆盖状态（等 barge-in 触发后自然切换）
        if (sk !== VOICE_STATES.RECOGNIZING && sk !== VOICE_STATES.EVENT && sk !== VOICE_STATES.SPEAKING)
          setStatus(vol > 0.15 ? VOICE_STATES.RECORDING : VOICE_STATES.LISTENING, { reason: 'microphone volume activity', volume: Number(vol.toFixed(4)) });
        else if (sk === VOICE_STATES.SPEAKING && vol > BARGEIN_THRESHOLD)
          setStatus(VOICE_STATES.INTERRUPTED, { reason: 'possible barge-in', volume: Number(vol.toFixed(4)) });
      } else if (sk !== VOICE_STATES.IDLE && sk !== VOICE_STATES.EVENT && sk !== VOICE_STATES.THINKING && sk !== VOICE_STATES.DONE && sk !== VOICE_STATES.SPEAKING) {
        setStatus(VOICE_STATES.IDLE, { reason: 'microphone silence' });
      }
    }

    // 声音事件闪烁效果自动恢复
    if (sk === VOICE_STATES.EVENT) {
      eventFlashCount--;
      if (eventFlashCount <= 0) setStatus(micActive ? VOICE_STATES.LISTENING : VOICE_STATES.IDLE, { reason: 'sound event flash end' });
    }

    s.t    += 0.016 * s.spd;
    s.rotY += 0.008;
    s.rotX  = 0.22 + Math.sin(s.t * 0.15) * 0.06;

    ctx.clearRect(0, 0, W, H);

    const cY = Math.cos(s.rotY), sY = Math.sin(s.rotY);
    const cX = Math.cos(s.rotX), sX = Math.sin(s.rotX);

    const project = (orig) => {
      const d = 1.0 + sn(orig.x, orig.y, orig.z, s.t) * s.amp;
      const px = orig.x * d, py = orig.y * d, pz = orig.z * d;
      const rx  =  px * cY + pz * sY;
      const ry0 = py;
      const rz  = -px * sY + pz * cY;
      const ry  = ry0 * cX - rz * sX;
      const rz2 = ry0 * sX + rz * cX;
      return { sx: cx + rx * scale, sy: cy - ry * scale, z: rz2 };
    };

    const allPts = [
      ...BASE_PTS.map(p  => ({ ...project(p), inner: false })),
      ...BASE_PTS2.map(p => ({ ...project(p), inner: true  })),
    ];
    allPts.sort((a, b) => a.z - b.z);

    for (const pt of allPts) {
      const depth = (pt.z + 1.5) / 3.0;
      const r = Math.round(lerp(s.col[0][0], s.col[0][2], depth));
      const g = Math.round(lerp(s.col[1][0], s.col[1][2], depth));
      const b = Math.round(lerp(s.col[2][0], s.col[2][2], depth));
      const alpha = 0.25 + depth * 0.75;
      const dotR = pt.inner ? (0.4 + depth * 0.5) : (0.6 + depth * 0.8 + s.amp * 2);
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.fill();
    }

    rafId = requestAnimationFrame(drawFrame);
  }

  // ─── 麦克风捕获（共用于两种模式） ───
  let micData = null;
  let micActive = false;
  let userWantedMic = false;
  let suspendedByMedia = false;
  let mediaModeActive = false;
  let mediaStartedMic = false;
  let lastMediaVoiceActivityAt = 0;
  let mediaVoiceFrames = 0;
  let mediaVoiceLastVol = 0;
  let ttsStartTime = 0;
  let bargeinFrames = 0;
  let nearFieldGate = {
    noiseFloor: getAmbientThreshold(),
    nearChunks: 0,
    tailChunks: 0,
    ambientChunks: 0,
  };
  // Cloud 专用
  let cloudAudioCtx = null;
  let cloudProcessor = null;
  let cloudWs = null;
  // 打断预缓冲：TTS 期间把 PCM 写入环形缓冲，打断后一并发给 ASR
  let bargeinBuffer = []  // Int16Array 块的环形队列
  let bargeinBuffering = false // true = 正在 TTS，写缓冲而非发 WS
  // 噪音误触发恢复：barge-in 后若 ASR 一直无输出则重新播放 TTS
  let bargeinNoSpeechTimer = null
  const BARGEIN_NO_SPEECH_MS = 3500 // 3.5s 内没有识别到语音 → 视为误触发
  // Duck 状态（两阶段检测：先降音量，再判断是语音还是噪音）
  let duckActive = false
  let duckHighFrames = 0    // duck 中持续高振幅帧数（→判语音→打断）
  let duckLowFrames = 0     // duck 中持续低振幅帧数（→判噪音→恢复）
  let duckStartTime = 0
  // 快速非语音检测状态（真正打断后仍保留作为兜底）
  let bargeinFastCheckActive = false
  let bargeinFastCheckStart = 0
  let bargeinFastSilentFrames = 0
  // 自动发送防抖
  let lastTranscriptText = '';
  let autoSendTimer = null;
  let lastFinalTranscript = '';
  // PTT 按住期间禁用自动发送（由 pttEnd 在松手时统一发送）
  let pttHolding = false;
  // 多句累积：Paraformer 按句回调，需拼接完整段落
  let accumulatedText = '';
  let wakeActiveUntil = 0;
  let lastWakeReject = { text: '', at: 0, count: 0 };

  async function startMic() {
    try {
      const useAec = localStorage.getItem(VOICE_VIDEO_AEC_KEY) !== 'false';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: useAec,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      micData = { analyser, dataArray, stream, actx, src };
      nearFieldGate = { noiseFloor: getAmbientThreshold(), nearChunks: 0, tailChunks: 0, ambientChunks: 0 };
      return stream;
    } catch (e) {
      // 权限拒绝时球体变红，不在 transcript 显示文字
      setStatus(VOICE_STATES.ERROR, { reason: 'microphone permission denied' });
      return null;
    }
  }

  function stopMic() {
    micData?.stream.getTracks().forEach(t => t.stop());
    micData = null;
  }

  // ─── 语音识别结果发送 ───
  function sendRecognizedVoiceText() {
    if (!lastTranscriptText) return;
    if (looksLikeAsrHallucination(lastTranscriptText)) {
      lastTranscriptText = '';
      accumulatedText = '';
      if (transcript) transcript.textContent = '';
      setStatus(VOICE_STATES.LISTENING, { reason: 'filtered hallucination' });
      return;
    }
    const input = getChatInput?.();
    if (input) input.value = lastTranscriptText;
    getSendMessage?.({ channel: '语音识别', label: 'You · 语音识别' });
  }

  function getWakeConfig() {
    const enabled = localStorage.getItem(VOICE_WAKE_ENABLED_KEY) !== 'false';
    const words = (localStorage.getItem(VOICE_WAKE_WORDS_KEY) || '小龙马，龙马，白龙马')
      .split(/[,，、\s]+/)
      .map(w => w.trim())
      .filter(Boolean);
    const mode = localStorage.getItem(VOICE_WAKE_MODE_KEY) === 'loose' ? 'loose' : 'strict';
    const windowSeconds = Math.max(3, Math.min(30, Number(localStorage.getItem(VOICE_WAKE_WINDOW_KEY) || 8) || 8));
    const repeatSuppression = localStorage.getItem(VOICE_WAKE_REPEAT_SUPPRESS_KEY) !== 'false';
    return { enabled, words: words.length ? words : ['小龙马', '龙马', '白龙马'], mode, windowSeconds, repeatSuppression };
  }

  function normalizeWakeText(text = '') {
    return String(text || '').replace(/[\s,，、。.！!？?：:；;"“”'‘’]/g, '').toLowerCase();
  }

  function applyWakeWordGate(text = '') {
    const raw = String(text || '').trim();
    const cfg = getWakeConfig();
    if (!cfg.enabled) return { accepted: true, text: raw, wokeOnly: false, reason: 'wake disabled' };

    const now = Date.now();
    if (wakeActiveUntil > now) return { accepted: true, text: raw, wokeOnly: false, reason: 'wake window active' };

    if (cfg.repeatSuppression) {
      const normalizedRaw = normalizeWakeText(raw);
      if (normalizedRaw && normalizedRaw === lastWakeReject.text && now - lastWakeReject.at < 6000) {
        lastWakeReject = { text: normalizedRaw, at: now, count: lastWakeReject.count + 1 };
        return { accepted: false, text: '', wokeOnly: false, reason: 'repeat suppressed', repeatCount: lastWakeReject.count };
      }
    }

    const normalized = normalizeWakeText(raw);
    for (const word of cfg.words) {
      const nw = normalizeWakeText(word);
      if (!nw) continue;
      const idx = normalized.indexOf(nw);
      if (idx < 0) continue;
      if (cfg.mode === 'strict' && idx !== 0) continue;

      // 从原文里按未归一化唤醒词尽量切掉前缀；切不准时再做宽松替换。
      let remainder = raw;
      const directIdx = raw.indexOf(word);
      if (directIdx >= 0) remainder = raw.slice(directIdx + word.length);
      else remainder = raw.replace(new RegExp(word.split('').map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s,，、。.！!？?：:；;]*'), 'i'), '');
      remainder = remainder.replace(/^[\s,，、。.！!？?：:；;]+/, '').trim();
      wakeActiveUntil = Date.now() + cfg.windowSeconds * 1000;
      lastWakeReject = { text: '', at: 0, count: 0 };
      if (!remainder) return { accepted: false, text: '', wokeOnly: true, reason: 'wake only', word, windowSeconds: cfg.windowSeconds };
      return { accepted: true, text: remainder, wokeOnly: false, reason: 'wake matched', word, mode: cfg.mode };
    }
    const normalizedRaw = normalizeWakeText(raw);
    if (cfg.repeatSuppression && normalizedRaw) lastWakeReject = { text: normalizedRaw, at: now, count: 1 };
    return { accepted: false, text: '', wokeOnly: false, reason: cfg.mode === 'strict' ? 'wake not at prefix' : 'wake missing' };
  }

  function looksLikeAsrHallucination(text = '') {
    const t = String(text || '').trim();
    if (!t) return true;
    if (/(我不想说了|我只想说了|我想说了).*(我不想说了|我只想说了|我想说了)/.test(t)) return true;
    if (/(嗨|嘿|喂)[,，。\s]*(三毛|三猫)/.test(t)) return true;
    const segs = t.split(/[,，、。.！!？?\s]+/).map(s => s.trim()).filter(Boolean);
    if (segs.length >= 4 && new Set(segs).size <= 2) return true;
    if (segs.length >= 6) {
      const counts = new Map();
      for (const s of segs) counts.set(s, (counts.get(s) || 0) + 1);
      if (Math.max(...counts.values()) / segs.length >= 0.45) return true;
    }
    return false;
  }

  // 防抖自动发送：收到任意转录文字就重置 2s 计时器，停说 2s 后自动发
  function scheduleAutoSend() {
    if (pttHolding) return;
    if (autoSendTimer) clearTimeout(autoSendTimer);
    autoSendTimer = setTimeout(() => {
      autoSendTimer = null;
      setStatus(VOICE_STATES.THINKING, { reason: 'auto send recognized text' });
      sendRecognizedVoiceText();
    }, 2000);
  }

  // ─── ASR 模式：本地 SenseVoice/Whisper 或云端代理 ───
  let cloudWsIntentional = false; // stopCloudStream 主动关闭时置 true，避免触发重连

  function getAsrProvider() {
    const provider = localStorage.getItem(VOICE_PROVIDER_KEY) || 'local';
    return ['local', 'aliyun', 'tencent', 'xunfei'].includes(provider) ? provider : 'local';
  }

  async function ensureLocalAsrServer() {
    const model = localStorage.getItem(VOICE_LOCAL_ASR_MODEL_KEY) || 'sensevoice-small';
    const resp = await fetch(LOCAL_START_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, localAsrModel: model, asrProfile: localStorage.getItem(VOICE_ASR_PROFILE_KEY) || 'balanced' }),
    });
    if (!resp.ok) throw new Error(`本地语音识别启动失败: HTTP ${resp.status}`);
    const data = await resp.json().catch(() => ({}));
    if (data.ok === false) throw new Error(data.error || '本地语音识别启动失败');
    return data;
  }

  async function createRecognitionWs() {
    const provider = getAsrProvider();
    if (provider === 'local') {
      setStatus(VOICE_STATES.RECOGNIZING, { reason: 'starting local asr' });
      if (transcript) transcript.textContent = '正在启动本地语音模型…';
      await ensureLocalAsrServer();
      return { ws: new WebSocket(LOCAL_WS_URL), provider };
    }
    return { ws: new WebSocket(CLOUD_WS_URL), provider };
  }

  function sendRecognitionConfig(ws, provider) {
    const lang = getLang?.()?.split('-')[0] || 'zh';
    const payload = provider === 'local'
      ? {
          type: 'config',
          lang,
          speakerVerification: localStorage.getItem(VOICE_SPEAKER_VERIFY_KEY) === 'true',
          speakerThreshold: parseFloat(localStorage.getItem(VOICE_SPEAKER_THRESHOLD_KEY) || '0.55'),
        }
      : { type: 'config', provider, lang };
    ws.send(JSON.stringify(payload));
  }

  function handleRecognitionMessage(ev, ws) {
    if (cloudWs !== ws) return;
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'config_ok') {
        setStatus(VOICE_STATES.LISTENING, { reason: 'recognition config ok' });
        if (transcript && transcript.textContent === '正在启动本地语音模型…') transcript.textContent = '';
        return;
      }
      if (msg.type === 'transcript') {
        const text = (msg.text || '').trim();
        if (!text) return;
        if (looksLikeAsrHallucination(text)) return;
        if (msg.is_final) {
          if (text === lastFinalTranscript) return;
          const gated = applyWakeWordGate(text);
          if (!gated.accepted) {
            if (gated.wokeOnly) {
              if (transcript) transcript.textContent = `已唤醒，请在 ${gated.windowSeconds || 8} 秒内继续说指令…`;
              setStatus(VOICE_STATES.WAKE_DETECTED, { reason: 'wake word detected, waiting command', word: gated.word, windowSeconds: gated.windowSeconds });
            } else {
              setStatus(VOICE_STATES.LISTENING, { reason: gated.reason || 'wake rejected', repeatCount: gated.repeatCount });
            }
            return;
          }
          const acceptedText = gated.text;
          if (!acceptedText || looksLikeAsrHallucination(acceptedText)) return;
          lastFinalTranscript = acceptedText;
          accumulatedText = accumulatedText ? accumulatedText + '，' + acceptedText : acceptedText;
          lastTranscriptText = accumulatedText;
          if (transcript) transcript.textContent = accumulatedText;
          const input = getChatInput?.();
          if (input) input.value = accumulatedText;
          window.dispatchEvent(new CustomEvent('bailongma:assistant-wake', { detail: { text: acceptedText, wakeReason: gated.reason, wakeWord: gated.word } }));
          triggerDone();
        } else {
          lastTranscriptText = accumulatedText ? accumulatedText + '，' + text : text;
          if (transcript) transcript.textContent = lastTranscriptText;
        }
        scheduleAutoSend();
      } else if (msg.type === 'speaker_rejected') {
        setStatus(VOICE_STATES.LISTENING, { reason: 'speaker rejected' });
        if (transcript) transcript.textContent = msg.reason || `已忽略非本人声音${msg.score != null ? `（声纹 ${msg.score}/${msg.threshold}）` : ''}`;
        return;
      } else if (msg.type === 'sound_event') {
        // 本地语音服务可选返回环境声音事件。这里保持静默，不干扰转写文本。
      } else if (msg.type === 'error') {
        setStatus(VOICE_STATES.ERROR, { reason: msg.message || 'recognition error' });
        if (transcript) transcript.textContent = msg.message || '语音识别错误';
      }
    } catch {}
  }

  async function connectCloudWs() {
    cloudWsIntentional = false; // 新连接建立时清除上一次主动关闭的标记
    let ws, provider;
    try {
      ({ ws, provider } = await createRecognitionWs());
    } catch (err) {
      setStatus(VOICE_STATES.ERROR, { reason: err?.message || 'recognition startup failed' });
      if (transcript) transcript.textContent = err?.message || '本地语音识别启动失败';
      return;
    }
    ws.binaryType = 'arraybuffer';
    cloudWs = ws;

    ws.onopen = () => {
      if (cloudWs !== ws) return;
      sendRecognitionConfig(ws, provider);
      setStatus(VOICE_STATES.LISTENING, { reason: 'recognition websocket open', provider });
      // 注意：此处不重置 accumulatedText，由调用方在首次启动时负责清空
    };

    ws.onmessage = (ev) => handleRecognitionMessage(ev, ws);

    ws.onerror = () => { if (cloudWs === ws) setStatus(VOICE_STATES.ERROR, { reason: 'recognition websocket error' }); };

    ws.onclose = () => {
      if (cloudWs !== ws) return; // 已被新连接取代，忽略旧连接的 close 事件
      cloudWs = null;
      if (!cloudWsIntentional && micActive) {
        // 非主动断开（超时/网络抖动）且用户仍在录音 → 自动重连，保留已识别文字
        setTimeout(() => { if (micActive) connectCloudWs(); }, 800);
      } else {
        cloudWsIntentional = false;
        if (micActive) setStatus(VOICE_STATES.IDLE, { reason: 'recognition websocket closed' });
      }
    };
  }

  function startCloudStream(stream) {
    const targetSR = 16000;
    if (micData?.actx?.sampleRate !== targetSR) {
      cloudAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: targetSR });
      const src = cloudAudioCtx.createMediaStreamSource(stream);
      setupCloudProcessor(src, cloudAudioCtx);
    } else {
      setupCloudProcessor(micData.src, micData.actx);
    }

    // 首次启动清空累积文字；重连时由 connectCloudWs 直接调用，不经过此处
    accumulatedText = '';
    if (transcript) transcript.textContent = '';
    voiceMachine.beginAsrSession('recognition stream start');
    connectCloudWs();
  }

  function setupCloudProcessor(srcNode, audioCtx) {
    const bufferSize = 4096;
    cloudProcessor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    srcNode.connect(cloudProcessor);
    cloudProcessor.connect(audioCtx.destination);

    cloudProcessor.onaudioprocess = (e) => {
      const f32 = e.inputBuffer.getChannelData(0);
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
      }
      if (bargeinBuffering) {
        // TTS 播放中：写入环形缓冲而非发送，供打断时回放
        bargeinBuffer.push(i16);
        if (bargeinBuffer.length > BARGEIN_MAX_CHUNKS) bargeinBuffer.shift();
        return;
      }
      if (!cloudWs || cloudWs.readyState !== WebSocket.OPEN) return;
      cloudWs.send(i16.buffer);
    };
  }

  function stopCloudStream({ preserveProcessor = false } = {}) {
    cloudWsIntentional = true; // 标记为主动关闭，防止 onclose 触发重连
    try {
      if (cloudWs && cloudWs.readyState === WebSocket.OPEN) {
        cloudWs.send(JSON.stringify({ type: 'flush' }));
        setTimeout(() => { try { cloudWs?.close(); } catch {} }, 200);
      } else {
        cloudWs?.close();
      }
    } catch {}
    cloudWs = null;

    if (!preserveProcessor) {
      try { cloudProcessor?.disconnect(); } catch {}
      cloudProcessor = null;
      try { if (cloudAudioCtx) { cloudAudioCtx.close(); cloudAudioCtx = null; } } catch {}
    }
  }

  // ─── 统一开关 ───
  async function toggleVoice() {
    if (!micActive) {
      voiceMachine.beginRound('manual microphone start');
      micActive = true;
      userWantedMic = true;
      suspendedByMedia = false;
      btn?.classList.add('active');
      const stream = await startMic();
      if (!stream) { micActive = false; userWantedMic = false; btn?.classList.remove('active'); return; }
      startCloudStream(stream);
    } else {
      stopVoiceInput();
    }
  }

  function stopVoiceInput({ keepIntent = false, reason = '' } = {}) {
    pttHolding = false;
    if (doneTimer) { clearTimeout(doneTimer); doneTimer = null; }
    if (autoSendTimer) { clearTimeout(autoSendTimer); autoSendTimer = null; }
    clearBargeinNoSpeechTimer();
    bargeinFastCheckActive = false;
    bargeinFastSilentFrames = 0;
    duckActive = false;
    duckHighFrames = 0;
    duckLowFrames = 0;
    lastTranscriptText = '';
    micActive = false;
    if (!keepIntent) userWantedMic = false;
    btn?.classList.toggle('active', Boolean(keepIntent && userWantedMic));
    bargeinBuffer = [];
    bargeinBuffering = false;
    stopCloudStream();
    stopMic();
    setStatus(VOICE_STATES.IDLE, { reason: reason || 'voice input stopped' });
    if (transcript) transcript.textContent = '';
  }

  function clearBargeinNoSpeechTimer() {
    if (bargeinNoSpeechTimer) {
      clearTimeout(bargeinNoSpeechTimer);
      bargeinNoSpeechTimer = null;
    }
  }

  // 启动误触发恢复计时：若 N 毫秒内没有真实语音输入，则续播 TTS
  function startBargeinNoSpeechTimer() {
    clearBargeinNoSpeechTimer();
    bargeinNoSpeechTimer = setTimeout(() => {
      bargeinNoSpeechTimer = null;
      // 没有收到任何语音 → 噪音误触发，让 agent 继续说
      window.resumeTTSIfNoSpeech?.();
    }, BARGEIN_NO_SPEECH_MS);
  }

  async function resumeVoiceInputFromMedia(fromBargein = false) {
    if (!suspendedByMedia || !userWantedMic) return;
    suspendedByMedia = false;
    bargeinFrames = 0;

    // 拿走缓冲区快照并立刻停止写入，避免 WS 重连期间继续堆积
    const bufferedChunks = bargeinBuffer.slice();
    bargeinBuffer = [];
    bargeinBuffering = false;

    if (micActive && micData && cloudProcessor) {
      // TTS 模式：ScriptProcessor 仍存活，只需重连 WebSocket
      setStatus(VOICE_STATES.LISTENING, { reason: 'resume voice input from media' });

      // barge-in 触发的恢复：等待真实语音，超时则续播
      if (fromBargein) startBargeinNoSpeechTimer();

      accumulatedText = '';
      if (transcript) transcript.textContent = '';
      let bargeinWs, bargeinProvider;
      try {
        ({ ws: bargeinWs, provider: bargeinProvider } = await createRecognitionWs());
      } catch (err) {
        setStatus(VOICE_STATES.ERROR, { reason: err?.message || 'barge-in recognition startup failed' });
        if (transcript) transcript.textContent = err?.message || '语音识别启动失败';
        return;
      }
      bargeinWs.binaryType = 'arraybuffer';
      cloudWs = bargeinWs;
      bargeinWs.onopen = () => {
        if (cloudWs !== bargeinWs) return;
        sendRecognitionConfig(bargeinWs, bargeinProvider);
        // 先把预缓冲的历史音频一次性发出，补回打断前说的内容
        for (const chunk of bufferedChunks) {
          if (bargeinWs.readyState === WebSocket.OPEN) bargeinWs.send(chunk.buffer);
        }
      };
      bargeinWs.onmessage = (ev) => {
        // 收到真实语音 → 取消所有误触发恢复机制
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'transcript' && (msg.text || '').trim()) {
            bargeinFastCheckActive = false;
            bargeinFastSilentFrames = 0;
            clearBargeinNoSpeechTimer();
          }
        } catch {}
        handleRecognitionMessage(ev, bargeinWs);
      };
      bargeinWs.onerror = () => { if (cloudWs === bargeinWs) setStatus(VOICE_STATES.ERROR, { reason: 'barge-in websocket error' }); };
      bargeinWs.onclose = () => {
        if (cloudWs !== bargeinWs) return;
        cloudWs = null;
        if (!cloudWsIntentional && micActive) {
          setTimeout(() => { if (micActive) connectCloudWs(); }, 800);
        } else {
          cloudWsIntentional = false;
          if (micActive) setStatus(VOICE_STATES.IDLE, { reason: 'recognition websocket closed' });
        }
      };
    } else {
      // 视频/音乐模式，或 Processor 已被销毁：完整重启
      if (fromBargein) startBargeinNoSpeechTimer();
      micActive = true;
      btn?.classList.add('active');
      const stream = await startMic();
      if (!stream) {
        micActive = false;
        userWantedMic = false;
        btn?.classList.remove('active');
        return;
      }
      startCloudStream(stream);
    }
  }

  // PTT（按住空格说话）：press → 开 mic / 从 TTS 恢复，release → 立即发送
  let pttStartedMic = false;

  async function pttStart() {
    // 让 release 时不会发出旧的累积识别结果
    pttHolding = true;
    lastTranscriptText = '';
    if (autoSendTimer) { clearTimeout(autoSendTimer); autoSendTimer = null; }

    if (suspendedByMedia) {
      // mic 硬件仍在，只是 ASR WS 被 TTS 暂停 → 重连即可，不算 PTT 开的 mic
      pttStartedMic = false;
      await resumeVoiceInputFromMedia(false);
      return;
    }
    if (micActive) {
      // 已经在听 → 不改状态，但 release 时仍要"立即发送"
      pttStartedMic = false;
      return;
    }
    pttStartedMic = true;
    await toggleVoice();
  }

  function pttEnd() {
    pttHolding = false;
    const startedMic = pttStartedMic;
    pttStartedMic = false;
    if (!micActive) return;

    // 通知云端 ASR 立刻给最终结果
    try {
      if (cloudWs && cloudWs.readyState === WebSocket.OPEN) {
        cloudWs.send(JSON.stringify({ type: 'flush' }));
      }
    } catch {}

    const finalize = () => {
      if (lastTranscriptText) {
        if (autoSendTimer) { clearTimeout(autoSendTimer); autoSendTimer = null; }
        setStatus(VOICE_STATES.THINKING, { reason: 'ptt send recognized text' });
        sendRecognizedVoiceText();
        if (startedMic) setTimeout(() => stopVoiceInput(), 120);
      } else if (startedMic) {
        stopVoiceInput();
      }
    };

    // 给云端 800ms 把最终结果吐出来
    let waited = 0;
    const tick = () => {
      if (lastTranscriptText) { finalize(); return; }
      if (waited >= 800) { finalize(); return; }
      waited += 100;
      setTimeout(tick, 100);
    };
    tick();
  }

  function shouldKeepMicDuringMedia() {
    return localStorage.getItem(VOICE_VIDEO_DUCK_KEY) !== 'false'
      || localStorage.getItem(VOICE_VIDEO_AEC_KEY) !== 'false';
  }

  async function handleMediaModeActive() {
    mediaModeActive = true;
    if (shouldKeepMicDuringMedia()) {
      suspendedByMedia = false;
      if (!micActive) {
        mediaStartedMic = true;
        userWantedMic = true;
        await toggleVoice();
      }
      return;
    }
    window.bailongmaVoice.suspendForMedia();
  }

  function handleMediaModeInactive() {
    mediaModeActive = false;
    if (mediaStartedMic) {
      mediaStartedMic = false;
      stopVoiceInput({ keepIntent: false, reason: '视频结束，关闭自动监听' });
      return;
    }
    window.bailongmaVoice.resumeAfterMedia();
  }

  window.bailongmaVoice = {
    isActive: () => micActive,
    // 视频/音乐模式：完全停止 mic（不需要打断能力）
    suspendForMedia: () => {
      if (!micActive) return;
      suspendedByMedia = true;
      stopVoiceInput({ keepIntent: true, reason: '视频模式中，语音已暂停' });
    },
    // TTS 模式：只停云端 ASR WebSocket，保持 mic 硬件 + ScriptProcessor
    // 开启预缓冲：打断时可回放最近 1.5s 的音频，避免开头几个字丢失
    suspendForTTS: () => {
      if (!micActive) return;
      suspendedByMedia = true;
      ttsStartTime = Date.now();
      bargeinFrames = 0;
      duckActive = false;
      duckHighFrames = 0;
      duckLowFrames = 0;
      bargeinBuffer = [];
      bargeinBuffering = true;
      stopCloudStream({ preserveProcessor: true }); // 保留 Processor，只断 WS
      voiceMachine.beginTtsSession('tts playback started');
      setStatus(VOICE_STATES.SPEAKING, { reason: 'tts playback started' });
    },
    resumeAfterMedia: () => {
      clearBargeinNoSpeechTimer(); // TTS 正常结束，不需要续播
      voiceMachine.clearTtsSession('tts playback ended');
      resumeVoiceInputFromMedia(false);
    },
    stop: () => stopVoiceInput(),
    pttStart,
    pttEnd,
  };

  window.addEventListener('bailongma:video-mode', (event) => {
    if (event.detail?.active) {
      handleMediaModeActive();
    } else {
      handleMediaModeInactive();
    }
  });

  window.addEventListener('bailongma:music-mode', (event) => {
    if (event.detail?.active) {
      handleMediaModeActive();
    } else {
      handleMediaModeInactive();
    }
  });

  // 阈值实时更新（设置面板保存后立即生效，无需重启语音）
  window.addEventListener('bailongma:voice-threshold', (event) => {
    const t = Number(event.detail?.threshold);
    if (!isNaN(t) && t > 0) {
      nearFieldGate.noiseFloor = t * 0.375;
    }
  });

  // ─── 面板初始化 ───
  function openPanel() {
    panel.hidden = false;
    if (!rafId) drawFrame();
  }

  btn?.addEventListener('click', toggleVoice);
  canvas.addEventListener('click', toggleVoice);

  setStatus(VOICE_STATES.IDLE, { reason: 'voice panel initialized' });
  openPanel();
  if (getAutoMic?.()) toggleVoice();
}
