/**
 * 设备标识与注册国家：供 device-login / 埋点使用。
 * storage：manna_device_id（与 Selah 的 selah_device_id 隔离，避免同机串号）。
 */

const DEVICE_KEY = 'manna_device_id'

/** 生成 RFC 风格随机设备 UUID（不写 storage） */
export function generateDeviceId() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/**
 * 获取或创建持久化设备 UUID。
 * 前缀 manna-，与 Selah 设备账号隔离（后端按 device_id 查用户）。
 */
export function getOrCreateDeviceId() {
	let id = uni.getStorageSync(DEVICE_KEY)
	if (!id) {
		id = `manna-${generateDeviceId()}`
		uni.setStorageSync(DEVICE_KEY, id)
	}
	return id
}

/**
 * 换新设备 ID（注销本机账户后重新标识设备）。
 * @returns {string} 新 device_id
 */
export function rotateDeviceId() {
	const id = `manna-${generateDeviceId()}`
	uni.setStorageSync(DEVICE_KEY, id)
	return id
}

/**
 * 整小时/半小时偏移 → IANA 名。
 * 兜底用：App 端 JS 引擎（iOS JSCore / 部分 Android WebView）取不到 Intl 时区，
 * 直接退回 UTC 会让后端把 10:20(+8) 判成 02:20 → 早祷被判成晚祷。
 */
const TZ_HALF_HOUR = {
	'5.5': 'Asia/Kolkata',
	'5.75': 'Asia/Kathmandu',
	'9.5': 'Australia/Darwin',
}

/**
 * IANA 时区：优先 Intl，取不到时按设备 UTC 偏移兜底。
 * 注：Etc/GMT-8 才是 UTC+8（IANA 的符号是反的）。
 */
export function getTimezone() {
	let tz = ''
	try {
		tz = String(Intl.DateTimeFormat().resolvedOptions().timeZone || '')
	} catch (e) {}
	if (tz && tz !== 'UTC') return tz
	// Intl 缺失或报 UTC 时，用设备偏移判断是不是真的在 UTC 时区
	const offset = -new Date().getTimezoneOffset() / 60
	if (!offset) return 'UTC'
	if (Number.isInteger(offset)) {
		return `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`
	}
	return TZ_HALF_HOUR[String(offset)] || tz || 'UTC'
}

/** 给请求参数补上 tz（调用方已传则保留） */
export function withTz(params = {}) {
	return { ...params, tz: params.tz || getTimezone() }
}

/**
 * 客户端平台：ios / android / h5。
 * App 读系统；H5 可用 debug_x_platform，否则跟系统/UA。
 */
export function getClientPlatform() {
	// #ifdef APP-PLUS
	try {
		const p = String(uni.getSystemInfoSync().platform || '').toLowerCase()
		return p === 'ios' ? 'ios' : 'android'
	} catch (e) {
		return 'android'
	}
	// #endif
	// #ifndef APP-PLUS
	try {
		const debug = String(uni.getStorageSync('debug_x_platform') || '').toLowerCase()
		if (debug === 'ios' || debug === 'android') return debug
	} catch (e) {}
	try {
		const info = uni.getSystemInfoSync() || {}
		const p = String(info.platform || info.osName || '').toLowerCase()
		if (p === 'ios' || p === 'iphone' || p === 'ipad') return 'ios'
		if (p === 'android') return 'android'
	} catch (e) {}
	try {
		const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : ''
		if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
		if (/Android/i.test(ua)) return 'android'
	} catch (e) {}
	return 'h5'
	// #endif
}

/**
 * 近似注册国家二字码：
 * 优先 storage register_country；否则从系统语言区（en-US → US）推断；默认 US。
 */
export function getRegisterCountry() {
	const cached = uni.getStorageSync('register_country')
	if (cached) return String(cached).toUpperCase().slice(0, 2)
	try {
		const info = uni.getSystemInfoSync() || {}
		const lang = (info.language || info.osLanguage || 'en').replace('_', '-')
		const region = lang.split('-')[1]
		if (region && region.length === 2) return region.toUpperCase()
	} catch (e) {}
	return 'US'
}
