/**
 * 原生 tabBar 隐藏；实际底栏为各页 MannaTabBar。
 */
export function applyTabBarLocale() {}

export function hideNativeTabBar() {
	try {
		const ret = uni.hideTabBar({ animation: false })
		if (ret && typeof ret.then === 'function') ret.catch(() => {})
	} catch (e) {
		/* ignore */
	}
}

/** @deprecated 兼容旧调用；现由页面内 MannaTabBar 的 active 控制 */
export function setTabBarSelected() {
	hideNativeTabBar()
}
