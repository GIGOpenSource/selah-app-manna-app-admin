/**
 * 安全区 / 状态栏：对齐 Figma 展示帧 Status bar（高 62，如 6:1421）。
 * H5 手机网页与 App 同一套：优先系统 statusBar / safe-area，桌面预览再回落轻量顶距。
 */

/** 稿内 Status bar 组件高度（375×812 帧） */
export const FIGMA_STATUS_BAR_PX = 62

/** H5 顶栏轻量留白（px），避免贴顶又不过度垫高 */
export const H5_TOP_INSET_PX = 12

/** 稿画板高度，用于首页纵向比例 */
export const FIGMA_FRAME_H = 812

function readCssSafeTop() {
	if (typeof document === 'undefined') return 0
	try {
		const probe = document.createElement('div')
		probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none;'
		document.documentElement.appendChild(probe)
		const inset = probe.getBoundingClientRect().height
		probe.remove()
		return Number.isFinite(inset) ? Math.round(inset) : 0
	} catch (e) {
		return 0
	}
}

/**
 * 自定义顶栏 paddingTop（px）。
 * H5 / App 同一套：优先系统 statusBar / 安全区，避免手机网页顶栏贴刘海。
 */
export function getStatusBarPx() {
	try {
		const info = uni.getSystemInfoSync?.() || {}
		const h = Number(info.statusBarHeight)
		if (Number.isFinite(h) && h > 0) return h
		const inset = Number(info.safeAreaInsets?.top)
		if (Number.isFinite(inset) && inset > 0) return inset
	} catch (e) {}
	// #ifdef H5
	const cssTop = readCssSafeTop()
	if (cssTop > 0) return cssTop
	return H5_TOP_INSET_PX
	// #endif
	return FIGMA_STATUS_BAR_PX
}
