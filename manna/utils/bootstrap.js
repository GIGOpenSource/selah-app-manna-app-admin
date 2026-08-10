/**
 * Manna 包内公开配置快照：首次无 pageCache 时灌入，再后台静默拉网比对 revision。
 *
 * 本文件仅服务 `mobile-manna`（pageCache 前缀 manna_page_cache:）。
 * 勿与 Selah `frontend/mobile/utils/bootstrap.js` 混用或互相覆盖快照目录。
 *
 * 适合随包：app-config（含 login_title/subtitle）/ Welcome / Onboarding 题（预留）/
 *           教育夹层（VIP trial_intro 等）。
 * 不随包：Bible / Quiz / Devotion / Prayer / Me 业务数据、余额账本、VIP 权益状态。
 *
 * 快照来源：`static/bootstrap/*.json`
 * 发版导出：backend/scripts/export_manna_bootstrap.py（--preset manna）
 */
import bundledAppConfig from '@/static/bootstrap/app-config.json'
import bundledWelcome from '@/static/bootstrap/welcome.json'
import bundledOnboarding from '@/static/bootstrap/onboarding-questions.json'
import bundledInterstitials from '@/static/bootstrap/interstitials.json'
import { apiAppConfig, apiWelcome, apiInterstitial, apiOnboardingQuestions } from '@/api/content.js'
import { readPageCache, writePageCache } from '@/utils/pageCache.js'
import { getToken } from '@/utils/storageKeys.js'
import {
	APP_CONFIG_KEY,
	WELCOME_CACHE_KEY,
	ONBOARDING_Q_KEY,
	interstitialCacheKey,
} from '@/utils/wallpaperCache.js'

export { interstitialCacheKey }

/** 兼容旧缓存（纯数组）与新结构 `{ revision, questions }` */
export function unwrapOnboardingCache(data) {
	if (Array.isArray(data)) {
		return { revision: '', questions: data }
	}
	if (data && typeof data === 'object') {
		const questions = Array.isArray(data.questions) ? data.questions : []
		return { revision: data.revision || '', questions }
	}
	return { revision: '', questions: [] }
}

export function appConfigRevision(data) {
	return data && data.revision != null ? data.revision : ''
}

export function welcomeRevision(data) {
	return data && data.version != null ? Number(data.version) : ''
}

export function onboardingRevision(data) {
	return unwrapOnboardingCache(data).revision || ''
}

export function interstitialRevision(data) {
	return data && data.version != null ? Number(data.version) : ''
}

/**
 * 首次启动：本地无对应 pageCache 时写入包内快照（同步，不触网）。
 * @returns {{ seeded: string[] }}
 */
export function hydrateBootstrapCaches() {
	const seeded = []
	if (readPageCache(APP_CONFIG_KEY) == null && bundledAppConfig && typeof bundledAppConfig === 'object') {
		writePageCache(APP_CONFIG_KEY, bundledAppConfig)
		seeded.push(APP_CONFIG_KEY)
	}
	if (
		readPageCache(WELCOME_CACHE_KEY) == null
		&& bundledWelcome
		&& (bundledWelcome.title || bundledWelcome.subtitle)
	) {
		writePageCache(WELCOME_CACHE_KEY, bundledWelcome)
		seeded.push(WELCOME_CACHE_KEY)
	}
	if (readPageCache(ONBOARDING_Q_KEY) == null) {
		const wrapped = unwrapOnboardingCache(bundledOnboarding)
		if (wrapped.questions.length) {
			writePageCache(ONBOARDING_Q_KEY, {
				revision: wrapped.revision || '',
				questions: wrapped.questions,
			})
			seeded.push(ONBOARDING_Q_KEY)
		}
	}
	const map = bundledInterstitials && typeof bundledInterstitials === 'object'
		? bundledInterstitials
		: {}
	Object.keys(map).forEach((kind) => {
		const key = interstitialCacheKey(kind)
		if (readPageCache(key) == null && map[kind]) {
			writePageCache(key, map[kind])
			seeded.push(key)
		}
	})
	return { seeded }
}

function writeIfChanged(key, fresh, getRevision) {
	if (fresh == null) return false
	const cached = readPageCache(key)
	if (cached != null && getRevision) {
		const a = getRevision(cached)
		const b = getRevision(fresh)
		if (a != null && b != null && a !== '' && b !== '' && String(a) === String(b)) {
			return false
		}
	}
	writePageCache(key, fresh)
	return true
}

/**
 * 后台静默刷新公开配置（不挡冷启）。revision 一致则跳过写缓存。
 * 冷启主路径暂不走问卷；已登录时仍拉 onboarding 以便日后接线。
 * @returns {Promise<{ updated: string[] }>}
 */
export async function refreshBootstrapCaches() {
	const updated = []
	try {
		const res = await apiAppConfig()
		const fresh = res?.results
		if (fresh && writeIfChanged(APP_CONFIG_KEY, fresh, appConfigRevision)) {
			updated.push(APP_CONFIG_KEY)
		}
	} catch (e) {}

	try {
		const res = await apiWelcome()
		const fresh = res?.results
		if (fresh && (fresh.title || fresh.subtitle)
			&& writeIfChanged(WELCOME_CACHE_KEY, fresh, welcomeRevision)) {
			updated.push(WELCOME_CACHE_KEY)
		}
	} catch (e) {}

	try {
		if (getToken()) {
			const res = await apiOnboardingQuestions({}, { skipAuthRetry: true, showLoading: false })
			const questions = res?.results
			if (Array.isArray(questions) && questions.length) {
				const fresh = {
					revision: (res.meta && res.meta.revision) || '',
					questions,
				}
				if (writeIfChanged(ONBOARDING_Q_KEY, fresh, onboardingRevision)) {
					updated.push(ONBOARDING_Q_KEY)
				}
			}
		}
	} catch (e) {
		// 未登录 / token 失效：跳过；不触发强制欢迎页
	}

	const kinds = Object.keys(
		(bundledInterstitials && typeof bundledInterstitials === 'object')
			? bundledInterstitials
			: {},
	)
	await Promise.all(kinds.map(async (kind) => {
		try {
			const res = await apiInterstitial(kind)
			const fresh = res?.results
			const key = interstitialCacheKey(kind)
			if (fresh && (fresh.title || fresh.subtitle || fresh.image_url)
				&& writeIfChanged(key, fresh, interstitialRevision)) {
				updated.push(key)
			}
		} catch (e) {}
	}))

	return { updated }
}

/**
 * 解析 Welcome：优先 pageCache（含包内灌入），必要时短等网络；同时触发静默刷新。
 */
export async function resolveWelcomeScreen() {
	const cached = readPageCache(WELCOME_CACHE_KEY)
	apiWelcome().then((res) => {
		const fresh = res?.results
		if (fresh && (fresh.title || fresh.subtitle)) {
			writeIfChanged(WELCOME_CACHE_KEY, fresh, welcomeRevision)
		}
	}).catch(() => {})
	if (cached && (cached.title || cached.subtitle)) return cached
	try {
		const res = await apiWelcome()
		const fresh = res?.results
		if (fresh && (fresh.title || fresh.subtitle)) {
			writePageCache(WELCOME_CACHE_KEY, fresh)
			return fresh
		}
	} catch (e) {}
	return cached || null
}

/**
 * 解析教育夹层：缓存优先，后台静默比对 version。
 * Manna：冷启跳过 personalize；VIP 入口可走 trial_intro（见 utils/vip.js）。
 */
export async function resolveInterstitialScreen(kind) {
	const key = interstitialCacheKey(kind)
	const cached = readPageCache(key)
	apiInterstitial(kind).then((res) => {
		const fresh = res?.results
		if (fresh && (fresh.title || fresh.subtitle || fresh.image_url)) {
			writeIfChanged(key, fresh, interstitialRevision)
		}
	}).catch(() => {})
	if (cached && (cached.title || cached.subtitle || cached.image_url)) return cached
	try {
		const res = await apiInterstitial(kind)
		const fresh = res?.results
		if (fresh && (fresh.title || fresh.subtitle || fresh.image_url)) {
			writePageCache(key, fresh)
			return fresh
		}
	} catch (e) {}
	return cached || null
}
