/**
 * AI 对话 API：快捷开场、历史、发送消息、删除消息。
 * 发送会扣免费额度或 VIP 日额度；命中安全词返回拒答 + 热线。
 */
import { postRequest, getRequest } from '@/utils/http.js'

/** 拉取 AI 聊天开场快捷提示词 */
export function apiAiQuickPrompts() {
	return getRequest('/ai/quick-prompts/')
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

/** 发送一条用户消息并获取 AI 回复（扣额度；可能安全拒答） */
export function apiAiChat(content) {
	return postRequest('/ai/chat/', { content }, { showLoading: true })
}

/** 删除一条历史消息 */
export function apiAiDeleteMessage(id) {
	return postRequest('/ai/delete-message/', { id })
}
