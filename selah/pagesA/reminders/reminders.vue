<!--
  提醒中心：对齐 Figma 136:24308（渐变卡 + 开关）；文案去竞品名。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-left">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-title">{{ t('reminders') }}</text>
				</view>
			</view>
		</view>

		<text class="page-lead">{{ t('reminders_lead') }}</text>

		<view :class="['rm-card', prefs.record_enabled ? 'on' : 'off']">
			<view class="rm-top">
				<text class="rm-title">{{ t('reminder_record') }}</text>
				<text class="rm-time">{{ t('reminder_record_window') }}</text>
			</view>
			<view class="rm-bottom">
				<text class="rm-meta">{{ t('reminder_record_meta') }}</text>
				<switch
					:checked="prefs.record_enabled"
					@change="onToggle('record_enabled', $event)"
					color="#191919"
				/>
			</view>
		</view>

		<view :class="['rm-card', prefs.checkin_remind_enabled ? 'on' : 'off']">
			<view class="rm-top">
				<text class="rm-title">{{ t('reminder_checkin') }}</text>
				<text class="rm-time">{{ t('reminder_checkin_time') }}</text>
			</view>
			<view class="rm-bottom">
				<text class="rm-meta">{{ t('reminder_checkin_meta') }}</text>
				<switch
					:checked="prefs.checkin_remind_enabled"
					:disabled="!prefs.record_enabled"
					@change="onToggle('checkin_remind_enabled', $event)"
					color="#191919"
				/>
			</view>
		</view>

		<view :class="['rm-card', prefs.streak_remind_enabled ? 'on' : 'off']">
			<view class="rm-top">
				<text class="rm-title">{{ t('reminder_streak') }}</text>
				<text class="rm-time">{{ t('reminder_streak_time') }}</text>
			</view>
			<view class="rm-bottom">
				<text class="rm-meta">{{ t('reminder_streak_meta') }}</text>
				<switch
					:checked="prefs.streak_remind_enabled"
					:disabled="!prefs.record_enabled"
					@change="onToggle('streak_remind_enabled', $event)"
					color="#191919"
				/>
			</view>
		</view>

		<text class="hint">{{ t('reminders_hint') }}</text>

		<view class="footer">
			<view class="cta" @tap="onUnlock">
				<text class="cta-text">{{ t('reminders_unlock') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiReminderPrefsGet, apiReminderPrefsSave } from '@/api/checkin.js'
import { getUser, setUser } from '@/utils/session.js'
import { applyReminderPrefsLocal, getLocalReminderPrefs } from '@/utils/reminder.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { track } from '@/utils/analytics.js'
import { goVip } from '@/utils/vip.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const loading = ref(false)
const prefs = ref(getLocalReminderPrefs())
const fromProfile = ref(false)

onLoad((q) => {
	fromProfile.value = q?.from === 'profile'
})

function goBack() {
	safeBack(fromProfile.value ? '/pages/profile/profile' : '/pagesA/settings/settings')
}

function onUnlock() {
	goVip('reminders')
}

async function load() {
	loading.value = true
	try {
		const res = await apiReminderPrefsGet()
		const data = res.results || {}
		prefs.value = applyReminderPrefsLocal(data)
		const u = getUser() || {}
		Object.assign(u, {
			checkin_record_enabled: prefs.value.record_enabled,
			checkin_remind_enabled: prefs.value.checkin_remind_enabled,
			reminder_prefs: prefs.value,
		})
		setUser(u)
	} catch (e) {
		prefs.value = getLocalReminderPrefs()
	} finally {
		loading.value = false
	}
}

async function onToggle(key, e) {
	const val = !!e.detail.value
	const next = { ...prefs.value, [key]: val }
	if (key === 'record_enabled' && !val) {
		next.streak_remind_enabled = false
		next.checkin_remind_enabled = false
	}
	prefs.value = next
	try {
		const res = await apiReminderPrefsSave(next)
		const data = res.results || next
		prefs.value = applyReminderPrefsLocal(data)
		const u = getUser() || {}
		Object.assign(u, {
			checkin_record_enabled: prefs.value.record_enabled,
			checkin_remind_enabled: prefs.value.checkin_remind_enabled,
			reminder_prefs: prefs.value,
		})
		setUser(u)
		track('reminder_pref_change', { ...prefs.value })
	} catch (err) {
		await load()
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	}
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 180rpx;
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
	min-height: 88rpx;
}
.nav-left {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 20rpx;
}
.nav-pill {
	@include selah-nav-circle;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.nav-title {
	@include selah-display-title;
	font-size: 40rpx;
}
.page-lead {
	display: block;
	margin: 24rpx 0 28rpx;
	font-size: 36rpx;
	line-height: 1.35;
	color: $selah-ink;
}
.rm-card {
	border-radius: $selah-radius-card;
	padding: 32rpx 24rpx;
	margin-bottom: 24rpx;
	box-sizing: border-box;
}
.rm-card.on {
	background: linear-gradient(180deg, $selah-grad-top 0%, #ffffff 100%);
}
.rm-card.off {
	background: $selah-card;
	opacity: 0.55;
}
.rm-top {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: baseline;
	gap: 16rpx;
}
.rm-title {
	@include selah-display-title;
	font-size: 40rpx;
}
.rm-time {
	font-size: 28rpx;
	color: $selah-ink;
	flex-shrink: 0;
}
.rm-bottom {
	margin-top: 24rpx;
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
}
.rm-meta {
	font-size: 28rpx;
	color: $selah-ink;
	opacity: 0.65;
}
.hint {
	display: block;
	margin-top: 8rpx;
	padding: 0 8rpx;
	font-size: 24rpx;
	color: $selah-muted;
	line-height: 1.5;
}
.footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(245, 245, 245, 0) 0%, $selah-bg-gray 28%);
}
.cta {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
</style>
