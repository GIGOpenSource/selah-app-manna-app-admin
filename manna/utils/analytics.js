/**
 * Firebase Analytics 封装 — 事件名严格对齐产品文档 §9.4
 * 同时双写服务端 POST /api/analytics/batch/（仅 ios/android）
 *
 * 本文件为 **Manna 工程内副本**（`mobile-manna/utils/analytics.js`）。
 * 与 Selah `mobile/utils/analytics.js` 可能同构，但互不共享、改一边不会自动同步。
 * 品牌 / 鉴权键经本工程 `@/config` + `@/utils/storageKeys` 区分。
 *
 * 公共参数（COMMON_KEYS）：user_id / vip_level / register_country / login_type / platform
 * + system_lang。H5 只打 console，不上报服务端。
 */
import { host, APP_KEY } from '@/config/config.js'
import { getCurrentLanguage, getToken, getUserInfo } from '@/utils/storageKeys.js'

const COMMON_KEYS = ['user_id', 'vip_level', 'register_country', 'login_type', 'platform']

/** 服务端批量上报队列；满 MAX_BATCH 或 FLUSH_MS 后 flush */
const queue = []
let flushTimer = null
const FLUSH_MS = 1500
const MAX_BATCH = 40

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
	const u = getUserInfo() || {}
	return {
		user_id: u.user_id || '',
		vip_level: u.vip_level || 'free',
		register_country: u.register_country || '',
		login_type: u.login_type || 'device',
		platform: platform(),
		system_lang: getCurrentLanguage() || u.system_lang || 'en',
	}
}

/**
 * 入队服务端上报：无平台或无 token 直接跳过；
 * 达批量上限立即 flush，否则延迟 FLUSH_MS。
 */
function enqueueServer(eventName, params) {
	const plat = getAppPlatform()
	if (!plat) return
	const token = getToken()
	if (!token) return
	queue.push({
		name: eventName,
		params: { ...params, platform: plat },
		ts: Date.now(),
	})
	if (queue.length >= MAX_BATCH) {
		flushServerQueue()
		return
	}
	if (!flushTimer) {
		flushTimer = setTimeout(() => {
			flushTimer = null
			flushServerQueue()
		}, FLUSH_MS)
	}
}

/** 取出队列前 MAX_BATCH 条 POST /analytics/batch/；失败静默 */
function flushServerQueue() {
	if (!queue.length) return
	const token = getToken()
	if (!token) {
		queue.length = 0
		return
	}
	const events = queue.splice(0, MAX_BATCH)
	const headers = {
		'Content-Type': 'application/json',
		token,
		'Accept-Language': getCurrentLanguage(),
		'X-App-Key': APP_KEY,
	}
	const platHdr = getAppPlatform()
	if (platHdr) headers['X-Platform'] = platHdr
	try {
		uni.request({
			url: `${host}/analytics/batch/`,
			method: 'POST',
			header: headers,
			data: { events },
			success() {},
			fail() {},
		})
	} catch (e) {
		// 静默
	}
}

/**
 * 打点入口：合并公共参数 → Firebase（APP）或 console（H5）→ 入队服务端。
 * @param {string} eventName 文档 §9.4 事件名
 * @param {object} [params] 业务附加字段
 */
export function track(eventName, params = {}) {
	const payload = { ...commonParams(), ...params }
	try {
		// #ifdef APP-PLUS
		if (typeof plus !== 'undefined' && plus.firebase) {
			plus.firebase.logEvent(eventName, payload)
		} else {
			console.log('[analytics]', eventName, payload)
		}
		// #endif
		// #ifndef APP-PLUS
		console.log('[analytics]', eventName, payload)
		// #endif
	} catch (e) {
		console.warn('analytics fail', e)
	}
	enqueueServer(eventName, payload)
}

/** 设置用户属性（当前仅本地 log，预留 Firebase setUserProperty） */
export function setUserProps(props = {}) {
	try {
		console.log('[analytics:user_props]', { ...commonParams(), ...props })
	} catch (e) {}
}

export { COMMON_KEYS }
