import { ref, computed } from 'vue'
import {
	BGM_VOL_DEFAULT,
	BGM_VOL_KEY,
	readStoredVol,
	sliderPercent,
	writeStoredVol,
} from '@/utils/audioVolume.js'
import { apiDailyVerse } from '@/api/manna.js'
import { getTimezone } from '@/utils/device.js'
import {
	mixBgmPause,
	mixBgmPlay,
	mixBgmSetVolume,
	mixBgmSync,
	mixBgmUnlock,
	setMixBgmSrc,
} from '@/utils/mixBgmPlayer.js'

export const BGM_PRESETS = [
	{ key: 'off', vol: 0, labelKey: 'listen_music_off_short' },
	{ key: 'quiet', vol: 0.12, labelKey: 'listen_music_quiet' },
	{ key: 'normal', vol: 0.22, labelKey: 'listen_music_normal' },
	{ key: 'strong', vol: 0.4, labelKey: 'listen_music_strong' },
]

function readStoredBgmVol() {
	return readStoredVol(BGM_VOL_KEY, BGM_VOL_DEFAULT)
}

/**
 * 听经配乐地址改为服务器下发（daily-verse.bgm_url）。
 * 接口失败或没有该字段时，保留 mixBgmPlayer 里的本地静态文件兜底。
 */
let bgmUrlLoaded = false
async function loadBgmUrl() {
	try {
		const res = await apiDailyVerse({ tz: getTimezone() })
		const url =
			(res && res.results && res.results.bgm_url) ||
			(res && res.bgm_url) ||
			''
		if (url) setMixBgmSrc(url)
	} catch (e) {
		// 忽略：保留默认本地配乐
	}
}

export function useListenBgm({ playing, musicSheet, timerSheet, listenMaskReady }) {
	const bgmVolume = ref(readStoredBgmVol())
	const musicOn = computed(() => bgmVolume.value > 0.001)
	const musicVolPct = computed(() => Math.round(bgmVolume.value * 100))
	const presetKey = computed(() => {
		const v = bgmVolume.value
		const hit = BGM_PRESETS.find((p) => Math.abs(p.vol - v) < 0.015)
		return hit ? hit.key : ''
	})

	function syncBgm() {
		mixBgmSetVolume(bgmVolume.value)
		mixBgmSync(!!playing.value)
	}

	function applyBgmVolumeLive(vol) {
		const n = clamp01Safe(vol)
		bgmVolume.value = n
		mixBgmSetVolume(n)
		if (n <= 0.001) {
			mixBgmPause()
			return
		}
		mixBgmUnlock()
		if (playing.value) mixBgmPlay()
	}

	function clamp01Safe(vol) {
		const n = Number(vol)
		if (!Number.isFinite(n)) return bgmVolume.value
		return Math.max(0, Math.min(1, n))
	}

	function setBgmVolume(vol) {
		applyBgmVolumeLive(vol)
		writeStoredVol(BGM_VOL_KEY, bgmVolume.value)
	}

	function onMusicVolChanging(e) {
		const pct = sliderPercent(e)
		if (pct == null) return
		applyBgmVolumeLive(pct / 100)
	}

	function onMusicVolChange(e) {
		const pct = sliderPercent(e)
		if (pct == null) return
		setBgmVolume(pct / 100)
	}

	function openMusicSheet() {
		timerSheet.value = false
		musicSheet.value = true
		mixBgmUnlock()
		if (playing.value && musicOn.value) mixBgmPlay()
	}

	function closeMusicSheet() {
		musicSheet.value = false
	}

	function onMusicMaskClose() {
		if (!listenMaskReady.value) return
		closeMusicSheet()
	}

	// 进入听经页即用 daily-verse.bgm_url 覆盖配乐地址（仅拉一次）
	if (!bgmUrlLoaded) {
		bgmUrlLoaded = true
		loadBgmUrl()
	}

	return {
		bgmVolume,
		musicOn,
		musicVolPct,
		presetKey,
		syncBgm,
		applyBgmVolumeLive,
		setBgmVolume,
		onMusicVolChanging,
		onMusicVolChange,
		openMusicSheet,
		closeMusicSheet,
		onMusicMaskClose,
	}
}
