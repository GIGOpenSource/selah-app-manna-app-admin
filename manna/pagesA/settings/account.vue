<template>
	<!-- Account：Sign in / 绑定 Google·Apple / 退出 / 注销 -->
	<view class="page-wrap">
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('login_setting') }}</text>
		</view>


		<!-- 绑定 Google / Apple 暂隐
		<text class="section">{{ t('section_account') }}</text>
		<view class="group">
			<view
				v-if="!platformBound"
				class="row"
				hover-class="row-hover"
				@click="bindOauth"
			>
				<text class="row__lab">{{ oauthProvider === 'apple' ? t('bind_apple') : t('bind_google') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view v-if="!platformBound" class="row tip">
				<text class="row__tip">{{ t('bind_tip') }}</text>
			</view>
			<view v-if="platformBound" class="row last">
				<text class="row__lab">{{ oauthProvider === 'apple' ? t('bound_apple') : t('bound_google') }}</text>
			</view>
		</view>
		-->

		<button class="logout" hover-class="logout--press" @click="openLogout">{{ t('logout') }}</button>

		<view class="clear">
			<template v-if="deletionPending">
				<text class="clear__hint">{{ deletionHint }}</text>
				<view class="clear__btn" @click="onKeepAccount">
					<text class="clear__txt clear__txt--keep">{{ t('deletion_keep') }}</text>
				</view>
			</template>
			<template v-else>
				<view class="clear__btn" @click="openClearAccount">
					<text class="clear__txt">{{ t('clear_account') }}</text>
				</view>
				<text class="clear__hint">{{ t('clear_account_hint') }}</text>
			</template>
		</view>
	</view>

		<!-- 绑定 Google / Apple 冲突弹窗暂隐
		<manna-dialog
			v-model:visible="bindDialogOpen"
			:title="bindDialogTitle"
			:content="bindDialogContent"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="onBindDialogConfirm"
			@cancel="onBindDialogCancel"
		/>
		-->
		<manna-dialog
			v-model:visible="logoutOpen"
			:title="t('logout')"
			:content="t('logout_confirm')"
			:confirm-text="t('logout_confirm_btn')"
			:cancel-text="t('cancel')"
			@confirm="onLogout"
		/>
		<manna-dialog
			v-model:visible="clearAccountOpen"
			:title="t('clear_account')"
			:content="t('clear_account_confirm')"
			:confirm-text="t('clear_account_confirm_btn')"
			:cancel-text="t('cancel')"
			@confirm="onClearAccountConfirm"
		/>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiLogout, apiDeleteAccount, apiAuthMe } from '@/api/auth.js'
import { clearLocalAccount, clearAuthToWelcome, getUser, setUser } from '@/utils/session.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { getAppPlatform } from '@/utils/analytics.js'
import {
	isDeletionPending,
	deletionCountdownText,
	cancelAccountDeletion,
} from '@/utils/accountDeletion.js'
/*
import { apiBindOauth } from '@/api/auth.js'
import { setToken } from '@/utils/storageKeys.js'
import {
	getLoginOauthProvider,
	identityFromAppleSuccess,
	identityFromGoogleSuccess,
	isOauthUserCancel,
	buildOauthLoginPayload,
	startUniLogin,
} from '@/utils/oauth.js'
import { track } from '@/utils/analytics.js'
*/

const { t } = useI18n()
const statusBar = getStatusBarPx()
const clearAccountOpen = ref(false)
const logoutOpen = ref(false)
const user = ref(getUser() || {})
const busy = ref(false)
const deletionPending = computed(() => isDeletionPending(user.value))
const deletionHint = computed(() => deletionCountdownText(user.value))

async function refreshUser() {
	user.value = getUser() || {}
	try {
		const plat = getAppPlatform()
		const res = await apiAuthMe(plat ? { platform: plat } : {}, { skipAuthRetry: true })
		if (res?.results) {
			setUser(res.results)
			user.value = res.results
		}
	} catch (e) {}
}

onShow(refreshUser)

/*
const bindDialogOpen = ref(false)
const bindDialogTitle = ref('')
const bindDialogContent = ref('')
const bindDialogMode = ref('prompt')
const bindProvider = ref('google')
const pendingOauth = ref(null)
const oauthProvider = getLoginOauthProvider()
const platformBound = computed(() => {
	if (oauthProvider === 'apple') return !!user.value.apple_bound
	return !!user.value.google_bound
})
*/

function back() {
	uni.navigateBack({ fail: () => uni.navigateTo({ url: '/pagesA/settings/settings' }) })
}

/*
async function applyBindResult(provider, res) {
	if (res.results?.token) setToken(res.results.token)
	if (res.results?.user) {
		setUser(res.results.user)
		user.value = res.results.user
	}
	uni.showToast({
		title: res.message || (provider === 'apple' ? t('bound_apple') : t('bound_google')),
		icon: 'none',
	})
}

function toastBindFail(e) {
	if (isOauthUserCancel(e)) return
	if (e && (typeof e.code === 'number' || e.statusCode)) return
	uni.showToast({
		title: String(e?.errMsg || e?.message || t('request_failed')),
		icon: 'none',
	})
}

function bindOauth() {
	if (platformBound.value) return
	const provider = oauthProvider
	bindProvider.value = provider
	startUniLogin(provider, {
		success: async (success) => {
			track('bind_prompt_click', { target: provider, scene: 'settings' })
			try {
				pendingOauth.value =
					provider === 'apple'
						? identityFromAppleSuccess(success)
						: await identityFromGoogleSuccess(success)
				const identity = pendingOauth.value || {}
				const res = await apiBindOauth(
					buildOauthLoginPayload(provider, identity, { confirm_switch: false }),
					{ silentBizCodes: [409] },
				)
				track('bind_success', { method: provider })
				await applyBindResult(provider, res)
			} catch (e) {
				if (e && e.code === 409) {
					track('bind_conflict_show', { method: provider })
					bindDialogMode.value = 'conflict'
					bindDialogTitle.value = t('account_exists')
					bindDialogContent.value = e.message || t('bind_conflict_hint')
					bindDialogOpen.value = true
					return
				}
				toastBindFail(e)
			}
		},
		fail: (err) => toastBindFail(err),
	})
}

function onBindDialogCancel() {
	if (bindDialogMode.value === 'conflict') {
		track('bind_conflict_cancel', { method: bindProvider.value })
	}
}

async function onBindDialogConfirm() {
	if (bindDialogMode.value !== 'conflict') return
	const provider = bindProvider.value
	const ident = pendingOauth.value || {}
	track('bind_conflict_confirm', { method: provider })
	try {
		const res2 = await apiBindOauth(
			buildOauthLoginPayload(provider, ident, { confirm_switch: true }),
			{ silentBizCodes: [409] },
		)
		await applyBindResult(provider, res2)
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	}
}
*/

function openLogout() {
	if (busy.value) return
	logoutOpen.value = true
}

async function onLogout() {
	try {
		await apiLogout()
	} catch (e) {}
	await clearLocalAccount()
	uni.reLaunch({ url: '/pagesA/welcome/welcome' })
}

function openClearAccount() {
	if (busy.value || deletionPending.value) return
	clearAccountOpen.value = true
}

async function onKeepAccount() {
	if (busy.value) return
	busy.value = true
	try {
		const next = await cancelAccountDeletion()
		if (next) user.value = next
		uni.showToast({ title: t('deletion_keep_ok'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		busy.value = false
	}
}

async function onClearAccountConfirm() {
	if (busy.value) return
	busy.value = true
	try {
		await apiDeleteAccount({}, { silentBizCodes: [400, 403] })
		clearAuthToWelcome()
	} catch (e) {
		if (e && e.code === 401) {
			clearAuthToWelcome()
			return
		}
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
		if (e && e.code === 400) refreshUser()
	} finally {
		busy.value = false
	}
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page-wrap {
	min-height: 100vh;
	position: relative;
}

.page {
	min-height: 100vh;
	/* 顶距由 :style paddingTop（状态栏）控制，勿用 padding 简写覆盖 */
	padding: 0 40rpx 80rpx;
	box-sizing: border-box;
	@include manna-peach-page;
}

.row-hover {
	opacity: 0.72;
}

.nav {
	display: flex;
	align-items: center;
	padding-top: 24rpx;
	margin-bottom: 48rpx;
}

.nav__back {
	width: 64rpx;
	height: 64rpx;
	margin-right: 8rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.nav__back-ico {
	width: 48rpx;
	height: 48rpx;
}

.nav__press {
	opacity: 0.7;
}

.nav__title {
	@include manna-nav-title;
}

.section {
	display: block;
	margin: 8rpx 8rpx 16rpx;
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.5);
	letter-spacing: 0.04em;
	text-transform: uppercase;
}

.group {
	@include manna-white-card;
	overflow: hidden;
	margin-bottom: 28rpx;
}

.row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 32rpx 28rpx;
	border-bottom: 1rpx solid rgba(33, 33, 33, 0.06);
}

.row:last-child {
	border-bottom: none;
}

.row.tip {
	padding: 20rpx 28rpx 28rpx;
}

.row__lab {
	font-family: $manna-font-body;
	font-size: 30rpx;
	color: $manna-btn-text;
}

.row__val {
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.5);
}

.row__tip {
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.55);
	line-height: 1.4;
}

.chev {
	width: 32rpx;
	height: 32rpx;
	flex-shrink: 0;
}

.logout {
	@include manna-cta-cream;
	height: 88rpx;
	line-height: 88rpx;
	font-size: 30rpx;
	border: none;
	width: 100%;
	background: $manna-btn-text;
	color: #fff;
}

.logout::after {
	border: none;
}

.logout--press {
	opacity: 0.88;
}

.clear {
	margin-top: 48rpx;
	text-align: center;
}

.clear__btn {
	padding: 16rpx;
}

.clear__txt {
	font-size: 28rpx;
	color: rgba(180, 60, 60, 0.9);
	text-decoration: underline;
}

.clear__txt--keep {
	color: $manna-btn-text;
}

.clear__hint {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: rgba(33, 33, 33, 0.45);
	line-height: 1.4;
}
</style>
