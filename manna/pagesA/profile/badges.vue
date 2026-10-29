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
			:class="{ 'card--off': !b.earned, 'card--hidden': isMystery(b) }"
			hover-class="card--press"
			@click="onTap(b)"
		>
			<view class="card__badge" :class="'card__badge--' + badgeTone(b)">
				<image
					class="card__ico"
					:src="isMystery(b) ? '/static/ui/me/ico-badges.svg' : (b.icon_url || badgeIcon(b))"
					mode="aspectFit"
				/>
			</view>
			<view class="card__body">
				<text class="card__t">{{ isMystery(b) ? t('badge_hidden') : b.title }}</text>
				<text class="card__m">{{ metaLine(b) }}</text>
				<view v-if="showProgress(b)" class="card__track">
					<view class="card__fill" :style="{ width: progressPct(b) + '%' }" />
				</view>
				<text v-if="showProgress(b)" class="card__prog">{{ b.progress || 0 }} / {{ b.target }}</text>
			</view>
			<image
				v-if="b.earned"
				class="card__share"
				src="/static/ui/home/ico-share.svg"
				mode="aspectFit"
				@click.stop="onShare(b)"
			/>
		</view>
		<text v-if="!badges.length && !loading" class="empty">{{ t('badges_empty') }}</text>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { t } from '@/i18n/index.js'
import { apiMannaBadges } from '@/api/manna.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { track } from '@/utils/analytics.js'
import { badgeIcon, badgeTone, clearNewlyEarned, goBadgeCta, openBadgeShare } from '@/utils/badges.js'

const statusBar = getStatusBarPx()
const badges = ref([])
const loading = ref(false)

function isMystery(b) {
	return !!(b && b.hidden && !b.earned)
}

function showProgress(b) {
	if (!b || b.earned || isMystery(b)) return false
	return Number(b.target || 0) > 0
}

function progressPct(b) {
	const target = Number(b?.target || 0)
	if (target <= 0) return 0
	const cur = Math.max(0, Number(b?.progress || 0))
	return Math.min(100, Math.round((cur / target) * 100))
}

function metaLine(b) {
	if (isMystery(b)) return ''
	if (b.earned) {
		const at = String(b.earned_at || '').slice(0, 10)
		return at || t('badge_earned')
	}
	return b.how_to || t('badge_locked')
}

async function load() {
	loading.value = true
	clearNewlyEarned()
	try {
		const res = await apiMannaBadges()
		badges.value = res?.results || []
		track('badge_view', { n: badges.value.length })
	} catch (e) {
		badges.value = []
	} finally {
		loading.value = false
	}
}

function onShare(b) {
	track('badge_share', { code: b.code || '', channel: 'list' })
	openBadgeShare(b)
}

function onTap(b) {
	if (isMystery(b)) return
	if (b.earned) {
		onShare(b)
		return
	}
	const path = b.cta_path || ''
	if (!path) return
	track('badge_tap_cta', { code: b.code || '', path })
	goBadgeCta(path)
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
	display: flex;
	align-items: center;
}

.card--press { opacity: 0.92; }

.card__badge {
	width: 88rpx;
	height: 88rpx;
	margin-right: 20rpx;
	flex-shrink: 0;
	border-radius: 50%;
	border: 4rpx solid #d4a574;
	background: #fff7ee;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.card__badge--quiz { border-color: #c45c26; background: #fff1e6; }
.card__badge--pray { border-color: #2f6f4e; background: #e8f4ec; }
.card__badge--devotion { border-color: #3d5a80; background: #e8eef6; }
.card__badge--story { border-color: #8b5a2b; background: #f6ead8; }
.card__badge--amen { border-color: #b42318; background: #fde8e6; }
.card__badge--bible { border-color: #4a6fa5; background: #e8eef8; }
.card__badge--streak { border-color: #b8860b; background: #f7eed4; }
.card--off .card__badge { filter: grayscale(0.85); opacity: 0.78; }
.card--hidden .card__badge { filter: grayscale(1) brightness(0.55); opacity: 0.9; }

.card__ico {
	width: 48rpx;
	height: 48rpx;
}

.card__body { flex: 1; min-width: 0; }

.card__share {
	width: 40rpx;
	height: 40rpx;
	margin-left: 12rpx;
	flex-shrink: 0;
	opacity: 0.55;
}

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
	color: rgba(33, 33, 33, 0.62);
}

.card__track {
	margin-top: 12rpx;
	height: 8rpx;
	border-radius: 8rpx;
	background: rgba(33, 33, 33, 0.08);
	overflow: hidden;
}

.card__fill {
	height: 8rpx;
	border-radius: 8rpx;
	background: #c45c26;
}

.card__prog {
	display: block;
	margin-top: 6rpx;
	font-family: $manna-font-body;
	font-size: 22rpx;
	color: rgba(33, 33, 33, 0.45);
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
