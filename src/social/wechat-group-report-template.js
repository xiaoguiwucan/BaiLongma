const TEMPLATE_IDS = ['guochao-red-gold', 'editorial-newspaper', 'ancient-scroll', 'ink-wash']

export const WECHAT_GROUP_REPORT_TEMPLATES = [
  { id: 'guochao-red-gold', name: '国潮红金封神榜' },
  { id: 'editorial-newspaper', name: '报纸头版群聊时报' },
  { id: 'ancient-scroll', name: '古风卷轴值班战报' },
  { id: 'ink-wash', name: '水墨山水雅集榜' },
]

export function normalizeWeChatGroupReportTemplate(value = '') {
  const id = String(value || '').trim()
  return TEMPLATE_IDS.includes(id) ? id : 'guochao-red-gold'
}

function esc(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shortName(value = '', max = 8) {
  const text = String(value || '未知成员').trim() || '未知成员'
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function formatTime(value = '') {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).replace('T', ' ').slice(0, 16)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function weekday(value = '') {
  const d = value ? new Date(value) : new Date()
  if (Number.isNaN(d.getTime())) return '今日'
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
}

function first(rows = []) {
  return Array.isArray(rows) && rows.length ? rows[0] : { name: '暂无', value: 0 }
}

function rankRows(rows = [], unit = '次', notes = []) {
  const safe = Array.isArray(rows) ? rows.slice(0, 5) : []
  if (!safe.length) return '<div class="empty-state">暂无数据 · 等待群友上榜</div>'
  return safe.map((row, i) => `<div class="rank-row ${i === 0 ? 'first' : ''}">
    <i>${i + 1}</i><span>${esc(shortName(row.name, 9))}</span><b>${esc(row.value || 0)}${unit}</b><em>${esc(notes[i] || '继续冲榜')}</em>
  </div>`).join('')
}

function board(title, icon, rows, unit, notes, cls = '') {
  return `<section class="board ${cls}"><h3><em>${icon}</em><span>${esc(title)}</span><small>TOP 5</small></h3>${rankRows(rows, unit, notes)}</section>`
}

function metricCards(metrics) {
  return metrics.map(m => `<div class="metric"><span>${esc(m.label)}</span><b>${esc(m.value)}</b><small>${esc(m.unit)}</small><em>${esc(m.tip)}</em></div>`).join('')
}

function champCards(champs) {
  return champs.map((c, i) => `<div class="champ"><strong>${String(i + 1).padStart(2, '0')}</strong><small>${esc(c.title)}</small><b>${esc(shortName(c.name, 8))}</b><span>${esc(c.value)}</span><em>${esc(c.note)}</em></div>`).join('')
}

function hotTags(tags) { return tags.slice(0, 8).map(t => `<span>${esc(t)}</span>`).join('') }
function moments(items) { return items.slice(0, 6).map((t, i) => `<div class="moment"><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(t)}</span></div>`).join('') }
function bars(items) { return items.slice(0, 5).map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i><u style="width:${Math.max(8, Math.min(100, Number(v || 0)))}%"></u></i><b>${esc(v)}</b></div>`).join('') }

function buildData(stats = {}) {
  const totals = stats.totals || {}
  const boards = stats.leaderboards || {}
  const msg = first(boards.messages)
  const img = first(boards.images)
  const link = first(boards.links)
  const emoji = first(boards.emojis)
  const brag = first(boards.brag)
  const from = formatTime(stats.from)
  const to = formatTime(stats.to)
  return {
    group: stats.group_name || stats.group_id || '本群',
    date: (from || to || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    weekday: weekday(stats.to || stats.from),
    range: `${from.slice(11) || '00:00'} - ${to.slice(11) || '现在'}`,
    metrics: [
      { label: '消息', value: totals.message_count || 0, unit: '条', tip: '水群热度' },
      { label: '参与', value: totals.participant_count || 0, unit: '人', tip: '在线冒泡' },
      { label: '图片', value: totals.image_count || 0, unit: '张', tip: '图力输出' },
      { label: '表情', value: totals.emoji_count || 0, unit: '个', tip: '无声控场' },
      { label: '链接', value: totals.link_count || 0, unit: '条', tip: '情报搬运' },
      { label: '装逼', value: totals.brag_count || 0, unit: '次', tip: '高光发言' },
    ],
    boards,
    champs: [
      { title: '话痨王', name: msg.name || '暂无', value: `${msg.value || 0} 条发言`, note: '键盘冒烟，稳定输出' },
      { title: '图王', name: img.name || '暂无', value: `${img.value || 0} 张图片`, note: '素材库疑似开闸' },
      { title: '链接王', name: link.name || '暂无', value: `${link.value || 0} 条链接`, note: '群内情报中枢' },
      { title: '表情王', name: emoji.name || '暂无', value: `${emoji.value || 0} 个表情`, note: '不说话也能赢' },
    ],
    hot: ['老板椅文学', 'NAS 玄学', '表情包连击', '链接轰炸', '赛博加班', '摸鱼不打烊', '键盘冒烟', '群内显眼包'],
    moments: [
      `${shortName(msg.name, 6)}：发言 ${msg.value || 0}，嘴替本替`,
      `${shortName(img.name, 6)}：发图 ${img.value || 0}，素材开闸`,
      `${shortName(link.name, 6)}：链接上榜，情报搬运`,
      `${shortName(brag.name, 6)}：高光整活，低调失败`,
      `${shortName(emoji.name, 6)}：表情控场，无声输出`,
      `全群 ${totals.participant_count || 0} 人：今日热闹达标`,
    ],
    bars: [['活跃度', Math.min(99, Math.round((totals.message_count || 0) / 15))], ['梗密度', 88], ['摸鱼值', 76], ['情报量', Math.min(99, Math.round((totals.link_count || 0) * 2))], ['整活度', 79]],
  }
}

const commonCss = `
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px;overflow:hidden}body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}.poster{position:relative;width:1080px;height:1350px;overflow:hidden}.safe{position:relative;z-index:2}.metric,.champ,.board,.panel,.note,.fillcard,.story,.column,.edict,.seal-card{min-width:0;overflow:hidden}.metric span,.metric small,.metric em{display:block}.metric b{display:block}.metric em,.champ em,.rank-row em{font-style:normal}.board h3{margin:0;display:flex;align-items:center;gap:7px}.board h3 em{font-style:normal}.board h3 small{margin-left:auto}.rank-row{display:grid;grid-template-columns:25px minmax(48px,.9fr) 62px minmax(0,1fr);align-items:center;gap:7px;line-height:1.12}.rank-row i{font-style:normal;font-weight:950;text-align:center}.rank-row span,.rank-row b,.rank-row em{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.empty-state{height:78px;display:grid;place-items:center;text-align:center;font-weight:950;opacity:.72;border-top:1px dashed currentColor;margin-top:8px}.tags{display:flex;flex-wrap:wrap;justify-content:center;gap:7px}.moment{display:grid;grid-template-columns:31px minmax(0,1fr);align-items:center}.moment span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar{display:grid;grid-template-columns:58px 1fr 30px;align-items:center;gap:9px}.bar span,.bar b{font-weight:950;white-space:nowrap}.bar i{height:10px;border-radius:99px;overflow:hidden}.bar u{display:block;height:100%;border-radius:99px}.footer{position:absolute;z-index:2;left:54px;right:54px;bottom:30px;display:flex;justify-content:space-between;align-items:center}.grain:after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.1;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='80' height='80' filter='url(%23n)' opacity='.28'/%3E%3C/svg%3E")}.filldeck{display:grid;grid-template-columns:1.2fr .9fr .9fr;gap:12px}.fillcard{border-radius:20px;padding:14px 16px;text-align:center}.fillcard h3{margin:0 0 9px;font-size:20px}.fillcard p{margin:0;font-size:13px;font-weight:850;line-height:1.42}.fillcard ul{margin:0;padding:0;list-style:none;display:grid;gap:5px}.fillcard li{font-size:13px;font-weight:900}@media (max-width:1079px){body{transform:scale(calc(100vw / 1080));transform-origin:top left}}
`

function commonBlocks(d) {
  const b = d.boards || {}
  return {
    metrics: metricCards(d.metrics),
    champs: champCards(d.champs),
    msgBoard: board('发言榜','💬',b.messages,'条',['稳定输出','句句在线','躺着上榜','浪花一朵','吹过留痕'],'msg'),
    imgBoard: board('发图榜','🖼️',b.images,'张',['图片洪峰','边聊边发','素材在线','可爱火力','随手一张'],'img'),
    emojiBoard: board('表情榜','😁',b.emojis,'个',['法师开大','用图说话','双修选手','咸鱼翻身','萌系火力'],'emoji'),
    bragBoard: board('装逼榜','😎',b.brag,'次',['逼格在线','关键三分','轻轻一秀','可爱实力','低频高光'],'brag'),
    tags: hotTags(d.hot),
    moments: moments(d.moments),
    bars: bars(d.bars),
  }
}

function fillDeck(theme = '') {
  return `<div class="safe filldeck ${theme}"><div class="fillcard big"><h3>🧠 群聊复盘</h3><p>关键词：高频输出、图片补刀、表情控场。今日群聊热闹达标，但榜单仍留给明天翻盘。</p></div><div class="fillcard"><h3>🎯 明日攻略</h3><ul><li>潜水员先冒泡</li><li>表情包别省着</li><li>链接记得带瓜</li></ul></div><div class="fillcard"><h3>⚠️ 温馨提示</h3><p>榜单只记热闹；如有不服，请用消息数量说话。</p></div></div>`
}

const css = {
  'guochao-red-gold': `.poster{padding:32px 44px;color:#ffe9b0;background:radial-gradient(circle at 18% 8%,rgba(255,216,101,.25),transparent 22%),radial-gradient(circle at 88% 32%,rgba(255,127,62,.18),transparent 20%),linear-gradient(145deg,#4d0508,#b80f17 48%,#330407)}.poster:before{content:"";position:absolute;inset:22px;border:3px solid rgba(255,213,100,.42);border-radius:34px}.poster:after{content:"";position:absolute;inset:0;opacity:.16;background-image:linear-gradient(90deg,rgba(255,219,120,.55) 1px,transparent 1px),linear-gradient(rgba(255,219,120,.5) 1px,transparent 1px);background-size:74px 74px}.head{display:grid;grid-template-columns:160px 1fr 160px;align-items:center;gap:14px;text-align:center}.badge{height:126px;border:3px solid #ffd66f;border-radius:50%;display:grid;place-items:center;color:#ffd66f;font-size:25px;font-weight:1000;background:rgba(50,0,0,.42)}.plaque{display:inline-block;background:linear-gradient(#3b0602,#150201);border:4px solid #ffd66f;border-radius:22px;padding:13px 44px;box-shadow:0 12px 0 rgba(32,0,0,.35)}.k{font-size:21px;font-weight:1000;letter-spacing:.26em}.title{font-family:"Songti SC","STSong",serif;font-size:72px;line-height:1;font-weight:950;color:#fff4c8}.sub{font-size:21px;font-weight:950;color:#ffe0a1;margin-top:7px}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-top:20px}.metric{height:102px;border-radius:18px;background:rgba(48,8,5,.84);border:1px solid rgba(255,214,111,.38);text-align:center;padding:10px 8px}.metric span{font-size:15px;font-weight:900}.metric b{font-size:32px;line-height:1}.metric small{font-size:12px;color:#efbd65}.metric em{font-size:11px;margin-top:5px}.heroes{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px;margin-top:14px}.champ{height:126px;border-radius:22px;background:linear-gradient(180deg,rgba(255,214,111,.24),rgba(46,7,5,.9));border:2px solid rgba(255,214,111,.34);padding:13px;text-align:center}.champ:first-child{height:264px;grid-row:span 2;display:flex;flex-direction:column;justify-content:center}.champ:first-child b{font-size:58px}.champ strong{color:#ffd66f}.champ small{font-size:16px;color:#ffd66f;font-weight:950}.champ b{display:block;font-family:"Songti SC",serif;font-size:31px;color:#fff}.champ span{font-size:13px;font-weight:900}.champ em{display:block;font-size:12px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.layout{display:grid;grid-template-columns:1.05fr .8fr;gap:12px;margin-top:12px}.boards{display:grid;grid-template-columns:1fr 1fr;gap:10px}.board{height:204px;border-radius:20px;background:rgba(42,7,5,.86);border:2px solid rgba(255,214,111,.3);padding:13px}.board h3{font-family:"Songti SC",serif;font-size:22px;color:#ffd66f;margin-bottom:7px}.rank-row{height:30px;border-top:1px solid rgba(255,214,111,.14);font-size:12.2px}.side{display:grid;grid-template-rows:112px 145px 145px;gap:10px}.panel{border-radius:20px;background:rgba(255,214,111,.15);border:2px solid rgba(255,214,111,.28);padding:12px}.panel h3{text-align:center;margin:0 0 8px;font-size:21px}.tags span{background:#ffd66f;color:#4c0905;border-radius:999px;padding:6px 10px;font-size:13px;font-weight:950}.moment{height:22px;font-size:11.5px;border-top:1px solid rgba(255,214,111,.13)}.bar{height:23px;font-size:12px}.bar i{background:rgba(255,255,255,.15)}.bar u{background:#ffd66f}.summary{margin-top:12px;height:86px;border-radius:24px;background:#ffd66f;color:#3a0804;display:grid;place-items:center;text-align:center;font-size:24px;font-weight:1000;padding:12px 22px}.summary small{display:block;font-size:13px;margin-top:4px}.filldeck{height:132px;margin-top:10px}.fillcard{background:rgba(42,7,5,.86);border:2px solid rgba(255,214,111,.28);color:#ffe9b0}.footer{font-size:14px;color:#ffd66f}`,
  'editorial-newspaper': `.poster{padding:38px 52px;color:#151515;background:#f4ecd8}.mast{border-top:6px solid #151515;border-bottom:6px solid #151515;padding:12px 0;text-align:center}.paper{font-family:Georgia,serif;font-size:26px;letter-spacing:.24em;font-weight:900}.title{font-family:Georgia,"Songti SC",serif;font-size:78px;line-height:.92;font-weight:950;letter-spacing:-.04em}.title b{color:#a96c12}.sub{margin-top:8px;font-size:18px;font-weight:900}.front{display:grid;grid-template-columns:1.18fr .82fr;gap:16px;margin-top:16px}.story{border:3px solid #151515;background:#fffaf0;padding:18px;height:262px}.story h2{margin:0;font-family:Georgia,serif;font-size:30px}.story b{display:block;font-size:72px;line-height:1;color:#a96c12}.story p{font-size:18px;line-height:1.35;font-weight:850}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}.metric{height:81px;border:2px solid #151515;background:#fffaf0;text-align:center;padding:7px}.metric span{font-size:12px;font-weight:900;color:#666}.metric b{font-size:27px;line-height:1}.metric small{font-size:11px}.metric em{font-size:10px;color:#87570e}.columns{display:grid;grid-template-columns:.84fr 1.16fr .84fr;gap:12px;margin-top:14px}.column{display:grid;gap:10px}.board{height:214px;border:2px solid #151515;background:#fffaf0;padding:12px}.board.big{height:438px}.board h3{font-size:22px;margin-bottom:8px}.rank-row{height:30px;border-top:1px solid #d2c4ad;font-size:12px}.champ{height:102px;border:2px solid #151515;background:#fffaf0;padding:9px;text-align:center}.champ strong{display:none}.champ small{font-size:13px;color:#a96c12;font-weight:950}.champ b{display:block;font-size:25px}.champ span,.champ em{font-size:11px;font-weight:900;display:block}.digest{height:168px;border:3px solid #151515;background:#151515;color:#fffaf0;padding:16px;text-align:center}.digest h3{font-size:25px;margin:0 0 8px;color:#e3b45c}.tags span{border:1px solid #151515;background:#fffaf0;color:#151515;padding:5px 8px;font-size:12px;font-weight:900}.summary{margin-top:14px;height:92px;border-top:4px solid #151515;border-bottom:4px solid #151515;display:grid;place-items:center;text-align:center;font-family:Georgia,serif;font-size:25px;font-weight:900}.summary small{display:block;font-size:13px;color:#666;margin-top:5px}.footer{font-size:13px}`,
  'ancient-scroll': `.poster{padding:34px 50px;color:#45240e;background:radial-gradient(circle at 50% 9%,rgba(255,255,255,.55),transparent 24%),linear-gradient(90deg,#c69a56 0 5%,#fae9bc 13% 87%,#bf904c 95% 100%)}.poster:before{content:"";position:absolute;inset:28px;border:7px double rgba(96,50,17,.34);border-radius:36px}.scroll{display:grid;grid-template-columns:132px 1fr;gap:20px}.vertical{height:1210px;border-right:2px solid rgba(92,49,18,.2);writing-mode:vertical-rl;text-align:center;font-family:"Kaiti SC","Songti SC",serif;font-size:49px;line-height:1.1;font-weight:950;letter-spacing:.08em;color:#6a2b12;padding-top:22px}.vertical b{color:#a51f15}.head{display:grid;grid-template-columns:1fr 120px;align-items:center;gap:14px;text-align:center}.k{font-family:"Songti SC",serif;font-size:22px;letter-spacing:.2em;color:#8a4b19;font-weight:900}.title{font-family:"Songti SC",serif;font-size:64px;font-weight:950}.sub{font-size:19px;font-weight:850;color:#7b5a35}.seal{width:112px;height:112px;border:5px solid #a51f15;color:#a51f15;border-radius:50%;display:grid;place-items:center;font-family:"Kaiti SC",serif;font-size:29px;font-weight:950;transform:rotate(-10deg)}.ribbon{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:18px}.metric{height:93px;border-radius:999px;background:rgba(255,248,220,.78);border:2px solid rgba(111,69,27,.22);text-align:center;padding:9px}.metric span{font-size:13px;font-weight:900}.metric b{font-size:29px;font-family:Georgia,serif}.metric small{font-size:11px}.metric em{display:none}.main{display:grid;grid-template-columns:.82fr 1.18fr;gap:12px;margin-top:14px}.edict{height:448px;border-radius:24px;background:linear-gradient(#fff5cf,#ecca8a);border:2px solid rgba(104,61,20,.28);padding:16px;text-align:center}.champ{height:99px;border-bottom:1px dashed rgba(92,49,18,.25);padding:8px}.champ strong{float:left;color:#a51f15}.champ small{display:block;font-size:15px;font-weight:950;color:#a51f15}.champ b{display:block;font-size:28px;font-family:"Songti SC",serif}.champ span,.champ em{display:block;font-size:11.5px;font-weight:900}.boards{display:grid;grid-template-columns:1fr 1fr;gap:10px}.board{height:219px;border-radius:24px;background:rgba(255,248,220,.83);border:2px solid rgba(111,69,27,.23);padding:12px}.board h3{font-family:"Kaiti SC",serif;font-size:22px;color:#5c2b0e;margin-bottom:7px}.rank-row{height:31px;border-top:1px dashed rgba(99,57,18,.28);font-size:12px}.lower{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px}.note{height:146px;border-radius:22px;background:rgba(255,248,220,.82);border:2px solid rgba(111,69,27,.23);padding:12px}.note h3{margin:0 0 8px;text-align:center;color:#a51f15;font-family:"Kaiti SC",serif;font-size:21px}.tags span{background:#6a2f12;color:#ffe8b0;border-radius:999px;padding:5px 8px;font-size:12px;font-weight:900}.moment{height:21px;font-size:11px;border-top:1px dashed rgba(99,57,18,.2)}.bar{height:22px;font-size:11.5px}.bar i{background:#ead3a0}.bar u{background:#6a2f12}.summary{margin-top:13px;height:92px;border-radius:26px;background:#5c2b0e;color:#ffe8b0;display:grid;place-items:center;text-align:center;font-family:"Kaiti SC",serif;font-size:25px;font-weight:950}.summary small{display:block;font-size:13px;margin-top:4px}.filldeck{height:124px;margin-top:12px}.fillcard{background:rgba(255,248,220,.82);border:2px solid rgba(111,69,27,.22)}.footer{font-family:"Songti SC",serif;font-size:14px}`,
  'ink-wash': `.poster{padding:38px 48px;color:#14231e;background:#edf3ea}.mountain{position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350' viewBox='0 0 1080 1350'%3E%3Crect fill='%23edf3ea' width='1080' height='1350'/%3E%3Cg opacity='.25' fill='%2327352f'%3E%3Cpath d='M-40 410 C120 270 230 360 350 190 C500 -10 650 280 760 150 C900 -5 1000 230 1130 80 L1130 650 L-40 650z'/%3E%3Cpath opacity='.5' d='M-20 760 C150 570 290 690 430 470 C570 280 760 610 890 420 C1010 250 1080 460 1130 360 L1130 1030 L-20 1030z'/%3E%3C/g%3E%3C/svg%3E") center/cover no-repeat}.poster:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.82) 82%)}.head{display:grid;grid-template-columns:1fr 118px;gap:16px;align-items:center}.kicker{font-family:"Kaiti SC",serif;font-size:24px;letter-spacing:.18em;color:#4d675e;font-weight:900}.title{font-family:"Kaiti SC",serif;font-size:72px;line-height:1;font-weight:950}.title b{color:#1f5b47}.sub{font-size:19px;color:#5a7169;font-weight:850}.seal{width:108px;height:108px;border-radius:50%;border:4px solid #b42222;color:#b42222;display:grid;place-items:center;font-family:"Kaiti SC",serif;font-size:29px;font-weight:950;transform:rotate(8deg);background:rgba(255,255,255,.36)}.flow{display:grid;grid-template-columns:.38fr .62fr;gap:16px;margin-top:18px}.left{display:grid;gap:11px}.metric{height:86px;background:rgba(255,255,255,.68);border:1px solid rgba(24,36,31,.16);border-radius:30px 10px 30px 10px;padding:9px 12px;text-align:center}.metric span{font-size:13px;color:#506b61;font-weight:900}.metric b{font-size:30px;font-family:Georgia,serif}.metric small{font-size:11px}.metric em{display:none}.right{display:grid;grid-template-columns:1fr 1fr;gap:10px}.champ{height:132px;background:rgba(255,255,255,.7);border:1px solid rgba(24,36,31,.16);border-radius:14px 32px 14px 32px;padding:12px;text-align:center}.champ strong{color:#b42222}.champ small{display:block;font-family:"Kaiti SC",serif;font-size:17px;color:#1f5b47;font-weight:950}.champ b{display:block;font-size:31px;font-family:"Songti SC",serif}.champ span,.champ em{display:block;font-size:12px;font-weight:900}.boards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.board{height:210px;background:rgba(255,255,255,.74);border:1px solid rgba(24,36,31,.16);border-radius:32px 10px 32px 10px;padding:13px}.board h3{font-family:"Kaiti SC",serif;font-size:23px;color:#1e4e3e;margin-bottom:7px}.rank-row{height:30px;border-top:1px solid rgba(24,36,31,.1);font-size:12px}.notes{display:grid;grid-template-columns:.9fr 1.1fr .9fr;gap:12px;margin-top:14px}.note{height:158px;background:rgba(255,255,255,.72);border:1px solid rgba(24,36,31,.16);border-radius:32px 10px 32px 10px;padding:13px}.note h3{margin:0 0 9px;text-align:center;font-family:"Kaiti SC",serif;font-size:22px;color:#1e4e3e}.tags span{background:#1e4e3e;color:#edf5ec;border-radius:999px;padding:5px 8px;font-size:12px;font-weight:900}.moment{height:22px;font-size:11.2px;border-top:1px solid rgba(24,36,31,.1)}.bar{height:23px;font-size:12px}.bar i{background:#d7e2dc}.bar u{background:#1e4e3e}.summary{margin-top:14px;height:94px;border-radius:34px 10px 34px 10px;background:rgba(21,38,32,.92);color:#edf5ec;display:grid;place-items:center;text-align:center;font-family:"Kaiti SC",serif;font-size:25px;font-weight:950}.summary small{display:block;font-size:13px;color:#c9d6cf;margin-top:4px}.filldeck{height:126px;margin-top:13px}.fillcard{background:rgba(255,255,255,.72);border:1px solid rgba(24,36,31,.16);border-radius:28px 10px 28px 10px}.footer{font-size:14px;color:#587169}`,
}

function renderBody(template, d) {
  const c = commonBlocks(d)
  if (template === 'editorial-newspaper') {
    const top = d.champs[0]
    return `<div class="poster"><div class="safe mast"><div class="paper">BAILONGMA GROUP TIMES</div><div class="title">群聊<b>头版</b></div><div class="sub">${esc(d.group)} · ${esc(d.date)} · ${esc(d.range)} · EXTRA EDITION</div></div><div class="safe front"><div class="story"><h2>HEADLINE · 今日话痨王</h2><b>${esc(shortName(top.name, 9))}</b><p>${esc(top.value)}。编辑部评价：稳定输出，是今日群聊基础设施。</p></div><div class="metrics">${c.metrics}</div></div><div class="safe columns"><div class="column">${c.imgBoard}${c.emojiBoard}</div><div class="column">${c.msgBoard.replace('board msg','board big msg')}</div><div class="column">${c.champs}<div class="digest"><h3>今日热梗</h3><div class="tags">${c.tags}</div></div></div></div><div class="safe summary">今日社论：水群有章法，整活有温度，榜单有江湖。<small>潜水不违法，但容易错过自己被做成梗。</small></div><div class="footer"><span>Editorial Broadsheet</span><b>BaiLongma</b></div></div>`
  }
  if (template === 'ancient-scroll') {
    return `<div class="poster grain"><div class="safe scroll"><div class="vertical"><b>金榜</b><br>今日群聊</div><div><div class="head"><div><div class="k">白龙马自动誊录 · 字字有梗</div><div class="title">值班群战报</div><div class="sub">${esc(d.date)} · ${esc(d.range)} · 诸君请看榜</div></div><div class="seal">群榜</div></div><div class="ribbon">${c.metrics}</div><div class="main"><div class="edict">${c.champs}</div><div class="boards">${c.msgBoard}${c.imgBoard}${c.emojiBoard}${c.bragBoard}</div></div><div class="lower"><div class="note"><h3>热梗签</h3><div class="tags">${c.tags}</div></div><div class="note"><h3>群贤小传</h3>${c.moments}</div><div class="note"><h3>水群脉象</h3>${c.bars}</div></div><div class="summary">今日判词：群贤谈笑有梗，榜上名士各有绝活。<small>不服明日再战；潜水也请潜出水平。</small></div>${fillDeck('scroll-fill')}<div class="footer"><span>卷轴古风 · 榜文版</span><b>BaiLongma</b></div></div></div></div>`
  }
  if (template === 'ink-wash') {
    return `<div class="poster grain"><div class="mountain"></div><div class="safe head"><div><div class="kicker">水墨群山 · 聊天留痕 · 梗不落地</div><div class="title">今日群聊<b>雅集榜</b></div><div class="sub">${esc(d.group)} · ${esc(d.date)} · ${esc(d.range)} · 山水之间全是消息</div></div><div class="seal">水墨</div></div><div class="safe flow"><div class="left">${c.metrics}</div><div class="right">${c.champs}</div></div><div class="safe boards">${c.msgBoard}${c.imgBoard}${c.emojiBoard}${c.bragBoard}</div><div class="safe notes"><div class="note"><h3>今日热梗</h3><div class="tags">${c.tags}</div></div><div class="note"><h3>雅集札记</h3>${c.moments}</div><div class="note"><h3>水群指数</h3>${c.bars}</div></div><div class="safe summary">今日题跋：山色有无中，群聊热闹处；有人刷屏，有人发图，有人默默接住梗。<small>留白已保留，长昵称已安全截断。</small></div>${fillDeck('ink-fill')}<div class="footer"><span>水墨风 · 雅集版</span><b>BaiLongma</b></div></div>`
  }
  return `<div class="poster grain"><div class="safe head"><div class="badge">群榜</div><div><div class="plaque"><div class="k">国潮群聊战报</div><div class="title">今日封神榜</div></div><div class="sub">${esc(d.group)} · ${esc(d.date)} · ${esc(d.range)} · 水群人永不下线</div></div><div class="badge">封神</div></div><div class="safe metrics">${c.metrics}</div><div class="safe heroes">${c.champs}</div><div class="safe layout"><div class="boards">${c.msgBoard}${c.imgBoard}${c.emojiBoard}${c.bragBoard}</div><div class="side"><div class="panel"><h3>🔥 今日热梗弹幕</h3><div class="tags">${c.tags}</div></div><div class="panel"><h3>📜 封神小传</h3>${c.moments}</div><div class="panel"><h3>📊 群聊体征</h3>${c.bars}</div></div></div><div class="safe summary">今日彩头：群里气氛到位，榜上有名者皆是狠人。<small>不服明天继续冲榜；榜单雷达已开机。</small></div>${fillDeck('red-fill')}<div class="footer"><span>国潮红金 · 封神版</span><b>BaiLongma</b></div></div>`
}

export function renderWeChatGroupStatsPosterHtml(stats = {}, { templateId = 'guochao-red-gold' } = {}) {
  const template = normalizeWeChatGroupReportTemplate(templateId)
  const d = buildData(stats)
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=1080,initial-scale=1"><title>${esc(d.group)} 群聊战报</title><style>${commonCss}\n${css[template]}</style></head><body>${renderBody(template, d)}</body></html>`
}
