/**
 * 冷启 / 登录后路由。
 *
 * 主路径（显式）：Welcome → Login → 新用户 Onboarding / 老用户 Home
 * 静默回访：已看过 Welcome 则按 onboarding 状态进问卷或首页（不强制 Login）
 *
 * Welcome / 夹层优先读 pageCache（含包内快照），避免冷启堵在首屏等网。
 */
import { hasSeenInterstitial } from '@/utils/vip.js'
import { resolveWelcomeScreen, resolveInterstitialScreen } from '@/utils/bootstrap.js'

export const WELCOME_SEEN_KEY = 'welcome_seen_version'

/**
 * 冷启静默登录后：未看 Welcome → Welcome；否则按画像完成度进问卷/首页。
 * @param {object} user
 * @param {{ forceWelcome?: boolean }} [opts]
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

	await routeAfterAuth(user, { isNew: false, allowInterstitial: true })
}

/**
 * 登录页选完方式后：新用户 → 问卷；非新用户 → 首页。
 * @param {object} user
 * @param {{ isNew?: boolean, allowInterstitial?: boolean }} [opts]
 */
export async function routeAfterAuth(user, opts = {}) {
	const isNew = !!opts.isNew
	const allowInterstitial = !!opts.allowInterstitial

	if (isNew) {
		uni.reLaunch({ url: '/pagesA/onboarding/onboarding' })
		return
	}

	if (allowInterstitial) {
		try {
			const row = await resolveInterstitialScreen('personalize_intro')
			if (row && (row.title || row.image_url)) {
				const ver = Number(row.version || 1)
				if (!hasSeenInterstitial('personalize_intro', ver)) {
					const next = encodeURIComponent(
						(!user?.onboarding_completed && !user?.onboarding_skipped)
							? '/pagesA/onboarding/onboarding'
							: '/pages/home/home',
					)
					uni.reLaunch({
						url: `/pagesA/interstitial/interstitial?kind=personalize_intro&next=${next}`,
					})
					return
				}
			}
		} catch (e) {
			console.warn('personalize_intro gate skipped', e)
		}
	}

	if (!user?.onboarding_completed && !user?.onboarding_skipped) {
		uni.reLaunch({ url: '/pagesA/onboarding/onboarding' })
		return
	}

	uni.reLaunch({ url: '/pages/home/home' })
}
