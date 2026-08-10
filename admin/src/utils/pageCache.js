/**
 * 管理端页面缓存：进入先展示缓存，静默刷新成功后替换。
 */

const PREFIX = 'selah_admin_page_cache:'

export function readPageCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function writePageCache(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch {
    /* quota / private mode */
  }
}

export function clearPageCache(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

/**
 * 先 apply 缓存（若有），再 await fetcher，写入缓存并再次 apply。
 * @param {string} key
 * @param {() => Promise<any>} fetcher
 * @param {(data: any, meta?: { fromCache: boolean }) => void} apply
 */
export async function loadWithCache(key, fetcher, apply) {
  const cached = readPageCache(key)
  if (cached != null) {
    try {
      apply(cached, { fromCache: true })
    } catch {
      /* ignore bad cache shape */
    }
  }
  const fresh = await fetcher()
  writePageCache(key, fresh)
  apply(fresh, { fromCache: false })
  return fresh
}
