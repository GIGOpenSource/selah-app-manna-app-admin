<!--
  成长捆绑包：确认后进入商店 / IAP 支付。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
			</view>
		</view>

		<view class="hero">
			<image class="art" src="/static/ui/grid-bind.png" mode="aspectFit" />
			<text class="title">{{ t('growth_pack_title') }}</text>
			<text class="body">{{ t('growth_pack_body') }}</text>
		</view>

		<view class="card">
			<view v-for="(b, i) in benefits" :key="i" :class="['row', i === benefits.length - 1 ? 'last' : '']">
				<text class="row-label">{{ b }}</text>
			</view>
		</view>

		<view class="footer">
			<view :class="['cta', busy ? 'disabled' : '']" @tap.stop="onConfirm">
				<text class="cta-text">{{ t('growth_pack_confirm') }}</text>
			</view>
			<text class="fine">{{ t('growth_pack_fine') }}</text>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { goVip } from '@/utils/vip.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const busy = ref(false)

const benefits = computed(() => [
	t('growth_pack_b1'),
	t('growth_pack_b2'),
	t('growth_pack_b3'),
])

function goBack() {
	safeBack('/pages/profile/profile')
}

async function onConfirm() {
	if (busy.value) return
	busy.value = true
	try {
		await goVip('growth_pack', { skipTrialIntro: true })
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		setTimeout(() => {
			busy.value = false
		}, 400)
	}
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 200rpx;
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
	min-height: 88rpx;
	align-items: center;
}
.nav-pill {
	@include selah-nav-circle;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	padding: 24rpx 16rpx 36rpx;
}
.art {
	width: 160rpx;
	height: 160rpx;
	margin-bottom: 28rpx;
}
.title {
	display: block;
	@include selah-display-title;
	font-size: 44rpx;
	margin-bottom: 12rpx;
}
.body {
	display: block;
	font-size: 28rpx;
	line-height: 1.45;
	color: $selah-ink-soft;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 8rpx 24rpx;
}
.row {
	min-height: 88rpx;
	display: flex;
	align-items: center;
	border-bottom: 1rpx solid rgba(25, 25, 25, 0.08);
}
.row.last {
	border-bottom: none;
}
.row-label {
	font-size: 28rpx;
	line-height: 1.4;
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
.cta.disabled {
	opacity: 0.4;
}
.cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
.fine {
	display: block;
	margin-top: 16rpx;
	text-align: center;
	font-size: 22rpx;
	color: $selah-muted;
}
</style>
