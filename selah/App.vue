<script setup>
/**
 * App 启动流：包内公开配置灌入 → TabBar 文案 → 签到提醒 →
 * 注销本机后强制欢迎/登录页 → 否则 ensureLogin → Welcome / Onboarding。
 */
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { ensureLogin, shouldForceLoginPage } from '@/utils/session.js'
import { track, setUserProps } from '@/utils/analytics.js'
import { t } from '@/i18n/index.js'
import { applyTabBarLocale } from '@/utils/tabbar.js'
import { ensureCheckinReminderScheduled } from '@/utils/reminder.js'
import { ensurePrayerAlarmScheduled } from '@/utils/alarm.js'
import { routeAfterLogin } from '@/utils/coldStart.js'
import { hydrateBootstrapCaches, refreshBootstrapCaches } from '@/utils/bootstrap.js'
import { routeFromSelahDeepLink } from '@/utils/selahNative.js'
import { getCurrentLanguage, migrateLegacyStorageKeys } from '@/utils/storageKeys.js'

function handleSelahDeepLink(raw) {
	const url = routeFromSelahDeepLink(raw)
	if (!url) return
	uni.navigateTo({ url, fail: () => uni.reLaunch({ url }) })
}

function readLaunchDeepLink() {
	// #ifdef APP-PLUS
	try {
		const args = plus.runtime.arguments
		if (args) handleSelahDeepLink(String(args))
	} catch (e) {}
	// #endif
}

onLaunch(async () => {
	migrateLegacyStorageKeys()
	// 无本地缓存时先灌包内快照，冷启 Welcome / 开关不堵网
	hydrateBootstrapCaches()
	// 公开配置后台静默刷新（onboarding 需 token，在 ensureLogin 后再刷）
	refreshBootstrapCaches().catch(() => {})

	applyTabBarLocale(t)
	ensureCheckinReminderScheduled()
	ensurePrayerAlarmScheduled()
	readLaunchDeepLink()
	if (shouldForceLoginPage()) {
		// 注销本机后：先 Welcome，Continue 后再进 Login
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
		return
	}
	try {
		const user = await ensureLogin()
		// 登录后补刷问卷题快照
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
		track('login_success', {
			method: user.login_type || 'device',
			is_new_user: !!uni.getStorageSync('is_new_user'),
		})
		await routeAfterLogin(user)
	} catch (e) {
		if (e && e.code === 'FORCE_LOGIN') {
			uni.reLaunch({ url: '/pagesA/welcome/welcome' })
			return
		}
		console.error('launch login failed', e)
	}
})

onShow(() => {
	applyTabBarLocale(t)
	ensureCheckinReminderScheduled()
	ensurePrayerAlarmScheduled()
	// #ifdef APP-PLUS
	try {
		const args = plus.runtime.arguments
		if (args) handleSelahDeepLink(String(args))
	} catch (e) {}
	// #endif
})
</script>

<style lang="scss">
@import "uview-plus/index.scss";
@import "./styles/selah-theme.scss";

@font-face {
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	src: url("/static/fonts/LibreBaskerville.ttf") format("truetype");
	font-weight: 400 700;
	font-style: normal;
	font-display: swap;
}

page {
	background: $selah-bg !important;
	color: $selah-ink;
	font-family: $selah-font-body;
}
</style>
