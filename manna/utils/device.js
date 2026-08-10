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

/** IANA 时区，失败回退 UTC */
export function getTimezone() {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
	} catch (e) {
		return 'UTC'
	}
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
