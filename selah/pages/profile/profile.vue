<!--
  个人中心：对齐 Figma 8:860
  https://www.figma.com/design/8HrsHSUQG2WbBfEdBzLHcx/Selah?node-id=8-860
  Customize 含 Compose / Widget / Icon / Prayer lock / Alarm 真入口；Watch 不可达态。
  喜欢/收藏/历史/肯定语入口在设置页「我的内容」。
-->
<template>
	<view class="profile">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goHome">
					<image class="nav-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
				</view>
				<text class="page-title nav-title" :style="titleStyle">{{ t('profile') }}</text>
				<view class="nav-pill" @tap.stop="onSettings">
					<image class="nav-ico" src="/static/ui/ico-settings.svg" mode="aspectFit" />
				</view>
			</view>
		</view>
		<text class="hero-title" :style="heroTitleStyle">{{ t('profile') }}</text>

		<view class="vip-card" :class="{ 'vip-card--on': vipOn }" @click="goVipBanner">
			<view class="vip-copy">
				<text class="vip-title">{{ vipTitle }}</text>
				<text class="vip-desc">{{ vipDesc }}</text>
			</view>
			<image class="vip-art" src="/static/ui/art-dove.png" mode="aspectFit" />
		</view>

		<view class="streak card">
			<view class="streak-badge" @click="goCheckin">
				<view class="streak-ring" />
				<text class="streak-num">{{ streakDays || user.checkin_streak || 0 }}</text>
			</view>
			<view class="streak-body">
				<view class="streak-top">
					<text class="streak-label" @click="goCheckin">{{ t('your_streak') }}</text>
					<view class="streak-actions">
						<!-- Figma 9:1024 share · 9:1031 more（圆框三点 SVG，禁止文字 ···） -->
						<view class="streak-act" @tap.stop="shareStreak">
							<image
								class="streak-act-ico"
								src="/static/ui/ico-share.svg"
								mode="aspectFit"
							/>
						</view>
						<view class="streak-act" @tap.stop="goCheckin">
							<image
								class="streak-act-ico"
								src="/static/ui/ico-more.svg"
								mode="aspectFit"
							/>
						</view>
					</view>
				</view>
				<view class="week" @click="goCheckin">
					<view v-for="(d, i) in weekDays" :key="d.date || i" class="day-col">
						<text class="dow" :class="{ on: d.state === 'checked' || d.state === 'frozen' || d.is_today }">{{ d.label || dowLabels[i] }}</text>
						<view class="day" :class="[d.state || 'empty', { today: d.is_today }]">
							<text v-if="d.state === 'checked'">✓</text>
							<text v-else-if="d.state === 'frozen'">❄</text>
						</view>
					</view>
				</view>
			</view>
		</view>

		<view class="quiz card">
			<view class="quiz-copy">
				<text class="quiz-title">{{ t('bible_quiz') }}</text>
				<text class="quiz-desc">{{ t('bible_quiz_body') }}</text>
				<view class="quiz-cta" @tap="onQuizStart">
					<text class="quiz-cta-text">{{ t('bible_quiz_start') }}</text>
				</view>
			</view>
			<image class="quiz-art" src="/static/ui/art-quiz.png" mode="aspectFit" />
		</view>

		<text class="section-title">{{ t('customize') }}</text>
		<view class="grid">
			<view
				v-for="item in customizeItems"
				:key="item.key"
				class="grid-item"
				@tap="onCustomize(item)"
			>
				<image class="grid-art" :src="item.art" mode="aspectFit" />
				<text class="grid-label">{{ t(item.labelKey) }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
/**
 * 我的页：Figma 8:860 结构；可跳转项走现有页，SCOPE 项 toast 即将支持。
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiCheckinStatus } from '@/api/checkin.js'
import { apiAppConfig } from '@/api/content.js'
import { apiAuthMe } from '@/api/auth.js'
import { getUser, setUser } from '@/utils/session.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { goTab } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { goVip, isVipActive } from '@/utils/vip.js'
import { guardFeatureOrPray } from '@/utils/prayerLock.js'
import { buildCalendarWeek, streakWeekLabels, resolveStreakDays } from '@/utils/streakWeek.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { openSharePage } from '@/utils/share.js'




const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle, heroTitleStyle } = useCollapsingTitle({
	mode: 'hero',
	statusBarPx,
	fontStartRpx: 56,
	fontEndRpx: 34,
	titleBlockRpx: 80,
})
const user = ref(getUser())
const apiWeek = ref([])
const streakDays = ref(0)
const watchEnabled = ref(true)

/** 与 Figma Customize 顺序一致；Watch 由 watch_enabled 控制 */
const CUSTOMIZE_ALL = [
	{
		key: 'topics',
		labelKey: 'profile_topics_you_follow',
		art: '/static/ui/grid-topics.png',
		url: '/pagesA/explore/follow?from=profile',
	},
	{
		key: 'wallpapers',
		labelKey: 'wallpapers',
		art: '/static/ui/grid-wallpaper.png',
		url: '/pagesA/wallpaper/wallpaper?mode=used',
	},
	{
		key: 'lock_widgets',
		labelKey: 'lock_screen_widgets',
		art: '/static/ui/grid-lock-widgets.png',
		url: '/pagesA/widgets/widgets?from=profile&kind=lock',
	},
	{
		key: 'home_widgets',
		labelKey: 'home_screen_widgets',
		art: '/static/ui/grid-widgets.png',
		url: '/pagesA/widgets/center?from=profile',
	},
	{
		key: 'reminders',
		labelKey: 'reminders',
		art: '/static/ui/grid-reminders.png',
		url: '/pagesA/reminders/reminders?from=profile',
	},
	{
		key: 'prayer_lock',
		labelKey: 'prayer_lock',
		art: '/static/ui/grid-prayer-lock.png',
		url: '/pagesA/prayer-lock/prayer-lock?from=profile',
	},
	{
		key: 'growth_pack',
		labelKey: 'growth_pack',
		art: '/static/ui/grid-bind.png',
		url: '/pagesA/growth-pack/growth-pack?from=profile',
	},
	{
		key: 'alarm',
		labelKey: 'alarm',
		art: '/static/ui/grid-alarm.png',
		url: '/pagesA/alarm/alarm?from=profile',
	},
	{
		key: 'watch',
		labelKey: 'watch',
		art: '/static/ui/grid-watch.png',
		url: '/pagesA/watch/watch',
	},
	{
		key: 'app_icon',
		labelKey: 'app_icon',
		art: '/static/ui/grid-app-icon.png',
		url: '/pagesA/icons/icons?from=profile',
	},
]

const customizeItems = computed(() => {
	return CUSTOMIZE_ALL.filter((item) => {
		if (item.key === 'growth_pack') return false
		return item.key !== 'watch' || watchEnabled.value
	})
})

const weekDays = computed(() => {
	const days = streakDays.value || user.value.checkin_streak || 0
	return buildCalendarWeek(days, apiWeek.value, streakWeekLabels(t))
})
const dowLabels = computed(() => streakWeekLabels(t))
const vipOn = computed(() => isVipActive(user.value))
const vipTitle = computed(() => {
	if (!vipOn.value) return t('unlock_all')
	const trial = user.value.is_trial ? ` ${t('vip_trial_tag')}` : ''
	return `${t('vip_member_title')}${trial}`
})
const vipDesc = computed(() => (vipOn.value ? t('vip_member_body') : t('unlock_all_body')))

const PROFILE_EVENTS = {
	topics: 'profile_topics_click',
	wallpapers: 'profile_wallpapers_click',
	home_widgets: 'profile_home_widget_click',
	reminders: 'profile_reminder_click',
	alarm: 'profile_alarm_click',
	app_icon: 'profile_appIcon_click',
}

const go = (url) => uni.navigateTo({ url })
const goHome = () => {
	try { logFirebaseEvent('profile_close_click') } catch (e) {}
	goTab('/pages/home/home')
}

function onSettings() {
	try { logFirebaseEvent('profile_settings_click') } catch (e) {}
	go('/pagesA/settings/settings')
}

function streakDaysNow() {
	return Number(streakDays.value || user.value.checkin_streak || 0)
}

function goCheckin() {
	try { logFirebaseEvent('profile_streakDetail_click', { streak_days: streakDaysNow() }) } catch (e) {}
	go('/pagesA/checkin/checkin')
}

function shareStreak() {
	const days = streakDaysNow()
	try { logFirebaseEvent('profile_streakDetail_share', { streak_days: days }) } catch (e) {}
	openSharePage({ mode: 'streak', days })
}

function goVipBanner() {
	if (vipOn.value) {
		goVip('personal_banner', { manage: true })
		return
	}
	goVip('personal_banner')
}

function onQuizStart() {
	if (guardFeatureOrPray('quiz', t)) return
	try { logFirebaseEvent('profile_quiz_click') } catch (e) {}
	go('/pagesA/quiz/quiz')
}

function onCustomize(item) {
	if (item.soon) {
		uni.showToast({ title: t('teaser_coming'), icon: 'none' })
		return
	}
	if (item.key !== 'prayer_lock' && guardFeatureOrPray(item.key, t)) return
	const eventName = PROFILE_EVENTS[item.key]
	if (eventName) {
		try { logFirebaseEvent(eventName) } catch (e) {}
	}
	if (item.url) go(item.url)
}

let checkinApplied = false

function applyCheckinStatus(res) {
	const data = (res && res.results) || {}
	apiWeek.value = data.week || []
	checkinApplied = true
	const days = resolveStreakDays(data, user.value.checkin_streak || 0)
	streakDays.value = days
	// 周历已勾选但 streak_days/用户字段仍为 0 时，回写会话，避免其它入口再显示 0
	if (days > 0 && Number(user.value.checkin_streak || 0) !== days) {
		const next = { ...user.value, checkin_streak: days }
		setUser(next)
		user.value = next
	}
}

async function refresh() {
	hideNativeTabBar()
	user.value = getUser()
	checkinApplied = false
	streakDays.value = Number(user.value.checkin_streak || 0)
	// 打卡周历不排队等资料和配置，进页立刻请求
	const checkinTask = apiCheckinStatus()
		.then(applyCheckinStatus)
		.catch(() => {})
	try {
		const me = await apiAuthMe()
		if (me && me.results) {
			setUser(me.results)
			user.value = me.results
			if (!checkinApplied) {
				streakDays.value = Number(user.value.checkin_streak || streakDays.value || 0)
			}
		}
	} catch (e) {}
	try {
		await loadWithCache(
			APP_CONFIG_KEY,
			async () => (await apiAppConfig()).results || {},
			(cfg) => {
				if (cfg && Object.prototype.hasOwnProperty.call(cfg, 'watch_enabled')) {
					watchEnabled.value = cfg.watch_enabled !== false
				}
			},
		)
	} catch (e) {}
	await checkinTask
}

onShow(() => {
	try { logFirebaseEvent('profile_show') } catch (e) {}
	refresh()
})
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.profile {
	min-height: 100vh;
	padding: 0 32rpx 140rpx;
	background: #ffffff;
	box-sizing: border-box;
}
.page-head {
	@include selah-sticky-head;
}
.head-glass {
	@include selah-sticky-head-glass(#ffffff);
}
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 0 0 8rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.page-title {
	@include selah-display-title;
}
.nav-title {
	/* 绝对定位由 titleStyle 控制；占位避免挤开两侧按钮 */
	flex: 1;
	text-align: center;
}
.hero-title {
	@include selah-display-title;
	display: block;
	font-size: 56rpx;
	line-height: 1.15;
	margin: 8rpx 0 24rpx;
	will-change: opacity, transform;
}
.nav-pill {
	@include selah-nav-circle;
	position: relative;
	z-index: 2;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.vip-card {
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 20rpx 20rpx 20rpx 32rpx;
	border-radius: 32rpx;
	margin-bottom: 16rpx;
	background: linear-gradient(90deg, #b6badf 0%, #ffffff 100%);
	overflow: hidden;
}
.vip-copy {
	flex: 1;
	padding-right: 12rpx;
}
.vip-title {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: $selah-ink;
	margin-bottom: 8rpx;
}
.vip-desc {
	display: block;
	font-size: 24rpx;
	color: $selah-ink;
	line-height: 1.35;
}
.vip-art {
	width: 160rpx;
	height: 160rpx;
	flex-shrink: 0;
	border-radius: 50%;
	overflow: hidden;
}
.card {
	padding: 32rpx;
	background: $selah-card;
	border-radius: 32rpx;
	margin-bottom: 16rpx;
	box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.04);
	box-sizing: border-box;
}
.streak.card {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.streak-badge {
	width: 140rpx;
	height: 140rpx;
	border-radius: 50%;
	background: linear-gradient(145deg, #cfa2ff, #fff3d3);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 24rpx;
	flex-shrink: 0;
	position: relative;
	box-shadow: 0 0 28rpx rgba(182, 186, 223, 0.55);
}
.streak-ring {
	position: absolute;
	inset: 6rpx;
	border-radius: 50%;
	border: 4rpx solid $selah-ink;
	box-sizing: border-box;
}
.streak-num {
	position: relative;
	z-index: 1;
	font-family: $selah-font-display;
	font-size: 44rpx;
	font-weight: 700;
	color: $selah-ink;
}
.streak-body {
	flex: 1;
	min-width: 0;
}
.streak-top {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16rpx;
}
.streak-label {
	font-size: 30rpx;
	font-weight: 600;
	color: $selah-ink;
}
.streak-actions {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.streak-act {
	/* Figma Frame 111：图标 20×20，间距 12 */
	width: 40rpx;
	height: 40rpx;
	margin-left: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.streak-act-ico {
	width: 40rpx;
	height: 40rpx;
}
.week {
	display: flex;
	flex-direction: row;
	direction: ltr;
	justify-content: space-between;
}
.day-col {
	display: flex;
	flex-direction: column;
	align-items: center;
}
.dow {
	font-size: 20rpx;
	color: $selah-muted;
	margin-bottom: 10rpx;
}
.dow.on { color: $selah-ink; font-weight: 600; }
.day {
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	background: transparent;
	border: 3rpx solid #e6e0d6;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 20rpx;
	color: #ffffff;
}
.day.checked {
	background: #f3b4c4;
	border-color: #f3b4c4;
}
.day.frozen {
	background: #cfcfcf;
	border-color: #cfcfcf;
}
.quiz.card {
	display: flex;
	flex-direction: row;
	align-items: center;
	min-height: 250rpx;
}
.quiz-copy {
	flex: 1;
	min-width: 0;
	padding-right: 16rpx;
}
.quiz-title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: $selah-ink;
	margin-bottom: 12rpx;
}
.quiz-desc {
	display: block;
	font-size: 24rpx;
	line-height: 1.35;
	color: $selah-ink;
	margin-bottom: 20rpx;
}
.quiz-cta {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 60rpx;
	padding: 0 16rpx;
	border-radius: 999rpx;
	background: $selah-ink;
}
.quiz-cta-text {
	font-size: 24rpx;
	font-weight: 600;
	color: #ffffff;
}
.quiz-art {
	width: 160rpx;
	height: 160rpx;
	flex-shrink: 0;
}
.section-title {
	display: block;
	@include selah-display-title;
	font-size: 36rpx;
	margin: 16rpx 0 16rpx;
}
.grid {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	justify-content: space-between;
}
.grid-item {
	/* 两列百分比宽，避免长文案语言下固定 336rpx 撑出屏外被裁切 */
	width: 48.5%;
	min-height: 254rpx;
	height: auto;
	background: $selah-card;
	border-radius: 32rpx;
	padding: 20rpx 16rpx 22rpx;
	margin-bottom: 16rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.03);
	overflow: hidden;
}
.grid-art {
	/* Figma Mask group 70×70 → 140rpx；资源已紧裁铺满 */
	width: 140rpx;
	height: 140rpx;
	margin-top: 8rpx;
	margin-bottom: 16rpx;
	display: block;
	flex-shrink: 0;
}
.grid-label {
	width: 100%;
	padding: 0 4rpx;
	box-sizing: border-box;
	font-size: 26rpx;
	color: $selah-ink;
	text-align: center;
	line-height: 1.3;
	/* 葡/德等长词换行，最多两行，避免与邻列挤在一起 */
	white-space: normal;
	overflow-wrap: break-word;
	word-break: break-word;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
}
</style>
