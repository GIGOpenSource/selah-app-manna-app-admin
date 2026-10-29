/**
 * 认证相关 API：设备登录、当前用户、额度、OAuth 绑定与资料更新。
 */
import { postRequest, getRequest } from '@/utils/http.js'

/** 设备号登录，返回 token + user + is_new_user */
export function apiDeviceLogin(params, other = {}) {
	return postRequest('/auth/device-login/', params, other)
}

/** Google/Apple 登录并绑定本机 device_id（免登）。 */
export function apiOauthLogin(params, other = {}) {
	return postRequest('/auth/oauth-login/', params, { skipAuthRetry: true, ...other })
}

/** 拉取当前登录用户资料（可带 platform 供后端对齐端侧） */
export function apiAuthMe(params = {}, other = {}) {
	return getRequest('/auth/me/', params, { showLoading: false, ...other })
}

/** 查询 AI 免费额度 / VIP 日剩余额度 */
export function apiQuota() {
	return getRequest('/auth/quota/')
}

/** 已登录态绑定第三方 OAuth（设置页）；登录页请用 apiOauthLogin */
export function apiBindOauth(params, other = {}) {
	return postRequest('/auth/bind-oauth/', params, other)
}

/** 关闭「请绑定账号」引导提示 */
export function apiDismissBindPrompt() {
	return postRequest('/auth/dismiss-bind-prompt/', {})
}

/** 更新用户资料（昵称、兴趣、信仰、营销开关等） */
export function apiUpdateProfile(params) {
	return postRequest('/auth/update-profile/', params)
}

/** 登出并失效服务端会话（不清账号） */
export function apiLogout() {
	return postRequest('/auth/logout/', {})
}

/** 申请注销：进入 7 天冷静期，服务端踢全部会话 */
export function apiDeleteAccount(params = {}, other = {}) {
	return postRequest('/auth/delete-account/', params, { showLoading: true, ...other })
}

/** 冷静期内撤销注销 */
export function apiCancelDelete(params = {}, other = {}) {
	return postRequest('/auth/cancel-delete/', params, { showLoading: true, ...other })
}
