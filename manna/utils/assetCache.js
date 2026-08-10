/**
 * 远程 UI 图本地落盘：App/小程序首次 download+save，之后直接用本地路径。
 * 包内 /static、data/blob/file 原样返回；H5 无法持久化文件时仍返回原 URL（靠浏览器缓存）。
 */

const MAP_KEY = 'manna_asset_local_map'
const LEGACY_MAP_KEY = 'selah_asset_local_map'
const inflight = new Map()

function readMap() {
	try {
		let raw = uni.getStorageSync(MAP_KEY)
		if (!raw) {
			raw = uni.getStorageSync(LEGACY_MAP_KEY)
			if (raw) {
				try {
					uni.setStorageSync(MAP_KEY, raw)
					uni.removeStorageSync(LEGACY_MAP_KEY)
				} catch (e) {}
			}
		}
		if (!raw) return {}
		return typeof raw === 'string' ? JSON.parse(raw) : raw
	} catch (e) {
		return {}
	}
}

function writeMap(map) {
	try {
		uni.setStorageSync(MAP_KEY, map)
	} catch (e) {}
}

/** 已是本地/包内资源则无需下载 */
export function isBundledOrLocalUrl(url) {
	if (!url || typeof url !== 'string') return true
	const u = url.trim()
	if (!u) return true
	if (u.startsWith('/') && !u.startsWith('//')) return true
	if (/^(data:|blob:|file:|wxfile:|content:)/i.test(u)) return true
	return false
}

function canPersistSavedFile() {
	try {
		const sys = uni.getSystemInfoSync?.() || {}
		const p = String(sys.uniPlatform || sys.platform || '').toLowerCase()
		if (p === 'web' || p === 'h5') return false
		if (typeof window !== 'undefined' && !sys.uniPlatform) return false
		return true
	} catch (e) {
		return false
	}
}

/** App/小程序可持久化落盘；H5 为 false */
export function canPersistAssets() {
	return canPersistSavedFile()
}

/** 已缓存的本地路径；未下载返回空串（不触发下载） */
export function peekLocalAsset(url) {
	const src = (url || '').trim()
	if (!src) return ''
	if (isBundledOrLocalUrl(src)) return src
	return readMap()[src] || ''
}

/** 是否已在本地 map 落盘（不含包内 /static 等「伪本地」） */
export function hasPersistedAsset(url) {
	const src = (url || '').trim()
	if (!src || isBundledOrLocalUrl(src)) return false
	return !!readMap()[src]
}

/**
 * 强制下载并落盘（听经等）。
 * @returns {Promise<{ ok: boolean, path: string, reason?: string }>}
 */
export function downloadAndPersist(url) {
	const src = (url || '').trim()
	if (!src) return Promise.resolve({ ok: false, path: '', reason: 'empty' })
	if (isBundledOrLocalUrl(src)) return Promise.resolve({ ok: true, path: src })

	const existing = readMap()[src]
	if (existing) return Promise.resolve({ ok: true, path: existing })

	if (!canPersistSavedFile()) {
		return Promise.resolve({ ok: false, path: '', reason: 'h5' })
	}

	if (inflight.has(src)) {
		return inflight.get(src).then((path) => {
			const ok = !!(path && path !== src)
			return { ok: ok || !!peekLocalAsset(src), path: peekLocalAsset(src) || path || '' }
		})
	}

	const task = new Promise((resolve) => {
		uni.downloadFile({
			url: src,
			success: (res) => {
				if (res.statusCode !== 200 || !res.tempFilePath) {
					resolve(src)
					return
				}
				uni.saveFile({
					tempFilePath: res.tempFilePath,
					success: (saved) => {
						const path = saved.savedFilePath || res.tempFilePath
						const next = readMap()
						next[src] = path
						writeMap(next)
						resolve(path)
					},
					fail: () => resolve(res.tempFilePath || src),
				})
			},
			fail: () => resolve(src),
		})
	}).finally(() => {
		inflight.delete(src)
	})

	inflight.set(src, task)
	return task.then((path) => {
		const local = peekLocalAsset(src)
		if (local) return { ok: true, path: local }
		if (path && path !== src) return { ok: true, path }
		return { ok: false, path: '', reason: 'fail' }
	})
}

/**
 * 将远程 URL 解析为可复用的本地路径；失败则回退原 URL。
 * @param {string} url
 * @returns {Promise<string>}
 */
export function ensureLocalAsset(url) {
	const src = (url || '').trim()
	if (!src || isBundledOrLocalUrl(src)) return Promise.resolve(src)

	const map = readMap()
	if (map[src]) return Promise.resolve(map[src])

	if (inflight.has(src)) return inflight.get(src)

	const task = new Promise((resolve) => {
		if (!canPersistSavedFile()) {
			resolve(src)
			return
		}
		uni.downloadFile({
			url: src,
			success: (res) => {
				if (res.statusCode !== 200 || !res.tempFilePath) {
					resolve(src)
					return
				}
				uni.saveFile({
					tempFilePath: res.tempFilePath,
					success: (saved) => {
						const path = saved.savedFilePath || res.tempFilePath
						const next = readMap()
						next[src] = path
						writeMap(next)
						resolve(path)
					},
					fail: () => resolve(res.tempFilePath || src),
				})
			},
			fail: () => resolve(src),
		})
	}).finally(() => {
		inflight.delete(src)
	})

	inflight.set(src, task)
	return task
}
