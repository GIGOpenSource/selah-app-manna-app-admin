/**
 * 可滚动页大标题：随上滑收拢为顶栏居中小标题，并与两侧按钮垂直居中对齐。
 */
import { ref, computed } from 'vue'
import { onPageScroll } from '@dcloudio/uni-app'

function clamp01(n) {
	return Math.min(1, Math.max(0, n))
}

function smoothstep(p) {
	return p * p * (3 - 2 * p)
}

function lerp(a, b, t) {
	return a + (b - a) * t
}

/**
 * @param {object} [opts]
 * @param {number} [opts.statusBarPx=0]
 * @param {number} [opts.range=72] 完全收拢所需滚动距离（px）
 * @param {'hero'|'bar'} [opts.mode='hero']
 *   hero：大标题在导航下方 → 收拢到导航垂直中心并水平居中
 *   bar：标题已在导航行内（偏左）→ 收拢为水平居中并略缩小
 * @param {number} [opts.fontStartRpx]
 * @param {number} [opts.fontEndRpx]
 * @param {number} [opts.navHRpx=88]
 * @param {number} [opts.titleBlockRpx=72] hero 模式下展开态占位高度
 * @param {number} [opts.leftStartPercent=18] bar 模式起始 left%
 * @param {number} [opts.contentInsetRpx=0] hero 模式展开态距左（当 page-head 通栏时）
 */
export function useCollapsingTitle(opts = {}) {
	const statusBarPx = opts.statusBarPx ?? 0
	const range = opts.range ?? 72
	const mode = opts.mode ?? 'hero'
	const fontStartRpx = opts.fontStartRpx ?? (mode === 'hero' ? 56 : 40)
	const fontEndRpx = opts.fontEndRpx ?? 34
	const navHRpx = opts.navHRpx ?? 88
	const titleBlockRpx = opts.titleBlockRpx ?? 72
	const leftStartPercent = opts.leftStartPercent ?? 18
	const contentInsetRpx = opts.contentInsetRpx ?? 0

	const progress = ref(0)

	onPageScroll((e) => {
		progress.value = clamp01((e.scrollTop || 0) / range)
	})

	const eased = computed(() => smoothstep(progress.value))

	const titleStyle = computed(() => {
		const p = eased.value
		const navH = uni.upx2px(navHRpx)
		const fontStart = uni.upx2px(fontStartRpx)
		const fontEnd = uni.upx2px(fontEndRpx)
		const fontSize = lerp(fontStart, fontEnd, p)
		const winW = uni.getSystemInfoSync().windowWidth || 375

		if (mode === 'bar') {
			return {
				position: 'absolute',
				top: '50%',
				left: `${lerp(leftStartPercent, 50, p)}%`,
				transform: `translate(${lerp(0, -50, p)}%, -50%)`,
				fontSize: `${fontSize}px`,
				lineHeight: '1.15',
				zIndex: 1,
				maxWidth: `${lerp(70, 52, p)}%`,
				overflow: 'hidden',
				textOverflow: 'ellipsis',
				whiteSpace: 'nowrap',
				pointerEvents: 'none',
			}
		}

		const topExpanded = statusBarPx + navH + uni.upx2px(8)
		const topCollapsed = statusBarPx + (navH - fontEnd) / 2
		const leftStart = contentInsetRpx
			? (uni.upx2px(contentInsetRpx) / winW) * 100
			: 0
		return {
			position: 'absolute',
			left: `${lerp(leftStart, 50, p)}%`,
			top: `${lerp(topExpanded, topCollapsed, p)}px`,
			transform: `translateX(${lerp(0, -50, p)}%)`,
			fontSize: `${fontSize}px`,
			lineHeight: '1.15',
			zIndex: 1,
			maxWidth: `${lerp(92, 52, p)}%`,
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap',
			pointerEvents: 'none',
		}
	})

	const spacerStyle = computed(() => {
		if (mode === 'bar') return { height: '0px' }
		const h = lerp(uni.upx2px(titleBlockRpx), 0, eased.value)
		return { height: `${Math.max(0, h)}px` }
	})

	return {
		titleProgress: progress,
		titleStyle,
		spacerStyle,
	}
}
