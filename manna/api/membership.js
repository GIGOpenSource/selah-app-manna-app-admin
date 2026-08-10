/**
 * 会员/IAP API：套餐列表、验单、恢复购买。
 * 验单按 platform + store_product_id 匹配后台 SKU。
 */
import { postRequest, getRequest } from '@/utils/http.js'

/** 拉取当前平台可用 VIP 套餐（月/年 + 价格文案 + 试用天数） */
export function apiVipPlans() {
	return getRequest('/membership/plans/')
}

/** 提交商店收据验单并开通/续期 VIP */
export function apiVipVerify(params) {
	return postRequest('/membership/verify/', params, { showLoading: true })
}

/** 恢复购买（重新校验历史收据） */
export function apiVipRestore(params) {
	return postRequest('/membership/restore/', params, { showLoading: true })
}
