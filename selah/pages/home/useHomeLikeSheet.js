/**
 * 首页新人点赞进度、喜欢 Sheet、爆发动效与 toggleLike。
 */
import { ref, computed } from 'vue'
import { apiLike, apiNewcomerLike, isAffirmationTarget, contentTargetType } from '@/api/content.js'
import { getUser, setUser } from '@/utils/session.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { playSfx } from '@/utils/sfx.js'
import { cmsText } from '@/utils/cmsI18n.js'
import { recordLikeStatus } from '@/utils/likeSync.js'
import { readPageCache } from '@/utils/pageCache.js'
import { HOME_CACHE_KEY, readSessionHomeLook } from '@/utils/homeFeedSync.js'

/** 点满后写入本地。用户资料被刷新冲掉字段时，进度条也不会再出现。 */
const NEWCOMER_FILLED_KEY = 'selah_newcomer_like_filled'

function newcomerLooksFull(nl) {
	if (!nl || typeof nl !== 'object') return false
	const goal = Number(nl.goal) || 0
	return goal > 0 && Number(nl.current) >= goal
}

function readCachedNewcomer() {
	try {
		const session = readSessionHomeLook()
		if (session && session.newcomer) return session.newcomer
	} catch (e) {}
	try {
		const page = readPageCache(HOME_CACHE_KEY)
		if (page && page.newcomer) return page.newcomer
	} catch (e) {}
	return null
}

function filledState(goal) {
	const g = Number(goal) > 0 ? Number(goal) : 5
	return {
		current: g,
		goal: g,
		visible: false,
		completed: true,
		just_completed: false,
	}
}

/** 首屏用本地结果决定要不要画进度条，不等接口回来。 */
function readNewcomerBoot() {
	let stored = false
	try { stored = !!uni.getStorageSync(NEWCOMER_FILLED_KEY) } catch (e) {}
	const userFull = !!(getUser() || {}).newcomer_like_completed
	const cached = readCachedNewcomer()
	if (stored || userFull || newcomerLooksFull(cached)) {
		const goal = Number(cached && cached.goal) > 0 ? Number(cached.goal) : 5
		return { locked: true, resolved: true, state: filledState(goal) }
	}
	const goal = Number(cached && cached.goal) > 0 ? Number(cached.goal) : 5
	const cur = Math.max(0, Math.min(goal, Number(cached && cached.current) || 0))
	if (cur > 0 && cur < goal) {
		return {
			locked: false,
			resolved: true,
			state: {
				current: cur,
				goal,
				visible: true,
				completed: false,
				just_completed: false,
			},
		}
	}
	return {
		locked: false,
		resolved: false,
		state: {
			current: 0,
			goal,
			visible: true,
			completed: false,
			just_completed: false,
		},
	}
}

/**
 * @param {{
 *   t: Function,
 *   config: import('vue').Ref,
 *   user: import('vue').Ref,
 *   list: import('vue').Ref,
 *   liked: import('vue').Ref,
 *   likeTick: import('vue').Ref,
 *   quoteLiked: Function,
 *   persistHomeCache: Function,
 *   deps: Record<string, any>,
 * }} opts
 * deps 回填：checkinPopup
 */
export function useHomeLikeSheet({
	t,
	config,
	user,
	list,
	liked,
	likeTick,
	quoteLiked,
	persistHomeCache,
	deps,
}) {
	/** 进行中的 newcomer GET；点赞写入后自增，避免过期 GET 把 1/5 盖回去 */
	let newcomerGen = 0
	let pendingNewcomerSheet = false
	let checkinSettled = false

	const boot = readNewcomerBoot()
	/** 一旦点满就锁死，接口或缓存都不能再把进度条放出来 */
	const newcomerLocked = ref(boot.locked)
	/** 还没确认进度前不渲染，避免进首页先闪 0/5 再被 5/5 关掉 */
	const newcomerResolved = ref(boot.resolved)
	const newcomer = ref(boot.state)

	function rememberNewcomerFilled() {
		try { uni.setStorageSync(NEWCOMER_FILLED_KEY, '1') } catch (e) {}
		const u = { ...(getUser() || {}), newcomer_like_completed: true }
		setUser(u)
		user.value = u
	}

	if (boot.locked) rememberNewcomerFilled()
	const showLikeSheet = ref(false)
	const showComplete = ref(false)
	const burstShow = ref(false)
	/** 同一条进行中则忽略；首页按钮同时绑了 @tap/@click，不锁会连发 like 再 unlike */
	const likeInFlight = new Set()

	function cfgText(key, i18nKey) {
		const v = String((config.value || {})[key] || '').trim()
		return cmsText(v, i18nKey)
	}

	const newcomerTitle = computed(() => cfgText('newcomer_intro_title', 'newcomer_title'))
	const newcomerDesc = computed(() => cfgText('newcomer_intro_body', 'newcomer_desc'))
	const newcomerCongrats = computed(() => cfgText('newcomer_congrats_text', 'newcomer_congrats'))
	const newcomerDone = computed(() => cfgText('newcomer_done_text', 'newcomer_done'))

	function applyNewcomer(nl, opts = {}) {
		if (!nl || typeof nl !== 'object') return
		const fromCache = opts.fromCache === true
		if (newcomerLocked.value) {
			const goal = Number(nl.goal) > 0 ? Number(nl.goal) : (Number(newcomer.value.goal) || 5)
			newcomer.value = filledState(goal)
			newcomerResolved.value = true
			return
		}
		const goal = Number(nl.goal) > 0 ? Number(nl.goal) : 5
		const cur = Math.max(0, Math.min(goal, Number(nl.current) || 0))
		const completed = cur >= goal
		if (completed) {
			newcomerLocked.value = true
			rememberNewcomerFilled()
			newcomer.value = {
				...filledState(goal),
				just_completed: !fromCache && !!nl.just_completed,
			}
			newcomerResolved.value = true
			return
		}
		// 缓存里的 0/5 可能是还没拉到接口时写下的，不能拿来把进度条闪出来
		if (fromCache && cur <= 0) return
		newcomer.value = {
			current: cur,
			goal,
			completed: false,
			just_completed: false,
			visible: true,
		}
		const u = { ...(getUser() || {}), newcomer_like_completed: false }
		setUser(u)
		user.value = u
		newcomerResolved.value = true
	}

	const showNewcomerProgress = computed(() => {
		if (newcomerLocked.value || !newcomerResolved.value) return false
		const n = newcomer.value || {}
		const goal = Number(n.goal) || 0
		return !(goal > 0 && Number(n.current) >= goal)
	})

	function maybeShowNewcomerSheet() {
		const checkinPopup = deps.checkinPopup
		if (!pendingNewcomerSheet || !checkinSettled || (checkinPopup && checkinPopup.value)) return
		pendingNewcomerSheet = false
		if (uni.getStorageSync('newcomer_sheet_seen')) return
		if (!newcomer.value.visible || newcomer.value.completed) return
		showLikeSheet.value = true
		uni.setStorageSync('newcomer_sheet_seen', '1')
		try { logFirebaseEvent('like_popup_show') } catch (e) {}
	}

	/** 打开点赞后的收藏夹选择底栏。 */
	function openLikeSheet() {
		const opened = !showLikeSheet.value
		showLikeSheet.value = true
		if (opened) {
			try { logFirebaseEvent('like_popup_show') } catch (e) {}
		}
	}

	/** 关闭收藏夹选择底栏。 */
	function closeLikeSheet() {
		showLikeSheet.value = false
	}

	/** 拉取新人点赞进度（如 0/5）；目标来自 newcomer_like_goal。 */
	async function loadNewcomer() {
		const gen = newcomerGen
		const res = await apiNewcomerLike()
		if (gen !== newcomerGen) return
		applyNewcomer(res.results)
		if (newcomer.value.visible && !newcomer.value.completed && !uni.getStorageSync('newcomer_sheet_seen')) {
			pendingNewcomerSheet = true
			maybeShowNewcomerSheet()
		}
	}

	/**
	 * 喜欢/取消喜欢：
	 * 1) 乐观更新本地 liked map（立即红心）
	 * 2) 喜欢时播音效 + 爆发动效
	 * 3) 调 /content/like/；以返回的 results.liked 为准刷新按钮态
	 * 4) 用返回的 newcomer_like 刷新 0/5 进度；just_completed 播完成层
	 * 没点满就继续计数（跨天也算）。点满后进度条收起，之后不再出现。
	 */
	async function toggleLike(q) {
		if (!q?.id) return
		const id = String(q.id)
		if (likeInFlight.has(id)) return
		likeInFlight.add(id)
		const next = !quoteLiked(q)
		try {
			if (next) logFirebaseEvent('quote_like_click')
		} catch (e) {}
		const prevCurrent = newcomer.value.current
		const prevNewcomer = { ...newcomer.value }
		const countsNewcomer = !isAffirmationTarget(q)
		// 乐观 UI：不等接口回来先翻状态，避免滑动卡顿
		liked.value = { ...liked.value, [id]: next }
		likeTick.value += 1
		if (next) {
			playSfx('like')
			burstShow.value = true
			setTimeout(() => { burstShow.value = false }, 700)
		}
		const goalNow = newcomer.value.goal || 5
		const alreadyFull = newcomerLocked.value || !!prevNewcomer.completed || prevCurrent >= goalNow
		// 已经点满时先不改进度条，等 like 返回再决定。否则会先露出 4/5，接口仍是 5/5 时一闪而过。
		if (countsNewcomer && !alreadyFull) {
			const nextCurrent = Math.max(0, Math.min(goalNow, prevCurrent + (next ? 1 : -1)))
			newcomer.value = {
				...newcomer.value,
				current: nextCurrent,
				completed: nextCurrent >= goalNow,
				visible: true,
			}
			newcomerGen += 1
		}
		try {
			const res = await apiLike(q.id, next, { target_type: contentTargetType(q) })
			// 按钮态以接口 results.liked 为准
			const serverLiked = !!(res?.results?.liked ?? res?.liked)
			liked.value = { ...liked.value, [id]: serverLiked }
			likeTick.value += 1
			const idx = list.value.findIndex((x) => String(x.id) === id)
			if (idx >= 0) list.value[idx].liked = serverLiked
			recordLikeStatus(q.id, serverLiked)
			if (!next && !serverLiked) {
				try { logFirebaseEvent('quote_like_cancel', { source: 'home' }) } catch (e) {}
			}
			const nl = countsNewcomer ? (res?.results?.newcomer_like ?? res?.newcomer_like) : null
			if (nl) {
				newcomerGen += 1
				applyNewcomer(nl)
				if (serverLiked && countsNewcomer) {
					try { logFirebaseEvent('like_task_progress', { likeProgress: Number(nl.current || 0) }) } catch (e) {}
				}
				if (nl.just_completed) {
					try { logFirebaseEvent('like_task_complete') } catch (e) {}
					showComplete.value = true
					setTimeout(() => {
						showComplete.value = false
					}, 2200)
					uni.showToast({
						title: newcomerDone.value,
						icon: 'none',
						duration: 2500,
					})
				}
			} else if (countsNewcomer) {
				loadNewcomer().catch(() => {})
			}
			persistHomeCache()
		} catch (e) {
			liked.value = { ...liked.value, [id]: !next }
			likeTick.value += 1
			if (!newcomerLocked.value) newcomer.value = prevNewcomer
		} finally {
			likeInFlight.delete(id)
		}
	}

	function getCheckinSettled() {
		return checkinSettled
	}

	function setCheckinSettled(v) {
		checkinSettled = !!v
	}

	return {
		newcomer,
		showNewcomerProgress,
		showLikeSheet,
		showComplete,
		burstShow,
		newcomerTitle,
		newcomerDesc,
		newcomerCongrats,
		newcomerDone,
		applyNewcomer,
		maybeShowNewcomerSheet,
		openLikeSheet,
		closeLikeSheet,
		loadNewcomer,
		toggleLike,
		getCheckinSettled,
		setCheckinSettled,
	}
}
