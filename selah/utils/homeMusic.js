/**
 * 首页背景音乐（全局单例）。
 * 手动打开后一直播，离开首页或切到其他页面都不停；只有再点一次关闭才停。
 * App 进后台先暂停，回到前台且未手动关闭时继续。
 * 音量由设置页进度条控制，0–100。
 */
import { t } from '@/i18n/index.js'

const BGM_RELS = ['/static/audio/new-home.mp3']
const ON_KEY = 'selah_home_music_on'
const VOL_KEY = 'selah_home_music_volume'

let inner = null
let plusPlayer = null
let wantPlay = false
let usingPlus = false
let innerRelIndex = 0
let volume = 1
let volumeReady = false
const listeners = new Set()

function emit() {
	listeners.forEach((fn) => {
		try { fn(wantPlay) } catch (e) {}
	})
}

function readWant() {
	try {
		const v = uni.getStorageSync(ON_KEY)
		return v === '1' || v === 1 || v === true
	} catch (e) {
		return false
	}
}

function writeWant(on) {
	try {
		if (on) uni.setStorageSync(ON_KEY, '1')
		else uni.removeStorageSync(ON_KEY)
	} catch (e) {}
}

function ensureVolume() {
	if (volumeReady) return
	volumeReady = true
	try {
		const raw = uni.getStorageSync(VOL_KEY)
		if (raw === '' || raw == null) return
		const n = Number(raw)
		if (!Number.isFinite(n)) return
		volume = Math.min(1, Math.max(0, n > 1 ? n / 100 : n))
	} catch (e) {}
}

function applyVolume() {
	ensureVolume()
	if (inner) {
		try { inner.volume = volume } catch (e) {}
	}
	if (plusPlayer) {
		try {
			if (typeof plusPlayer.setStyles === 'function') plusPlayer.setStyles({ volume })
		} catch (e) {}
		try { plusPlayer.volume = volume } catch (e) {}
	}
}

function failToast() {
	uni.showToast({
		title: t('music_unavailable'),
		icon: 'none',
	})
}

function normalizeFileUrl(abs) {
	if (!abs) return ''
	if (/^(file:|http:|https:|_www|_doc|_documents|_downloads)/i.test(abs)) return abs
	if (abs.charAt(0) === '/') return 'file://' + abs
	return abs
}

function plusSrcList() {
	return BGM_RELS.map((rel) => '_www' + rel)
}

function innerSrcFor(rel) {
	// #ifdef APP-PLUS
	try {
		if (typeof plus !== 'undefined' && plus.io && typeof plus.io.convertLocalFileSystemURL === 'function') {
			const abs = plus.io.convertLocalFileSystemURL('_www' + rel)
			const url = normalizeFileUrl(abs)
			if (url) return url
		}
	} catch (e) {}
	return '_www' + rel
	// #endif
	return rel
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

function stopPlus() {
	if (!plusPlayer) return
	try { plusPlayer.pause() } catch (e) {}
	try { plusPlayer.stop() } catch (e) {}
	plusPlayer = null
}

function stopInner() {
	if (!inner) return
	try { inner.pause() } catch (e) {}
	try { inner.stop() } catch (e) {}
	try { inner.destroy() } catch (e) {}
	inner = null
}

function onPlayOk() {
	if (!wantPlay) return
	emit()
}

function onPlayFail() {
	if (!wantPlay) return
	wantPlay = false
	writeWant(false)
	usingPlus = false
	stopPlus()
	stopInner()
	emit()
	failToast()
}

function copyWwwToDoc(rel) {
	return new Promise((resolve, reject) => {
		// #ifdef APP-PLUS
		if (typeof plus === 'undefined' || !plus.io) {
			reject(new Error('no plus.io'))
			return
		}
		const dest = '_doc' + rel
		plus.io.resolveLocalFileSystemURL(dest, () => {
			resolve(normalizeFileUrl(plus.io.convertLocalFileSystemURL(dest)))
		}, () => {
			plus.io.resolveLocalFileSystemURL('_www' + rel, (srcEntry) => {
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

function mkdirp(root, parts, ok, fail) {
	if (!parts.length) {
		ok(root)
		return
	}
	const name = parts.shift()
	root.getDirectory(name, { create: true }, (dir) => mkdirp(dir, parts, ok, fail), fail)
}

function bindPlusPlayer(src, onErr) {
	stopPlus()
	prepareIosSession()
	ensureVolume()
	try {
		plusPlayer = plus.audio.createPlayer({
			src,
			loop: true,
			autoplay: false,
			volume,
		})
	} catch (e) {
		plusPlayer = plus.audio.createPlayer(src)
	}
	usingPlus = true
	try { plusPlayer.setSessionCategory('playback') } catch (e) {}
	try {
		if (plus.audio.ROUTE_SPEAKER != null) plusPlayer.setRoute(plus.audio.ROUTE_SPEAKER)
	} catch (e) {}
	applyVolume()
	if (typeof plusPlayer.addEventListener === 'function') {
		plusPlayer.addEventListener('play', onPlayOk)
		plusPlayer.addEventListener('error', onErr)
	}
	plusPlayer.play(() => {}, onErr)
	emit()
}

function startPlus() {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.audio) return false
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
	ensureVolume()
	inner = uni.createInnerAudioContext()
	inner.src = src
	inner.loop = true
	inner.autoplay = false
	inner.volume = volume
	try { inner.obeyMuteSwitch = false } catch (e) {}
	try { inner.sessionCategory = 'playback' } catch (e) {}
	try { inner.mixWithOthers = true } catch (e) {}
	inner.onPlay(onPlayOk)
	inner.onCanplay(() => {
		if (wantPlay && inner) {
			try { inner.play() } catch (e) {}
		}
	})
	inner.onError(onErr)
	inner.play()
	emit()
}

function startInner() {
	usingPlus = false
	innerRelIndex = 0
	tryNextInner()
}

function tryNextInner() {
	if (!wantPlay) return
	if (innerRelIndex >= BGM_RELS.length) {
		onPlayFail()
		return
	}
	const rel = BGM_RELS[innerRelIndex++]
	playInnerWithSrc(innerSrcFor(rel), () => {
		if (!wantPlay) return
		copyWwwToDoc(rel).then((docUrl) => {
			if (!wantPlay) return
			playInnerWithSrc(docUrl, () => {
				if (!wantPlay) return
				tryNextInner()
			})
		}).catch(() => {
			if (!wantPlay) return
			tryNextInner()
		})
	})
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

function playExisting() {
	applyVolume()
	if (plusPlayer) {
		try { plusPlayer.play(() => {}, () => {}) } catch (e) {}
		return true
	}
	if (inner) {
		try { inner.play() } catch (e) {}
		return true
	}
	return false
}

export function isHomeMusicOn() {
	ensureVolume()
	return wantPlay || readWant()
}

export function getHomeMusicVolume() {
	ensureVolume()
	return Math.round(volume * 100)
}

export function setHomeMusicVolume(percent) {
	const p = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)))
	volume = p / 100
	volumeReady = true
	try { uni.setStorageSync(VOL_KEY, p) } catch (e) {}
	applyVolume()
}

export function subscribeHomeMusic(fn) {
	listeners.add(fn)
	try { fn(wantPlay || readWant()) } catch (e) {}
	return () => listeners.delete(fn)
}

/** 手动打开。已在播则只续上，不重新建播放器。 */
export function startHomeMusic() {
	ensureVolume()
	wantPlay = true
	writeWant(true)
	emit()
	if (playExisting()) return
	whenPlusReady(() => {
		if (!wantPlay) return
		if (plusPlayer || inner) return
		if (startPlus()) return
		startInner()
	})
}

/** 手动关闭。之后换页面也不会再响。 */
export function stopHomeMusic() {
	wantPlay = false
	writeWant(false)
	usingPlus = false
	stopPlus()
	stopInner()
	emit()
}

export function toggleHomeMusic() {
	if (wantPlay || readWant()) stopHomeMusic()
	else startHomeMusic()
}

/** 应用进后台：暂停，但不算用户关闭。 */
export function pauseHomeMusic() {
	if (!wantPlay && !readWant()) return
	if (plusPlayer) {
		try { plusPlayer.pause() } catch (e) {}
	}
	if (inner) {
		try { inner.pause() } catch (e) {}
	}
}

/** 应用回前台：上次没手动关就继续播。 */
export function resumeHomeMusic() {
	if (!readWant()) return
	wantPlay = true
	emit()
	if (playExisting()) return
	startHomeMusic()
}
