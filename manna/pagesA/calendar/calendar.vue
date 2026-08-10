<template>
	<!-- 成长日历：peach 轻壳，对齐 Me / Stories -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('me_calendar') }}</text>
			<view class="nav__spacer" />
		</view>

		<view class="card">
			<view class="month">
				<view class="month__btn" hover-class="nav__press" @click="shiftMonth(-1)">
					<text class="month__chev">‹</text>
				</view>
				<text class="month__lab">{{ monthLabel }}</text>
				<view class="month__btn" hover-class="nav__press" @click="shiftMonth(1)">
					<text class="month__chev">›</text>
				</view>
			</view>

			<view class="week">
				<text v-for="w in weekLabels" :key="w" class="week__d">{{ w }}</text>
			</view>

			<view class="grid">
				<view v-for="n in padStart" :key="'pad-' + n" class="cell cell--pad" />
				<view
					v-for="d in days"
					:key="d.date"
					class="cell"
					:class="{
						'cell--on': d.active,
						'cell--today': d.isToday,
						'cell--sel': selected === d.date,
					}"
					hover-class="cell--press"
					@click="selectDay(d)"
				>
					<text class="cell__n">{{ d.day }}</text>
					<view v-if="d.active" class="cell__dot" />
				</view>
			</view>

			<view class="legend">
				<view class="legend__item">
					<view class="legend__dot legend__dot--on" />
					<text class="legend__txt">{{ t('calendar_legend_active') }}</text>
				</view>
				<view class="legend__item">
					<view class="legend__ring" />
					<text class="legend__txt">{{ t('calendar_legend_today') }}</text>
				</view>
			</view>
		</view>

		<view v-if="selectedMeta" class="card detail">
			<text class="detail__date">{{ selectedMeta.date }}</text>
			<view class="detail__row">
				<text class="detail__lab">{{ t('stat_pray') }}</text>
				<text class="detail__val">{{ formatMin(selectedMeta.pray_sec) }}</text>
			</view>
			<view class="detail__row">
				<text class="detail__lab">{{ t('stat_devotion') }}</text>
				<text class="detail__val">{{ formatMin(selectedMeta.devotion_sec) }}</text>
			</view>
			<view class="detail__row">
				<text class="detail__lab">{{ t('stat_read') }}</text>
				<text class="detail__val">{{ formatMin(selectedMeta.read_sec) }}</text>
			</view>
			<view class="detail__row">
				<text class="detail__lab">{{ t('stat_quiz') }}</text>
				<text class="detail__val">{{ selectedMeta.quiz_count || 0 }}</text>
			</view>
			<text v-if="!selectedMeta.active" class="detail__empty">{{ t('calendar_day_empty') }}</text>
		</view>

		<text v-if="!loading && !days.length" class="empty">{{ t('calendar_empty') }}</text>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { t } from '@/i18n/index.js'
import { apiMannaCalendar, apiMannaCalendarDay } from '@/api/manna.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const days = ref([])
const loading = ref(false)
const selected = ref('')
const dayDetail = ref(null)

const weekLabels = computed(() => [
	t('calendar_week_mon'),
	t('calendar_week_tue'),
	t('calendar_week_wed'),
	t('calendar_week_thu'),
	t('calendar_week_fri'),
	t('calendar_week_sat'),
	t('calendar_week_sun'),
])

const monthLabel = computed(() => t('calendar_month', { y: year.value, m: month.value }))

/** 周一为首，空白格数量 */
const padStart = computed(() => {
	const wd = new Date(year.value, month.value - 1, 1).getDay() // 0=Sun
	return (wd + 6) % 7
})

const selectedMeta = computed(() => {
	if (dayDetail.value && dayDetail.value.date === selected.value) return dayDetail.value
	return days.value.find((d) => d.date === selected.value) || null
})

function formatMin(sec) {
	const s = Number(sec) || 0
	const m = Math.round(s / 60)
	return t('calendar_minutes', { n: m })
}

function todayKey() {
	const d = new Date()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${d.getFullYear()}-${m}-${day}`
}

async function load() {
	loading.value = true
	try {
		const res = await apiMannaCalendar({ year: year.value, month: month.value })
		const r = res?.results || {}
		const list = r.days || []
		const today = todayKey()
		days.value = list.map((x) => {
			const date = x.date || ''
			return {
				date,
				day: String(Number((date || '').slice(-2) || x.day || '')),
				active: !!(x.active || x.has_activity || x.amen),
				isToday: date === today,
				pray_sec: Number(x.pray_sec) || 0,
				devotion_sec: Number(x.devotion_sec) || 0,
				read_sec: Number(x.read_sec) || 0,
				quiz_count: Number(x.quiz_count) || 0,
			}
		})
		if (r.year) year.value = Number(r.year) || year.value
		if (r.month) month.value = Number(r.month) || month.value
		const prefer = days.value.find((d) => d.isToday) || days.value.find((d) => d.active)
		selected.value = prefer?.date || days.value[0]?.date || ''
	} catch (e) {
		days.value = []
		selected.value = ''
	} finally {
		loading.value = false
	}
}

function shiftMonth(delta) {
	let y = year.value
	let m = month.value + delta
	if (m < 1) {
		m = 12
		y -= 1
	} else if (m > 12) {
		m = 1
		y += 1
	}
	year.value = y
	month.value = m
	load()
}

async function selectDay(d) {
	if (!d?.date) return
	selected.value = d.date
	dayDetail.value = { ...d }
	try {
		const res = await apiMannaCalendarDay({ date: d.date })
		const row = res?.results || {}
		if (row && (row.date || row.pray_sec != null || row.quiz_count != null)) {
			dayDetail.value = {
				...d,
				...row,
				date: row.date || d.date,
				active: !!(row.active ?? d.active ?? (row.pray_sec || row.devotion_sec || row.read_sec || row.quiz_count)),
			}
		}
	} catch (e) {
		/* 月历已有点位即可；日详情失败保留月数据 */
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onMounted(load)
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	padding: 24rpx 40rpx 80rpx;
	box-sizing: border-box;
	@include manna-peach-page;
}

.nav {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-bottom: 28rpx;
}

.nav__back {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.72);
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav__back-ico {
	width: 48rpx;
	height: 48rpx;
}

.nav__press { opacity: 0.7; }

.nav__title {
	flex: 1;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 36rpx;
	color: $manna-btn-text;
	text-align: center;
}

.nav__spacer { width: 64rpx; }

.card {
	@include manna-white-card;
	padding: 28rpx 24rpx 32rpx;
	margin-bottom: 20rpx;
}

.month {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 8rpx 20rpx;
}

.month__btn {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: rgba(33, 33, 33, 0.05);
	display: flex;
	align-items: center;
	justify-content: center;
}

.month__chev {
	font-size: 40rpx;
	line-height: 1;
	color: $manna-btn-text;
}

.month__lab {
	font-family: $manna-font-serif;
	font-size: 34rpx;
	color: $manna-btn-text;
}

.week {
	display: flex;
	padding: 0 4rpx 8rpx;
}

.week__d {
	flex: 1;
	text-align: center;
	font-family: $manna-font-body;
	font-size: 22rpx;
	color: rgba(33, 33, 33, 0.4);
}

.grid {
	display: flex;
	flex-wrap: wrap;
}

.cell {
	width: 14.2857%;
	height: 88rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	position: relative;
	box-sizing: border-box;
}

.cell--pad { pointer-events: none; }

.cell__n {
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.55);
	line-height: 1.2;
}

.cell__dot {
	width: 10rpx;
	height: 10rpx;
	border-radius: 50%;
	background: $manna-tag-on;
	margin-top: 6rpx;
}

.cell--on .cell__n {
	color: $manna-btn-text;
	font-weight: 600;
}

.cell--today .cell__n {
	color: $manna-btn-text;
	font-weight: 700;
}

.cell--today::after {
	content: '';
	position: absolute;
	inset: 10rpx;
	border-radius: 50%;
	border: 2rpx solid rgba(33, 33, 33, 0.18);
	pointer-events: none;
}

.cell--sel {
	.cell__n { color: $manna-btn-text; font-weight: 700; }
}

.cell--sel::before {
	content: '';
	position: absolute;
	inset: 10rpx;
	border-radius: 50%;
	background: rgba(250, 208, 44, 0.28);
	pointer-events: none;
}

.cell--press { opacity: 0.75; }

.legend {
	display: flex;
	gap: 28rpx;
	justify-content: center;
	margin-top: 12rpx;
	padding-top: 16rpx;
	border-top: 1rpx solid rgba(33, 33, 33, 0.06);
}

.legend__item {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.legend__dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
}

.legend__dot--on { background: $manna-tag-on; }

.legend__ring {
	width: 20rpx;
	height: 20rpx;
	border-radius: 50%;
	border: 2rpx solid rgba(33, 33, 33, 0.22);
	box-sizing: border-box;
}

.legend__txt {
	font-family: $manna-font-body;
	font-size: 22rpx;
	color: rgba(33, 33, 33, 0.45);
}

.detail__date {
	display: block;
	font-family: $manna-font-serif;
	font-size: 32rpx;
	color: $manna-btn-text;
	margin-bottom: 16rpx;
}

.detail__row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 14rpx 0;
	border-bottom: 1rpx solid rgba(33, 33, 33, 0.06);
}

.detail__row:last-of-type { border-bottom: none; }

.detail__lab {
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.55);
}

.detail__val {
	font-family: $manna-font-body;
	font-weight: 600;
	font-size: 26rpx;
	color: $manna-btn-text;
}

.detail__empty {
	display: block;
	margin-top: 8rpx;
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.4);
}

.empty {
	display: block;
	margin-top: 48rpx;
	text-align: center;
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}
</style>
