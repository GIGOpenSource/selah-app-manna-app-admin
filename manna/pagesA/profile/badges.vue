<template>
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('me_badges') }}</text>
			<view class="nav__spacer" />
		</view>

		<view
			v-for="b in badges"
			:key="b.code || b.id"
			class="card"
			:class="{ 'card--off': !b.earned }"
		>
			<text class="card__t">{{ b.title }}</text>
			<text class="card__m">{{ b.earned ? t('badge_earned') : t('badge_locked') }}</text>
		</view>
		<text v-if="!badges.length && !loading" class="empty">{{ t('badges_empty') }}</text>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { t } from '@/i18n/index.js'
import { apiMannaBadges } from '@/api/manna.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const badges = ref([])
const loading = ref(false)

async function load() {
	loading.value = true
	try {
		const res = await apiMannaBadges()
		badges.value = res?.results || []
	} catch (e) {
		badges.value = []
	} finally {
		loading.value = false
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onMounted(load)
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	padding: 24rpx 40rpx 80rpx;
	box-sizing: border-box;
	@include manna-peach-page;
}

.nav { @include manna-sub-nav; }

.nav__back {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.72);
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav__back-ico { width: 48rpx; height: 48rpx; }
.nav__press { opacity: 0.7; }
.nav__title { @include manna-nav-title; flex: 1; text-align: center; }
.nav__spacer { width: 64rpx; }

.card {
	@include manna-white-card;
	padding: 28rpx 32rpx;
	margin-bottom: 14rpx;
}

.card--off { opacity: 0.48; }

.card__t {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 30rpx;
	color: $manna-btn-text;
	margin-bottom: 6rpx;
}

.card__m {
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.5);
}

.empty {
	display: block;
	margin-top: 48rpx;
	text-align: center;
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}
</style>
