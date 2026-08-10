<template>
	<!-- Figma 440:862 听经全屏；成功空经文走空态；无 audio 可保留 demo 进度条 -->
	<view class="page">
		<image class="page__bg" src="/static/ui/bible/listen/bg-listen.png" mode="aspectFill" />
		<view class="page__fade" />

		<view class="top" :style="{ paddingTop: statusBar + 'px' }">
			<view class="top__spacer" />
			<view class="top__close" hover-class="press" @click="close">
				<image class="top__close-ico" src="/static/ui/bible/listen/ico-chevron-down.svg" mode="aspectFit" />
			</view>
		</view>

		<view class="head">
			<text class="head__title">{{ bookName }} {{ chapter }}</text>
		</view>

		<scroll-view scroll-y class="verses" :scroll-into-view="scrollInto" scroll-with-animation>
			<view
				v-for="v in verses"
				:id="'lv-' + v.verse"
				:key="v.verse"
				class="verse"
				:class="{
					'verse--active': activeVerse === v.verse,
					'verse--dim': activeVerse > 0 && v.verse !== activeVerse,
				}"
			>
				<text class="verse__n">{{ v.verse }}</text>
				<text class="verse__t">{{ v.text }}</text>
			</view>
			<text v-if="!verses.length && !loading" class="empty">{{ t('bible_empty') }}</text>
			<view class="verses__pad" />
		</scroll-view>

		<view class="dock">
			<view class="tools">
				<view
					class="tool"
					:class="{ 'tool--on': sleepActive }"
					hover-class="press"
					@click="onTimer"
				>
					<text v-if="sleepRemainSec > 0" class="tool__rate">{{ fmt(sleepRemainSec) }}</text>
					<image
						v-else
						class="tool__ico"
						src="/static/ui/bible/listen/ico-timer.svg"
						mode="aspectFit"
					/>
				</view>
				<view class="tool" hover-class="press" @click="cycleRate">
					<text class="tool__rate">{{ rateLabel }}</text>
				</view>
				<view
					class="tool"
					:class="{ 'tool--on': downloaded }"
					hover-class="press"
					@click="onDownload"
				>
					<image class="tool__ico" src="/static/ui/bible/listen/ico-download.svg" mode="aspectFit" />
				</view>
			</view>

			<view class="prog">
				<view class="prog__t">{{ fmt(currentSec) }}</view>
				<view class="prog__track" @click="onSeekTap">
					<view class="prog__rail" />
					<view class="prog__fill" :style="{ width: progressPct + '%' }" />
					<view class="prog__knob" :style="{ left: progressPct + '%' }" />
				</view>
				<view class="prog__t prog__t--end">{{ fmt(durationSec) }}</view>
			</view>

			<view class="ctrls">
				<view
					class="side"
					:class="{ 'side--off': !musicOn }"
					hover-class="press"
					@click.stop="openMusicSheet"
				>
					<image class="side__ico" src="/static/ui/bible/listen/ico-music.svg" mode="aspectFit" />
					<text class="side__lab">{{ t('listen_music') }}</text>
				</view>
				<view class="side side--mid" hover-class="press" @click.stop="skip(-15)">
					<image class="side__ico" src="/static/ui/bible/listen/ico-skip-back.svg" mode="aspectFit" />
				</view>
				<view class="play" hover-class="press" @click.stop="toggle">
					<view v-if="playing" class="play__pause">
						<view class="play__bar" />
						<view class="play__bar" />
					</view>
					<!-- 圆角播放三角：不用 border 尖角，H5 用 inline SVG 避免外链 image 空白 -->
					<view v-else class="play__triangle" aria-hidden="true">
						<svg class="play__triangle-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
							<path
								d="M25.289 12.171c2.588 1.554 2.588 5.304 0 6.858L14.559 25.472C11.893 27.073 8.5 25.152 8.5 22.043V9.157c0-3.11 3.393-5.03 6.059-3.429l10.73 6.443z"
								fill="#FFFFFF"
							/>
						</svg>
					</view>
				</view>
				<view class="side side--mid" hover-class="press" @click.stop="skip(15)">
					<image class="side__ico" src="/static/ui/bible/listen/ico-skip-fwd.svg" mode="aspectFit" />
				</view>
				<view class="side" hover-class="press" @click.stop="cycleVoice">
					<image class="side__ico" src="/static/ui/bible/listen/ico-voice.svg" mode="aspectFit" />
					<text class="side__lab">{{ voiceLabel }}</text>
				</view>
			</view>
		</view>

		<!-- 背景音乐音量 -->
		<view v-if="musicSheet" class="mask" @click="closeMusicSheet">
			<view class="msheet" @click.stop>
				<view class="msheet__handle" />
				<text class="msheet__title">{{ t('listen_music') }}</text>
				<text class="msheet__sub">{{ t('listen_music_volume') }} · {{ musicVolPct }}%</text>
				<view class="msheet__slider">
					<text class="msheet__mute" @click="setBgmVolume(0)">{{ t('listen_music_off_short') }}</text>
					<slider
						class="msheet__bar"
						:value="musicVolPct"
						:min="0"
						:max="100"
						:step="1"
						activeColor="#ffffff"
						backgroundColor="rgba(255,255,255,0.18)"
						block-size="20"
						@changing="onMusicVolChanging"
						@change="onMusicVolChange"
					/>
					<text class="msheet__pct">{{ musicVolPct }}</text>
				</view>
				<view class="msheet__presets">
					<view
						v-for="p in BGM_PRESETS"
						:key="p.key"
						class="msheet__chip"
						:class="{ 'msheet__chip--on': presetKey === p.key }"
						hover-class="press"
						@click="setBgmVolume(p.vol)"
					>
						<text class="msheet__chip-t">{{ t(p.labelKey) }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 定时关闭（深色底栏，对齐听经页） -->
		<view v-if="timerSheet" class="mask" @click="closeTimerSheet">
			<view class="msheet" @click.stop>
				<view class="msheet__handle" />
				<text class="msheet__title">{{ t('listen_timer') }}</text>
				<view class="tlist">
					<view
						class="tlist__row"
						:class="{ 'tlist__row--on': !sleepActive }"
						hover-class="press"
						@click="pickTimer('off')"
					>
						<text class="tlist__t">{{ t('listen_timer_off') }}</text>
					</view>
					<view
						v-for="n in TIMER_MINUTES"
						:key="'tm-' + n"
						class="tlist__row"
						:class="{ 'tlist__row--on': sleepRemainSec > 0 && sleepPickMin === n }"
						hover-class="press"
						@click="pickTimer('min', n)"
					>
						<text class="tlist__t">{{ t('listen_timer_min', { n }) }}</text>
					</view>
					<view
						class="tlist__row"
						:class="{ 'tlist__row--on': sleepUntilEnd }"
						hover-class="press"
						@click="pickTimer('end')"
					>
						<text class="tlist__t">{{ t('listen_timer_end') }}</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiBibleChapter } from '@/api/bible.js'
import { withDemoChapter, DEMO_LISTEN } from '@/utils/bibleDemo.js'
import { absolutizeMedia } from '@/utils/media.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import {
	canPersistAssets,
	downloadAndPersist,
	hasPersistedAsset,
	peekLocalAsset,
} from '@/utils/assetCache.js'

const RATES = [0.75, 1, 1.25, 1.5]
const VOICES = [
	{ key: 'female', label: 'Female' },
	{ key: 'male', label: 'Male' },
]
const TIMER_MINUTES = [5, 10, 15, 30, 60]
const BGM_SRC = '/static/audio/listen-bgm.mp3'
const BGM_VOL_KEY = 'manna_listen_bgm_vol'
const BGM_DEFAULT = 0.22
const BGM_PRESETS = [
	{ key: 'off', vol: 0, labelKey: 'listen_music_off_short' },
	{ key: 'quiet', vol: 0.12, labelKey: 'listen_music_quiet' },
	{ key: 'normal', vol: 0.22, labelKey: 'listen_music_normal' },
	{ key: 'strong', vol: 0.4, labelKey: 'listen_music_strong' },
]

function readStoredBgmVol() {
	const raw = uni.getStorageSync(BGM_VOL_KEY)
	if (raw === '' || raw == null) return BGM_DEFAULT
	const n = Number(raw)
	if (Number.isNaN(n)) return BGM_DEFAULT
	return Math.max(0, Math.min(1, n))
}

const statusBar = getStatusBarPx()
const bookKey = ref('genesis')
const bookName = ref('')
const translation = ref('web')
const chapter = ref(1)
const verses = ref([])
const audioUrl = ref('')
/** API 下发的章节朗读 URL（含 gender 段）；Voice 切换时以此为底改写，避免串路径 */
const chapterAudioUrl = ref('')
const durationSec = ref(0)
const currentSec = ref(0)
const activeVerse = ref(0)
const scrollInto = ref('')
const playing = ref(false)
const bgmVolume = ref(readStoredBgmVol())
const musicSheet = ref(false)
const timerSheet = ref(false)
const sleepPickMin = ref(0)
const rateIdx = ref(1)
const voiceIdx = ref(1)
const autoplay = ref(true)
const loading = ref(false)
const sleepRemainSec = ref(0)
const sleepUntilEnd = ref(false)
const downloaded = ref(false)
const downloadBusy = ref(false)

let innerAudio = null
let bgmAudio = null
let tick = null
let demoTimer = null
let sleepTick = null
/** Voice 切换中：onError 时回退音色，不掉进 demo 进度条 */
let voiceSwitchPending = false
let voiceSwitchPrevIdx = 1

const musicOn = computed(() => bgmVolume.value > 0.001)
const musicVolPct = computed(() => Math.round(bgmVolume.value * 100))
const presetKey = computed(() => {
	const v = bgmVolume.value
	const hit = BGM_PRESETS.find((p) => Math.abs(p.vol - v) < 0.015)
	return hit ? hit.key : ''
})
const rateLabel = computed(() => `${RATES[rateIdx.value].toFixed(1)}X`)
const voiceLabel = computed(() => VOICES[voiceIdx.value]?.label || 'Male')
const voiceKey = computed(() => VOICES[voiceIdx.value]?.key || 'male')
const sleepActive = computed(() => sleepRemainSec.value > 0 || sleepUntilEnd.value)
const progressPct = computed(() => {
	const d = durationSec.value || 1
	return Math.max(0, Math.min(100, (currentSec.value / d) * 100))
})

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

function buildAudioUrl(gender) {
	const g = gender || voiceKey.value
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

function setVoiceFromUrl(url) {
	const g = genderFromUrl(url) || 'male'
	const idx = VOICES.findIndex((v) => v.key === g)
	voiceIdx.value = idx >= 0 ? idx : 1
}

onLoad((q) => {
	if (q?.book) bookKey.value = String(q.book)
	if (q?.chapter) chapter.value = Number(q.chapter) || 1
	if (q?.name) bookName.value = decodeURIComponent(String(q.name))
	autoplay.value = String(q?.autoplay || '1') !== '0'
})

function fmt(sec) {
	const s = Math.max(0, Math.floor(Number(sec) || 0))
	const m = Math.floor(s / 60)
	const r = s % 60
	return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function syncActiveFromTime(tSec) {
	const list = verses.value
	if (!list.length) return
	const d = durationSec.value || 1
	const idx = Math.min(list.length - 1, Math.floor((tSec / d) * list.length))
	const v = list[idx]?.verse || idx + 1
	if (v !== activeVerse.value) {
		activeVerse.value = v
		scrollInto.value = 'lv-' + v
	}
}

function stopTick() {
	if (tick) {
		clearInterval(tick)
		tick = null
	}
	if (demoTimer) {
		clearInterval(demoTimer)
		demoTimer = null
	}
}

function clearSleepTimer() {
	if (sleepTick) {
		clearInterval(sleepTick)
		sleepTick = null
	}
	sleepRemainSec.value = 0
	sleepUntilEnd.value = false
	sleepPickMin.value = 0
}

function pausePlayback() {
	if (innerAudio) {
		try { innerAudio.pause() } catch (e) {}
		stopTick()
	} else {
		stopTick()
	}
	playing.value = false
	syncBgm()
}

function fireSleepStop() {
	clearSleepTimer()
	pausePlayback()
	uni.showToast({ title: t('listen_timer_done'), icon: 'none' })
}

function startSleepCountdown(minutes) {
	const mins = Math.max(1, Math.floor(Number(minutes) || 0))
	clearSleepTimer()
	sleepPickMin.value = mins
	sleepRemainSec.value = mins * 60
	sleepTick = setInterval(() => {
		sleepRemainSec.value -= 1
		if (sleepRemainSec.value <= 0) fireSleepStop()
	}, 1000)
}

function onChapterEnded() {
	playing.value = false
	stopTick()
	activeVerse.value = 0
	syncBgm()
	if (sleepUntilEnd.value) {
		sleepUntilEnd.value = false
		uni.showToast({ title: t('listen_timer_done'), icon: 'none' })
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

function refreshDownloadedFlag() {
	downloaded.value = hasPersistedAsset(remoteAudioSrc())
}

function h5SaveAudio(url) {
	if (typeof document === 'undefined') return false
	try {
		const book = (bookName.value || bookKey.value || 'chapter').replace(/\s+/g, '_')
		const name = `${book}-${String(chapter.value).padStart(3, '0')}-${voiceKey.value}.mp3`
		const a = document.createElement('a')
		a.href = url
		a.download = name
		a.rel = 'noopener'
		document.body.appendChild(a)
		a.click()
		a.remove()
		return true
	} catch (e) {
		return false
	}
}

function destroyBgm() {
	if (bgmAudio) {
		try { bgmAudio.stop() } catch (e) {}
		try { bgmAudio.destroy() } catch (e) {}
		bgmAudio = null
	}
}

function ensureBgm() {
	if (bgmAudio) return true
	bgmAudio = uni.createInnerAudioContext()
	bgmAudio.src = BGM_SRC
	bgmAudio.loop = true
	bgmAudio.volume = bgmVolume.value
	bgmAudio.onError(() => {
		// 配乐失败不打断听经
		destroyBgm()
	})
	return true
}

function syncBgm() {
	if (!musicOn.value || !playing.value) {
		if (bgmAudio) {
			try { bgmAudio.pause() } catch (e) {}
		}
		return
	}
	if (!ensureBgm()) return
	try {
		bgmAudio.volume = bgmVolume.value
		bgmAudio.play()
	} catch (e) {}
}

function applyBgmVolumeLive(vol) {
	const n = Math.max(0, Math.min(1, Number(vol) || 0))
	bgmVolume.value = n
	if (bgmAudio) {
		try { bgmAudio.volume = n } catch (e) {}
	}
	if (n <= 0.001) {
		if (bgmAudio) {
			try { bgmAudio.pause() } catch (e) {}
		}
		return
	}
	if (playing.value) syncBgm()
}

function setBgmVolume(vol) {
	const n = Math.max(0, Math.min(1, Number(vol) || 0))
	applyBgmVolumeLive(n)
	try { uni.setStorageSync(BGM_VOL_KEY, n) } catch (e) {}
}

function onMusicVolChanging(e) {
	applyBgmVolumeLive((Number(e?.detail?.value) || 0) / 100)
}

function onMusicVolChange(e) {
	setBgmVolume((Number(e?.detail?.value) || 0) / 100)
}

function openMusicSheet() {
	timerSheet.value = false
	musicSheet.value = true
}

function closeMusicSheet() {
	musicSheet.value = false
}

function openTimerSheet() {
	musicSheet.value = false
	timerSheet.value = true
}

function closeTimerSheet() {
	timerSheet.value = false
}

function pickTimer(kind, minutes) {
	if (kind === 'off') {
		clearSleepTimer()
		closeTimerSheet()
		uni.showToast({ title: t('listen_timer_cleared'), icon: 'none' })
		return
	}
	if (kind === 'end') {
		clearSleepTimer()
		sleepUntilEnd.value = true
		closeTimerSheet()
		uni.showToast({ title: t('listen_timer_end_set'), icon: 'none' })
		return
	}
	const mins = Number(minutes) || 0
	startSleepCountdown(mins)
	closeTimerSheet()
	uni.showToast({ title: t('listen_timer_set', { n: mins }), icon: 'none' })
}

function destroyAudio() {
	stopTick()
	if (innerAudio) {
		try { innerAudio.stop() } catch (e) {}
		try { innerAudio.destroy() } catch (e) {}
		innerAudio = null
	}
	playing.value = false
	syncBgm()
}

function startRealTick() {
	stopTick()
	tick = setInterval(() => {
		if (!innerAudio) return
		const tSec = Number(innerAudio.currentTime) || 0
		currentSec.value = tSec
		const d = Number(innerAudio.duration) || 0
		if (d > 0) durationSec.value = d
		syncActiveFromTime(tSec)
	}, 220)
}

function startDemoPlayback() {
	destroyAudio()
	playing.value = true
	syncBgm()
	demoTimer = setInterval(() => {
		currentSec.value = Math.min(durationSec.value, currentSec.value + 1)
		syncActiveFromTime(currentSec.value)
		if (currentSec.value >= durationSec.value) {
			onChapterEnded()
		}
	}, 1000)
}

function ensureAudio() {
	const remote = remoteAudioSrc()
	const src = playSrcFor(remote)
	if (!src) return false
	if (innerAudio && innerAudio.src === src) return true
	if (innerAudio) {
		try { innerAudio.stop() } catch (e) {}
		try { innerAudio.destroy() } catch (e) {}
		innerAudio = null
	}
	audioUrl.value = remote || src
	innerAudio = uni.createInnerAudioContext()
	innerAudio.src = src
	innerAudio.playbackRate = RATES[rateIdx.value]
	innerAudio.onEnded(() => {
		onChapterEnded()
	})
	innerAudio.onError(() => {
		if (voiceSwitchPending) {
			voiceSwitchPending = false
			voiceIdx.value = voiceSwitchPrevIdx
			audioUrl.value = buildAudioUrl(voiceKey.value) || chapterAudioUrl.value
			refreshDownloadedFlag()
			if (innerAudio) {
				try { innerAudio.destroy() } catch (e) {}
				innerAudio = null
			}
			uni.showToast({ title: t('listen_voice_fail'), icon: 'none' })
			return
		}
		uni.showToast({ title: t('bible_audio_fail'), icon: 'none' })
		startDemoPlayback()
	})
	innerAudio.onCanplay(() => {
		if (voiceSwitchPending) voiceSwitchPending = false
	})
	return true
}

function toggle() {
	if (playing.value) {
		pausePlayback()
		return
	}
	if (ensureAudio()) {
		innerAudio.play()
		playing.value = true
		startRealTick()
		syncBgm()
		return
	}
	startDemoPlayback()
}

function skip(delta) {
	const next = Math.max(0, Math.min(durationSec.value, currentSec.value + delta))
	currentSec.value = next
	if (innerAudio) {
		try { innerAudio.seek(next) } catch (e) {}
	}
	syncActiveFromTime(next)
}

function onSeekTap(e) {
	// uni 点击坐标不稳定时按步进，保证可交互
	const next = Math.min(durationSec.value, currentSec.value + 10)
	currentSec.value = next
	if (innerAudio) {
		try { innerAudio.seek(next) } catch (err) {}
	}
	syncActiveFromTime(next)
}

function cycleRate() {
	rateIdx.value = (rateIdx.value + 1) % RATES.length
	if (innerAudio) {
		try { innerAudio.playbackRate = RATES[rateIdx.value] } catch (e) {}
	}
	uni.showToast({ title: rateLabel.value, icon: 'none' })
}

function reloadVoiceAudio() {
	const wasPlaying = playing.value
	const pos = currentSec.value
	const nextUrl = buildAudioUrl(voiceKey.value)
	if (!nextUrl) return false
	audioUrl.value = nextUrl
	if (innerAudio) {
		try { innerAudio.stop() } catch (e) {}
		try { innerAudio.destroy() } catch (e) {}
		innerAudio = null
	}
	if (!ensureAudio()) return false
	const resume = () => {
		if (!innerAudio) return
		try { innerAudio.seek(pos) } catch (e) {}
		currentSec.value = pos
		syncActiveFromTime(pos)
		if (wasPlaying) {
			innerAudio.play()
			playing.value = true
			startRealTick()
			syncBgm()
		}
	}
	// H5/小程序：duration 可能稍晚才就绪，短延迟再 seek
	setTimeout(resume, 120)
	return true
}

function cycleVoice() {
	const prev = voiceIdx.value
	voiceIdx.value = (voiceIdx.value + 1) % VOICES.length
	voiceSwitchPrevIdx = prev
	voiceSwitchPending = true
	refreshDownloadedFlag()
	if (!reloadVoiceAudio()) {
		voiceSwitchPending = false
		voiceIdx.value = prev
		refreshDownloadedFlag()
		uni.showToast({ title: t('listen_voice_fail'), icon: 'none' })
		return
	}
	uni.showToast({ title: voiceLabel.value, icon: 'none' })
}

function onTimer() {
	openTimerSheet()
}

async function onDownload() {
	const remote = remoteAudioSrc()
	if (!remote) {
		uni.showToast({ title: t('listen_download_none'), icon: 'none' })
		return
	}
	if (downloaded.value) {
		uni.showToast({ title: t('listen_downloaded'), icon: 'none' })
		return
	}
	if (downloadBusy.value) return
	downloadBusy.value = true
	uni.showLoading({ title: t('listen_download_busy'), mask: true })
	try {
		if (!canPersistAssets()) {
			const ok = h5SaveAudio(remote)
			uni.showToast({
				title: ok ? t('listen_download_ok') : t('listen_download_fail'),
				icon: 'none',
			})
			return
		}
		const res = await downloadAndPersist(remote)
		if (!res?.ok) {
			uni.showToast({ title: t('listen_download_fail'), icon: 'none' })
			return
		}
		downloaded.value = true
		uni.showToast({ title: t('listen_download_ok'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: t('listen_download_fail'), icon: 'none' })
	} finally {
		downloadBusy.value = false
		try { uni.hideLoading() } catch (e) {}
	}
}

function close() {
	destroyAudio()
	destroyBgm()
	clearSleepTimer()
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/bible/bible' }) })
}

onMounted(async () => {
	loading.value = true
	try {
		const res = await apiBibleChapter({
			translation: translation.value || 'web',
			book: bookKey.value,
			chapter: chapter.value,
		})
		const d = res?.results || {}
		if (d.translation) translation.value = String(d.translation)
		if (d.book_name || d.book_title) bookName.value = d.book_name || d.book_title
		if (d.chapter) chapter.value = Number(d.chapter) || chapter.value
		const list = Array.isArray(d.verses) ? d.verses : []
		verses.value = list.map((v, i) => ({
			verse: Number(v.verse) || i + 1,
			text: v.text || v.content || '',
		}))
		audioUrl.value = absolutizeMedia(d.audio_url || '')
		chapterAudioUrl.value = audioUrl.value
		setVoiceFromUrl(audioUrl.value || chapterAudioUrl.value)
		if (!audioUrl.value && (bookName.value || bookKey.value)) {
			// 章节无 audio_url 时仍按书卷拼 bible-media 路径，便于 Voice 切换试听
			chapterAudioUrl.value = buildAudioUrl(voiceKey.value)
			audioUrl.value = chapterAudioUrl.value
		} else if (audioUrl.value) {
			audioUrl.value = buildAudioUrl(voiceKey.value)
		}
		durationSec.value = Number(d.audio_duration_sec) || 0
		if (verses.value.length) {
			activeVerse.value = verses.value[0].verse
			currentSec.value = 0
			// 真章节有经文但无音频：保留 demo 进度条便于播放 UX
			if (!audioUrl.value) {
				durationSec.value = durationSec.value || DEMO_LISTEN.audio_duration_sec
			}
		}
	} catch (e) {
		const d = withDemoChapter(null, DEMO_LISTEN)
		bookName.value = bookName.value || d.book_name
		verses.value = d.verses
		durationSec.value = d.audio_duration_sec
		activeVerse.value = d.verses[0]?.verse || 1
		currentSec.value = 0
	} finally {
		loading.value = false
	}
	refreshDownloadedFlag()
	if (activeVerse.value) scrollInto.value = 'lv-' + activeVerse.value
	if (autoplay.value && verses.value.length) toggle()
})

onUnmounted(() => {
	destroyAudio()
	destroyBgm()
	clearSleepTimer()
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	overflow: hidden;
	background: #160907;
	font-family: $manna-font-body;
	display: flex;
	flex-direction: column;
}

.page__bg {
	position: fixed;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
}

.page__fade {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	height: 70%;
	z-index: 0;
	background: linear-gradient(180deg, rgba(66, 26, 21, 0) 0%, #160907 30%);
}

.top, .head, .verses, .dock { position: relative; z-index: 1; }

.top {
	display: flex;
	align-items: center;
	padding: 20rpx 40rpx 0;
}

.top__spacer { flex: 1; }

.top__close {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.top__close-ico { width: 48rpx; height: 48rpx; }

.head {
	padding: 24rpx 48rpx 8rpx;
}

.head__title {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 48rpx;
	color: #fff;
}

.verses {
	flex: 1;
	min-height: 0;
	height: 0;
	padding-bottom: 24rpx;
}

.verse {
	display: flex;
	gap: 16rpx;
	padding: 20rpx 48rpx;
	align-items: flex-start;
}

.verse--dim { opacity: 0.3; }

.verse__n {
	font-weight: 300;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.5);
	padding-top: 8rpx;
	flex-shrink: 0;
}

.verse__t {
	flex: 1;
	font-weight: 300;
	font-size: 32rpx;
	line-height: 56rpx;
	color: #fff;
	letter-spacing: 0.32rpx;
}

.verse--active .verse__t {
	font-weight: 400;
	font-size: 48rpx;
	line-height: 80rpx;
}

.verses__pad { height: 40rpx; }

.empty {
	display: block;
	margin: 48rpx;
	text-align: center;
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.45);
}

.dock {
	padding: 16rpx 48rpx calc(40rpx + env(safe-area-inset-bottom, 0px));
}

.tools {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16rpx 0 28rpx;
}

.tool {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
}

.tool--on {
	opacity: 1;
}

.tool--on .tool__ico,
.tool--on .tool__rate {
	opacity: 1;
	filter: drop-shadow(0 0 8rpx rgba(255, 255, 255, 0.45));
}

.tool__ico {
	width: 64rpx;
	height: 64rpx;
	pointer-events: none;
}

.tool__rate {
	font-size: 28rpx;
	color: #fff;
	letter-spacing: -0.8rpx;
}

.prog {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-bottom: 36rpx;
}

/* view 而非 text：H5 uni-text 为 inline，width 不生效会挤乱进度条 */
.prog__t {
	width: 80rpx;
	flex-shrink: 0;
	font-size: 24rpx;
	line-height: 1;
	color: rgba(255, 255, 255, 0.5);
	white-space: nowrap;
}

.prog__t--end { text-align: right; }

.prog__track {
	position: relative;
	flex: 1;
	min-width: 0;
	height: 40rpx;
	display: flex;
	align-items: center;
	overflow: visible;
}

.prog__rail {
	width: 100%;
	height: 8rpx;
	border-radius: 20rpx;
	background: rgba(255, 255, 255, 0.2);
}

.prog__fill {
	position: absolute;
	left: 0;
	top: 50%;
	height: 8rpx;
	margin-top: -4rpx;
	border-radius: 20rpx;
	background: #fff;
	pointer-events: none;
}

/* Figma 440:926 白点 8px；不用 image，避免 H5 uni-image 撑破轨道 */
.prog__knob {
	position: absolute;
	top: 50%;
	width: 16rpx;
	height: 16rpx;
	margin-left: -8rpx;
	margin-top: -8rpx;
	border-radius: 50%;
	background: #fff;
	pointer-events: none;
}

.ctrls {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
}

.side {
	width: 88rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
}

.side--mid { padding-top: 8rpx; }

.side__ico {
	width: 64rpx;
	height: 64rpx;
	pointer-events: none;
}

.side__lab {
	font-weight: 300;
	font-size: 20rpx;
	color: rgba(255, 255, 255, 0.7);
}

.side--off {
	opacity: 0.38;
}

.play {
	width: 128rpx;
	height: 128rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.2);
	box-shadow: 0 0 32rpx rgba(0, 0, 0, 0.25);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: -8rpx;
}

.play__ico {
	width: 56rpx;
	height: 56rpx;
	pointer-events: none;
}

.play__triangle {
	width: 56rpx;
	height: 56rpx;
	margin-left: 4rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	pointer-events: none;
}

.play__triangle-svg {
	width: 100%;
	height: 100%;
	display: block;
}

.play__pause {
	display: flex;
	gap: 16rpx;
	align-items: center;
}

.play__bar {
	width: 10rpx;
	height: 40rpx;
	border-radius: 100rpx;
	background: #fff;
}

.mask {
	position: fixed;
	inset: 0;
	z-index: 80;
	background: rgba(0, 0, 0, 0.45);
	display: flex;
	align-items: flex-end;
}

.msheet {
	width: 100%;
	background: #24110e;
	border-radius: 32rpx 32rpx 0 0;
	padding: 16rpx 40rpx calc(40rpx + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.msheet__handle {
	align-self: center;
	width: 80rpx;
	height: 8rpx;
	border-radius: 8rpx;
	background: rgba(255, 255, 255, 0.22);
	margin-bottom: 4rpx;
}

.msheet__title {
	font-family: $manna-font-body;
	font-size: 36rpx;
	font-weight: 700;
	color: #fff;
}

.msheet__sub {
	font-family: $manna-font-body;
	font-size: 24rpx;
	font-weight: 300;
	color: rgba(255, 255, 255, 0.62);
	margin-top: -8rpx;
}

.msheet__slider {
	display: flex;
	align-items: center;
	gap: 16rpx;
	margin-top: 8rpx;
}

.msheet__mute {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.72);
	min-width: 56rpx;
}

.msheet__bar {
	flex: 1;
	margin: 0;
}

.msheet__pct {
	min-width: 56rpx;
	text-align: right;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.85);
}

.msheet__presets {
	display: flex;
	gap: 12rpx;
	margin-top: 8rpx;
}

.msheet__chip {
	flex: 1;
	height: 72rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
}

.msheet__chip--on {
	background: rgba(255, 255, 255, 0.92);
}

.msheet__chip-t {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.88);
}

.msheet__chip--on .msheet__chip-t {
	color: #212121;
	font-weight: 600;
}

.tlist {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	margin-top: 4rpx;
}

.tlist__row {
	height: 88rpx;
	border-radius: 20rpx;
	padding: 0 28rpx;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	background: rgba(255, 255, 255, 0.08);
}

.tlist__row--on {
	background: rgba(255, 255, 255, 0.92);
}

.tlist__t {
	font-family: $manna-font-body;
	font-size: 30rpx;
	font-weight: 400;
	color: rgba(255, 255, 255, 0.9);
}

.tlist__row--on .tlist__t {
	color: #212121;
	font-weight: 600;
}

.press { opacity: 0.72; }
</style>
