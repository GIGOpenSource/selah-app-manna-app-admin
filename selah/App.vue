<script>
/** globalData 供弹层页回调（不依赖 eventChannel） */
export default {
	globalData: {
		__selahModalResolve: null,
		__selahSheetResolve: null,
	},
}
</script>

<script setup>
/**
 * App 启动：灌缓存 / TabBar / 提醒 / 深链。
 * 页面路由改由 pages/boot/boot 在挂载后执行，避免 onLaunch 内 reLaunch
 * 导致安卓欢迎页点击失效、Continue 跳不走。
 */
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { t, getLocale } from '@/i18n/index.js'
import { applyTextDirection } from '@/utils/textDirection.js'
import { applyTabBarLocale } from '@/utils/tabbar.js'
import { refreshDaypartPushes, bindDailyPushOpen, reportNativeDaypartOpen } from '@/utils/reminder.js'
import { hydrateBootstrapCaches, refreshBootstrapCaches } from '@/utils/bootstrap.js'
import { routeFromSelahDeepLink } from '@/utils/selahNative.js'
import { migrateLegacyStorageKeys } from '@/utils/storageKeys.js'
import { pauseHomeMusic, resumeHomeMusic } from '@/utils/homeMusic.js'
import { handleAlarmLaunch, stopForegroundAlarmWatch } from '@/utils/alarmClock.js'

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

let appForegroundAt = 0
let appWasHidden = false

function appLaunch(cold) {
	appForegroundAt = Date.now()
	try { logFirebaseEvent('app_launch', { cold_boot: !!cold }) } catch (e) {}
}

onLaunch(() => {
	appLaunch(true)
	migrateLegacyStorageKeys()
	applyTextDirection(getLocale())
	hydrateBootstrapCaches()
	refreshBootstrapCaches().catch(() => {})
	applyTabBarLocale(t)
	bindDailyPushOpen()
	reportNativeDaypartOpen()
	refreshDaypartPushes().catch(() => {})
	readLaunchDeepLink()
	handleAlarmLaunch()
})

onShow(() => {
	if (appWasHidden) {
		appWasHidden = false
		appLaunch(false)
	}
	applyTextDirection(getLocale())
	applyTabBarLocale(t)
	reportNativeDaypartOpen()
	refreshDaypartPushes().catch(() => {})
	import('@/utils/widgetDesktopSync.js')
		.then((mod) => mod.republishWidgetDesktop())
		.catch(() => {})
	// #ifdef APP-PLUS
	try {
		const args = plus.runtime.arguments
		if (args) handleSelahDeepLink(String(args))
	} catch (e) {}
	// #endif
	resumeHomeMusic()
	handleAlarmLaunch()
})

onHide(() => {
	appWasHidden = true
	const duration = appForegroundAt ? Math.max(0, Math.round((Date.now() - appForegroundAt) / 1000)) : 0
	try { logFirebaseEvent('app_leave', { duration }) } catch (e) {}
	pauseHomeMusic()
	stopForegroundAlarmWatch()
})
</script>

<style lang="scss">
@import "uview-plus/index.scss";
@import "./styles/selah-theme.scss";

@font-face {
	font-family: "SelahDisplay";
	src: url("/static/fonts/LibreBaskerville.ttf") format("truetype");
	font-weight: 400 700;
	font-style: normal;
	font-display: swap;
}

page {
	background: $selah-bg !important;
	color: $selah-ink;
	font-family: $selah-font-body;
	overscroll-behavior: none;
	overscroll-behavior-y: none;
}

/*
 * 阿拉伯语：只改文字方向（RTL + bidi），不镜像整页。
 * 勿给 html/page 设 direction:rtl，否则 flex 行会左右对调。
 */
html.selah-rtl,
html.selah-rtl body,
html.selah-rtl uni-page,
html.selah-rtl uni-page-wrapper,
html.selah-rtl uni-page-body,
html.selah-rtl page {
	direction: ltr;
}

html.selah-rtl uni-text,
html.selah-rtl uni-text span,
html.selah-rtl text,
html.selah-rtl .uni-text,
html.selah-rtl uni-rich-text,
html.selah-rtl rich-text,
html.selah-rtl input,
html.selah-rtl textarea,
html.selah-rtl uni-input,
html.selah-rtl uni-textarea,
html.selah-rtl .uni-input-input,
html.selah-rtl .uni-textarea-textarea,
html.selah-rtl .u-input__content,
html.selah-rtl .u-textarea__field {
	direction: rtl;
	unicode-bidi: plaintext;
}

/* H5：与 App 一样走自定义 dock，藏掉 uni 自带 TabBar；整页撑满手机视口 */
/* #ifdef H5 */
html,
body,
uni-app,
#app {
	height: 100%;
	height: 100dvh;
}
uni-page,
uni-page-wrapper,
uni-page-body {
	height: 100%;
}
html,
body {
	overscroll-behavior: none;
	overscroll-behavior-y: none;
}
uni-page,
uni-page-wrapper,
uni-page-body,
.uni-page-body {
	overscroll-behavior: none;
	overscroll-behavior-y: none;
}
html.selah-hide-tabbar .uni-tabbar,
html.selah-hide-tabbar .uni-tabbar-bottom,
html.selah-hide-tabbar uni-tabbar,
html.selah-hide-tabbar .uni-placeholder {
	display: none !important;
	height: 0 !important;
	overflow: hidden !important;
	visibility: hidden !important;
}
html.selah-hide-tabbar uni-page-wrapper,
html.selah-hide-tabbar uni-page-body,
html.selah-hide-tabbar .uni-page-body,
html.selah-hide-tabbar .uni-app--showtabbar uni-page-wrapper,
html.selah-hide-tabbar .uni-app--showtabbar uni-page-body {
	height: 100% !important;
	bottom: 0 !important;
	padding-bottom: 0 !important;
}
/* #endif */
</style>
