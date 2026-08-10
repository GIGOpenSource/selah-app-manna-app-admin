/**
 * 运营台枚举 / 配置键中文对照与选项常量。
 * value 仍是机器名；展示用 labelZh(map, value) 或专用 helper。
 * 与 backend/tools/selah_enums.py 对齐，禁止运营随意手输枚举值。
 */

export function labelZh(map, value, fallback) {
  const v = String(value ?? '').trim()
  if (!v) return fallback || '—'
  if (map && map[v]) return map[v]
  return fallback != null ? fallback : v
}

/** 表格双行：中文主文 + 英文机器名 */
export function zhEn(zh, en) {
  return { zh: zh || en || '—', en: en || '' }
}

// ---------- 教育夹层 kind ----------
export const INTERSTITIAL_KIND_ZH = {
  personalize_intro: '个性化介绍',
  prefs_intro: '偏好设置介绍',
  value_edu: '价值教育',
  devotion_custom: '灵修定制',
  push_nudge: '推送引导',
  trial_intro: '试用介绍',
}

// ---------- Onboarding question_key ----------
export const ONBOARDING_KEY_ZH = {
  faith_type: '信仰类型',
  prayer_frequency: '祷告频率',
  interest_tags: '兴趣主题',
  basic_info: '基础信息（姓名/性别/年龄）',
  display_basics: '基础信息（旧 key，勿新建）',
  age_range: '年龄段（辅助）',
  acquisition_channel: '获知渠道',
  emotion_status: '情感/关系状态',
  faith_transition: '信仰历程',
  scripture_familiarity: '经文熟悉度',
  faith_practice: '信仰实践',
  closeness_to_god: '与神亲近度',
  denomination_pref: '教派偏好',
  habit_help_style: '习惯帮助方式',
  relationship_with_god: '与神的关系',
  recent_feeling: '最近感受',
  current_struggle: '当前挣扎',
  current_goal: '当前目标',
  legacy_disabled: '已停用旧题',
}

// ---------- 主题分类 ----------
export const TOPIC_CATEGORY_ZH = {
  calm: '平静',
  faith: '信仰',
  emotion: '情绪',
  growth: '成长',
  life: '生活',
  seasonal: '节期',
}

// ---------- 兴趣标签 ----------
export const INTEREST_TAG_ZH = {
  prayer: '祷告',
  family: '家庭',
  anxiety: '焦虑缓解',
  gratitude: '感恩',
  courage: '勇气',
  work: '工作与使命',
  peace: '平安',
  hope: '盼望',
  relationships: '人际关系',
  healing: '医治',
}

/** 壁纸 tags：主题分类 ∪ 兴趣标签（软约束，与种子/推荐对齐） */
export const WALLPAPER_TAG_ZH = {
  ...TOPIC_CATEGORY_ZH,
  ...INTEREST_TAG_ZH,
}

export const WALLPAPER_TAG_OPTIONS = Object.keys(WALLPAPER_TAG_ZH).map((value) => ({
  value,
  label: `${WALLPAPER_TAG_ZH[value]}（${value}）`,
}))

/** 壁纸媒体类型（Selah 3.0） */
export const MEDIA_TYPE_ZH = {
  static: '静态',
  video: '动态',
}

export const MEDIA_TYPE_OPTIONS = Object.keys(MEDIA_TYPE_ZH).map((value) => ({
  value,
  label: `${MEDIA_TYPE_ZH[value]}（${value}）`,
}))

// ---------- 信仰标签 ----------
export const FAITH_TAG_ZH = {
  new: '新约取向',
  old: '旧约取向',
  other: '其他',
  learning: '探索中',
  exploring: '探索中（旧）',
}

// ---------- 举报原因 ----------
export const REPORT_REASON_ZH = {
  inappropriate: '不当内容',
  hate: '仇恨/歧视',
  spam: '垃圾广告',
  copyright: '版权',
  other: '其他',
}

// ---------- 安全类别 ----------
export const SAFETY_CATEGORY_ZH = {
  self_harm: '自残/自杀',
  violence: '暴力/伤害他人',
  illegal: '违法犯罪',
  hate_extremism: '仇恨/极端',
  religion_dispute: '宗教高敏争议',
  medical: '医疗处方级',
}

// ---------- 登录类型 / 会员 ----------
export const LOGIN_TYPE_ZH = {
  device: '设备登录',
  google: 'Google',
  apple: 'Apple',
}

export const VIP_LEVEL_ZH = {
  free: '免费',
  vip: 'VIP',
  plus_vip: 'Plus VIP',
}

export const PLATFORM_ZH = {
  ios: 'iOS',
  android: 'Android',
  '': '全部',
}

export const LANG_ZH = {
  en: '英语',
  zh: '中文',
  es: '西语',
  pt: '葡语',
  ja: '日语',
  ko: '韩语',
}

/** App 界面语言码（对齐 APP_LANGS） */
export const LANG_CODES = ['en', 'zh', 'es', 'pt', 'ja', 'ko']

export function langOptionLabel(code) {
  const zh = LANG_ZH[code]
  return zh ? `${zh}（${code}）` : code
}

export const LANG_OPTIONS = LANG_CODES.map((value) => ({
  value,
  label: langOptionLabel(value),
}))

/** 允许的 App 标识（禁止 allow-create） */
export const APP_KEYS = ['selah', 'manna']

/**
 * Manna 产品内可跳转页（Home 运营卡等）。
 * value = uni-app path；label = 后台中文对照；nav = switchTab | navigateTo。
 * needsId：详情页，客户端用 payload.target_id 拼 ?id=
 */
export const MANNA_APP_ROUTE_OPTIONS = [
  { value: '/pages/home/home', label: '首页（Tab）', nav: 'switchTab', type: 'home' },
  { value: '/pages/quiz/quiz', label: '测验首页（Tab）', nav: 'switchTab', type: 'daily_quiz' },
  { value: '/pages/devotion/list', label: '灵修列表（Tab）', nav: 'switchTab', type: 'daily_devotion' },
  { value: '/pages/bible/bible', label: '圣经阅读（Tab）', nav: 'switchTab', type: 'bible' },
  { value: '/pages/profile/profile', label: '我的（Tab）', nav: 'switchTab', type: 'profile' },
  {
    value: '/pagesA/devotion/detail',
    label: '灵修系列详情',
    nav: 'navigateTo',
    type: 'devotion_detail',
    needsId: true,
    idHint: '填系列 ID（series_id）',
  },
  { value: '/pagesA/quiz/stories', label: '圣经故事列表', nav: 'navigateTo', type: 'story' },
  {
    value: '/pagesA/quiz/play',
    label: '测验答题',
    nav: 'navigateTo',
    type: 'quiz_play',
    needsId: true,
    idHint: '填关卡 ID（level_id）',
  },
  { value: '/pagesA/prayer/prayer', label: '晨晚祷', nav: 'navigateTo', type: 'prayer' },
  { value: '/pagesA/calendar/calendar', label: '日历', nav: 'navigateTo', type: 'calendar' },
  { value: '/pagesA/profile/badges', label: '徽章墙', nav: 'navigateTo', type: 'badges' },
  { value: '/pagesA/profile/collections', label: '收藏', nav: 'navigateTo', type: 'collections' },
  { value: '/pagesA/profile/ledger', label: '积分流水', nav: 'navigateTo', type: 'ledger' },
  { value: '/pagesA/settings/settings', label: '设置', nav: 'navigateTo', type: 'settings' },
  { value: '/pagesA/legal/legal', label: '法务条款', nav: 'navigateTo', type: 'legal' },
]

export function mannaRouteByPath(path) {
  const p = String(path || '').trim()
  return MANNA_APP_ROUTE_OPTIONS.find((r) => r.value === p) || null
}

export const AI_PROVIDER_ZH = {
  openai_compatible: 'OpenAI 兼容',
  mock: 'Mock（无 Key）',
}

export const AI_MODEL_OPTIONS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4.1-mini',
  'gpt-4.1',
  'o4-mini',
]

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD · 美元' },
  { value: 'CNY', label: 'CNY · 人民币' },
  { value: 'EUR', label: 'EUR · 欧元' },
  { value: 'GBP', label: 'GBP · 英镑' },
  { value: 'JPY', label: 'JPY · 日元' },
  { value: 'KRW', label: 'KRW · 韩元' },
  { value: 'HKD', label: 'HKD · 港币' },
  { value: 'SGD', label: 'SGD · 新币' },
  { value: 'AUD', label: 'AUD · 澳元' },
  { value: 'CAD', label: 'CAD · 加元' },
  { value: 'BRL', label: 'BRL · 巴西雷亚尔' },
  { value: 'MXN', label: 'MXN · 墨西哥比索' },
]

/** ISO-2 国家/地区（运营热线、语录国家限制、筛选用） */
export const COUNTRY_ZH = {
  GLOBAL: '全球兜底',
  US: '美国',
  GB: '英国',
  CA: '加拿大',
  AU: '澳大利亚',
  NZ: '新西兰',
  IE: '爱尔兰',
  DE: '德国',
  FR: '法国',
  ES: '西班牙',
  PT: '葡萄牙',
  IT: '意大利',
  NL: '荷兰',
  BE: '比利时',
  CH: '瑞士',
  AT: '奥地利',
  SE: '瑞典',
  NO: '挪威',
  DK: '丹麦',
  FI: '芬兰',
  PL: '波兰',
  BR: '巴西',
  MX: '墨西哥',
  AR: '阿根廷',
  CL: '智利',
  CO: '哥伦比亚',
  JP: '日本',
  KR: '韩国',
  CN: '中国大陆',
  HK: '中国香港',
  TW: '中国台湾',
  SG: '新加坡',
  MY: '马来西亚',
  PH: '菲律宾',
  ID: '印尼',
  TH: '泰国',
  VN: '越南',
  IN: '印度',
  ZA: '南非',
  NG: '尼日利亚',
  KE: '肯尼亚',
  AE: '阿联酋',
  SA: '沙特',
  IL: '以色列',
  RU: '俄罗斯',
  TR: '土耳其',
}

export const COUNTRY_OPTIONS = Object.keys(COUNTRY_ZH).map((value) => ({
  value,
  label: `${COUNTRY_ZH[value]}（${value}）`,
}))

/** 其他配置页：布尔开关键（勿用手输 true/false） */
export const BOOL_CONFIG_KEYS = new Set([
  'widget_teaser_enabled',
  'app_icon_teaser_enabled',
  'dynamic_wallpaper_tab_enabled',
  'like_soft_signal',
  'welcome_enabled',
  'trial_intro_enabled',
  'selah_2_0_features_enabled',
  'selah_3_0_features_enabled',
  'compose_enabled',
  'quiz_enabled',
  'support_selah_enabled',
  'widget_enabled',
  'app_icon_enabled',
  'dynamic_wallpaper_enabled',
  'watch_enabled',
  'checkin_auto_popup',
  'iap_sandbox_allowed',
])

/** 其他配置页：数值键 */
export const NUMBER_CONFIG_KEYS = new Set([
  'expose_dedupe_window',
  'cold_start_interest_ratio',
  'cold_start_ops_ratio',
  'vip_daily_quota',
  'trial_days',
  'newcomer_bonus',
  'newcomer_like_goal',
  'checkin_reward',
  'free_quota_cap',
  'ai_temperature',
  'ai_timeout',
])

// ---------- AppConfig 键 ----------
export const CONFIG_KEY_ZH = {
  expose_dedupe_window: 'Feed 曝光去重窗口',
  // 2.0 teaser 键：与 3.0 真能力开关合并兼容，勿再写「仅壳/即将支持」
  widget_teaser_enabled: 'Widget · 真能力兼容开关',
  app_icon_teaser_enabled: 'App 图标 · 真能力兼容开关',
  dynamic_wallpaper_tab_enabled: '动态壁纸 · 真能力兼容开关',
  cold_start_interest_ratio: '冷启兴趣比例',
  cold_start_ops_ratio: '冷启运营比例',
  like_soft_signal: '点赞软信号',
  welcome_enabled: 'Welcome 开关',
  trial_intro_enabled: '试用夹层开关',
  selah_2_0_features_enabled: '2.0 功能总开关',
  selah_3_0_features_enabled: '3.0 功能总开关',
  compose_enabled: 'Compose 创作开关',
  quiz_enabled: '测验开关',
  support_selah_enabled: 'Support Selah 开关',
  url_rate: '应用商店评分链接',
  compose_entry_label: 'Compose 入口文案',
  support_rate_label: '评分入口文案',
  support_share_label: '分享入口文案',
  support_help_label: '帮助入口文案',
  widget_enabled: 'Widget 真能力开关',
  app_icon_enabled: 'App 图标真能力开关',
  dynamic_wallpaper_enabled: '动态壁纸真能力开关',
  widget_default_theme: 'Widget 默认主题',
  widget_default_border: 'Widget 默认边框',
  widget_default_refresh: 'Widget 默认刷新',
  widget_vip_borders: 'Widget VIP 边框列表',
  watch_enabled: 'Watch 开关',
  brand_name: '品牌名',
  legal_entity_name: '法律主体名',
  support_email: '支持邮箱',
  vip_daily_quota: 'VIP 每日 AI 额度',
  vip_cta_text: 'VIP 按钮文案',
  vip_benefits: 'VIP 权益列表',
  trial_days: '试用天数',
  newcomer_bonus: '新人赠送次数',
  newcomer_like_goal: '新人点赞目标',
  checkin_reward: '打卡奖励次数',
  free_quota_cap: '免费额度上限',
  checkin_auto_popup: '打卡自动弹层',
  ai_provider: 'AI 提供商',
  ai_model: 'AI 模型',
  ai_temperature: 'AI 温度',
  ai_timeout: 'AI 超时',
  ai_system_prompt: 'AI 系统提示词',
  ai_greeting: 'AI 欢迎语',
  ai_crisis_footer: 'AI 危机页脚',
  iap_sandbox_allowed: 'IAP 沙盒开关',
}

export function configKeyZh(key) {
  const k = String(key || '')
  if (CONFIG_KEY_ZH[k]) return CONFIG_KEY_ZH[k]
  if (k.startsWith('safety_cat_') && k.endsWith('_enabled')) {
    const cat = k.slice('safety_cat_'.length, -'_enabled'.length)
    return `${labelZh(SAFETY_CATEGORY_ZH, cat)} · 开关`
  }
  if (k.startsWith('ai_refuse_')) {
    const cat = k.slice('ai_refuse_'.length)
    return `${labelZh(SAFETY_CATEGORY_ZH, cat)} · 拒答文案`
  }
  if (k.startsWith('url_')) return `外链 · ${k.slice(4)}`
  if (k.startsWith('legal_body_')) return `法务正文 · ${k.slice('legal_body_'.length)}`
  if (k.startsWith('iap_')) return `IAP · ${k.slice(4)}`
  return k
}

export function tagsZh(tags, map = INTEREST_TAG_ZH) {
  if (!Array.isArray(tags) || !tags.length) return '—'
  return tags.map((t) => labelZh(map, t)).join('、')
}

export function optionLabelZh(value, enLabel, map) {
  const zh = labelZh(map, value, '')
  if (zh && zh !== value) return `${zh}（${value}）`
  if (enLabel) return `${enLabel}（${value}）`
  return value
}

/** 解析配置编辑值：布尔/数字键强制类型 */
export function parseConfigEdit(key, edit) {
  if (BOOL_CONFIG_KEYS.has(key) || key.startsWith('safety_cat_')) {
    if (typeof edit === 'boolean') return edit
    const s = String(edit).trim().toLowerCase()
    return s === 'true' || s === '1' || s === 'yes'
  }
  if (NUMBER_CONFIG_KEYS.has(key)) {
    const n = Number(edit)
    return Number.isFinite(n) ? n : edit
  }
  if (typeof edit === 'string') {
    try {
      return JSON.parse(edit)
    } catch {
      return edit
    }
  }
  return edit
}
