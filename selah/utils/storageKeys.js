/**
 * Selah 本地 storage 键辅助（语言与 Manna 隔离）。
 *
 * 冷启调用 migrateLegacyStorageKeys()：currentLanguage → selah_currentLanguage。
 */
export const LANG_KEY = 'selah_currentLanguage'

const LEGACY_LANG_MAP = [
	['currentLanguage', LANG_KEY],
]

let _migrated = false

export function migrateLegacyStorageKeys() {
	if (_migrated) return
	_migrated = true
	LEGACY_LANG_MAP.forEach(([from, to]) => {
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
