<!--
  App Lock：系统选 App + 权限申请；保存后需每日祷告解锁（应用内门禁）。
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
					<text class="nav-title">{{ t('prayer_lock_choose') }}</text>
				</view>
			</view>
		</view>

		<view class="card master">
			<view class="row last" @tap.stop="toggleEnabled">
				<view class="row-copy">
					<text class="row-label">{{ t('prayer_lock') }}</text>
					<text class="row-desc">{{
						prayerDone ? t('prayer_lock_done_today') : t('prayer_lock_need_pray')
					}}</text>
				</view>
				<view :class="['sw', enabled ? 'on' : '']">
					<view class="sw-knob" />
				</view>
			</view>
		</view>

		<text class="page-lead">{{ t('prayer_lock_system_lead') }}</text>

		<view class="card">
			<view
				v-for="(app, i) in catalog"
				:key="app.id"
				:id="'expo-' + app.id"
				:data-xid="app.id"
				:class="['row expo-plock', i === catalog.length - 1 ? 'last' : '']"
				@tap="toggle(app.id)"
			>
				<text class="row-label">{{ t(app.labelKey) }}</text>
				<text v-if="selected.includes(app.id)" class="check">✓</text>
			</view>
		</view>

		<text class="hint">{{ t('prayer_lock_system_hint') }}</text>

		<view class="footer">
			<view :class="['cta', saving ? 'disabled' : '']" @tap="onSave">
				<text class="cta-text">{{ t('save') }}</text>
			</view>
			<view class="cta outline" @tap="goPray">
				<text class="cta-text dark">{{ t('prayer_lock_go_pray') }}</text>
			</view>
		</view>

		<view v-if="permOpen" class="mask" @tap="closePerm">
			<view class="sheet" @tap.stop>
				<text class="sheet-title">{{ t('prayer_lock_perm_title') }}</text>
				<text class="sheet-body">{{ t('prayer_lock_perm_body') }}</text>
				<view class="sheet-actions">
					<view class="sheet-btn solid" @tap="grantPerm">
						<text class="sheet-btn-text solid-text">{{ t('alarm_go_settings') }}</text>
					</view>
					<view class="sheet-btn ghost" @tap="closePerm">
						<text class="sheet-btn-text ghost-text">{{ t('alarm_maybe_later') }}</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiPrayerLockPrefsGet, apiPrayerLockPrefsSave } from '@/api/content.js'
import { safeBack, goTab } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import {
	SYSTEM_APP_CATALOG,
	getLocalPrayerLockPrefs,
	applyPrayerLockPrefsLocal,
	isPrayerDoneToday,
	openSystemAppLockSettings,
} from '@/utils/prayerLock.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const fromProfile = ref(false)
const saving = ref(false)
const permOpen = ref(false)
const catalog = SYSTEM_APP_CATALOG
const selected = ref([])
const enabled = ref(false)
const lastPrayerDate = ref('')
const screenAuth = ref(false)
const dirty = ref(false)
let skipNextShowLoad = false

const prayerDone = computed(() =>
	isPrayerDoneToday({
		last_prayer_date: lastPrayerDate.value,
	}),
)

onLoad((q) => {
	fromProfile.value = q?.from === 'profile'
})

function goBack() {
	safeBack('/pagesA/prayer-lock/prayer-lock?from=' + (fromProfile.value ? 'profile' : 'settings'))
}

function goPray() {
	goTab('/pages/ai/ai')
}

function persistLocalPartial(patch) {
	return applyPrayerLockPrefsLocal({
		...getLocalPrayerLockPrefs(),
		enabled: enabled.value,
		app_ids: selected.value,
		last_prayer_date: lastPrayerDate.value || '',
		screen_time_authorized: screenAuth.value,
		...patch,
	})
}

function setEnabled(on) {
	const next = !!on
	enabled.value = next
	dirty.value = true
	persistLocalPartial({ enabled: next })
	if (next && !screenAuth.value) {
		permOpen.value = true
	}
}

let enableLockUntil = 0
function toggleEnabled() {
	const now = Date.now()
	if (now < enableLockUntil) return
	enableLockUntil = now + 350
	setEnabled(!enabled.value)
}

function toggle(id) {
	const set = new Set(selected.value)
	if (set.has(id)) set.delete(id)
	else set.add(id)
	selected.value = Array.from(set)
	dirty.value = true
	persistLocalPartial({ app_ids: selected.value })
}

function applyLocal(prefs) {
	selected.value = prefs.app_ids || []
	enabled.value = !!prefs.enabled
	lastPrayerDate.value = prefs.last_prayer_date || ''
	screenAuth.value = !!prefs.screen_time_authorized
}

function mergeServerPrefs(data) {
	const local = getLocalPrayerLockPrefs()
	return applyPrayerLockPrefsLocal({
		...(data || {}),
		screen_time_authorized: !!(data?.screen_time_authorized || local.screen_time_authorized),
		enabled: dirty.value ? !!local.enabled : !!(data?.enabled ?? local.enabled),
		app_ids: dirty.value ? (local.app_ids || []) : (data?.app_ids || data?.feature_ids || local.app_ids || []),
	})
}

async function load() {
	if (dirty.value) return
	try {
		const res = await apiPrayerLockPrefsGet()
		if (dirty.value) return
		applyLocal(mergeServerPrefs(res.results || {}))
	} catch (e) {
		if (dirty.value) return
		applyLocal(getLocalPrayerLockPrefs())
	}
}

async function onSave() {
	if (saving.value) return
	const local = getLocalPrayerLockPrefs()
	const on = dirty.value ? !!local.enabled : !!enabled.value
	enabled.value = on
	if (on && !selected.value.length) {
		uni.showToast({ title: t('prayer_lock_pick_one'), icon: 'none' })
		return
	}
	saving.value = true
	try {
		const payload = {
			enabled: on,
			app_ids: selected.value,
			last_prayer_date: lastPrayerDate.value || '',
			screen_time_authorized: !!screenAuth.value,
		}
		const res = await apiPrayerLockPrefsSave(payload)
		dirty.value = false
		const prefs = applyPrayerLockPrefsLocal({
			...(res.results || {}),
			...payload,
		})
		applyLocal(prefs)
		uni.showToast({ title: t('saved'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		saving.value = false
	}
}

function closePerm() {
	permOpen.value = false
}

function grantPerm() {
	const opened = openSystemAppLockSettings()
	screenAuth.value = true
	enabled.value = true
	dirty.value = true
	skipNextShowLoad = true
	persistLocalPartial({
		enabled: true,
		screen_time_authorized: true,
	})
	permOpen.value = false
	if (!opened) {
		uni.showToast({ title: t('prayer_lock_perm_manual'), icon: 'none' })
	}
}

onShow(() => {
	if (skipNextShowLoad) {
		skipNextShowLoad = false
		return
	}
	if (dirty.value) return
	load()
})
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 260rpx;
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
	margin: 24rpx 0 20rpx;
	font-size: 28rpx;
	line-height: 1.4;
	color: $selah-ink-soft;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 8rpx 24rpx;
	margin-bottom: 24rpx;
}
.card.master {
	margin-top: 12rpx;
}
.row {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	min-height: 96rpx;
	border-bottom: 1rpx solid rgba(25, 25, 25, 0.08);
}
.row.last {
	border-bottom: none;
}
.row-copy {
	flex: 1;
	margin-right: 16rpx;
}
.row-label {
	display: block;
	font-size: 30rpx;
	color: $selah-ink;
}
.row-desc {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: $selah-muted;
}
.sw {
	position: relative;
	flex-shrink: 0;
	width: 102rpx;
	height: 62rpx;
	border-radius: 62rpx;
	background: rgba(120, 120, 128, 0.16);
	transition: background 0.2s ease;
}
.sw.on {
	background: $selah-ink;
}
.sw-knob {
	position: absolute;
	top: 4rpx;
	left: 4rpx;
	width: 54rpx;
	height: 54rpx;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.18);
	transition: transform 0.2s ease;
}
.sw.on .sw-knob {
	transform: translateX(40rpx);
}
.check {
	font-size: 32rpx;
	color: $selah-ink;
	font-weight: 700;
}
.hint {
	display: block;
	font-size: 24rpx;
	color: $selah-muted;
	line-height: 1.5;
	padding: 0 8rpx;
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
	margin-bottom: 16rpx;
}
.cta.outline {
	background: transparent;
	border: 2rpx solid $selah-ink;
}
.cta.disabled {
	opacity: 0.4;
}
.cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
.cta-text.dark {
	color: $selah-ink;
}
.mask {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.45);
	z-index: 40;
	display: flex;
	align-items: flex-end;
}
.sheet {
	width: 100%;
	background: #fff;
	border-radius: 32rpx 32rpx 0 0;
	padding: 40rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}
.sheet-title {
	display: block;
	@include selah-display-title;
	font-size: 40rpx;
	margin-bottom: 16rpx;
}
.sheet-body {
	display: block;
	font-size: 28rpx;
	line-height: 1.45;
	color: $selah-ink-soft;
	margin-bottom: 32rpx;
}
.sheet-actions {
	display: flex;
	flex-direction: column;
}
.sheet-btn {
	height: 88rpx;
	border-radius: $selah-radius-btn;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 16rpx;
}
.sheet-btn.solid {
	background: $selah-ink;
}
.sheet-btn.ghost {
	border: 2rpx solid $selah-ink;
}
.sheet-btn-text {
	font-size: 30rpx;
	font-weight: 600;
}
.solid-text {
	color: #fff;
}
.ghost-text {
	color: $selah-ink;
}
</style>
