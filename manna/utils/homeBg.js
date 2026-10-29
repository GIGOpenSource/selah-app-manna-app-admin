/**
 * 首页日夜间背景池：本机本地时钟分池，每次冷启纯随机一张。
 * 同一次 JS 运行期内（切 Tab 再回首页）不重抽。
 * 早晚切点见 dayPeriod.js（06:00–18:00 为早）。
 */
import { isDaytime, periodKind } from './dayPeriod.js'
export { isDaytime, periodKind }
const MORNING = [
	'MorningPrayer-1.png',
	'MorningPrayer-10.png',
	'MorningPrayer-11.png',
	'MorningPrayer-12.png',
	'MorningPrayer-13.png',
	'MorningPrayer-14.png',
	'MorningPrayer-15.png',
	'MorningPrayer-16.png',
	'MorningPrayer-17.png',
	'MorningPrayer-18.png',
	'MorningPrayer-19.png',
	'MorningPrayer-2.png',
	'MorningPrayer-20.png',
	'MorningPrayer-21.png',
	'MorningPrayer-22.png',
	'MorningPrayer-23.png',
	'MorningPrayer-24.png',
	'MorningPrayer-25.png',
	'MorningPrayer-26.png',
	'MorningPrayer-27.png',
	'MorningPrayer-28.png',
	'MorningPrayer-29.png',
	'MorningPrayer-3.png',
	'MorningPrayer-30.png',
	'MorningPrayer-31.png',
	'MorningPrayer-32.png',
	'MorningPrayer-33.png',
	'MorningPrayer-34.png',
	'MorningPrayer-35.png',
	'MorningPrayer-4.png',
	'MorningPrayer-5.png',
	'MorningPrayer-6.png',
	'MorningPrayer-7.png',
	'MorningPrayer-8.png',
	'MorningPrayer-9.png',
	'MorningPrayer.png'
]
const NIGHT = [
	'NightPrayer-1.png',
	'NightPrayer-10.png',
	'NightPrayer-11.png',
	'NightPrayer-12.png',
	'NightPrayer-13.png',
	'NightPrayer-14.png',
	'NightPrayer-15.png',
	'NightPrayer-16.png',
	'NightPrayer-17.png',
	'NightPrayer-18.png',
	'NightPrayer-19.png',
	'NightPrayer-2.png',
	'NightPrayer-20.png',
	'NightPrayer-21.png',
	'NightPrayer-22.png',
	'NightPrayer-23.png',
	'NightPrayer-24.png',
	'NightPrayer-25.png',
	'NightPrayer-26.png',
	'NightPrayer-27.png',
	'NightPrayer-28.png',
	'NightPrayer-3.png',
	'NightPrayer-30.png',
	'NightPrayer-31.png',
	'NightPrayer-32.png',
	'NightPrayer-33.png',
	'NightPrayer-34.png',
	'NightPrayer-35.png',
	'NightPrayer-4.png',
	'NightPrayer-5.png',
	'NightPrayer-6.png',
	'NightPrayer-7.png',
	'NightPrayer-8.png',
	'NightPrayer-9.png',
	'NightPrayer.png'
]
const PREFIX = '/static/ui/home/bgs/'
const FALLBACK = '/static/ui/home/bg-279-364.png'

/** Text-free photos for prayer / covers / share. Do not reuse the home verse-card pool. */
const SCENE_MORNING = [
	'/static/ui/prayer/bg-morning.png',
	'/static/ui/share/bg-field.png',
	'/static/ui/share/bg-path.png',
	'/static/ui/share/bg-beach.png',
]
const SCENE_NIGHT = [
	'/static/ui/prayer/bg-night.png',
	'/static/ui/share/bg-heart.png',
	'/static/ui/share/bg-embrace.png',
	'/static/ui/bible/listen/bg-listen.png',
	'/static/ui/home/bg-279-364.png',
]

/** Local folder pick; CMS overlay must not overwrite this. */
let localPicked = null
/** Currently shown src (CMS URL when configured). */
let sessionPicked = null

function pickFromLocalFolder(force = false) {
	const day = isDaytime()
	const folder = day ? 'morning' : 'night'
	if (localPicked && !force && localPicked.pool === folder) return localPicked
	const pool = day ? MORNING : NIGHT
	let name = ''
	if (pool.length) {
		name = pool[Math.floor(Math.random() * pool.length)]
	}
	localPicked = {
		src: name ? `${PREFIX}${folder}/${name}` : FALLBACK,
		pool: folder,
		name: name || 'fallback',
		daytime: day,
	}
	return localPicked
}

/** Random file from `static/ui/home/bgs/{morning|night}/`. */
export function getHomeBg(force = false) {
	return pickFromLocalFolder(force)
}

export function peekHomeBg() {
	return sessionPicked || localPicked
}

export function homeBgSrc() {
	return (sessionPicked || getHomeBg()).src
}

/** Drop CMS overlay and return the local folder pick. */
export function clearSessionBg() {
	sessionPicked = null
	return getHomeBg()
}

/** Pick CMS day/night URL by local clock (6:00–18:00 day). Empty if both missing. */
export function resolveTimedBg({ dayUrl, nightUrl } = {}) {
	const day = decodeAssetPath(dayUrl)
	const night = decodeAssetPath(nightUrl)
	if (isDaytime()) return day || night || ''
	return night || day || ''
}

/** Loop-decode query/storage paths (`%252F` → `/`). */
export function decodeAssetPath(raw) {
	let s = String(raw || '').trim()
	for (let i = 0; i < 4; i++) {
		if (!s.includes('%')) break
		try {
			const next = decodeURIComponent(s)
			if (next === s) break
			s = next
		} catch (e) {
			break
		}
	}
	return s
}

/** Home verse-card art has baked-in copy. Other surfaces must not use it. */
export function isHomePoolBg(src) {
	const s = String(src || '').toLowerCase()
	return s.includes('/static/ui/home/bgs/') || s.includes('morningprayer') || s.includes('nightprayer')
}

/** Infer morning/night from a local or COS asset path. Empty if unknown. */
export function bgKindOf(src) {
	const s = String(src || '').toLowerCase()
	if (s.includes('/night/') || s.includes('nightprayer') || s.includes('bg-night')) return 'night'
	if (s.includes('/morning/') || s.includes('morningprayer') || s.includes('bg-morning')) return 'morning'
	return ''
}

/**
 * Random image from the morning/night pool. Does not overwrite the home-session pick.
 */
export function setSessionBg(src, pool) {
	if (!src) return clearSessionBg()
	const folder = pool || bgKindOf(src) || (isDaytime() ? 'morning' : 'night')
	sessionPicked = {
		src,
		pool: folder,
		name: 'cms',
		daytime: folder !== 'night',
	}
	return sessionPicked
}

/**
 * Random text-free scene photo for the morning/night slot.
 * Does not overwrite the home-session pick (those images have baked-in verse text).
 */
export function pickBgForKind(kind) {
	const night = kind === 'night'
	const pool = night ? SCENE_NIGHT : SCENE_MORNING
	if (!pool.length) {
		return night ? '/static/ui/prayer/bg-night.png' : '/static/ui/prayer/bg-morning.png'
	}
	return pool[Math.floor(Math.random() * pool.length)]
}
