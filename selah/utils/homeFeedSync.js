/**
 * 首页 Feed 与主题关注同步：关注主题后清缓存，首页改拉该主题语录。
 */
import { clearPageCache, readPageCache } from '@/utils/pageCache.js'
import { rememberWallpaper, usableImageUrl } from '@/utils/wallpaperCache.js'

export const HOME_CACHE_KEY = 'home_v1'
export const HOME_FEED_TOPIC_KEY = 'home_feed_topic_id'
export const HOME_THEME_APPLY_EVENT = 'selah_home_theme_apply'
const HOME_FEED_STALE_KEY = 'home_feed_stale'
const HOME_FORCE_QUOTE_KEY = 'home_force_quote'

export function getHomeFeedTopicId() {
	const n = Number(uni.getStorageSync(HOME_FEED_TOPIC_KEY) || 0)
	return Number.isFinite(n) && n > 0 ? n : 0
}

export function setHomeFeedTopicId(id) {
	const n = Number(id)
	if (Number.isFinite(n) && n > 0) {
		try { uni.setStorageSync(HOME_FEED_TOPIC_KEY, n) } catch (e) {}
		return
	}
	try { uni.removeStorageSync(HOME_FEED_TOPIC_KEY) } catch (e) {}
}

/** 本次进程内离开首页前的画面。reLaunch 会拆掉页面，但模块变量还在。 */
let sessionHomeLook = null

export function readSessionHomeLook() {
	return sessionHomeLook
}

export function writeSessionHomeLook(snap) {
	sessionHomeLook = snap || null
}

export function clearSessionHomeLook() {
	sessionHomeLook = null
}

function lookHasQuoteText(snap) {
	return !!(snap && Array.isArray(snap.list) && snap.list.some((q) => String(q?.content || '').trim()))
}

/** 主题未换时取离开前的画面：先内存，再本地缓存。主题已标脏则返回 null。 */
export function readKeptHomeLook() {
	if (peekHomeFeedStale() || peekHomeForceQuote()) return null
	const topicId = getHomeFeedTopicId()
	const candidates = [sessionHomeLook, readPageCache(HOME_CACHE_KEY)]
	for (const snap of candidates) {
		if (!lookHasQuoteText(snap)) continue
		if (Number(snap.topicId || 0) !== topicId) continue
		return snap
	}
	return null
}

export function markHomeFeedStale() {
	clearPageCache(HOME_CACHE_KEY)
	clearSessionHomeLook()
	try { uni.setStorageSync(HOME_FEED_STALE_KEY, '1') } catch (e) {}
	markHomeForceQuote()
}

export function markHomeForceQuote() {
	try { uni.setStorageSync(HOME_FORCE_QUOTE_KEY, '1') } catch (e) {}
}

export function peekHomeForceQuote() {
	try {
		return !!uni.getStorageSync(HOME_FORCE_QUOTE_KEY)
	} catch (e) {
		return false
	}
}

export function consumeHomeForceQuote() {
	try {
		const v = uni.getStorageSync(HOME_FORCE_QUOTE_KEY)
		if (!v) return false
		uni.removeStorageSync(HOME_FORCE_QUOTE_KEY)
		return true
	} catch (e) {
		return false
	}
}

export function consumeHomeFeedStale() {
	try {
		const v = uni.getStorageSync(HOME_FEED_STALE_KEY)
		if (!v) return false
		uni.removeStorageSync(HOME_FEED_STALE_KEY)
		return true
	} catch (e) {
		return false
	}
}

export function peekHomeFeedStale() {
	try {
		return !!uni.getStorageSync(HOME_FEED_STALE_KEY)
	} catch (e) {
		return false
	}
}

/** 关注某主题后：首页切到该主题并强制重拉语录 */
export function applyHomeFeedTopic(topicId) {
	setHomeFeedTopicId(topicId)
	markHomeFeedStale()
}

/**
 * 与壁纸页 applyCurrent 同款：钉选首页语录主题，并把封面落到当前壁纸缓存。
 * 封面不写 wallpaper_id，避免首页再按用户旧壁纸把图刷回去。
 */
export async function applyHomeThemeLook(topicId, coverUrl) {
	applyHomeFeedTopic(topicId)
	const url = String(coverUrl || '').trim()
	if (usableImageUrl(url)) {
		await rememberWallpaper({ image_url: url })
	}
	try {
		uni.$emit(HOME_THEME_APPLY_EVENT, { topicId: getHomeFeedTopicId() })
	} catch (e) {}
	import('./widgetDesktopSync.js')
		.then((mod) => {
			if (mod.isIosDevice()) return null
			return Promise.resolve(mod.republishWidgetDesktop()).then(() => mod.saveWidgetPageDesktop())
		})
		.catch(() => {})
}

/** 取关当前首页主题时清掉钉选，下次进首页回默认 Feed */
export function clearHomeFeedTopicIf(topicId) {
	if (!topicId || getHomeFeedTopicId() !== Number(topicId)) return
	setHomeFeedTopicId(0)
	markHomeFeedStale()
}
