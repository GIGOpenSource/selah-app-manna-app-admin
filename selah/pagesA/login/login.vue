<!--
  Login：布局对齐 Welcome（居中文案 + 底部 CTA 区）；底图独立 login-bg.jpg。
  Apple / Google / 快速登录。
-->
<template>
	<view class="page">
		<view class="bg" aria-hidden="true">
			<view class="bg-base" />
			<image class="bg-photo" src="/static/ui/login-bg.jpg" mode="aspectFill" />
			<view class="bg-fade" />
		</view>

		<view v-if="!forceGate" class="nav" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="nav-pill" @tap.stop="goBack">
				<image class="nav-ico" src="/static/ui/login-ico-back.svg" mode="aspectFit" />
			</view>
		</view>

		<view class="copy">
			<text class="title">{{ t('login_title') }}</text>
			<text class="subtitle">{{ t('login_sub') }}</text>
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

		<selah-dialog
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiOauthLogin } from '@/api/auth.js'
import { ensureLogin, setUser, shouldForceLoginPage, clearForceLoginPage } from '@/utils/session.js'
import { track, setUserProps } from '@/utils/analytics.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { getSandboxOauthId, buildDeviceAuthPayload } from '@/utils/oauth.js'
import { routeAfterAuth } from '@/utils/coldStart.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const busy = ref(false)
const forceGate = ref(shouldForceLoginPage())
const bindDialogOpen = ref(false)
const bindDialogTitle = ref('')
const bindDialogContent = ref('')
const bindDialogMode = ref('prompt')
const bindProvider = ref('google')

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
		gender: user.gender || '',
		faith_type: user.faith_type,
		prayer_frequency: user.prayer_frequency,
		login_type: user.login_type || method,
		system_lang: user.system_lang || getCurrentLanguage() || 'en',
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
		await finishLogin('device', user, !!uni.getStorageSync('is_new_user'))
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
			if (res2.results?.token) uni.setStorageSync('token', res2.results.token)
			uni.setStorageSync('is_new_user', !!res2.results?.is_new_user)
			await finishLogin(provider, res2.results.user, !!res2.results?.is_new_user)
			return
		}
		const res = await runOauthLogin(false)
		if (res.results?.token) uni.setStorageSync('token', res.results.token)
		uni.setStorageSync('is_new_user', !!res.results?.is_new_user)
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
	} finally {
		busy.value = false
	}
}

onMounted(() => {
	track('login_page_view', {})
})
</script>

<style lang="scss" scoped>
@import '@/styles/selah-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	width: 100%;
	overflow: hidden;
	background: $selah-bg;
}

.bg {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
.bg-base {
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, $selah-grad-top 0%, $selah-grad-mid 100%);
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
		$selah-grad-mid 0%,
		rgba(245, 245, 245, 0) 59.4%
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
	@include selah-nav-circle;
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
	font-family: $selah-font-display;
	font-size: 52rpx;
	font-weight: 700;
	color: $selah-ink;
	line-height: 1.2;
}
.subtitle {
	display: block;
	width: 100%;
	margin-top: 20rpx;
	text-align: center;
	font-family: $selah-font-body;
	font-size: 32rpx;
	font-weight: 400;
	color: $selah-ink;
	line-height: 1.35;
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
	border-radius: $selah-radius-btn;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	padding: 0 24rpx;
	box-sizing: border-box;
	margin-bottom: 20rpx;
}
.cta:last-of-type {
	margin-bottom: 0;
}
.cta.primary {
	background: $selah-ink;
	border: 2rpx solid $selah-ink;
}
.cta.outline {
	background: rgba(255, 255, 255, 0.72);
	border: 2rpx solid $selah-ink;
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
	font-family: $selah-font-body;
	font-size: 32rpx;
	font-weight: 600;
	color: $selah-ink;
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
	font-family: $selah-font-body;
	font-size: 24rpx;
	color: $selah-ink;
	line-height: 1.4;
}
.legal-link {
	font-weight: 700;
	text-decoration: underline;
}
</style>
