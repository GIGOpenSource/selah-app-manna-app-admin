/**
 * 桌面小组件样式。
 * 没设置首页壁纸时不写自定义样式，桌面继续用后台固定卡片。
 * 设置了首页壁纸后，桌面按小组件页预览来画，并按刷新间隔向接口重拉语录。
 * 执行前按设备分开：安卓写 items（含预览图），iOS 写 ios_previews 和本地图。
 */
import { host, APP_KEY } from '@/config/config.js'
import { apiWidgets, apiWidgetSave, apiDisplayTagQuotes } from '@/api/content.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import { getUser } from '@/utils/session.js'
import { getActiveWallpaper } from '@/utils/wallpaperCache.js'
import { readWidgetUiPrefs, refreshToApi } from '@/pagesA/widgets/refreshOptions.js'
import { nativeWriteWidgetStyle } from '@/utils/selahNative.js'

const STYLE_KEY = 'widget_style_last'

const REFRESH_SECONDS = {
	off: 0,
	'30s': 30,
	'1min': 60,
	'1m': 60,
	'5min': 300,
	'5m': 300,
	'15min': 900,
	'15m': 900,
	'30min': 1800,
	'30m': 1800,
	'1h': 3600,
	'3h': 10800,
	'6h': 21600,
	'24h': 86400,
	daily: 86400,
	hourly: 3600,
}

function emptyStyle() {
	return {
		wallpaper_set: false,
		wallpaper_url: '',
		wallpaper_changed: false,
		catalog: [],
		api_base: '',
		fallback_quotes: [],
		last_shape: '',
		quote_url: '',
		token: '',
		language: 'en',
		app_key: APP_KEY,
		slots: {},
		ios_previews: [],
	}
}

export function hasHomepageWallpaper() {
	const id = getUser()?.wallpaper_id
	return id != null && id !== '' && Number(id) !== 0
}

export function isIosDevice() {
	try {
		return String(uni.getSystemInfoSync().platform || '').toLowerCase() === 'ios'
	} catch (e) {
		return false
	}
}

function httpUrl(url) {
	const value = String(url || '').trim()
	return /^https?:\/\//i.test(value) ? value : ''
}

export function refreshSeconds(code) {
	const seconds = REFRESH_SECONDS[String(code || '').toLowerCase()]
	return Number.isFinite(seconds) ? seconds : 0
}

export function shapeKey(shape) {
	const raw = String(shape || '').toLowerCase()
	if (raw === 'square' || raw === 's22') return 'square'
	if (raw === 'large_square') return 'large_square'
	if (raw === 'large' || raw === 'extra_large' || raw === 's44') return 'large'
	return 'wide'
}

function quoteLines(list) {
	return (list || [])
		.map((item) => String(item || '').trim())
		.filter(Boolean)
		.slice(0, 30)
}

function normalizePreviews(list) {
	return (list || [])
		.map((row) => ({
			shape: shapeKey(row?.shape),
			name: String(row?.name || '').trim(),
			quotes: quoteLines(row?.quotes),
			refresh_seconds: Number(row?.refresh_seconds) || refreshSeconds(row?.refresh),
			border: !!row?.border,
			quote_url: String(row?.quote_url || '').trim(),
			image_url: String(row?.image_url || '').trim(),
		}))
		.filter((row) => row.quotes.length || row.name || row.image_url)
}

/** 安卓桌面只读 items。图片用网络壁纸，没有网络地址时用本地文件。 */
function androidItems(previews, slots, image, quoteUrl) {
	const picture = String(image || '').trim()
	const fromPreviews = (previews || []).map((row) => ({
		shape: row.shape,
		image_url: String(row.image_url || '').trim() || picture,
		name: row.name,
		border: !!row.border,
		refresh_seconds: Number(row.refresh_seconds) || 0,
		quotes: quoteLines(row.quotes),
		quote_url: row.quote_url || quoteUrl || '',
	}))
	const rows = fromPreviews.length ? fromPreviews : []
	if (!rows.length) {
		;['square', 'wide', 'large'].forEach((key) => {
			const slot = slots?.[key]
			if (!slot || typeof slot !== 'object') return
			rows.push({
				shape: key,
				image_url: picture,
				name: String(slot.name || '').trim(),
				border: !!slot.border,
				refresh_seconds: Number(slot.refresh_seconds) || refreshSeconds(slot.refresh),
				quotes: quoteLines(slot.quotes),
				quote_url: String(slot.quote_url || quoteUrl || ''),
			})
		})
	}
	const kept = rows.filter((row) => row.quotes.length || row.name || row.image_url)
	const seed = kept[0]
	if (!seed) return kept
	if (!kept.some((row) => row.shape === 'square')) kept.push({ ...seed, shape: 'square' })
	if (!kept.some((row) => row.shape === 'wide' || row.shape === 'large')) kept.push({ ...seed, shape: 'wide' })
	return kept
}

function slotsHaveContent(slots) {
	return Object.keys(slots || {}).some((key) => {
		const slot = slots[key]
		if (!slot || typeof slot !== 'object') return false
		if (String(slot.name || '').trim()) return true
		return quoteLines(slot.quotes).length > 0
	})
}

/** 桌面上的方块和横条共用同一份名称和语录，避免只写了一种尺寸时另一种停在旧卡片。 */
function mirrorSlots(slots) {
	const next = { ...(slots || {}) }
	const seed = ['square', 'wide', 'large']
		.map((key) => next[key])
		.find((slot) => slot && (String(slot.name || '').trim() || quoteLines(slot.quotes).length))
	if (!seed) return next
	if (!next.square) next.square = { ...seed }
	if (!next.wide) next.wide = { ...seed }
	return next
}

function savedPreview(style) {
	if (!style) return false
	if (style.local_image) return true
	if ((style.ios_previews || []).length) return true
	return slotsHaveContent(style.slots)
}

function localFilePath(url) {
	const value = String(url || '').trim()
	if (!value || /^https?:\/\//i.test(value)) return ''
	if (value.startsWith('file://')) return decodeURIComponent(value.slice('file://'.length))
	if (value.startsWith('/')) return value
	try {
		if (typeof plus !== 'undefined' && plus.io && typeof plus.io.convertLocalFileSystemURL === 'function') {
			const abs = String(plus.io.convertLocalFileSystemURL(value) || '')
			if (abs.startsWith('file://')) return decodeURIComponent(abs.slice('file://'.length))
			if (abs.startsWith('/')) return abs
		}
	} catch (e) {}
	return ''
}

function readStyle() {
	try {
		const raw = uni.getStorageSync(STYLE_KEY)
		if (!raw) return emptyStyle()
		const data = typeof raw === 'string' ? JSON.parse(raw) : raw
		if (!data || typeof data !== 'object') return emptyStyle()
		return {
			wallpaper_set: !!data.wallpaper_set,
			wallpaper_url: httpUrl(data.wallpaper_url),
			wallpaper_changed: !!data.wallpaper_changed,
			catalog: Array.isArray(data.catalog) ? data.catalog : [],
			api_base: String(data.api_base || apiBase()),
			fallback_quotes: quoteLines(data.fallback_quotes),
			last_shape: String(data.last_shape || ''),
			quote_url: String(data.quote_url || ''),
			token: String(data.token || ''),
			language: String(data.language || 'en'),
			app_key: String(data.app_key || APP_KEY),
			slots: data.slots && typeof data.slots === 'object' ? data.slots : {},
			ios_previews: normalizePreviews(data.ios_previews),
			local_image: localFilePath(data.local_image),
		}
	} catch (e) {
		return emptyStyle()
	}
}

async function writeStyle(style) {
	const wallpaperSet = !!style?.wallpaper_set
	const wallpaper = wallpaperSet ? httpUrl(style?.wallpaper_url) : ''
	const localImage = localFilePath(style?.local_image)
	const quoteUrl = String(style?.quote_url || '')
	const slots = style?.slots && typeof style.slots === 'object' ? style.slots : {}
	const iosPreviews = normalizePreviews(style?.ios_previews)
	const stored = {
		wallpaper_set: wallpaperSet,
		wallpaper_url: wallpaper,
		wallpaper_changed: !!style?.wallpaper_changed,
		catalog: Array.isArray(style?.catalog) ? style.catalog : [],
		api_base: String(style?.api_base || apiBase()),
		fallback_quotes: quoteLines(style?.fallback_quotes),
		last_shape: String(style?.last_shape || ''),
		quote_url: quoteUrl,
		token: String(style?.token || uni.getStorageSync('token') || ''),
		language: String(style?.language || getCurrentLanguage() || 'en'),
		app_key: String(style?.app_key || APP_KEY),
		slots,
		ios_previews: iosPreviews,
		local_image: localImage,
		updated_at: new Date().toISOString(),
	}
	try {
		uni.setStorageSync(STYLE_KEY, JSON.stringify(stored))
	} catch (e) {}
	if (!isIosDevice()) {
		const picture = localImage || wallpaper
		const active = wallpaperSet || !!picture || iosPreviews.length > 0 || slotsHaveContent(slots)
		const androidSlots = mirrorSlots(slots)
		return nativeWriteWidgetStyle({
			wallpaper_set: active,
			wallpaper_url: picture,
			wallpaper_changed: stored.wallpaper_changed,
			catalog: stored.catalog,
			api_base: stored.api_base,
			fallback_quotes: stored.fallback_quotes,
			last_shape: stored.last_shape,
			quote_url: quoteUrl,
			token: stored.token,
			language: stored.language,
			app_key: stored.app_key,
			slots: androidSlots,
			items: active ? androidItems(iosPreviews, androidSlots, picture, quoteUrl) : [],
			updated_at: stored.updated_at,
		})
	}
	return nativeWriteWidgetStyle(stored)
}

function apiBase() {
	return String(host || '').replace(/\/$/, '')
}

/** 语录接口。选了话题就拉话题语录，否则拉小组件载荷。桌面到点会自己再请求。 */
export function quoteRequest(displayTagIds) {
	const ids = (displayTagIds || []).map((id) => String(id || '').trim()).filter(Boolean)
	const base = apiBase()
	const quote_url = ids.length
		? `${base}/content/display-tag-quotes/?display_tag_id=${encodeURIComponent(ids.join(','))}&currentPage=1&pageSize=20`
		: `${base}/content/widget-payload/`
	return {
		quote_url,
		token: String(uni.getStorageSync('token') || ''),
		language: getCurrentLanguage() || 'en',
		app_key: APP_KEY,
	}
}

export function quoteAt(quotes, refresh) {
	const list = quoteLines(quotes)
	if (!list.length) return ''
	const seconds = refreshSeconds(refresh)
	if (!seconds) return list[0]
	const bucket = Math.floor(Date.now() / 1000 / seconds)
	const index = ((bucket % list.length) + list.length) % list.length
	return list[index]
}

function slotFromUiPrefs() {
	const local = readWidgetUiPrefs()
	const items = Array.isArray(local?.category?.items) ? local.category.items : []
	const ids = items.map((row) => row?.id).filter((id) => id != null && id !== '')
	return {
		name: typeof local.name === 'string' ? local.name : '',
		border: !!local.border_on,
		refresh: typeof local.refresh === 'string' ? local.refresh : 'off',
		displayTagIds: ids,
	}
}

function catalogQuote(row) {
	const quote = row?.quote
	if (quote && typeof quote === 'object') {
		const text = quote.content || quote.text || ''
		if (String(text).trim()) return String(text).trim()
	}
	if (typeof quote === 'string' && quote.trim()) return quote.trim()
	return String(row?.quote_content || row?.text || row?.content || '').trim()
}

function catalogImage(row) {
	return String(row?.image_url || row?.cover_url || row?.card_image_url || '').trim()
}

/**
 * 把 /content/widgets/ 的 wallpaper_changed 和 list 交给桌面。
 * false：桌面继续用 selah1 的 widget-cards 四条。
 * true：桌面用 list 里的图和语录，对齐小组件中心的日落图和居中文案。
 * @param {object} [bag] results，不传则自己请求
 */
export async function publishWidgetCatalog(bag) {
	let results = bag
	if (!results) {
		try {
			const res = await apiWidgets({}, { showLoading: false })
			results = res?.results || {}
		} catch (e) {
			return { ok: false }
		}
	}
	const list = Array.isArray(results.list) ? results.list : []
	const catalog = list.map((row) => ({
		id: row?.id,
		shape: shapeKey(row?.shape),
		image_url: catalogImage(row),
		quote: catalogQuote(row),
	})).filter((row) => row.image_url || row.quote)
	const prev = readStyle()
	const changed = !!results.wallpaper_changed
	return writeStyle({
		...prev,
		wallpaper_changed: changed,
		catalog,
		api_base: apiBase(),
		token: String(uni.getStorageSync('token') || prev.token || ''),
		language: getCurrentLanguage() || prev.language || 'en',
		wallpaper_set: !!(prev.wallpaper_set || prev.wallpaper_url),
	})
}

/** 回到前台时，按接口 wallpaper_changed 重新交给桌面小组件。 */
export async function republishWidgetDesktop() {
	const published = await publishWidgetCatalog()
	if (published && published.ok !== false) return published
	const prev = readStyle()
	if (!prev.wallpaper_set && !prev.wallpaper_url && !prev.local_image && !prev.ios_previews.length && !prev.catalog.length) {
		return { ok: false, skipped: true }
	}
	return writeStyle({ ...prev, wallpaper_set: !!prev.wallpaper_changed })
}

/** 没设置首页壁纸、也没有已保存的小组件预览时，桌面回到后台固定卡片。 */
export async function clearWidgetDesktop() {
	const prev = readStyle()
	if (savedPreview(prev)) return { ok: true, unchanged: true }
	if (!prev.wallpaper_set && !prev.wallpaper_url && !prev.local_image) return { ok: true, unchanged: true }
	return writeStyle({ ...prev, wallpaper_set: false, wallpaper_url: '', local_image: '' })
}

/**
 * 仅在用户设置过首页壁纸时，把壁纸地址交给桌面小组件。
 * @param {string} url
 * @param {{ wallpaperSet?: boolean }} [opts]
 */
export async function syncWidgetWallpaper(url, opts = {}) {
	const wallpaperSet = opts.wallpaperSet != null ? !!opts.wallpaperSet : hasHomepageWallpaper()
	if (!wallpaperSet) return clearWidgetDesktop()
	const remote = httpUrl(url)
	if (!remote) return { ok: false, skipped: true }
	const prev = readStyle()
	const ui = slotFromUiPrefs()
	const auth = quoteRequest(ui.displayTagIds)
	const same = prev.wallpaper_set && prev.wallpaper_url === remote && prev.quote_url === auth.quote_url
	if (same) return { ok: true, unchanged: true }
	return writeStyle({
		...prev,
		...auth,
		wallpaper_set: true,
		wallpaper_url: remote,
	})
}

function readStoredObject(key) {
	try {
		const raw = uni.getStorageSync(key)
		if (!raw) return {}
		const data = typeof raw === 'string' ? JSON.parse(raw) : raw
		return data && typeof data === 'object' ? data : {}
	} catch (e) {
		return {}
	}
}

function quoteTextOf(row) {
	if (!row || typeof row !== 'object') return ''
	const raw = row.content ?? row.text ?? row.body
	if (typeof raw === 'string') return raw.trim()
	if (row.quote && typeof row.quote === 'object') return quoteTextOf(row.quote)
	return ''
}

/**
 * 和小组件详情页点击保存一样：把名称、边框、语录和列表图交给桌面。
 * 只在安卓换首页壁纸时调用，iOS 不走这里。
 */
export async function saveWidgetPageDesktop() {
	if (isIosDevice()) return { ok: true, skipped: true }
	let rows = []
	try {
		const res = await apiWidgets({}, { showLoading: false })
		rows = res?.results?.list || []
	} catch (e) {
		return { ok: false }
	}
	const prefs = readWidgetUiPrefs()
	const edited = readStoredObject('widget_edit_item')
	const editedId = edited.id != null && edited.id !== '' ? edited.id : rows[0]?.id
	const row = rows.find((item) => String(item?.id) === String(editedId)) || rows[0] || null
	const name = typeof prefs.name === 'string' ? prefs.name : String(edited.name || row?.name || '')
	const border = typeof prefs.border_on === 'boolean'
		? prefs.border_on
		: !!(edited.border_enabled || row?.border_enabled)
	const refresh = typeof prefs.refresh === 'string'
		? prefs.refresh
		: String(row?.refresh || edited.refresh || 'off')
	const cat = prefs.category
	let ids = []
	if (Array.isArray(cat?.items) && cat.items.length) {
		ids = cat.items.map((item) => item?.id).filter((id) => id != null && id !== '')
	} else if (cat && cat.id != null && cat.id !== '') {
		ids = [cat.id]
	} else if (edited.display_tag_id != null && edited.display_tag_id !== '') {
		ids = [edited.display_tag_id]
	} else if (row?.display_tag_id != null && row.display_tag_id !== '') {
		ids = [row.display_tag_id]
	}
	let quotes = []
	if (ids.length) {
		try {
			const res = await apiDisplayTagQuotes(ids.join(','), { currentPage: 1, pageSize: 30 }, { showLoading: false })
			const bag = res?.results || res || {}
			const list = Array.isArray(bag.list) ? bag.list : []
			quotes = list.map(quoteTextOf).filter(Boolean)
		} catch (e) {}
	}
	if (!quotes.length) {
		const current = catalogQuote(row) || String(edited.quote_content || edited.quote?.content || '').trim()
		if (current) quotes = [current]
	}
	const shape = String(row?.shape || edited.shape || 'wide')
	const previewImage = catalogImage(row) || String(edited.image_url || '').trim()
	try {
		const body = {
			name: String(name || ''),
			display_tag_id: ids.length === 1 ? (Number.isFinite(Number(ids[0])) ? Number(ids[0]) : ids[0]) : null,
			border_enabled: !!border,
			refresh: refreshToApi(refresh),
		}
		if (editedId != null && editedId !== '') body.id = Number(editedId) || editedId
		await apiWidgetSave(body)
	} catch (e) {}
	const snap = getActiveWallpaper() || {}
	const mine = {
		shape,
		name: String(name || '').trim(),
		quotes,
		refresh,
		border: !!border,
		image_url: previewImage,
	}
	const iosPreviews = [mine]
	rows.forEach((item) => {
		if (editedId != null && String(item?.id) === String(editedId)) return
		const text = catalogQuote(item)
		iosPreviews.push({
			shape: item?.shape,
			name: String(item?.name || ''),
			quotes: text ? [text] : [],
			refresh: item?.refresh,
			border: !!item?.border_enabled,
			image_url: catalogImage(item),
		})
	})
	return syncWidgetSlot({
		shape,
		name,
		border: !!border,
		refresh,
		quotes,
		displayTagIds: ids,
		wallpaperUrl: httpUrl(snap.image_url || snap.poster_url),
		localImage: localFilePath(snap.local_url),
		wallpaperSet: true,
		iosPreviews,
	})
}

/** 读当前用户壁纸。设置过才同步，没设置则恢复后台固定卡片。安卓换完主题后顺手重拉小组件接口。 */
export async function syncWidgetWallpaperFromSession() {
	if (!hasHomepageWallpaper()) return clearWidgetDesktop()
	const snap = getActiveWallpaper()
	const remote = httpUrl(snap?.image_url || snap?.poster_url)
	if (!remote) return { ok: false, skipped: true }
	const synced = await syncWidgetWallpaper(remote, { wallpaperSet: true })
	if (isIosDevice()) return synced
	try {
		const published = await republishWidgetDesktop()
		try {
			await saveWidgetPageDesktop()
		} catch (e) {}
		if (published && published.ok !== false) return published
	} catch (e) {}
	return synced
}

/**
 * 保存某一个尺寸的小组件：名称、边框、话题语录、刷新频率。
 * @param {{ shape?: string, name?: string, border?: boolean, refresh?: string, quotes?: string[], wallpaperUrl?: string }} slot
 */
export async function syncWidgetSlot(slot) {
	if (!hasHomepageWallpaper() && !slot?.wallpaperSet) return clearWidgetDesktop()
	const prev = readStyle()
	const key = shapeKey(slot?.shape)
	const quotes = quoteLines(slot?.quotes)
	const ids = slot?.displayTagIds || []
	const auth = quoteRequest(ids)
	const wallpaper = httpUrl(slot?.wallpaperUrl) || prev.wallpaper_url
	const localImage = localFilePath(slot?.localImage) || prev.local_image
	const hasPreview = quotes.length > 0 || String(slot?.name || '').trim()
	if (!wallpaper && !localImage && !hasPreview) return clearWidgetDesktop()
	const slots = { ...prev.slots }
	slots[key] = {
		name: String(slot?.name || '').trim(),
		border: !!slot?.border,
		show_buttons: !!slot?.show_buttons,
		refresh: String(slot?.refresh || 'off'),
		refresh_seconds: refreshSeconds(slot?.refresh),
		quotes,
		quote_url: auth.quote_url,
		display_tag_ids: ids.map((id) => String(id)),
	}
	return writeStyle({
		...prev,
		...auth,
		wallpaper_set: true,
		wallpaper_url: wallpaper,
		local_image: localImage,
		fallback_quotes: quotes.length ? quotes : prev.fallback_quotes,
		last_shape: key,
		slots,
		ios_previews: normalizePreviews(slot?.iosPreviews).length
			? normalizePreviews(slot.iosPreviews)
			: prev.ios_previews,
	})
}

/**
 * 把小组件中心里每一张预览交给桌面。
 * @param {Array<{ shape?: string, name?: string, quotes?: string[], refresh?: string }>} rows
 * @param {string} wallpaperUrl
 * @param {string} [localImage]
 */
export async function syncWidgetPreviews(rows, wallpaperUrl, localImage) {
	const remote = httpUrl(wallpaperUrl)
	const local = localFilePath(localImage)
	const ios_previews = normalizePreviews(rows)
	if ((!remote && !local) || !ios_previews.length) return { ok: false, skipped: true }
	const prev = readStyle()
	return writeStyle({
		...prev,
		wallpaper_set: true,
		wallpaper_url: remote,
		local_image: local || prev.local_image,
		ios_previews,
	})
}
