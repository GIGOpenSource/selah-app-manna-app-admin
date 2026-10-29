<!--
  AI 对话日历：有记录的日期可点，直接回到当天聊天页；无记录日期置灰。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title">{{ t('ai_calendar_title') }}</text>
				<view class="nav-spacer" />
			</view>
		</view>

		<view class="month-bar">
			<text class="month-nav" @tap="shiftMonth(-1)">‹</text>
			<text class="month-label">{{ monthLabel }}</text>
			<text v-if="canShiftNext" class="month-nav" @tap="shiftMonth(1)">›</text>
			<view v-else class="month-nav" />
		</view>
		<view class="dow-row">
			<text v-for="d in dows" :key="d" class="dow">{{ d }}</text>
		</view>
		<view class="grid">
			<view
				v-for="(cell, i) in cells"
				:key="i"
				:class="['cell', cell.iso ? 'hit' : 'pad', cell.iso === selected && cell.clickable ? 'on' : '', cell.has ? 'has' : '', cell.muted ? 'muted' : '']"
				:hover-class="cell.clickable ? 'cell-press' : 'none'"
				:hover-start-time="cell.clickable ? 20 : 99999"
				@tap="pickDay(cell)"
			>
				<text v-if="cell.day" class="cell-num">{{ cell.day }}</text>
				<view v-if="cell.has" class="dot" />
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiAiHistory } from '@/api/ai.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const VIEW_DATE_KEY = 'selah_ai_view_date'
const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const cursor = ref(startOfMonth(new Date()))
const selected = ref(isoDate(new Date()))
const dated = ref({})
const datesReady = ref(false)

const dows = computed(() => [
	t('dow_su'), t('dow_mo'), t('dow_tu'), t('dow_we'), t('dow_th'), t('dow_fr'), t('dow_sa'),
])
const monthLabel = computed(() => {
	const d = cursor.value
	return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
})
const canShiftNext = computed(() => {
	const now = new Date()
	const d = cursor.value
	return d.getFullYear() < now.getFullYear()
		|| (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth())
})
const cells = computed(() => {
	const first = cursor.value
	const year = first.getFullYear()
	const month = first.getMonth()
	const startWeek = new Date(year, month, 1).getDay()
	const lastDate = new Date(year, month + 1, 0).getDate()
	const today = isoDate(new Date())
	const out = []
	for (let i = 0; i < startWeek; i += 1) {
		out.push({ iso: '', day: 0, has: false, muted: false, clickable: false })
	}
	for (let d = 1; d <= lastDate; d += 1) {
		const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
		const has = !!dated.value[iso]
		const muted = iso > today || (datesReady.value && !has)
		out.push({
			iso,
			day: d,
			has,
			muted,
			clickable: has && iso <= today,
		})
	}
	return out
})

function startOfMonth(d) {
	return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isoDate(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseIso(iso) {
	const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (!m) return null
	return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function shiftMonth(delta) {
	if (delta > 0 && !canShiftNext.value) return
	const d = cursor.value
	cursor.value = new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

async function bootstrap() {
	const today = isoDate(new Date())
	const res = await apiAiHistory(today)
	const data = res.results || {}
	const map = {}
	;(data.dates || []).forEach((iso) => { map[iso] = true })
	if ((data.messages || []).length) map[today] = true
	dated.value = map
	datesReady.value = true
}

function pickDay(cell) {
	if (!cell || !cell.clickable) return
	try { uni.setStorageSync(VIEW_DATE_KEY, cell.iso) } catch (e) {}
	selected.value = cell.iso
	safeBack('/pages/ai/ai')
}

function goBack() {
	safeBack('/pages/ai/ai')
}

function applyStoredDate() {
	try {
		const stored = uni.getStorageSync(VIEW_DATE_KEY)
		if (!stored) return
		selected.value = String(stored)
		const d = parseIso(stored)
		if (d) cursor.value = startOfMonth(d)
	} catch (e) {}
}

onMounted(() => {
	applyStoredDate()
	bootstrap()
})
onShow(() => {
	applyStoredDate()
	if (!Object.keys(dated.value).length) bootstrap()
})
</script>

<style scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head { @include selah-sticky-head; }
.head-glass { @include selah-sticky-head-glass($selah-bg-gray); }
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
}
.nav-pill { @include selah-nav-circle; }
.nav-ico { width: 48rpx; height: 48rpx; }
.nav-title { @include selah-display-title; font-size: 34rpx; }
.nav-spacer { width: 88rpx; height: 88rpx; }
.month-bar {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 12rpx 8rpx 20rpx;
}
.month-label {
	font-family: $selah-font-display;
	font-size: 36rpx;
	font-weight: 700;
}
.month-nav {
	width: 64rpx;
	text-align: center;
	font-size: 48rpx;
	color: $selah-muted;
}
.dow-row {
	display: flex;
	flex-direction: row;
	padding: 0 0 8rpx;
}
.dow {
	width: 14.28%;
	text-align: center;
	font-size: 22rpx;
	color: $selah-muted;
}
.grid {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
}
.cell {
	width: 14.28%;
	height: 88rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	position: relative;
}
.cell-num { font-size: 26rpx; color: $selah-ink; }
.cell.muted {
	pointer-events: none;
}
.cell.muted .cell-num { color: $selah-muted; opacity: 0.4; }
.cell.on,
.cell-press {
	background: rgba(25, 25, 25, 0.08);
	border-radius: 20rpx;
}
.dot {
	width: 8rpx;
	height: 8rpx;
	margin-top: 4rpx;
	border-radius: 999rpx;
	background: $selah-ink;
}
</style>
