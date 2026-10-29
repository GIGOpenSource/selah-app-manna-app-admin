/**
 * 跨页喜欢 / 不喜欢态：资产、分享页操作后立刻通知仍存活的首页 tab。
 */
import { readPageCache, writePageCache } from '@/utils/pageCache.js'
import { readSessionHomeLook, writeSessionHomeLook } from '@/utils/homeFeedSync.js'

const PATCH_KEY = 'like_status_patch_v1'
const DISLIKE_PATCH_KEY = 'dislike_status_patch_v1'
/** 喜欢缓存属于哪个账号。换号后丢掉上一账号的红心。 */
const LIKE_OWNER_KEY = 'like_cache_owner_v1'
/** 换号后首页要按新账号重拉 liked / disliked */
const LIKE_REFRESH_KEY = 'like_cache_refresh_v1'
/** 与 pages/home/home.vue HOME_CACHE_KEY 保持一致 */
const HOME_CACHE_KEY = 'home_v1'
const LIKE_EVENT = 'selah-like-status'
const DISLIKE_EVENT = 'selah-dislike-status'

const listeners = new Set()
const dislikeListeners = new Set()

function readMap(key) {
	try {
		const raw = uni.getStorageSync(key)
		if (!raw) return {}
		const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
		if (obj && typeof obj === 'object' && !Array.isArray(obj)) return { ...obj }
	} catch (e) {}
	return {}
}

function writeMap(key, patch) {
	try {
		uni.setStorageSync(key, patch)
	} catch (e) {}
}

export function quoteStatusCacheKey(contentId) {
	return `quote_status_v1_${String(contentId || '')}`
}

export function readQuoteStatusCache(contentId) {
	const id = String(contentId || '')
	if (!id) return null
	const snap = readPageCache(quoteStatusCacheKey(id))
	return snap && typeof snap === 'object' ? snap : null
}

/** 合并写入语录 liked/disliked 快照，分享页进页秒开、避免等接口闪一下。 */
export function writeQuoteStatusCache(contentId, payload) {
	const id = String(contentId || '')
	if (!id || !payload || typeof payload !== 'object') return
	const prev = readQuoteStatusCache(id) || {}
	writePageCache(quoteStatusCacheKey(id), { ...prev, ...payload })
}

function hasOwn(obj, key) {
	return !!obj && Object.prototype.hasOwnProperty.call(obj, key)
}

/** 本地已缓存的 disliked；没有则 null，不把「未知」当成 false。 */
export function readCachedDisliked(contentId) {
	const id = String(contentId || '')
	if (!id) return null
	const patch = readMap(DISLIKE_PATCH_KEY)
	if (hasOwn(patch, id)) return !!patch[id]
	const fromQuote = readDislikedField(readQuoteStatusCache(id))
	if (fromQuote != null) return fromQuote
	const snap = readPageCache(HOME_CACHE_KEY)
	if (hasOwn(snap?.disliked, id)) return !!snap.disliked[id]
	const q = Array.isArray(snap?.list) ? snap.list.find((x) => String(x?.id) === id) : null
	if (q && q.disliked != null) return !!q.disliked
	return null
}

function patchHomeCache(id, fields) {
	const snap = readPageCache(HOME_CACHE_KEY)
	if (!snap || typeof snap !== 'object') return
	if (Object.prototype.hasOwnProperty.call(fields, 'liked')) {
		snap.liked = { ...(snap.liked || {}), [id]: !!fields.liked }
	}
	if (Object.prototype.hasOwnProperty.call(fields, 'disliked')) {
		snap.disliked = { ...(snap.disliked || {}), [id]: !!fields.disliked }
	}
	if (Array.isArray(snap.list)) {
		snap.list = snap.list.map((q) => (
			String(q?.id) === id ? { ...q, ...fields } : q
		))
	}
	writePageCache(HOME_CACHE_KEY, snap)
}

/** 首页订阅喜欢变化；返回取消订阅函数。 */
export function onLikeStatusChange(fn) {
	if (typeof fn !== 'function') return () => {}
	listeners.add(fn)
	return () => listeners.delete(fn)
}

/** 首页订阅不喜欢变化；返回取消订阅函数。 */
export function onDislikeStatusChange(fn) {
	if (typeof fn !== 'function') return () => {}
	dislikeListeners.add(fn)
	return () => dislikeListeners.delete(fn)
}

function accountReactionKey(userId) {
	return `like_account_v1_${String(userId || '')}`
}

function currentUserId() {
	try {
		const user = uni.getStorageSync('userInfo') || {}
		return userIdOf(user)
	} catch (e) {
		return ''
	}
}

/** 某个账号自己的喜欢 / 不喜欢。退出后再登录同一账号时用它恢复红心。 */
export function readAccountReactions(userId) {
	const raw = readMap(accountReactionKey(userId))
	const liked = raw.liked && typeof raw.liked === 'object' && !Array.isArray(raw.liked) ? { ...raw.liked } : {}
	const disliked = raw.disliked && typeof raw.disliked === 'object' && !Array.isArray(raw.disliked) ? { ...raw.disliked } : {}
	return { liked, disliked }
}

export function writeAccountReactions(userId, liked, disliked) {
	const id = String(userId || '')
	if (!id) return
	writeMap(accountReactionKey(id), {
		liked: liked && typeof liked === 'object' ? { ...liked } : {},
		disliked: disliked && typeof disliked === 'object' ? { ...disliked } : {},
	})
}

function rememberAccountReaction(userId, contentId, fields) {
	const uid = String(userId || '') || currentUserId()
	const id = String(contentId || '')
	if (!uid || !id || !fields) return
	const saved = readAccountReactions(uid)
	if (Object.prototype.hasOwnProperty.call(fields, 'liked')) saved.liked[id] = !!fields.liked
	if (Object.prototype.hasOwnProperty.call(fields, 'disliked')) saved.disliked[id] = !!fields.disliked
	writeAccountReactions(uid, saved.liked, saved.disliked)
}

/** 清掉当前画面上的红心之前，先把这一账号的记录留下。 */
function snapshotAccountReactions(userId) {
	const uid = String(userId || '')
	if (!uid) return
	const saved = readAccountReactions(uid)
	const liked = { ...saved.liked, ...readMap(PATCH_KEY) }
	const disliked = { ...saved.disliked, ...readMap(DISLIKE_PATCH_KEY) }
	const snap = readPageCache(HOME_CACHE_KEY)
	if (snap?.liked && typeof snap.liked === 'object') Object.assign(liked, snap.liked)
	if (snap?.disliked && typeof snap.disliked === 'object') Object.assign(disliked, snap.disliked)
	if (Array.isArray(snap?.list)) {
		snap.list.forEach((q) => {
			if (!q?.id) return
			const id = String(q.id)
			if (q.liked != null) liked[id] = !!q.liked
			if (q.disliked != null) disliked[id] = !!q.disliked
		})
	}
	const session = readSessionHomeLook()
	if (session?.liked && typeof session.liked === 'object') Object.assign(liked, session.liked)
	if (session?.disliked && typeof session.disliked === 'object') Object.assign(disliked, session.disliked)
	if (Array.isArray(session?.list)) {
		session.list.forEach((q) => {
			if (!q?.id) return
			const id = String(q.id)
			if (q.liked != null) liked[id] = !!q.liked
			if (q.disliked != null) disliked[id] = !!q.disliked
		})
	}
	writeAccountReactions(uid, liked, disliked)
}

/** 记录某条语录的喜欢结果，并通知首页立刻改心形。 */
export function recordLikeStatus(contentId, isLiked) {
	const id = String(contentId || '')
	if (!id) return
	const liked = !!isLiked
	const patch = readMap(PATCH_KEY)
	patch[id] = liked
	writeMap(PATCH_KEY, patch)
	patchHomeCache(id, { liked })
	writeQuoteStatusCache(id, { liked })
	rememberAccountReaction('', id, { liked })
	listeners.forEach((fn) => {
		try { fn(id, liked) } catch (e) {}
	})
	try {
		uni.$emit(LIKE_EVENT, { id, liked })
	} catch (e) {}
}

/** 记录不喜欢结果，供分享页按钮态；不改 liked。 */
export function recordDislikeStatus(contentId, isDisliked) {
	const id = String(contentId || '')
	if (!id) return
	const disliked = !!isDisliked
	const patch = readMap(DISLIKE_PATCH_KEY)
	patch[id] = disliked
	writeMap(DISLIKE_PATCH_KEY, patch)
	patchHomeCache(id, { disliked })
	writeQuoteStatusCache(id, { disliked })
	rememberAccountReaction('', id, { disliked })
	dislikeListeners.forEach((fn) => {
		try { fn(id, disliked) } catch (e) {}
	})
	try {
		uni.$emit(DISLIKE_EVENT, { id, disliked })
	} catch (e) {}
}

/** 取出待同步补丁（不清除；loadFeed 晚到时仍能盖过旧的 liked）。 */
export function readLikeStatusPatches() {
	return readMap(PATCH_KEY)
}

export function readDislikeStatusPatches() {
	return readMap(DISLIKE_PATCH_KEY)
}

/**
 * 从 /content/quote/ 或 like 接口结果读 liked。
 * 字段缺失返回 null，避免把「没返回」当成未喜欢。
 */
export function readLikedField(payload) {
	if (!payload || typeof payload !== 'object') return null
	const raw = payload.liked
	if (raw === undefined || raw === null) return null
	return !!raw
}

/** 从 quote / dislike 接口结果读 disliked；缺失返回 null。 */
export function readDislikedField(payload) {
	if (!payload || typeof payload !== 'object') return null
	const raw = payload.disliked
	if (raw === undefined || raw === null) return null
	return !!raw
}

export function userIdOf(user) {
	if (!user || typeof user !== 'object') return ''
	return String(user.user_id || user.id || '')
}

function stripReactionFields(q) {
	if (!q || typeof q !== 'object') return q
	const next = { ...q }
	delete next.liked
	delete next.disliked
	return next
}

function stripLookReactions(snap) {
	if (!snap || typeof snap !== 'object') return snap
	return {
		...snap,
		liked: {},
		disliked: {},
		list: Array.isArray(snap.list) ? snap.list.map(stripReactionFields) : snap.list,
	}
}

function clearQuoteStatusCaches() {
	try {
		const info = uni.getStorageInfoSync()
		const keys = info?.keys || []
		keys.forEach((k) => {
			if (String(k).indexOf('quote_status_v1_') === -1) return
			try { uni.removeStorageSync(k) } catch (e) {}
		})
	} catch (e) {}
}

/** 丢掉当前画面上的红心。语录正文留下；该账号自己的记录另存，同一账号再登录可以恢复。 */
function clearReactionCaches() {
	let owner = ''
	try { owner = String(uni.getStorageSync(LIKE_OWNER_KEY) || '') } catch (e) {}
	snapshotAccountReactions(owner)
	writeMap(PATCH_KEY, {})
	writeMap(DISLIKE_PATCH_KEY, {})
	clearQuoteStatusCaches()
	const snap = readPageCache(HOME_CACHE_KEY)
	if (snap && typeof snap === 'object') writePageCache(HOME_CACHE_KEY, stripLookReactions(snap))
	const session = readSessionHomeLook()
	if (session) writeSessionHomeLook(stripLookReactions(session))
	try { uni.setStorageSync(LIKE_REFRESH_KEY, '1') } catch (e) {}
}

/**
 * 把喜欢缓存记到当前账号上。
 * 账号变了就清掉上一份红心，并让首页重拉。
 * 第一次只记账，避免升级后把当前账号的喜欢清掉。
 */
export function adoptLikeCacheOwner(user) {
	const next = userIdOf(user)
	if (!next) return false
	let prev = ''
	try { prev = String(uni.getStorageSync(LIKE_OWNER_KEY) || '') } catch (e) {}
	if (prev === next) return false
	if (prev) clearReactionCaches()
	try { uni.setStorageSync(LIKE_OWNER_KEY, next) } catch (e) {}
	return !!prev
}

export function likeCacheNeedsRefresh() {
	try { return !!uni.getStorageSync(LIKE_REFRESH_KEY) } catch (e) { return false }
}

export function clearLikeCacheRefresh() {
	try { uni.removeStorageSync(LIKE_REFRESH_KEY) } catch (e) {}
}

/** 退出登录时收起当前画面上的红心。同一账号再进来会恢复自己的喜欢。 */
export function releaseLikeCache() {
	clearReactionCaches()
}

export { LIKE_EVENT, DISLIKE_EVENT }
