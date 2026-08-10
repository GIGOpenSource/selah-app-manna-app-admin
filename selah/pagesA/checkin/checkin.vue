<!--
  签到页：视觉对齐 25:6477 教育环；保留领次/分享业务 CTA。
-->
<template>
	<view class="page">
		<view class="custom-nav" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="nav-pill" @tap.stop="goBack">
				<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
		</view>

		<view class="orbit-wrap">
			<view class="orbit" />
			<view v-for="i in 12" :key="'tk'+i" class="tick" :style="tickStyle(i)" />
			<view class="badge">
				<text class="big">{{ status.streak_days || 0 }}</text>
			</view>
		</view>

		<text class="headline">{{ t('checkin_headline') }}</text>

		<view class="card">
			<text class="card-lead">{{ t('checkin_sub') }}</text>
			<view class="week">
				<view v-for="(d, i) in (status.week || [])" :key="d.date || i" class="day-col">
					<text class="dow" :class="{ on: d.state === 'checked' || d.state === 'frozen' }">{{ ['Mo','Tu','We','Th','Fr','Sa','Su'][i] || '' }}</text>
					<view class="day" :class="d.state">
						<text v-if="d.state === 'checked'">✓</text>
						<text v-else-if="d.state === 'frozen'">❄</text>
					</view>
				</view>
			</view>
		</view>

		<text class="hint">{{ t('checkin_hint', { n: status.miss_reset_days || 3 }) }}</text>

		<view v-if="lastPopup" class="result">
			<text class="rt">{{ lastPopup.title }}</text>
			<text class="rs">{{ lastPopup.subtitle }}</text>
			<text v-if="lastPopup.quota_line" class="rq">{{ lastPopup.quota_line }}</text>
		</view>

		<view class="foot-bar">
			<text class="hearts muted-meta">{{ t('hearts') }} ❤ {{ status.streak_hearts || 0 }}</text>
			<view
				v-if="status.show_quota_reward && status.can_checkin_today"
				class="cta"
				@click="doCheckin"
			>
				<text class="cta-text">{{ t('checkin_for_quota') }}</text>
			</view>
			<view
				v-else
				class="cta"
				@click="share"
			>
				<text class="cta-text">{{ t('continue') || t('share_streak') }}</text>
			</view>
			<view
				v-if="status.show_quota_reward && status.can_checkin_today"
				class="cta secondary"
				@click="share"
			>
				<text class="cta-text dark">{{ t('share_streak') }}</text>
			</view>
			<text v-if="status.already && !(status.show_quota_reward && status.can_checkin_today)" class="done">{{ t('checked_today') }}</text>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiCheckinStatus, apiCheckinDo } from '@/api/checkin.js'
import { track } from '@/utils/analytics.js'
import { localizeCheckinPopup } from '@/utils/checkinPopup.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const status = ref({})
const lastPopup = ref(null)

function tickStyle(i) {
	const deg = (i - 1) * 30
	return {
		transform: `rotate(${deg}deg) translateY(-148rpx)`,
	}
}

async function load() {
	const res = await apiCheckinStatus()
	status.value = res.results || {}
}

onMounted(async () => {
	await load()
})

function goBack() {
	safeBack('/pages/profile/profile')
}

async function doCheckin() {
	track('checkin_show', { scene: 'manual' })
	const res = await apiCheckinDo()
	const data = res.results || {}
	if (data.already) {
		track('checkin_already')
		await load()
		return
	}
	lastPopup.value = localizeCheckinPopup(data, t)
	track('checkin_success', {
		streak_days: data.streak_days,
		granted_quota: data.granted_quota,
		hit_cap: data.hit_cap,
		vip_level: data.vip_level,
		frozen_days: (data.frozen_days || []).length,
	})
	if ((data.frozen_days || []).length) {
		track('checkin_freeze', { used_hearts: (data.frozen_days || []).length })
	}
	if (data.scenario === 'restart') {
		track('checkin_reset', { streak_days: data.streak_days })
	}
	await load()
}

function share() {
	track('checkin_share', { streak_days: status.value.streak_days })
	uni.navigateTo({
		url: `/pagesA/share/share?mode=streak&days=${status.value.streak_days || 0}`,
	})
}
</script>

<style scoped>
.page {
	padding: 0 40rpx 48rpx;
	min-height: 100vh;
	background: linear-gradient(180deg, #b6badf 0%, #fff0d9 55%, #fbf8f2 100%);
	color: #191919;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}
.custom-nav {
	position: sticky;
	top: 0;
	z-index: 100;
	display: flex;
	padding: 0 0 8rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.head-glass {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 50%;
	width: 100vw;
	margin-left: -50vw;
	z-index: 0;
	pointer-events: none;
	-webkit-backdrop-filter: blur(32rpx) saturate(1.2);
	backdrop-filter: blur(32rpx) saturate(1.2);
	background-color: transparent;
	background-image: linear-gradient(
		180deg,
		rgba(182, 186, 223, 0.94) 0%,
		rgba(182, 186, 223, 0.82) 55%,
		rgba(182, 186, 223, 0.35) 82%,
		rgba(182, 186, 223, 0) 100%
	);
	-webkit-mask-image: linear-gradient(
		180deg,
		#000 0%,
		#000 48%,
		rgba(0, 0, 0, 0.45) 75%,
		transparent 100%
	);
	mask-image: linear-gradient(
		180deg,
		#000 0%,
		#000 48%,
		rgba(0, 0, 0, 0.45) 75%,
		transparent 100%
	);
}
.nav-pill {
	position: relative;
	z-index: 1;
	width: 88rpx;
	height: 88rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.56);
	box-shadow: 0 8rpx 80rpx rgba(0, 0, 0, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
}
.nav-ico { width: 48rpx; height: 48rpx; }
.orbit-wrap {
	width: 320rpx;
	height: 320rpx;
	margin: 24rpx auto 32rpx;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
}
.orbit {
	position: absolute;
	left: 0; top: 0; right: 0; bottom: 0;
	border-radius: 50%;
	border: 3rpx solid rgba(25, 25, 25, 0.85);
}
.tick {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 5rpx;
	height: 22rpx;
	margin-left: -2.5rpx;
	margin-top: -11rpx;
	background: #191919;
	border-radius: 4rpx;
	transform-origin: center center;
}
.badge {
	width: 248rpx;
	height: 248rpx;
	border-radius: 50%;
	background: linear-gradient(160deg, #efe2c4 0%, #d8d4ef 48%, #c5c3e8 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: inset 0 0 0 2rpx rgba(255, 255, 255, 0.35);
}
.big {
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 100rpx;
	font-weight: 700;
}
.headline {
	display: block;
	text-align: center;
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 42rpx;
	font-weight: 700;
	line-height: 1.3;
	margin-bottom: 36rpx;
	padding: 0 16rpx;
}
.card {
	background: #ffffff;
	border-radius: 32rpx;
	padding: 32rpx 24rpx;
	margin-bottom: 24rpx;
}
.card-lead {
	display: block;
	text-align: center;
	font-size: 26rpx;
	color: #5c5c5c;
	margin-bottom: 24rpx;
}
.week {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
}
.day-col {
	display: flex;
	flex-direction: column;
	align-items: center;
}
.dow {
	font-size: 20rpx;
	color: #8a8a8a;
	margin-bottom: 12rpx;
}
.dow.on { color: #191919; font-weight: 600; }
.day {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	background: #f0ebe3;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 22rpx;
}
.day.checked {
	background: linear-gradient(145deg, #c5c3e8, #b6badf);
	color: #191919;
}
.day.frozen {
	background: #d0d0d0;
}
.foot-bar {
	margin-top: auto;
	padding-top: 24rpx;
}
.hearts {
	color: #d97b8c;
	display: block;
	text-align: center;
	font-size: 22rpx;
	margin-bottom: 8rpx;
}
.muted-meta { opacity: 0.55; }
.hint {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #8a8a8a;
	line-height: 1.4;
	text-align: center;
}
.result {
	margin-top: 32rpx;
	padding: 24rpx;
	background: #ffffff;
	border-radius: 24rpx;
}
.rt { display: block; font-size: 32rpx; margin-bottom: 8rpx; }
.rs { display: block; color: #8a8a8a; font-size: 26rpx; }
.rq { display: block; color: #191919; font-size: 26rpx; margin-top: 12rpx; }
.cta {
	margin-top: 28rpx;
	height: 96rpx;
	border-radius: 32rpx;
	background: #191919;
	display: flex;
	align-items: center;
	justify-content: center;
}
.cta.secondary {
	background: #ffffff;
	border: 2rpx solid #191919;
	margin-top: 20rpx;
}
.cta-text {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
}
.cta-text.dark { color: #191919; }
.done {
	display: block;
	margin-top: 28rpx;
	text-align: center;
	color: #8a8a8a;
}
</style>
