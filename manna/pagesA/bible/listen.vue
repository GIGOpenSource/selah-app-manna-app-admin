<template>
	<!-- Figma 440:862 听经全屏；成功空经文走空态；无 audio 可保留 demo 进度条 -->
	<view class="page" :class="{ 'page--mini': mini }">
		<image v-if="!mini" class="page__bg" :src="listenBg" mode="aspectFill" />
		<view v-if="!mini" class="page__fade" />

		<view class="top" :style="{ paddingTop: statusBar + 'px' }" v-if="!mini">
			<view class="top__down" hover-class="press" @click="collapseMini">
				<image class="top__down-ico" src="/static/ui/bible/listen/ico-chevron-down.svg" mode="aspectFit" />
			</view>
		</view>

		<view class="head" v-if="!mini">
			<text class="head__title">{{ bookName }} {{ chapter }}</text>
		</view>

		<scroll-view
			v-if="!mini"
			scroll-y
			class="verses"
			:scroll-into-view="scrollInto"
			scroll-with-animation
		>
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

		<view class="dock" v-if="!mini">
			<view class="tools">
				<view
					class="tool"
					:class="{ 'tool--on': sleepActive }"
					hover-class="press"
					@tap.stop="onTimer"
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
					@click="openDownloadSheet"
				>
					<image
						class="tool__ico"
						:src="
							downloaded
								? '/static/ui/bible/listen/downloaded.png'
								: '/static/ui/bible/listen/ico-download.svg'
						"
						mode="aspectFit"
					/>
				</view>
			</view>

			<view class="prog">
				<view class="prog__t">{{ fmt(currentSec) }}</view>
				<view
					id="seek-track"
					class="prog__track"
					@touchstart.stop="onSeekStart"
					@touchmove.stop.prevent="onSeekMove"
					@touchend.stop="onSeekEnd"
					@touchcancel.stop="onSeekEnd"
				>
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
					@tap.stop="openMusicSheet"
				>
					<image class="side__ico" src="/static/ui/bible/listen/ico-music.svg" mode="aspectFit" />
					<text class="side__lab">{{ t('listen_music') }}</text>
				</view>
				<view class="side side--mid" hover-class="press" @click.stop="changeChapter(-1)">
					<image class="side__ico" src="/static/ui/bible/listen/ico-skip-back.svg" mode="aspectFit" />
				</view>
				<view class="play" hover-class="press" @tap.stop="toggle">
					<view v-show="playing" class="play__pause">
						<view class="play__bar" />
						<view class="play__bar" />
					</view>
					<image
						v-show="!playing"
						class="play__ico"
						src="/static/ui/bible/listen/ico-play.svg"
						mode="aspectFit"
					/>
				</view>
				<view class="side side--mid" hover-class="press" @click.stop="changeChapter(1)">
					<image class="side__ico" src="/static/ui/bible/listen/ico-skip-fwd.svg" mode="aspectFit" />
				</view>
				<view class="side" hover-class="press" @click.stop="cycleVoice">
					<image class="side__ico" src="/static/ui/bible/listen/ico-voice.svg" mode="aspectFit" />
					<text class="side__lab">{{ voiceLabel }}</text>
				</view>
			</view>
		</view>

		<!-- 经文 / 配乐 分轨音量 -->
		<view v-if="musicSheet" class="mask mask--dock" @touchmove.stop.prevent="noop">
			<view v-if="listenMaskReady" class="mask__hit" @tap.stop="onMusicMaskClose" />
			<view class="msheet" @tap.stop @click.stop>
				<view class="msheet__handle" />
				<text class="msheet__title">{{ t('listen_music') }}</text>
				<text class="msheet__sub">{{ t('listen_voice_volume') }} · {{ voiceVolPct }}%</text>
				<view class="msheet__slider">
					<view
						id="voice-vol-track"
						class="vslider"
						@touchstart.stop="onVoiceTrackStart"
						@touchmove.stop.prevent="onVoiceTrackMove"
						@touchend.stop="onVoiceTrackEnd"
						@touchcancel.stop="onVoiceTrackEnd"
					>
						<view class="vslider__rail">
							<view class="vslider__fill" :style="{ width: voiceVolPct + '%' }" />
							<view class="vslider__knob" :style="{ left: voiceVolPct + '%' }" />
						</view>
					</view>
					<text class="msheet__pct">{{ voiceVolPct }}</text>
				</view>
				<text class="msheet__sub">{{ t('listen_music_volume') }} · {{ musicVolPct }}%</text>
				<view class="msheet__slider">
					<text class="msheet__mute" @click="setBgmVolume(0)">{{ t('listen_music_off_short') }}</text>
					<view
						id="music-vol-track"
						class="vslider"
						@touchstart.stop="onMusicTrackStart"
						@touchmove.stop.prevent="onMusicTrackMove"
						@touchend.stop="onMusicTrackEnd"
						@touchcancel.stop="onMusicTrackEnd"
					>
						<view class="vslider__rail">
							<view class="vslider__fill" :style="{ width: musicVolPct + '%' }" />
							<view class="vslider__knob" :style="{ left: musicVolPct + '%' }" />
						</view>
					</view>
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
		<view v-if="timerSheet" class="mask mask--dock" @touchmove.stop.prevent="noop">
			<view v-if="listenMaskReady" class="mask__hit" @tap.stop="onTimerMaskClose" />
			<view class="msheet" @tap.stop @click.stop>
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
						<text class="tlist__t">{{ t('listen_timer_min', { n: n }) }}</text>
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

		<!-- 下载本书（暖棕底弹层，对齐设计稿） -->
		<view v-if="downloadSheet" class="mask" @touchmove.stop.prevent="noop">
			<view v-if="listenMaskReady" class="mask__hit" @tap.stop="closeDownloadSheet" />
			<view class="dsheet" @tap.stop @click.stop>
				<view class="dsheet__handle" />
				<view class="dsheet__head">
					<text class="dsheet__title">{{ t('listen_download_sheet') }}</text>
					<image
						class="dsheet__wifi"
						src="/static/ui/bible/listen/icowifi.png"
						mode="aspectFit"
					/>
				</view>
				<view class="dsheet__row">
					<view class="dsheet__meta">
						<text class="dsheet__book">{{ bookName }}</text>
						<text class="dsheet__sub">{{ downloadMetaLabel }}</text>
					</view>
					<view
						class="dsheet__btn"
						:class="{
							'dsheet__btn--busy': downloadBusy,
							'dsheet__btn--done': downloaded && !downloadBusy,
						}"
						hover-class="press"
						@click.stop="onSheetDownload"
					>
						<view v-if="downloadBusy" class="dsheet__ring" :style="ringStyle" />
						<image
							v-else-if="downloaded"
							class="dsheet__btn-ico"
							src="/static/ui/bible/listen/ico-check-circle.svg"
							mode="aspectFit"
						/>
						<text class="dsheet__btn-t">{{ downloadBtnLabel }}</text>
					</view>
				</view>
			</view>
		</view>

		<view v-if="mini" class="mini" hover-class="press" @click="expandMini">
			<view class="mini__play" @click.stop="toggle">
				<image
					class="mini__ico"
					:class="{ 'mini__ico--play': !playing }"
					:src="playing ? '/static/ui/bible/ico-pause.svg' : '/static/ui/bible/listen/ico-play.svg'"
					mode="aspectFit"
				/>
			</view>
			<view class="mini__meta">
				<text class="mini__t">{{ bookName }} {{ chapter }}</text>
				<text class="mini__m">{{ fmt(currentSec) }} / {{ fmt(durationSec) }}</text>
			</view>
			<view class="mini__close" @click.stop="close">
				<image class="mini__x" src="/static/ui/ico-close.svg" mode="aspectFit" />
			</view>
		</view>
		<view v-if="voiceLoading" class="dl" @touchmove.stop.prevent="noop">
			<view class="dl__box">
				<text class="dl__t">{{ t('loading') }}</text>
			</view>
		</view>
		<!-- <manna-badge-toast v-model:visible="badgeOpen" :items="badgeItems" /> -->
	</view>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { useMaskReady } from '@/utils/overlay.js'
import { stopHomeBgm } from '@/utils/homeBgm.js'
import { useListenPlayback } from './useListenPlayback.js'
import { useListenBgm, BGM_PRESETS } from './useListenBgm.js'
import { useListenSleep, TIMER_MINUTES } from './useListenSleep.js'

/** 进听经页先掐掉首页背景音：朗读不能被轻音乐叠着；先注册，保证早于播放逻辑的 onLoad */
onLoad(() => {
	stopHomeBgm()
})

const musicSheet = ref(false)
const timerSheet = ref(false)
const downloadSheet = ref(false)
const listenMaskReady = useMaskReady(
	() => !!(musicSheet.value || timerSheet.value || downloadSheet.value),
)

const hooks = {}

const sleep = useListenSleep({
	hooks,
	musicSheet,
	timerSheet,
	listenMaskReady,
})

const playback = useListenPlayback({
	syncBgm: () => hooks.syncBgm && hooks.syncBgm(),
	clearSleepTimer: sleep.clearSleepTimer,
	sleepUntilEnd: sleep.sleepUntilEnd,
})

const bgm = useListenBgm({
	playing: playback.playing,
	musicSheet,
	timerSheet,
	listenMaskReady,
})

hooks.syncBgm = bgm.syncBgm
hooks.pausePlayback = playback.pausePlayback

const {
	statusBar,
	bookName,
	chapter,
	chapterCount,
	verses,
	durationSec,
	currentSec,
	activeVerse,
	scrollInto,
	playing,
	listenBg,
	mini,
	loading,
	downloaded,
	downloadBusy,
	downloadPct,
	voiceLoading,
	badgeOpen,
	badgeItems,
	rateLabel,
	voiceLabel,
	voiceVolPct,
	sliderMax,
	progressPct,
	fmt,
	onSeekChanging,
	onSeekChange,
	onVoiceVolChanging,
	onVoiceVolChange,
	toggle,
	cycleRate,
	cycleVoice,
	onDownload,
	changeChapter,
	collapseMini,
	expandMini,
	close,
	noop,
} = playback

const {
	musicOn,
	musicVolPct,
	presetKey,
	setBgmVolume,
	onMusicVolChanging,
	onMusicVolChange,
	openMusicSheet,
	onMusicMaskClose,
} = bgm

const pageInst = getCurrentInstance()
const volRect = { voice: null, music: null, seek: null }

/** 整本书体积估算：128kbps 单声道约 16KB/s；本章时长未知时按每章 1.4MB 估 */
const bookSizeMb = computed(() => {
	const n = Math.max(1, Number(chapterCount.value) || 1)
	const dur = Number(durationSec.value) || 0
	const perChapter = dur > 1 ? dur * 16000 : 1400 * 1024
	return Math.max(1, Math.round((perChapter * n) / 1048576))
})

const downloadMetaLabel = computed(() => {
	const n = Number(chapterCount.value) || 0
	const size = `${bookSizeMb.value}MB`
	return n > 1 ? `${t('listen_download_chapters', { n })} | ${size}` : size
})

const downloadBtnLabel = computed(() => {
	if (downloadBusy.value) {
		return downloadPct.value > 0 ? `${downloadPct.value}%` : t('listen_download_doing')
	}
	if (downloaded.value) return t('listen_download_done_btn')
	return t('listen_download_sheet')
})

/** 真实进度圆环：conic-gradient 从 0% 画到当前百分比 */
const ringStyle = computed(() => {
	const p = Math.max(0, Math.min(100, Number(downloadPct.value) || 0))
	return {
		background: `conic-gradient(#ffffff 0% ${p}%, rgba(255, 255, 255, 0.24) ${p}% 100%)`,
	}
})

function openDownloadSheet() {
	downloadSheet.value = true
}

function closeDownloadSheet() {
	downloadSheet.value = false
}

/** 下载逻辑完全沿用 playback.onDownload；进度不再弹居中遮罩，直接用按钮三态反馈 */
async function onSheetDownload() {
	if (downloadBusy.value) return
	await onDownload()
}

function touchX(e) {
	const t = (e && e.touches && e.touches[0]) || (e && e.changedTouches && e.changedTouches[0])
	if (!t) return null
	const x = t.clientX != null ? t.clientX : t.pageX
	return Number.isFinite(Number(x)) ? Number(x) : null
}

function measureTrack(selector) {
	return new Promise((resolve) => {
		const proxy = pageInst && pageInst.proxy
		const q = proxy ? uni.createSelectorQuery().in(proxy) : uni.createSelectorQuery()
		q.select(selector).boundingClientRect((rect) => {
			resolve(rect && rect.width ? rect : null)
		}).exec()
	})
}

async function volPct(key, selector, e, refresh) {
	const x = touchX(e)
	if (x == null) return null
	if (refresh || !volRect[key]) volRect[key] = await measureTrack(selector)
	const rect = volRect[key]
	if (!rect || !rect.width) return null
	return Math.round(Math.max(0, Math.min(1, (x - rect.left) / rect.width)) * 100)
}

async function onVoiceTrackStart(e) {
	const pct = await volPct('voice', '#voice-vol-track', e, true)
	if (pct == null) return
	onVoiceVolChanging({ detail: { value: pct } })
}

function onVoiceTrackMove(e) {
	const rect = volRect.voice
	const x = touchX(e)
	if (!rect || !rect.width || x == null) return
	const pct = Math.round(Math.max(0, Math.min(1, (x - rect.left) / rect.width)) * 100)
	onVoiceVolChanging({ detail: { value: pct } })
}

async function onVoiceTrackEnd(e) {
	const pct = await volPct('voice', '#voice-vol-track', e, false)
	if (pct == null) return
	onVoiceVolChange({ detail: { value: pct } })
}

async function onMusicTrackStart(e) {
	const pct = await volPct('music', '#music-vol-track', e, true)
	if (pct == null) return
	onMusicVolChanging({ detail: { value: pct } })
}

function onMusicTrackMove(e) {
	const rect = volRect.music
	const x = touchX(e)
	if (!rect || !rect.width || x == null) return
	const pct = Math.round(Math.max(0, Math.min(1, (x - rect.left) / rect.width)) * 100)
	onMusicVolChanging({ detail: { value: pct } })
}

async function onMusicTrackEnd(e) {
	const pct = await volPct('music', '#music-vol-track', e, false)
	if (pct == null) return
	onMusicVolChange({ detail: { value: pct } })
}

function seekSecFromX(x) {
	const rect = volRect.seek
	const max = Number(sliderMax.value) || 0
	if (!rect || !rect.width || max <= 0 || x == null) return null
	const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width))
	return ratio * max
}

async function onSeekStart(e) {
	volRect.seek = null
	const x = touchX(e)
	if (x == null) return
	volRect.seek = await measureTrack('#seek-track')
	const sec = seekSecFromX(x)
	if (sec == null) return
	onSeekChanging({ detail: { value: sec } })
}

function onSeekMove(e) {
	const sec = seekSecFromX(touchX(e))
	if (sec == null) return
	onSeekChanging({ detail: { value: sec } })
}

async function onSeekEnd(e) {
	if (!volRect.seek) volRect.seek = await measureTrack('#seek-track')
	const sec = seekSecFromX(touchX(e))
	if (sec == null) {
		onSeekChange({ detail: { value: NaN } })
		return
	}
	onSeekChange({ detail: { value: sec } })
}

const {
	sleepPickMin,
	sleepRemainSec,
	sleepUntilEnd,
	sleepActive,
	onTimerMaskClose,
	pickTimer,
	onTimer,
} = sleep
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	overflow: hidden;
	background: #0a0a0a;
	font-family: $manna-font-body;
	display: flex;
	flex-direction: column;
}

.page--mini {
	background: transparent;
	pointer-events: none;
	height: auto;
	min-height: 0;
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
	height: 72%;
	z-index: 0;
	background: linear-gradient(
		180deg,
		rgba(10, 10, 10, 0) 0%,
		rgba(10, 10, 10, 0.55) 36%,
		#0a0a0a 78%
	);
}

.top, .head, .verses, .dock { position: relative; z-index: 1; }

.top {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	padding: 12rpx 28rpx 0;
}

.top__down {
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.top__down-ico {
	width: 48rpx;
	height: 48rpx;
}

.head {
	padding: 8rpx 48rpx 12rpx;
}

.head__title {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 48rpx;
	color: #fff;
	letter-spacing: -0.4rpx;
}

.verses {
	flex: 1;
	min-height: 0;
	height: 0;
	overflow-anchor: none;
	background: transparent;
}

.verse {
	display: flex;
	& > *:not(:first-child) { margin-left: 16rpx; }
	padding: 14rpx 48rpx;
	align-items: flex-start;
	overflow-anchor: none;
}

.verse--dim {
	opacity: 1;
}

.verse__n {
	font-weight: 300;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.32);
	padding-top: 8rpx;
	flex-shrink: 0;
	min-width: 28rpx;
}

.verse__t {
	flex: 1;
	font-weight: 300;
	font-size: 28rpx;
	line-height: 44rpx;
	color: rgba(255, 255, 255, 0.34);
	letter-spacing: 0.2rpx;
}

.verse--active .verse__n {
	color: rgba(255, 255, 255, 0.55);
	padding-top: 12rpx;
}

.verse--active .verse__t {
	font-weight: 600;
	font-size: 44rpx;
	line-height: 60rpx;
	color: #fff;
}

/* 底部留白让后半章也能滚到视口上方，避免 scroll-into-view 卡在底部 */
.verses__pad {
	height: 52vh;
	flex-shrink: 0;
}

.empty {
	display: block;
	margin: 48rpx;
	text-align: center;
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.45);
}

.dock {
	padding: 8rpx 48rpx calc(28rpx + env(safe-area-inset-bottom, 0px));
	background: transparent;
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
	& > *:not(:first-child) { margin-left: 16rpx; }
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
	height: 56rpx;
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
	padding-top: 32rpx;
	& > *:not(:first-child) { margin-top: 8rpx; }
}

.side--mid {
	height: 128rpx;
	padding-top: 0;
	justify-content: center;
}

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
	position: relative;
	z-index: 2;
	width: 128rpx;
	height: 128rpx;
	flex-shrink: 0;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.2);
	box-shadow: 0 0 32rpx rgba(0, 0, 0, 0.25);
	display: flex;
	align-items: center;
	justify-content: center;
}

.play__ico {
	width: 56rpx;
	height: 56rpx;
	margin-left: 6rpx;
	pointer-events: none;
}

.play__pause {
	display: flex;
	& > *:not(:first-child) { margin-left: 16rpx; }
	align-items: center;
}

.play__bar {
	width: 10rpx;
	height: 40rpx;
	border-radius: 100rpx;
	background: #fff;
}

.dl {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 100000;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0);
}

.dl__box {
	min-width: 200rpx;
	padding: 28rpx 40rpx;
	border-radius: 16rpx;
	background: rgba(17, 17, 17, 0.92);
	display: flex;
	flex-direction: column;
	align-items: center;
}

.dl__t {
	color: #ffffff;
	font-size: 28rpx;
	line-height: 40rpx;
	text-align: center;
}

.mask {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	width: 100%;
	height: 100%;
	z-index: 99999;
	background: rgba(0, 0, 0, 0.45);
	box-sizing: border-box;
}

/* 底部播放键留在遮罩外面，安卓上调配乐音量时仍能点播放/暂停 */
.mask--dock {
	bottom: calc(200rpx + env(safe-area-inset-bottom, 0px));
	height: auto;
}

.mask__hit {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
}

.msheet {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 1;
	width: 100%;
	background: #24110e;
	border-radius: 32rpx 32rpx 0 0;
	padding: 16rpx 40rpx calc(40rpx + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	& > *:not(:first-child) { margin-top: 20rpx; }
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
	& > *:not(:first-child) { margin-left: 16rpx; }
	margin-top: 8rpx;
}

.msheet__mute {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.72);
	min-width: 56rpx;
}

.vslider {
	flex: 1;
	min-width: 0;
	height: 56rpx;
	display: flex;
	align-items: center;
}

.vslider__rail {
	position: relative;
	width: 100%;
	height: 8rpx;
	border-radius: 20rpx;
	background: rgba(255, 255, 255, 0.18);
}

.vslider__fill {
	position: absolute;
	left: 0;
	top: 0;
	height: 100%;
	border-radius: 20rpx;
	background: #fff;
	pointer-events: none;
}

.vslider__knob {
	position: absolute;
	top: 50%;
	width: 28rpx;
	height: 28rpx;
	margin-left: -14rpx;
	margin-top: -14rpx;
	border-radius: 50%;
	background: #fff;
	pointer-events: none;
}

.msheet__pct {
	min-width: 56rpx;
	text-align: right;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.85);
}

.msheet__presets {
	display: flex;
	& > *:not(:first-child) { margin-left: 12rpx; }
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
	& > *:not(:first-child) { margin-top: 8rpx; }
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

/* 下载本书弹层：暖棕底 + 顶部指示条 */
.dsheet {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 1;
	width: 100%;
	padding: 24rpx 48rpx calc(64rpx + env(safe-area-inset-bottom, 0px));
	border-radius: 40rpx 40rpx 0 0;
	box-sizing: border-box;
	background: linear-gradient(150deg, #8d4e39 0%, #7c4531 44%, #6b3727 100%);
	display: flex;
	flex-direction: column;
}

.dsheet__handle {
	align-self: center;
	width: 96rpx;
	height: 8rpx;
	border-radius: 8rpx;
	background: rgba(255, 246, 240, 0.42);
}

.dsheet__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 120rpx;
}

.dsheet__title {
	font-family: $manna-font-body;
	font-size: 36rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #fff;
	letter-spacing: -0.4rpx;
}

.dsheet__wifi {
	width: 40rpx;
	height: 40rpx;
	opacity: 0.9;
	flex-shrink: 0;
	margin-left: 24rpx;
}

.dsheet__row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 64rpx;
}

.dsheet__meta {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.dsheet__book {
	font-family: $manna-font-body;
	font-size: 36rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #fff;
	letter-spacing: -0.4rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dsheet__sub {
	margin-top: 10rpx;
	font-family: $manna-font-body;
	font-size: 24rpx;
	font-weight: 300;
	line-height: 1.2;
	color: rgba(255, 255, 255, 0.58);
}

.dsheet__btn {
	flex-shrink: 0;
	margin-left: 32rpx;
	height: 80rpx;
	padding: 0 40rpx;
	box-sizing: border-box;
	border-radius: 999rpx;
	border: 2rpx solid rgba(255, 255, 255, 0.9);
	display: flex;
	align-items: center;
	justify-content: center;
}

.dsheet__btn--busy,
.dsheet__btn--done {
	border-color: rgba(255, 255, 255, 0.62);
}

.dsheet__btn-t {
	font-family: $manna-font-body;
	font-size: 28rpx;
	font-weight: 600;
	color: #fff;
	white-space: nowrap;
}

.dsheet__btn--busy .dsheet__btn-t,
.dsheet__btn--done .dsheet__btn-t {
	color: rgba(255, 255, 255, 0.92);
}

.dsheet__btn-ico {
	width: 28rpx;
	height: 28rpx;
	margin-right: 10rpx;
	flex-shrink: 0;
}

/* 真实进度圆环：conic-gradient 打底 + 径向遮罩挖空成环（用百分比，避免 rpx 在 mask 里不换算） */
.dsheet__ring {
	width: 34rpx;
	height: 34rpx;
	margin-right: 12rpx;
	flex-shrink: 0;
	border-radius: 50%;
	-webkit-mask: radial-gradient(closest-side, transparent 72%, #000 76%);
	mask: radial-gradient(closest-side, transparent 72%, #000 76%);
}

.press { opacity: 0.72; }

.mini {
	position: fixed;
	left: 50%;
	transform: translateX(-50%);
	bottom: calc(32rpx + env(safe-area-inset-bottom, 0px));
	z-index: 20;
	@include manna-listen-mini;
}

.mini__play {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background: #ffffff;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 16rpx;
	flex-shrink: 0;
	box-shadow: 0 8rpx 20rpx rgba(33, 33, 33, 0.12);
}

.mini__ico {
	width: 36rpx;
	height: 36rpx;
}

.mini__ico--play {
	filter: brightness(0);
	width: 28rpx;
	height: 28rpx;
	margin-left: 4rpx;
}

.mini__meta { flex: 1; min-width: 0; }

.mini__t {
	display: block;
	font-family: $manna-font-body;
	color: $manna-btn-text;
	font-weight: 700;
	font-size: 28rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.mini__m {
	display: block;
	font-family: $manna-font-body;
	color: rgba(33, 33, 33, 0.45);
	font-size: 22rpx;
	margin-top: 4rpx;
}

.mini__close {
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.mini__x {
	width: 40rpx;
	height: 40rpx;
	filter: brightness(0) opacity(0.45);
}
</style>
