import { host, APP_KEY, develop } from '@/config/config.js'
import { getToken } from '@/utils/storageKeys.js'

/** 相对媒体路径转绝对 URL（本地 /static 保持原样） */
export function absolutizeMedia(url) {
	if (!url) return ''
	if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url
	if (/^\/static\//i.test(url)) return url
	const origin = String(host || '').replace(/\/api\/?$/, '')
	return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}

/** 经文朗读等受保护媒体：请求头 token（与 /api 一致，非 Authorization） */
export function mediaAuthHeaders() {
	return {
		token: getToken() || '',
		'X-App-Key': APP_KEY,
		'is-dev': develop ? 'true' : 'false',
	}
}

export function needsMediaAuth(url) {
	const u = String(url || '')
	if (!u) return false
	if (/^(data:|blob:|file:|wxfile:|content:)/i.test(u)) return false
	if (/^\/static\//i.test(u)) return false
	if (!/\/bible-med/i.test(u) && !/storage\.googleapis\.com\/[^/]*bible/i.test(u)) return false
	// H5: fetch+token headers CORS-fail after 302 to GCS. Play via <audio src>.
	if (isH5Runtime()) return false
	return true
}

const playableCache = new Map()
const inflight = new Map()

function isH5Runtime() {
	try {
		if (typeof window !== 'undefined' && typeof document !== 'undefined') return true
	} catch (e) {}
	return false
}

function fetchBlobUrl(url, headers) {
	return fetch(url, { method: 'GET', headers, credentials: 'omit' }).then((res) => {
		if (!res.ok) throw new Error(`media ${res.status}`)
		return res.blob()
	}).then((blob) => URL.createObjectURL(blob))
}

function downloadTempFile(url, headers) {
	return new Promise((resolve, reject) => {
		uni.downloadFile({
			url,
			header: headers,
			success: (res) => {
				if (res.statusCode === 200 && res.tempFilePath) resolve(res.tempFilePath)
				else reject(new Error(`media ${res.statusCode}`))
			},
			fail: (err) => reject(err || new Error('media fail')),
		})
	})
}

/**
 * 受保护媒体先带 token 头拉取，再给 InnerAudioContext 播本地/blob。
 * 普通 URL 原样返回。
 */
export function resolveAuthedMediaSrc(url) {
	const src = String(url || '').trim()
	if (!src) return Promise.resolve('')
	if (!needsMediaAuth(src)) return Promise.resolve(src)
	if (playableCache.has(src)) return Promise.resolve(playableCache.get(src))
	if (inflight.has(src)) return inflight.get(src)

	const headers = mediaAuthHeaders()
	const task = (isH5Runtime() ? fetchBlobUrl(src, headers) : downloadTempFile(src, headers))
		.then((playable) => {
			if (playable) playableCache.set(src, playable)
			return playable
		})
		.catch(() => src)
	inflight.set(src, task)
	return task.finally(() => inflight.delete(src))
}
