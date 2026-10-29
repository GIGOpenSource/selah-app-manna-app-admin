<!--
  首页 Feed：滑动语录、点赞/收藏/举报、壁纸背景、签到入口与新人引导。
-->
<template>
	<view :class="['home', bgVideoUrl ? 'has-dyn-bg' : '']">
		<image v-if="bgUrl && !bgVideoUrl" class="bg" :src="bgUrl" mode="aspectFill" @error="onBgError" />
		<video
			v-if="bgVideoUrl"
			id="homeBgVideo"
			class="bg bg-video"
			:src="bgVideoUrl"
			:autoplay="true"
			:loop="true"
			:muted="true"
			:controls="false"
			:playsinline="true"
			:show-center-play-btn="false"
			:show-play-btn="false"
			:show-fullscreen-btn="false"
			:show-mute-btn="false"
			:show-loading="false"
			:enable-progress-gesture="false"
			object-fit="cover"
			@error="onBgVideoError"
		/>
		<view class="veil" />

		<!-- 顶栏：稿 Status bar=62、侧钮 y=62；H5 用 getStatusBarPx 回落 62 -->
		<view class="top" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="top-left">
				<view class="glass-pill" @click.stop="goMe">
					<image class="pill-img" src="/static/ui/ico-profile.svg" mode="aspectFit" />
				</view>
				<view class="glass-pill" @click.stop="toggleHomeMusic">
					<image
						class="pill-img"
						:src="musicPlaying ? '/static/ui/ico-music-pause.svg' : '/static/ui/ico-music.svg'"
						mode="aspectFit"
					/>
				</view>
			</view>
			<!-- 点满后进度条消失，槽位仍占位，避免右侧图标被 flex 挤偏 -->
			<view class="progress-slot">
				<view
					v-if="showNewcomerProgress"
					class="progress-pill"
					@click.stop="openLikeSheet"
				>
					<image class="progress-ico" src="/static/ui/ico-like-on.svg" mode="aspectFit" />
					<text class="progress-num">{{ newcomer.current }}/{{ newcomer.goal }}</text>
					<view class="bar">
						<view class="bar-fill" :style="{ width: Math.min(100, (newcomer.goal ? newcomer.current / newcomer.goal * 100 : 0)) + '%' }" />
					</view>
				</view>
			</view>
			<view class="glass-pill" @click.stop="goVip('quote_home')">
				<image class="pill-img" src="/static/ui/ico-vip.svg" mode="aspectFit" />
			</view>
		</view>

		<swiper
			:key="feedSwiperKey"
			class="feed"
			vertical
			:current="current"
			:duration="280"
			:circular="false"
			:disable-touch="true"
			:style="{ backgroundColor: 'transparent' }"
			@change="onSwipe"
		>
			<swiper-item v-for="(q, idx) in list" :key="q.id">
				<view
					:class="['card', bgVideoUrl ? 'card-dyn' : '']"
					@touchstart="onFeedTouchStart"
					@touchmove.stop.prevent="onFeedTouchMove"
					@touchend="onFeedTouchEnd"
					@touchcancel="onFeedTouchEnd"
				>
					<image
						v-if="bgUrl && !bgVideoUrl"
						class="card-bg"
						:src="bgUrl"
						mode="aspectFill"
					/>
					<view v-if="!bgVideoUrl" class="card-veil" />
					<!-- 语录块：稿 Frame36 y=311/812 -->
					<view class="quote-block">
						<text class="quote">{{ q.content }}</text>
						<!-- <text v-if="q.source_ref" class="cite">-{{ q.source_ref }}</text> -->
					</view>
					<view v-if="q.locked" class="lock-hit">
						<view class="lock-hit-close" @click.stop="dismissLockHit">
							<image class="lock-hit-close-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
						</view>
						<view class="lock-hit-body" @click.stop="onLockTap">
							<text class="lock-hit-text">{{ t('vip_content') }}</text>
							<view class="lock-hit-cta-row">
								<text class="lock-hit-cta">{{ t('unlock_vip') }}</text>
								<image class="lock-hit-arrow" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
							</view>
						</view>
					</view>
					<view class="quote-hit" />
				</view>
			</swiper-item>
		</swiper>

		<selah-vip-lock
			v-if="vipLockOpen"
			mode="overlay"
			:pay-trigger-source="vipLockSource"
			:lock-content-id="activeQuote?.id || ''"
			@close="closeVipLock"
			@activated="onVipActivated"
		/>

		<!-- Share/Like：稿 Frame41 y=662；挂根层避免 swiper 裁切 -->
		<view v-if="activeQuote && !activeQuote.locked" class="mid-actions">
			<view class="icon-btn" @click.stop="goShare(activeQuote)">
				<image class="act-img" src="/static/ui/ico-share.svg" mode="aspectFit" />
			</view>
			<view class="icon-btn" :class="{ liked: isActiveLiked }" @click.stop="toggleLike(activeQuote)">
				<!-- App 端仅改 :src 常不刷新，按态拆开两个 image -->
				<image
					v-if="isActiveLiked"
					:key="'like-on-' + activeQuote.id + '-' + likeTick"
					class="act-img"
					src="/static/ui/ico-like-on.svg"
					mode="aspectFit"
				/>
				<image
					v-else
					:key="'like-off-' + activeQuote.id + '-' + likeTick"
					class="act-img"
					src="/static/ui/ico-like.svg"
					mode="aspectFit"
				/>
			</view>
		</view>

		<!-- Dock：稿 y=734 -->
		<view class="dock">
			<view class="glass-pill" @click.stop="onTopicsClick">
				<image class="pill-img" src="/static/ui/ico-star.svg" mode="aspectFit" />
			</view>
			<view class="glass-pill prayer" @click.stop="goAi">
				<image class="pill-img" src="/static/ui/ico-prayer.svg" mode="aspectFit" />
				<text class="prayer-text">{{ t('prayer') }}</text>
			</view>
			<view class="glass-pill" @click.stop="onThemesClick">
				<image class="pill-img" src="/static/ui/ico-paint.svg" mode="aspectFit" />
			</view>
		</view>

		<!-- 新人任务说明（不用 u-popup：离线打包易失效） -->
		<selah-dialog
			v-model:visible="showLikeSheet"
			:title="newcomerTitle"
			:content="newcomerDesc"
			:confirm-text="t('got_it')"
			:show-cancel="false"
			@confirm="onLikeSheetConfirm"
			@cancel="onLikeSheetDismiss"
		/>

		<!-- 打卡弹层 -->
		<selah-dialog
			:visible="!!checkinPopup"
			:title="(checkinPopup && checkinPopup.title) || ''"
			:content="(checkinPopup && checkinPopup.subtitle) || ''"
			:confirm-text="(checkinPopup && checkinPopup.cta) || t('got_it')"
			:show-cancel="false"
			:extra="checkinDialogExtra"
			@update:visible="onCheckinPopupVisible"
			@confirm="onCheckinContinue"
			@cancel="checkinPopup = null"
		/>

		<selah-widget-nudge
			:visible="widgetNudgeOpen"
			:quote="(activeQuote && activeQuote.content) || ''"
			@learn="onWidgetLearn"
			@dismiss="closeWidgetNudge"
		/>
		<selah-discount-nudge
			:visible="discountNudgeOpen"
			@continue="onDiscountContinue"
			@dismiss="closeDiscountNudge"
			@activated="onDiscountActivated"
		/>

		<!-- 完成动效 -->
		<view v-if="showComplete" class="complete-toast">
			<text>{{ newcomerCongrats }}</text>
		</view>
		<!-- 喜欢爆发 -->
		<view v-if="burstShow" class="burst">
			<text class="burst-heart">♥</text>
		</view>
		<selah-deletion-prompt />
	</view>
</template>

<script setup>
/**
 * 首页 Feed：预取/缓存、新人点赞进度、VIP 遮罩、签到弹窗、朗读与举报。
 */
import { onMounted, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiAppConfig } from '@/api/content.js'
import { ensureLogin, getUser, shouldForceLoginPage, hasLocalSession } from '@/utils/session.js'
import { readPageCache, loadWithCache } from '@/utils/pageCache.js'
import { peekHomeForceQuote, consumeHomeForceQuote, getHomeFeedTopicId } from '@/utils/homeFeedSync.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { APP_CONFIG_KEY, playWallpaperVideo } from '@/utils/wallpaperCache.js'
import { appConfigRevision } from '@/utils/bootstrap.js'
import { useHomeFeed } from './useHomeFeed.js'
import { useHomeLikeSheet } from './useHomeLikeSheet.js'
import { useHomeCheckin } from './useHomeCheckin.js'
import { useHomePopups } from './useHomePopups.js'
import { useHomeMusic } from './useHomeMusic.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { musicPlaying, toggleHomeMusic } = useHomeMusic({ t })

/** 跨 composable 回填：newcomer / applyNewcomer / checkinPopup */
const deps = {}

const feed = useHomeFeed({ t, deps })
const {
	HOME_CACHE_KEY,
	list,
	current,
	feedSwiperKey,
	liked,
	likeTick,
	user,
	bgUrl,
	bgVideoUrl,
	config,
	activeQuote,
	isActiveLiked,
	quoteLiked,
	applyHomeCache,
	persistHomeCache,
	overlayPendingLikes,
	syncHomeLikesForAccount,
	go,
	goAi,
	goMe,
	goVip,
	onLockTap,
	dismissLockHit,
	vipLockOpen,
	vipLockSource,
	closeVipLock,
	onVipActivated,
	handleVipDismissCooldown,
	goShare,
	pauseFeedRead,
	settleFeedRead,
	resumeFeedRead,
	exposeActiveQuote,
	loadFeed,
	homeFeedNeedsReload,
	keepHomeLook,
	reloadHomeFeedIfStale,
	hydratePinnedTopicQuotes,
	silentPrefetchFeed,
	onFeedTouchStart,
	onFeedTouchMove,
	onFeedTouchEnd,
	onSwipe,
	applyWallpaper,
	onBgError,
	onBgVideoError,
} = feed

function onTopicsClick() {
	try { logFirebaseEvent('home_topics_click') } catch (e) {}
	go('/pagesA/explore/explore')
}

function onThemesClick() {
	try { logFirebaseEvent('home_themes_click') } catch (e) {}
	go('/pagesA/topics/topics')
}

const likeSheet = useHomeLikeSheet({
	t,
	config,
	user,
	list,
	liked,
	likeTick,
	quoteLiked,
	persistHomeCache,
	deps,
})
const {
	newcomer,
	showNewcomerProgress,
	showLikeSheet,
	showComplete,
	burstShow,
	newcomerTitle,
	newcomerDesc,
	newcomerCongrats,
	applyNewcomer,
	maybeShowNewcomerSheet,
	openLikeSheet,
	closeLikeSheet,
	loadNewcomer,
	toggleLike,
	setCheckinSettled,
	getCheckinSettled,
} = likeSheet

watch(showNewcomerProgress, (on) => {
	if (!on) return
	try { logFirebaseEvent('like_task_show') } catch (e) {}
})

deps.newcomer = newcomer
deps.applyNewcomer = applyNewcomer

const checkin = useHomeCheckin({
	t,
	config,
	user,
	maybeShowNewcomerSheet,
	setCheckinSettled,
})
const {
	checkinPopup,
	checkinDialogExtra,
	onCheckinDialogVisible,
	runCheckin,
} = checkin

deps.checkinPopup = checkinPopup
deps.showLikeSheet = showLikeSheet
deps.vipLockOpen = vipLockOpen
deps.getCheckinSettled = getCheckinSettled

const popups = useHomePopups({ user, deps })
const {
	widgetNudgeOpen,
	discountNudgeOpen,
	noteHomeView,
	tryShowHomePopups,
	closeWidgetNudge,
	closeDiscountNudge,
} = popups
deps.noteHomeView = noteHomeView

/** 任一全屏遮挡打开则暂停有效停留；全部关闭才恢复；切后台才 settle */
function syncFeedReadOverlay() {
	const blocked = !!(
		vipLockOpen.value
		|| showLikeSheet.value
		|| showComplete.value
		|| widgetNudgeOpen.value
		|| discountNudgeOpen.value
		|| checkinPopup.value
	)
	if (blocked) pauseFeedRead()
	else resumeFeedRead()
}
watch(vipLockOpen, syncFeedReadOverlay)
watch(showLikeSheet, syncFeedReadOverlay)
watch(showComplete, syncFeedReadOverlay)
watch(widgetNudgeOpen, syncFeedReadOverlay)
watch(discountNudgeOpen, syncFeedReadOverlay)
watch(checkinPopup, syncFeedReadOverlay)

function onWidgetLearn() {
	try { logFirebaseEvent('homeWidget_learn_click') } catch (e) {}
	widgetNudgeOpen.value = false
	go('/pagesA/widgets/widgets?from=home')
}

function onDiscountContinue() {
	closeDiscountNudge()
	goVip('home_discount')
}

function onDiscountActivated() {
	closeDiscountNudge()
	onVipActivated()
}

function onCheckinPopupVisible(v) {
	onCheckinDialogVisible(v)
	if (!v) tryShowHomePopups()
}

function onLikeSheetDismiss() {
	closeLikeSheet()
	tryShowHomePopups()
}

function onLikeSheetConfirm() {
	try { logFirebaseEvent('like_popup_confirm_click') } catch (e) {}
	onLikeSheetDismiss()
}

function onCheckinContinue() {
	try { logFirebaseEvent('daily_checkin_continue_click') } catch (e) {}
	checkinPopup.value = null
}

/** 首屏 ensureLogin 完成前禁止抢跑鉴权接口 */
let homeReady = false
/** 防止 hideTabBar/setStyle 触发的 onShow 重入狂刷曝光 */
let lastHomeShowAt = 0

onHide(() => {
	settleFeedRead()
	persistHomeCache()
})

onShow(async () => {
	hideNativeTabBar()
	user.value = getUser()
	if (!syncHomeLikesForAccount()) overlayPendingLikes()
	if (homeReady) setCheckinSettled(false)
	if (!homeReady) return
	const now = Date.now()
	const freshShow = now - lastHomeShowAt > 800
	lastHomeShowAt = now
	if (!freshShow) return
	const pendingVipDismiss = Number(uni.getStorageSync('selah_vip_dismiss_content_id') || 0)
	if (pendingVipDismiss) await handleVipDismissCooldown().catch(() => {})
	// 没换主题：壁纸和语录保持离开前的样子，不重新请求
	if (keepHomeLook()) {
		if (bgVideoUrl.value) playWallpaperVideo('homeBgVideo')
		exposeActiveQuote()
		resumeFeedRead()
		if (uni.getStorageSync('token')) loadNewcomer().catch(() => {})
		runCheckin().catch(() => {}).then(() => tryShowHomePopups())
		return
	}
	try { await applyWallpaper({ allowNetwork: false }) } catch (e) {}
	const switched = await reloadHomeFeedIfStale().catch(() => false)
	if (!switched) await hydratePinnedTopicQuotes().catch(() => {})
	exposeActiveQuote()
	if (uni.getStorageSync('token')) loadNewcomer().then(() => persistHomeCache()).catch(() => {})
	runCheckin().catch(() => {}).then(() => tryShowHomePopups())
})

/**
 * 首页挂载顺序（刻意设计，勿随意调序）：
 * 1. 灌缓存秒开 → 2. ensureLogin
 * 3. app-config / 壁纸 → 4. 拉 Feed（有缓存则不再重复埋首曝）
 * 5. 新人喜欢进度 → 写缓存 → 静默预取 → 进首页自动打卡并弹对勾
 */
onMounted(async () => {
	if (shouldForceLoginPage() || !hasLocalSession()) {
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
		return
	}
	// 1) 先灌缓存：网络慢时也能先滑已有语录
	applyHomeCache(readPageCache(HOME_CACHE_KEY))
	if (!syncHomeLikesForAccount()) overlayPendingLikes()
	if (bgVideoUrl.value) playWallpaperVideo('homeBgVideo')
	try {
		await ensureLogin()
		user.value = getUser()
		homeReady = true
		if (!syncHomeLikesForAccount()) overlayPendingLikes()

		try {
			await loadWithCache(
				APP_CONFIG_KEY,
				async () => (await apiAppConfig()).results || {},
				(cfg) => { config.value = cfg || {} },
				{ getRevision: appConfigRevision },
			)
		} catch (e) {}
		// 主题没换：用离开前的壁纸和语录，不请求壁纸 / 语录接口
		if (keepHomeLook()) {
			if (bgVideoUrl.value) playWallpaperVideo('homeBgVideo')
			exposeActiveQuote()
			await loadNewcomer().catch(() => {})
			persistHomeCache()
			runCheckin().catch(() => {}).then(() => tryShowHomePopups())
			return
		}
		await applyWallpaper({ allowNetwork: true })
		const forceQuote = peekHomeForceQuote()
		const hadCache = list.value.length > 0
		// 主题没更新且已有缓存：直接用本地语录，不请求 /content/quote/
		if (hadCache && !homeFeedNeedsReload()) {
			if (forceQuote) consumeHomeForceQuote()
			exposeActiveQuote()
		} else {
			const feedRefresh = loadFeed({ trackView: !hadCache, replace: !hadCache }).then(() => {
				persistHomeCache()
				if (forceQuote) consumeHomeForceQuote()
				if (!getHomeFeedTopicId()) return silentPrefetchFeed()
			})
			if (!hadCache) {
				await feedRefresh
			} else {
				feedRefresh.catch(() => {})
				exposeActiveQuote()
			}
		}
		await loadNewcomer()
		persistHomeCache()
		homeReady = true
		runCheckin().catch(() => {}).then(() => tryShowHomePopups())
	} catch (e) {
		console.error('home init failed', e)
		if (e && (e.code === 'NEED_LOGIN' || e.code === 'FORCE_LOGIN')) {
			uni.reLaunch({ url: '/pagesA/welcome/welcome' })
			return
		}
		if (uni.getStorageSync('token')) homeReady = true
		// 无缓存且初始化失败才 toast，避免有缓存时吓人
		if (!list.value.length) {
			uni.showToast({ title: t('load_failed'), icon: 'none' })
		}
	}
})
</script>


<style>
/* 避免 page 默认浅底在回弹/TabBar 留白处露出来 */
page {
	height: 100%;
	overflow: hidden;
	background-color: #f5dfbc;
}
</style>

<style scoped>
.home {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	width: auto;
	height: auto;
	overflow: hidden;
	overscroll-behavior: none;
	background-color: #fbf8f2;
	background-image: linear-gradient(180deg, #b6badf 0%, #fff0d9 48%, #f5dfbc 100%);
	color: #191919;
}
.bg {
	position: absolute;
	left: 0;
	top: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
	opacity: 0.55;
	pointer-events: none;
}
.bg.bg-video {
	z-index: 0;
	opacity: 1;
}
.bg.bg-video :deep(video),
.bg.bg-video :deep(.uni-video-container),
.bg.bg-video :deep(.uni-video-video) {
	position: absolute !important;
	left: 0 !important;
	top: 0 !important;
	width: 100% !important;
	height: 100% !important;
	object-fit: cover !important;
	opacity: 1 !important;
	background: transparent !important;
	pointer-events: none !important;
}
.bg-video :deep(.uni-video-cover),
.bg-video :deep(.uni-video-bar),
.bg-video :deep(.uni-video-progress) {
	display: none !important;
	opacity: 0 !important;
	pointer-events: none !important;
}
.veil {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 1;
	background: linear-gradient(180deg, rgba(251, 248, 242, 0.02), rgba(251, 248, 242, 0.16));
	pointer-events: none;
}
.has-dyn-bg .veil {
	background: linear-gradient(180deg, rgba(251, 248, 242, 0.2), rgba(251, 248, 242, 0.36));
}
/* 纵向按稿 812 比例（top %），避免 rpx 随屏宽拉伸导致竖向错位 */
.top {
	position: absolute;
	z-index: 30;
	top: 0;
	left: 0;
	right: 0;
	padding-left: 32rpx;
	padding-right: 32rpx;
	padding-bottom: 0;
	box-sizing: border-box;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
	pointer-events: auto;
	transform: translateZ(0);
}
.top-left {
	display: flex;
	flex-direction: row;
	align-items: center;
	flex-shrink: 0;
}
.top-left .glass-pill + .glass-pill {
	margin-left: 16rpx;
}
.top-spacer {
	width: 192rpx;
	height: 88rpx;
	flex-shrink: 0;
	visibility: hidden;
}
.glass-pill {
	position: relative;
	z-index: 1;
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.56);
	box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.1);
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	cursor: pointer;
}
.pill-img {
	width: 48rpx;
	height: 48rpx;
	pointer-events: none;
}
.brand-wrap {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
}
.brand {
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 36rpx;
	font-weight: 700;
	color: #191919;
}
/* 稿 6:1487 — 165×28；槽位常驻，进度条点满后只藏内容 */
.progress-slot {
	width: 330rpx;
	height: 56rpx;
	flex-shrink: 0;
}
.progress-pill {
	width: 330rpx;
	height: 56rpx;
	padding: 0 20rpx;
	box-sizing: border-box;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.56);
	box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.1);
	display: flex;
	flex-direction: row;
	align-items: center;
}
.progress-ico {
	width: 40rpx;
	height: 40rpx;
	flex-shrink: 0;
	margin-right: 8rpx;
	pointer-events: none;
}
.progress-num {
	font-size: 28rpx;
	line-height: 1;
	color: #191919;
	font-weight: 500;
	flex-shrink: 0;
}
.bar {
	width: 172rpx;
	height: 12rpx;
	background: rgba(25, 25, 25, 0.22);
	margin-left: 16rpx;
	border-radius: 999rpx;
	overflow: hidden;
	flex-shrink: 0;
}
.bar-fill {
	height: 100%;
	background: #d97b8c;
}
.feed {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	width: auto;
	height: auto;
	z-index: 2;
	background: transparent;
}
.feed :deep(uni-swiper),
.feed :deep(uni-swiper-item),
.feed :deep(.uni-swiper-wrapper),
.feed :deep(.uni-swiper-slides),
.feed :deep(.uni-swiper-slide-frame) {
	background: transparent !important;
}
.card {
	height: 100%;
	width: 100%;
	position: relative;
	box-sizing: border-box;
	overflow: hidden;
	background-color: #fbf8f2;
	background-image: linear-gradient(180deg, #b6badf 0%, #fff0d9 48%, #f5dfbc 100%);
}
.card.card-dyn {
	background: transparent;
}
.card-bg {
	position: absolute;
	left: 0;
	top: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
	opacity: 0.55;
	pointer-events: none;
}
.card-veil {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 1;
	background: linear-gradient(180deg, rgba(251, 248, 242, 0.02), rgba(251, 248, 242, 0.16));
	pointer-events: none;
}
/* 稿 Frame 36：y=311/812 */
.quote-block {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	top: calc(100% * 311 / 812);
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	pointer-events: none;
}
.lock-hit {
	position: absolute;
	left: 48rpx;
	right: 48rpx;
	top: 42%;
	z-index: 3;
	padding: 40rpx 32rpx 32rpx;
	background: rgba(251, 248, 242, 0.95);
	border-radius: 32rpx;
	border: 2rpx solid rgba(25, 25, 25, 0.06);
	display: flex;
	flex-direction: column;
	align-items: center;
	box-sizing: border-box;
}
.lock-hit-close {
	position: absolute;
	top: 12rpx;
	right: 12rpx;
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2;
}
.lock-hit-close-ico {
	width: 36rpx;
	height: 36rpx;
	opacity: 0.55;
}
.lock-hit-body {
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.lock-hit-text {
	color: #5c5c5c;
	font-size: 24rpx;
}
.lock-hit-cta-row {
	margin-top: 12rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	gap: 4rpx;
}
.lock-hit-cta {
	color: #191919;
	font-size: 28rpx;
	font-weight: 600;
}
.lock-hit-arrow {
	width: 28rpx;
	height: 28rpx;
	opacity: 0.85;
}
.quote {
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 48rpx;
	line-height: 1.28;
	color: #191919;
	text-align: center;
	font-weight: 700;
	width: 100%;
}
.cite {
	margin-top: 20rpx;
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 28rpx;
	color: #191919;
	text-align: center;
	width: 100%;
}
.quote-hit {
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 2;
	pointer-events: none;
}
/* 稿 Frame 41：y=662，高 36，间距 40 */
.mid-actions {
	position: absolute;
	left: 0;
	right: 0;
	top: min(calc(100% * 662 / 812), calc(100% - 88rpx - 72rpx - 40rpx - constant(safe-area-inset-bottom)));
	top: min(calc(100% * 662 / 812), calc(100% - 88rpx - 72rpx - 40rpx - env(safe-area-inset-bottom)));
	bottom: auto;
	height: 72rpx;
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
	z-index: 7;
	pointer-events: auto;
	transform: translateZ(0);
}
.icon-btn {
	width: 72rpx;
	height: 72rpx;
	margin: 0 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.act-img {
	width: 72rpx;
	height: 72rpx;
	pointer-events: none;
}
.icon {
	font-size: 40rpx;
	color: #191919;
}
.icon.more {
	letter-spacing: 2rpx;
}
/* 稿 dock y=734；Prayer 宽 95 */
.dock {
	position: absolute;
	z-index: 6;
	left: 32rpx;
	right: 32rpx;
	top: min(calc(100% * 734 / 812), calc(100% - 88rpx - 16rpx - constant(safe-area-inset-bottom)));
	top: min(calc(100% * 734 / 812), calc(100% - 88rpx - 16rpx - env(safe-area-inset-bottom)));
	bottom: auto;
	height: 88rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	filter: drop-shadow(0 8rpx 40rpx rgba(0, 0, 0, 0.12));
	transform: translateZ(0);
	pointer-events: auto;
}
.dock .prayer {
	width: 190rpx;
	padding: 0 24rpx;
	box-sizing: border-box;
}
.prayer-text {
	margin-left: 8rpx;
	font-size: 28rpx;
	color: #191919;
}
.sheet {
	padding: 40rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
	color: #191919;
	background: #f5f5f5;
}
.sheet-title {
	display: block;
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 40rpx;
	font-weight: 700;
	margin-bottom: 16rpx;
	text-align: center;
}
.sheet-desc {
	display: block;
	font-size: 28rpx;
	color: #5c5c5c;
	margin-bottom: 32rpx;
	text-align: center;
	line-height: 1.4;
}
.sheet-cta {
	height: 96rpx;
	border-radius: 32rpx;
	background: #191919;
	display: flex;
	align-items: center;
	justify-content: center;
}
.sheet-cta-text {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
}
.checkin-pop {
	width: 600rpx;
	padding: 48rpx 40rpx;
	background: #ffffff;
	border-radius: 32rpx;
	color: #191919;
	box-shadow: 0 16rpx 64rpx rgba(0, 0, 0, 0.12);
}
.cp-title {
	display: block;
	font-size: 34rpx;
	text-align: center;
	margin-bottom: 12rpx;
}
.cp-sub {
	display: block;
	font-size: 26rpx;
	color: #5c5c5c;
	text-align: center;
	margin-bottom: 16rpx;
}
.cp-quota {
	display: block;
	font-size: 26rpx;
	color: #191919;
	text-align: center;
	margin-bottom: 28rpx;
}
.week {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	margin-bottom: 36rpx;
}
.day {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	border: 2rpx solid rgba(25, 25, 25, 0.15);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24rpx;
	color: #191919;
}
.day.checked {
	background: #d97b8c;
	border-color: #d97b8c;
	color: #fff;
}
.day.frozen {
	background: #c5c3e8;
	border-color: #c5c3e8;
}
.complete-toast {
	position: absolute;
	z-index: 20;
	left: 40rpx;
	right: 40rpx;
	top: 40%;
	padding: 32rpx;
	background: #191919;
	color: #fff;
	border-radius: 32rpx;
	text-align: center;
}
.burst {
	position: absolute;
	z-index: 25;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	pointer-events: none;
}
.burst-heart {
	font-size: 120rpx;
	color: #d97b8c;
	animation: burstPop 0.7s ease-out forwards;
}
@keyframes burstPop {
	0% { transform: scale(0.3); opacity: 0; }
	40% { transform: scale(1.35); opacity: 1; }
	100% { transform: scale(1.8); opacity: 0; }
}
</style>
