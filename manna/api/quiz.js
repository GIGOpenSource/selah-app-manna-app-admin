/**
 * Manna 测验 / 故事解锁 API
 */
import { getRequest, postRequest } from '@/utils/http.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import { withTz } from '@/utils/device.js'

export function apiQuizHome(params = {}, other = {}) {
	const language = params.language || getCurrentLanguage()
	return getRequest('/quiz/home/', { ...params, language }, { showLoading: false, ...other })
}

/** 进行中 attempt（可选独立接口；优先用 GET /quiz/home/ 的 active_attempt） */
export function apiQuizCurrentAttempt(params = {}, other = {}) {
	return getRequest('/quiz/current-attempt/', params, {
		showLoading: false,
		silentBizCodes: [404, 4040],
		...other,
	})
}

export function apiQuizLevels(params = {}, other = {}) {
	return getRequest('/quiz/levels/', params, { showLoading: false, ...other })
}

export function apiQuizStart(params = {}, other = {}) {
	return postRequest('/quiz/start/', params, { showLoading: true, ...other })
}

export function apiQuizAnswer(params = {}, other = {}) {
	return postRequest('/quiz/answer/', params, { showLoading: false, ...other })
}

export function apiQuizFinish(params = {}, other = {}) {
	return postRequest('/quiz/finish/', withTz(params), { showLoading: true, ...other })
}

export function apiQuizResult(params = {}, other = {}) {
	return getRequest('/quiz/result/', params, { showLoading: false, ...other })
}

export function apiQuizStories(params = {}, other = {}) {
	return getRequest('/quiz/stories/', params, { showLoading: false, ...other })
}

export function apiQuizStoryUnlock(params = {}, other = {}) {
	return postRequest('/quiz/story-unlock/', params, { showLoading: true, ...other })
}

export function apiQuizSpend(params = {}, other = {}) {
	return postRequest('/quiz/spend/', params, { showLoading: false, silentBizCodes: [400], ...other })
}

export function apiQuizStoryDetail(params = {}, other = {}) {
	return getRequest('/quiz/story-detail/', params, { showLoading: false, ...other })
}
