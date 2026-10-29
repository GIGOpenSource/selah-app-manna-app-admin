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

export function apiOnboardingSkip() {
	return postRequest('/content/onboarding/skip/', {})
}

/** Help 热线（Legal Help）；后端 /content/hotlines/ */
export function apiHotlines(params = {}) {
	const language = params.language || getCurrentLanguage()
	return getRequest('/content/hotlines/', { ...params, language }, { showLoading: false })
}

/** 不感兴趣（负反馈）；disliked=false 解除屏蔽 */
export function apiDislike(contentId, disliked = true) {
	return postRequest('/content/dislike/', { content_id: contentId, disliked })
}

/** 我的资产（点赞 / 收藏 / 屏蔽等） */
export function apiMyAssets(kind, folderId, params) {
	const query = { kind, ...(params || {}) }
	if (folderId) query.folder_id = folderId
	return getRequest('/content/my-assets/', query)
}
