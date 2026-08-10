<template>
	<!-- Settings：对齐 Selah — 语言切换 / OAuth 绑定 / 注销账户 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav" @click="back">
			<text class="nav__back">‹</text>
			<text class="nav__title">{{ t('settings') }}</text>
		</view>

		<view class="group">
			<view class="row" @click="openNameDialog">
				<text class="row__lab">{{ t('settings_name') }}</text>
				<text class="row__val">{{ displayName || t('settings_name_empty') }}</text>
			</view>
			<view class="row" @click="pickLang">
				<text class="row__lab">{{ t('settings_lang') }}</text>
				<text class="row__val">{{ langDisplay }}</text>
			</view>
			<view class="row" @click="toggleSound">
				<text class="row__lab">{{ t('settings_sound') }}</text>
				<text class="row__val">{{ soundOn ? t('on') : t('off') }}</text>
			</view>
		</view>

		<text class="section">{{ t('section_account') }}</text>
		<view class="group">
			<view v-if="!user.google_bound" class="row" @click="bindOauth('google')">
				<text class="row__lab">{{ t('bind_google') }}</text>
				<text class="row__val">›</text>
			</view>
			<view v-if="!user.apple_bound" class="row" @click="bindOauth('apple')">
				<text class="row__lab">{{ t('bind_apple') }}</text>
				<text class="row__val">›</text>
			</view>
			<view v-if="!user.google_bound && !user.apple_bound" class="row tip">
				<text class="row__tip">{{ t('bind_tip') }}</text>
			</view>
			<view v-if="user.google_bound || user.apple_bound" class="row">
				<text class="row__lab">{{ t('bound') }}</text>
				<text class="row__val">OK</text>
			</view>
		</view>

		<button class="logout" hover-class="logout--press" @click="onLogout">{{ t('logout') }}</button>

		<view class="clear">
			<view class="clear__btn" @click="openClearAccount">
				<text class="clear__txt">{{ t('clear_account') }}</text>
			</view>
			<text class="clear__hint">{{ t('clear_account_hint') }}</text>
		</view>

		<manna-sheet
			v-model:visible="langSheetOpen"
			v-model="lang"
			:title="t('language')"
			:items="langOptions"
			:cancel-text="t('cancel')"
			@select="onLangSelect"
		/>
		<manna-dialog
			v-model:visible="nameDialogOpen"
			:title="t('edit_display_name')"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="onNameDialogConfirm"
		>
			<input
				v-model="nameDraft"
				class="name-input"
				:placeholder="t('display_name')"
				:maxlength="32"
				:focus="nameDialogOpen"
			/>
		</manna-dialog>
		<manna-dialog
			v-model:visible="bindDialogOpen"
			:title="bindDialogTitle"
			:content="bindDialogContent"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="onBindDialogConfirm"
			@cancel="onBindDialogCancel"
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
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import {
	setLocale,
	getLocale,
	LANG_PICKER_OPTIONS,
	NATIVE_LANG_LABELS,
	UI_LOCALES,
} from '@/i18n/index.js'
import { apiLogout, apiUpdateProfile, apiBindOauth } from '@/api/auth.js'
import { getUser, setUser, clearLocalAccount } from '@/utils/session.js'
import { getCurrentLanguage, setCurrentLanguage, setToken } from '@/utils/storageKeys.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { applyTabBarLocale } from '@/utils/tabbar.js'
import { getSandboxOauthId } from '@/utils/oauth.js'
import { track } from '@/utils/analytics.js'

const { t } = useI18n()
const statusBar = getStatusBarPx()
const user = ref(getUser() || {})
const displayName = ref('')
const soundOn = ref(true)
const lang = ref('en')
const langSheetOpen = ref(false)
const nameDialogOpen = ref(false)
const nameDraft = ref('')
const bindDialogOpen = ref(false)
const bindDialogTitle = ref('')
const bindDialogContent = ref('')
const bindDialogMode = ref('prompt')
const bindProvider = ref('google')
const clearAccountOpen = ref(false)

/** 仅完整 UI 语言；标签用母语名，不随 t() 变化 */
const langOptions = LANG_PICKER_OPTIONS

function normalizeLang(raw) {
	const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-')
	if (!s) return ''
	if (UI_LOCALES.includes(s)) return s
	const base = s.split('-')[0]
	return UI_LOCALES.includes(base) ? base : ''
}

function syncLangDisplay() {
	let stored = ''
	try {
		stored = getCurrentLanguage() || ''
	} catch (e) {}
	const next =
		normalizeLang(getLocale()) ||
		normalizeLang(stored) ||
		normalizeLang(user.value?.system_lang) ||
		'en'
	lang.value = next
	if (String(stored) !== next) {
		try {
			setCurrentLanguage(next)
		} catch (e) {}
	}
	if (getLocale() !== next) setLocale(next)
}

const langDisplay = computed(() => {
	const code = normalizeLang(lang.value) || 'en'
	return NATIVE_LANG_LABELS[code] || code
})

function refreshUser() {
	user.value = getUser() || {}
	displayName.value = user.value.display_name || ''
	if (typeof user.value.sound_enabled === 'boolean') soundOn.value = user.value.sound_enabled
	syncLangDisplay()
}

onMounted(refreshUser)
onShow(refreshUser)

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

function pickLang() {
	langSheetOpen.value = true
}

function onLangSelect({ value }) {
	if (!value) return
	const next = setLocale(normalizeLang(value) || 'en')
	lang.value = next
	applyTabBarLocale(t)
	persistProfile({ system_lang: next })
}

async function persistProfile(patch) {
	try {
		const res = await apiUpdateProfile(patch)
		setUser(res.results)
		user.value = res.results
	} catch (e) {}
}

function openNameDialog() {
	nameDraft.value = displayName.value || ''
	nameDialogOpen.value = true
}

async function onNameDialogConfirm() {
	const next = (nameDraft.value || '').trim()
	displayName.value = next
	await persistProfile({ display_name: next })
}

function toggleSound() {
	soundOn.value = !soundOn.value
	persistProfile({ sound_enabled: soundOn.value })
}

function bindOauth(provider) {
	bindProvider.value = provider
	track('bind_prompt_click', { target: provider, scene: 'settings' })
	bindDialogMode.value = 'prompt'
	bindDialogTitle.value = provider === 'apple' ? t('bind_apple') : t('bind_google')
	bindDialogContent.value = t('bind_sandbox')
	bindDialogOpen.value = true
}

function onBindDialogCancel() {
	if (bindDialogMode.value === 'conflict') {
		track('bind_conflict_cancel', { method: bindProvider.value })
	}
}

async function onBindDialogConfirm() {
	const provider = bindProvider.value
	const oauth_id = getSandboxOauthId(provider)
	if (bindDialogMode.value === 'conflict') {
		track('bind_conflict_confirm', { method: provider })
		try {
			const res2 = await apiBindOauth({
				provider,
				oauth_id,
				confirm_switch: true,
			}, { silentBizCodes: [409] })
			if (res2.results.token) setToken(res2.results.token)
			setUser(res2.results.user)
			user.value = res2.results.user
			uni.showToast({ title: t('bound'), icon: 'none' })
		} catch (e) {}
		return
	}
	try {
		const res = await apiBindOauth({
			provider,
			oauth_id,
			confirm_switch: false,
		}, { silentBizCodes: [409] })
		setUser(res.results.user)
		user.value = res.results.user
		track('bind_success', { method: provider })
		uni.showToast({ title: t('bound'), icon: 'none' })
	} catch (e) {
		if (e && e.code === 409) {
			track('bind_conflict_show', { method: provider })
			bindDialogMode.value = 'conflict'
			bindDialogTitle.value = t('account_exists')
			bindDialogContent.value = e.message || t('bind_conflict_hint')
			bindDialogOpen.value = true
		}
	}
}

async function onLogout() {
	try {
		await apiLogout()
	} catch (e) {}
	await clearLocalAccount()
	uni.reLaunch({ url: '/pagesA/welcome/welcome' })
}

function openClearAccount() {
	clearAccountOpen.value = true
}

async function onClearAccountConfirm() {
	try {
		await apiLogout()
	} catch (e) {}
	await clearLocalAccount()
	uni.reLaunch({ url: '/pagesA/welcome/welcome' })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	padding: 24rpx 40rpx 80rpx;
	box-sizing: border-box;
	@include manna-peach-page;
}

.nav {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin-bottom: 40rpx;
}

.nav__back {
	font-size: 56rpx;
	line-height: 1;
	color: $manna-btn-text;
	padding-right: 8rpx;
}

.nav__title {
	@include manna-nav-title;
	font-size: 40rpx;
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

.clear__hint {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: rgba(33, 33, 33, 0.45);
	line-height: 1.4;
}

.name-input {
	width: 100%;
	height: 80rpx;
	padding: 0 20rpx;
	box-sizing: border-box;
	background: rgba(0, 0, 0, 0.04);
	border-radius: 16rpx;
	font-size: 28rpx;
	color: $manna-btn-text;
}
</style>
