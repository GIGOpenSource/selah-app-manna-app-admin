<template>
	<!-- Figma Quiz 576:1606 / 答对 591:1809 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<image class="page__bg" src="/static/ui/quiz/bg-576-1606.png" mode="aspectFill" />
		<view class="page__fade" />

		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ navTitle }}</text>
			<view class="balance" hover-class="nav__press" @click="openLedger">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.png" mode="aspectFit" />
				<text class="balance__n">{{ balance }}</text>
			</view>
		</view>

		<view
			v-if="current"
			class="sheet"
			:class="{ 'sheet--tight': tightLayout && !isJudge, 'sheet--tf': isJudge }"
		>
			<!-- 判断题卡：题目全部非 single 时启用（数字倒计时 + 进度点 + 题干 + NO / YES） -->
			<view v-if="isJudge" class="tf">
				<view class="tf__head">
					<view v-if="timeLimit > 0" class="tfclock">
						<view class="tfclock__box">
							<text class="tfclock__d">{{ clockDigits[0] }}</text>
							<text class="tfclock__d">{{ clockDigits[1] }}</text>
						</view>
						<text class="tfclock__sep">:</text>
						<view class="tfclock__box">
							<text class="tfclock__d">{{ clockDigits[2] }}</text>
							<text class="tfclock__d">{{ clockDigits[3] }}</text>
						</view>
					</view>
					<view class="tf__bars">
						<view
							v-for="n in questions.length"
							:key="'tb' + n"
							class="tf__bar"
							:class="{ 'tf__bar--on': n <= idx + 1 }"
						/>
					</view>
				</view>

				<view class="tf__stemwrap">
					<scroll-view class="tf__stem-scroll" scroll-y :show-scrollbar="false">
						<text class="tf__stem">{{ current.stem }}</text>
					</scroll-view>
				</view>

				<view class="tf__btns">
					<view
						class="tf__btn tf__btn--no"
						:class="tfClass(tfPair.no)"
						hover-class="tf__btn--press"
						@click="pick(tfPair.no)"
					>
						<text class="tf__btn-txt">{{ t('quiz_no') }}</text>
					</view>
					<view
						class="tf__btn tf__btn--yes"
						:class="tfClass(tfPair.yes)"
						hover-class="tf__btn--press"
						@click="pick(tfPair.yes)"
					>
						<text class="tf__btn-txt">{{ t('quiz_yes') }}</text>
					</view>
				</view>

				<!-- 答错 / 需手动结算：In Bible + Next -->
				<view v-if="showNextBar" class="wrong tf__wrong">
					<view class="actions">
						<view
							v-if="!lastCorrect"
							class="chip"
							hover-class="chip--press"
							@click="openInBible"
						>
							<image class="chip__ico" src="/static/ui/quiz/ico-in-bible.svg" mode="aspectFit" />
							<text class="chip__txt">{{ t('quiz_in_bible') }}</text>
						</view>
						<view class="chip" hover-class="chip--press" @click="onNext()">
							<text class="chip__txt">{{ isLast ? t('quiz_finish') : t('quiz_next') }}</text>
							<image class="chip__ico" src="/static/ui/quiz/ico-next.svg" mode="aspectFit" />
						</view>
					</view>
				</view>
			</view>

			<!-- 选择题卡：原样式 -->
			<template v-else>
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
					<!-- <text v-if="remainSec > 0" class="timer">{{ clockLabel }}</text> -->
				</view>

				<view class="qcard">
					<scroll-view class="stem-scroll" scroll-y :show-scrollbar="false">
						<text class="stem">{{ current.stem }}</text>
					</scroll-view>
				</view>

				<view class="optcard">
						<scroll-view
							class="opts-scroll"
							:scroll-y="tightLayout"
							:show-scrollbar="false"
						>
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
					</scroll-view>
				</view>

				<!-- 答错：In Bible + Next（不揭示正确答案文案） -->
				<view v-if="showNextBar" class="wrong">
					<view class="actions">
						<view
							v-if="!lastCorrect"
							class="chip"
							hover-class="chip--press"
							@click="openInBible"
						>
							<image class="chip__ico" src="/static/ui/quiz/ico-in-bible.svg" mode="aspectFit" />
							<text class="chip__txt">{{ t('quiz_in_bible') }}</text>
						</view>
						<view class="chip" hover-class="chip--press" @click="onNext()">
							<text class="chip__txt">{{ isLast ? t('quiz_finish') : t('quiz_next') }}</text>
							<image class="chip__ico" src="/static/ui/quiz/ico-next.svg" mode="aspectFit" />
						</view>
					</view>
				</view>
			</template>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaBalance } from '@/api/manna.js'
import { apiQuizAnswer, apiQuizFinish, apiQuizSpend, apiQuizStart } from '@/api/quiz.js'
import { getUser } from '@/utils/session.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { stashNewlyEarned } from '@/utils/badges.js'
import { markShowQuizHub, syncReviewFromAnswered } from '@/utils/quizAttempt.js'

const statusBar = getStatusBarPx()

/** 结果页首屏图：进答题页后就预热，交卷跳转时直接命中缓存，不等图 */
const RESULT_IMAGES = [
	'/static/ui/quiz/halo-cross-pass.svg',
	'/static/ui/quiz/halo-cross-fail.svg',
	'/static/ui/quiz/ico-back-light.svg',
	'/static/ui/quiz/ico-level-medal.svg',
	'/static/ui/quiz/ico-stat-pray.svg',
	'/static/ui/quiz/ico-stat-devotion.svg',
	'/static/ui/quiz/ico-stat-read.svg',
	'/static/ui/quiz/ico-stat-quiz.svg',
]
function warmResultAssets() {
	// #ifdef H5
	try {
		RESULT_IMAGES.forEach((src) => {
			const img = new Image()
			img.decoding = 'async'
			img.src = src
		})
	} catch (e) {}
	// #endif
}

const attemptId = ref(0)
const title = ref('')
const questions = ref([])
const idx = ref(0)
const picked = ref('')
const answered = ref(false)
const lastCorrect = ref(false)
const lastCorrectKey = ref('')
const busy = ref(false)
const finishing = ref(false)
const balance = ref(0)
const startBalance = ref(0)
const passDelta = ref(30)
const failDelta = ref(-10)
const willFail = ref(false)
const correctCount = ref(0)
const levelNo = ref(1)
const bibleRef = ref(null)
const remainSec = ref(0)
const timeLimit = ref(0)
let advanceTimer = null
let clockTimer = null
let pageReady = false
const reviewLog = []

const current = computed(() => questions.value[idx.value] || null)
const isLast = computed(() => idx.value >= questions.value.length - 1)
const showNextBar = computed(() =>
	answered.value && (!lastCorrect.value || (isLast.value && willFail.value)),
)
const windowHeight = ref(667)
try {
	windowHeight.value = Number(uni.getSystemInfoSync().windowHeight) || 667
} catch (e) {}

/** 题干很长或选项较多时，卡片会超出屏幕，底部「看经文 / 下一题」被裁掉 */
const tightLayout = computed(() => {
	const stem = String(current.value?.stem || '')
	const optCount = (current.value?.options || []).length
	const stemLines = Math.max(1, Math.ceil(stem.length / 22))
	const stemPx = stemLines * 28 + 24
	const optPx = optCount * 72 + 16
	const actionPx = showNextBar.value ? 64 : 0
	const chromePx = statusBar + 210
	return stemPx + optPx + actionPx + chromePx > windowHeight.value
})
const navTitle = computed(() => t('quiz_level_n', { n: levelNo.value || 1 }))
const clockLabel = computed(() => {
	const s = Math.max(0, Number(remainSec.value || 0))
	const m = Math.floor(s / 60)
	const r = s % 60
	return `${m}:${String(r).padStart(2, '0')}`
})

/**
 * 判断题模式：results.questions 里每一项的 qtype 都不是 'single' 时启用。
 * 此时整页换成「数字倒计时 + 进度点 + 题干 + NO / YES」卡片样式。
 */
const isJudge = computed(() => {
	const list = questions.value || []
	if (!list.length) return false
	return list.every((q) => String(q?.qtype || '').toLowerCase() !== 'single')
})

/** 4 位倒计时数字：MM:SS 拆成 [十, 个, 十, 个] */
const clockDigits = computed(() => {
	const s = Math.max(0, Number(remainSec.value || 0))
	const m = Math.floor(s / 60)
	const r = s % 60
	const str = `${String(m).padStart(2, '0')}${String(r).padStart(2, '0')}`
	return str.split('')
})

const TRUE_WORDS = ['true', 't', 'yes', 'y', 'correct', 'right', '正确', '对', '是']
const FALSE_WORDS = ['false', 'f', 'no', 'n', 'incorrect', 'wrong', '错误', '错', '否']

function judgeValueOf(opt) {
	const key = String(opt?.key || '').trim().toLowerCase()
	const text = String(opt?.text || '').trim().toLowerCase()
	if (TRUE_WORDS.includes(key) || TRUE_WORDS.includes(text)) return true
	if (FALSE_WORDS.includes(key) || FALSE_WORDS.includes(text)) return false
	return null
}

/**
 * 把选项映射成「YES / NO」两个按钮：
 * 优先按选项 key/text 语义（True/正确/是 ↔ False/错误/否）识别；
 * 识别不出来时按接口约定，第一个选项为 YES、第二个为 NO。
 */
const tfPair = computed(() => {
	const opts = current.value?.options || []
	if (!opts.length) return { yes: null, no: null }
	let yes = null
	let no = null
	opts.forEach((opt) => {
		const v = judgeValueOf(opt)
		if (v === true && !yes) yes = opt
		if (v === false && !no) no = opt
	})
	if (yes && no) return { yes, no }
	if (!yes && !no && opts.length >= 2) return { yes: opts[0], no: opts[1] }
	return { yes: yes || opts[0] || null, no: no || opts[1] || yes || opts[0] || null }
})

/** 判断题按钮的答题态：选中的对 = 高亮描边，选中错 = 变暗红，未选 = 褪色 */
function tfClass(opt) {
	if (!opt) return 'tf__btn--dim'
	if (!answered.value) return ''
	if (opt.key === picked.value) return lastCorrect.value ? 'tf__btn--ok' : 'tf__btn--bad'
	return 'tf__btn--dim'
}

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
	if (typeof p.balance === 'number') {
		balance.value = p.balance
		startBalance.value = p.balance
	}
	if (typeof p.preview_pass_delta === 'number') passDelta.value = p.preview_pass_delta
	else if ((p.questions || []).length) passDelta.value = 10 * p.questions.length
	if (typeof p.preview_fail_delta === 'number') failDelta.value = p.preview_fail_delta
	if (p.will_fail) willFail.value = true
	if (typeof p.correct_count === 'number') correctCount.value = p.correct_count
	syncReviewFromAnswered(p)
	restoreProgressFromReview()
	if (p.level_id) uni.setStorageSync('manna_quiz_last_level_id', p.level_id)
	uni.setStorageSync('manna_quiz_level_no', levelNo.value)
	const limit = Number(p.time_limit_sec || 0) || (p.mode === 'rapid' ? 60 : 0)
	timeLimit.value = limit
	if (limit > 0 && !clockTimer) startClock(limit)
	persistAttempt(p.level_id)
}

function restoreProgressFromReview() {
	const review = uni.getStorageSync('manna_quiz_review') || {}
	if (Number(review.attempt_id) !== attemptId.value || !Array.isArray(review.items) || !review.items.length) return
	reviewLog.length = 0
	review.items.forEach((item) => reviewLog.push(item))
	correctCount.value = review.items.filter((i) => i.correct).length
	if (review.items.some((i) => i.correct === false)) willFail.value = true
	const answeredIds = new Set(review.items.map((i) => i.id))
	const nextIdx = questions.value.findIndex((q) => !answeredIds.has(q.id))
	if (nextIdx >= 0) {
		idx.value = nextIdx
		return
	}
	if (!questions.value.length) return
	idx.value = questions.value.length - 1
	const last = review.items[review.items.length - 1] || {}
	answered.value = true
	lastCorrect.value = !!last.correct
	lastCorrectKey.value = String(last.answer_key || '')
	picked.value = String(last.picked || '')
}

function persistAttempt(levelId) {
	const prev = uni.getStorageSync('manna_quiz_attempt') || {}
	uni.setStorageSync('manna_quiz_attempt', {
		...prev,
		attempt_id: attemptId.value,
		level_id: levelId || prev.level_id || uni.getStorageSync('manna_quiz_last_level_id'),
		level_no: levelNo.value,
		title: title.value,
		mode: prev.mode || '',
		time_limit_sec: prev.time_limit_sec,
		questions: questions.value,
		balance: startBalance.value || balance.value,
		preview_pass_delta: passDelta.value,
		preview_fail_delta: failDelta.value,
		will_fail: willFail.value,
		correct_count: correctCount.value,
	})
}

function applyWallet(n) {
	if (typeof n !== 'number') return
	balance.value = n
	startBalance.value = n
	persistAttempt()
}

async function refreshBalance() {
	try {
		const bal = await apiMannaBalance()
		if (typeof bal?.results?.balance === 'number') {
			applyWallet(bal.results.balance)
		} else if (typeof getUser()?.manna_balance === 'number') {
			applyWallet(getUser().manna_balance)
		}
	} catch (e) {}
}

async function leaveToQuizHub() {
	uni.showToast({ title: t('quiz_start_fail'), icon: 'none' })
	setTimeout(() => {
		markShowQuizHub()
		uni.switchTab({ url: '/pages/quiz/quiz' })
	}, 400)
}

/**
 * 409 换关重开：用服务端给的新关卡 id 重新 start 开新局。
 * 仅在答案接口返回 code=409 且 data.restart=true 时调用。
 */
async function restartWithLevel(lvId) {
	const id = Number(lvId || 0)
	if (!id) throw new Error('no level')
	// 清掉上一关的计时器与本地进度，避免沿用旧关状态
	if (clockTimer) {
		clearInterval(clockTimer)
		clockTimer = null
	}
	remainSec.value = 0
	timeLimit.value = 0
	idx.value = 0
	picked.value = ''
	answered.value = false
	lastCorrect.value = false
	lastCorrectKey.value = ''
	correctCount.value = 0
	willFail.value = false
	reviewLog.length = 0
	uni.removeStorageSync('manna_quiz_review')
	const res = await apiQuizStart({ level_id: id })
	const d = res?.results || {}
	if (!d.attempt_id) throw new Error('no attempt')
	applyAttemptPayload(d)
}

function startClock(sec) {
	remainSec.value = sec
	if (clockTimer) clearInterval(clockTimer)
	clockTimer = setInterval(() => {
		remainSec.value = Math.max(0, remainSec.value - 1)
		if (remainSec.value <= 0) {
			clearInterval(clockTimer)
			clockTimer = null
			forceFinish()
		}
	}, 1000)
}

async function forceFinish() {
	if (busy.value) return
	answered.value = true
	await onNext(true)
}

onMounted(async () => {
	hideNativeTabBar()
	const cached = uni.getStorageSync('manna_quiz_attempt') || {}
	const routeId = Number(attemptId.value || 0)
	const cacheId = Number(cached.attempt_id || 0)
	if (cacheId && (!routeId || cacheId === routeId) && (cached.questions || []).length) {
		await applyAttemptPayload(cached)
	}
	if (!attemptId.value || !questions.value.length) {
		await leaveToQuizHub()
		return
	}
	await refreshBalance()
	pageReady = true
	// 交卷前就把结果页的图预热好：错开首屏，别和当前页的请求抢带宽
	setTimeout(warmResultAssets, 400)
})

onShow(() => {
	hideNativeTabBar()
	if (!pageReady) return
	refreshBalance()
})

onUnmounted(() => {
	if (advanceTimer) clearTimeout(advanceTimer)
	if (clockTimer) clearInterval(clockTimer)
})

function optClass(opt) {
	if (!answered.value) return ''
	if (lastCorrect.value) {
		if (opt.key === picked.value) return 'opt--ok'
		return 'opt--dim'
	}
	// 答错不揭示正确答案，只标记用户所选
	if (opt.key === picked.value) return 'opt--bad'
	return 'opt--dim'
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
	if (answered.value || busy.value || finishing.value || !current.value) return
	const qid = current.value.id
	if (!qid || !opt?.key) return
	picked.value = opt.key
	busy.value = true
	try {
		const res = await apiQuizAnswer(
			{
				attempt_id: attemptId.value,
				question_id: qid,
				option_key: opt.key,
			},
			// 409 换关重开由本页静默处理，不要弹通用错误
			{ silentBizCodes: [409] },
		)
		const d = res?.results || {}
		answered.value = true
		lastCorrect.value = !!d.correct
		if (!lastCorrect.value) willFail.value = true
		lastCorrectKey.value = String(d.answer_key || (d.correct ? opt.key : '') || '')
		bibleRef.value = d.bible_ref || current.value.bible_ref || null
		const alreadyLogged = reviewLog.some((i) => i.id === qid)
		reviewLog.push({
			id: qid,
			stem: current.value.stem,
			options: current.value.options || [],
			picked: opt.key,
			correct: lastCorrect.value,
			answer_key: lastCorrectKey.value,
		})
		uni.setStorageSync('manna_quiz_review', {
			attempt_id: attemptId.value,
			items: reviewLog.slice(),
		})
		if (lastCorrect.value) {
			if (!alreadyLogged) correctCount.value += 1
			// 已失败则最后一题不自动跳转，等用户点 Next 再进失败页
			if (!(isLast.value && willFail.value)) scheduleAdvance()
		}
		persistAttempt()
	} catch (e) {
		// 服务端要求换关重开（code=409 且 data.restart=true）：不弹错，
		// 直接用 data.question_level_id 重新调 start 开新局
		if (e?.code === 409 && e?.data?.restart) {
			picked.value = ''
			answered.value = false
			const newLevelId = Number(e?.data?.question_level_id || 0)
			if (newLevelId) {
				try {
					await restartWithLevel(newLevelId)
				} catch (e2) {
					uni.showToast({ title: t('quiz_start_fail'), icon: 'none' })
					await leaveToQuizHub()
				}
				return
			}
		}
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		picked.value = ''
		answered.value = false
	} finally {
		busy.value = false
	}
}

async function openInBible() {
	if (busy.value) return
	const r = bibleRef.value || current.value?.bible_ref || {}
	const book = String(r.book || r.book_key || '').trim()
	const chapter = Number(r.chapter) || 1
	const verse = Number(r.verse || r.verse_start) || 1
	// bible_ref 常给 verse_start/verse_end 区间，一起带到 InBible 做整段高亮
	const verseEnd = Math.max(Number(r.verse_end) || verse, verse)
	if (!book) {
		uni.showToast({ title: t('quiz_in_bible'), icon: 'none' })
		return
	}
	busy.value = true
	try {
		const res = await apiQuizSpend({
			kind: 'in_bible',
			attempt_id: attemptId.value,
			question_id: current.value?.id || 0,
		})
		const d = res?.results || {}
		if (typeof d.balance === 'number') {
			applyWallet(d.balance)
		}
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		busy.value = false
		return
	}
	busy.value = false
	const name = encodeURIComponent(r.book_name || r.name || '')
	const level = encodeURIComponent(title.value || 'Level')
	uni.navigateTo({
		url: `/pagesA/quiz/in-bible?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}&end=${verseEnd}&name=${name}&level=${level}&attempt_id=${attemptId.value}&balance=${balance.value}`,
	})
}

async function onNext(force = false) {
	// @click 会传入 event，不可当作 force
	const doForce = force === true
	if (!answered.value && !doForce) return
	clearAdvance()
	if (!isLast.value && !doForce) {
		idx.value += 1
		picked.value = ''
		answered.value = false
		lastCorrectKey.value = ''
		lastCorrect.value = false
		bibleRef.value = null
		persistAttempt()
		return
	}
	if (busy.value || finishing.value) return
	finishing.value = true
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
		stashNewlyEarned(d.newly_earned)
		const lv = levelNo.value
		const nextId = d.next_level?.id || ''
		const storyId = d.unlock_story?.id || ''
		uni.removeStorageSync('manna_quiz_attempt')
		if (d.unlock_story) {
			uni.setStorageSync('manna_quiz_unlock_story', d.unlock_story)
		}
		uni.redirectTo({
			url: `/pagesA/quiz/result?attempt_id=${attemptId.value}&score=${d.score || 0}&total=${d.total || 0}&passed=${d.passed ? 1 : 0}&delta=${d.manna_delta || 0}&balance=${d.balance ?? ''}&level_no=${lv}&next_level_id=${nextId}&story_id=${storyId}`,
			fail: () => {
				finishing.value = false
				uni.navigateTo({
					url: `/pagesA/quiz/result?attempt_id=${attemptId.value}&score=${d.score || 0}&total=${d.total || 0}&passed=${d.passed ? 1 : 0}&delta=${d.manna_delta || 0}&balance=${d.balance ?? ''}&level_no=${lv}&next_level_id=${nextId}&story_id=${storyId}`,
					fail: () => { finishing.value = false },
				})
			},
		})
	} catch (e) {
		finishing.value = false
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
	persistAttempt()
	markShowQuizHub()
	uni.switchTab({ url: '/pages/quiz/quiz' })
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
	padding: 0 0 calc(64rpx + env(safe-area-inset-bottom, 0px));
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
	overflow-y: auto;
}

.nav {
	position: relative;
	display: flex;
	align-items: center;
	flex-shrink: 0;
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
	flex: 1;
	min-width: 0;
	margin-left: 8rpx;
	@include manna-nav-title;
	color: #000;
	text-align: left;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.timer {
	position: absolute;
	right: 8rpx;
	top: 2rpx;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 24rpx;
	color: #aa614b;
	line-height: 1;
}

.balance {
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 12rpx; }
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
	flex-shrink: 0;
}

.balance__n {
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 28rpx;
	color: $manna-white;
	line-height: 1;
}

.sheet {
	margin:200rpx 48rpx 0;
	padding: 28rpx 28rpx 32rpx;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	border-radius: 56rpx;
	border: 2rpx solid $manna-white;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.66) 0%, rgba(255, 255, 255, 0.92) 100%);
	box-shadow: 0 0 40rpx rgba(170, 97, 75, 0.1);
	backdrop-filter: blur(10rpx);
}

.sheet--tight {
	flex: 1;
	min-height: 0;
	margin-top: 24rpx;
	overflow: hidden;
}

.prog {
	position: relative;
	width: 100%;
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	& > *:not(:first-child):not(.timer) { margin-top: 16rpx; }
}

.prog__lab {
	display: flex;
	align-items: baseline;
	& > *:not(:first-child) { margin-left: 4rpx; }
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
	& > *:not(:first-child) { margin-left: 8rpx; }
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

.qcard {
	width: 100%;
	flex-shrink: 0;
	margin-top: 60rpx;
	padding: 36rpx 24rpx;
	box-sizing: border-box;
	border-radius: 32rpx;
}

.sheet--tight .qcard {
	flex: 1 1 0;
	min-height: 0;
	margin-top: 20rpx;
	padding-top: 12rpx;
	padding-bottom: 8rpx;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.stem-scroll {
	width: 100%;
	max-height: 40vh;
	box-sizing: border-box;
}

.sheet--tight .stem-scroll {
	flex: 1;
	height: 0;
	max-height: none;
}

.stem {
	display: block;
	width: 100%;
	box-sizing: border-box;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 40rpx;
	line-height: 1.3;
	text-align: center;
	color: $manna-btn-text;
}

.optcard {
	width: 100%;
	flex-shrink: 0;
	margin-top:50rpx;
	padding: 24rpx;
	box-sizing: border-box;
	border-radius: 32rpx;
}

.sheet--tight .optcard {
	flex: 0 0 auto;
	min-height: 0;
	height: 42%;
	max-height: 42%;
	margin-top: 8rpx;
	padding-top: 8rpx;
	padding-bottom: 8rpx;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.opts-scroll {
	width: 100%;
}

.sheet--tight .opts-scroll {
	flex: 1;
	height: 100%;
}

.sheet--tight .opt {
	height: 104rpx;
}

.sheet--tight .wrong {
	flex-shrink: 0;
}

.opts {
	width: 100%;
	display: flex;
	flex-direction: column;
	& > *:not(:first-child) { margin-top: 16rpx; }
}

.opt {
	height: 130rpx;
	min-height: 88rpx;
	padding: 0 32rpx;
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

.wrong {
	width: 100%;
	flex-shrink: 0;
	margin-top: 20rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.wrong__ans {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 24rpx;
	color: $quiz-ok;
	margin-bottom: 12rpx;
}

.actions {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	& > *:not(:first-child) { margin-left: 24rpx; }
	flex-shrink: 0;
	padding-top: 8rpx;
}

.chip {
	display: flex;
	align-items: center;
	justify-content: center;
	& > *:not(:first-child) { margin-left: 4rpx; }
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

/* ===== 判断题卡（qtype 全非 single）：数字倒计时 + 进度点 + 题干 + NO / YES ===== */
.sheet--tf {
	margin: 140rpx 48rpx 0;
	padding: 48rpx 40rpx 44rpx;
	max-height: calc(100vh - 240rpx);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.tf {
	width: 100%;
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.tf__head {
	width: 100%;
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.tfclock {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.tfclock__box {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 124rpx;
	height: 92rpx;
	padding: 0 14rpx;
	box-sizing: border-box;
	border-radius: 24rpx;
	background: $quiz-terra;
	& > *:not(:first-child) { margin-left: 12rpx; }
}

.tfclock__d {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 44rpx;
	line-height: 1;
	color: #fff4ee;
}

.tfclock__sep {
	margin: 0 14rpx;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 40rpx;
	line-height: 1;
	color: $quiz-terra;
}

.tf__bars {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	margin-top: 28rpx;
	& > *:not(:first-child) { margin-left: 16rpx; }
}

.tf__bar {
	width: 56rpx;
	height: 8rpx;
	border-radius: 20rpx;
	background: rgba(170, 97, 75, 0.18);
}

.tf__bar--on {
	background: $quiz-terra;
}

.tf__stemwrap {
	width: 100%;
	flex: 1;
	min-height: 0;
	margin-top: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.tf__stem-scroll {
	width: 100%;
	max-height: 32vh;
	box-sizing: border-box;
}

.tf__stem {
	display: block;
	width: 100%;
	box-sizing: border-box;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 42rpx;
	line-height: 1.36;
	text-align: center;
	color: $manna-btn-text;
}

.tf__btns {
	width: 100%;
	flex-shrink: 0;
	margin-top: 52rpx;
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 24rpx; }
}

.tf__btn {
	flex: 1;
	height: 100rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	border-radius: 200rpx;
	transition: opacity 0.16s ease;
}

.tf__btn--no {
	background: $quiz-terra;
}

.tf__btn--yes {
	background: $quiz-ok;
}

.tf__btn--press { opacity: 0.86; }

.tf__btn-txt {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 30rpx;
	letter-spacing: 0.08em;
	color: $manna-white;
}

.tf__btn--ok {
	box-shadow: inset 0 0 0 6rpx rgba(255, 255, 255, 0.8);
}

.tf__btn--bad {
	background: #8d4e3c;
	box-shadow: inset 0 0 0 6rpx rgba(255, 255, 255, 0.5);
}

.tf__btn--dim {
	opacity: 0.38;
}

.tf__wrong {
	margin-top: 24rpx;
}

</style>
