<template>
	<!-- Bible Calendar：对齐 Figma — 祷告手印日历 + DONE/AMEN 任务 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="cross" aria-hidden="true">
			<view class="cross__v" />
			<view class="cross__h" />
		</view>

		<view class="nav">
			<view class="nav__back" hover-class="press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('me_calendar') }}</text>
			<view class="nav__spacer" />
		</view>

		<view class="card">
			<view class="month">
				<view class="month__btn" hover-class="press" @click="shiftMonth(-1)">
					<text class="month__chev">‹</text>
				</view>
				<text class="month__lab">{{ monthLabel }}</text>
				<view
					v-if="canNextMonth"
					class="month__btn"
					hover-class="press"
					@click="shiftMonth(1)"
				>
					<text class="month__chev">›</text>
				</view>
				<view v-else class="month__btn month__btn--ghost" />
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
						'cell--future': d.future,
					}"
					hover-class="press"
					@click="selectDay(d)"
				>
					<view class="cell__inner">
						<text class="cell__n">{{ d.day }}</text>
						<image
							class="cell__amen"
							:src="d.active || d.isToday || selected === d.date
								? '/static/ui/calendar/ico-amen-on.svg'
								: '/static/ui/calendar/ico-amen-muted.svg'"
							mode="aspectFit"
						/>
					</view>
				</view>
			</view>
		</view>

		<view v-if="selected && dayTasks.length" class="card tasks">
			<view
				v-for="task in dayTasks"
				:key="task.key"
				class="tasks__row"
			>
				<image class="tasks__ico" :src="task.icon" mode="aspectFit" />
				<text class="tasks__lab">{{ task.label }}</text>
				<view
					class="tasks__btn"
					:class="task.done ? 'tasks__btn--done' : 'tasks__btn--amen'"
					hover-class="press"
					@click="onTask(task)"
				>
					<image
						class="tasks__btn-ico"
						:src="task.done
							? '/static/ui/calendar/ico-check-white.svg'
							: '/static/ui/calendar/ico-amen-white.svg'"
						mode="aspectFit"
					/>
					<text class="tasks__btn-txt">{{ task.done ? t('calendar_btn_done') : t('calendar_btn_amen') }}</text>
				</view>
			</view>
		</view>

		<text v-if="!loading && !days.length" class="empty">{{ t('calendar_empty') }}</text>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaCalendar, apiMannaCalendarDay } from '@/api/manna.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { isCalendarTaskDone, periodKind } from '@/utils/dayPeriod.js'
import { openQuizPlayDirect } from '@/utils/quizAttempt.js'
import { apiBibleChapter } from '@/api/bible.js'

const statusBar = getStatusBarPx()
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const days = ref([])
const loading = ref(false)
const selected = ref('')
const dayDetail = ref(null)
const isRead = ref(false)
/** 周日为首，对齐稿 */
const weekLabels = computed(() => [
	t('calendar_week_sun'),
	t('calendar_week_mon'),
	t('calendar_week_tue'),
	t('calendar_week_wed'),
	t('calendar_week_thu'),
	t('calendar_week_fri'),
	t('calendar_week_sat'),
])

const monthLabel = computed(() => t('calendar_month', { y: year.value, m: month.value }))

const canNextMonth = computed(() => {
	const t0 = todayParts()
	return year.value < t0.y || (year.value === t0.y && month.value < t0.m)
})

/** 周日为首的空白格 */
const padStart = computed(() => new Date(year.value, month.value - 1, 1).getDay())

const selectedMeta = computed(() => {
	if (dayDetail.value && dayDetail.value.date === selected.value) return dayDetail.value
	return days.value.find((d) => d.date === selected.value) || null
})

const dayTasks = computed(() => {
	const m = selectedMeta.value
	if (!m?.date) return []
	// 晨/晚祷：本地完成标记；灵修：任意一课（devotion_sec）；读经 ≥60s；测验有次数
	return [
		{
			key: 'morning',
			label: t('calendar_task_morning'),
			icon: '/static/ui/prayer/ico-sun.png',
			// 改这里
			done: isCalendarTaskDone('morning', m.date),
			path: '/pagesA/prayer/prayer?kind=morning',
			tab: false,
		},
		{
			key: 'night',
			label: t('calendar_task_night'),
			icon: '/static/ui/prayer/ico-moon.png',
			done: isCalendarTaskDone('night', m.date),
			path: '/pagesA/prayer/prayer?kind=night',
			tab: false,
		},
		{
			key: 'devotion',
			label: t('calendar_task_devotion'),
			icon: '/static/ui/me/dao.png',
			done: (Number(m.devotion_sec) || 0) > 0,
			path: '/pages/devotion/list',
			tab: true,
		},
		{
			key: 'bible',
			label: t('calendar_task_bible'),
			icon: '/static/ui/me/bible.png',
			done: (Number(m.read_sec) || 0) >= 60,
			path: '/pages/bible/bible',
			tab: true,
		},
		{
			key: 'quiz',
			label: t('calendar_task_quiz'),
			icon: '/static/ui/me/quiz.png',
			done: (Number(m.quiz_count) || 0) > 0,
			path: '/pages/quiz/quiz',
			tab: true,
		},
	]
})

function onTask(task) {
	if (!task || task.done) return
	// 晚祷仅 18:00–05:59 可开；非时段直接 toast，不进页
	if (task.key === 'night' && periodKind() !== 'night') {
		uni.showToast({ title: t('calendar_prayer_night_locked'), icon: 'none' })
		return
	}
	if (task.key === 'quiz') {
		openQuizPlayDirect().catch(() => {})
		return
	}
	if (task.tab) {
		uni.switchTab({ url: task.path })
		return
	}
	uni.navigateTo({ url: task.path })
}

function todayKey() {
	const d = new Date()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${d.getFullYear()}-${m}-${day}`
}

function todayParts() {
	const d = new Date()
	return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}

function pad2(n) {
	return String(n).padStart(2, '0')
}

function dateKey(y, m, d) {
	return `${y}-${pad2(m)}-${pad2(d)}`
}

function isFutureMonth(y, m) {
	const t0 = todayParts()
	return y > t0.y || (y === t0.y && m > t0.m)
}

function lastDayOfMonth(y, m) {
	return new Date(y, m, 0).getDate()
}

function pickKeepDate(keepDay) {
	const today = todayKey()
	const t0 = todayParts()
	const last = lastDayOfMonth(year.value, month.value)
	let day = Math.min(Math.max(1, Number(keepDay) || t0.d), last)
	let key = dateKey(year.value, month.value, day)
	if (key > today) {
		key = (year.value === t0.y && month.value === t0.m)
			? today
			: (days.value.filter((d) => d.date && d.date <= today).pop()?.date || '')
	}
	if (days.value.some((d) => d.date === key)) return key
	const n = Number(String(key).slice(-2)) || day
	const same = days.value.find((x) => Number(x.day) === n && x.date <= today)
	if (same) return same.date
	const past = days.value.filter((d) => d.date && d.date <= today)
	return past[past.length - 1]?.date || days.value[0]?.date || key
}

async function load({ keepDay } = {}) {
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
				active: !!x.active,
				isToday: date === today,
				future: !!date && date > today,
				pray_sec: Number(x.pray_sec) || 0,
				devotion_sec: Number(x.devotion_sec) || 0,
				read_sec: Number(x.read_sec) || 0,
				quiz_count: Number(x.quiz_count) || 0,
			}
		})
		console.log(days.value,'days.value')
		if (r.year) year.value = Number(r.year) || year.value
		if (r.month) month.value = Number(r.month) || month.value
		const fromSelected = Number(String(selected.value || '').slice(-2)) || 0
		const dayNum = Number(keepDay) || fromSelected || todayParts().d
		selected.value = pickKeepDate(dayNum)
		const hit = days.value.find((d) => d.date === selected.value)
		if (hit) selectDay(hit)
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
	if (isFutureMonth(y, m)) return
	const keepDay = Number(String(selected.value || '').slice(-2)) || todayParts().d
	year.value = y
	month.value = m
	load({ keepDay })
}

async function selectDay(d) {
	if (!d?.date || d.future || d.date > todayKey()) return
	selected.value = d.date
	// console.log(d,'d')
	dayDetail.value = { ...d }
	try {
		const res = await apiMannaCalendarDay({ date: d.date })
		const row = res?.results || {}
		if (row && (row.date || row.pray_sec != null || row.quiz_count != null)) {
			dayDetail.value = {
				...d,
				...row,
				date: row.date || d.date,
				active: row.active != null
					? !!row.active
					: !!(
						(Number(row.pray_sec) || 0) > 0
						|| (Number(row.devotion_sec) || 0) > 0
						|| (Number(isRead.value) || 0) >= 60
						|| (Number(row.quiz_count) || 0) > 0
					),
			}
		}
		console.log(dayDetail.value,'dayDetail.value')
	} catch (e) {
		/* 月历已有点位即可 */
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}
onLoad(async () => {
	const res = await apiBibleChapter({ translation : 'web' , book : 'genesis' , chapter : 1 })
	isRead.value = res?. results ?. chapter_done || false
	console.log(isRead.value,'isRead.value')
})
onMounted(load)
onShow(load)
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

$cal-green: #52aa4b;
$cal-amen: #c47a5a;

.page {
	position: relative;
	min-height: 100vh;
	padding: 8rpx 40rpx 80rpx;
	box-sizing: border-box;
	@include manna-peach-page;
	overflow: hidden;
}

.cross {
	position: absolute;
	right: 24rpx;
	top: 72rpx;
	width: 192rpx;
	height: 288rpx;
	pointer-events: none;
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

.nav {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	margin-bottom: 20rpx;
}
.nav__back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}
.nav__back-ico { width: 48rpx; height: 48rpx; }
.nav__title {
	flex: 1;
	@include manna-nav-title;
	margin-left: 4rpx;
}
.nav__spacer { width: 64rpx; }

.card {
	position: relative;
	z-index: 1;
	@include manna-white-card;
	padding: 28rpx 20rpx 32rpx;
	margin-bottom: 24rpx;
}

.month {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 8rpx 20rpx;
}
.month__btn {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	background: rgba(33, 33, 33, 0.05);
	display: flex;
	align-items: center;
	justify-content: center;
}
.month__btn--ghost {
	background: transparent;
	pointer-events: none;
}
.month__chev {
	font-size: 36rpx;
	line-height: 1;
	color: $manna-btn-text;
	/* ‹ › 字形视觉偏下，上移以光学居中 */
	transform: translateY(-4rpx);
	display: block;
}
.month__lab {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 30rpx;
	color: $manna-btn-text;
}

.week {
	display: flex;
	padding: 0 4rpx 12rpx;
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
	height: 100rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.cell--pad { pointer-events: none; }

.cell__inner {
	width: 72rpx;
	height: 88rpx;
	border-radius: 16rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.cell__n {
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
	line-height: 1.15;
	font-weight: 500;
}

.cell__amen {
	width: 28rpx;
	height: 28rpx;
	margin-top: 4rpx;
}

.cell--on .cell__n {
	color: $manna-btn-text;
	font-weight: 600;
}

.cell--today .cell__inner,
.cell--sel .cell__inner {
	background: $manna-tag-on;
}
.cell--today .cell__n,
.cell--sel .cell__n {
	color: $manna-btn-text;
	font-weight: 700;
}

.cell--future {
	pointer-events: none;
}
.cell--future .cell__n {
	color: rgba(33, 33, 33, 0.2);
	font-weight: 400;
}
.cell--future .cell__amen {
	opacity: 0.35;
}

.tasks {
	padding: 8rpx 24rpx;
}
.tasks__row {
	display: flex;
	align-items: center;
	padding: 22rpx 0;
	border-bottom: 1rpx solid rgba(33, 33, 33, 0.06);
}
.tasks__row:last-child {
	border-bottom: none;
}
.tasks__ico {
	width: 48rpx;
	height: 48rpx;
	flex-shrink: 0;
	margin-right: 20rpx;
}
.tasks__lab {
	flex: 1;
	min-width: 0;
	font-family: $manna-font-body;
	font-size: 28rpx;
	font-weight: 600;
	color: $manna-btn-text;
}
.tasks__btn {
	height: 56rpx;
	padding: 0 22rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	flex-shrink: 0;
}
.tasks__btn--done {
	background: $cal-green;
}
.tasks__btn--amen {
	background: $cal-amen;
}
.tasks__btn-ico {
	width: 28rpx;
	height: 28rpx;
	margin-right: 8rpx;
}
.tasks__btn-txt {
	font-family: $manna-font-body;
	font-size: 22rpx;
	font-weight: 700;
	color: #ffffff;
	letter-spacing: 0.5rpx;
}

.empty {
	display: block;
	margin-top: 48rpx;
	text-align: center;
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}

.press { opacity: 0.78; }
</style>
