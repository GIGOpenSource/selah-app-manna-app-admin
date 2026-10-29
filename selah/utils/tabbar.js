/**
 * 更新 tabBar 文案（随语言切换）。
 * 已去掉 pages.json 原生 TabBar（iOS 在 TabBar 下方必留白条），这些 API 在无 TabBar 时会被吞掉。
 * index：0=home / 1=ai / 2=me。
 *
 * 注意：部分安卓（小米等）对 webview.setStyle / hideTabBar 会再次触发页面 onShow，
 * 必须在同页生命周期内只执行一次铺满，否则会和业务 onShow 形成死循环。
 */

const TAB_ROUTES = new Set([
	'pages/home/home',
	'pages/ai/ai',
	'pages/profile/profile',
])

/** @type {null | ((key: string) => string)} */
let pendingT = null
/** 当前页已铺满时的 key；同 key 不再 hideTabBar / setStyle */
let lastExpandKey = ''
let expandTimers = []

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

function clearExpandTimers() {
	while (expandTimers.length) {
		clearTimeout(expandTimers.pop())
	}
}

function expandKeyForCurrent() {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined') return ''
		const pages = getCurrentPages()
		const page = pages[pages.length - 1]
		if (!page) return ''
		const wv = (typeof page.$getAppWebview === 'function' && page.$getAppWebview())
			|| (page.$vm && page.$vm.$scope && typeof page.$vm.$scope.$getAppWebview === 'function' && page.$vm.$scope.$getAppWebview())
			|| (page.$scope && typeof page.$scope.$getAppWebview === 'function' && page.$scope.$getAppWebview())
			|| plus.webview.currentWebview()
		if (!wv) return currentRoute() || 'unknown'
		const info = uni.getSystemInfoSync?.() || {}
		const h = Number(info.screenHeight) || Number(plus.screen && plus.screen.resolutionHeight) || 0
		const route = currentRoute() || 'unknown'
		const wid = wv.id != null ? String(wv.id) : (wv.__uuid__ != null ? String(wv.__uuid__) : 'cur')
		return `${route}|${wid}|${h}`
	} catch (e) {
		return currentRoute() || 'unknown'
	}
	// #endif
	// #ifndef APP-PLUS
	return currentRoute() || 'unknown'
	// #endif
}

/**
 * hideTabBar 后 App 仍常按 TabBar 高度排 webview，底部留一条系统白边。
 * 把当前 Tab 页铺回整屏。标记先写再 setStyle，避免同步回调重入。
 */
function expandTabWebview() {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined') return false
		const pages = getCurrentPages()
		const page = pages[pages.length - 1]
		if (!page) return false
		const wv = (typeof page.$getAppWebview === 'function' && page.$getAppWebview())
			|| (page.$vm && page.$vm.$scope && typeof page.$vm.$scope.$getAppWebview === 'function' && page.$vm.$scope.$getAppWebview())
			|| (page.$scope && typeof page.$scope.$getAppWebview === 'function' && page.$scope.$getAppWebview())
			|| plus.webview.currentWebview()
		if (!wv || typeof wv.setStyle !== 'function') return false
		const key = expandKeyForCurrent()
		if (!key || lastExpandKey === key) return false
		lastExpandKey = key
		const info = uni.getSystemInfoSync?.() || {}
		const h = Number(info.screenHeight) || Number(plus.screen && plus.screen.resolutionHeight)
		const style = { top: 0, bottom: 0 }
		if (h) style.height = h
		wv.setStyle(style)
		return true
	} catch (e) {
		return false
	}
	// #endif
	// #ifndef APP-PLUS
	return false
	// #endif
}

/** 隐藏原生 TabBar / 铺满 webview（Home/AI/Profile 自定义导航时用）。 */
export function hideNativeTabBar() {
	flushTabBarLocale()
	// #ifdef H5
	if (typeof document !== 'undefined') {
		document.documentElement.classList.add('selah-hide-tabbar')
	}
	// #endif

	const key = expandKeyForCurrent()
	if (key && lastExpandKey === key) return

	safeCall(() => uni.hideTabBar({
		animation: false,
		success: expandTabWebview,
		complete: expandTabWebview,
	}))
	expandTabWebview()
	// #ifdef APP-PLUS
	clearExpandTimers()
	expandTimers.push(setTimeout(() => {
		if (expandKeyForCurrent() !== lastExpandKey) expandTabWebview()
	}, 50))
	expandTimers.push(setTimeout(() => {
		if (expandKeyForCurrent() !== lastExpandKey) expandTabWebview()
	}, 300))
	// #endif
}
