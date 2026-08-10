<!--
  祷告闹钟：对齐 Figma 136:24969 / 权限弹窗 136:25037。
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
					<text class="nav-title">{{ t('alarm') }}</text>
				</view>
			</view>
		</view>

		<text class="page-lead">{{ t('alarm_lead') }}</text>

		<view class="card">
			<view class="row">
				<text class="row-label">{{ t('alarm') }}</text>
				<switch
					:checked="prefs.enabled"
					color="#191919"
					:disabled="saving"
					@change="onToggle"
				/>
			</view>
			<picker
				v-if="prefs.enabled"
				mode="time"
				:value="timePickerValue"
				@change="onTimeChange"
			>
				<view class="row last">
					<text class="row-label">{{ t('alarm_time') }}</text>
					<view class="row-trail">
						<text class="row-value">{{ timeLabel }}</text>
						<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
					</view>
				</view>
			</picker>
		</view>

		<view v-if="permOpen" class="mask" @tap="closePerm">
			<view class="sheet" @tap.stop>
				<text class="sheet-title">{{ t('alarm_perm_title') }}</text>
				<text class="sheet-body">{{ t('alarm_perm_body') }}</text>
				<view class="sheet-actions">
					<view class="sheet-btn ghost" @tap="goSettings">
						<text class="sheet-btn-text ghost-text">{{ t('alarm_go_settings') }}</text>
					</view>
					<view class="sheet-btn solid" @tap="closePerm">
						<text class="sheet-btn-text solid-text">{{ t('alarm_maybe_later') }}</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiAlarmPrefsGet, apiAlarmPrefsSave } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { track } from '@/utils/analytics.js'
import {
	getLocalAlarmPrefs,
	applyAlarmPrefsLocal,
	requestNotificationPermission,
	openAppNotificationSettings,
	formatAlarmTime,
} from '@/utils/alarm.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const fromProfile = ref(false)
const saving = ref(false)
const permOpen = ref(false)
const prefs = ref(getLocalAlarmPrefs())

const timeLabel = computed(() => formatAlarmTime(prefs.value.hour, prefs.value.minute))
const timePickerValue = computed(() => {
	const h = String(prefs.value.hour ?? 8).padStart(2, '0')
	const m = String(prefs.value.minute ?? 0).padStart(2, '0')
	return `${h}:${m}`
})

onLoad((q) => {
	fromProfile.value = q?.from === 'profile'
})

function goBack() {
	safeBack(fromProfile.value ? '/pages/profile/profile' : '/pagesA/settings/settings')
}

async function load() {
	try {
		const res = await apiAlarmPrefsGet()
		prefs.value = applyAlarmPrefsLocal(res.results || {})
	} catch (e) {
		prefs.value = getLocalAlarmPrefs()
	}
}

async function persist(next) {
	saving.value = true
	try {
		const res = await apiAlarmPrefsSave({
			enabled: !!next.enabled,
			hour: next.hour,
			minute: next.minute,
		})
		prefs.value = applyAlarmPrefsLocal(res.results || next)
		track('alarm_pref_change', {
			enabled: prefs.value.enabled,
			hour: prefs.value.hour,
			minute: prefs.value.minute,
		})
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
		await load()
	} finally {
		saving.value = false
	}
}

async function onToggle(e) {
	const on = !!e?.detail?.value
	if (on) {
		const ok = await requestNotificationPermission()
		if (!ok) {
			prefs.value = { ...prefs.value, enabled: false }
			permOpen.value = true
			return
		}
	}
	await persist({
		...prefs.value,
		enabled: on,
	})
}

async function onTimeChange(e) {
	const raw = e?.detail?.value || '08:00'
	const [hs, ms] = String(raw).split(':')
	await persist({
		...prefs.value,
		enabled: true,
		hour: Math.max(0, Math.min(23, parseInt(hs, 10) || 0)),
		minute: Math.max(0, Math.min(59, parseInt(ms, 10) || 0)),
	})
}

function closePerm() {
	permOpen.value = false
}

function goSettings() {
	permOpen.value = false
	openAppNotificationSettings()
}

onMounted(load)
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
	padding: 24rpx 24rpx;
	border-bottom: 1rpx solid $selah-divider;
	box-sizing: border-box;
}
.row.last {
	border-bottom: none;
}
.row-label {
	font-size: 32rpx;
}
.row-trail {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 8rpx;
}
.row-value {
	font-size: 28rpx;
	opacity: 0.6;
}
.chev {
	width: 40rpx;
	height: 40rpx;
	opacity: 0.45;
}
.mask {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
	z-index: 200;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
}
.sheet {
	width: 100%;
	max-width: 600rpx;
	background: #ffffff;
	border-radius: 48rpx;
	padding: 28rpx;
	box-sizing: border-box;
}
.sheet-title {
	display: block;
	font-size: 36rpx;
	font-weight: 600;
	margin-bottom: 16rpx;
}
.sheet-body {
	display: block;
	font-size: 32rpx;
	line-height: 1.35;
	color: $selah-ink;
	margin-bottom: 40rpx;
}
.sheet-actions {
	display: flex;
	flex-direction: row;
	gap: 16rpx;
}
.sheet-btn {
	flex: 1;
	height: 96rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.sheet-btn.ghost {
	background: $selah-bg-gray;
}
.sheet-btn.solid {
	background: $selah-ink;
}
.sheet-btn-text {
	font-size: 32rpx;
}
.ghost-text {
	color: $selah-ink;
	opacity: 0.6;
}
.solid-text {
	color: #ffffff;
	font-weight: 600;
}
</style>
