<script setup>
/**
 * App 启动：灌缓存 / 藏原生 TabBar / 提醒。
 * 页面路由改由 pages/boot/boot 在挂载后执行：
 * 未登录直接进 Welcome，避免先闪首页再跳。
 */
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { hydrateBootstrapCaches, refreshBootstrapCaches } from '@/utils/bootstrap.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { apiMannaActivityPing } from '@/api/manna.js'
import { getToken, migrateLegacyStorageKeys } from '@/utils/storageKeys.js'
import { ensureMannaRemindersScheduled, bindMannaPushClick } from '@/utils/reminder.js'
import { enableAudioMix } from '@/utils/mixBgmPlayer.js'
import { listenSession } from '@/utils/listenSession.js'
import '@/utils/h5Audio.js'

onLaunch(() => {
	migrateLegacyStorageKeys()
	hydrateBootstrapCaches()
	refreshBootstrapCaches().catch(() => {})
	// 杀进程再进：清听经小卡态；并强制藏原生 tabBar（冷启需延后补刀）
	listenSession.mini = false
	listenSession.keepAlive = false
	listenSession.playing = false
	hideNativeTabBar({ force: true })
	enableAudioMix()
	try {
		bindMannaPushClick()
		ensureMannaRemindersScheduled()
	} catch (e) {}

	// H5 QA：未设平台时默认 ios，便于命中带 platform 的库内 Scope 行
	// #ifdef H5
	try {
		const plat = String(uni.getStorageSync('debug_x_platform') || '').toLowerCase()
		if (plat !== 'ios' && plat !== 'android') {
			uni.setStorageSync('debug_x_platform', 'ios')
		}
	} catch (e) {}
	// #endif
})

onShow(() => {
	hideNativeTabBar({ force: true })
	try {
		bindMannaPushClick()
		ensureMannaRemindersScheduled()
	} catch (e) {}
	// 冷启 onShow 常早于 boot 写 token；无 token 不 ping，避免 401 清会话打断登录
	if (!getToken()) return
	apiMannaActivityPing({ scene: 'app_show' }, { skipAuthRetry: true }).catch(() => {})
})
</script>

<style lang="scss">
@import "uview-plus/index.scss";
@import "./styles/manna-theme.scss";

/* 相对路径让 Vite 打包进 CSS，避免 H5 绝对 /static 偶发未命中 */
@font-face {
	font-family: "Lavishly Yours";
	src: url("./static/ui/fonts/LavishlyYours.ttf") format("truetype");
	font-weight: 400;
	font-style: normal;
	font-display: swap;
}

@font-face {
	font-family: "LavishlyYours";
	src: url("./static/ui/fonts/LavishlyYours.ttf") format("truetype");
	font-weight: 400;
	font-style: normal;
	font-display: swap;
}

@font-face {
	font-family: "Forum";
	src: url("./static/ui/fonts/Forum.ttf") format("truetype");
	font-weight: 400;
	font-style: normal;
	font-display: swap;
}

@font-face {
	font-family: "Lexend";
	src: url("./static/ui/fonts/Lexend-Light.ttf") format("truetype");
	font-weight: 300;
	font-style: normal;
	font-display: swap;
}

@font-face {
	font-family: "Lexend";
	src: url("./static/ui/fonts/Lexend.ttf") format("truetype");
	font-weight: 400;
	font-style: normal;
	font-display: swap;
}

@font-face {
	font-family: "Lexend";
	src: url("./static/ui/fonts/Lexend-Medium.ttf") format("truetype");
	font-weight: 500;
	font-style: normal;
	font-display: swap;
}

@font-face {
	font-family: "Lexend";
	src: url("./static/ui/fonts/Lexend-SemiBold.ttf") format("truetype");
	font-weight: 600;
	font-style: normal;
	font-display: swap;
}

@font-face {
	font-family: "Lexend";
	src: url("./static/ui/fonts/Lexend-Bold.ttf") format("truetype");
	font-weight: 700;
	font-style: normal;
	font-display: swap;
}

page,
html,
body,
uni-page-body,
uni-page-wrapper,
.uni-page-body {
	background: #fff4ee !important;
	color: #212121;
	font-family: $manna-font-body;
	min-height: 100%;
	height: 100%;
}

/* uni-text / button / input 默认不继承 page 字体 */
uni-text,
text,
button,
input,
textarea,
.uni-input-input,
.uni-textarea-textarea {
	font-family: inherit;
}

/* 隐藏原生 tabBar；自定义底栏为页面内 fixed MannaTabBar */
uni-tabbar,
.uni-tabbar,
.uni-tabbar-bottom,
.uni-tabbar-height,
.uni-placeholder-tabbar {
	display: none !important;
	height: 0 !important;
	min-height: 0 !important;
	opacity: 0 !important;
	pointer-events: none !important;
	visibility: hidden !important;
}

uni-page-wrapper,
uni-page-body,
.uni-page-body,
.uni-app--showtabbar uni-page-wrapper {
	--window-bottom: 0px !important;
	--tab-bar-height: 0px !important;
}
</style>
