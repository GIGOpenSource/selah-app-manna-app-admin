/**
 * 打开协议入口：优先 app-config 的 url_*；本机 /legal/* 回落或空 URL 时进端内页。
 * 外链若是本机 /legal/*，自动带 ?app_key=，避免浏览器直开偏中性/他牌。
 * 仅 navigateTo，失败用 redirectTo；禁止 reLaunch。
 * @param {'privacy'|'terms'|'subscription'|'help'} slug
 * @param {Record<string, any>} [cfgOverride] 可选已加载的 app-config
 */
import { readPageCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { apiAppConfig } from '@/api/content.js'
import { APP_KEY } from '@/config/config.js'

const SLUG_URL_KEY = {
	privacy: 'url_privacy',
	terms: 'url_terms',
	help: 'url_help',
	subscription: 'url_subscription',
}

/** 后端默认回落为本机 /legal/<slug>/；此时用端内稿 + Help 热线更合适 */
function isLocalLegalFallback(url) {
	const u = String(url || '').trim()
	if (!u) return true
	return /\/legal\/(privacy|terms|help|subscription|download)\/?(\?|#|$)/i.test(u)
}

function withAppKey(url) {
	const u = String(url || '').trim()
	if (!u || !APP_KEY) return u
	if (/[?&]app_key=/i.test(u)) return u
	const sep = u.includes('?') ? '&' : '?'
	return `${u}${sep}app_key=${encodeURIComponent(APP_KEY)}`
}

function openExternal(url) {
	if (!url) return
	const href = withAppKey(url)
	// #ifdef H5
	window.open(href, '_blank')
	// #endif
	// #ifdef APP-PLUS
	plus.runtime.openURL(href)
	// #endif
}

function openInApp(slug) {
	const s = encodeURIComponent(String(slug || 'privacy'))
	const url = `/pagesA/legal/legal?slug=${s}`
	uni.navigateTo({
		url,
		fail: () => uni.redirectTo({ url }),
	})
}

function resolveCfg(cfgOverride) {
	if (cfgOverride && typeof cfgOverride === 'object') return cfgOverride
	return readPageCache(APP_CONFIG_KEY) || {}
}

/**
 * @param {string} [slug='privacy']
 * @param {Record<string, any>} [cfgOverride]
 */
export function openLegalPage(slug = 'privacy', cfgOverride) {
	const key = SLUG_URL_KEY[slug] || SLUG_URL_KEY.privacy
	const cfg = resolveCfg(cfgOverride)
	const href = String((cfg && cfg[key]) || '').trim()

	if (href && !isLocalLegalFallback(href)) {
		openExternal(href)
		return
	}

	// 缓存未命中时异步补拉一次；仍优先端内（避免阻塞点按）
	if (!href) {
		apiAppConfig()
			.then((res) => {
				const fresh = (res && res.results) || {}
				const next = String(fresh[key] || '').trim()
				if (next && !isLocalLegalFallback(next)) openExternal(next)
			})
			.catch(() => {})
	}
	openInApp(slug)
}
