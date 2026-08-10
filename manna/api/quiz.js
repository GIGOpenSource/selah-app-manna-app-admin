/**
 * Manna 测验 / 故事解锁 API
 */
import { getRequest, postRequest } from '@/utils/http.js'

export function apiQuizHome(params = {}, other = {}) {
	return getRequest('/quiz/home/', params, { showLoading: false, ...other })
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
	return postRequest('/quiz/finish/', params, { showLoading: true, ...other })
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

export function apiQuizStoryDetail(params = {}, other = {}) {
	return getRequest('/quiz/story-detail/', params, { showLoading: false, ...other })
}
