<!--
  冷启闸：主包入口页（分包 Welcome 不能做第一页）。
  默认只占位；路由由 App.onLaunch 负责。超时仍停在本页时再兜底一次。
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
import { ensureLogin, shouldForceLoginPage } from '@/utils/session.js'
import { routeAfterLogin } from '@/utils/coldStart.js'

const { t } = useI18n()
let timer = null
let left = false

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

async function fallbackRoute() {
	if (left || !stillOnBoot()) return
	if (shouldForceLoginPage()) {
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
		return
	}
	try {
		const user = await ensureLogin()
		if (left || !stillOnBoot()) return
		await routeAfterLogin(user)
	} catch (e) {
		if (left || !stillOnBoot()) return
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
	}
}

onMounted(() => {
	// 给 App.onLaunch 优先权；卡住再兜底，避免与 launch 双路由
	timer = setTimeout(() => {
		fallbackRoute()
	}, 1200)
})

onUnmounted(() => {
	left = true
	if (timer) clearTimeout(timer)
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
