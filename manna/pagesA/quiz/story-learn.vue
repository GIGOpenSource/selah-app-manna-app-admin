<template>
	<!-- Figma 869:1497 圣经故事学习；卡片缺则用 demo 知识卡 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<image class="page__bg" :src="cover" mode="aspectFill" />
		<view class="page__fade" />

		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('quiz_bible_learning') }}</text>
			<view class="balance">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.svg" mode="aspectFit" />
				<text class="balance__n">{{ balance }}</text>
			</view>
		</view>

		<text class="scene">「{{ title }}」</text>

		<view class="sheet">
			<view class="prog">
				<view class="prog__lab">
					<text class="prog__cur">{{ idx + 1 }}</text>
					<text class="prog__tot">/{{ cards.length }}</text>
				</view>
				<view class="prog__bars">
					<view
						v-for="n in cards.length"
						:key="'b' + n"
						class="prog__bar"
						:class="{ 'prog__bar--on': n <= idx + 1 }"
					/>
				</view>
			</view>
			<view class="stem-wrap">
				<text class="stem">{{ currentBody }}</text>
			</view>
			<button class="get" hover-class="get--press" @click="onGet">{{ t('quiz_get') }}</button>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaBalance } from '@/api/manna.js'
import { apiQuizStoryDetail } from '@/api/quiz.js'
import { withDemoStoryDetail, DEMO_STORY } from '@/utils/quizDemo.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const storyId = ref(DEMO_STORY.id)
const title = ref(DEMO_STORY.title)
const cover = ref(DEMO_STORY.cover_url)
const cards = ref(DEMO_STORY.cards)
const idx = ref(0)
const balance = ref(240)
const linkedLevelId = ref(null)

onLoad((q) => {
	storyId.value = String(q?.id || DEMO_STORY.id)
	if (q?.title) title.value = decodeURIComponent(String(q.title))
})

const currentBody = computed(() => {
	const c = cards.value[idx.value] || {}
	return c.body || c.text || ''
})

onMounted(async () => {
	try {
		const bal = await apiMannaBalance()
		if (typeof bal?.results?.balance === 'number') balance.value = bal.results.balance
	} catch (e) {}
	try {
		if (String(storyId.value).startsWith('demo-')) throw new Error('demo')
		const res = await apiQuizStoryDetail({ id: storyId.value })
		const raw = res?.results || {}
		title.value = raw.title || title.value
		cover.value = raw.cover_url || cover.value
		const cardsRaw = raw.knowledge_cards || raw.cards || []
		cards.value = Array.isArray(cardsRaw) ? cardsRaw : []
		linkedLevelId.value = raw.linked_level_id || null
		if (linkedLevelId.value) {
			uni.setStorageSync('manna_quiz_last_level_id', linkedLevelId.value)
		}
	} catch (e) {
		const d = withDemoStoryDetail(DEMO_STORY, title.value)
		title.value = d.title
		cover.value = d.cover_url || cover.value
		cards.value = d.cards?.length ? d.cards : DEMO_STORY.cards
		linkedLevelId.value = d.linked_level_id || null
	}
})

function onGet() {
	if (!cards.value.length) {
		uni.redirectTo({
			url: `/pagesA/quiz/story-done?id=${encodeURIComponent(storyId.value)}&title=${encodeURIComponent(title.value)}&level_id=${linkedLevelId.value || ''}`,
		})
		return
	}
	if (idx.value < cards.value.length - 1) {
		idx.value += 1
		return
	}
	uni.redirectTo({
		url: `/pagesA/quiz/story-done?id=${encodeURIComponent(storyId.value)}&title=${encodeURIComponent(title.value)}&level_id=${linkedLevelId.value || ''}`,
	})
}

function back() {
	uni.navigateBack({ fail: () => uni.navigateTo({ url: '/pagesA/quiz/stories' }) })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

$quiz-terra: #aa614b;
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
	gap: 8rpx;
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
.nav__title {
	flex: 1;
	font-weight: 700;
	font-size: 36rpx;
	color: #000;
}

.balance {
	display: flex;
	align-items: center;
	gap: 12rpx;
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
	padding: 64rpx 40rpx 48rpx;
	border-radius: 56rpx;
	border: 2rpx solid #fff;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, #fff 47%);
	box-shadow: 0 0 40rpx rgba(170, 97, 75, 0.1);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 40rpx;
}

.prog { display: flex; flex-direction: column; align-items: center; gap: 16rpx; }
.prog__lab { display: flex; gap: 4rpx; font-size: 24rpx; color: #212121; }
.prog__tot { opacity: 0.7; font-weight: 300; letter-spacing: 0.1em; }
.prog__bars { display: flex; gap: 8rpx; }
.prog__bar {
	width: 64rpx;
	height: 8rpx;
	border-radius: 20rpx;
	background: rgba(170, 97, 75, 0.15);
}
.prog__bar--on { background: $quiz-terra; }

.stem-wrap {
	min-height: 220rpx;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}
.stem {
	font-weight: 700;
	font-size: 48rpx;
	text-align: center;
	color: #212121;
	line-height: 1.3;
}

.get {
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
.get::after { border: none; }
.get--press { opacity: 0.9; }
</style>
