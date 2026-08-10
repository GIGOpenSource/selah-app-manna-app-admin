/**
 * 灵修课包 API
 */
import { getRequest, postRequest } from '@/utils/http.js'

export function apiDevotionSeries(params = {}, other = {}) {
	return getRequest('/devotion/series/', params, { showLoading: false, ...other })
}

export function apiDevotionSeriesDetail(params = {}, other = {}) {
	return getRequest('/devotion/series-detail/', params, { showLoading: false, ...other })
}

export function apiDevotionSession(params = {}, other = {}) {
	return getRequest('/devotion/session/', params, { showLoading: false, ...other })
}

export function apiDevotionProgress(params = {}, other = {}) {
	return getRequest('/devotion/progress/', params, { showLoading: false, ...other })
}

export function apiDevotionComplete(params = {}, other = {}) {
	return postRequest('/devotion/complete/', params, { showLoading: false, ...other })
}
