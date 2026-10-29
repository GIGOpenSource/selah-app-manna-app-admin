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

// ---------- 主题分类（Explore canonical + 历史多语文案）----------
export const TOPIC_CATEGORY_ZH = {
  draw_near: '亲近神',
  health: '健康与身心',
  journey: '旅途之光',
  'Draw near to God': '亲近神',
  'Health and well-being': '健康与身心',
  'Light for your journey': '旅途之光',
  亲近神: '亲近神',
  健康与身心: '健康与身心',
  旅途之光: '旅途之光',
  'Acercarse a Dios': '亲近神',
  'Salud y bienestar': '健康与身心',
  'Luz para tu camino': '旅途之光',
  'Aproximar-se de Deus': '亲近神',
  'Saúde e bem-estar': '健康与身心',
  'Luz para a jornada': '旅途之光',
  神に近づく: '亲近神',
  健康とウェルビーイング: '健康与身心',
  旅路の光: '旅途之光',
  '하나님께 가까이': '亲近神',
  '건강과 웰빙': '健康与身心',
  '여정을 비추는 빛': '旅途之光',
  'اقترب من الله': '亲近神',
  'الصحة والعافية': '健康与身心',
  'نور لرحلتك': '旅途之光',
  'Приблизьтесь к Богу': '亲近神',
  'Здоровье и благополучие': '健康与身心',
  'Свет на твоём пути': '旅途之光',
  'Approche de Dieu': '亲近神',
  'Santé et bien-être': '健康与身心',
  'Lumière pour ton chemin': '旅途之光',
  'Gott nahe kommen': '亲近神',
  'Gesundheit und Wohlbefinden': '健康与身心',
  'Licht für deinen Weg': '旅途之光',
  'Lumapit sa Diyos': '亲近神',
  'Kalusugan at kaginhawahan': '健康与身心',
  'Liwanag sa iyong lakbay': '旅途之光',
  'Avvicinati a Dio': '亲近神',
  'Salute e benessere': '健康与身心',
  'Luce per il tuo cammino': '旅途之光',
}

export const TOPIC_CATEGORY_CANONICAL = [
  { value: 'draw_near', label: '亲近神（draw_near）' },
  { value: 'health', label: '健康与身心（health）' },
  { value: 'journey', label: '旅途之光（journey）' },
]

export const TOPIC_TYPE_SLUGS = [
  { value: 'bible_verses', label: '圣经经文（bible_verses）' },
  { value: 'prayers', label: '祷告（prayers）' },
  { value: 'quotes', label: '语录（quotes）' },
  { value: 'affirmations', label: '肯定语（affirmations）' },
]

const CATEGORY_ALIAS_TO_CANON = (() => {
  const map = {}
  for (const [raw, zh] of Object.entries(TOPIC_CATEGORY_ZH)) {
    const canon = zh === '亲近神' ? 'draw_near' : zh === '健康与身心' ? 'health' : zh === '旅途之光' ? 'journey' : ''
    if (canon) map[String(raw).trim().toLowerCase()] = canon
  }
  map.draw_near = 'draw_near'
  map.health = 'health'
  map.journey = 'journey'
  return map
})()

/** 把历史多语文案收成 canonical key，供表单下拉回填 */
export function canonicalTopicCategory(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  return CATEGORY_ALIAS_TO_CANON[s.toLowerCase()] || CATEGORY_ALIAS_TO_CANON[s] || s
}

// ---------- 标签库主主题（展示用；兼容旧 slug） ----------
export const THEME_TAG_ZH = {
  Prayer: '祷告',
  Family: '家庭',
  'Anxiety Relief': '焦虑缓解',
  Gratitude: '感恩',
  Courage: '勇气',
  'Work & Purpose': '工作与使命',
  Peace: '平安',
  Hope: '盼望',
  Relationships: '人际关系',
  Healing: '医治',
  Faith: '信仰',
  Strength: '力量',
  Love: '爱',
  Guidance: '指引',
  Growth: '成长',
  'Self-Worth': '自我价值',
  // legacy slugs
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

/** @deprecated 使用 THEME_TAG_ZH */
export const INTEREST_TAG_ZH = THEME_TAG_ZH

/** 壁纸 tags：Explore 栏目 ∪ 兴趣标签（软约束，与种子/推荐对齐） */
export const WALLPAPER_TAG_ZH = {
  draw_near: '亲近神',
  health: '健康与身心',
  journey: '旅途之光',
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

/** 信仰类型（引导问卷 / 策略条件）下拉：中文展示，英文值入库 */
export const FAITH_TYPE_OPTIONS = [
  { value: 'new', label: '新约取向（new）' },
  { value: 'old', label: '旧约取向（old）' },
  { value: 'other', label: '其他（other）' },
  { value: 'learning', label: '探索中（learning）' },
]

/** 祷告频率下拉 */
export const PRAYER_FREQ_ZH = {
  daily: '每天',
  weekly: '每周',
  occasionally: '偶尔',
  just_started: '刚开始',
}

export const PRAYER_FREQ_OPTIONS = Object.keys(PRAYER_FREQ_ZH).map((value) => ({
  value,
  label: `${PRAYER_FREQ_ZH[value]}（${value}）`,
}))

/** 主主题下拉（策略条件等；值=标签库英文名） */
export const INTEREST_TAG_OPTIONS = Object.entries(THEME_TAG_ZH)
  .filter(([value]) => value[0] === value[0].toUpperCase())
  .map(([value, zh]) => ({
    value,
    label: `${zh}（${value}）`,
  }))

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
  ar: '阿语',
  ru: '俄语',
  fr: '法语',
  de: '德语',
  fil: '菲律宾语',
  it: '意大利语',
}

/** App 界面语言码（对齐 APP_LANGS） */
export const LANG_CODES = ['en', 'zh', 'es', 'pt', 'ja', 'ko', 'ar', 'ru', 'fr', 'de', 'fil', 'it']

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
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openrouter/free',
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
  'iap_verify_enabled',
  'iap_restore_enabled',
  'iap_unverified_allowed',
  'device_login_enabled',
  'oauth_login_enabled',
  'translate_enabled',
  'pool_rank_enabled',
  'ai_suggest_enabled',
])

/** 其他配置页：数值键 */
export const NUMBER_CONFIG_KEYS = new Set([
  'expose_dedupe_window',
  'cold_start_interest_ratio',
  'cold_start_ops_ratio',
  'pool_hit_ratio',
  'pool_ops_ratio',
  'pool_random_ratio',
  'pool_rank_share_weight',
  'pool_rank_like_weight',
  'pool_rank_half_life_days',
  'pool_rank_window_days',
  'pool_rank_like_alpha',
  'pool_rank_like_beta',
  'pool_rank_share_alpha',
  'pool_rank_share_beta',
  'pool_rank_faith_bonus',
  'vip_daily_quota',
  'trial_days',
  'newcomer_bonus',
  'newcomer_like_goal',
  'checkin_reward',
  'free_quota_cap',
  'ai_temperature',
  'ai_timeout',
  'ai_max_tokens',
  'session_ttl_days',
  'session_remember_days',
])

// ---------- AppConfig 键 ----------
export const CONFIG_KEY_ZH = {
  expose_dedupe_window: 'Feed 曝光去重窗口（已废弃驱动）',
  // 2.0 teaser 键：与 3.0 真能力开关合并兼容，勿再写「仅壳/即将支持」
  widget_teaser_enabled: 'Widget · 真能力兼容开关',
  app_icon_teaser_enabled: 'App 图标 · 真能力兼容开关',
  dynamic_wallpaper_tab_enabled: '动态壁纸 · 真能力兼容开关',
  cold_start_interest_ratio: '旧冷启兴趣比例（只读）',
  cold_start_ops_ratio: '旧冷启运营比例（只读）',
  pool_hit_ratio: '三池·命中比例',
  pool_ops_ratio: '三池·运营推荐比例',
  pool_random_ratio: '三池·纯随机比例',
  pool_rank_enabled: '同池互动排序开关',
  pool_rank_share_weight: '同池·分享权重',
  pool_rank_like_weight: '同池·点赞权重',
  pool_rank_half_life_days: '同池·半衰期(天)',
  pool_rank_window_days: '同池·统计天数',
  pool_rank_like_alpha: '同池·点赞平滑分子',
  pool_rank_like_beta: '同池·点赞平滑分母',
  pool_rank_share_alpha: '同池·分享平滑分子',
  pool_rank_share_beta: '同池·分享平滑分母',
  pool_rank_faith_bonus: '同池·信仰微调',
  pool_rank_tie_break: '同池·同分规则',
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
  publisher_name: '发行方名称',
  url_more_apps: '更多应用链接',
  url_download: '分享下载落地页',
  url_app_store: 'iOS App Store 下载链接',
  url_play_store: 'Android Google Play 下载链接',
  url_instagram: 'Instagram 链接',
  url_tiktok: 'TikTok 链接',
  url_facebook: 'Facebook 链接',
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
  ai_api_base: 'AI API Base',
  ai_api_key: 'AI API Key',
  ai_http_referer: 'AI HTTP-Referer',
  ai_http_title: 'AI X-Title',
  ai_temperature: 'AI 温度',
  ai_timeout: 'AI 超时',
  ai_max_tokens: 'AI 最大生成长度',
  ai_system_prompt: 'AI 系统提示词',
  ai_suggest_enabled: 'AI 对话快捷追问',
  ai_greeting: 'AI 欢迎语',
  ai_crisis_footer: 'AI 危机页脚',
  iap_sandbox_allowed: 'IAP 沙盒开关',
  iap_verify_enabled: 'IAP 验单开关',
  iap_restore_enabled: 'IAP 恢复购买开关',
  iap_unverified_allowed: 'IAP 未验签联调',
  device_login_enabled: '设备登录开关',
  oauth_login_enabled: 'Google/Apple 登录开关',
  session_ttl_days: '会话天数',
  session_remember_days: '记住我天数',
  translate_enabled: '经文翻译开关',
  bible_audio_root: '听经音频根目录',
  bible_listen_bg_url: '听经底图',
  manna_quiz_hub_bg_url: 'Quiz枢纽日间底图',
  manna_quiz_hub_bg_night_url: 'Quiz枢纽夜间底图',
  manna_verse_rotate: '今日经文轮换',
  manna_prayer_rotate: '祷告轮换',
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

// ---------- 远程 PUSH ----------

/** 日常 PUSH 时段 key → 当地时刻 / 展示名 */
export const PUSH_SLOT_ZH = {
  morning: '早晨 08:00',
  noon: '中午 12:00',
  afternoon: '傍晚 19:00',
  evening: '夜晚 21:00',
}

export const PUSH_SLOT_OPTIONS = [
  { value: 'morning', label: '早晨 08:00', hour: 8 },
  { value: 'noon', label: '中午 12:00', hour: 12 },
  { value: 'afternoon', label: '傍晚 19:00', hour: 19 },
  { value: 'evening', label: '夜晚 21:00', hour: 21 },
]

/** 运营 PUSH 任务状态 */
export const PUSH_CAMPAIGN_STATUS_ZH = {
  draft: '草稿',
  pending_review: '待审核',
  rejected: '审核驳回',
  approved: '审核通过',
  queued: '待发送',
  sending: '发送中',
  done: '已完成',
  failed: '发送失败',
  expired: '已过期',
}

/** Element Plus Tag type */
export const PUSH_CAMPAIGN_STATUS_TAG = {
  draft: 'info',
  pending_review: 'warning',
  rejected: 'danger',
  approved: '',
  queued: '',
  sending: '',
  done: 'success',
  failed: 'danger',
  expired: 'info',
}

/** 调度模式 once / daily / weekly / monthly */
export const PUSH_SCHEDULE_MODE_ZH = {
  once: '一次',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
}

export const PUSH_SCHEDULE_MODE_OPTIONS = [
  { value: 'once', label: '一次' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
]

/** 周期系列状态（一次任务为空串） */
export const PUSH_SERIES_STATUS_ZH = {
  '': '—',
  active: '进行中',
  paused: '已暂停',
  ended: '已结束',
}

export const PUSH_SERIES_STATUS_TAG = {
  active: 'success',
  paused: 'warning',
  ended: 'info',
}

/** weekdays：0=周一 … 6=周日（与后端约定一致） */
export const PUSH_WEEKDAY_OPTIONS = [
  { value: 0, label: '周一' },
  { value: 1, label: '周二' },
  { value: 2, label: '周三' },
  { value: 3, label: '周四' },
  { value: 4, label: '周五' },
  { value: 5, label: '周六' },
  { value: 6, label: '周日' },
]

export const PUSH_TYPE_ZH = {
  daily: '日常 PUSH',
  campaign: '运营 PUSH',
}

export const PUSH_TARGET_STATUS_ZH = {
  pending: '待发送',
  invalid: '无效',
  no_token: '无 Token',
  skipped: '已跳过',
  success: '成功',
  failed: '失败',
}
