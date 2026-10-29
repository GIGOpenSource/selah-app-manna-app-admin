/**
 * 列表曝光：进入视口达到比例后，连续停留 delay 毫秒再上报。同一 id 只报一次。
 * 列表变化后再次 start，已上报的 id 不会重报。
 */
export function createExposure(vm, selector, { ratio = 0, delay = 0, onShow } = {}) {
	const seen = new Set()
	const timers = new Map()
	let ob = null

	function clearTimer(key) {
		if (!timers.has(key)) return
		clearTimeout(timers.get(key))
		timers.delete(key)
	}

	function stop() {
		timers.forEach((timer) => clearTimeout(timer))
		timers.clear()
		try { ob && ob.disconnect() } catch (e) {}
		ob = null
	}

	function start() {
		stop()
		if (!vm || typeof uni === 'undefined' || typeof uni.createIntersectionObserver !== 'function') return
		ob = uni.createIntersectionObserver(vm, { thresholds: [0, 0.5, 1], observeAll: true })
		ob.relativeToViewport().observe(selector, (res) => {
			const raw = res?.dataset?.xid ?? res?.dataset?.Xid
			let key = raw == null || raw === '' ? '' : String(raw)
			if (!key && res?.id) {
				const nodeId = String(res.id)
				key = nodeId.startsWith('expo-') ? nodeId.slice(5) : ''
			}
			if (!key) return
			const visible = Number(res.intersectionRatio || 0) >= ratio
			if (!visible) {
				clearTimer(key)
				return
			}
			if (seen.has(key) || timers.has(key)) return
			const fire = () => {
				timers.delete(key)
				if (seen.has(key)) return
				seen.add(key)
				try { onShow(key) } catch (e) {}
			}
			if (delay > 0) timers.set(key, setTimeout(fire, delay))
			else fire()
		})
	}

	return { start, stop }
}
