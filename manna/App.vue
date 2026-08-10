<script setup>
/**
 * App 启动流（冷启主流程）：
 * 注销本机 → Welcome；否则 ensureLogin → Welcome 闸 / Home。
 */
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { ensureLogin, shouldForceLoginPage } from '@/utils/session.js'
import { track, setUserProps } from '@/utils/analytics.js'
import { routeAfterLogin } from '@/utils/coldStart.js'
import { hydrateBootstrapCaches, refreshBootstrapCaches } from '@/utils/bootstrap.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { apiMannaActivityPing } from '@/api/manna.js'
import { getCurrentLanguage, getToken, IS_NEW_USER_KEY, migrateLegacyStorageKeys } from '@/utils/storageKeys.js'

onLaunch(async () => {
	migrateLegacyStorageKeys()
	hydrateBootstrapCaches()
	refreshBootstrapCaches().catch(() => {})
	hideNativeTabBar()

	// H5 QA：未设平台时默认 ios，便于命中带 platform 的库内 Scope 行
	// #ifdef H5
	try {
		const plat = String(uni.getStorageSync('debug_x_platform') || '').toLowerCase()
		if (plat !== 'ios' && plat !== 'android') {
			uni.setStorageSync('debug_x_platform', 'ios')
		}
	} catch (e) {}
	// #endif

	if (shouldForceLoginPage()) {
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
		return
	}
	try {
		const user = await ensureLogin()
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
		await routeAfterLogin(user)
	} catch (e) {
		if (e && e.code === 'FORCE_LOGIN') {
			uni.reLaunch({ url: '/pagesA/welcome/welcome' })
			return
		}
		console.error('manna launch login failed', e)
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
	}
})

onShow(() => {
	hideNativeTabBar()
	// 冷启 onShow 常早于 ensureLogin 写 token；无 token 不 ping，避免 401 清会话打断登录
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

page {
	background: #0a0a0a !important;
	color: #ffffff;
	font-family: $manna-font-body;
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
