<template>
	<!-- Figma Me 938:1978 -->
	<view
		class="page"
		:class="{ 'page--mini': listenSession.mini }"
		:style="{ paddingTop: statusBar + 'px' }"
	>
		<view class="cross" aria-hidden="true">
			<view class="cross__v" />
			<view class="cross__h" />
		</view>

		<text class="page__title">{{ t('me_title') }}</text>

		<view class="card card--stats">
			<view class="manna" hover-class="manna--press" @click="openLedger">
				<view class="manna__row">
					<text class="manna__n">{{ balance }}</text>
					<image class="manna__ico" src="/static/ui/me/ico-manna.svg" mode="aspectFit" />
				</view>
				<text class="manna__lab">MANNA</text>
				<text class="manna__hint">{{ todayHint }}</text>
			</view>
			<view class="grid">
				<view
					v-for="s in statsGrid"
					:key="s.key"
					class="grid__cell"
					hover-class="grid__cell--press"
					@click="onStat(s)"
				>
					<view class="grid__text">
						<text class="grid__n">{{ s.value }}</text>
						<text class="grid__lab">{{ s.label }}</text>
					</view>
					<image class="grid__ico" :src="s.icon" mode="aspectFit" />
				</view>
			</view>
		</view>

		<view class="card card--menu">
			<view
				v-for="row in rows"
				:key="row.key"
				class="menu__row"
				hover-class="menu__row--press"
				@click="onRow(row)"
			>
				<image class="menu__ico" :src="row.icon" mode="aspectFit" />
				<text class="menu__label">{{ row.label }}</text>
				<image class="menu__chev" src="/static/ui/me/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<MannaTabBar v-show="tabOn" active="me" variant="light" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { ensureLogin, getUser } from '@/utils/session.js'
import {
	apiMannaBalance,
	apiMannaStats,
	apiMannaCollections,
	apiMannaStatsCard,
} from '@/api/manna.js'
import { apiAppConfig } from '@/api/content.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { hideNativeTabBar, scheduleCustomTabBarHide, setTabUiKey } from '@/utils/tabbar.js'
import { track } from '@/utils/analytics.js'
import { goVip } from '@/utils/vip.js'
import { listenSession } from '@/utils/listenSession.js'
import { openQuizPlayDirect } from '@/utils/quizAttempt.js'
import MannaTabBar from '@/components/MannaTabBar.vue'

const statusBar = getStatusBarPx()
const tabOn = ref(true)
let tabHideTimer = null
const balance = ref(0)
const todayManna = ref(0)
const displayName = ref('')
const prayMin = ref(0)
const devotionMin = ref(0)
const readMin = ref(0)
const quizCount = ref(0)
const collectionsCount = ref(0)
const vipEnabled = ref(false)

const todayHint = computed(() => {
	const n = Number(todayManna.value) || 0
	return t('me_today_manna', { n: n > 0 ? `+${n}` : String(n) })
})

const statsGrid = computed(() => [
	{ key: 'pray', value: String(prayMin.value), label: `${t('stat_pray')} (Manna)`, icon: '/static/ui/me/ico-pray.svg' },
	{ key: 'devotion', value: String(devotionMin.value), label: `${t('stat_devotion')} (Manna)`, icon: '/static/ui/me/ico-devotion.svg' },
	{ key: 'read', value: String(readMin.value), label: `${t('stat_read')} (Manna)`, icon: '/static/ui/me/ico-read.svg' },
	{ key: 'quiz', value: String(quizCount.value), label: `${t('stat_quiz')} (Manna)`, icon: '/static/ui/me/ico-quiz.svg' },
])

const rows = computed(() => {
	const list = [
		{ key: 'calendar', label: t('me_calendar'), path: '/pagesA/calendar/calendar', icon: '/static/ui/me/ico-calendar.svg' },
		{ key: 'collections', label: t('me_collections'), path: '/pagesA/profile/collections', icon: '/static/ui/me/ico-collections.svg' },
		{ key: 'stories', label: t('me_stories'), path: '/pagesA/quiz/stories', icon: '/static/ui/me/ico-stories.svg' },
		{ key: 'bible', label: t('bible'), path: '/pagesA/profile/bible-hub', icon: '/static/ui/me/ico-bible.svg' },
		{ key: 'settings', label: t('settings'), path: '/pagesA/settings/settings', icon: '/static/ui/me/ico-settings.svg' },
	]
	if (vipEnabled.value) {
		const i = list.findIndex((r) => r.key === 'settings')
		list.splice(i < 0 ? list.length : i, 0, { key: 'vip', label: t('me_vip'), path: '', icon: '/static/ui/me/ico-vip.svg' })
	}
	return list
})

async function load() {
	const [bal, st, col, card, cfg] = await Promise.all([
		apiMannaBalance().catch(() => null),
		apiMannaStats().catch(() => null),
		apiMannaCollections().catch(() => null),
		apiMannaStatsCard().catch(() => null),
		apiAppConfig().catch(() => null),
	])
	const relatedFailed = !bal && !st && !card
	// 仅当 balance / stats / stats-card 全部失败时用假数；成功返回 0 保持真零
	if (relatedFailed) {
		balance.value = 520
		todayManna.value = 0
		prayMin.value = 5
		devotionMin.value = 6
		readMin.value = 0
		quizCount.value = 0
		vipEnabled.value = !!(cfg?.results?.manna_vip_enabled)
		return
	}
	const b = bal?.results || {}
	const s = st?.results || {}
	const g = card?.results || {}
	if (typeof b.balance === 'number') balance.value = b.balance
	if (typeof s.balance === 'number') balance.value = s.balance
	if (typeof g.manna === 'number') balance.value = g.manna
	todayManna.value = pickAmount([g, s, b], ['manna_today'])
	const minsFromSec = (sec) => {
		const n = Number(sec) || 0
		if (n <= 0) return 0
		return Math.max(1, Math.round(n / 60))
	}
	prayMin.value = minsFromSec(s.pray_sec)
	devotionMin.value = minsFromSec(s.devotion_sec)
	readMin.value = minsFromSec(s.read_sec)
	quizCount.value = s.quiz_count || 0
	if (typeof g.pray_min === 'number') prayMin.value = g.pray_min
	if (typeof g.devotion_min === 'number') devotionMin.value = g.pray_num
	if (typeof g.read_min === 'number') readMin.value = g.read_min
	if (typeof g.quiz_num === 'number') quizCount.value = g.quiz_num
	const c = col?.results || {}
	collectionsCount.value = (c.favorites || []).filter((f) => f.target_type === 'verse_card').length
	vipEnabled.value = !!(cfg?.results?.manna_vip_enabled)
}

function pickAmount(sources, keys) {
	for (let i = 0; i < sources.length; i++) {
		const obj = sources[i]
		if (!obj || typeof obj !== 'object') continue
		for (let j = 0; j < keys.length; j++) {
			const v = obj[keys[j]]
			if (typeof v === 'number' && Number.isFinite(v)) return v
			if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
		}
	}
	return 0
}

onMounted(async () => {
	tabOn.value = true
	setTabUiKey('me')
	hideNativeTabBar()
	try {
		const user = await ensureLogin({ explicit: true })
		displayName.value = user?.display_name || getUser()?.display_name || ''
		if (typeof user?.manna_balance === 'number') balance.value = user.manna_balance
		if (typeof user?.manna_today === 'number') todayManna.value = user.manna_today
	} catch (e) {}
	await load()
})

onShow(() => {
	if (tabHideTimer) {
		clearTimeout(tabHideTimer)
		tabHideTimer = null
	}
	tabOn.value = true
	setTabUiKey('me')
	hideNativeTabBar()
	load()
	track('page_view', { page_name: 'me' })
})

onHide(() => {
	tabHideTimer = scheduleCustomTabBarHide(() => {
		tabOn.value = false
		tabHideTimer = null
	})
})

function onStat(s) {
	if (s.key === 'pray') {
		uni.navigateTo({ url: '/pagesA/prayer/prayer?kind=morning' })
		return
	}
	if (s.key === 'devotion') {
		uni.switchTab({ url: '/pages/devotion/list' })
		return
	}
	if (s.key === 'read') {
		uni.switchTab({ url: '/pages/bible/bible' })
		return
	}
	if (s.key === 'quiz') {
		openQuizPlayDirect().catch(() => {})
	}
}

async function onRow(row) {
	if (row.key === 'vip') {
		try {
			await goVip('me')
		} catch (e) {
			uni.showToast({ title: t('me_vip_soon'), icon: 'none' })
		}
		return
	}
	if (row.tab) {
		uni.switchTab({ url: row.path })
		return
	}
	if (row.path) uni.navigateTo({ url: row.path })
}

function openLedger() {
	uni.navigateTo({ url: '/pagesA/profile/ledger' })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	padding: 8rpx 40rpx calc(#{$manna-page-pad-bottom} + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
	@include manna-peach-page;
	overflow-x: hidden;
	overflow-y: auto;
}

.page--mini {
	padding-bottom: calc(#{$manna-page-pad-bottom} + 140rpx + env(safe-area-inset-bottom, 0px));
}

.cross {
	position: absolute;
	right: 24rpx;
	top: 48rpx;
	width: 192rpx;
	height: 288rpx;
	pointer-events: none;
	opacity: 0.55;
	z-index: 0;
}

.cross__v {
	position: absolute;
	left: 50%;
	top: 0;
	transform: translateX(-50%);
	width: 20rpx;
	height: 256rpx;
	border-radius: 6rpx;
	background: linear-gradient(180deg, #fff1e7, #ffdabf);
}

.cross__h {
	position: absolute;
	left: 50%;
	top: 72rpx;
	transform: translateX(-50%);
	width: 160rpx;
	height: 20rpx;
	border-radius: 6rpx;
	background: linear-gradient(90deg, #ffddc4, #fff1e9, #ffddc4);
}

.page__title {
	position: relative;
	z-index: 1;
	display: block;
	padding: 8rpx 0 24rpx;
	font-family: $manna-font-body !important;
	font-weight: 700;
	font-size: 40rpx;
	color: #000;
}

.card {
	position: relative;
	z-index: 1;
	@include manna-white-card;
	margin-bottom: 24rpx;
}

.card--stats {
	padding: 32rpx;
	background: linear-gradient(227deg, rgba(255, 255, 255, 0.3) 1%, #ffffff 58%);
	backdrop-filter: blur(4rpx);
}

.manna {
	padding: 8rpx 16rpx 20rpx;
}

.manna--press {
	opacity: 0.85;
}

.manna__row {
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 12rpx; }
}

.manna__n {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 56rpx;
	color: #000;
	line-height: 1.1;
}

.manna__ico {
	width: 32rpx;
	height: 32rpx;
}

.manna__lab {
	display: block;
	margin-top: 4rpx;
	font-family: $manna-font-body;
	font-size: 28rpx;
	color: #000;
	text-transform: uppercase;
}

.manna__hint {
	display: block;
	margin-top: 8rpx;
	font-family: $manna-font-body;
	font-size: 22rpx;
	color: rgba(33, 33, 33, 0.4);
}

.grid {
	display: flex;
	flex-wrap: wrap;
}

.grid__cell {
	width: 48%;
	margin-bottom: 16rpx;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 20rpx 24rpx 28rpx;
	border-radius: 24rpx;
	background: linear-gradient(-65deg, #faece8 2%, #ffecd9 97%);
}

.grid__cell:nth-child(odd) {
	margin-right: 4%;
}

.grid__cell:nth-child(n+3) {
	margin-bottom: 0;
}

.grid__cell--press {
	opacity: 0.88;
}

.grid__text {
	flex: 1;
	min-width: 0;
	margin-right: 8rpx;
	display: flex;
	flex-direction: column;
	& > *:not(:first-child) { margin-top: 4rpx; }
}

.grid__n {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 48rpx;
	color: $manna-btn-text;
	line-height: 1.1;
}

.grid__lab {
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 22rpx;
	line-height: 1.25;
	color: rgba(33, 33, 33, 0.8);
	white-space: normal;
	word-break: break-word;
}

.grid__ico {
	width: 64rpx;
	height: 64rpx;
	flex-shrink: 0;
}

.card--menu {
	padding: 24rpx 0;
}

.menu__row {
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 16rpx; }
	padding: 16rpx 32rpx;
}

.menu__row--press {
	background: rgba(0, 0, 0, 0.03);
}

.menu__ico {
	width: 56rpx;
	height: 56rpx;
	flex-shrink: 0;
}

.menu__label {
	flex: 1;
	font-family: $manna-font-body;
	font-size: 28rpx;
	color: $manna-btn-text;
}

.menu__chev {
	width: 64rpx;
	height: 64rpx;
	opacity: 0.35;
	transform: scaleX(-1);
}
</style>
