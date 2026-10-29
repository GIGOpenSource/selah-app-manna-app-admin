/**
 * 首页轻音乐：跨页继续播，仅再次点音符图标停止。
 *
 * 音量不读听经配乐档位。听经默认是 0（没选过档就不出声），
 * 首页若共用这个值，点左上角音符会“在播”但完全无声。
 *
 * App：优先 plus.audio（备好 iOS Playback 会话），失败再 InnerAudio；
 * H5：HTMLAudioElement。
 */
import { reactive } from 'vue'
import { unlockH5Audio } from '@/utils/h5Audio.js'

const BGM_RELS = ['/static/audio/listen-bgm.mp3']
/** 首页是单独的环境音，不压在朗读下面，比听经「强」档再抬一点 */
const HOME_BGM_VOL = 0.6

export const homeBgm = reactive({
	playing: false,
	src: BGM_RELS[0],
})

let h5El = null
let plusPlayer = null
let inner = null
let wantPlay = false
let usingPlus = false

function markPlaying() {
	if (!wantPlay) return
	homeBgm.playing = true
}

function markStopped() {
	wantPlay = false
	homeBgm.playing = false
}

function htmlAudioOk() {
	return typeof Audio !== 'undefined'
}

function plusAudioOk() {
	try {
		return typeof plus !== 'undefined' && plus.audio && typeof plus.audio.createPlayer === 'function'
	} catch (e) {
		return false
	}
}

function normalizeFileUrl(abs) {
	if (!abs) return ''
	if (/^(file:|http:|https:|_www|_doc|_documents|_downloads)/i.test(abs)) return abs
	if (abs.charAt(0) === '/') return `file://${abs}`
	return abs
}

function plusSrcList() {
	return BGM_RELS.map((rel) => `_www${rel}`)
}

function innerSrcFor(rel) {
	// #ifdef APP-PLUS
	try {
		if (typeof plus !== 'undefined' && plus.io && typeof plus.io.convertLocalFileSystemURL === 'function') {
			const abs = plus.io.convertLocalFileSystemURL(`_www${rel}`)
			const url = normalizeFileUrl(abs)
			if (url) return url
		}
	} catch (e) {}
	return `_www${rel}`
	// #endif
	return rel
}

function applyPlusVolume(player) {
	if (!player) return
	try {
		if (typeof player.setStyles === 'function') player.setStyles({ volume: HOME_BGM_VOL })
	} catch (e) {}
	try {
		if (typeof player.setVolume === 'function') player.setVolume(HOME_BGM_VOL)
	} catch (e) {}
	try { player.volume = HOME_BGM_VOL } catch (e) {}
}

function prepareIosSession() {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.ios) return
		const AVAudioSession = plus.ios.import('AVAudioSession')
		const session = AVAudioSession.sharedInstance()
		const mixWithOthers = 1
		try {
			session.setCategorywithOptionserror('AVAudioSessionCategoryPlayback', mixWithOthers, null)
		} catch (e) {
			try { session.setCategoryerror('AVAudioSessionCategoryPlayback', null) } catch (e2) {}
		}
		try { session.setActiveerror(true, null) } catch (e) {}
		plus.ios.deleteObject(session)
	} catch (e) {}
	// #endif
}

function armSession() {
	try {
		uni.setInnerAudioOption({
			mixWithOthers: true,
			obeyMuteSwitch: false,
			speakerOn: true,
		})
	} catch (e) {}
	prepareIosSession()
}

function stopPlus() {
	if (!plusPlayer) return
	try { plusPlayer.pause() } catch (e) {}
	try { plusPlayer.stop() } catch (e) {}
	// App 上 close 与听经同路径可能崩，仅置空引用
	plusPlayer = null
	usingPlus = false
}

function stopInner() {
	if (!inner) return
	try { inner.pause() } catch (e) {}
	try { inner.stop() } catch (e) {}
	try { inner.destroy() } catch (e) {}
	inner = null
}

function stopH5() {
	if (!h5El) return
	try { h5El.pause() } catch (e) {}
}

function mkdirp(root, parts, ok, fail) {
	if (!parts.length) {
		ok(root)
		return
	}
	const name = parts.shift()
	root.getDirectory(name, { create: true }, (dir) => mkdirp(dir, parts, ok, fail), fail)
}

function copyWwwToDoc(rel) {
	return new Promise((resolve, reject) => {
		// #ifdef APP-PLUS
		if (typeof plus === 'undefined' || !plus.io) {
			reject(new Error('no plus.io'))
			return
		}
		const dest = `_doc${rel}`
		plus.io.resolveLocalFileSystemURL(dest, () => {
			resolve(normalizeFileUrl(plus.io.convertLocalFileSystemURL(dest)))
		}, () => {
			plus.io.resolveLocalFileSystemURL(`_www${rel}`, (srcEntry) => {
				const parts = rel.replace(/^\//, '').split('/')
				const fileName = parts.pop()
				plus.io.resolveLocalFileSystemURL('_doc', (docRoot) => {
					mkdirp(docRoot, parts, (dir) => {
						srcEntry.copyTo(dir, fileName, (copied) => {
							try {
								if (copied && typeof copied.toLocalURL === 'function') {
									resolve(copied.toLocalURL())
									return
								}
							} catch (e) {}
							resolve(normalizeFileUrl(plus.io.convertLocalFileSystemURL(dest)))
						}, reject)
					}, reject)
				}, reject)
			}, reject)
		})
		return
		// #endif
		reject(new Error('not app'))
	})
}

function bindPlusPlayer(src, onErr) {
	stopPlus()
	armSession()
	try {
		plusPlayer = plus.audio.createPlayer({
			src,
			loop: true,
			autoplay: false,
			volume: HOME_BGM_VOL,
		})
	} catch (e) {
		plusPlayer = plus.audio.createPlayer(src)
	}
	usingPlus = true
	try { plusPlayer.setSessionCategory('playback') } catch (e) {}
	try {
		if (plus.audio.ROUTE_SPEAKER != null) plusPlayer.setRoute(plus.audio.ROUTE_SPEAKER)
	} catch (e) {}
	applyPlusVolume(plusPlayer)
	if (typeof plusPlayer.addEventListener === 'function') {
		try {
			plusPlayer.addEventListener('ended', () => {
				if (!wantPlay || !plusPlayer) return
				try { plusPlayer.play(() => {}, () => {}) } catch (e) {}
			}, false)
			plusPlayer.addEventListener('error', onErr, false)
		} catch (e) {}
	}
	try {
		plusPlayer.play(() => { markPlaying() }, onErr)
	} catch (e) {
		onErr(e)
	}
}

function startPlus() {
	// #ifdef APP-PLUS
	try {
		if (!plusAudioOk()) return false
		const srcs = plusSrcList()
		let i = 0
		const tryNext = () => {
			if (!wantPlay) return
			if (i >= srcs.length) {
				usingPlus = false
				stopPlus()
				startInner()
				return
			}
			const src = srcs[i++]
			try {
				bindPlusPlayer(src, () => {
					if (!wantPlay) return
					tryNext()
				})
			} catch (e) {
				tryNext()
			}
		}
		tryNext()
		return true
	} catch (e) {
		plusPlayer = null
		usingPlus = false
		return false
	}
	// #endif
	return false
}

function playInnerWithSrc(src, onErr) {
	stopInner()
	armSession()
	inner = uni.createInnerAudioContext()
	inner.src = src
	inner.loop = true
	inner.autoplay = false
	inner.volume = HOME_BGM_VOL
	try { inner.obeyMuteSwitch = false } catch (e) {}
	try { inner.sessionCategory = 'playback' } catch (e) {}
	try { inner.mixWithOthers = true } catch (e) {}
	inner.onPlay(() => { markPlaying() })
	inner.onCanplay(() => {
		if (wantPlay && inner) {
			try { inner.play() } catch (e) {}
		}
	})
	inner.onError(onErr)
	try { inner.play() } catch (e) { onErr(e) }
}

function startInner() {
	usingPlus = false
	let idx = 0
	const tryNext = () => {
		if (!wantPlay) return
		if (idx >= BGM_RELS.length) {
			if (htmlAudioOk()) {
				playH5()
				return
			}
			markStopped()
			return
		}
		const rel = BGM_RELS[idx++]
		playInnerWithSrc(innerSrcFor(rel), () => {
			if (!wantPlay) return
			copyWwwToDoc(rel).then((docUrl) => {
				if (!wantPlay) return
				playInnerWithSrc(docUrl, () => {
					if (!wantPlay) return
					tryNext()
				})
			}).catch(() => {
				if (!wantPlay) return
				tryNext()
			})
		})
	}
	tryNext()
}

function ensureH5() {
	if (h5El) return h5El
	h5El = new Audio(BGM_RELS[0])
	h5El.loop = true
	h5El.preload = 'auto'
	try { h5El.playsInline = true } catch (e) {}
	h5El.volume = HOME_BGM_VOL
	h5El.addEventListener('error', () => {
		if (wantPlay) markStopped()
	})
	return h5El
}

function playH5() {
	unlockH5Audio()
	const a = ensureH5()
	a.volume = HOME_BGM_VOL
	try {
		const p = a.play()
		if (p && typeof p.then === 'function') {
			p.then(() => { markPlaying() }).catch(() => { markStopped() })
			return
		}
		markPlaying()
	} catch (e) {
		markStopped()
	}
}

function playExisting() {
	if (plusPlayer) {
		applyPlusVolume(plusPlayer)
		try {
			plusPlayer.play(() => { markPlaying() }, () => {})
		} catch (e) {}
		return true
	}
	if (inner) {
		try {
			inner.volume = HOME_BGM_VOL
			inner.play()
		} catch (e) {}
		return true
	}
	if (h5El) {
		playH5()
		return true
	}
	return false
}

function whenPlusReady(fn) {
	// #ifdef APP-PLUS
	if (typeof plus !== 'undefined') {
		fn()
		return
	}
	let done = false
	const run = () => {
		if (done) return
		done = true
		fn()
	}
	if (typeof document !== 'undefined') {
		document.addEventListener('plusready', run)
	}
	setTimeout(run, 800)
	return
	// #endif
	fn()
}

export function isHomeBgmPlaying() {
	return !!homeBgm.playing
}

export function toggleHomeBgm() {
	if (homeBgm.playing || wantPlay) {
		stopHomeBgm()
		return
	}
	wantPlay = true
	homeBgm.playing = true
	armSession()
	if (playExisting()) return
	whenPlusReady(() => {
		if (!wantPlay) return
		if (plusPlayer || inner || h5El) return
		if (plusAudioOk() && startPlus()) return
		if (typeof plus !== 'undefined') {
			startInner()
			return
		}
		if (htmlAudioOk()) {
			playH5()
			return
		}
		startInner()
	})
}

export function stopHomeBgm() {
	markStopped()
	stopH5()
	stopPlus()
	stopInner()
}
