/**
 * 听经配乐：禁止再用 InnerAudioContext。
 * iOS 上两个 InnerAudioContext 互抢会话，朗读会卡、配乐无声。
 * H5 用 HTMLAudioElement 混音；App 用 plus.audio + mixWithOthers。
 *
 * App 注意：页面返回时禁止 plusPlayer.close()，已知会导致进程崩溃。
 */
import { stopHomeBgm } from '@/utils/homeBgm.js'
import { BGM_VOL_DEFAULT, BGM_VOL_KEY, clamp01, readStoredVol } from '@/utils/audioVolume.js'
import { absolutizeMedia } from '@/utils/media.js'

/**
 * 听经配乐地址：默认本地静态兜底（daily-verse 接口拿不到时仍有声）。
 * 运行时由 setMixBgmSrc() 用 daily-verse.bgm_url 覆盖。
 */
let bgmSrc = '/static/audio/listen-bgm.mp3'
/** App 端本地地址（_www 前缀）；远程 URL 直接用 bgmSrc */
let bgmPlusSrc = '_www/static/audio/listen-bgm.mp3'

/** 由 bgm_url 推导 App 端播放地址：远程直连，本地 /static 走 _www */
function toPlusSrc(url) {
	if (!url) return url
	const u = absolutizeMedia(url) || url
	if (/^(https?:|file:)/i.test(u)) return u
	if (u.indexOf('_www') === 0) return u
	if (u.charAt(0) === '/') return `_www${u}`
	return u
}

let h5El = null
let plusPlayer = null
let plusPlayerSrc = ''
let plusLoopBound = false
let plusPlaying = false
let wantPlay = false
let volume = readStoredVol(BGM_VOL_KEY, BGM_VOL_DEFAULT)
let resolvedPlusKey = ''
let resolvedPlusSrc = ''
let resolvingPlus = null
let plusPlayTicket = 0
let androidInner = null
let androidSrcApplied = ''

function isAppPlusRuntime() {
	try {
		return typeof plus !== 'undefined' && !!(plus.audio || plus.runtime)
	} catch (e) {
		return false
	}
}

function prepareIosMixSession() {
	try {
		if (typeof plus === 'undefined' || !plus.ios) return
		const AVAudioSession = plus.ios.import('AVAudioSession')
		const session = AVAudioSession.sharedInstance()
		// 1 = AVAudioSessionCategoryOptionMixWithOthers，避免朗读把配乐挤掉
		const mixWithOthers = 1
		try {
			session.setCategorywithOptionserror('AVAudioSessionCategoryPlayback', mixWithOthers, null)
		} catch (e) {
			try { session.setCategoryerror('AVAudioSessionCategoryPlayback', null) } catch (e2) {}
		}
		try { session.setActiveerror(true, null) } catch (e) {}
		try { plus.ios.deleteObject(session) } catch (e) {}
	} catch (e) {}
}

export function enableAudioMix() {
	try {
		uni.setInnerAudioOption({
			mixWithOthers: true,
			obeyMuteSwitch: false,
			speakerOn: true,
		})
	} catch (e) {}
	prepareIosMixSession()
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

/** 安卓 plus.audio 会拉起原生播放层，盖住底部播放/暂停。安卓改走 InnerAudioContext。 */
function isAndroidApp() {
	try {
		return typeof plus !== 'undefined' && plus.os && /android/i.test(String(plus.os.name || ''))
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

function resolvePlusSrc() {
	const src = bgmPlusSrc
	if (!src) return src
	// 远程 URL 直接交给 plus 播放，无需本地文件系统转换
	if (/^(https?:|file:)/i.test(src)) return src
	try {
		const converted = plus.io.convertLocalFileSystemURL(src)
		const url = normalizeFileUrl(converted)
		if (url) return url
	} catch (e) {}
	return src
}

/**
 * 只改音量。禁止 setStyles({ volume })：
 * App 把网络配乐走成带画面的播放器时，setStyles 会按默认全屏铺一层原生视图，
 * 声音在播，但经文和暂停按钮都点不到。
 */
function applyPlusVolume(player, vol) {
	if (!player) return
	try {
		if (typeof player.setVolume === 'function') player.setVolume(vol)
	} catch (e) {}
	try {
		player.volume = vol
	} catch (e) {}
}

function isRemoteSrc(src) {
	return /^https?:/i.test(String(src || ''))
}

/** 仅网络直链才可能带原生画面；本地文件调用 setStyles 会把好端端的播放器变成全屏层 */
function pinPlusPlayerOffscreen(player, src) {
	if (!isRemoteSrc(src)) return
	if (!player || typeof player.setStyles !== 'function') return
	try {
		player.setStyles({
			top: '-240px',
			left: '0px',
			width: '1px',
			height: '1px',
			position: 'absolute',
		})
	} catch (e) {}
}

/**
 * 手机浏览器会把未内联的 Audio 收成全屏原生播放器（常是透明层），页面因此不能滚、不能点。
 * 必须进文档流，并声明 playsinline / X5 同层播放。
 */
function tuneInlineAudio(el) {
	if (!el) return
	try { el.playsInline = true } catch (e) {}
	try { el.setAttribute('playsinline', 'true') } catch (e) {}
	try { el.setAttribute('webkit-playsinline', 'true') } catch (e) {}
	try { el.setAttribute('x5-playsinline', 'true') } catch (e) {}
	try { el.setAttribute('x5-video-player-type', 'h5') } catch (e) {}
	try { el.setAttribute('x5-video-player-fullscreen', 'false') } catch (e) {}
	try { el.controls = false } catch (e) {}
	try {
		el.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;'
	} catch (e) {}
	try {
		if (typeof document !== 'undefined' && document.body && el.parentNode !== document.body) {
			document.body.appendChild(el)
		}
	} catch (e) {}
}

function ensureH5() {
	if (h5El) return h5El
	h5El = new Audio(bgmSrc)
	h5El.loop = true
	h5El.preload = 'auto'
	tuneInlineAudio(h5El)
	h5El.volume = volume
	return h5El
}

/**
 * 远程配乐先落到本地再交给 plus.audio。
 * 直接播 https 时，部分手机会拉起全屏原生播放层，把听经页的触摸吃掉。
 */
function resolvePlayablePlusSrc() {
	const src = resolvePlusSrc()
	if (!src || !/^https?:/i.test(src)) return Promise.resolve(src)
	if (resolvedPlusKey === src && resolvedPlusSrc) return Promise.resolve(resolvedPlusSrc)
	if (resolvingPlus && resolvedPlusKey === src) return resolvingPlus
	resolvedPlusKey = src
	resolvedPlusSrc = ''
	resolvingPlus = new Promise((resolve) => {
		const finish = (path) => {
			resolvingPlus = null
			resolve(path)
		}
		uni.downloadFile({
			url: src,
			success: (res) => {
				const path = res.statusCode === 200 && res.tempFilePath ? res.tempFilePath : src
				if (resolvedPlusKey === src) resolvedPlusSrc = path
				finish(path)
			},
			fail: () => finish(src),
		})
	})
	return resolvingPlus
}

function ensurePlus(src) {
	if (plusPlayer && plusPlayerSrc === src) return plusPlayer
	if (plusPlayer) {
		try { plusPlayer.pause() } catch (e) {}
		try { plusPlayer.stop() } catch (e) {}
		plusPlayer = null
		plusLoopBound = false
		plusPlaying = false
	}
	plusPlayerSrc = src
	enableAudioMix()
	// 只传路径。对象参数会被运行时当成带画面的播放器，默认铺满屏幕。
	try {
		plusPlayer = plus.audio.createPlayer(src)
	} catch (e) {
		plusPlayer = null
		plusPlayerSrc = ''
		plusPlaying = false
		return null
	}
	pinPlusPlayerOffscreen(plusPlayer, src)
	try { plusPlayer.setSessionCategory('playback') } catch (e) {}
	try {
		if (plus.audio.ROUTE_SPEAKER != null) plusPlayer.setRoute(plus.audio.ROUTE_SPEAKER)
	} catch (e) {}
	enableAudioMix()
	applyPlusVolume(plusPlayer, volume)
	if (!plusLoopBound) {
		plusLoopBound = true
		try {
			plusPlayer.addEventListener('ended', () => {
				if (!wantPlay || volume <= 0.001 || !plusPlayer) return
				setTimeout(() => {
					if (!wantPlay || volume <= 0.001 || !plusPlayer) return
					try { plusPlayer.play() } catch (e) {}
					pinPlusPlayerOffscreen(plusPlayer, plusPlayerSrc)
				}, 40)
			})
		} catch (e) {}
	}
	return plusPlayer
}

function playPlus(player) {
	pinPlusPlayerOffscreen(player, plusPlayerSrc)
	applyPlusVolume(player, volume)
	try {
		player.play(() => {
			plusPlaying = true
			pinPlusPlayerOffscreen(player, plusPlayerSrc)
			enableAudioMix()
		}, () => { plusPlaying = false })
	} catch (e) {
		try { player.play() } catch (err) {}
		plusPlaying = true
		pinPlusPlayerOffscreen(player, plusPlayerSrc)
	}
	enableAudioMix()
}

function ensureAndroidBgm() {
	if (androidInner) return androidInner
	enableAudioMix()
	const ctx = uni.createInnerAudioContext()
	androidInner = ctx
	ctx.autoplay = false
	ctx.loop = true
	ctx.volume = volume
	try { ctx.obeyMuteSwitch = false } catch (e) {}
	try { ctx.mixWithOthers = true } catch (e) {}
	try { ctx.sessionCategory = 'ambient' } catch (e) {}
	try {
		ctx.onEnded(() => {
			if (!wantPlay || volume <= 0.001 || !androidInner) return
			try { androidInner.play() } catch (e) {}
		})
	} catch (e) {}
	return ctx
}

function playAndroidBgm() {
	enableAudioMix()
	const ctx = ensureAndroidBgm()
	const src = resolvePlusSrc()
	ctx.volume = volume
	try { ctx.mixWithOthers = true } catch (e) {}
	if (src && androidSrcApplied !== src) {
		androidSrcApplied = src
		try { ctx.src = src } catch (e) {}
	}
	try { ctx.play() } catch (e) {}
}

function pauseAndroidBgm() {
	if (!androidInner) return
	try { androidInner.pause() } catch (e) {}
}

function plusIsPaused() {
	if (!plusPlayer) return true
	try {
		if (typeof plusPlayer.isPaused === 'function') return !!plusPlayer.isPaused()
	} catch (e) {}
	return true
}

/** 须在点击栈内调用，解锁 H5 自动播放 */
export function mixBgmUnlock() {
	if (!htmlAudioOk() || plusAudioOk()) return
	const a = ensureH5()
	a.volume = 0
	const p = a.play()
	if (p && typeof p.then === 'function') {
		p.then(() => {
			try { a.pause() } catch (e) {}
			a.volume = volume
			if (wantPlay && volume > 0.001) {
				a.play().catch(() => {})
			}
		}).catch(() => {
			a.volume = volume
		})
	} else {
		try { a.pause() } catch (e) {}
		a.volume = volume
	}
}

/**
 * 设置听经配乐地址（来自 daily-verse.bgm_url）。
 * 已存在的播放器就近热替换：H5 直接换 src；App 端销毁后由 ensurePlus 重建。
 * 传空字符串则忽略（保留默认本地静态兜底）。
 */
export function setMixBgmSrc(url) {
	if (!url) return
	const next = absolutizeMedia(url) || url
	bgmSrc = next
	bgmPlusSrc = toPlusSrc(url)
	resolvedPlusKey = ''
	resolvedPlusSrc = ''
	androidSrcApplied = ''
	// H5：热替换当前播放实例
	if (h5El) {
		try { h5El.src = bgmSrc } catch (e) {}
		try { h5El.loop = true } catch (e) {}
		tuneInlineAudio(h5El)
	}
	// App：实例 src 不可改，销毁后下次播放由 ensurePlus 重建；若正在播则无缝续上
	if (plusPlayer) {
		const wasPlaying = plusPlaying
		try { plusPlayer.pause() } catch (e) {}
		try { plusPlayer.stop() } catch (e) {}
		plusPlayer = null
		plusPlayerSrc = ''
		plusLoopBound = false
		plusPlaying = false
		if (wasPlaying && volume > 0.001) mixBgmPlay()
	}
	if (androidInner && wantPlay && volume > 0.001) playAndroidBgm()
}

export function mixBgmSetVolume(vol) {
	volume = clamp01(vol)
	if (h5El) {
		try { h5El.volume = volume } catch (e) {}
	}
	if (androidInner) {
		try { androidInner.volume = volume } catch (e) {}
	}
	applyPlusVolume(plusPlayer, volume)
	if (volume <= 0.001) mixBgmPause()
}

export function mixBgmPlay() {
	enableAudioMix()
	try { stopHomeBgm() } catch (e) {}
	if (volume <= 0.001) {
		mixBgmPause()
		return
	}
	wantPlay = true
	if (isAndroidApp()) {
		playAndroidBgm()
		return
	}
	if (plusAudioOk()) {
		const ticket = ++plusPlayTicket
		resolvePlayablePlusSrc().then((src) => {
			if (ticket !== plusPlayTicket || !wantPlay || volume <= 0.001 || !src) return
			const player = ensurePlus(src)
			if (!player) return
			if (plusPlaying && plusPlayerSrc === src) {
				pinPlusPlayerOffscreen(player, src)
				enableAudioMix()
				return
			}
			try {
				if (!plusIsPaused()) {
					plusPlaying = true
					pinPlusPlayerOffscreen(player, src)
					enableAudioMix()
					return
				}
				if (typeof player.resume === 'function' && player.getPosition && player.getPosition() > 0) {
					player.resume()
					plusPlaying = true
					pinPlusPlayerOffscreen(player, src)
					enableAudioMix()
					return
				}
			} catch (e) {}
			playPlus(player)
		})
		return
	}
	if (!htmlAudioOk()) return
	const a = ensureH5()
	tuneInlineAudio(a)
	a.volume = volume
	const p = a.play()
	if (p && typeof p.then === 'function') p.catch(() => {})
}

export function mixBgmPause() {
	wantPlay = false
	plusPlaying = false
	plusPlayTicket += 1
	pauseAndroidBgm()
	if (h5El) {
		try { h5El.pause() } catch (e) {}
	}
	if (plusPlayer) {
		try { plusPlayer.pause() } catch (e) {}
	}
}

/**
 * 释放配乐。App 上只 pause，绝不 close（返回听经页时 close 会崩进程）。
 */
export function mixBgmDestroy() {
	wantPlay = false
	if (isAppPlusRuntime()) {
		mixBgmPause()
		return
	}
	const h5 = h5El
	const plus = plusPlayer
	h5El = null
	plusPlayer = null
	plusLoopBound = false
	if (h5) {
		try { h5.pause() } catch (e) {}
		setTimeout(() => {
			try {
				h5.removeAttribute('src')
				h5.load()
			} catch (e) {}
		}, 60)
	}
	if (plus) {
		try { plus.pause() } catch (e) {}
		setTimeout(() => {
			try { plus.stop() } catch (e) {}
			try { plus.close() } catch (e) {}
		}, 80)
	}
}

export function mixBgmSync(playing) {
	if (playing && volume > 0.001) mixBgmPlay()
	else mixBgmPause()
}
