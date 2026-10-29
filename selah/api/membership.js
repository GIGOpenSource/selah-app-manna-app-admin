/**
 * 会员/IAP API：套餐列表、验单、恢复购买。
 * 验单按 platform + store_product_id 匹配后台 SKU。
 */
import { postRequest, getRequest } from '@/utils/http.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'

function requestPlatform() {
	try {
		const sys = uni.getSystemInfoSync?.() || {}
		return /android/i.test(sys.platform || sys.osName || '') ? 'android' : 'ios'
	} catch (e) {
		return 'ios'
	}
}

/** 拉取当前平台可用 VIP 套餐（月/年 + 价格文案 + 试用天数） */
export function apiVipPlans(params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	const platform = params.platform || requestPlatform()
	return getRequest('/membership/plans/', { ...params, language, platform })
}

/** 开通免费试用：未试用过且非会员时按 trial_days 开通一次，不走商店 */
export function apiVipStartTrial(params = {}) {
	return postRequest('/membership/trial/', params, { showLoading: true })
}

/** 提交商店收据验单并开通/续期 VIP */
export function apiVipVerify(params) {
	return postRequest('/membership/verify/', params, { showLoading: true })
}

/** 恢复购买（重新校验历史收据） */
export function apiVipRestore(params) {
	return postRequest('/membership/restore/', params, { showLoading: true })
}
