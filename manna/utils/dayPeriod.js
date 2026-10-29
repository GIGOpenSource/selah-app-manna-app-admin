/**
 * 早晚窗口：日间 06:00–18:00，夜间 18:00–次日 06:00（以运营配置为准）。
 */
export const MORNING_START_HOUR = 6
export const EVENING_START_HOUR = 18

const DONE_PREFIX = 'manna_prayer_done_'

export function isDaytime(d = new Date()) {
	const h = d.getHours()
	return h >= MORNING_START_HOUR && h < EVENING_START_HOUR
}

export function periodKind(d = new Date()) {
	return isDaytime(d) ? 'morning' : 'night'
}

/** 晚卡跨午夜仍算「前一自然日」的晚祷日，与 18:00 切晚对齐。 */
export function periodDateKey(d = new Date()) {
	const x = new Date(d)
	if (!isDaytime(x) && x.getHours() < MORNING_START_HOUR) {
		x.setDate(x.getDate() - 1)
	}
	const m = String(x.getMonth() + 1).padStart(2, '0')
	const day = String(x.getDate()).padStart(2, '0')
	return `${x.getFullYear()}-${m}-${day}`
}

export function localDateKey(d = new Date()) {
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${d.getFullYear()}-${m}-${day}`
}

function doneKey(kind, dateKey) {
	return `${DONE_PREFIX}${dateKey}_${kind}`
}

export function isPeriodPrayerDone(kind, d = new Date()) {
	const k = kind || periodKind(d)
	try {
		return !!uni.getStorageSync(doneKey(k, periodDateKey(d)))
	} catch (e) {
		return false
	}
}

/**
 * 标记某时段祷告完成。
 * 只允许写「当下这个时段」：白天从收藏/旧链接点进晚祷页并 Amen，
 * 会把今天的晚祷提前标成已完成（首页红点、日历、连续天数全被污染），这里直接拒绝。
 * @returns {boolean} 是否写入
 */
export function markPeriodPrayerDone(kind, d = new Date()) {
	const k = kind || periodKind(d)
	if (k !== periodKind(d)) return false
	try {
		uni.setStorageSync(doneKey(k, periodDateKey(d)), 1)
		return true
	} catch (e) {
		return false
	}
}

export function isCalendarTaskDone(kind, dateKey) {
	try {
		return !!uni.getStorageSync(doneKey(kind, dateKey))
	} catch (e) {
		return false
	}
}
