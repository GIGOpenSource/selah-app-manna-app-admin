export const UI_PREFS_KEY = 'widget_ui_prefs'
export const EDIT_ITEM_KEY = 'widget_edit_item'
export const REFRESH_KEYS = ['off', '30s', '1min', '5min', '15min', '30min', '1h', '3h', '6h', '24h']

const API_TO_UI_REFRESH = {
	off: 'off',
	'30s': '30s',
	'1m': '1min',
	'1min': '1min',
	'5m': '5min',
	'5min': '5min',
	'15m': '15min',
	'15min': '15min',
	'30m': '30min',
	'30min': '30min',
	'1h': '1h',
	'3h': '3h',
	'6h': '6h',
	'24h': '24h',
	daily: '24h',
	hourly: '1h',
}

const UI_TO_API_REFRESH = {
	off: 'off',
	'30s': '30s',
	'1min': '1m',
	'5min': '5m',
	'15min': '15m',
	'30min': '30m',
	'1h': '1h',
	'3h': '3h',
	'6h': '6h',
	'24h': '24h',
}

export function refreshFromApi(code) {
	const key = API_TO_UI_REFRESH[String(code || '').toLowerCase()]
	return REFRESH_KEYS.includes(key) ? key : 'off'
}

export function refreshToApi(code) {
	return UI_TO_API_REFRESH[code] || 'off'
}

export function refreshLabelKey(code) {
	return code === 'off' ? 'widgets_refresh_off' : `widgets_refresh_${code}`
}

export function readWidgetUiPrefs() {
	try {
		const raw = uni.getStorageSync(UI_PREFS_KEY)
		if (!raw) return {}
		const data = typeof raw === 'string' ? JSON.parse(raw) : raw
		return data && typeof data === 'object' ? data : {}
	} catch (e) {
		return {}
	}
}

export function writeWidgetUiPrefs(patch) {
	const next = { ...readWidgetUiPrefs(), ...patch }
	try {
		uni.setStorageSync(UI_PREFS_KEY, JSON.stringify(next))
	} catch (e) {}
	return next
}
