/**
 * 安全区 / 状态栏：对齐 Figma 展示帧 Status bar（高 62，如 6:1421）。
 * H5 上 system statusBarHeight 常为 0，需回落稿高，否则顶栏贴顶。
 */

/** 稿内 Status bar 组件高度（375×812 帧） */
export const FIGMA_STATUS_BAR_PX = 62

/** 稿画板高度，用于首页纵向比例 */
export const FIGMA_FRAME_H = 812

/**
 * 自定义顶栏 paddingTop（px）。
 * 真机用系统 statusBarHeight；为 0/缺失时用稿 62（H5 预览）。
 */
export function getStatusBarPx() {
	try {
		const info = uni.getSystemInfoSync?.() || {}
		const h = Number(info.statusBarHeight)
		if (Number.isFinite(h) && h > 0) return h
	} catch (e) {}
	return FIGMA_STATUS_BAR_PX
}
