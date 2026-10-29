<!--
  Login：对齐 Selah — Apple / Google / 快速登录 → routeAfterAuth → Home。
-->
<template>
	<view class="page-wrap">
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
			<view
				v-if="allowOauth && oauthProvider === 'apple'"
				class="cta primary"
				:class="{ disabled: busy }"
				@tap="loginOauth('apple')"
			>
				<image class="cta-ico" src="/static/ui/login-ico-apple.svg" mode="aspectFit" />
				<text class="cta-text light">{{ t('login_apple') }}</text>
			</view>
			<view
				v-else-if="allowOauth"
				class="cta outline"
				:class="{ disabled: busy }"
				@tap="loginOauth('google')"
			>
				<image class="cta-ico" src="/static/ui/login-ico-google.svg" mode="aspectFit" />
				<text class="cta-text">{{ t('login_google') }}</text>
			</view>
			<view v-if="allowDevice" class="cta outline" :class="{ disabled: busy }" @tap="quickLogin">
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

		<manna-dialog
			v-model:visible="bindDialogOpen"
			:title="bindDialogTitle"
			:content="bindDialogContent"
			:confirm-text="t('ok') || 'OK'"
			:cancel-text="t('cancel')"
			@confirm="onBindDialogConfirm"
			@cancel="onBindDialogCancel"
		/>
		<manna-dialog
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
/**
 * Login：流程对齐 Selah；标题/副标题走 AppConfig（app_key×语言×设备），i18n 作回落。
 * 登录后 routeAfterAuth：后台有问卷则进问卷，否则 Home。
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiOauthLogin } from '@/api/auth.js'
import { apiAppConfig } from '@/api/content.js'
import { ensureLogin, setUser, shouldForceLoginPage, clearForceLoginPage, getUser } from '@/utils/session.js'
import { track, setUserProps } from '@/utils/analytics.js'
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
import {
	isDeletionPending,
	deletionPromptContent,
	cancelAccountDeletion,
} from '@/utils/accountDeletion.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { IS_NEW_USER_KEY, FORCE_LOGIN_KEY, getCurrentLanguage, setToken } from '@/utils/storageKeys.js'
import { appConfigRevision } from '@/utils/bootstrap.js'
import { syncLocaleFromUser } from '@/i18n/index.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const busy = ref(false)
const forceGate = ref(shouldForceLoginPage())
const bindDialogOpen = ref(false)
const bindDialogTitle = ref('')
const bindDialogContent = ref('')
const bindDialogMode = ref('prompt')
const bindProvider = ref('google')
const pendingOauth = ref(null)
const pageTitle = ref(t('login_title'))
const pageSub = ref(t('login_sub'))
const allowOauth = ref(true)
const allowDevice = ref(true)
const oauthProvider = getLoginOauthProvider()
const deletionOpen = ref(false)
const deletionBody = ref('')
const pendingAfterAuth = ref(null)

function applyLoginCopy(cfg) {
	if (!cfg || typeof cfg !== 'object') return
	const title = String(cfg.login_title || '').trim()
	const sub = String(cfg.login_subtitle || '').trim()
	if (title) pageTitle.value = title
	if (sub) pageSub.value = sub
	if (cfg.oauth_login_enabled === false) allowOauth.value = false
	if (cfg.device_login_enabled === false) allowDevice.value = false
}

function goBack() {
	if (forceGate.value) return
	safeBack('/pagesA/settings/settings')
}

async function enterApp(method, user, isNew, toastTitle) {
	clearForceLoginPage()
	forceGate.value = false
	const u = user && typeof user === 'object' ? user : {}
	setUser(u)
	setUserProps({
		user_id: u.user_id,
		vip_level: u.vip_level,
		register_country: u.register_country || '',
		login_type: u.login_type || method,
		system_lang: u.system_lang || getCurrentLanguage(),
	})
	// 全局语言以服务端 user.system_lang 为准，进主流程前先对齐
	syncLocaleFromUser(u)
	const dest = await routeAfterAuth(u, { isNew: !!isNew })
	// 先完成跳转再 toast。登录页里先 toast 再 reLaunch，安卓会丢掉进问卷的导航
	const title = String(toastTitle || '').trim()
	if (title && dest !== 'onboarding') {
		uni.showToast({
			title,
			icon: 'none',
		})
	}
}

async function finishLogin(method, user, isNew, toastTitle) {
	const u = user && typeof user === 'object' ? user : {}
	setUser(u)
	setUserProps({
		user_id: u.user_id,
		vip_level: u.vip_level,
		register_country: u.register_country || '',
		login_type: u.login_type || method,
		system_lang: u.system_lang || getCurrentLanguage(),
	})
	track('login_success', {
		method,
		is_new_user: !!isNew,
	})
	if (isDeletionPending(u)) {
		pendingAfterAuth.value = { method, user: u, isNew, toastTitle }
		deletionBody.value = deletionPromptContent(u)
		busy.value = false
		deletionOpen.value = true
		return
	}
	await enterApp(method, u, isNew, toastTitle || (method === 'device' ? t('login_quick_ok') : ''))
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
	try { uni.setStorageSync(FORCE_LOGIN_KEY, '1') } catch (e) {}
	forceGate.value = true
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

async function loginOauth(provider) {
	if (busy.value) return
	startUniLogin(provider, {
		success: async (success) => {
			bindProvider.value = provider
			track('bind_prompt_click', { target: provider, scene: 'login_page' })
			track('login_page_continue', { method: provider })
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
				pendingOauth.value = identity
				const res = await apiOauthLogin(
					buildOauthLoginPayload(provider, identity),
					{ silentBizCodes: [409] },
				)
				if (res.results?.token) setToken(res.results.token)
				uni.setStorageSync(IS_NEW_USER_KEY, !!res.results?.is_new_user)
				track('bind_success', { method: provider })
				await finishLogin(provider, res.results?.user, !!res.results?.is_new_user, res.message || res.msg || '')
			} catch (e) {
				if (e && e.code === 409) {
					track('bind_conflict_show', { method: provider })
					bindDialogMode.value = 'conflict'
					bindDialogTitle.value = t('account_exists')
					bindDialogContent.value = e.message || t('bind_conflict_hint')
					bindDialogOpen.value = true
					return
				}
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
	if (e && (typeof e.code === 'number' || e.statusCode)) return
	uni.showToast({
		title: String(e?.errMsg || e?.message || t('request_failed')),
		icon: 'none',
	})
}

function onBindDialogCancel() {
	if (bindDialogMode.value === 'conflict') {
		track('bind_conflict_cancel', { method: bindProvider.value })
	}
}

async function runOauthLogin(confirmSwitch) {
	const provider = bindProvider.value
	const ident = pendingOauth.value || {}
	return apiOauthLogin(
		buildOauthLoginPayload(provider, ident, { confirm_switch: !!confirmSwitch }),
		{ silentBizCodes: [409] },
	)
}

async function onBindDialogConfirm() {
	if (busy.value) return
	if (bindDialogMode.value !== 'conflict') return
	busy.value = true
	const provider = bindProvider.value
	try {
		track('bind_conflict_confirm', { method: provider })
		const res2 = await runOauthLogin(true)
		if (res2.results?.token) setToken(res2.results.token)
		uni.setStorageSync(IS_NEW_USER_KEY, !!res2.results?.is_new_user)
		await finishLogin(provider, res2.results?.user, !!res2.results?.is_new_user, res2.message)
	} catch (e) {
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

.page-wrap {
	min-height: 100vh;
	position: relative;
}

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
