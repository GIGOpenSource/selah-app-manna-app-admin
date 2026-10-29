<!--
  壁纸库双态：网格 ↔ 单屏预览（Include quote / Continue）；Dynamic 滤签加载 video。
  顶栏切换全部壁纸 / 我的壁纸；清空仅在「我的壁纸」且有记录时出现。
-->
<template>
	<page-meta :overflow="pageOverflow" />
	<view class="page">
		<view class="library">
			<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-left">
						<view class="nav-pill" @tap.stop="onNavBack">
							<image
								class="nav-ico"
								:src="fromUsedEntry ? '/static/ui/ico-close.svg' : '/static/ui/ico-back.svg'"
								mode="aspectFit"
							/>
						</view>
						<text class="nav-title">{{ t('wallpapers') }}</text>
					</view>
					<text
						v-if="isUsedMode && list.length"
						class="nav-action"
						@click.stop="onClearUsed"
					>{{ t('clear') }}</text>
					<view
						v-else-if="showUnlockAll"
						class="unlock-pill"
						@tap="goVip('wallpaper_lock')"
					>
						<text class="unlock-text">{{ t('wallpaper_unlock_all') }}</text>
					</view>
					<view v-else class="nav-spacer" />
				</view>
				<view class="tabs">
					<view
						v-for="tabItem in scopeTabs"
						:key="tabItem.key"
						:class="['tab', pageScope === tabItem.key ? 'on' : '']"
						@click.stop="switchScope(tabItem.key)"
					>
						<text class="tab-label">{{ tabItem.label }}</text>
					</view>
				</view>
			</view>

			<view v-if="!isUsedMode && displayTags.length" class="tag-sec">
				<text class="tag-sec-label">{{ t('wallpaper_filter_tags') }}</text>
				<scroll-view
					scroll-x
					direction="horizontal"
					class="tag-rail"
					:show-scrollbar="false"
				>
					<view class="tag-row">
						<view
							:class="['tag-chip', !displayFilter ? 'on' : '']"
							@click="setDisplayFilter('')"
						>
							<text class="tag-chip-text">{{ t('all') }}</text>
						</view>
						<view
							v-for="tag in displayTags"
							:key="'dt-' + (tag.id || tag.filterKey)"
							:class="['tag-chip', String(displayFilter) === String(tag.id) ? 'on' : '']"
							@click="setDisplayFilter(tag.id)"
						>
							<text class="tag-chip-text">{{ tag.name }}</text>
						</view>
					</view>
				</scroll-view>
			</view>

			<template v-if="!isUsedMode && showDynamicTab">
				<view class="sec-head">
					<text class="sec-title">{{ t('wallpaper_dynamic') }}</text>
				</view>
				<scroll-view scroll-x class="dyn-rail" :show-scrollbar="false">
					<view class="dyn-rail-row">
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
					</view>
				</scroll-view>
				<view class="sec-head">
					<text class="sec-title">{{ t('wallpaper_static') }}</text>
				</view>
			</template>

			<view class="grid grid-fy">
				<view v-if="!list.length && !loadingMore" class="empty">
					{{ isUsedMode ? t('my_wallpapers_empty') : t('empty') }}
				</view>
				<view
					v-for="(w, i) in list"
					:key="w.id"
					:id="'expo-' + w.id"
					:data-xid="w.id"
					:class="['item expo-wall', selectedId === w.id ? 'on' : '', (i + 1) % 3 === 0 ? 'row-end' : '']"
					@tap="onPick(w)"
				>
					<image :src="w.poster_url || w.image_url" mode="aspectFill" class="img"/>
					<text v-if="!w.locked && !w.is_vip" class="free-tag">{{ t('free') }}</text>
					<text v-if="!isUsedMode && w.is_current" class="cur">{{ t('current') }}</text>
					<text v-if="w.locked" class="lock">VIP</text>
				</view>
			</view>
			<view
				v-if="loadingMore"
				class="tip-layer"
				:style="{ paddingTop: headHeightPx + 'px' }"
			>
				<view class="tip">{{ t('loading') }}</view>
			</view>

			<view v-if="isUsedMode && selectedId && uiMode === 'library'" class="foot">
				<view class="cta" @tap="goPreview">
					<text class="cta-text">{{ t('preview') }}</text>
				</view>
			</view>
		</view>

		<view v-if="uiMode === 'preview'" class="preview-layer" @touchmove.stop.prevent>
			<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-pill" @tap.stop="leavePreview">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-skip" @tap="skipPreview">{{ t('skip') }}</text>
				</view>
			</view>
			<view class="preview-body">
				<view class="preview" v-if="previewWall">
					<!-- AAB 里视频是 SurfaceView：父级 overflow/圆角会把它裁没，只剩封面静图 -->
					<view v-if="isVideoWall(previewWall)" class="preview-video-slot">
						<image
							v-if="previewPoster && !previewVideoPlaying"
							class="preview-img preview-poster"
							:src="previewPoster"
							mode="aspectFill"
						/>
						<video
							v-if="previewVideoOn"
							id="wallpaperPreviewVideo"
							class="preview-video"
							:src="previewWall.video_url"
							:controls="false"
							:autoplay="true"
							:loop="true"
							:muted="true"
							:playsinline="true"
							:show-center-play-btn="false"
							:show-play-btn="false"
							:show-fullscreen-btn="false"
							:show-mute-btn="false"
							:show-loading="false"
							:enable-progress-gesture="false"
							:vslide-gesture="false"
							:vslide-gesture-in-fullscreen="false"
							object-fit="cover"
							@play="onPreviewVideoPlay"
							@timeupdate="onPreviewVideoPlay"
							@error="onPreviewVideoError"
						/>
					</view>
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
					<view class="cta" @tap="setwallpaper">
						<text class="cta-text">{{ t('continue') }}</text>
					</view>
				</view>
			</view>
		</view>

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
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { onLoad, onReachBottom, onShow, onPageScroll } from '@dcloudio/uni-app'
import { apiWallpapers, apiWallpaperSearch, apiSetWallpaper, apiRecordWallpaperUsage, apiAppConfig, apiClearWallpaperUsage, apiDisplayTags } from '@/api/content.js'
import { setUser, getUser } from '@/utils/session.js'
import { safeBack } from '@/utils/nav.js'
import { goVip, isVipActive } from '@/utils/vip.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { silentListRefresh, loadWithCache, clearPageCache } from '@/utils/pageCache.js'
import { WP_LIST_KEY, APP_CONFIG_KEY, rememberWallpaper, playWallpaperVideo } from '@/utils/wallpaperCache.js'
import { setSystemWallpaper } from '@/utils/systemWallpaper.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
/** 吸顶头部高度（状态栏 + 88rpx 导航 + 80rpx 标签）：用于把「加载中」居中到头部以下的内容区 */
const headHeightPx = statusBarPx + uni.upx2px(168)
const user = ref(getUser())

const currentImage = ref('')

function assignCurrentImage(w) {
	if (!w) return
	if (isVideoWall(w)) {
		currentImage.value = String(w.poster_url || w.image_url || '').trim()
		return
	}
	currentImage.value = String(w.image_url || '').trim()
}

const setwallpaper = async () => {
	const wall = previewWall.value
	if (!wall?.id) return
	try {
		await apiRecordWallpaperUsage(wall.id)
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
		return
	}
	assignCurrentImage(wall)
	if (!currentImage.value) {
		uni.showToast({ title: t('wp_pick_image'), icon: 'none' })
		return
	}
	await setSystemWallpaper(currentImage.value, { t })
}

function onDynamicIos(w) {
	assignCurrentImage(w)
	if (!currentImage.value) {
		uni.showToast({ title: t('wp_pick_image'), icon: 'none' })
		return
	}
	setSystemWallpaper(currentImage.value, { t })
}

/** used = 我的页当前+曾用；browse = 全量图库 */
const pageScope = ref('browse')
const fromUsedEntry = ref(false)
const isUsedMode = computed(() => pageScope.value === 'used')
/** 非免费身份不展示「全部解锁」 */
const showUnlockAll = computed(() => {
	if (isUsedMode.value) return false
	if (isVipActive(user.value)) return false
	const level = String(user.value?.vip_level || 'free').toLowerCase()
	return level === 'free'
})
const scopeTabs = computed(() => [
	{ key: 'browse', label: t('all_wallpapers') },
	{ key: 'used', label: t('my_wallpapers') },
])
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
const libraryScrollTop = ref(0)
const savedLibraryScrollTop = ref(0)
const previewVideoOn = ref(false)
const previewVideoPlaying = ref(false)
let previewVideoRetry = 0
let previewVideoKickTimer = 0
const tab = ref('static') // kept for cache key / legacy; browse always loads static into list
const showDynamicTab = ref(false)
const displayTags = ref([])
const displayFilter = ref('')
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

/** 视频预览不能把页面 overflow 锁成 hidden，否则正式包 SurfaceView 被裁掉，只剩封面 */
const pageOverflow = computed(() => {
	if (clearDialogOpen.value) return 'visible'
	if (uiMode.value !== 'preview') return 'visible'
	if (isVideoWall(previewWall.value)) return 'visible'
	return 'hidden'
})

const previewPoster = computed(() => {
	const w = previewWall.value
	if (!w) return ''
	return String(w.poster_url || w.image_url || '').trim()
})

function clearPreviewVideoKick() {
	if (!previewVideoKickTimer) return
	clearTimeout(previewVideoKickTimer)
	previewVideoKickTimer = 0
}

function kickPreviewVideo(attempt) {
	if (uiMode.value !== 'preview' || !previewVideoOn.value) return
	playWallpaperVideo('wallpaperPreviewVideo')
	if (attempt >= 4) return
	clearPreviewVideoKick()
	previewVideoKickTimer = setTimeout(() => kickPreviewVideo(attempt + 1), 400)
}

function onPreviewVideoPlay() {
	previewVideoPlaying.value = true
}

function onPreviewVideoError() {
	previewVideoPlaying.value = false
	clearPreviewVideoKick()
	if (previewVideoRetry >= 2) {
		previewVideoOn.value = false
		return
	}
	previewVideoRetry += 1
	previewVideoOn.value = false
	nextTick(() => {
		if (uiMode.value !== 'preview' || !isVideoWall(previewWall.value)) return
		previewVideoOn.value = true
		nextTick(() => kickPreviewVideo(0))
	})
}

function stopPreviewVideo() {
	try {
		const ctx = uni.createVideoContext('wallpaperPreviewVideo')
		if (!ctx) return
		if (typeof ctx.pause === 'function') ctx.pause()
		if (typeof ctx.stop === 'function') ctx.stop()
		if (typeof ctx.exitFullScreen === 'function') ctx.exitFullScreen()
	} catch (e) {}
}

onPageScroll((e) => {
	if (uiMode.value !== 'library') return
	libraryScrollTop.value = e.scrollTop || 0
})

function enterPreview() {
	savedLibraryScrollTop.value = libraryScrollTop.value
	uiMode.value = 'preview'
}

function restoreLibraryScroll() {
	const top = savedLibraryScrollTop.value
	const apply = () => uni.pageScrollTo({ scrollTop: top, duration: 0 })
	nextTick(() => {
		apply()
		setTimeout(apply, 32)
	})
}

function leavePreview() {
	clearPreviewVideoKick()
	stopPreviewVideo()
	previewVideoOn.value = false
	previewVideoPlaying.value = false
	uiMode.value = 'library'
	restoreLibraryScroll()
}

watch(uiMode, (mode) => {
	clearPreviewVideoKick()
	previewVideoPlaying.value = false
	previewVideoRetry = 0
	if (mode === 'preview' && isVideoWall(previewWall.value)) {
		previewVideoOn.value = true
		nextTick(() => kickPreviewVideo(0))
		return
	}
	stopPreviewVideo()
	previewVideoOn.value = false
})

function tagFilterKey(tag) {
	const nameEn = String(tag?.name_en || tag?.nameEn || '').trim()
	if (nameEn) return nameEn
	return String(tag?.name || tag?.label || '').trim()
}

function normalizeWallpaperTags(rows) {
	const bag = Array.isArray(rows) ? rows : (Array.isArray(rows?.list) ? rows.list : [])
	return bag.map((tag) => {
		if (!tag || typeof tag !== 'object') return null
		const filterKey = tagFilterKey(tag)
		if (!filterKey) return null
		const name = String(tag.name || tag.label || tag.name_en || tag.nameEn || '').trim() || filterKey
		return { ...tag, id: tag.id ?? tag.pk ?? filterKey, name, filterKey }
	}).filter(Boolean)
}

function searchWallpapers(res) {
	const bag = res?.results || {}
	return Array.isArray(bag.wallpapers) ? bag.wallpapers : []
}

function listParams(page) {
	if (isUsedMode.value) {
		return { currentPage: page, pageSize: PAGE_SIZE, used_only: 1 }
	}
	const params = { currentPage: page, pageSize: 10, media_type: 'static' }
	if (displayFilter.value) params.tag_id = displayFilter.value
	return params
}

function fetchPage(page) {
	if (isUsedMode.value) {
		return apiWallpapers(listParams(page), { showLoading: true, loadingTime: 0, loadingMask: true }).then((res) => ({
			results: res.results || [],
			pagination: res.pagination || null,
		}))
	}
	return apiWallpaperSearch(listParams(page)).then((res) => ({
		results: searchWallpapers(res),
		pagination: res.pagination || null,
	}))
}

function setDisplayFilter(name) {
	const next = String(name || '').trim()
	if (displayFilter.value === next) return
	displayFilter.value = next
	clearPageCache(listCacheKey.value)
	pageNo.value = 1
	hasMore.value = true
	list.value = []
	loadingMore.value = true
	loadDynamics()
	fetchPage(1)
		.then(applyPage1)
		.catch(() => { list.value = [] })
		.finally(() => { loadingMore.value = false })
}

async function loadDisplayTags() {
	if (isUsedMode.value) {
		displayTags.value = []
		return
	}
	try {
		const res = await apiDisplayTags('wallpaper')
		displayTags.value = normalizeWallpaperTags(res.results || res.data || [])
	} catch {
		displayTags.value = []
	}
}

async function loadDynamics() {
	if (isUsedMode.value || !showDynamicTab.value) {
		dynamicList.value = []
		return
	}
	try {
		const params = {
			currentPage: 1,
			pageSize: 10,
			media_type: 'video',
		}
		if (displayFilter.value) params.tag_id = displayFilter.value
		const res = await apiWallpaperSearch(params)
		dynamicList.value = searchWallpapers(res)
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
	assignCurrentImage(w)
	enterPreview()
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
			const page = await fetchPage(1)
			return page
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
		loadDisplayTags()
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
		const page = await fetchPage(next)
		const rows = page.results || []
		list.value = list.value.concat(rows)
		pageNo.value = next + 1
		const totalPages = page.pagination?.total_pages || 1
		hasMore.value = totalPages ? next < totalPages : rows.length >= (isUsedMode.value ? PAGE_SIZE : 10)
	} finally {
		loadingMore.value = false
	}
}

function syncUser() {
	user.value = getUser()
}

onLoad((q) => {
	fromUsedEntry.value = q?.mode === 'used'
	pageScope.value = 'browse'
	syncUser()
	bootstrap()
})
onShow(syncUser)
onReachBottom(loadMore)

function switchScope(scope) {
	if (pageScope.value === scope) return
	pageScope.value = scope
	uiMode.value = 'library'
	selectedId.value = null
	list.value = []
	pageNo.value = 1
	hasMore.value = true
	loadingMore.value = false
	bootstrap()
}

function onNavBack() {
	if (uiMode.value === 'preview') {
		leavePreview()
		return
	}
	safeBack(fromUsedEntry.value ? '/pages/profile/profile' : '/pages/home/home')
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
	assignCurrentImage(w)
	if (!isUsedMode.value) {
		enterPreview()
	}
}

function goPreview() {
	if (!selectedId.value) return
	assignCurrentImage(previewWall.value)
	enterPreview()
}

function skipPreview() {
	leavePreview()
	if (isUsedMode.value) selectedId.value = null
}

async function applyCurrent() {
	const w = previewWall.value
	if (!w) {
		leavePreview()
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
	import('@/utils/widgetDesktopSync.js')
		.then((mod) => mod.syncWidgetWallpaperFromSession())
		.catch(() => {})
	list.value = list.value.map((item) => ({
		...item,
		is_current: item.id === w.id,
	}))
	clearPageCache('wallpapers_used_v1')
	stopPreviewVideo()
	previewVideoOn.value = false
	await nextTick()
	leavePreview()
	if (isUsedMode.value) selectedId.value = null
	uni.showToast({ title: t('applied'), icon: 'none' })
	if (isUsedMode.value) return
	setTimeout(() => {
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
.preview-layer {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 300;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}
.preview-layer .page-head {
	flex-shrink: 0;
	padding-left: 32rpx;
	padding-right: 32rpx;
}
.preview-body {
	flex: 1;
	height: 0;
	padding: 0 32rpx 80rpx;
	box-sizing: border-box;
	overflow: visible;
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
.tabs {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	padding: 0 0 16rpx;
}
.tab {
	flex: 1;
	min-width: 0;
	height: 64rpx;
	padding: 0 8rpx;
	margin-right: 10rpx;
	border-radius: 32rpx;
	background: $selah-card;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.tab:last-child {
	margin-right: 0;
}
.tab.on { background: $selah-ink; }
.tag-sec {
	display: flex;
	flex-direction: column;
	padding: 0 0 16rpx;
}
.tag-sec-label {
	display: block;
	flex-shrink: 0;
	font-size: 22rpx;
	line-height: 32rpx;
	color: $selah-muted;
	margin-bottom: 16rpx;
}
.tag-rail {
	width: 100%;
	height: 72rpx;
	white-space: nowrap;
}
.tag-row {
	display: inline-flex;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: center;
	height: 72rpx;
	padding-right: 24rpx;
}
.tag-chip {
	display: flex;
	flex-direction: row;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	height: 56rpx;
	padding: 0 28rpx;
	margin-right: 12rpx;
	border-radius: 28rpx;
	background: $selah-card;
	box-sizing: border-box;
}
.tag-chip.on {
	background: $selah-ink;
	color: #ffffff;
}
.tag-chip-text {
	font-size: 24rpx;
	font-weight: 600;
	line-height: 56rpx;
	color: $selah-ink;
	white-space: nowrap;
	pointer-events: none;
}
.tag-chip.on .tag-chip-text,
.tag-chip.on text {
	color: #ffffff;
}
.tab-label {
	font-size: 22rpx;
	font-weight: 600;
	color: $selah-muted;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.tab.on .tab-label { color: #ffffff; }
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
	width: 750rpx;
	margin-left: -32rpx;
	white-space: nowrap;
	margin-bottom: 8rpx;
}
.dyn-rail-row {
	display: inline-flex;
	flex-direction: row;
	align-items: stretch;
	padding: 0 32rpx 8rpx;
	box-sizing: border-box;
}
.dyn-card {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 336rpx;
	height: 448rpx;
	margin-right: 16rpx;
	border-radius: 32rpx;
	overflow: hidden;
	flex-shrink: 0;
	vertical-align: top;
	background: #e8e4dc;
	box-sizing: border-box;
}
.dyn-img {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
}
.dyn-label {
	position: relative;
	z-index: 1;
	max-width: 86%;
	padding: 0 16rpx;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 44rpx;
	font-style: italic;
	font-weight: 700;
	line-height: 1.15;
	color: #ffffff;
	text-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.35);
	pointer-events: none;
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
.preview {
	position: relative;
	z-index: 1;
}
.preview-video-slot {
	position: relative;
	width: 100%;
	height: calc(686rpx * 4 / 3);
	background: #e8e0d4;
	overflow: visible;
	border-radius: 0;
}
.preview-img {
	width: 100%;
	height: calc(686rpx * 4 / 3);
	border-radius: $selah-radius-card;
	background: #e8e0d4;
	overflow: hidden;
	position: relative;
	z-index: 0;
	pointer-events: none;
}
.preview-poster {
	position: absolute;
	left: 0;
	top: 0;
	z-index: 0;
	height: 100%;
}
.preview-video {
	position: absolute;
	left: 0;
	top: 0;
	z-index: 1;
	width: 100%;
	height: calc(686rpx * 4 / 3);
	display: block;
	overflow: visible;
	border-radius: 0;
	background: transparent;
}
.preview-video :deep(video),
.preview-video :deep(.uni-video-container),
.preview-video :deep(.uni-video-video) {
	width: 100% !important;
	height: 100% !important;
	object-fit: cover !important;
	opacity: 1 !important;
	background: transparent !important;
	pointer-events: none !important;
}
.preview-video :deep(.uni-video-cover) {
	display: none !important;
	opacity: 0 !important;
}
.toggle-card {
	position: relative;
	z-index: 2;
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
/* 全部壁纸 / 我的壁纸：同一套三列 3:4 竖卡 */
.grid-fy .item {
	width: 218rpx;
	height: calc(218rpx * 4 / 3);
	margin: 0 16rpx 32rpx 0;
	background: #e8e4dc;
}
.grid-fy .item.row-end {
	margin-right: 0;
}
.empty {
	width: 100%;
	text-align: center;
	color: $selah-muted;
	margin-top: 80rpx;
}
.item {
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
	position: absolute;
	left: 0;
	top: 0;
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
/* 「加载中」居中在吸顶头部以下的内容区正中（不随列表滚动，也不贴列表末尾） */
.tip-layer {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 90;
	display: flex;
	align-items: center;
	justify-content: center;
	pointer-events: none;
	box-sizing: border-box;
}
.tip {
	text-align: center;
	color: $selah-muted;
	padding: 24rpx;
	font-size: 22rpx;
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
	position: relative;
	z-index: 2;
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
