/**
 * H5 自动播放：浏览器要求用户手势。
 * uni-h5 InnerAudioContext.play() 内部是 this._audio.play() 且不接 Promise，
 * 拒绝会变成 Uncaught (in promise) NotAllowedError（uni-h5.es.js:19219）。
 */

const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

let unlockEl = null

function isAutoplayBlock(err) {
	const name = err && err.name
	return name === 'NotAllowedError' || name === 'AbortError' || name === 'NotSupportedError'
}

function patchHtmlAudioPlay() {
	// #ifdef H5
	if (typeof HTMLAudioElement === 'undefined') return
	const proto = HTMLAudioElement.prototype
	if (proto.__mannaPlayPatched) return
	const orig = proto.play
	if (typeof orig !== 'function') return
	proto.__mannaPlayPatched = true
	proto.play = function patchedPlay(...args) {
		const p = orig.apply(this, args)
		if (p && typeof p.then === 'function') {
			// 挂上 handler，避免 uni-h5 丢掉返回值后变成 Uncaught
			p.catch((err) => {
				if (isAutoplayBlock(err)) return
			})
		}
		return p
	}
	// #endif
}

patchHtmlAudioPlay()

export function hasH5UserActivation() {
	// #ifdef H5
	try {
		const ua = typeof navigator !== 'undefined' ? navigator.userActivation : null
		if (ua && typeof ua.isActive === 'boolean') return !!ua.isActive
	} catch (e) {}
	return false
	// #endif
	return true
}

/** 在点击栈内调用，解锁后续 HTMLAudio / InnerAudioContext.play */
export function unlockH5Audio() {
	// #ifdef H5
	patchHtmlAudioPlay()
	try {
		if (typeof Audio === 'undefined') return
		if (!unlockEl) {
			unlockEl = new Audio()
			unlockEl.preload = 'auto'
			try { unlockEl.playsInline = true } catch (e) {}
		}
		unlockEl.src = SILENT_WAV
		const p = unlockEl.play()
		if (p && typeof p.then === 'function') {
			p.then(() => {
				try { unlockEl.pause() } catch (e) {}
			}).catch(() => {})
		}
	} catch (e) {}
	// #endif
}

function playHtmlAudio(audio) {
	if (!audio || typeof audio.play !== 'function') return Promise.resolve(false)
	try {
		const p = audio.play()
		if (p && typeof p.then === 'function') {
			return p.then(() => true).catch(() => false)
		}
		return Promise.resolve(true)
	} catch (e) {
		return Promise.resolve(false)
	}
}

export function safePlay(ctx) {
	if (!ctx) return Promise.resolve(false)
	try {
		if (typeof ctx._stoping !== 'undefined') ctx._stoping = false
		if (ctx._audio) return playHtmlAudio(ctx._audio)
		const ret = ctx.play()
		if (ret && typeof ret.then === 'function') {
			return ret.then(() => true).catch(() => false)
		}
		return Promise.resolve(true)
	} catch (e) {
		return Promise.resolve(false)
	}
}
