/**
 * 首页 Feed：预取/缓存、VIP 冷却、曝光、壁纸与顶栏导航。
 */
import { ref, computed, onUnmounted } from 'vue'
import { apiFeed, apiQuote, apiExpose, apiReadSignal, apiTopicQuotes, apiMyAssets, isAffirmationTarget } from '@/api/content.js'
import { getUser } from '@/utils/session.js'
import { getTimezone } from '@/utils/device.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { writePageCache } from '@/utils/pageCache.js'
import { FALLBACK_WALLPAPER, resolveActiveWallpaper, wallpaperDisplayUrl, wallpaperOverlayVideoUrl, playWallpaperVideo } from '@/utils/wallpaperCache.js'
import { goVip as navigateVip } from '@/utils/vip.js'
import { createTapLock } from '@/utils/tapLock.js'
import { goTab } from '@/utils/nav.js'
import { HOME_CACHE_KEY, getHomeFeedTopicId, consumeHomeFeedStale, peekHomeFeedStale, peekHomeForceQuote, consumeHomeForceQuote, HOME_THEME_APPLY_EVENT, readKeptHomeLook, writeSessionHomeLook } from '@/utils/homeFeedSync.js'
import { readLikeStatusPatches, readDislikeStatusPatches, onLikeStatusChange, onDislikeStatusChange, LIKE_EVENT, DISLIKE_EVENT, readLikedField, readDislikedField, recordLikeStatus, recordDislikeStatus, writeQuoteStatusCache, userIdOf, likeCacheNeedsRefresh, clearLikeCacheRefresh, adoptLikeCacheOwner, readAccountReactions, writeAccountReactions } from '@/utils/likeSync.js'
import { openSharePage } from '@/utils/share.js'

/** 首屏条数 */
const FEED_FIRST_PAGE = 12
/** 静默/滑动补货每批 */
const FEED_BATCH = 10
/** 会话内列表软上限（非无限滚动） */
const FEED_SOFT_CAP = 48
/** 前方剩余 ≤ 此值时再补货 */
const FEED_LOW_WATER = 6
/** 首屏就绪后静默预取轮数 */
const FEED_SILENT_ROUNDS = 2

function withoutReactions(q) {
	if (!q || typeof q !== 'object') return q
	const next = { ...q }
	delete next.liked
	delete next.disliked
	return next
}

/** 缓存上标了别的账号时，只留语录正文，红心不带走。 */
function reactionsForCurrentUser(snap) {
	if (!snap || typeof snap !== 'object') return snap
	const me = userIdOf(getUser())
	const owner = String(snap.reactionUserId || '')
	if (!owner || !me || owner === me) return snap
	return {
		...snap,
		liked: {},
		disliked: {},
		list: Array.isArray(snap.list) ? snap.list.map(withoutReactions) : snap.list,
	}
}

/**
 * @param {{ t: Function, deps: Record<string, any> }} opts
 * deps 由页面在各 composable 创建后回填：newcomer / applyNewcomer
 */
export function useHomeFeed({ t, deps }) {
	let feedLoading = false
	let feedExhausted = false
	let topicQuotePage = 1
	let loadedFeedTopicId = null
	let feedInflight = null
	try { adoptLikeCacheOwner(getUser()) } catch (e) {}
	const bootLook = reactionsForCurrentUser(readKeptHomeLook())
	if (bootLook) loadedFeedTopicId = getHomeFeedTopicId()
	let audioCtx = null
	/** 有效停留：可见 + 前台 + 无全屏遮挡；滑走/切后台结算 read-signal */
	let dwellContentId = null
	let dwellQuote = null
	let dwellAccumMs = 0
	let dwellSegmentAt = 0
	let dwellPaused = false

	const list = ref(bootLook ? bootLook.list.map((q) => ({ ...q })) : [])
	const current = ref(0)
	if (bootLook) {
		const idx = Number(bootLook.current)
		if (Number.isFinite(idx) && idx >= 0 && idx < list.value.length) current.value = idx
	}
	/** 仅在整表替换时递增，避免滑动中改 children 把 swiper 拽回第一张 */
	const feedSwiperKey = ref(0)
	const liked = ref(bootLook?.liked || {})
	const disliked = ref(bootLook?.disliked || {})
	const likeTick = ref(0)
	/** 这批红心属于哪个账号。换号后不能把上一账号的喜欢写回缓存。 */
	let reactionUserId = userIdOf(getUser())
	const user = ref(getUser())
	const bgUrl = ref((bootLook && bootLook.bgUrl) || FALLBACK_WALLPAPER)
	const bgVideoUrl = ref(bootLook?.bgVideoUrl || '')
	const config = ref(bootLook?.config || {})

	const activeQuote = computed(() => list.value[current.value] || null)

	function quoteLiked(q) {
		if (!q || q.id == null) return false
		const id = String(q.id)
		if (Object.prototype.hasOwnProperty.call(liked.value, id)) return !!liked.value[id]
		return !!q.liked
	}

	function quoteDisliked(q) {
		if (!q || q.id == null) return false
		const id = String(q.id)
		if (Object.prototype.hasOwnProperty.call(disliked.value, id)) return !!disliked.value[id]
		return !!q.disliked
	}

	const isActiveLiked = computed(() => quoteLiked(activeQuote.value))
	const isActiveDisliked = computed(() => quoteDisliked(activeQuote.value))

	const brandLabel = computed(() => {
		const bn = String((config.value || {}).brand_name || '').trim()
		return bn || t('brand')
	})

	function quoteListHasText(rows) {
		return (rows || []).some((q) => String(q?.content || '').trim())
	}

	function cloneQuoteList(rows) {
		return (rows || []).map((q) => ({ ...q }))
	}

	/** 把离开前的主题壁纸和语录灌回页面，不改当前已有正文。 */
	function applyKeptLook(snap) {
		const look = reactionsForCurrentUser(snap)
		if (!look || !quoteListHasText(look.list)) return false
		const topicId = getHomeFeedTopicId()
		if (Number(look.topicId || 0) !== topicId) return false
		if (quoteListHasText(list.value) && loadedFeedTopicId != null && Number(loadedFeedTopicId) === topicId) {
			return true
		}
		list.value = cloneQuoteList(look.list)
		liked.value = look.liked || {}
		disliked.value = look.disliked || {}
		loadedFeedTopicId = topicId
		const idx = Number(snap.current)
		current.value = Number.isFinite(idx) && idx >= 0 && idx < list.value.length ? idx : 0
		if (snap.config) config.value = snap.config
		if (snap.bgUrl && !/placehold\.co|picsum/i.test(String(snap.bgUrl))) bgUrl.value = snap.bgUrl
		if (snap.bgVideoUrl) bgVideoUrl.value = snap.bgVideoUrl
		if (snap.newcomer && deps.applyNewcomer) applyNewcomerViaDeps({ ...snap.newcomer, just_completed: false }, { fromCache: true })
		return true
	}

	/** 把 pageCache 中的 feed/newcomer/checkin 状态灌入页面（首屏秒开）。 */
	function applyHomeCache(snap) {
		if (!snap || typeof snap !== 'object') return
		if (snap.newcomer && deps.applyNewcomer) applyNewcomerViaDeps({ ...snap.newcomer, just_completed: false }, { fromCache: true })
		if (applyKeptLook(snap)) return
		if (snap.config && !config.value?.brand_name) config.value = snap.config
		if (snap.bgUrl && !bgUrl.value) bgUrl.value = snap.bgUrl
	}

	function applyNewcomerViaDeps(nl, opts) {
		if (typeof deps.applyNewcomer === 'function') deps.applyNewcomer(nl, opts)
	}

	/** 记下当前画面。没有正文、或主题正在切换时不写，避免空列表或旧语录盖掉离开前的字。 */
	function persistHomeCache() {
		if (feedInflight) return
		const uid = userIdOf(getUser())
		if (reactionUserId && uid && reactionUserId !== uid) return
		if (!quoteListHasText(list.value)) return
		if (peekHomeFeedStale() || peekHomeForceQuote()) return
		const topicId = getHomeFeedTopicId()
		if (loadedFeedTopicId == null || Number(loadedFeedTopicId) !== Number(topicId)) return
		const snap = {
			topicId,
			list: cloneQuoteList(list.value),
			current: current.value,
			liked: { ...liked.value },
			disliked: { ...disliked.value },
			reactionUserId: uid,
			config: config.value,
			bgUrl: bgUrl.value,
			bgVideoUrl: bgVideoUrl.value,
			newcomer: deps.newcomer ? deps.newcomer.value : undefined,
		}
		writeSessionHomeLook(snap)
		writePageCache(HOME_CACHE_KEY, snap)
	}

	function pickQuoteText(q) {
		if (q == null) return ''
		if (typeof q === 'string') return q.trim()
		if (typeof q !== 'object') return ''
		const raw = q.content ?? q.text ?? q.body ?? q.quote_text
		if (typeof raw === 'string') return raw.trim()
		if (raw && typeof raw === 'object') {
			if (typeof raw.content === 'string') return raw.content.trim()
			const s = raw.zh || raw.en || raw.text
			return typeof s === 'string' ? s.trim() : ''
		}
		if (q.quote && typeof q.quote === 'object') return pickQuoteText(q.quote)
		return ''
	}

	function normalizeFeedQuote(row) {
		if (row == null) return null
		if (typeof row === 'number' || typeof row === 'string') {
			const n = Number(row)
			return Number.isFinite(n) && n > 0 ? { id: n, content: '' } : null
		}
		if (typeof row !== 'object') return null
		const nested = row.quote
		const inner = (nested && typeof nested === 'object' && !Array.isArray(nested))
			? nested
			: row
		const id = inner.id ?? row.id ?? row.content_id ?? inner.content_id ?? row.quote_id ?? inner.quote_id ?? row.pk
		const n = Number(id)
		if (!Number.isFinite(n) || n <= 0) return null
		const kind = String(inner.kind || row.kind || 'quote').toLowerCase() || 'quote'
		const batchId = inner.batch_id ?? row.batch_id ?? inner.batchId ?? row.batchId
		const expected = inner.expected_read_time ?? row.expected_read_time
		return {
			...row,
			...inner,
			id: n,
			kind,
			content: pickQuoteText(inner) || pickQuoteText(row),
			source_ref: inner.source_ref || row.source_ref || '',
			batch_id: batchId != null && batchId !== '' ? String(batchId) : (inner.batch_id || row.batch_id || ''),
			expected_read_time: expected != null && expected !== '' ? Number(expected) : undefined,
			recall_source: inner.recall_source ?? row.recall_source,
		}
	}

	/** Feed 推荐项：仅语录参与 expose / read-signal */
	function isRecommendQuote(q) {
		if (!q?.id) return false
		if (isAffirmationTarget(q)) return false
		const kind = String(q.kind || 'quote').toLowerCase()
		return kind !== 'affirmation'
	}

	function quoteRowsFromRes(res) {
		const bags = [res?.results, res?.data, res]
		let rows = []
		let batchId = ''
		for (const bag of bags) {
			if (Array.isArray(bag)) {
				rows = bag
				break
			}
			if (!bag || typeof bag !== 'object') continue
			if (bag.batch_id) batchId = String(bag.batch_id)
			if (Array.isArray(bag.list)) {
				rows = bag.list
				break
			}
			if (Array.isArray(bag.quotes)) {
				rows = bag.quotes
				break
			}
			if (Array.isArray(bag.items)) {
				rows = bag.items
				break
			}
			if (Array.isArray(bag.results)) {
				rows = bag.results
				break
			}
		}
		if (!batchId) {
			batchId = String(res?.results?.batch_id || res?.batch_id || '')
		}
		return rows.map(normalizeFeedQuote).filter(Boolean).map((q) => {
			if (q && !q.batch_id && batchId) q.batch_id = batchId
			return q
		})
	}

	function scrapeQuoteIdsFromRes(res) {
		const ids = []
		const seen = new Set()
		const push = (v) => {
			const n = Number(v)
			if (!Number.isFinite(n) || n <= 0 || seen.has(n)) return
			seen.add(n)
			ids.push(n)
		}
		const visit = (node, depth) => {
			if (!node || depth > 5) return
			if (Array.isArray(node)) {
				node.forEach((n) => {
					if (typeof n === 'number' || typeof n === 'string') push(n)
					else visit(n, depth + 1)
				})
				return
			}
			if (typeof node !== 'object') return
			if (node.content_id != null) push(node.content_id)
			else if (node.quote_id != null) push(node.quote_id)
			else if (node.kind === 'quote' || node.content != null || node.text != null) push(node.id)
			visit(node.list, depth + 1)
			visit(node.quotes, depth + 1)
			visit(node.items, depth + 1)
			visit(node.results, depth + 1)
		}
		visit(res, 0)
		return ids
	}

	function patchQuoteIntoList(id, payload) {
		if (id == null || !payload) return
		const prev = list.value.find((q) => String(q.id) === String(id))
		const prevContent = String(prev?.content || '').trim()
		const merged = normalizeFeedQuote({ ...(prev || {}), id, ...payload })
		if (!merged) return
		if (!String(merged.content || '').trim() && prevContent) merged.content = prev.content
		const sid = String(merged.id)
		const idx = list.value.findIndex((q) => String(q.id) === sid)
		if (idx < 0) return
		Object.assign(list.value[idx], merged)
	}

	async function hydrateQuoteDetails(rows, { forceFirst = 0, forceAll = false, syncList = false } = {}) {
		const listRows = rows || []
		const want = []
		const seen = new Set()
		listRows.forEach((q, i) => {
			if (!q?.id) return
			const sid = String(q.id)
			if (seen.has(sid)) return
			const missing = !String(q.content || '').trim()
			if (!forceAll && !missing && i >= forceFirst) return
			seen.add(sid)
			want.push(q)
		})
		if (!want.length) return listRows
		const byId = new Map(listRows.map((q, i) => [String(q.id), i]))
		await Promise.all(want.map(async (q) => {
			try {
				const res = await apiQuote(q.id)
				const payload = res?.results || res
				const idx = byId.get(String(q.id))
				if (idx == null || !payload) return
				const prevContent = String(listRows[idx]?.content || '').trim()
				const merged = normalizeFeedQuote({ ...listRows[idx], ...payload })
				if (merged) {
					if (!String(merged.content || '').trim() && prevContent) merged.content = listRows[idx].content
					const target = listRows[idx]
					if (target && typeof target === 'object') Object.assign(target, merged)
					else listRows[idx] = merged
				}
				if (syncList) patchQuoteIntoList(q.id, payload)
			} catch (e) {}
		}))
		return listRows
	}

	function rememberQuoteReactions(q) {
		if (!q?.id) return
		const payload = {}
		if (q.liked != null) payload.liked = !!q.liked
		if (q.disliked != null) payload.disliked = !!q.disliked
		if (Object.keys(payload).length) writeQuoteStatusCache(q.id, payload)
	}

	/** 把其它页（如喜欢列表）的喜欢/取消写回当前 Feed 与心形。 */
	function applyLikePatches(patch) {
		if (!patch || typeof patch !== 'object') return false
		const ids = Object.keys(patch)
		if (!ids.length) return false
		const next = { ...liked.value }
		let mapChanged = false
		ids.forEach((id) => {
			const mark = !!patch[id]
			if (!Object.prototype.hasOwnProperty.call(next, id) || !!next[id] !== mark) {
				next[id] = mark
				mapChanged = true
			}
		})
		let listChanged = false
		const activeId = String(activeQuote.value?.id || '')
		let activeChanged = false
		if (list.value.length) {
			list.value.forEach((q) => {
				const id = String(q.id)
				if (!Object.prototype.hasOwnProperty.call(patch, id)) return
				const mark = !!patch[id]
				if (id === activeId && quoteLiked(q) !== mark) activeChanged = true
				if (!!q.liked === mark) return
				q.liked = mark
				listChanged = true
			})
		} else if (activeId && Object.prototype.hasOwnProperty.call(patch, activeId)) {
			activeChanged = !!liked.value[activeId] !== !!patch[activeId]
		}
		if (!mapChanged && !listChanged) return false
		if (mapChanged) {
			liked.value = next
			if (activeChanged) likeTick.value += 1
		}
		persistHomeCache()
		return true
	}

	function applyDislikePatches(patch) {
		if (!patch || typeof patch !== 'object') return false
		const ids = Object.keys(patch)
		if (!ids.length) return false
		const next = { ...disliked.value }
		let mapChanged = false
		ids.forEach((id) => {
			const mark = !!patch[id]
			if (!Object.prototype.hasOwnProperty.call(next, id) || !!next[id] !== mark) {
				next[id] = mark
				mapChanged = true
			}
		})
		let listChanged = false
		if (list.value.length) {
			list.value.forEach((q) => {
				const id = String(q.id)
				if (!Object.prototype.hasOwnProperty.call(patch, id)) return
				const mark = !!patch[id]
				if (!!q.disliked === mark) return
				q.disliked = mark
				listChanged = true
			})
		}
		if (!mapChanged && !listChanged) return false
		if (mapChanged) disliked.value = next
		persistHomeCache()
		return true
	}

	function overlayPendingLikes() {
		applyLikePatches(readLikeStatusPatches())
		applyDislikePatches(readDislikeStatusPatches())
	}

	function restoreAccountReactions(userId) {
		const saved = readAccountReactions(userId)
		const likePatch = {}
		const dislikePatch = {}
		list.value.forEach((q) => {
			if (!q?.id) return
			const id = String(q.id)
			const likeMark = Object.prototype.hasOwnProperty.call(saved.liked, id) ? !!saved.liked[id] : false
			const dislikeMark = Object.prototype.hasOwnProperty.call(saved.disliked, id) ? !!saved.disliked[id] : false
			if (quoteLiked(q) !== likeMark) likePatch[id] = likeMark
			if (quoteDisliked(q) !== dislikeMark) dislikePatch[id] = dislikeMark
		})
		if (Object.keys(likePatch).length) applyLikePatches(likePatch)
		if (Object.keys(dislikePatch).length) applyDislikePatches(dislikePatch)
	}

	function assetRows(res) {
		const bag = res?.results ?? res?.data ?? res
		if (Array.isArray(bag)) return bag
		if (Array.isArray(bag?.list)) return bag.list
		if (Array.isArray(bag?.items)) return bag.items
		if (Array.isArray(bag?.results)) return bag.results
		return []
	}

	function assetLikeId(row) {
		if (!row || typeof row !== 'object') return ''
		const type = String(row.item_type || row.target_type || '').toLowerCase()
		if (type === 'affirmation' || type === 'ai_message') return ''
		return String(row.content_id ?? row.quote_id ?? row.id ?? '')
	}

	/** 用喜欢列表把当前账号点过的语录补回首页。只打一次列表接口，不逐条打 /content/quote/。 */
	async function reconcileLikedFromAssets(userId) {
		if (!uni.getStorageSync('token')) return false
		try {
			const res = await apiMyAssets('like', null, { currentPage: 1, pageSize: 100 })
			if (userIdOf(getUser()) !== userId) return false
			const rows = assetRows(res)
			const likedIds = new Set(rows.map(assetLikeId).filter(Boolean))
			const likePatch = {}
			list.value.forEach((q) => {
				const id = String(q?.id || '')
				if (!id || !likedIds.has(id)) return
				if (!quoteLiked(q)) likePatch[id] = true
			})
			if (Object.keys(likePatch).length) {
				applyLikePatches(likePatch)
				const saved = readAccountReactions(userId)
				writeAccountReactions(userId, { ...saved.liked, ...likePatch }, saved.disliked)
			}
			return true
		} catch (e) {
			return false
		}
	}

	/** 换号或重新登录后，按当前账号恢复红心。同一轮只恢复一次。 */
	let restoredForUser = ''
	let accountLikeSyncing = false

	/**
	 * 换账号或退出后再登录：先恢复这个账号自己的红心，再用喜欢列表补齐。
	 * 返回 true 表示不要再叠上一账号留在公共补丁里的状态。
	 */
	function syncHomeLikesForAccount() {
		const id = userIdOf(getUser())
		const switched = !!(reactionUserId && id && reactionUserId !== id)
		const flagged = likeCacheNeedsRefresh()
		if (!switched && !flagged && !accountLikeSyncing) return false
		if (!id) return true
		reactionUserId = id
		if (list.value.length && restoredForUser !== id) {
			restoreAccountReactions(id)
			restoredForUser = id
		}
		if (!list.value.length || accountLikeSyncing) return true
		accountLikeSyncing = true
		reconcileLikedFromAssets(id).then((ok) => {
			if (ok && userIdOf(getUser()) === id) clearLikeCacheRefresh()
		}).finally(() => {
			accountLikeSyncing = false
		})
		return true
	}

	/** 进入首页时同步喜欢 / 不喜欢：以 /content/quote/ 的 liked、disliked 为准。 */
	async function refreshLikeStatus(opts = {}) {
		if (!opts.skipOverlay) overlayPendingLikes()
		if (!uni.getStorageSync('token')) return false
		const owner = userIdOf(getUser())
		const ids = []
		const seen = new Set()
		const pushId = (raw) => {
			if (raw == null) return
			const id = String(raw)
			if (seen.has(id)) return
			seen.add(id)
			ids.push(raw)
		}
		if (opts.all) {
			list.value.forEach((q) => pushId(q?.id))
		} else {
			pushId(activeQuote.value?.id)
			const topicPinned = !!getHomeFeedTopicId()
			list.value.forEach((q, i) => {
				const id = String(q?.id || '')
				if (!id) return
				if (topicPinned && i < 3) {
					pushId(q.id)
					return
				}
				const markedLike = Object.prototype.hasOwnProperty.call(liked.value, id)
					? !!liked.value[id]
					: !!q.liked
				const markedDislike = Object.prototype.hasOwnProperty.call(disliked.value, id)
					? !!disliked.value[id]
					: !!q.disliked
				if (markedLike || markedDislike) pushId(q.id)
			})
		}
		let anyOk = false
		await Promise.all(ids.map(async (id) => {
			try {
				const res = await apiQuote(id)
				if (owner && userIdOf(getUser()) !== owner) return
				const payload = res?.results || res
				writeQuoteStatusCache(id, payload)
				patchQuoteIntoList(id, payload)
				const serverLiked = readLikedField(payload)
				const serverDisliked = readDislikedField(payload)
				if (serverLiked != null) {
					applyLikePatches({ [String(id)]: serverLiked })
					recordLikeStatus(id, serverLiked)
				}
				if (serverDisliked != null) {
					applyDislikePatches({ [String(id)]: serverDisliked })
					recordDislikeStatus(id, serverDisliked)
				}
				anyOk = true
			} catch (e) {}
		}))
		return anyOk
	}

	function onLikeStatusEvent(payload) {
		const id = payload?.id
		if (id == null) return
		applyLikePatches({ [String(id)]: !!payload.liked })
	}
	function onDislikeStatusEvent(payload) {
		const id = payload?.id
		if (id == null) return
		applyDislikePatches({ [String(id)]: !!payload.disliked })
	}
	const stopLikeSync = onLikeStatusChange((id, isLiked) => {
		applyLikePatches({ [id]: !!isLiked })
	})
	const stopDislikeSync = onDislikeStatusChange((id, isDisliked) => {
		applyDislikePatches({ [id]: !!isDisliked })
	})
	uni.$on(LIKE_EVENT, onLikeStatusEvent)
	uni.$on(DISLIKE_EVENT, onDislikeStatusEvent)
	onUnmounted(() => {
		stopLikeSync()
		stopDislikeSync()
		uni.$off(LIKE_EVENT, onLikeStatusEvent)
		uni.$off(DISLIKE_EVENT, onDislikeStatusEvent)
		uni.$off(HOME_THEME_APPLY_EVENT, onThemeApplyEvent)
		uni.$off('selah_vip_activated', onVipActivatedEvent)
	})

	/** 播放当前语录朗读 audio_url；尊重 muted；切换卡片时停上一段。 */
	function playAudio(q) {
		if (!q.audio_url) return
		const u = getUser() || {}
		if (u.muted || u.sound_enabled === false) {
			uni.showToast({ title: t('muted') || 'Muted', icon: 'none' })
			return
		}
		try {
			if (audioCtx) {
				audioCtx.stop()
				audioCtx.destroy()
			}
			audioCtx = uni.createInnerAudioContext()
			audioCtx.src = q.audio_url
			audioCtx.play()
		} catch (e) {
			uni.showToast({ title: t('audio_unavailable'), icon: 'none' })
		}
	}

	/** 顶栏 / Dock 固定控件防抖；不影响 swiper 滑动 */
	const chromeTap = createTapLock(500)

	/** 通用分包导航（topics/checkin/share 等）。 */
	const go = (url) => chromeTap.run(() => uni.navigateTo({ url }))
	const goAi = () => chromeTap.run(() => {
		try { logFirebaseEvent('home_prayer_click') } catch (e) {}
		goTab('/pages/ai/ai')
	})
	const goMe = () => chromeTap.run(() => {
		try { logFirebaseEvent('home_profile_click') } catch (e) {}
		goTab('/pages/profile/profile')
	})
	/** 顶栏 VIP 入口：只打开订阅页。不把当前语录记成锁定内容，关闭后首页文字保持不动。 */
	const goVip = (src) => chromeTap.run(() => {
		if ((src || 'quote_home') === 'quote_home') {
			try { logFirebaseEvent('home_premium_click') } catch (e) {}
		}
		try { uni.removeStorageSync('selah_vip_lock_content_id') } catch (e) {}
		navigateVip(src || 'quote_home')
	})

	const vipLockOpen = ref(false)
	const vipLockSource = ref('quote_lock')

	function openVipLock(src) {
		if (vipCooldownActive()) return
		const q = activeQuote.value
		try {
			if (q?.id) uni.setStorageSync('selah_vip_lock_content_id', Number(q.id) || 0)
		} catch (e) {}
		vipLockSource.value = src || 'quote_lock'
		vipLockOpen.value = true
	}

	const onLockTap = () => {
		openVipLock('quote_lock')
	}

	/** 关闭锁定卡：走冷却，不再自动弹出开通拦截 */
	async function dismissLockHit() {
		const q = activeQuote.value
		try {
			uni.setStorageSync('selah_vip_cooldown_until', Date.now() + 30000)
			if (q?.id) uni.setStorageSync('selah_vip_dismiss_content_id', Number(q.id) || 0)
			uni.removeStorageSync('selah_vip_lock_content_id')
		} catch (e) {}
		vipLockOpen.value = false
		await handleVipDismissCooldown()
	}

	async function closeVipLock() {
		vipLockOpen.value = false
		try {
			if (!vipCooldownActive()) {
				uni.setStorageSync('selah_vip_cooldown_until', Date.now() + 30000)
			}
			const qid = Number(
				uni.getStorageSync('selah_vip_dismiss_content_id')
				|| activeQuote.value?.id
				|| uni.getStorageSync('selah_vip_lock_content_id')
				|| 0,
			)
			if (qid) uni.setStorageSync('selah_vip_dismiss_content_id', qid)
			uni.removeStorageSync('selah_vip_lock_content_id')
		} catch (e) {}
		await handleVipDismissCooldown()
	}

	function onVipActivated() {
		vipLockOpen.value = false
		const q = activeQuote.value
		if (q) {
			q.locked = false
			q.is_vip = false
		}
	}

	function onVipActivatedEvent() {
		onVipActivated()
	}
	uni.$on('selah_vip_activated', onVipActivatedEvent)

	function vipCooldownActive() {
		try {
			const until = Number(uni.getStorageSync('selah_vip_cooldown_until') || 0)
			return until > Date.now()
		} catch (e) {
			return false
		}
	}

	function feedRequestParams(pageSize) {
		const params = { pageSize, timezone: getTimezone() }
		const ids = list.value.map((q) => q.id).filter(Boolean)
		if (ids.length) params.exclude_ids = ids
		if (vipCooldownActive()) params.vip_cooldown = 1
		return params
	}

	function isVipItem(q) {
		return !!(q && (q.is_vip || q.locked))
	}

	function filterVipIfCooling(items) {
		if (!vipCooldownActive() || !items?.length) return items || []
		return items.filter((q) => !isVipItem(q))
	}

	/** 仅在刚关掉开通窗时清 VIP 并补内容。普通返回首页不改列表，避免文字被清空后再出现。 */
	async function handleVipDismissCooldown() {
		let qid = 0
		try {
			qid = Number(uni.getStorageSync('selah_vip_dismiss_content_id') || 0)
		} catch (e) {}
		if (!qid) return
		const target = list.value.find((q) => Number(q.id) === qid)
		try { uni.removeStorageSync('selah_vip_dismiss_content_id') } catch (e) {}
		// 右上角进会员页再关掉时，当前语录不是锁定卡，不要把它从首页拿掉
		if (target && !isVipItem(target)) return
		try {
			if (!vipCooldownActive()) {
				uni.setStorageSync('selah_vip_cooldown_until', Date.now() + 30000)
			}
		} catch (e) {}
		try {
			await apiExpose(qid, { batch_id: target?.batch_id })
		} catch (e) {}
		const beforeLen = list.value.length
		const keptIndex = current.value
		list.value = list.value.filter((q) => !isVipItem(q) && Number(q.id) !== qid)
		if (list.value.length === beforeLen) return
		current.value = Math.min(keptIndex, Math.max(0, list.value.length - 1))
		feedSwiperKey.value += 1
		const need = Math.max(FEED_BATCH, beforeLen - list.value.length)
		await fetchMoreFeed(need)
		try { persistHomeCache() } catch (e) {}
	}

	/** 携带当前语录 id 进入分享页。 */
	const goShare = (q) => chromeTap.run(() => {
		if (!q) return
		try { logFirebaseEvent('home_quoteShare_click') } catch (e) {}
		openSharePage({ id: q.id, text: q.content, cite: q.source_ref, fbSource: 'home' })
	})

	function dwellElapsedMs() {
		if (dwellContentId == null) return 0
		let ms = dwellAccumMs
		if (!dwellPaused && dwellSegmentAt) ms += Math.max(0, Date.now() - dwellSegmentAt)
		return ms
	}

	/** 结算本卡有效停留 → read-signal（仅语录）；埋点字段本期不改。 */
	function flushReadSignal() {
		if (dwellContentId == null) return
		const q = dwellQuote
		const contentId = dwellContentId
		const ms = dwellElapsedMs()
		const durationSec = Math.max(0, Math.round(ms / 1000))
		const dwellSec = Math.round((ms / 1000) * 100) / 100
		dwellContentId = null
		dwellQuote = null
		dwellAccumMs = 0
		dwellSegmentAt = 0
		dwellPaused = false
		try { logFirebaseEvent('feed_quote_leave', { duration: durationSec }) } catch (e) {}
		if (!isRecommendQuote(q || { id: contentId })) return
		const expected = Number(q?.expected_read_time)
		const body = {
			content_id: contentId,
			batch_id: q?.batch_id || '',
			effective_dwell_time: dwellSec,
		}
		if (Number.isFinite(expected) && expected > 0) {
			body.expected_read_time = expected
			const threshold = Math.max(0.8, expected * 0.25)
			body.is_quick_skip = dwellSec < threshold
		}
		apiReadSignal(body).catch(() => {})
	}

	/** 开始新卡停留计时（先结算上一张）。 */
	function beginDwell(q) {
		flushReadSignal()
		if (!q?.id) return
		dwellContentId = q.id
		dwellQuote = q
		dwellAccumMs = 0
		dwellSegmentAt = Date.now()
		dwellPaused = false
	}

	/** 全屏遮挡（VIP 锁 / 弹层）期间暂停有效停留，不结算。 */
	function pauseFeedRead() {
		if (dwellContentId == null || dwellPaused) return
		dwellAccumMs += Math.max(0, Date.now() - dwellSegmentAt)
		dwellSegmentAt = 0
		dwellPaused = true
	}

	/** 切后台 / 离开首页：结算 read-signal。 */
	function settleFeedRead() {
		flushReadSignal()
	}

	/** 遮挡关闭或 onShow：继续同一卡，或重新开始计时。 */
	function resumeFeedRead() {
		if (dwellContentId != null && dwellPaused) {
			dwellPaused = false
			dwellSegmentAt = Date.now()
			return
		}
		const q = activeQuote.value
		if (q?.id && dwellContentId == null) beginDwell(q)
	}

	function isExposeNotFound(err) {
		const status = Number(err?.statusCode ?? err?.status ?? err?.code ?? err?.data?.code ?? 0)
		return status === 404
	}

	/** 曝光 404 只刷新一次，避免新内容再 404 时连环重拉。 */
	let expose404Hold = false
	/** 同一条语录短时间只曝一次，避免 onShow 循环狂刷 */
	let lastExposeId = null
	let lastExposeAt = 0

	/** 上报当前可见语录曝光；affirmation 禁止；进入首页 / 滑动共用。 */
	function exposeActiveQuote() {
		const q = activeQuote.value
		if (!isRecommendQuote(q)) return
		const now = Date.now()
		if (lastExposeId === q.id && now - lastExposeAt < 2500) return
		lastExposeId = q.id
		lastExposeAt = now
		try { logFirebaseEvent('feed_quote_show', { cotentId: q.id }) } catch (e) {}
		if (!q.locked) {
			try { logFirebaseEvent('quote_like_show') } catch (e) {}
		}
		apiExpose(q.id, { batch_id: q.batch_id }).then(() => {
			expose404Hold = false
		}).catch((err) => {
			if (!isExposeNotFound(err) || expose404Hold) return
			expose404Hold = true
			loadFeed({ trackView: true, hydrateQuotes: true, replace: true })
				.then(() => persistHomeCache())
				.catch(() => {})
		})
		if (typeof deps.noteHomeView === 'function') deps.noteHomeView(q.id)
	}

	/** 拉取 Feed（可 refresh）；成功后 merge 并 persist；触发新人进度与签到弹窗逻辑。 */
	async function loadFeed({ trackView = true, hydrateQuotes = true, replace = true } = {}) {
		if (feedInflight) return feedInflight
		feedInflight = (async () => {
		const topicId = getHomeFeedTopicId()
		loadedFeedTopicId = topicId
		consumeHomeFeedStale()
		consumeHomeForceQuote()
		feedExhausted = false
		topicQuotePage = 1
		let rows = []
		if (topicId) {
			const res = await apiTopicQuotes(topicId, { currentPage: 1, pageSize: FEED_FIRST_PAGE })
			rows = quoteRowsFromRes(res)
			if (!rows.length) {
				rows = scrapeQuoteIdsFromRes(res).map((id) => ({ id, content: '' }))
			}
			const totalPages = Number(res?.pagination?.total_pages || 1)
			topicQuotePage = 2
			feedExhausted = topicQuotePage > totalPages || !rows.length
		} else {
			// 推荐 v2：按服务端 list 原序展示，客户端禁止 shuffle
			const params = { pageSize: FEED_FIRST_PAGE, timezone: getTimezone() }
			if (vipCooldownActive()) params.vip_cooldown = 1
			const res = await apiFeed(params)
			rows = quoteRowsFromRes(res)
			rows = filterVipIfCooling(rows)
		}
		if (hydrateQuotes && rows.length) {
			rows = await hydrateQuoteDetails(rows, { forceFirst: 0 })
		}
		if (replace || !list.value.length) {
			if (rows.length || !list.value.length) replaceFeed(rows)
		} else if (rows.length) {
			mergeIncomingFeed(rows)
		}
		const map = {}
		const dmap = {}
		list.value.forEach((q) => {
			if (!q?.id) return
			const id = String(q.id)
			if (q.liked != null) map[id] = !!q.liked
			if (q.disliked != null) dmap[id] = !!q.disliked
			rememberQuoteReactions(q)
		})
		liked.value = map
		disliked.value = dmap
		overlayPendingLikes()
		if (list.value[0] && trackView) {
			exposeActiveQuote()
			beginDwell(list.value[0])
		}
		})().finally(() => {
			feedInflight = null
		})
		return feedInflight
	}

	function onThemeApplyEvent() {
		loadedFeedTopicId = null
		loadFeed({ trackView: true, hydrateQuotes: true, replace: true })
			.then(() => persistHomeCache())
			.catch(() => {})
	}
	uni.$on(HOME_THEME_APPLY_EVENT, onThemeApplyEvent)

	/** 主题未更新且当前画面还有正文时，不重复打 /content/quote/。 */
	function homeFeedNeedsReload() {
		const topicId = getHomeFeedTopicId()
		const sameTopic = loadedFeedTopicId != null && Number(loadedFeedTopicId) === Number(topicId)
		if (sameTopic && quoteListHasText(list.value) && !peekHomeFeedStale()) {
			if (peekHomeForceQuote()) consumeHomeForceQuote()
			return false
		}
		if (peekHomeFeedStale() || peekHomeForceQuote()) return true
		if (loadedFeedTopicId == null) return true
		return !sameTopic || !quoteListHasText(list.value)
	}

	/** 主题没换：恢复离开前的壁纸和文字，并告诉调用方不要再请求。 */
	function keepHomeLook() {
		if (peekHomeFeedStale()) return false
		if (!homeFeedNeedsReload()) return true
		if (peekHomeForceQuote()) return false
		return applyKeptLook(readKeptHomeLook())
	}

	async function hydratePinnedTopicQuotes() {
		if (feedInflight) return
		const topicId = getHomeFeedTopicId()
		if (!topicId) return
		if (!homeFeedNeedsReload()) return
		await loadFeed({ trackView: true, hydrateQuotes: true })
	}

	async function reloadHomeFeedIfStale() {
		if (feedInflight) return false
		const pinned = getHomeFeedTopicId()
		const topicChanged = loadedFeedTopicId != null && Number(loadedFeedTopicId) !== Number(pinned)
		const stale = peekHomeFeedStale()
		const forceQuote = peekHomeForceQuote()
		if (!stale && !topicChanged && !forceQuote) return false
		const alreadyShowing = list.value.length > 0
			&& loadedFeedTopicId != null
			&& Number(loadedFeedTopicId) === Number(pinned)
		if (alreadyShowing && !topicChanged && !stale) {
			consumeHomeForceQuote()
			return false
		}
		await loadFeed({ trackView: true, hydrateQuotes: true, replace: true })
		persistHomeCache()
		return true
	}

	function withKeptCopy(prev, incoming) {
		if (!prev) return incoming
		const next = { ...prev, ...incoming, id: prev.id }
		if (!String(incoming?.content || '').trim() && String(prev.content || '').trim()) {
			next.content = prev.content
		}
		if (!String(incoming?.source_ref || '').trim() && prev.source_ref) {
			next.source_ref = prev.source_ref
		}
		// 详情补全勿丢掉 Feed 下发的 batch_id / 预计阅读时长
		if (!next.batch_id && prev.batch_id) next.batch_id = prev.batch_id
		if (next.expected_read_time == null && prev.expected_read_time != null) {
			next.expected_read_time = prev.expected_read_time
		}
		if (!next.kind && prev.kind) next.kind = prev.kind
		return next
	}

	function replaceFeed(rows) {
		const prevById = new Map(list.value.map((q) => [String(q.id), q]))
		const next = (rows || []).map((q) => withKeptCopy(prevById.get(String(q?.id)), q))
		const hadText = list.value.some((q) => String(q?.content || '').trim())
		const nextHasText = next.some((q) => String(q?.content || '').trim())
		if (hadText && !nextHasText) return
		const sameIds = next.length === list.value.length
			&& next.every((q, i) => String(q.id) === String(list.value[i]?.id))
		list.value = next.length ? next : list.value
		if (!sameIds) {
			current.value = 0
			feedSwiperKey.value += 1
		}
	}

	function mergeIncomingFeed(rows) {
		if (!rows?.length) return
		const byId = new Map(list.value.map((q) => [String(q.id), q]))
		for (const q of rows) {
			if (!q?.id) continue
			const prev = byId.get(String(q.id))
			if (!prev) continue
			Object.assign(prev, withKeptCopy(prev, q))
		}
		mergeFeedItems(rows)
	}

	/** 合并新旧 Feed，按 id 去重，保留已 like 等本地态。 */
	function mergeFeedItems(incoming) {
		if (!incoming?.length) return 0
		const seen = new Set(list.value.map((q) => q.id))
		const add = []
		const likePatch = { ...liked.value }
		const dislikePatch = { ...disliked.value }
		for (const q of incoming) {
			if (!q?.id || seen.has(q.id)) continue
			seen.add(q.id)
			add.push(q)
			if (q.liked) likePatch[String(q.id)] = true
			if (q.disliked != null) dislikePatch[String(q.id)] = !!q.disliked
			rememberQuoteReactions(q)
		}
		if (!add.length) return 0
		const room = Math.max(FEED_SOFT_CAP - list.value.length, 0)
		const slice = add.slice(0, room)
		list.value = list.value.concat(slice)
		liked.value = likePatch
		disliked.value = dislikePatch
		overlayPendingLikes()
		return slice.length
	}

	/** 静默补货 / 上拉加载更多：受软上限 FEED_SOFT_CAP 与 feedLoading/feedExhausted 并发锁约束 */
	async function fetchMoreFeed(pageSize = FEED_BATCH) {
		if (feedLoading || feedExhausted) return 0
		if (list.value.length >= FEED_SOFT_CAP) return 0
		feedLoading = true
		try {
			const need = Math.min(pageSize, FEED_SOFT_CAP - list.value.length)
			const topicId = getHomeFeedTopicId()
			let items = []
			if (topicId) {
				if (feedExhausted) return 0
				const res = await apiTopicQuotes(topicId, { currentPage: topicQuotePage, pageSize: need })
				items = quoteRowsFromRes(res)
				const totalPages = Number(res?.pagination?.total_pages || 1)
				topicQuotePage += 1
				if (topicQuotePage > totalPages) feedExhausted = true
			} else {
				const res = await apiFeed(feedRequestParams(need))
				items = filterVipIfCooling(quoteRowsFromRes(res))
			}
			if (!items.length) {
				feedExhausted = true
				return 0
			}
			const n = mergeFeedItems(items)
			// 全是重复也视为本批无增量，避免死循环狂刷
			if (n === 0) feedExhausted = true
			return n
		} catch (e) {
			return 0
		} finally {
			feedLoading = false
		}
	}

	/** 首屏就绪后后台静默预取有限轮次，写入缓存但不打断当前滑动 */
	async function silentPrefetchFeed() {
		if (getHomeFeedTopicId()) {
			persistHomeCache()
			return
		}
		for (let i = 0; i < FEED_SILENT_ROUNDS; i++) {
			if (list.value.length >= FEED_SOFT_CAP || feedExhausted) break
			const n = await fetchMoreFeed(FEED_BATCH)
			if (!n) break
		}
		persistHomeCache()
	}

	/** 滑动接近末尾时触发 silentPrefetch，降低白屏。 */
	function maybePrefetchOnSwipe() {
		const ahead = list.value.length - current.value - 1
		if (ahead > FEED_LOW_WATER) return
		if (list.value.length >= FEED_SOFT_CAP || feedExhausted || feedLoading) return
		fetchMoreFeed(FEED_BATCH).then((n) => {
			if (n) persistHomeCache()
		})
	}

	let feedTouchY = 0
	let noMoreToastAt = 0
	let feedNavAt = 0

	function toastNoMore() {
		const now = Date.now()
		if (now - noMoreToastAt < 1600) return
		noMoreToastAt = now
		uni.showToast({ title: t('no_more'), icon: 'none' })
	}

	function feedCanLoadMore() {
		if (feedExhausted) return false
		if (list.value.length >= FEED_SOFT_CAP) return false
		return true
	}

	function atFeedEnd() {
		return current.value >= list.value.length - 1 && !feedCanLoadMore() && !feedLoading
	}

	/** 原生 swiper 不再跟手。越界时不改 current，页面停住。 */
	function onFeedTouchStart(e) {
		const touch = e?.touches?.[0] || e?.changedTouches?.[0]
		feedTouchY = Number(touch?.clientY ?? touch?.pageY) || 0
	}

	function onFeedTouchMove() {}

	function onFeedTouchEnd(e) {
		const now = Date.now()
		if (now - feedNavAt < 280) return
		const touch = e?.changedTouches?.[0]
		const endY = Number(touch?.clientY ?? touch?.pageY)
		if (!Number.isFinite(endY)) return
		const dy = endY - feedTouchY
		if (Math.abs(dy) < 48) return
		feedNavAt = now
		const toNext = dy < 0
		let landed = current.value
		if (toNext && current.value < list.value.length - 1) landed = current.value + 1
		else if (!toNext && current.value > 0) landed = current.value - 1
		try { logFirebaseEvent('feed_swipe', { count: landed + 1 }) } catch (err) {}
		if (toNext) {
			if (current.value < list.value.length - 1) {
				onSwipe({ detail: { current: current.value + 1 } })
				return
			}
			if (feedCanLoadMore()) {
				fetchMoreFeed(FEED_BATCH).then((n) => {
					if (n > 0 && current.value < list.value.length - 1) {
						onSwipe({ detail: { current: current.value + 1 } })
						return
					}
					toastNoMore()
				})
				return
			}
			toastNoMore()
			return
		}
		if (current.value <= 0) {
			toastNoMore()
			return
		}
		onSwipe({ detail: { current: current.value - 1 } })
	}

	/** 卡片滑动：切换索引、曝光、预取、停音频。 */
	function onSwipe(e) {
		const idx = Number(e?.detail?.current)
		if (!Number.isFinite(idx) || idx < 0 || idx === current.value) {
			maybePrefetchOnSwipe()
			return
		}
		if (idx > current.value && atFeedEnd()) {
			toastNoMore()
			return
		}
		if (idx < current.value && current.value <= 0) {
			toastNoMore()
			return
		}
		current.value = idx
		persistHomeCache()
		const q = list.value[current.value]
		if (q) {
			exposeActiveQuote()
			beginDwell(q)
			// 刷到 VIP：仅展示锁定卡；点 CTA/箭头再开开通窗，点关闭走冷却跳过拦截
		}
		maybePrefetchOnSwipe()
	}

	/** 应用当前壁纸：本地快照秒开；无 token 时禁止拉需鉴权列表，避免抢跑 401。 */
	async function applyWallpaper(opts = {}) {
		try {
			const hasToken = !!uni.getStorageSync('token')
			const snap = await resolveActiveWallpaper(user.value, {
				...opts,
				allowNetwork: hasToken && opts.allowNetwork !== false,
			})
			const url = wallpaperDisplayUrl(snap) || FALLBACK_WALLPAPER
			bgUrl.value = url
			bgVideoUrl.value = wallpaperOverlayVideoUrl(snap)
			if (bgVideoUrl.value) playWallpaperVideo('homeBgVideo')
		} catch (e) {
			if (!bgUrl.value) bgUrl.value = FALLBACK_WALLPAPER
			bgVideoUrl.value = ''
		}
	}

	function onBgError() {
		if (bgUrl.value !== FALLBACK_WALLPAPER) bgUrl.value = FALLBACK_WALLPAPER
	}

	function onBgVideoError() {
		bgVideoUrl.value = ''
	}

	return {
		HOME_CACHE_KEY,
		list,
		current,
		feedSwiperKey,
		liked,
		disliked,
		likeTick,
		user,
		bgUrl,
		bgVideoUrl,
		config,
		activeQuote,
		isActiveLiked,
		isActiveDisliked,
		brandLabel,
		quoteLiked,
		quoteDisliked,
		applyHomeCache,
		persistHomeCache,
		applyLikePatches,
		overlayPendingLikes,
		syncHomeLikesForAccount,
		refreshLikeStatus,
		playAudio,
		go,
		goAi,
		goMe,
		goVip,
		onLockTap,
		dismissLockHit,
		vipLockOpen,
		vipLockSource,
		closeVipLock,
		onVipActivated,
		vipCooldownActive,
		handleVipDismissCooldown,
		goShare,
		pauseFeedRead,
		settleFeedRead,
		resumeFeedRead,
		exposeActiveQuote,
		loadFeed,
		homeFeedNeedsReload,
		keepHomeLook,
		reloadHomeFeedIfStale,
		hydratePinnedTopicQuotes,
		fetchMoreFeed,
		silentPrefetchFeed,
		onFeedTouchStart,
		onFeedTouchMove,
		onFeedTouchEnd,
		onSwipe,
		applyWallpaper,
		onBgError,
		onBgVideoError,
	}
}
