<!--
  Themes：列表 + 三连（选 → 预览 → follow-topic）；无 New Post。
-->
<template>
	<view class="page">
		<template v-if="step === 'list'">
			<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
					</view>
					<text
						v-if="isFollowedMode && list.length"
						class="nav-action"
						@tap="onClearFollowed"
					>{{ t('clear') }}</text>
					<view v-else class="nav-spacer" />
				</view>
				<view class="title-spacer" :style="spacerStyle" />
				<text class="page-title" :style="titleStyle">{{ pageTitle }}</text>
			</view>

			<scroll-view v-if="!isFollowedMode" scroll-x class="chips" :show-scrollbar="false">
				<view class="chips-row">
					<view class="chip" @tap="surprise">
						<image class="chip-ico" src="/static/ui/ico-surprise.svg" mode="aspectFit" />
						<text>{{ t('surprise_me') }}</text>
					</view>
					<view :class="['chip', filter === 'all' ? 'on' : '']" @tap="filter = 'all'">
						<text :class="filter === 'all' ? 'chip-on-text' : ''">{{ t('all') }}</text>
					</view>
					<view
						v-for="cat in chipCats"
						:key="'c' + cat"
						:class="['chip', filter === cat ? 'on' : '']"
						@tap="filter = cat"
					>
						<text :class="filter === cat ? 'chip-on-text' : ''">{{ catLabel(cat) }}</text>
					</view>
				</view>
			</scroll-view>

			<template v-if="!isFollowedMode">
				<view class="sec-head">
					<text class="sec-title">{{ t('theme_mixes') }}</text>
					<view class="sec-link-hit" @tap.stop="onSeeAll('mix')">
						<text class="sec-link">{{ t('see_all') }}</text>
					</view>
				</view>
				<scroll-view scroll-x class="mix-scroll" :show-scrollbar="false">
					<view class="mix-row">
						<view
							v-for="(item, i) in mixList"
							:key="'m' + item.id"
							:class="['mix-card', selectedId === item.id ? 'picked' : '']"
							@tap="selectTheme(item)"
						>
							<image
								class="mix-img"
								:src="coverSrc(item, i, 'mix')"
								mode="aspectFill"
								@error="onCoverError(item.id, i, 'mix')"
							/>
							<text :class="['mix-name', i === 0 ? 'light' : '']">{{ item.name }}</text>
							<text v-if="item.locked" class="badge">VIP</text>
						</view>
					</view>
				</scroll-view>
			</template>

			<view v-if="!isFollowedMode" id="topics-for-you" class="sec-head">
				<text class="sec-title">{{ t('for_you') }}</text>
				<view class="sec-link-hit" @tap.stop="onSeeAll('for_you')">
					<text class="sec-link">{{ t('see_all') }}</text>
				</view>
			</view>
			<view :class="['grid3', isFollowedMode ? 'grid3-solo' : '']">
				<view
					v-for="(item, i) in forYouList"
					:key="item.id"
					:class="['fy-card', selectedId === item.id ? 'selected' : '']"
					@tap="selectTheme(item)"
				>
					<image
						class="fy-img"
						:src="coverSrc(item, i, 'fy')"
						mode="aspectFill"
						@error="onCoverError(item.id, i, 'fy')"
					/>
					<text :class="['aa', darkAa(i) ? 'light' : '']">Aa</text>
					<text v-if="!item.locked && i === 4 && !isFollowedMode" class="tag">{{ t('free') }}</text>
					<text v-if="item.locked" class="badge">VIP</text>
				</view>
			</view>

			<view v-if="loadingMore" class="tip">...</view>
			<view v-if="!list.length && !loadingMore" class="empty">
				{{ isFollowedMode ? t('topics_followed_empty') : t('empty') }}
			</view>
			<view v-else-if="!forYouList.length && !loadingMore" class="empty">{{ t('empty') }}</view>

			<view v-if="selectedId" class="foot">
				<view class="cta" @tap="goPreview">
					<text class="cta-text">{{ t('preview') }}</text>
				</view>
			</view>
		</template>

		<!-- 预览步：封面 + Follow -->
		<template v-else>
			<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-pill" @tap.stop="step = 'list'">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-skip" @tap="skipPreview">{{ t('skip') }}</text>
				</view>
			</view>
			<view class="preview" v-if="previewItem">
				<image class="preview-img" :src="previewCover" mode="aspectFill" />
				<text class="preview-name">{{ previewItem.name }}</text>
				<text v-if="previewItem.description" class="preview-desc">{{ previewItem.description }}</text>
				<view class="cta" @tap="confirmFollow">
					<text class="cta-text">{{ following ? t('unfollow') : t('follow_theme') }}</text>
				</view>
			</view>
		</template>
		<selah-dialog
			v-model:visible="clearDialogOpen"
			:title="t('clear_followed_topics')"
			:content="t('clear_followed_topics_confirm')"
			:confirm-text="t('clear')"
			:cancel-text="t('cancel')"
			@confirm="doClearFollowed"
		/>
	</view>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { apiTopics, apiContentEnums, apiFollowTopic, apiClearFollowedTopics } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { goVip } from '@/utils/vip.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { silentListRefresh, loadWithCache, clearPageCache } from '@/utils/pageCache.js'
import { TOPICS_PAGE1_KEY } from '@/utils/wallpaperCache.js'
import { track } from '@/utils/analytics.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle, spacerStyle } = useCollapsingTitle({
	mode: 'hero',
	statusBarPx,
	fontStartRpx: 48,
	fontEndRpx: 34,
	titleBlockRpx: 72,
	contentInsetRpx: 32,
})
/** followed = 我的页仅已关注；browse = 首页全量 */
const pageMode = ref('browse')
const isFollowedMode = computed(() => pageMode.value === 'followed')
const pageTitle = computed(() => (isFollowedMode.value ? t('topics_you_follow') : t('themes')))
const listCacheKey = computed(() => (isFollowedMode.value ? 'topics_followed_v1' : TOPICS_PAGE1_KEY))

const list = ref([])
const pageNo = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const filter = ref('all')
const broken = ref({})
const PAGE_SIZE = 24
const step = ref('list') // list | preview
const selectedId = ref(null)
const following = ref(false)
const clearDialogOpen = ref(false)
const LOCAL_COVERS = [
	'/static/ui/themes/fy-1.jpg',
	'/static/ui/themes/fy-2.jpg',
	'/static/ui/themes/fy-3.jpg',
	'/static/ui/themes/fy-5.jpg',
	'/static/ui/themes/mix-1.jpg',
	'/static/ui/themes/mix-2.jpg',
]

const catLabelMap = ref({})

const chipCats = computed(() => {
	const seen = []
	list.value.forEach((t) => {
		const c = (t.category || '').trim()
		if (c && !seen.includes(c)) seen.push(c)
	})
	return seen
})

const visible = computed(() => {
	if (filter.value === 'all') return list.value
	return list.value.filter((x) => x.category === filter.value)
})

const mixList = computed(() => visible.value.slice(0, 6))
const forYouList = computed(() => visible.value)

const previewItem = computed(() => list.value.find((x) => x.id === selectedId.value) || null)
const previewCover = computed(() => {
	const item = previewItem.value
	if (!item) return LOCAL_COVERS[0]
	return coverOf(item) || localCover(0)
})

function topicListParams(page) {
	const params = { currentPage: page, pageSize: PAGE_SIZE }
	if (isFollowedMode.value) params.followed_only = 1
	return params
}

function catLabel(cat) {
	const hit = catLabelMap.value[cat]
	if (hit) return hit
	return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : ''
}

function coverOf(item) {
	const url = (item.cover_url || item.image_url || '').trim()
	if (!url) return ''
	if (url.endsWith('/')) return ''
	return url
}

function localCover(i) {
	return LOCAL_COVERS[Math.abs(i) % LOCAL_COVERS.length]
}

function coverSrc(item, i, kind) {
	const key = `${kind}:${item.id}`
	if (broken.value[key]) return localCover(i)
	return coverOf(item) || localCover(i)
}

function onCoverError(id, i, kind) {
	const key = `${kind}:${id}`
	if (broken.value[key]) return
	broken.value = { ...broken.value, [key]: true }
}

function darkAa(i) {
	return i === 7 || i === 12
}

function applyPage1(payload, meta = {}) {
	const rows = payload?.results || []
	list.value = rows
	pageNo.value = 2
	const totalPages = payload?.pagination?.total_pages || 1
	hasMore.value = 1 < totalPages
	if (!meta.fromCache) broken.value = {}
}

function bootstrap() {
	if (!isFollowedMode.value) {
		loadWithCache(
			'topic_categories_v1',
			async () => {
				const res = await apiContentEnums()
				return (res.results || {}).topic_categories || []
			},
			(rows) => {
				const map = {}
				;(rows || []).forEach((r) => {
					if (r && r.value) map[r.value] = r.label || r.value
				})
				catLabelMap.value = map
			},
		).catch(() => {})
	}

	const { hydrated, refresh } = silentListRefresh(
		listCacheKey.value,
		async () => {
			const res = await apiTopics(topicListParams(1))
			return { results: res.results || [], pagination: res.pagination || null }
		},
		applyPage1,
	)
	if (!hydrated) loadingMore.value = true
	refresh
		.catch(() => {})
		.finally(() => { loadingMore.value = false })
}

async function loadMore() {
	if (loadingMore.value || !hasMore.value) return
	loadingMore.value = true
	try {
		const next = pageNo.value
		const res = await apiTopics(topicListParams(next))
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
	pageMode.value = (q?.mode === 'followed') ? 'followed' : 'browse'
	bootstrap()
})

onReachBottom(loadMore)

function goBack() {
	if (step.value === 'preview') {
		step.value = 'list'
		return
	}
	safeBack(isFollowedMode.value ? '/pages/profile/profile' : '/pages/home/home')
}

function onClearFollowed() {
	if (!isFollowedMode.value || !list.value.length) return
	clearDialogOpen.value = true
}

async function doClearFollowed() {
	try {
		await apiClearFollowedTopics()
		list.value = []
		selectedId.value = null
		hasMore.value = false
		clearPageCache(listCacheKey.value)
		uni.showToast({ title: t('cleared'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	}
}

function surprise() {
	const pool = visible.value.filter((x) => !x.locked)
	const pick = pool[Math.floor(Math.random() * pool.length)] || visible.value[0] || list.value[0]
	if (pick) selectTheme(pick)
}

/** Theme mixes / For you「查看全部」：清筛选并滚到 For you 全量网格（稿双入口） */
function onSeeAll(section) {
	filter.value = 'all'
	if (section === 'mix') {
		nextTick(() => {
			uni.pageScrollTo({
				selector: '#topics-for-you',
				duration: 280,
				fail: () => {
					// H5 部分环境无 selector：估一个偏移滚过横滑区
					uni.pageScrollTo({ scrollTop: 420, duration: 280 })
				},
			})
		})
		return
	}
	// For you：继续拉下一页，直到可滚动
	if (hasMore.value) loadMore()
}

function selectTheme(item) {
	if (item.locked) {
		goVip('topic_lock')
		return
	}
	selectedId.value = item.id
	following.value = !!item.followed
}

function goPreview() {
	if (!selectedId.value) return
	step.value = 'preview'
	track('theme_preview_open', { topic_id: selectedId.value })
}

function skipPreview() {
	step.value = 'list'
	selectedId.value = null
}

async function confirmFollow() {
	const item = previewItem.value
	if (!item) return
	try {
		if (following.value) {
			await apiFollowTopic(item.id, false)
			item.followed = false
			following.value = false
			track('topic_unfollow', { topic_id: item.id })
			uni.showToast({ title: t('unfollow'), icon: 'none' })
			if (isFollowedMode.value) {
				list.value = list.value.filter((x) => x.id !== item.id)
			}
			setTimeout(() => {
				step.value = 'list'
				selectedId.value = null
			}, 400)
			return
		}
		await apiFollowTopic(item.id, true)
		item.followed = true
		following.value = true
		track('theme_pick_complete', { topic_id: item.id })
		uni.showToast({ title: t('following'), icon: 'none' })
		setTimeout(() => {
			step.value = 'list'
			selectedId.value = null
		}, 400)
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
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
.title-spacer {
	position: relative;
	z-index: 0;
	pointer-events: none;
	margin: 0 32rpx;
}
.page-title {
	@include selah-display-title;
}
.chips {
	width: 100%;
	height: 100rpx;
	margin-bottom: 8rpx;
}
.chips-row {
	display: inline-flex;
	flex-direction: row;
	align-items: center;
	height: 100rpx;
	padding: 0 32rpx;
	box-sizing: border-box;
}
.chip {
	display: inline-flex;
	flex-direction: row;
	align-items: center;
	height: 84rpx;
	padding: 0 24rpx;
	margin-right: 16rpx;
	background: #ffffff;
	border-radius: 32rpx;
	font-size: 28rpx;
	color: $selah-ink;
	flex-shrink: 0;
	box-sizing: border-box;
}
.chip.on {
	background: $selah-ink;
}
.chip-on-text {
	color: #ffffff;
}
.chip-ico {
	width: 44rpx;
	height: 44rpx;
	margin-right: 8rpx;
}
.sec-head {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 32rpx 12rpx;
	position: relative;
	z-index: 2;
}
.sec-title {
	@include selah-display-title;
	font-size: 36rpx;
}
.sec-link-hit {
	padding: 12rpx 8rpx 12rpx 24rpx;
	flex-shrink: 0;
}
.sec-link {
	font-size: 28rpx;
	color: #0a0a0a;
	line-height: 1.2;
}
.sec-link-hit:active .sec-link {
	opacity: 0.55;
}
.mix-scroll {
	width: 100%;
	height: 216rpx;
	margin-bottom: 8rpx;
}
.mix-row {
	display: inline-flex;
	flex-direction: row;
	align-items: center;
	height: 216rpx;
	padding: 0 32rpx 8rpx;
	box-sizing: border-box;
}
.mix-card {
	position: relative;
	width: 336rpx;
	height: 200rpx;
	margin-right: 16rpx;
	border-radius: 32rpx;
	overflow: hidden;
	flex-shrink: 0;
	background: #e8e4dc;
	border: 4rpx solid transparent;
	box-sizing: border-box;
}
.mix-card.picked {
	border-color: $selah-ink;
}
.mix-img {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
}
.mix-name {
	position: absolute;
	left: 24rpx;
	right: 24rpx;
	top: 50%;
	margin-top: -28rpx;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 48rpx;
	font-style: italic;
	font-weight: 700;
	color: #000000;
	z-index: 1;
}
.mix-name.light {
	color: #ffffff;
}
.grid3 {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	padding: 0 32rpx;
}
.grid3-solo {
	padding-top: 8rpx;
}
.fy-card {
	position: relative;
	width: 218rpx;
	height: 306rpx;
	margin-right: 16rpx;
	margin-bottom: 32rpx;
	border-radius: 32rpx;
	overflow: hidden;
	background: #e8e4dc;
	box-sizing: border-box;
	border: 4rpx solid transparent;
}
.fy-card:nth-child(3n) {
	margin-right: 0;
}
.fy-card.selected {
	border-color: $selah-ink;
}
.fy-img {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
}
.aa {
	position: absolute;
	left: 0;
	right: 0;
	top: 50%;
	margin-top: -20rpx;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 32rpx;
	font-weight: 700;
	color: $selah-ink;
	z-index: 1;
}
.aa.light {
	color: #ffffff;
}
.tag {
	position: absolute;
	right: 16rpx;
	bottom: 16rpx;
	z-index: 2;
	padding: 4rpx 20rpx;
	border-radius: 32rpx;
	background: rgba(255, 255, 255, 0.8);
	font-size: 24rpx;
	color: $selah-ink;
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
	margin-top: 32rpx;
	font-family: $selah-font-display;
	font-size: 48rpx;
	font-weight: 700;
	text-align: center;
}
.preview-desc {
	display: block;
	margin: 16rpx 0 40rpx;
	font-size: 28rpx;
	color: #5c5c5c;
	text-align: center;
	line-height: 1.4;
}
</style>
