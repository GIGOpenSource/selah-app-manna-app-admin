/**
 * 键盘抬升：只补系统还没把 webview 压矮的那一段。
 * 安卓会先回调键盘高度，再把页面顶上去；若再按整段高度去垫，
 * 输入框会悬在键盘上方，搜索条则会盖住列表。
 */
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'

function readBox() {
	let inner = 0
	let client = 0
	let visual = 0
	try {
		if (typeof window !== 'undefined') {
			inner = Number(window.innerHeight) || 0
			const root = document.documentElement
			client = Number(root && root.clientHeight) || 0
			if (window.visualViewport) visual = Number(window.visualViewport.height) || 0
		}
	} catch (e) {}
	return { inner, client, visual }
}

function shrunkBy(base, current) {
	if (!(base > 0) || !(current > 0)) return 0
	return Math.max(0, base - current)
}

/**
 * @param {{ selector?: string, onChange?: Function }} [options]
 * selector 用来量输入条离可视底边还有多远，把多抬的高度收回来。
 */
export function useKeyboardLift(options = {}) {
	const liftPx = ref(0)
	const open = ref(false)
	const rawPx = ref(0)
	let baseInner = 0
	let baseClient = 0
	let baseVisual = 0
	/** 同一次键盘高度已经按可视区域收回过，避免重试又抬回去 */
	let snappedRaw = -1
	/** 这次键盘弹出后出现过的最小抬升。再次点输入框不能比它更高 */
	let settledLift = null
	/** 这次弹起锁住的高度。再次聚焦时安卓常把键盘高度越报越大 */
	let lockedRaw = 0
	let timers = []
	let closeTimer = null
	let growTimer = null
	let growRaw = 0
	let dismissTries = 0
	let pinTries = 0
	let viewportTick = 0

	function clearTimers() {
		timers.forEach((id) => clearTimeout(id))
		timers = []
	}

	function clearCloseTimer() {
		if (closeTimer) {
			clearTimeout(closeTimer)
			closeTimer = null
		}
	}

	function captureBase() {
		if (rawPx.value > 40) return
		const box = readBox()
		if (box.inner > baseInner) baseInner = box.inner
		if (box.client > baseClient) baseClient = box.client
		if (box.visual > baseVisual) baseVisual = box.visual
	}

	/** 键盘高度减去视口已经变矮的部分 */
	function compute(raw) {
		const n = Math.max(0, Number(raw) || 0)
		if (n < 40) return 0
		const box = readBox()
		const shrunk = Math.max(
			shrunkBy(baseInner, box.inner),
			shrunkBy(baseClient, box.client),
		)
		return Math.max(0, Math.round(n - shrunk))
	}

	function commit(nextLift) {
		const prevLift = liftPx.value
		const prevOpen = open.value
		const nextOpen = rawPx.value > 40
		const liftChanged = Math.abs(nextLift - prevLift) > 0.5
		const openChanged = nextOpen !== prevOpen
		liftPx.value = nextLift
		open.value = nextOpen
		if ((liftChanged || openChanged) && typeof options.onChange === 'function') {
			options.onChange({
				raw: rawPx.value,
				lift: nextLift,
				prevLift,
				open: nextOpen,
				prevOpen,
			})
		}
	}

	function findEl() {
		if (typeof document === 'undefined' || !options.selector) return null
		try {
			return document.querySelector(options.selector)
		} catch (e) {
			return null
		}
	}

	function inputFocused() {
		try {
			if (typeof document === 'undefined') return false
			const el = document.activeElement
			if (!el || el === document.body || el === document.documentElement) return false
			const tag = String(el.tagName || '').toUpperCase()
			if (tag === 'INPUT' || tag === 'TEXTAREA') return true
			if (el.isContentEditable) return true
			return !!(el.querySelector && el.querySelector('input, textarea'))
		} catch (e) {
			return false
		}
	}

	/** 再次点输入框时，系统会把整页往上撵。固定布局不需要这段滚动。 */
	function pinScroll() {
		try {
			if (typeof window === 'undefined') return
			const root = document.scrollingElement || document.documentElement
			const y = window.scrollY || (root && root.scrollTop) || (document.body && document.body.scrollTop) || 0
			const vv = window.visualViewport
			const offset = vv ? Number(vv.offsetTop) || 0 : 0
			if (y <= 1 && offset <= 1) {
				pinTries = 0
				return
			}
			pinTries += 1
			if (pinTries > 8) return
			window.scrollTo(0, 0)
			if (root) root.scrollTop = 0
			if (document.body) document.body.scrollTop = 0
		} catch (e) {}
	}

	/**
	 * 键盘上沿在可视区域里的 y。
	 * 视口已经被系统压矮时，不再按整段键盘高度往上垫。
	 */
	function keyboardTop() {
		try {
			if (typeof window === 'undefined') return null
			const raw = rawPx.value
			if (raw < 40) return null
			const vv = window.visualViewport
			if (!vv || !(vv.height > 0)) return null
			const shrunk = baseVisual > 0 ? Math.max(0, baseVisual - vv.height) : 0
			const overlap = Math.max(0, raw - shrunk)
			return Math.max(0, vv.height - overlap)
		} catch (e) {
			return null
		}
	}

	/** 输入条底边相对键盘上沿的空隙。正数是空得太多，负数是被键盘挡住。 */
	function measure(lift) {
		try {
			const top = keyboardTop()
			if (top == null) return null
			const el = findEl()
			if (!el || typeof el.getBoundingClientRect !== 'function') return null
			const rect = el.getBoundingClientRect()
			if (!rect || rect.height < 1 || rect.bottom < 1) return null
			const delta = top - rect.bottom - 8
			if (Math.abs(delta) < 20) return null
			const next = Math.round(lift - delta)
			return Math.min(rawPx.value, Math.max(0, next))
		} catch (e) {
			return null
		}
	}

	function nudge() {
		if (rawPx.value < 40) return
		nextTick(() => {
			const run = () => {
				pinScroll()
				const fixed = measure(liftPx.value)
				if (fixed == null || Math.abs(fixed - liftPx.value) <= 8) return
				snappedRaw = rawPx.value
				settledLift = fixed
				commit(fixed)
			}
			if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
			else run()
		})
	}

	function publish() {
		if (rawPx.value < 40) {
			commit(0)
			return
		}
		pinScroll()
		const computed = compute(rawPx.value)
		let next = computed
		// 同一次键盘里，后到的高度回调和再次聚焦都不能把输入条再抬高
		if (snappedRaw === rawPx.value && computed > liftPx.value) next = liftPx.value
		if (settledLift != null && next > settledLift) next = settledLift
		settledLift = next
		commit(next)
		nudge()
	}

	function clearGrowTimer() {
		if (growTimer) {
			clearTimeout(growTimer)
			growTimer = null
		}
		growRaw = 0
	}

	function finishClose() {
		closeTimer = null
		clearTimers()
		clearGrowTimer()
		rawPx.value = 0
		lockedRaw = 0
		snappedRaw = -1
		settledLift = null
		pinTries = 0
		dismissTries = 0
		commit(0)
		timers.push(setTimeout(captureBase, 200))
		timers.push(setTimeout(captureBase, 700))
	}

	function scheduleClose() {
		if (closeTimer) return
		dismissTries = 0
		const tick = () => {
			closeTimer = null
			dismissTries += 1
			// 再次点输入框时，安卓会先报一次高度 0，焦点还在输入框上
			if (inputFocused() && dismissTries < 4) {
				closeTimer = setTimeout(tick, 180)
				return
			}
			finishClose()
		}
		closeTimer = setTimeout(tick, 180)
	}

	function armFollowUps() {
		clearTimers()
		for (const ms of [80, 200, 450]) {
			timers.push(setTimeout(() => {
				if (rawPx.value > 40) publish()
			}, ms))
		}
	}

	/** 更高的键盘（表情键盘）要持续一小段，并且确实挡住了输入条，才允许再抬。 */
	function armGrow(raw) {
		growRaw = raw
		clearGrowTimer()
		growRaw = raw
		growTimer = setTimeout(() => {
			growTimer = null
			if (rawPx.value < 40 || growRaw <= lockedRaw + 80) return
			const prev = rawPx.value
			rawPx.value = growRaw
			const top = keyboardTop()
			rawPx.value = prev
			const el = findEl()
			if (top == null || !el || typeof el.getBoundingClientRect !== 'function') return
			const rect = el.getBoundingClientRect()
			if (!rect || rect.bottom <= top + 28) return
			lockedRaw = growRaw
			rawPx.value = growRaw
			settledLift = null
			snappedRaw = -1
			publish()
		}, 280)
	}

	function applyRaw(height) {
		const raw = Math.max(0, Number(height) || 0)
		if (raw < 40) {
			scheduleClose()
			return
		}
		clearCloseTimer()
		dismissTries = 0
		const wasOpen = rawPx.value > 40 && lockedRaw > 40
		if (!wasOpen) {
			lockedRaw = raw
			snappedRaw = -1
			settledLift = null
			pinTries = 0
			rawPx.value = raw
			publish()
			armFollowUps()
			return
		}
		// 同一次键盘里，忽略突然变高的回调，避免每点一次输入框就多空一截
		if (raw > lockedRaw + 80) {
			armGrow(raw)
			armFollowUps()
			return
		}
		if (raw + 48 < lockedRaw) {
			lockedRaw = raw
			settledLift = null
			snappedRaw = -1
		} else if (raw < lockedRaw) {
			lockedRaw = raw
		}
		rawPx.value = lockedRaw
		publish()
		armFollowUps()
	}

	function onKeyboard(res) {
		applyRaw(res && res.height)
	}

	function scheduleViewportPublish() {
		if (viewportTick || rawPx.value < 40) return
		const run = () => {
			viewportTick = 0
			if (rawPx.value > 40) publish()
		}
		if (typeof requestAnimationFrame === 'function') viewportTick = requestAnimationFrame(run)
		else viewportTick = setTimeout(run, 16)
	}

	function onViewport() {
		try {
			if (typeof window === 'undefined') return
			// 浏览器没有键盘高度回调时，用可视区域变矮的差值
			if (typeof plus === 'undefined') {
				const vv = window.visualViewport
				if (!vv) return
				applyRaw(window.innerHeight - vv.height - (vv.offsetTop || 0))
				return
			}
			if (rawPx.value < 40) return
			pinScroll()
			scheduleViewportPublish()
		} catch (e) {}
	}

	function onWindowScroll() {
		if (rawPx.value < 40) return
		pinScroll()
	}

	function onResize() {
		if (rawPx.value > 40) publish()
	}

	function bind() {
		captureBase()
		if (typeof uni.onKeyboardHeightChange === 'function') {
			uni.onKeyboardHeightChange(onKeyboard)
		}
		try {
			if (typeof window === 'undefined') return
			window.addEventListener('resize', onResize)
			window.addEventListener('scroll', onWindowScroll, true)
			if (window.visualViewport) {
				window.visualViewport.addEventListener('resize', onViewport)
				window.visualViewport.addEventListener('scroll', onViewport)
			}
		} catch (e) {}
	}

	function unbind() {
		clearTimers()
		clearCloseTimer()
		clearGrowTimer()
		if (viewportTick) {
			if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(viewportTick)
			clearTimeout(viewportTick)
			viewportTick = 0
		}
		if (typeof uni.offKeyboardHeightChange === 'function') {
			uni.offKeyboardHeightChange(onKeyboard)
		}
		try {
			if (typeof window === 'undefined') return
			window.removeEventListener('resize', onResize)
			window.removeEventListener('scroll', onWindowScroll, true)
			if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', onViewport)
				window.visualViewport.removeEventListener('scroll', onViewport)
			}
		} catch (e) {}
	}

	function reset() {
		clearTimers()
		clearCloseTimer()
		clearGrowTimer()
		snappedRaw = -1
		settledLift = null
		lockedRaw = 0
		pinTries = 0
		dismissTries = 0
		rawPx.value = 0
		liftPx.value = 0
		open.value = false
	}

	function refresh() {
		if (rawPx.value > 40) publish()
	}

	onMounted(bind)
	onBeforeUnmount(unbind)

	return { liftPx, open, rawPx, reset, refresh }
}
