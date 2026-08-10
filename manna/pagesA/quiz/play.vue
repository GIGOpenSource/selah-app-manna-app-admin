<template>
	<!-- Figma Quiz 576:1606 / 答对 591:1809 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<image class="page__bg" src="/static/ui/quiz/bg-576-1606.png" mode="aspectFill" />
		<view class="page__fade" />

		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ title }}</text>
			<view class="balance" hover-class="nav__press" @click="openLedger">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.svg" mode="aspectFit" />
				<text class="balance__n">{{ balance }}</text>
			</view>
		</view>

		<view v-if="current" class="sheet">
			<view class="prog">
				<view class="prog__lab">
					<text class="prog__cur">{{ idx + 1 }}</text>
					<text class="prog__tot">/{{ questions.length }}</text>
				</view>
				<view class="prog__bars">
					<view
						v-for="n in questions.length"
						:key="'b' + n"
						class="prog__bar"
						:class="{ 'prog__bar--on': n <= idx + 1 }"
					/>
				</view>
			</view>

			<view class="stem-wrap">
				<text class="stem">{{ current.stem }}</text>
			</view>

			<view class="opts">
				<view
					v-for="opt in (current.options || [])"
					:key="opt.key"
					class="opt"
					:class="optClass(opt)"
					hover-class="opt--press"
					@click="pick(opt)"
				>
					<text class="opt__txt">{{ opt.text || opt.key }}</text>
				</view>
			</view>

			<!-- Figma 591:1912 答错：In Bible + Next -->
			<view v-if="answered && !lastCorrect" class="actions">
				<view class="chip" hover-class="chip--press" @click="openInBible">
					<image class="chip__ico" src="/static/ui/quiz/ico-in-bible.svg" mode="aspectFit" />
					<text class="chip__txt">{{ t('quiz_in_bible') }}</text>
				</view>
				<view class="chip" hover-class="chip--press" @click="onNext">
					<text class="chip__txt">{{ isLast ? t('quiz_finish') : t('quiz_next') }}</text>
					<image class="chip__ico" src="/static/ui/quiz/ico-next.svg" mode="aspectFit" />
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaBalance } from '@/api/manna.js'
import { apiQuizAnswer, apiQuizFinish, apiQuizStart } from '@/api/quiz.js'
import { getUser } from '@/utils/session.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const attemptId = ref(0)
const title = ref('')
const questions = ref([])
const idx = ref(0)
const picked = ref('')
const answered = ref(false)
const lastCorrect = ref(false)
const lastCorrectKey = ref('')
const busy = ref(false)
const balance = ref(0)
const levelNo = ref(1)
const bibleRef = ref(null)
let advanceTimer = null

const current = computed(() => questions.value[idx.value] || null)
const isLast = computed(() => idx.value >= questions.value.length - 1)

onLoad((q) => {
	attemptId.value = Number(q?.attempt_id || 0)
})

async function applyAttemptPayload(payload) {
	const p = payload || {}
	attemptId.value = Number(p.attempt_id || attemptId.value || 0)
	levelNo.value = Number(p.level_no || 1)
	title.value =
		p.title ||
		(levelNo.value ? t('quiz_level_n', { n: levelNo.value }) : t('quiz'))
	questions.value = p.questions || []
	if (typeof p.balance === 'number') balance.value = p.balance
	if (p.level_id) uni.setStorageSync('manna_quiz_last_level_id', p.level_id)
	uni.setStorageSync('manna_quiz_level_no', levelNo.value)
	uni.setStorageSync('manna_quiz_attempt', {
		attempt_id: attemptId.value,
		level_id: p.level_id || uni.getStorageSync('manna_quiz_last_level_id'),
		level_no: levelNo.value,
		title: title.value,
		questions: questions.value,
		balance: balance.value,
	})
}

async function leaveToQuizHub() {
	uni.showToast({ title: t('quiz_start_fail'), icon: 'none' })
	setTimeout(() => {
		uni.switchTab({ url: '/pages/quiz/quiz' })
	}, 400)
}

onMounted(async () => {
	const cached = uni.getStorageSync('manna_quiz_attempt') || {}
	if (cached.attempt_id && Number(cached.attempt_id) === attemptId.value) {
		await applyAttemptPayload(cached)
	}
	if (!questions.value.length) {
		const levelId =
			Number(uni.getStorageSync('manna_quiz_last_level_id') || 0) ||
			Number(cached.level_id || 0)
		if (levelId) {
			try {
				const res = await apiQuizStart({ level_id: levelId })
				const r = res?.results || {}
				await applyAttemptPayload({
					attempt_id: r.attempt_id,
					level_id: levelId,
					level_no: r.level_no || cached.level_no,
					title: r.title || cached.title,
					questions: r.questions || [],
					balance: r.balance,
				})
			} catch (e) {
				await leaveToQuizHub()
				return
			}
		}
	}
	if (!attemptId.value || !questions.value.length) {
		await leaveToQuizHub()
		return
	}
	try {
		const bal = await apiMannaBalance()
		if (typeof bal?.results?.balance === 'number') {
			balance.value = bal.results.balance
		} else if (typeof getUser()?.manna_balance === 'number') {
			balance.value = getUser().manna_balance
		}
	} catch (e) {}
})

onUnmounted(() => {
	if (advanceTimer) clearTimeout(advanceTimer)
})

function optClass(opt) {
	if (!answered.value) return ''
	// 答对：正确项绿；答错稿只标选中项为 terra，不额外标绿
	if (lastCorrect.value && opt.key === lastCorrectKey.value) return 'opt--ok'
	if (!lastCorrect.value && picked.value === opt.key) return 'opt--bad'
	if (answered.value) return 'opt--dim'
	return ''
}

function clearAdvance() {
	if (advanceTimer) {
		clearTimeout(advanceTimer)
		advanceTimer = null
	}
}

function scheduleAdvance() {
	clearAdvance()
	advanceTimer = setTimeout(() => {
		advanceTimer = null
		onNext()
	}, 900)
}

async function pick(opt) {
	if (answered.value || busy.value || !current.value) return
	picked.value = opt.key
	busy.value = true
	try {
		const res = await apiQuizAnswer({
			attempt_id: attemptId.value,
			question_id: current.value.id,
			option_key: opt.key,
		})
		const d = res?.results || {}
		answered.value = true
		lastCorrect.value = !!d.correct
		lastCorrectKey.value = String(d.answer_key || (d.correct ? opt.key : '') || '')
		bibleRef.value = d.bible_ref || current.value.bible_ref || null
		if (lastCorrect.value) scheduleAdvance()
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		picked.value = ''
	} finally {
		busy.value = false
	}
}

function openInBible() {
	const r = bibleRef.value || {}
	const book = r.book || r.book_key || 'romans'
	const chapter = Number(r.chapter) || 7
	const verse = Number(r.verse) || 3
	const name = encodeURIComponent(r.book_name || r.name || '')
	const level = encodeURIComponent(title.value || 'Level')
	uni.navigateTo({
		url: `/pagesA/quiz/in-bible?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}&name=${name}&level=${level}&attempt_id=${attemptId.value}&balance=${balance.value}`,
	})
}

async function onNext() {
	if (!answered.value) return
	clearAdvance()
	if (!isLast.value) {
		idx.value += 1
		picked.value = ''
		answered.value = false
		lastCorrectKey.value = ''
		lastCorrect.value = false
		bibleRef.value = null
		return
	}
	if (busy.value) return
	busy.value = true
	try {
		const res = await apiQuizFinish({ attempt_id: attemptId.value })
		const d = res?.results || {}
		track('manna_quiz_finish', {
			attempt_id: attemptId.value,
			score: d.score || 0,
			passed: !!d.passed,
			manna_delta: d.manna_delta || 0,
		})
		const lv = levelNo.value
		uni.removeStorageSync('manna_quiz_attempt')
		uni.redirectTo({
			url: `/pagesA/quiz/result?attempt_id=${attemptId.value}&score=${d.score || 0}&total=${d.total || 0}&passed=${d.passed ? 1 : 0}&delta=${d.manna_delta || 0}&balance=${d.balance ?? ''}&level_no=${lv}`,
		})
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	} finally {
		busy.value = false
	}
}

function openLedger() {
	uni.navigateTo({ url: '/pagesA/profile/ledger' })
}

function back() {
	clearAdvance()
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/quiz/quiz' }) })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

$quiz-terra: #aa614b;
$quiz-opt: #faece8;
$quiz-opt-border: #ffd1c4;
$quiz-ok: #52aa4b;
$quiz-bad: #d96b5c;

.page {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	box-sizing: border-box;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	padding: 0 0 40rpx;
	font-family: $manna-font-body;
	color: $manna-btn-text;
}

.page__bg {
	position: fixed;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
	pointer-events: none;
}

.page__fade {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	height: 62%;
	z-index: 0;
	pointer-events: none;
	background: linear-gradient(180deg, rgba(255, 244, 238, 0) 0%, #fff4ee 31%);
}

.nav,
.sheet {
	position: relative;
	z-index: 1;
}

.nav {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 40rpx 16rpx;
	min-height: 64rpx;
}

.nav__back {
	width: 64rpx;
	height: 64rpx;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2;
}

.nav__back-ico {
	width: 48rpx;
	height: 48rpx;
}

.nav__press { opacity: 0.72; }

.nav__title {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
	max-width: 46%;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 36rpx;
	color: #000;
	line-height: 1.2;
	text-align: center;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	z-index: 1;
	pointer-events: none;
}

.balance {
	display: flex;
	align-items: center;
	gap: 12rpx;
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(33, 33, 33, 0.5);
	border: 1rpx solid rgba(0, 0, 0, 0.5);
	flex-shrink: 0;
	margin-left: auto;
	z-index: 2;
}

.balance__ico {
	width: 40rpx;
	height: 40rpx;
}

.balance__n {
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 28rpx;
	color: $manna-white;
	line-height: 1;
}

.sheet {
	flex: 1;
	margin: 24rpx 48rpx 0;
	min-height: 0;
	padding: 48rpx 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 40rpx;
	box-sizing: border-box;
	border-radius: 56rpx;
	border: 2rpx solid $manna-white;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, #ffffff 47%);
	box-shadow: 0 0 40rpx rgba(170, 97, 75, 0.1);
	backdrop-filter: blur(10rpx);
}

.prog {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16rpx;
}

.prog__lab {
	display: flex;
	align-items: baseline;
	gap: 4rpx;
	color: $manna-btn-text;
	font-size: 24rpx;
}

.prog__cur {
	font-family: $manna-font-body;
	font-weight: 400;
}

.prog__tot {
	font-family: $manna-font-body;
	font-weight: 300;
	opacity: 0.7;
	letter-spacing: 0.1em;
}

.prog__bars {
	display: flex;
	align-items: center;
	gap: 8rpx;
}

.prog__bar {
	width: 64rpx;
	height: 8rpx;
	border-radius: 20rpx;
	background: rgba(170, 97, 75, 0.15);
}

.prog__bar--on {
	background: $quiz-terra;
}

.stem-wrap {
	width: 100%;
	min-height: 220rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 8rpx;
	box-sizing: border-box;
}

.stem {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 48rpx;
	line-height: 1.25;
	text-align: center;
	color: $manna-btn-text;
}

.opts {
	flex: 1;
	width: 100%;
	min-height: 0;
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 24rpx;
}

.opt {
	flex: 1;
	min-height: 96rpx;
	max-height: 160rpx;
	padding: 32rpx;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 200rpx;
	background: $quiz-opt;
	border: 2rpx solid $quiz-opt-border;
}

.opt--press { opacity: 0.88; }

.opt__txt {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 36rpx;
	text-align: center;
	color: $manna-btn-text;
	width: 100%;
}

/* Figma 591:1809 答对：实心绿 + 白粗字 */
.opt--ok {
	background: $quiz-ok;
	border-color: $quiz-ok;
	.opt__txt {
		color: $manna-white;
		font-weight: 700;
	}
}

/* Figma 答错：选中项 terra，非鲜红 */
.opt--bad {
	background: $quiz-terra;
	border-color: $quiz-terra;
	.opt__txt {
		color: $manna-white;
		font-weight: 700;
	}
}

.opt--dim {
	opacity: 0.55;
}

.actions {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	gap: 24rpx;
	flex-shrink: 0;
	padding-top: 8rpx;
}

.chip {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4rpx;
	min-width: 204rpx;
	padding: 8rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(255, 255, 255, 0.5);
	border: 1rpx solid rgba(0, 0, 0, 0.1);
	box-sizing: border-box;
}

.chip--press { opacity: 0.8; }

.chip__ico {
	width: 40rpx;
	height: 40rpx;
}

.chip__txt {
	font-family: $manna-font-body;
	font-weight: 500;
	font-size: 24rpx;
	color: $manna-btn-text;
}
</style>
