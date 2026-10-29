<!--
  冷启闸：主包入口页（分包 Welcome 不能做第一页）。
  未登录直接进 Welcome，不先挂载首页再跳。
  在本页 onMounted 后再跳，避免 App.onLaunch 同步 reLaunch 导致安卓点击失效。
-->
<template>
	<view class="boot">
		<view class="mist" />
		<text class="brand">{{ t('brand') }}</text>
	</view>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { t, syncLocaleFromUser } from '@/i18n/index.js'
import { ensureLogin, shouldForceLoginPage, hasLocalSession } from '@/utils/session.js'
import { isDeletionPending } from '@/utils/accountDeletion.js'
import { track, setUserProps } from '@/utils/analytics.js'
import { routeAfterLogin, safeRelaunch } from '@/utils/coldStart.js'
import { refreshBootstrapCaches } from '@/utils/bootstrap.js'
import { getCurrentLanguage, IS_NEW_USER_KEY, FORCE_LOGIN_KEY } from '@/utils/storageKeys.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'

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
	hideNativeTabBar({ force: true })

	// 无登录态 / 强制登录：直接 Welcome，绝不先闪首页
	if (shouldForceLoginPage() || !hasLocalSession()) {
		safeRelaunch('/pagesA/welcome/welcome')
		return
	}

	try {
		const user = await ensureLogin()
		if (left || !stillOnBoot()) return
		// 全局语言以服务端 system_lang 为准（换设备 / 重装后再切回来也一致）
		syncLocaleFromUser(user)
		refreshBootstrapCaches().catch(() => {})
		setUserProps({
			user_id: user.user_id,
			vip_level: user.vip_level,
			register_country: user.register_country || '',
			login_type: user.login_type,
			system_lang: user.system_lang || getCurrentLanguage(),
		})
		track('login_success', {
			method: user.login_type || 'device',
			is_new_user: !!uni.getStorageSync(IS_NEW_USER_KEY),
		})
		if (isDeletionPending(user)) {
			try { uni.setStorageSync(FORCE_LOGIN_KEY, '1') } catch (e) {}
			safeRelaunch('/pagesA/login/login')
			return
		}
		await routeAfterLogin(user)
	} catch (e) {
		if (left || !stillOnBoot()) return
		safeRelaunch('/pagesA/welcome/welcome')
	}
}

onMounted(() => {
	setTimeout(() => {
		startRoute()
	}, 32)
})

onUnmounted(() => {
	left = true
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.boot {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background: $manna-peach;
	position: relative;
	overflow: hidden;
}
.mist {
	position: absolute;
	inset: 0;
	pointer-events: none;
	background: linear-gradient(180deg, #fff8f3 0%, $manna-peach 55%, #ffe8d8 100%);
}
.brand {
	position: relative;
	z-index: 1;
	font-family: $manna-font-script;
	font-size: 72rpx;
	font-weight: 400;
	color: $manna-btn-text;
	opacity: 0.88;
}
</style>
