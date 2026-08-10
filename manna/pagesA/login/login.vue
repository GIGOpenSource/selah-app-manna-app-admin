<!--
  Login：对齐 Selah — Apple / Google / 快速登录 → routeAfterAuth → Home。
-->
<template>
	<view class="page">
		<view class="bg" aria-hidden="true">
			<image class="bg-photo" src="/static/ui/home/bg-279-364.png" mode="aspectFill" />
			<view class="bg-fade" />
		</view>

		<view v-if="!forceGate" class="nav" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="nav-pill" @tap.stop="goBack">
				<image class="nav-ico" src="/static/ui/login-ico-back.svg" mode="aspectFit" />
			</view>
		</view>

		<view class="copy">
			<text class="title">{{ pageTitle }}</text>
			<text class="subtitle">{{ pageSub }}</text>
		</view>

		<view class="footer">
			<view class="cta primary" :class="{ disabled: busy }" @tap="loginOauth('apple')">
				<image class="cta-ico" src="/static/ui/login-ico-apple.svg" mode="aspectFit" />
				<text class="cta-text light">{{ t('login_apple') }}</text>
			</view>
			<view class="cta outline" :class="{ disabled: busy }" @tap="loginOauth('google')">
				<image class="cta-ico" src="/static/ui/login-ico-google.svg" mode="aspectFit" />
				<text class="cta-text">{{ t('login_google') }}</text>
			</view>
			<view class="cta outline" :class="{ disabled: busy }" @tap="quickLogin">
				<text class="cta-text">{{ t('login_quick') }}</text>
			</view>
			<view class="legal">
				<text class="legal-plain">{{ t('login_legal_prefix') }}</text>
				<text class="legal-link" @click.stop="openLegalPage('terms')">{{ t('legal_terms') }}</text>
				<text class="legal-plain">{{ t('login_legal_mid') }}</text>
				<text class="legal-link" @click.stop="openLegalPage('privacy')">{{ t('legal_privacy') }}</text>
			</view>
		</view>

		<manna-dialog
			v-model:visible="bindDialogOpen"
			:title="bindDialogTitle"
			:content="bindDialogContent"
			:confirm-text="t('ok') || 'OK'"
			:cancel-text="t('cancel')"
			@confirm="onBindDialogConfirm"
			@cancel="onBindDialogCancel"
		/>
	</view>
</template>

<script setup>
/**
 * Login：流程对齐 Selah；标题/副标题走 AppConfig（app_key×语言×设备），i18n 作回落。
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiOauthLogin } from '@/api/auth.js'
import { apiAppConfig } from '@/api/content.js'
import { ensureLogin, setUser, shouldForceLoginPage, clearForceLoginPage } from '@/utils/session.js'
import { track, setUserProps } from '@/utils/analytics.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { getSandboxOauthId, buildDeviceAuthPayload } from '@/utils/oauth.js'
import { routeAfterAuth } from '@/utils/coldStart.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { IS_NEW_USER_KEY, getCurrentLanguage, setToken } from '@/utils/storageKeys.js'
import { appConfigRevision } from '@/utils/bootstrap.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const busy = ref(false)
const forceGate = ref(shouldForceLoginPage())
const bindDialogOpen = ref(false)
const bindDialogTitle = ref('')
const bindDialogContent = ref('')
const bindDialogMode = ref('prompt')
const bindProvider = ref('google')
const pageTitle = ref(t('login_title'))
const pageSub = ref(t('login_sub'))

function applyLoginCopy(cfg) {
	if (!cfg || typeof cfg !== 'object') return
	const title = String(cfg.login_title || '').trim()
	const sub = String(cfg.login_subtitle || '').trim()
	if (title) pageTitle.value = title
	if (sub) pageSub.value = sub
}

function goBack() {
	if (forceGate.value) return
	safeBack('/pagesA/settings/settings')
}

async function finishLogin(method, user, isNew) {
	clearForceLoginPage()
	forceGate.value = false
	setUser(user)
	setUserProps({
		user_id: user.user_id,
		vip_level: user.vip_level,
		register_country: user.register_country || '',
		login_type: user.login_type || method,
		system_lang: user.system_lang || getCurrentLanguage(),
	})
	track('login_success', {
		method,
		is_new_user: !!isNew,
	})
	uni.showToast({
		title: method === 'device' ? t('login_quick_ok') : t('bound'),
		icon: 'none',
	})
	await routeAfterAuth(user, { isNew: !!isNew })
}

async function quickLogin() {
	if (busy.value) return
	busy.value = true
	track('login_page_continue', { method: 'device' })
	try {
		const user = await ensureLogin({ explicit: true })
		await finishLogin('device', user, !!uni.getStorageSync(IS_NEW_USER_KEY))
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		busy.value = false
	}
}

function loginOauth(provider) {
	if (busy.value) return
	bindProvider.value = provider
	track('bind_prompt_click', { target: provider, scene: 'login_page' })
	track('login_page_continue', { method: provider })
	bindDialogMode.value = 'prompt'
	bindDialogTitle.value = provider === 'apple' ? t('login_apple') : t('login_google')
	bindDialogContent.value = t('bind_sandbox')
	bindDialogOpen.value = true
}

function onBindDialogCancel() {
	if (bindDialogMode.value === 'conflict') {
		track('bind_conflict_cancel', { method: bindProvider.value })
	}
}

async function runOauthLogin(confirmSwitch) {
	const provider = bindProvider.value
	const payload = {
		...buildDeviceAuthPayload(),
		provider,
		oauth_id: getSandboxOauthId(provider),
		confirm_switch: !!confirmSwitch,
	}
	return apiOauthLogin(payload, { silentBizCodes: [409] })
}

async function onBindDialogConfirm() {
	if (busy.value) return
	busy.value = true
	const provider = bindProvider.value
	try {
		if (bindDialogMode.value === 'conflict') {
			track('bind_conflict_confirm', { method: provider })
			const res2 = await runOauthLogin(true)
			if (res2.results?.token) setToken(res2.results.token)
			uni.setStorageSync(IS_NEW_USER_KEY, !!res2.results?.is_new_user)
			await finishLogin(provider, res2.results.user, !!res2.results?.is_new_user)
			return
		}
		const res = await runOauthLogin(false)
		if (res.results?.token) setToken(res.results.token)
		uni.setStorageSync(IS_NEW_USER_KEY, !!res.results?.is_new_user)
		track('bind_success', { method: provider })
		await finishLogin(provider, res.results.user, !!res.results?.is_new_user)
	} catch (e) {
		if (e && e.code === 409) {
			track('bind_conflict_show', { method: provider })
			bindDialogMode.value = 'conflict'
			bindDialogTitle.value = t('account_exists')
			bindDialogContent.value = e.message || t('bind_conflict_hint')
			bindDialogOpen.value = true
			return
		}
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		busy.value = false
	}
}

onMounted(async () => {
	track('login_page_view', {})
	try {
		await loadWithCache(
			APP_CONFIG_KEY,
			async () => {
				const res = await apiAppConfig().catch(() => null)
				return res?.results || null
			},
			async (data) => { applyLoginCopy(data) },
			{ getRevision: appConfigRevision },
		)
	} catch (e) {
		console.warn('login config load failed', e)
	}
})
</script>

<style lang="scss" scoped>
@import '@/styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	width: 100%;
	overflow: hidden;
	background: $manna-peach;
}

.bg {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
.bg-photo {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}
.bg-fade {
	position: absolute;
	inset: 0;
	background: linear-gradient(
		180deg,
		rgba(255, 244, 238, 0.88) 0%,
		rgba(255, 244, 238, 0.15) 50%,
		rgba(255, 244, 238, 0.75) 100%
	);
}

.nav {
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	z-index: 3;
	padding-left: 32rpx;
	box-sizing: border-box;
}
.nav-pill {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.85);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 8rpx;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}

.copy {
	position: absolute;
	left: 48rpx;
	right: 48rpx;
	top: 42%;
	transform: translateY(-50%);
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 20rpx 0;
	box-sizing: border-box;
}
.title {
	display: block;
	width: 100%;
	text-align: center;
	font-family: $manna-font-serif;
	font-size: 52rpx;
	color: $manna-btn-text;
	line-height: 1.2;
}
.subtitle {
	display: block;
	width: 100%;
	margin-top: 20rpx;
	text-align: center;
	font-family: $manna-font-body;
	font-size: 28rpx;
	font-weight: 400;
	color: rgba(33, 33, 33, 0.72);
	line-height: 1.4;
}

.footer {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(48rpx + env(safe-area-inset-bottom));
	z-index: 2;
}
.cta {
	height: 96rpx;
	border-radius: $manna-radius-btn;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	padding: 0 24rpx;
	box-sizing: border-box;
	margin-bottom: 20rpx;
}
.cta.primary {
	background: $manna-btn-text;
	border: 2rpx solid $manna-btn-text;
}
.cta.outline {
	background: rgba(255, 255, 255, 0.82);
	border: 2rpx solid $manna-btn-text;
}
.cta.disabled {
	opacity: 0.55;
}
.cta-ico {
	width: 40rpx;
	height: 40rpx;
	margin-right: 16rpx;
	flex-shrink: 0;
}
.cta-text {
	font-family: $manna-font-body;
	font-size: 32rpx;
	font-weight: 600;
	color: $manna-btn-text;
}
.cta-text.light {
	color: #ffffff;
}
.legal {
	margin-top: 8rpx;
	padding: 24rpx 0;
	text-align: center;
}
.legal-plain,
.legal-link {
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: $manna-btn-text;
	line-height: 1.4;
}
.legal-link {
	font-weight: 700;
	text-decoration: underline;
}
</style>
