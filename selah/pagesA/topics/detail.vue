<!--
  话题语录：Calm 栏目用首页同款纵向滑动；其余栏目保持白卡列表。
-->
<template>
	<view :class="['page', isFeed ? 'page-feed' : '', isFeed && bgVideoUrl ? 'has-dyn-bg' : '']">
		<image v-if="isFeed && bgUrl && !bgVideoUrl" class="bg" :src="bgUrl" mode="aspectFill" @error="onBgError" />
		<video
			v-if="isFeed && bgVideoUrl"
			id="topicBgVideo"
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
		/>
		<view v-if="isFeed" class="veil" />

		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" :class="{ 'head-glass-feed': isFeed }" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="title nav-title" :style="isFeed ? null : titleStyle">{{ name }}</text>
				<view class="nav-pill" @click.stop="toggle">
					<image
						v-if="isDisplayTag && !isVip && displayNeedsVip"
						class="lock-ico"
						src="/static/ui/explore/ico-lock.svg"
						mode="aspectFit"
					/>
					<text v-else class="follow-mini">{{ followed ? t('unfollow') : t('follow') }}</text>
				</view>
			</view>
		</view>

		<template v-if="isFeed">
			<swiper
				class="feed"
				vertical
				:current="current"
				@change="onSwipe"
				:circular="false"
			>
				<swiper-item v-for="(q, idx) in list" :key="q.id || idx">
					<view class="card">
						<view class="quote-block">
							<text class="quote">{{ q.content }}</text>
							<text v-if="q.source_ref" class="cite">-{{ q.source_ref }}</text>
						</view>
						<view v-if="q.locked" class="lock-hit">
							<view class="lock-hit-close" @click.stop="dismissLockHit">
								<image class="lock-hit-close-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
							</view>
							<view class="lock-hit-body" @click.stop="openVip">
								<text class="lock-hit-text">{{ t('vip_content') }}</text>
								<view class="lock-hit-cta-row">
									<text class="lock-hit-cta">{{ t('unlock_vip') }}</text>
									<image class="lock-hit-arrow" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
								</view>
							</view>
						</view>
						<view class="quote-hit" @longpress="goShare(q)" />
					</view>
				</swiper-item>
			</swiper>
			<selah-vip-lock
				v-if="vipLockOpen"
				mode="overlay"
				pay-trigger-source="topic_lock"
				:lock-content-id="activeQuote?.id || ''"
				@close="closeVipLock"
				@activated="onVipActivated"
			/>
			<view v-if="activeQuote && !activeQuote.locked" class="mid-actions">
				<view class="icon-btn" @click.stop="goShare(activeQuote)">
					<image class="act-img" src="/static/ui/ico-share.svg" mode="aspectFit" />
				</view>
				<view class="icon-btn" @click.stop="toggleLike(activeQuote)">
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
			<view v-if="!list.length && loaded" class="empty empty-feed">
				<text class="empty-text">{{ t('no_quotes') }}</text>
			</view>
		</template>

		<template v-else>
			<text class="hero-title" :style="heroTitleStyle">{{ name }}</text>
			<view v-if="!list.length && loaded" class="empty">
				<image class="empty-art" src="/static/ui/themes/like.png" mode="aspectFill" />
				<text class="empty-text">{{ t('no_quotes') }}</text>
			</view>
			<view v-for="q in list" :key="q.id" class="q" @click="goShare(q)">
				<text class="q-text">{{ q.content }}</text>
				<view class="q-foot">
					<text class="q-share">{{ t('share') }}</text>
					<image class="q-ico" src="/static/ui/ico-share.svg" mode="aspectFit" />
				</view>
			</view>
			<view v-if="loadingMore" class="tip">...</view>
		</template>
	</view>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiTopicQuotes, apiFollowTopic, apiDisplayTagQuotes, apiFollowDisplayTag, apiLike, contentTargetType } from '@/api/content.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { silentListRefresh } from '@/utils/pageCache.js'
import { applyHomeThemeLook, clearHomeFeedTopicIf } from '@/utils/homeFeedSync.js'
import { topicQuotesKey, getActiveWallpaper, wallpaperDisplayUrl, wallpaperOverlayVideoUrl, FALLBACK_WALLPAPER, playWallpaperVideo } from '@/utils/wallpaperCache.js'
import { cmsLabel } from '@/utils/cmsI18n.js'
import { isCalmCategory } from '@/utils/exploreCatalog.js'
import { goVip } from '@/utils/vip.js'
import { getUser } from '@/utils/session.js'
import { playSfx } from '@/utils/sfx.js'
import { recordLikeStatus } from '@/utils/likeSync.js'
import { createTapLock } from '@/utils/tapLock.js'
import { openSharePage } from '@/utils/share.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle, heroTitleStyle } = useCollapsingTitle({
	mode: 'hero',
	statusBarPx,
	fontStartRpx: 48,
	fontEndRpx: 34,
	titleBlockRpx: 72,
})
const id = ref(0)
const name = ref('')
const list = ref([])
const followed = ref(false)
const loaded = ref(false)
const page = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const isFeed = ref(false)
const fromExplore = ref(false)
const isDisplayTag = ref(false)
const isVip = computed(() => String(getUser()?.vip_level || 'free') !== 'free')
const topicSnap = ref({})
const displayNeedsVip = computed(() => {
	const topic = topicSnap.value || {}
	return !!(topic.locked || topic.vip || topic.is_vip)
})
const current = ref(0)
const liked = ref({})
const likeTick = ref(0)
const vipLockOpen = ref(false)
const bgUrl = ref(FALLBACK_WALLPAPER)
const bgVideoUrl = ref('')
const PAGE_SIZE = 20
const actionTap = createTapLock(420)

const activeQuote = computed(() => list.value[current.value] || null)
const isActiveLiked = computed(() => quoteLiked(activeQuote.value))

function quoteLiked(q) {
	if (!q || q.id == null) return false
	const sid = String(q.id)
	if (Object.prototype.hasOwnProperty.call(liked.value, sid)) return !!liked.value[sid]
	return !!q.liked
}

onLoad((q) => {
	isDisplayTag.value = q.display_tag != null && q.display_tag !== ''
	id.value = Number(isDisplayTag.value ? q.display_tag : q.id)
	name.value = cmsLabel(decodeURIComponent(q.name || ''))
	fromExplore.value = String(q.from || '') === 'explore'
	isFeed.value = !isDisplayTag.value && (String(q.mode || '') === 'feed' || isCalmCategory(q.category))
	list.value = []
	loaded.value = false
	hasMore.value = true
	page.value = 1
	current.value = 0
	bgUrl.value = wallpaperDisplayUrl(getActiveWallpaper()) || FALLBACK_WALLPAPER
	bgVideoUrl.value = wallpaperOverlayVideoUrl(getActiveWallpaper())
	if (isFeed.value && bgVideoUrl.value) playWallpaperVideo('topicBgVideo')
	bootstrap()
})

function onBgError() {
	if (bgUrl.value !== FALLBACK_WALLPAPER) bgUrl.value = FALLBACK_WALLPAPER
}

function applyPage1(payload) {
	const rows = payload?.list || payload?.results?.list || []
	list.value = rows
	page.value = 2
	const totalPages = payload?.pagination?.total_pages || 1
	hasMore.value = 1 < totalPages
	if (payload?.followed != null) followed.value = !!payload.followed
	const topic = payload?.topic || payload?.collection || {}
	topicSnap.value = topic
	if (topic.name) name.value = cmsLabel(topic.name)
	if (!isDisplayTag.value && isCalmCategory(topic.category)) isFeed.value = true
	if (topic.locked) {
		loaded.value = true
		goVip('topic_lock')
		return
	}
	loaded.value = true
}

function bootstrap() {
	if (!id.value) {
		loaded.value = true
		return
	}
	const cacheKey = isDisplayTag.value ? `display_tag_quotes_${id.value}` : topicQuotesKey(id.value)
	const { hydrated, refresh } = silentListRefresh(
		cacheKey,
		async () => {
			if (isDisplayTag.value) {
				const res = await apiDisplayTagQuotes(id.value, { currentPage: 1, pageSize: PAGE_SIZE })
				const collection = res.results?.collection || {}
				return {
					list: res.results?.list || [],
					pagination: res.pagination || null,
					followed: !!(res.results?.followed ?? collection.followed),
					collection,
				}
			}
			const res = await apiTopicQuotes(id.value, { currentPage: 1, pageSize: PAGE_SIZE })
			const topic = res.results?.topic || {}
			return {
				list: res.results?.list || [],
				pagination: res.pagination || null,
				followed: !!(res.results?.followed ?? topic.followed),
				topic,
			}
		},
		applyPage1,
	)
	if (!hydrated) loadingMore.value = true
	refresh
		.catch((e) => {
			if (isDisplayTag.value && (e?.code === 403 || e?.results?.collection?.locked || e?.results?.locked)) {
				goVip('topic_lock')
			}
		})
		.finally(() => {
			loadingMore.value = false
			loaded.value = true
		})
}

async function loadMore() {
	if (loadingMore.value || !hasMore.value || !id.value) return
	loadingMore.value = true
	try {
		const next = page.value
		const res = isDisplayTag.value
			? await apiDisplayTagQuotes(id.value, { currentPage: next, pageSize: PAGE_SIZE })
			: await apiTopicQuotes(id.value, { currentPage: next, pageSize: PAGE_SIZE })
		const rows = res.results?.list || []
		list.value = list.value.concat(rows)
		page.value = next + 1
		const totalPages = res.pagination?.total_pages || 1
		hasMore.value = next < totalPages
	} finally {
		loadingMore.value = false
		loaded.value = true
	}
}

onReachBottom(() => {
	if (!isFeed.value) loadMore()
})

function onSwipe(e) {
	current.value = e.detail.current
	if (isFeed.value && list.value.length - current.value <= 4) loadMore()
}

function goBack() {
	safeBack(fromExplore.value ? '/pagesA/explore/explore' : '/pagesA/topics/topics')
}

function openVip() {
	const q = activeQuote.value
	try {
		if (q?.id) uni.setStorageSync('selah_vip_lock_content_id', Number(q.id) || 0)
	} catch (e) {}
	vipLockOpen.value = true
}

function applyVipDismissCooldown(qid) {
	try {
		const until = Number(uni.getStorageSync('selah_vip_cooldown_until') || 0)
		if (until < Date.now()) {
			uni.setStorageSync('selah_vip_cooldown_until', Date.now() + 30000)
		}
		if (qid) uni.setStorageSync('selah_vip_dismiss_content_id', Number(qid) || 0)
		uni.removeStorageSync('selah_vip_lock_content_id')
	} catch (e) {}
}

/** 关闭锁定卡：冷却，跳过开通拦截 */
function dismissLockHit() {
	const q = activeQuote.value
	const qid = Number(q?.id || 0)
	applyVipDismissCooldown(qid)
	vipLockOpen.value = false
	if (qid) {
		const idx = list.value.findIndex((row) => Number(row.id) === qid)
		if (idx >= 0) {
			const next = list.value.slice()
			next.splice(idx, 1)
			list.value = next
			if (current.value >= list.value.length) {
				current.value = Math.max(0, list.value.length - 1)
			}
		}
	}
}

function closeVipLock() {
	vipLockOpen.value = false
	const qid = Number(activeQuote.value?.id || uni.getStorageSync('selah_vip_lock_content_id') || 0)
	applyVipDismissCooldown(qid)
	if (qid) {
		const idx = list.value.findIndex((row) => Number(row.id) === qid)
		if (idx >= 0) {
			const next = list.value.slice()
			next.splice(idx, 1)
			list.value = next
			if (current.value >= list.value.length) {
				current.value = Math.max(0, list.value.length - 1)
			}
		}
	}
}

function onVipActivated() {
	vipLockOpen.value = false
	const q = activeQuote.value
	if (q) {
		q.locked = false
		q.is_vip = false
	}
}

function onVipActivatedEvent() {
	onVipActivated()
}
uni.$on('selah_vip_activated', onVipActivatedEvent)
onUnmounted(() => {
	uni.$off('selah_vip_activated', onVipActivatedEvent)
})

async function toggle() {
	if (isDisplayTag.value && !isVip.value && displayNeedsVip.value) {
		goVip('topic_lock')
		return
	}
	const next = !followed.value
	try { logFirebaseEvent(next ? 'topic_follow_click' : 'topic_follow_cancel', { topicID: id.value }) } catch (e) {}
	if (isDisplayTag.value) {
		await apiFollowDisplayTag(id.value, next)
		followed.value = next
		return
	}
	await apiFollowTopic(id.value, next)
	followed.value = next
	if (next) {
		await applyHomeThemeLook(id.value, topicSnap.value.cover_url || topicSnap.value.image_url)
	} else {
		clearHomeFeedTopicIf(id.value)
	}
}

function goShare(q) {
	if (!q?.id) return
	actionTap.run(() => openSharePage({ id: q.id, text: q.content, cite: q.source_ref }))
}

async function toggleLike(q) {
	if (!q?.id) return
	actionTap.run(async () => {
		const sid = String(q.id)
		const next = !quoteLiked(q)
		liked.value = { ...liked.value, [sid]: next }
		likeTick.value += 1
		if (next) playSfx()
		try {
			const res = await apiLike(q.id, next, { target_type: contentTargetType(q) })
			const serverLiked = !!(res?.results?.liked ?? res?.liked)
			liked.value = { ...liked.value, [sid]: serverLiked }
			likeTick.value += 1
			const idx = list.value.findIndex((x) => String(x.id) === sid)
			if (idx >= 0) {
				const nextList = list.value.slice()
				nextList[idx] = { ...nextList[idx], liked: serverLiked }
				list.value = nextList
			}
			recordLikeStatus(q.id, serverLiked)
		} catch (e) {
			liked.value = { ...liked.value, [sid]: !next }
			likeTick.value += 1
		}
	})
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-feed {
	height: 100vh;
	height: 100dvh;
	min-height: 100vh;
	padding: 0;
	overflow: hidden;
	background-color: #fbf8f2;
	background-image: linear-gradient(180deg, #b6badf 0%, #fff0d9 48%, #f5dfbc 100%);
}
.bg {
	position: absolute;
	left: 0;
	top: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
	opacity: 0.22;
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
	background: linear-gradient(180deg, rgba(251, 248, 242, 0.08), rgba(251, 248, 242, 0.42));
	pointer-events: none;
}
.has-dyn-bg .veil {
	background: linear-gradient(180deg, rgba(251, 248, 242, 0.58), rgba(251, 248, 242, 0.72));
}
.page-head {
	@include selah-sticky-head;
}
.page-feed .page-head {
	position: absolute;
	left: 0;
	right: 0;
	z-index: 20;
	padding-left: 32rpx;
	padding-right: 32rpx;
	background: transparent;
}
.head-glass {
	@include selah-sticky-head-glass($selah-bg-gray);
}
.head-glass-feed {
	background: transparent;
	backdrop-filter: none;
}
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	padding: 0 0 8rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.nav-pill {
	min-width: 88rpx;
	height: 88rpx;
	padding: 0 24rpx;
	border-radius: $selah-radius-pill;
	background: $selah-glass;
	box-shadow: $selah-shadow;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	position: relative;
	z-index: 2;
}
.nav-ico { width: 48rpx; height: 48rpx; }
.follow-mini { font-size: 24rpx; color: $selah-ink; font-weight: 600; }
.lock-ico { width: 36rpx; height: 36rpx; display: block; }
.title {
	@include selah-display-title;
}
.nav-title {
	flex: 1;
	text-align: center;
}
.page-feed .nav-title {
	font-size: 32rpx;
	opacity: 1;
	transform: none;
}
.hero-title {
	@include selah-display-title;
	display: block;
	font-size: 48rpx;
	line-height: 1.15;
	margin: 8rpx 0 24rpx;
	will-change: opacity, transform;
}
.feed {
	position: relative;
	height: 100%;
	z-index: 2;
	background: transparent;
}
.feed :deep(uni-swiper),
.feed :deep(uni-swiper-item),
.feed :deep(.uni-swiper-wrapper) {
	background: transparent;
}
.card {
	height: 100%;
	position: relative;
	box-sizing: border-box;
}
.quote-block {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	top: calc(100% * 311 / 812);
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
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
	font-family: $selah-font-display;
	font-size: 48rpx;
	line-height: 1.28;
	color: #191919;
	text-align: center;
	font-weight: 700;
	width: 100%;
}
.cite {
	margin-top: 20rpx;
	font-family: $selah-font-display;
	font-size: 28rpx;
	color: #191919;
	text-align: center;
	width: 100%;
}
.quote-hit {
	position: absolute;
	left: 48rpx;
	right: 48rpx;
	top: 30%;
	bottom: 22%;
	z-index: 1;
}
.mid-actions {
	position: absolute;
	left: 0;
	right: 0;
	top: calc(100% * 662 / 812);
	height: 72rpx;
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
	z-index: 7;
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
}
.empty {
	margin: 80rpx 0 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.empty-feed {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	top: 42%;
	z-index: 4;
}
.empty-art {
	width: 240rpx;
	height: 240rpx;
	border-radius: 32rpx;
	margin-bottom: 24rpx;
	opacity: 0.85;
}
.empty-text { color: $selah-muted; text-align: center; font-size: 28rpx; }
.q {
	padding: 32rpx;
	margin-bottom: 16rpx;
	background: $selah-card;
	border-radius: $selah-radius-card;
	line-height: 1.45;
}
.q-text {
	font-family: $selah-font-display;
	font-size: 32rpx;
	color: $selah-ink;
	display: block;
}
.q-foot {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin-top: 20rpx;
}
.q-share { color: $selah-ink-soft; font-size: 22rpx; margin-right: 8rpx; }
.q-ico { width: 28rpx; height: 28rpx; }
.tip { color: $selah-muted; text-align: center; padding: 16rpx; font-size: 22rpx; }
</style>
