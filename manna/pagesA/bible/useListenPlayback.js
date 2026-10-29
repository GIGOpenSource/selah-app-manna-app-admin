import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { onLoad, onHide, onUnload, onBackPress } from '@dcloudio/uni-app'
import { apiBibleChapter, apiBibleReadProgress } from '@/api/bible.js'
import { t } from '@/i18n/index.js'
import { getUser, setUser } from '@/utils/session.js'
import { getToken } from '@/utils/storageKeys.js'
import { absolutizeMedia, resolveAuthedMediaSrc } from '@/utils/media.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import {
	canPersistAssets,
	downloadAndPersist,
	hasPersistedAsset,
	peekLocalAsset,
} from '@/utils/assetCache.js'
import { safePlay, hasH5UserActivation, unlockH5Audio } from '@/utils/h5Audio.js'
import {
	listenSession,
	listenAudio,
	writeListenSnapshot,
	destroyListenAudio,
	bindListenHandlers,
	startSessionTick,
	stopListenTicks,
	isAppPlusRuntime,
} from '@/utils/listenSession.js'
import {
	VOICE_VOL_DEFAULT,
	VOICE_VOL_KEY,
	readStoredVol,
	setCtxVolume,
	sliderPercent,
	writeStoredVol,
} from '@/utils/audioVolume.js'
import { enableAudioMix, mixBgmUnlock, mixBgmPause } from '@/utils/mixBgmPlayer.js'
import {
	correctSpokenDuration,
	rawVerseSpans,
	resumeSecForVerse,
	verseFractionAt,
	verseSpokenAt,
} from '@/utils/verseCue.js'

const RATES = [0.75, 1, 1.25, 1.5]
const VOICES = [
	{ key: 'female', label: 'Female' },
	{ key: 'male', label: 'Male' },
]
const LISTEN_BG = '/static/ui/listen.png'

export function useListenPlayback({ syncBgm, clearSleepTimer, sleepUntilEnd }) {
	const statusBar = getStatusBarPx()
	const bookKey = ref('genesis')
	const bookName = ref('')
	const translation = ref('web')
	const chapter = ref(1)
	const chapterCount = ref(0)
	const verses = ref([])
	const audioUrl = ref('')
	/** 当前音色对应的章节朗读 URL，下载整书时用来替换章号 */
	const chapterAudioUrl = ref('')
	/** 本章接口下发的男女声地址，切换音色时直接取，不再改路径 */
	const voiceAudio = { male: '', female: '' }
	const voiceDuration = { male: 0, female: 0, fallback: 0 }
	const durationSec = ref(0)
	const currentSec = ref(0)
	const activeVerse = ref(0)
	const scrollInto = ref('')
	const playing = ref(false)
	const voiceVolume = ref(readStoredVol(VOICE_VOL_KEY, VOICE_VOL_DEFAULT))
	const voiceVolPct = computed(() => Math.round(voiceVolume.value * 100))
	const rateIdx = ref(1)
	const voiceIdx = ref(1)
	const autoplay = ref(true)
	const startVerse = ref(0)
	const listenBg = ref(LISTEN_BG)
	const mini = ref(false)
	const loading = ref(false)
	const downloaded = ref(false)
	const downloadBusy = ref(false)
	const downloadTitle = ref('')
	const downloadCount = ref('')
	/** 整本书下载的真实进度 0-100（字节进度加权到章数） */
	const downloadPct = ref(0)
	const voiceLoading = ref(false)
	const badgeOpen = ref(false)
	const badgeItems = ref([])
	
	/** Voice 切换中：onError 时回退音色，不掉进 demo 进度条 */
	let voiceSwitchPending = false
	let voiceSwitchPrevIdx = 1
	/** 播放器已报出真实时长：高亮按这个时长走，不再按 128kbps 估算拉长 */
	let durationFromPlayer = false
	/**
	 * 播放器时长连续两次报同一个值才算数（换源瞬间常先报旧文件/极短的假时长）。
	 * 接口下发的 audio_duration_sec 可能是码率估算值，偏长会把整章时间轴拉长，
	 * 高亮就会一路落后于声音（文字还没到下一节、音频已经到了）。
	 */
	let playerDurRaw = 0
	let playerDurStable = 0
	function notePlayerDuration(d) {
		const n = Number(d) || 0
		if (!(n > 1)) return 0
		if (playerDurRaw > 1 && Math.abs(n - playerDurRaw) <= 0.4) playerDurStable = n
		playerDurRaw = n
		return playerDurStable
	}
	function resetPlayerDurationProbe() {
		playerDurRaw = 0
		playerDurStable = 0
	}
	let listenStart = Date.now()
	let audioErrorCount = 0
	let chapterSwitching = false
	let chapterEnded = false
	const LISTEN_TASK_SEC = 60
	function localDateIso() {
		const d = new Date()
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
	}

	function listenTaskToastKey() {
		return `manna_listen_task_toast_${localDateIso()}`
	}

	function listenAccKey() {
		return `manna_listen_acc_${localDateIso()}`
	}

	function alreadyToastedListenTask() {
		try { return !!uni.getStorageSync(listenTaskToastKey()) } catch (e) { return false }
	}

	function markListenTaskToasted() {
		try { uni.setStorageSync(listenTaskToastKey(), '1') } catch (e) {}
	}

	function maybeToastListenTask(d, flushedSec) {
		const added = Math.max(0, Number(flushedSec) || 0)
		const accKey = listenAccKey()
		let acc = 0
		try { acc = Number(uni.getStorageSync(accKey)) || 0 } catch (e) {}
		const prevAcc = acc
		acc += added
		try { uni.setStorageSync(accKey, acc) } catch (e) {}
		if (alreadyToastedListenTask()) return
		const readSec = Number(d?.read_sec || 0)
		const prevRead = readSec - added
		const crossedByApi = readSec >= LISTEN_TASK_SEC && prevRead < LISTEN_TASK_SEC
		const crossedByAcc = readSec <= 0 && prevAcc < LISTEN_TASK_SEC && acc >= LISTEN_TASK_SEC
		if (!crossedByApi && !crossedByAcc) {
			if (readSec >= LISTEN_TASK_SEC || acc >= LISTEN_TASK_SEC) markListenTaskToasted()
			return
		}
		markListenTaskToasted()
		if (chapterEnded) return
		if (Number(d?.manna_delta || 0) > 0) return
		uni.showToast({ title: t('listen_task_done'), icon: 'none' })
	}
	
	function applyReadGrant(d) {
		const earned = Array.isArray(d?.newly_earned) ? d.newly_earned.filter(Boolean) : []
		if (earned.length) {
			badgeItems.value = earned
			badgeOpen.value = true
		}
		const delta = Number(d?.manna_delta || 0)
		if (delta <= 0) return
		uni.showToast({ title: t('manna_granted', { n: delta }), icon: 'none' })
		try {
			const u = getUser() || {}
			if (typeof d.balance === 'number') setUser({ ...u, manna_balance: d.balance })
		} catch (e) {}
	}
	
	function flushListenProgress() {
		const sec = Math.round((Date.now() - listenStart) / 1000)
		listenStart = Date.now()
		if (sec <= 0) return
		if (!getToken()) return
		apiBibleReadProgress({
			seconds: sec,
			book_key: bookKey.value,
			chapter: chapter.value,
			local_date: localDateIso(),
		}).then((res) => {
			const d = res?.results || {}
			applyReadGrant(d)
			maybeToastListenTask(d, sec)
		}).catch(() => {
			if (!getToken()) return
			if (sec >= 60) uni.showToast({ title: t('network_error'), icon: 'none' })
		})
	}
	
	const voiceLabel = computed(() => VOICES[voiceIdx.value]?.label || 'Male')
	const voiceKey = computed(() => VOICES[voiceIdx.value]?.key || 'male')
	const rateLabel = computed(() => {
		const r = RATES[rateIdx.value]
		const n = Number(r)
		if (!Number.isFinite(n) || n <= 0) return '1x'
		return `${n}x`
	})
	const seekSec = ref(0)
	const seeking = ref(false)
	let seekLockUntil = 0
	
	const sliderMax = computed(() => {
		const d = Number(durationSec.value) || 0
		return d > 0.01 ? d : 1
	})
	const sliderValue = computed(() => {
		const v = seeking.value ? seekSec.value : currentSec.value
		return Math.max(0, Math.min(sliderMax.value, Number(v) || 0))
	})
	const progressPct = computed(() => {
		const d = durationSec.value || 1
		const sec = seeking.value ? seekSec.value : currentSec.value
		return Math.max(0, Math.min(100, (sec / d) * 100))
	})
	
	function previewSeek(sec) {
		const dur = Number(durationSec.value) || 0
		const next = Math.max(0, Math.min(dur, Number(sec) || 0))
		seekSec.value = next
		currentSec.value = next
	}
	
	function audioReadyState(ctx) {
		try {
			if (ctx && ctx._audio && typeof ctx._audio.readyState === 'number') return ctx._audio.readyState
		} catch (e) {}
		return 0
	}
	
	function seekWhenReady(ctx, sec, opts = {}) {
		if (!ctx) return
		const target = Math.max(0, Number(sec) || 0)
		const apply = () => {
			try { ctx.seek(target) } catch (err) {}
		}
		// 刚换过 src 时旧 duration 可能还在，不能据此立刻 seek
		if (!opts.afterSrcChange) {
			const dur = Number(ctx.duration) || 0
			if (dur > 0 || audioReadyState(ctx) >= 1) {
				apply()
				return
			}
		}
		const el = ctx._audio
		if (el && typeof el.addEventListener === 'function') {
			const once = () => {
				try { el.removeEventListener('loadedmetadata', once) } catch (e) {}
				apply()
			}
			try { el.addEventListener('loadedmetadata', once) } catch (e) {}
			setTimeout(() => {
				try { el.removeEventListener('loadedmetadata', once) } catch (e) {}
				apply()
			}, 800)
			return
		}
		// App InnerAudioContext：等 canplay 再 seek，否则常被静默忽略并从头播
		if (typeof ctx.onCanplay === 'function') {
			let done = false
			const once = () => {
				if (done) return
				done = true
				apply()
			}
			try { ctx.onCanplay(once) } catch (e) {}
			setTimeout(once, opts.afterSrcChange ? 700 : 600)
			return
		}
		setTimeout(apply, opts.afterSrcChange ? 400 : 200)
	}
	
	function commitSeek(sec) {
		const dur = Number(durationSec.value) || 0
		const next = Math.max(0, Math.min(dur, Number(sec) || 0))
		seeking.value = false
		currentSec.value = next
		seekSec.value = next
		listenSession.currentSec = next
		resetPacedClock(next)
		seekLockUntil = Date.now() + 800
		const ctx = listenAudio.inner
		if (ctx) {
			const cur = Number(ctx.currentTime) || 0
			if (Math.abs(cur - next) >= 0.25) seekWhenReady(ctx, next)
		}
		syncActiveFromTime(next)
	}
	
	function onSeekChanging(e) {
		const next = Number(e.detail && e.detail.value)
		if (Number.isNaN(next)) return
		seeking.value = true
		previewSeek(next)
	}
	
	function onSeekChange(e) {
		const next = Number(e.detail && e.detail.value)
		if (Number.isNaN(next)) {
			seeking.value = false
			return
		}
		if (seeking.value) {
			commitSeek(next)
			return
		}
		const pushed = Number(sliderValue.value) || 0
		if (Math.abs(next - pushed) < 0.45) return
		commitSeek(next)
	}
	
	function genderFromUrl(url) {
		const m = String(url || '').match(/\/(male|female)\//i)
		return m ? m[1].toLowerCase() : ''
	}
	
	function withVoiceGender(url, gender) {
		if (!url) return ''
		if (/\/(male|female)\//i.test(url)) {
			return url.replace(/\/(male|female)\//i, `/${gender}/`)
		}
		return url
	}
	
	function rememberChapterVoices(d) {
		const male = absolutizeMedia(d.audio_url_male || '')
		const female = absolutizeMedia(d.audio_url_female || '')
		const legacy = absolutizeMedia(d.audio_url || '')
		voiceAudio.male = male
		voiceAudio.female = female
		if (!male && !female && legacy) {
			const g = genderFromUrl(legacy)
			if (g === 'female') voiceAudio.female = legacy
			else voiceAudio.male = legacy
		}
		const base = Number(d.audio_duration_sec) || 0
		voiceDuration.male = Number(d.audio_duration_sec_male) || base
		voiceDuration.female = Number(d.audio_duration_sec_female) || base
		voiceDuration.fallback = base
	}

	function durationForVoice(gender) {
		const g = gender === 'female' ? 'female' : 'male'
		return Number(voiceDuration[g]) || Number(voiceDuration.fallback) || 0
	}

	function buildAudioUrl(gender) {
		const g = gender === 'female' ? 'female' : 'male'
		if (voiceAudio.male || voiceAudio.female) return voiceAudio[g] || ''
		const cur = chapterAudioUrl.value || audioUrl.value
		if (cur && /\/(male|female)\//i.test(cur)) {
			return withVoiceGender(cur, g)
		}
		const book = (bookName.value || bookKey.value || '').trim()
		if (!book) return ''
		const tr = String(translation.value || 'web').toUpperCase()
		const ch = String(Number(chapter.value) || 1).padStart(3, '0')
		return absolutizeMedia(`/bible-media/${tr}/${g}/${book}/${ch}.mp3`)
	}
	
	onLoad((q) => {
		if (q?.book) bookKey.value = String(q.book)
		if (q?.chapter) chapter.value = Number(q.chapter) || 1
		if (q?.name) bookName.value = decodeURIComponent(String(q.name))
		if (q?.verse) startVerse.value = Number(q.verse) || 0
		if (q?.translation) {
			translation.value = String(q.translation)
			try { uni.setStorageSync('manna_bible_translation', translation.value) } catch (e) {}
		} else {
			translation.value = uni.getStorageSync('manna_bible_translation') || 'web'
		}
		autoplay.value = String(q?.autoplay || '1') !== '0'
	})
	
	function fmt(sec) {
		const s = Math.max(0, Math.floor(Number(sec) || 0))
		const m = Math.floor(s / 60)
		const r = s % 60
		return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
	}
	
	function playbackDuration() {
		// 写入时已是最终轴：播放器原样，或接口已校正一次；禁止再二次处理
		return Number(durationSec.value) || 0
	}

	/** trustPlayer=播放器时长原样；否则接口估算只校正一次 */
	function adoptDuration(raw, opts = {}) {
		const n = Number(raw) || 0
		if (n <= 1) return Number(durationSec.value) || 0
		const next = opts.trustPlayer ? n : correctSpokenDuration(n, verses.value)
		if (!(next > 1)) return Number(durationSec.value) || 0
		const cur = Number(durationSec.value) || 0
		if (!opts.replace && !opts.trustPlayer && cur > 8 && next < cur * 0.6) return cur
		durationFromPlayer = !!opts.trustPlayer
		durationSec.value = next
		listenSession.durationSec = next
		return next
	}

	function verseAtPlaybackTime(tSec) {
		return verseSpokenAt(verses.value, tSec, playbackDuration())
	}

	function timeAtVerse(verse) {
		const n = Number(verse) || 0
		if (n <= 0) return 0
		const w = rawVerseSpans(verses.value, playbackDuration()).find((item) => item.verse === n)
		return w ? w.start : 0
	}
	
	let scrollToken = 0
	
	function queueScrollToVerse(v) {
		if (!v || mini.value) return
		const id = 'lv-' + v
		const token = ++scrollToken
		nextTick(() => {
			if (token !== scrollToken || mini.value || activeVerse.value !== v) return
			if (scrollInto.value === id) {
				scrollInto.value = ''
				nextTick(() => {
					if (token !== scrollToken) return
					scrollInto.value = id
				})
				return
			}
			scrollInto.value = id
		})
	}
	
	let pacedAt = 0
	let pacedSec = 0

	function resetPacedClock(sec) {
		pacedAt = 0
		pacedSec = Math.max(0, Number(sec) || 0)
	}

	/** 系统 currentTime 偶发前跳时，按真实经过时间卡住，避免高亮连跳 */
	function paceMediaTime(tSec) {
		const raw = Math.max(0, Number(tSec) || 0)
		const now = Date.now()
		const rate = Number(RATES[rateIdx.value]) || 1
		if (!pacedAt || raw + 0.8 < pacedSec) {
			pacedAt = now
			pacedSec = raw
			return raw
		}
		const dt = Math.max(0, (now - pacedAt) / 1000)
		const cap = pacedSec + dt * rate + 0.08
		const next = raw > cap ? cap : raw
		pacedAt = now
		pacedSec = next
		return next
	}

	function syncActiveFromTime(tSec) {
		if (!verses.value.length) return
		const v = verseAtPlaybackTime(tSec)
		if (!v || v === activeVerse.value) return
		activeVerse.value = v
		listenSession.verse = v
		queueScrollToVerse(v)
	}
	
	function stopTick() {
		stopListenTicks()
	}
	
	function pausePlayback() {
		if (listenAudio.inner) {
			try { listenAudio.inner.pause() } catch (e) {}
			// App-PLUS: pause() 可能不立即生效，补一次
			if (isAppPlusRuntime()) {
				setTimeout(() => {
					if (!playing.value && listenAudio.inner) {
						try {
							const a = listenAudio.inner._audio || listenAudio.inner
							if (a && a.paused === false) listenAudio.inner.pause()
						} catch (e) {}
					}
				}, 200)
			}
			stopTick()
		} else {
			stopTick()
		}
		playing.value = false
		listenSession.playing = false
		syncBgm()
	}
	
	function canAdvanceChapter() {
		const cur = Number(chapter.value || 1)
		const maxCh = Number(chapterCount.value) || 0
		// 有明确章数：未到最后一章；章数未知：仍允许尝试下一章
		if (maxCh > 0) return cur < maxCh
		return cur >= 1
	}

	function playbackAtEnd() {
		if (chapterEnded) return true
		const dur = Number(durationSec.value) || Number(listenSession.durationSec) || 0
		const pos = Number(currentSec.value) || Number(listenSession.currentSec) || 0
		return dur > 1 && pos >= dur - 0.5
	}

	function stopAtChapterEnd(toastKey) {
		playing.value = false
		listenSession.playing = false
		stopTick()
		activeVerse.value = 0
		syncBgm()
		uni.showToast({ title: t(toastKey), icon: 'none' })
	}

	async function onChapterEnded() {
		if (chapterEnded || chapterSwitching) return
		chapterEnded = true
		flushListenProgress()
		if (sleepUntilEnd.value) {
			sleepUntilEnd.value = false
			stopAtChapterEnd('listen_timer_done')
			return
		}
		const cur = Number(chapter.value || 1)
		const maxCh = Number(chapterCount.value) || 0
		if (maxCh > 0 && cur >= maxCh) {
			stopAtChapterEnd('listen_book_done')
			return
		}
		// 本章结束 → 自动衔接下一章并继续播放
		const ok = await changeChapter(1, { play: true, fromAuto: true })
		if (!ok) {
			// 投机切章失败或已是末章
			if (Number(chapter.value) === cur) {
				stopAtChapterEnd('listen_book_done')
			}
		}
	}
	
	function remoteAudioSrc() {
		return buildAudioUrl(voiceKey.value) || audioUrl.value || ''
	}
	
	function playSrcFor(remote) {
		const src = (remote || '').trim()
		if (!src) return ''
		if (hasPersistedAsset(src)) return peekLocalAsset(src) || src
		return src
	}
	
	function audioUrlForChapter(ch) {
		const g = voiceKey.value
		const padded = String(Number(ch) || 1).padStart(3, '0')
		const cur = chapterAudioUrl.value || audioUrl.value
		if (cur && /\/\d{3}\.mp3/i.test(cur)) {
			return withVoiceGender(cur, g).replace(/\/\d{3}\.mp3/i, `/${padded}.mp3`)
		}
		const book = (bookName.value || bookKey.value || '').trim()
		if (!book) return ''
		const tr = String(translation.value || 'web').toUpperCase()
		return absolutizeMedia(`/bible-media/${tr}/${g}/${book}/${padded}.mp3`)
	}

	function bookChapterUrls() {
		const maxCh = Math.max(1, Number(chapterCount.value) || 1)
		const urls = []
		for (let i = 1; i <= maxCh; i++) {
			const u = audioUrlForChapter(i)
			if (u) urls.push(u)
		}
		return urls
	}

	function isCellularType(nt) {
		const n = String(nt || '').toLowerCase()
		return n === '2g' || n === '3g' || n === '4g' || n === '5g' || n === 'cellular' || n === 'wwan'
	}

	function confirmIfCellular() {
		return new Promise((resolve) => {
			uni.getNetworkType({
				success: (res) => {
					if (!isCellularType(res.networkType)) {
						resolve(true)
						return
					}
					uni.showModal({
						title: t('listen_download_cellular'),
						cancelText: t('cancel'),
						confirmText: t('continue'),
						success: (r) => resolve(!!r.confirm),
						fail: () => resolve(false),
					})
				},
				fail: () => resolve(true),
			})
		})
	}

	function refreshDownloadedFlag() {
		// 下载进行中一律不刷新：中途已有部分章节落盘，避免半成品被误判成"整本已下载"
		if (downloadBusy.value) return
		if (!canPersistAssets()) {
			downloaded.value = false
			return
		}
		// 章节数还没拿到时 bookChapterUrls() 只返回 1 条，every() 会被单章缓存骗过去
		if (!(Number(chapterCount.value) > 0)) {
			downloaded.value = false
			return
		}
		const urls = bookChapterUrls()
		downloaded.value = urls.length > 0 && urls.every((u) => hasPersistedAsset(u))
	}
	
	function h5SaveAudio(url) {
		if (typeof document === 'undefined') return Promise.resolve(false)
		return resolveAuthedMediaSrc(url).then((src) => {
			const book = (bookName.value || bookKey.value || 'chapter').replace(/\s+/g, '_')
			const name = `${book}-${String(chapter.value).padStart(3, '0')}-${voiceKey.value}.mp3`
			const a = document.createElement('a')
			a.href = src
			a.download = name
			a.rel = 'noopener'
			document.body.appendChild(a)
			a.click()
			a.remove()
			return true
		}).catch(() => false)
	}
	
	function innerIsLive() {
		const a = listenAudio.inner
		if (!a) return false
		if (listenSession.playing) return true
		try {
			if (a._audio && a._audio.paused === false) return true
			if (typeof a.paused === 'boolean' && a.paused === false) return true
		} catch (e) {}
		return false
	}
	
	function chapterFromMediaUrl(url) {
		const path = decodeURIComponent(String(url || '').split('?')[0])
		const m = path.match(/\/(\d{1,3})\.mp3$/i)
		return m ? Number(m[1]) : 0
	}

	function sameAudioSrc(a, b) {
		const na = decodeURIComponent(String(a || '').split('?')[0])
		const nb = decodeURIComponent(String(b || '').split('?')[0])
		if (!na || !nb) return false
		const ca = chapterFromMediaUrl(na)
		const cb = chapterFromMediaUrl(nb)
		// 001.mp3 与 1.mp3 / 011.mp3 不能当成同一文件，否则切章后仍播第一章
		if (ca && cb && ca !== cb) return false
		return na === nb || na.endsWith(nb) || nb.endsWith(na)
	}
	
	function softDestroyInnerSync() {
		const a = listenAudio.inner
		listenAudio.inner = null
		listenAudio.handlersBound = false
		if (!a) return null
		try { a.pause() } catch (e) {}
		// App：禁止 destroy，否则易整进程崩溃
		if (isAppPlusRuntime()) return a
		setTimeout(() => {
			try { a.stop() } catch (e) {}
			try { a.destroy() } catch (e) {}
		}, 100)
		return a
	}

	async function softDestroyInner() {
		softDestroyInnerSync()
		await new Promise((r) => setTimeout(r, isAppPlusRuntime() ? 40 : 110))
	}

	function destroyAudio() {
		stopTick()
		softDestroyInnerSync()
		playing.value = false
		listenSession.playing = false
		syncBgm()
	}
	
	function startRealTick() {
		startSessionTick()
	}
	
	function startDemoPlayback() {
		destroyAudio()
		playing.value = true
		listenSession.playing = true
		syncBgm()
		listenAudio.demoTimer = setInterval(() => {
			if (seeking.value || Date.now() < seekLockUntil) return
			currentSec.value = Math.min(durationSec.value, currentSec.value + 1)
			listenSession.currentSec = currentSec.value
			syncActiveFromTime(currentSec.value)
			if (currentSec.value >= durationSec.value) {
				onChapterEnded()
			}
		}, 1000)
	}
	
	function wireListenCallbacks() {
		listenAudio.onPlay = () => {
			playing.value = true
			applyVoiceVolume()
			syncBgm()
			const want = Number(listenAudio.voiceSeekTarget) || 0
			const ctx = listenAudio.inner
			if (want > 0.35 && ctx) {
				const cur = Number(ctx.currentTime) || 0
				if (cur + 0.8 < want) {
					try { ctx.seek(want) } catch (e) {}
				}
			}
		}
		listenAudio.onPause = () => {
			playing.value = false
			syncBgm()
		}
		listenAudio.onEnded = () => {
			onChapterEnded()
		}
		listenAudio.onTick = (tSec, d) => {
			if (voiceSwitchPending) return
			if (d > 1) {
				const curDur = Number(durationSec.value) || 0
				const stable = notePlayerDuration(d)
				if (stable > 1) {
					// 播放器稳定时长原样用，各章统一，不再码率二次处理
					adoptDuration(stable, { replace: true, trustPlayer: true })
				} else if (durationFromPlayer) {
					const glitch = curDur > 8 && d < curDur * 0.75
					if (!glitch) adoptDuration(d, { replace: true, trustPlayer: true })
				}
			}
			if (seeking.value || Date.now() < seekLockUntil) return
			const want = Number(listenAudio.voiceSeekTarget) || 0
			let shown = Number(tSec) || 0
			let holding = false
			if (want > 0.4) {
				if (shown + 1.2 < want) {
					shown = want
					holding = true
				} else {
					listenAudio.voiceSeekTarget = 0
					resetPacedClock(shown)
				}
			}
			const paced = holding ? shown : paceMediaTime(shown)
			currentSec.value = paced
			listenSession.currentSec = paced
			if (!mini.value && !listenSession.mini) syncActiveFromTime(paced)
			if (d > 1 && paced >= d - 0.35) onChapterEnded()
		}
		listenAudio.onError = () => {
			if (seeking.value || Date.now() < seekLockUntil) return
			if (voiceSwitchPending) {
				voiceSwitchPending = false
				voiceLoading.value = false
				voiceIdx.value = voiceSwitchPrevIdx
				audioUrl.value = buildAudioUrl(voiceKey.value) || chapterAudioUrl.value
				refreshDownloadedFlag()
				if (listenAudio.inner) {
					softDestroyInnerSync()
				}
				playing.value = false
				listenSession.playing = false
				uni.showToast({ title: t('listen_voice_fail'), icon: 'none' })
				return
			}
			playing.value = false
			listenSession.playing = false
			uni.showToast({ title: t('bible_audio_fail'), icon: 'none' })
		}
	}
	
	function applyPlaybackRate(ctx, rate) {
		if (!ctx) return
		try { ctx.playbackRate = rate } catch (e) {}
		try {
			if (ctx._audio) ctx._audio.playbackRate = rate
		} catch (e) {}
	}

	function applyVoiceVolume(ctx = listenAudio.inner) {
		setCtxVolume(ctx, voiceVolume.value)
	}

	function applyVoiceVolumeLive(vol) {
		const n = Number(vol)
		if (!Number.isFinite(n)) return
		voiceVolume.value = Math.max(0, Math.min(1, n))
		applyVoiceVolume()
	}

	function setVoiceVolume(vol) {
		applyVoiceVolumeLive(vol)
		writeStoredVol(VOICE_VOL_KEY, voiceVolume.value)
	}

	function onVoiceVolChanging(e) {
		const pct = sliderPercent(e)
		if (pct == null) return
		applyVoiceVolumeLive(pct / 100)
	}

	function onVoiceVolChange(e) {
		const pct = sliderPercent(e)
		if (pct == null) return
		setVoiceVolume(pct / 100)
	}
	
	function armInnerMix(ctx) {
		if (!ctx) return
		enableAudioMix()
		try { ctx.obeyMuteSwitch = false } catch (e) {}
		try { ctx.mixWithOthers = true } catch (e) {}
		try { ctx.sessionCategory = 'playback' } catch (e) {}
	}

	async function ensureAudio(opts = {}) {
		const remote = remoteAudioSrc()
		let src = playSrcFor(remote)
		if (!src) return false
		try {
			src = await resolveAuthedMediaSrc(src)
		} catch (e) {
			return false
		}
		if (!src) return false
		audioUrl.value = remote || src
		listenAudio.remoteSrc = remote || src
		audioErrorCount = 0
		wireListenCallbacks()
		enableAudioMix()
		if (listenAudio.inner) {
			const cur = listenAudio.inner.src || ''
			if (!sameAudioSrc(cur, src)) {
				resetPlayerDurationProbe()
				// 换男女声时不要 stop：iOS/安卓会把随后的 seek 丢掉，从第 1 节重播
				if (opts.softSwap) {
					try { listenAudio.inner.pause() } catch (e) {}
				} else {
					try { listenAudio.inner.stop() } catch (e) {}
				}
				listenAudio.inner.src = src
			}
			applyPlaybackRate(listenAudio.inner, RATES[rateIdx.value])
			applyVoiceVolume(listenAudio.inner)
			armInnerMix(listenAudio.inner)
			bindListenHandlers()
			return true
		}
		listenAudio.inner = uni.createInnerAudioContext()
		listenAudio.inner.src = src
		applyPlaybackRate(listenAudio.inner, RATES[rateIdx.value])
		applyVoiceVolume(listenAudio.inner)
		armInnerMix(listenAudio.inner)
		bindListenHandlers()
		return true
	}

	function waitForDuration(ctx, timeout = 1400, opts = {}) {
		const ignore = Number(opts.ignoreDuration) || 0
		const raw = () => {
			const d = Number(ctx && ctx.duration) || 0
			return d > 1 && Number.isFinite(d) ? d : 0
		}
		// 换 src 后 duration 会短暂留着上一个声音的值，不能拿来对齐高亮
		const fresh = () => {
			const d = raw()
			if (!d) return 0
			if (ignore > 1 && Math.abs(d - ignore) < 0.35) return 0
			const fixed = correctSpokenDuration(d, verses.value)
			const chars = (verses.value || []).reduce(
				(sum, v) => sum + Math.max(8, String(v.text || v.content || '').length),
				0,
			)
			const maxRate = Number(opts.maxRate) || 18
			if (chars >= 24 && fixed > 1 && chars / fixed > maxRate) return 0
			return d
		}
		if (!ignore && fresh()) return Promise.resolve(fresh())
		return new Promise((resolve) => {
			let done = false
			let timer = null
			const finish = (allowStale) => {
				if (done) return
				done = true
				if (timer) clearInterval(timer)
				resolve((fresh() || (allowStale ? raw() : 0)) || 0)
			}
			timer = setInterval(() => {
				if (fresh()) finish(false)
			}, 80)
			try {
				ctx.onCanplay(() => {
					if (fresh()) finish(false)
				})
			} catch (e) {}
			setTimeout(() => finish(true), timeout)
		})
	}

	function seekVoiceTo(ctx, sec) {
		return new Promise((resolve) => {
			if (!ctx) {
				resolve(false)
				return
			}
			const target = Math.max(0, Number(sec) || 0)
			if (target < 0.05) {
				resolve(true)
				return
			}
			listenAudio.voiceSeekTarget = target
			const started = Date.now()
			let kicks = 0
			const kick = () => {
				try { ctx.seek(target) } catch (e) {}
			}
			kick()
			const timer = setInterval(() => {
				const cur = Number(ctx.currentTime) || 0
				const near = Math.abs(cur - target) <= 0.9
				if (near || Date.now() - started > 2200) {
					clearInterval(timer)
					if (!near) kick()
					resolve(near || Math.abs((Number(ctx.currentTime) || 0) - target) <= 1.4)
					return
				}
				kicks += 1
				if (kicks % 2 === 0) kick()
			}, 140)
		})
	}
	
	function watchPlayStart() {
		if (listenAudio.playWatch) clearTimeout(listenAudio.playWatch)
		listenAudio.playWatch = setTimeout(() => {
			listenAudio.playWatch = null
			const tSec = Number(listenAudio.inner && listenAudio.inner.currentTime) || 0
			if (tSec > 0.05 && !playing.value) {
				playing.value = true
				listenSession.playing = true
				startRealTick()
				syncBgm()
			}
		}, 600)
	}
	
	async function toggle() {
		if (playing.value || innerIsLive()) {
			pausePlayback()
			return
		}
		unlockH5Audio()
		mixBgmUnlock()
		const atEnd = playbackAtEnd()
		chapterEnded = false
		if (atEnd && canAdvanceChapter()) {
			await changeChapter(1, { play: true })
			return
		}
		if (atEnd && listenAudio.inner) {
			try { listenAudio.inner.seek(0) } catch (e) {}
			currentSec.value = 0
			listenSession.currentSec = 0
		}
		if (await ensureAudio()) {
			audioErrorCount = 0
			safePlay(listenAudio.inner).then((ok) => {
				if (!ok) {
					playing.value = false
					listenSession.playing = false
				}
			})
			syncBgm()
			watchPlayStart()
			return
		}
		startDemoPlayback()
	}
	
	function cycleRate() {
		rateIdx.value = (rateIdx.value + 1) % RATES.length
		if (listenAudio.inner) {
			try { listenAudio.inner.playbackRate = RATES[rateIdx.value] } catch (e) {}
			try {
				if (listenAudio.inner._audio) listenAudio.inner._audio.playbackRate = RATES[rateIdx.value]
			} catch (e) {}
		}
		uni.showToast({ title: rateLabel.value, icon: 'none' })
	}
	
	async function reloadVoiceAudio() {
		const wasPlaying = playing.value || innerIsLive()
		const pos = Number(currentSec.value) || Number(listenSession.currentSec) || 0
		const keepVerse = Number(activeVerse.value) || Number(listenSession.verse) || 0
		const oldDur = playbackDuration()
		const frac = keepVerse > 0
			? verseFractionAt(verses.value, keepVerse, pos, oldDur)
			: 0
		const prevMediaDur = Number(listenAudio.inner && listenAudio.inner.duration) || 0
		const oldRaw = prevMediaDur > 1 ? prevMediaDur : (oldDur > 1 ? oldDur : 0)
		const fileFrac = oldRaw > 1 ? Math.max(0, Math.min(0.985, pos / oldRaw)) : 0
		const nextUrl = buildAudioUrl(voiceKey.value)
		if (!nextUrl) return false
		audioUrl.value = nextUrl
		chapterAudioUrl.value = nextUrl
		voiceSwitchPending = true
		voiceLoading.value = true
		playing.value = false
		listenSession.playing = false

		try {
			// 配乐占用音频会话时，安卓/iOS 换源 seek 会失败，先停配乐再对齐同一节
			mixBgmPause()
			if (isAppPlusRuntime()) {
				await new Promise((r) => setTimeout(r, 80))
			}
			if (listenAudio.inner) {
				try { listenAudio.inner.pause() } catch (e) {}
				stopTick()
			}

			if (!(await ensureAudio({ softSwap: true }))) {
				listenAudio.voiceSeekTarget = 0
				return false
			}
			const ctx = listenAudio.inner
			if (!ctx) {
				listenAudio.voiceSeekTarget = 0
				return false
			}

			const probed = await waitForDuration(ctx, 1600, {
				ignoreDuration: prevMediaDur,
				maxRate: 26,
			})
			const reusedOld = prevMediaDur > 1 && probed > 1 && Math.abs(probed - prevMediaDur) < 0.35
			const newRaw = probed > 1 && !reusedOld ? probed : 0
			const newDur = newRaw > 1
				? adoptDuration(newRaw, { replace: true, trustPlayer: true })
				: (oldRaw > 1 ? oldRaw : playbackDuration())
			const byFile = newDur > 1 ? fileFrac * Math.max(0, newDur - 0.12) : 0
			const byVerse = keepVerse > 0
				? resumeSecForVerse(verses.value, keepVerse, frac, newDur)
				: 0
			const target = byFile > 0.2 ? byFile : byVerse

			function placeAt(sec) {
				const t = Math.max(0, Number(sec) || 0)
				seekLockUntil = 0
				currentSec.value = t
				listenSession.currentSec = t
				resetPacedClock(t)
				syncActiveFromTime(t)
			}

			// 停住并跳到当前段落后再开播。play() 会把进度打回 0，开播后还要再跳一次。
			listenAudio.voiceSeekTarget = target
			placeAt(target)
			try { ctx.seek(target) } catch (e) {}
			if (!wasPlaying) {
				await seekVoiceTo(ctx, target)
				placeAt(target)
				listenAudio.voiceSeekTarget = 0
				voiceSwitchPending = false
				syncBgm()
				return true
			}
			const ok = await safePlay(ctx)
			if (!ok) {
				playing.value = false
				listenSession.playing = false
				listenAudio.voiceSeekTarget = 0
				voiceSwitchPending = false
				syncBgm()
				return false
			}
			await new Promise((r) => setTimeout(r, 80))
			await seekVoiceTo(ctx, target)
			placeAt(target)
			listenAudio.voiceSeekTarget = target
			voiceSwitchPending = false
			seekLockUntil = 0
			startRealTick()
			syncBgm()
			return true
		} finally {
			voiceLoading.value = false
		}
	}
	
	async function cycleVoice() {
		const prev = voiceIdx.value
		voiceIdx.value = (voiceIdx.value + 1) % VOICES.length
		voiceSwitchPrevIdx = prev
		voiceSwitchPending = true
		refreshDownloadedFlag()
		if (!(await reloadVoiceAudio())) {
			voiceSwitchPending = false
			voiceIdx.value = prev
			refreshDownloadedFlag()
			uni.showToast({ title: t('listen_voice_fail'), icon: 'none' })
			return
		}
		listenSession.voice = voiceKey.value
		uni.showToast({ title: voiceLabel.value, icon: 'none' })
	}
	async function dismissDownloadOverlay() {
		if (!downloadTitle.value && !downloadCount.value) return
		downloadTitle.value = ''
		downloadCount.value = ''
		await nextTick()
	}
	async function onDownload() {
		const urls = canPersistAssets() ? bookChapterUrls() : [remoteAudioSrc()].filter(Boolean)
		if (!urls.length) {
			uni.showToast({ title: t('listen_download_none'), icon: 'none' })
			return
		}
		if (canPersistAssets() && urls.every((u) => hasPersistedAsset(u))) {
			uni.showToast({ title: t('listen_downloaded'), icon: 'none' })
			return
		}
		if (downloadBusy.value) return
		if (!(await confirmIfCellular())) return
		downloadBusy.value = true
		downloadTitle.value = t('listen_download_busy')
		downloadCount.value = ''
		downloadPct.value = 0
		try {
			if (!canPersistAssets()) {
				const ok = await h5SaveAudio(urls[0])
				await dismissDownloadOverlay()
				uni.showToast({
					title: ok ? t('listen_download_ok') : t('listen_download_fail'),
					icon: 'none',
				})
				return
			}
			downloadCount.value = `1/${urls.length}`
			await nextTick()
			let okN = 0
			for (let i = 0; i < urls.length; i++) {
				const count = `${i + 1}/${urls.length}`
				if (downloadCount.value !== count) downloadCount.value = count
				if (hasPersistedAsset(urls[i])) {
					okN += 1
					downloadPct.value = Math.min(99, Math.round(((i + 1) / urls.length) * 100))
					continue
				}
				const res = await downloadAndPersist(urls[i], {
					// 已下完的章数 + 当前章字节进度，换算成整本百分比；收尾留给最后 1%
					onProgress: (p) => {
						const pct = Math.min(99, Math.round(((i + p / 100) / urls.length) * 100))
						if (pct !== downloadPct.value) downloadPct.value = pct
					},
				})
				if (res?.ok) okN += 1
				downloadPct.value = Math.min(99, Math.round(((i + 1) / urls.length) * 100))
			}
			// 收尾双重校验：既要每章都下载成功，也要文件真的落盘了，才允许标记"已下载"
			const allPersisted = urls.every((u) => hasPersistedAsset(u))
			downloaded.value = okN === urls.length && allPersisted
			downloadPct.value = 100
			await dismissDownloadOverlay()
			uni.showToast({
				title: downloaded.value ? t('listen_download_book_ok') : t('listen_download_fail'),
				icon: 'none',
			})
		} catch (e) {
			await dismissDownloadOverlay()
			uni.showToast({ title: t('listen_download_fail'), icon: 'none' })
		} finally {
			downloadBusy.value = false
			downloadTitle.value = ''
			downloadCount.value = ''
			downloadPct.value = 0
		}
	}
	
	function snapshotNow() {
		writeListenSnapshot({
			playing: playing.value,
			bookKey: bookKey.value,
			bookName: bookName.value,
			chapter: chapter.value,
			verse: Number(activeVerse.value) || 0,
			translation: translation.value,
			currentSec: currentSec.value,
			durationSec: durationSec.value,
		})
	}
	
	function writeReaderReturnIntent() {
		const verse = Number(activeVerse.value) || 0
		try {
			uni.setStorageSync('manna_bible_listen', {
				book: bookKey.value,
				chapter: Number(chapter.value) || 1,
				verse,
				name: bookName.value,
				translation: translation.value || 'web',
				autoplay: false,
			})
		} catch (e) {}
		try {
			uni.setStorageSync('manna_bible_progress', {
				book_key: bookKey.value,
				book_name: bookName.value,
				chapter: Number(chapter.value) || 1,
				verse,
				translation: translation.value || 'web',
			})
		} catch (e) {}
	}

	function leaveListenToBible() {
		const tab = '/pages/bible/bible'
		// App/安卓：用 switchTab 回读经 Tab，避免 navigateBack 与页销毁竞态；禁止 reLaunch（会像重启）
		if (isAppPlusRuntime()) {
			uni.switchTab({ url: tab })
			return
		}
		try {
			const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
			if (stack.length > 1) {
				uni.navigateBack({
					delta: 1,
					fail: () => uni.switchTab({ url: tab }),
				})
				return
			}
		} catch (e) {}
		uni.switchTab({ url: tab })
	}

	/** App 离开听经时：只停 JS 定时器/回调，绝对不 pause/destroy 原生音频 */
	function armAppLeaveWithoutNativeTeardown() {
		stopListenTicks()
		listenAudio.onPlay = null
		listenAudio.onPause = null
		listenAudio.onEnded = null
		listenAudio.onError = null
		listenAudio.onTick = null
		playing.value = false
		listenSession.playing = false
		listenSession.keepAlive = false
		listenSession.mini = false
		mini.value = false
		// 标记：onUnmounted 不要碰原生播放器
		listenAudio._appLeaveQuiet = true
		// 仅降音量，避免 pause/destroy；读经页落稳后再 pauseOrphanListenAudio
		try {
			if (listenAudio.inner) listenAudio.inner.volume = 0
		} catch (e) {}
	}

	function close() {
		flushListenProgress()
		snapshotNow()
		writeReaderReturnIntent()
		clearSleepTimer()
		// 关闭（非收起）：结束保活
		listenSession.keepAlive = false
		listenSession.mini = false
		mini.value = false
		if (isAppPlusRuntime()) {
			armAppLeaveWithoutNativeTeardown()
			leaveListenToBible()
			return
		}
		quietStopListenAudio()
		leaveListenToBible()
	}
	
	function collapseMini() {
		snapshotNow()
		writeReaderReturnIntent()
		mini.value = false
		// 收起小卡：续播保活（App 同样 keepAlive；离开瞬间不 pause/destroy）
		listenAudio.onPlay = null
		listenAudio.onPause = null
		listenAudio.onEnded = null
		listenAudio.onError = null
		listenAudio.onTick = null
		listenSession.keepAlive = true
		listenSession.mini = true
		try {
			if (listenAudio.inner) {
				setCtxVolume(listenAudio.inner, readStoredVol(VOICE_VOL_KEY, VOICE_VOL_DEFAULT))
			}
		} catch (e) {}
		// 优先信任播放意图（用户已点播放），仅在能确认音频确实已暂停时才降级。
		// 避免刚点播放、play 异步未落地就返回，把 playing 误记为 false
		let stillPlaying = !!playing.value || !!listenSession.playing
		try {
			if (listenAudio.inner && typeof listenAudio.inner.paused === 'boolean') {
				if (listenAudio.inner.paused === true) stillPlaying = false
			}
		} catch (e) {}
		listenSession.playing = stillPlaying
		playing.value = stillPlaying
		if (stillPlaying) startSessionTick()
		leaveListenToBible()
	}

	function quietStopListenAudio() {
		stopListenTicks()
		listenAudio.onPlay = null
		listenAudio.onPause = null
		listenAudio.onEnded = null
		listenAudio.onError = null
		listenAudio.onTick = null
		listenAudio.handlersBound = false
		playing.value = false
		listenSession.playing = false
		const a = listenAudio.inner
		listenAudio.inner = null
		try { mixBgmPause() } catch (e) {}
		if (a) {
			try { a.pause() } catch (e) {}
		}
		clearSleepTimer()
	}

	onBackPress(() => {
		collapseMini()
		return true
	})
	
	function expandMini() {
		mini.value = false
		listenSession.mini = false
	}
	
	async function changeChapter(delta, opts = {}) {
		if (chapterSwitching) return false
		// 自动衔接时若仍在 loading，稍等再切，避免直接放弃
		if (loading.value) {
			if (!opts.fromAuto && !opts.play) return false
			const start = Date.now()
			while (loading.value && Date.now() - start < 2500) {
				await new Promise((r) => setTimeout(r, 80))
			}
			if (loading.value) return false
		}
		const cur = Number(chapter.value || 1)
		const maxCh = Number(chapterCount.value) || 0
		const next = cur + Number(delta || 0)
		if (next < 1) return false
		if (maxCh > 0 && next > maxCh) return false
		chapterSwitching = true
		chapterEnded = false
		const wasPlaying = !!opts.play || playing.value || innerIsLive()
		const prevChapter = cur
		chapter.value = next
		currentSec.value = 0
		activeVerse.value = 0
		scrollInto.value = ''
		playing.value = false
		listenSession.playing = false
		stopTick()
		if (listenAudio.inner && !opts.play && !opts.fromAuto) {
			await softDestroyInner()
		} else if (listenAudio.inner) {
			try { listenAudio.inner.pause() } catch (e) {}
			if (!isAppPlusRuntime()) {
				try { listenAudio.inner.stop() } catch (e) {}
			}
		}
		syncBgm()
		try {
			await reloadChapter()
			// 章数未知时投机切到下一章：无经文且无音频 → 视为书末，回退
			const emptyNext = !verses.value.length && !String(audioUrl.value || '').trim()
			if (emptyNext && (opts.fromAuto || maxCh <= 0) && Number(delta) > 0) {
				chapter.value = prevChapter
				await reloadChapter()
				return false
			}
			snapshotNow()
			if (!wasPlaying) return true
			if (await ensureAudio()) {
				playing.value = true
				listenSession.playing = true
				const ok = await safePlay(listenAudio.inner)
				if (!ok) {
					playing.value = false
					listenSession.playing = false
				} else {
					watchPlayStart()
				}
			} else {
				startDemoPlayback()
			}
			return true
		} catch (e) {
			chapter.value = prevChapter
			try { await reloadChapter() } catch (err) {}
			return false
		} finally {
			chapterSwitching = false
		}
	}
	
	async function reloadChapter(opts = {}) {
		const preserveProgress = !!opts.preserveProgress
		resetPlayerDurationProbe()
		loading.value = true
		try {
			const res = await apiBibleChapter({
				translation: translation.value || 'web',
				book: bookKey.value,
				chapter: chapter.value,
			})
			const d = res?.results || {}
			if (d.translation) translation.value = String(d.translation)
			if (d.book_key) bookKey.value = String(d.book_key)
			if (d.book_name || d.book_title) bookName.value = d.book_name || d.book_title
			if (d.chapter) chapter.value = Number(d.chapter) || chapter.value
			const cc = Number(d.chapter_count)
			if (Number.isFinite(cc) && cc > 0) {
				chapterCount.value = Math.max(1, cc)
			}
			const list = Array.isArray(d.verses) ? d.verses : []
			verses.value = list.map((v, i) => ({
				verse: Number(v.verse) || i + 1,
				text: v.text || v.content || '',
			}))
			rememberChapterVoices(d)
			const picked = buildAudioUrl(voiceKey.value)
			audioUrl.value = picked
			chapterAudioUrl.value = picked
			if (!preserveProgress) {
				durationSec.value = 0
				durationFromPlayer = false
				adoptDuration(durationForVoice(voiceKey.value))
				if (verses.value.length) {
					activeVerse.value = verses.value[0].verse
					currentSec.value = 0
				}
			} else if (!durationSec.value) {
				adoptDuration(durationForVoice(voiceKey.value) || listenSession.durationSec)
			}
		} catch (e) {
			verses.value = []
			if (!preserveProgress) durationSec.value = 0
			uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		} finally {
			loading.value = false
		}
		refreshDownloadedFlag()
		if (activeVerse.value && !mini.value) queueScrollToVerse(activeVerse.value)
	}
	
	onMounted(async () => {
		wireListenCallbacks()
		const sameChapter =
			String(listenSession.bookKey || '') === String(bookKey.value || '')
			&& Number(listenSession.chapter) === Number(chapter.value)
		const restoring = !!(listenAudio.inner && listenSession.keepAlive && sameChapter)
		if (restoring) {
			const saved = listenSession.voice === 'female'
				? 'female'
				: (listenSession.voice === 'male' ? 'male' : (genderFromUrl(listenAudio.remoteSrc) || 'male'))
			const idx = VOICES.findIndex((v) => v.key === saved)
			voiceIdx.value = idx >= 0 ? idx : 1
		} else {
			voiceIdx.value = 1
			listenSession.voice = 'male'
		}
		await reloadChapter({ preserveProgress: restoring })
		snapshotNow()
		if (restoring) {
			playing.value = listenSession.playing
			// 以单例真实播放位置为权威进度：跨页期间 listenSession.currentSec 可能未同步，
			// 直接用复用的 inner.currentTime，避免重进后进度条显示 0:00（点播放才跳回真实进度）。
			const livePos = Number(listenAudio.inner && listenAudio.inner.currentTime) || 0
			currentSec.value = livePos > 0 ? livePos : (Number(listenSession.currentSec) || 0)
			listenSession.currentSec = currentSec.value
			if (listenSession.durationSec) adoptDuration(listenSession.durationSec)
			if (currentSec.value > 0) syncActiveFromTime(currentSec.value)
			listenSession.keepAlive = false
			listenSession.mini = false
			mini.value = false
			await ensureAudio()
			// 以音频真实播放状态校准：返回瞬间 play 异步未落地会把 playing 误记成 false，
			// 导致重进后 logo 显示暂停、但音频实际仍在后台播放
			if (innerIsLive()) playing.value = true
			if (playing.value) {
				listenSession.playing = true
				startRealTick()
				syncBgm()
			}
			return
		}
		await ensureAudio()
		if (startVerse.value > 0) {
			const t = timeAtVerse(startVerse.value)
			if (t > 0) {
				currentSec.value = t
				listenSession.currentSec = t
				activeVerse.value = startVerse.value
				if (listenAudio.inner) seekWhenReady(listenAudio.inner, t)
			}
		}
		// 兜底：复用既有单例但进度被重置为 0（如跨页/续播未命中 restoring），
		// 以单例真实播放位置同步进度，避免进度条显示 0:00、需手动点击才跳回真实进度。
		if (!currentSec.value && listenAudio.inner && Number(listenAudio.inner.currentTime) > 0) {
			const lp = Number(listenAudio.inner.currentTime)
			currentSec.value = lp
			listenSession.currentSec = lp
		}
		if (autoplay.value && verses.value.length && hasH5UserActivation()) {
			toggle()
			return
		}
		if (listenAudio.inner && (listenSession.playing || innerIsLive())) {
			playing.value = true
			startRealTick()
			syncBgm()
		}
	})
	
	onHide(() => {
		flushListenProgress()
	})
	
	onUnload(() => {
		flushListenProgress()
	})
	
	onUnmounted(() => {
		flushListenProgress()
		// 返回读经页（小卡保活）：睡眠倒计时继续，不要清
		if (listenSession.keepAlive) return
		clearSleepTimer()
		listenAudio.onPlay = null
		listenAudio.onPause = null
		listenAudio.onEnded = null
		listenAudio.onError = null
		listenAudio.onTick = null
		if (listenAudio._appLeaveQuiet || isAppPlusRuntime()) {
			listenAudio._appLeaveQuiet = false
			return
		}
		destroyListenAudio()
	})

	function noop() {}

	return {
		statusBar,
		bookKey,
		bookName,
		translation,
		chapter,
		chapterCount,
		verses,
		audioUrl,
		durationSec,
		currentSec,
		activeVerse,
		scrollInto,
		playing,
		rateIdx,
		voiceIdx,
		autoplay,
		listenBg,
		mini,
		loading,
		downloaded,
		downloadBusy,
		downloadTitle,
		downloadCount,
		downloadPct,
		voiceLoading,
		badgeOpen,
		badgeItems,
		rateLabel,
		voiceLabel,
		voiceKey,
		voiceVolPct,
		sliderMax,
		sliderValue,
		progressPct,
		fmt,
		onSeekChanging,
		onSeekChange,
		onVoiceVolChanging,
		onVoiceVolChange,
		setVoiceVolume,
		toggle,
		cycleRate,
		cycleVoice,
		onDownload,
		changeChapter,
		collapseMini,
		expandMini,
		close,
		pausePlayback,
		noop,
	}
}
