/**
 * 内容域 API：Feed、互动、话题、壁纸、收藏夹、Onboarding 与 App 配置。
 */
import { postRequest, getRequest } from '@/utils/http.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'

/** 首页 Feed 流（含冷启 70/30、兴趣匹配；可分页/cursor） */
export function apiFeed(params) {
	return getRequest('/content/feed/', params || {})
}

/** 按 id 拉取单条语录详情 */
export function apiQuote(contentId) {
	return getRequest('/content/quote/', { id: contentId })
}

/** 上报语录曝光（埋点/推荐反馈） */
export function apiExpose(contentId) {
	return postRequest('/content/expose/', { content_id: contentId })
}

/** 点赞/取消点赞语录；liked=false 表示取消 */
export function apiLike(contentId, liked = true) {
	return postRequest('/content/like/', { content_id: contentId, liked })
}

/** 不感兴趣（负反馈，影响后续推荐） */
export function apiDislike(contentId) {
	return postRequest('/content/dislike/', { content_id: contentId })
}

/** 收藏语录到指定文件夹 */
export function apiCollect(contentId, folderId) {
	return postRequest('/content/collect/', { content_id: contentId, folder_id: folderId })
}

/** 取消收藏语录 */
export function apiUncollect(contentId) {
	return postRequest('/content/uncollect/', { content_id: contentId })
}

/** 举报语录（reason + 可选 detail） */
export function apiReport(contentId, reason, detail) {
	return postRequest('/content/report/', { content_id: contentId, reason, detail })
}

/** 话题列表 */
export function apiTopics(params) {
	return getRequest('/content/topics/', params || {})
}

/** 某话题下的语录列表 */
export function apiTopicQuotes(topicId, params) {
	return getRequest('/content/topic-quotes/', { topic_id: topicId, ...(params || {}) })
}

/** 关注/取关话题；follow=false 表示取关 */
export function apiFollowTopic(topicId, follow = true) {
	return postRequest('/content/follow-topic/', { topic_id: topicId, follow })
}

/** 清空全部关注主题 */
export function apiClearFollowedTopics() {
	return postRequest('/content/clear-followed-topics/', {})
}

/** 壁纸列表（含 VIP 锁标志） */
export function apiWallpapers(params) {
	return getRequest('/content/wallpapers/', params || {})
}

/** 设置当前壁纸 */
export function apiSetWallpaper(wallpaperId) {
	return postRequest('/content/set-wallpaper/', { wallpaper_id: wallpaperId })
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
export function apiFolders() {
	return getRequest('/content/folders/')
}

/** 新建或更新收藏夹 */
export function apiFolderSave(params) {
	return postRequest('/content/folder-save/', params)
}

/** 删除收藏夹 */
export function apiFolderDelete(id) {
	return postRequest('/content/folder-delete/', { id })
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
export function apiQuizList(params) {
	return getRequest('/content/quiz/list/', params || {})
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

/** 测验结果（含 detail） */
export function apiQuizResult(attemptId) {
	return getRequest('/content/quiz/result/', { attempt_id: attemptId }, { showLoading: true })
}

/** GET 小组件偏好 */
export function apiWidgetPrefsGet() {
	return getRequest('/content/widget-prefs/')
}

/** POST 合并更新小组件偏好 */
export function apiWidgetPrefsSave(params) {
	return postRequest('/content/widget-prefs/', params || {})
}

/** GET 祷告闹钟偏好 */
export function apiAlarmPrefsGet() {
	return getRequest('/content/alarm-prefs/')
}

/** POST 祷告闹钟偏好 */
export function apiAlarmPrefsSave(params) {
	return postRequest('/content/alarm-prefs/', params || {})
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

/** 选择 App 图标 */
export function apiSelectAppIcon(iconKey) {
	return postRequest('/content/select-app-icon/', { icon_key: iconKey })
}

/** 拉取 App 端运营配置（额度、签到弹窗、新人点赞目标等） */
export function apiAppConfig() {
	return getRequest('/content/app-config/')
}

/** 公开危机热线列表（Help / AI 拒答共用；可选 country） */
export function apiHotlines(params = {}) {
	return getRequest('/content/hotlines/', params || {}, { showLoading: false })
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
	return getRequest('/content/onboarding/questions/', params || {}, other)
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
export function apiContentEnums() {
	return getRequest('/content/enums/')
}

/** 新人点赞进度（如当前 0/5，目标来自 newcomer_like_goal） */
export function apiNewcomerLike() {
	return getRequest('/content/newcomer-like/')
}

/** 运营预置肯定语模板（空态一键填入） */
export function apiAffirmationTemplates() {
	return getRequest('/content/affirmation-templates/', {}, { showLoading: false })
}

/** 清空当前用户曝光历史 */
export function apiHistoryClear() {
	return postRequest('/content/history-clear/', {})
}
