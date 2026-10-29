/**
 * 壁纸 UI 缓存：活跃壁纸 URL/本地路径 + 列表首页，避免分享/首页每次打开都拉网重载图。
 */
import { apiWallpapers } from '@/api/content.js'
import { ensureLocalAsset } from '@/utils/assetCache.js'
import { readPageCache, writePageCache } from '@/utils/pageCache.js'

export const WP_LIST_KEY = 'wallpapers_page1_v1'
export const WP_ACTIVE_KEY = 'wallpaper_active_v2'
/** 占位图不可用时的包内底图（placehold.co 常失败/带字） */
export const FALLBACK_WALLPAPER = '/static/ui/welcome-bg.jpg'
export const SHARE_THEME_KEY = 'share_theme_id'
export const APP_CONFIG_KEY = 'app_config_v1'
export const WELCOME_CACHE_KEY = 'welcome_v1'
export const TOPICS_PAGE1_KEY = 'topics_page1_v2'

/** 主题合集「查看全部」列表缓存键 */
export function wallpaperCollectionsKey(tagId) {
	const tag = String(tagId || '').trim() || 'all'
	return `wallpaper_collections_${tag}_v1`
}
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

/** @returns {boolean} */
export function isVideoWallpaper(snap) {
	return !!(snap && (snap.media_type === 'video' || snap.video_url))
}

/** 动态壁纸循环视频 URL；静图返回空串。仅壁纸预览页使用。 */
export function wallpaperVideoUrl(snap) {
	if (!isVideoWallpaper(snap)) return ''
	return String(snap.video_url || '').trim()
}

/**
 * 首页 / Feed 等叠层页不要挂原生 video：会盖住语录和按钮。
 * 这些页面改用海报当静图壁纸，观感与静态壁纸一致。
 */
export function wallpaperOverlayVideoUrl(_snap) {
	return ''
}

/** @returns {{ id?: number, image_url?: string, local_url?: string, video_url?: string } | null} */
export function getActiveWallpaper() {
	return readPageCache(WP_ACTIVE_KEY)
}

function wallpaperSnapFields(snap) {
	const image_url = snap.image_url || snap.poster_url || ''
	return {
		id: snap.id || null,
		image_url,
		local_url: snap.local_url || image_url,
		media_type: snap.media_type || (snap.video_url ? 'video' : 'static'),
		video_url: snap.video_url || '',
		poster_url: snap.poster_url || '',
		duration_sec: snap.duration_sec ?? null,
	}
}

/** 写入当前壁纸快照（含可选本地路径与视频字段） */
export function setActiveWallpaper(snap) {
	if (!snap || !usableImageUrl(snap.image_url || snap.poster_url || snap.local_url)) return
	writePageCache(WP_ACTIVE_KEY, wallpaperSnapFields(snap))
}

/** 占位图 / 空 URL 不能当壁纸（placehold.co 常超时，且把字画进图里） */
export function usableImageUrl(url) {
	const s = String(url || '').trim()
	if (!s || s.endsWith('/')) return false
	return !/placehold\.co|placehold\.it|picsum\.photos|via\.placeholder/i.test(s)
}

/** 展示用路径：优先本地落盘；占位图视为无效（视频壁纸用海报） */
export function wallpaperDisplayUrl(snap) {
	if (!snap) return ''
	if (usableImageUrl(snap.local_url)) return snap.local_url
	if (usableImageUrl(snap.poster_url)) return snap.poster_url
	if (usableImageUrl(snap.image_url)) return snap.image_url
	return ''
}

/**
 * 记住壁纸并尽量把海报落盘（设置壁纸 / 首页 / 分享共用）。视频本身不落盘。
 * @param {{ id?: number, image_url?: string, video_url?: string, poster_url?: string, media_type?: string }} w
 */
export async function rememberWallpaper(w) {
	const image_url = w?.poster_url || w?.image_url
	if (!usableImageUrl(image_url)) return null
	const local_url = await ensureLocalAsset(image_url)
	const snap = wallpaperSnapFields({ ...w, image_url, local_url })
	setActiveWallpaper(snap)
	import('./widgetDesktopSync.js')
		.then((mod) => {
			if (!mod.hasHomepageWallpaper()) return null
			return mod.syncWidgetWallpaper(snap.image_url || snap.poster_url, { wallpaperSet: true })
		})
		.catch(() => {})
	return snap
}

function sameWallpaperId(a, b) {
	if (a == null || b == null || a === '' || b === '') return false
	return String(a) === String(b)
}

function pickFromRows(rows, wid) {
	const list = (rows || []).filter((w) => usableImageUrl(w?.image_url) || w?.video_url)
	if (wid) {
		return list.find((w) => sameWallpaperId(w.id, wid)) || null
	}
	return list.find((w) => !w.locked && !isVideoWallpaper(w))
		|| list.find((w) => !w.locked)
		|| list[0]
		|| null
}

async function fetchWallpaperHit(wid) {
	if (wid) {
		try {
			const vid = await apiWallpapers({ currentPage: 1, pageSize: 20, media_type: 'video' })
			const hit = pickFromRows(vid.results, wid)
			if (hit) return hit
		} catch (e) {}
	}
	const PAGE_SIZE = 30
	let page = 1
	let totalPages = 1
	let rows = []
	while (page <= totalPages && page <= 8) {
		const res = await apiWallpapers({ currentPage: page, pageSize: PAGE_SIZE })
		const batch = res.results || []
		totalPages = res.pagination?.total_pages || page
		rows = rows.concat(batch)
		const hit = pickFromRows(batch, wid)
		if (hit) return hit
		if (!wid) return pickFromRows(rows, wid)
		page += 1
	}
	return pickFromRows(rows, wid)
}

/** Tab 页 / H5 上 autoplay 经常不生效，进入首页后主动播。 */
export function playWallpaperVideo(videoId) {
	const id = String(videoId || '').trim()
	if (!id) return
	const run = () => {
		try {
			const ctx = uni.createVideoContext(id)
			if (ctx && typeof ctx.play === 'function') ctx.play()
		} catch (e) {}
		// #ifdef H5
		if (typeof document !== 'undefined') {
			try {
				const root = document.getElementById(id)
				const el = (root && (root.tagName === 'VIDEO' ? root : root.querySelector('video')))
					|| document.querySelector('.bg-video video')
				if (el) {
					el.muted = true
					el.defaultMuted = true
					el.loop = true
					el.playsInline = true
					el.setAttribute('playsinline', 'true')
					el.setAttribute('webkit-playsinline', 'true')
					el.setAttribute('muted', 'true')
					el.removeAttribute('poster')
					el.style.opacity = '1'
					el.style.objectFit = 'cover'
					el.style.background = 'transparent'
					const host = root && root !== el ? root : el.parentElement
					if (host && host.querySelectorAll) {
						host.querySelectorAll('.uni-video-cover').forEach((n) => {
							n.style.display = 'none'
						})
					}
					const p = el.play()
					if (p && typeof p.catch === 'function') p.catch(() => {})
				}
			} catch (e) {}
		}
		// #endif
	}
	run()
	setTimeout(run, 80)
	setTimeout(run, 400)
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
	const cacheHit = usableImageUrl(cached?.image_url) && (!wid || !cached.id || sameWallpaperId(cached.id, wid))
	const allowNetwork = opts.allowNetwork !== false
	const cacheReady = cacheHit && (cached.media_type !== 'video' || cached.video_url)

	if (cacheReady && !opts.forceRefresh) {
		rememberWallpaper(cached).catch(() => {})
		return cached
	}

	const listCached = readPageCache(WP_LIST_KEY)
	let hit = pickFromRows(listCached?.results, wid)

	if ((!hit || opts.forceRefresh) && allowNetwork) {
		try {
			hit = await fetchWallpaperHit(wid)
		} catch (e) {
			if (cacheHit) return cached
			hit = pickFromRows(listCached?.results, wid)
		}
	}

	if (!usableImageUrl(hit?.image_url) && !hit?.video_url) return cacheHit ? cached : null
	return rememberWallpaper(hit)
}
