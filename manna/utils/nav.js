/**
 * 导航工具：标题更新 + 返回（禁止滥用 reLaunch 造成整页重挂载）。
 *
 * 原则：UI 跳转优先 navigateBack / switchTab / navigateTo；
 * reLaunch 仅在非 Tab 且其它方式都失败时兜底（会话失效等场景另说）。
 */
export function setNavTitle(title) {
	if (!title) return
	try {
		uni.setNavigationBarTitle({ title })
	} catch (e) {}
}

const TAB_URLS = [
	'/pages/home/home',
	'/pages/quiz/quiz',
	'/pages/devotion/list',
	'/pages/bible/bible',
	'/pages/profile/profile',
]

function leaveFallback(url) {
	const path = (url || '').split('?')[0]
	if (TAB_URLS.includes(path)) {
		uni.switchTab({ url: path })
		return
	}
	uni.navigateTo({
		url,
		fail: () => {
			uni.redirectTo({ url })
		},
	})
}

/**
 * 可靠返回，不整页重刷 Tab。
 * @param {string} [fallback='/pages/home/home']
 */
export function safeBack(fallback = '/pages/home/home') {
	const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	if (stack.length > 1) {
		uni.navigateBack({
			delta: 1,
			fail: () => leaveFallback(fallback),
		})
		return
	}
	leaveFallback(fallback)
}

export { TAB_URLS }
