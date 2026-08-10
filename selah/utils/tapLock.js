/**
 * 固定控件点击防抖（顶栏 / 底栏 / Skip / CTA）。
 * 仅锁「动作」本身，不改页面滚动、不挡 swiper / scroll-view。
 *
 * @param {number} [ms=600]
 * @returns {{ run: (fn: Function) => any, locked: () => boolean, reset: () => void }}
 */
export function createTapLock(ms = 600) {
	let until = 0
	return {
		locked() {
			return Date.now() < until
		},
		reset() {
			until = 0
		},
		run(fn) {
			const now = Date.now()
			if (now < until) return undefined
			until = now + ms
			return typeof fn === 'function' ? fn() : undefined
		},
	}
}

/**
 * async 版：请求进行中一直锁住，结束后再开一小段冷却。
 * 适合 Skip / Continue / 登录等会 reLaunch 的按钮。
 *
 * @param {() => Promise<any>} fn
 * @param {{ busy: { value: boolean }, cooldownMs?: number }} opts
 */
export async function runBusy(fn, opts) {
	const busy = opts && opts.busy
	const cooldownMs = (opts && opts.cooldownMs) || 400
	if (!busy || busy.value) return
	busy.value = true
	try {
		return await fn()
	} finally {
		setTimeout(() => {
			try {
				busy.value = false
			} catch (e) {}
		}, cooldownMs)
	}
}
