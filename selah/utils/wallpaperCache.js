/**
 * 壁纸 UI 缓存：活跃壁纸 URL/本地路径 + 列表首页，避免分享/首页每次打开都拉网重载图。
 */
import { apiWallpapers } from '@/api/content.js'
import { ensureLocalAsset } from '@/utils/assetCache.js'
import { readPageCache, writePageCache } from '@/utils/pageCache.js'

export const WP_LIST_KEY = 'wallpapers_page1_v1'
export const WP_ACTIVE_KEY = 'wallpaper_active_v1'
export const SHARE_THEME_KEY = 'share_theme_id'
export const APP_CONFIG_KEY = 'app_config_v1'
export const WELCOME_CACHE_KEY = 'welcome_v1'
export const TOPICS_PAGE1_KEY = 'topics_page1_v1'
export const VIP_PLANS_KEY = 'vip_plans_v1'
export const ONBOARDING_Q_KEY = 'onboarding_questions_v1'
export const ASSETS_FOLDERS_KEY = 'assets_folders_v1'

/** 教育夹层 pageCache 键（与 bootstrap 灌入一致） */
export function interstitialCacheKey(kind) {
	return `interstitial_${String(kind || '').trim()}_v1`
}

/** 资产列表首页缓存键（按 kind / folder） */
export function assetsListKey(kind, folderId) {
	return `assets_${kind || 'like'}_${folderId || 0}_p1`
}

/** 话题语录列表首页缓存键 */
export function topicQuotesKey(topicId) {
	return `topic_quotes_${topicId || 0}_p1`
}

/** @returns {{ id?: number, image_url?: string, local_url?: string } | null} */
export function getActiveWallpaper() {
	return readPageCache(WP_ACTIVE_KEY)
}

/** 写入当前壁纸快照（含可选本地路径） */
export function setActiveWallpaper(snap) {
	if (!snap || !snap.image_url) return
	writePageCache(WP_ACTIVE_KEY, {
		id: snap.id || null,
		image_url: snap.image_url,
		local_url: snap.local_url || snap.image_url,
	})
}

/** 展示用路径：优先本地落盘 */
export function wallpaperDisplayUrl(snap) {
	if (!snap) return ''
	return snap.local_url || snap.image_url || ''
}

/**
 * 记住壁纸并尽量落盘到本地（设置壁纸 / 首页 / 分享共用）。
 * @param {{ id?: number, image_url?: string }} w
 */
export async function rememberWallpaper(w) {
	if (!w?.image_url) return null
	const local_url = await ensureLocalAsset(w.image_url)
	const snap = { id: w.id, image_url: w.image_url, local_url }
	setActiveWallpaper(snap)
	return snap
}

function pickFromRows(rows, wid) {
	const list = rows || []
	if (wid) {
		const hit = list.find((w) => w.id === wid)
		if (hit?.image_url) return hit
	}
	return list.find((w) => !w.locked && w.image_url) || list.find((w) => w.image_url) || null
}

/**
 * 解析当前用户壁纸：先读本地快照秒开，再按需静默拉列表刷新。
 * @param {{ wallpaper_id?: number } | null} user
 * @param {{ forceRefresh?: boolean, allowNetwork?: boolean }} [opts]
 *   allowNetwork=false：仅本地缓存（onShow 抢跑 / 未登录时用），不打需鉴权接口
 */
export async function resolveActiveWallpaper(user, opts = {}) {
	const wid = user?.wallpaper_id
	const cached = getActiveWallpaper()
	const cacheHit = cached?.image_url && (!wid || !cached.id || cached.id === wid)
	const allowNetwork = opts.allowNetwork !== false

	if (cacheHit && !opts.forceRefresh) {
		// 后台补落盘 / 校验，不阻塞首屏
		rememberWallpaper({ id: cached.id, image_url: cached.image_url }).catch(() => {})
		return cached
	}

	const listCached = readPageCache(WP_LIST_KEY)
	let hit = pickFromRows(listCached?.results, wid)

	if ((!hit || opts.forceRefresh) && allowNetwork) {
		try {
			const PAGE_SIZE = 30
			let page = 1
			let totalPages = 1
			let rows = []
			let pagination = null
			while (page <= totalPages) {
				const res = await apiWallpapers({ currentPage: page, pageSize: PAGE_SIZE })
				const batch = res.results || []
				pagination = res.pagination || null
				totalPages = pagination?.total_pages || page
				if (page === 1) {
					rows = batch
					writePageCache(WP_LIST_KEY, { results: batch, pagination })
				} else {
					rows = rows.concat(batch)
				}
				hit = pickFromRows(batch, wid)
				if (hit) break
				if (!wid) {
					hit = pickFromRows(rows, wid)
					break
				}
				page += 1
			}
			if (!hit) hit = pickFromRows(rows, wid)
		} catch (e) {
			if (cacheHit) return cached
			hit = pickFromRows(listCached?.results, wid)
		}
	}

	if (!hit?.image_url) return cacheHit ? cached : null
	return rememberWallpaper(hit)
}
