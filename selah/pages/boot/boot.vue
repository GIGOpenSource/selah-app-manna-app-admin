<!--
  冷启闸：主包入口页（分包 Welcome 不能做第一页）。
  在本页 onMounted 后再 reLaunch，避免 App.onLaunch 同步跳转导致安卓点击失效。
-->
<template>
	<view class="boot">
		<view class="mist" />
		<text class="brand">{{ t('brand') }}</text>
	</view>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ensureLogin, shouldForceLoginPage, hasLocalSession } from '@/utils/session.js'
import { setUserProps } from '@/utils/analytics.js'
import { routeAfterLogin, safeRelaunch } from '@/utils/coldStart.js'
import { refreshBootstrapCaches } from '@/utils/bootstrap.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import { queueDeletionPrompt } from '@/utils/accountDeletion.js'
import { consumeAlarmOpenPage, peekAlarmRinging } from '@/utils/alarmClock.js'

const { t } = useI18n()
let left = false
let started = false

function stillOnBoot() {
	try {
		const pages = getCurrentPages()
		const cur = pages && pages.length ? pages[pages.length - 1] : null
		const route = String((cur && (cur.route || '')) || '')
		return route === 'pages/boot/boot' || route.endsWith('/boot/boot')
	} catch (e) {
		return false
	}
}

async function startRoute() {
	if (left || started) return
	started = true
	const alarmPage = consumeAlarmOpenPage()
	if (alarmPage) {
		safeRelaunch(alarmPage)
		return
	}
	if (peekAlarmRinging()) {
		safeRelaunch('/pagesA/alarm/ring')
		return
	}
	if (shouldForceLoginPage() || !hasLocalSession()) {
		safeRelaunch('/pagesA/welcome/welcome')
		return
	}
	try {
		const user = await ensureLogin()
		if (left || !stillOnBoot()) return
		queueDeletionPrompt(user)
		refreshBootstrapCaches().catch(() => {})
		setUserProps({
			user_id: user.user_id,
			vip_level: user.vip_level,
			register_country: user.register_country || '',
			gender: user.gender || '',
			faith_type: user.faith_type,
			prayer_frequency: user.prayer_frequency,
			login_type: user.login_type,
			system_lang: user.system_lang || getCurrentLanguage() || 'en',
		})
		await routeAfterLogin(user)
	} catch (e) {
		if (left || !stillOnBoot()) return
		safeRelaunch('/pagesA/welcome/welcome')
	}
}

onMounted(() => {
	// 下一帧再跳，保证首屏 webview 事件已就绪
	setTimeout(() => {
		startRoute()
	}, 32)
})

onUnmounted(() => {
	left = true
})
</script>

<style scoped lang="scss">
@import '@/styles/selah-theme.scss';

.boot {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background: $selah-bg;
	position: relative;
	overflow: hidden;
}
.mist {
	position: absolute;
	inset: 0;
	pointer-events: none;
	background: linear-gradient(180deg, $selah-grad-top 0%, $selah-grad-mid 55%, $selah-bg 100%);
}
.brand {
	position: relative;
	z-index: 1;
	font-family: $selah-font-display;
	font-size: 56rpx;
	font-weight: 700;
	color: $selah-ink;
	opacity: 0.85;
}
</style>
