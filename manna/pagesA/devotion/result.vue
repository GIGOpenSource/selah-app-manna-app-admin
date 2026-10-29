<template>
	<!-- 灵修结果页：金色光晕十字 + Manna + 周打卡 + 2×2 统计 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="page__veil" />

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
			<image class="hero__cross" src="/static/ui/quiz/halo-cross-pass.svg" mode="aspectFit" />
			<view class="hero__delta">
				<text class="hero__sign">{{ deltaSign }}</text>
				<text class="hero__n">{{ deltaAbs }}</text>
			</view>
			<text class="hero__brand">{{ t('brand') }}</text>
			<text class="hero__tag">{{ t('devotion_result_tagline') }}</text>
		</view>

		<view class="week">
			<view
				v-for="d in week"
				:key="d.date"
				class="week__cell"
				:class="{ 'week__cell--on': d.active, 'week__cell--today': d.isToday }"
			>
				<text class="week__lab">{{ d.lab }}</text>
				<image class="week__ico" src="/static/ui/quiz/ico-stat-pray.svg" mode="aspectFit" />
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

const WEEK_KEYS = [
	'calendar_week_mon',
	'calendar_week_tue',
	'calendar_week_wed',
	'calendar_week_thu',
	'calendar_week_fri',
	'calendar_week_sat',
	'calendar_week_sun',
]
const statusBar = getStatusBarPx()
const delta = ref(0)
const balance = ref('')
const sessionId = ref('')
const seriesId = ref('')
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
	sessionId.value = q?.session_id != null ? String(q.session_id) : ''
	seriesId.value = q?.series_id != null ? String(q.series_id) : ''
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
		if (typeof g.devotion_min === 'number') devotionMin.value = g.devotion_min
		if (typeof g.read_min === 'number') readMin.value = g.read_min
		if (typeof g.quiz_num === 'number') quizCount.value = g.quiz_num
		if (typeof g.manna === 'number' && balance.value === '') balance.value = String(g.manna)
		const today = new Date()
		const iso = (d) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
		const rawWeek = Array.isArray(g.week) ? g.week : []
		week.value = rawWeek.map((d, i) => {
			const isToday = d.date === iso(today)
			return {
				...d,
				lab: t(WEEK_KEYS[i] || 'calendar_week_sun'),
				isToday,
				active: !!d.devotion || (isToday && delta.value > 0),
			}
		})
	} catch (e) {}
})

const balanceDisplay = computed(() => balance.value || '0')
const deltaSign = computed(() => (delta.value >= 0 ? '+' : '−'))
const deltaAbs = computed(() => Math.abs(delta.value || 0))
const kinds = ref('')
const statsGrid = computed(() => [
	{
		key: 'pray',
		value: String(prayMin.value),
		label: t('stat_pray_min'),
		icon: '/static/ui/quiz/ico-stat-pray.svg',
		go: () => uni.navigateTo({ url: `/pagesA/prayer/prayer?kind=${kinds.value}` })
	},
	{
		key: 'devotion',
		value: String(devotionMin.value),
		label: t('stat_devotion_min'),
		icon: '/static/ui/quiz/ico-stat-devotion.svg',
		go: () => uni.switchTab({ url: '/pages/devotion/list' }),
	},
	{
		key: 'read',
		value: String(readMin.value),
		label: t('stat_read_min'),
		icon: '/static/ui/quiz/ico-stat-read.svg',
		go: () => uni.switchTab({ url: '/pages/bible/bible' }),
	},
	{
		key: 'quiz',
		value: String(quizCount.value),
		label: t('stat_quiz_num'),
		icon: '/static/ui/quiz/ico-stat-quiz.svg',
		go: () => {
			openQuizPlayDirect().catch(() => {})
		},
	},
])

function openLedger() {
	uni.navigateTo({ url: '/pagesA/profile/ledger' })
}

function sessionUrl() {
	const id = String(sessionId.value || '').trim()
	if (!id) return ''
	const q = [`id=${encodeURIComponent(id)}`]
	if (seriesId.value) q.push(`series_id=${encodeURIComponent(seriesId.value)}`)
	return `/pagesA/devotion/session?${q.join('&')}`
}

function back() {
	try {
		const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
		const prev = pages.length > 1 ? pages[pages.length - 2] : null
		const route = String(prev?.route || '')
		if (route.includes('devotion/session')) {
			uni.navigateBack({ fail: () => openSessionOrList() })
			return
		}
	} catch (e) {}
	openSessionOrList()
}

function openSessionOrList() {
	const url = sessionUrl()
	if (!url) {
		uni.switchTab({ url: '/pages/devotion/list' })
		return
	}
	uni.redirectTo({
		url,
		fail: () => {
			uni.navigateTo({
				url,
				fail: () => uni.switchTab({ url: '/pages/devotion/list' }),
			})
		},
	})
}
onLoad((options) => {
	kinds.value = options.kind || ''
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	box-sizing: border-box;
	padding: 0 48rpx 64rpx;
	overflow: hidden;
	background: #21120e;
	color: $manna-white;
	font-family: $manna-font-body;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.page__veil {
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background:
		radial-gradient(ellipse 80% 50% at 50% 28%, rgba(255, 170, 0, 0.28) 0%, transparent 70%),
		radial-gradient(ellipse 60% 40% at 50% 32%, rgba(255, 85, 0, 0.12) 0%, transparent 65%),
		#21120e;
}

.nav,
.hero,
.week,
.stats {
	position: relative;
	z-index: 1;
}

.nav {
	width: 100%;
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

.nav__back-ico {
	width: 48rpx;
	height: 48rpx;
}

.balance {
	display: flex;
	align-items: center;
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(255, 255, 255, 0.1);
}

.balance__ico {
	width: 40rpx;
	height: 40rpx;
	margin-right: 12rpx;
	flex-shrink: 0;
}

.balance__n {
	font-weight: 300;
	font-size: 28rpx;
	color: $manna-white;
}

.hero {
	margin-top: 8rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

.hero__cross {
	width: 520rpx;
	height: 520rpx;
	margin-top: -48rpx;
	margin-bottom: -140rpx;
}

.hero__delta {
	display: flex;
	align-items: flex-start;
	justify-content: center;
	color: $manna-white;
	line-height: 1;
}

.hero__sign {
	font-weight: 700;
	font-size: 40rpx;
	margin-top: 18rpx;
	margin-right: 4rpx;
}

.hero__n {
	font-weight: 700;
	font-size: 120rpx;
}

.hero__brand {
	margin-top: 8rpx;
	font-weight: 700;
	font-size: 36rpx;
	color: $manna-white;
}

.hero__tag {
	margin-top: 12rpx;
	font-weight: 300;
	font-size: 24rpx;
	letter-spacing: 0.04em;
	opacity: 0.72;
	color: $manna-white;
	text-align: center;
}

.week {
	margin-top: 40rpx;
	width: 100%;
	box-sizing: border-box;
	display: flex;
	justify-content: space-between;
	padding: 28rpx 24rpx;
	border-radius: 24rpx;
	border: 1rpx solid rgba(206, 170, 38, 0.28);
	background: rgba(0, 0, 0, 0.12);
}

.week__cell {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	opacity: 0.35;
}

.week__cell--on {
	opacity: 1;
}

.week__lab {
	font-size: 20rpx;
	margin-bottom: 12rpx;
	opacity: 0.9;
}

.week__ico {
	width: 40rpx;
	height: 40rpx;
}

.week__cell--on .week__ico {
	filter: none;
}

.week__cell:not(.week__cell--on) .week__ico {
	opacity: 0.55;
	filter: grayscale(1);
}

.stats {
	margin-top: 32rpx;
	width: 100%;
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
	padding: 28rpx 24rpx 28rpx 36rpx;
	border-radius: 24rpx;
	background: rgba(0, 0, 0, 0.12);
	border: 1rpx solid rgba(206, 170, 38, 0.28);
}

.stats__n {
	display: block;
	font-weight: 700;
	font-size: 48rpx;
	line-height: 1.1;
}

.stats__lab {
	display: block;
	margin-top: 4rpx;
	font-weight: 300;
	font-size: 24rpx;
	opacity: 0.8;
}

.stats__ico {
	width: 72rpx;
	height: 72rpx;
	flex-shrink: 0;
}

.press {
	opacity: 0.8;
}
</style>
