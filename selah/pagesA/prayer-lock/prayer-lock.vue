<!--
  祷告锁引导：对齐 Figma 136:24915（App 内锁文案）。
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
					<text class="nav-title">{{ t('prayer_lock') }}</text>
				</view>
			</view>
		</view>

		<view class="hero">
			<view class="hero-art">
				<image class="hero-img" src="/static/ui/grid-prayer-lock.png" mode="aspectFit" />
			</view>
			<text class="hero-title">{{ t('prayer_lock_title') }}</text>
			<text class="hero-sub">{{ t('prayer_lock_sub') }}</text>
			<text v-if="statusLine" class="hero-status">{{ statusLine }}</text>
		</view>

		<view class="footer">
			<view class="cta" @tap="goChoose">
				<text class="cta-text">{{ t('prayer_lock_choose') }}</text>
			</view>
			<view class="cta outline" @tap="goPray">
				<text class="cta-text dark">{{ t('prayer_lock_go_pray') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { track } from '@/utils/analytics.js'
import {
	getLocalPrayerLockPrefs,
	isPrayerDoneToday,
	applyPrayerLockPrefsLocal,
} from '@/utils/prayerLock.js'
import { apiPrayerLockPrefsGet } from '@/api/content.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const fromProfile = ref(false)
const prefs = ref(getLocalPrayerLockPrefs())

const statusLine = computed(() => {
	if (!prefs.value.enabled) return ''
	if (isPrayerDoneToday(prefs.value)) return t('prayer_lock_done_today')
	const n = (prefs.value.app_ids || []).length
	return t('prayer_lock_locked_n', { n })
})

onLoad((q) => {
	fromProfile.value = q?.from === 'profile'
	track('prayer_lock_view', { mode: 'in_app' })
})

async function refresh() {
	try {
		const res = await apiPrayerLockPrefsGet()
		prefs.value = applyPrayerLockPrefsLocal(res.results || {})
	} catch (e) {
		prefs.value = getLocalPrayerLockPrefs()
	}
}

function goBack() {
	safeBack(fromProfile.value ? '/pages/profile/profile' : '/pagesA/settings/settings')
}

function goChoose() {
	track('prayer_lock_choose_tap', {})
	uni.navigateTo({
		url: `/pagesA/prayer-lock/apps?from=${fromProfile.value ? 'profile' : 'settings'}`,
	})
}

function goPray() {
	uni.switchTab({ url: '/pages/ai/ai' })
}

onShow(refresh)
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 220rpx;
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
.hero {
	margin-top: 100rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 0 16rpx;
}
.hero-art {
	width: 320rpx;
	height: 320rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 40rpx;
}
.hero-img {
	width: 240rpx;
	height: 240rpx;
}
.hero-title {
	@include selah-display-title;
	font-size: 52rpx;
	text-align: center;
	margin-bottom: 20rpx;
}
.hero-sub {
	font-size: 32rpx;
	line-height: 1.4;
	text-align: center;
	color: $selah-ink;
}
.hero-status {
	margin-top: 24rpx;
	font-size: 26rpx;
	color: $selah-muted;
	text-align: center;
}
.footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
	background: #f7f4f1;
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
.cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
.cta-text.dark {
	color: $selah-ink;
}
</style>
