<template>
	<!-- Figma 880:1580 学习结束 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<image class="page__bg" :src="cover" mode="aspectFill" />
		<view class="page__fade" />

		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('quiz_bible_learning') }}</text>
			<view class="balance">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.png" mode="aspectFit" />
				<text class="balance__n">{{ balance }}</text>
			</view>
		</view>

		<text class="scene">「{{ title }}」</text>

		<view class="sheet">
			<view class="badge">
				<image class="badge__ico" src="/static/ui/quiz/ico-great-check.svg" mode="aspectFit" />
			</view>
			<text class="great">{{ t('quiz_great') }}</text>
			<text class="sub">{{ t('quiz_great_sub') }}</text>
			<button class="cta" hover-class="cta--press" @click="testNow">{{ t('quiz_test_now') }}</button>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaBalance } from '@/api/manna.js'
import { apiQuizStart, apiQuizStoryUnlock } from '@/api/quiz.js'
import { cacheAttemptPayload, markShowQuizHub } from '@/utils/quizAttempt.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { stashNewlyEarned } from '@/utils/badges.js'
import { track } from '@/utils/analytics.js'

const statusBar = getStatusBarPx()
const storyId = ref('')
const title = ref('')
const cover = ref('')
const balance = ref(0)
const levelId = ref(0)

onLoad((q) => {
	storyId.value = String(q?.id || '')
	if (q?.title) title.value = decodeURIComponent(String(q.title))
	levelId.value = Number(q?.level_id || 0)
})

onMounted(async () => {
	try {
		const bal = await apiMannaBalance()
		if (typeof bal?.results?.balance === 'number') balance.value = bal.results.balance
	} catch (e) {}
	if (!storyId.value) return
	try {
		const res = await apiQuizStoryUnlock({ story_id: storyId.value })
		stashNewlyEarned(res?.results?.newly_earned)
		track('manna_story_complete', { story_id: storyId.value })
		if (typeof res?.results?.balance === 'number') balance.value = res.results.balance
	} catch (e) {}
})

async function testNow() {
	const id = levelId.value || Number(uni.getStorageSync('manna_quiz_last_level_id') || 0)
	if (!id) {
		markShowQuizHub()
		uni.switchTab({ url: '/pages/quiz/quiz' })
		return
	}
	try {
		const res = await apiQuizStart({ level_id: id, mode: 'story_tf' })
		const d = res?.results || {}
		if (!d.attempt_id) throw new Error('no attempt')
		cacheAttemptPayload(d, {
			level_id: id,
			level_no: d.level_no || uni.getStorageSync('manna_quiz_level_no') || 1,
			balance: typeof d.balance === 'number' ? d.balance : balance.value,
			time_limit_sec: 30,
			mode: 'story_tf',
		})
		uni.redirectTo({ url: `/pagesA/quiz/play?attempt_id=${d.attempt_id}` })
	} catch (e) {
		uni.showToast({ title: e?.message || t('quiz_start_fail'), icon: 'none' })
		markShowQuizHub()
		uni.switchTab({ url: '/pages/quiz/quiz' })
	}
}

function back() {
	uni.navigateTo({ url: '/pagesA/quiz/stories' })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

$quiz-ok: #52aa4b;

.page {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	overflow: hidden;
	box-sizing: border-box;
	font-family: $manna-font-body;
	display: flex;
	flex-direction: column;
}

.page__bg {
	position: fixed;
	inset: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
}

.page__fade {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	height: 55%;
	z-index: 0;
	background: linear-gradient(180deg, rgba(255, 244, 238, 0) 0%, #fff4ee 31%);
}

.nav, .scene, .sheet { position: relative; z-index: 1; }

.nav {
	display: flex;
	align-items: center;
	padding: 20rpx 40rpx;
	& > *:not(:first-child) { margin-left: 8rpx; }
}
.nav__back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.nav__back-ico { width: 48rpx; height: 48rpx; }
.nav__press { opacity: 0.7; }
.nav__title { flex: 1; @include manna-nav-title; color: #000; }

.balance {
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 12rpx; }
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(33, 33, 33, 0.5);
	border: 1rpx solid rgba(0, 0, 0, 0.5);
}
.balance__ico { width: 40rpx; height: 40rpx; }
.balance__n { font-weight: 300; font-size: 28rpx; color: #fff; }

.scene {
	margin-top: auto;
	margin-bottom: 24rpx;
	text-align: center;
	font-weight: 700;
	font-size: 40rpx;
	color: #fff;
	text-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.35);
	padding: 0 40rpx;
}

.sheet {
	margin: 0 48rpx 48rpx;
	padding: 40rpx 40rpx 48rpx;
	border-radius: 56rpx;
	border: 2rpx solid #fff;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, #fff 47%);
	box-shadow: 0 0 40rpx rgba(170, 97, 75, 0.1);
	display: flex;
	flex-direction: column;
	align-items: center;
	& > *:not(:first-child) { margin-top: 16rpx; }
}

.badge {
	width: 160rpx;
	height: 160rpx;
	border-radius: 50%;
	background: $quiz-ok;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 8rpx;
	box-shadow: 0 0 0 12rpx rgba(82, 170, 75, 0.2);
}
.badge__ico { width: 72rpx; height: 72rpx; }

.great {
	font-weight: 700;
	font-size: 48rpx;
	color: #212121;
}
.sub {
	font-weight: 300;
	font-size: 32rpx;
	color: #212121;
	text-align: center;
	margin-bottom: 16rpx;
}

.cta {
	width: 100%;
	height: 120rpx;
	border: none;
	border-radius: 200rpx;
	background: $quiz-ok;
	color: #fff;
	font-weight: 700;
	font-size: 36rpx;
	line-height: 120rpx;
}
.cta::after { border: none; }
.cta--press { opacity: 0.9; }
</style>
