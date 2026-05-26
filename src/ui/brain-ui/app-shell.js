import { createHotspotPanel } from './hotspot-panel.js';
import { createPersonCardPanel } from './person-card-panel.js';
import { createDocPanel } from './doc-panel.js';

const createGraphStage = () => `
<div class="grid-overlay"></div>
<svg id="graph" aria-label="Longma 记忆节点图"></svg>
`;

const createPrimaryPanel = () => `
<aside id="panel-l1" class="panel">
  <header class="panel-identity">
    <div class="brand-mark"></div>
    <div class="brand-copy">
      <div class="eyebrow">认知界面</div>
      <div class="brand-title" id="agent-brand-name">Longma AI Agent</div>
    </div>
    <button class="voice-btn" id="voice-btn" title="麦克风 开/关" type="button">🎤</button>
    <button class="video-btn" id="video-btn" title="视频模式 (V)" type="button">⊞</button>
    <button class="music-btn" id="music-btn" title="音乐模式 (M)" type="button" hidden>♪</button>
    <button class="settings-btn" id="settings-btn" title="设置" type="button">⚙</button>
  </header>

  <div class="stream-meta">
    <div>
      <div class="stream-title-text">用户消息处理器</div>
      <!-- <div class="stream-subtitle">user message · react</div> -->
    </div>
    <span class="pill" id="pill-l1">实时</span>
  </div>

  ${createVoicePanel()}

  <div class="legend" id="legend"></div>

  <div class="stream">
    <div class="stream-inner" id="si-l1"></div>
  </div>

  <div class="panel-actions">
    <button class="reset-view" id="reset-view-btn" type="button">重置节点图</button>

    <section class="physics-control" id="physics-control">
      <button class="physics-toggle" id="physics-toggle" type="button" aria-expanded="false">
        <span class="physics-toggle-label">图谱调节</span>
        <span class="physics-toggle-icon">▾</span>
      </button>
      <div class="physics-panel" id="physics-panel">
        <div class="physics-panel-inner">
          <div class="physics-field">
            <div class="physics-field-head">
              <label class="physics-field-label" for="gravity-slider">引力</label>
              <span class="physics-field-value" id="gravity-value">1.00x</span>
            </div>
            <input class="physics-slider" id="gravity-slider" type="range" min="0" max="5" step="0.02" value="2">
          </div>
          <div class="physics-field">
            <div class="physics-field-head">
              <label class="physics-field-label" for="repulsion-slider">斥力</label>
              <span class="physics-field-value" id="repulsion-value">1.00x</span>
            </div>
            <input class="physics-slider" id="repulsion-slider" type="range" min="0" max="5" step="0.02" value="2">
          </div>
          <div class="physics-field">
            <div class="physics-field-head">
              <label class="physics-field-label" for="node-size-slider">节点大小</label>
              <span class="physics-field-value" id="node-size-value">1.00x</span>
            </div>
            <input class="physics-slider" id="node-size-slider" type="range" min="0" max="5" step="0.02" value="2">
          </div>
        </div>
      </div>
    </section>
  </div>
</aside>
`;

const createSecondaryPanel = () => `
<aside id="panel-l2" class="panel">
  <header class="panel-stats">
    <div class="stat">
      <span class="stat-label">状态</span>
      <div class="stat-value live" id="conn-state"><span class="live-dot"></span>Token流</div>
    </div>
    <div class="stat">
      <span class="stat-label">节点</span>
      <div class="stat-value" id="node-count">0</div>
    </div>
    <div class="stat">
      <span class="stat-label">连线</span>
      <div class="stat-value" id="link-count">0</div>
    </div>
    <div class="stat">
      <span class="stat-label">tok/s</span>
      <div class="stat-value" id="tok-rate">—</div>
    </div>
  </header>

  <!-- 专注帧 UI 已隐藏（后端 focus stack 仍在工作，给 LLM 注入上下文）。
       要恢复观察面板时把对应 HTML 还原即可——app.js 渲染逻辑保留着，靠 getElementById 返回 null 自动 no-op。 -->

  <div class="stream-meta">
    <div>
      <div class="stream-title-text">自主行动机制 · Tick</div>
      <div class="stream-subtitle">心跳 · 思考 · 工具</div>
    </div>
    <span class="pill pill-warm" id="pill-l2">流式传输</span>
  </div>

  <div class="stream">
    <div class="stream-inner" id="si-l2"></div>
  </div>
</aside>
`;

const createConsole = () => `
<section class="console" id="chat-area">
  <div id="chat-history">
    <div id="chat-messages"></div>
  </div>
  <div id="input-row">
    <span class="prompt-mark">▸</span>
    <input id="msg-input" type="text" placeholder="向 Longma 发送消息…" autocomplete="off">
    <button id="send-btn" type="button">发送</button>
  </div>
</section>
`;

const createThemeSwitcher = () => `
<div class="theme-switcher" id="theme-switcher">
  <div class="theme-dot active" data-t="midnight" title="Midnight Steel"></div>
  <div class="theme-dot" data-t="phosphor" title="Phosphor CRT"></div>
  <div class="theme-dot" data-t="violet" title="Violet Lab"></div>
  <div class="theme-dot" data-t="rose" title="Rose Dusk"></div>
  <div class="theme-dot" data-t="arctic" title="Arctic"></div>
  <div class="theme-dot" data-t="sand" title="Warm Sand"></div>
</div>
`;

const createTooltip = () => `
<div id="tip"></div>
`;

const createSettingsModal = () => `
<div class="settings-overlay" id="settings-overlay" hidden>
  <div class="settings-modal" role="dialog" aria-modal="true" aria-label="设置">
    <div class="settings-header">
      <span class="settings-title">设置</span>
      <button class="settings-close" id="settings-close" type="button" aria-label="关闭">×</button>
    </div>
    <div class="settings-body">

      <!-- 侧栏导航 -->
      <nav class="settings-nav">
        <button class="settings-nav-item active" data-tab="appearance" type="button">外观</button>
        <button class="settings-nav-item" data-tab="llm" type="button">LLM 模型</button>
        <button class="settings-nav-item" data-tab="media" type="button">媒体能力</button>
        <button class="settings-nav-item" data-tab="social" type="button">社交媒体</button>
        <button class="settings-nav-item" data-tab="voice" type="button">语音识别</button>
        <button class="settings-nav-item" data-tab="web-search" type="button">上网搜索</button>
        <button class="settings-nav-item" data-tab="security" type="button">安全沙箱</button>
        <button class="settings-nav-item" data-tab="update" type="button">更新</button>
      </nav>

      <!-- 内容区 -->
      <div class="settings-content">

        <!-- ── 外观 tab ── -->
        <div class="settings-tab active" data-tab="appearance">
          <div class="settings-section">
            <div class="settings-section-label">主题</div>
            ${createThemeSwitcher()}
          </div>
          <div class="settings-section">
            <div class="settings-section-label">记忆节点图</div>
            <p class="settings-hint">开启后在背景显示记忆节点力导向图，会占用额外 CPU/GPU 资源，低配设备建议关闭。修改后需刷新页面生效。</p>
            <div class="settings-row">
              <label class="settings-label" for="settings-memory-graph-toggle">显示记忆节点图</label>
              <input id="settings-memory-graph-toggle" type="checkbox" style="width:auto;flex:none;">
              <span class="settings-feedback" id="settings-memory-graph-feedback" style="margin-left:8px;"></span>
            </div>
          </div>
        </div>

        <!-- ── LLM 模型 tab ── -->
        <div class="settings-tab" data-tab="llm">
          <div class="settings-section">
            <div class="settings-section-label">当前状态</div>
            <div class="settings-config-row">
              <span class="settings-config-type">LLM</span>
              <span class="settings-config-info" id="settings-cfg-llm">—</span>
              <span class="settings-config-dot" id="settings-cfg-llm-dot"></span>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">切换配置</div>
            <div class="settings-row">
              <label class="settings-label" for="settings-provider-select">提供商</label>
              <select class="settings-select" id="settings-provider-select">
                <option value="auto">自动识别</option>
                <option value="deepseek">DeepSeek</option>
                <option value="minimax">MiniMax</option>
                <option value="custom">自定义端点（本地/其他）</option>
              </select>
            </div>
            <div class="settings-row" id="settings-model-row">
              <label class="settings-label" for="settings-model-select">模型</label>
              <select class="settings-select" id="settings-model-select"></select>
            </div>
            <!-- 自定义端点字段（选择"自定义端点"时显示） -->
            <div id="settings-custom-llm-section" style="display:none;">
              <div class="settings-row">
                <label class="settings-label" for="settings-custom-baseurl">Base URL</label>
                <input class="settings-input" id="settings-custom-baseurl" type="text" placeholder="如 http://localhost:11434/v1">
              </div>
              <div class="settings-row">
                <label class="settings-label" for="settings-custom-model">模型名称</label>
                <input class="settings-input" id="settings-custom-model" type="text" placeholder="如 llama3.2, qwen2.5, mistral">
              </div>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="settings-llm-key">API Key</label>
              <input class="settings-input" id="settings-llm-key" type="password" placeholder="自定义端点可留空；其他留空则仅切换模型" autocomplete="new-password">
            </div>
            <div class="settings-row-action">
              <button class="settings-save-btn" id="settings-save-llm" type="button">保存</button>
              <span class="settings-feedback" id="settings-llm-feedback"></span>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">模型温度</div>
            <p class="settings-hint">控制回复的随机性。0 = 确定性最高，1 = 正常创意，1.5 = 更随机。推荐 0.3–0.7。</p>
            <div class="settings-row">
              <label class="settings-label" for="settings-temperature">Temperature</label>
              <input type="range" id="settings-temperature" min="0" max="1.5" step="0.05" value="0.5" style="flex:1;cursor:pointer;">
              <span id="settings-temperature-val" style="min-width:2.8em;text-align:right;color:var(--ink2);font-size:13px;">0.50</span>
            </div>
            <div class="settings-row-action">
              <button class="settings-save-btn" id="settings-save-temperature" type="button">保存</button>
              <span class="settings-feedback" id="settings-temperature-feedback"></span>
            </div>
          </div>
        </div>

        <!-- ── 媒体能力 tab ── -->
        <div class="settings-tab" data-tab="media">
          <div class="settings-section">
            <div class="settings-section-label">当前状态</div>
            <div class="settings-config-row">
              <span class="settings-config-type">媒体</span>
              <span class="settings-config-info" id="settings-cfg-media">—</span>
              <span class="settings-config-dot" id="settings-cfg-media-dot"></span>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">MiniMax API Key</div>
            <div class="settings-row">
              <label class="settings-label" for="settings-minimax-key">API Key</label>
              <input class="settings-input" id="settings-minimax-key" type="password" placeholder="填入 MiniMax API Key…" autocomplete="new-password">
            </div>
            <div class="settings-row-action">
              <button class="settings-save-btn" id="settings-save-minimax" type="button">保存</button>
              <span class="settings-feedback" id="settings-minimax-feedback"></span>
            </div>
          </div>
        </div>

        <!-- ── 社交媒体 tab ── -->
        <div class="settings-tab" data-tab="social">
          <div class="settings-section">
            <div class="settings-section-label">Discord</div>
            <div class="settings-platform-status" id="social-status-discord"></div>
            <div class="settings-row">
              <label class="settings-label" for="social-discord-token">Bot Token</label>
              <input class="settings-input" id="social-discord-token" type="password" placeholder="留空保持原值不变…" autocomplete="new-password">
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">飞书</div>
            <div class="settings-platform-status" id="social-status-feishu"></div>
            <div class="settings-row">
              <label class="settings-label" for="social-feishu-appid">App ID</label>
              <input class="settings-input" id="social-feishu-appid" type="password" placeholder="留空保持原值…" autocomplete="new-password">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="social-feishu-secret">App Secret</label>
              <input class="settings-input" id="social-feishu-secret" type="password" placeholder="留空保持原值…" autocomplete="new-password">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="social-feishu-token">Verify Token</label>
              <input class="settings-input" id="social-feishu-token" type="password" placeholder="留空保持原值…" autocomplete="new-password">
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">微信公众号</div>
            <div class="settings-platform-status" id="social-status-wechat"></div>
            <div class="settings-row">
              <label class="settings-label" for="social-wechat-appid">App ID</label>
              <input class="settings-input" id="social-wechat-appid" type="password" placeholder="留空保持原值…" autocomplete="new-password">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="social-wechat-secret">App Secret</label>
              <input class="settings-input" id="social-wechat-secret" type="password" placeholder="留空保持原值…" autocomplete="new-password">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="social-wechat-token">Token</label>
              <input class="settings-input" id="social-wechat-token" type="password" placeholder="留空保持原值…" autocomplete="new-password">
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">企业微信</div>
            <div class="settings-platform-status" id="social-status-wecom"></div>
            <div class="settings-row">
              <label class="settings-label" for="social-wecom-botkey">Bot Key</label>
              <input class="settings-input" id="social-wecom-botkey" type="password" placeholder="留空保持原值…" autocomplete="new-password">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="social-wecom-token">Incoming Token</label>
              <input class="settings-input" id="social-wecom-token" type="password" placeholder="留空保持原值…" autocomplete="new-password">
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">微信 ClawBot（个人微信）</div>
            <div class="settings-platform-status" id="social-status-clawbot">○ 未连接</div>
            <p class="settings-hint">点击「连接微信」后会生成二维码，用微信扫码即可绑定个人账号。凭证保存在本地，重启后无需重新扫码。</p>
            <div class="settings-row" style="gap:8px;flex-wrap:wrap;">
              <button class="settings-save-btn" id="clawbot-connect-btn" type="button" style="width:auto;padding:0 16px;">连接微信</button>
              <button class="settings-save-btn" id="clawbot-logout-btn" type="button" style="width:auto;padding:0 16px;background:var(--danger,#c0392b);">断开</button>
            </div>
            <div id="clawbot-qr-area" style="display:none;margin-top:12px;text-align:center;">
              <p class="settings-hint" style="margin-bottom:8px;">用微信扫描下方二维码：</p>
              <img id="clawbot-qr-img" src="" alt="微信二维码" style="width:200px;height:200px;border:1px solid var(--border);border-radius:4px;">
              <p class="settings-hint" style="margin-top:6px;font-size:11px;" id="clawbot-qr-hint">等待扫码…</p>
            </div>
            <span class="settings-feedback" id="clawbot-feedback"></span>
          </div>
          <div class="settings-section settings-section-action">
            <button class="settings-save-btn" id="settings-save-social" type="button">保存所有</button>
            <span class="settings-feedback" id="settings-social-feedback"></span>
          </div>
        </div>

        <!-- ── 语音 tab ── -->
        <div class="settings-tab" data-tab="voice">

          <div class="settings-section">
            <div class="settings-section-label">小智式语音状态机</div>
            <p class="settings-hint">用于调试唤醒词、声纹、视频抗干扰、ASR 和后续分句 TTS。状态机记录每一轮 roundId / asrSessionId / ttsSessionId，旧轮次事件会被识别并丢弃，避免串音和误触发。</p>
            <div class="settings-row">
              <label class="settings-label" for="voice-debug-enabled">显示语音调试状态</label>
              <input id="voice-debug-enabled" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div id="voice-debug-panel" style="display:grid;grid-template-columns:120px 1fr;gap:6px 12px;margin-top:10px;font-size:12px;color:var(--ink2);">
              <span>当前状态</span><strong id="voice-debug-state" style="color:var(--ink);">idle</strong>
              <span>状态原因</span><span id="voice-debug-reason">init</span>
              <span>Round</span><code id="voice-debug-round">—</code>
              <span>ASR Session</span><code id="voice-debug-asr">—</code>
              <span>TTS Session</span><code id="voice-debug-tts">—</code>
              <span>最近事件</span><code id="voice-debug-event">—</code>
              <span>麦克风/VAD</span><code id="voice-debug-mic">—</code>
              <span>唤醒判定</span><code id="voice-debug-wake">—</code>
              <span>声纹判定</span><code id="voice-debug-speaker">—</code>
              <span>媒体门控</span><code id="voice-debug-media">—</code>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-section-label">外部语音客户端</div>
            <p class="settings-hint">显示通过 /voice/events 接入的小智式 ESP32、桥接器、手机端或调试 CLI。用于排查是否连上、是否订阅音频、声明了哪些 capabilities，以及服务端建议的音频模式。</p>
            <div class="voice-clients-toolbar">
              <div class="voice-client-stat"><span>连接</span><strong id="voice-clients-count">0</strong></div>
              <div class="voice-client-stat"><span>音频订阅</span><strong id="voice-clients-audio-count">0</strong></div>
              <div class="voice-client-stat"><span>二进制</span><strong id="voice-clients-binary-count">0</strong></div>
              <button class="settings-save-btn" id="voice-clients-refresh-btn" type="button">刷新客户端</button>
              <button class="settings-save-btn" id="voice-link-check-btn" type="button">一键自检</button>
              <button class="settings-save-btn" id="voice-package-btn" type="button">生成接入包</button>
              <button class="settings-save-btn" id="voice-clients-protocol-btn" type="button">协议自检</button>
              <button class="settings-save-btn" id="voice-clients-copy-btn" type="button">复制接入命令</button>
              <label class="voice-clients-auto"><input id="voice-clients-auto-refresh" type="checkbox" checked> 自动刷新</label>
              <span class="settings-feedback" id="voice-clients-feedback"></span>
            </div>
            <div id="voice-link-summary" class="voice-link-summary" hidden></div>
            <div id="voice-link-check" class="voice-link-check" hidden></div>
            <div id="voice-package-panel" class="voice-package-panel" hidden></div>
            <div id="voice-clients-diagnostics" class="voice-clients-diagnostics" hidden></div>
            <div id="voice-clients-guide" class="voice-clients-guide" hidden></div>
            <div id="voice-clients-list" class="voice-clients-list">
              <div class="voice-clients-empty">暂无外部客户端连接。可运行 <code>npm run voice:events -- listen --audio --client-id mac-debug</code> 测试。</div>
            </div>
            <div class="voice-events-history-head">
              <div>
                <div class="voice-events-history-title">最近语音事件</div>
                <p class="settings-hint">按时间倒序显示 /voice/events/history 的唤醒、识别、TTS 与中断事件，方便判断设备是否真的听到、识别到、播报到。</p>
              </div>
              <div class="voice-events-history-controls">
                <select class="settings-select" id="voice-events-history-filter" aria-label="语音事件过滤">
                  <option value="">全部</option>
                  <option value="wake:accepted">唤醒成功</option>
                  <option value="wake:rejected">唤醒拒绝</option>
                  <option value="asr:partial">识别中</option>
                  <option value="asr:final">识别完成</option>
                  <option value="tts:start">TTS 开始</option>
                  <option value="tts:stop">TTS 结束</option>
                  <option value="interrupt">中断</option>
                </select>
                <button class="settings-save-btn" id="voice-events-history-refresh-btn" type="button">刷新事件</button>
              </div>
            </div>
            <div id="voice-events-history-list" class="voice-events-history-list">
              <div class="voice-clients-empty">暂无语音事件。触发一次唤醒/识别/TTS 后会显示在这里。</div>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-section-label">语音识别模式</div>
            <div class="settings-row">
              <label class="settings-label" for="voice-provider-select">服务商</label>
              <select class="settings-select" id="voice-provider-select">
                <option value="local">本地模型（默认）</option>
                <option value="aliyun">阿里云百炼（推荐）</option>
                <option value="tencent">腾讯云 ASR</option>
                <option value="xunfei">科大讯飞 RTASR</option>
              </select>
            </div>
            <div id="voice-cred-local">
              <p class="settings-hint">本地模式会在 Mac 上启动离线语音识别服务，麦克风音频不上传云端。推荐 SenseVoiceSmall：中文优先、速度快、比 Whisper 更不容易空音频幻觉。</p>
              <div class="settings-row">
                <label class="settings-label" for="voice-local-asr-model">本地模型</label>
                <select class="settings-select" id="voice-local-asr-model">
                  <option value="sensevoice-small">SenseVoiceSmall（推荐：中文优先/更快/低幻觉）</option>
                  <option value="small">Whisper small（备用）</option>
                  <option value="base">Whisper base（更快，准确率低）</option>
                  <option value="medium">Whisper medium（更准，更慢）</option>
                  <option value="turbo">Whisper turbo（较快且较准）</option>
                </select>
              </div>
              <div class="settings-row">
                <label class="settings-label" for="voice-asr-profile">识别模式</label>
                <select class="settings-select" id="voice-asr-profile">
                  <option value="speed">极速：优先低延迟</option>
                  <option value="balanced">平衡：推荐默认</option>
                  <option value="accuracy">高精度：优先准确率</option>
                </select>
              </div>
              <div class="voice-local-overview" id="voice-local-overview" hidden>
                <div class="voice-local-overview-head">
                  <strong id="voice-local-overview-title">本地语音总览</strong>
                  <span id="voice-local-overview-level">pending</span>
                </div>
                <p id="voice-local-overview-summary">正在读取本地语音状态…</p>
                <div id="voice-local-overview-actions" class="voice-local-overview-actions"></div>
                <div class="voice-local-diagnostics-actions">
                  <button class="voice-readiness-action" id="voice-diagnostics-export" type="button">导出诊断包</button>
                  <span class="settings-feedback" id="voice-diagnostics-feedback"></span>
                </div>
              </div>
              <div class="settings-row voice-local-service-actions">
                <label class="settings-label">本地服务控制</label>
                <button class="settings-save-btn" id="voice-local-stop" type="button" style="width:auto;padding:0 12px;">停止/取消跟踪</button>
                <button class="settings-save-btn" id="voice-local-restart" type="button" style="width:auto;padding:0 12px;margin-left:8px;">按当前模型重启</button>
                <span class="settings-feedback" id="voice-local-service-feedback"></span>
              </div>
              <p class="settings-hint">如果当前显示“复用已运行服务”，停止只会取消本应用跟踪，不会强杀其他进程；要切换模型，请先停止旧服务或使用重启。</p>
              <div class="voice-readiness-wizard" id="voice-readiness-wizard" hidden>
                <div class="voice-readiness-head">
                  <div>
                    <strong>一键语音准备</strong>
                    <p class="settings-hint">自动切到本地 SenseVoice、启动本地服务、开启严格唤醒和视频抗干扰；声纹只提示录入，不会替你伪造声纹。</p>
                  </div>
                  <button class="settings-save-btn" id="voice-readiness-apply" type="button">一键准备</button>
                </div>
                <div id="voice-readiness-list" class="voice-readiness-list"></div>
                <span class="settings-feedback" id="voice-readiness-feedback"></span>
              </div>
              <div class="voice-self-test" id="voice-self-test" hidden>
                <div class="voice-readiness-head">
                  <div>
                    <strong>语音实测闭环</strong>
                    <p class="settings-hint">一键准备后，用真实唤醒词验证“唤醒→识别→播报”是否走通。</p>
                  </div>
                  <button class="settings-save-btn" id="voice-self-test-start" type="button">开始实测</button>
                </div>
                <div id="voice-self-test-list" class="voice-readiness-list"></div>
                <span class="settings-feedback" id="voice-self-test-feedback"></span>
              </div>
              <div class="voice-local-doctor" id="voice-local-doctor" hidden>
                <div class="voice-local-doctor-head">
                  <strong>本地语音体检</strong>
                  <button class="settings-save-btn" id="voice-local-doctor-refresh" type="button">刷新体检</button>
                </div>
                <div id="voice-local-doctor-list" class="voice-local-doctor-list"></div>
              </div>
              <p class="settings-hint">v2.1.215 起 ASR 被抽象为 Provider + Profile。当前默认仍是本地 SenseVoiceSmall；识别模式会随本地服务状态一起记录，后续可接 Sherpa/FunASR/更多中文模型。</p>
            </div>
            <div id="voice-cred-aliyun">
              <div class="settings-row">
                <label class="settings-label" for="voice-aliyun-key">阿里云 API Key</label>
                <input class="settings-input" type="password" id="voice-aliyun-key" placeholder="留空则不修改">
              </div>
            </div>
            <div id="voice-cred-tencent" style="display:none;">
              <div class="settings-row">
                <label class="settings-label" for="voice-tencent-sid">SecretId</label>
                <input class="settings-input" type="password" id="voice-tencent-sid" placeholder="留空则不修改">
              </div>
              <div class="settings-row">
                <label class="settings-label" for="voice-tencent-skey">SecretKey</label>
                <input class="settings-input" type="password" id="voice-tencent-skey" placeholder="留空则不修改">
              </div>
              <div class="settings-row">
                <label class="settings-label" for="voice-tencent-appid">AppId</label>
                <input class="settings-input" type="text" id="voice-tencent-appid" placeholder="腾讯云 AppId">
              </div>
            </div>
            <div id="voice-cred-xunfei" style="display:none;">
              <div class="settings-row">
                <label class="settings-label" for="voice-xunfei-appid">AppId</label>
                <input class="settings-input" type="text" id="voice-xunfei-appid" placeholder="讯飞 AppId">
              </div>
              <div class="settings-row">
                <label class="settings-label" for="voice-xunfei-apikey">ApiKey</label>
                <input class="settings-input" type="password" id="voice-xunfei-apikey" placeholder="留空则不修改">
              </div>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-section-label">通用设置</div>
            <div class="settings-row">
              <label class="settings-label" for="voice-lang-select">识别语言</label>
              <select class="settings-select" id="voice-lang-select">
                <option value="zh-CN">中文（普通话）</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-auto-send">识别后自动发送</label>
              <input id="voice-auto-send" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-auto-mic">启动时自动开启麦克风</label>
              <input id="voice-auto-mic" type="checkbox" style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-enabled">启用唤醒词</label>
              <input id="voice-wake-enabled" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-words">唤醒词</label>
              <input class="settings-input" type="text" id="voice-wake-words" placeholder="小龙马，龙马，白龙马">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-detection-provider">唤醒检测方式</label>
              <select class="settings-select" id="voice-wake-detection-provider">
                <option value="text">文本唤醒：ASR 文本匹配（当前稳定）</option>
                <option value="hybrid">混合唤醒：KWS + 文本双保险</option>
                <option value="kws">本地 KWS：关键词模型唤醒</option>
              </select>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-kws-engine">本地 KWS 引擎</label>
              <select class="settings-select" id="voice-kws-engine">
                <option value="none">未启用</option>
                <option value="sherpa-onnx">sherpa-onnx KWS</option>
                <option value="openwakeword">openWakeWord</option>
              </select>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-kws-threshold">KWS 触发阈值</label>
              <input type="range" id="voice-kws-threshold" min="0.10" max="0.99" step="0.01" value="0.50" style="flex:1;cursor:pointer;">
              <span id="voice-kws-threshold-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">0.50</span>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-kws-model-path">KWS 模型路径</label>
              <input class="settings-input" type="text" id="voice-kws-model-path" placeholder="例如 models/kws/longma.onnx；openWakeWord .onnx 优先">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-kws-model-select">本地模型</label>
              <select class="settings-select" id="voice-kws-model-select">
                <option value="">扫描 models/kws 中的 .onnx 模型</option>
              </select>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-kws-import-source">导入模型路径</label>
              <input class="settings-input" type="text" id="voice-kws-import-source" placeholder="/Users/你/Downloads/hey-longma.onnx">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-kws-import-url">下载模型 URL</label>
              <input class="settings-input" type="text" id="voice-kws-import-url" placeholder="https://.../model.onnx">
            </div>
            <div class="settings-row" style="align-items:flex-start;gap:8px;flex-wrap:wrap;">
              <label class="settings-label">KWS 自检</label>
              <button class="settings-button ghost" type="button" id="voice-kws-refresh">检测 KWS</button>
              <button class="settings-button ghost" type="button" id="voice-kws-scan-models">扫描模型</button>
              <button class="settings-button ghost" type="button" id="voice-kws-import-model">导入/下载模型</button>
              <button class="settings-button ghost" type="button" id="voice-kws-install-openwakeword">安装 openWakeWord</button>
              <button class="settings-button ghost" type="button" id="voice-kws-apply-openwakeword">应用 openWakeWord 配置</button>
              <button class="settings-button ghost" type="button" id="voice-kws-record-test">录音自测</button>
              <span id="voice-kws-feedback" class="settings-feedback"></span>
            </div>
            <div id="voice-kws-status" class="voice-readiness-list" style="margin:6px 0 10px;"></div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-mode">文本唤醒匹配模式</label>
              <select class="settings-select" id="voice-wake-mode">
                <option value="strict">严格：必须以唤醒词开头，推荐</option>
                <option value="loose">宽松：句中包含唤醒词即可</option>
              </select>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-window">唤醒后指令窗口</label>
              <input type="range" id="voice-wake-window" min="3" max="30" step="1" value="8" style="flex:1;cursor:pointer;">
              <span id="voice-wake-window-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">8s</span>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-repeat-suppression">抑制重复误识别文本</label>
              <input id="voice-wake-repeat-suppression" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-confidence">唤醒置信度阈值</label>
              <input type="range" id="voice-wake-confidence" min="0.50" max="0.98" step="0.01" value="0.72" style="flex:1;cursor:pointer;">
              <span id="voice-wake-confidence-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">0.72</span>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-min-command">唤醒后最短指令字数</label>
              <input type="range" id="voice-wake-min-command" min="0" max="20" step="1" value="2" style="flex:1;cursor:pointer;">
              <span id="voice-wake-min-command-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">2字</span>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-cooldown">唤醒冷却时间</label>
              <input type="range" id="voice-wake-cooldown" min="0" max="15000" step="100" value="1200" style="flex:1;cursor:pointer;">
              <span id="voice-wake-cooldown-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">1.2s</span>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-require-speaker">声纹开启时唤醒也必须通过声纹</label>
              <input id="voice-wake-require-speaker" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <p class="settings-hint">严格模式更适合视频/聊天环境：必须说“龙马，帮我查天气”。当前稳定路径仍是文本唤醒；openWakeWord 已接入本地语音服务协议，配置模型后可测试。sherpa-onnx 需要完整模型组，未满足时会提示不可用，不会假装可用。</p>
            <div class="settings-row">
              <label class="settings-label" for="voice-speaker-verify">只响应我的声音</label>
              <input id="voice-speaker-verify" type="checkbox" style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label">声纹录入</label>
              <button class="settings-save-btn" id="voice-enroll-speaker" type="button">录入/重录声纹</button>
              <button class="settings-save-btn" id="voice-test-speaker" type="button" style="width:auto;padding:0 12px;margin-left:8px;">测试我的声纹</button>
              <button class="settings-save-btn" id="voice-calibrate-speaker" type="button" style="width:auto;padding:0 12px;margin-left:8px;">校准阈值</button>
              <button class="settings-save-btn" id="voice-clear-speaker" type="button" style="width:auto;padding:0 12px;margin-left:8px;">清除声纹</button>
              <select class="settings-select" id="voice-speaker-backup-select" style="max-width:190px;margin-left:8px;"><option value="">最近备份</option></select>
              <button class="settings-save-btn" id="voice-restore-speaker" type="button" style="width:auto;padding:0 12px;margin-left:8px;">恢复备份</button>
              <span class="settings-feedback" id="voice-speaker-feedback"></span>
            </div>
            <div class="settings-row">
              <label class="settings-label">声纹状态</label>
              <span class="settings-config-info" id="voice-speaker-status">未检测</span>
              <button class="settings-save-btn voice-speaker-status-action" id="voice-speaker-start-service" type="button" hidden>启动服务</button>
              <button class="settings-save-btn voice-speaker-status-action" id="voice-speaker-enroll-shortcut" type="button" hidden>去录入</button>
              <button class="settings-save-btn voice-speaker-status-action" id="voice-speaker-refresh-status" type="button">刷新</button>
            </div>
            <p class="settings-hint">声纹只保存在本机。v2.1.213 起录入时会拆成多段样本求中心声纹，测试按钮会显示当前分数和建议阈值。录入时请在安静环境下连续说 6–8 秒。</p>
            <div class="voice-speaker-calibration" id="voice-speaker-calibration" hidden></div>
            <div class="settings-row">
              <label class="settings-label" for="voice-speaker-threshold">声纹严格度</label>
              <input type="range" id="voice-speaker-threshold" min="0.45" max="0.80" step="0.01" value="0.55" style="flex:1;cursor:pointer;">
              <span id="voice-speaker-threshold-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">0.55</span>
            </div>
            <p class="settings-hint">越低越不容易误拒绝你，越高越严格。建议先用 0.55；如果别人能唤醒再提高到 0.62–0.70。</p>
            <div class="voice-preset-panel" id="voice-stability-presets">
              <div class="voice-preset-head">
                <div>
                  <strong>语音稳定性预设</strong>
                  <p class="settings-hint">一键切换整组参数：唤醒严格度、声纹门槛、视频降音/PTT/AEC 会一起调整。适合先选场景，再微调单项。</p>
                </div>
                <span class="settings-feedback" id="voice-preset-feedback"></span>
              </div>
              <div class="voice-preset-grid" id="voice-preset-list">
                <div class="voice-clients-empty">正在读取推荐预设…</div>
              </div>
            </div>

          </div>


          <div class="settings-section">
            <div class="settings-section-label">视频播放时的语音唤醒</div>
            <p class="settings-hint">三个能力可同时开启：自动降噪/降音量负责“听得见你”，按住说话负责兜底，系统回声消除负责减少播放器声音进入麦克风。</p>
            <div class="settings-row">
              <label class="settings-label" for="voice-video-duck">检测到人声时自动降低/暂停视频</label>
              <input id="voice-video-duck" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-video-ptt">视频播放时启用空格按住说话</label>
              <input id="voice-video-ptt" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-video-aec">启用系统回声消除 AEC</label>
              <input id="voice-video-aec" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-video-duck-level">视频降音目标</label>
              <input type="range" id="voice-video-duck-level" min="0.02" max="0.50" step="0.01" value="0.10" style="flex:1;cursor:pointer;">
              <span id="voice-video-duck-level-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">10%</span>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-video-duck-hold">降音保持时间</label>
              <input type="range" id="voice-video-duck-hold" min="800" max="8000" step="100" value="2200" style="flex:1;cursor:pointer;">
              <span id="voice-video-duck-hold-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">2.2s</span>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-video-duck-sensitivity">人声触发灵敏度</label>
              <input type="range" id="voice-video-duck-sensitivity" min="0.55" max="1.60" step="0.05" value="1.00" style="flex:1;cursor:pointer;">
              <span id="voice-video-duck-sensitivity-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">1.00</span>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-video-preroll">视频/音乐预录音缓存</label>
              <input id="voice-video-preroll" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-video-preroll-ms">预录音时长</label>
              <input type="range" id="voice-video-preroll-ms" min="800" max="4000" step="100" value="2600" style="flex:1;cursor:pointer;">
              <span id="voice-video-preroll-ms-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">2.6s</span>
            </div>
            <div class="settings-row">
              <label class="settings-label">当前降音状态</label>
              <span class="settings-config-info" id="voice-media-duck-status">空闲</span>
            </div>
            <p class="settings-hint">本地 mp4 可直接降音量；YouTube 会尝试通过播放器 API 降音量；Bilibili 等跨域播放器无法稳定调音量时会短暂停/恢复。开启预录音缓存后，视频/音乐播放时会保留最近 0.8–4 秒麦克风音频，检测到近场人声后连同开头一起送入 ASR，减少被视频声盖住时丢掉唤醒词前几个字。</p>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">语音灵敏度</div>
            <p class="settings-hint">调节麦克风触发阈值。越低越灵敏，越高越需要大声说话。默认 0.008。</p>
            <div class="settings-row">
              <label class="settings-label" for="settings-voice-threshold">触发阈值</label>
              <input type="range" id="settings-voice-threshold" min="0.002" max="0.04" step="0.001" value="0.008" style="flex:1;cursor:pointer;">
              <span id="settings-voice-threshold-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">0.008</span>
            </div>
            <div class="voice-mic-meter" id="voice-mic-meter">
              <div class="voice-mic-meter-head">
                <strong>麦克风自检</strong>
                <span id="voice-mic-meter-state">等待麦克风数据</span>
              </div>
              <div class="voice-mic-meter-bar"><i id="voice-mic-meter-bar" style="width:0%"></i><b id="voice-mic-meter-threshold" style="left:20%"></b></div>
              <div class="voice-mic-meter-meta">
                <span>当前 <code id="voice-mic-current">0.000</code></span>
                <span>峰值 <code id="voice-mic-peak">0.000</code></span>
                <span>噪声底 <code id="voice-mic-noise">0.000</code></span>
                <span>阈值 <code id="voice-mic-threshold-label">0.008</code></span>
              </div>
              <div class="voice-mic-meter-actions">
                <button class="voice-readiness-action" id="voice-mic-meter-reset" type="button">重置峰值/噪声底</button>
                <button class="voice-readiness-action" id="voice-mic-threshold-calibrate" type="button">按当前峰值校准阈值</button>
                <span class="settings-feedback" id="voice-mic-meter-advice">打开麦克风后，对着 Mac 说唤醒词，看柱状条是否越过阈值。</span>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-section-label">语音合成（TTS）</div>
            <p class="settings-hint">用语音发消息时，Agent 回复会自动转为语音播放。首选推荐豆包语音合成 2.0（https://console.volcengine.com/speech/new/），也支持 MiniMax、OpenAI、ElevenLabs、火山引擎。</p>
            <div class="settings-row">
              <label class="settings-label" for="tts-provider-select">服务商</label>
              <select class="settings-select" id="tts-provider-select">
                <option value="doubao">豆包（方舟，流式，中文最自然）</option>
                <option value="openai">OpenAI TTS（流式，$0.015/千字）</option>
                <option value="elevenlabs">ElevenLabs（流式，高质量）</option>
                <option value="volcano">火山引擎（中文，有免费额度）</option>
                <option value="minimax">MiniMax（已有配置）</option>
              </select>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="tts-voice-select">声音</label>
              <select class="settings-select" id="tts-voice-select"></select>
            </div>

            <div id="tts-creds-doubao" style="display:none;">
              <div class="settings-row">
                <label class="settings-label" for="tts-doubao-key">API Key</label>
                <input class="settings-input" type="password" id="tts-doubao-key" placeholder="留空则不修改">
              </div>
              <p class="settings-hint">在<a href="https://console.volcengine.com/speech/new/" target="_blank" style="color:var(--cool)">豆包语音合成 2.0 控制台</a>获取 API Key（需先完成实名认证和服务开通）。音色默认使用 seed-tts-2.0。</p>
            </div>

            <div id="tts-creds-minimax" style="display:none;">
              <div class="settings-row">
                <label class="settings-label" for="tts-minimax-key">MiniMax API Key</label>
                <input class="settings-input" type="password" id="tts-minimax-key" placeholder="留空则不修改（可与 LLM 共用）">
              </div>
              <p class="settings-hint">可用声音：male-qn-qingse · male-qn-jingying · female-shaonv · female-yujie · presenter_female 等。</p>
            </div>

            <div id="tts-creds-openai">
              <div class="settings-row">
                <label class="settings-label" for="tts-openai-key">OpenAI API Key</label>
                <input class="settings-input" type="password" id="tts-openai-key" placeholder="留空则不修改（可与 LLM 共用）">
              </div>
              <div class="settings-row">
                <label class="settings-label" for="tts-openai-baseurl">Base URL（选填）</label>
                <input class="settings-input" type="text" id="tts-openai-baseurl" placeholder="自定义端点，如 https://api.deepseek.com">
              </div>
              <p class="settings-hint">可用声音：nova · shimmer · alloy · echo · fable · onyx</p>
            </div>

            <div id="tts-creds-elevenlabs" style="display:none;">
              <div class="settings-row">
                <label class="settings-label" for="tts-elevenlabs-key">ElevenLabs API Key</label>
                <input class="settings-input" type="password" id="tts-elevenlabs-key" placeholder="留空则不修改">
              </div>
              <p class="settings-hint">免费套餐每月 10,000 字符。声音 ID 在 ElevenLabs 控制台获取。</p>
            </div>

            <div id="tts-creds-volcano" style="display:none;">
              <div class="settings-row">
                <label class="settings-label" for="tts-volcano-appid">AppId</label>
                <input class="settings-input" type="text" id="tts-volcano-appid" placeholder="火山引擎 TTS AppId">
              </div>
              <div class="settings-row">
                <label class="settings-label" for="tts-volcano-token">Access Token</label>
                <input class="settings-input" type="password" id="tts-volcano-token" placeholder="留空则不修改">
              </div>
              <p class="settings-hint">可用声音：BV001_streaming（通用女声）· BV002_streaming（通用男声）等，在火山引擎控制台查看全部。</p>
            </div>

            <div class="settings-section-label" style="margin-top:12px;">外部语音客户端限制</div>
            <p class="settings-hint">用于 /voice/events WebSocket 的 tts:speak。外部设备或调试客户端会在 /voice/events/protocol 里读取这些限制，避免误发过长文本或高频请求。</p>
            <div class="settings-row">
              <label class="settings-label" for="tts-speak-max-chars">最大文本字符</label>
              <input class="settings-input" type="number" id="tts-speak-max-chars" min="40" max="3000" step="10" value="800">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="tts-speak-cooldown-ms">单连接冷却 ms</label>
              <input class="settings-input" type="number" id="tts-speak-cooldown-ms" min="0" max="10000" step="100" value="1200">
            </div>

            <div class="settings-row" style="margin-top:8px;">
              <button class="settings-save-btn" id="tts-test-btn" type="button" style="padding:4px 12px;font-size:12px;">试听</button>
              <span id="tts-test-status" style="color:var(--ink2);font-size:12px;margin-left:8px;"></span>
            </div>
          </div>

          <div class="settings-section settings-section-action">
            <button class="settings-save-btn" id="settings-save-voice" type="button">保存</button>
            <span class="settings-feedback" id="settings-voice-feedback"></span>
          </div>
        </div>

        <!-- ── 上网搜索 tab ── -->
        <div class="settings-tab" data-tab="web-search">
          <div class="settings-section">
            <div class="settings-section-label">搜索引擎</div>
            <p class="settings-hint">Agent 调用 web_search 时会按 Serper → SearXNG → Bing → Jina → DuckDuckGo 顺序兜底。Bing 和 DuckDuckGo 不需要配置即可使用；如果你有 Serper / Jina 的 key，质量会显著提升。</p>

            <div class="settings-row">
              <label class="settings-label" for="websearch-serper-key">Serper API Key</label>
              <input class="settings-input" type="password" id="websearch-serper-key" placeholder="留空则不修改">
            </div>
            <p class="settings-hint">在 <a href="https://serper.dev" target="_blank" style="color:var(--cool)">serper.dev</a> 注册后获取（每月 2500 次免费）。Google SERP JSON 接口，最稳定。</p>

            <div class="settings-row">
              <label class="settings-label" for="websearch-jina-key">Jina API Key</label>
              <input class="settings-input" type="password" id="websearch-jina-key" placeholder="留空则不修改">
            </div>
            <p class="settings-hint">在 <a href="https://jina.ai" target="_blank" style="color:var(--cool)">jina.ai</a> 获取（有免费额度）。s.jina.ai 搜索接口，作为 Bing 失效时的额外兜底。</p>

            <div class="settings-row">
              <label class="settings-label" for="websearch-searxng-url">SearXNG URL</label>
              <input class="settings-input" type="text" id="websearch-searxng-url" placeholder="https://your-searxng-instance.com">
            </div>
            <p class="settings-hint">选填。自托管 SearXNG 实例地址（去隐私的元搜索引擎）。要带 http:// 或 https://。</p>
          </div>

          <div class="settings-section">
            <div class="settings-section-label">当前状态</div>
            <div class="settings-config-row">
              <span class="settings-config-type">Serper</span>
              <span class="settings-config-info" id="websearch-status-serper">—</span>
            </div>
            <div class="settings-config-row">
              <span class="settings-config-type">Jina</span>
              <span class="settings-config-info" id="websearch-status-jina">—</span>
            </div>
            <div class="settings-config-row">
              <span class="settings-config-type">SearXNG</span>
              <span class="settings-config-info" id="websearch-status-searxng">—</span>
            </div>
          </div>

          <div class="settings-section settings-section-action">
            <button class="settings-save-btn" id="settings-save-web-search" type="button">保存</button>
            <span class="settings-feedback" id="settings-web-search-feedback"></span>
          </div>
        </div>

        <!-- ── 安全沙箱 tab ── -->
        <div class="settings-tab" data-tab="security">
          <div class="settings-section">
            <div class="settings-section-label">文件沙箱</div>
            <p class="settings-hint">开启后文件读写只允许在 sandbox/ 目录内。关闭后 Agent 可操作系统任意位置的文件，请谨慎使用。</p>
            <div class="settings-row">
              <label class="settings-label" for="security-file-sandbox">启用文件沙箱</label>
              <label class="settings-toggle">
                <input type="checkbox" id="security-file-sandbox" checked>
                <span class="settings-toggle-track"></span>
              </label>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">命令执行沙箱</div>
            <p class="settings-hint">开启后 exec_command 工作目录锁定在 sandbox/，且禁止使用绝对路径和父目录引用。关闭后命令可访问系统任意目录。</p>
            <div class="settings-row">
              <label class="settings-label" for="security-exec-sandbox">启用执行沙箱</label>
              <label class="settings-toggle">
                <input type="checkbox" id="security-exec-sandbox" checked>
                <span class="settings-toggle-track"></span>
              </label>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">工具黑名单</div>
            <p class="settings-hint">勾选后该工具将被拒绝执行，对话中 Agent 调用时会收到"已被安全策略禁用"错误。</p>
            <div class="settings-row"><label class="settings-label"><input type="checkbox" class="security-blocked-tool" value="exec_command"> exec_command &nbsp;<span style="color:var(--ink2);font-size:12px;">（执行 shell 命令）</span></label></div>
            <div class="settings-row"><label class="settings-label"><input type="checkbox" class="security-blocked-tool" value="browser_read"> browser_read &nbsp;<span style="color:var(--ink2);font-size:12px;">（浏览器渲染访问）</span></label></div>
            <div class="settings-row"><label class="settings-label"><input type="checkbox" class="security-blocked-tool" value="fetch_url"> fetch_url &nbsp;<span style="color:var(--ink2);font-size:12px;">（HTTP 请求）</span></label></div>
            <div class="settings-row"><label class="settings-label"><input type="checkbox" class="security-blocked-tool" value="web_search"> web_search &nbsp;<span style="color:var(--ink2);font-size:12px;">（网页搜索）</span></label></div>
            <div class="settings-row"><label class="settings-label"><input type="checkbox" class="security-blocked-tool" value="ui_show"> ui_show &nbsp;<span style="color:var(--ink2);font-size:12px;">（推送 UI 卡片 / 动态代码注入）</span></label></div>
            <div class="settings-row"><label class="settings-label"><input type="checkbox" class="security-blocked-tool" value="ui_register"> ui_register &nbsp;<span style="color:var(--ink2);font-size:12px;">（注册新 UI 组件）</span></label></div>
          </div>
          <div class="settings-section settings-section-action">
            <button class="settings-save-btn" id="settings-save-security" type="button">保存</button>
            <span class="settings-feedback" id="settings-security-feedback"></span>
          </div>
        </div>

        <!-- ── 更新 tab ── -->
        <div class="settings-tab" data-tab="update">
          <div class="settings-section">
            <div class="settings-section-label">版本信息</div>
            <div class="settings-config-row">
              <span class="settings-config-type">当前版本</span>
              <span class="settings-config-info" id="settings-current-version">—</span>
            </div>
            <div class="settings-config-row">
              <span class="settings-config-type">状态</span>
              <span class="settings-config-info" id="settings-update-status">未检查</span>
            </div>
            <div class="settings-row-action" style="margin-top:12px;gap:8px;flex-wrap:wrap;">
              <button class="settings-save-btn" id="settings-check-update-btn" type="button" style="width:auto;padding:0 14px;">检查更新</button>
              <button class="settings-save-btn hidden" id="settings-download-update-btn" type="button" style="width:auto;padding:0 14px;">立即下载</button>
              <button class="settings-save-btn hidden" id="settings-install-update-btn" type="button" style="width:auto;padding:0 14px;">立即重启安装</button>
              <button class="settings-save-btn hidden" id="settings-ignore-update-btn" type="button" style="width:auto;padding:0 14px;background:transparent;border:1px solid var(--line);color:var(--ink2);">忽略此版本</button>
              <span class="settings-feedback" id="settings-update-feedback"></span>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">更新说明</div>
            <div class="release-notes-list">
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.4.0</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">本地 KWS/openWakeWord 唤醒大版本：文本/混合/纯 KWS 唤醒、模型管理、依赖安装、应用配置和录音自测。</p>
                <ul class="release-note-points">
                  <li>新增唤醒检测方式：文本唤醒、混合唤醒、本地 KWS；默认仍保持文本唤醒，不破坏旧路径。</li>
                  <li>openWakeWord 接入本地语音服务，支持 .onnx 模型懒加载、kws_detect 协议、wake:kws 调试事件。</li>
                  <li>设置页支持检测 KWS、安装依赖、扫描 models/kws、导入本地模型、下载 URL 模型、应用配置和录音自测。</li>
                  <li>纯 KWS 模式下必须先命中 KWS 才接受 final ASR 指令，降低视频/他人说话被误当唤醒的问题。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.3.2</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">语音唤醒稳定性补丁版：视频/音乐 pre-roll、调试面板增强、partial ASR 不再绕过唤醒门控自动发送。</p>
                <ul class="release-note-points">
                  <li>视频/音乐播放时保留短暂麦克风环形缓存，检测到近场人声后先 flush 预录音，减少唤醒词开头丢失。</li>
                  <li>语音调试面板新增 VAD/麦克风、唤醒原因、声纹分数、媒体门控和 pre-roll 状态。</li>
                  <li>ASR partial 只用于显示/调试；只有 final 且通过唤醒/声纹门控后才进入正式发送。</li>
                  <li>新增 smoke:voice-panel-gating，保护 partial 不得触发自动发送的不变量。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.3.1</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">Mac Electron 打包部署补丁版：默认构建切到 macOS，补齐 dmg/zip 打包、发布仓库和部署说明。</p>
                <ul class="release-note-points">
                  <li>npm run build 现在默认执行 Mac arm64 打包；新增 build:mac / build:mac:x64 / publish:mac，保留 build:win / publish:win。</li>
                  <li>新增跨平台 prebuild-clean.mjs 和 macOS icon.icns，Mac 构建不再依赖 PowerShell。</li>
                  <li>Electron Builder 发布目标修正到当前维护仓库 xiaoguiwucan/BaiLongma。</li>
                  <li>README、CHANGELOG、备份文档和 Release 规则同步更新，避免长时间堆改动不发版本。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.3.0</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">本地语音稳定性大版本：一键准备、真实自测、服务复用、声纹恢复/校准、隐私诊断包、麦克风自检和阈值校准。</p>
                <ul class="release-note-points">
                  <li>新增本地语音总览、readiness wizard、自测闭环和诊断包，能直接看出下一步该准备、实测、录声纹还是修服务。</li>
                  <li>增强声纹：防锁死、清除、离线清除、备份/恢复、选择备份和阈值校准，降低“录了声纹但本人唤不醒”的风险。</li>
                  <li>新增麦克风自检仪表与触发阈值校准，并把麦克风状态并入总览，用来排查视频盖住声音/阈值不合适。</li>
                  <li>验证通过：smoke:voice-manager 7/7、smoke:voice-events 92/92、smoke:brain-ui。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.2.0</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">小智式语音设备控制台大版本：客户端诊断、事件历史、链路总控、一键自检和设备接入包。</p>
                <ul class="release-note-points">
                  <li>新增 /voice/events/history、summary、check、package 与 onboarding，集中支持 LAN/ESP32 接入排障。</li>
                  <li>Brain UI 语音页新增外部客户端、最近语音事件、语音链路总控、一键自检、生成接入包。</li>
                  <li>smoke:voice-mapping 46/46、smoke:voice-events 49/49、voice-events-client 8/8、brain-ui smoke 通过。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.240</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增 /voice/events/clients 客户端诊断端点，方便排查外部设备连接。</p>
                <ul class="release-note-points">
                  <li>集中返回身份、capabilities、订阅状态和 negotiated 音频模式。</li>
                  <li>/voice/events/protocol 暴露 clients endpoint 和 client_diagnostics 能力。</li>
                  <li>smoke:voice-events 扩展到 41 项，覆盖空列表与已登记客户端。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.239</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增 /voice/events 音频能力协商，client:accepted 返回 negotiated.audioMode。</p>
                <ul class="release-note-points">
                  <li>协议能力新增 audio_negotiation，并在 protocol 暴露 negotiation 元数据。</li>
                  <li>binary_audio 优先协商为 binary，仅 base64_audio 协商为 base64。</li>
                  <li>当前只推荐不自动订阅，smoke:voice-mapping 37 项、smoke:voice-events 39 项通过。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.238</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">增强 voice:events 调试客户端：支持 protocol、身份登记和 capabilities 参数。</p>
                <ul class="release-note-points">
                  <li>listen/speak/cancel 默认发送 client:hello，便于 status 诊断。</li>
                  <li>新增 --client-id、--device、--platform、--capability 和 --no-identify。</li>
                  <li>新增 smoke:voice-events-client，覆盖 CLI 调试链路 8 项。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.237</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">增强外部客户端诊断：client:hello 支持 capabilities，并记录 lastSeenAt。</p>
                <ul class="release-note-points">
                  <li>client:accepted 返回清洗后的 capabilities。</li>
                  <li>/voice/events/status 显示 clientDetails.identity.lastSeenAt。</li>
                  <li>smoke:voice-mapping 增至 33 项，smoke:voice-events 增至 37 项。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.236</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增 /voice/events 外部客户端身份登记，便于 ESP32/调试客户端诊断。</p>
                <ul class="release-note-points">
                  <li>支持 client:hello / client:identify，并返回 client:accepted。</li>
                  <li>/voice/events/status 新增 clientDetails 安全身份摘要。</li>
                  <li>smoke:voice-mapping 增至 31 项，smoke:voice-events 增至 34 项。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.235</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">为 /voice/events tts:speak 增加远端地址级冷却，防止多连接绕过限流。</p>
                <ul class="release-note-points">
                  <li>rate_limited 新增 scope=connection/remote。</li>
                  <li>limits.ttsSpeak 新增 scopes: connection 与 remoteAddress。</li>
                  <li>smoke:voice-mapping 增至 28 项，smoke:voice-events 增至 31 项。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.234</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">为 /voice/events 增加可选 token 鉴权元数据和 WebSocket 访问检查。</p>
                <ul class="release-note-points">
                  <li>WebSocket upgrade 复用现有 BAILONGMA_API_TOKEN / ?token= 机制。</li>
                  <li>/voice/events/protocol 和 hello 新增 auth 元数据，不泄露 token。</li>
                  <li>smoke:voice-mapping 增至 27 项，smoke:voice-events 增至 29 项。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.233</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">把外部语音客户端 tts:speak 限制改为可配置。</p>
                <ul class="release-note-points">
                  <li>设置页新增最大文本字符和单连接冷却 ms。</li>
                  <li>/settings/tts、/voice/events/protocol 和 WebSocket hello 同步 active limits。</li>
                  <li>smoke:voice-mapping 增至 25 项，smoke:voice-events 增至 26 项。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.232</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">为 WebSocket tts:speak 增加文本长度和发送冷却保护。</p>
                <ul class="release-note-points">
                  <li>tts:speak 默认限制 800 字符、同连接 1200ms 冷却。</li>
                  <li>/voice/events/protocol 暴露 limits.ttsSpeak 和 tts_speak_limits 能力。</li>
                  <li>新增 text_too_long / rate_limited protocol_error，并扩展 smoke 覆盖。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.231</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增语音 WebSocket 客户端消息校验和 protocol_error 错误回执。</p>
                <ul class="release-note-points">
                  <li>坏 JSON、未知 type、空 tts:speak 不再静默失败。</li>
                  <li>/voice/events/protocol 新增 protocol_errors 能力和 errorCodes。</li>
                  <li>smoke:voice-mapping 与 smoke:voice-events 均扩展到 20 项。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.230</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增语音事件协议元数据端点，方便小智式外部设备接入前自检能力。</p>
                <ul class="release-note-points">
                  <li>新增 GET /voice/events/protocol，返回版本、能力、端点和消息类型。</li>
                  <li>WebSocket hello/status/protocol 统一复用共享协议常量，减少版本漂移。</li>
                  <li>smoke:voice-mapping 增至 15 项，smoke:voice-events 增至 17 项。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.229</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增事件映射纯函数 smoke，快速保护小智式协议映射。</p>
                <ul class="release-note-points">
                  <li>导出 mapVoiceEventToXiaozhi(event)。</li>
                  <li>新增 scripts/smoke-voice-mapping.mjs。</li>
                  <li>新增 npm run smoke:voice-mapping，覆盖 13 项核心映射。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.228</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">继续增强语音协议 smoke，覆盖完整 TTS lifecycle 映射。</p>
                <ul class="release-note-points">
                  <li>smoke:voice-events 从 11 项扩展到 15 项检查。</li>
                  <li>新增 tts:start、tts:sentence_start、tts:sentence_end、tts:stop 映射断言。</li>
                  <li>保护外部设备播放队列依赖的 TTS 生命周期事件。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.227</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">继续增强语音协议 smoke，覆盖 wake 和 TTS 音频就绪映射。</p>
                <ul class="release-note-points">
                  <li>smoke:voice-events 从 9 项扩展到 11 项检查。</li>
                  <li>新增 wake:accepted 小智式映射断言。</li>
                  <li>新增 tts:audio_ready 小智式映射断言。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.226</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">增强语音 WebSocket smoke，覆盖事件发布桥接和小智式映射。</p>
                <ul class="release-note-points">
                  <li>smoke:voice-events 从 7 项扩展到 9 项检查。</li>
                  <li>新增 POST /voice/events/publish 覆盖。</li>
                  <li>验证 raw voice_event 和小智式 stt final 映射。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.225</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增语音 WebSocket 协议 smoke 测试，保护基础对接行为。</p>
                <ul class="release-note-points">
                  <li>新增 scripts/smoke-voice-events.mjs。</li>
                  <li>新增 npm run smoke:voice-events。</li>
                  <li>自动验证 hello、ping、subscribe、tts:cancel 和 status client 计数。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.224</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增语音 WebSocket 协议文档，方便外部设备接入。</p>
                <ul class="release-note-points">
                  <li>新增 docs/VOICE_EVENTS_PROTOCOL.md。</li>
                  <li>固化 /voice/events v3、tts:speak、tts:cancel 和音频块说明。</li>
                  <li>补充 CLI 调试、ESP32/手机端实现建议和已知限制。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.223</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增语音 WebSocket 调试客户端，方便验证小智式协议。</p>
                <ul class="release-note-points">
                  <li>新增 scripts/voice-events-client.mjs。</li>
                  <li>新增 npm run voice:events。</li>
                  <li>支持 status、listen、speak、cancel，以及音频保存到文件。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.222</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增 WebSocket TTS 取消与 speak 生命周期守卫。</p>
                <ul class="release-note-points">
                  <li>新增 tts:cancel/cancel 消息，可取消当前连接的 active speak。</li>
                  <li>同连接新的 tts:speak 会自动替换旧 speak。</li>
                  <li>连接关闭或出错时自动取消当前 speak，避免旧音频继续生成。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.221</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增 WebSocket tts:speak，外部客户端可直接请求 TTS 并接收音频块。</p>
                <ul class="release-note-points">
                  <li>/voice/events 协议升级到 version 3，并声明 tts_speak 能力。</li>
                  <li>客户端可发送 tts:speak/speak 文本请求。</li>
                  <li>服务端按句返回 session、sentence、audio_ready、audio_chunk、stop 等事件。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.220</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增可选 WebSocket TTS 音频块订阅，向小智式音频帧协议继续推进。</p>
                <ul class="release-note-points">
                  <li>/voice/events hello 升级到 version 2 并声明 tts_audio_chunks 能力。</li>
                  <li>客户端可发送 subscribe audio/binaryAudio 显式订阅音频块。</li>
                  <li>TTS 分句 HTTP 播放时同步广播 audio_start、audio_chunk、audio_end/audio_error。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.219</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增 TTS 分句音频就绪事件，让外部客户端能拿到每段音频 URL。</p>
                <ul class="release-note-points">
                  <li>新增 tts:audio_ready 语音事件。</li>
                  <li>/voice/events 会广播小智式 tts audio_ready JSON。</li>
                  <li>事件包含 sessionId、index、text、url、contentType，为后续 Opus 音频帧做准备。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.218</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增实验性语音 WebSocket 事件通道，支持外部客户端观察小智式生命周期事件。</p>
                <ul class="release-note-points">
                  <li>新增 ws://127.0.0.1:3721/voice/events。</li>
                  <li>新增 /voice/events/status 和 /voice/events/publish。</li>
                  <li>广播原始 voice_event 和小智式 wake/stt/tts/interrupt JSON 消息。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.217</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增小智式语音事件协议，为 WebSocket 语音通道做准备。</p>
                <ul class="release-note-points">
                  <li>新增 bailongma:voice-event 统一事件总线。</li>
                  <li>规范 wake/asr/tts/interrupt/media 事件类型。</li>
                  <li>语音调试面板新增最近事件显示。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.216</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">新增分句式 TTS Session，让 AI 回复按句生成和播放。</p>
                <ul class="release-note-points">
                  <li>新增中文分句器和 TTS Session Manager。</li>
                  <li>新增 <code>/tts/session</code>、单句音频和取消接口。</li>
                  <li>前端 TTS 改为播放队列，用户打断或新回复会取消旧会话。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.215</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">重构 ASR Provider 基础，新增极速/平衡/高精度识别模式。</p>
                <ul class="release-note-points">
                  <li>新增 ASR Provider 元数据模块，集中描述本地/云端 ASR 能力。</li>
                  <li>设置页新增识别模式：极速、平衡、高精度。</li>
                  <li>本地语音服务状态现在会返回 engine/profile/provider summaries，便于后续扩展 Sherpa/FunASR。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.214</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">增强视频播放抗干扰，让唤醒词更容易盖过视频声音。</p>
                <ul class="release-note-points">
                  <li>视频降音触发改为连续帧确认，减少单帧噪声误触发。</li>
                  <li>新增视频降音目标、保持时间和触发灵敏度设置。</li>
                  <li>新增当前降音状态显示，方便调试视频播放时的语音唤醒。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.213</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">增强本地声纹稳定性，减少录入后误拒绝本人声音。</p>
                <ul class="release-note-points">
                  <li>声纹录入升级为多样本中心声纹，兼容旧版单样本声纹文件。</li>
                  <li>新增“测试我的声纹”按钮，显示分数、阈值和样本数量。</li>
                  <li>录入后提供自校准反馈和建议阈值，方便解决本人声音被拒绝的问题。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.212</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">增强小智式唤醒词流程，减少视频和普通聊天误唤醒。</p>
                <ul class="release-note-points">
                  <li>新增严格/宽松唤醒模式，默认严格：必须以唤醒词开头。</li>
                  <li>唤醒后指令窗口改为 3–30 秒可配置，不再固定 8 秒。</li>
                  <li>新增重复误识别文本抑制，降低噪声和视频导致的连续误触发。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.211</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">启动小智式语音改造第一阶段：新增语音状态机、轮次守卫和调试面板。</p>
                <ul class="release-note-points">
                  <li>新增 Voice State Machine，统一 idle/listening/wake/recording/recognizing/thinking/speaking/interrupted/error 状态。</li>
                  <li>新增 roundId、ASR sessionId、TTS sessionId，给后续分句 TTS 和旧音频丢弃打基础。</li>
                  <li>设置页新增小智式语音状态调试面板，便于排查唤醒、声纹、视频抗干扰和打断问题。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.210</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">固化 GitHub Release 备份规则，并新增小智语音架构借鉴研究报告。</p>
                <ul class="release-note-points">
                  <li>明确以后任何版本修改或更新都必须上传 GitHub 并创建 Release。</li>
                  <li>新增 xiaozhi-esp32 研究报告，整理本地唤醒、AFE、Opus 流式音频、声纹和状态机。</li>
                  <li>给出白龙马后续落地路线：pre-roll、KWS、声纹升级、流式 TTS 和统一语音状态机。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.209</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">补齐版本更新记录机制，在文档和设置页加入更新说明。</p>
                <ul class="release-note-points">
                  <li>新增 CHANGELOG.md，集中记录每个版本的更新内容、改变原因和部署注意事项。</li>
                  <li>README 增加版本更新记录入口，备份文档增加每次备份必须更新的清单。</li>
                  <li>设置页更新 tab 增加最近版本摘要，打开软件就能看到当前版本改了什么。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v2.1.208</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">本地语音助手大版本：中文优先 ASR、唤醒词、声纹和视频抗干扰。</p>
                <ul class="release-note-points">
                  <li>默认本地 ASR 改为 SenseVoiceSmall，Whisper 保留为备用模型。</li>
                  <li>新增唤醒词开关、自定义唤醒词、本地声纹录入和声纹严格度设置。</li>
                  <li>新增视频播放场景的自动降音/暂停、空格按住说话和系统 AEC 开关。</li>
                  <li>本地 ASR 增加静音门控、低置信度过滤和重复幻觉文本过滤。</li>
                  <li>新增 Mac 自部署与备份文档，说明模型、虚拟环境和个人数据如何恢复。</li>
                </ul>
              </article>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">通知偏好</div>
            <div class="settings-row">
              <label class="settings-label" for="settings-suppress-updates">不再提醒更新</label>
              <label class="settings-toggle">
                <input type="checkbox" id="settings-suppress-updates">
                <span class="settings-toggle-track"></span>
              </label>
            </div>
            <p class="settings-hint">开启后发现新版本时不会弹出提示卡片，仍可在此处手动检查。</p>
          </div>
          <div class="settings-section" id="settings-ignored-section" style="display:none;">
            <div class="settings-section-label">已忽略的版本</div>
            <div class="settings-row">
              <span class="settings-config-info" id="settings-ignored-version-val">—</span>
              <button class="settings-save-btn" id="settings-clear-ignored-btn" type="button" style="width:auto;padding:0 12px;margin-left:auto;">清除忽略</button>
            </div>
          </div>
        </div>

      </div><!-- /settings-content -->
    </div><!-- /settings-body -->
  </div>
</div>
`;

const createVoicePanel = () => `
<div class="voice-panel" id="voice-panel">
  <canvas id="voice-canvas" width="160" height="160"></canvas>
  <div class="voice-transcript" id="voice-transcript"></div>
</div>
`;

const createVideoPanel = () => `
<div class="video-panel" id="video-panel">
  <div class="media-stage-head">
    <div class="media-stage-title" id="video-title">视频</div>
    <button class="video-exit-btn" id="video-exit-btn" type="button" title="关闭视频">x</button>
  </div>
  <div class="video-surface" id="video-surface">
    <div class="video-backdrop" id="video-backdrop"></div>
    <video id="video-feed" playsinline controls></video>
    <iframe id="video-frame" title="视频播放器" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen hidden></iframe>
    <div class="video-empty" id="video-empty">
      <div class="video-empty-title">无视频源</div>
      <div class="video-open-row">
        <input id="video-url-input" class="video-url-input" type="text" placeholder="粘贴 YouTube / Bilibili / mp4 / webm / 本地视频路径" />
        <button id="video-open-btn" class="video-open-btn" type="button">播放</button>
      </div>
    </div>
  </div>
</div>
`;

const createMusicPanel = () => `
<div class="music-panel" id="music-panel">
  <div class="media-stage-head">
    <div class="media-stage-title" id="music-panel-title">音乐</div>
    <button class="music-exit-btn" id="music-exit-btn" type="button" title="退出音乐模式">×</button>
  </div>
  <div class="music-stage">
    <div class="music-turntable">
      <div class="music-vinyl" id="music-vinyl">
        <div class="music-groove music-groove-1"></div>
        <div class="music-groove music-groove-2"></div>
        <div class="music-groove music-groove-3"></div>
        <div class="music-groove music-groove-4"></div>
        <div class="music-cover" id="music-cover">
          <div class="music-cover-title" id="music-cover-title">♪</div>
          <div class="music-cover-artist" id="music-cover-artist"></div>
        </div>
        <div class="music-spindle"></div>
      </div>
      <div class="music-tonearm-group" id="music-tonearm-group">
        <div class="music-tonearm-pivot"></div>
        <div class="music-arm-shaft"></div>
        <div class="music-headshell">
          <div class="music-stylus"></div>
        </div>
      </div>
    </div>
    <div class="music-lyrics-pane" id="music-lyrics-pane">
      <div class="music-lyrics-scroll" id="music-lyrics-scroll"></div>
      <div class="music-no-lyrics" id="music-no-lyrics" hidden>— 无歌词 —</div>
    </div>
  </div>
  <div class="music-footer">
    <div class="music-meta">
      <div class="music-meta-title" id="music-meta-title">—</div>
      <div class="music-meta-artist" id="music-meta-artist">—</div>
    </div>
    <div class="music-progress-row">
      <span class="music-time" id="music-time-cur">0:00</span>
      <input class="music-seek" id="music-seek" type="range" min="0" max="100" step="0.1" value="0">
      <span class="music-time" id="music-time-total">0:00</span>
    </div>
    <div class="music-controls-row">
      <button class="music-ctrl" id="music-prev" type="button" title="上一首">⏮</button>
      <button class="music-ctrl music-ctrl-play" id="music-play" type="button" title="播放/暂停">▶</button>
      <button class="music-ctrl" id="music-next" type="button" title="下一首">⏭</button>
      <input class="music-vol" id="music-vol" type="range" min="0" max="1" step="0.01" value="0.8" title="音量">
    </div>
  </div>
  <audio id="music-audio" preload="auto"></audio>
</div>
`;

const createImagePanel = () => `
<div class="image-panel" id="image-panel">
  <div class="media-stage-head">
    <div class="media-stage-title" id="image-title">图片</div>
    <button class="image-exit-btn" id="image-exit-btn" type="button" title="关闭图片">x</button>
  </div>
  <div class="image-surface" id="image-surface">
    <img id="image-display" alt="" />
    <div class="image-empty" id="image-empty">无图片源</div>
  </div>
</div>
`;

const createPanelTabs = () => `
<button id="panel-l1-tab" class="panel-tab panel-tab-left" aria-label="切换左面板" title="切换左面板 [ "></button>
<button id="panel-l2-tab" class="panel-tab panel-tab-right" aria-label="切换右面板" title="切换右面板 ] "></button>
`;

export function createBrainUiMarkup() {
  return [
    createGraphStage(),
    createPrimaryPanel(),
    createSecondaryPanel(),
    createConsole(),
    createTooltip(),
    createSettingsModal(),
    createVideoPanel(),
    createMusicPanel(),
    createImagePanel(),
    createHotspotPanel(),
    createPersonCardPanel(),
    createDocPanel(),
  ].join("\n\n");
}

export function renderBrainUiApp(root = document.body) {
  root.dataset.theme = "midnight";
  root.innerHTML = createBrainUiMarkup();
}
