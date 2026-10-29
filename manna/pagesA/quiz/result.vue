<template>
	<!-- Figma 通关 648:1339 金色 / 失败 655:1732 灰色 -->
	<view class="page" :class="passed ? 'page--pass' : 'page--fail'" :style="{ paddingTop: statusBar + 'px' }">
		<view class="page__veil" />

		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/quiz/ico-back-light.svg" mode="aspectFit" />
			</view>
			<view class="balance" hover-class="nav__press" @click="openLedger">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.png" mode="aspectFit" />
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
			<button class="cta cta--ghost" hover-class="cta--press" @click="tryAgain">
				<text class="cta__txt">{{ t('quiz_try_again') }}</text>
			</button>
			<button class="cta cta--ghost" hover-class="cta--press" @click="goReview">
				<text class="cta__txt">{{ t('quiz_review') }}</text>
			</button>
		</template>
		<!-- <manna-badge-toast v-model:visible="badgeOpen" :items="badgeItems" /> -->

		<view v-if="reviewOpen" class="review" @touchmove.stop.prevent>
			<view class="review__mask" @tap="closeReview" />
			<view class="review__sheet">
				<view class="review__card" @tap.stop>
					<text class="review__title">{{ reviewTitle }}</text>
					<view class="review__scroll">
						<view v-for="(item, i) in reviewItems" :key="item.id || i" class="review__q">
							<text class="review__stem">{{ i + 1 }}. {{ item.stem }}</text>
							<view class="review__opts">
								<view v-for="(row, j) in item.rows" :key="j" class="review__opt">
									<image
										class="review__mark"
										:src="row.kind === 'ok' ? '/static/ui/quiz/ico-review-ok.svg' : '/static/ui/quiz/ico-review-bad.svg'"
										mode="aspectFit"
									/>
									<text class="review__opt-txt">{{ row.text }}</text>
								</view>
							</view>
						</view>
						<text v-if="!reviewItems.length" class="review__empty">{{ t('quiz_review_empty') }}</text>
					</view>
				</view>
				<view class="review__x" hover-class="review__x--press" @tap.stop="closeReview">
					<image class="review__x-ico" src="/static/ui/quiz/ico-review-close.svg" mode="aspectFit" />
				</view>
			</view>
		</view>

		<manna-story-unlock
			:visible="unlockOpen"
			:story-id="storyId"
			:title="unlockTitle"
			:balance="balance"
			@update:visible="onUnlockDismiss"
			@learn="onUnlockLearn"
		/>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaStatsCard } from '@/api/manna.js'
import { apiQuizResult, apiQuizStart, apiQuizSpend } from '@/api/quiz.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { takeNewlyEarned } from '@/utils/badges.js'
import { cacheAttemptPayload, markShowQuizHub } from '@/utils/quizAttempt.js'

const statusBar = getStatusBarPx()

/** 统计卡本地缓存：通关页首帧直接用上次真值，避免 0 → 真值跳变 */
const STATS_KEY = 'manna_stats_card'

function readStatsCache() {
	try {
		const v = uni.getStorageSync(STATS_KEY)
		return v && typeof v === 'object' ? v : null
	} catch (e) {
		return null
	}
}

function writeStatsCache(g) {
	try {
		uni.setStorageSync(STATS_KEY, { ...g, at: Date.now() })
	} catch (e) {}
}

const cachedStats = readStatsCache()

const score = ref(0)
const total = ref(0)
const passed = ref(false)
const delta = ref(0)
const balance = ref('')
const levelNo = ref(1)
const nextLevelId = ref(0)
const storyId = ref(0)
const prayMin = ref(Number(cachedStats?.pray_min) || 0)
const devotionMin = ref(Number(cachedStats?.devotion_min) || 0)
const readMin = ref(Number(cachedStats?.read_min) || 0)
const quizCount = ref(Number(cachedStats?.quiz_num) || 0)
const attemptId = ref(0)
const badgeOpen = ref(false)
const badgeItems = ref([])
const reviewOpen = ref(false)
const reviewBusy = ref(false)
const reviewItems = ref([])
const unlockOpen = ref(false)
const unlockTitle = ref('')

onLoad((q) => {
	score.value = Number(q?.score || 0)
	total.value = Number(q?.total || 0)
	passed.value = String(q?.passed || '') === '1'
	delta.value = Number(q?.delta || 0)
	balance.value = q?.balance !== undefined && q?.balance !== '' ? String(q.balance) : ''
	levelNo.value = Number(q?.level_no || 0) || Number(uni.getStorageSync('manna_quiz_level_no') || 1)
	nextLevelId.value = Number(q?.next_level_id || 0)
	storyId.value = Number(q?.story_id || 0)
	attemptId.value = Number(q?.attempt_id || 0)
	// 参数没带余额时先用缓存兜住，避免右上角先显示 0
	if (balance.value === '' && cachedStats && cachedStats.manna != null) {
		balance.value = String(cachedStats.manna)
	}
})

onMounted(() => {
	const earned = takeNewlyEarned()
	if (earned.length) {
		badgeItems.value = earned
		badgeOpen.value = true
	}
	// 失败页没有统计卡，不必为它多打一个请求
	if (passed.value) refreshStats()
})

/** 后台刷新统计卡：只更新变化项，避免同样的值触发二次渲染 */
async function refreshStats() {
	try {
		const res = await apiMannaStatsCard()
		const g = res?.results || {}
		// 接口字段缺失时保留当前值（含缓存值），不要被空响应打回 0
		const num = (v, fallback) => (typeof v === 'number' && isFinite(v) ? v : fallback)
		const next = {
			pray_min: num(g.pray_min, prayMin.value),
			devotion_min: num(g.devotion_min, devotionMin.value),
			read_min: num(g.read_min, readMin.value),
			quiz_num: num(g.quiz_num, quizCount.value),
			manna: typeof g.manna === 'number' ? g.manna : null,
		}
		if (next.pray_min !== prayMin.value) prayMin.value = next.pray_min
		if (next.devotion_min !== devotionMin.value) devotionMin.value = next.devotion_min
		if (next.read_min !== readMin.value) readMin.value = next.read_min
		if (next.quiz_num !== quizCount.value) quizCount.value = next.quiz_num
		if (passed.value) quizCount.value = Math.max(quizCount.value, 1)
		if (next.manna != null && balance.value === '') balance.value = String(next.manna)
		writeStatsCache(next)
	} catch (e) {}
}

const balanceDisplay = computed(() => balance.value || '0')
/** 失败页始终按扣减展示（接口若误传正数也显示 −） */
const displayDelta = computed(() => {
	const d = Number(delta.value || 0)
	if (passed.value) return d
	if (d === 0) return -10
	return -Math.abs(d)
})
const deltaSign = computed(() => (displayDelta.value >= 0 ? '+' : '−'))
const deltaAbs = computed(() => Math.abs(displayDelta.value || 0))
const crossSrc = computed(() =>
	passed.value
		? '/static/ui/quiz/halo-cross-pass.svg'
		: '/static/ui/quiz/halo-cross-fail.svg',
)
const primaryLabel = computed(() => {
	const n = levelNo.value + 1
	return t('quiz_level_n', { n: Math.max(1, n) })
})
const reviewTitle = computed(() => t('quiz_level_n', { n: Math.max(1, levelNo.value) }))

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
	markShowQuizHub()
	uni.switchTab({ url: '/pages/quiz/quiz' })
}

function onUnlockLearn({ id, title }) {
	uni.redirectTo({
		url: `/pagesA/quiz/story-learn?id=${encodeURIComponent(id)}&title=${encodeURIComponent(title || '')}`,
	})
}

/** 放弃 / 叉号（含点遮罩）：关掉解锁弹层后直接进入下一关 */
function onUnlockDismiss() {
	if (!unlockOpen.value) return
	unlockOpen.value = false
	gotoNextLevel()
}

/** 进入下一关：有 next_level_id 就开局，否则回关卡列表 */
const nextBusy = ref(false)
async function gotoNextLevel() {
	if (nextBusy.value) return
	nextBusy.value = true
	try {
		if (nextLevelId.value) {
			await startLevel(nextLevelId.value)
			return
		}
		markShowQuizHub()
		uni.switchTab({ url: '/pages/quiz/quiz' })
	} finally {
		nextBusy.value = false
	}
}

async function onPrimary() {
	// if (!passed.value) {
	// 	tryAgain()
	// 	return
	// }
	if (storyId.value) {
		const s = uni.getStorageSync('manna_quiz_unlock_story') || {}
		unlockTitle.value = s.title || ''
		unlockOpen.value = true
		return
	}
	await gotoNextLevel()
}

async function tryAgain() {
	const cached = uni.getStorageSync('manna_quiz_last_level_id')
	const id = Number(cached || 0)
	if (id) {
		await startLevel(id)
		return
	}
	markShowQuizHub()
	uni.switchTab({ url: '/pages/quiz/quiz' })
}

async function startLevel(levelId) {
	try {
		const res = await apiQuizStart({ level_id: levelId },
		// {
		// 	headers: {
		// 		'X-App-Key': mannaApiKey,
		// 	},
		// }
	)
		const d = res?.results || {}
		if (!d.attempt_id) throw new Error('no attempt')
		cacheAttemptPayload(d, {
			level_id: levelId,
			level_no: d.level_no || levelNo.value,
			balance: typeof d.balance === 'number' ? d.balance : Number(balance.value) || 0,
		})
		uni.redirectTo({ url: `/pagesA/quiz/play?attempt_id=${d.attempt_id}` })
	} catch (e) {
		uni.showToast({ title: e?.message || t('quiz_start_fail'), icon: 'none' })
	}
}

function truthyFlag(v) {
	return v === true || v === 1 || v === '1' || v === 'true'
}

function falsyFlag(v) {
	return v === false || v === 0 || v === '0' || v === 'false'
}

function normalizeReviewItem(row, index) {
	const options = Array.isArray(row?.options) ? row.options : []
	const picked = String(row?.picked ?? row?.option_key ?? '')
	const answerKey = String(row?.answer_key ?? row?.correct_key ?? '')
	let correct = null
	if (truthyFlag(row?.correct)) correct = true
	else if (falsyFlag(row?.correct)) correct = false
	else if (picked && answerKey) correct = picked.toLowerCase() === answerKey.toLowerCase()
	return {
		id: row?.id ?? row?.question_id ?? index,
		stem: String(row?.stem ?? row?.question ?? ''),
		options,
		picked,
		answer_key: answerKey,
		correct: !!correct,
		picked_text: String(row?.picked_text ?? row?.picked_label ?? ''),
		answer_text: String(row?.answer_text ?? row?.answer_label ?? ''),
	}
}

function optionText(item, key, explicit) {
	const k = String(key || '')
	const hit = (item.options || []).find((o) => {
		const ok = String(o?.key ?? o?.option_key ?? o?.id ?? '')
		return ok === k || (ok && k && ok.toLowerCase() === k.toLowerCase())
	})
	const fromOpt = hit ? String(hit.text ?? hit.label ?? hit.content ?? '') : ''
	if (fromOpt) return fromOpt
	if (explicit) return String(explicit)
	return k
}

function reviewRows(item) {
	const picked = String(item.picked || '')
	const answer = String(item.answer_key || '')
	const same = picked && answer && picked.toLowerCase() === answer.toLowerCase()
	if (item.correct || same) {
		const text = optionText(item, answer || picked, item.answer_text || item.picked_text)
		return text ? [{ kind: 'ok', text }] : []
	}
	const rows = []
	if (picked && (!answer || picked.toLowerCase() !== answer.toLowerCase())) {
		const text = optionText(item, picked, item.picked_text)
		if (text) rows.push({ kind: 'bad', text })
	}
	const answerText = optionText(item, answer, item.answer_text)
	if (answerText) rows.push({ kind: 'ok', text: answerText })
	return rows
}

function decorateReview(items) {
	return items.map((item) => ({ ...item, rows: reviewRows(item) }))
}

function readLocalReview(id) {
	const local = uni.getStorageSync('manna_quiz_review') || {}
	const items = Array.isArray(local.items) ? local.items : []
	if (!items.length) return []
	if (id && Number(local.attempt_id || 0) && Number(local.attempt_id) !== id) return []
	return items.map(normalizeReviewItem)
}

function mergeReview(localItems, remoteItems) {
	if (!remoteItems.length) return localItems
	return remoteItems.map((row, i) => {
		const local = localItems.find((it) => String(it.id) === String(row.id)) || localItems[i] || {}
		return normalizeReviewItem({
			...local,
			...row,
			stem: row.stem || local.stem || '',
			picked: row.picked || local.picked || '',
			answer_key: row.answer_key || local.answer_key || '',
			options: (row.options && row.options.length) ? row.options : (local.options || []),
			picked_text: row.picked_text || local.picked_text || '',
			answer_text: row.answer_text || local.answer_text || '',
		}, i)
	})
}

async function loadReviewItems(id) {
	const localItems = readLocalReview(id)
	if (!id) return decorateReview(localItems)
	try {
		const res = await apiQuizResult({ attempt_id: id })
		const d = res?.results || {}
		const detail = d.detail || d.items || []
		const remoteItems = (Array.isArray(detail) ? detail : []).map(normalizeReviewItem)
		return decorateReview(mergeReview(localItems, remoteItems))
	} catch (e) {
		return decorateReview(localItems)
	}
}

function closeReview() {
	reviewOpen.value = false
}

async function goReview() {
	if (reviewBusy.value) return
	const local = uni.getStorageSync('manna_quiz_review') || {}
	const id = Number(attemptId.value || local.attempt_id || 0)
	if (!id) {
		uni.showToast({ title: t('quiz_review_empty'), icon: 'none' })
		return
	}
	reviewBusy.value = true
	try {
		const res = await apiQuizSpend({ kind: 'review', attempt_id: id })
		const d = res?.results || {}
		if (typeof d.balance === 'number') balance.value = String(d.balance)
		reviewItems.value = await loadReviewItems(id)
		reviewOpen.value = true
	} catch (e) {
		const msg = String(e?.message || e?.msg || '').toLowerCase()
		uni.showToast({
			title: msg.includes('insufficient') ? t('quiz_insufficient_manna') : (e?.message || e?.msg || t('network_error')),
			icon: 'none',
		})
	} finally {
		reviewBusy.value = false
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
	& > *:not(:first-child) { margin-left: 12rpx; }
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(255, 255, 255, 0.1);
}

.balance__ico {
	width: 40rpx;
	height: 40rpx;
	flex-shrink: 0;
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
	border: none;
	font-family: $manna-font-body;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
	padding: 0;
	line-height: 1;
	color: $manna-btn-text;
}

.cta::after { border: none; }

/* 底色 alpha 0.9，背后只有一层纯色/渐变光晕，模糊肉眼不可见；
   backdrop-filter 会强制整块背景快照 + 逐帧重算，转场时最贵，直接去掉 */
.cta--solid {
	background: rgba(255, 255, 255, 0.9);
}

.cta--ghost {
	margin-top: 32rpx;
	background: #3a2a24;
	border: 2rpx solid #ffffff;
	.cta__txt { color: #ffffff; font-weight: 700; }
}

.cta--press { opacity: 0.88; }

.cta__ico {
	width: 48rpx;
	height: 48rpx;
	margin-right: 8rpx;
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
}

.stats__cell {
	width: calc((100% - 20rpx) / 2);
	box-sizing: border-box;
	margin-bottom: 20rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 24rpx 28rpx 32rpx;
	border-radius: 24rpx;
	background: #21120e;
	border: 1rpx solid rgba(206, 170, 38, 0.3);
}

.stats__cell:nth-child(odd) {
	margin-right: 20rpx;
}

.stats__cell:nth-child(n+3) {
	margin-bottom: 0;
}

.stats__text {
	flex: 1;
	min-width: 0;
	margin-right: 12rpx;
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

.review {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 30;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	padding: 48rpx 0;
	overflow-y: auto;
}

.review__mask {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.62);
}

.review__sheet {
	position: relative;
	z-index: 1;
	width: 620rpx;
	max-width: calc(100% - 96rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
}

.review__card {
	width: 100%;
	box-sizing: border-box;
	padding: 48rpx 40rpx 40rpx;
	border-radius: 36rpx;
	background: #f6f1e8;
	box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.28);
}

.review__title {
	display: block;
	text-align: center;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 44rpx;
	line-height: 1.2;
	color: #1a1a1a;
}

.review__scroll {
	width: 100%;
	max-height: 68vh;
	margin-top: 36rpx;
	overflow-y: auto;
}

.review__q {
	margin-bottom: 32rpx;
}

.review__q:last-child {
	margin-bottom: 8rpx;
}

.review__stem {
	display: block;
	font-family: $manna-font-body;
	font-weight: 400;
	font-size: 30rpx;
	line-height: 1.4;
	color: #1a1a1a;
}

.review__opts {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	margin-top: 12rpx;
}

.review__opt {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin-right: 28rpx;
	margin-bottom: 8rpx;
}

.review__mark {
	width: 32rpx;
	height: 32rpx;
	flex-shrink: 0;
}

.review__opt-txt {
	margin-left: 10rpx;
	font-family: $manna-font-body;
	font-weight: 400;
	font-size: 30rpx;
	line-height: 1.3;
	color: #1a1a1a;
}

.review__empty {
	display: block;
	padding: 12rpx 0 8rpx;
	text-align: center;
	font-size: 26rpx;
	color: rgba(26, 26, 26, 0.5);
}

.review__x {
	margin-top: 236rpx;
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.review__x--press {
	opacity: 0.75;
}

.review__x-ico {
	width: 72rpx;
	height: 72rpx;
}
</style>
