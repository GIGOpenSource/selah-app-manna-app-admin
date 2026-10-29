/**
 * 移动端 HTTP 封装（核心契约，勿轻易改动）：
 * - 鉴权：请求头 `token`（非 Authorization），来自 uni.storage
 * - 语言：`Accept-Language` ← selah_currentLanguage
 * - Loading：默认**不**弹全局 Loading；慢操作在 api 层显式 `{ showLoading: true }`
 * - 若开启：延迟 loadingTime ms 后才 showLoading，complete 时 hideLoading
 * - 业务码：HTTP 200/201 且 data.code 200/201 → resolve
 * - 401/403：仅当本次请求曾携带 token（登录态确实失效）才清会话并踢 Welcome；
 *   空凭证抢跑（尚未登录 / token 已被清）只 reject，避免误杀有效会话
 * - 导出：request / get|post|put|patch|deleteRequest / getImg
 */
import {
	host,
	APP_KEY,
} from '@/config/config.js'
import { t } from '@/i18n/index.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
// 401/403 处理中标志，防止并发重复 toast / reLaunch
var expired = false;
let loadingShown = false;
/** 进行中、需要 Loading 的请求数（并发安全） */
let loadingReqCount = 0;
// stopRepeat 时按 url 防抖的简易记录（仅标记当前锁住的 url）
let requestRecord = {

}

/** 每次请求动态读 token，避免登录后仍用旧闭包值 */
function getToken() {
	return uni.getStorageSync('token') || '';
}

/** 请求头平台：APP 读系统；H5 跟手机 UA 走 ios/android，也可 debug_x_platform 覆盖 */
function requestPlatform() {
	// #ifdef APP-PLUS
	try {
		const p = uni.getSystemInfoSync().platform
		return p === 'ios' ? 'ios' : 'android'
	} catch (e) {
		return ''
	}
	// #endif
	// #ifndef APP-PLUS
	try {
		const debug = String(uni.getStorageSync('debug_x_platform') || '').toLowerCase()
		if (debug === 'ios' || debug === 'android') return debug
	} catch (e) {}
	try {
		const ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '').toLowerCase()
		if (/iphone|ipad|ipod/.test(ua)) return 'ios'
		if (/android/.test(ua)) return 'android'
	} catch (e) {}
	return ''
	// #endif
}

let httpConfig = {
	header: {
		'Content-Type': "application/json",
		'is-dev': 'true'
	},
	method: 'POST',
	// 默认关闭：Feed/点赞/曝光等高频接口不应挡全屏；慢操作在调用处开启
	showLoading: false,
	loadingText: 'Loading…',
	loadingTime: 800, // 开启后：超过该时间才展示，避免快请求闪一下
	timer: null, // 定时器
	loadingMask: false, // 展示loading的时候，是否给一个透明的蒙层，防止触摸穿透
	stopRepeat: false, // 是否阻止重复请求
	timeout: 1500000, // 请求超时时间
	errorOutput: true // 请求失败输出信息
}

/**
 * 底层请求生命周期：
 * 1) 合并 other 覆盖默认 httpConfig
 * 2) 注入 header.token + Accept-Language
 * 3) 可选 stopRepeat / 延迟 Loading
 * 4) uni.request → complete 里关 Loading、按状态码分支
 *
 * @param {string} url 相对路径（拼 host）
 * @param {object} params 请求体/查询参数
 * @param {object} [other]
 */
function request(url, params, other) {
	other = {
		...httpConfig,
		...other
	};
	// 每次请求时动态获取token，确保使用最新的token
	const token = getToken();
	const hadToken = !!token;
	// 浅拷贝 header，避免并发请求互相覆盖共享的 httpConfig.header
	other.header = {
		...(httpConfig.header || {}),
		...(other.header || {}),
	};
	// 注意：后端鉴权读 headers.token，不是 Authorization
	other.header['token'] = token;
	other.header['Accept-Language'] = getCurrentLanguage() || 'en'
	other.header['X-App-Key'] = APP_KEY
	const plat = requestPlatform()
	if (plat) other.header['X-Platform'] = plat
	return new Promise((resolve, reject) => {
		if (other.stopRepeat) {
			if (requestRecord.url === true) {
				reject();
				return;
			}
			requestRecord.url = true;
		}
		if (other.showLoading) {
			loadingReqCount += 1
			// 仅第一个需要 Loading 的请求负责延迟弹出
			if (loadingReqCount === 1 && !httpConfig.timer) {
				httpConfig.timer = setTimeout(() => {
					uni.showLoading({
						title: other.loadingText,
						mask: other.loadingMask
					});
					loadingShown = true;
					httpConfig.timer = null;
				}, other.loadingTime);
			}
		}
		uni.request({
			url: host + url,
			data: params,
			header: other.header,
			method: other.method,
			timeout: other.timeout,
			complete: data => {
				if (other.showLoading) {
					loadingReqCount = Math.max(0, loadingReqCount - 1)
					if (loadingReqCount === 0) {
						clearTimeout(httpConfig.timer);
						httpConfig.timer = null;
						if (loadingShown) {
							loadingShown = false;
							try {
								uni.hideLoading();
							} catch (e) {
								// 忽略 hideLoading 错误
							}
						}
					}
				}
	
				const respData = data.data || {};
				// HTTP 401 或业务码 401：会话失效
				const isUnauthorized =
					data.statusCode === 401 ||
					respData.code === 401 ||
					respData.status === 401;

				if (isUnauthorized) {
					// 登录链路自身的 401：只 reject，交给 ensureLogin 清 token 后 device-login
					if (other.skipAuthRetry || other._authRetry) {
						reject(respData);
						return;
					}
					// 未带 token 的 401：抢跑/未登录，不当成「登录态掉了」
					if (!hadToken) {
						reject(respData);
						return;
					}
					if (!expired) {
						expired = true;
						if (httpConfig.errorOutput) {
							uni.showToast({
								title: t('session_expired'),
								icon: 'none'
							});
						}
						// 动态 import，避免与 session → auth → http 循环依赖
						import('@/utils/session.js').then(({ forceSessionExpiredToWelcome }) => {
							forceSessionExpiredToWelcome();
						}).catch(() => {
							uni.removeStorageSync('token');
							uni.removeStorageSync('userInfo');
							uni.setStorageSync('force_login_page', '1');
							uni.reLaunch({ url: '/pagesA/welcome/welcome' });
						});
					}
					reject(respData);
					return;
				}
                 // response handled below
				if (data.statusCode == 200 || data.statusCode == 201) {
					// 业务码 403：默认视为身份失效；VIP/权益门禁传 skipSessionExpire 由页面 goVip
					if (data.data.code == 403) {
						if (other.skipSessionExpire) {
							reject(data.data);
						} else if (hadToken && !expired) {
							expired = true;
							if (httpConfig.errorOutput) {
								uni.showToast({
									title: t('session_expired'),
									icon: 'none'
								})
							}
							import('@/utils/session.js').then(({ forceSessionExpiredToWelcome }) => {
								forceSessionExpiredToWelcome();
							}).catch(() => {
								uni.removeStorageSync('token');
								uni.removeStorageSync('userInfo');
								uni.setStorageSync('force_login_page', '1');
								uni.reLaunch({ url: '/pagesA/welcome/welcome' });
							});
							reject(data.data)
						} else {
							reject(data.data)
						}
					} else {
						expired = false;
						// 业务成功码 200/201
						if (data.data.code == 200 || data.data.code == 201) resolve(data.data);
						else {
							// 其它业务错误：toast msg 后 reject（silentBizCodes 如 409 冲突由页面自处理）
							const silentCodes = other.silentBizCodes || [];
							if (httpConfig.errorOutput && !silentCodes.includes(data.data.code)) {
								uni.showToast({
									title: data.data.msg || data.data.message || t('request_failed'),
									icon: 'none'
								})
							}
							reject(data.data);
						}
					}
				} else {
					// 非 2xx / 无网（安卓缺 INTERNET 时 statusCode 常为 undefined）
					if (httpConfig.errorOutput) {
						const offline = !data.statusCode
						uni.showToast({
							title: offline
								? (t('network_error') || t('request_failed'))
								: t('request_failed'),
							icon: 'none'
						})
					}
					reject(data)
				}
				if (other.stopRepeat && requestRecord.url === true) {
					requestRecord.url = false;
				}
			}
		});
	})
}

/** GET 封装 */
function getRequest(url, params = {}, other = {}) {
	return request(url, params, {
		...other,
		method: 'GET'
	})
}

/** POST 封装 */
function postRequest(url, params = {}, other = {}) {
	return request(url, params, {
		...other,
		method: 'POST'
	})
}
/** PUT 封装 */
function putRequest(url, params = {}, other = {}) {
	return request(url, params, {
		...other,
		method: 'PUT'
	})
}
/** PATCH 封装（实现上仍走 PUT method，与历史契约一致） */
function patchRequest(url, params = {}, other = {}) {
	return request(url, params, {
		...other,
		method: 'PUT'
	})
}
/** DELETE 封装 */
function deleteRequest(url, params = {}, other = {}) {
	return request(url, params, {
		...other,
		method: 'DELETE'
	})
}
/** 静态图路径助手：/static/{name}.png */
function getImg(url) {
	return `/static/${url}.png`
	// return `/static/${url}.png`
}

export {
	request,
	getRequest,
	postRequest,
	putRequest,
	patchRequest,
	deleteRequest,
	getImg
}
