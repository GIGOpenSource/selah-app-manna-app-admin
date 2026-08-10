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
				<view class="nav-pill" @tap.stop="go('/pagesA/settings/settings')">
					<image class="nav-ico" src="/static/ui/ico-settings.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="title-spacer" :style="spacerStyle" />
			<text class="page-title" :style="titleStyle">{{ t('profile') }}</text>
		</view>

		<view class="vip-card" @click="goVipBanner" v-if="user.vip_level === 'free'">
			<view class="vip-copy">
				<text class="vip-title">{{ t('unlock_all') }}</text>
				<text class="vip-desc">{{ t('unlock_all_body') }}</text>
			</view>
			<image class="vip-art" src="/static/ui/art-dove.png" mode="aspectFit" />
		</view>

		<view class="streak card">
			<view class="streak-badge" @click="go('/pagesA/checkin/checkin')">
				<view class="streak-ring" />
				<text class="streak-num">{{ user.checkin_streak || 0 }}</text>
			</view>
			<view class="streak-body">
				<view class="streak-top">
					<text class="streak-label" @click="go('/pagesA/checkin/checkin')">{{ t('your_streak') }}</text>
					<view class="streak-actions">
						<!-- Figma 9:1024 share · 9:1031 more（圆框三点 SVG，禁止文字 ···） -->
						<view class="streak-act" @tap.stop="shareStreak">
							<image
								class="streak-act-ico"
								src="/static/ui/ico-share.svg"
								mode="aspectFit"
							/>
						</view>
						<view class="streak-act" @tap.stop="go('/pagesA/checkin/checkin')">
							<image
								class="streak-act-ico"
								src="/static/ui/ico-more.svg"
								mode="aspectFit"
							/>
						</view>
					</view>
				</view>
				<view class="week" @click="go('/pagesA/checkin/checkin')">
					<view v-for="(d, i) in weekDays" :key="d.date || i" class="day-col">
						<text class="dow">{{ dowLabels[i] }}</text>
						<view class="day" :class="d.state">
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
import { getUser } from '@/utils/session.js'
import { track } from '@/utils/analytics.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { goVip } from '@/utils/vip.js'
import { guardFeatureOrPray } from '@/utils/prayerLock.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle, spacerStyle } = useCollapsingTitle({
	mode: 'hero',
	statusBarPx,
	fontStartRpx: 56,
	fontEndRpx: 34,
	titleBlockRpx: 80,
})
const user = ref(getUser())
const week = ref([])
const dowLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** 与 Figma Customize 顺序一致；3.0 增 Compose / 真 Widget·Icon */
const customizeItems = [
	{
		key: 'compose',
		labelKey: 'compose_entry',
		art: '/static/ui/grid-affirmations.png',
		url: '/pagesA/compose/compose',
	},
	{
		key: 'topics',
		labelKey: 'topics_you_follow',
		art: '/static/ui/grid-topics.png',
		url: '/pagesA/topics/topics?mode=followed',
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
		url: '/pagesA/widgets/widgets?from=profile&kind=home',
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

const weekDays = computed(() => {
	const w = week.value || []
	if (w.length) return w
	return dowLabels.map(() => ({ date: '', state: '' }))
})

const go = (url) => uni.navigateTo({ url })
const goHome = () => {
	uni.switchTab({ url: '/pages/home/home' })
}

function shareStreak() {
	const days = user.value.checkin_streak || 0
	uni.navigateTo({ url: `/pagesA/share/share?mode=streak&days=${days}` })
}

function goVipBanner() {
	track('home_enter_vip', { pay_trigger_source: 'personal_banner' })
	goVip('personal_banner')
}

function onQuizStart() {
	if (guardFeatureOrPray('quiz', t)) return
	track('quiz_start', { scene: 'profile', available: true })
	go('/pagesA/quiz/quiz')
}

function onCustomize(item) {
	track('profile_customize_tap', { key: item.key })
	if (item.soon) {
		uni.showToast({ title: t('teaser_coming'), icon: 'none' })
		return
	}
	if (item.key !== 'prayer_lock' && guardFeatureOrPray(item.key, t)) return
	if (item.url) go(item.url)
}

async function refresh() {
	hideNativeTabBar()
	user.value = getUser()
	try {
		const res = await apiCheckinStatus()
		week.value = res.results.week || []
	} catch (e) {}
}

onShow(refresh)
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
.title-spacer {
	position: relative;
	z-index: 0;
	pointer-events: none;
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
.day {
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	background: #f0ebe3;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 20rpx;
	color: #fff;
}
.day.checked {
	background: $selah-ink;
}
.day.frozen {
	background: $selah-accent;
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
	/* Figma 9:1178 卡 168×127 / pad 12 / 图标 Mask 70×70 / 与文案间距 11 */
	width: 336rpx;
	height: 254rpx;
	background: $selah-card;
	border-radius: 32rpx;
	padding: 24rpx;
	margin-bottom: 16rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.03);
}
.grid-art {
	/* Figma Mask group 70×70 → 140rpx；资源已紧裁铺满 */
	width: 140rpx;
	height: 140rpx;
	margin-top: 10rpx;
	margin-bottom: 22rpx;
	display: block;
	flex-shrink: 0;
}
.grid-label {
	font-size: 28rpx;
	color: $selah-ink;
	text-align: center;
	line-height: 1.2;
}
</style>
