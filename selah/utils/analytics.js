/**
 * 公共埋点字段与用户属性。事件上报走 utils/firebase.js 的 logFirebaseEvent。
 *
 * 公共参数（COMMON_KEYS）：user_id / vip_level / register_country / login_type / platform
 * + system_lang。
 */
import { getCurrentLanguage } from '@/utils/storageKeys.js'

const COMMON_KEYS = ['user_id', 'vip_level', 'register_country', 'login_type', 'platform']

/** 运行平台：ios / android / h5（条件编译） */
export function platform() {
	// #ifdef APP-PLUS
	try {
		const p = uni.getSystemInfoSync().platform
		return p === 'ios' ? 'ios' : 'android'
	} catch (e) {
		return 'android'
	}
	// #endif
	// #ifndef APP-PLUS
	return 'h5'
	// #endif
}

/** 仅 ios/android 返回平台码；H5 返回空串（不上报服务端 batch） */
export function getAppPlatform() {
	const p = platform()
	return p === 'ios' || p === 'android' ? p : ''
}

/** 从 userInfo + 语言拼公共埋点字段 */
function commonParams() {
	const u = uni.getStorageSync('userInfo') || {}
	return {
		user_id: u.user_id || '',
		vip_level: u.vip_level || 'free',
		register_country: u.register_country || '',
		login_type: u.login_type || 'device',
		platform: platform(),
		system_lang: getCurrentLanguage() || u.system_lang || 'en',
	}
}

/** 设置用户属性（当前仅本地 log，预留 Firebase setUserProperty） */
export function setUserProps(props = {}) {
	try {
		console.log('[analytics:user_props]', { ...commonParams(), ...props })
	} catch (e) {}
}

export { COMMON_KEYS }
