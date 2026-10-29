/**
 * CMS / 包内英文快照文案：非英语言下若仍是英文目录文案，则回落到当前 locale 的 i18n。
 * 后端已按语言返回时（与英文目录不同）则原样展示。
 */
import i18n, { getLocale, t, interpolateMessage } from '@/i18n/index.js'
import { clearPageCache } from '@/utils/pageCache.js'
import {
	APP_CONFIG_KEY,
	WELCOME_CACHE_KEY,
	ONBOARDING_Q_KEY,
	VIP_PLANS_KEY,
	TOPICS_PAGE1_KEY,
	interstitialCacheKey,
} from '@/utils/wallpaperCache.js'
import bundledInterstitials from '@/static/bootstrap/interstitials.json'

function enMessage(key) {
	try {
		return String(i18n.global.t(key, {}, { locale: 'en' }) || '')
	} catch (e) {
		return ''
	}
}

/** 基本可视为「未翻译英文」：仅 ASCII 且含单词 */
function looksEnglishOnly(s) {
	const t0 = String(s || '').trim()
	if (!t0) return false
	return /^[\x00-\x7F]*$/.test(t0) && /[A-Za-z]{3,}/.test(t0)
}

/**
 * @param {string} cmsValue 运营/接口原文
 * @param {string} i18nKey 本地 i18n key
 * @param {Record<string, any>} [params] named 插值（如 {brand}/{name}）
 * @returns {string}
 */
export function cmsText(cmsValue, i18nKey, params) {
	const locale = getLocale() || 'en'
	const named = params && typeof params === 'object' && !Array.isArray(params) ? params : {}
	const local = String(t(i18nKey, named) || '')
	const raw = String(cmsValue || '').trim()
	if (!raw) return local
	const shown = interpolateMessage(raw, named)
	if (locale === 'en') return shown
	const en = enMessage(i18nKey)
	if (en && raw === en) return local
	// 中/日/韩等：接口仍是英文、本地已有译文 → 用译文
	if (local && looksEnglishOnly(raw) && !looksEnglishOnly(local)) return local
	return shown
}

/**
 * CMS 目录名（主题名 / 分类）：非英文 UI 且接口仍是英文时，
 * 若与某条英文 i18n 文案完全一致，则换成当前语言译文。
 */
export function cmsLabel(raw) {
	const locale = getLocale() || 'en'
	const text = String(raw || '').trim()
	if (!text) return ''
	if (locale === 'en' || !looksEnglishOnly(text)) return text
	let enMsgs = {}
	try {
		enMsgs = i18n.global.getLocaleMessage('en') || {}
	} catch (e) {
		enMsgs = {}
	}
	const hit = Object.keys(enMsgs).find((k) => String(enMsgs[k] || '').trim() === text)
	if (!hit) return text
	const local = String(t(hit) || '')
	if (local && local !== hit && local !== text) return local
	return text
}

/** 切换语言后清掉会带文案的公开缓存，强制按新 Accept-Language / language 重拉 */
export function clearLocaleSensitiveCaches() {
	clearPageCache(APP_CONFIG_KEY)
	clearPageCache(WELCOME_CACHE_KEY)
	clearPageCache(ONBOARDING_Q_KEY)
	clearPageCache(VIP_PLANS_KEY)
	clearPageCache(TOPICS_PAGE1_KEY)
	clearPageCache('topics_followed_v1')
	const map = bundledInterstitials && typeof bundledInterstitials === 'object'
		? bundledInterstitials
		: {}
	Object.keys(map).forEach((kind) => {
		clearPageCache(interstitialCacheKey(kind))
	})
}
