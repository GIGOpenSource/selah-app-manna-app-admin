<!--
  设置页：昵称、语言、签到提醒、账号绑定等。
  UI 对齐 Figma 9:1222（圆形返回 + 分组白卡）；业务逻辑不变。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ t('settings') }}</text>
				<view class="nav-spacer" />
			</view>
		</view>

		<text class="section-label">{{ t('section_premium') }}</text>
		<view class="card">
			<view class="row last" @click="goVip">
				<text class="row-label">{{ t('subscription') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section-label">{{ t('section_about_you') }}</text>
		<view class="card">
			<view class="row" @click="openNameDialog">
				<text class="row-label">{{ t('display_name') }}</text>
				<view class="row-trail">
					<text class="val">{{ displayName || t('display_name_empty') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row last">
				<text class="row-label">{{ t('device_id') }}</text>
				<text class="val tiny">{{ deviceHint }}</text>
			</view>
		</view>

		<text class="section-label">{{ t('section_make_yours') }}</text>
		<view class="card">
			<view class="row">
				<text class="row-label">{{ t('sound') }}</text>
				<switch :checked="soundOn" @change="onSound" color="#191919" />
			</view>
			<view class="row">
				<text class="row-label">{{ t('muted') }}</text>
				<switch :checked="mutedOn" @change="onMuted" color="#191919" />
			</view>
			<view class="row" @click="pickLang">
				<text class="row-label">{{ t('language') }}</text>
				<view class="row-trail">
					<text class="val">{{ langDisplay }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row last">
				<text class="row-label">{{ t('marketing') }}</text>
				<switch :checked="marketingOn" @change="onMarketing" color="#191919" />
			</view>
		</view>

		<text class="section-label">{{ t('section_account') }}</text>
		<view class="card">
			<view class="row" v-if="!user.google_bound" @click="bindOauth('google')">
				<text class="row-label">{{ t('bind_google') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" v-if="!user.apple_bound" @click="bindOauth('apple')">
				<text class="row-label">{{ t('bind_apple') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row tip" v-if="!user.google_bound && !user.apple_bound">
				<text>{{ t('bind_tip') }}</text>
			</view>
			<view class="row last" v-if="user.google_bound || user.apple_bound">
				<text class="row-label">{{ t('bound') }}</text>
				<text class="val">OK</text>
			</view>
		</view>

		<text class="section-label">{{ t('section_my_content') }}</text>
		<view class="card">
			<view class="row" @click="go('/pagesA/assets/assets?kind=like')">
				<text class="row-label">{{ t('likes') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" @click="go('/pagesA/assets/assets?kind=collect')">
				<text class="row-label">{{ t('collections') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" @click="go('/pagesA/assets/assets?kind=history')">
				<text class="row-label">{{ t('history') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row last" @click="go('/pagesA/assets/assets?kind=affirmation')">
				<text class="row-label">{{ t('affirmations') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section-label">{{ t('reminders') }}</text>
		<view class="card">
			<view class="row last" @click="goReminders">
				<text class="row-label">{{ t('reminders') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section-label">{{ t('checkin') }}</text>
		<view class="card">
			<view class="row">
				<text class="row-label">{{ t('checkin_record') }}</text>
				<switch :checked="recordOn" @change="onRecord" color="#191919" />
			</view>
			<view class="row last">
				<text class="row-label">{{ t('checkin_remind') }}</text>
				<switch :checked="remindOn" :disabled="!recordOn" @change="onRemind" color="#191919" />
			</view>
		</view>

		<template v-if="showSupportSelah">
			<text class="section-label">{{ t('support_selah') }}</text>
			<view class="card">
				<view class="row" @click="onSupportRate">
					<text class="row-label">{{ t('support_rate') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
				<view class="row" @click="onSupportShare">
					<text class="row-label">{{ t('support_share') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
				<template v-if="socialConfigured.length">
					<view
						v-for="s in socialConfigured"
						:key="'support-' + s.key"
						class="row"
						@click="onSupportFollow(s)"
					>
						<text class="row-label">{{ t('support_follow') }} · {{ s.label }}</text>
						<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
					</view>
				</template>
				<view class="row last" @click="onSupportHelp">
					<text class="row-label">{{ t('support_help') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
		</template>

		<template v-if="showWidgetEntry || showIconEntry">
			<text class="section-label">{{ t('section_extras') }}</text>
			<view class="card">
				<view v-if="showWidgetEntry" :class="['row', !showIconEntry ? 'last' : '']" @click="goWidget">
					<text class="row-label">{{ t('widget_teaser_title') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
				<view v-if="showIconEntry" class="row last" @click="goIcon">
					<text class="row-label">{{ t('icon_teaser_title') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
		</template>

		<text class="section-label">{{ t('section_help') }}</text>
		<view class="card">
			<view class="row" @click="openLegalPage('help', cfg)">
				<text class="row-label">{{ t('legal_help') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" @click="openLegalPage('privacy', cfg)">
				<text class="row-label">{{ t('legal_privacy') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" @click="openLegalPage('terms', cfg)">
				<text class="row-label">{{ t('legal_terms') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row last" @click="openLegalPage('subscription', cfg)">
				<text class="row-label">{{ t('legal_subscription') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section-label">{{ t('section_follow') }}</text>
		<view class="card">
			<view
				v-for="(s, i) in socialLinks"
				:key="'follow-' + s.key"
				:class="['row', i === socialLinks.length - 1 && !cfg.url_download ? 'last' : '']"
				@click="openSocial(s)"
			>
				<text class="row-label">{{ s.label }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view v-if="cfg.url_download" class="row last" @click="shareApp">
				<text class="row-label">{{ t('share_app') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<view class="meta" @click="copyUserId">
			<view class="meta-copy">
				<text>{{ cfg.brand_name || 'Selah' }} · {{ version }}</text>
				<text>User ID {{ user.user_id }}</text>
				<text v-if="cfg.support_email">{{ cfg.support_email }}</text>
			</view>
			<image class="meta-ico" src="/static/ui/ico-share.svg" mode="aspectFit" />
		</view>

		<view class="clear-account">
			<view class="clear-account-btn" @click="openClearAccount">
				<text class="clear-account-btn-text">{{ t('clear_account') }}</text>
			</view>
			<text class="clear-account-hint">{{ t('clear_account_hint') }}</text>
		</view>

		<selah-sheet
			v-model:visible="langSheetOpen"
			v-model="lang"
			:title="t('language')"
			:items="langOptions"
			:cancel-text="t('cancel')"
			@select="onLangSelect"
		/>
		<selah-dialog
			v-model:visible="nameDialogOpen"
			:title="t('edit_display_name')"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="onNameDialogConfirm"
		>
			<input
				v-model="nameDraft"
				class="name-dialog-input"
				:placeholder="t('display_name')"
				:maxlength="32"
				:focus="nameDialogOpen"
			/>
		</selah-dialog>
		<selah-dialog
			v-model:visible="bindDialogOpen"
			:title="bindDialogTitle"
			:content="bindDialogContent"
			:confirm-text="t('ok') || 'OK'"
			:cancel-text="t('cancel')"
			@confirm="onBindDialogConfirm"
			@cancel="onBindDialogCancel"
		/>
		<selah-dialog
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
/**
 * 设置：资料、音效/静音、营销开关、语言、签到提醒。
 */
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { apiAppConfig } from '@/api/content.js'
import { apiCheckinSettings } from '@/api/checkin.js'
import { apiUpdateProfile, apiBindOauth, apiLogout } from '@/api/auth.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { getUser, setUser, clearLocalAccount } from '@/utils/session.js'
import { track } from '@/utils/analytics.js'
import { getOrCreateDeviceId } from '@/utils/device.js'
import { getSandboxOauthId } from '@/utils/oauth.js'
import { setLocale, getLocale } from '@/i18n/index.js'
import { useI18n } from 'vue-i18n'
import { applyTabBarLocale } from '@/utils/tabbar.js'
import { scheduleCheckinReminder, clearCheckinReminder } from '@/utils/reminder.js'
import { playSfx } from '@/utils/sfx.js'
import { safeBack } from '@/utils/nav.js'
import { goVip as navigateVip } from '@/utils/vip.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { getCurrentLanguage, setCurrentLanguage } from '@/utils/storageKeys.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle } = useCollapsingTitle({
	mode: 'bar',
	statusBarPx,
	fontStartRpx: 40,
	fontEndRpx: 34,
	leftStartPercent: 16,
})

const cfg = ref({})
const user = ref(getUser())
const recordOn = ref(true)
const remindOn = ref(true)
const soundOn = ref(true)
const mutedOn = ref(false)
const marketingOn = ref(true)
const displayName = ref('')
const nameDialogOpen = ref(false)
const nameDraft = ref('')
const lang = ref('en')
const version = ref('1.0.0')
const deviceHint = ref('')
const showWidgetEntry = ref(false)
const showIconEntry = ref(false)
const showSupportSelah = ref(true)

function resolveAppVersion() {
	try {
		const info = uni.getSystemInfoSync?.() || {}
		const v = info.appVersion || info.appWgtVersion || info.hostVersion || ''
		if (v) {
			version.value = String(v)
			return
		}
	} catch (e) {}
	// #ifdef APP-PLUS
	try {
		plus.runtime.getProperty(plus.runtime.appid, (inf) => {
			if (inf && (inf.version || inf.versionCode)) {
				version.value = String(inf.version || inf.versionCode)
			}
		})
	} catch (e) {}
	// #endif
}
const langSheetOpen = ref(false)
const bindDialogOpen = ref(false)
const bindDialogTitle = ref('')
const bindDialogContent = ref('')
const bindDialogMode = ref('prompt')
const bindProvider = ref('google')
const clearAccountOpen = ref(false)
const clearAccountBusy = ref(false)

const langOptions = computed(() => [
	{ code: 'en', label: t('lang_en') },
	{ code: 'zh', label: t('lang_zh') },
	{ code: 'es', label: t('lang_es') },
	{ code: 'pt', label: t('lang_pt') },
	{ code: 'ja', label: t('lang_ja') },
	{ code: 'ko', label: t('lang_ko') },
])

const LANG_CODES = ['en', 'zh', 'es', 'pt', 'ja', 'ko']

/** 归一化 zh-CN / en_US → zh / en，避免与选项 code 对不上 */
function normalizeLang(raw) {
	const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-')
	if (!s) return ''
	if (LANG_CODES.includes(s)) return s
	const base = s.split('-')[0]
	return LANG_CODES.includes(base) ? base : ''
}

/** 以当前 i18n 为准，再回落本地存储 / 用户画像 */
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
	// 治好 storage 与 UI 不一致，避免下次再漂
	if (normalizeLang(stored) !== next) {
		try {
			setCurrentLanguage(next)
		} catch (e) {}
	}
}

const langDisplay = computed(() => {
	const code = normalizeLang(lang.value) || 'en'
	const hit = langOptions.value.find((x) => x.code === code)
	return hit ? hit.label : code
})

/** 社交行：Follow us 区块展示全部；Support 仅点已配置 URL。 */
const socialLinks = computed(() => {
	const c = cfg.value || {}
	return [
		{ key: 'instagram', label: 'Instagram', url: c.url_instagram },
		{ key: 'tiktok', label: 'TikTok', url: c.url_tiktok },
		{ key: 'facebook', label: 'Facebook', url: c.url_facebook },
	]
})
const socialConfigured = computed(() => socialLinks.value.filter((s) => !!s.url))

function refreshLocalUserState() {
	user.value = getUser() || {}
	recordOn.value = user.value.checkin_record_enabled !== false
	remindOn.value = !!user.value.checkin_remind_enabled
	soundOn.value = user.value.sound_enabled !== false
	mutedOn.value = !!user.value.muted
	marketingOn.value = user.value.marketing_opt_in !== false
	displayName.value = user.value.display_name || ''
	syncLangDisplay()
	const did = getOrCreateDeviceId()
	deviceHint.value = did ? `${did.slice(0, 8)}…` : '—'
}

onShow(() => {
	refreshLocalUserState()
})

onMounted(async () => {
	resolveAppVersion()
	refreshLocalUserState()
	try {
		await loadWithCache(
			APP_CONFIG_KEY,
			async () => (await apiAppConfig()).results || {},
			(results) => {
				cfg.value = results || {}
				const c = cfg.value
				showWidgetEntry.value = !!(c.widget_enabled ?? c.widget_teaser_enabled ?? true)
				showIconEntry.value = !!(c.app_icon_enabled ?? c.app_icon_teaser_enabled ?? true)
				showSupportSelah.value = c.support_selah_enabled !== false
			},
		)
	} catch (e) {
		cfg.value = {}
	}
})

function goBack() {
	safeBack('/pages/profile/profile')
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
			if (res2.results.token) uni.setStorageSync('token', res2.results.token)
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

async function persistProfile(patch) {
	const res = await apiUpdateProfile(patch)
	setUser(res.results)
	user.value = res.results
}

function openNameDialog() {
	nameDraft.value = displayName.value || ''
	nameDialogOpen.value = true
}

async function onNameDialogConfirm() {
	const next = (nameDraft.value || '').trim()
	displayName.value = next
	try {
		await persistProfile({ display_name: next })
		uni.showToast({ title: t('saved'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	}
}

function onSound(e) {
	soundOn.value = e.detail.value
	persistProfile({ sound_enabled: soundOn.value })
	if (soundOn.value) playSfx()
}

function onMuted(e) {
	mutedOn.value = e.detail.value
	if (mutedOn.value) soundOn.value = false
	persistProfile({ muted: mutedOn.value, sound_enabled: soundOn.value })
}

function onMarketing(e) {
	marketingOn.value = e.detail.value
	persistProfile({ marketing_opt_in: marketingOn.value })
}

function pickLang() {
	langSheetOpen.value = true
}

function onLangSelect({ value }) {
	if (!value) return
	const next = normalizeLang(value) || 'en'
	lang.value = next
	setLocale(next)
	applyTabBarLocale(t)
	persistProfile({ system_lang: next })
}

async function onRecord(e) {
	recordOn.value = e.detail.value
	if (!recordOn.value) {
		remindOn.value = false
		clearCheckinReminder()
	}
	const res = await apiCheckinSettings({
		checkin_record_enabled: recordOn.value,
		checkin_remind_enabled: remindOn.value,
	})
	Object.assign(user.value, res.results)
	setUser(user.value)
	track('checkin_setting_toggle', { record_on: recordOn.value, remind_on: remindOn.value })
}

async function onRemind(e) {
	remindOn.value = e.detail.value
	const res = await apiCheckinSettings({ checkin_remind_enabled: remindOn.value })
	Object.assign(user.value, res.results)
	setUser(user.value)
	track('checkin_setting_toggle', { record_on: recordOn.value, remind_on: remindOn.value })
	if (remindOn.value) {
		scheduleCheckinReminder({ enabled: true, hour: 9, minute: 0 })
		uni.showToast({ title: t('reminder_on'), icon: 'none' })
	} else {
		clearCheckinReminder()
		uni.showToast({ title: t('reminder_off'), icon: 'none' })
	}
}

function open(url) {
	if (!url) return
	// #ifdef H5
	window.open(url, '_blank')
	// #endif
	// #ifdef APP-PLUS
	plus.runtime.openURL(url)
	// #endif
}

function openSocial(s) {
	if (s.url) {
		open(s.url)
		return
	}
	uni.showToast({ title: t('coming_soon') || 'Soon', icon: 'none' })
}

function shareApp() {
	const href = cfg.value.url_download || ''
	if (!href) {
		uni.showToast({ title: t('coming_soon'), icon: 'none' })
		return
	}
	// #ifdef H5
	if (navigator.share) {
		navigator.share({ title: 'Selah', url: href }).catch(() => open(href))
	} else {
		open(href)
	}
	// #endif
	// #ifdef APP-PLUS
	plus.runtime.openURL(href)
	// #endif
}

function goVip() {
	navigateVip('settings')
}

function go(url) {
	uni.navigateTo({ url })
}

function goReminders() {
	uni.navigateTo({ url: '/pagesA/reminders/reminders' })
}

function goWidget() {
	uni.navigateTo({ url: '/pagesA/widgets/widgets' })
}

function goIcon() {
	uni.navigateTo({ url: '/pagesA/icons/icons' })
}

function onSupportRate() {
	track('support_action', { action: 'rate' })
	const url = cfg.value.url_rate || cfg.value.url_download || ''
	if (url) {
		open(url)
		return
	}
	uni.showToast({ title: t('coming_soon'), icon: 'none' })
}

function onSupportShare() {
	track('support_action', { action: 'share' })
	shareApp()
}

function onSupportFollow(s) {
	track('support_action', { action: 'follow', target: s.key })
	openSocial(s)
}

function onSupportHelp() {
	track('support_action', { action: 'help' })
	const mail = cfg.value.support_email
	if (mail) {
		open(`mailto:${mail}`)
		return
	}
	openLegalPage('help', cfg.value)
}

function copyUserId() {
	const id = String(user.value.user_id || '')
	if (!id) return
	uni.setClipboardData({ data: id })
}

function openClearAccount() {
	if (clearAccountBusy.value) return
	clearAccountOpen.value = true
}

async function onClearAccountConfirm() {
	if (clearAccountBusy.value) return
	clearAccountBusy.value = true
	try {
		try {
			await apiLogout()
		} catch (e) {
			/* 本地注销仍继续：网络失败不阻断清会话 */
		}
		const { device_id } = await clearLocalAccount()
		deviceHint.value = device_id ? `${device_id.slice(0, 8)}…` : '—'
		user.value = {}
		uni.showToast({ title: t('clear_account_done'), icon: 'none' })
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
	} catch (e) {
		clearAccountBusy.value = false
		uni.showToast({ title: e.message || e.msg || 'Failed', icon: 'none' })
	}
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head {
	@include selah-sticky-head;
}
.head-glass {
	@include selah-sticky-head-glass($selah-bg-gray);
}
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 0 0 12rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.nav-pill {
	@include selah-nav-circle;
	position: relative;
	z-index: 2;
	flex-shrink: 0;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.nav-title {
	@include selah-display-title;
}
.nav-spacer {
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
	visibility: hidden;
}
.section-label {
	display: block;
	margin-top: 24rpx;
	margin-bottom: 8rpx;
	padding: 16rpx 16rpx 8rpx;
	font-size: 28rpx;
	color: $selah-ink;
	opacity: 0.6;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	overflow: hidden;
}
.row {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	min-height: 112rpx;
	padding: 32rpx;
	border-bottom: 1rpx solid $selah-divider;
	box-sizing: border-box;
}
.row.last,
.card .row:last-child {
	border-bottom: none;
}
.row.tip {
	display: block;
	font-size: 24rpx;
	color: #8a8a8a;
	line-height: 1.4;
	background: #fafafa;
}
.row-label {
	font-size: 32rpx;
	color: #191919;
}
.row-trail {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.chev {
	width: 48rpx;
	height: 48rpx;
	margin-left: 8rpx;
	flex-shrink: 0;
}
.name-dialog-input {
	width: 100%;
	margin: 8rpx 0 28rpx;
	padding: 24rpx 28rpx;
	background: #f5f5f5;
	border-radius: 20rpx;
	font-size: 30rpx;
	color: #191919;
	box-sizing: border-box;
	text-align: center;
}
.val {
	color: #8a8a8a;
	font-size: 28rpx;
	max-width: 360rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.val.tiny {
	font-size: 22rpx;
	max-width: 360rpx;
	overflow: hidden;
}
.meta {
	margin-top: 40rpx;
	padding: 24rpx 32rpx;
	background: #f2f1ed;
	border: 2rpx solid rgba(25, 25, 25, 0.1);
	border-radius: 32rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	box-sizing: border-box;
}
.meta-copy {
	flex: 1;
	display: flex;
	flex-direction: column;
	color: #5c5c5c;
	font-size: 22rpx;
}
.meta-copy text {
	margin-bottom: 6rpx;
}
.meta-ico {
	width: 36rpx;
	height: 36rpx;
	opacity: 0.55;
	margin-left: 16rpx;
}
.clear-account {
	margin-top: 48rpx;
	padding-bottom: 48rpx;
	display: flex;
	flex-direction: column;
	align-items: stretch;
}
.clear-account-btn {
	min-height: 96rpx;
	padding: 28rpx 32rpx;
	border-radius: 32rpx;
	border: 2rpx solid rgba(180, 48, 48, 0.35);
	background: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.clear-account-btn-text {
	font-size: 30rpx;
	color: #b43030;
	font-weight: 600;
}
.clear-account-hint {
	margin-top: 16rpx;
	padding: 0 8rpx;
	font-size: 22rpx;
	line-height: 1.4;
	color: #8a8a8a;
	text-align: center;
}
</style>
