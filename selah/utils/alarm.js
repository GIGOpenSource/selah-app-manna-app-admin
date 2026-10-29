/**
 * 祷告闹钟：按选中星期的本地通知（APP-PLUS）；H5 仅持久化配置。
 * storage：selah_alarm_prefs → { enabled, hour, minute, weekdays, sound_id, next_at }
 * weekdays：0 周日 … 6 周六。未设置时为 null。铃声文件在 static/listen。
 */
import { ensureCheckinReminderScheduled } from '@/utils/reminder.js'
import { rescheduleSavedAlarm } from '@/utils/alarmClock.js'

const KEY = 'selah_alarm_prefs'

/** 试听与闹钟铃声。system 对应「闹钟」。 */
export const ALARM_SOUNDS = [
	{ id: 'graceful', file: 'graceful.mp3', nameKey: 'alarm_sound_graceful' },
	{ id: 'nature', file: 'nature.mp3', nameKey: 'alarm_sound_nature' },
	{ id: 'brisk', file: 'brisk.mp3', nameKey: 'alarm_sound_brisk' },
	{ id: 'system', file: 'alarm.mp3', nameKey: 'alarm_sound_bell' },
]

export const DEFAULT_ALARM_SOUND_ID = 'system'

const SOUND_IDS = new Set(ALARM_SOUNDS.map((item) => item.id))

function clampHour(value, fallback = 8) {
	const n = Number(value)
	return Number.isFinite(n) ? Math.max(0, Math.min(23, Math.round(n))) : fallback
}

function clampMinute(value, fallback = 0) {
	const n = Number(value)
	return Number.isFinite(n) ? Math.max(0, Math.min(59, Math.round(n))) : fallback
}

export function normalizeAlarmDays(days) {
	if (!Array.isArray(days)) return []
	const out = []
	days.forEach((day) => {
		const n = Number(day)
		if (n >= 0 && n <= 6 && !out.includes(n)) out.push(n)
	})
	out.sort((a, b) => a - b)
	return out
}

export function normalizeAlarmSoundId(id) {
	const key = String(id || '')
	if (key === 'bell') return DEFAULT_ALARM_SOUND_ID
	return SOUND_IDS.has(key) ? key : ''
}

function readClock(value) {
	if (value == null || value === '') return null
	const n = Number(value)
	return Number.isFinite(n) ? n : null
}

function readWeekdays(src) {
	if (!src || typeof src !== 'object') return null
	if (Array.isArray(src.weekdays)) return normalizeAlarmDays(src.weekdays)
	if (Array.isArray(src.days)) return normalizeAlarmDays(src.days)
	return null
}

export function normalizeAlarmPrefs(data, fallback = {}) {
	const src = data && typeof data === 'object' ? data : {}
	const weekdays = readWeekdays(src)
	const fallbackDays = readWeekdays(fallback)
	const hour = readClock(src.hour)
	const minute = readClock(src.minute)
	const soundRaw = src.sound_id != null ? src.sound_id : src.soundId
	const sound = soundRaw != null && soundRaw !== '' ? normalizeAlarmSoundId(soundRaw) : ''
	const fallbackSound = normalizeAlarmSoundId(fallback.sound_id)
	return {
		enabled: !!src.enabled,
		hour: hour == null ? (readClock(fallback.hour) == null ? null : clampHour(fallback.hour, 0)) : clampHour(hour, 0),
		minute: minute == null ? (readClock(fallback.minute) == null ? null : clampMinute(fallback.minute, 0)) : clampMinute(minute, 0),
		weekdays: weekdays == null ? fallbackDays : weekdays,
		sound_id: sound || fallbackSound || '',
		updated_at: Date.now(),
	}
}

/** 服务端还没存过时间、重复或铃声。 */
export function alarmPrefsMissing(prefs) {
	if (!prefs) return true
	return prefs.hour == null || prefs.minute == null || prefs.weekdays == null || !prefs.sound_id
}

/** 开启且未设置时：时间为当前时刻，重复为今天（0 周日），铃声为闹钟。 */
export function fillAlarmDefaults(prefs = {}) {
	const now = new Date()
	return {
		...prefs,
		enabled: prefs.enabled !== false,
		hour: prefs.hour == null ? now.getHours() : prefs.hour,
		minute: prefs.minute == null ? now.getMinutes() : prefs.minute,
		weekdays: prefs.weekdays == null ? [now.getDay()] : prefs.weekdays,
		sound_id: prefs.sound_id || DEFAULT_ALARM_SOUND_ID,
	}
}

export function alarmSoundSrc(file) {
	const rel = '/static/listen/' + file
	// #ifdef APP-PLUS
	try {
		if (typeof plus !== 'undefined' && plus.io && typeof plus.io.convertLocalFileSystemURL === 'function') {
			const abs = plus.io.convertLocalFileSystemURL('_www' + rel)
			if (abs) {
				if (/^(file:|http:|https:|_www|_doc|_documents|_downloads)/i.test(abs)) return abs
				if (abs.charAt(0) === '/') return 'file://' + abs
				return abs
			}
		}
	} catch (e) {}
	return '_www' + rel
	// #endif
	return rel
}

export function getLocalAlarmPrefs() {
	return normalizeAlarmPrefs(uni.getStorageSync(KEY) || {})
}

export function applyAlarmPrefsLocal(data, fallback = true) {
	const cur = fallback ? (uni.getStorageSync(KEY) || {}) : {}
	const next = normalizeAlarmPrefs(data, cur)
	uni.setStorageSync(KEY, next)
	rescheduleSavedAlarm()
	ensureCheckinReminderScheduled()
	return next
}

/** 写入并调度下一次本地通知。真正的推送由提醒中心统一 clear 后重建，避免把打卡通知清掉。 */
export function schedulePrayerAlarm(partial = {}) {
	const cur = uni.getStorageSync(KEY) || {}
	const next = normalizeAlarmPrefs({ ...cur, ...partial, enabled: true }, cur)
	uni.setStorageSync(KEY, next)
	rescheduleSavedAlarm()
	ensureCheckinReminderScheduled()
	return next
}

export function clearPrayerAlarm() {
	const cur = uni.getStorageSync(KEY) || {}
	const next = normalizeAlarmPrefs({ ...cur, enabled: false }, cur)
	uni.setStorageSync(KEY, { ...next, next_at: null })
	rescheduleSavedAlarm()
	ensureCheckinReminderScheduled()
}

export function ensurePrayerAlarmScheduled() {
	const cur = getLocalAlarmPrefs()
	if (!cur.enabled) return cur
	return schedulePrayerAlarm(cur)
}

/**
 * 请求通知权限。返回 Promise<boolean>。
 * H5 无系统权限时视为 true（仅存偏好）。
 */
function iosNotificationTypes() {
	try {
		if (typeof plus === 'undefined' || !plus.ios) return null
		const UIApplication = plus.ios.import('UIApplication')
		const app = UIApplication.sharedApplication()
		const settings = plus.ios.invoke(app, 'currentUserNotificationSettings')
		if (!settings) return null
		let types = settings.types
		if (typeof types === 'function') types = types()
		if (types == null) types = plus.ios.invoke(settings, 'types')
		const n = Number(types)
		try { plus.ios.deleteObject(settings) } catch (e) {}
		return Number.isFinite(n) ? n : null
	} catch (e) {
		return null
	}
}

function readIosAuthorizationStatus(settings) {
	const values = []
	try { values.push(settings.authorizationStatus) } catch (e) {}
	try {
		if (settings && typeof settings.plusGetAttribute === 'function') {
			values.push(settings.plusGetAttribute('authorizationStatus'))
		}
	} catch (e) {}
	try { values.push(plus.ios.invoke(settings, 'authorizationStatus')) } catch (e) {}
	for (const value of values) {
		const raw = typeof value === 'function' ? value() : value
		const n = Number(raw)
		if (n === 0 || n === 1 || n === 2 || n === 3 || n === 4) return n
	}
	return null
}

/** 0 未决定，1 拒绝，2 允许，3 临时，4 短暂。读不到返回 null。 */
function readIosNotificationStatus() {
	return new Promise((resolve) => {
		let settled = false
		const finish = (value) => {
			if (settled) return
			settled = true
			resolve(value)
		}
		try {
			const UNUserNotificationCenter = plus.ios.import('UNUserNotificationCenter')
			const center = UNUserNotificationCenter.currentNotificationCenter()
			center.getNotificationSettingsWithCompletionHandler((settings) => {
				const status = readIosAuthorizationStatus(settings)
				try { plus.ios.deleteObject(settings) } catch (e) {}
				try { plus.ios.deleteObject(center) } catch (e) {}
				finish(status)
			})
		} catch (e) {
			finish(null)
		}
		setTimeout(() => finish(null), 1500)
	})
}

function iosNotificationAllowed(status) {
	return status === 2 || status === 3 || status === 4
}

function requestIosNotification() {
	return new Promise((resolve) => {
		let settled = false
		const finish = (value) => {
			if (settled) return
			settled = true
			resolve(value)
		}
		try {
			const UNUserNotificationCenter = plus.ios.import('UNUserNotificationCenter')
			const center = UNUserNotificationCenter.currentNotificationCenter()
			// badge 1 | sound 2 | alert 4
			center.requestAuthorizationWithOptionsCompletionHandler(7, (granted) => {
				try { plus.ios.deleteObject(center) } catch (e) {}
				finish(granted === true || granted === 1 || granted === 'true')
			})
		} catch (e) {
			finish(null)
		}
		setTimeout(() => finish(null), 1500)
	})
}

function requestAndroidNotification() {
	return new Promise((resolve) => {
		try {
			const Build = plus.android.importClass('android.os.Build')
			if (Build.VERSION.SDK_INT < 33) {
				resolve(isNotificationAuthorized())
				return
			}
			plus.android.requestPermissions(
				['android.permission.POST_NOTIFICATIONS'],
				(result) => {
					const granted = result && Array.isArray(result.granted)
						&& result.granted.indexOf('android.permission.POST_NOTIFICATIONS') >= 0
					resolve(!!granted || isNotificationAuthorized())
				},
				() => resolve(false),
			)
		} catch (e) {
			resolve(isNotificationAuthorized())
		}
	})
}

export function requestNotificationPermission() {
	return new Promise((resolve) => {
		// #ifdef H5
		// H5 无系统推送授权；视为不可用，引导用户到 App
		resolve(false)
		return
		// #endif
		// #ifdef APP-PLUS
		try {
			if (typeof plus === 'undefined') {
				resolve(false)
				return
			}
			if (isNotificationAuthorized()) {
				resolve(true)
				return
			}
			const os = String(plus.os && plus.os.name || '').toLowerCase()
			if (os === 'android') {
				requestAndroidNotification().then(resolve, () => resolve(false))
				return
			}
			readIosNotificationStatus().then(async (status) => {
				if (iosNotificationAllowed(status)) {
					resolve(true)
					return
				}
				const types = iosNotificationTypes()
				if (types > 0) {
					resolve(true)
					return
				}
				if (status === 1) {
					resolve(false)
					return
				}
				const asked = await requestIosNotification()
				const again = await readIosNotificationStatus()
				if (iosNotificationAllowed(again) || asked === true || iosNotificationTypes() > 0) {
					resolve(true)
					return
				}
				resolve(again !== 1)
			}, () => resolve(true))
			return
		} catch (e) {
			resolve(false)
		}
		return
		// #endif
		resolve(false)
	})
}

function _androidNotificationsEnabled() {
	try {
		if (typeof plus === 'undefined' || !plus.android) return null
		const main = plus.android.runtimeMainActivity()
		const Context = plus.android.importClass('android.content.Context')
		const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
		if (!nm) return null
		const enabled = plus.android.invoke(nm, 'areNotificationsEnabled')
		if (typeof enabled === 'boolean') return enabled
	} catch (e) {}
	return null
}

/** 当前 App 是否已允许消息通知。开了就不该再弹「通知未开启」。 */
export function isNotificationAuthorized() {
	// #ifdef APP-PLUS
	try {
		const os = String(plus && plus.os && plus.os.name || '').toLowerCase()
		if (os === 'android') {
			const enabled = _androidNotificationsEnabled()
			if (enabled != null) return enabled
		}
		if (os === 'ios') {
			const types = iosNotificationTypes()
			if (types > 0) return true
		}
		if (typeof uni !== 'undefined' && typeof uni.getAppAuthorizeSetting === 'function') {
			const setting = uni.getAppAuthorizeSetting()
			const st = String(setting && setting.notificationAuthorized || '').toLowerCase()
			if (st === 'authorized') return true
			if (st === 'denied') return false
		}
	} catch (e) {}
	// #endif
	return false
}

/**
 * 打开系统通知设置。
 * 成功返回 true；打不开时返回 false。silent 为 true 时不弹 toast，由页面自己提示。
 */
export function openAppNotificationSettings({ silent = false } = {}) {
	const fail = () => {
		if (!silent) uni.showToast({ title: 'Open Settings manually', icon: 'none' })
		return false
	}
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined') return fail()
		if (plus.os.name === 'iOS') {
			plus.runtime.openURL('app-settings:')
			return true
		}
		const main = plus.android.runtimeMainActivity()
		const Intent = plus.android.importClass('android.content.Intent')
		const Settings = plus.android.importClass('android.provider.Settings')
		const Uri = plus.android.importClass('android.net.Uri')
		const intent = new Intent()
		intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
		intent.putExtra(Settings.EXTRA_APP_PACKAGE, main.getPackageName())
		intent.putExtra('android.provider.extra.APP_PACKAGE', main.getPackageName())
		intent.putExtra('app_package', main.getPackageName())
		intent.putExtra('app_uid', main.getApplicationInfo().uid)
		try {
			main.startActivity(intent)
			return true
		} catch (e1) {
			const intent2 = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
			intent2.setData(Uri.parse('package:' + main.getPackageName()))
			main.startActivity(intent2)
			return true
		}
	} catch (e) {
		return fail()
	}
	// #endif
	if (!silent) uni.showToast({ title: 'Use the Selah app to enable notifications', icon: 'none' })
	return false
}

export function formatAlarmTime(hour, minute) {
	const h = Math.max(0, Math.min(23, +hour || 0))
	const m = Math.max(0, Math.min(59, +minute || 0))
	const am = h < 12
	const h12 = h % 12 || 12
	const mm = String(m).padStart(2, '0')
	return `${h12}:${mm} ${am ? 'AM' : 'PM'}`
}
