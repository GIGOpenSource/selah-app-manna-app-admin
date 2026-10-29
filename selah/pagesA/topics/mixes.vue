<!--
  Theme mixes 全部列表：Themes「See all」二级页。
-->
<template>
	<view class="page">
		<template v-if="step === 'list'">
			<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="page-title nav-title" :style="titleStyle">{{ pageHeading }}</text>
					<view class="nav-spacer" />
				</view>
			</view>
			<text class="hero-title" :style="heroTitleStyle">{{ pageHeading }}</text>

			<view class="mix-grid">
				<view
					v-for="item in list"
					:key="'m' + item.id"
					class="mix-card"
					@tap="openCollection(item)"
				>
					<image
						v-if="coverSrc(item)"
						class="mix-img"
						:src="coverSrc(item)"
						mode="aspectFill"
					/>
					<text class="mix-label">{{ collectionName(item) }}</text>
				</view>
			</view>

			<view v-if="loadingMore && !list.length" class="tip">{{ t('loading') }}</view>
			<view v-if="!list.length && !loadingMore" class="empty">{{ t('empty') }}</view>
		</template>

		<template v-else-if="step === 'papers'">
			<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="page-title nav-title" :style="titleStyle">{{ pageHeading }}</text>
					<view class="nav-spacer" />
				</view>
			</view>
			<text class="hero-title" :style="heroTitleStyle">{{ pageHeading }}</text>
			<view class="mix-grid">
				<view
					v-for="item in papers"
					:key="'w' + item.id"
					class="paper-card"
					@tap="onPaperTap(item)"
				>
					<image
						v-if="paperCover(item)"
						class="mix-img"
						:src="paperCover(item)"
						mode="aspectFill"
					/>
					<text v-if="item.locked" class="badge">VIP</text>
				</view>
			</view>
			<view v-if="loadingMore && !papers.length" class="tip">{{ t('loading') }}</view>
			<view v-if="!papers.length && !loadingMore" class="empty">{{ t('empty') }}</view>
		</template>

		<template v-else>
			<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-skip" @tap="skipPreview">{{ t('skip') }}</text>
				</view>
			</view>
			<view v-if="previewItem" class="preview">
				<image
					v-if="previewCover"
					class="preview-img"
					:key="'pv-' + selectedKey"
					:src="previewCover"
					mode="aspectFill"
				/>
				<text class="preview-name">{{ collectionName(activeCollection) }}</text>
				<view class="cta" @tap="applyCurrent">
					<text class="cta-text">{{ applying ? t('loading') : t('continue') }}</text>
				</view>
			</view>
		</template>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { apiWallpaperCollections, apiWallpaperSearch, apiWallpapers, apiSetWallpaper } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getUser, setUser } from '@/utils/session.js'
import { goVip } from '@/utils/vip.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { silentListRefresh } from '@/utils/pageCache.js'
import { rememberWallpaper, wallpaperCollectionsKey } from '@/utils/wallpaperCache.js'
import { markHomeFeedStale } from '@/utils/homeFeedSync.js'
const { t, locale } = useI18n()
const statusBarPx = getStatusBarPx()
const list = ref([])
const pageNo = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const booting = ref(true)
const showBackTop = ref(false)
const broken = ref({})
const PAGE_SIZE = 24
const BACK_TOP_PX = 480
const step = ref('list')
const { titleStyle, heroTitleStyle } = useCollapsingTitle({
	mode: 'hero',
	statusBarPx,
	fontStartRpx: 48,
	fontEndRpx: 34,
	titleBlockRpx: 72,
	contentInsetRpx: 32,
	onScroll(top) {
		if (step.value !== 'list') {
			if (showBackTop.value) showBackTop.value = false
			return
		}
		const next = (top || 0) > BACK_TOP_PX
		if (next !== showBackTop.value) showBackTop.value = next
	},
})
const selectedKey = ref('')
const previewItem = computed(() => {
	const id = selectedId.value
	if (id == null || id === '') return null
	return papers.value.find((x) => String(x.id) === String(id)) || null
})
const previewCover = computed(() => paperCover(previewItem.value))
const selectedId = computed(() => {
	const k = String(selectedKey.value || '')
	const i = k.indexOf(':')
	if (i < 0) return null
	const raw = k.slice(i + 1)
	const n = Number(raw)
	return Number.isFinite(n) && raw !== '' ? n : raw || null
})
const applying = ref(false)
const papers = ref([])
const paperPage = ref(1)
const paperHasMore = ref(true)
const activeCollection = ref(null)
const tagId = ref('')
const openedDirect = ref(false)
const pageHeading = computed(() => (
	step.value === 'papers'
		? collectionName(activeCollection.value)
		: t('wallpaper_collections')
))

function collectionName(item) {
	return String(item?.name || item?.name_en || '').trim()
}

function collectionCountText(item) {
	const n = Number(item?.match_count ?? item?.wallpaper_count ?? item?.count ?? 0) || 0
	const zh = String(locale.value || '').startsWith('zh')
	if (zh) return `${n} 张壁纸`
	return `${n} wallpaper${n === 1 ? '' : 's'}`
}

function coverOf(item) {
	const url = String(item?.cover_url || item?.image_url || '').trim()
	if (!url || url.endsWith('/')) return ''
	return url
}

function coverSrc(item) {
	return coverOf(item)
}

function paperCover(item) {
	return coverOf(item)
}

function normalizeCollections(rows) {
	const bag = Array.isArray(rows) ? rows : (Array.isArray(rows?.list) ? rows.list : [])
	return bag.map((item) => {
		if (!item || typeof item !== 'object') return null
		const id = item.id ?? item.pk
		const name = collectionName(item)
		if (id == null || id === '' || !name) return null
		return { ...item, id, name }
	}).filter(Boolean).sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
}

function applyCollections(payload, meta = {}) {
	const rows = normalizeCollections(payload?.results || [])
	list.value = rows
	pageNo.value = 2
	hasMore.value = false
	if (!meta.fromCache) broken.value = {}
}

function parseCollectionRows(res) {
	const bag = res?.results
	if (Array.isArray(bag)) return bag
	if (Array.isArray(bag?.collections)) return bag.collections
	if (Array.isArray(bag?.list)) return bag.list
	return []
}

/** 优先专用合集接口；失败再静默拼搜索结果（大页、关全屏 loading） */
async function fetchAllCollections() {
	const params = { currentPage: 1, pageSize: 100 }
	if (tagId.value) params.tag_id = tagId.value
	try {
		const res = await apiWallpaperCollections(params)
		const normalized = normalizeCollections(parseCollectionRows(res))
		if (normalized.length) {
			return { results: normalized, pagination: res.pagination || null }
		}
	} catch (e) {}
	const seen = new Set()
	const out = []
	let page = 1
	while (page < 10) {
		const p = { currentPage: page, pageSize: 50 }
		if (tagId.value) p.tag_id = tagId.value
		const res = await apiWallpaperSearch(p, { showLoading: false })
		const rows = normalizeCollections((res.results || {}).collections)
		let added = 0
		rows.forEach((row) => {
			const key = String(row.id)
			if (seen.has(key)) return
			seen.add(key)
			out.push(row)
			added += 1
		})
		const totalPages = res.pagination?.total_pages
		if (totalPages ? page >= totalPages : !added) break
		page += 1
	}
	return { results: out, pagination: null }
}

function bootstrap() {
	const cacheKey = wallpaperCollectionsKey(tagId.value)
	const { hydrated, refresh } = silentListRefresh(
		cacheKey,
		fetchAllCollections,
		applyCollections,
		{
			getRevision: (d) => {
				const rows = normalizeCollections(d?.results || [])
				return `${rows.length}:${rows.map((x) => x.id).join(',')}`
			},
		},
	)
	// 仅无缓存且列表仍空时出 tip，有数据时静默刷新不闪 loading
	if (!hydrated && !list.value.length) loadingMore.value = true
	refresh
		.catch(() => {
			if (!list.value.length) list.value = []
		})
		.finally(() => {
			loadingMore.value = false
			booting.value = false
		})
}

async function loadPapers(reset = true) {
	const id = activeCollection.value?.id
	if (id == null || id === '') return
	if (!reset && (loadingMore.value || !paperHasMore.value)) return
	const page = reset ? 1 : paperPage.value
	// 首屏无数据才亮 tip；分页加载底部不闪全屏
	if (reset ? !papers.value.length : true) loadingMore.value = true
	try {
		const res = await apiWallpapers(
			{ currentPage: page, pageSize: PAGE_SIZE, collection_id: id },
			{ showLoading: false },
		)
		const rows = res.results || []
		papers.value = reset ? rows : papers.value.concat(rows)
		paperPage.value = page + 1
		const totalPages = res.pagination?.total_pages || 1
		paperHasMore.value = page < totalPages
	} catch {
		if (reset) papers.value = []
	} finally {
		loadingMore.value = false
	}
}

function openCollection(item) {
	activeCollection.value = item
	step.value = 'papers'
	papers.value = []
	paperHasMore.value = true
	loadPapers(true)
}

onLoad((q) => {
	tagId.value = q?.tag_id ? String(q.tag_id) : ''
	const id = q?.collection_id
	if (id) {
		openedDirect.value = true
		activeCollection.value = { id, name: decodeURIComponent(q.name || '') }
		step.value = 'papers'
		loadPapers(true)
		booting.value = false
		return
	}
	bootstrap()
})

onReachBottom(() => {
	if (step.value === 'papers') loadPapers(false)
})

function goBack() {
	if (step.value === 'preview') {
		step.value = 'papers'
		return
	}
	if (step.value === 'papers' && !openedDirect.value) {
		step.value = 'list'
		selectedKey.value = ''
		return
	}
	safeBack('/pagesA/topics/topics')
}

function onPaperTap(item) {
	if (item.locked) {
		goVip('wallpaper_lock')
		return
	}
	selectedKey.value = `mix:${item.id}`
	goPreview()
}

function goPreview() {
	if (!selectedId.value) return
	showBackTop.value = false
	step.value = 'preview'
}

function skipPreview() {
	step.value = 'papers'
	selectedKey.value = ''
}

async function applyCurrent() {
	if (applying.value) return
	const item = previewItem.value
	if (!item) {
		step.value = 'papers'
		return
	}
	if (item.locked) {
		goVip('wallpaper_lock')
		return
	}
	applying.value = true
	try {
		await apiSetWallpaper(item.id)
		await rememberWallpaper({
			id: item.id,
			image_url: previewCover.value || paperCover(item),
		})
		const u = getUser() || {}
		u.wallpaper_id = item.id
		setUser(u)
		import('@/utils/widgetDesktopSync.js')
			.then((mod) => mod.syncWidgetWallpaperFromSession())
			.catch(() => {})
		markHomeFeedStale()
		uni.showToast({ title: t('applied'), icon: 'none' })
		setTimeout(() => {
			safeBack('/pages/home/home')
		}, 400)
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		applying.value = false
	}
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 0 160rpx;
	background: #f5f5f5;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head {
	@include selah-sticky-head;
}
.head-glass {
	@include selah-sticky-head-glass(#f5f5f5);
}
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 0 32rpx 0;
	box-sizing: border-box;
	min-height: 88rpx;
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
.nav-skip {
	font-size: 30rpx;
	line-height: 1.2;
	color: rgba(25, 25, 25, 0.45);
	padding: 16rpx 8rpx;
	font-weight: 400;
}
.nav-skip:active {
	color: rgba(25, 25, 25, 0.72);
}
.page-title {
	@include selah-display-title;
}
.nav-title {
	flex: 1;
	text-align: center;
}
.hero-title {
	@include selah-display-title;
	display: block;
	font-size: 48rpx;
	line-height: 1.15;
	margin: 8rpx 32rpx 24rpx;
	will-change: opacity, transform;
}
/* 二级页：三列 3:4 主题合集卡片 */
.mix-grid {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	padding: 0 32rpx;
}
.mix-card {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 218rpx;
	height: 291rpx; /* 3:4 */
	margin-right: 16rpx;
	margin-bottom: 16rpx;
	border-radius: 28rpx;
	overflow: hidden;
	background: #e8e4dc;
	box-sizing: border-box;
}
.mix-card:nth-child(3n) {
	margin-right: 0;
}
.paper-card {
	position: relative;
	width: 218rpx;
	height: 291rpx; /* 3:4 */
	margin-right: 16rpx;
	margin-bottom: 16rpx;
	border-radius: 28rpx;
	overflow: hidden;
	background: #e8e4dc;
	box-sizing: border-box;
}
.paper-card:nth-child(3n) {
	margin-right: 0;
}
.mix-img {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
}
.mix-label {
	position: relative;
	z-index: 1;
	max-width: 90%;
	padding: 0 8rpx;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 30rpx;
	font-style: italic;
	font-weight: 700;
	line-height: 1.15;
	color: #ffffff;
	text-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.35);
	pointer-events: none;
}
.badge {
	position: absolute;
	top: 12rpx;
	right: 12rpx;
	z-index: 2;
	background: $selah-ink;
	color: #fff;
	font-size: 20rpx;
	padding: 4rpx 12rpx;
	border-radius: 999rpx;
}
.tip,
.empty {
	text-align: center;
	color: $selah-muted;
	padding: 32rpx;
	font-size: 24rpx;
}
.foot {
	position: fixed;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(24rpx + env(safe-area-inset-bottom));
	z-index: 10;
}
.cta {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.cta-text {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
}
.back-top {
	position: fixed;
	right: 32rpx;
	bottom: calc(40rpx + env(safe-area-inset-bottom));
	z-index: 20;
	@include selah-nav-circle;
}
.back-top.lift {
	bottom: calc(152rpx + env(safe-area-inset-bottom));
}
.back-top-ico {
	width: 48rpx;
	height: 48rpx;
}
.back-top:active {
	opacity: 0.72;
}
.preview {
	padding: 24rpx 32rpx 80rpx;
}
.preview-img {
	width: 100%;
	height: 720rpx;
	border-radius: 32rpx;
	background: #e8e4dc;
}
.preview-name {
	display: block;
	margin-top: 24rpx;
	margin-bottom: 16rpx;
	font-family: $selah-font-display;
	font-size: 48rpx;
	font-weight: 700;
	line-height: 1.1;
	text-align: center;
}
.preview-desc {
	display: block;
	margin: 8rpx 0 16rpx;
	font-size: 28rpx;
	color: #5c5c5c;
	text-align: center;
	line-height: 1.4;
}
</style>
