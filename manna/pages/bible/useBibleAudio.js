import { ref, nextTick } from 'vue'
import { t } from '@/i18n/index.js'
import { unlockH5Audio, safePlay } from '@/utils/h5Audio.js'
import { resolveAuthedMediaSrc } from '@/utils/media.js'
import {
	primeListenFromGesture,
	writeListenSnapshot,
	listenSession,
	listenAudio,
	startSessionTick,
	stopListenTicks,
} from '@/utils/listenSession.js'
import {
	VOICE_VOL_DEFAULT,
	VOICE_VOL_KEY,
	isListenBgmOn,
	readStoredVol,
	setCtxVolume,
} from '@/utils/audioVolume.js'
import { mixBgmPause, mixBgmPlay } from '@/utils/mixBgmPlayer.js'
import { verseSpokenAt } from '@/utils/verseCue.js'

export const LISTEN_KEY = 'manna_bible_listen'

export function useBibleAudio({
	verses,
	audioUrl,
	audioDurationSec,
	scrollInto,
	audioPlaying,
	listeningVerse,
	bookKey,
	bookName,
	chapterNum,
	selectedVerse,
	translation,
	loadChapter,
}) {
	const fabFlow = ref(false)
	let innerAudio = null
	let audioTick = null
	let scrollLockUntil = 0
	let fabFlowTimer = null
	let pendingAutoplay = false
	let applyIntentInflight = null

	function stopAudioTick() {
		if (audioTick) {
			clearInterval(audioTick)
			audioTick = null
		}
	}
	
	function verseAtPlaybackTime(t, duration) {
		const dur = Number(duration) > 0 ? Number(duration) : Number(audioDurationSec.value) || 0
		return verseSpokenAt(verses.value, t, dur)
	}
	
	function syncListeningVerse() {
		if (!innerAudio || !audioPlaying.value) return
		const t = Number(innerAudio.currentTime) || 0
		const d = Number(innerAudio.duration) || 0
		if (d > 1) {
			const cur = Number(audioDurationSec.value) || 0
			if (!(cur > 8 && d < cur * 0.5 && d < 12)) audioDurationSec.value = d
		}
		const next = verseAtPlaybackTime(t, audioDurationSec.value)
		if (!next || next === listeningVerse.value) return
		listeningVerse.value = next
		const now = Date.now()
		if (now >= scrollLockUntil) {
			const id = `verse-${next}`
			if (scrollInto.value === id) scrollInto.value = ''
			nextTick(() => {
				scrollInto.value = id
			})
			scrollLockUntil = now + 400
		}
	}
	
	function startAudioTick() {
		stopAudioTick()
		syncListeningVerse()
		audioTick = setInterval(syncListeningVerse, 220)
	}
	
	function stopAudio() {
		stopAudioTick()
		const a = innerAudio
		innerAudio = null
		if (a) {
			try { a.pause() } catch (e) {}
			// App 上 destroy 易崩；只断开引用
			try {
				if (typeof plus === 'undefined') {
					setTimeout(() => {
						try { a.stop() } catch (e2) {}
						try { a.destroy() } catch (e2) {}
					}, 80)
				}
			} catch (e) {}
		}
		audioPlaying.value = false
		listeningVerse.value = 0
		scrollInto.value = ''
	}

	function pulseFabGlass() {
		fabFlow.value = false
		nextTick(() => {
			fabFlow.value = true
			if (fabFlowTimer) clearTimeout(fabFlowTimer)
			fabFlowTimer = setTimeout(() => {
				fabFlow.value = false
				fabFlowTimer = null
			}, 780)
		})
	}
	
	function onFabTap() {
		pulseFabGlass()
		stopAudio()
		unlockH5Audio()
		const book = String(bookKey.value || 'genesis')
		const chapter = Number(chapterNum.value) || 1
		const name = String(bookName.value || '')
		const tr = String(translation.value || 'web')
		const verse = Number(selectedVerse?.value?.verse) || 0
		// 同源续播：若全局单例仍在、且目标章与当前播放章一致，保留真实进度与 keepAlive，
		// 让 listen 页走 restoring 分支恢复进度，避免进入后进度条显示 0:00、需手动点击才开始。
		const sameChapterLive =
			!!listenAudio.inner &&
			String(listenSession.bookKey || '') === String(book) &&
			Number(listenSession.chapter) === Number(chapter) &&
			String(listenSession.translation || '') === String(tr)
		let resumeSec = 0
		if (sameChapterLive) {
			resumeSec =
				Number(listenAudio.inner.currentTime) ||
				Number(listenSession.currentSec) ||
				0
		}
		writeListenSnapshot({
			bookKey: book,
			bookName: name,
			chapter,
			translation: tr,
			currentSec: resumeSec,
			playing: false,
			mini: false,
			keepAlive: !!sameChapterLive,
		})
		listenSession.bookKey = book
		listenSession.bookName = name
		listenSession.chapter = chapter
		listenSession.translation = tr
		listenSession.mini = false
		listenSession.keepAlive = !!sameChapterLive
		listenSession.currentSec = resumeSec
		if (!sameChapterLive && listenAudio.inner) {
			try { listenAudio.inner.pause() } catch (e) {}
		}
		// 只解锁混音，不跨页 create/play（否则与听经页竞态易崩）
		primeListenFromGesture(audioUrl.value)
		const q = [
			`book=${encodeURIComponent(book)}`,
			`chapter=${chapter}`,
			`name=${encodeURIComponent(name)}`,
			`translation=${encodeURIComponent(tr)}`,
			'autoplay=1',
		]
		if (verse > 0) q.push(`verse=${verse}`)
		const url = `/pagesA/bible/listen?${q.join('&')}`
		uni.navigateTo({
			url,
			fail: () => {
				uni.redirectTo({
					url,
					fail: () => uni.showToast({ title: t('bible_audio_fail'), icon: 'none' }),
				})
			},
		})
	}

	async function toggleAudio() {
		if (!audioUrl.value) return
		let src = audioUrl.value
		try {
			src = await resolveAuthedMediaSrc(src)
		} catch (e) {
			uni.showToast({ title: t('bible_audio_fail'), icon: 'none' })
			return
		}
		if (!src) return
		if (!innerAudio) {
			innerAudio = uni.createInnerAudioContext()
			innerAudio.src = src
			innerAudio.onEnded(() => {
				audioPlaying.value = false
				stopAudioTick()
				listeningVerse.value = 0
				scrollInto.value = ''
			})
			innerAudio.onPause(() => {
				audioPlaying.value = false
				stopAudioTick()
			})
			innerAudio.onPlay(() => {
				audioPlaying.value = true
				startAudioTick()
			})
			innerAudio.onStop(() => {
				audioPlaying.value = false
				stopAudioTick()
				listeningVerse.value = 0
			})
			innerAudio.onError(() => {
				audioPlaying.value = false
				stopAudioTick()
				listeningVerse.value = 0
				uni.showToast({ title: t('bible_audio_fail'), icon: 'none' })
			})
		} else if (innerAudio.src !== src) {
			innerAudio.src = src
		}
		if (audioPlaying.value) {
			innerAudio.pause()
			audioPlaying.value = false
			stopAudioTick()
		} else {
			safePlay(innerAudio)
			audioPlaying.value = true
			startAudioTick()
		}
	}

	async function applyListenIntent() {
		if (applyIntentInflight) return applyIntentInflight
		applyIntentInflight = (async () => {
		let intent = null
		try {
			intent = uni.getStorageSync(LISTEN_KEY) || null
			uni.removeStorageSync(LISTEN_KEY)
		} catch (e) {
			intent = null
		}
		if (!intent || typeof intent !== 'object') return

		const nextBook = intent.book ? String(intent.book) : String(bookKey.value || '')
		const nextChapter = intent.chapter
			? (Number(intent.chapter) || 1)
			: (Math.max(1, Number(chapterNum.value) || 1))
		const nextTranslation = intent.translation
			? String(intent.translation)
			: String(translation.value || '')
		const targetVerse = Math.max(0, Number(intent.verse) || 0)
		pendingAutoplay = !!intent.autoplay

		const sameChapter =
			nextBook === String(bookKey.value || '')
			&& nextChapter === Math.max(1, Number(chapterNum.value) || 1)
			&& (!intent.translation || nextTranslation === String(translation.value || ''))
			&& Array.isArray(verses.value)
			&& verses.value.length > 0

		if (intent.name || intent.book_name) {
			bookName.value = String(intent.name || intent.book_name)
		}

		if (sameChapter) {
			// 同章返回：只对齐节次，避免整章重拉（体感像 App 重启）
			if (targetVerse) {
				listeningVerse.value = targetVerse
				scrollInto.value = ''
				await nextTick()
				scrollInto.value = `verse-${targetVerse}`
			}
			pendingAutoplay = false
			return
		}

		if (intent.book) bookKey.value = nextBook
		if (intent.chapter) chapterNum.value = nextChapter
		if (intent.translation) translation.value = nextTranslation || translation.value
		await loadChapter()
		if (targetVerse) {
			listeningVerse.value = targetVerse
			scrollInto.value = ''
			await nextTick()
			scrollInto.value = `verse-${targetVerse}`
		}
		if (pendingAutoplay && audioUrl.value) {
			pendingAutoplay = false
			toggleAudio()
		} else if (pendingAutoplay) {
			pendingAutoplay = false
			uni.showToast({ title: t('bible_audio_fail'), icon: 'none' })
		}
		})().finally(() => {
			applyIntentInflight = null
		})
		return applyIntentInflight
	}

	function clearFabFlowTimer() {
		if (fabFlowTimer) {
			clearTimeout(fabFlowTimer)
			fabFlowTimer = null
		}
	}

	/** 听经小卡保活：读经页跟播高亮 + 滚动 */
	function bindMiniListenFollow() {
		// 不能只看 mini 标记：音频实例还在就说明还在播（mini 可能与实际状态脱节）
		if (!listenSession.mini && !listenAudio.inner) return
		try {
			if (listenAudio.inner) {
				setCtxVolume(listenAudio.inner, readStoredVol(VOICE_VOL_KEY, VOICE_VOL_DEFAULT))
			}
		} catch (e) {}

		listenAudio.onTick = (tSec, d) => {
			if (!listenSession.mini) return
			const sameChapter = String(listenSession.bookKey || '') === String(bookKey.value || '')
				&& Number(listenSession.chapter) === Math.max(1, Number(chapterNum.value) || 1)
			// 正文和音频不是同一章时，不要拿别章进度去高亮第 1 章
			if (listenAudio.suppressTick || listenAudio.readerRetarget || !sameChapter) {
				if (listeningVerse.value) listeningVerse.value = 0
				return
			}
			if (d > 1) {
				const cur = Number(listenSession.durationSec) || 0
				if (!(cur > 8 && d < cur * 0.5 && d < 12)) listenSession.durationSec = d
			}
			listenSession.currentSec = tSec
			const next = verseAtPlaybackTime(tSec, listenSession.durationSec)
			if (!next) return
			listenSession.verse = next
			if (next === listeningVerse.value) return
			listeningVerse.value = next
			const now = Date.now()
			if (now >= scrollLockUntil) {
				const id = `verse-${next}`
				if (scrollInto.value === id) scrollInto.value = ''
				nextTick(() => {
					scrollInto.value = id
				})
				scrollLockUntil = now + 400
			}
		}
		listenAudio.onPlay = () => {
			listenSession.playing = true
			audioPlaying.value = false
			try {
				if (isListenBgmOn()) mixBgmPlay()
			} catch (e) {}
		}
		listenAudio.onPause = () => {
			listenSession.playing = false
			try { mixBgmPause() } catch (e) {}
		}
		listenAudio.onEnded = () => {
			listenSession.playing = false
			try { mixBgmPause() } catch (e) {}
		}
		listenAudio.onError = () => {
			listenSession.playing = false
		}

		let playing = !!listenSession.playing
		try {
			const a = listenAudio.inner
			if (a && typeof a.paused === 'boolean' && a.paused === false) playing = true
		} catch (e) {}
		listenSession.playing = playing
		if (playing) startSessionTick()

		const sameChapterNow = String(listenSession.bookKey || '') === String(bookKey.value || '')
			&& Number(listenSession.chapter) === Math.max(1, Number(chapterNum.value) || 1)
		const cur = sameChapterNow ? Math.max(
			0,
			Number(listenSession.verse) || verseAtPlaybackTime(
				Number(listenSession.currentSec) || 0,
				Number(listenSession.durationSec) || 0,
			) || 0,
		) : 0
		if (!sameChapterNow && listeningVerse.value) listeningVerse.value = 0
		if (cur) {
			listeningVerse.value = cur
			scrollInto.value = ''
			nextTick(() => {
				scrollInto.value = `verse-${cur}`
			})
		}
	}

	function unbindMiniListenFollow() {
		if (!listenSession.mini) {
			stopListenTicks()
		}
	}

	return {
		fabFlow,
		stopAudio,
		toggleAudio,
		onFabTap,
		applyListenIntent,
		clearFabFlowTimer,
		bindMiniListenFollow,
		unbindMiniListenFollow,
	}
}
