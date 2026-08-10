/**
 * 祷告锁（App 内）：每日祷告前锁定所选功能入口。
 * 不涉及系统级锁第三方 App。
 *
 * prefs: { enabled, app_ids: featureKey[], last_prayer_date: 'YYYY-MM-DD' }
 */
const KEY = 'selah_prayer_lock_prefs'

/** 可锁定的 Selah 功能（id 与 Profile customize / Quiz 键一致） */
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

/** @deprecated 兼容旧名 */
export const PRAYER_LOCK_APP_CATALOG = PRAYER_LOCK_FEATURE_CATALOG

const NEVER_LOCK = new Set(['prayer_lock', 'alarm', 'settings', 'home', 'ai'])

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
		updated_at: Date.now(),
	}
	uni.setStorageSync(KEY, next)
	return next
}

/** 今日是否已完成祷告（解锁） */
export function isPrayerDoneToday(prefs) {
	const p = prefs || getLocalPrayerLockPrefs()
	return !!(p.last_prayer_date && p.last_prayer_date === localDateKey())
}

/**
 * 某功能今日是否被 App 内锁挡住。
 * prayer_lock / alarm / AI / Home 永不锁。
 */
export function isFeatureLocked(featureKey, prefs) {
	if (!featureKey || NEVER_LOCK.has(featureKey)) return false
	const p = prefs || getLocalPrayerLockPrefs()
	if (!p.enabled) return false
	const ids = p.app_ids || []
	if (!ids.includes(featureKey)) return false
	return !isPrayerDoneToday(p)
}

/**
 * 若锁定则引导去 Prayer（AI），返回 true 表示已拦截。
 */
export function guardFeatureOrPray(featureKey, t) {
	if (!isFeatureLocked(featureKey)) return false
	const title =
		(t && t('prayer_lock_blocked_title')) || 'Pray first'
	const body =
		(t && t('prayer_lock_blocked_body')) ||
		'This feature is locked until you spend time in prayer today.'
	uni.showModal({
		title,
		content: body,
		confirmText: (t && t('prayer_lock_go_pray')) || 'Pray now',
		cancelText: (t && t('cancel')) || 'Cancel',
		success: (res) => {
			if (res.confirm) {
				uni.switchTab({ url: '/pages/ai/ai' })
			}
		},
	})
	return true
}

/**
 * 标记今日已祷告；可选同步服务端 prefs。
 */
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
	try {
		const { track } = await import('@/utils/analytics.js')
		track('prayer_lock_unlocked', { date: today })
	} catch (e) {}
	return getLocalPrayerLockPrefs()
}
