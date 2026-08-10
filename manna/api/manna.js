/**
 * Manna 经济 / Home / Me / 祷告 / 收藏 API
 */
import { getRequest, postRequest } from '@/utils/http.js'

/** 当前用户 Manna 余额 */
export function apiMannaBalance(params = {}, other = {}) {
	return getRequest('/manna/balance/', params, { showLoading: false, ...other })
}

/** 今日经文 */
export function apiDailyVerse(params = {}, other = {}) {
	return getRequest('/manna/daily-verse/', params, { showLoading: false, ...other })
}

/** Amen（scene=home 等） */
export function apiMannaAmen(params = {}, other = {}) {
	return postRequest('/manna/amen/', params, { showLoading: false, ...other })
}

/** 四维统计 */
export function apiMannaStats(params = {}, other = {}) {
	return getRequest('/manna/stats/', params, { showLoading: false, ...other })
}

/** 活动日历月条 */
export function apiMannaCalendar(params = {}, other = {}) {
	return getRequest('/manna/calendar/', params, { showLoading: false, ...other })
}

/** 单日活动 */
export function apiMannaCalendarDay(params = {}, other = {}) {
	return getRequest('/manna/calendar-day/', params, { showLoading: false, ...other })
}

/** 活动心跳 */
export function apiMannaActivityPing(params = {}, other = {}) {
	return postRequest('/manna/activity-ping/', params, { showLoading: false, ...other })
}

/** 徽章列表 */
export function apiMannaBadges(params = {}, other = {}) {
	return getRequest('/manna/badges/', params, { showLoading: false, ...other })
}

/** 祷告内容 */
export function apiMannaPrayer(params = {}, other = {}) {
	return getRequest('/manna/prayer/', params, { showLoading: false, ...other })
}

/** 祷告 Amen */
export function apiMannaPrayerAmen(params = {}, other = {}) {
	return postRequest('/manna/prayer/amen/', params, { showLoading: false, ...other })
}

/** 收藏聚合 */
export function apiMannaCollections(params = {}, other = {}) {
	return getRequest('/manna/collections/', params, { showLoading: false, ...other })
}

/** 已解锁故事卡 */
export function apiMannaStoryCards(params = {}, other = {}) {
	return getRequest('/manna/story-cards/', params, { showLoading: false, ...other })
}

/** 流水 */
export function apiMannaLedger(params = {}, other = {}) {
	return getRequest('/manna/ledger/', params, { showLoading: false, ...other })
}

/** 收藏开关 */
export function apiMannaFavoriteToggle(params = {}, other = {}) {
	return postRequest('/manna/favorite/toggle/', params, { showLoading: false, ...other })
}

/** 分享载荷 */
export function apiMannaSharePayload(params = {}, other = {}) {
	return getRequest('/manna/share-payload/', params, { showLoading: false, ...other })
}

/** Home 运营卡（2.0） */
export function apiMannaHomeCards(params = {}, other = {}) {
	return getRequest('/manna/home/cards/', params, { showLoading: false, ...other })
}

/** 成长卡 */
export function apiMannaStatsCard(params = {}, other = {}) {
	return getRequest('/manna/stats/card/', params, { showLoading: false, ...other })
}

/** Testimony */
export function apiMannaTestimonies(params = {}, other = {}) {
	return getRequest('/manna/testimonies/', params, { showLoading: false, ...other })
}
