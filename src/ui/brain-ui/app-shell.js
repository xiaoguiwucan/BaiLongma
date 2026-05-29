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
        <button class="settings-nav-item" data-tab="database" type="button">数据库</button>
        <button class="settings-nav-item" data-tab="skills" type="button">Skill 技能</button>
        <button class="settings-nav-item" data-tab="voice" type="button">语音识别</button>
        <button class="settings-nav-item" data-tab="web-search" type="button">网络能力</button>
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
            <p class="settings-hint">可以配置多个 LLM 模型。当前模型没额度、限流、认证失败或服务异常时，会按优先级自动切换到下一个可用模型。</p>
            <div class="llm-active-strip" id="settings-llm-current-profile">当前使用：—</div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">自动切换策略</div>
            <div class="llm-failover-panel">
              <label class="llm-failover-toggle">
                <input id="settings-llm-failover-enabled" type="checkbox">
                <span>
                  <b>额度不足/限流时自动切换备用模型</b>
                  <em>推荐开启。只在回答尚未输出时切换，避免重复播报和内容断裂。</em>
                </span>
              </label>
              <div class="settings-row compact">
                <label class="settings-label" for="settings-llm-failover-cooldown">失败冷却</label>
                <select class="settings-select" id="settings-llm-failover-cooldown">
                  <option value="60">1 分钟</option>
                  <option value="180">3 分钟（推荐）</option>
                  <option value="300">5 分钟</option>
                  <option value="600">10 分钟</option>
                </select>
                <label class="settings-label" for="settings-llm-failover-attempts">最多尝试</label>
                <select class="settings-select" id="settings-llm-failover-attempts">
                  <option value="2">2 个模型</option>
                  <option value="3">3 个模型</option>
                  <option value="4">4 个模型（推荐）</option>
                  <option value="6">6 个模型</option>
                </select>
              </div>
              <div class="settings-row-action">
                <button class="settings-save-btn" id="settings-save-llm-failover" type="button">保存策略</button>
                <span class="settings-feedback" id="settings-llm-failover-feedback"></span>
              </div>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">渠道连通通知</div>
            <p class="settings-hint">定时检测你选择的 LLM 渠道是否还能连通，并按策略把结果发到指定微信群；每个通知群都可以继续选择要 @ 的群成员。检测只发一个极短 ping，不会泄露 API Key。</p>
            <div class="llm-monitor-panel">
              <div class="llm-monitor-head">
                <label class="llm-failover-toggle">
                  <input id="settings-llm-monitor-enabled" type="checkbox">
                  <span>
                    <b>启用 LLM 渠道连通通知</b>
                    <em>建议选择“异常/恢复变化通知”，避免群里被正常巡检刷屏。</em>
                  </span>
                </label>
                <div class="llm-monitor-status" id="settings-llm-monitor-status">尚未检测</div>
              </div>
              <div class="llm-monitor-controls">
                <label>通知间隔
                  <select class="settings-select llm-monitor-select" id="settings-llm-monitor-interval">
                    <option value="5">每 5 分钟</option>
                    <option value="15">每 15 分钟</option>
                    <option value="30">每 30 分钟</option>
                    <option value="60">每 1 小时（推荐）</option>
                    <option value="180">每 3 小时</option>
                    <option value="360">每 6 小时</option>
                    <option value="720">每 12 小时</option>
                    <option value="1440">每天一次</option>
                  </select>
                </label>
                <label>通知策略
                  <select class="settings-select llm-monitor-select" id="settings-llm-monitor-mode">
                    <option value="changes">异常/恢复变化通知（推荐）</option>
                    <option value="failures">只通知不通渠道</option>
                    <option value="all">每次检测都通知</option>
                  </select>
                </label>
              </div>
              <div class="llm-monitor-picker-grid">
                <div class="llm-monitor-picker">
                  <div class="llm-monitor-picker-head"><b>选择检测渠道</b><span id="settings-llm-monitor-profile-count">—</span></div>
                  <div class="llm-monitor-list" id="settings-llm-monitor-profile-list">
                    <div class="llm-profile-empty">正在读取模型池…</div>
                  </div>
                </div>
                <div class="llm-monitor-picker">
                  <div class="llm-monitor-picker-head"><b>选择通知微信群</b><span id="settings-llm-monitor-group-count">—</span></div>
                  <div class="llm-monitor-list" id="settings-llm-monitor-group-list">
                    <div class="llm-profile-empty">先登录/恢复微信群助手后选择通知群。</div>
                  </div>
                </div>
              </div>
              <div class="llm-monitor-result" id="settings-llm-monitor-result">检测结果会显示在这里。</div>
              <div class="settings-row-action">
                <button class="settings-save-btn" id="settings-save-llm-monitor" type="button">保存通知设置</button>
                <button class="settings-save-btn" id="settings-test-llm-monitor" type="button">立即检测</button>
                <button class="settings-save-btn primary" id="settings-notify-llm-monitor" type="button">立即检测并通知</button>
                <span class="settings-feedback" id="settings-llm-monitor-feedback"></span>
              </div>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">新增 / 编辑模型</div>
            <input id="settings-llm-editing-id" type="hidden" value="">
            <div class="settings-row">
              <label class="settings-label" for="settings-llm-profile-name">名称</label>
              <input class="settings-input" id="settings-llm-profile-name" type="text" placeholder="如：主力 DeepSeek、备用 Qwen、公司 OpenAI">
            </div>
            <div class="settings-row">
              <label class="settings-label" for="settings-provider-select">提供商</label>
              <select class="settings-select" id="settings-provider-select">
                <option value="auto">自动识别</option>
                <option value="deepseek">DeepSeek</option>
                <option value="minimax">MiniMax</option>
                <option value="openai">OpenAI</option>
                <option value="qwen">Qwen / 阿里百炼</option>
                <option value="moonshot">Moonshot</option>
                <option value="zhipu">智谱</option>
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
              <input class="settings-input" id="settings-llm-key" type="password" placeholder="新增必填；编辑时留空表示继续使用原 Key" autocomplete="new-password">
            </div>
            <div class="settings-row-action">
              <button class="settings-save-btn" id="settings-save-llm" type="button">保存到模型池</button>
              <button class="settings-save-btn" id="settings-save-llm-current" type="button">保存并设为当前</button>
              <span class="settings-feedback" id="settings-llm-feedback"></span>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-label">模型池优先级</div>
            <p class="settings-hint">排在上面的优先使用。关闭某个模型后不会参与自动切换；点击“设为当前”可立即切过去。</p>
            <div class="llm-profile-list" id="settings-llm-pool-list">
              <div class="llm-profile-empty">还没有模型配置，先在上方添加一个。</div>
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


        <!-- ── 数据库 tab ── -->
        <div class="settings-tab" data-tab="database">
          <div class="settings-section database-settings">
            <div class="settings-section-label">数据库与知识库容量</div>
            <p class="settings-hint">这里集中查看本地数据库、微信群聊天记录、知识库记忆和媒体文件占用。微信群助手页只保留连接与回复设置，数据管理统一放到这里。</p>
            <div class="db-hero-card">
              <div>
                <small>总占用</small>
                <strong id="db-total-size">—</strong>
                <span id="db-path-hint">正在读取本机数据库…</span>
              </div>
              <div class="db-hero-actions"><button class="settings-save-btn primary" id="db-refresh-btn" type="button">刷新容量</button><button class="settings-save-btn" id="db-vector-backfill-btn" type="button">补齐向量</button><button class="settings-save-btn" id="db-memory-extract-btn" type="button">提取成员记忆</button><button class="settings-save-btn" id="db-honcho-sync-btn" type="button">同步 Honcho</button><button class="settings-save-btn" id="db-export-all-btn" type="button">导出备份 JSON</button><label class="settings-save-btn"><input id="db-import-file" type="file" accept="application/json" hidden>导入 JSON</label></div>
            </div>
            <div class="db-health-grid" id="db-health-grid"></div>
            <div class="db-overview-grid" id="db-overview-grid">
              <div class="wechaty-empty">正在加载数据库统计…</div>
            </div>
            <div class="db-image-panel">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">微信群图片解析库</div>
                  <p class="settings-hint compact">所有已接入微信群收到的图片会自动入库并后台识图；这里可以实时查看解析进度、筛选图片、浏览缩略图和识图内容。</p>
                </div>
                <div class="db-image-actions">
                  <button class="settings-save-btn primary" id="db-image-refresh-btn" type="button">刷新图片库</button>
                  <button class="settings-save-btn" id="db-image-process-btn" type="button">解析待处理</button>
                </div>
              </div>
              <div class="db-image-progress" id="db-image-progress">
                <div class="wechaty-empty">正在读取图片解析状态…</div>
              </div>
              <div class="db-image-filters">
                <label>群组
                  <select class="settings-select" id="db-image-group"></select>
                </label>
                <label>解析状态
                  <select class="settings-select" id="db-image-status">
                    <option value="">全部状态</option>
                    <option value="done">已解析</option>
                    <option value="pending">待解析</option>
                    <option value="running">解析中</option>
                    <option value="error">解析失败</option>
                    <option value="no_model">无可用模型</option>
                  </select>
                </label>
                <label>关键词
                  <input class="settings-input" id="db-image-query" placeholder="搜 newapi、截图文字、图片描述、文件名">
                </label>
                <label>发送人
                  <input class="settings-input" id="db-image-sender" placeholder="搜昵称/备注/sender_id">
                </label>
                <label>开始时间
                  <input class="settings-input" id="db-image-from" type="datetime-local">
                </label>
                <label>结束时间
                  <input class="settings-input" id="db-image-to" type="datetime-local">
                </label>
                <div class="db-image-filter-actions">
                  <button class="settings-save-btn primary" id="db-image-search-btn" type="button">查询图片</button>
                  <button class="settings-save-btn ghost" id="db-image-reset-btn" type="button">重置筛选</button>
                </div>
              </div>
              <div class="db-image-summary" id="db-image-summary">—</div>
              <div class="db-image-list" id="db-image-list">
                <div class="wechaty-empty">正在加载图片…</div>
              </div>
              <div class="wechaty-records-more">
                <button class="settings-save-btn ghost" id="db-image-more-btn" type="button" style="display:none;">加载更多图片</button>
              </div>
            </div>
            <div class="db-member-panel" id="db-member-panel"></div>
            <div class="db-search-panel">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">聊天记录 / 长期记忆混合搜索</div>
                  <p class="settings-hint compact">同时搜微信群逐条聊天记录和长期记忆；未配置云端 embedding 时自动使用本地轻量向量兜底，不会因为 Honcho 不通而失忆。</p>
                </div>
              </div>
              <div class="db-search-row">
                <input class="settings-input" id="db-search-input" placeholder="输入要查的关键词、人物、梗或历史问题">
                <button class="settings-save-btn primary" id="db-search-btn" type="button">查询</button>
              </div>
              <div class="db-search-results" id="db-search-results"></div>
            </div>
            <div class="db-table-panel">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">表级明细</div>
                  <p class="settings-hint compact">按估算占用从大到小排列；SQLite 的 WAL/SHM 与媒体文件会计入总占用。</p>
                </div>
              </div>
              <div class="db-table-list" id="db-table-list"></div>
            </div>
            <span class="settings-feedback" id="db-feedback"></span>
          </div>
        </div>

        <!-- ── Skill 技能 tab ── -->
        <div class="settings-tab" data-tab="skills">
          <div class="settings-section">
            <div class="settings-section-label">Skill 技能管理</div>
            <p class="settings-hint">这里管理可被微信群 @ 触发的技能。第一个技能「生图」会在群友 @ 助手并明确要求生成图片时直接调用图片模型，不额外添加预制提示词。</p>
            <div class="wechaty-meme-panel">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">生图 Skill</div>
                  <p class="settings-hint">触发：微信群里 @ 助手并要求“生成图片 / 生图 / 画图”。默认低质量 1024×1024 以提高速度；用户明确要求高清、2K、4K、8K 时使用高质量参数。每人每小时最多 10 张。</p>
                </div>
                <span class="settings-platform-status" id="skill-image-status">○ 未配置</span>
              </div>
              <label class="wechaty-master-toggle">
                <input id="skill-image-enabled" type="checkbox" checked>
                <span>启用生图 Skill</span>
              </label>
              <div class="wechaty-meme-grid">
                <label>Base URL
                  <input class="settings-input" id="skill-image-baseurl" type="text" placeholder="https://sub.pbopenai.cloud/v1">
                </label>
                <label>模型
                  <select class="settings-select" id="skill-image-model"></select>
                </label>
                <label>API Key
                  <input class="settings-input" id="skill-image-key" type="password" placeholder="留空则不覆盖已保存密钥">
                </label>
                <label>每人每小时上限
                  <select class="settings-select" id="skill-image-limit">
                    <option value="5">5 张</option>
                    <option value="10">10 张（推荐）</option>
                    <option value="20">20 张</option>
                  </select>
                </label>
                <label>API 超时
                  <select class="settings-select" id="skill-image-timeout">
                    <option value="120">120 秒</option>
                    <option value="180">180 秒（推荐）</option>
                    <option value="240">240 秒</option>
                    <option value="300">300 秒</option>
                  </select>
                </label>
                <label>默认质量
                  <select class="settings-select" id="skill-image-default-quality">
                    <option value="low">low（最快）</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="auto">auto</option>
                  </select>
                </label>
                <label>高清质量
                  <select class="settings-select" id="skill-image-high-quality">
                    <option value="high">high（推荐）</option>
                    <option value="medium">medium</option>
                    <option value="auto">auto</option>
                  </select>
                </label>
              </div>
              <div class="settings-row-action">
                <button class="settings-save-btn primary" id="skill-image-save-btn" type="button">保存生图 Skill</button>
                <button class="settings-save-btn" id="skill-image-add-channel-btn" type="button">新增生图渠道</button>
                <span class="settings-feedback" id="skill-image-feedback"></span>
              </div>
              <div class="wechaty-subsection-head" style="margin-top:14px;">
                <div>
                  <div class="wechaty-subsection-title">生图模型渠道池</div>
                  <p class="settings-hint compact">可配置多个 OpenAI 兼容图片模型渠道；默认渠道失败时会自动切换到下一个已启用渠道。</p>
                </div>
              </div>
              <div class="wechaty-member-list" id="skill-image-channel-list"></div>
              <p class="settings-hint compact">密钥只保存在本机配置，不会在页面回显，也不会提交到 GitHub。微信群生成失败或 API 调用失败时会 @ 提问人反馈原因。</p>
            </div>

            <div class="wechaty-meme-panel">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">识图 Skill</div>
                  <p class="settings-hint">微信群收到图片后保存文件与 base64，并用多模态/GPT 模型生成中文描述和标签。以后即使当前聊天模型不是多模态，也会把图片描述作为知识库上下文注入。</p>
                </div>
                <span class="settings-platform-status" id="skill-vision-status">○ 未检测</span>
              </div>
              <label class="wechaty-master-toggle">
                <input id="skill-vision-enabled" type="checkbox" checked>
                <span>启用微信群识图与图片记忆</span>
              </label>
              <label class="wechaty-master-toggle">
                <input id="skill-vision-prefer-current" type="checkbox" checked>
                <span>当前 LLM 是多模态模型时优先直接使用当前模型</span>
              </label>
              <div class="wechaty-meme-grid">
                <label>备用 GPT Base URL
                  <input class="settings-input" id="skill-vision-baseurl" type="text" placeholder="https://sub.pbopenai.cloud/v1">
                </label>
                <label>备用识图模型
                  <select class="settings-select" id="skill-vision-model"></select>
                </label>
                <label>备用 API Key
                  <input class="settings-input" id="skill-vision-key" type="password" placeholder="留空则复用生图 Key / 已保存 Key">
                </label>
                <label>识图超时
                  <select class="settings-select" id="skill-vision-timeout">
                    <option value="30">30 秒</option>
                    <option value="45">45 秒（推荐）</option>
                    <option value="60">60 秒</option>
                    <option value="90">90 秒</option>
                  </select>
                </label>
              </div>
              <div class="settings-row-action">
                <button class="settings-save-btn primary" id="skill-vision-save-btn" type="button">保存识图 Skill</button>
                <button class="settings-save-btn" id="skill-vision-add-channel-btn" type="button">新增识图渠道</button>
                <button class="settings-save-btn" id="skill-vision-refresh-btn" type="button">刷新状态</button>
                <span class="settings-feedback" id="skill-vision-feedback"></span>
              </div>
              <div class="wechaty-subsection-head" style="margin-top:14px;">
                <div>
                  <div class="wechaty-subsection-title">识图模型渠道池</div>
                  <p class="settings-hint compact">可配置多个多模态模型渠道；当前渠道超时/503/返回空时会自动尝试下一个渠道。</p>
                </div>
              </div>
              <div class="wechaty-member-list" id="skill-vision-channel-list"></div>
              <p class="settings-hint compact" id="skill-vision-counts">图片入库：—</p>
            </div>
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
              <div class="wechaty-login-actions">
                <button class="settings-save-btn" id="wechaty-start-btn" type="button">登录/恢复微信</button>
                <button class="settings-save-btn danger" id="wechaty-relogin-btn" type="button">强制重新扫码</button>
              </div>
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
              <div>用要接入群聊的微信扫码登录；登录成功后会自动获取群列表。二维码如果过期，请点“强制重新扫码”。</div>
            </div>
            <div class="wechaty-offline-notify-card">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">掉线二维码自动通知</div>
                  <p class="settings-hint compact">监控微信群助手真实在线状态；掉线并生成登录二维码后，会通过「社交媒体 → 微信 ClawBot（个人微信）」发送到 ClawBot 自己，不需要选择联系人。请确保 ClawBot 微信账号与进群回复的微信群助手账号不是同一个。</p>
                </div>
                <span class="wechaty-offline-notify-state" id="wechaty-offline-qr-notify-status">—</span>
              </div>
              <label class="wechaty-master-toggle">
                <input id="wechaty-offline-qr-notify-enabled" type="checkbox" checked>
                <span>掉线后自动用 ClawBot 发送登录二维码</span>
              </label>
              <label class="wechaty-master-toggle">
                <input id="wechaty-offline-qr-notify-autorelogin" type="checkbox" checked>
                <span>离线且暂无二维码时自动重新生成二维码</span>
              </label>
              <div class="wechaty-offline-notify-controls">
                <label>重复通知间隔
                  <select class="settings-select" id="wechaty-offline-qr-notify-cooldown">
                    <option value="5">5 分钟</option>
                    <option value="10">10 分钟</option>
                    <option value="15">15 分钟（推荐）</option>
                    <option value="30">30 分钟</option>
                    <option value="60">60 分钟</option>
                  </select>
                </label>
              </div>
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
              <span class="settings-feedback" id="wechaty-duty-feedback"></span>
            </div>
            <div class="wechaty-admin-panel">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">管理员模式（昵称选择，底层精确 ID）</div>
                  <p class="settings-hint">界面按微信昵称选择和显示，底层仍只保存 Wechaty sender_id 精确识别管理员；昵称改名或自称管理员都不会获得权限。</p>
                </div>
                <button class="settings-save-btn subtle" id="wechaty-refresh-admin-members-btn" type="button">刷新昵称</button>
              </div>
              <label class="wechaty-master-toggle wechaty-admin-toggle">
                <input id="wechaty-admin-enabled" type="checkbox">
                <span>启用管理员模式</span>
              </label>
              <input class="settings-input wechaty-admin-search" id="wechaty-admin-search" type="search" placeholder="搜索微信昵称，点成员卡片即可加入管理员…">
              <div class="wechaty-admin-editor">
                <textarea class="settings-textarea" id="wechaty-admin-ids" rows="4" readonly placeholder="这里显示已选管理员昵称。请从下方成员列表点击添加/取消，底层会自动保存精确 ID。"></textarea>
                <div class="wechaty-admin-side">
                  <button class="settings-save-btn primary" id="wechaty-save-admins-btn" type="button">保存管理员</button>
                  <span class="settings-feedback" id="wechaty-admin-feedback"></span>
                  <small>安全规则：页面显示昵称方便操作；真正授权仍是后台保存的精确 sender_id，昵称相同也不会误授权。</small>
                </div>
              </div>
              <div class="wechaty-admin-members" id="wechaty-admin-members">
                <div class="wechaty-empty">登录并刷新昵称后，这里会按微信昵称显示群成员，可一键加入管理员。</div>
              </div>
            </div>

            <div class="wechaty-meme-panel">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">AI 斗图表情包</div>
                  <p class="settings-hint">接入慕名 API 表情搜索：群友 @ 后要求斗图/表情包/梗图时，AI 可搜索公开网络图片或 GIF 并发送到群里；不读取、不上传任何本机文件。</p>
                </div>
                <button class="settings-save-btn subtle" id="wechaty-test-meme-btn" type="button">测试搜索</button>
              </div>
              <label class="wechaty-master-toggle">
                <input id="wechaty-meme-enabled" type="checkbox" checked>
                <span>启用 AI 斗图</span>
              </label>
              <div class="wechaty-meme-grid">
                <label>表情源
                  <select class="settings-select" id="wechaty-meme-provider">
                    <option value="xiaoapi">慕名 API / xiaoapi</option>
                  </select>
                </label>
                <label>每次最多发送
                  <select class="settings-select" id="wechaty-meme-max">
                    <option value="1">1 张（推荐）</option>
                    <option value="2">2 张</option>
                    <option value="3">3 张</option>
                  </select>
                </label>
                <label>冷却时间
                  <select class="settings-select" id="wechaty-meme-cooldown">
                    <option value="15">15 秒</option>
                    <option value="30">30 秒（推荐）</option>
                    <option value="60">60 秒</option>
                    <option value="120">120 秒</option>
                  </select>
                </label>
                <label>测试关键词
                  <input class="settings-input" id="wechaty-meme-test-query" type="text" value="鄙视" placeholder="例如：无语、笑死、吃瓜">
                </label>
              </div>
              <div class="wechaty-meme-preview" id="wechaty-meme-preview">
                <div class="wechaty-empty">输入关键词后点击“测试搜索”，这里会显示将要发送的网络图片/GIF。</div>
              </div>
              <div class="settings-row-action">
                <button class="settings-save-btn primary" id="wechaty-save-meme-btn" type="button">保存斗图设置</button>
                <span class="settings-feedback" id="wechaty-meme-feedback"></span>
              </div>
              <p class="settings-hint compact">安全规则：只允许 HTTPS 公开图片/GIF，默认白名单域名为 biaoqing.gtimg.com 和 tugelepic.mse.sogou.com；本机文件、桌面图片、截图、相册、file:// 一律禁止发送。</p>
            </div>
            <div class="wechaty-persona-panel">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">微信群助手性格设定</div>
                  <p class="settings-hint">先选一个预设，再按需要微调。这里不会包含网页微信 DOM、浏览器脚本等旧项目流程；保存后会注入当前 Wechaty + Honcho 群回复 prompt。</p>
                </div>
                <button class="settings-save-btn subtle" id="wechaty-persona-reset-btn" type="button">恢复默认</button>
              </div>
              <div class="wechaty-persona-presets" id="wechaty-persona-presets">
                <div class="wechaty-empty">正在读取性格预设…</div>
              </div>
              <div class="wechaty-persona-current" id="wechaty-persona-current">
                <span class="wechaty-persona-current-label">当前生效</span>
                <b id="wechaty-persona-current-name">—</b>
                <em id="wechaty-persona-current-state">读取中</em>
              </div>
              <div class="wechaty-persona-editor-head">
                <span>当前提示词</span>
                <small id="wechaty-persona-active">未选择预设，可手动编辑</small>
              </div>
              <textarea class="settings-textarea wechaty-persona-textarea" id="wechaty-persona-prompt" rows="9" placeholder="例如：你是小白龙，回复要简洁、靠谱、有一点幽默；重要事情先给结论，再给步骤。"></textarea>
              <div class="wechaty-persona-actions">
                <button class="settings-save-btn primary" id="wechaty-save-persona-btn" type="button">保存性格并生效</button>
                <span class="settings-feedback" id="wechaty-persona-feedback"></span>
              </div>
              <p class="settings-hint compact">保存规则：点击预设只会填入上方文本，不会立刻生效；确认后点击“保存性格并生效”或上方“保存并生效”。危险电脑操作仍由安全黑名单强制拦截，性格设定不能绕过。</p>
            </div>
            <div class="wechaty-memory-manager" id="wechaty-memory-manager">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">Honcho 群记忆管理</div>
                  <p class="settings-hint">按微信群隔离显示：左侧选择群，右侧查看 Honcho 原始消息、自动总结、长期结论。这里不使用本地兜底记忆。</p>
                </div>
                <div class="wechaty-memory-actions">
                  <button class="settings-save-btn" id="wechaty-refresh-memory-btn" type="button">刷新记忆</button>
                  <button class="settings-save-btn danger" id="wechaty-clear-group-memory-btn" type="button">清空本群</button>
                </div>
              </div>
              <div class="wechaty-memory-grid">
                <div class="wechaty-memory-groups" id="wechaty-memory-groups">
                  <div class="wechaty-empty">先获取并勾选群组</div>
                </div>
                <div class="wechaty-memory-detail">
                  <div class="wechaty-memory-toolbar">
                    <span class="wechaty-memory-title" id="wechaty-memory-title">未选择群</span>
                    <span class="wechaty-memory-stat" id="wechaty-memory-stat">—</span>
                  </div>
                  <div class="wechaty-manual-memory">
                    <input class="settings-input" id="wechaty-manual-memory-input" type="text" placeholder="手动添加一条本群长期记忆，例如：本群值班规则是先看监控再处理告警">
                    <button class="settings-save-btn" id="wechaty-add-memory-btn" type="button">添加记忆</button>
                  </div>
                  <div class="wechaty-memory-preview" id="wechaty-memory-preview"></div>
                </div>
              </div>
            </div>
            <div class="wechaty-stats-panel" id="wechaty-stats-panel">
              <div class="wechaty-subsection-head">
                <div>
                  <div class="wechaty-subsection-title">群统计与定时总结</div>
                  <p class="settings-hint">统计和定时总结有单独的群组选择：没在这里勾选的群不会进入统计，也不会自动发送总结，避免误发到所有群。</p>
                </div>
                <div class="wechaty-memory-actions">
                  <select class="settings-select wechaty-stats-scope-select" id="wechaty-stats-view-mode">
                    <option value="single">查看当前群</option>
                    <option value="all">已选统计群总览</option>
                  </select>
                  <button class="settings-save-btn" id="wechaty-refresh-stats-btn" type="button">刷新统计</button>
                  <button class="settings-save-btn primary" id="wechaty-send-digest-btn" type="button">立即发本群总结</button>
                </div>
              </div>
              <div class="wechaty-stats-scope" id="wechaty-stats-scope-label">当前查看：未选择群</div>
              <div class="wechaty-digest-group-picker">
                <div class="wechaty-digest-group-head">
                  <div>
                    <b>选择参与统计/定时总结的群组</b>
                    <small>这里独立于上方“@ 回复群组”；只有勾选并保存后，后续新消息才会写入本地统计库并参与定时总结。</small>
                  </div>
                  <span id="wechaty-digest-group-count">未选择</span>
                </div>
                <div class="wechaty-digest-group-list" id="wechaty-digest-group-list">
                  <div class="wechaty-empty">先在上方登录微信并获取群列表</div>
                </div>
              </div>
              <div class="wechaty-digest-config">
                <label class="wechaty-digest-toggle"><input id="wechaty-digest-enabled" type="checkbox" checked><span>启用群统计/自动总结</span></label>
                <label class="wechaty-digest-toggle"><input id="wechaty-digest-interval-enabled" type="checkbox"><span>阶段总结</span></label>
                <select class="settings-select" id="wechaty-digest-interval">
                  <option value="30">每 30 分钟</option>
                  <option value="60">每 1 小时</option>
                  <option value="180">每 3 小时</option>
                  <option value="360">每 6 小时</option>
                  <option value="720">每 12 小时</option>
                  <option value="1440">每天一次</option>
                </select>
                <label class="wechaty-digest-toggle"><input id="wechaty-digest-daily-enabled" type="checkbox" checked><span>每日统计</span></label>
                <input class="settings-input wechaty-digest-time" id="wechaty-digest-daily-time" type="time" value="00:00">
              </div>
              <div class="wechaty-digest-config wechaty-digest-ranks">
                <label><input id="wechaty-rank-message" type="checkbox" checked> 发言榜</label>
                <label><input id="wechaty-rank-image" type="checkbox" checked> 发图榜</label>
                <label><input id="wechaty-rank-emoji" type="checkbox" checked> 表情榜</label>
                <label><input id="wechaty-rank-link" type="checkbox" checked> 链接榜</label>
                <label><input id="wechaty-rank-brag" type="checkbox" checked> 装逼榜</label>
                <label class="wechaty-report-template-field">战报模板
                  <select class="settings-select" id="wechaty-report-template">
                    <option value="guochao-red-gold">国潮红金封神榜</option>
                    <option value="editorial-newspaper">报纸头版群聊时报</option>
                    <option value="ancient-scroll">古风卷轴值班战报</option>
                    <option value="ink-wash">水墨山水雅集榜</option>
                  </select>
                </label>
                <button class="settings-save-btn" id="wechaty-save-digest-btn" type="button">保存总结设置</button>
                <span class="settings-feedback" id="wechaty-digest-feedback"></span>
              </div>
              <div class="wechaty-report-preview-wrap">
                <div class="wechaty-report-preview-head"><b>HTML/CSS 战报模板预览</b><span>切换模板后会实时预览；保存后作为默认模板。</span></div>
                <iframe id="wechaty-report-preview" class="wechaty-report-preview" title="群聊战报模板预览" loading="lazy"></iframe>
              </div>
              <div class="wechaty-stats-cards" id="wechaty-stats-cards">
                <div class="wechaty-empty">选择左侧群并刷新统计后显示今日数据。</div>
              </div>
              <div class="wechaty-leaderboards" id="wechaty-leaderboards"></div>
              <div class="wechaty-records-panel">
                <div class="wechaty-records-head">
                  <div>
                    <h5>微信群聊天记录库</h5>
                    <p>显示已经写入本机 SQLite 的全量聊天记录，支持时间筛选、关键词检索、导入和导出。</p>
                  </div>
                  <div class="wechaty-records-actions">
                    <button class="settings-save-btn primary" id="wechaty-records-refresh-btn" type="button">🔎 查询记录</button>
                    <button class="settings-save-btn ghost" id="wechaty-records-today-btn" type="button">今天</button>
                    <button class="settings-save-btn ghost" id="wechaty-records-refresh-names-btn" type="button">刷新昵称</button>
                    <button class="settings-save-btn ghost" id="wechaty-records-export-json-btn" type="button">导出 JSON</button>
                    <button class="settings-save-btn ghost" id="wechaty-records-export-csv-btn" type="button">导出 CSV</button>
                    <label class="settings-save-btn ghost" for="wechaty-records-import-file">导入 JSON</label>
                    <input id="wechaty-records-import-file" type="file" accept="application/json,.json" hidden>
                  </div>
                </div>
                <div class="wechaty-records-help">
                  <b>聊天记录库</b>是原始流水账：谁在什么时候说了什么、发了什么图；<b>群记忆管理</b>是 Honcho 长期记忆：把聊天里有价值的偏好、约定、结论抽取成可供大模型下次回答使用的知识。
                </div>
                <div class="wechaty-records-filters">
                  <label><span>查看群组</span><select class="settings-select" id="wechaty-records-group">
                    <option value="">跟随左侧群选择</option>
                  </select></label>
                  <label><span>开始时间</span><input class="settings-input" id="wechaty-records-from" type="datetime-local"></label>
                  <label><span>结束时间</span><input class="settings-input" id="wechaty-records-to" type="datetime-local"></label>
                  <label><span>类型</span><select class="settings-select" id="wechaty-records-type">
                    <option value="">全部类型</option>
                    <option value="text">文字</option>
                    <option value="image">图片</option>
                    <option value="emoji">表情</option>
                    <option value="link">链接</option>
                    <option value="mixed">混合</option>
                  </select></label>
                  <label><span>关键词</span><input class="settings-input" id="wechaty-records-query" type="search" placeholder="搜索成员/内容/链接"></label>
                </div>
                <div class="wechaty-records-summary" id="wechaty-records-summary">尚未查询聊天记录。</div>
                <div class="wechaty-records-list" id="wechaty-records-list"></div>
                <div class="wechaty-records-more"><button class="settings-save-btn" id="wechaty-records-more-btn" type="button">加载更多</button></div>
              </div>
              <div class="wechaty-stats-recent" id="wechaty-stats-recent"></div>
            </div>
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

        <!-- ── 网络能力 tab ── -->
        <div class="settings-tab" data-tab="web-search">
          <div class="network-panel">
            <section class="network-hero" aria-label="网络能力总览">
              <div class="network-hero-copy">
                <div class="network-eyebrow">NETWORK CAPABILITY</div>
                <h3>网络能力中枢</h3>
                <p>把网页搜索、公开图片搜索、链接真实查看和 Brave Key 池放到一个清晰面板里。默认 Brave 优先，失败后自动走兜底链路。</p>
              </div>
              <div class="network-route-card" aria-label="搜索链路">
                <span>搜索链路</span>
                <strong>Brave</strong>
                <em>→ Serper → SearXNG → Bing → Jina → DuckDuckGo</em>
              </div>
            </section>

            <section class="network-stat-grid" aria-label="网络能力状态摘要">
              <article class="network-stat-card primary">
                <span class="network-stat-icon">B</span>
                <div>
                  <strong>Brave Key 池</strong>
                  <small>10 槽位自动轮换</small>
                </div>
              </article>
              <article class="network-stat-card">
                <span class="network-stat-icon">W</span>
                <div>
                  <strong>网页搜索</strong>
                  <small>优先 Brave，失败回落</small>
                </div>
              </article>
              <article class="network-stat-card">
                <span class="network-stat-icon">IMG</span>
                <div>
                  <strong>图片直发</strong>
                  <small>微信群直接发图/GIF</small>
                </div>
              </article>
              <article class="network-stat-card guard">
                <span class="network-stat-icon">✓</span>
                <div>
                  <strong>链接守卫</strong>
                  <small>禁止假装“正在查看”</small>
                </div>
              </article>
            </section>

            <section class="network-card network-card-main">
              <div class="network-card-head">
                <div>
                  <div class="settings-section-label">Brave Search Key 池</div>
                  <p>主力配置区：最多 10 个 Key。留空会保留原值；输入新 Key 覆盖当前槽；勾选清空会删除当前槽。</p>
                </div>
                <span class="network-status-pill is-empty" id="websearch-status-brave-pool">—</span>
              </div>

              <div class="network-key-grid" id="websearch-brave-key-grid">
                ${Array.from({ length: 10 }, (_, i) => `
                  <div class="network-key-card">
                    <div class="network-key-top">
                      <span class="network-key-index">KEY ${String(i + 1).padStart(2, '0')}</span>
                      <small class="network-key-status is-empty" id="websearch-status-brave-${i}">—</small>
                    </div>
                    <input class="settings-input websearch-brave-key" type="password" data-index="${i}" aria-label="Brave Key ${i + 1}" placeholder="粘贴新 Key；留空保留">
                    <label class="network-clear-row">
                      <input type="checkbox" class="websearch-brave-clear" data-index="${i}">
                      <span>清空此槽</span>
                    </label>
                  </div>
                `).join('')}
              </div>
            </section>

            <section class="network-provider-grid" aria-label="兜底搜索渠道">
              <article class="network-provider-card">
                <div class="network-provider-head">
                  <div>
                    <span>Serper</span>
                    <small>Google SERP JSON，稳定兜底</small>
                  </div>
                  <span class="network-status-pill is-empty" id="websearch-status-serper">—</span>
                </div>
                <label class="network-field" for="websearch-serper-key">
                  <span>API Key</span>
                  <input class="settings-input" type="password" id="websearch-serper-key" placeholder="留空则不修改">
                </label>
                <p>在 <a href="https://serper.dev" target="_blank">serper.dev</a> 获取；用于 Brave 不可用时继续搜索。</p>
              </article>

              <article class="network-provider-card">
                <div class="network-provider-head">
                  <div>
                    <span>Jina</span>
                    <small>s.jina.ai 搜索兜底</small>
                  </div>
                  <span class="network-status-pill is-empty" id="websearch-status-jina">—</span>
                </div>
                <label class="network-field" for="websearch-jina-key">
                  <span>API Key</span>
                  <input class="settings-input" type="password" id="websearch-jina-key" placeholder="留空则不修改">
                </label>
                <p>在 <a href="https://jina.ai" target="_blank">jina.ai</a> 获取；作为 Bing 失效时的额外兜底。</p>
              </article>

              <article class="network-provider-card">
                <div class="network-provider-head">
                  <div>
                    <span>SearXNG</span>
                    <small>自托管元搜索实例</small>
                  </div>
                  <span class="network-status-pill is-empty" id="websearch-status-searxng">—</span>
                </div>
                <label class="network-field" for="websearch-searxng-url">
                  <span>实例 URL</span>
                  <input class="settings-input" type="text" id="websearch-searxng-url" placeholder="https://your-searxng-instance.com">
                </label>
                <p>选填，必须带 <code>http://</code> 或 <code>https://</code>。清空输入并保存可删除本地 URL。</p>
              </article>
            </section>

            <section class="network-action-bar">
              <div>
                <strong>保存后立即生效</strong>
                <small>Key 明文不会回显；只显示“本地 / 环境变量 / 空”状态，避免泄露。</small>
              </div>
              <div class="network-action-controls">
                <button class="settings-save-btn primary" id="settings-save-web-search" type="button">保存网络能力设置</button>
                <span class="settings-feedback" id="settings-web-search-feedback"></span>
              </div>
            </section>
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
                  <span class="release-note-version">v0.4.62</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">微信群助手掉线二维码自动通知：离线后通过 ClawBot 自己发送重新登录二维码。</p>
                <ul class="release-note-points">
                  <li>持续监控微信群助手真实在线状态，离线且暂无二维码时可自动重新生成二维码。</li>
                  <li>二维码会生成 PNG，并通过“微信 ClawBot（个人微信）”发送到 ClawBot 自己，不需要选择联系人。</li>
                  <li>新增通知开关、自动生成二维码开关、重复通知冷却和通知状态显示。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.61</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">网络能力设置页 UI 精修：Key 池、兜底渠道和保存动作更清楚。</p>
                <ul class="release-note-points">
                  <li>设置窗口加宽加高，网络能力页新增顶部总览、能力状态卡片和底部保存操作条。</li>
                  <li>Brave Key 1~10 改为卡片式槽位，状态显示本地 / ENV / 空，清空操作更直观。</li>
                  <li>Serper、Jina、SearXNG 改为独立兜底渠道卡片，状态统一为胶囊组件。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.60</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">网络能力大版本：Brave Key 池、网络图片直接发图、链接真实查看防假执行。</p>
                <ul class="release-note-points">
                  <li>网络能力菜单新增 10 个 Brave Search Key 槽位，无额度/限流会自动轮换。</li>
                  <li>web_search 优先 Brave，全部不可用时回落 Serper、SearXNG、Bing、Jina、DuckDuckGo。</li>
                  <li>微信群找图/发网络图片会直接发图片/GIF；链接查看必须真实 fetch_url/browser_read，禁止只说“正在查看”。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.59</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">微信群引用回复可见化：引用消息和聊天记录证据不再“看不出来”。</p>
                <ul class="release-note-points">
                  <li>引用文字/图片/语音/视频/链接/小程序后 @ 助手，依赖引用回答时会先显示一行“引用…”依据。</li>
                  <li>send_message 增加底层兜底，模型忘写引用行时会自动补上，不会再像没引用一样直接回答。</li>
                  <li>聊天记录检索类问题会要求显示一条关键历史证据，例如“引用聊天记录：时间 昵称：摘要”。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.58</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">修复微信群排行榜同一成员占多个名次的问题，统计会按稳定身份/群昵称合并。</p>
                <ul class="release-note-points">
                  <li>发言、发图、表情、链接、装逼榜统一合并历史 sender_id。</li>
                  <li>拿不到稳定 wxid 时按当前群昵称合并，避免同一人重复上榜。</li>
                  <li>参与人数也按合并后的成员身份计算，不再被历史 ID 虚高。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.57</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">修复微信群图片解析真实接口可用但后台报空内容的问题，当前识图状态已恢复正常。</p>
                <ul class="release-note-points">
                  <li>识图调用改为原始 fetch 解析中转响应，不再被 OpenAI SDK 响应格式兼容问题误判为空。</li>
                  <li>专用 Skill 识图渠道优先于当前 LLM，减少空返回和超时等待。</li>
                  <li>陈旧 running 图片任务会自动重排队，状态区会区分待处理、解析中和失败数。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.56</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">根据 5 张失败图片真实测试修复识图超时：gpt-5.4 可用但大图需要 22~33 秒。</p>
                <ul class="release-note-points">
                  <li>gpt-4o-mini 在指定渠道真实图片请求中 5/5 返回 502。</li>
                  <li>gpt-5.4 对小图成功，对大图可成功但需要更长等待。</li>
                  <li>识图调用不再硬压 25 秒，改为按设置里的超时执行。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.55</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">识图渠道测试改为真实多模态调用，不再把 /models 可用误判为图片识别可用。</p>
                <ul class="release-note-points">
                  <li>测试连通会发送一张测试图片到 chat.completions，返回非空才算识图可用。</li>
                  <li>识图状态区分“最近成功 / 最近失败 / 待真实识图”。</li>
                  <li>图片库状态会显示最近失败摘要，例如 503、超时或返回空内容。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.54</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">Skill 技能新增模型渠道池，生图/识图可配置多个渠道并自动故障切换。</p>
                <ul class="release-note-points">
                  <li>生图和识图渠道支持新增、删除、排序、设为默认和测试连通。</li>
                  <li>渠道失败时自动尝试下一个已启用渠道，失败原因会汇总反馈。</li>
                  <li>识图请求会先确认图片已入库并开始识别，避免坏模型表现为完全没响应。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.53</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">修复微信群图片理解链路：连续 @、补充文字、再发图片时不再只看到 [图片] 占位。</p>
                <ul class="release-note-points">
                  <li>纯 @ 或看图请求会短暂等待同一成员后续文字/图片入库，再合并处理。</li>
                  <li>命中“总结图片/看看图/解析截图”时直接从当前群图片库取最近图片调用识图模型。</li>
                  <li>识图候选模型去重并限制单候选超时，坏模型会明确反馈错误，不再让文本模型猜图。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.52</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">完成 Web 微信系统级 @ 实验：MsgSource 注入可发出消息，但不能触发「有人@我」。</p>
                <ul class="release-note-points">
                  <li>新增本机调试接口，可对指定群和成员测试 MsgSource/atuserlist。</li>
                  <li>值班群实测 4 种载荷均只显示普通文本 @，没有系统级提醒。</li>
                  <li>生产回复保持可见 @ 昵称兜底；真正系统 @ 需改走 Mac 微信 UI 自动化或真实 mention puppet。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.51</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">修复微信群可见 @ 昵称显示：回复和渠道告警不再出现空 @ 或 @ 后直接接正文。</p>
                <ul class="release-note-points">
                  <li>Web 微信链路会手动拼出真实群昵称，确保群里能看到明确 @ 对象。</li>
                  <li>普通群回复仍锁定真实提问人 sender_id，模型选错 target 也会被底层纠正。</li>
                  <li>模型自己写的开头 @ 会被清理并重建为正确群昵称。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.50</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">LLM 渠道连通通知新增按群选择 @ 人员，异常通知能精准提醒指定成员。</p>
                <ul class="release-note-points">
                  <li>每个通知微信群都能加载成员、按微信昵称搜索并勾选要 @ 的人。</li>
                  <li>底层保存真实 sender_id，避免改昵称或同名导致误 @。</li>
                  <li>不选择 @ 人员时只发群通知，不会误 @ 全员。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.49</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">新增 LLM 渠道连通通知，可定时检测模型池渠道并通知到指定微信群。</p>
                <ul class="release-note-points">
                  <li>可配置通知间隔、通知策略、检测渠道和通知群组。</li>
                  <li>设置页新增大尺寸下拉和卡片多选列表，避免控件太小不好用。</li>
                  <li>支持立即检测/立即检测并通知；通知不展示 API Key。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.48</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">微信群新增引用消息上下文理解，引用文字/图片/语音/视频/链接/小程序后能按引用回答。</p>
                <ul class="release-note-points">
                  <li>新增精简引用上下文块，只给类型、发送者、摘要、URL/标题和引用后的当前请求。</li>
                  <li>不把原始 XML、base64、完整历史塞进模型，减少 token 和误判。</li>
                  <li>图片引用优先结合图片解析库；语音无转写时明确说明，不编造内容。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.47</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">优化图片解析库控件可用性，并新增编辑/删除图片管理能力。</p>
                <ul class="release-note-points">
                  <li>群组、状态、关键词、发送人和时间筛选改为大尺寸控件，新增查询/重置按钮。</li>
                  <li>每张图片可编辑识图描述和标签，保存后立即刷新。</li>
                  <li>每张图片可删除数据库记录，并尝试删除本机已入库图片文件；不允许删除任意本机路径。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.46</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">数据库页新增微信群图片解析库，可看进度、浏览缩略图、搜索图片并后台补解析。</p>
                <ul class="release-note-points">
                  <li>显示图片总数、已解析、待解析、解析中、失败/无模型和 base64 备份数量。</li>
                  <li>支持按群组、解析状态、关键词、发送人和时间筛选图片。</li>
                  <li>数据库页每 10 秒自动刷新，并在存在待解析图片时自动触发后台补解析。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.45</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">增强微信群图片检索时间理解，可按时间、成员和图片内容联合找图。</p>
                <ul class="release-note-points">
                  <li>支持今天/昨天/几月几日/上午下午晚上/几点几分/刚才最近等自然时间表达。</li>
                  <li>图片转发会把时间范围、发送者昵称/别名、识图描述和 OCR 内容一起打分。</li>
                  <li>真实 PT 群图片库已验证“今天09:15力佬发的newapi图”可命中对应图片。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.44</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">修复微信群图片转发检索，能把“力佬发的 newapi 图”正确匹配到已入库图片。</p>
                <ul class="release-note-points">
                  <li>newapi / New API / New-API 统一归一化匹配。</li>
                  <li>图片库搜索加入发送者昵称、花体昵称标准化和“力佬/大力/Dali”别名兼容。</li>
                  <li>已入库但还没完成识图描述的图片也可作为兜底候选，避免刚收到图就说找不到。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.43</span>
                  <span class="release-note-date">2026-05-29</span>
                </div>
                <p class="release-note-summary">新增已入库群图片转发能力，并避免把“山水画”误判成生图。</p>
                <ul class="release-note-points">
                  <li>“把那张图发给我/转发刚才那张图”会优先从当前群图片库发送原图。</li>
                  <li>只允许发送当前群已入库微信图片，不允许任意本机文件外发。</li>
                  <li>生图触发词进一步收紧，避免名词里的“画”误触发。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.19</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">管理员设置页改为昵称显示和昵称搜索，底层仍精确 ID 授权。</p>
                <ul class="release-note-points">
                  <li>已选管理员区域显示微信昵称，不再显示长 sender_id。</li>
                  <li>搜索框按微信昵称搜索，点击成员卡片添加/取消管理员。</li>
                  <li>后台仍保存精确 sender_id，昵称相同或自称管理员不会获得权限。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.18</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">修复微信群发送失败导致回复变慢，并支持多人同时 @ 并行处理。</p>
                <ul class="release-note-points">
                  <li>真实 sender_id 回复目标会进入本轮发送白名单，避免 target_id 校验先失败再重试。</li>
                  <li>短时间多条 Wechaty 群 @ 默认最多 3 条并行处理，继续使用同一套性格、安全和记忆逻辑。</li>
                  <li>并行回复仍分别锁定各自真实提问人，不会串 @。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.17</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">修复微信群 @ 错人和管理员模式：回复目标底层锁定真实提问人，管理员设置立即生效。</p>
                <ul class="release-note-points">
                  <li>send_message 在 Wechaty 群消息上下文下强制使用本轮真实 sender_id，不允许模型把回复 @ 到被讨论对象。</li>
                  <li>修复管理员模式勾选被状态轮询清掉的问题，保存后立即生效。</li>
                  <li>管理员选择新增昵称/群名/ID 搜索框，点成员卡片即可加入管理员。</li>
                  <li>普通群友暗算、嘲讽或要求伤害管理员时，会站在管理员一边短句回怼，不执行危险操作。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.16</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">修复微信群回答不查聊天记录库导致“记不完整”：历史问题会先查当前群 SQLite 流水。</p>
                <ul class="release-note-points">
                  <li>微信群 @ 回复新增聊天记录库证据检索，按问题关键词、@ 对象和称呼词查当前群历史消息。</li>
                  <li>新增 <code>wechat-group-archive-evidence</code> 证据区，回答“谁说过/老登是谁/称呼关系/之前记录”时优先基于数据库。</li>
                  <li>检索严格按当前微信群隔离，不把其他群记录混进来。</li>
                  <li>证据里没有时要求明确说明没查到，避免靠常识或最近上下文瞎猜。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.15</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">修复微信群聊天记录页“不更新”的误判：明确当前查看群，并让结束时间自动跟随现在。</p>
                <ul class="release-note-points">
                  <li>聊天记录库新增“查看群组”下拉框，不再只能跟随左侧 Honcho 记忆群选择。</li>
                  <li>默认结束时间会在每次查询前自动刷新到当前时间，避免设置页长开后新消息被旧时间过滤。</li>
                  <li>微信群助手页停留时会自动刷新聊天记录列表，不再只刷新统计榜单。</li>
                  <li>记录摘要显示当前查看群和 DB 最新入库时间，方便判断是选错群、筛选范围问题还是真没入库。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.14</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">修复微信群重复回复：成功回复一次后立即结束，不再外发内部结束语。</p>
                <ul class="release-note-points">
                  <li>微信群 @ 回合成功 send_message 后本轮立即停止，避免继续生成第二条/第三条。</li>
                  <li>拦截“已回复/回复完毕/发送完毕/本轮结束/无需补充”等内部状态外发。</li>
                  <li>如果已成功回复，后续 LLM 超时或报错不会重新排队该消息，避免重复刷屏。</li>
                  <li>模型收到更明确的微信群回复规则：只发一条自然回答，不发协议状态。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.13</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">清理后台内部 skip 日志显示：避免再把正常记忆空结果看成“跳过消息”。</p>
                <ul class="release-note-points">
                  <li>后台记忆识别/整合内部工具不再输出“工具调用 skip_recognition/skip_consolidation”。</li>
                  <li>“显式跳过”日志改为“无需写入记忆 / 无需整理”，含义更准确。</li>
                  <li>TICK 只做节奏/界面等运行时动作时不再进入记忆识别器。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.12</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">彻底修复后台一直“跳过识别/跳过整理”：内部记忆工具不再循环刷屏。</p>
                <ul class="release-note-points">
                  <li>记忆识别器遇到 skip_recognition / upsert_memory 后立即结束，不再继续问模型下一步。</li>
                  <li>记忆整合器遇到 skip_consolidation / merge / downgrade 后立即结束，避免内部整理循环熔断。</li>
                  <li>TICK 心跳没有实际工具动作时不再进入记忆识别，减少空闲状态的无意义识别。</li>
                  <li>内部记忆工具不写入审计流，前端思考流也隐藏这些内部协议工具。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.11</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">修复一直“跳过识别”不回复：记忆识别器内部工具不再污染主对话。</p>
                <ul class="release-note-points">
                  <li>主对话工具列表强制过滤 skip_recognition 等记忆识别/整理内部工具。</li>
                  <li>recent action log 注入也会过滤这些内部工具，避免历史 skip 状态影响新消息。</li>
                  <li>微信群 @ 消息即使模型返回“已回复/无需补充”，也会被 fallback 纠正，不再静默跳过。</li>
                  <li>新增 tool-router 测试，覆盖内部记忆工具不能通过 action log 保活进主对话。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.10</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">Wechaty 启动卡住自恢复修复：避免重启后假 starting 导致群消息进不来。</p>
                <ul class="release-note-points">
                  <li>启动 60 秒仍没有二维码、登录事件或真实在线状态时，自动重启 Wechaty 连接。</li>
                  <li>设置页“登录/恢复微信”不再把无二维码的 starting 当作已运行，会走重启恢复。</li>
                  <li>和 v0.4.9 的持续入库配合，确保“能收到消息”和“收到就入库”两层都稳定。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.9</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群聊天记录库持续入库修复：原始聊天流水不再被统计/日报群组勾选拦截。</p>
                <ul class="release-note-points">
                  <li>只要程序运行且 Wechaty 收到群消息，就会写入本机 SQLite 聊天记录库。</li>
                  <li>群统计与定时总结的勾选项只控制排行榜和自动发送，不再影响原始记录入库。</li>
                  <li>非微信群助手接入群只做本地记录，不进入 Honcho、大模型或自动回复链路。</li>
                  <li>修复前已为当前数据库创建 SQLite 备份，避免误判为数据丢失。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.8</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群 @ 回复目标链路热修复：正确解析带成员的 Wechaty 群目标，避免发送时 room_id 被拼坏。</p>
                <ul class="release-note-points">
                  <li>支持解析 <code>wechaty:room:&lt;room&gt;:member:&lt;member&gt;</code>，分开发送群 room_id 和 @ 对象 member_id。</li>
                  <li>如果模型只传 target_id，也会用 member_id 作为兜底 @ 对象。</li>
                  <li>继续坚持精确成员 ID 匹配，找不到真实成员就不 @，避免 @ 错主人或上一位提问人。</li>
                  <li>新增 social target 解析测试，覆盖旧格式、新编码格式和带成员格式。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.7</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群 @ 回复对象修复：按当前提问人的 sender_id / sender_name 精确 @ 回去，不再误 @ 管理员或上一位成员。</p>
                <ul class="release-note-points">
                  <li>每条群消息生成独立回复目标，send_message 会明确指向当前提问人。</li>
                  <li>发送时优先在当前群成员列表里按 contact.id 精确找人，找不到就不模糊猜测。</li>
                  <li>群消息 prompt 中会明确要求回复当前提问人，减少模型选错 target_id 的概率。</li>
                  <li>顺带解释了当前聊天记忆不是全库直塞，而是按群/成员/最近上下文分层注入。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.6</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">LLM 多模型池与自动故障切换：一个模型没额度或不可用时自动切备用模型。</p>
                <ul class="release-note-points">
                  <li>设置页 LLM 模型菜单新增模型池，可添加、编辑、启停、排序、删除和设为当前。</li>
                  <li>自动切换策略默认开启，支持失败冷却时间和最多尝试模型数。</li>
                  <li>额度不足、限流、认证失败、模型不可用、5xx、网络超时时会自动切换备用模型。</li>
                  <li>只在尚未输出内容时切换，避免回复重复、语音断裂；API 不返回明文 Key。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.5</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群多群统计、排队回复与管理员模式：多人 @ 不再吞消息，多群排行榜标明来源群。</p>
                <ul class="release-note-points">
                  <li>多人同时 @ 时按队列顺序逐条回复，不再被同群后一条消息覆盖。</li>
                  <li>统计页新增“当前群 / 已选统计群总览”，多群排行榜每行显示群名。</li>
                  <li>新增精确 sender_id 管理员模式，可从成员 ID 列表点选添加。</li>
                  <li>设置页停留在微信群助手时，榜单会自动刷新。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.4</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群昵称强制刷新与记录库 UI 优化：修复“未知成员”，并说明记录库和群记忆的区别。</p>
                <ul class="release-note-points">
                  <li>直接调用 wechat4u 群成员资料刷新，解决重新登录后昵称仍未知的问题。</li>
                  <li>新增“刷新昵称”按钮，在线时可手动回填群成员昵称。</li>
                  <li>重新扫码导致 room_id 变化时，统计和聊天记录按群名合并。</li>
                  <li>查询区新增主查询按钮、今天快捷按钮和更清晰的日期输入框。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.3</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群聊天记录库：按群查看完整入库消息，支持时间筛选、昵称映射、媒体预览和导入导出。</p>
                <ul class="release-note-points">
                  <li>新增“微信群聊天记录库”，显示已入库总数、完整时间、成员昵称、内容和媒体标记。</li>
                  <li>支持开始/结束时间、类型、关键词筛选和分页加载更多。</li>
                  <li>JSON 导出包含媒体 base64 备份，CSV 导出方便表格查看，JSON 导入会恢复记录和媒体。</li>
                  <li>新收到的图片/表情/音视频会尝试保存到本机数据目录，并可在设置页预览。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.2</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群排行榜昵称修复：发言榜/发图榜等优先显示微信群昵称，不再暴露内部 ID。</p>
                <ul class="release-note-points">
                  <li>优先读取群昵称、微信备注和微信昵称，过滤 @ 开头的 WeChaty 内部 ID。</li>
                  <li>接入群或收到消息后后台刷新成员列表，自动回填旧统计行。</li>
                  <li>排行榜按 sender_id 合并，昵称变化不会把同一个人拆成多条。</li>
                  <li>最近记录、链接列表和群总结重点线索同步清洗昵称。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.1</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">群统计选择修复：统计/定时总结必须手动勾选群组，统计数据和成员记忆更直观。</p>
                <ul class="release-note-points">
                  <li>新增统计/定时总结专用群组选择，未选择群不会统计也不会自动发送。</li>
                  <li>统计面板显示本机 SQLite 表位置，并展示最近写入的统计记录。</li>
                  <li>Honcho 群组长期记忆和成员长期记忆固定显示空状态。</li>
                  <li>历史英文内部协议误回复在记忆展示和上下文注入中隐藏。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.4.0</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群统计与定时总结大版本：全量记录群消息，新增排行榜、日报和阶段总结设置。</p>
                <ul class="release-note-points">
                  <li>修复群里偶发回复英文内部协议文本的问题。</li>
                  <li>全量统计文字、图片、表情、链接和装逼指数，不只记录 @ 消息。</li>
                  <li>新增每日 00:00 群日报、阶段总结、手动立即发送本群总结。</li>
                  <li>设置页新增统计卡片和发言/发图/表情/链接/装逼排行榜。</li>
                  <li>成员长期记忆从消息元数据补全 peer，展示更稳定。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.10</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">性格保存与记忆展示修复：预设不再跳自定义，新增性格保存按钮，成员记忆单独展示。</p>
                <ul class="release-note-points">
                  <li>修复状态轮询覆盖性格编辑区，导致预设卡片跳到自定义的问题。</li>
                  <li>性格设定区新增“保存性格并生效”按钮，保存后状态立即显示已生效。</li>
                  <li>Honcho 详情拆分“群组长期记忆”和“成员长期记忆”。</li>
                  <li>成员记忆明确只在当前微信群内生效，并与群组记忆共同参与匹配。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.9</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群网络图片发送补强：公开图片 URL 可作为图片发送，本机文件引用出站拦截。</p>
                <ul class="release-note-points">
                  <li>识别 https 图片 URL 和 Markdown 图片并用 FileBox.fromUrl 发送。</li>
                  <li>只允许 png/jpg/jpeg/gif/webp 公开网络图片，单条最多 3 张。</li>
                  <li>拦截 file://、/Users、~/、桌面/相册/截图等本机文件引用。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.8</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群体验增强：网络梗理解、网络图边界、性格状态更明显、称呼身份即时记忆。</p>
                <ul class="release-note-points">
                  <li>v我50 / vw50 / 疯狂星期四等中文网络梗会按群聊语境理解。</li>
                  <li>允许公开网络图片/表情包链接，禁止本机文件、桌面文件、截图、相册外发。</li>
                  <li>性格设定显示“当前生效 / 已生效 / 有未保存修改”，并加入自定义性格卡片。</li>
                  <li>“以后叫我大哥 / 我是你大哥 / 我叫xxx”会即时写入本群 Honcho 长期记忆。</li>
                  <li>新增 test:wechat-memory 自动测试。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.7</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">紧急安全修复：微信群黑名单补拦截查看桌面、本机文件列表和系统盘点请求。</p>
                <ul class="release-note-points">
                  <li>新增本机文件/目录盘点规则，拦截“查看桌面有啥文件”等请求。</li>
                  <li>新增本机系统信息盘点规则，拦截查看配置、进程、窗口、软件列表等请求。</li>
                  <li>扩展凭证规则，补上“把 .env 发群里”这类表达。</li>
                  <li>ClawBot 群聊路径也接入安全守卫，避免旁路绕过。</li>
                  <li>新增自动测试脚本 test:wechat-guard。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.6</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群助手性格预设：新增 3 种可一键套用的人格风格，并过滤旧项目网页微信流程。</p>
                <ul class="release-note-points">
                  <li>新增“主人数字分身 / 技术值班助手 / 幽默社交助手”三张预设卡片。</li>
                  <li>点击预设只填入提示词，不会立即生效；确认后仍需点“保存并生效”。</li>
                  <li>预设提示词适配当前 Wechaty + Honcho：不包含 wx.qq.com、DOM、browser_evaluate、浏览器轮询等旧流程。</li>
                  <li>可查看当前是否完全匹配某个预设；手动编辑后显示为自定义提示词。</li>
                  <li>危险电脑操作仍由安全黑名单强制拦截，性格设定不能绕过。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.5</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群助手记忆管理增强：按群查看/管理 Honcho 记忆，新增性格设定和完整安全隔离词库。</p>
                <ul class="release-note-points">
                  <li>设置页新增微信群助手性格提示词输入框，保存后直接注入群回复 prompt。</li>
                  <li>Honcho 群知识库改为左侧群列表、右侧详情，可查看原始消息、自动摘要、长期结论。</li>
                  <li>支持手动添加本群长期记忆、删除单条结论、清空本群 Honcho session。</li>
                  <li>安全黑名单扩展为 17 类危险指令规则，并以卡片展示说明、示例和替代方案。</li>
                  <li>设置窗口放大，保存群选择时不再因搜索过滤误取消隐藏群。</li>
                </ul>
              </article>
              <article class="release-note-card">
                <div class="release-note-head">
                  <span class="release-note-version">v0.3.4</span>
                  <span class="release-note-date">2026-05-28</span>
                </div>
                <p class="release-note-summary">微信群助手真实状态修复：不再假在线，新增强制重新扫码入口。</p>
                <ul class="release-note-points">
                  <li>旧群列表只显示为缓存，不再当成当前在线证据。</li>
                  <li>没有真实刷新群列表时不会再提示“群列表已刷新”。</li>
                  <li>新增“强制重新扫码”，清空坏登录态并重新生成二维码。</li>
                </ul>
              </article>
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
