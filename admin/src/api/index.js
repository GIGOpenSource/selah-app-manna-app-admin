/**
 * Selah 运营后台 API 封装。
 * 开发环境固定对接测试站；线上跟当前部署域名走。
 * 请求头携带 localStorage.admin_token，业务码非 200/201 时 reject。
 * HTTP 401：清会话并跳登录（token 过期、Redis 丢失、同账号被挤下线）。
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'

function resolveApiBaseURL() {
  // 开发走同源 /api，由 Vite 代理到 https://www.test-selahbible.site，避免浏览器跨域
  if (import.meta.env.DEV) return '/api'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/api`
}

const http = axios.create({
  baseURL: resolveApiBaseURL(),
  timeout: 30000,
})

/** 并发 401 时只跳转一次，避免多接口同时失败刷屏 */
let redirectingToLogin = false

function clearAdminSessionStorage() {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_name')
  localStorage.removeItem('admin_user_id')
  localStorage.removeItem('admin_role')
  localStorage.removeItem('admin_permissions')
}

function redirectToLogin(message) {
  if (redirectingToLogin) return
  if (window.location.pathname === '/admin/login') return
  redirectingToLogin = true
  clearAdminSessionStorage()
  ElMessage.error(message || '登录已失效，请重新登录')
  // 硬跳转：确保路由守卫与 Pinia 内存态一并重置
  window.location.replace('/admin/login')
}

// 请求拦截：把 admin_token 写入 headers.token（后端中间件按此字段鉴权）
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.token = token
  return config
})

async function parseBlobPayload(blob) {
  if (!(blob instanceof Blob)) return blob
  const text = await blob.text()
  try {
    return JSON.parse(text)
  } catch {
    return { message: text || '请求失败' }
  }
}

function isBizJson(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && 'code' in data
}

function settleBiz(data) {
  if (data.code !== 200 && data.code !== 201) {
    if (data.code === 401) redirectToLogin(data.message)
    return Promise.reject(data)
  }
  return data
}

function filenameFromDisposition(header, fallback) {
  if (!header) return fallback
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, ''))
    } catch {
      return star[1].trim()
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header)
  if (quoted) return quoted[1]
  const plain = /filename=([^;]+)/i.exec(header)
  return plain ? plain[1].trim() : fallback
}

function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 响应拦截：业务层约定 { code, results, message }；仅 200/201 视为成功。
// blob 导出：文件直接返回 axios 响应；JSON 包一层业务码时仍按 code 处理。
http.interceptors.response.use(
  async (resp) => {
    if (resp.config.responseType === 'blob') {
      const blob = resp.data
      const type = String(resp.headers['content-type'] || blob?.type || '').toLowerCase()
      if (blob instanceof Blob && type.includes('json')) {
        const data = await parseBlobPayload(blob)
        if (isBizJson(data)) return settleBiz(data)
      }
      return resp
    }
    const data = resp.data
    if (data.code !== 200 && data.code !== 201) {
      if (data.code === 401) redirectToLogin(data.message)
      return Promise.reject(data)
    }
    return data
  },
  async (error) => {
    const status = error?.response?.status
    let payload = error?.response?.data
    if (payload instanceof Blob) payload = await parseBlobPayload(payload)
    if (status === 401) {
      redirectToLogin(payload?.message || payload?.detail || '登录已失效，请重新登录')
    }
    return Promise.reject(payload || error)
  },
)

/* ---------- auth：登录与当前账号 ---------- */

/** 后台账号密码登录，成功后返回 token / 角色 / 权限列表 */
export function adminLogin(username, password) {
  return http.post('/admin-ops/login/', { username, password })
}

/** 拉取当前登录账号信息（角色、权限、用户名），用于刷新会话 */
export function fetchMe() {
  return http.get('/admin-ops/me/')
}

/* ---------- content：语录 / 主题 / 壁纸 / 举报 / 上传 ---------- */

/** 分页/筛选查询语录列表（支持冷启池、语言、分类等 params） */
export function fetchQuotes(params) {
  return http.get('/admin-ops/quotes/', { params })
}

/** 新建或更新单条语录（有 id 则更新） */
export function saveQuote(data) {
  return http.post('/admin-ops/quote-save/', data)
}

/** 删除语录：单条传 id，批量传 ids 数组 */
export function deleteQuote(idOrIds) {
  if (Array.isArray(idOrIds)) {
    return http.post('/admin-ops/quote-delete/', { ids: idOrIds })
  }
  return http.post('/admin-ops/quote-delete/', { id: idOrIds })
}

/** 从回收站恢复语录 */
export function restoreQuote(id) {
  return http.post('/admin-ops/quote-restore/', { id })
}

const IMPORT_TIMEOUT = 120000

/**
 * 以 CSV 文本批量导入语录。
 * mode=create 导入新内容；mode=replace 按 id 替换。任一行失败则整表不导入。
 */
export function importQuotes(csv_text, app_key = 'selah', mode = 'create') {
  return http.post('/admin-ops/quote-import/', { csv_text, app_key, mode }, { timeout: IMPORT_TIMEOUT })
}

/** 上传 Excel/CSV 文件批量导入语录（multipart：file、app_key、mode） */
export function importQuotesFile(file, app_key = 'selah', mode = 'create') {
  const fd = new FormData()
  fd.append('file', file)
  if (app_key) fd.append('app_key', app_key)
  if (mode) fd.append('mode', mode)
  return http.post('/admin-ops/quote-import/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: IMPORT_TIMEOUT,
  })
}

function defaultExportFilename(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`
}

function downloadExportPayload(results, fallbackName) {
  if (typeof results === 'string') {
    triggerBrowserDownload(new Blob([results], { type: 'text/csv;charset=utf-8' }), fallbackName)
    return fallbackName
  }
  if (!results || typeof results !== 'object') return ''
  if (results.url) {
    window.open(results.url, '_blank')
    return results.filename || fallbackName
  }
  const text = results.csv || results.csv_text || results.file_content
  const name = results.filename || fallbackName
  if (typeof text === 'string') {
    triggerBrowserDownload(new Blob([text], { type: 'text/csv;charset=utf-8' }), name)
    return name
  }
  const jsonName = String(name).replace(/\.csv$/i, '.json')
  triggerBrowserDownload(
    new Blob([JSON.stringify(results, null, 2)], { type: 'application/json;charset=utf-8' }),
    jsonName,
  )
  return jsonName
}

async function saveAdminFileResponse(resp, prefix) {
  const fallback = defaultExportFilename(prefix)
  if (resp?.data instanceof Blob) {
    const filename = filenameFromDisposition(resp.headers?.['content-disposition'], fallback)
    triggerBrowserDownload(resp.data, filename)
    return { filename }
  }
  const results = resp?.results ?? resp?.data ?? resp
  const filename = downloadExportPayload(results, fallback)
  if (!filename) throw { message: '导出内容为空' }
  return { filename, results }
}

async function exportAdminFile(path, params, prefix) {
  const resp = await http.get(path, {
    params,
    responseType: 'blob',
    timeout: 120000,
  })
  return saveAdminFileResponse(resp, prefix)
}

/** 批量导出语录（GET 文件流或 JSON 包 CSV） */
export function exportQuotes(params = {}) {
  return exportAdminFile('/admin-ops/quote-export/', params, 'quotes')
}

/** 下载语录导入模板。mode=create 新建表头；mode=replace 含 id 列。 */
export function downloadQuoteImportTemplate(mode = 'create') {
  return exportAdminFile('/admin-ops/quote-import-template/', { mode }, `quote-import-template-${mode}`)
}

/** 翻译预览：不落库。texts 为英文数组，targets 如 ['es','pt']。 */
export function previewTranslate(data) {
  return http.post('/admin-ops/translate-preview/', data)
}

/** 获取内容相关枚举（分类、情绪标签等），供语录/主题表单下拉 */
export function fetchContentEnums() {
  return http.get('/admin-ops/content-enums/')
}

/** 获取主题列表 */
export function fetchTopics(params = {}) {
  return http.get('/admin-ops/topics/', { params })
}

/** 新建或更新主题 */
export function saveTopic(data) {
  return http.post('/admin-ops/topic-save/', data)
}

/** 按 id 删除主题 */
export function deleteTopic(id) {
  return http.post('/admin-ops/topic-delete/', { id })
}

/** 从回收站恢复主题 */
export function restoreTopic(id) {
  return http.post('/admin-ops/topic-restore/', { id })
}

/**
 * 通用文件上传（壁纸图、主题封面等）。
 * @param {File} file 本地文件
 * @param {string} [type='selah'] 上传业务类型，后端按 type 分目录
 */
export function uploadFile(file, type = 'selah') {
  const fd = new FormData()
  fd.append('file', file)
  return http.post('/upload/', fd, {
    params: { type },
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
}

/** 获取壁纸列表 */
export function fetchWallpapers(params = {}) {
  return http.get('/admin-ops/wallpapers/', { params })
}

/** 新建或更新壁纸（含图片 URL、排序、启用状态） */
export function saveWallpaper(data) {
  return http.post('/admin-ops/wallpaper-save/', data)
}

/** 删除壁纸：单条传 id，批量传 ids 数组 */
export function deleteWallpaper(idOrIds) {
  if (Array.isArray(idOrIds)) {
    return http.post('/admin-ops/wallpaper-delete/', { ids: idOrIds })
  }
  return http.post('/admin-ops/wallpaper-delete/', { id: idOrIds })
}

/** 从回收站恢复壁纸 */
export function restoreWallpaper(id) {
  return http.post('/admin-ops/wallpaper-restore/', { id })
}

/** 上传表格替换壁纸（multipart：file、app_key、mode=replace） */
export function importWallpapersFile(file, app_key = 'selah', mode = 'replace') {
  const fd = new FormData()
  fd.append('file', file)
  if (app_key) fd.append('app_key', app_key)
  if (mode) fd.append('mode', mode)
  return http.post('/admin-ops/wallpaper-import/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: IMPORT_TIMEOUT,
  })
}

/** JSON wallpapers 数组批量导入壁纸 */
export function importWallpapersJson(wallpapers, app_key = 'selah') {
  return http.post('/admin-ops/wallpaper-import/', { wallpapers, app_key }, { timeout: IMPORT_TIMEOUT })
}

/** 批量导出壁纸（GET 文件流或 JSON 包 CSV） */
export function exportWallpapers(params = {}) {
  return exportAdminFile('/admin-ops/wallpaper-export/', params, 'wallpapers')
}

/* ---------- tag library：标签类型 / 归类标签 / 前端展示标签 ---------- */

export function fetchTagTypes() {
  return http.get('/admin-ops/tag-types/')
}

export function saveTagType(data) {
  return http.post('/admin-ops/tag-type-save/', data)
}

export function fetchLibraryTags(params = {}) {
  return http.get('/admin-ops/tags/', { params })
}

export function saveLibraryTag(data) {
  return http.post('/admin-ops/tag-save/', data)
}

export function setLibraryTagStatus(id, enabled) {
  return http.post('/admin-ops/tag-status/', { id, enabled })
}

export function deleteLibraryTags(ids) {
  return http.post('/admin-ops/tag-delete/', { ids })
}

export function exportLibraryTags(params = {}) {
  return exportAdminFile('/admin-ops/tag-export/', params, 'tags')
}

export function downloadTagImportTemplate(mode = 'create') {
  return exportAdminFile('/admin-ops/tag-import-template/', { mode }, `tag-import-template-${mode}`)
}

/** 导入二级标签。type 为当前一级 type_key，只写入该一级。 */
export function importTagsFile(file, { mode = 'create', type } = {}) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('mode', mode)
  if (type) fd.append('type', type)
  return http.post('/admin-ops/tag-import/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: IMPORT_TIMEOUT,
  })
}

export function bulkWallpaperTags(data) {
  return http.post('/admin-ops/wallpaper-bulk-tags/', data)
}

export function fetchDisplayTags(kind) {
  return http.get('/admin-ops/display-tags/', { params: { kind } })
}

export function fetchDisplayStructure(kind) {
  return http.get('/admin-ops/display-structure/', { params: { kind } })
}

export function saveDisplayTag(data) {
  return http.post('/admin-ops/display-tag-save/', data)
}

export function setDisplayTagStatus(id, status) {
  return http.post('/admin-ops/display-tag-status/', { id, status })
}

/** 删除显性标签：单条传 id，批量传 ids */
export function deleteDisplayTags(idOrIds) {
  if (Array.isArray(idOrIds)) {
    return http.post('/admin-ops/display-tag-delete/', { ids: idOrIds })
  }
  return http.post('/admin-ops/display-tag-delete/', { id: idOrIds })
}

export function previewDisplayRule(data) {
  return http.post('/admin-ops/display-preview/', data)
}

export function setWallpaperFilterDisplay(tag_id, display_enabled) {
  return http.post('/admin-ops/wallpaper-filter-display/', { tag_id, display_enabled })
}

export function publishDisplayStructure(kind) {
  return http.post('/admin-ops/display-structure-publish/', { kind })
}

export function discardDisplayStructure(kind) {
  return http.post('/admin-ops/display-structure-discard/', { kind })
}

export function moveDisplayStructure(data) {
  return http.post('/admin-ops/display-structure-move/', data)
}

export function bulkQuoteTags(data) {
  return http.post('/admin-ops/quote-bulk-tags/', data)
}

/* ---------- content 3.0：测验 / 题目 ---------- */

/** 分页查询测验套题列表（可按 app_key×language×platform） */
export function fetchQuizzes(params = {}) {
  return http.get('/admin-ops/quizzes/', { params })
}

/** 新建或更新测验套题 */
export function saveQuiz(data) {
  return http.post('/admin-ops/quiz-save/', data)
}

/** 按 id 软删除测验套题 */
export function deleteQuiz(id) {
  return http.post('/admin-ops/quiz-delete/', { id })
}

/** 从回收站恢复测验套题 */
export function restoreQuiz(id) {
  return http.post('/admin-ops/quiz-restore/', { id })
}

/** 按 quiz_id 拉取题目列表 */
export function fetchQuizQuestions(params = {}) {
  return http.get('/admin-ops/quiz-questions/', { params })
}

/** 新建或更新测验题目 */
export function saveQuizQuestion(data) {
  return http.post('/admin-ops/quiz-question-save/', data)
}

/** 按 id 硬删除测验题目 */
export function deleteQuizQuestion(id) {
  return http.post('/admin-ops/quiz-question-delete/', { id })
}

/* ---------- ops 3.0：App 图标 ---------- */

/** 分页查询 App Alternate Icon 目录 */
export function fetchAppIcons(params = {}) {
  return http.get('/admin-ops/app-icons/', { params })
}

/** 新建或更新 App 图标条目 */
export function saveAppIcon(data) {
  return http.post('/admin-ops/app-icon-save/', data)
}

/** 按 id 软删除 App 图标 */
export function deleteAppIcon(id) {
  return http.post('/admin-ops/app-icon-delete/', { id })
}

/* ---------- ops：App 小组件卡片 ---------- */

/** 分页查询小组件卡片（运营台含未启用；传 id 时只返回该条） */
export function fetchWidgetCards(params = {}) {
  return http.get('/admin-ops/widget-cards/', { params })
}

/** 新建或更新小组件卡片（有 id 更新，无 id 新建） */
export function saveWidgetCard(data) {
  return http.post('/admin-ops/widget-cards/', data)
}

/** 按 id 软删除小组件卡片 */
export function deleteWidgetCard(id) {
  return http.post('/admin-ops/widget-card-delete/', { id })
}

/** 分页查询用户内容举报列表 */
export function fetchContentReports(params) {
  return http.get('/admin-ops/content-reports/', { params })
}

/**
 * 更新举报处理状态。
 * @param {number} id 举报记录 id
 * @param {string} status 处理状态（如 reviewed / dismissed）
 * @param {boolean} [soft_delete_quote=false] 为 true 时同时软删除被举报语录
 */
export function updateContentReportStatus(id, status, soft_delete_quote = false) {
  return http.post('/admin-ops/content-report-status/', { id, status, soft_delete_quote })
}

/* ---------- configs：运营配置 / Onboarding / AI 开场 ---------- */

/**
 * 按配置维度拉取运营 KV。
 * 未传 app_key/language/platform → 该维不过滤（browse）；传空串 → 精确全局行。
 * params.keys 可为逗号串或数组，只返回指定键。
 */
export function fetchConfigs(params = {}) {
  const p = { ...params }
  if (Array.isArray(p.keys)) p.keys = p.keys.join(',')
  return http.get('/admin-ops/configs/', { params: p })
}

/**
 * 保存单条运营配置。
 * @param {string} key 配置键
 * @param {*} value 配置值（对象会由后端序列化）
 * @param {string} [remark=''] 备注
 * @param {{app_key?: string, language?: string, platform?: string, priority?: number}} [scope={}] 三维作用域+优先级，空串=全局
 */
export function saveConfig(key, value, remark = '', scope = {}) {
  return http.post('/admin-ops/config-save/', {
    key,
    value,
    remark,
    app_key: scope.app_key ?? '',
    language: scope.language ?? '',
    platform: scope.platform ?? '',
    priority: scope.priority ?? 0,
  })
}

/**
 * 删除某精确维度下的一组配置键（维度打包）。
 * @param {string[]} keys
 * @param {{app_key?: string, language?: string, platform?: string, priority?: number|null}} [scope={}]
 */
export function deleteConfigPack(keys, scope = {}) {
  const body = {
    keys,
    app_key: scope.app_key ?? '',
    language: scope.language ?? '',
    platform: scope.platform ?? '',
  }
  if (scope.priority !== undefined && scope.priority !== null && scope.priority !== '') {
    body.priority = Number(scope.priority)
  }
  return http.post('/admin-ops/config-pack-delete/', body)
}

/** 命中策略列表 */
export function fetchRecommendStrategies(params = {}) {
  return http.get('/admin-ops/recommend-strategies/', { params })
}

/** 推荐策略 v2 默认 schema（新建/重置表单） */
export function fetchRecommendStrategySchema() {
  return http.get('/admin-ops/recommend-strategy-schema/')
}

/** 将库内旧默认策略 action 合并为完整 v2（一次性） */
export function upgradeRecommendStrategyDefault(data = { enabled: true }) {
  return http.post('/admin-ops/recommend-strategy-upgrade-default/', data)
}

/** 保存命中策略 */
export function saveRecommendStrategy(data) {
  return http.post('/admin-ops/recommend-strategy-save/', data)
}

/** 删除命中策略 */
export function deleteRecommendStrategy(id) {
  return http.post('/admin-ops/recommend-strategy-delete/', { id })
}

/** 填充验收用测试策略（幂等） */
export function seedRecommendTestStrategies(scope = {}) {
  return http.post('/admin-ops/recommend-strategies-seed-test/', {
    app_key: scope.app_key ?? '',
    language: scope.language ?? '',
    platform: scope.platform ?? '',
  })
}

/** 节日日历列表 */
export function fetchFestivalCalendars(params = {}) {
  return http.get('/admin-ops/festival-calendars/', { params })
}

/** 保存节日日历 */
export function saveFestivalCalendar(data) {
  return http.post('/admin-ops/festival-calendar-save/', data)
}

/** 写入 Christmas / New Year / Thanksgiving(US) 种子（幂等） */
export function seedFestivalCalendars() {
  return http.post('/admin-ops/festival-calendars-seed/', {})
}

/** 相邻标签列表 */
export function fetchTagAdjacencies(params = {}) {
  return http.get('/admin-ops/tag-adjacencies/', { params })
}

/** 保存相邻标签映射 */
export function saveTagAdjacency(data) {
  return http.post('/admin-ops/tag-adjacency-save/', data)
}

/** 删除相邻标签映射 */
export function deleteTagAdjacency(id) {
  return http.post('/admin-ops/tag-adjacency-delete/', { id })
}

/** 推荐快照（为何推荐） */
export function fetchRecommendSnapshots(params = {}) {
  return http.get('/admin-ops/recommend-snapshots/', { params })
}

/** 立即重算同池得分 */
export function recomputePoolRank() {
  return http.post('/admin-ops/pool-rank-recompute/', {})
}

/** 拉取 Onboarding 问卷题目（可按 app_key/language/platform 维度筛选） */
export function fetchOnboarding(params = {}) {
  return http.get('/admin-ops/onboarding-questions/', { params })
}

/** 保存 Onboarding 题目整包（覆盖当前维度下的题目列表） */
export function saveOnboarding(data) {
  return http.post('/admin-ops/onboarding-questions/', data)
}

/** 拉取 AI 聊天开场快捷提示词列表 */
export function fetchQuickPrompts(params = {}) {
  return http.get('/admin-ops/quick-prompts/', { params })
}

/** 保存 AI 开场快捷提示词（支持按维度） */
export function saveQuickPrompt(data) {
  return http.post('/admin-ops/quick-prompts/', data)
}

/** 拉取冷启 Welcome 屏列表（可按 language/platform） */
export function fetchWelcomeScreens(params = {}) {
  return http.get('/admin-ops/welcome-screens/', { params })
}

/** 保存/删除 Welcome 屏（有 id 更新；delete_id 删除） */
export function saveWelcomeScreen(data) {
  return http.post('/admin-ops/welcome-screens/', data)
}

/** 拉取教育夹层列表（可按 kind / language / platform） */
export function fetchInterstitialScreens(params = {}) {
  return http.get('/admin-ops/interstitial-screens/', { params })
}

/** 保存/删除教育夹层（有 id 更新；delete_id 删除） */
export function saveInterstitialScreen(data) {
  return http.post('/admin-ops/interstitial-screens/', data)
}

/* ---------- safety：安全词 / 热线 / 审计 ---------- */

/** 拉取安全敏感词列表（可按维度筛选） */
export function fetchSafety(params = {}) {
  return http.get('/admin-ops/safety-keywords/', { params })
}

/** 保存安全敏感词配置（命中后 AI 拒答并引导热线） */
export function saveSafety(data) {
  return http.post('/admin-ops/safety-keywords/', data)
}

/** 拉取危机干预热线列表（可按地区/语言） */
export function fetchHotlines(params = {}) {
  return http.get('/admin-ops/hotlines/', { params })
}

/** 保存危机热线条目 */
export function saveHotline(data) {
  return http.post('/admin-ops/hotlines/', data)
}

/** 分页查询安全审计日志（用户触发敏感词的记录） */
export function fetchSafetyAudits(params) {
  return http.get('/admin-ops/safety-audits/', { params })
}

/* ---------- membership：会员 SKU / 订单 ---------- */

/** 拉取会员商品 SKU 列表（含价格、时长、商店商品 ID） */
export function fetchMembershipProducts(params) {
  return http.get('/admin-ops/membership-products/', { params })
}

/** 新建或更新会员 SKU（price_cents 为分单位整数） */
export function saveMembershipProduct(data) {
  return http.post('/admin-ops/membership-product-save/', data)
}

/** 按 id 删除会员 SKU */
export function deleteMembershipProduct(id) {
  return http.post('/admin-ops/membership-product-delete/', { id })
}

/** 分页查询会员订单列表 */
export function fetchOrders(params) {
  return http.get('/admin-ops/orders/', { params })
}

/** 按 id 查询订单详情（含支付流水、用户信息） */
export function fetchOrderDetail(id) {
  return http.get('/admin-ops/order-detail/', { params: { id } })
}

/** 手动更新订单状态（退款/补发等运营操作） */
export function updateOrderStatus(id, status) {
  return http.post('/admin-ops/order-status/', { id, status })
}

/* ---------- stats：数据看板 ---------- */

/**
 * 将看板筛选表单规范为查询 params。
 * from/to、system_lang、register_country、platform、app_key；空值不传。
 */
function statsParams(filters) {
  const params = {}
  if (filters?.from) params.from = filters.from
  if (filters?.to) params.to = filters.to
  if (filters?.system_lang) params.system_lang = filters.system_lang
  if (filters?.register_country) params.register_country = filters.register_country
  if (filters?.platform) params.platform = filters.platform
  if (filters?.app_key) params.app_key = filters.app_key
  return params
}

/** 看板总览 KPI（DAU、新增、收入等汇总卡片） */
export function fetchStatsOverview(filters) {
  return http.get('/admin-ops/stats/overview/', { params: statsParams(filters) })
}

/** 日活趋势序列（折线图数据源） */
export function fetchStatsDau(filters) {
  return http.get('/admin-ops/stats/dau/', { params: statsParams(filters) })
}

/** 新注册用户趋势序列 */
export function fetchStatsNewUsers(filters) {
  return http.get('/admin-ops/stats/new-users/', { params: statsParams(filters) })
}

/** 留存率矩阵（次日/7日/30日等） */
export function fetchStatsRetention(filters) {
  return http.get('/admin-ops/stats/retention/', { params: statsParams(filters) })
}

/** 收入趋势序列（会员付费） */
export function fetchStatsRevenue(filters) {
  return http.get('/admin-ops/stats/revenue/', { params: statsParams(filters) })
}

/** 地理 × 设备分布（国家/平台饼图或柱状） */
export function fetchStatsGeoDevice(filters) {
  return http.get('/admin-ops/stats/geo-device/', { params: statsParams(filters) })
}

/** 系统语言分布统计 */
export function fetchStatsLanguage(filters) {
  return http.get('/admin-ops/stats/language/', { params: statsParams(filters) })
}

/** 订单相关 KPI（成交量、客单价、转化等） */
export function fetchStatsOrdersKpi(filters) {
  return http.get('/admin-ops/stats/orders-kpi/', { params: statsParams(filters) })
}

/** 埋点事件 PV/UV。results 为数组，按 pv 降序；目录内无数据的事件 uv/pv 为 0。 */
export function fetchStatsEvents(filters) {
  const params = statsParams(filters)
  if (filters?.event_name) params.event_name = filters.event_name
  if (filters?.kind) params.kind = filters.kind
  return http.get('/admin-ops/stats/events/', { params })
}

/** 激活漏斗。results.steps：欢迎页 → 协议 → 登录 → 引导 → 首页内容。 */
export function fetchStatsActivationFunnel(filters) {
  return http.get('/admin-ops/stats/funnel/activation/', { params: statsParams(filters) })
}

/** 付费漏斗。results.steps：会员介绍 → 付费墙 → 试用点击 → 购买结果 → 权益生效。 */
export function fetchStatsPaywallFunnel(filters) {
  return http.get('/admin-ops/stats/funnel/paywall/', { params: statsParams(filters) })
}

/** Manna 功课留存（账本 + 活动日 + 测验局） */
export function fetchStatsMannaPractice(filters) {
  return http.get('/admin-ops/stats/manna-practice/', { params: statsParams(filters) })
}

/** Manna 内容打开次数（PV/UV，兴趣筛选看 UV） */
export function fetchStatsMannaContentOpens(filters = {}) {
  const params = {}
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  params.app_key = filters.app_key || 'manna'
  if (filters.language) params.language = filters.language
  if (filters.country) params.country = String(filters.country).toUpperCase()
  if (filters.platform) params.platform = filters.platform
  if (filters.content_type) params.content_type = filters.content_type
  if (filters.limit) params.limit = filters.limit
  return http.get('/admin-ops/stats/manna-content-opens/', { params })
}

/* ---------- users：App 用户 / 后台员工 ---------- */

/** 分页查询 App 端用户列表 */
export function fetchAppUsers(params) {
  return http.get('/admin-ops/app-users/', { params })
}

/** 按 id 查询 App 用户详情（会员状态、配额等） */
export function fetchAppUserDetail(id) {
  return http.get('/admin-ops/app-user-detail/', { params: { id } })
}

/** 保存 App 用户运营字段（备注、标签、手动会员等） */
export function saveAppUser(data) {
  return http.post('/admin-ops/app-user-save/', data)
}

/** 切换 App 用户启用/禁用状态 */
export function toggleAppUserStatus(id) {
  return http.post('/admin-ops/app-user-toggle-status/', { id })
}

/** 分页检索用户自写肯定语 */
export function fetchUserAffirmations(params) {
  return http.get('/admin-ops/user-affirmations/', { params })
}

/** 审核删除用户肯定语 */
export function deleteUserAffirmation(id) {
  return http.post('/admin-ops/user-affirmation-delete/', { id })
}

/** 用户收藏（kind × app_key）；folder 时可带 folder_id 钻取 */
export function fetchUserCollections(params) {
  return http.get('/admin-ops/user-collections/', { params })
}

/** 删除单条：kind=folder_item|like|favorite|highlight|note */
export function deleteUserCollectionItem(id, kind = 'folder_item') {
  return http.post('/admin-ops/user-collection-item-delete/', { id, kind })
}

/** 运营肯定语模板列表 */
export function fetchAffirmationTemplatesAdmin(params) {
  return http.get('/admin-ops/affirmation-templates/', { params })
}

/** 新建/更新肯定语模板（POST 同路径；也可传 delete_id） */
export function saveAffirmationTemplate(data) {
  return http.post('/admin-ops/affirmation-templates/', data)
}

/** 软删除肯定语模板 */
export function deleteAffirmationTemplate(id) {
  return http.post('/admin-ops/affirmation-template-delete/', { id })
}

/** 分页查询后台员工账号列表 */
export function fetchStaffUsers(params) {
  return http.get('/admin-ops/staff-users/', { params })
}

/** 新建或更新后台员工（含角色绑定） */
export function saveStaffUser(data) {
  return http.post('/admin-ops/staff-user-save/', data)
}

/** 切换后台员工启用/禁用状态 */
export function toggleStaffUserStatus(id) {
  return http.post('/admin-ops/staff-user-toggle-status/', { id })
}

/* ---------- rbac：角色权限 ---------- */

/** 拉取角色-权限矩阵（各角色拥有的 perm 码列表） */
export function fetchPermissions() {
  return http.get('/admin-ops/permissions/')
}

/** 整包保存角色权限配置 */
export function savePermissions(roles) {
  return http.post('/admin-ops/permissions/', { roles })
}

/* ---------- Manna：今日经文 / 圣经 / 灵修 / 测验 / 祷告 / 徽章 / 2.0 钩子 ---------- */

/** 分页查询今日经文（app×language×platform） */
export function fetchDailyVerses(params = {}) {
  return http.get('/admin-ops/daily-verses/', { params })
}

/** 新建/更新今日经文；传 delete_id 删除 */
export function saveDailyVerse(data) {
  return http.post('/admin-ops/daily-verses/', data)
}

/** 圣经译本列表 / 保存（delete_id 删除） */
export function fetchBibleTranslations(params = {}) {
  return http.get('/admin-ops/bible-translations/', { params })
}

export function saveBibleTranslation(data) {
  return http.post('/admin-ops/bible-translations/', data)
}

/** 导入单章经文 JSON（translation_code / book_key / chapter_num / verses） */
export function importBibleChapter(data) {
  return http.post('/admin-ops/bible-import-chapter/', data)
}

/** 可导入译本与语言槽（versions / locales） */
export function fetchBibleImportContent(params = {}) {
  return http.get('/admin-ops/bible-import-content/', { params })
}

/** 上传译本 zip。不要手写 Content-Type，交给浏览器带 boundary。 */
export function importBibleZip(formData) {
  return http.post('/admin-ops/bible-import-content/', formData, { timeout: 600000 })
}

/**
 * 听经 mp3 上传到 bible-media/{VERSION}/{gender}/…。
 * 男声写入 audio_url_male，女声写入 audio_url_female。
 */
export function uploadBibleChapterAudio({ id, file, gender, duration_sec, write_url } = {}) {
  const fd = new FormData()
  fd.append('id', id)
  fd.append('file', file)
  if (gender) fd.append('gender', gender)
  if (duration_sec != null && duration_sec !== '') fd.append('duration_sec', String(duration_sec))
  if (write_url) fd.append('write_url', '1')
  return http.post('/admin-ops/bible-chapters/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
}

export function fetchBibleBooks(params = {}) {
  return http.get('/admin-ops/bible-books/', { params })
}

export function saveBibleBook(data) {
  return http.post('/admin-ops/bible-books/', data)
}

export function fetchBibleChapters(params = {}) {
  return http.get('/admin-ops/bible-chapters/', { params })
}

export function saveBibleChapter(data) {
  return http.post('/admin-ops/bible-chapters/', data)
}

export function fetchBibleVerses(params = {}) {
  return http.get('/admin-ops/bible-verses/', { params })
}

export function saveBibleVerse(data) {
  return http.post('/admin-ops/bible-verses/', data)
}

/** 灵修系列 CRUD */
export function fetchDevotionSeries(params = {}) {
  return http.get('/admin-ops/devotion-series/', { params })
}

export function saveDevotionSeries(data) {
  return http.post('/admin-ops/devotion-series/', data)
}

/** 灵修课时 CRUD（可按 series_id 筛选） */
export function fetchDevotionSessions(params = {}) {
  return http.get('/admin-ops/devotion-sessions/', { params })
}

export function saveDevotionSession(data) {
  return http.post('/admin-ops/devotion-sessions/', data)
}

/** Manna 测验关卡 CRUD */
export function fetchMannaQuizLevels(params = {}) {
  return http.get('/admin-ops/manna-quiz-levels/', { params })
}

export function saveMannaQuizLevel(data) {
  return http.post('/admin-ops/manna-quiz-levels/', data)
}

/** Manna 测验题目 CRUD（可按 level_id 筛选） */
export function fetchMannaQuizQuestions(params = {}) {
  return http.get('/admin-ops/manna-quiz-questions/', { params })
}

export function saveMannaQuizQuestion(data) {
  return http.post('/admin-ops/manna-quiz-questions/', data)
}

/** App 圣经译本（选经目录用，不写入题目） */
export function fetchAppBibleTranslations(params = {}) {
  return http.get('/bible/translations/', { params })
}

/** App 书卷目录：book_key / name / chapter_count */
export function fetchAppBibleBooks(params = {}) {
  return http.get('/bible/books/', { params })
}

/** App 单章经文：verses[].verse */
export function fetchAppBibleChapter(params = {}) {
  return http.get('/bible/chapter/', { params })
}

/** 圣经故事卡 CRUD */
export function fetchMannaStories(params = {}) {
  return http.get('/admin-ops/manna-stories/', { params })
}

export function saveMannaStory(data) {
  return http.post('/admin-ops/manna-stories/', data)
}

/** 晨晚祷内容 CRUD */
export function fetchPrayerContents(params = {}) {
  return http.get('/admin-ops/prayer-contents/', { params })
}

export function savePrayerContent(data) {
  return http.post('/admin-ops/prayer-contents/', data)
}

/** 徽章定义 CRUD */
export function fetchBadgeDefs(params = {}) {
  return http.get('/admin-ops/badge-defs/', { params })
}

export function saveBadgeDef(data) {
  return http.post('/admin-ops/badge-defs/', data)
}

/** Home 运营卡 CRUD（2.0 钩子） */
export function fetchMannaHomeCards(params = {}) {
  return http.get('/admin-ops/manna-home-cards/', { params })
}

export function saveMannaHomeCard(data) {
  return http.post('/admin-ops/manna-home-cards/', data)
}

/** Testimony CRUD（2.0 钩子） */
export function fetchMannaTestimonies(params = {}) {
  return http.get('/admin-ops/manna-testimonies/', { params })
}

export function saveMannaTestimony(data) {
  return http.post('/admin-ops/manna-testimonies/', data)
}

/** 成长卡文案 CRUD（2.0 钩子） */
export function fetchMannaStatsCopies(params = {}) {
  return http.get('/admin-ops/manna-stats-copies/', { params })
}

export function saveMannaStatsCopy(data) {
  return http.post('/admin-ops/manna-stats-copies/', data)
}

/** 内容 Tag CRUD（2.0 钩子） */
export function fetchMannaTags(params = {}) {
  return http.get('/admin-ops/manna-tags/', { params })
}

export function saveMannaTag(data) {
  return http.post('/admin-ops/manna-tags/', data)
}

/** Manna 流水只读（需 user_id） */
export function fetchMannaLedger(params = {}) {
  return http.get('/admin-ops/manna-ledger/', { params })
}

/* ---------- 远程 PUSH：文案库 / 运营任务 / 发送记录 ---------- */

/** 日常 PUSH 文案库列表（传 id 时 results 为单条） */
export function fetchPushCopies(params = {}) {
  return http.get('/admin-ops/push-copies/', { params })
}

/** 新建/更新/删除日常 PUSH 文案（有 id 更新；delete_id 删除） */
export function savePushCopy(data) {
  return http.post('/admin-ops/push-copies/', data)
}

/** 按 ids 批量启用文案：{ app_key, ids: number[] } */
export function batchEnablePushCopies(data) {
  return http.post('/admin-ops/push-copies-batch-enable/', data)
}

/** 文案库存统计（页头红标用） */
export function fetchPushCopyStats(params = {}) {
  return http.get('/admin-ops/push-copy-stats/', { params })
}

/** 运营 PUSH 审核人列表；all=1 含停用 */
export function fetchPushReviewers(params = {}) {
  return http.get('/admin-ops/push-reviewers/', { params })
}

/** 新建/更新/删除审核人（有 id 更新；delete_id 删除） */
export function savePushReviewer(data) {
  return http.post('/admin-ops/push-reviewers/', data)
}

/** 运营 PUSH 任务列表（传 id 时 results 为详情含 copies/target_status） */
export function fetchPushCampaigns(params = {}) {
  return http.get('/admin-ops/push-campaigns/', { params })
}

/** 创建/更新运营 PUSH 任务（draft/rejected 可改；submit_review 直接进待审） */
export function savePushCampaign(data) {
  return http.post('/admin-ops/push-campaigns/', data)
}

/** 草稿任务提交审核 */
export function submitPushCampaign(data) {
  return http.post('/admin-ops/push-campaign-submit/', data)
}

/** 审核通过/驳回（仅指定审核人） */
export function reviewPushCampaign(data) {
  return http.post('/admin-ops/push-campaign-review/', data)
}

/** 周期系列：pause / resume / end（仅 is_recurring） */
export function controlPushCampaignSeries(data) {
  return http.post('/admin-ops/push-campaign-series/', data)
}

/** 任务目标用户明细 */
export function fetchPushCampaignTargets(params = {}) {
  return http.get('/admin-ops/push-campaign-targets/', { params })
}

/** PUSH 底层发送流水。管理台主列表请用 fetchPushLogsSummary。 */
export function fetchPushLogs(params = {}) {
  return http.get('/admin-ops/push-logs/', { params })
}

/** PUSH 记录聚合列表：当地日 × 时段 × 文案 × 渠道。 */
export function fetchPushLogsSummary(params = {}) {
  return http.get('/admin-ops/push-logs-summary/', { params })
}

/** PUSH 投递明细 */
export function fetchPushDeliveries(params = {}) {
  return http.get('/admin-ops/push-deliveries/', { params })
}
