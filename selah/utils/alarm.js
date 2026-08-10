/**
 * 祷告闹钟：每日本地通知（APP-PLUS）；H5 仅持久化配置。
 * storage：selah_alarm_prefs → { enabled, hour, minute, next_at }
 */
const KEY = 'selah_alarm_prefs'
const NOTIFY_ID = 180808

export function getLocalAlarmPrefs() {
	return (
		uni.getStorageSync(KEY) || {
			enabled: false,
			hour: 8,
			minute: 0,
		}
	)
}

export function applyAlarmPrefsLocal(data) {
	const next = {
		enabled: !!data?.enabled,
		hour: Number.isFinite(+data?.hour) ? Math.max(0, Math.min(23, +data.hour)) : 8,
		minute: Number.isFinite(+data?.minute) ? Math.max(0, Math.min(59, +data.minute)) : 0,
		updated_at: Date.now(),
	}
	uni.setStorageSync(KEY, next)
	if (next.enabled) schedulePrayerAlarm(next)
	else clearPrayerAlarm()
	return next
}

function _nextFireDate(hour, minute) {
	const when = new Date()
	when.setSeconds(0, 0)
	when.setHours(hour, minute, 0, 0)
	if (when.getTime() <= Date.now()) {
		when.setDate(when.getDate() + 1)
	}
	return when
}

function _cancelNative() {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.push) return
		if (plus.push.clear) plus.push.clear()
		if (plus.push.remove) plus.push.remove(NOTIFY_ID)
	} catch (e) {}
	// #endif
}

/** 写入并调度下一次本地通知 */
export function schedulePrayerAlarm({ enabled, hour = 8, minute = 0 } = {}) {
	const payload = {
		enabled: !!enabled,
		hour,
		minute,
		updated_at: Date.now(),
	}
	uni.setStorageSync(KEY, payload)
	_cancelNative()
	if (!enabled) return payload
	// #ifdef APP-PLUS
	try {
		if (typeof plus !== 'undefined' && plus.push) {
			const when = _nextFireDate(hour, minute)
			plus.push.createMessage(
				'Time to spend a moment with God',
				'Selah',
				{
					cover: true,
					when,
					title: 'Selah',
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

export function clearPrayerAlarm() {
	const cur = uni.getStorageSync(KEY) || {}
	uni.setStorageSync(KEY, {
		...cur,
		enabled: false,
		updated_at: Date.now(),
		next_at: null,
	})
	_cancelNative()
}

export function ensurePrayerAlarmScheduled() {
	const cur = getLocalAlarmPrefs()
	if (!cur.enabled) return cur
	return schedulePrayerAlarm({
		enabled: true,
		hour: cur.hour ?? 8,
		minute: cur.minute ?? 0,
	})
}

/**
 * 请求通知权限。返回 Promise<boolean>。
 * H5 无系统权限时视为 true（仅存偏好）。
 */
export function requestNotificationPermission() {
	return new Promise((resolve) => {
		// #ifdef H5
		resolve(true)
		return
		// #endif
		// #ifdef APP-PLUS
		try {
			if (typeof plus === 'undefined') {
				resolve(false)
				return
			}
			const push = plus.push
			if (!push) {
				resolve(false)
				return
			}
			if (typeof push.getClientInfoAsync === 'function') {
				push.getClientInfoAsync(
					() => resolve(true),
					() => resolve(false),
				)
				return
			}
			resolve(true)
		} catch (e) {
			resolve(false)
		}
		return
		// #endif
		resolve(true)
	})
}

/** 打开系统通知/应用设置 */
export function openAppNotificationSettings() {
	// #ifdef APP-PLUS
	try {
		if (plus.os.name === 'iOS') {
			plus.runtime.openURL('app-settings:')
			return
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
			return
		} catch (e1) {
			const intent2 = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
			intent2.setData(Uri.parse('package:' + main.getPackageName()))
			main.startActivity(intent2)
		}
	} catch (e) {
		uni.showToast({ title: 'Open Settings manually', icon: 'none' })
	}
	return
	// #endif
	uni.showToast({ title: 'Use the Selah app to enable notifications', icon: 'none' })
}

export function formatAlarmTime(hour, minute) {
	const h = Math.max(0, Math.min(23, +hour || 0))
	const m = Math.max(0, Math.min(59, +minute || 0))
	const am = h < 12
	const h12 = h % 12 || 12
	const mm = String(m).padStart(2, '0')
	return `${h12}:${mm}${am ? 'AM' : 'PM'}`
}
