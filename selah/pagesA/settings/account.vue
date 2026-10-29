<!--
  Account & content：退出登录、注销冷静期、资产、提醒/打卡、App 工具。
-->
<template>
	<view class="page-wrap">
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @click="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ t('account_content') }}</text>
				<view class="nav-spacer" />
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
				<text class="row-label">{{ t('my_affirmations') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section-label">{{ t('reminders') }}</text>
		<view class="card">
			<view class="row last" @click="go('/pagesA/reminders/reminders')">
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
				<switch
					:key="remindSwitchKey"
					:checked="remindOn"
					:disabled="!recordOn"
					@change="onRemind"
					color="#191919"
				/>
			</view>
		</view>

		<template v-if="showWidgetEntry || showIconEntry">
			<text class="section-label">{{ t('section_extras') }}</text>
			<view class="card">
				<view v-if="showWidgetEntry" :class="['row', !showIconEntry ? 'last' : '']" @click="go('/pagesA/widgets/center?from=profile')">
					<text class="row-label">{{ t('widget_teaser_title') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
				<view v-if="showIconEntry" class="row last" @click="go('/pagesA/icons/icons')">
					<text class="row-label">{{ t('icon_teaser_title') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
		</template>

		<view class="account-actions">
			<view class="logout-btn" @click="openLogout">
				<text class="logout-btn-text">{{ t('logout') }}</text>
			</view>
			<template v-if="deletionPending">
				<text class="clear-account-hint">{{ deletionHint }}</text>
				<view class="clear-account-btn" @click="onKeepAccount">
					<text class="clear-account-keep">{{ t('deletion_keep') }}</text>
				</view>
			</template>
			<template v-else>
				<view class="clear-account-btn" @click="openClearAccount">
					<text class="clear-account-btn-text">{{ t('clear_account') }}</text>
				</view>
				<text class="clear-account-hint">{{ t('clear_account_hint') }}</text>
			</template>
		</view>
	</view>

		<selah-dialog
			v-model:visible="logoutOpen"
			:title="t('logout')"
			:content="t('logout_confirm')"
			:confirm-text="t('logout_confirm_btn')"
			:cancel-text="t('cancel')"
			@confirm="onLogout"
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
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiAppConfig } from '@/api/content.js'
import { apiCheckinSettings } from '@/api/checkin.js'
import { apiLogout, apiDeleteAccount, apiAuthMe } from '@/api/auth.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { getUser, setUser, clearAuthToWelcome } from '@/utils/session.js'
import { getAppPlatform } from '@/utils/analytics.js'
import {
	isDeletionPending,
	deletionCountdownText,
	cancelAccountDeletion,
} from '@/utils/accountDeletion.js'
import { scheduleCheckinReminder, clearCheckinReminder } from '@/utils/reminder.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'

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
const remindSwitchKey = ref(0)
const showWidgetEntry = ref(false)
const showIconEntry = ref(false)
const logoutOpen = ref(false)
const clearAccountOpen = ref(false)
const busy = ref(false)
const deletionPending = computed(() => isDeletionPending(user.value))
const deletionHint = computed(() => deletionCountdownText(user.value))

async function refreshLocalUserState() {
	user.value = getUser() || {}
	applyCheckinSwitchState(user.value)
	try {
		const plat = getAppPlatform()
		const res = await apiAuthMe(plat ? { platform: plat } : {}, { skipAuthRetry: true })
		if (res?.results) {
			setUser(res.results)
			user.value = res.results
			applyCheckinSwitchState(user.value)
		}
	} catch (e) {}
}

function applyCheckinSwitchState(source) {
	recordOn.value = source?.checkin_record_enabled !== false
	remindOn.value = recordOn.value && !!source?.checkin_remind_enabled
}

onShow(refreshLocalUserState)

onMounted(async () => {
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
			},
		)
	} catch (e) {
		cfg.value = {}
	}
})

function goBack() {
	safeBack('/pagesA/settings/settings')
}

function go(url) {
	uni.navigateTo({ url })
}

function writeCheckinUser(payload) {
	Object.assign(user.value, payload)
	user.value.checkin_record_enabled = payload.checkin_record_enabled
	user.value.checkin_remind_enabled = payload.checkin_remind_enabled
	setUser(user.value)
}

async function onRecord(e) {
	recordOn.value = !!e.detail.value
	if (!recordOn.value) {
		remindOn.value = false
		remindSwitchKey.value += 1
		user.value.checkin_record_enabled = false
		user.value.checkin_remind_enabled = false
		setUser(user.value)
		clearCheckinReminder()
	}
	const payload = {
		checkin_record_enabled: recordOn.value,
		checkin_remind_enabled: recordOn.value ? !!remindOn.value : false,
	}
	const res = await apiCheckinSettings(payload)
	writeCheckinUser({ ...(res?.results || {}), ...payload })
}

async function onRemind(e) {
	if (!recordOn.value) {
		remindOn.value = false
		remindSwitchKey.value += 1
		return
	}
	remindOn.value = !!e.detail.value
	const payload = {
		checkin_record_enabled: true,
		checkin_remind_enabled: remindOn.value,
	}
	const res = await apiCheckinSettings(payload)
	writeCheckinUser({ ...(res?.results || {}), ...payload })
	if (remindOn.value) {
		scheduleCheckinReminder({ enabled: true })
		uni.showToast({ title: t('reminder_on'), icon: 'none' })
	} else {
		clearCheckinReminder()
		uni.showToast({ title: t('reminder_off'), icon: 'none' })
	}
}

function openLogout() {
	if (busy.value) return
	logoutOpen.value = true
}

async function onLogout() {
	try {
		await apiLogout()
	} catch (e) {}
	clearAuthToWelcome()
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
		if (e && e.code === 400) refreshLocalUserState()
	} finally {
		busy.value = false
	}
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page-wrap { min-height: 100vh; position: relative; }
.page {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head { @include selah-sticky-head; }
.head-glass { @include selah-sticky-head-glass($selah-bg-gray); }
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
}
.nav-pill { @include selah-nav-circle; }
.nav-ico { width: 48rpx; height: 48rpx; }
.nav-title { @include selah-display-title; }
.nav-spacer { width: 88rpx; height: 88rpx; visibility: hidden; }
.section-label {
	display: block;
	margin: 28rpx 8rpx 12rpx;
	font-size: 24rpx;
	color: $selah-muted;
	font-weight: 600;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	overflow: hidden;
}
.row {
	display: flex;
	align-items: center;
	padding: 28rpx 24rpx;
	border-bottom: 1rpx solid rgba(25, 25, 25, 0.06);
}
.row.last { border-bottom: none; }
.row.tip { font-size: 22rpx; color: $selah-muted; }
.row-label { flex: 1; font-size: 30rpx; }
.val { font-size: 26rpx; color: $selah-muted; }
.chev { width: 28rpx; height: 28rpx; opacity: 0.4; }
.account-actions { margin-top: 48rpx; text-align: center; }
.logout-btn {
	height: 88rpx;
	border-radius: $selah-radius-card;
	background: $selah-card;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 16rpx;
}
.logout-btn-text {
	font-size: 30rpx;
	font-weight: 600;
	color: $selah-ink;
}
.clear-account-btn {
	display: inline-flex;
	padding: 20rpx 40rpx;
}
.clear-account-btn-text { color: #c0392b; font-size: 28rpx; }
.clear-account-keep { color: $selah-ink; font-size: 28rpx; font-weight: 600; }
.clear-account-hint {
	display: block;
	margin-top: 8rpx;
	padding: 0 24rpx;
	font-size: 22rpx;
	color: $selah-muted;
	line-height: 1.4;
}
</style>
