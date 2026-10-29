import { ref, watch, onUnmounted } from 'vue'

/** App WebView 不认 inset；必须写死四边 + 宽高，否则遮罩尺寸为 0。 */
export const OVERLAY_MASK_STYLE = {
	position: 'fixed',
	top: '0px',
	left: '0px',
	right: '0px',
	bottom: '0px',
	width: '100%',
	height: '100%',
	zIndex: 99999,
}

/**
 * App 上弹出层出现后，同一次触摸的 touchend 会打到新遮罩上，看起来像“点了没反应”。
 * 打开后短暂忽略点遮罩关闭。
 */
export function useMaskReady(showingSource, delay = 360) {
	const ready = ref(false)
	let timer = null

	const stop = watch(
		showingSource,
		(v) => {
			ready.value = false
			if (timer) {
				clearTimeout(timer)
				timer = null
			}
			if (v) {
				timer = setTimeout(() => {
					ready.value = true
					timer = null
				}, delay)
			}
		},
		{ immediate: true },
	)

	onUnmounted(() => {
		if (timer) clearTimeout(timer)
		stop()
	})

	return ready
}
