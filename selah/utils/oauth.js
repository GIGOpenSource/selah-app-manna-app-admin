/**
 * 三方登录：Google / Apple 走 uni.login 的 authResult；设置页绑定仍可用 sandbox oauth_id。
 */
import { getOrCreateDeviceId, getTimezone, getRegisterCountry } from '@/utils/device.js'
import { getAppPlatform, platform } from '@/utils/analytics.js'
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

/** 登录页三方按钮：iOS 用 Apple，其它端用 Google */
export function getLoginOauthProvider() {
	return platform() === 'ios' ? 'apple' : 'google'
}

/** 用户取消授权（不弹失败 toast） */
export function isOauthUserCancel(err) {
	const msg = String(err?.errMsg || err?.message || err || '').toLowerCase()
	return /cancel|denied|close/.test(msg)
}

function appleDisplayName(appleInfo = {}) {
	const givenName = appleInfo.fullName?.givenName || ''
	const familyName = appleInfo.fullName?.familyName || ''
	return [familyName, givenName].filter(Boolean).join(' ').trim()
}

function pickStr(...vals) {
	for (const v of vals) {
		const s = String(v == null ? '' : v).trim()
		if (s) return s
	}
	return ''
}

function pickOpenId(obj = {}) {
	return pickStr(obj.openid, obj.openId, obj.open_id, obj.unionid, obj.unionId, obj.userId, obj.uid, obj.sub)
}

function pickEmail(obj = {}) {
	return pickStr(obj.email, obj.mail)
}

function pickDisplayName(obj = {}) {
	const given = pickStr(obj.givenName, obj.given_name)
	const family = pickStr(obj.familyName, obj.family_name)
	const joined = [given, family].filter(Boolean).join(' ')
	return pickStr(
		obj.displayName,
		obj.display_name,
		obj.nickName,
		obj.nickname,
		obj.name,
		obj.fullName,
		joined,
	)
}

function unwrapUserInfo(infoRes = {}) {
	let u = infoRes.userInfo || infoRes.userinfo || infoRes
	if (typeof u === 'string') {
		try {
			u = JSON.parse(u)
		} catch (e) {
			u = {}
		}
	}
	if (!u || typeof u !== 'object') u = {}
	const nested = u.userInfo || u.userinfo || {}
	return {
		email: pickEmail(u) || pickEmail(nested) || pickEmail(infoRes),
		display_name: pickDisplayName(u) || pickDisplayName(nested) || pickDisplayName(infoRes),
		oauth_id: pickOpenId(u) || pickOpenId(nested) || pickOpenId(infoRes),
	}
}

/** Google 登录后用 uni.getUserInfo 取 email / 昵称 */
function getGoogleUserProfile() {
	return new Promise((resolve) => {
		if (typeof uni.getUserInfo !== 'function') {
			resolve({ email: '', display_name: '', oauth_id: '' })
			return
		}
		uni.getUserInfo({
			provider: 'google',
			success: (infoRes) => resolve(unwrapUserInfo(infoRes || {})),
			fail: () => resolve({ email: '', display_name: '', oauth_id: '' }),
		})
	})
}

/** Google：oauth_id 来自 uni.login；email / display_name 来自 uni.getUserInfo */
export async function identityFromGoogleSuccess(loginRes = {}) {
	const authResult = loginRes.authResult || loginRes
	let profile = unwrapUserInfo(loginRes.userInfo || {})
	if (!profile.email || !profile.display_name) {
		const extra = await getGoogleUserProfile()
		profile = {
			email: profile.email || extra.email,
			display_name: profile.display_name || extra.display_name,
			oauth_id: profile.oauth_id || extra.oauth_id,
		}
	}
	return {
		provider: 'google',
		oauth_id: pickOpenId(authResult) || profile.oauth_id,
		email: profile.email,
		display_name: profile.display_name,
	}
}

export function identityFromAppleSuccess(success = {}) {
	const appleInfo = success.appleInfo || {}
	const authResult = success.authResult || {}
	const id_token = String(
		appleInfo.identityToken ||
			authResult.identityToken ||
			authResult.id_token ||
			'',
	)
	return {
		provider: 'apple',
		id_token,
		display_name: appleDisplayName(appleInfo),
	}
}

function finishOnce(timeoutMs, run) {
	return new Promise((resolve) => {
		let done = false
		const finish = () => {
			if (done) return
			done = true
			resolve()
		}
		setTimeout(finish, timeoutMs)
		try {
			run(finish)
		} catch (e) {
			finish()
		}
	})
}

/** 注销单个三方授权，清 SDK 缓存，下次 uni.login 才会再弹账号选择 */
export function logoutOauthProvider(provider) {
	const p = String(provider || '').toLowerCase()
	if (p !== 'google' && p !== 'apple') return Promise.resolve()
	return finishOnce(1500, (finish) => {
		let left = 2
		const part = () => {
			left -= 1
			if (left <= 0) finish()
		}
		if (typeof uni.logout === 'function') {
			uni.logout({
				provider: p,
				success: part,
				fail: part,
			})
		} else {
			part()
		}
		if (typeof plus !== 'undefined' && plus.oauth && typeof plus.oauth.getServices === 'function') {
			plus.oauth.getServices((services) => {
				const svc = (services || []).find((s) => String(s.id || '').toLowerCase() === p)
				if (!svc || typeof svc.logout !== 'function') {
					part()
					return
				}
				svc.logout(part, part)
			}, part)
		} else {
			part()
		}
	})
}

/** 退出登录 / 注销账号时清 Google、Apple 授权缓存 */
export async function clearNativeOauthCache() {
	try {
		uni.removeStorageSync('sandbox_oauth_id_google')
		uni.removeStorageSync('sandbox_oauth_id_apple')
	} catch (e) {}
	await Promise.all([logoutOauthProvider('google'), logoutOauthProvider('apple')])
}

/**
 * 在点击回调里同步调 uni.login，success 里再请求接口。
 * 不要先 await / 先改 busy，否则 iOS Apple 授权页可能唤不起来。
 * Google：login 成功后立刻 uni.getUserInfo，把 email / 昵称带给后续请求。
 */
export function startUniLogin(provider, { success, fail } = {}) {
	uni.login({
		provider,
		success: (loginRes) => {
			const next = (res) => {
				if (typeof success === 'function') success(res || {})
			}
			if (provider !== 'google') {
				next(loginRes)
				return
			}
			uni.getUserInfo({
				provider: 'google',
				success: (infoRes) => {
					next({
						...(loginRes || {}),
						userInfo: (infoRes && (infoRes.userInfo || infoRes.userinfo)) || infoRes || {},
					})
				},
				fail: () => next(loginRes || {}),
			})
		},
		fail: (err) => {
			if (typeof fail === 'function') fail(err)
		},
	})
}

/** 组装 device-login / oauth-login 共用的设备侧字段 */
export function buildDeviceAuthPayload() {
	const plat = getAppPlatform()
	const payload = {
		device_id: getOrCreateDeviceId(),
		timezone: getTimezone(),
		system_lang: getCurrentLanguage() || 'en',
		register_country: getRegisterCountry(),
		app_key: APP_KEY,
	}
	if (plat) payload.platform = plat
	return payload
}

/** 组装 /auth/oauth-login/ 请求体：Apple 用 id_token，Google 用 oauth_id */
export function buildOauthLoginPayload(provider, identity = {}, extra = {}) {
	const device = buildDeviceAuthPayload()
	if (provider === 'apple') {
		return {
			provider: 'apple',
			id_token: identity.id_token || '',
			app_key: device.app_key,
			platform: 'ios',
			system_lang: device.system_lang || 'en',
			timezone: device.timezone || '',
			display_name: identity.display_name || '',
			device_id: device.device_id,
			...extra,
		}
	}
	return {
		...device,
		provider: 'google',
		oauth_id: identity.oauth_id || '',
		email: identity.email || '',
		display_name: identity.display_name || '',
		...extra,
	}
}
