/**
 * 会话与登录：有 token 则拉 /auth/me，失败则清 token 并走设备登录。
 *
 * uni.storage 键约定（均带 manna_ 前缀，见 storageKeys.js）：
 * - manna_token / manna_userInfo / manna_is_new_user / manna_force_login_page
 *
 * 登录 payload 还会带：device_id、timezone、system_lang、register_country、platform、app_key。
 *
 * 并发：ensureLogin 单飞（shared promise），避免多次 device-login 互相挤下线。
 */
import { apiDeviceLogin, apiAuthMe } from '@/api/auth.js'
import { getOrCreateDeviceId, rotateDeviceId, getTimezone, getRegisterCountry } from '@/utils/device.js'
import { getAppPlatform } from '@/utils/analytics.js'
import { APP_KEY } from '@/config/config.js'
import {
	FORCE_LOGIN_KEY,
	IS_NEW_USER_KEY,
	LANG_KEY,
	TOKEN_KEY,
	clearSessionKeys,
	getCurrentLanguage,
	getToken,
	getUserInfo,
	migrateLegacyStorageKeys,
	setCurrentLanguage,
	setToken,
	setUserInfo,
} from '@/utils/storageKeys.js'

export { FORCE_LOGIN_KEY }

/** @type {Promise<object>|null} */
let _loginPromise = null

export function shouldForceLoginPage() {
	migrateLegacyStorageKeys()
	return !!uni.getStorageSync(FORCE_LOGIN_KEY)
}

export function clearForceLoginPage() {
	try {
		uni.removeStorageSync(FORCE_LOGIN_KEY)
	} catch (e) {}
	try {
		uni.removeStorageSync('force_login_page')
	} catch (e) {}
}

/**
 * 身份过期：清本地会话、禁止静默 device-login，并强制回到欢迎页重新登录。
 */
export function forceSessionExpiredToWelcome() {
	clearSessionKeys()
	try {
		uni.setStorageSync(FORCE_LOGIN_KEY, '1')
	} catch (e) {}
	_loginPromise = null
	uni.reLaunch({ url: '/pagesA/welcome/welcome' })
}

/**
 * 确保已登录：
 * 1) 若 force_login_page（且非登录页显式调用）→ 抛 FORCE_LOGIN，交给冷启跳登录页
 * 2) 本地有 token → apiAuthMe 校验并刷新 userInfo
 * 3) me 失败 → 清 token，落入步骤 4
 * 4) 无 token → device_id 登录，写入 token / userInfo / is_new_user
 *
 * @param {{ explicit?: boolean }} [opts] explicit=true：登录页「快速登录」允许在 force 闸下 device-login
 * @returns {Promise<object>} 用户信息
 */
export async function ensureLogin(opts = {}) {
	migrateLegacyStorageKeys()
	if (_loginPromise) return _loginPromise
	_loginPromise = _ensureLoginInner(opts).finally(() => {
		_loginPromise = null
	})
	return _loginPromise
}

async function _ensureLoginInner(opts = {}) {
	if (shouldForceLoginPage() && !opts.explicit) {
		const err = new Error('force_login_page')
		err.code = 'FORCE_LOGIN'
		throw err
	}
	const plat = getAppPlatform()
	const token = getToken()
	if (token) {
		try {
			// skipAuthRetry：me 401 只 reject，不触发 http 层再入 ensureLogin（防死锁）
			const res = await apiAuthMe(plat ? { platform: plat } : {}, { skipAuthRetry: true })
			setUserInfo(res.results)
			return res.results
		} catch (e) {
			clearSessionKeys()
		}
	}
	const deviceId = getOrCreateDeviceId()
	const payload = {
		device_id: deviceId,
		timezone: getTimezone(),
		system_lang: getCurrentLanguage(),
		register_country: getRegisterCountry(),
		app_key: APP_KEY,
	}
	if (plat) payload.platform = plat
	const res = await apiDeviceLogin(payload, { skipAuthRetry: true })
	setToken(res.results.token)
	setUserInfo(res.results.user)
	uni.setStorageSync(IS_NEW_USER_KEY, !!res.results.is_new_user)
	return res.results.user
}

/** @returns {object} 本地缓存的 userInfo，无则 {} */
export function getUser() {
	return getUserInfo()
}

/** 更新本地 userInfo 缓存（资料修改、VIP 开通后调用） */
export function setUser(user) {
	setUserInfo(user)
}

/**
 * 注销本机账户：清本地会话，换新 device_id，并强制进入 Welcome → 登录。
 *
 * 注意：不在此处 ensureLogin——否则会静默建号，跳过登录页。
 * H5 上 Chrome「清空缓存并硬性重新加载」也不会清 localStorage，须靠本函数清存储。
 *
 * @returns {Promise<{ device_id: string }>}
 */
export async function clearLocalAccount() {
	const keepLang = getCurrentLanguage()
	_loginPromise = null

	try {
		uni.clearStorageSync()
	} catch (e) {}

	// H5：uni.clearStorage 偶发漏键，直接扫 localStorage
	// #ifdef H5
	try {
		const doomed = []
		for (let i = 0; i < window.localStorage.length; i += 1) {
			const k = window.localStorage.key(i)
			if (!k) continue
			if (k === 'currentLanguage' || k === LANG_KEY) continue
			doomed.push(k)
		}
		doomed.forEach((k) => {
			try {
				window.localStorage.removeItem(k)
			} catch (e) {}
		})
	} catch (e) {}
	// #endif

	setCurrentLanguage(keepLang)
	const deviceId = rotateDeviceId()
	uni.setStorageSync(FORCE_LOGIN_KEY, '1')
	_loginPromise = null
	return { device_id: deviceId }
}

export { TOKEN_KEY, getToken }
