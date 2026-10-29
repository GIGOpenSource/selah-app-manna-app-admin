<template>
	<!-- 祷告结果页（灵修已独立到 devotion/result） -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="press" @click="back">
				<image class="nav__back-ico" src="/static/ui/quiz/ico-back-light.svg" mode="aspectFit" />
			</view>
			<view class="balance" hover-class="press" @click="openLedger">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.png" mode="aspectFit" />
				<text class="balance__n">{{ balanceDisplay }}</text>
			</view>
		</view>

		<view class="hero">
			<text class="hero__sign">{{ deltaSign }}</text>
			<text class="hero__n">{{ deltaAbs }}</text>
			<text class="hero__lab">{{ t('stat_pray') }}</text>
		</view>

		<view class="week">
			<view
				v-for="d in week"
				:key="d.date"
				class="week__cell"
				:class="{ 'week__cell--on': d.active, 'week__cell--today': d.isToday }"
			>
				<text class="week__lab">{{ d.lab }}</text>
				<view class="week__dot" />
			</view>
		</view>

		<view class="stats">
			<view v-for="s in statsGrid" :key="s.key" class="stats__cell" hover-class="press" @click="s.go()">
				<view class="stats__text">
					<text class="stats__n">{{ s.value }}</text>
					<text class="stats__lab">{{ s.label }}</text>
				</view>
				<image class="stats__ico" :src="s.icon" mode="aspectFit" />
			</view>
		</view>
		<!-- <manna-badge-toast v-model:visible="badgeOpen" :items="badgeItems" /> -->
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaStatsCard } from '@/api/manna.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { takeNewlyEarned } from '@/utils/badges.js'
import { openQuizPlayDirect } from '@/utils/quizAttempt.js'

const WEEK_LABS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const statusBar = getStatusBarPx()
const delta = ref(0)
const balance = ref('')
const week = ref([])
const amenSec = ref(0)
const prayMin = ref(0)
const devotionMin = ref(0)
const readMin = ref(0)
const quizCount = ref(0)
const badgeOpen = ref(false)
const badgeItems = ref([])

onLoad((q) => {
	delta.value = Number(q?.delta || 0)
	amenSec.value = Math.max(0, Number(q?.sec || 0))
	if (q?.balance !== undefined && q?.balance !== '') balance.value = String(q.balance)
})

onMounted(async () => {
	const earned = takeNewlyEarned()
	if (earned.length) {
		badgeItems.value = earned
		badgeOpen.value = true
	}
	try {
		const res = await apiMannaStatsCard()
		const g = res?.results || {}
		if (typeof g.pray_min === 'number') prayMin.value = g.pray_min
		prayMin.value = Math.max(prayMin.value, Math.max(1, Math.round(amenSec.value / 60) || 1))
		if (typeof g.devotion_min === 'number') devotionMin.value = g.devotion_min
		if (typeof g.read_min === 'number') readMin.value = g.read_min
		if (typeof g.quiz_num === 'number') quizCount.value = g.quiz_num
		if (typeof g.manna === 'number' && balance.value === '') balance.value = String(g.manna)
		const today = new Date()
		const iso = (d) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
		week.value = (g.week || []).map((d, i) => {
			const isToday = d.date === iso(today)
			return {
				...d,
				lab: WEEK_LABS[i] || '',
				isToday,
				active: !!d.prayer || (isToday && delta.value > 0),
			}
		})
	} catch (e) {}
})

const balanceDisplay = computed(() => balance.value || '0')
const deltaSign = computed(() => (delta.value >= 0 ? '+' : '−'))
const deltaAbs = computed(() => Math.abs(delta.value || 0))

const statsGrid = computed(() => [
	{
		key: 'pray',
		value: String(prayMin.value),
		label: t('stat_pray_min'),
		icon: '/static/ui/me/ico-pray.svg',
		go: () => uni.navigateTo({ url: '/pagesA/prayer/prayer' }),
	},
	{
		key: 'devotion',
		value: String(devotionMin.value),
		label: t('stat_devotion_min'),
		icon: '/static/ui/me/ico-devotion.svg',
		go: () => uni.switchTab({ url: '/pages/devotion/list' }),
	},
	{
		key: 'read',
		value: String(readMin.value),
		label: t('stat_read_min'),
		icon: '/static/ui/me/ico-read.svg',
		go: () => uni.switchTab({ url: '/pages/bible/bible' }),
	},
	{
		key: 'quiz',
		value: String(quizCount.value),
		label: t('stat_quiz_num'),
		icon: '/static/ui/me/ico-quiz.svg',
		go: () => {
			openQuizPlayDirect().catch(() => {})
		},
	},
])

function openLedger() {
	uni.navigateTo({ url: '/pagesA/profile/ledger' })
}

function back() {
	uni.navigateBack({
		fail: () => {
			uni.navigateTo({
				url: '/pagesA/prayer/prayer',
				fail: () => uni.switchTab({ url: '/pages/profile/profile' }),
			})
		},
	})
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	box-sizing: border-box;
	padding: 0 48rpx 64rpx;
	background: #21120e;
	color: $manna-white;
	font-family: $manna-font-body;
}

.nav {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 0 8rpx;
}

.nav__back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav__back-ico { width: 48rpx; height: 48rpx; }

.balance {
	display: flex;
	align-items: center;
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(255, 255, 255, 0.1);
}

.balance__ico { width: 40rpx; height: 40rpx; margin-right: 12rpx; flex-shrink: 0; }
.balance__n { font-weight: 300; font-size: 28rpx; color: $manna-white; }

.hero {
	margin-top: 48rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.hero__sign { font-weight: 700; font-size: 40rpx; }
.hero__n { font-weight: 700; font-size: 120rpx; line-height: 1; }
.hero__lab { margin-top: 8rpx; font-size: 24rpx; opacity: 0.7; letter-spacing: 0.12em; text-transform: uppercase; }

.week {
	margin-top: 48rpx;
	display: flex;
	justify-content: space-between;
}

.week__cell {
	display: flex;
	flex-direction: column;
	align-items: center;
	opacity: 0.35;
}

.week__cell--on { opacity: 1; }
.week__cell--today .week__dot {
	box-shadow: 0 0 0 4rpx rgba(255, 255, 255, 0.35);
}

.week__lab { font-size: 22rpx; margin-bottom: 12rpx; }
.week__dot {
	width: 20rpx;
	height: 20rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.25);
}
.week__cell--on .week__dot { background: #ceaa26; }

.stats {
	margin-top: 48rpx;
	display: flex;
	flex-wrap: wrap;
	margin-left: -8rpx;
	margin-right: -8rpx;
}

.stats__cell {
	width: calc(50% - 16rpx);
	margin: 8rpx;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 24rpx 24rpx 40rpx;
	border-radius: 24rpx;
	background: #21120e;
	border: 1rpx solid rgba(206, 170, 38, 0.3);
}

.stats__n { display: block; font-weight: 700; font-size: 48rpx; line-height: 1.1; }
.stats__lab { display: block; margin-top: 4rpx; font-weight: 300; font-size: 24rpx; opacity: 0.8; }
.stats__ico { width: 72rpx; height: 72rpx; flex-shrink: 0; }
.press { opacity: 0.8; }
</style>
