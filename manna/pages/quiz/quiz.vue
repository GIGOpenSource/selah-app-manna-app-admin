<template>
	<!-- Figma Quiz 591:2092；背景固定，不随触摸滚动 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }" @touchmove.stop.prevent>
		<image class="page__bg" src="/static/ui/quiz/bg-591-2092.png" mode="aspectFill" />
		<view class="page__fade" />

		<view class="page__top">
			<view class="balance" hover-class="balance--press" @click="openLedger">
				<image class="balance__ico" src="/static/ui/quiz/ico-manna.svg" mode="aspectFit" />
				<text class="balance__n">{{ balance }}</text>
			</view>
		</view>

		<view class="page__hero">
			<text class="page__title">{{ t('quiz_hub_title') }}</text>
			<text class="page__tag">{{ t('quiz_hub_tag') }}</text>
			<button
				class="page__cta"
				hover-class="page__cta--press"
				:disabled="starting"
				@click="onPrimary"
			>
				<image class="page__cta-ico" src="/static/ui/quiz/ico-level.svg" mode="aspectFit" />
				<text class="page__cta-txt">{{ primaryLabel }}</text>
			</button>
			<text class="page__stories" hover-class="page__stories--press" @click="openStories">
				{{ t('me_stories') }}
			</text>
			<text v-if="!levels.length && !loading" class="page__empty">{{ t('quiz_empty') }}</text>
		</view>

		<MannaTabBar v-if="tabOn" active="quiz" variant="dark" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { ensureLogin, getUser } from '@/utils/session.js'
import { apiMannaBalance } from '@/api/manna.js'
import { apiQuizHome, apiQuizLevels, apiQuizStart } from '@/api/quiz.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import MannaTabBar from '@/components/MannaTabBar.vue'

const statusBar = getStatusBarPx()
const tabOn = ref(true)
const balance = ref(0)
const levels = ref([])
const loading = ref(false)
const starting = ref(false)

const primaryLevel = computed(() => {
	const open = levels.value.find((lv) => !lv.locked) || levels.value[0]
	return open || null
})

const primaryLabel = computed(() => {
	const lv = primaryLevel.value
	if (!lv) return t('quiz_start')
	return t('quiz_level_n', { n: lv.level_no })
})

async function refresh() {
	loading.value = true
	try {
		const [bal, home, lv] = await Promise.all([
			apiMannaBalance().catch(() => null),
			apiQuizHome().catch(() => null),
			apiQuizLevels().catch(() => null),
		])
		balance.value =
			bal?.results?.balance ??
			home?.results?.balance ??
			(typeof getUser()?.manna_balance === 'number' ? getUser().manna_balance : 0)
		levels.value = lv?.results || []
	} finally {
		loading.value = false
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
	if (starting.value) return
	starting.value = true
	try {
		const res = await apiQuizStart({ level_id: lv.id })
		const d = res?.results || {}
		if (!d.attempt_id) throw new Error('no attempt')
		uni.setStorageSync('manna_quiz_attempt', {
			...d,
			level_no: lv.level_no,
			level_id: lv.id,
			balance: balance.value,
			title: d.title || t('quiz_level_n', { n: lv.level_no }),
		})
		uni.setStorageSync('manna_quiz_last_level_id', lv.id)
		uni.setStorageSync('manna_quiz_level_no', lv.level_no)
		track('manna_quiz_start', { level_id: lv.id, attempt_id: d.attempt_id })
		uni.navigateTo({ url: `/pagesA/quiz/play?attempt_id=${d.attempt_id}` })
	} catch (e) {
		uni.showToast({ title: e?.message || t('quiz_start_fail'), icon: 'none' })
	} finally {
		starting.value = false
	}
}

function openLedger() {
	uni.navigateTo({ url: '/pagesA/profile/ledger' })
}

function openStories() {
	uni.navigateTo({ url: '/pagesA/quiz/stories' })
}

onMounted(async () => {
	tabOn.value = true
	hideNativeTabBar()
	try {
		const user = await ensureLogin({ explicit: true })
		if (typeof user?.manna_balance === 'number') balance.value = user.manna_balance
	} catch (e) {}
	await refresh()
})

onShow(() => {
	tabOn.value = true
	hideNativeTabBar()
	refresh()
})

onHide(() => {
	tabOn.value = false
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
	height: 55%;
	z-index: 1;
	pointer-events: none;
	background: linear-gradient(180deg, rgba(34, 23, 11, 0) 0%, #22170b 45%);
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
	gap: 12rpx;
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

.page__title {
	font-family: $manna-font-body !important;
	font-weight: 700;
	font-size: 64rpx;
	color: $manna-white;
	text-align: center;
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
	gap: 8rpx;
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

.page__stories {
	margin-top: 28rpx;
	font-family: $manna-font-body;
	font-size: 28rpx;
	color: rgba(255, 255, 255, 0.78);
	text-decoration: underline;
	text-underline-offset: 6rpx;
}

.page__stories--press {
	opacity: 0.7;
}

.page__empty {
	margin-top: 20rpx;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.55);
}
</style>
