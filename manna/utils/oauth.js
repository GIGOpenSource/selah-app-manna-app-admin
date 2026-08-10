/**
 * 三方登录沙盒身份：真机替换为 Google/Apple SDK 返回的稳定 sub。
 * 本机持久化一份 sandbox oauth_id，便于 H5 反复测「换机找回」。
 */
import { getOrCreateDeviceId, getTimezone, getRegisterCountry } from '@/utils/device.js'
import { getAppPlatform } from '@/utils/analytics.js'
import { APP_KEY } from '@/config/config.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'

/**
 * 取得（或生成）本机沙盒 oauth_id。
 * @param {'google'|'apple'} provider
 * @returns {string}
 */
export function getSandboxOauthId(provider) {
	const key = `sandbox_oauth_id_${provider}`
	let id = uni.getStorageSync(key)
	if (!id) {
		const seed = getOrCreateDeviceId().replace(/-/g, '').slice(0, 12)
		id = `${provider}_sandbox_${seed}`
		uni.setStorageSync(key, id)
	}
	return String(id)
}

/** 组装 device-login / oauth-login 共用的设备侧字段 */
export function buildDeviceAuthPayload() {
	const plat = getAppPlatform()
	const payload = {
		device_id: getOrCreateDeviceId(),
		timezone: getTimezone(),
		system_lang: getCurrentLanguage(),
		register_country: getRegisterCountry(),
		app_key: APP_KEY,
	}
	if (plat) payload.platform = plat
	return payload
}
