<template>
	<!-- Manna 货币流水：GET /manna/ledger/ -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav" @click="back">
			<text class="nav__back">‹</text>
			<text class="nav__title">{{ t('ledger_title') }}</text>
		</view>

		<view class="head">
			<view class="head__row">
				<text class="head__n">{{ balance }}</text>
				<image class="head__ico" src="/static/ui/me/ico-manna.svg" mode="aspectFit" />
			</view>
			<text class="head__lab">{{ t('manna_balance') }}</text>
			<text class="earn">{{ t('ledger_earn_hint') }}</text>
		</view>

		<scroll-view
			scroll-y
			class="list"
			:style="{ height: listH }"
			@scrolltolower="loadMore"
		>
			<view v-for="row in rows" :key="row.id" class="row">
				<view class="row__main">
					<text class="row__reason">{{ reasonLabel(row.reason) }}</text>
					<text class="row__time">{{ formatTime(row.created_at) }}</text>
				</view>
				<text class="row__delta" :class="row.delta >= 0 ? 'is-plus' : 'is-minus'">
					{{ formatDelta(row.delta) }}
				</text>
			</view>
			<text v-if="!rows.length && !loading" class="empty">{{ t('ledger_empty') }}</text>
			<text v-if="loading" class="hint">{{ t('loading') }}</text>
			<text v-else-if="rows.length && !hasMore" class="hint">{{ t('ledger_end') }}</text>
		</scroll-view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { t } from '@/i18n/index.js'
import { apiMannaBalance, apiMannaLedger } from '@/api/manna.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const balance = ref(0)
const rows = ref([])
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const listH = ref('70vh')

const REASON_KEYS = {
	grant_newcomer: 'ledger_reason_newcomer',
	quiz_pass: 'ledger_reason_quiz_pass',
	quiz_fail: 'ledger_reason_quiz_fail',
	quiz_in_bible: 'ledger_reason_quiz_in_bible',
	quiz_review: 'ledger_reason_quiz_review',
	story_unlock: 'ledger_reason_story_unlock',
	prayer_amen: 'ledger_reason_prayer',
	devotion_amen: 'ledger_reason_devotion',
	bible_read: 'ledger_reason_bible_read',
}

function reasonLabel(reason) {
	const key = REASON_KEYS[reason]
	if (key) return t(key)
	return reason || t('ledger_reason_other')
}

function formatDelta(n) {
	const v = Number(n) || 0
	return v > 0 ? `+${v}` : String(v)
}

function formatTime(iso) {
	if (!iso) return ''
	try {
		const d = new Date(iso)
		if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16)
		const y = d.getFullYear()
		const m = String(d.getMonth() + 1).padStart(2, '0')
		const day = String(d.getDate()).padStart(2, '0')
		const hh = String(d.getHours()).padStart(2, '0')
		const mm = String(d.getMinutes()).padStart(2, '0')
		return `${y}-${m}-${day} ${hh}:${mm}`
	} catch (e) {
		return String(iso).slice(0, 16)
	}
}

async function loadBalance() {
	try {
		const res = await apiMannaBalance()
		balance.value = res?.results?.balance ?? 0
	} catch (e) {}
}

async function loadPage(reset = false) {
	if (loading.value) return
	if (!reset && !hasMore.value) return
	loading.value = true
	try {
		if (reset) {
			page.value = 1
			hasMore.value = true
			rows.value = []
		}
		const res = await apiMannaLedger({ currentPage: page.value, pageSize: 20 })
		const batch = Array.isArray(res?.results) ? res.results : []
		rows.value = reset ? batch : rows.value.concat(batch)
		const pag = res?.pagination || {}
		const totalPages = Number(pag.total_pages) || 1
		hasMore.value = page.value < totalPages && batch.length > 0
		if (batch.length) page.value += 1
	} catch (e) {
		if (reset) rows.value = []
		hasMore.value = false
	} finally {
		loading.value = false
	}
}

function loadMore() {
	loadPage(false)
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onMounted(async () => {
	try {
		const sys = uni.getSystemInfoSync()
		const h = Math.max(280, (sys.windowHeight || 600) - statusBar - 180)
		listH.value = `${h}px`
	} catch (e) {}
	await loadBalance()
	await loadPage(true)
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	padding: 24rpx 40rpx 40rpx;
	box-sizing: border-box;
	@include manna-peach-page;
}

.nav {
	display: flex;
	align-items: center;
	margin-bottom: 28rpx;
}

.nav__back {
	font-size: 56rpx;
	line-height: 1;
	color: $manna-btn-text;
	padding-right: 8rpx;
}

.nav__title {
	@include manna-nav-title;
}

.head {
	@include manna-white-card;
	padding: 32rpx 36rpx;
	margin-bottom: 24rpx;
}

.head__row {
	display: flex;
	align-items: center;
}

.head__n {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 56rpx;
	color: #000;
	line-height: 1.1;
}

.head__ico {
	width: 32rpx;
	height: 32rpx;
	margin-left: 12rpx;
}

.head__lab {
	display: block;
	margin-top: 4rpx;
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.65);
	text-transform: uppercase;
}

.earn {
	display: block;
	margin-top: 20rpx;
	font-size: 24rpx;
	line-height: 36rpx;
	color: rgba(33, 33, 33, 0.55);
}

.press { opacity: 0.75; }

.list {
	width: 100%;
}

.row {
	@include manna-white-card;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 32rpx;
	margin-bottom: 16rpx;
}

.row__main {
	flex: 1;
	min-width: 0;
}

.row__reason {
	display: block;
	font-family: $manna-font-body;
	font-size: 28rpx;
	color: $manna-btn-text;
}

.row__time {
	display: block;
	margin-top: 8rpx;
	font-family: $manna-font-body;
	font-size: 22rpx;
	color: rgba(33, 33, 33, 0.45);
}

.row__delta {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 32rpx;
	flex-shrink: 0;
}

.row__delta.is-plus {
	color: #2f7d4a;
}

.row__delta.is-minus {
	color: #b44a3a;
}

.empty,
.hint {
	display: block;
	text-align: center;
	padding: 48rpx 16rpx;
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}
</style>
