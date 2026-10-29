/**
 * 可滚动页大标题：随上滑收拢为顶栏居中小标题。
 *
 * 重要：不在 sticky 头内动态改 spacer 高度（会触发布局回流 → 安卓顶部抖动）。
 * hero：大标题在吸顶头下方随页面滚走；吸顶栏内小标题仅用 opacity 显隐。
 * bar：标题本就在导航行内，仅做位置/字号插值（不改容器高度）。
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
 * @param {number} [opts.fontStartRpx]
 * @param {number} [opts.fontEndRpx]
 * @param {number} [opts.navHRpx=88]
 * @param {number} [opts.titleBlockRpx=72] 保留兼容；hero 不再用其做吸顶内动画高度
 * @param {number} [opts.leftStartPercent=18] bar 模式起始 left%
 * @param {number} [opts.contentInsetRpx=0]
 * @param {(scrollTop: number) => void} [opts.onScroll] 与收拢共用同一 onPageScroll，避免重复注册
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

	// 启动时缓存，避免滚动帧内反复 getSystemInfoSync / upx2px
	let winW = 375
	let navH = 44
	let fontStart = 28
	let fontEnd = 17
	let titleBlockPx = 36
	try {
		winW = uni.getSystemInfoSync().windowWidth || 375
		navH = uni.upx2px(navHRpx)
		fontStart = uni.upx2px(fontStartRpx)
		fontEnd = uni.upx2px(fontEndRpx)
		titleBlockPx = uni.upx2px(titleBlockRpx)
	} catch (e) {}

	const progress = ref(0)
	let ticking = false
	let pendingTop = 0
	let lastApplied = -1

	function applyScrollTop(scrollTop) {
		const next = clamp01((scrollTop || 0) / range)
		if (Math.abs(next - lastApplied) < 0.01) return
		lastApplied = next
		progress.value = next
	}

	const extraOnScroll = typeof opts.onScroll === 'function' ? opts.onScroll : null

	onPageScroll((e) => {
		pendingTop = e.scrollTop || 0
		if (extraOnScroll) extraOnScroll(pendingTop)
		if (ticking) return
		ticking = true
		const flush = () => {
			ticking = false
			applyScrollTop(pendingTop)
		}
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(flush)
		} else {
			setTimeout(flush, 16)
		}
	})

	const eased = computed(() => smoothstep(progress.value))

	/** bar 模式：导航行内标题插值。hero 模式：吸顶栏内的收拢小标题 */
	const titleStyle = computed(() => {
		const p = eased.value
		const fontSize = mode === 'bar'
			? lerp(fontStart, fontEnd, p)
			: fontEnd

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

		// hero：小标题固定在导航垂直居中，仅透明度变化（不改 left/top 避免抖动）
		return {
			position: 'absolute',
			top: '50%',
			left: '50%',
			transform: 'translate(-50%, -50%)',
			fontSize: `${fontSize}px`,
			lineHeight: '1.15',
			zIndex: 1,
			maxWidth: '52%',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap',
			pointerEvents: 'none',
			opacity: p,
		}
	})

	/** hero 大标题（放在吸顶头下方、随页面滚动） */
	const heroTitleStyle = computed(() => {
		const p = eased.value
		return {
			opacity: 1 - p,
			transform: `translateY(${lerp(0, -8, p)}px)`,
			// 收拢后不挡点击
			pointerEvents: p > 0.85 ? 'none' : 'auto',
		}
	})

	/** 兼容旧用法：不再在 sticky 内收缩高度 */
	const spacerStyle = computed(() => {
		if (mode === 'bar') return { height: '0px' }
		return { height: '0px' }
	})

	return {
		titleProgress: progress,
		titleStyle,
		heroTitleStyle,
		spacerStyle,
		/** @deprecated 仅兼容；恒为 0，大标题请放到吸顶头外 */
		titleBlockPx,
		statusBarPx,
		navH,
		winW,
	}
}
