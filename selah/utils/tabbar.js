/**
 * 更新 tabBar 文案（随语言切换）。
 * uni.setTabBarItem 仅在当前为 TabBar 页时可用；非 TabBar 页 / 冷启未就绪时入队，
 * 进入 Tab 页（如 hideNativeTabBar）时再冲刷。
 * index：0=home / 1=ai / 2=me，与 pages.json tabBar 顺序一致。
 *
 * 主路径 UI 按 Figma 使用自定义 dock / 顶栏，运行时会 hideTabBar；
 * 仍保留 pages.json tabBar 以便 switchTab 路由可用。
 */

const TAB_ROUTES = new Set([
	'pages/home/home',
	'pages/ai/ai',
	'pages/profile/profile',
])

/** @type {null | ((key: string) => string)} */
let pendingT = null

function currentRoute() {
	const pages = getCurrentPages()
	if (!pages.length) return ''
	const cur = pages[pages.length - 1]
	return (cur && (cur.route || cur.$page?.fullPath?.replace(/^\//, '').split('?')[0])) || ''
}

function isTabBarPage() {
	return TAB_ROUTES.has(currentRoute())
}

/** uni API 可能返回 Promise；吞掉 fail，避免 Uncaught (in promise)。 */
function safeCall(fn) {
	try {
		const ret = fn()
		if (ret && typeof ret.then === 'function') {
			ret.catch(() => {})
		}
	} catch (e) {
		/* ignore sync throw */
	}
}

function flushTabBarLocale() {
	if (!pendingT || !isTabBarPage()) return
	const t = pendingT
	safeCall(() => uni.setTabBarItem({ index: 0, text: t('home') }))
	safeCall(() => uni.setTabBarItem({ index: 1, text: t('ai') }))
	safeCall(() => uni.setTabBarItem({ index: 2, text: t('me') }))
}

export function applyTabBarLocale(t) {
	pendingT = t
	flushTabBarLocale()
}

/** 隐藏原生 TabBar（Home/AI/Profile 自定义导航时用）。 */
export function hideNativeTabBar() {
	flushTabBarLocale()
	if (!isTabBarPage()) return
	safeCall(() => uni.hideTabBar({ animation: false }))
}
