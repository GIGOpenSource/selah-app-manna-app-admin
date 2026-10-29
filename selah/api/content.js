/**
 * 内容域 API：Feed、互动、话题、壁纸、收藏夹、Onboarding 与 App 配置。
 */
import { postRequest, getRequest } from '@/utils/http.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import { getTimezone } from '@/utils/device.js'

/** 首页 Feed：支持 exclude_ids（当前列表）、vip_cooldown=1（关闭开通窗后 30s）；自动带 IANA timezone */
export function apiFeed(params) {
	const p = { ...(params || {}) }
	if (Array.isArray(p.exclude_ids)) {
		p.exclude_ids = p.exclude_ids.filter(Boolean).join(',')
	}
	if (p.vip_cooldown === true) p.vip_cooldown = 1
	if (p.vip_cooldown === false) delete p.vip_cooldown
	if (!p.timezone) p.timezone = getTimezone()
	return getRequest('/content/feed/', p, {
		header: { 'X-Timezone': String(p.timezone) },
	})
}

/** 按 id 拉取单条语录详情 */
export function apiQuote(contentId) {
	return getRequest('/content/quote/', { id: contentId })
}

/**
 * 上报语录曝光（可见且前台时）。仅 kind=quote；带 batch_id。
 * 404 由首页自行刷新，不弹失败提示。
 * @param {number|string} contentId
 * @param {{ batch_id?: string }} [extra]
 */
export function apiExpose(contentId, extra = {}) {
	const body = { content_id: contentId }
	const batchId = extra.batch_id ?? extra.batchId
	if (batchId) body.batch_id = String(batchId)
	return postRequest('/content/expose/', body, { errorOutput: false })
}

/**
 * 阅读信号：卡片离开 / 滑走 / 切后台时结算有效停留（秒）。
 * affirmation 不要调用。
 */
export function apiReadSignal(payload = {}) {
	const body = {
		content_id: payload.content_id ?? payload.contentId,
		effective_dwell_time: Number(payload.effective_dwell_time ?? payload.effectiveDwellTime ?? 0),
	}
	const batchId = payload.batch_id ?? payload.batchId
	if (batchId) body.batch_id = String(batchId)
	const expected = payload.expected_read_time ?? payload.expectedReadTime
	if (expected != null && expected !== '') body.expected_read_time = Number(expected)
	if (payload.visible_ratio != null) body.visible_ratio = Number(payload.visible_ratio)
	if (payload.is_quick_skip != null) body.is_quick_skip = !!payload.is_quick_skip
	if (payload.completion_ratio != null) body.completion_ratio = Number(payload.completion_ratio)
	return postRequest('/content/read-signal/', body, { errorOutput: false })
}

/** 分享成功上报（同池排序分享率） */
export function apiShareSuccess(contentId) {
	return postRequest('/content/share-success/', { content_id: contentId })
}

const TARGET_TYPES = new Set(['quote', 'affirmation', 'ai_message'])

/**
 * like/collect/uncollect/dislike 的 target_type：优先接口返回的 item_type，缺省 quote。
 * extra 可显式传 target_type / kind，或传入带 item_type 的内容行。
 */
export function contentTargetType(rowOrType, fallback = 'quote') {
	if (rowOrType == null || rowOrType === '') return fallback
	if (typeof rowOrType !== 'object') return normalizeTargetType(rowOrType, fallback)
	// item_type 优先：与 my-assets 等列表接口字段对齐
	const keys = ['item_type', 'target_type', 'targetType', 'content_type', 'kind']
	for (const key of keys) {
		const mapped = normalizeTargetType(rowOrType[key], '')
		if (mapped) return mapped
	}
	return fallback
}

function normalizeTargetType(value, fallback = 'quote') {
	const raw = String(value || '').trim().toLowerCase()
	if (raw === 'affirmations') return 'affirmation'
	if (raw === 'ai' || raw === 'aimessage') return 'ai_message'
	if (TARGET_TYPES.has(raw)) return raw
	return fallback
}

export function isAffirmationTarget(rowOrType) {
	return contentTargetType(rowOrType, '') === 'affirmation'
}

function applyTargetType(body, extra = {}) {
	body.target_type = contentTargetType(extra)
	return body
}

/** 点赞/取消点赞；liked 可选。target_type 取 extra.kind / extra.target_type，缺省 quote */
export function apiLike(contentId, liked = true, extra = {}) {
	const body = applyTargetType({ content_id: contentId, liked }, extra)
	return postRequest('/content/like/', body)
}

/** 不感兴趣（负反馈，影响后续推荐）；disliked=false 解除屏蔽 */
export function apiDislike(contentId, disliked = true, extra = {}) {
	const body = applyTargetType({ content_id: contentId, disliked }, extra)
	return postRequest('/content/dislike/', body)
}

/** 收藏语录到指定文件夹；无 id 时可带正文，供祷告分享落库 */
export function apiCollect(contentId, folderId, extra = {}) {
	const body = { ...(extra.body || {}) }
	const cid = Number(contentId)
	if (Number.isFinite(cid) && cid > 0) body.content_id = cid
	const fid = Number(folderId)
	if (Number.isFinite(fid) && fid > 0) body.folder_id = fid
	if (extra.content) body.content = String(extra.content)
	if (extra.source_ref) body.source_ref = String(extra.source_ref)
	applyTargetType(body, extra)
	return postRequest('/content/collect/', body, extra.http || {})
}

/** 兼容 results 为数组或 { list / folders / items } */
export function parseFolderList(res) {
	if (!res) return []
	if (Array.isArray(res)) return res
	const bags = [res.results, res.data, res]
	for (const bag of bags) {
		if (Array.isArray(bag)) return bag
		if (!bag || typeof bag !== 'object') continue
		if (Array.isArray(bag.list)) return bag.list
		if (Array.isArray(bag.folders)) return bag.folders
		if (Array.isArray(bag.results)) return bag.results
		if (Array.isArray(bag.items)) return bag.items
	}
	return []
}

export function normalizeFolderItem(f) {
	if (!f || typeof f !== 'object') return null
	const id = f.id ?? f.folder_id ?? f.folderId ?? f.pk
	const n = Number(id)
	if (!Number.isFinite(n) || n <= 0) return null
	return { ...f, id: n }
}

/** 取消收藏；target_type 取 extra.kind / extra.target_type，缺省 quote */
export function apiUncollect(contentId, extra = {}) {
	return postRequest('/content/uncollect/', applyTargetType({ content_id: contentId }, extra))
}

/** 举报语录（reason + 可选 detail） */
export function apiReport(contentId, reason, detail) {
	return postRequest('/content/report/', { content_id: contentId, reason, detail })
}

/** 话题列表 */
export function apiTopics(params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest('/content/topics/', { ...params, language })
}

/** 某话题下的语录列表 */
export function apiTopicQuotes(topicId, params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest('/content/topic-quotes/', { topic_id: topicId, ...params, language })
}

/** 关注/取关话题；follow=false 表示取关 */
export function apiFollowTopic(topicId, follow = true) {
	return postRequest('/content/follow-topic/', { topic_id: topicId, follow })
}

/** 关注/取关收藏夹；follow=false 表示取关 */
export function apiFollowFolder(folderId, follow = true) {
	return postRequest('/content/follow-folder/', { folder_id: folderId, follow })
}

/** 一键关注/取消全部肯定语；follow=false 表示取关 */
export function apiFollowAllAffirmations(follow = true) {
	return postRequest('/content/follow-all-affirmations/', { follow: !!follow })
}

/** 清空全部关注主题 */
export function apiClearFollowedTopics() {
	return postRequest('/content/clear-followed-topics/', {})
}

const listLoading = { showLoading: true, loadingTime: 0, loadingMask: true, loadingText: 'Loading…' }

/** 壁纸列表（含 VIP 锁标志） */
export function apiWallpapers(params, other = {}) {
	return getRequest('/content/wallpapers/', params || {}, other)
}

/** 壁纸合集（二级「查看全部」用；默认不弹全屏 loading，避免进页闪烁） */
export function apiWallpaperCollections(params = {}, other = {}) {
	return getRequest('/content/wallpaper-collections/', params || {}, { showLoading: false, ...other })
}

/** 按标签搜索壁纸，结果在 results.wallpapers */
export function apiWallpaperSearch(params = {}, other = {}) {
	return getRequest('/content/wallpaper-search/', params || {}, { ...listLoading, ...other })
}

/** 设置当前壁纸 */
export function apiSetWallpaper(wallpaperId, other = {}) {
	return postRequest('/content/set-wallpaper/', { wallpaper_id: wallpaperId }, { ...listLoading, ...other })
}

/** 记录一次壁纸使用（壁纸页 · 继续） */
export function apiRecordWallpaperUsage(wallpaperId, other = {}) {
	return postRequest('/content/record-wallpaper-usage/', { wallpaper_id: wallpaperId }, { ...listLoading, ...other })
}

/** 清空曾用壁纸记录（当前壁纸保留） */
export function apiClearWallpaperUsage() {
	return postRequest('/content/clear-wallpaper-usage/', {})
}

/**
 * 我的资产（点赞/收藏/肯定语等）。
 * @param {string} kind 资产类型
 * @param {number|string} [folderId] 收藏夹 id（kind 为收藏时）
 */
export function apiMyAssets(kind, folderId, params) {
	const query = { kind, ...(params || {}) }
	if (folderId) query.folder_id = folderId
	return getRequest('/content/my-assets/', query)
}

/** 收藏夹列表 */
export function apiFolders(other = {}) {
	return getRequest('/content/folders/', {}, other)
}

/** 新建或更新收藏夹 */
export function apiFolderSave(params) {
	return postRequest('/content/folder-save/', params)
}

/** 删除收藏夹；409=非空夹，由页面自行 toast */
export function apiFolderDelete(id) {
	return postRequest('/content/folder-delete/', { id }, { silentBizCodes: [409] })
}

/** 肯定语（affirmations）列表 */
export function apiAffirmations(params) {
	return getRequest('/content/affirmations/', params || {})
}

/**
 * 新建或更新肯定语。
 * @param {object} params
 * @param {string} params.content 1–160 字
 * @param {number} [params.id]
 * @param {number|null} [params.theme_id]
 * @param {number|null} [params.wallpaper_id]
 * @param {object} [params.meta]
 */
export function apiAffirmationSave(params) {
	const body = {
		content: params.content,
	}
	if (params.id != null) body.id = params.id
	if (params.theme_id !== undefined) body.theme_id = params.theme_id
	if (params.wallpaper_id !== undefined) body.wallpaper_id = params.wallpaper_id
	if (params.meta !== undefined) body.meta = params.meta
	return postRequest('/content/affirmation-save/', body)
}

/** 删除肯定语 */
export function apiAffirmationDelete(id) {
	return postRequest('/content/affirmation-delete/', { id })
}

/** Quiz 列表 */
export function apiQuizList(params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest('/content/quiz/list/', { ...params, language })
}

/** 开始测验 → attempt + questions */
export function apiQuizStart(quizId) {
	return postRequest('/content/quiz/start/', { quiz_id: quizId }, { showLoading: true })
}

/** 提交单题答案 */
export function apiQuizAnswer(attemptId, questionId, optionKey) {
	return postRequest('/content/quiz/answer/', {
		attempt_id: attemptId,
		question_id: questionId,
		option_key: optionKey,
	})
}

/** 测验结果（含 detail）；答题页取正解时关 loading，避免每题闪全屏 */
export function apiQuizResult(attemptId, other = {}) {
	return getRequest('/content/quiz/result/', { attempt_id: attemptId }, { showLoading: true, ...other })
}

/** GET 小组件中心列表 */
export function apiWidgets(params = {}, other = {}) {
	return getRequest('/content/widgets/', params || {}, { showLoading: false, ...other })
}

/** POST 保存单个小组件配置 */
export function apiWidgetSave(params) {
	return postRequest('/content/widgets/', params || {}, {
		skipSessionExpire: true,
		silentBizCodes: [403],
	})
}

/** GET 小组件偏好 */
export function apiWidgetPrefsGet() {
	return getRequest('/content/widget-prefs/')
}

/** POST 合并更新小组件偏好（VIP 边框 403 不踢登录） */
export function apiWidgetPrefsSave(params) {
	return postRequest('/content/widget-prefs/', params || {}, {
		skipSessionExpire: true,
		silentBizCodes: [403],
	})
}

/** GET 祷告闹钟偏好 */
export function apiAlarmPrefsGet() {
	return getRequest('/content/alarm-prefs/')
}

/** POST 祷告闹钟偏好。修改时立刻出 loading，避免连点。 */
export function apiAlarmPrefsSave(params, other = {}) {
	return postRequest('/content/alarm-prefs/', params || {}, {
		showLoading: true,
		loadingTime: 0,
		loadingMask: true,
		...other,
	})
}

/** GET 祷告锁偏好 */
export function apiPrayerLockPrefsGet() {
	return getRequest('/content/prayer-lock-prefs/')
}

/** POST 祷告锁偏好 */
export function apiPrayerLockPrefsSave(params) {
	return postRequest('/content/prayer-lock-prefs/', params || {})
}

/** 小组件今日载荷预览 */
export function apiWidgetPayload() {
	return getRequest('/content/widget-payload/', {}, { showLoading: false })
}

/** App 图标列表 */
export function apiAppIcons() {
	return getRequest('/content/app-icons/')
}

/** 选择 App 图标（VIP 403 不踢登录，由页面进订阅） */
export function apiSelectAppIcon(iconKey) {
	return postRequest(
		'/content/select-app-icon/',
		{ icon_key: iconKey },
		{ skipSessionExpire: true, silentBizCodes: [403] },
	)
}

/** 拉取 App 端运营配置（额度、签到弹窗、新人点赞目标等） */
export function apiAppConfig(params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest('/content/app-config/', { ...params, language }, { showLoading: false })
}

/** 公开危机热线列表（Help / AI 拒答共用；可选 country） */
export function apiHotlines(params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest('/content/hotlines/', { ...params, language }, { showLoading: false })
}

/** 拉取冷启 Welcome 屏（运营可配；无内容时 results 为空对象） */
export function apiWelcome(params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest('/content/welcome/', { ...params, language }, { showLoading: false })
}

/** 拉取教育夹层（按 kind；无内容时 results 为 null） */
export function apiInterstitial(kind, params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest(
		'/content/interstitial/',
		{ kind, ...params, language },
		{ showLoading: false },
	)
}

/** 拉取 Onboarding 问卷题目 */
export function apiOnboardingQuestions(params = {}, other = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest('/content/onboarding/questions/', { ...params, language }, other)
}

/** 提交 Onboarding 答案并标记完成 */
export function apiOnboardingComplete(params) {
	return postRequest('/content/onboarding/complete/', params)
}

/** 跳过 Onboarding */
export function apiOnboardingSkip() {
	return postRequest('/content/onboarding/skip/', {})
}

/** 内容相关枚举（兴趣/信仰/举报原因等） */
export function apiContentEnums(params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest('/content/enums/', { ...params, language })
}

/** 前端展示标签（quote | wallpaper），用于 App 筛选入口 */
export function apiDisplayTags(kind = 'quote', params = {}, other = {}) {
	return getRequest('/content/display-tags/', { kind, ...params }, other)
}

/** 关注/取消一条显性合集 */
export function apiFollowDisplayTag(displayTagId, follow = true) {
	return postRequest('/content/follow-display-tag/', {
		display_tag_id: displayTagId,
		follow: !!follow,
	})
}

/** 关注/取消一个模块下的全部显性合集 */
export function apiFollowDisplayColumn(columnId, follow = true) {
	return postRequest('/content/follow-display-column/', {
		column_id: columnId,
		follow: !!follow,
	})
}

/** 显性合集下的语录 */
export function apiDisplayTagQuotes(displayTagId, params = {}, other = {}) {
	return getRequest('/content/display-tag-quotes/', {
		display_tag_id: displayTagId,
		currentPage: 1,
		pageSize: 10,
		...params,
	}, { skipSessionExpire: true, ...other })
}

/** 新人点赞进度（如当前 0/5，目标来自 newcomer_like_goal） */
export function apiNewcomerLike() {
	return getRequest('/content/newcomer-like/')
}

/** 圣经译本列表 */
export function apiBibleTranslations() {
	return getRequest('/bible/translations/', {}, { showLoading: false })
}

/** 译本下的书卷 */
export function apiBibleBooks(translation) {
	return getRequest('/bible/books/', { translation }, { showLoading: false })
}

/** 某一章经文 */
export function apiBibleChapter(translation, book, chapter) {
	return getRequest('/bible/chapter/', { translation, book, chapter }, { showLoading: false })
}

/** 运营预置肯定语模板（空态一键填入） */
export function apiAffirmationTemplates() {
	return getRequest('/content/affirmation-templates/', {}, { showLoading: false })
}

/** 清空当前用户曝光历史 */
export function apiHistoryClear() {
	return postRequest('/content/history-clear/', {})
}
