/**
 * App Lock：系统第三方 App 选择 + 权限申请；祷告解锁仍走 in-app 功能锁兼容。
 */
import { goTab } from '@/utils/nav.js'
const KEY = 'selah_prayer_lock_prefs'

/** PRD：进入系统选择 App — 常见分心 App 清单（真系统 Picker 需 Screen Time 原生能力） */
export const SYSTEM_APP_CATALOG = [
	{ id: 'instagram', labelKey: 'plock_app_instagram' },
	{ id: 'tiktok', labelKey: 'plock_app_tiktok' },
	{ id: 'youtube', labelKey: 'plock_app_youtube' },
	{ id: 'x', labelKey: 'plock_app_x' },
	{ id: 'facebook', labelKey: 'plock_app_facebook' },
	{ id: 'snapchat', labelKey: 'plock_app_snapchat' },
	{ id: 'reddit', labelKey: 'plock_app_reddit' },
	{ id: 'games', labelKey: 'plock_app_games' },
	{ id: 'browser', labelKey: 'plock_app_browser' },
	{ id: 'messages', labelKey: 'plock_app_messages' },
]

/** 可锁定的 Selah 功能（兼容旧祷告锁） */
export const PRAYER_LOCK_FEATURE_CATALOG = [
	{ id: 'compose', labelKey: 'compose_entry' },
	{ id: 'topics', labelKey: 'topics_you_follow' },
	{ id: 'wallpapers', labelKey: 'wallpapers' },
	{ id: 'lock_widgets', labelKey: 'lock_screen_widgets' },
	{ id: 'home_widgets', labelKey: 'home_screen_widgets' },
	{ id: 'reminders', labelKey: 'reminders' },
	{ id: 'watch', labelKey: 'watch' },
	{ id: 'app_icon', labelKey: 'app_icon' },
	{ id: 'quiz', labelKey: 'bible_quiz' },
]

/** @deprecated */
export const PRAYER_LOCK_APP_CATALOG = SYSTEM_APP_CATALOG

const NEVER_LOCK = new Set(['prayer_lock', 'alarm', 'settings', 'home', 'ai'])
const SYSTEM_IDS = new Set(SYSTEM_APP_CATALOG.map((a) => a.id))

export function localDateKey(d = new Date()) {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

export function getLocalPrayerLockPrefs() {
	return (
		uni.getStorageSync(KEY) || {
			enabled: false,
			app_ids: [],
			last_prayer_date: '',
			screen_time_authorized: false,
		}
	)
}

export function applyPrayerLockPrefsLocal(data) {
	const ids = Array.isArray(data?.app_ids)
		? data.app_ids.map(String)
		: Array.isArray(data?.feature_ids)
			? data.feature_ids.map(String)
			: []
	const next = {
		enabled: !!data?.enabled,
		app_ids: ids.filter((id) => id && !NEVER_LOCK.has(id)).slice(0, 40),
		last_prayer_date: data?.last_prayer_date ? String(data.last_prayer_date).slice(0, 32) : '',
		screen_time_authorized: !!data?.screen_time_authorized,
		updated_at: Date.now(),
	}
	uni.setStorageSync(KEY, next)
	return next
}

export function isPrayerDoneToday(prefs) {
	const p = prefs || getLocalPrayerLockPrefs()
	return !!(p.last_prayer_date && p.last_prayer_date === localDateKey())
}

export function isFeatureLocked(featureKey, prefs) {
	if (!featureKey || NEVER_LOCK.has(featureKey) || SYSTEM_IDS.has(featureKey)) return false
	const p = prefs || getLocalPrayerLockPrefs()
	if (!p.enabled) return false
	const ids = p.app_ids || []
	if (!ids.includes(featureKey)) return false
	return !isPrayerDoneToday(p)
}

export function guardFeatureOrPray(featureKey, t) {
	if (!isFeatureLocked(featureKey)) return false
	const title = (t && t('prayer_lock_blocked_title')) || 'Pray first'
	const body =
		(t && t('prayer_lock_blocked_body')) ||
		'This feature is locked until you spend time in prayer today.'
	uni.showModal({
		title,
		content: body,
		confirmText: (t && t('prayer_lock_go_pray')) || 'Pray now',
		cancelText: (t && t('cancel')) || 'Cancel',
		success: (res) => {
			if (res.confirm) goTab('/pages/ai/ai')
		},
	})
	return true
}

/** 打开系统 Screen Time / 应用限制设置（权限申请） */
export function openSystemAppLockSettings() {
	// #ifdef APP-PLUS
	try {
		if (plus.os.name === 'iOS') {
			// Screen Time 无公开 deep link；打开系统设置
			plus.runtime.openURL('App-prefs:SCREEN_TIME')
			setTimeout(() => {
				try {
					plus.runtime.openURL('app-settings:')
				} catch (e2) {}
			}, 400)
			return true
		}
		const main = plus.android.runtimeMainActivity()
		const Intent = plus.android.importClass('android.content.Intent')
		const Settings = plus.android.importClass('android.provider.Settings')
		const intent = new Intent(Settings.ACTION_SETTINGS)
		main.startActivity(intent)
		return true
	} catch (e) {
		return false
	}
	// #endif
	return false
}

export async function markPrayerDoneToday({ sync = true } = {}) {
	const cur = getLocalPrayerLockPrefs()
	const today = localDateKey()
	if (cur.last_prayer_date === today) return cur
	const next = applyPrayerLockPrefsLocal({
		...cur,
		last_prayer_date: today,
	})
	if (sync) {
		try {
			const { apiPrayerLockPrefsSave } = await import('@/api/content.js')
			const res = await apiPrayerLockPrefsSave({
				enabled: next.enabled,
				app_ids: next.app_ids,
				last_prayer_date: today,
			})
			if (res?.results) applyPrayerLockPrefsLocal(res.results)
		} catch (e) {}
	}
	return getLocalPrayerLockPrefs()
}
