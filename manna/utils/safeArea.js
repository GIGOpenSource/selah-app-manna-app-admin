/**
 * 安全区 / 状态栏 — 对齐 Figma Holy Bible（375×812）
 * Home 顶栏图标 top≈51；Tab bottom≈26。
 * H5 statusBarHeight 常为 0：回落稿高，但勿用过大占位。
 */

/** 稿内状态栏区域（图标条起点） */
export const FIGMA_STATUS_BAR_PX = 47

/** Tab 相对屏幕底的设计 inset（Figma bottom-26） */
export const FIGMA_TAB_BOTTOM_INSET_PX = 26

/** 稿画板高度 */
export const FIGMA_FRAME_H = 812

/**
 * 自定义顶栏 paddingTop（px）。
 * 优先系统 statusBarHeight / safeAreaInsets.top；H5 回落稿 47。
 */
export function getStatusBarPx() {
	try {
		const info = uni.getSystemInfoSync?.() || {}
		const h = Number(info.statusBarHeight)
		if (Number.isFinite(h) && h > 0) return Math.min(h, 54)
		const insetTop = Number(info.safeAreaInsets?.top)
		if (Number.isFinite(insetTop) && insetTop > 0) return Math.min(insetTop, 54)
	} catch (e) {}
	return FIGMA_STATUS_BAR_PX
}

/** 底部安全区（home indicator），不含稿内 Tab 悬浮 inset */
export function getSafeBottomPx() {
	try {
		const info = uni.getSystemInfoSync?.() || {}
		const b = Number(info.safeAreaInsets?.bottom)
		if (Number.isFinite(b) && b > 0) return b
	} catch (e) {}
	return 0
}

/** Tab 容器 paddingBottom = 稿 inset + 设备安全底 */
export function getTabBarPaddingBottomPx() {
	return FIGMA_TAB_BOTTOM_INSET_PX + getSafeBottomPx()
}
