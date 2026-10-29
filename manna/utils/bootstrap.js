/**
 * Manna 包内公开配置快照：首次无 pageCache 时灌入，再后台静默拉网比对 revision。
 *
 * 本文件仅服务 `mobile-manna`（pageCache 前缀 manna_page_cache:）。
 * 勿与 Selah `frontend/mobile/utils/bootstrap.js` 混用或互相覆盖快照目录。
 *
 * 适合随包：app-config（含 login_title/subtitle）/ Welcome / Onboarding 题 /
 *           教育夹层（VIP trial_intro 等）。冷启是否走问卷以线上题库为准。
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
import { readPageCache, writePageCache, clearPageCache } from '@/utils/pageCache.js'
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
	if (!data) return ''
	const v = data.version != null ? Number(data.version) : ''
	const img = String(data.image_url || '').trim()
	// version + 图 URL：运营只换图未抬 version 时也要刷新
	return `${v}|${img}`
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

function hasWelcomeCopy(data) {
	return !!(data && (data.title || data.subtitle || data.cta_text || data.image_url))
}

/** 接口 results 为空对象时视为未配置，避免写成脏缓存 */
function normalizeWelcomeResults(data) {
	if (!data || typeof data !== 'object') return null
	if (!hasWelcomeCopy(data)) return null
	return data
}

function hasInterstitialCopy(data) {
	return !!(data && (data.title || data.subtitle || data.image_url))
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
 * Welcome / 问卷 / 夹层：接口明确无内容时清缓存，避免包内快照把未配置的流程又灌回来。
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
		const fresh = normalizeWelcomeResults(res?.results)
		if (hasWelcomeCopy(fresh)) {
			if (writeIfChanged(WELCOME_CACHE_KEY, fresh, welcomeRevision)) {
				updated.push(WELCOME_CACHE_KEY)
			}
		} else {
			clearPageCache(WELCOME_CACHE_KEY)
		}
	} catch (e) {}

	try {
		if (getToken()) {
			const res = await apiOnboardingQuestions({}, { skipAuthRetry: true, showLoading: false })
			const questions = Array.isArray(res?.results) ? res.results : []
			const fresh = {
				revision: (res.meta && res.meta.revision) || '',
				questions,
			}
			if (writeIfChanged(ONBOARDING_Q_KEY, fresh, onboardingRevision)) {
				updated.push(ONBOARDING_Q_KEY)
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
			if (hasInterstitialCopy(fresh)) {
				if (writeIfChanged(key, fresh, interstitialRevision)) {
					updated.push(key)
				}
			} else {
				clearPageCache(key)
			}
		} catch (e) {}
	}))

	return { updated }
}

/**
 * 解析 Welcome：以后台为准。未配/已关则跳过；断网才回落缓存。
 */
export async function resolveWelcomeScreen() {
	try {
		const res = await apiWelcome()
		const fresh = normalizeWelcomeResults(res?.results)
		if (hasWelcomeCopy(fresh)) {
			writeIfChanged(WELCOME_CACHE_KEY, fresh, welcomeRevision)
			return fresh
		}
		clearPageCache(WELCOME_CACHE_KEY)
		return null
	} catch (e) {
		const cached = readPageCache(WELCOME_CACHE_KEY)
		return hasWelcomeCopy(cached) ? cached : null
	}
}

/**
 * 解析教育夹层：以后台为准。未配则跳过；断网才回落缓存。
 * VIP 入口可走 trial_intro（见 utils/vip.js）。
 */
export async function resolveInterstitialScreen(kind) {
	const key = interstitialCacheKey(kind)
	try {
		const res = await apiInterstitial(kind)
		const fresh = res?.results
		if (hasInterstitialCopy(fresh)) {
			writeIfChanged(key, fresh, interstitialRevision)
			return fresh
		}
		clearPageCache(key)
		return null
	} catch (e) {
		const cached = readPageCache(key)
		return hasInterstitialCopy(cached) ? cached : null
	}
}

/**
 * 解析问卷题：以后台为准。无启用题则空数组（跳过问卷）；断网才回落缓存。
 * @returns {Promise<object[]>}
 */
export async function resolveOnboardingQuestions() {
	try {
		if (!getToken()) return []
		const res = await apiOnboardingQuestions({}, { skipAuthRetry: true, showLoading: false })
		const questions = Array.isArray(res?.results) ? res.results : []
		writePageCache(ONBOARDING_Q_KEY, {
			revision: (res.meta && res.meta.revision) || '',
			questions,
		})
		return questions
	} catch (e) {
		return unwrapOnboardingCache(readPageCache(ONBOARDING_Q_KEY)).questions
	}
}
