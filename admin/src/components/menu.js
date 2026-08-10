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
      { index: '/cold-start', title: '冷启池' },
      { index: '/topics', title: '主题' },
      { index: '/wallpapers', title: '壁纸' },
      { index: '/manna/daily-verses', title: '今日经文' },
      { index: '/manna/home-cards', title: 'Home 运营卡' },
      { index: '/manna/bible', title: '圣经译本' },
      { index: '/manna/devotions', title: '灵修课包' },
      { index: '/quizzes', title: 'Selah 测验' },
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
      { index: '/manna/prayers', title: '晨晚祷' },
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

/**
 * 按当前账号权限过滤菜单。
 * - 有 children：先滤子项（子项无 perm 或 set 含其 perm 则保留）；子项全空则整组隐藏；
 *   若父级声明了 perm 且不在 set，整组隐藏。
 * - 无 children：自身有 perm 且不在 set 则隐藏。
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
        const children = item.children.filter((c) => !c.perm || set.has(c.perm))
        if (!children.length) return null
        if (item.perm && !set.has(item.perm)) return null
        return { ...item, children }
      }
      if (item.perm && !set.has(item.perm)) return null
      return item
    })
    .filter(Boolean)
}
