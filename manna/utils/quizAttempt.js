/**
 * Quiz 闯关 attempt 缓存 / 续关 / Tab 跳板标记
 */
import { apiQuizHome, apiQuizStart } from '@/api/quiz.js'
import { setTabUiKey } from '@/utils/tabbar.js'

export const QUIZ_SHOW_HUB_KEY = 'manna_quiz_show_hub'
export const QUIZ_ATTEMPT_KEY = 'manna_quiz_attempt'
export const QUIZ_REVIEW_KEY = 'manna_quiz_review'

export function markShowQuizHub() {
	try {
		uni.setStorageSync(QUIZ_SHOW_HUB_KEY, 1)
	} catch (e) {}
}

export function consumeShowQuizHub() {
	try {
		const v = uni.getStorageSync(QUIZ_SHOW_HUB_KEY)
		if (v) {
			uni.removeStorageSync(QUIZ_SHOW_HUB_KEY)
			return true
		}
	} catch (e) {}
	return false
}

export function peekShowQuizHub() {
	try {
		return !!uni.getStorageSync(QUIZ_SHOW_HUB_KEY)
	} catch (e) {
		return false
	}
}

export function clearShowQuizHub() {
	try {
		uni.removeStorageSync(QUIZ_SHOW_HUB_KEY)
	} catch (e) {}
}

/** 仅当 attempt 换新时清本地答题进度 */
export function clearReviewIfNewAttempt(nextAttemptId) {
	const nextId = Number(nextAttemptId || 0)
	if (!nextId) return
	try {
		const prev = uni.getStorageSync(QUIZ_REVIEW_KEY) || {}
		const prevId = Number(prev.attempt_id || 0)
		if (prevId && prevId !== nextId) {
			uni.removeStorageSync(QUIZ_REVIEW_KEY)
		}
	} catch (e) {}
}

/** 用服务端 answered 重建本地 review（权威进度） */
export function syncReviewFromAnswered(attempt) {
	const a = attempt || {}
	const attemptId = Number(a.attempt_id || 0)
	if (!attemptId) return
	const answered = a.answered || a.answers || []
	if (!Array.isArray(answered) || !answered.length) return
	const qMap = {}
	;(a.questions || []).forEach((q) => {
		if (q?.id != null) qMap[q.id] = q
	})
	const items = answered
		.map((row) => {
			const id = Number(row.question_id || row.id || 0)
			if (!id) return null
			const q = qMap[id] || {}
			return {
				id,
				stem: q.stem || row.stem || '',
				options: q.options || [],
				picked: String(row.option_key || row.picked || ''),
				correct: !!row.correct,
				answer_key: String(row.answer_key || ''),
			}
		})
		.filter(Boolean)
	if (!items.length) return
	uni.setStorageSync(QUIZ_REVIEW_KEY, { attempt_id: attemptId, items })
}

export function cacheAttemptPayload(payload, extras = {}) {
	const d = payload || {}
	const attemptId = Number(d.attempt_id || 0)
	if (!attemptId) return null
	clearReviewIfNewAttempt(attemptId)
	syncReviewFromAnswered(d)
	const cached = {
		...d,
		attempt_id: attemptId,
		level_id: d.level_id || extras.level_id || uni.getStorageSync('manna_quiz_last_level_id'),
		level_no: Number(d.level_no || extras.level_no || 0) || 1,
		title: d.title || extras.title || '',
		balance: typeof d.balance === 'number' ? d.balance : extras.balance,
		time_limit_sec: Number(d.time_limit_sec || extras.time_limit_sec || 0),
		questions: d.questions || [],
		preview_pass_delta: d.preview_pass_delta,
		preview_fail_delta: d.preview_fail_delta,
		will_fail: !!d.will_fail,
		correct_count: Number(d.correct_count || 0),
		mode: d.mode || extras.mode || '',
	}
	uni.setStorageSync(QUIZ_ATTEMPT_KEY, cached)
	if (cached.level_id) uni.setStorageSync('manna_quiz_last_level_id', cached.level_id)
	if (cached.level_no) uni.setStorageSync('manna_quiz_level_no', cached.level_no)
	return cached
}

export function readLocalAttempt() {
	try {
		const cached = uni.getStorageSync(QUIZ_ATTEMPT_KEY) || {}
		const id = Number(cached.attempt_id || 0)
		if (!id || !(cached.questions || []).length) return null
		return cached
	} catch (e) {
		return null
	}
}

export function goPlay(attemptId, { replace = true } = {}) {
	const id = Number(attemptId || 0)
	if (!id) return
	// 从「我的」等入口进答题页：底栏立刻切到测验高亮
	setTabUiKey('quiz')
	const url = `/pagesA/quiz/play?attempt_id=${id}`
	if (replace) {
		uni.redirectTo({
			url,
			fail: () => uni.navigateTo({ url }),
		})
	} else {
		uni.navigateTo({
			url,
			fail: () => uni.redirectTo({ url }),
		})
	}
}

export function isTopQuizPlay(attemptId) {
	try {
		const pages = getCurrentPages()
		const top = pages[pages.length - 1]
		const route = String(top?.route || '')
		if (!route.includes('quiz/play')) return false
		const id = Number(attemptId || 0)
		if (!id) return true
		return Number(top?.options?.attempt_id || 0) === id
	} catch (e) {
		return false
	}
}

let openingQuizPlay = false

/**
 * 从 Tab / 运营卡等入口直接进答题页（不经过 quiz 枢纽闪屏）
 */
export async function openQuizPlayDirect() {
	clearShowQuizHub()
	if (openingQuizPlay) return { ok: false, busy: true }
	openingQuizPlay = true
	try {
		const local = readLocalAttempt()
		if (local) {
			if (isTopQuizPlay(local.attempt_id)) {
				return { ok: true, attemptId: local.attempt_id, fromLocal: true, already: true }
			}
			goPlay(local.attempt_id, { replace: false })
			return { ok: true, attemptId: local.attempt_id, fromLocal: true }
		}
		const r = await resolveAndEnterPlay({ replace: false })
		return r
	} finally {
		openingQuizPlay = false
	}
}

/**
 * Tab/入口跳板：优先服务端进行中 attempt → 本地缓存 → start 当前关
 * @returns {{ ok: boolean, attemptId?: number, home?: object, error?: Error }}
 */
export async function resolveAndEnterPlay({ replace = true, forceStart = false } = {}) {
	let home = null
	try {
		const res = await apiQuizHome()
		home = res?.results || {}
	} catch (e) {
		home = null
	}

	const level = home?.current_level || null
	let active = home?.active_attempt || null
	// 兼容：部分环境把进行中局直接挂在 results 上
	if (!active?.attempt_id && home?.attempt_id && (home.questions || []).length) {
		active = home
	}

	if (!forceStart && active?.attempt_id && (active.questions || []).length) {
		const cached = cacheAttemptPayload(active, {
			level_id: active.level_id || level?.id,
			level_no: active.level_no || level?.level_no,
			title: active.title || level?.title,
			balance: typeof home?.balance === 'number' ? home.balance : undefined,
		})
		if (isTopQuizPlay(cached.attempt_id)) {
			return { ok: true, attemptId: cached.attempt_id, home, resumed: true, already: true }
		}
		goPlay(cached.attempt_id, { replace })
		return { ok: true, attemptId: cached.attempt_id, home, resumed: true }
	}

	if (!forceStart) {
		const local = readLocalAttempt()
		if (local) {
			if (isTopQuizPlay(local.attempt_id)) {
				return { ok: true, attemptId: local.attempt_id, home, resumed: true, fromLocal: true, already: true }
			}
			goPlay(local.attempt_id, { replace })
			return { ok: true, attemptId: local.attempt_id, home, resumed: true, fromLocal: true }
		}
	}

	const lv = level
	if (!lv?.id) {
		return { ok: false, home, error: new Error('no_level') }
	}
	if (lv.locked) {
		return { ok: false, home, error: new Error('locked') }
	}

	const res = await apiQuizStart({ level_id: lv.id })
	const d = res?.results || {}
	if (!d.attempt_id) throw new Error('no attempt')
	const cached = cacheAttemptPayload(d, {
		level_id: lv.id,
		level_no: lv.level_no,
		title: d.title || lv.title,
		balance: typeof d.balance === 'number' ? d.balance : home?.balance,
		time_limit_sec: Number(d.time_limit_sec || lv.time_limit_sec || 0),
	})
	goPlay(cached.attempt_id, { replace })
	return { ok: true, attemptId: cached.attempt_id, home, resumed: false }
}
