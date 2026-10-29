<!--
  Login：布局对齐 Welcome（居中文案 + 底部 CTA 区）；底图独立 login-bg.jpg。
  iOS 苹果登录 / Android 谷歌登录 / 快速登录。
-->
<template>
	<view class="page-wrap">
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
			<view
				v-if="oauthProvider === 'apple'"
				class="cta primary"
				:class="{ disabled: busy }"
				@tap="loginOauth('apple')"
			>
				<image class="cta-ico" src="/static/ui/login-ico-apple.svg" mode="aspectFit" />
				<text class="cta-text light">{{ t('login_apple') }}</text>
			</view>
			<view
				v-else
				class="cta outline"
				:class="{ disabled: busy }"
				@tap="loginOauth('google')"
			>
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
	</view>

		<selah-dialog
			v-model:visible="deletionOpen"
			:title="t('deletion_pending_title')"
			:content="deletionBody"
			:confirm-text="t('deletion_keep')"
			:cancel-text="t('deletion_continue')"
			:close-on-mask="false"
			@confirm="onDeletionKeep"
			@cancel="onDeletionContinue"
		/>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiOauthLogin } from '@/api/auth.js'
import { ensureLogin, setUser, shouldForceLoginPage, clearForceLoginPage, hasLocalSession, getUser, FORCE_LOGIN_KEY } from '@/utils/session.js'
import { setUserProps } from '@/utils/analytics.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import {
	buildOauthLoginPayload,
	getLoginOauthProvider,
	identityFromAppleSuccess,
	identityFromGoogleSuccess,
	isOauthUserCancel,
	startUniLogin,
} from '@/utils/oauth.js'
import { routeAfterAuth } from '@/utils/coldStart.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import {
	isDeletionPending,
	deletionPromptContent,
	cancelAccountDeletion,
} from '@/utils/accountDeletion.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const busy = ref(false)
const forceGate = ref(shouldForceLoginPage() || !hasLocalSession())
const oauthProvider = getLoginOauthProvider()
const deletionOpen = ref(false)
const deletionBody = ref('')
const pendingAfterAuth = ref(null)

function goBack() {
	if (forceGate.value) return
	safeBack('/pagesA/settings/settings')
}

async function enterApp(method, user, isNew, message) {
	clearForceLoginPage()
	forceGate.value = false
	const u = user && typeof user === 'object' ? user : {}
	setUser(u)
	setUserProps({
		user_id: u.user_id,
		vip_level: u.vip_level,
		register_country: u.register_country || '',
		gender: u.gender || '',
		faith_type: u.faith_type,
		prayer_frequency: u.prayer_frequency,
		login_type: u.login_type || method,
		system_lang: u.system_lang || getCurrentLanguage() || 'en',
	})
	const title = String(message || '').trim()
	if (title) {
		uni.showToast({
			title,
			icon: 'none',
		})
	}
	await routeAfterAuth(u, { isNew: !!isNew })
}

async function finishLogin(method, user, isNew, message) {
	const u = user && typeof user === 'object' ? user : {}
	setUser(u)
	setUserProps({
		user_id: u.user_id,
		vip_level: u.vip_level,
		register_country: u.register_country || '',
		gender: u.gender || '',
		faith_type: u.faith_type,
		prayer_frequency: u.prayer_frequency,
		login_type: u.login_type || method,
		system_lang: u.system_lang || getCurrentLanguage() || 'en',
	})
	if (isDeletionPending(u)) {
		pendingAfterAuth.value = { method, user: u, isNew, message }
		deletionBody.value = deletionPromptContent(u)
		busy.value = false
		deletionOpen.value = true
		return
	}
	await enterApp(method, u, isNew, message || (method === 'device' ? t('login_quick_ok') : t('bound')))
}

async function onDeletionKeep() {
	try {
		const next = await cancelAccountDeletion()
		const pending = pendingAfterAuth.value || {}
		pendingAfterAuth.value = null
		const user = next || pending.user || getUser()
		uni.showToast({ title: t('deletion_keep_ok'), icon: 'none' })
		await enterApp(pending.method || 'device', user, pending.isNew, '')
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	}
}

function onDeletionContinue() {
	pendingAfterAuth.value = null
	try {
		uni.setStorageSync(FORCE_LOGIN_KEY, '1')
	} catch (e) {}
	forceGate.value = true
}

async function quickLogin() {
	if (busy.value) return
	busy.value = true
	try { logFirebaseEvent('login_quick_click') } catch (e) {}
	try {
		const user = await ensureLogin({ explicit: true })
		await finishLogin('device', user, !!uni.getStorageSync('is_new_user'))
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		busy.value = false
	}
}

async function applyOauthResult(provider, res) {
	if (res.results?.token) uni.setStorageSync('token', res.results.token)
	uni.setStorageSync('is_new_user', !!res.results?.is_new_user)
	await finishLogin(
		provider,
		res.results.user,
		!!res.results?.is_new_user,
		res.message || res.msg || '',
	)
}

function loginOauth(provider) {
	if (busy.value) return
	if (provider === 'google') {
		try { logFirebaseEvent('login_google_click') } catch (e) {}
	}
	startUniLogin(provider, {
		success: async (success) => {
			busy.value = true
			try {
				const identity =
					provider === 'apple'
						? identityFromAppleSuccess(success)
						: await identityFromGoogleSuccess(success)
				if (provider === 'apple' && !identity.id_token) {
					const err = new Error('missing_id_token')
					err.errMsg = 'missing_id_token'
					throw err
				}
				const payload = buildOauthLoginPayload(provider, identity)
				const res = await apiOauthLogin(payload)
				await applyOauthResult(provider, res)
				if (provider === 'google') {
					try { logFirebaseEvent('login_google_result') } catch (e) {}
				}
			} catch (e) {
				toastNativeOauthFail(e)
			} finally {
				busy.value = false
			}
		},
		fail: (err) => toastNativeOauthFail(err),
	})
}

function toastNativeOauthFail(e) {
	if (isOauthUserCancel(e)) return
	// 接口层已 toast 过的业务/网络错误不再重复提示
	if (e && (typeof e.code === 'number' || e.statusCode)) return
	uni.showToast({
		title: String(e?.errMsg || e?.message || t('request_failed')),
		icon: 'none',
	})
}

onMounted(() => {
	try { logFirebaseEvent('loginPage_show') } catch (e) {}
})
</script>

<style lang="scss" scoped>
@import '@/styles/selah-theme.scss';

.page-wrap {
	min-height: 100vh;
	position: relative;
}
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
