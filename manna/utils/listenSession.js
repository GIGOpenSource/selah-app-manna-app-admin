/**
 * 听经音频跨页存活：收起小卡时 listen 页卸载，播放器与进度仍在。
 * App-Plus 严禁在页面返回瞬间 destroy/close 原生播放器（会直接崩进程 → HBuilderX 启动页）。
 */
import { reactive } from 'vue'
import { safePlay } from '@/utils/h5Audio.js'
import { resolveAuthedMediaSrc } from '@/utils/media.js'
import {
	VOICE_VOL_DEFAULT,
	VOICE_VOL_KEY,
	isListenBgmOn,
	readStoredVol,
	setCtxVolume,
} from '@/utils/audioVolume.js'
import { enableAudioMix, mixBgmDestroy, mixBgmPause, mixBgmPlay, mixBgmUnlock } from '@/utils/mixBgmPlayer.js'

export const listenSession = reactive({
	mini: false,
	keepAlive: false,
	playing: false,
	bookKey: 'genesis',
	bookName: '',
	chapter: 1,
	verse: 0,
	translation: 'web',
	/** 听经音色：进来默认男声，切换后换章仍沿用 */
	voice: 'male',
	currentSec: 0,
	durationSec: 0,
	/** 睡眠定时：听经页卸载后仍要继续倒数 */
	sleepRemainSec: 0,
	sleepUntilEnd: false,
	sleepPickMin: 0,
})

export const listenAudio = {
	inner: null,
	tick: null,
	demoTimer: null,
	playWatch: null,
	handlersBound: false,
	onPlay: null,
	onPause: null,
	onEnded: null,
	onError: null,
	onTick: null,
	sleepTick: null,
	onSleepFire: null,
	/** 换男女声后 play() 会把进度打回 0，开播时跳回这个位置 */
	voiceSeekTarget: 0,
	/** 读经页正在切章，跟播不要把旧章进度套到新正文上 */
	readerRetarget: false,
	/** 换源瞬间的 ended 不能当成章节播完 */
	suppressEnd: false,
	suppressTick: false,
	/** 当前音源对应的远程地址（blob/临时文件上看不到章号） */
	remoteSrc: '',
}

/** 销毁门闩：防止 close + onUnmounted 双杀 */
let tearingDown = false
let destroyTimer = null

export function isAppPlusRuntime() {
	try {
		return typeof plus !== 'undefined' && !!(plus.audio || plus.runtime)
	} catch (e) {
		return false
	}
}

export function listenPageUrl() {
	const name = encodeURIComponent(listenSession.bookName || '')
	return `/pagesA/bible/listen?book=${encodeURIComponent(listenSession.bookKey || 'genesis')}&chapter=${Number(listenSession.chapter) || 1}&name=${name}&translation=${encodeURIComponent(listenSession.translation || 'web')}&autoplay=0`
}

export function writeListenSnapshot(p) {
	if (!p || typeof p !== 'object') return
	Object.keys(p).forEach((k) => {
		if (k in listenSession && p[k] !== undefined) listenSession[k] = p[k]
	})
}

export function fmtListenTime(sec) {
	const s = Math.max(0, Math.floor(Number(sec) || 0))
	const m = Math.floor(s / 60)
	const r = s % 60
	return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** 用户关掉播放或手动取消定时时才清；返回读经页不要调用 */
export function clearListenSleep() {
	if (listenAudio.sleepTick) {
		clearInterval(listenAudio.sleepTick)
		listenAudio.sleepTick = null
	}
	listenSession.sleepRemainSec = 0
	listenSession.sleepUntilEnd = false
	listenSession.sleepPickMin = 0
}

export function stopListenTicks() {
	if (listenAudio.tick) {
		clearInterval(listenAudio.tick)
		listenAudio.tick = null
	}
	if (listenAudio.demoTimer) {
		clearInterval(listenAudio.demoTimer)
		listenAudio.demoTimer = null
	}
	if (listenAudio.playWatch) {
		clearTimeout(listenAudio.playWatch)
		listenAudio.playWatch = null
	}
}

export function startSessionTick() {
	stopListenTicks()
	listenAudio.tick = setInterval(() => {
		const a = listenAudio.inner
		if (!a || tearingDown) {
			stopListenTicks()
			return
		}
		try {
			if (listenAudio.suppressTick) return
			const tSec = Number(a.currentTime) || 0
			listenSession.currentSec = tSec
			const d = Number(a.duration) || 0
			if (d > 0) listenSession.durationSec = d
			if (typeof listenAudio.onTick === 'function') listenAudio.onTick(tSec, d)
		} catch (e) {
			stopListenTicks()
			listenSession.playing = false
		}
	}, 220)
}

export function bindListenHandlers() {
	const inner = listenAudio.inner
	if (!inner || listenAudio.handlersBound) return
	listenAudio.handlersBound = true
	inner.onPlay(() => {
		if (tearingDown || !listenAudio.inner) return
		listenSession.playing = true
		startSessionTick()
		try { setCtxVolume(inner, readStoredVol(VOICE_VOL_KEY, VOICE_VOL_DEFAULT)) } catch (e) {}
		try {
			if (isListenBgmOn()) mixBgmPlay()
		} catch (e) {}
		if (typeof listenAudio.onPlay === 'function') {
			try { listenAudio.onPlay() } catch (e) {}
		}
	})
	inner.onPause(() => {
		if (tearingDown) return
		listenSession.playing = false
		stopListenTicks()
		try { mixBgmPause() } catch (e) {}
		if (typeof listenAudio.onPause === 'function') {
			try { listenAudio.onPause() } catch (e) {}
		}
	})
	inner.onEnded(() => {
		if (tearingDown || listenAudio.suppressEnd) return
		listenSession.playing = false
		stopListenTicks()
		if (typeof listenAudio.onEnded === 'function') {
			try { listenAudio.onEnded() } catch (e) {}
		}
	})
	inner.onError(() => {
		if (tearingDown) return
		if (typeof listenAudio.onError === 'function') {
			try { listenAudio.onError() } catch (e) {}
		}
	})
}

/**
 * 摘掉引用并 pause。App 上绝不调用 destroy/close（已知会崩进程）。
 */
export function detachListenAudio({ destroyNative = false } = {}) {
	stopListenTicks()
	listenAudio.onPlay = null
	listenAudio.onPause = null
	listenAudio.onEnded = null
	listenAudio.onError = null
	listenAudio.onTick = null
	listenAudio.handlersBound = false
	listenAudio.suppressEnd = false
	listenAudio.suppressTick = false
	listenAudio.readerRetarget = false
	listenAudio.remoteSrc = ''
	listenSession.playing = false

	const a = listenAudio.inner
	listenAudio.inner = null
	try { mixBgmPause() } catch (e) {}
	if (a) {
		try { a.pause() } catch (e) {}
	}

	clearListenSleep()
	const app = isAppPlusRuntime()
	if (app || !destroyNative) return

	if (!a) return
	setTimeout(() => {
		try { a.stop() } catch (e) {}
		try { a.destroy() } catch (e) {}
		try { mixBgmDestroy() } catch (e) {}
	}, 200)
}

/**
 * 听经页已离开后，在读经 Tab 里延后轻停残留音频（勿在听经页销毁瞬间调用）。
 */
export function pauseOrphanListenAudio() {
	stopListenTicks()
	listenAudio.onPlay = null
	listenAudio.onPause = null
	listenAudio.onEnded = null
	listenAudio.onError = null
	listenAudio.onTick = null
	listenAudio.handlersBound = false
	listenAudio.suppressEnd = false
	listenAudio.suppressTick = false
	listenAudio.readerRetarget = false
	listenAudio.remoteSrc = ''
	listenSession.playing = false
	listenSession.mini = false
	listenSession.keepAlive = false
	try { mixBgmPause() } catch (e) {}
	const a = listenAudio.inner
	listenAudio.inner = null
	if (a) {
		try { a.pause() } catch (e) {}
	}
	clearListenSleep()
}

/**
 * 完整销毁听经音频。App 上等价于 detach（不 destroy）。
 */
export function destroyListenAudio() {
	if (tearingDown) return
	tearingDown = true
	if (destroyTimer) {
		clearTimeout(destroyTimer)
		destroyTimer = null
	}

	listenSession.mini = false
	listenSession.keepAlive = false
	listenSession.voice = 'male'
	detachListenAudio({ destroyNative: !isAppPlusRuntime() })

	destroyTimer = setTimeout(() => {
		destroyTimer = null
		tearingDown = false
	}, 160)
}

/** 必须在点击栈内调用：仅解锁混音，不立刻 play */
export function primeListenFromGesture(src) {
	if (tearingDown) return
	enableAudioMix()
	mixBgmUnlock()
	const url = String(src || '').trim()
	if (!url) return
	resolveAuthedMediaSrc(url).catch(() => {})
}

function chapterFromMediaUrl(url) {
	const path = decodeURIComponent(String(url || '').split('?')[0])
	const m = path.match(/\/(\d{1,3})\.mp3$/i)
	return m ? Number(m[1]) : 0
}

function withVoiceFromCurrent(nextUrl) {
	const cur = String(listenAudio.remoteSrc || '')
	const g = (cur.match(/\/(male|female)\//i) || [])[1]
	const src = String(nextUrl || '')
	if (!g || !src) return src
	if (/\/(male|female)\//i.test(src)) {
		return src.replace(/\/(male|female)\//i, `/${g.toLowerCase()}/`)
	}
	return src
}

/** 读经页已经按当前音色选好 audio_url_male / audio_url_female 时，不要再改路径 */
function resolveRetargetSrc(src) {
	const url = String(src || '').trim()
	if (!url) return ''
	const want = listenSession.voice === 'female' ? 'female' : 'male'
	const got = (url.match(/\/(male|female)\//i) || [])[1]
	if (!got || got.toLowerCase() === want) return url
	return withVoiceFromCurrent(url)
}

/**
 * 读经页换章时，把小卡正在播的音频切到同一章。
 * onlyIfChapterDiffers：音源章号已经对上则不动进度（避免回到读经页把正在听的章从头播）。
 */
export async function retargetListenChapter(opts = {}) {
	if (tearingDown) return false
	const chapter = Math.max(1, Number(opts.chapter) || 1)
	const bookKey = String(opts.bookKey || listenSession.bookKey || '')
	const bookName = String(opts.bookName || listenSession.bookName || '')
	const translation = String(opts.translation || listenSession.translation || 'web')
	const keepPosition = !!opts.keepPosition
	const onlyIfChapterDiffers = !!opts.onlyIfChapterDiffers
	const remoteGuess = resolveRetargetSrc(opts.src)
	const playingChapter = chapterFromMediaUrl(listenAudio.remoteSrc)

	if (onlyIfChapterDiffers) {
		if (!playingChapter || playingChapter === chapter) return false
	}

	const wasPlaying = opts.play != null ? !!opts.play : !!listenSession.playing
	const stale = () => (typeof opts.isStale === 'function' ? !!opts.isStale() : false)
	let pos = 0
	if (keepPosition) {
		try {
			pos = Number(listenAudio.inner && listenAudio.inner.currentTime) || Number(listenSession.currentSec) || 0
		} catch (e) {
			pos = Number(listenSession.currentSec) || 0
		}
	}

	listenSession.bookKey = bookKey
	listenSession.bookName = bookName
	listenSession.chapter = chapter
	listenSession.translation = translation
	if (!keepPosition) {
		listenSession.currentSec = 0
		listenSession.verse = 0
		listenSession.durationSec = Math.max(0, Number(opts.durationSec) || 0)
	}

	const a = listenAudio.inner
	if (!a) return true

	// 先停旧章，避免拉新音频期间第一章还在播、进度又被 tick 写回去
	listenAudio.suppressEnd = true
	listenAudio.suppressTick = true
	try { a.pause() } catch (e) {}
	if (!keepPosition) listenSession.playing = false

	if (!remoteGuess) {
		listenSession.playing = false
		stopListenTicks()
		listenAudio.suppressTick = false
		listenAudio.suppressEnd = false
		return false
	}

	let playable = remoteGuess
	try {
		playable = await resolveAuthedMediaSrc(remoteGuess)
	} catch (e) {
		playable = ''
	}
	if (!playable || stale()) {
		if (!stale()) {
			listenSession.playing = false
			stopListenTicks()
			listenAudio.suppressTick = false
			listenAudio.suppressEnd = false
		}
		return false
	}

	listenAudio.remoteSrc = remoteGuess
	if (!isAppPlusRuntime()) {
		try { a.stop() } catch (e) {}
	}
	try { a.src = playable } catch (e) {}
	const seekTo = keepPosition ? Math.max(0, pos) : 0
	try { a.seek(seekTo) } catch (e) {}
	listenSession.currentSec = seekTo

	const releaseSuppress = () => {
		listenAudio.suppressTick = false
		setTimeout(() => {
			listenAudio.suppressEnd = false
		}, 450)
	}

	if (!wasPlaying) {
		listenSession.playing = false
		stopListenTicks()
		releaseSuppress()
		return true
	}
	const ok = await safePlay(a)
	listenSession.playing = !!ok
	if (ok) startSessionTick()
	else stopListenTicks()
	releaseSuppress()
	return !!ok
}

export function toggleListenPlayback() {
	if (tearingDown) return
	const a = listenAudio.inner
	if (!a) return
	if (listenSession.playing) {
		try { a.pause() } catch (e) {}
		listenSession.playing = false
		stopListenTicks()
		mixBgmPause()
		return
	}
	const dur = Number(a.duration) || Number(listenSession.durationSec) || 0
	const pos = Number(a.currentTime) || Number(listenSession.currentSec) || 0
	if (dur > 1 && pos >= dur - 0.5) {
		try { a.seek(0) } catch (e) {}
		listenSession.currentSec = 0
	}
	mixBgmUnlock()
	safePlay(a).then((ok) => {
		if (!ok || tearingDown) return
		listenSession.playing = true
		startSessionTick()
		if (isListenBgmOn()) mixBgmPlay()
	})
}

export function closeListenMini() {
	destroyListenAudio()
}

export function expandListenMini() {
	listenSession.mini = false
	listenSession.keepAlive = true
	uni.navigateTo({
		url: listenPageUrl(),
		fail: () => {
			listenSession.mini = true
		},
	})
}
