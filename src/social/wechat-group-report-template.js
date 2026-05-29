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

function shortName(value = '') {
  const text = String(value || '未知成员').trim() || '未知成员'
  return text.length > 8 ? `${text.slice(0, 8)}…` : text
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

function first(rows = []) { return Array.isArray(rows) && rows.length ? rows[0] : { name: '暂无', value: 0 } }

function rankRows(rows = [], unit = '次', notes = []) {
  const safe = Array.isArray(rows) ? rows.slice(0, 5) : []
  if (!safe.length) return '<div class="rank-row empty"><span>暂无数据</span></div>'
  return safe.map((row, i) => `<div class="rank-row ${i === 0 ? 'first' : ''}">
    <i>${i + 1}</i><span>${esc(shortName(row.name))}</span><b>${esc(row.value || 0)}${unit}</b><em>${esc(notes[i] || '继续冲榜')}</em>
  </div>`).join('')
}

function board(title, icon, rows, unit, notes) {
  return `<section class="board"><h3><em>${icon}</em><span>${esc(title)}</span><small>TOP 5</small></h3>${rankRows(rows, unit, notes)}</section>`
}

function metricCards(metrics) {
  return metrics.map(m => `<div class="metric"><span>${esc(m.label)}</span><b>${esc(m.value)}</b><small>${esc(m.unit)}</small><em>${esc(m.tip)}</em></div>`).join('')
}

function champCards(champs) {
  return champs.map((c, i) => `<div class="champ"><strong>0${i + 1}</strong><small>${esc(c.title)}</small><b>${esc(shortName(c.name))}</b><span>${esc(c.value)}</span><em>${esc(c.note)}</em></div>`).join('')
}

function hotTags(tags) { return tags.map(t => `<span>${esc(t)}</span>`).join('') }
function moments(items) { return items.map((t, i) => `<div class="moment"><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(t)}</span></div>`).join('') }
function bars(items) { return items.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i><u style="width:${Math.max(8, Math.min(100, Number(v || 0)))}%"></u></i><b>${esc(v)}</b></div>`).join('') }

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
      { label: '消息', value: totals.message_count || 0, unit: '条', tip: '水群 KPI 已点亮' },
      { label: '参与', value: totals.participant_count || 0, unit: '人', tip: '全员在线冒泡' },
      { label: '图片', value: totals.image_count || 0, unit: '张', tip: '图库开闸放水' },
      { label: '表情', value: totals.emoji_count || 0, unit: '个', tip: '不说话也能输出' },
      { label: '链接', value: totals.link_count || 0, unit: '条', tip: '情报搬运专线' },
      { label: '装逼', value: totals.brag_count || 0, unit: '次', tip: '低调但没完全低调' },
    ],
    boards,
    champs: [
      { title: '话痨王', name: msg.name || '暂无', value: `${msg.value || 0} 条发言`, note: '键盘冒烟但 CPU 很稳' },
      { title: '图王', name: img.name || '暂无', value: `${img.value || 0} 张图片`, note: '素材库疑似开闸放水' },
      { title: '链接王', name: link.name || '暂无', value: `${link.value || 0} 条链接`, note: '群内情报搬运中枢' },
      { title: '表情王', name: emoji.name || '暂无', value: `${emoji.value || 0} 个表情`, note: '不说话也能赢麻了' },
    ],
    hot: ['老板椅文学', 'NAS 玄学', '表情包连击', '链接轰炸', '赛博加班', '摸鱼不打烊', '键盘冒烟', '群内显眼包'],
    moments: [
      `${shortName(msg.name)}：发言 ${msg.value || 0}，嘴替本替`,
      `${shortName(img.name)}：发图 ${img.value || 0}，素材开闸`,
      `${shortName(link.name)}：链接上榜，情报搬运`,
      `${shortName(brag.name)}：高光整活，低调失败`,
      `${shortName(emoji.name)}：表情控场，无声输出`,
      `全群 ${totals.participant_count || 0} 人：今天也很热闹`,
    ],
    bars: [['活跃度', Math.min(99, Math.round((totals.message_count || 0) / 15))], ['梗密度', 88], ['摸鱼值', 76], ['情报量', Math.min(99, Math.round((totals.link_count || 0) * 2))], ['整活度', 79]],
  }
}

const commonCss = `
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}.poster{position:relative;width:1080px;height:1350px;overflow:hidden}.safe{position:relative;z-index:2}.rowish{display:grid}.metric,.champ,.board,.panel,.note,.fillcard{min-width:0;overflow:hidden}.metric span,.metric small,.metric em{display:block}.metric b{display:block}.metric em,.champ em,.rank-row em{font-style:normal}.board h3{margin:0;display:flex;align-items:center;justify-content:center;gap:7px;text-align:center}.board h3 em{font-style:normal}.board h3 small{margin-left:auto}.rank-row{display:grid;grid-template-columns:24px minmax(44px,.9fr) 54px minmax(0,1fr);align-items:center;gap:5px;line-height:1.1}.rank-row i{font-style:normal;font-weight:950;text-align:center}.rank-row span,.rank-row b,.rank-row em{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tags{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}.moment{display:grid;grid-template-columns:30px minmax(0,1fr);align-items:center}.moment span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar{display:grid;grid-template-columns:58px 1fr 30px;align-items:center;gap:9px}.bar span,.bar b{font-weight:950;white-space:nowrap}.bar i{height:10px;border-radius:99px;overflow:hidden}.bar u{display:block;height:100%;border-radius:99px}.footer{position:absolute;z-index:2;left:50px;right:50px;bottom:22px;display:flex;justify-content:space-between;align-items:center}.grain:after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.12;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='80' height='80' filter='url(%23n)' opacity='.28'/%3E%3C/svg%3E")}.filldeck{display:grid;grid-template-columns:1.25fr .85fr .9fr;gap:10px}.fillcard{border-radius:18px;padding:12px 14px;text-align:center}.fillcard h3{margin:0 0 8px;font-size:19px}.fillcard p{margin:0;font-size:12.5px;font-weight:850;line-height:1.38}.fillcard ul{margin:0;padding:0;list-style:none;display:grid;gap:4px}.fillcard li{font-size:12.5px;font-weight:900}.preview-scale{transform-origin:top left}@media (max-width:1079px){body{transform:scale(calc(100vw / 1080));transform-origin:top left}}
`

function fillDeck() {
  return `<div class="safe filldeck"><div class="fillcard big"><h3>🧠 群聊复盘</h3><p>关键词：高频输出、图片补刀、表情控场。今日群聊，热闹达标。</p></div><div class="fillcard"><h3>🎯 明日冲榜攻略</h3><ul><li>潜水员先冒泡</li><li>表情包别省着</li><li>链接记得带瓜</li></ul></div><div class="fillcard"><h3>⚠️ 温馨提示</h3><p>榜单只记热闹；如有不服，请用消息数量说话。</p></div></div>`
}

function commonBlocks(d) {
  const b = d.boards || {}
  return {
    metrics: metricCards(d.metrics),
    champs: champCards(d.champs),
    boards: `${board('发言榜','💬',b.messages,'条',['稳定输出','句句在线','躺着上榜','浪花一朵','吹过留痕'])}${board('发图榜','🖼️',b.images,'张',['图片洪峰','边聊边发','素材在线','可爱火力','随手一张'])}${board('表情榜','😁',b.emojis,'个',['法师开大','用图说话','双修选手','咸鱼翻身','萌系火力'])}${board('装逼榜','😎',b.brag,'次',['逼格在线','关键三分','轻轻一秀','可爱实力','低频高光'])}`,
    tags: hotTags(d.hot),
    moments: moments(d.moments),
    bars: bars(d.bars),
  }
}

const css = {
  'guochao-red-gold': `.poster{padding:30px 42px;color:#fff7df;background:radial-gradient(circle at 50% -10%,rgba(255,226,135,.3),transparent 26%),linear-gradient(145deg,#680b11,#b7151b 47%,#5b080e)}.poster:before{content:"";position:absolute;inset:0;opacity:.22;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='116' height='116'%3E%3Cpath d='M0 58h116M58 0v116M18 18c30 0 30 28 0 28M98 70c-30 0-30 28 0 28' fill='none' stroke='%23ffd36d' stroke-width='2'/%3E%3C/svg%3E")}.frame{position:absolute;inset:24px;border:4px solid rgba(255,211,109,.48);border-radius:28px}.head{text-align:center}.plaque{display:inline-block;min-width:550px;background:linear-gradient(#4b1008,#210705);border:3px solid #ffd36d;border-radius:20px;padding:10px 30px;box-shadow:0 12px 0 rgba(40,0,0,.28)}.k{font-size:21px;color:#ffd36d;font-weight:1000;letter-spacing:.2em}.title{font-family:"Songti SC",serif;font-size:66px;font-weight:950;letter-spacing:.08em;color:#fff0b8}.sub{font-size:21px;color:#ffdda4;font-weight:950;margin-top:6px}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin-top:17px}.metric{height:104px;border-radius:16px;background:rgba(55,14,8,.78);border:1px solid rgba(255,211,109,.36);padding:9px 8px;text-align:center}.metric span{font-size:15px;color:#ffdba0;font-weight:900}.metric b{font-size:31px;line-height:1.02}.metric small{font-size:12px;color:#e8b96a}.metric em{font-size:11px;color:#ffedc4;margin-top:4px;line-height:1.18}.champ-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.champ{height:133px;border-radius:20px;background:linear-gradient(180deg,rgba(255,211,109,.24),rgba(56,13,9,.78));border:2px solid rgba(255,211,109,.32);padding:12px 14px;text-align:center}.champ strong{float:left;color:#ffd36d;font-size:13px}.champ small{display:block;font-size:16px;color:#ffd36d;font-weight:950}.champ b{display:block;font-family:"Songti SC",serif;font-size:31px;margin-top:2px;color:#fff}.champ span{display:block;font-size:13px;color:#ffdba0;font-weight:900}.champ em{display:block;font-size:12px;color:#fff0c1;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.middle{display:grid;grid-template-columns:1fr .74fr;gap:12px;margin-top:12px}.boards{display:grid;grid-template-columns:1fr 1fr;gap:10px}.board{height:223px;border-radius:18px;background:rgba(55,14,8,.78);border:2px solid rgba(255,211,109,.29);padding:12px 14px}.board h3{font-family:"Songti SC",serif;font-size:22px;color:#ffd36d;margin-bottom:6px}.board h3 small{font-size:11px;color:#e8b96a}.rank-row{height:32px;border-top:1px solid rgba(255,211,109,.13);font-size:12.5px}.rank-row i{color:#ffd36d}.rank-row.first span,.rank-row.first b{color:#fff3c8}.side{display:grid;grid-template-rows:126px 158px 158px;gap:10px}.panel{border-radius:18px;background:rgba(255,211,109,.15);border:2px solid rgba(255,211,109,.29);padding:13px}.panel h3{margin:0 0 9px;color:#ffe6a4;font-size:21px;text-align:center}.tags span{padding:6px 10px;border-radius:999px;background:#ffd36d;color:#481006;font-weight:950;font-size:13px}.moment{height:23px;border-top:1px solid rgba(255,211,109,.14);font-size:12px;font-weight:850}.moment b{color:#ffd36d}.bar{height:23px;font-size:12px}.bar i{background:rgba(255,255,255,.16)}.bar u{background:#ffd36d}.summary{margin-top:12px;height:100px;border-radius:22px;background:#ffd36d;color:#3d1008;padding:14px 22px;text-align:center;font-size:24px;font-weight:1000}.summary small{display:block;font-size:14px;color:#7a2b15;margin-top:5px;line-height:1.35}.filldeck{height:154px;margin-top:8px}.fillcard{background:rgba(55,14,8,.78);border:2px solid rgba(255,211,109,.29);color:#fff0c1}.fillcard h3{color:#ffd36d}.footer{font-size:14px;color:#ffdba0}.footer b{color:#ffd36d}`,
  'editorial-newspaper': `.poster{padding:34px 48px;color:#161616;background:#f2ecdf}.mast{display:grid;grid-template-columns:1fr 230px;gap:18px;border-top:5px solid #161616;border-bottom:5px solid #161616;padding:12px 0}.paper{font-family:Georgia,serif;font-size:23px;font-weight:900;letter-spacing:.16em;color:#8a5c18}.title{font-family:Georgia,serif;font-size:70px;line-height:.92;font-weight:900;letter-spacing:-.055em;margin-top:3px}.title b{color:#ad741b}.date{text-align:center;border-left:2px solid #161616;padding-left:18px;display:grid;place-items:center}.date b{display:block;font-size:34px}.date span{font-size:16px;color:#666}.ticker{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.ticker span{border:1px solid #161616;padding:5px 9px;font-size:13px;font-weight:900;color:#ad741b;background:#fffaf0}.metrics{display:grid;grid-template-columns:repeat(6,1fr);border:2px solid #161616;margin-top:14px}.metric{height:100px;border-right:2px solid #161616;padding:8px 9px;background:#fffaf0;text-align:center}.metric:last-child{border-right:0}.metric span{font-size:13px;color:#666;font-weight:900}.metric b{font-size:30px;line-height:1}.metric small{font-size:11px;color:#888}.metric em{font-size:10.5px;color:#8a5c18;font-weight:900;margin-top:5px;line-height:1.16}.lead{display:grid;grid-template-columns:1.06fr .94fr;gap:14px;margin-top:14px}.story{height:220px;border:2px solid #161616;background:#fffaf0;padding:16px 18px;text-align:center}.story h2{font-family:Georgia,serif;font-size:26px;margin:0;color:#ad741b}.story b{display:block;font-size:58px;margin-top:10px}.story p{font-size:18px;font-weight:850;margin:8px 0 0;line-height:1.35}.right-stack{display:grid;grid-template-columns:1fr 1fr;gap:8px}.champ{border:2px solid #161616;background:#fffaf0;padding:10px;height:106px;text-align:center}.champ strong{display:none}.champ small{display:block;font-size:14px;color:#ad741b;font-weight:950}.champ b{display:block;font-size:26px;margin-top:1px}.champ span{display:block;font-size:12px;color:#222;font-weight:900}.champ em{display:block;font-size:10.5px;color:#666;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.content{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.board{height:205px;border:2px solid #161616;background:#fffaf0;padding:10px 12px}.board h3{font-size:21px;margin-bottom:4px}.board h3 small{font-size:10px;color:#777}.rank-row{height:29px;border-top:1px solid #d6cbbb;font-size:12px}.rank-row i,.rank-row.first b{color:#ad741b}.extra{display:grid;grid-template-columns:.78fr 1.22fr;gap:12px;margin-top:12px}.column{border:2px solid #161616;background:#fffaf0;padding:11px 14px;height:142px}.column h3{margin:0 0 7px;color:#ad741b;font-size:20px;text-align:center}.column p{font-weight:850;font-size:14px;line-height:1.34;margin:0 0 4px}.brief{display:grid;grid-template-columns:1fr 1fr;gap:5px}.brief span{display:block;border:1px solid #d6cbbb;padding:5px;font-size:13px;font-weight:850;text-align:center}.summary{margin-top:12px;height:88px;background:#161616;color:#fffaf0;padding:14px 20px;text-align:center;font-family:Georgia,serif;font-size:24px;font-weight:900}.summary small{display:block;color:#d6cbbb;font-size:13px;margin-top:4px}.footer{font-size:13px;color:#666}.footer b{color:#161616}`,
  'ancient-scroll': `.poster{padding:32px 48px;color:#3b2411;background:radial-gradient(circle at 50% 8%,rgba(255,255,255,.55),transparent 25%),linear-gradient(90deg,#d0aa6a 0 4%,#fae7b5 9% 91%,#c99f61 96% 100%)}.poster:before{content:"";position:absolute;inset:25px;border:6px double rgba(101,54,19,.36);border-radius:34px;background:linear-gradient(90deg,rgba(92,49,18,.09),transparent 15%,transparent 85%,rgba(92,49,18,.09))}.head{display:grid;grid-template-columns:138px 1fr 128px;gap:14px;align-items:center}.vertical{writing-mode:vertical-rl;font-family:"Kaiti SC","Songti SC",serif;font-size:48px;line-height:1.08;font-weight:950;letter-spacing:.08em;color:#662b13;text-align:center}.vertical b{color:#a72219}.meta{text-align:center}.meta .k{font-family:"Songti SC",serif;font-size:22px;font-weight:900;color:#8a4b19;letter-spacing:.2em}.meta .title{font-family:"Songti SC",serif;font-size:63px;font-weight:950;letter-spacing:.06em;margin-top:5px;color:#4a260e}.meta .sub{font-size:20px;font-weight:850;color:#7b5a35}.seal{width:112px;height:112px;border:5px solid #a72219;color:#a72219;border-radius:50%;display:grid;place-items:center;font-family:"Kaiti SC",serif;font-size:30px;font-weight:950;transform:rotate(-10deg);background:rgba(255,255,255,.2)}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:18px}.metric{height:98px;border-radius:18px;background:rgba(255,248,220,.78);border:2px solid rgba(111,69,27,.23);padding:8px;text-align:center}.metric span{font-size:14px;font-weight:900;color:#7d4a1d}.metric b{font-size:30px;font-family:Georgia,serif;color:#3f220e}.metric small{font-size:11px;color:#8b6740}.metric em{font-size:10.5px;color:#8a4b19;font-weight:850;margin-top:4px;line-height:1.14}.court{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:11px}.champ{height:126px;border-radius:20px;background:linear-gradient(#fff5cf,#edcc8b);border:2px solid rgba(104,61,20,.3);padding:11px 12px;text-align:center}.champ strong{display:none}.champ small{display:block;font-size:16px;font-weight:900;color:#a72219}.champ b{display:block;font-family:"Songti SC",serif;font-size:29px;margin-top:3px}.champ span{display:block;font-size:12px;font-weight:900;color:#7b5a35}.champ em{display:block;font-size:11px;margin-top:4px;color:#6d451f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.main{display:grid;grid-template-columns:1fr .43fr;gap:12px;margin-top:12px}.boards{display:grid;grid-template-columns:1fr 1fr;gap:10px}.board{height:210px;border-radius:21px;background:rgba(255,248,220,.81);border:2px solid rgba(111,69,27,.24);padding:11px 13px}.board h3{font-family:"Kaiti SC",serif;font-size:22px;color:#5c2b0e;margin-bottom:5px}.board h3 small{font-size:10px;color:#8a4b19}.rank-row{height:29px;border-top:1px dashed rgba(99,57,18,.28);font-size:11.7px}.rank-row i{color:#a72219}.rank-row.first span,.rank-row.first b{color:#9d2014}.side{display:grid;grid-template-rows:118px 161px 161px;gap:10px}.note{border-radius:20px;background:rgba(255,248,220,.81);border:2px solid rgba(111,69,27,.24);padding:12px}.note h3{margin:0 0 8px;font-family:"Kaiti SC",serif;font-size:22px;color:#a72219;text-align:center}.tags span{border-radius:999px;background:#6a2f12;color:#ffe8b0;padding:5px 8px;font-size:12px;font-weight:900}.moment{height:23px;border-top:1px dashed rgba(99,57,18,.25);font-size:11.2px;font-weight:850}.moment b{color:#a72219}.bar{height:24px;font-size:12px}.bar i{background:#ead3a0}.bar u{background:#6a2f12}.summary{margin-top:12px;height:96px;border-radius:22px;background:#5c2b0e;color:#ffe8b0;padding:15px 22px;text-align:center;font-family:"Kaiti SC",serif;font-size:25px;font-weight:950}.summary small{display:block;font-size:13px;margin-top:4px;color:#d9bd86}.filldeck{height:150px;margin-top:8px}.fillcard{background:rgba(255,248,220,.82);border:2px solid rgba(111,69,27,.24);color:#5c2b0e}.fillcard h3{font-family:"Kaiti SC",serif;color:#a72219}.footer{font-family:"Songti SC",serif;font-size:14px;color:#75512f}.footer b{color:#9d2014}`,
  'ink-wash': `.poster{padding:32px 46px;color:#14231e;background:#eef2e9}.mountain{position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350' viewBox='0 0 1080 1350'%3E%3Crect fill='%23eef2e9' width='1080' height='1350'/%3E%3Cg opacity='.26' fill='%2327352f'%3E%3Cpath d='M-40 380 C120 270 210 360 330 210 C470 40 610 270 720 170 C850 60 980 200 1120 80 L1120 570 L-40 570z'/%3E%3Cpath opacity='.55' d='M-20 660 C150 520 230 620 360 460 C500 290 650 550 760 400 C890 220 980 460 1120 290 L1120 920 L-20 920z'/%3E%3Cpath opacity='.38' d='M-20 1000 C180 820 280 960 430 750 C570 560 720 840 840 680 C960 510 1020 730 1120 580 L1120 1350 L-20 1350z'/%3E%3C/g%3E%3C/svg%3E") center/cover no-repeat}.poster:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,.72) 83%)}.head{display:grid;grid-template-columns:1fr 124px;gap:16px;align-items:center}.kicker{font-family:"Kaiti SC",serif;font-size:24px;color:#4d675e;font-weight:900;letter-spacing:.18em}.title{font-family:"Kaiti SC",serif;font-size:68px;line-height:1.02;font-weight:950;color:#14231e;margin-top:2px}.title b{color:#1f5b47}.sub{font-size:20px;color:#5a7169;font-weight:850}.seal{width:110px;height:110px;border-radius:50%;border:4px solid #b42222;color:#b42222;display:grid;place-items:center;font-family:"Kaiti SC",serif;font-size:30px;font-weight:950;transform:rotate(8deg);background:rgba(255,255,255,.32)}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:18px}.metric{height:98px;background:rgba(255,255,255,.68);border:1px solid rgba(24,36,31,.18);border-radius:24px 10px 24px 10px;padding:8px;text-align:center}.metric span{font-size:14px;color:#506b61;font-weight:900}.metric b{font-size:30px;font-family:Georgia,serif}.metric small{font-size:11px;color:#6d847c}.metric em{font-size:10.5px;color:#1e4e3e;font-weight:850;margin-top:4px;line-height:1.14}.topline{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:11px}.champ{height:124px;background:rgba(255,255,255,.7);border:1px solid rgba(24,36,31,.17);border-radius:14px 30px 14px 30px;padding:11px 12px;text-align:center}.champ strong{display:none}.champ small{display:block;font-family:"Kaiti SC",serif;font-size:17px;color:#1f5b47;font-weight:950}.champ b{display:block;font-size:30px;font-family:"Songti SC",serif;margin-top:2px}.champ span{display:block;font-size:12px;color:#60766e;font-weight:900}.champ em{display:block;font-size:11px;color:#405b52;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.content{display:grid;grid-template-columns:.43fr 1fr;gap:12px;margin-top:12px}.left{display:grid;grid-template-rows:122px 163px 163px;gap:10px}.note{background:rgba(255,255,255,.7);border:1px solid rgba(24,36,31,.17);border-radius:28px 10px 28px 10px;padding:12px 14px}.note h3{margin:0 0 8px;font-family:"Kaiti SC",serif;font-size:22px;color:#1e4e3e;text-align:center}.tags span{border-radius:999px;background:#1e4e3e;color:#edf5ec;padding:5px 8px;font-size:12px;font-weight:900}.moment{height:23px;border-top:1px solid rgba(24,36,31,.1);font-size:11px;font-weight:850}.moment b{color:#b42222}.bar{height:24px;font-size:12px}.bar i{background:#d7e2dc}.bar u{background:#1e4e3e}.boards{display:grid;grid-template-columns:1fr 1fr;gap:10px}.board{height:224px;background:rgba(255,255,255,.72);border:1px solid rgba(24,36,31,.17);border-radius:28px 10px 28px 10px;padding:12px 13px}.board h3{font-family:"Kaiti SC",serif;font-size:22px;color:#1e4e3e;margin-bottom:5px}.board h3 small{font-size:10px;color:#60766e}.rank-row{height:31px;border-top:1px solid rgba(24,36,31,.1);font-size:11.7px}.rank-row i{color:#b42222}.rank-row.first b{color:#1e4e3e}.summary{margin-top:12px;height:96px;border-radius:32px 10px 32px 10px;background:rgba(21,38,32,.92);color:#edf5ec;padding:14px 22px;text-align:center;font-family:"Kaiti SC",serif;font-size:25px;font-weight:950}.summary small{display:block;font-size:13px;color:#c9d6cf;margin-top:4px}.filldeck{height:150px;margin-top:8px}.fillcard{background:rgba(255,255,255,.72);border:1px solid rgba(24,36,31,.17);border-radius:28px 10px 28px 10px;color:#1e4e3e}.fillcard h3{font-family:"Kaiti SC",serif;color:#1e4e3e}.footer{font-size:14px;color:#587169}.footer b{color:#b42222}`,
}

function renderBody(template, d) {
  const c = commonBlocks(d)
  if (template === 'editorial-newspaper') {
    const top = d.champs[0]
    return `<div class="poster"><div class="safe mast"><div><div class="paper">BAILONGMA GROUP TIMES</div><div class="title">今日群聊<b>头版</b></div><div class="ticker"><span>热梗专栏</span><span>榜单速递</span><span>群友观察</span><span>不服明天再战</span><span>摸鱼指数上涨</span></div></div><div class="date"><div><b>${esc(d.weekday)}</b><span>${esc(d.date)}<br>${esc(d.range)}<br>EXTRA EDITION</span></div></div></div><div class="safe metrics">${c.metrics}</div><div class="safe lead"><div class="story"><h2>HEADLINE · 今日话痨王</h2><b>${esc(shortName(top.name))}</b><p>${esc(top.value)}，编辑部评价：这是群聊基础设施。</p></div><div class="right-stack">${c.champs}</div></div><div class="safe content">${c.boards}</div><div class="safe extra"><div class="column"><h3>快讯九宫格</h3><div class="brief"><span>话痨持续输出</span><span>图片开闸</span><span>链接搬运</span><span>装到了</span><span>潜水观察</span><span>表情稳定</span></div></div><div class="column"><h3>今日社论</h3><p><b>1</b>有人认真输出，有人疯狂贴图，有人用表情包完成精准打击。</p><p><b>2</b>榜单只是一时的，水群才是永恒的。</p><p><b>3</b>少点潜水，多点离谱，多一点大胆想法。</p></div></div><div class="safe summary">今日社论：水群有章法，整活有温度，榜单有江湖。<small>本报郑重声明：潜水不违法，但容易错过自己被做成梗。</small></div><div class="footer"><span>Editorial Newspaper · Dense Frontpage</span><b>BaiLongma</b></div></div>`
  }
  if (template === 'ancient-scroll') {
    return `<div class="poster grain"><div class="safe head"><div class="vertical"><b>金榜</b><br>今日群聊</div><div class="meta"><div class="k">白龙马自动誊录 · 字字有梗</div><div class="title">值班群战报</div><div class="sub">${esc(d.date)} · ${esc(d.range)} · 诸君请看榜</div></div><div class="seal">群榜</div></div><div class="safe metrics">${c.metrics}</div><div class="safe court">${c.champs}</div><div class="safe main"><div class="boards">${c.boards}</div><div class="side"><div class="note"><h3>热梗签</h3><div class="tags">${c.tags}</div></div><div class="note"><h3>群贤小传</h3>${c.moments}</div><div class="note"><h3>水群脉象</h3>${c.bars}</div></div></div><div class="safe summary">今日判词：诸位群贤谈笑有梗，榜上名士各有绝活。<small>不服明日再战；若要潜水，也请潜出水平。</small></div>${fillDeck()}<div class="footer"><span>卷轴古风 · 留白填满版</span><b>BaiLongma</b></div></div>`
  }
  if (template === 'ink-wash') {
    return `<div class="poster grain"><div class="mountain"></div><div class="safe head"><div><div class="kicker">水墨群山 · 聊天留痕 · 梗不落地</div><div class="title">今日群聊<b>雅集榜</b></div><div class="sub">${esc(d.group)} · ${esc(d.date)} · ${esc(d.range)} · 山水之间全是消息</div></div><div class="seal">水墨</div></div><div class="safe metrics">${c.metrics}</div><div class="safe topline">${c.champs}</div><div class="safe content"><div class="left"><div class="note"><h3>今日热梗</h3><div class="tags">${c.tags}</div></div><div class="note"><h3>雅集札记</h3>${c.moments}</div><div class="note"><h3>水群指数</h3>${c.bars}</div></div><div class="boards">${c.boards}</div></div><div class="safe summary">今日题跋：山色有无中，群聊热闹处；有人刷屏，有人发图，有人默默把梗接住。<small>长昵称、长数值已做安全适配。</small></div>${fillDeck()}<div class="footer"><span>水墨风 · 内容充实版</span><b>BaiLongma</b></div></div>`
  }
  return `<div class="poster grain"><div class="frame"></div><div class="safe head"><div class="plaque"><div class="k">国潮群聊战报 · 填满不留白</div><div class="title">今日封神榜</div></div><div class="sub">${esc(d.group)} · ${esc(d.date)} · ${esc(d.range)} · 水群人永不下线</div></div><div class="safe metrics">${c.metrics}</div><div class="safe champ-grid">${c.champs}</div><div class="safe middle"><div class="boards">${c.boards}</div><div class="side"><div class="panel"><h3>🔥 今日热梗弹幕</h3><div class="tags">${c.tags}</div></div><div class="panel"><h3>📜 封神小传</h3>${c.moments}</div><div class="panel"><h3>📊 群聊体征</h3>${c.bars}</div></div></div><div class="safe summary">今日彩头：群里气氛到位，榜上有名者皆是狠人。<small>不服明天继续冲榜；潜水员也别躲，榜单雷达已开机。</small></div>${fillDeck()}<div class="footer"><span>国潮红金 · 内容加密版</span><b>BaiLongma</b></div></div>`
}

export function renderWeChatGroupStatsPosterHtml(stats = {}, { templateId = 'guochao-red-gold' } = {}) {
  const template = normalizeWeChatGroupReportTemplate(templateId)
  const d = buildData(stats)
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=1080,initial-scale=1"><title>${esc(d.group)} 群聊战报</title><style>${commonCss}\n${css[template]}</style></head><body>${renderBody(template, d)}</body></html>`
}
