/**
 * 推送提醒：四个固定时段的开关。
 * GET  /push/reminders/
 * POST /push/reminders/  { key: morning|noon|afternoon|evening, enabled }
 */
import { getRequest, postRequest } from '@/utils/http.js'

/** 拉取清晨 / 正午 / 午后 / 夜晚的开关 */
export function apiPushRemindersGet() {
	return getRequest('/push/reminders/', {}, { showLoading: false, errorOutput: false })
}

/** 当天某个时段的推送文案。slot：morning | noon | afternoon | evening。 */
export function apiPushDailyCopiesGet(slot) {
	const params = {}
	if (slot) params.slot = String(slot)
	return getRequest('/push/daily-copies/', params, { showLoading: false, errorOutput: false })
}

/** 用户点开每日推送。copy_id、delivery_id 都来自 /push/daily-copies/。 */
export function apiPushOpen({ push_type = 'daily', copy_id, delivery_id, clicked = true, opened = true } = {}) {
	const body = {
		push_type: String(push_type || 'daily'),
		copy_id: Number(copy_id),
		clicked: clicked !== false,
		opened: opened !== false,
	}
	if (delivery_id != null && delivery_id !== '') body.delivery_id = delivery_id
	return postRequest('/push/open/', body, { showLoading: false, errorOutput: false })
}

/** 改一个时段的开关。立刻出 loading，避免连点把上一次结果盖掉。 */
export function apiPushReminderSave({ key, enabled } = {}, other = {}) {
	return postRequest('/push/reminders/', {
		key: String(key || ''),
		enabled: !!enabled,
	}, {
		showLoading: true,
		loadingTime: 0,
		loadingMask: true,
		errorOutput: false,
		...other,
	})
}
