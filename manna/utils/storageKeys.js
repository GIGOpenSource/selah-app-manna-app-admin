/**
 * Manna 本地 storage 键（一律 `manna_` 前缀，与 Selah 隔离）。
 *
 * 冷启调用 migrateLegacyStorageKeys()：把未加前缀的旧键迁到新键并删除旧键。
 */
export const TOKEN_KEY = 'manna_token'
export const USER_INFO_KEY = 'manna_userInfo'
export const FORCE_LOGIN_KEY = 'manna_force_login_page'
export const IS_NEW_USER_KEY = 'manna_is_new_user'
export const WELCOME_SEEN_KEY = 'manna_welcome_seen_version'
export const CHECKIN_REMIND_KEY = 'manna_checkin_remind'
export const REMINDER_PREFS_KEY = 'manna_reminder_prefs'
export const DAILY_REMIND_KEY = 'manna_daily_remind_enabled'
/** 语言：勿用裸 currentLanguage，H5 同域会与 Selah 互踩 */
export const LANG_KEY = 'manna_currentLanguage'

const LEGACY_MAP = [
	['token', TOKEN_KEY],
	['userInfo', USER_INFO_KEY],
	['force_login_page', FORCE_LOGIN_KEY],
	['is_new_user', IS_NEW_USER_KEY],
	['welcome_seen_version', WELCOME_SEEN_KEY],
	['selah_checkin_remind', CHECKIN_REMIND_KEY],
	['selah_reminder_prefs', REMINDER_PREFS_KEY],
	['currentLanguage', LANG_KEY],
]

let _migrated = false

/** 一次性：旧键 → manna_ 键；目标已有值则只删旧键 */
export function migrateLegacyStorageKeys() {
	if (_migrated) return
	_migrated = true
	LEGACY_MAP.forEach(([from, to]) => {
		try {
			const legacy = uni.getStorageSync(from)
			const hasLegacy = legacy !== '' && legacy != null
			if (!hasLegacy) return
			const cur = uni.getStorageSync(to)
			const hasCur = cur !== '' && cur != null
			if (!hasCur) uni.setStorageSync(to, legacy)
			uni.removeStorageSync(from)
		} catch (e) {}
	})
}

export function getCurrentLanguage() {
	migrateLegacyStorageKeys()
	return uni.getStorageSync(LANG_KEY) || 'en'
}

export function setCurrentLanguage(next) {
	uni.setStorageSync(LANG_KEY, next || 'en')
}

export function getToken() {
	migrateLegacyStorageKeys()
	return uni.getStorageSync(TOKEN_KEY) || ''
}

export function setToken(token) {
	uni.setStorageSync(TOKEN_KEY, token)
}

export function getUserInfo() {
	migrateLegacyStorageKeys()
	return uni.getStorageSync(USER_INFO_KEY) || {}
}

export function setUserInfo(user) {
	uni.setStorageSync(USER_INFO_KEY, user || {})
}

export function clearSessionKeys() {
	try { uni.removeStorageSync(TOKEN_KEY) } catch (e) {}
	try { uni.removeStorageSync(USER_INFO_KEY) } catch (e) {}
	try { uni.removeStorageSync(IS_NEW_USER_KEY) } catch (e) {}
	// 兼容未迁移残留
	try { uni.removeStorageSync('token') } catch (e) {}
	try { uni.removeStorageSync('userInfo') } catch (e) {}
	try { uni.removeStorageSync('is_new_user') } catch (e) {}
}
