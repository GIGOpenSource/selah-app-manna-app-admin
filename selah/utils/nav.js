/**
 * 导航工具：标题更新 + 返回（禁止滥用 reLaunch 造成整页重挂载）。
 *
 * 原则：UI 跳转优先 navigateBack / goTab / navigateTo；
 * reLaunch 仅在根 Tab 切换、以及其它方式都失败时使用。
 */
export function setNavTitle(title) {
	if (!title) return
	try {
		uni.setNavigationBarTitle({ title })
	} catch (e) {}
}

const TAB_URLS = [
	'/pages/home/home',
	'/pages/ai/ai',
	'/pages/profile/profile',
]

function pagePath(page) {
	if (!page) return ''
	return '/' + String(page.route || '').replace(/^\//, '')
}

/**
 * Home / AI / Me 已去掉原生 TabBar。
 * 用进栈 / 退栈切换，避免 reLaunch 整页重挂载造成进出会白闪。
 */
export function goTab(url) {
	const path = String(url || '').split('?')[0]
	if (!path) return
	const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	const curPath = pagePath(stack[stack.length - 1])
	if (curPath === path) return
	for (let i = stack.length - 2; i >= 0; i--) {
		if (pagePath(stack[i]) !== path) continue
		uni.navigateBack({
			delta: stack.length - 1 - i,
			fail: () => uni.reLaunch({ url: path }),
		})
		return
	}
	uni.navigateTo({
		url: path,
		animationType: 'slide-in-right',
		animationDuration: 280,
		fail: () => uni.reLaunch({ url: path }),
	})
}

function leaveFallback(url) {
	const path = (url || '').split('?')[0]
	if (TAB_URLS.includes(path)) {
		goTab(path)
		return
	}
	const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	const curPath = pagePath(stack[stack.length - 1])
	// 当前已是分包页时用 redirectTo 换掉自己，避免压在首页栈上再 navigateBack 回首页
	if (curPath && !TAB_URLS.includes(curPath)) {
		uni.redirectTo({
			url,
			fail: () => {
				uni.navigateTo({ url })
			},
		})
		return
	}
	uni.navigateTo({
		url,
		fail: () => {
			uni.redirectTo({ url })
		},
	})
}

/** H5 上 @tap + @click 会连打两次返回，锁一下避免连退两层到首页 */
let backLockUntil = 0

/**
 * 可靠返回，不整页重刷 Tab。
 * @param {string} [fallback='/pages/home/home']
 */
export function safeBack(fallback = '/pages/home/home') {
	const now = Date.now()
	if (now < backLockUntil) return
	backLockUntil = now + 500
	const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	const fallbackPath = String(fallback || '').split('?')[0]
	if (stack.length > 1) {
		const prevPath = pagePath(stack[stack.length - 2])
		// 上一页是 Tab，但要回到探索等分包页：不要 navigateBack 掉进首页
		if (
			fallbackPath
			&& prevPath
			&& prevPath !== fallbackPath
			&& TAB_URLS.includes(prevPath)
			&& !TAB_URLS.includes(fallbackPath)
		) {
			leaveFallback(fallback)
			return
		}
		uni.navigateBack({
			delta: 1,
			fail: () => leaveFallback(fallback),
		})
		return
	}
	leaveFallback(fallback)
}

export { TAB_URLS }
