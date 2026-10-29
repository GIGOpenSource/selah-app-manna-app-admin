<template>
	<!-- 故事卡网格：封面在上、标题在下；unlocked=false 灰度锁定 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<image class="page__halo" src="/static/ui/quiz/halo-cross.svg" mode="aspectFit" />

		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('me_stories') }}</text>
		</view>

		<view class="grid">
			<view
				v-for="s in stories"
				:key="s.id"
				class="card"
				:class="{ 'card--locked': isLocked(s) }"
				hover-class="card--press"
				@click="onStory(s)"
			>
				<view class="card__shot">
					<image
						v-if="coverOf(s)"
						class="card__img"
						:src="coverOf(s)"
						mode="aspectFill"
					/>
				</view>
				<text class="card__t">{{ s.title }}</text>
			</view>
		</view>
		<text v-if="!stories.length && !loading" class="empty">{{ t('quiz_stories_empty') }}</text>

		<view v-if="lockOpen" class="lock" @touchmove.stop.prevent>
			<view class="lock__mask" @tap="closeLock" />
			<view class="lock__sheet">
				<view class="lock__card" @tap.stop>
					<text class="lock__title">{{ t('quiz_story_lock_title') }}</text>
					<text class="lock__body">{{ t('quiz_story_lock_body') }}</text>
					<view
						class="lock__cta"
						:class="{ 'is-busy': quizBusy }"
						hover-class="lock__cta--press"
						@tap.stop="onTakeQuiz"
					>
						<text class="lock__cta-txt">{{ t('quiz_story_lock_cta') }}</text>
					</view>
				</view>
				<view class="lock__x" hover-class="lock__x--press" @tap.stop="closeLock">
					<image class="lock__x-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiQuizStories } from '@/api/quiz.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { absolutizeMedia } from '@/utils/media.js'
import { openQuizPlayDirect } from '@/utils/quizAttempt.js'

const statusBar = getStatusBarPx()
const stories = ref([])
const loading = ref(false)
const lockOpen = ref(false)
const quizBusy = ref(false)

function coverOf(s) {
	const raw = String(s?.card_url || s?.cover_url || '').trim()
	if (!raw) return ''
	return absolutizeMedia(raw) || raw
}

async function load() {
	loading.value = true
	try {
		const res = await apiQuizStories()
		stories.value = Array.isArray(res?.results) ? res.results : []
	} catch (e) {
		stories.value = []
	} finally {
		loading.value = false
	}
}

function isUnlocked(s) {
	return s?.unlocked === true || s?.unlocked === 'true' || s?.unlocked === 1
}

function isLocked(s) {
	return !isUnlocked(s)
}

function isRead(s) {
	return isUnlocked(s)
}

function closeLock() {
	if (quizBusy.value) return
	lockOpen.value = false
}

async function onTakeQuiz() {
	if (quizBusy.value) return
	quizBusy.value = true
	try {
		const r = await openQuizPlayDirect()
		if (r?.ok) {
			lockOpen.value = false
			return
		}
		const msg = r?.error?.message === 'locked' ? t('quiz_locked') : t('quiz_start_fail')
		uni.showToast({ title: msg, icon: 'none' })
	} catch (e) {
		uni.showToast({ title: e?.message || t('quiz_start_fail'), icon: 'none' })
	} finally {
		quizBusy.value = false
	}
}

function onStory(s) {
	if (!s) return
	if (isLocked(s)) {
		lockOpen.value = true
		return
	}
	const path = isRead(s) ? '/pagesA/quiz/story-read' : '/pagesA/quiz/story-learn'
	uni.navigateTo({
		url: `${path}?id=${encodeURIComponent(s.id)}&title=${encodeURIComponent(s.title || '')}`,
	})
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onShow(load)
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	padding: 12rpx 40rpx 80rpx;
	box-sizing: border-box;
	overflow: hidden;
	@include manna-peach-page;
}

.page__halo {
	position: absolute;
	top: -24rpx;
	right: -48rpx;
	width: 420rpx;
	height: 440rpx;
	opacity: 0.42;
	pointer-events: none;
	z-index: 0;
}

.nav {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	margin-bottom: 28rpx;
}

.nav__back {
	width: 64rpx;
	height: 64rpx;
	margin-right: 8rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.nav__back-ico { width: 48rpx; height: 48rpx; }
.nav__press { opacity: 0.7; }
.nav__title {
	@include manna-nav-title;
	text-align: left;
}

.grid {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
}

.card {
	flex: 0 0 calc((100% - 24rpx) / 2);
	width: calc((100% - 24rpx) / 2);
	margin-right: 24rpx;
	margin-bottom: 28rpx;
	box-sizing: border-box;
	padding: 16rpx 16rpx 20rpx;
	background: $manna-white;
	border-radius: 32rpx;
	box-shadow: $manna-shadow-card;
}

.card:nth-child(2n) {
	margin-right: 0;
}

.card--press { opacity: 0.92; }

.card__shot {
	width: 100%;
	height: 380rpx;
	border-radius: 24rpx;
	overflow: hidden;
	background: linear-gradient(160deg, #e8a070, #8b4a2e);
}

.card__img {
	width: 100%;
	height: 100%;
	display: block;
}

.card--locked .card__shot {
	filter: grayscale(1);
}

.card__t {
	margin-top: 16rpx;
	padding: 0 8rpx;
	font-family: $manna-font-body;
	font-weight: 600;
	font-size: 28rpx;
	line-height: 1.35;
	color: $manna-btn-text;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	line-clamp: 2;
}

.empty {
	position: relative;
	z-index: 1;
	margin-top: 48rpx;
	text-align: center;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}

.lock {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
}

.lock__mask {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.55);
}

.lock__sheet {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 560rpx;
}

.lock__card {
	width: 100%;
	box-sizing: border-box;
	padding: 52rpx 32rpx 36rpx;
	border-radius: 40rpx;
	background: linear-gradient(180deg, #ffe0cf 0%, #fff1e6 20%, #ffffff 40%);
	box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.12);
}

.lock__title {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 32rpx;
	line-height: 1.15;
	letter-spacing: 0.01em;
	text-transform: uppercase;
	text-align: center;
	color: #1a1a1a;
}

.lock__body {
	display: block;
	margin-top: 18rpx;
	font-family: $manna-font-body;
	font-weight: 400;
	font-size: 26rpx;
	line-height: 1.4;
	text-align: center;
	color: #3a3a3a;
	white-space: pre-line;
}

.lock__cta {
	margin-top: 36rpx;
	height: 88rpx;
	border-radius: 999rpx;
	background: #b36c56;
	display: flex;
	align-items: center;
	justify-content: center;
}

.lock__cta--press {
	opacity: 0.9;
}

.lock__cta.is-busy {
	opacity: 0.7;
}

.lock__cta-txt {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 32rpx;
	line-height: 1;
	color: #ffffff;
	letter-spacing: 0.01em;
}

.lock__x {
	margin-top: 40rpx;
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.lock__x--press {
	opacity: 0.75;
}

.lock__x-ico {
	width: 64rpx;
	height: 64rpx;
}
</style>
