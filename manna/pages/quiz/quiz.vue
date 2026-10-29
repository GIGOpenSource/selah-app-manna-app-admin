<template>
	<!-- Quiz 枢纽 / Tab 跳板：默认直达当前闯关 play；返回标记时停留本页 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<image class="page__bg" :src="bgSrc" mode="aspectFill" />
		<view class="page__fade" />

		<view v-if="!trampolining" class="page__top">
			<view class="balance" hover-class="balance--press" @click="openLedger">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.png" mode="aspectFit" />
				<text class="balance__n">{{ balance }}</text>
			</view>
		</view>

		<view v-if="!trampolining" class="page__hero" :class="{ 'page__hero--mini': listenSession.mini }">
			<text class="page__title">{{ t('quiz_hub_title') }}</text>
			<text class="page__tag">{{ t('quiz_hub_tag') }}</text>
			<button
				class="page__cta"
				hover-class="page__cta--press"
				:disabled="starting || trampolining"
				@click="onPrimary"
			>
				<image class="page__cta-ico" src="/static/ui/quiz/ico-level.svg" mode="aspectFit" />
				<text class="page__cta-txt">{{ primaryLabel }}</text>
			</button>
			<text v-if="!primaryLevel && !loading" class="page__empty">{{ t('quiz_empty') }}</text>
		</view>

		<MannaTabBar v-show="tabOn && !trampolining" active="quiz" variant="dark" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { ensureLogin, getUser } from '@/utils/session.js'
import { apiMannaBalance } from '@/api/manna.js'
import { apiQuizHome, apiQuizLevels, apiQuizStart } from '@/api/quiz.js'
import { apiAppConfig } from '@/api/content.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { hideNativeTabBar, scheduleCustomTabBarHide, setTabUiKey } from '@/utils/tabbar.js'
import { isDaytime, pickBgForKind, resolveTimedBg } from '@/utils/homeBg.js'
import {
	cacheAttemptPayload,
	clearShowQuizHub,
	consumeShowQuizHub,
	goPlay,
	resolveAndEnterPlay,
} from '@/utils/quizAttempt.js'
import MannaTabBar from '@/components/MannaTabBar.vue'
import { listenSession } from '@/utils/listenSession.js'

const statusBar = getStatusBarPx()
const tabOn = ref(true)
let tabHideTimer = null
// --- 动态背景（CMS 日夜间 / 本地场景池），暂隐藏，改用固定图 ---
const sceneByKind = { morning: '', night: '' }
function sceneBgNow() {
	const k = isDaytime() ? 'morning' : 'night'
	if (!sceneByKind[k]) sceneByKind[k] = pickBgForKind(k)
	return sceneByKind[k]
}
let cmsDayUrl = ''
let cmsNightUrl = ''
const USE_DYNAMIC_QUIZ_BG = false
// --- /动态背景 ---
/** 固定背景图 */
const bgSrc = ref('/static/ui/quiz/Quiz_bg.png')
const balance = ref(0)
const levels = ref([])
const currentLevel = ref(null)
const loading = ref(false)
const starting = ref(false)
const trampolining = ref(false)
/** 从 play 返回：停留枢纽，不自动进 play */
const stayOnHub = ref(false)
let enterSeq = 0

const primaryLevel = computed(() => {
	if (currentLevel.value?.id || currentLevel.value?.level_no) return currentLevel.value
	const open = levels.value.find((lv) => !lv.locked) || levels.value[0]
	return open || null
})

const primaryLabel = computed(() => {
	const n = Number(primaryLevel.value?.level_no)
	if (!n) return t('quiz_start')
	return t('quiz_level_n', { n })
})

// --- 动态背景逻辑（暂隐藏：USE_DYNAMIC_QUIZ_BG = false） ---
function applyQuizBg() {
	if (!USE_DYNAMIC_QUIZ_BG) return
	const cms = resolveTimedBg({ dayUrl: cmsDayUrl, nightUrl: cmsNightUrl })
	bgSrc.value = cms || sceneBgNow()
}

async function loadQuizBg() {
	if (!USE_DYNAMIC_QUIZ_BG) return
	try {
		const res = await apiAppConfig()
		const d = res?.results || {}
		cmsDayUrl = d.manna_quiz_hub_bg_url || ''
		cmsNightUrl = d.manna_quiz_hub_bg_night_url || ''
	} catch (e) {
		cmsDayUrl = ''
		cmsNightUrl = ''
	}
	applyQuizBg()
}
// --- /动态背景逻辑 ---

function applyHomePayload(d) {
	currentLevel.value = d?.current_level || null
	if (typeof d?.balance === 'number') {
		balance.value = d.balance
	}
	if (currentLevel.value) {
		levels.value = [currentLevel.value]
	}
}

async function refresh() {
	loading.value = true
	try {
		const home = await apiQuizHome().catch(() => null)
		const d = home?.results || {}
		applyHomePayload(d)
		if (typeof d.balance !== 'number') {
			const bal = await apiMannaBalance().catch(() => null)
			balance.value =
				bal?.results?.balance ??
				(typeof getUser()?.manna_balance === 'number' ? getUser().manna_balance : 0)
		}
		if (!currentLevel.value) {
			const lv = await apiQuizLevels().catch(() => null)
			levels.value = lv?.results || []
		}
	} finally {
		loading.value = false
	}
}

async function trampolineToPlay() {
	if (stayOnHub.value || starting.value || trampolining.value) return
	const seq = ++enterSeq
	trampolining.value = true
	try {
		const r = await resolveAndEnterPlay({ replace: true })
		if (seq !== enterSeq) return
		if (r.home) applyHomePayload(r.home)
		if (r.ok) {
			track('manna_quiz_start', {
				level_id: uni.getStorageSync('manna_quiz_last_level_id') || 0,
				attempt_id: r.attemptId,
				auto: true,
				resumed: !!r.resumed,
			})
			return
		}
		await refresh()
	} catch (e) {
		await refresh()
		uni.showToast({ title: e?.message || t('quiz_start_fail'), icon: 'none' })
	} finally {
		if (seq === enterSeq) trampolining.value = false
	}
}

async function onPrimary() {
	const lv = primaryLevel.value
	if (!lv) {
		uni.showToast({ title: t('quiz_empty'), icon: 'none' })
		return
	}
	if (lv.locked) {
		uni.showToast({ title: t('quiz_locked'), icon: 'none' })
		return
	}
	if (starting.value || trampolining.value) return
	starting.value = true
	stayOnHub.value = false
	clearShowQuizHub()
	try {
		const res = await apiQuizStart({ level_id: lv.id })
		const d = res?.results || {}
		if (!d.attempt_id) throw new Error('no attempt')
		cacheAttemptPayload(d, {
			level_id: lv.id,
			level_no: lv.level_no,
			title: d.title || lv.title || t('quiz_level_n', { n: lv.level_no }),
			balance: typeof d.balance === 'number' ? d.balance : balance.value,
			time_limit_sec: Number(d.time_limit_sec || lv.time_limit_sec || 0),
		})
		track('manna_quiz_start', { level_id: lv.id, attempt_id: d.attempt_id })
		goPlay(d.attempt_id, { replace: false })
	} catch (e) {
		uni.showToast({ title: e?.message || t('quiz_start_fail'), icon: 'none' })
	} finally {
		starting.value = false
	}
}

function openLedger() {
	uni.navigateTo({ url: '/pagesA/profile/ledger' })
}

onMounted(async () => {
	tabOn.value = true
	setTabUiKey('quiz')
	hideNativeTabBar()
	try {
		const user = await ensureLogin({ explicit: true })
		if (typeof user?.manna_balance === 'number') balance.value = user.manna_balance
	} catch (e) {}
	await loadQuizBg()
})

onShow(async () => {
	if (tabHideTimer) {
		clearTimeout(tabHideTimer)
		tabHideTimer = null
	}
	tabOn.value = true
	setTabUiKey('quiz')
	hideNativeTabBar()
	applyQuizBg()
	track('page_view', { page_name: 'quiz' })

	if (consumeShowQuizHub()) {
		stayOnHub.value = true
		await refresh()
		return
	}

	stayOnHub.value = false
	await trampolineToPlay()
})

onHide(() => {
	tabHideTimer = scheduleCustomTabBarHide(() => {
		tabOn.value = false
		tabHideTimer = null
	})
	enterSeq += 1
	trampolining.value = false
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	overflow: hidden;
	box-sizing: border-box;
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
	height: 70%;
	z-index: 1;
	pointer-events: none;
	background: linear-gradient(
		180deg,
		rgba(34, 23, 11, 0) 0%,
		rgba(34, 23, 11, 0.06) 32%,
		rgba(34, 23, 11, 0.22) 58%,
		rgba(34, 23, 11, 0.38) 82%,
		rgba(34, 23, 11, 0.48) 100%
	);
}

.page__top,
.page__hero {
	position: relative;
	z-index: 2;
}

.page__top {
	display: flex;
	justify-content: flex-end;
	padding: 8rpx 40rpx 0;
}

.balance {
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 12rpx; }
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(33, 33, 33, 0.5);
	border: 1rpx solid rgba(0, 0, 0, 0.35);
}

.balance--press {
	opacity: 0.82;
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
}

.page__hero {
	position: absolute;
	left: 0;
	right: 0;
	bottom: calc(#{$manna-page-pad-bottom} + env(safe-area-inset-bottom, 0px));
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 0 40rpx;
}

/* 听经小窗约 112rpx，再留一点空隙，避免盖住标题和关卡按钮 */
.page__hero--mini {
	bottom: calc(#{$manna-page-pad-bottom} + 136rpx + env(safe-area-inset-bottom, 0px));
}

.page__title {
	font-family: $manna-font-body !important;
	font-weight: 700;
	font-size: 64rpx;
	color: $manna-white;
	text-align: center;
	max-width: 100%;
	padding: 0 8rpx;
	word-break: break-word;
}

.page__tag {
	margin-top: 16rpx;
	font-family: $manna-font-body !important;
	font-weight: 300;
	font-size: 24rpx;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: rgba(255, 255, 255, 0.6);
}

.page__cta {
	@include manna-cta-cream;
	margin-top: 40rpx;
	width: 320rpx;
	height: 104rpx;
	padding: 0;
	border: none;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	& > *:not(:first-child) { margin-left: 8rpx; }
}

.page__cta::after {
	border: none;
}

.page__cta--press {
	transform: scale(0.97);
	opacity: 0.92;
}

.page__cta-ico {
	width: 48rpx;
	height: 48rpx;
}

.page__cta-txt {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 36rpx;
	color: $manna-btn-text;
}

.page__empty {
	margin-top: 20rpx;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.55);
}
</style>
