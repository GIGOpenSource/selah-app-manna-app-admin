/**
 * 页面级本地缓存：进入先展示缓存，后台静默拉取成功后再替换。
 * storage 前缀：manna_page_cache:{key}（与 Selah 隔离）
 *
 * 策略：有缓存先 apply(fromCache:true) → fetcher → 可选 revision 比对 → write → apply(fromCache:false)。
 * 缓存损坏/读失败返回 null，等同无缓存直接拉网。
 */

const PREFIX = 'manna_page_cache:'

/** 读取页面缓存；解析失败返回 null */
export function readPageCache(key) {
	try {
		const raw = uni.getStorageSync(PREFIX + key)
		if (!raw) return null
		return typeof raw === 'string' ? JSON.parse(raw) : raw
	} catch (e) {
		return null
	}
}

/** 写入页面缓存（静默失败，如配额满） */
export function writePageCache(key, data) {
	try {
		uni.setStorageSync(PREFIX + key, data)
	} catch (e) {}
}

/** 清除指定页面缓存（写操作后调用，避免脏读） */
export function clearPageCache(key) {
	try {
		uni.removeStorageSync(PREFIX + key)
	} catch (e) {}
}

/**
 * @param {(data: any) => (string|number|null|undefined)} [getRevision]
 * @returns {boolean} 是否应视为「同版可跳过重绘」
 */
function sameRevision(cached, fresh, getRevision) {
	if (!getRevision || cached == null || fresh == null) return false
	const a = getRevision(cached)
	const b = getRevision(fresh)
	if (a == null || b == null || a === '' || b === '') return false
	return String(a) === String(b)
}

/**
 * 先缓存后网络的加载器。
 * @param {string} key 缓存键
 * @param {() => Promise<any>} fetcher 网络拉取
 * @param {(data: any, meta: { fromCache: boolean }) => (void|Promise<void>)} apply 应用到页面状态
 * @param {{ getRevision?: (data: any) => (string|number|null|undefined) }} [opts]
 * @returns {Promise<any>} 新鲜数据
 */
export async function loadWithCache(key, fetcher, apply, opts = {}) {
	const cached = readPageCache(key)
	if (cached != null) {
		try {
			await apply(cached, { fromCache: true })
		} catch (e) {}
	}
	const fresh = await fetcher()
	if (fresh != null) {
		if (sameRevision(cached, fresh, opts.getRevision)) {
			return fresh
		}
		writePageCache(key, fresh)
		await apply(fresh, { fromCache: false })
	}
	return fresh
}

/**
 * 列表首页：同步灌缓存秒开，再后台静默拉新；拉完直接 apply 替换，不挡交互。
 * @param {string} key
 * @param {() => Promise<any>} fetcher 返回可缓存结构（通常含 results/pagination）
 * @param {(data: any, meta: { fromCache: boolean }) => (void|Promise<void>)} apply
 * @param {{ getRevision?: (data: any) => (string|number|null|undefined) }} [opts]
 * @returns {{ hydrated: boolean, refresh: Promise<any> }}
 */
export function silentListRefresh(key, fetcher, apply, opts = {}) {
	const cached = readPageCache(key)
	let hydrated = false
	if (cached != null) {
		try {
			apply(cached, { fromCache: true })
			hydrated = true
		} catch (e) {}
	}
	const refresh = (async () => {
		const fresh = await fetcher()
		if (fresh != null) {
			if (sameRevision(cached, fresh, opts.getRevision)) {
				return fresh
			}
			writePageCache(key, fresh)
			await apply(fresh, { fromCache: false })
		}
		return fresh
	})()
	return { hydrated, refresh }
}

/**
 * 公开配置：有缓存则立即 apply，网络刷新仅在 revision 变化时写回并重绘。
 * 无缓存时等同 silentListRefresh。
 */
export function silentPublicRefresh(key, fetcher, apply, opts = {}) {
	return silentListRefresh(key, fetcher, apply, opts)
}
