/**
 * 共用内容域（冷启 / 配置 / 壁纸）— Manna 仅用到子集。
 */
import { getRequest, postRequest } from '@/utils/http.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'

export function apiAppConfig() {
	return getRequest('/content/app-config/', {}, { showLoading: false })
}

export function apiWelcome(params = {}) {
	const language = params.language || getCurrentLanguage()
	return getRequest('/content/welcome/', { ...params, language }, { showLoading: false })
}

export function apiInterstitial(kind, params = {}) {
	const language = params.language || getCurrentLanguage()
	return getRequest(
		'/content/interstitial/',
		{ kind, ...params, language },
		{ showLoading: false },
	)
}

export function apiOnboardingQuestions(params = {}, other = {}) {
	return getRequest('/content/onboarding/questions/', params || {}, other)
}

export function apiWallpapers(params = {}) {
	return getRequest('/content/wallpapers/', params || {}, { showLoading: false })
}

export function apiOnboardingComplete(params) {
	return postRequest('/content/onboarding/complete/', params)
}

/** Help 热线（Legal Help）；后端 /content/hotlines/ */
export function apiHotlines(params = {}) {
	return getRequest('/content/hotlines/', params || {}, { showLoading: false })
}
