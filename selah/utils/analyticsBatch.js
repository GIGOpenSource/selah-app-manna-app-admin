/**
 * POST /api/analytics/batch/
 * 事件结构与原 track 队列一致：{ events: [{ name, params, ts }] }。
 */
import { host, APP_KEY } from '@/config/config.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'

const queue = []
let flushTimer = null
const FLUSH_MS = 1500
const MAX_BATCH = 40

function appPlatform() {
	// #ifdef APP-PLUS
	try {
		const p = uni.getSystemInfoSync().platform
		return p === 'ios' ? 'ios' : 'android'
	} catch (e) {
		return 'android'
	}
	// #endif
	// #ifndef APP-PLUS
	return ''
	// #endif
}

export function enqueueBatch(eventName, params = {}) {
	queue.push({
		name: eventName,
		params: { ...(params || {}) },
		ts: Date.now(),
	})
	if (queue.length >= MAX_BATCH) {
		flushBatch()
		return
	}
	if (!flushTimer) {
		flushTimer = setTimeout(() => {
			flushTimer = null
			flushBatch()
		}, FLUSH_MS)
	}
}

export function flushBatch() {
	if (!queue.length) return
	const events = queue.splice(0, MAX_BATCH)
	let token = ''
	try {
		token = uni.getStorageSync('token') || ''
	} catch (e) {}
	const headers = {
		'Content-Type': 'application/json',
		'Accept-Language': getCurrentLanguage() || 'en',
		'X-App-Key': APP_KEY,
	}
	if (token) headers.token = token
	const plat = appPlatform()
	if (plat) headers['X-Platform'] = plat
	try {
		uni.request({
			url: `${host}/analytics/batch/`,
			method: 'POST',
			header: headers,
			data: { events },
			success() {},
			fail() {},
		})
	} catch (e) {}
	if (queue.length) {
		flushTimer = setTimeout(() => {
			flushTimer = null
			flushBatch()
		}, FLUSH_MS)
	}
}
