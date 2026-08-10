<template>
	<!-- Figma 通关 648:1339 金色 / 失败 655:1732 灰色 -->
	<view class="page" :class="passed ? 'page--pass' : 'page--fail'" :style="{ paddingTop: statusBar + 'px' }">
		<view class="page__veil" />

		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/quiz/ico-back-light.svg" mode="aspectFit" />
			</view>
			<view class="balance" hover-class="nav__press" @click="openLedger">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.svg" mode="aspectFit" />
				<text class="balance__n">{{ balanceDisplay }}</text>
			</view>
		</view>

		<view class="hero">
			<image class="hero__cross" :src="crossSrc" mode="aspectFit" />
			<view class="hero__delta">
				<text class="hero__sign">{{ deltaSign }}</text>
				<text class="hero__n">{{ deltaAbs }}</text>
			</view>
			<text class="hero__brand">{{ t('brand') }}</text>
			<text class="hero__tag">{{ t('quiz_tagline') }}</text>
		</view>

		<button class="cta cta--solid" hover-class="cta--press" @click="onPrimary">
			<image class="cta__ico" src="/static/ui/quiz/ico-level-medal.svg" mode="aspectFit" />
			<text class="cta__txt">{{ primaryLabel }}</text>
		</button>

		<template v-if="passed">
			<view class="stats">
				<view v-for="s in statsGrid" :key="s.key" class="stats__cell">
					<view class="stats__text">
						<text class="stats__n">{{ s.value }}</text>
						<text class="stats__lab">{{ s.label }}</text>
					</view>
					<image class="stats__ico" :src="s.icon" mode="aspectFit" />
				</view>
			</view>
		</template>
		<template v-else>
			<button class="cta cta--ghost" hover-class="cta--press" @click="tryAgain">{{ t('quiz_try_again') }}</button>
			<button class="cta cta--ghost" hover-class="cta--press" @click="goStories">{{ t('quiz_review') }}</button>
		</template>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaStatsCard } from '@/api/manna.js'
import { apiQuizStart } from '@/api/quiz.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const score = ref(0)
const total = ref(0)
const passed = ref(false)
const delta = ref(0)
const balance = ref('')
const levelNo = ref(1)
const nextLevelId = ref(0)
const prayMin = ref(0)
const devotionMin = ref(0)
const readMin = ref(0)
const quizCount = ref(0)

onLoad((q) => {
	score.value = Number(q?.score || 0)
	total.value = Number(q?.total || 0)
	passed.value = String(q?.passed || '') === '1'
	delta.value = Number(q?.delta || 0)
	balance.value = q?.balance !== undefined && q?.balance !== '' ? String(q.balance) : ''
	levelNo.value = Number(q?.level_no || 0) || Number(uni.getStorageSync('manna_quiz_level_no') || 1)
	nextLevelId.value = Number(q?.next_level_id || 0)
})

onMounted(async () => {
	try {
		const res = await apiMannaStatsCard()
		const g = res?.results || {}
		if (typeof g.pray_min === 'number') prayMin.value = g.pray_min
		if (typeof g.devotion_min === 'number') devotionMin.value = g.devotion_min
		if (typeof g.read_min === 'number') readMin.value = g.read_min
		if (typeof g.quiz_count === 'number') quizCount.value = g.quiz_count
		if (typeof g.manna === 'number' && balance.value === '') balance.value = String(g.manna)
	} catch (e) {}
})

const balanceDisplay = computed(() => balance.value || '0')
const deltaSign = computed(() => (delta.value >= 0 ? '+' : '−'))
const deltaAbs = computed(() => Math.abs(delta.value || 0))
const crossSrc = computed(() =>
	passed.value
		? '/static/ui/quiz/halo-cross-pass.svg'
		: '/static/ui/quiz/halo-cross-fail.svg',
)
const primaryLabel = computed(() => {
	const n = passed.value ? levelNo.value + 1 : levelNo.value
	return t('quiz_level_n', { n: Math.max(1, n) })
})

const statsGrid = computed(() => [
	{ key: 'pray', value: String(prayMin.value), label: t('stat_pray_min'), icon: '/static/ui/quiz/ico-stat-pray.svg' },
	{ key: 'devotion', value: String(devotionMin.value), label: t('stat_devotion_min'), icon: '/static/ui/quiz/ico-stat-devotion.svg' },
	{ key: 'read', value: String(readMin.value), label: t('stat_read_min'), icon: '/static/ui/quiz/ico-stat-read.svg' },
	{ key: 'quiz', value: String(quizCount.value), label: t('stat_quiz_num'), icon: '/static/ui/quiz/ico-stat-quiz.svg' },
])

function openLedger() {
	uni.navigateTo({ url: '/pagesA/profile/ledger' })
}

function back() {
	uni.switchTab({ url: '/pages/quiz/quiz' })
}

async function onPrimary() {
	if (!passed.value) {
		tryAgain()
		return
	}
	if (nextLevelId.value) {
		await startLevel(nextLevelId.value)
		return
	}
	uni.switchTab({ url: '/pages/quiz/quiz' })
}

async function tryAgain() {
	const cached = uni.getStorageSync('manna_quiz_last_level_id')
	const id = Number(cached || 0)
	if (id) {
		await startLevel(id)
		return
	}
	uni.switchTab({ url: '/pages/quiz/quiz' })
}

async function startLevel(levelId) {
	try {
		const res = await apiQuizStart({ level_id: levelId })
		const d = res?.results || {}
		if (!d.attempt_id) throw new Error('no attempt')
		uni.setStorageSync('manna_quiz_attempt', {
			...d,
			level_no: d.level_no || levelNo.value,
			balance: Number(balance.value) || 0,
		})
		uni.redirectTo({ url: `/pagesA/quiz/play?attempt_id=${d.attempt_id}` })
	} catch (e) {
		uni.showToast({ title: e?.message || t('quiz_start_fail'), icon: 'none' })
	}
}

function goStories() {
	uni.navigateTo({ url: '/pagesA/quiz/stories' })
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
	background: #21120e;
}

/* 通关：金色光晕 */
.page--pass .page__veil {
	background:
		radial-gradient(ellipse 80% 50% at 50% 28%, rgba(255, 170, 0, 0.28) 0%, transparent 70%),
		radial-gradient(ellipse 60% 40% at 50% 32%, rgba(255, 85, 0, 0.12) 0%, transparent 65%),
		#21120e;
}

/* 失败：冷灰光晕，无彩色 */
.page--fail .page__veil {
	background:
		radial-gradient(ellipse 80% 50% at 50% 28%, rgba(180, 180, 180, 0.14) 0%, transparent 70%),
		#21120e;
}

.page--fail .hero__cross {
	opacity: 0.95;
}

.nav,
.hero,
.cta,
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

.nav__press { opacity: 0.72; }

.balance {
	display: flex;
	align-items: center;
	gap: 12rpx;
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(255, 255, 255, 0.1);
}

.balance__ico {
	width: 40rpx;
	height: 40rpx;
}

.balance__n {
	font-weight: 300;
	font-size: 28rpx;
	color: $manna-white;
}

.hero {
	margin-top: 24rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

.hero__cross {
	width: 576rpx;
	height: 576rpx;
	margin-top: -40rpx;
	margin-bottom: -120rpx;
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
	margin-top: 8rpx;
	font-weight: 300;
	font-size: 24rpx;
	letter-spacing: 0.2em;
	text-transform: uppercase;
	opacity: 0.7;
	color: $manna-white;
}

.cta {
	margin-top: 40rpx;
	width: 100%;
	height: 104rpx;
	border-radius: 500rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	border: none;
	font-family: $manna-font-body;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.cta::after { border: none; }

.cta--solid {
	background: rgba(255, 255, 255, 0.9);
	backdrop-filter: blur(8rpx);
}

.cta--ghost {
	margin-top: 32rpx;
	background: transparent;
	border: 2rpx solid rgba(255, 255, 255, 0.5);
	.cta__txt { color: $manna-white; }
}

.cta--press { opacity: 0.88; }

.cta__ico {
	width: 48rpx;
	height: 48rpx;
}

.cta__txt {
	font-weight: 700;
	font-size: 36rpx;
	color: $manna-btn-text;
}

.stats {
	margin-top: 48rpx;
	width: 100%;
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
}

.stats__cell {
	flex: 1 1 calc(50% - 8rpx);
	min-width: calc(50% - 8rpx);
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	padding: 24rpx 24rpx 24rpx 40rpx;
	border-radius: 24rpx;
	background: #21120e;
	border: 1rpx solid rgba(206, 170, 38, 0.3);
}

.stats__n {
	display: block;
	font-weight: 700;
	font-size: 48rpx;
	color: $manna-white;
	line-height: 1.1;
}

.stats__lab {
	display: block;
	margin-top: 4rpx;
	font-weight: 300;
	font-size: 24rpx;
	opacity: 0.8;
	color: $manna-white;
}

.stats__ico {
	width: 72rpx;
	height: 72rpx;
	flex-shrink: 0;
}
</style>
