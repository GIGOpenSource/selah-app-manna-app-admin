<!--
  祷告闹钟：开关默认关。打开后展开时间、重复（默认全选，至少一天）、铃声。
  铃声来自 static/listen。点选试听，单曲播完 3 次后停止；播放中再次点击不会暂停。
  进入页面先走系统通知授权，拒绝后再给出前往设置的说明。
-->
<template>
	<view :class="['page', ringing ? 'page-ringing' : '']">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-left">
					<view class="nav-pill" @tap.stop="onNavBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-title">{{ panel === 'sound' ? t('alarm_sound') : t('alarm') }}</text>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="body" :style="{ height: bodyHeight }" :show-scrollbar="false">
		<text :class="['page-lead', panel === 'sound' ? 'sound-lead' : '']">{{ panel === 'sound' ? t('alarm_sound_lead') : t('alarm_lead') }}</text>

		<view v-if="panel === 'main'" class="alarm-stack">
			<view class="card">
				<view class="row last">
					<text class="row-label">{{ t('alarm') }}</text>
					<switch
						v-if="!ringing"
						:key="'alarm-' + switchEpoch + '-' + (prefs.enabled ? 1 : 0)"
						:checked="prefs.enabled"
						color="#191919"
						:disabled="saving"
						@change="onToggle"
					/>
				</view>
			</view>
			<view v-if="prefs.enabled" class="card">
				<picker
					v-if="!iosApp"
					mode="time"
					:value="timeValue"
					:disabled="saving"
					@change="onTimeChange"
				>
					<view class="row">
						<text class="row-label">{{ t('alarm_time') }}</text>
						<view class="time-pill">
							<text class="time-pill-text">{{ timeLabel }}</text>
						</view>
					</view>
				</picker>
				<view v-else class="row" @tap="openTimeSheet">
					<text class="row-label">{{ t('alarm_time') }}</text>
					<view class="time-pill">
						<text class="time-pill-text">{{ timeLabel }}</text>
					</view>
				</view>
				<view class="repeat">
					<text class="row-label">{{ t('alarm_repeat') }}</text>
					<view class="days">
						<view
							v-for="day in weekDays"
							:key="day"
							:class="['day', dayOn(day) ? 'on' : '']"
							@tap="toggleDay(day)"
						>
							<text :class="['day-text', dayOn(day) ? 'on' : '']">{{ t('alarm_wd_' + day) }}</text>
						</view>
					</view>
					<view v-if="!(prefs.weekdays || []).length" class="day-warn">
						<image class="day-warn-ico" src="/static/ui/ico-alarm-warn.svg" mode="aspectFit" />
						<text class="day-warn-text">{{ t('alarm_need_day') }}</text>
					</view>
				</view>
				<view class="row last" @tap="openSound">
					<text class="row-label">{{ t('alarm_sound') }}</text>
					<view class="row-trail">
						<text v-if="soundLabel" class="row-value">{{ soundLabel }}</text>
						<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
					</view>
				</view>
			</view>
		</view>

		<view v-else class="sound-list">
			<view
				v-for="sound in sounds"
				:key="sound.id"
				:class="['sound-row', prefs.sound_id === sound.id ? 'on' : '']"
				@tap="onPickSound(sound)"
			>
				<image
					class="sound-ico"
					:src="playingId === sound.id ? '/static/ui/ico-speaker.svg' : '/static/ui/ico-speaker-off.svg'"
					mode="aspectFit"
				/>
				<text class="sound-name">{{ t(sound.nameKey) }}</text>
				<image
					class="radio"
					:src="prefs.sound_id === sound.id ? '/static/ui/radio-on.svg' : '/static/ui/radio-off.svg'"
					mode="aspectFit"
				/>
			</view>
		</view>
		<view class="body-pad" />
		</scroll-view>

		<view v-if="timeOpen" class="time-mask" @tap="closeTimeSheet" @touchmove.stop.prevent>
			<view class="time-sheet" @tap.stop>
				<view class="time-bar">
					<text class="time-cancel" @tap="closeTimeSheet">{{ t('cancel') }}</text>
					<text class="time-done" @tap="confirmTime">{{ t('alarm_done') }}</text>
				</view>
				<picker-view
					class="time-wheels"
					:value="wheelValue"
					indicator-style="height: 44px; border-radius: 0px;"
					indicator-class="alarm-wheel-bar"
					@change="onTimeWheel"
				>
					<picker-view-column>
						<view v-for="hour in hourOptions" :key="'h' + hour" class="wheel-item">{{ hour }}</view>
					</picker-view-column>
					<picker-view-column>
						<view v-for="minute in minuteOptions" :key="'m' + minute" class="wheel-item">{{ minute }}</view>
					</picker-view-column>
				</picker-view>
			</view>
		</view>

		<view v-if="permOpen" class="mask" @tap="closePerm">
			<view class="sheet" @tap.stop>
				<text class="sheet-title">{{ t('alarm_perm_title') }}</text>
				<text class="sheet-body">{{ t('alarm_perm_body') }}</text>
				<view class="sheet-actions">
					<view class="sheet-btn ghost" @tap="goSettings">
						<text class="sheet-btn-text ghost-text">{{ t('alarm_go_settings') }}</text>
					</view>
					<view class="sheet-btn solid" @tap="closePerm">
						<text class="sheet-btn-text solid-text">{{ t('alarm_maybe_later') }}</text>
					</view>
				</view>
			</view>
		</view>

		<view v-if="ringing" class="ring-mask">
			<view class="ring-card">
				<text class="ring-title">{{ t('alarm') }}</text>
				<text class="ring-body">{{ t('alarm_lead') }}</text>
				<text class="ring-time">{{ timeLabel }}</text>
				<view class="ring-btn" @tap="dismissRing">
					<text class="ring-btn-text">{{ t('alarm_dismiss') }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiAlarmPrefsGet, apiAlarmPrefsSave } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import {
	ALARM_SOUNDS,
	DEFAULT_ALARM_SOUND_ID,
	getLocalAlarmPrefs,
	applyAlarmPrefsLocal,
	normalizeAlarmDays,
	alarmPrefsMissing,
	fillAlarmDefaults,
	requestNotificationPermission,
	openAppNotificationSettings,
	formatAlarmTime,
	alarmSoundSrc,
} from '@/utils/alarm.js'
import {
	openExactAlarmSettings,
	requestExactAlarmPermission,
	bindAlarmPageRing,
	nextAlarmAt,
	clearAlarmRinging,
	openAlarmRingPage,
} from '@/utils/alarmClock.js'

function isIosApp() {
	try {
		return typeof plus !== 'undefined' && String(plus.os && plus.os.name).toLowerCase() === 'ios'
	} catch (e) {
		return false
	}
}

const { t } = useI18n()
const iosApp = ref(isIosApp())
const timeOpen = ref(false)
const draftHour = ref(0)
const draftMinute = ref(0)
const wheelValue = ref([0, 0])
const hourOptions = Array.from({ length: 24 }, (_, i) => i)
const minuteOptions = Array.from({ length: 60 }, (_, i) => i)
const statusBarPx = getStatusBarPx()
const fromProfile = ref(false)
const saving = ref(false)
const permOpen = ref(false)
const ringing = ref(false)
const prompted = ref(false)
const switchEpoch = ref(0)
const panel = ref('main')
const prefs = ref(getLocalAlarmPrefs())
const playingId = ref('')
const weekDays = [0, 1, 2, 3, 4, 5, 6]
const sounds = ALARM_SOUNDS

let audio = null
let ringAudio = null
let playToken = 0
let pageRingTimer = null
let ringMinute = 0
let hideRecover = null

const bodyHeight = computed(() => {
	try {
		const info = uni.getSystemInfoSync() || {}
		const windowHeight = Number(info.windowHeight) || 0
		const nav = typeof uni.upx2px === 'function' ? uni.upx2px(88) : 44
		if (windowHeight > 0) return `${Math.max(240, windowHeight - statusBarPx - nav)}px`
	} catch (e) {}
	return '70vh'
})
const timeLabel = computed(() => formatAlarmTime(prefs.value.hour, prefs.value.minute))
const timeValue = computed(() => {
	const h = Math.max(0, Math.min(23, parseInt(prefs.value.hour, 10) || 0))
	const m = Math.max(0, Math.min(59, parseInt(prefs.value.minute, 10) || 0))
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})
const soundLabel = computed(() => {
	const sound = sounds.find((item) => item.id === prefs.value.sound_id)
	return sound ? t(sound.nameKey) : ''
})

onLoad((q) => {
	iosApp.value = isIosApp()
	fromProfile.value = q?.from === 'profile'
})

onShow(async () => {
	iosApp.value = isIosApp()
	bindAlarmPageRing(showRingCard)
	armPageRingWatch()
	if (prompted.value) return
	prompted.value = true
	const ok = await requestNotificationPermission()
	if (!ok) permOpen.value = true
})

onHide(() => {
	prompted.value = false
	stopPreview()
	bindAlarmPageRing(null)
	clearPageRingTimer()
	// 26.1 系统闹钟横幅会让页面假隐藏。真的离开才把提示交给别的页。
	if (hideRecover) clearTimeout(hideRecover)
	hideRecover = setTimeout(() => {
		hideRecover = null
		if (stillOnAlarmPage()) {
			bindAlarmPageRing(showRingCard)
			armPageRingWatch()
			return
		}
		if (ringing.value) {
			stopRingAudio()
			ringing.value = false
			clearAlarmRinging()
			openAlarmRingPage()
		}
	}, 280)
})

onUnload(() => {
	if (hideRecover) {
		clearTimeout(hideRecover)
		hideRecover = null
	}
	stopPreview()
	bindAlarmPageRing(null)
	clearPageRingTimer()
	stopRingAudio()
})

function dayOn(day) {
	return Array.isArray(prefs.value.weekdays) && prefs.value.weekdays.includes(day)
}

function onNavBack() {
	if (panel.value === 'sound') {
		stopPreview()
		panel.value = 'main'
		return
	}
	const hour = String(prefs.value.hour ?? 0).padStart(2, '0')
	const minute = String(prefs.value.minute ?? 0).padStart(2, '0')
	try {
		logFirebaseEvent('alarm_page_leave', {
			is_open: prefs.value.enabled ? 'true' : 'false',
			alarm_time: `${hour}:${minute}`,
		})
	} catch (e) {}
	safeBack(fromProfile.value ? '/pages/profile/profile' : '/pagesA/settings/settings')
}

function openSound() {
	panel.value = 'sound'
}

let fillingDefaults = false

async function load() {
	try {
		const res = await apiAlarmPrefsGet()
		const next = applyAlarmPrefsLocal(res.results || {}, false)
		if (next.enabled && alarmPrefsMissing(next) && !fillingDefaults) {
			fillingDefaults = true
			try {
				await persist(fillAlarmDefaults(next))
			} finally {
				fillingDefaults = false
			}
			return
		}
		prefs.value = next
	} catch (e) {
		prefs.value = getLocalAlarmPrefs()
	}
	armPageRingWatch()
}

async function persist(next) {
	saving.value = true
	const body = {
		enabled: !!next.enabled,
		hour: next.hour,
		minute: next.minute,
		weekdays: normalizeAlarmDays(next.weekdays),
		sound_id: next.sound_id || '',
	}
	try {
		const res = await apiAlarmPrefsSave(body, { loadingText: t('loading') })
		prefs.value = applyAlarmPrefsLocal({ ...(res.results || {}), ...body })
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
		if (!fillingDefaults) await load()
	} finally {
		saving.value = false
		armPageRingWatch()
	}
}

async function onToggle(e) {
	const on = !!e?.detail?.value
	if (on) {
		try { logFirebaseEvent('alarm_open_click') } catch (err) {}
		const ok = await requestNotificationPermission()
		if (!ok) {
			prefs.value = { ...prefs.value, enabled: false }
			switchEpoch.value += 1
			permOpen.value = true
			return
		}
		await requestExactAlarmPermission()
	}
	const next = { ...prefs.value, enabled: on }
	await persist(on && alarmPrefsMissing(next) ? fillAlarmDefaults(next) : next)
}

function clampClock(hour, minute) {
	return {
		hour: Math.max(0, Math.min(23, parseInt(hour, 10) || 0)),
		minute: Math.max(0, Math.min(59, parseInt(minute, 10) || 0)),
	}
}

async function openTimeSheet() {
	if (saving.value || !prefs.value.enabled) return
	const next = clampClock(prefs.value.hour, prefs.value.minute)
	draftHour.value = next.hour
	draftMinute.value = next.minute
	wheelValue.value = [next.hour, next.minute]
	timeOpen.value = true
	await nextTick()
	wheelValue.value = [next.hour, next.minute]
}

function closeTimeSheet() {
	timeOpen.value = false
}

function onTimeWheel(e) {
	const value = e?.detail?.value || []
	draftHour.value = Math.max(0, Math.min(23, Number(value[0]) || 0))
	draftMinute.value = Math.max(0, Math.min(59, Number(value[1]) || 0))
}

async function confirmTime() {
	if (saving.value) return
	const hour = draftHour.value
	const minute = draftMinute.value
	timeOpen.value = false
	await onTimeChange({
		detail: { value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` },
	})
}

async function onTimeChange(e) {
	const raw = e?.detail?.value || '08:00'
	const [hs, ms] = String(raw).split(':')
	const nextHour = Math.max(0, Math.min(23, parseInt(hs, 10) || 0))
	const nextMinute = Math.max(0, Math.min(59, parseInt(ms, 10) || 0))
	if (!prefs.value.enabled) return
	await persist({
		...prefs.value,
		hour: nextHour,
		minute: nextMinute,
	})
}

function toggleDay(day) {
	if (saving.value) return
	const cur = normalizeAlarmDays(prefs.value.weekdays)
	const has = cur.includes(day)
	const weekdays = has ? cur.filter((item) => item !== day) : cur.concat(day).sort((a, b) => a - b)
	persist({
		...prefs.value,
		weekdays,
	})
}

function prepareIosSession() {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.ios) return
		const AVAudioSession = plus.ios.import('AVAudioSession')
		const session = AVAudioSession.sharedInstance()
		try {
			session.setCategorywithOptionserror('AVAudioSessionCategoryPlayback', 1, null)
		} catch (e) {
			try { session.setCategoryerror('AVAudioSessionCategoryPlayback', null) } catch (e2) {}
		}
		try { session.setActiveerror(true, null) } catch (e) {}
		plus.ios.deleteObject(session)
	} catch (e) {}
	// #endif
}

function stopPreview() {
	playToken += 1
	playingId.value = ''
	const ctx = audio
	audio = null
	if (!ctx) return
	try { ctx.stop() } catch (e) {}
	try { ctx.destroy() } catch (e) {}
}

function startPreview(sound) {
	stopPreview()
	prepareIosSession()
	const token = playToken
	const ctx = uni.createInnerAudioContext()
	audio = ctx
	ctx.autoplay = false
	ctx.loop = false
	ctx.src = alarmSoundSrc(sound.file)
	let left = 3
	playingId.value = sound.id
	ctx.onEnded(() => {
		if (token !== playToken) return
		left -= 1
		if (left > 0) {
			try { ctx.seek(0) } catch (e) {}
			try { ctx.play() } catch (e) {}
			return
		}
		if (playingId.value === sound.id) playingId.value = ''
	})
	ctx.onError(() => {
		if (token !== playToken) return
		playingId.value = ''
		uni.showToast({ title: t('audio_unavailable'), icon: 'none' })
	})
	try { ctx.play() } catch (e) {}
}

function onPickSound(sound) {
	if (playingId.value === sound.id) return
	prefs.value = { ...prefs.value, sound_id: sound.id }
	startPreview(sound)
	persist({ ...prefs.value, sound_id: sound.id })
}

function closePerm() {
	permOpen.value = false
}

function stillOnAlarmPage() {
	try {
		const pages = getCurrentPages() || []
		const cur = pages.length ? pages[pages.length - 1] : null
		return String((cur && cur.route) || '').indexOf('alarm/alarm') >= 0
	} catch (e) {
		return false
	}
}

function clearPageRingTimer() {
	if (!pageRingTimer) return
	clearTimeout(pageRingTimer)
	pageRingTimer = null
}

function stopRingAudio() {
	const ctx = ringAudio
	ringAudio = null
	if (!ctx) return
	try { ctx.stop() } catch (e) {}
	try { ctx.destroy() } catch (e) {}
}

function startRingAudio() {
	stopRingAudio()
	prepareIosSession()
	const sound = ALARM_SOUNDS.find((item) => item.id === (prefs.value.sound_id || DEFAULT_ALARM_SOUND_ID))
		|| ALARM_SOUNDS.find((item) => item.id === DEFAULT_ALARM_SOUND_ID)
	if (!sound) return
	const ctx = uni.createInnerAudioContext()
	ringAudio = ctx
	ctx.loop = true
	ctx.src = alarmSoundSrc(sound.file)
	try { ctx.play() } catch (e) {}
}

/** 26.1 从闹钟页再跳一层透明页，提示框不会出现。到点就画在当前页上。 */
function showRingCard() {
	if (ringing.value) return true
	const minute = Math.floor(Date.now() / 60000)
	if (ringMinute === minute) return true
	ringMinute = minute
	timeOpen.value = false
	permOpen.value = false
	stopPreview()
	ringing.value = true
	startRingAudio()
	return true
}

function dismissRing() {
	stopRingAudio()
	ringing.value = false
	clearAlarmRinging()
}

function armPageRingWatch() {
	clearPageRingTimer()
	if (ringing.value) return
	const at = nextAlarmAt()
	if (!at) return
	const tick = () => {
		pageRingTimer = null
		if (ringing.value) return
		const left = at - Date.now()
		if (left <= 0) {
			showRingCard()
			return
		}
		const wait = left > 2500 ? Math.min(left - 1000, 20000) : left
		pageRingTimer = setTimeout(tick, Math.max(16, wait))
	}
	tick()
}

function goSettings() {
	permOpen.value = false
	let ios = false
	try {
		ios = typeof plus !== 'undefined' && String(plus.os && plus.os.name).toLowerCase() === 'ios'
	} catch (e) {}
	if (ios) {
		openExactAlarmSettings()
		return
	}
	openAppNotificationSettings()
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	height: 100vh;
	padding: 0 32rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
	overflow: hidden;
}
.page-ringing {
	overflow: visible;
}
.ring-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 99999;
	background: rgba(0, 0, 0, 0.45);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
}
.ring-card {
	width: 100%;
	background: #ffffff;
	border-radius: 48rpx;
	padding: 48rpx 36rpx 36rpx;
	box-sizing: border-box;
}
.ring-title {
	display: block;
	font-size: 40rpx;
	font-weight: 700;
	text-align: center;
	color: $selah-ink;
}
.ring-body {
	display: block;
	margin-top: 16rpx;
	font-size: 30rpx;
	line-height: 1.4;
	text-align: center;
	color: $selah-ink;
}
.ring-time {
	display: block;
	margin-top: 28rpx;
	font-size: 64rpx;
	font-weight: 600;
	text-align: center;
	color: $selah-ink;
}
.ring-btn {
	margin-top: 40rpx;
	height: 96rpx;
	border-radius: 999rpx;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.ring-btn-text {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
}
.body {
	width: 100%;
}
.body-pad {
	height: calc(80rpx + env(safe-area-inset-bottom));
}
.page-head {
	@include selah-sticky-head;
}
.head-glass {
	@include selah-sticky-head-glass($selah-bg-gray);
}
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	min-height: 88rpx;
}
.nav-left {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 20rpx;
}
.nav-pill {
	@include selah-nav-circle;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.nav-title {
	@include selah-display-title;
	font-size: 40rpx;
}
.page-lead {
	display: block;
	margin: 8rpx 48rpx 28rpx;
	font-size: 32rpx;
	line-height: 1.4;
	color: $selah-ink;
	text-align: center;
}
.sound-lead {
	text-align: center;
	font-size: 28rpx;
	color: rgba(25, 25, 25, 0.45);
	margin-bottom: 32rpx;
}
.sound-list {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}
.sound-row {
	display: flex;
	flex-direction: row;
	align-items: center;
	min-height: 112rpx;
	padding: 0 28rpx;
	background: #ffffff;
	border-radius: 28rpx;
	gap: 20rpx;
	box-sizing: border-box;
}
.sound-row.on {
	background: #f6ead6;
}
.sound-ico {
	width: 40rpx;
	height: 40rpx;
	flex-shrink: 0;
}
.sound-name {
	flex: 1;
	font-size: 32rpx;
	color: $selah-ink;
}
.alarm-stack {
	display: flex;
	flex-direction: column;
	gap: 24rpx;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	overflow: hidden;
}
.row {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	min-height: 112rpx;
	padding: 24rpx 24rpx;
	border-bottom: 1rpx solid $selah-divider;
	box-sizing: border-box;
}
.row.last {
	border-bottom: none;
}
.row-label {
	font-size: 32rpx;
}
.row-trail {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 8rpx;
}
.row-value {
	font-size: 28rpx;
	opacity: 0.6;
}
.time-pill {
	min-height: 56rpx;
	padding: 8rpx 22rpx;
	border-radius: 999rpx;
	background: #ececec;
	display: flex;
	align-items: center;
	justify-content: center;
}
.time-pill-text {
	font-size: 28rpx;
	line-height: 1;
	color: rgba(25, 25, 25, 0.55);
}
.chev {
	width: 40rpx;
	height: 40rpx;
	opacity: 0.45;
}
.radio {
	width: 48rpx;
	height: 48rpx;
	flex-shrink: 0;
}
.repeat {
	padding: 28rpx 24rpx 24rpx;
	border-bottom: 1rpx solid $selah-divider;
}
.days {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	margin-top: 20rpx;
}
.day {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: #e4e4e4;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.day.on {
	background: linear-gradient(180deg, #fff3d3 0%, #a2aaff 100%);
}
.day-text {
	font-size: 22rpx;
	line-height: 1;
	font-weight: 600;
	color: rgba(25, 25, 25, 0.35);
}
.day-text.on {
	color: #191919;
}
.day-warn {
	display: flex;
	flex-direction: row;
	align-items: flex-start;
	gap: 8rpx;
	margin-top: 20rpx;
}
.day-warn-ico {
	width: 28rpx;
	height: 28rpx;
	margin-top: 2rpx;
	flex-shrink: 0;
}
.day-warn-text {
	flex: 1;
	font-size: 24rpx;
	line-height: 1.35;
	color: #e5484d;
}
.mask {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
	z-index: 200;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
}
.sheet {
	width: 100%;
	max-width: 600rpx;
	background: #ffffff;
	border-radius: 48rpx;
	padding: 28rpx;
	box-sizing: border-box;
}
.sheet-title {
	display: block;
	font-size: 36rpx;
	font-weight: 600;
	margin-bottom: 16rpx;
}
.sheet-body {
	display: block;
	font-size: 32rpx;
	line-height: 1.35;
	color: $selah-ink;
	margin-bottom: 40rpx;
}
.sheet-actions {
	display: flex;
	flex-direction: row;
	gap: 16rpx;
}
.sheet-btn {
	flex: 1;
	height: 96rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.sheet-btn.ghost {
	background: $selah-bg-gray;
}
.sheet-btn.solid {
	background: $selah-ink;
}
.sheet-btn-text {
	font-size: 32rpx;
}
.ghost-text {
	color: $selah-ink;
	opacity: 0.6;
}
.solid-text {
	color: #ffffff;
	font-weight: 600;
}
.time-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.4);
	z-index: 400;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
}
.time-sheet {
	width: 100%;
	background: #ffffff;
	padding-bottom: env(safe-area-inset-bottom);
}
.time-bar {
	height: 45px;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid #e5e5e5;
	background: #ffffff;
}
.time-cancel,
.time-done {
	font-size: 17px;
	line-height: 45px;
	padding: 0 14px;
}
.time-cancel {
	color: #888888;
}
.time-done {
	color: #007aff;
}
.time-wheels {
	width: 100%;
	height: 216px;
	background: #ffffff;
}
.wheel-item {
	height: 44px;
	line-height: 44px;
	text-align: center;
	font-size: 20px;
	color: #191919;
}
</style>

<style lang="scss">
/* picker-view 的选中条在组件内部，scoped 选择器够不着 */
.alarm-wheel-bar {
	height: 44px;
	left: 0;
	width: 100%;
	border-radius: 0;
	background: rgba(25, 25, 25, 0.04);
}
.alarm-wheel-bar::before,
.alarm-wheel-bar::after {
	border: none !important;
	border-radius: 0 !important;
	height: 0 !important;
	transform: none !important;
}
</style>
