<template>
	<!-- Figma 846:1053 解锁圣经故事；缺数据时用 demo 填充 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="page__glow" />
		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/quiz/ico-back-light.svg" mode="aspectFit" />
			</view>
			<view class="balance">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.svg" mode="aspectFit" />
				<text class="balance__n">{{ balance }}</text>
			</view>
		</view>
		<view class="close" :style="{ top: statusBar + 20 + 'px' }" hover-class="nav__press" @click="back">
			<image class="close__ico" src="/static/ui/quiz/ico-close-light.svg" mode="aspectFit" />
		</view>

		<text class="kicker">{{ t('quiz_unlocking') }}</text>
		<text class="title">「{{ title }}」</text>

		<view class="cover-wrap">
			<image class="cover" :src="cover" mode="aspectFill" />
		</view>

		<view class="actions">
			<button class="btn btn--ghost" hover-class="btn--press" @click="back">{{ t('quiz_give_up') }}</button>
			<button class="btn btn--solid" hover-class="btn--press" :disabled="busy" @click="onLearn">
				{{ t('quiz_learn') }}
			</button>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaBalance } from '@/api/manna.js'
import { apiQuizStoryUnlock, apiQuizStoryDetail } from '@/api/quiz.js'
import { withDemoStoryDetail, DEMO_STORY } from '@/utils/quizDemo.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { track } from '@/utils/analytics.js'

const statusBar = getStatusBarPx()
const storyId = ref('')
const title = ref(DEMO_STORY.title)
const cover = ref(DEMO_STORY.cover_url)
const balance = ref(240)
const unlockCost = ref(30)
const alreadyUnlocked = ref(false)
const busy = ref(false)

onLoad((q) => {
	storyId.value = String(q?.id || '')
	if (q?.title) title.value = decodeURIComponent(String(q.title))
	if (q?.unlocked === '1') alreadyUnlocked.value = true
	if (q?.cost) unlockCost.value = Number(q.cost) || 30
})

onMounted(async () => {
	try {
		const bal = await apiMannaBalance()
		if (typeof bal?.results?.balance === 'number') balance.value = bal.results.balance
	} catch (e) {}
	if (!storyId.value || storyId.value.startsWith('demo-')) {
		const d = withDemoStoryDetail(DEMO_STORY)
		title.value = d.title
		cover.value = d.cover_url
		return
	}
	try {
		const res = await apiQuizStoryDetail({ id: storyId.value })
		const d = withDemoStoryDetail(res?.results || {}, title.value)
		title.value = d.title
		cover.value = d.cover_url || cover.value
	} catch (e) {
		const d = withDemoStoryDetail(DEMO_STORY, title.value)
		title.value = d.title
		cover.value = d.cover_url
	}
})

async function onLearn() {
	if (busy.value) return
	busy.value = true
	try {
		if (!alreadyUnlocked.value && storyId.value && !String(storyId.value).startsWith('demo-')) {
			await apiQuizStoryUnlock({ story_id: storyId.value })
			track('manna_story_unlock', { story_id: storyId.value })
		}
		uni.redirectTo({
			url: `/pagesA/quiz/story-learn?id=${encodeURIComponent(storyId.value || DEMO_STORY.id)}&title=${encodeURIComponent(title.value)}`,
		})
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		// 仍进入学习页，保证贴稿可走通
		uni.redirectTo({
			url: `/pagesA/quiz/story-learn?id=${encodeURIComponent(DEMO_STORY.id)}&title=${encodeURIComponent(title.value)}`,
		})
	} finally {
		busy.value = false
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.navigateTo({ url: '/pagesA/quiz/stories' }) })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	box-sizing: border-box;
	padding: 0 48rpx 64rpx;
	overflow: hidden;
	background: #0a0706;
	color: $manna-white;
	font-family: $manna-font-body;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.page__glow {
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background:
		radial-gradient(ellipse 70% 45% at 50% 40%, rgba(170, 97, 75, 0.55) 0%, transparent 70%),
		radial-gradient(ellipse 50% 40% at 10% 0%, rgba(170, 97, 75, 0.35) 0%, transparent 60%),
		rgba(0, 0, 0, 0.85);
}

.nav, .close, .kicker, .title, .cover-wrap, .actions { position: relative; z-index: 1; }

.nav {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 0;
}

.nav__back, .close {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.close {
	position: absolute;
	right: 48rpx;
	z-index: 2;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.35);
}

.nav__back-ico, .close__ico { width: 48rpx; height: 48rpx; }
.nav__press { opacity: 0.7; }

.balance {
	display: flex;
	align-items: center;
	gap: 12rpx;
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(255, 255, 255, 0.1);
}

.balance__ico { width: 40rpx; height: 40rpx; }
.balance__n { font-weight: 300; font-size: 28rpx; }

.kicker {
	margin-top: 48rpx;
	font-weight: 700;
	font-size: 48rpx;
	letter-spacing: 0.04em;
}

.title {
	margin-top: 16rpx;
	font-weight: 300;
	font-size: 32rpx;
	opacity: 0.95;
}

.cover-wrap {
	margin-top: 48rpx;
	width: 474rpx;
	height: 646rpx;
	border-radius: 32rpx;
	padding: 4rpx;
	background: linear-gradient(160deg, #fad02c, #aa614b 55%, #5a2e22);
	box-shadow: 0 0 40rpx rgba(250, 208, 44, 0.25);
}

.cover {
	width: 100%;
	height: 100%;
	border-radius: 28rpx;
	background: #2a1812;
}

.actions {
	margin-top: auto;
	width: 100%;
	display: flex;
	gap: 24rpx;
	padding-top: 48rpx;
}

.btn {
	flex: 1;
	height: 104rpx;
	border-radius: 500rpx;
	border: none;
	font-family: $manna-font-body;
	font-size: 36rpx;
	line-height: 104rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}
.btn::after { border: none; }
.btn--ghost {
	background: transparent;
	border: 2rpx solid rgba(255, 255, 255, 0.7);
	color: rgba(255, 255, 255, 0.7);
	font-weight: 300;
}
.btn--solid {
	background: rgba(255, 255, 255, 0.9);
	color: $manna-btn-text;
	font-weight: 700;
}
.btn--press { opacity: 0.88; }
</style>
