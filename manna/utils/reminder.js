/**
 * 本地提醒：每日循环（APP-PLUS plus.push；H5 仅持久化配置）。
 * 打卡键 manna_checkin_remind；功课提醒键 manna_daily_remind_enabled。
 */
import {
	CHECKIN_REMIND_KEY,
	DAILY_REMIND_KEY,
	REMINDER_PREFS_KEY,
	migrateLegacyStorageKeys,
} from '@/utils/storageKeys.js'
import { t } from '@/i18n/index.js'
import { isPeriodPrayerDone, periodKind } from '@/utils/dayPeriod.js'

const KEY = CHECKIN_REMIND_KEY
const PREFS_KEY = REMINDER_PREFS_KEY
const NOTIFY_ID = 190808
let pushBound = false

/**
 * 写入提醒偏好并（若 enabled）调度下一次本地通知。
 * 先取消旧通知再创建，避免重复；H5 只写 storage。
 */
export function scheduleCheckinReminder({ enabled, hour = 9, minute = 0 } = {}) {
	migrateLegacyStorageKeys()
	const payload = { enabled: !!enabled, hour, minute, updated_at: Date.now() }
	uni.setStorageSync(KEY, payload)
	ensureMannaRemindersScheduled()
	return getCheckinReminder()
}

/** App 启动 / 前台时调用：若已开启则按存储的时分重排下一次 */
export function ensureCheckinReminderScheduled() {
	return ensureMannaRemindersScheduled()
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
	ensureMannaRemindersScheduled()
}

/** 读取本地提醒配置；缺省 09:00 关闭 */
export function getCheckinReminder() {
	migrateLegacyStorageKeys()
	return uni.getStorageSync(KEY) || { enabled: false, hour: 9, minute: 0 }
}

export function isDailyRemindOn() {
	migrateLegacyStorageKeys()
	const raw = uni.getStorageSync(DAILY_REMIND_KEY)
	if (raw === false || raw === 0 || raw === '0') return false
	return true
}

export function setDailyRemindEnabled(on) {
	migrateLegacyStorageKeys()
	uni.setStorageSync(DAILY_REMIND_KEY, !!on)
	ensureMannaRemindersScheduled()
	return !!on
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
		uni.setStorageSync(KEY, {
			enabled: true,
			hour: cur.hour ?? 9,
			minute: cur.minute ?? 0,
			updated_at: Date.now(),
		})
	} else {
		const cur = uni.getStorageSync(KEY) || {}
		uni.setStorageSync(KEY, {
			...cur,
			enabled: false,
			updated_at: Date.now(),
			next_at: null,
		})
	}
	ensureMannaRemindersScheduled()
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

function _nextFireDate(hour, minute, skipToday = false) {
	const d = new Date()
	d.setSeconds(0, 0)
	d.setHours(hour, minute, 0, 0)
	if (d.getTime() <= Date.now() + 5000 || skipToday) d.setDate(d.getDate() + 1)
	return d
}

function _createPush(content, payload, when) {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.push || !plus.push.createMessage) return
		plus.push.createMessage(content, payload, {
			cover: true,
			when,
			title: 'Manna',
			delay: Math.max(1, Math.floor((when.getTime() - Date.now()) / 1000)),
		})
	} catch (e) {}
	// #endif
}

function mannaSlots() {
	const morningDone = isPeriodPrayerDone('morning')
	const nightDone = isPeriodPrayerDone('night')
	const kindNow = periodKind()
	return [
		{
			skip: morningDone && kindNow === 'morning',
			hour: 7,
			minute: 0,
			content: t('remind_prayer_morning'),
			payload: JSON.stringify({ open: '/pagesA/prayer/prayer?kind=morning', tab: false }),
		},
		{
			skip: nightDone && kindNow === 'night',
			hour: 18,
			minute: 30,
			content: t('remind_prayer_night'),
			payload: JSON.stringify({ open: '/pagesA/prayer/prayer?kind=night', tab: false }),
		},
		{
			skip: false,
			hour: 8,
			minute: 30,
			content: t('remind_devotion'),
			payload: JSON.stringify({ open: '/pages/devotion/list', tab: true }),
		},
		{
			skip: false,
			hour: 20,
			minute: 0,
			content: t('remind_quiz'),
			payload: JSON.stringify({ open: '/pages/quiz/quiz', tab: true }),
		},
	]
}

/** 重排打卡 + 祷告 / 灵修 / 答题本地提醒；无权限时静默。 */
export function ensureMannaRemindersScheduled() {
	migrateLegacyStorageKeys()
	_cancelNative()
	const checkin = getCheckinReminder()
	if (checkin.enabled) {
		const when = _nextFireDate(checkin.hour ?? 9, checkin.minute ?? 0)
		_createPush('Time for your daily verse', 'Manna', when)
		try {
			uni.setStorageSync(KEY, { ...checkin, next_at: when.toISOString() })
		} catch (e) {}
	}
	if (!isDailyRemindOn()) return checkin
	mannaSlots().forEach((slot) => {
		const when = _nextFireDate(slot.hour, slot.minute, slot.skip)
		_createPush(slot.content, slot.payload, when)
	})
	return checkin
}

export function openMannaPushPayload(raw) {
	let open = ''
	let tab = false
	const s = String(raw || '').trim()
	if (!s) return
	try {
		const o = JSON.parse(s)
		open = o.open || ''
		tab = !!o.tab
	} catch (e) {
		open = s
	}
	if (!open || open === 'Manna') return
	const go = tab || /^\/pages\//.test(open)
	if (go && !open.startsWith('/pagesA/')) {
		uni.switchTab({ url: open, fail: () => uni.navigateTo({ url: open }) })
		return
	}
	uni.navigateTo({ url: open, fail: () => uni.switchTab({ url: open }) })
}

export function bindMannaPushClick() {
	if (pushBound) return
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.push) return
		pushBound = true
		plus.push.addEventListener('click', (msg) => {
			openMannaPushPayload(msg?.payload || '')
		}, false)
	} catch (e) {}
	// #endif
}
