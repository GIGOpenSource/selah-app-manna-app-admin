/**
 * 打卡本地提醒：每日循环（APP-PLUS localNotification；H5 仅持久化配置）
 * storage 键：manna_checkin_remind → { enabled, hour, minute, next_at }
 * 2.0：与 reminder_prefs.checkin_remind_enabled 对齐；streak 偏好仅本地镜像。
 */
import { CHECKIN_REMIND_KEY, REMINDER_PREFS_KEY, migrateLegacyStorageKeys } from '@/utils/storageKeys.js'

const KEY = CHECKIN_REMIND_KEY
const PREFS_KEY = REMINDER_PREFS_KEY
const NOTIFY_ID = 190808  // Manna check-in local id（与 Selah 隔离）

/**
 * 写入提醒偏好并（若 enabled）调度下一次本地通知。
 * 先取消旧通知再创建，避免重复；H5 只写 storage。
 */
export function scheduleCheckinReminder({ enabled, hour = 9, minute = 0 } = {}) {
	migrateLegacyStorageKeys()
	const payload = { enabled: !!enabled, hour, minute, updated_at: Date.now() }
	uni.setStorageSync(KEY, payload)
	_cancelNative()
	if (!enabled) return payload
	// #ifdef APP-PLUS
	try {
		if (typeof plus !== 'undefined' && plus.push) {
			const when = _nextFireDate(hour, minute)
			plus.push.createMessage(
				'Time for your daily verse',
				'Manna',
				{
					cover: true,
					when,
					title: 'Manna',
					delay: Math.max(1, Math.floor((when.getTime() - Date.now()) / 1000)),
				},
			)
			uni.setStorageSync(KEY, {
				...payload,
				next_at: when.toISOString(),
			})
		}
	} catch (e) {}
	// #endif
	return payload
}

/** App 启动 / 前台时调用：若已开启则按存储的时分重排下一次 */
export function ensureCheckinReminderScheduled() {
	const cur = getCheckinReminder()
	if (!cur.enabled) return cur
	return scheduleCheckinReminder({
		enabled: true,
		hour: cur.hour ?? 9,
		minute: cur.minute ?? 0,
	})
}

/** 关闭提醒：写 enabled=false 并取消原生通知 */
export function clearCheckinReminder() {
	migrateLegacyStorageKeys()
	const cur = uni.getStorageSync(KEY) || {}
	uni.setStorageSync(KEY, {
		...cur,
		enabled: false,
		updated_at: Date.now(),
		next_at: null,
	})
	_cancelNative()
}

/** 读取本地提醒配置；缺省 09:00 关闭 */
export function getCheckinReminder() {
	migrateLegacyStorageKeys()
	return uni.getStorageSync(KEY) || { enabled: false, hour: 9, minute: 0 }
}

/** 本地缓存 reminder_prefs 三开关（与服务端对齐） */
export function getLocalReminderPrefs() {
	migrateLegacyStorageKeys()
	return uni.getStorageSync(PREFS_KEY) || {
		record_enabled: true,
		streak_remind_enabled: true,
		checkin_remind_enabled: true,
	}
}

/**
 * 应用服务端 reminder_prefs：写本地 + 调度/清除 checkin 本地通知。
 * @param {object} prefs
 */
export function applyReminderPrefsLocal(prefs = {}) {
	migrateLegacyStorageKeys()
	const next = {
		record_enabled: prefs.record_enabled !== false,
		streak_remind_enabled: !!prefs.streak_remind_enabled,
		checkin_remind_enabled: !!prefs.checkin_remind_enabled,
	}
	if (!next.record_enabled) {
		next.streak_remind_enabled = false
		next.checkin_remind_enabled = false
	}
	uni.setStorageSync(PREFS_KEY, next)
	if (next.checkin_remind_enabled && next.record_enabled) {
		const cur = getCheckinReminder()
		scheduleCheckinReminder({
			enabled: true,
			hour: cur.hour ?? 9,
			minute: cur.minute ?? 0,
		})
	} else {
		clearCheckinReminder()
	}
	return next
}

/** 取消原生推送/本地通知 */
function _cancelNative() {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.push) return
		if (plus.push.clear) plus.push.clear()
		if (plus.push.remove) plus.push.remove(NOTIFY_ID)
	} catch (e) {}
	// #endif
}

/** 计算下一次触发时间：若今天该时刻已过（含 5s 缓冲）则推到明天 */
function _nextFireDate(hour, minute) {
	const d = new Date()
	d.setSeconds(0, 0)
	d.setHours(hour, minute, 0, 0)
	if (d.getTime() <= Date.now() + 5000) d.setDate(d.getDate() + 1)
	return d
}
