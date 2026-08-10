<template>
	<!-- 故事列表 → 解锁页 / 学习页（Figma 链路） -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('me_stories') }}</text>
			<view class="nav__spacer" />
		</view>

		<view
			v-for="s in stories"
			:key="s.id"
			class="card"
			hover-class="card--press"
			@click="onStory(s)"
		>
			<view
				v-if="s.cover_url"
				class="card__cover"
				:style="{ backgroundImage: `url(${s.cover_url})` }"
			/>
			<view class="card__body">
				<text class="card__t">{{ s.title }}</text>
				<text class="card__m">{{
					s.unlocked || !(Number(s.unlock_cost) > 0)
						? t('quiz_unlocked')
						: t('quiz_unlock_cost', { n: s.unlock_cost || 0 })
				}}</text>
			</view>
		</view>
		<text v-if="!stories.length && !loading" class="empty">{{ t('quiz_stories_empty') }}</text>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { t } from '@/i18n/index.js'
import { apiQuizStories } from '@/api/quiz.js'
import { withDemoStories } from '@/utils/quizDemo.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const stories = ref([])
const loading = ref(false)

async function load() {
	loading.value = true
	try {
		const res = await apiQuizStories()
		stories.value = Array.isArray(res?.results) ? res.results : []
	} catch (e) {
		stories.value = withDemoStories([])
	} finally {
		loading.value = false
	}
}

function onStory(s) {
	if (!s) return
	const unlocked = s.unlocked || !(Number(s.unlock_cost) > 0)
	if (unlocked) {
		uni.navigateTo({
			url: `/pagesA/quiz/story-learn?id=${encodeURIComponent(s.id)}&title=${encodeURIComponent(s.title || '')}`,
		})
		return
	}
	uni.navigateTo({
		url: `/pagesA/quiz/story-unlock?id=${encodeURIComponent(s.id)}&title=${encodeURIComponent(s.title || '')}&cost=${s.unlock_cost || 0}`,
	})
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

.nav {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-bottom: 28rpx;
}

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
.nav__title {
	flex: 1;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 36rpx;
	color: $manna-btn-text;
	text-align: center;
}
.nav__spacer { width: 64rpx; }

.card {
	@include manna-white-card;
	padding: 0;
	margin-bottom: 16rpx;
	overflow: hidden;
	display: flex;
	align-items: stretch;
}

.card--press { opacity: 0.92; }

.card__cover {
	width: 160rpx;
	flex-shrink: 0;
	background: linear-gradient(135deg, #e8a070, #8b4a2e);
	background-size: cover;
	background-position: center;
}

.card__body { flex: 1; padding: 28rpx 32rpx; min-width: 0; }

.card__t {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 32rpx;
	color: $manna-btn-text;
	margin-bottom: 8rpx;
}

.card__m {
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.5);
}

.empty {
	margin-top: 48rpx;
	text-align: center;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}
</style>
