/**
 * AI 对话 API：快捷开场、历史、发送消息、删除消息。
 * 发送会扣免费额度或 VIP 日额度；命中安全词返回拒答 + 热线。
 */
import { postRequest, getRequest } from '@/utils/http.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'

/** 拉取 AI 聊天开场快捷提示词 */
export function apiAiQuickPrompts(params = {}) {
	const language = params.language || getCurrentLanguage() || 'en'
	return getRequest('/ai/quick-prompts/', { ...params, language })
}

/**
 * 按日拉取聊天历史；不传 date 则默认当天。
 * @param {string} [date] YYYY-MM-DD
 */
export function apiAiHistory(date) {
	const params = {}
	if (date) params.date = date
	return getRequest('/ai/history/', params)
}

/** 发送一条用户消息并获取 AI 回复（扣额度；可能安全拒答；成功时带 suggested_replies） */
export function apiAiChat(content, extra = {}) {
	const payload = { content, retry: !!extra.retry }
	if (extra.kind) payload.kind = extra.kind
	if (extra.content_id) payload.content_id = extra.content_id
	if (extra.source_ref) payload.source_ref = extra.source_ref
	return postRequest(
		'/ai/chat/',
		payload,
		{ showLoading: false, silentBizCodes: [402, 500] },
	)
}

/** 删除一条历史消息 */
export function apiAiDeleteMessage(id) {
	return postRequest('/ai/delete-message/', { id })
}
