<!--
  壁纸库双态：网格 ↔ 单屏预览（Include quote / Continue）；Dynamic 滤签加载 video。
  mode=used 交互对齐 topics?mode=followed：关× / Clear / 点选 → Preview CTA → 预览应用。
-->
<template>
	<view class="page">
		<template v-if="uiMode === 'library'">
			<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-left">
						<view class="nav-pill" @tap.stop="onNavBack">
							<image
								class="nav-ico"
								:src="isUsedMode ? '/static/ui/ico-close.svg' : '/static/ui/ico-back.svg'"
								mode="aspectFit"
							/>
						</view>
						<text class="nav-title">{{ pageTitle }}</text>
					</view>
					<text
						v-if="isUsedMode && list.length"
						class="nav-action"
						@tap="onClearUsed"
					>{{ t('clear') }}</text>
					<view
						v-else-if="!isUsedMode"
						class="unlock-pill"
						@tap="goVip('wallpaper_lock')"
					>
						<text class="unlock-text">{{ t('wallpaper_unlock_all') }}</text>
					</view>
					<view v-else class="nav-spacer" />
				</view>
			</view>

			<template v-if="!isUsedMode && showDynamicTab">
				<view class="sec-head">
					<text class="sec-title">{{ t('wallpaper_dynamic') }}</text>
				</view>
				<scroll-view scroll-x class="dyn-rail" :show-scrollbar="false">
					<view
						v-for="w in dynamicList"
						:key="'d-' + w.id"
						class="dyn-card"
						@tap="onPickDynamic(w)"
					>
						<image
							:src="w.poster_url || w.image_url"
							mode="aspectFill"
							class="dyn-img"
						/>
						<text class="dyn-label">{{ w.title || t('wallpaper_video_badge') }}</text>
						<text v-if="w.locked" class="lock">VIP</text>
					</view>
					<view v-if="!dynamicList.length" class="dyn-card empty-card">
						<text class="dyn-empty-text">{{ t('wallpaper_dynamic_empty') }}</text>
					</view>
				</scroll-view>
				<view class="sec-head">
					<text class="sec-title">{{ t('wallpaper_static') }}</text>
				</view>
			</template>

			<view class="grid">
				<view v-if="!list.length && !loadingMore" class="empty">
					{{ isUsedMode ? t('my_wallpapers_empty') : t('empty') }}
				</view>
				<view
					v-for="w in list"
					:key="w.id"
					:class="['item', selectedId === w.id ? 'on' : '']"
					@tap="onPick(w)"
				>
					<image :src="w.image_url" mode="aspectFill" class="img" />
					<text v-if="!w.locked && !w.is_vip" class="free-tag">{{ t('free') }}</text>
					<text v-if="w.is_current" class="cur">{{ t('current') }}</text>
					<text v-if="w.locked" class="lock">VIP</text>
				</view>
			</view>
			<view v-if="loadingMore" class="tip">...</view>

			<view v-if="isUsedMode && selectedId" class="foot">
				<view class="cta" @tap="goPreview">
					<text class="cta-text">{{ t('preview') }}</text>
				</view>
			</view>
		</template>

		<template v-else>
			<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-pill" @tap.stop="uiMode = 'library'">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-skip" @tap="skipPreview">{{ t('skip') }}</text>
				</view>
			</view>
			<view class="preview" v-if="previewWall">
				<video
					v-if="isVideoWall(previewWall)"
					class="preview-img"
					:src="previewWall.video_url"
					:poster="previewWall.poster_url || previewWall.image_url"
					:controls="true"
					:autoplay="true"
					:loop="true"
					:muted="true"
					object-fit="cover"
				/>
				<image
					v-else
					class="preview-img"
					:src="previewWall.image_url"
					mode="aspectFill"
				/>
				<view class="toggle-card">
					<text class="toggle-label">{{ t('include_quote') }}</text>
					<switch :checked="includeQuote" @change="onInclude" color="#191919" />
				</view>
				<view class="cta" @tap="applyCurrent">
					<text class="cta-text">{{ t('continue') }}</text>
				</view>
			</view>
		</template>

		<selah-dialog
			v-model:visible="clearDialogOpen"
			:title="t('clear_wallpaper_usage')"
			:content="t('clear_wallpaper_usage_confirm')"
			:confirm-text="t('clear')"
			:cancel-text="t('cancel')"
			@confirm="doClearUsed"
		/>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { apiWallpapers, apiSetWallpaper, apiAppConfig, apiClearWallpaperUsage } from '@/api/content.js'
import { setUser, getUser } from '@/utils/session.js'
import { safeBack } from '@/utils/nav.js'
import { goVip } from '@/utils/vip.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { silentListRefresh, loadWithCache, clearPageCache } from '@/utils/pageCache.js'
import { WP_LIST_KEY, APP_CONFIG_KEY, rememberWallpaper } from '@/utils/wallpaperCache.js'
import { track } from '@/utils/analytics.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()

/** used = 我的页当前+曾用；browse = 首页全量图库 */
const pageScope = ref('browse')
const isUsedMode = computed(() => pageScope.value === 'used')
const pageTitle = computed(() => (isUsedMode.value ? t('my_wallpapers') : t('wallpapers')))
const listCacheKey = computed(() => {
	if (isUsedMode.value) return 'wallpapers_used_v1'
	return WP_LIST_KEY
})

const list = ref([])
const dynamicList = ref([])
const pageNo = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const selectedId = ref(null)
const includeQuote = ref(uni.getStorageSync('wallpaper_include_quote') !== false)
const uiMode = ref('library') // library | preview
const tab = ref('static') // kept for cache key / legacy; browse always loads static into list
const showDynamicTab = ref(false)
const clearDialogOpen = ref(false)
const PAGE_SIZE = 20

const previewWall = computed(() => {
	const fromStatic = list.value.find((x) => x.id === selectedId.value)
	if (fromStatic) return fromStatic
	return dynamicList.value.find((x) => x.id === selectedId.value) || null
})

function isVideoWall(w) {
	return !!(w && (w.media_type === 'video' || w.video_url))
}

function listParams(page) {
	const params = { currentPage: page, pageSize: PAGE_SIZE }
	if (isUsedMode.value) params.used_only = 1
	else params.media_type = 'static'
	return params
}

async function loadDynamics() {
	if (isUsedMode.value || !showDynamicTab.value) {
		dynamicList.value = []
		return
	}
	try {
		const res = await apiWallpapers({
			currentPage: 1,
			pageSize: 12,
			media_type: 'video',
		})
		dynamicList.value = res.results || []
	} catch (e) {
		dynamicList.value = []
	}
}

function onPickDynamic(w) {
	if (!w) return
	if (w.locked) {
		goVip('wallpaper_lock')
		return
	}
	selectedId.value = w.id
	uiMode.value = 'preview'
}

function applyPage1(payload) {
	const rows = payload?.results || []
	list.value = rows
	pageNo.value = 2
	const totalPages = payload?.pagination?.total_pages || 1
	hasMore.value = 1 < totalPages
	// used 模式不预选（同 topics followed）；browse 可回落当前壁纸
	if (!isUsedMode.value) {
		const cur = getUser()?.wallpaper_id || null
		if (cur && rows.some((r) => r.id === cur)) selectedId.value = cur
		else if (!selectedId.value && rows[0]) selectedId.value = rows[0].id
	}
}

function bootstrapList() {
	const { hydrated, refresh } = silentListRefresh(
		listCacheKey.value,
		async () => {
			const res = await apiWallpapers(listParams(1))
			return { results: res.results || [], pagination: res.pagination || null }
		},
		applyPage1,
	)
	if (!hydrated) loadingMore.value = true
	refresh
		.catch(() => {})
		.finally(() => { loadingMore.value = false })
}

function bootstrap() {
	if (!isUsedMode.value) {
		loadWithCache(
			APP_CONFIG_KEY,
			async () => (await apiAppConfig()).results || {},
			(cfg) => {
				showDynamicTab.value = !!(
					cfg?.dynamic_wallpaper_enabled ?? cfg?.dynamic_wallpaper_tab_enabled
				)
				loadDynamics()
			},
		).catch(() => {})
	} else {
		showDynamicTab.value = false
		dynamicList.value = []
		tab.value = 'static'
		selectedId.value = null
	}

	bootstrapList()
}
async function loadMore() {
	if (uiMode.value === 'preview') return
	if (loadingMore.value || !hasMore.value) return
	loadingMore.value = true
	try {
		const next = pageNo.value
		const res = await apiWallpapers(listParams(next))
		const rows = res.results || []
		list.value = list.value.concat(rows)
		pageNo.value = next + 1
		const totalPages = res.pagination?.total_pages || 1
		hasMore.value = next < totalPages
	} finally {
		loadingMore.value = false
	}
}

onLoad((q) => {
	pageScope.value = (q?.mode === 'used') ? 'used' : 'browse'
	bootstrap()
})
onReachBottom(loadMore)

function onNavBack() {
	if (uiMode.value === 'preview') {
		uiMode.value = 'library'
		return
	}
	safeBack(isUsedMode.value ? '/pages/profile/profile' : '/pages/home/home')
}

function onClearUsed() {
	if (!isUsedMode.value || !list.value.length) return
	clearDialogOpen.value = true
}

async function doClearUsed() {
	try {
		await apiClearWallpaperUsage()
		list.value = []
		selectedId.value = null
		hasMore.value = false
		clearPageCache(listCacheKey.value)
		uni.showToast({ title: t('cleared'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	}
}

function onInclude(e) {
	includeQuote.value = e.detail.value
	uni.setStorageSync('wallpaper_include_quote', includeQuote.value)
}

/** used：点选；browse：点即进预览（库双态） */
function onPick(w) {
	if (w.locked) {
		goVip('wallpaper_lock')
		return
	}
	selectedId.value = w.id
	if (!isUsedMode.value) {
		uiMode.value = 'preview'
	}
}

function goPreview() {
	if (!selectedId.value) return
	uiMode.value = 'preview'
	track('wallpaper_preview_open', { wallpaper_id: selectedId.value, mode: 'used' })
}

function skipPreview() {
	uiMode.value = 'library'
	if (isUsedMode.value) selectedId.value = null
}

async function applyCurrent() {
	const w = previewWall.value
	if (!w) {
		uiMode.value = 'library'
		return
	}
	if (w.locked) {
		goVip('wallpaper_lock')
		return
	}
	await apiSetWallpaper(w.id)
	await rememberWallpaper(w)
	const u = getUser()
	u.wallpaper_id = w.id
	setUser(u)
	list.value = list.value.map((item) => ({
		...item,
		is_current: item.id === w.id,
	}))
	clearPageCache('wallpapers_used_v1')
	if (isVideoWall(w)) {
		track('dynamic_wallpaper_set', { wallpaper_id: w.id })
	}
	uni.showToast({ title: t('applied'), icon: 'none' })
	setTimeout(() => {
		uiMode.value = 'library'
		if (isUsedMode.value) {
			selectedId.value = null
			return
		}
		safeBack('/pages/home/home')
	}, 400)
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 160rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head {
	@include selah-sticky-head;
}
.head-glass {
	@include selah-sticky-head-glass($selah-bg-gray);
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
.nav-left {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 20rpx;
	min-width: 0;
}
.nav-title {
	@include selah-display-title;
	font-size: 40rpx;
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
.nav-spacer {
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
	visibility: hidden;
}
.unlock-pill {
	@include selah-glass-pill;
	padding: 16rpx 28rpx;
	box-sizing: border-box;
}
.unlock-text {
	font-size: 28rpx;
	color: $selah-ink;
}
.nav-action,
.nav-skip {
	font-size: 30rpx;
	line-height: 1.2;
	color: rgba(25, 25, 25, 0.45);
	padding: 16rpx 8rpx;
	font-weight: 400;
}
.nav-action:active,
.nav-skip:active {
	color: rgba(25, 25, 25, 0.72);
}
.sec-head {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	margin: 16rpx 0 12rpx;
}
.sec-title {
	@include selah-display-title;
	font-size: 36rpx;
}
.dyn-rail {
	width: 100%;
	white-space: nowrap;
	margin-bottom: 8rpx;
}
.dyn-card {
	display: inline-flex;
	position: relative;
	width: 336rpx;
	height: 472rpx;
	margin-right: 16rpx;
	border-radius: 32rpx;
	overflow: hidden;
	vertical-align: top;
	align-items: center;
	justify-content: center;
	background: $selah-card;
}
.dyn-img {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}
.dyn-label {
	position: relative;
	z-index: 1;
	font-family: $selah-font-display;
	font-style: italic;
	font-size: 48rpx;
	font-weight: 700;
	color: #ffffff;
	text-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.35);
}
.empty-card {
	padding: 32rpx;
	box-sizing: border-box;
}
.dyn-empty-text {
	font-size: 26rpx;
	color: $selah-muted;
	white-space: normal;
	text-align: center;
}
.free-tag {
	position: absolute;
	top: 12rpx;
	right: 12rpx;
	background: rgba(255, 255, 255, 0.8);
	padding: 4rpx 16rpx;
	border-radius: 32rpx;
	font-size: 22rpx;
	color: $selah-ink;
}
.dyn-badge {
	position: absolute;
	left: 12rpx;
	bottom: 12rpx;
	background: rgba(25, 25, 25, 0.72);
	padding: 4rpx 12rpx;
	border-radius: 999rpx;
}
.dyn-badge-text {
	font-size: 20rpx;
	color: #fff;
}
.toggle-card {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 32rpx;
	background: $selah-card;
	border-radius: $selah-radius-card;
	margin: 28rpx 0;
}
.toggle-label {
	font-size: 28rpx;
	color: $selah-ink;
}
.grid {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
}
.empty {
	width: 100%;
	text-align: center;
	color: $selah-muted;
	margin-top: 80rpx;
}
.item {
	width: 46%;
	margin: 0 2% 24rpx;
	height: 320rpx;
	position: relative;
	border-radius: $selah-radius-card;
	overflow: hidden;
	background: #e8e0d4;
	border: 4rpx solid transparent;
	box-sizing: border-box;
}
.item.on {
	border-color: $selah-ink;
}
.img {
	width: 100%;
	height: 100%;
}
.lock {
	position: absolute;
	right: 12rpx;
	top: 12rpx;
	background: $selah-ink;
	color: #fff;
	padding: 4rpx 12rpx;
	font-size: 20rpx;
	border-radius: 999rpx;
}
.cur {
	position: absolute;
	left: 12rpx;
	top: 12rpx;
	background: rgba(255, 255, 255, 0.9);
	color: $selah-ink;
	padding: 4rpx 12rpx;
	font-size: 20rpx;
	border-radius: 999rpx;
	font-weight: 600;
}
.tip {
	width: 100%;
	text-align: center;
	color: $selah-muted;
	padding: 24rpx;
	font-size: 22rpx;
}
.preview-img {
	width: 100%;
	height: 780rpx;
	border-radius: $selah-radius-card;
	background: #e8e0d4;
}
.foot {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(245, 245, 245, 0) 0%, $selah-bg-gray 28%);
	box-sizing: border-box;
	z-index: 20;
}
.cta {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
}
.cta-text {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
}
</style>
