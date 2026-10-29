/**
 * 冷启 / 登录后路由。
 *
 * 无登录态：Welcome，由用户点 Continue 去登录页，不静默 device-login。
 * 已登录回访：直接进首页。
 * 显式登录：新用户 Onboarding，老用户 Home。
 */

export const WELCOME_SEEN_KEY = 'welcome_seen_version'

/**
 * 根跳转。非 Tab 优先 redirectTo（从 boot 进 Welcome 时比 reLaunch 更不易点死）。
 * Tab 页用 reLaunch。
 * @param {string} url
 * @param {{ defer?: boolean }} [opts]
 */
export function safeRelaunch(url, opts = {}) {
	const u = String(url || '').trim()
	if (!u) return
	const path = u.split('?')[0]
	const isTab = [
		'/pages/home/home',
		'/pages/ai/ai',
		'/pages/profile/profile',
	].includes(path)

	const go = () => {
		if (isTab) {
			uni.reLaunch({
				url: u,
				fail: () => setTimeout(() => uni.reLaunch({ url: u }), 150),
			})
			return
		}
		uni.redirectTo({
			url: u,
			fail: () => {
				uni.reLaunch({
					url: u,
					fail: () => setTimeout(() => uni.reLaunch({ url: u }), 150),
				})
			},
		})
	}
	if (opts.defer) {
		setTimeout(go, 120)
		return
	}
	go()
}

/**
 * 已登录冷启：进首页。无登录态由 boot 先送到 Welcome。
 * @param {object} user
 * @param {{ forceWelcome?: boolean }} [opts]
 */
export async function routeAfterLogin(user, opts = {}) {
	if (opts.forceWelcome) {
		safeRelaunch('/pagesA/welcome/welcome')
		return
	}
	safeRelaunch('/pages/home/home')
}

/**
 * @param {object} user
 * @param {{ isNew?: boolean, defer?: boolean }} [opts]
 */
export async function routeAfterAuth(user, opts = {}) {
	const isNew = !!opts.isNew
	const navOpts = opts.defer ? { defer: true } : {}

	if (isNew) {
		safeRelaunch('/pagesA/onboarding/onboarding', navOpts)
		return
	}

	if (!user?.onboarding_completed && !user?.onboarding_skipped) {
		safeRelaunch('/pagesA/onboarding/onboarding', navOpts)
		return
	}

	safeRelaunch('/pages/home/home', navOpts)
}
