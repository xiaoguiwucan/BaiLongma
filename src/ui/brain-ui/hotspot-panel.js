export const createHotspotPanel = () => `
<div class="hotspot-panel" id="hotspot-panel">

  <!-- ── 顶部标题栏 ── -->
  <div class="hs-header">
    <div class="hs-brand">
      <span class="hs-brand-name">GHTS v2.7.1</span>
      <span class="hs-brand-dot">●</span>
      <span class="hs-brand-status">SYSTEM ONLINE</span>
    </div>
    <div class="hs-title-block">
      <div class="hs-title-en">GLOBAL HOTSPOT TRACKING SYSTEM</div>
      <div class="hs-title-zh">全球热点事件追踪系统</div>
    </div>
    <div class="hs-header-right">
      <div class="hs-header-meta">
        <div class="hs-header-tag"><span class="hs-tag-icon">◈</span>卫星链路<br><span class="hs-tag-status">在线</span></div>
        <div class="hs-header-tag"><span class="hs-tag-icon">≡</span>数据源<br><span class="hs-tag-status">稳定</span></div>
        <div class="hs-header-tag"><span class="hs-tag-icon">⬡</span>AI分析引擎<br><span class="hs-tag-status">运行中</span></div>
      </div>
      <div class="hs-clock-block">
        <div class="hs-clock" id="hs-clock">19:26:17</div>
        <div class="hs-live-dot">● LIVE</div>
      </div>
      <button class="hs-exit-btn" id="hs-exit-btn" type="button" title="关闭热点模式">×</button>
    </div>
  </div>

  <!-- ── 统计条 ── -->
  <div class="hs-stats-bar">
    <div class="hs-stat hs-stat--warn">
      <div class="hs-stat-icon">⚠</div>
      <div class="hs-stat-body">
        <div class="hs-stat-label">热榜事件流</div>
        <div class="hs-stat-value" id="hs-stat-alert">--</div>
        <div class="hs-stat-delta hs-delta-up" id="hs-stat-alert-delta">等待数据刷新</div>
      </div>
    </div>
    <div class="hs-stat hs-stat--hot">
      <div class="hs-stat-icon">🔥</div>
      <div class="hs-stat-body">
        <div class="hs-stat-label">热榜条目</div>
        <div class="hs-stat-value" id="hs-stat-hot">--</div>
        <div class="hs-stat-delta hs-delta-up" id="hs-stat-hot-delta">等待数据源连接</div>
      </div>
    </div>
    <div class="hs-stat hs-stat--data">
      <div class="hs-stat-icon">◈</div>
      <div class="hs-stat-body">
        <div class="hs-stat-label">信息源总量</div>
        <div class="hs-stat-value" id="hs-stat-data">--</div>
        <div class="hs-stat-delta" id="hs-stat-data-delta">四平台热榜</div>
      </div>
    </div>
    <div class="hs-stat hs-stat--ai">
      <div class="hs-stat-icon">⬡</div>
      <div class="hs-stat-body">
        <div class="hs-stat-label">热榜源状态</div>
        <div class="hs-stat-value" id="hs-stat-ai">--</div>
        <div class="hs-stat-delta" id="hs-stat-ai-delta">等待刷新</div>
      </div>
    </div>
  </div>

  <!-- ── 主体：左柱 + 中柱（地球）+ 右柱 ── -->
  <div class="hs-body">

    <!-- 左柱 -->
    <div class="hs-col hs-col-left">

      <!-- 抖音热榜 -->
      <div class="hs-list-card" id="hs-douyin-card">
        <div class="hs-card-header">
          <span class="hs-platform-dot hs-dot-douyin"></span>
          <span class="hs-platform-name">抖音</span>
          <span class="hs-card-badge">热榜</span>
          <span class="hs-card-update" id="hs-douyin-update">刚刚更新</span>
        </div>
        <ul class="hs-list" id="hs-douyin-list">
          <!-- JS 动态填充 -->
        </ul>
      </div>

      <!-- 小红书热榜 -->
      <div class="hs-list-card" id="hs-xhs-card">
        <div class="hs-card-header">
          <span class="hs-platform-dot hs-dot-xhs"></span>
          <span class="hs-platform-name">小红书</span>
          <span class="hs-card-badge">热榜</span>
          <span class="hs-card-update" id="hs-xhs-update">刚刚更新</span>
        </div>
        <ul class="hs-list" id="hs-xhs-list">
          <!-- JS 动态填充 -->
        </ul>
      </div>

    </div>

    <!-- 中柱：3D 地球 + 辅助面板 -->
    <div class="hs-col hs-col-center">

      <!-- 地球容器 -->
      <div class="hs-earth-container" id="hs-earth-container">
        <div class="hs-earth-label">GLOBAL HEATMAP</div>
        <canvas id="hs-earth-canvas"></canvas>
        <div class="hs-earth-hint">拖拽旋转 · 滚轮缩放</div>
      </div>

      <!-- 辅助：区域关注度 + 情绪指数 -->
      <div class="hs-center-aux">

        <div class="hs-aux-box">
          <div class="hs-aux-title">区域关注度 <span class="hs-aux-sub">REGION RANKING</span></div>
          <div class="hs-region-list" id="hs-region-list">
            <div class="hs-region-row"><span class="hs-region-name">亚太地区</span><div class="hs-bar-track"><div class="hs-bar-fill" style="width:78%"></div></div><span class="hs-region-pct">78%</span></div>
            <div class="hs-region-row"><span class="hs-region-name">北美地区</span><div class="hs-bar-track"><div class="hs-bar-fill" style="width:62%"></div></div><span class="hs-region-pct">62%</span></div>
            <div class="hs-region-row"><span class="hs-region-name">欧洲地区</span><div class="hs-bar-track"><div class="hs-bar-fill" style="width:48%"></div></div><span class="hs-region-pct">48%</span></div>
            <div class="hs-region-row"><span class="hs-region-name">中东地区</span><div class="hs-bar-track"><div class="hs-bar-fill" style="width:33%"></div></div><span class="hs-region-pct">33%</span></div>
            <div class="hs-region-row"><span class="hs-region-name">南美地区</span><div class="hs-bar-track"><div class="hs-bar-fill" style="width:27%"></div></div><span class="hs-region-pct">27%</span></div>
            <div class="hs-region-row"><span class="hs-region-name">非洲地区</span><div class="hs-bar-track"><div class="hs-bar-fill" style="width:19%"></div></div><span class="hs-region-pct">19%</span></div>
          </div>
        </div>

        <div class="hs-aux-box">
          <div class="hs-aux-title">情绪指数 <span class="hs-aux-sub">SENTIMENT INDEX</span></div>
          <div class="hs-sentiment">
            <div class="hs-sentiment-ring">
              <svg viewBox="0 0 80 80" class="hs-ring-svg" aria-hidden="true">
                <circle cx="40" cy="40" r="28" fill="none" stroke="var(--line-strong)" stroke-width="5"/>
                <circle cx="40" cy="40" r="28" fill="none" stroke="var(--cool)" stroke-width="5"
                  stroke-dasharray="175.9" stroke-dashoffset="70"
                  stroke-linecap="round" transform="rotate(-90 40 40)"
                  id="hs-sentiment-arc"/>
              </svg>
              <div class="hs-ring-label">
                <div class="hs-ring-num" id="hs-sentiment-num">64</div>
                <div class="hs-ring-text" id="hs-sentiment-text">中性偏热</div>
              </div>
            </div>
            <div class="hs-sentiment-delta hs-delta-up" id="hs-sentiment-delta">↑ 3.12%</div>
          </div>
        </div>

      </div>
    </div>

    <!-- 右柱 -->
    <div class="hs-col hs-col-right">

      <!-- 微信热点榜 -->
      <div class="hs-list-card" id="hs-wechat-card">
        <div class="hs-card-header">
          <span class="hs-platform-dot hs-dot-wechat"></span>
          <span class="hs-platform-name">微信热点</span>
          <span class="hs-card-badge">热点榜</span>
          <span class="hs-card-update" id="hs-wechat-update">刚刚更新</span>
        </div>
        <ul class="hs-list" id="hs-wechat-list">
          <!-- JS 动态填充 -->
        </ul>
      </div>

      <!-- 微博热榜 -->
      <div class="hs-list-card" id="hs-weibo-card">
        <div class="hs-card-header">
          <span class="hs-platform-dot hs-dot-weibo"></span>
          <span class="hs-platform-name">微博</span>
          <span class="hs-card-badge">热搜榜</span>
          <span class="hs-card-update" id="hs-weibo-update">刚刚更新</span>
        </div>
        <ul class="hs-list" id="hs-weibo-list">
          <!-- JS 动态填充 -->
        </ul>
      </div>

    </div>
  </div>

  <!-- ── 热榜事件流（横向卡片轮播） ── -->
  <div class="hs-feed-bar">
    <div class="hs-feed-label">
      <span class="hs-feed-live-dot">●</span>
      <span>LIVE</span>
      <span class="hs-feed-subtitle">热榜事件流</span>
      <span class="hs-feed-desc">基于实时热榜动态生成</span>
    </div>
    <div class="hs-feed-viewport" id="hs-feed-viewport">
      <div class="hs-feed-track" id="hs-feed-track">
        <!-- JS 动态填充 -->
      </div>
    </div>
    <div class="hs-feed-controls">
      <span class="hs-feed-auto-label" id="hs-feed-auto">自动滚动中</span>
      <button class="hs-feed-nav" id="hs-feed-prev" type="button" aria-label="上一条">‹</button>
      <button class="hs-feed-nav" id="hs-feed-next" type="button" aria-label="下一条">›</button>
    </div>
  </div>

  <!-- ── 底部跑马灯 ── -->
  <div class="hs-ticker-bar">
    <div class="hs-ticker-inner" id="hs-ticker-inner">
      <!-- JS 动态填充（内容翻倍实现无缝滚动） -->
    </div>
  </div>

</div>
`;
