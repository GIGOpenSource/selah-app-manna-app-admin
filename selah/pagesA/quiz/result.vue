<!--
  Quiz 结果：分数 + 逐题对错详解；可选分享。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ pageHeading }}</text>
				<view class="nav-spacer" />
			</view>
		</view>
		<text class="hero-title" :style="heroTitleStyle">{{ pageHeading }}</text>

		<view class="score-card">
			<text class="score-num">{{ result.score ?? 0 }}/{{ result.total ?? 0 }}</text>
			<text class="score-label">{{ t('quiz_score_label') }}</text>
		</view>

		<view v-for="(d, i) in result.detail || []" :key="d.question_id || i" class="detail card">
			<view class="detail-head">
				<text class="detail-idx">{{ i + 1 }}</text>
				<text :class="['badge', d.correct ? 'ok' : 'bad']">
					{{ d.correct ? t('quiz_correct') : t('quiz_wrong') }}
				</text>
			</view>
			<text class="stem">{{ d.stem }}</text>
			<text class="picked">{{ t('quiz_your_answer') }}: {{ labelFor(d, d.picked_key) }}</text>
			<text v-if="!d.correct" class="correct">
				{{ t('quiz_correct_answer') }}: {{ labelFor(d, d.correct_key) }}
			</text>
			<text v-if="d.explain" class="explain">{{ d.explain }}</text>
		</view>

		<view class="footer">
			<view class="cta" @tap="onShare">
				<text class="cta-text">{{ t('quiz_share') }}</text>
			</view>
			<view class="cta ghost" @tap="goList">
				<text class="cta-text ghost-text">{{ t('quiz_again') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiQuizResult } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { openSharePage } from '@/utils/share.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle, heroTitleStyle } = useCollapsingTitle({
	mode: 'hero',
	statusBarPx,
	fontStartRpx: 40,
	fontEndRpx: 34,
})
const result = ref({ score: 0, total: 0, detail: [], title: '' })
const attemptId = ref(0)
const pageHeading = computed(() => result.value.title || t('quiz_result_title'))

function goBack() {
	safeBack('/pages/profile/profile')
}

function goList() {
	const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	const idx = stack.findIndex((p) => {
		const route = `/${String(p.route || p.__route__ || '').replace(/^\//, '')}`
		return route === '/pagesA/quiz/quiz'
	})
	if (idx >= 0) {
		const delta = stack.length - 1 - idx
		if (delta > 0) {
			uni.navigateBack({
				delta,
				fail: () => uni.redirectTo({ url: '/pagesA/quiz/quiz' }),
			})
			return
		}
	}
	uni.redirectTo({ url: '/pagesA/quiz/quiz' })
}

function normKey(key) {
	return String(key ?? '').trim().toLowerCase()
}

function labelFor(d, key) {
	const opts = d.options || []
	const hit = opts.find((o) => normKey(o.key) === normKey(key))
	const displayKey = hit ? hit.key : key
	return hit ? `${String(displayKey || '').toUpperCase()}. ${hit.text}` : (key || '—')
}

function onShare() {
	openSharePage({
		mode: 'quiz',
		text: `${result.value.title || t('quiz_title')}: ${result.value.score}/${result.value.total}`,
	})
}

onLoad(async (q) => {
	attemptId.value = Number(q?.attempt_id || 0)
	if (!attemptId.value) return
	try {
		const res = await apiQuizResult(attemptId.value)
		result.value = res.results || result.value
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	}
})
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	/* 双按钮 footer（≈256rpx）+ 安全区，避免末题被遮挡 */
	padding: 0 32rpx calc(300rpx + env(safe-area-inset-bottom));
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head {
	@include selah-sticky-head;
	background: $selah-bg-gray;
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
	background: $selah-bg-gray;
}
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
}
.nav-pill {
	@include selah-nav-circle;
	position: relative;
	z-index: 2;
	flex-shrink: 0;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.nav-spacer {
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
}
.nav-title {
	@include selah-display-title;
	flex: 1;
	text-align: center;
}
.hero-title {
	@include selah-display-title;
	display: block;
	position: relative;
	z-index: 1;
	font-size: 40rpx;
	line-height: 1.2;
	margin: 8rpx 0 24rpx;
	will-change: opacity, transform;
}
.score-card {
	background: linear-gradient(145deg, #b6badf, #fff0d9);
	border-radius: $selah-radius-card;
	padding: 48rpx 32rpx;
	text-align: center;
	margin-bottom: 24rpx;
}
.score-num {
	display: block;
	@include selah-display-title;
	font-size: 64rpx;
}
.score-label {
	display: block;
	margin-top: 8rpx;
	font-size: 26rpx;
	color: $selah-ink-soft;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 28rpx 32rpx;
	margin-bottom: 16rpx;
}
.detail-head {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin-bottom: 12rpx;
}
.detail-idx {
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	background: #f0ebe3;
	text-align: center;
	line-height: 40rpx;
	font-size: 22rpx;
	font-weight: 700;
	margin-right: 12rpx;
}
.badge {
	font-size: 22rpx;
	padding: 4rpx 14rpx;
	border-radius: 999rpx;
}
.badge.ok {
	background: #e4f2e4;
	color: #2a6b2a;
}
.badge.bad {
	background: #f8e4e4;
	color: #b43030;
}
.stem {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	line-height: 1.4;
	margin-bottom: 12rpx;
}
.picked,
.correct,
.explain {
	display: block;
	font-size: 24rpx;
	line-height: 1.4;
	color: $selah-ink-soft;
	margin-top: 6rpx;
}
.correct {
	color: #2a6b2a;
}
.explain {
	margin-top: 12rpx;
	padding-top: 12rpx;
	border-top: 1rpx solid $selah-divider;
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
.cta.ghost {
	background: transparent;
	border: 2rpx solid rgba(25, 25, 25, 0.15);
	margin-bottom: 0;
}
.cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
.ghost-text {
	color: $selah-ink;
}
</style>
