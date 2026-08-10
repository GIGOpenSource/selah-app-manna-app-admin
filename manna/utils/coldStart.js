/**
 * Manna 冷启 / 登录后路由（对齐 Selah 主路径，暂跳过问卷/夹层页）。
 * Welcome → Login → Home
 *
 * 夹层预留：页面已建 `/pagesA/interstitial/interstitial`。
 * - VIP 入口（goVip）：当 app-config `trial_intro_enabled` 且用户未看过 `trial_intro` 时，
 *   先夹层再进 `/pagesA/vip/vip`（见 utils/vip.js）。
 * - 冷启若日后要对齐 Selah，可在 routeAfterAuth 里 resolveInterstitialScreen('personalize_intro')
 *   + hasSeenInterstitial，再 reLaunch 到 interstitial?kind=…&next=…；当前仍直达 Home。
 */
import { resolveWelcomeScreen } from '@/utils/bootstrap.js'
import { WELCOME_SEEN_KEY } from '@/utils/storageKeys.js'

export { WELCOME_SEEN_KEY }

/**
 * 冷启静默登录后：未看 Welcome → Welcome；否则进 Home。
 */
export async function routeAfterLogin(user, opts = {}) {
	const forceWelcome = !!opts.forceWelcome

	try {
		const w = await resolveWelcomeScreen()
		if (w && w.title) {
			const ver = Number(w.version || 1)
			const seen = Number(uni.getStorageSync(WELCOME_SEEN_KEY) || 0)
			if (forceWelcome || ver > seen) {
				uni.reLaunch({ url: '/pagesA/welcome/welcome' })
				return
			}
		} else if (forceWelcome) {
			uni.reLaunch({ url: '/pagesA/welcome/welcome' })
			return
		}
	} catch (e) {
		console.warn('welcome gate skipped', e)
		if (forceWelcome) {
			uni.reLaunch({ url: '/pagesA/welcome/welcome' })
			return
		}
	}

	await routeAfterAuth(user, { isNew: false })
}

/**
 * 登录页选完方式后进入 Home（Manna 问卷/冷启夹层后续再接）。
 * trial_intro 由 goVip 门控，不在冷启主路径强制弹出。
 */
export async function routeAfterAuth(_user, _opts = {}) {
	uni.reLaunch({ url: '/pages/home/home' })
}
