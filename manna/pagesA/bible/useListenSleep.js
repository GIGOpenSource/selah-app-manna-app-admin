import { computed } from 'vue'
import { t } from '@/i18n/index.js'
import { listenAudio, listenSession, clearListenSleep } from '@/utils/listenSession.js'

export const TIMER_MINUTES = [5, 10, 15, 30, 60]

export function useListenSleep({ hooks, musicSheet, timerSheet, listenMaskReady }) {
	const sleepPickMin = computed(() => listenSession.sleepPickMin)
	const sleepRemainSec = computed(() => listenSession.sleepRemainSec)
	const sleepUntilEnd = computed({
		get: () => listenSession.sleepUntilEnd,
		set: (v) => { listenSession.sleepUntilEnd = !!v },
	})
	const sleepActive = computed(() => listenSession.sleepRemainSec > 0 || listenSession.sleepUntilEnd)

	function clearSleepTimer() {
		clearListenSleep()
	}

	function fireSleepStop() {
		const pause = listenAudio.onSleepFire
		clearListenSleep()
		if (typeof pause === 'function') {
			try { pause() } catch (e) {}
		}
		uni.showToast({ title: t('listen_timer_done'), icon: 'none' })
	}

	function ensureSleepTick() {
		if (listenAudio.sleepTick) return
		listenAudio.sleepTick = setInterval(() => {
			if (listenSession.sleepRemainSec <= 0) return
			// 仅在播放中倒数；暂停读经时冻结倒计时，继续播放后再走
			if (!listenSession.playing) return
			listenSession.sleepRemainSec -= 1
			if (listenSession.sleepRemainSec <= 0) fireSleepStop()
		}, 1000)
	}

	function startSleepCountdown(minutes) {
		const mins = Math.max(1, Math.floor(Number(minutes) || 0))
		clearListenSleep()
		listenSession.sleepPickMin = mins
		listenSession.sleepRemainSec = mins * 60
		listenSession.sleepUntilEnd = false
		ensureSleepTick()
	}

	listenAudio.onSleepFire = () => {
		if (typeof hooks.pausePlayback === 'function') hooks.pausePlayback()
	}
	if (listenSession.sleepRemainSec > 0) ensureSleepTick()

	function openTimerSheet() {
		musicSheet.value = false
		timerSheet.value = true
	}

	function closeTimerSheet() {
		timerSheet.value = false
	}

	function onTimerMaskClose() {
		if (!listenMaskReady.value) return
		closeTimerSheet()
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
			listenSession.sleepUntilEnd = true
			closeTimerSheet()
			uni.showToast({ title: t('listen_timer_end_set'), icon: 'none' })
			return
		}
		const mins = Number(minutes) || 0
		startSleepCountdown(mins)
		closeTimerSheet()
		uni.showToast({ title: t('listen_timer_set', { n: mins }), icon: 'none' })
	}

	function onTimer() {
		openTimerSheet()
	}

	return {
		sleepPickMin,
		sleepRemainSec,
		sleepUntilEnd,
		sleepActive,
		clearSleepTimer,
		fireSleepStop,
		startSleepCountdown,
		openTimerSheet,
		closeTimerSheet,
		onTimerMaskClose,
		pickTimer,
		onTimer,
	}
}
