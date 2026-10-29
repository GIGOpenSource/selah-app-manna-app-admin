<!--
  提醒：清晨 / 正午 / 午后 / 夜晚。点时间或频次可改，开关即时保存。
  进入页面若未开通知，先提示去系统设置；打不开设置时给出错误弹窗。
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

		<view
			v-for="slot in slots"
			:key="slot.id"
			:class="['rm-card', permOn ? 'on' : 'plain']"
		>
			<text class="rm-title">{{ t(`reminder_slot_${slot.id}`) }}</text>
			<text class="rm-sub">{{ t(`reminder_slot_${slot.id}_body`) }}</text>
			<view class="rm-foot">
				<picker
					mode="time"
					:value="timeValue(slot)"
					:disabled="saving"
					@cancel="onEditorCancel"
					@change="(e) => onTimeChange(slot, e)"
				>
					<view @tap="onEditTime">
						<text class="rm-time">{{ timeLabelOf(slot) }}</text>
					</view>
				</picker>
				<view class="rm-freq-row">
					<view class="rm-freq" @tap.stop="onEditFrequency(slot)">
						<text v-if="freqOf(slot) === 'weekdays'" class="rm-freq-count">{{ t('reminder_freq_weekdays') }}</text>
						<template v-else>
							<text class="rm-freq-count">{{ t('reminder_freq_count') }}</text>
							<text class="rm-freq-when">{{ t('reminder_freq_when') }}</text>
						</template>
					</view>
					<switch
						:key="`${slot.id}-${permOn}-${enabledOf(slot)}-${switchEpoch}`"
						class="rm-switch"
						:checked="permOn && enabledOf(slot)"
						:disabled="saving"
						color="#191919"
						@change="(e) => onToggle(slot, e)"
					/>
				</view>
			</view>
		</view>

		<!-- <view v-if="!vipOn" class="footer">
			<view class="cta" @tap="onUnlockMore">
				<text class="cta-text">{{ t('reminders_unlock') }}</text>
			</view>
		</view> -->

		<text v-if="!permOn" class="perm-hint">{{ t('reminders_perm_footer') }}</text>

		<selah-dialog
			v-model:visible="permOpen"
			:title="t('reminders_notif_off_title')"
			:content="t('reminders_notif_off_body')"
			:cancel-text="t('alarm_maybe_later')"
			:confirm-text="t('reminders_notif_open')"
			:close-on-mask="false"
			@confirm="onOpenSettings"
		/>
		<selah-dialog
			v-model:visible="permError"
			:title="t('reminders_notif_error_title')"
			:content="t('reminders_notif_error_body')"
			:show-cancel="false"
			:confirm-text="t('ok')"
			:close-on-mask="false"
		/>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad, onShow, onHide } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiPushRemindersGet, apiPushReminderSave } from '@/api/push.js'
import {
	REMINDER_SLOTS,
	resolveDaypartPrefs,
	applyDaypartPrefs,
	isDaypartRemindersInited,
	daypartPrefsFromPush,
	refreshDaypartPushes,
	formatRemindTime,
} from '@/utils/reminder.js'
import {
	isNotificationAuthorized,
	openAppNotificationSettings,
} from '@/utils/alarm.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { goVip, isVipActive } from '@/utils/vip.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const saving = ref(false)
const prefs = ref(resolveDaypartPrefs(null))
const fromProfile = ref(false)
const permOn = ref(false)
const permOpen = ref(false)
const permError = ref(false)
const vipOn = ref(false)
const prompted = ref(false)
const switchEpoch = ref(0)
const slots = REMINDER_SLOTS
let loadSeq = 0

onLoad((q) => {
	fromProfile.value = q?.from === 'profile'
})

onShow(() => {
	vipOn.value = isVipActive()
	permOn.value = isNotificationAuthorized()
	if (permOn.value) {
		permOpen.value = false
		permError.value = false
		if (isDaypartRemindersInited()) applyDaypartPrefs(prefs.value)
		return
	}
	if (!prompted.value) {
		prompted.value = true
		permOpen.value = true
	}
})

onHide(() => {
	prompted.value = false
})

function goBack() {
	const params = {}
	slots.forEach((slot, i) => {
		params[`reminder_${i + 1}`] = `${t(`reminder_slot_${slot.id}`)}/${timeLabelOf(slot)}/${freqOf(slot) === 'weekdays' ? t('reminder_freq_weekdays') : `${t('reminder_freq_count')}/${t('reminder_freq_when')}`}`
	})
	try { logFirebaseEvent('reminder_page_leave', params) } catch (e) {}
	safeBack(fromProfile.value ? '/pages/profile/profile' : '/pagesA/settings/settings')
}

function enabledOf(slot) {
	return !!prefs.value[`${slot.id}_enabled`]
}

function prefsFromRemote(remote) {
	const next = { ...resolveDaypartPrefs(null) }
	REMINDER_SLOTS.forEach((slot) => {
		next[`${slot.id}_enabled`] = !!remote[`${slot.id}_enabled`]
	})
	return next
}

function timeValue(slot) {
	const hour = prefs.value[`${slot.id}_hour`]
	const minute = prefs.value[`${slot.id}_minute`]
	const h = hour == null ? slot.hour : hour
	const m = minute == null ? slot.minute : minute
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeLabelOf(slot) {
	const hour = Number(prefs.value[`${slot.id}_hour`])
	const minute = Number(prefs.value[`${slot.id}_minute`])
	if (!Number.isFinite(hour) || !Number.isFinite(minute)) return slot.timeLabel
	if (hour === slot.hour && minute === slot.minute) return slot.timeLabel
	return formatRemindTime(hour, minute)
}

function freqOf(slot) {
	return prefs.value[`${slot.id}_freq`] === 'weekdays' ? 'weekdays' : 'daily'
}

function onEditTime() {
	try { logFirebaseEvent('reminder_edit_time_click') } catch (e) {}
}

function onTimeChange(slot, e) {
	const parts = String(e?.detail?.value || '').split(':')
	const hour = Number(parts[0])
	const minute = Number(parts[1])
	if (!Number.isFinite(hour) || !Number.isFinite(minute)) return
	prefs.value = applyDaypartPrefs({
		...prefs.value,
		[`${slot.id}_hour`]: hour,
		[`${slot.id}_minute`]: minute,
	})
	refreshDaypartPushes().catch(() => {})
}

function onEditFrequency(slot) {
	try { logFirebaseEvent('reminder_edit_frequency_click') } catch (e) {}
	uni.showActionSheet({
		itemList: [t('reminder_freq_daily'), t('reminder_freq_weekdays')],
		success: (res) => {
			const freq = res.tapIndex === 1 ? 'weekdays' : 'daily'
			prefs.value = applyDaypartPrefs({ ...prefs.value, [`${slot.id}_freq`]: freq })
			refreshDaypartPushes().catch(() => {})
		},
		fail: () => {
			try { logFirebaseEvent('reminder_editor_action_cancel') } catch (err) {}
		},
	})
}

function onEditorCancel() {
	try { logFirebaseEvent('reminder_editor_action_cancel') } catch (e) {}
}

function onUnlockMore() {
	try { logFirebaseEvent('reminder_unlockMore_click') } catch (e) {}
	goVip('reminders')
}

async function load() {
	const seq = ++loadSeq
	try {
		const res = await apiPushRemindersGet()
		if (seq !== loadSeq || saving.value) return
		const remote = daypartPrefsFromPush(res)
		if (remote) {
			prefs.value = applyDaypartPrefs(prefsFromRemote(remote))
			return
		}
	} catch (e) {
		if (seq !== loadSeq || saving.value) return
	}
	if (seq !== loadSeq || saving.value) return
	prefs.value = applyDaypartPrefs(resolveDaypartPrefs(null))
}

async function onToggle(slot, e) {
	const val = !!e.detail.value
	try { logFirebaseEvent('reminder_toggle_click') } catch (e) {}
	if (saving.value) {
		switchEpoch.value += 1
		return
	}
	if (!permOn.value) {
		switchEpoch.value += 1
		permOpen.value = true
		return
	}
	loadSeq += 1
	const prev = enabledOf(slot)
	prefs.value = applyDaypartPrefs({ ...prefs.value, [`${slot.id}_enabled`]: val })
	saving.value = true
	try {
		await apiPushReminderSave({ key: slot.id, enabled: val }, { loadingText: t('loading') })
		try {
			logFirebaseEvent('reminder_config_save_result', {
				reminder_name: t(`reminder_slot_${slot.id}`),
				time: slot.timeLabel,
				frequency: `${t('reminder_freq_count')}/${t('reminder_freq_when')}`,
			})
		} catch (e) {}
		refreshDaypartPushes().catch(() => {})
	} catch (err) {
		prefs.value = applyDaypartPrefs({ ...prefs.value, [`${slot.id}_enabled`]: prev })
		switchEpoch.value += 1
		try {
			logFirebaseEvent('reminder_config_save_result', {
				reminder_name: t(`reminder_slot_${slot.id}`),
				time: slot.timeLabel,
				frequency: `${t('reminder_freq_count')}/${t('reminder_freq_when')}`,
			})
		} catch (e) {}
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		saving.value = false
	}
}

function onOpenSettings() {
	const opened = openAppNotificationSettings({ silent: true })
	if (!opened) permError.value = true
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx calc(48rpx + env(safe-area-inset-bottom));
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
}
.nav-left .nav-title {
	margin-left: 20rpx;
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
	margin: 8rpx 8rpx 28rpx;
	font-size: 32rpx;
	line-height: 1.4;
	color: $selah-ink;
}
.rm-card {
	display: flex;
	flex-direction: column;
	border-radius: $selah-radius-card;
	padding: 32rpx 28rpx 56rpx;
	margin-bottom: 24rpx;
	box-sizing: border-box;
}
.rm-card.on {
	background: linear-gradient(180deg, $selah-grad-top 0%, #ffffff 72%);
}
.rm-card.plain {
	background: #ffffff;
}
.rm-title {
	@include selah-display-title;
	font-size: 40rpx;
	line-height: 1.2;
}
.rm-sub {
	display: block;
	margin-top: 8rpx;
	font-size: 28rpx;
	line-height: 1.35;
	color: $selah-ink-soft;
}
.rm-foot {
	display: flex;
	flex-direction: column;
	margin-top: 20rpx;
	padding-top: 28rpx;
	border-top: 2rpx dashed rgba(25, 25, 25, 0.22);
}
.rm-time {
	display: block;
	font-size: 28rpx;
	line-height: 1;
	color: $selah-ink;
	margin-bottom: 28rpx;
}
.rm-freq-row {
	display: flex;
	flex-direction: row;
	align-items: center;
	height: 28rpx;
}
.rm-freq {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: row;
	align-items: center;
	font-size: 28rpx;
	line-height: 1;
	color: $selah-ink;
}
.rm-freq-when {
	margin-left: 10rpx;
	color: $selah-muted;
}
.rm-switch {
	flex-shrink: 0;
	margin-left: 16rpx;
}
.footer {
	margin-top: 12rpx;
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
.perm-hint {
	display: block;
	margin-top: 8rpx;
	padding: 0 12rpx;
	font-size: 24rpx;
	line-height: 1.45;
	color: $selah-muted;
	text-align: center;
}
</style>
