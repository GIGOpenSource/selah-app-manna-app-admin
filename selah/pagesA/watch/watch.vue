<!--
  Watch 不可达态（N4 壳页）：真 Extension 未连上时展示。
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
			<image class="art" src="/static/ui/grid-watch.png" mode="aspectFit" />
			<text class="title">{{ t('watch_unreachable_title') }}</text>
			<text class="body">{{ t('watch_unreachable_body') }}</text>
		</view>

		<view class="footer">
			<view class="cta" @tap="goBack">
				<text class="cta-text">{{ t('ok') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { track } from '@/utils/analytics.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()

function goBack() {
	safeBack('/pages/profile/profile')
}

onMounted(() => {
	track('watch_unreachable_view', {})
})
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 48rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
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
.nav-pill {
	@include selah-nav-circle;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.hero {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 48rpx 32rpx;
	text-align: center;
}
.art {
	width: 200rpx;
	height: 200rpx;
	margin-bottom: 40rpx;
}
.title {
	display: block;
	@include selah-display-title;
	font-size: 44rpx;
	margin-bottom: 20rpx;
}
.body {
	display: block;
	font-size: 28rpx;
	line-height: 1.45;
	color: $selah-ink-soft;
}
.footer {
	padding: 24rpx 0 calc(24rpx + env(safe-area-inset-bottom));
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
