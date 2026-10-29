<!--
  闹钟到点弹层。系统闹钟把应用拉到前台后停在这里，直到关掉。
-->
<template>
	<view class="ring">
		<view class="card">
			<text class="title">{{ t('alarm') }}</text>
			<text class="body">{{ t('alarm_lead') }}</text>
			<text class="time">{{ timeLabel }}</text>
			<view class="btn" @tap="dismiss">
				<text class="btn-text">{{ t('alarm_dismiss') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import {
	ALARM_SOUNDS,
	DEFAULT_ALARM_SOUND_ID,
	alarmSoundSrc,
	formatAlarmTime,
	getLocalAlarmPrefs,
} from '@/utils/alarm.js'
import { clearAlarmRinging, wakeScreenForAlarm } from '@/utils/alarmClock.js'
import { pauseHomeMusic } from '@/utils/homeMusic.js'

const { t } = useI18n()
const prefs = getLocalAlarmPrefs()
const timeLabel = computed(() => formatAlarmTime(prefs.hour || 0, prefs.minute || 0))

let audio = null

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

function startRing() {
	prepareIosSession()
	pauseHomeMusic()
	const sound = ALARM_SOUNDS.find((item) => item.id === (prefs.sound_id || DEFAULT_ALARM_SOUND_ID))
		|| ALARM_SOUNDS.find((item) => item.id === DEFAULT_ALARM_SOUND_ID)
	if (!sound) return
	const ctx = uni.createInnerAudioContext()
	audio = ctx
	ctx.loop = true
	ctx.src = alarmSoundSrc(sound.file)
	try { ctx.play() } catch (e) {}
}

function stopRing() {
	const ctx = audio
	audio = null
	if (!ctx) return
	try { ctx.stop() } catch (e) {}
	try { ctx.destroy() } catch (e) {}
}

function dismiss() {
	stopRing()
	clearAlarmRinging()
	const pages = getCurrentPages() || []
	if (pages.length > 1) {
		uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/home' }) })
		return
	}
	uni.reLaunch({ url: '/pages/home/home' })
}

onMounted(() => {
	clearAlarmRinging()
	wakeScreenForAlarm()
	startRing()
})

onUnload(stopRing)
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.ring {
	min-height: 100vh;
	background: rgba(0, 0, 0, 0.45);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
}
.card {
	width: 100%;
	background: #ffffff;
	border-radius: 48rpx;
	padding: 48rpx 36rpx 36rpx;
	box-sizing: border-box;
}
.title {
	display: block;
	font-size: 40rpx;
	font-weight: 700;
	text-align: center;
	color: $selah-ink;
}
.body {
	display: block;
	margin-top: 16rpx;
	font-size: 30rpx;
	line-height: 1.4;
	text-align: center;
	color: $selah-ink;
}
.time {
	display: block;
	margin-top: 28rpx;
	font-size: 64rpx;
	font-weight: 600;
	text-align: center;
	color: $selah-ink;
}
.btn {
	margin-top: 40rpx;
	height: 96rpx;
	border-radius: 999rpx;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.btn-text {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
}
</style>
