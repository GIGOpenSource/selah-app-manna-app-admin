/**
 * 运营后台路由与权限守卫。
 * 路由 meta.perm 对应权限码；无 token 跳登录，无权限则落到 firstAllowedPath。
 */
import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Layout from '../views/Layout.vue'
import Quotes from '../views/Quotes.vue'
import ColdStart from '../views/ColdStart.vue'
import RecommendStrategies from '../views/RecommendStrategies.vue'
import FestivalCalendars from '../views/FestivalCalendars.vue'
import TagAdjacencies from '../views/TagAdjacencies.vue'
import RecommendSnapshots from '../views/RecommendSnapshots.vue'
import PoolRankConfig from '../views/PoolRankConfig.vue'
import Configs from '../views/Configs.vue'
import Features from '../views/Features.vue'
import BrandLegal from '../views/BrandLegal.vue'
import AiProvider from '../views/AiProvider.vue'
import Rewards from '../views/Rewards.vue'
import Safety from '../views/Safety.vue'
import Onboarding from '../views/Onboarding.vue'
import Welcome from '../views/Welcome.vue'
import Interstitials from '../views/Interstitials.vue'
import Topics from '../views/Topics.vue'
import Wallpapers from '../views/Wallpapers.vue'
import Quizzes from '../views/Quizzes.vue'
import AppIcons from '../views/AppIcons.vue'
import QuickPrompts from '../views/QuickPrompts.vue'
import AppUsers from '../views/AppUsers.vue'
import StaffUsers from '../views/StaffUsers.vue'
import Permissions from '../views/Permissions.vue'
import MembershipProducts from '../views/MembershipProducts.vue'
import Orders from '../views/Orders.vue'
import Dashboard from '../views/Dashboard.vue'
import ContentReports from '../views/ContentReports.vue'
import PushCopies from '../views/PushCopies.vue'
import PushCampaigns from '../views/PushCampaigns.vue'
import PushLogs from '../views/PushLogs.vue'
import WidgetCards from '../views/WidgetCards.vue'
import SafetyAudits from '../views/SafetyAudits.vue'
import UserAffirmations from '../views/UserAffirmations.vue'
import UserCollections from '../views/UserCollections.vue'
import AffirmationTemplates from '../views/AffirmationTemplates.vue'
import MannaDailyVerses from '../views/manna/DailyVerses.vue'
import MannaBible from '../views/manna/Bible.vue'
import MannaDevotions from '../views/manna/Devotions.vue'
import MannaQuiz from '../views/manna/Quiz.vue'
import MannaStories from '../views/manna/Stories.vue'
import MannaPrayers from '../views/manna/Prayers.vue'
import MannaBadges from '../views/manna/Badges.vue'
import MannaRules from '../views/manna/Rules.vue'
import MannaHomeCards from '../views/manna/HomeCards.vue'
import MannaTestimonies from '../views/manna/Testimonies.vue'
import MannaStatsCopies from '../views/manna/StatsCopies.vue'
import MannaTags from '../views/manna/Tags.vue'
import MannaLedger from '../views/manna/Ledger.vue'
import TagLibrary from '../views/TagLibrary.vue'
import DisplayTags from '../views/DisplayTags.vue'
import { useAuthStore } from '../store/auth'

const routes = [
  { path: '/login', component: Login, meta: { title: '登录' } },
  {
    path: '/',
    component: Layout,
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: Dashboard, meta: { title: '数据看板', perm: 'ops' } },
      { path: 'quotes', name: 'quotes', component: Quotes, meta: { title: '语录', perm: 'content' } },
      { path: 'tag-library', name: 'tag-library', component: TagLibrary, meta: { title: '隐性标签', perm: 'content' } },
      { path: 'display-tags', name: 'display-tags', component: DisplayTags, meta: { title: '显性标签', perm: 'content' } },
      { path: 'cold-start', name: 'cold-start', component: ColdStart, meta: { title: '首页推荐', perm: 'content' } },
      { path: 'recommend-strategies', name: 'recommend-strategies', component: RecommendStrategies, meta: { title: '命中策略', perm: 'content' } },
      { path: 'festival-calendars', name: 'festival-calendars', component: FestivalCalendars, meta: { title: '节日日历', perm: 'content' } },
      { path: 'tag-adjacencies', name: 'tag-adjacencies', component: TagAdjacencies, meta: { title: '相邻标签', perm: 'content' } },
      { path: 'recommend-snapshots', name: 'recommend-snapshots', component: RecommendSnapshots, meta: { title: '推荐快照', perm: 'content' } },
      { path: 'pool-rank', name: 'pool-rank', component: PoolRankConfig, meta: { title: '同池排序', perm: 'content' } },
      { path: 'topics', name: 'topics', component: Topics, meta: { title: '主题', perm: 'content' } },
      { path: 'wallpapers', name: 'wallpapers', component: Wallpapers, meta: { title: '壁纸', perm: 'content' } },
      { path: 'bible', name: 'bible', component: MannaBible, meta: { title: '圣经译本', perm: 'content' } },
      { path: 'quizzes', name: 'quizzes', component: Quizzes, meta: { title: 'Selah 测验', perm: 'content' } },
      { path: 'content-reports', name: 'content-reports', component: ContentReports, meta: { title: '内容举报', perm: 'content' } },
      // 远程 PUSH：全员可进；push_ops 仅作审核人角色，不在此鉴权
      { path: 'push-copies', name: 'push-copies', component: PushCopies, meta: { title: '日常 PUSH 文案库' } },
      { path: 'push-campaigns', name: 'push-campaigns', component: PushCampaigns, meta: { title: '运营 PUSH' } },
      { path: 'push-logs', name: 'push-logs', component: PushLogs, meta: { title: 'PUSH 记录' } },
      { path: 'app-icons', name: 'app-icons', component: AppIcons, meta: { title: 'App图标', perm: 'ops' } },
      { path: 'manna/daily-verses', name: 'manna-daily-verses', component: MannaDailyVerses, meta: { title: '今日经文', perm: 'content' } },
      { path: 'manna/home-cards', name: 'manna-home-cards', component: MannaHomeCards, meta: { title: 'Home 运营卡', perm: 'content' } },
      { path: 'manna/bible', name: 'manna-bible', component: MannaBible, meta: { title: '圣经译本', perm: 'content' } },
      { path: 'manna/devotions', name: 'manna-devotions', component: MannaDevotions, meta: { title: '灵修课包', perm: 'content' } },
      { path: 'manna/quiz', name: 'manna-quiz', component: MannaQuiz, meta: { title: 'Manna 测验关卡', perm: 'content' } },
      { path: 'manna/stories', name: 'manna-stories', component: MannaStories, meta: { title: '圣经故事', perm: 'content' } },
      { path: 'manna/prayers', name: 'manna-prayers', component: MannaPrayers, meta: { title: '晨晚祷', perm: 'ops' } },
      { path: 'manna/badges', name: 'manna-badges', component: MannaBadges, meta: { title: '徽章', perm: 'ops' } },
      { path: 'manna/rules', name: 'manna-rules', component: MannaRules, meta: { title: '成长规则', perm: 'ops' } },
      { path: 'manna/testimonies', name: 'manna-testimonies', component: MannaTestimonies, meta: { title: 'Testimony', perm: 'content' } },
      { path: 'manna/stats-copies', name: 'manna-stats-copies', component: MannaStatsCopies, meta: { title: '成长卡文案', perm: 'ops' } },
      { path: 'manna/tags', name: 'manna-tags', component: MannaTags, meta: { title: '内容 Tag', perm: 'content' } },
      { path: 'manna/ledger', name: 'manna-ledger', component: MannaLedger, meta: { title: '成长流水', perm: 'app_users' } },
      { path: 'ai-provider', name: 'ai-provider', component: AiProvider, meta: { title: 'AI 模型', perm: 'ops' } },
      { path: 'brand-legal', name: 'brand-legal', component: BrandLegal, meta: { title: '品牌与法务', perm: 'ops' } },
      { path: 'rewards', name: 'rewards', component: Rewards, meta: { title: '签到/额度', perm: 'ops' } },
      { path: 'widget-cards', name: 'widget-cards', component: WidgetCards, meta: { title: '小组件配置', perm: 'content' } },
      { path: 'features', name: 'features', component: Features, meta: { title: '功能开关', perm: 'ops' } },
      { path: 'configs', name: 'configs', component: Configs, meta: { title: '其他配置', perm: 'ops' } },
      { path: 'onboarding', name: 'onboarding', component: Onboarding, meta: { title: '引导问卷', perm: 'ops' } },
      { path: 'welcome', name: 'welcome', component: Welcome, meta: { title: '欢迎页', perm: 'ops' } },
      { path: 'interstitials', name: 'interstitials', component: Interstitials, meta: { title: '教育夹层', perm: 'ops' } },
      { path: 'safety', name: 'safety', component: Safety, meta: { title: '安全词/热线', perm: 'ops' } },
      { path: 'safety-audits', name: 'safety-audits', component: SafetyAudits, meta: { title: '安全审计', perm: 'ops' } },
      { path: 'quick-prompts', name: 'quick-prompts', component: QuickPrompts, meta: { title: 'AI 开场', perm: 'ops' } },
      { path: 'affirmation-templates', name: 'affirmation-templates', component: AffirmationTemplates, meta: { title: '肯定语模板', perm: 'content' } },
      { path: 'membership-products', name: 'membership-products', component: MembershipProducts, meta: { title: '会员 SKU', perm: 'ops' } },
      { path: 'orders', name: 'orders', component: Orders, meta: { title: '订单管理', perm: 'ops' } },
      { path: 'app-users', name: 'app-users', component: AppUsers, meta: { title: 'App 用户', perm: 'app_users' } },
      { path: 'user-affirmations', name: 'user-affirmations', component: UserAffirmations, meta: { title: '用户肯定语', perm: 'app_users' } },
      { path: 'user-collections', name: 'user-collections', component: UserCollections, meta: { title: '用户收藏', perm: 'app_users' } },
      { path: 'staff-users', name: 'staff-users', component: StaffUsers, meta: { title: '后台用户', perm: 'staff' } },
      { path: 'permissions', name: 'permissions', component: Permissions, meta: { title: '权限管理', perm: 'permissions' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory('/admin'),
  routes,
})

/**
 * 按权限优先级返回登录后默认落地页。
 * 优先级：ops → content → app_users → staff → permissions；全无则回登录。
 * @param {string[]} perms 当前账号权限码数组
 * @returns {string} 路径
 */
function firstAllowedPath(perms) {
  const set = new Set(perms || [])
  if (set.has('ops')) return '/dashboard'
  if (set.has('content')) return '/quotes'
  if (set.has('app_users')) return '/app-users'
  if (set.has('staff')) return '/staff-users'
  if (set.has('permissions')) return '/permissions'
  return '/login'
}

/** meta.perm 支持 string | string[]（满足其一即可） */
function hasRoutePerm(need, perms) {
  if (!need) return true
  if (!perms?.length) return false
  if (Array.isArray(need)) return need.some((p) => perms.includes(p))
  return perms.includes(need)
}

/**
 * 全局前置守卫：
 * 1) 设置 document.title
 * 2) /login 放行（不要求 token）
 * 3) 无 admin_token → 强制跳登录
 * 4) 权限列表空时从 localStorage 水合
 * 5) 目标路由声明了 meta.perm 且账号不具备 → 重定向到 firstAllowedPath
 */
router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '运营'} - Selah`
  // 登录页本身不鉴权
  if (to.path === '/login') {
    next()
    return
  }
  // 未登录：任意业务页都回登录
  if (!localStorage.getItem('admin_token')) {
    next('/login')
    return
  }
  const auth = useAuthStore()
  // Pinia 刷新后内存为空时，从 storage 恢复权限，避免误判无权限
  if (!auth.permissions.length) auth.hydrateFromStorage()
  const perms = auth.permissions
  const need = to.meta.perm
  // 声明了权限码则必须命中；水合后仍为空视为无权限，不放行
  if (need && !hasRoutePerm(need, perms)) {
    const fallback = firstAllowedPath(perms)
    // 避免同路径死循环（如无权限时 fallback 仍是当前页）
    if (fallback === to.path) {
      next('/login')
      return
    }
    next(fallback)
    return
  }
  next()
})

export default router
