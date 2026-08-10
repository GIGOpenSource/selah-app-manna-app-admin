<!--
  祷告锁 · 选择要 App 内锁定的功能；每日祷告（AI）后解锁。
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
			<view class="row last">
				<view class="row-copy">
					<text class="row-label">{{ t('prayer_lock') }}</text>
					<text class="row-desc">{{
						prayerDone ? t('prayer_lock_done_today') : t('prayer_lock_need_pray')
					}}</text>
				</view>
				<switch :checked="enabled" color="#191919" @change="onEnable" />
			</view>
		</view>

		<text class="page-lead">{{ t('prayer_lock_apps_lead') }}</text>

		<view class="card">
			<view
				v-for="(app, i) in catalog"
				:key="app.id"
				:class="['row', i === catalog.length - 1 ? 'last' : '']"
				@tap="toggle(app.id)"
			>
				<text class="row-label">{{ t(app.labelKey) }}</text>
				<text v-if="selected.includes(app.id)" class="check">✓</text>
			</view>
		</view>

		<text class="hint">{{ t('prayer_lock_hint') }}</text>

		<view class="footer">
			<view :class="['cta', saving ? 'disabled' : '']" @tap="onSave">
				<text class="cta-text">{{ t('save') }}</text>
			</view>
			<view class="cta outline" @tap="goPray">
				<text class="cta-text dark">{{ t('prayer_lock_go_pray') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiPrayerLockPrefsGet, apiPrayerLockPrefsSave } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { track } from '@/utils/analytics.js'
import {
	PRAYER_LOCK_FEATURE_CATALOG,
	getLocalPrayerLockPrefs,
	applyPrayerLockPrefsLocal,
	isPrayerDoneToday,
} from '@/utils/prayerLock.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const fromProfile = ref(false)
const saving = ref(false)
const catalog = PRAYER_LOCK_FEATURE_CATALOG
const selected = ref([])
const enabled = ref(false)
const lastPrayerDate = ref('')

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
	uni.switchTab({ url: '/pages/ai/ai' })
}

function toggle(id) {
	const set = new Set(selected.value)
	if (set.has(id)) set.delete(id)
	else set.add(id)
	selected.value = Array.from(set)
}

function onEnable(e) {
	enabled.value = !!e?.detail?.value
}

function applyLocal(prefs) {
	selected.value = prefs.app_ids || []
	enabled.value = !!prefs.enabled
	lastPrayerDate.value = prefs.last_prayer_date || ''
}

async function load() {
	try {
		const res = await apiPrayerLockPrefsGet()
		const prefs = applyPrayerLockPrefsLocal(res.results || {})
		applyLocal(prefs)
	} catch (e) {
		applyLocal(getLocalPrayerLockPrefs())
	}
}

async function onSave() {
	if (saving.value) return
	saving.value = true
	try {
		const payload = {
			enabled: !!enabled.value && selected.value.length > 0,
			app_ids: selected.value,
			last_prayer_date: lastPrayerDate.value || '',
		}
		if (enabled.value && !selected.value.length) {
			uni.showToast({ title: t('prayer_lock_pick_one'), icon: 'none' })
			saving.value = false
			return
		}
		const res = await apiPrayerLockPrefsSave(payload)
		const prefs = applyPrayerLockPrefsLocal(res.results || payload)
		applyLocal(prefs)
		track('prayer_lock_pref_change', {
			enabled: prefs.enabled,
			count: selected.value.length,
			mode: 'in_app',
		})
		uni.showToast({ title: t('saved'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		saving.value = false
	}
}

onMounted(load)
onShow(load)
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
	font-size: 36rpx;
}
.page-lead {
	display: block;
	margin: 16rpx 0 24rpx;
	font-size: 30rpx;
	line-height: 1.4;
	color: $selah-ink;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	overflow: hidden;
}
.card.master {
	margin-top: 16rpx;
	margin-bottom: 8rpx;
}
.row {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	min-height: 104rpx;
	padding: 24rpx 32rpx;
	border-bottom: 1rpx solid $selah-divider;
	box-sizing: border-box;
}
.row.last {
	border-bottom: none;
}
.row-copy {
	flex: 1;
	min-width: 0;
	padding-right: 24rpx;
}
.row-label {
	font-size: 32rpx;
}
.row-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: $selah-muted;
	line-height: 1.35;
}
.check {
	font-size: 30rpx;
	font-weight: 700;
}
.hint {
	display: block;
	margin-top: 24rpx;
	font-size: 24rpx;
	line-height: 1.45;
	color: $selah-muted;
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
	background: #ffffff;
	border: 2rpx solid $selah-ink;
	margin-bottom: 0;
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
</style>
