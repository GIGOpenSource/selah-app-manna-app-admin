/**
 * 签到 API：状态查询、执行签到、提醒偏好。
 * status 含连续天数、冻心（streak hearts）、本周三态等。
 */
import { postRequest, getRequest } from '@/utils/http.js'

/** 查询签到状态（连续天数、冻心、本周日历、今日是否已签） */
export function apiCheckinStatus() {
	return getRequest('/checkin/status/')
}

/** 执行今日签到（成功发奖励额度；可能消耗/补给冻心） */
export function apiCheckinDo() {
	return postRequest('/checkin/do/', {})
}

/** 更新签到提醒偏好（时间/开关） */
export function apiCheckinSettings(params) {
	return postRequest('/checkin/prefs/', params)
}

/** 提醒中心三开关 GET（record / streak / checkin） */
export function apiReminderPrefsGet() {
	return getRequest('/checkin/reminder-prefs/', {}, { showLoading: false })
}

/** 提醒中心三开关 POST（partial 亦可） */
export function apiReminderPrefsSave(params) {
	return postRequest('/checkin/reminder-prefs/', params || {})
}
