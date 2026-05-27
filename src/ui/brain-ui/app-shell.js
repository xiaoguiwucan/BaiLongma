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
    <button class="hotspot-btn" id="hotspot-btn" title="实时舆情/热点平台 (H)" type="button">热</button>
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
        <button class="settings-nav-item" data-tab="wechat-groups" type="button">微信群助手</button>
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


        <!-- ── 微信群助手 tab ── -->
        <div class="settings-tab" data-tab="wechat-groups">
          <div class="settings-section wechaty-group-settings">
            <div class="settings-section-label">微信群助手（@ 回复）</div>
            <div class="settings-platform-status" id="wechaty-duty-status">○ 未连接</div>
            <p class="settings-hint">先登录微信，再从真实获取到的群列表里勾选允许小白龙响应的群。开启后，只有在被 @ 当前扫码登录微信号时才会调用大模型回复；没有 @ 的群消息只归档，不打扰。</p>
            <div class="wechaty-login-card">
              <div>
                <div class="wechaty-login-title">微信登录状态</div>
                <div class="wechaty-login-sub" id="wechaty-login-sub">未登录。点击“登录/恢复微信”后，如本机没有登录态会显示二维码。</div>
              </div>
              <button class="settings-save-btn" id="wechaty-start-btn" type="button">登录/恢复微信</button>
            </div>
            <div class="wechaty-toolbar">
              <label class="wechaty-master-toggle">
                <input id="wechaty-duty-enabled" type="checkbox" checked>
                <span>启用微信群 @ 回复</span>
              </label>
              <button class="settings-save-btn" id="wechaty-refresh-rooms-btn" type="button">刷新真实群列表</button>
            </div>
            <div class="wechaty-qr-area" id="wechaty-qr-area" style="display:none;">
              <img id="wechaty-qr-img" src="" alt="Wechaty 微信登录二维码">
              <div>用要接入群聊的微信扫码登录；登录成功后会自动获取群列表。</div>
            </div>
            <div class="wechaty-room-tools">
              <input class="settings-input" id="wechaty-room-filter" type="search" placeholder="搜索群名…">
              <span class="wechaty-selected-count" id="wechaty-selected-count">未获取群列表</span>
            </div>
            <div class="wechaty-room-list" id="wechaty-room-list">
              <div class="wechaty-empty">点击“连接/恢复微信”后刷新群列表</div>
            </div>
            <div class="settings-row-action">
              <button class="settings-save-btn" id="wechaty-save-groups-btn" type="button">保存并生效</button>
              <button class="settings-save-btn" id="wechaty-view-memory-btn" type="button">查看群记忆</button>
              <span class="settings-feedback" id="wechaty-duty-feedback"></span>
            </div>
            <div class="wechaty-memory-preview" id="wechaty-memory-preview" hidden></div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">Honcho 群知识库</div>
            <div class="settings-platform-status" id="wechaty-honcho-status">○ 未启用</div>
            <p class="settings-hint">我已经按本机部署给你预填好了：本地地址 http://127.0.0.1:8018，知识库 bailongma-wechat-memory。群记忆只使用 Honcho，不启用本地兜底；每个微信群独立 session，群之间严格隔离。</p>
            <div class="settings-row">
              <label class="settings-label" for="honcho-enabled">启用 Honcho</label>
              <input id="honcho-enabled" type="checkbox" style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="honcho-environment">环境</label>
              <select class="settings-select" id="honcho-environment">
                <option value="local">local · 本地 Honcho</option>
                <option value="demo">demo · 官方测试</option>
                <option value="production">production · 官方生产</option>
              </select>
            </div>
            <div class="settings-row">
              <label class="settings-label" for="honcho-baseurl">Base URL</label>
              <input class="settings-input" id="honcho-baseurl" type="text" placeholder="http://127.0.0.1:8018">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="honcho-apikey">API Key</label>
              <input class="settings-input" id="honcho-apikey" type="password" placeholder="已默认使用 bailongma-local-honcho；留空保持不变">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="honcho-appid">知识库 ID</label>
              <input class="settings-input" id="honcho-appid" type="text" placeholder="bailongma-wechat-memory">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="honcho-appname">App 名称</label>
              <input class="settings-input" id="honcho-appname" type="text" placeholder="BaiLongma WeChat Memory">
            </div>
            <div class="settings-row-action">
              <button class="settings-save-btn" id="honcho-save-btn" type="button">一键启用/保存群知识库</button>
              <span class="settings-feedback" id="honcho-feedback"></span>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">安全黑名单</div>
            <p class="settings-hint">微信群入口默认禁止让大模型执行危险电脑操作。命中后会直接拒绝，只允许解释风险或给安全手动步骤。不包含逆向和成人内容过滤。</p>
            <div class="wechaty-guard-list" id="wechaty-guard-list"></div>
          </div>
        </div>

        <!-- ── 语音 tab ── -->
        <div class="settings-tab" data-tab="voice">
          <div class="settings-section">
            <div class="settings-section-label">语音识别模式</div>
            <div class="settings-row">
              <label class="settings-label" for="voice-provider-select">服务商</label>
              <select class="settings-select" id="voice-provider-select">
                <option value="local">本地模型（默认）</option>
                <option value="aliyun">阿里云百炼（推荐）</option>
                <option value="tencent">腾讯云 ASR</option>
                <option value="xunfei">科大讯飞 RTASR</option>
                <option value="volcengine">火山引擎/豆包 ASR</option>
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
            <div id="voice-cred-volcengine" style="display:none;">
              <p class="settings-hint">火山引擎/豆包流式语音识别。按控制台“服务接口认证信息”填写：APP ID 填到 APP ID，Access Token 填到 Access Token；Secret Key 当前不用填。</p>
              <div class="settings-row">
                <label class="settings-label" for="voice-volcengine-appkey">APP ID</label>
                <input class="settings-input" type="password" id="voice-volcengine-appkey" placeholder="控制台里的 APP ID">
              </div>
              <div class="settings-row">
                <label class="settings-label" for="voice-volcengine-accesskey">Access Token</label>
                <input class="settings-input" type="password" id="voice-volcengine-accesskey" placeholder="控制台里的 Access Token，留空则不修改">
              </div>
              <div class="settings-row">
                <label class="settings-label" for="voice-volcengine-resourceid">Resource ID</label>
                <input class="settings-input" type="text" id="voice-volcengine-resourceid" placeholder="默认 volc.bigasr.sauc.duration">
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
              <label class="settings-label" for="voice-fast-mode">极速语音模式（可打断 / 快速播报）</label>
              <input id="voice-fast-mode" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-enabled">启用唤醒词</label>
              <input id="voice-wake-enabled" type="checkbox" checked style="width:auto;flex:none;">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="voice-wake-words">唤醒词</label>
              <input class="settings-input" type="text" id="voice-wake-words" placeholder="贾维斯，Jarvis，小龙马，龙马，白龙马">
            </div>
            <p class="settings-hint">启用后，普通说话/视频声音会被忽略；只有识别到唤醒词才会把指令发送给助手。可以说“贾维斯，关闭视频”或“龙马，帮我查天气”；只说唤醒词后 8 秒内继续说指令也可以。</p>
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
            <p class="settings-hint">本地 mp4 可直接降音量；YouTube 会尝试通过播放器 API 降音量；Bilibili 等跨域播放器无法稳定调音量时会短暂停/恢复。</p>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">语音灵敏度</div>
            <p class="settings-hint">调节麦克风触发阈值。越低越灵敏，越高越需要大声说话。默认 0.008。</p>
            <div class="settings-row">
              <label class="settings-label" for="settings-voice-threshold">触发阈值</label>
              <input type="range" id="settings-voice-threshold" min="0.002" max="0.04" step="0.001" value="0.008" style="flex:1;cursor:pointer;">
              <span id="settings-voice-threshold-val" style="min-width:3.5em;text-align:right;color:var(--ink2);font-size:13px;">0.008</span>
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
                  <span class="release-note-version">v0.3.3</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">关闭行为修复：点击主窗口关闭按钮会彻底退出，不再只是隐藏到菜单栏。</p>
                <ul class="release-note-points">
                  <li>主窗口 close 不再拦截为 hide，避免用户以为关闭了但后台仍运行。</li>
                  <li>关闭最后一个窗口后调用 app.quit，菜单栏图标和后台服务会一起退出。</li>
                  <li>菜单栏“显示主界面 / 退出”仍保留，运行时可继续手动操作。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.2</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群登录态修复：扫码态写入 userData，正常重启后优先自动恢复。</p>
                <ul class="release-note-points">
                  <li>显式挂载 Wechaty MemoryCard，避免登录态写到项目临时目录。</li>
                  <li>正常 stop/restart 不再主动删除 PUPPET-WECHAT4U 登录数据。</li>
                  <li>状态接口新增 login_memory 诊断信息，区分真实在线和历史群列表快照。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.1</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群 @ 修复：只要微信元数据确认 @ 当前登录账号，就必须回复，不再看昵称关键词。</p>
                <ul class="release-note-points">
                  <li>修复群里 @ 后仍回复“没叫我，跳过”的问题。</li>
                  <li>移除固定昵称/唤醒词绑定，进群改名、改微信昵称、改备注都不影响 @ 回复。</li>
                  <li>send_message 和 fallback 增加保护，禁止把错误跳过文本发回微信群。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.0</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群助手里程碑版：扫码登录、多群勾选、群里 @ 后调用大模型回复，并加入 Honcho 群知识库入口。</p>
                <ul class="release-note-points">
                  <li>新增独立“微信群助手”设置页，登录状态、群列表和已选群组都显示真实运行状态。</li>
                  <li>修复保存群组后 Wechaty 掉线、@ 后无响应、以及测试话术硬编码回复的问题。</li>
                  <li>群消息 @ 登录账号后会进入 LLM，并 @ 原提问人回复，避免暴露内部 ID。</li>
                  <li>新增 Honcho 群知识库配置和预览入口，每个微信群独立 session，避免记忆串群。</li>
                  <li>新增微信群高危指令黑名单，默认拒绝删除文件、外传密钥、执行命令、支付转账等危险请求。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.2.0</span>
                  <span class="release-note-date">2026-05-27</span>
                </div>
                <p class="release-note-summary">小智式语音会话状态机：每轮语音独立 turn，旧回调不再串入新一轮。</p>
                <ul class="release-note-points">
                  <li>新增 voiceTurnId 全链路隔离，覆盖语音输入、LLM 流式输出和 TTS 队列。</li>
                  <li>新增统一 abortSpeaking 打断控制，新一轮语音开始会取消旧播报。</li>
                  <li>设置页保持简洁，不新增复杂参数。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.1.1</span>
                  <span class="release-note-date">2026-05-27</span>
                </div>
                <p class="release-note-summary">修复语音输入不回复、以及下一次识别带上上一轮内容的问题。</p>
                <ul class="release-note-points">
                  <li>语音识别结果发送后会立刻清空缓存和自动发送计时器。</li>
                  <li>本地语音输入统一走 voice 通道，避免被错当成 TUI/外部消息。</li>
                  <li>语音通道默认直接回复正文，由运行时负责显示和播报。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.1.0</span>
                  <span class="release-note-date">2026-05-26</span>
                </div>
                <p class="release-note-summary">小智式极速语音交互内核：更快开口、分句播报、可打断。</p>
                <ul class="release-note-points">
                  <li>语音通道下，LLM 正式回答会边生成边按句触发 TTS，不再等整段回答结束。</li>
                  <li>TTS 改为队列式分句播放，用户打断时会取消后续队列和正在请求的语音。</li>
                  <li>设置页新增“极速语音模式”开关，默认开启，可随时回退整段播报。</li>
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
                <p class="release-note-summary">本地语音助手大版本：中文优先 ASR、唤醒词和视频抗干扰。</p>
                <ul class="release-note-points">
                  <li>默认本地 ASR 改为 SenseVoiceSmall，Whisper 保留为备用模型。</li>
                  <li>新增唤醒词开关、自定义唤醒词和视频抗干扰设置。</li>
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
