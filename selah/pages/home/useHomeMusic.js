/**
 * 首页顶栏音乐按钮。播放器在 utils/homeMusic.js，离开页面不会停。
 */
import { ref, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createTapLock } from '@/utils/tapLock.js'
import { isHomeMusicOn, subscribeHomeMusic, toggleHomeMusic as toggleGlobal } from '@/utils/homeMusic.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

const tapLock = createTapLock(420)

export function useHomeMusic() {
	const musicPlaying = ref(isHomeMusicOn())
	const stopSub = subscribeHomeMusic((on) => {
		musicPlaying.value = !!on
	})

	onShow(() => {
		musicPlaying.value = isHomeMusicOn()
	})

	onUnmounted(() => {
		stopSub()
	})

	function toggleHomeMusic() {
		tapLock.run(() => {
			try { logFirebaseEvent('home_audio_click') } catch (e) {}
			toggleGlobal()
			musicPlaying.value = isHomeMusicOn()
			try { logFirebaseEvent('audio_play_result', { audio_is: musicPlaying.value ? 'on' : 'off' }) } catch (e) {}
		})
	}

	return { musicPlaying, toggleHomeMusic }
}
