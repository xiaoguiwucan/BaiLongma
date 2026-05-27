const DANGEROUS_RULES = [
  { id: 'delete_files', label: '删除/清空/破坏文件', pattern: /(删除|删掉|清空|抹掉|销毁|格式化|rm\s+-rf|trash|wipe|erase).{0,30}(文件|目录|项目|代码|桌面|下载|系统|磁盘|硬盘|home|Users|\/)/iu },
  { id: 'modify_system', label: '修改系统/权限/启动项', pattern: /(sudo|chmod|chown|launchctl|csrutil|spctl|系统设置|开机启动|root|管理员权限|钥匙串|keychain)/iu },
  { id: 'secret_exfiltration', label: '读取/发送密钥隐私', pattern: /(读取|查看|导出|发送|上传|复制).{0,30}(密码|密钥|token|api.?key|cookie|session|ssh|私钥|钥匙串|聊天记录|通讯录|相册|微信文件)/iu },
  { id: 'network_exfiltration', label: '上传/外传本机数据', pattern: /(上传|发到|发送到|传给|post到|curl).{0,40}(http|服务器|网盘|邮箱|telegram|discord|外部|陌生)/iu },
  { id: 'execute_code', label: '执行代码/脚本/命令', pattern: /(执行|运行|跑一下|帮我跑|终端|命令行|shell|bash|zsh|python|node|osascript|powershell|脚本|代码).{0,30}(命令|脚本|代码|安装|执行|运行)?/iu },
  { id: 'install_software', label: '安装/卸载软件或依赖', pattern: /(安装|卸载|升级|brew install|npm install|pip install|curl .*\|.*sh|下载并运行)/iu },
  { id: 'remote_control', label: '远程控制/自动操作电脑', pattern: /(控制|点击|打开|关闭|操作|自动).{0,30}(电脑|浏览器|微信|终端|系统|应用|屏幕|摄像头|麦克风)/iu },
  { id: 'payments', label: '支付/转账/下单', pattern: /(转账|付款|支付|下单|购买|充值|提现|银行卡|支付宝|微信支付|付款码)/iu },
  { id: 'account_ops', label: '账号登录/改密/绑定', pattern: /(登录|改密码|重置密码|绑定|解绑|注销|退出登录|验证码|二次验证|2fa|mfa)/iu },
  { id: 'mass_messaging', label: '批量发消息/骚扰', pattern: /(群发|批量|轰炸|刷屏|拉群|加好友|私信).{0,30}(消息|微信|好友|群|用户)/iu },
]

export function getWeChatCommandGuardRules() {
  return DANGEROUS_RULES.map(({ id, label }) => ({ id, label }))
}

export function checkWeChatGroupCommandSafety(text = '') {
  const value = String(text || '').trim()
  if (!value) return { allowed: true }
  const hits = DANGEROUS_RULES.filter(rule => rule.pattern.test(value)).map(({ id, label }) => ({ id, label }))
  if (!hits.length) return { allowed: true }
  return {
    allowed: false,
    hits,
    reason: `为了保护电脑和账号安全，微信群入口禁止执行此类指令：${hits.map(h => h.label).join('、')}。我可以解释风险、给出安全的手动操作步骤，但不会替你执行。`,
  }
}
