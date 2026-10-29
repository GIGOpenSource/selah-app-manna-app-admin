/**
 * 侧边栏菜单数据与按权限过滤。
 * 按业务类型分组（内容 / 运营 / 会员 / 用户），不按产品拆分。
 * perm 字段对应 auth.permissions；子项可单独声明 perm。
 * 未声明 perm 的子项继承父级：父级有 perm 时整组受父级控制。
 */
export const menuData = [
  {
    title: '数据看板',
    index: '/dashboard',
    icon: 'DataAnalysis',
    perm: 'ops',
  },
  {
    title: '内容管理',
    index: 'content',
    icon: 'Document',
    perm: 'content',
    children: [
      { index: '/quotes', title: '语录' },
      { index: '/wallpapers', title: '壁纸' },
      { index: '/tag-library', title: '隐性标签' },
      { index: '/display-tags', title: '显性标签' },
      // { index: '/topics', title: 'Explore 主题' },
      // { index: '/affirmation-templates', title: '肯定语模板' },
      { index: '/cold-start', title: '首页推荐' },
      { index: '/recommend-strategies', title: '命中策略' },
      { index: '/festival-calendars', title: '节日日历' },
      { index: '/tag-adjacencies', title: '相邻标签' },
      { index: '/recommend-snapshots', title: '推荐快照' },
      { index: '/pool-rank', title: '同池排序' },
      { index: '/widget-cards', title: '小组件配置' },
    ],
  },
  {
    title: 'Selah 测验',
    index: '/quizzes',
    icon: 'Trophy',
    perm: 'content',
  },
  {
    title: 'AI',
    index: 'ai',
    icon: 'ChatDotRound',
    perm: 'ops',
    children: [
      { index: '/ai-provider', title: 'AI模型' },
      { index: '/quick-prompts', title: 'AI开场' },
      { index: '/safety', title: '安全词与热线' },
    ],
  },
  {
    title: '用户引导',
    index: 'guide',
    icon: 'Guide',
    perm: 'ops',
    children: [
      { index: '/welcome', title: '欢迎页' },
      { index: '/onboarding', title: '引导问卷' },
      { index: '/interstitials', title: '教育夹层' },
    ],
  },
  {
    title: '用户运营',
    index: 'growth',
    icon: 'Present',
    perm: 'ops',
    children: [
      { index: '/rewards', title: '签到／使用额度' },
    ],
  },
  {
    // 全员可见；push_ops 角色仅用于「运营 PUSH」审核人，不控制菜单
    title: '远程 PUSH',
    index: 'remote-push',
    icon: 'Bell',
    children: [
      { index: '/push-copies', title: '日常 PUSH 文案库' },
      // { index: '/push-campaigns', title: '运营 PUSH' },
      { index: '/push-logs', title: 'PUSH 记录' },
    ],
  },
  {
    title: '内容安全',
    index: 'safety',
    icon: 'WarningFilled',
    perm: 'content',
    children: [
      { index: '/content-reports', title: '内容举报' },
      { index: '/safety-audits', title: '安全审计', perm: 'ops' },
    ],
  },
  {
    title: 'App配置',
    index: 'appcfg',
    icon: 'Iphone',
    perm: 'ops',
    children: [
      { index: '/app-icons', title: 'App图标' },
      { index: '/features', title: '功能开关' },
      { index: '/configs', title: '其他配置' },
      { index: '/brand-legal', title: '品牌与法务' },
    ],
  },
  {
    title: '会员经营',
    index: 'membership',
    icon: 'Goods',
    perm: 'ops',
    children: [
      { index: '/membership-products', title: '会员 SKU / 权益' },
      { index: '/orders', title: '订单管理' },
    ],
  },
  {
    title: '用户管理',
    index: 'users',
    icon: 'User',
    children: [
      { index: '/app-users', title: 'App 用户', perm: 'app_users' },
      { index: '/user-affirmations', title: '用户肯定语', perm: 'app_users' },
      { index: '/user-collections', title: '用户收藏', perm: 'app_users' },
      { index: '/staff-users', title: '后台用户', perm: 'staff' },
      { index: '/permissions', title: '权限管理', perm: 'permissions' },
    ],
  },
]

export const mannaMenuData = [
  {
    title: '数据看板',
    index: '/dashboard',
    icon: 'DataAnalysis',
    perm: 'ops',
  },
  {
    title: '内容管理',
    index: 'content',
    icon: 'Document',
    perm: 'content',
    children: [
      { index: '/manna/daily-verses', title: '今日经文' },
      { index: '/manna/home-cards', title: 'Home 运营卡' },
      { index: '/manna/bible', title: '圣经译本' },
      { index: '/manna/devotions', title: '灵修课包' },
      { index: '/manna/quiz', title: 'Manna 测验关卡' },
      { index: '/manna/stories', title: '圣经故事' },
      { index: '/manna/testimonies', title: 'Testimony' },
      { index: '/manna/tags', title: '内容 Tag' },
      { index: '/content-reports', title: '内容举报' },
    ],
  },
  {
    title: '运营配置',
    index: 'ops',
    icon: 'Setting',
    perm: 'ops',
    children: [
      { index: '/ai-provider', title: 'AI 模型' },
      { index: '/brand-legal', title: '品牌与法务' },
      { index: '/rewards', title: '签到/额度' },
      { index: '/configs', title: '其他配置' },
      { index: '/onboarding', title: '引导问卷' },
      { index: '/welcome', title: '欢迎页' },
      { index: '/interstitials', title: '教育夹层' },
      { index: '/quick-prompts', title: 'AI 开场' },
      { index: '/affirmation-templates', title: '肯定语模板' },
      { index: '/app-icons', title: 'App图标' },
      // { index: '/manna/prayers', title: '晨晚祷' },
      { index: '/manna/badges', title: '徽章' },
      { index: '/manna/rules', title: '成长规则' },
      { index: '/manna/stats-copies', title: '成长卡文案' },
      { index: '/safety', title: '安全词/热线' },
      { index: '/safety-audits', title: '安全审计' },
    ],
  },
  {
    title: '会员经营',
    index: 'membership',
    icon: 'Goods',
    perm: 'ops',
    children: [
      { index: '/membership-products', title: '会员 SKU / 权益' },
      { index: '/orders', title: '订单管理' },
    ],
  },
  {
    // 用户管理组：父级无统一 perm，由各子项各自声明
    title: '用户管理',
    index: 'users',
    icon: 'User',
    children: [
      { index: '/app-users', title: 'App 用户', perm: 'app_users' },
      { index: '/user-affirmations', title: '用户肯定语', perm: 'app_users' },
      { index: '/user-collections', title: '用户收藏', perm: 'app_users' },
      { index: '/manna/ledger', title: '成长流水', perm: 'app_users' },
      { index: '/staff-users', title: '后台用户', perm: 'staff' },
      { index: '/permissions', title: '权限管理', perm: 'permissions' },
    ],
  },
]

/** 菜单树里所有真实路由 path（以 / 开头） */
export function collectMenuIndexes(menu) {
  const set = new Set()
  for (const item of menu || []) {
    if (item.children) {
      for (const child of item.children) {
        if (child.index && String(child.index).startsWith('/')) set.add(child.index)
      }
    } else if (item.index && String(item.index).startsWith('/')) {
      set.add(item.index)
    }
  }
  return set
}

export function menuHasPath(menu, path) {
  return collectMenuIndexes(menu).has(path)
}

export function menuForApp(app) {
  return app === 'manna' ? mannaMenuData : menuData
}

/** 语录 / 冷启池 / 主题 / 壁纸 / Selah 测验 仅属 Selah，不出现在 Manna 菜单 */
const SELAH_ONLY_PATHS = new Set([
  '/quotes',
  '/cold-start',
  '/recommend-strategies',
  '/festival-calendars',
  '/tag-adjacencies',
  '/recommend-snapshots',
  '/pool-rank',
  '/topics',
  '/wallpapers',
  '/tag-library',
  '/display-tags',
  '/quizzes',
])

/** 圣经译本仅属 Manna（含历史 /bible 别名） */
const MANNA_ONLY_PATHS = new Set(['/bible', '/manna/bible'])

/** 远程 PUSH 仅 Selah */
const SELAH_PUSH_PATHS = new Set(['/push-copies', '/push-campaigns', '/push-logs'])

/** 切换 App 后的落地页：进 Manna 时不停留在 Selah 内容页 / PUSH 页 */
export function landingPathForApp(app, currentPath = '') {
  const path = String(currentPath || '')
  if (app === 'manna') {
    if (path === '/bible') return '/manna/bible'
    if (path.startsWith('/manna/')) return path
    if (SELAH_ONLY_PATHS.has(path) || SELAH_PUSH_PATHS.has(path)) return '/manna/daily-verses'
    if (menuHasPath(mannaMenuData, path)) return path
    return '/manna/daily-verses'
  }
  if (path.startsWith('/manna/') || MANNA_ONLY_PATHS.has(path)) return '/dashboard'
  if (SELAH_ONLY_PATHS.has(path) || SELAH_PUSH_PATHS.has(path) || menuHasPath(menuData, path)) return path
  if (path === '/affirmation-templates') return path
  return '/dashboard'
}

/** perm 可为 string 或 string[]（满足其一即可） */
export function hasMenuPerm(perm, permSet) {
  if (!perm) return true
  if (Array.isArray(perm)) return perm.some((p) => permSet.has(p))
  return permSet.has(perm)
}

/**
 * 按当前账号权限过滤菜单。
 * - 有 children：先滤子项（子项无 perm 或 set 含其 perm 则保留）；子项全空则整组隐藏；
 *   若父级声明了 perm 且不在 set，整组隐藏。
 * - 无 children：自身有 perm 且不在 set 则隐藏。
 * - perm 支持 string | string[]（OR）。
 * @param {Array} menu 原始菜单树
 * @param {string[]} perms 当前权限码
 * @returns {Array} 过滤后的菜单
 */
export function filterMenuByPerms(menu, perms) {
  const set = new Set(perms || [])
  return menu
    .map((item) => {
      if (item.children) {
        // 子项：未写 perm 视为「跟父级走」，只要父级通过就会显示
        const children = item.children.filter((c) => hasMenuPerm(c.perm, set))
        if (!children.length) return null
        if (!hasMenuPerm(item.perm, set)) return null
        return { ...item, children }
      }
      if (!hasMenuPerm(item.perm, set)) return null
      return item
    })
    .filter(Boolean)
}
