/**
 * Manna 冷启 / 登录后路由。
 * 未登录：Welcome → Login。
 * 当次登录：有问卷且未完成/未跳过 →（可选夹层）→ 问卷 → Home。
 * 已登录再次冷启：直接 Home。新手引导不能拖到下次启动再补弹。
 *
 * VIP `trial_intro` 仍由 goVip 门控，不在冷启主路径强制弹出。
 */
import { resolveWelcomeScreen, resolveInterstitialScreen, resolveOnboardingQuestions } from '@/utils/bootstrap.js'
import { hasSeenInterstitial } from '@/utils/vip.js'
import { WELCOME_SEEN_KEY } from '@/utils/storageKeys.js'
import { TAB_URLS } from '@/utils/nav.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'

export { WELCOME_SEEN_KEY }

/** 用户主动点底栏的时间戳；冷启异步落地时用于避免强行拉回首页 */
let userTabNavAt = 0

export function markUserTabNavigation() {
	userTabNavAt = Date.now()
}

function userRecentlyChoseTab(ms = 12000) {
	return userTabNavAt > 0 && Date.now() - userTabNavAt < ms
}

function normalizeRoute(url) {
	const raw = String(url || '').split('?')[0].trim()
	if (!raw) return ''
	return raw.startsWith('/') ? raw : `/${raw}`
}

function currentRoute() {
	try {
		const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
		const cur = pages[pages.length - 1]
		if (!cur?.route) return ''
		return normalizeRoute(cur.route)
	} catch (e) {
		return ''
	}
}

/**
 * 冷启落地：已在目标页则不再 reLaunch（否则会整页重挂 → 首页闪一下）。
 * Tab 页用 switchTab，其它用 reLaunch。
 * 异步登录完成前用户已点进其它 Tab：不要再强制拉回首页。
 */
export function safeRelaunch(url) {
	go(url)
}

function go(url) {
	const target = normalizeRoute(url)
	if (!target) return Promise.resolve(false)
	const cur = currentRoute()
	if (cur === target) return Promise.resolve(true)
	// 冷启默认去 Home，但用户已切到其它底栏（或刚点过底栏）时尊重用户选择
	if (target === '/pages/home/home') {
		if (userRecentlyChoseTab()) return Promise.resolve(false)
		if (cur && TAB_URLS.includes(cur) && cur !== '/pages/home/home') return Promise.resolve(false)
	}
	const fromAuthScreen = cur.indexOf('/login/login') >= 0 || cur.indexOf('/welcome/welcome') >= 0
	const run = () => new Promise((resolve) => {
		if (TAB_URLS.includes(target)) {
			uni.switchTab({
				url: target,
				success: () => {
					hideNativeTabBar({ force: true })
					resolve(true)
				},
				fail: () => {
					uni.reLaunch({
						url: target,
						success: () => resolve(true),
						fail: () => resolve(false),
					})
				},
			})
			return
		}
		// 登录页同步 reLaunch 分包时，安卓会把这次导航丢掉，问卷就只能拖到下次冷启
		uni.reLaunch({
			url: target,
			success: () => resolve(true),
			fail: () => {
				uni.redirectTo({
					url: target,
					success: () => resolve(true),
					fail: () => {
						uni.navigateTo({
							url: target,
							success: () => resolve(true),
							fail: () => resolve(false),
						})
					},
				})
			},
		})
	})
	if (!fromAuthScreen) return run()
	return new Promise((resolve) => {
		setTimeout(() => {
			run().then(resolve)
		}, 48)
	})
}

/**
 * 已登录再次冷启：直接进首页。
 * 欢迎页只在未登录时由 boot 打开；问卷只在当次登录的 routeAfterAuth 打开。
 */
export async function routeAfterLogin(_user, opts = {}) {
	const forceWelcome = !!opts.forceWelcome
	if (!forceWelcome) {
		go('/pages/home/home')
		return
	}

	try {
		const w = await resolveWelcomeScreen()
		if (w && w.title) {
			const ver = Number(w.version || 1)
			const seen = Number(uni.getStorageSync(WELCOME_SEEN_KEY) || 0)
			if (ver > seen) {
				go('/pagesA/welcome/welcome')
				return
			}
		} else {
			go('/pagesA/welcome/welcome')
			return
		}
	} catch (e) {
		console.warn('welcome gate skipped', e)
		go('/pagesA/welcome/welcome')
		return
	}

	go('/pages/home/home')
}

async function questionsForLoginGate() {
	let questions = []
	try {
		questions = await resolveOnboardingQuestions()
	} catch (e) {
		questions = []
	}
	if (Array.isArray(questions) && questions.length) return questions
	// 刚写入 token 时题库接口可能先失败；空结果再拉一次，避免登录当次漏掉引导
	await new Promise((resolve) => setTimeout(resolve, 250))
	try {
		questions = await resolveOnboardingQuestions()
	} catch (e) {
		console.warn('onboarding gate skipped', e)
		questions = []
	}
	return Array.isArray(questions) ? questions : []
}

/**
 * 当次登录：后台有问卷且未完成/未跳过 → 问卷；否则 Home。
 * @returns {'onboarding'|'home'}
 */
export async function routeAfterAuth(user, _opts = {}) {
	const questions = await questionsForLoginGate()
	const needOnboarding = questions.length > 0
		&& !user?.onboarding_completed && !user?.onboarding_skipped

	if (needOnboarding) {
		try {
			const row = await resolveInterstitialScreen('personalize_intro')
			if (row && (row.title || row.image_url)) {
				const ver = Number(row.version || 1)
				if (!hasSeenInterstitial('personalize_intro', ver)) {
					const next = encodeURIComponent('/pagesA/onboarding/onboarding')
					await go(`/pagesA/interstitial/interstitial?kind=personalize_intro&next=${next}`)
					return 'onboarding'
				}
			}
		} catch (e) {
			console.warn('personalize_intro gate skipped', e)
		}
		await go('/pagesA/onboarding/onboarding')
		return 'onboarding'
	}

	await go('/pages/home/home')
	return 'home'
}
