<!--
  Themes：列表 + 预览 + 应用（同壁纸 Continue）；无 New Post。
-->
<template>
	<view class="page">
		<template v-if="step === 'list'">
			<view class="page-head" :style="{ paddingTop: pickerMode ? '32rpx' : statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
					</view>
					<text class="page-title nav-title" :style="titleStyle">{{ pageTitle }}</text>
					<text
						v-if="isFollowedMode && list.length"
						class="nav-action"
						@tap="onNavAction"
					>{{ navActionLabel }}</text>
					<view v-else class="nav-spacer" />
				</view>
			</view>
			<text class="hero-title" :style="heroTitleStyle">{{ pageTitle }}</text>
			<text v-if="!isFollowedMode && !pickerMode" class="hero-subtitle">{{ t('themes_page_subtitle') }}</text>

			<scroll-view scroll-x class="chips" :show-scrollbar="false">
				<view class="chips-row">
					<view v-if="!isFollowedMode" class="chip" @tap="surprise">
						<image class="chip-ico" src="/static/ui/ico-surprise.svg" mode="aspectFit" />
						<text>{{ t('surprise_me') }}</text>
					</view>
					<view :class="['chip', filter === 'all' ? 'on' : '']" @tap="setFilter('all')">
						<text :class="filter === 'all' ? 'chip-on-text' : ''">{{ t('all') }}</text>
					</view>
					<view
						v-for="tag in displayTags"
						:key="'c' + tag.id"
						:class="['chip', String(filter) === String(tag.id) ? 'on' : '']"
						@tap="setFilter(tag.id)"
					>
						<text :class="String(filter) === String(tag.id) ? 'chip-on-text' : ''">{{ tag.name }}</text>
					</view>
				</view>
			</scroll-view>

			<template v-if="!isFollowedMode && !pickerMode && mixList.length">
				<view class="sec-head">
					<text class="sec-title">{{ t('wallpaper_collections') }}</text>
					<view class="sec-link-hit" @click.stop="onSeeAll">
						<text class="sec-link">{{ t('see_all') }}</text>
					</view>
				</view>
				<scroll-view scroll-x class="mix-rail" :show-scrollbar="false" @scroll="onCollectionSwipe">
					<view class="mix-rail-row">
						<view
							v-for="item in mixList"
							:key="'m' + item.id"
							class="mix-card expo-mix"
							:id="'expo-' + item.id"
							:data-xid="item.id"
							@tap="openCollection(item)"
						>
							<image
								v-if="coverUrl(item)"
								class="mix-img"
								:src="coverUrl(item)"
								mode="aspectFill"
							/>
							<text class="mix-label">{{ collectionName(item) }}</text>
							<text v-if="item.vip" class="badge">VIP</text>
						</view>
					</view>
				</scroll-view>
			</template>

			<view v-if="!isFollowedMode" id="topics-for-you" class="sec-head">
				<text class="sec-title">{{ t('for_you') }}</text>
				<view class="sec-link-hit">
					 <!-- @tap.stop="onSeeAll" -->
					<!-- <text class="sec-link">{{ t('see_all') }}</text> -->
				</view>
			</view>
			<view :class="['grid3', isFollowedMode ? 'grid3-solo' : '']">
				<view
					v-for="(item, i) in forYouList"
					:key="item.id"
					:id="'expo-' + item.id"
					:data-xid="item.id"
					:class="[
						'fy-card expo-theme',
						!selecting && selectedKey === 'fy:' + item.id ? 'selected' : '',
						selecting && isChecked(item.id) ? 'checked' : '',
					]"
					@tap="onCardTap(item, 'fy')"
				>
					<image
						v-if="coverUrl(item)"
						class="fy-img"
						:src="coverUrl(item)"
						mode="aspectFill"
						@load="onThemeImage(item, true)"
						@error="onThemeImage(item, false)"
					/>
					<text :class="['aa', darkAa(i) ? 'light' : '']">Aa</text>
					<image
						v-if="selecting"
						class="check-ico"
						:src="isChecked(item.id) ? '/static/ui/radio-on.svg' : '/static/ui/radio-off.svg'"
						mode="aspectFit"
					/>
					<text v-if="!item.locked && i === 4 && !isFollowedMode" class="tag">{{ t('free') }}</text>
					<text v-if="item.locked" class="badge">VIP</text>
				</view>
			</view>

			<view v-if="loadingMore" class="tip">{{ t('loading') }}</view>
			<view v-if="isFollowedMode && !list.length && !loadingMore" class="empty">
				{{ t('topics_followed_empty') }}
			</view>
			<view v-else-if="!forYouList.length && !loadingMore" class="empty">{{ t('empty') }}</view>

			<view v-if="selectedId && !selecting" class="foot">
				<view class="cta" @tap="goPreview">
					<text class="cta-text">{{ t('preview') }}</text>
				</view>
			</view>
		</template>

		<!-- 预览步：封面 + 继续应用（同壁纸页） -->
		<template v-else>
			<view class="page-head" :style="{ paddingTop: pickerMode ? '32rpx' : statusBarPx + 'px' }">
				<view class="head-glass" />
				<view class="custom-nav">
					<view class="nav-pill" @tap.stop="leavePreview">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-skip" @tap="skipPreview">{{ t('skip') }}</text>
				</view>
			</view>
			<view class="preview" v-if="previewItem">
				<image
					v-if="previewCover"
					class="preview-img"
					:key="'pv-' + selectedKey"
					:src="previewCover"
					mode="aspectFill"
				/>
				<text class="preview-name">{{ topicLabel(previewItem) }}</text>
				<text v-if="previewItem.description" class="preview-desc">{{ previewItem.description }}</text>
				<view class="cta" @tap="applyCurrent">
					<text class="cta-text">{{ t('continue') }}</text>
				</view>
			</view>
		</template>
		<selah-dialog
			v-model:visible="clearDialogOpen"
			:title="t('delete')"
			:content="t('delete_selected_followed_confirm')"
			:confirm-text="t('delete')"
			:cancel-text="t('cancel')"
			@confirm="doDeleteFollowed"
		/>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount, getCurrentInstance, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { apiTopics, apiDisplayTags, apiWallpaperSearch, apiSetWallpaper, apiFollowTopic } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { goVip } from '@/utils/vip.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { silentListRefresh, loadWithCache, clearPageCache, writePageCache } from '@/utils/pageCache.js'
import { TOPICS_PAGE1_KEY, rememberWallpaper, wallpaperCollectionsKey } from '@/utils/wallpaperCache.js'
import { applyHomeThemeLook, clearHomeFeedTopicIf, getHomeFeedTopicId, markHomeFeedStale, HOME_THEME_APPLY_EVENT } from '@/utils/homeFeedSync.js'
import { getUser, setUser } from '@/utils/session.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { createExposure } from '@/utils/exposure.js'
import { cmsLabel } from '@/utils/cmsI18n.js'

const props = defineProps({
	/** 分享页「编辑主题」弹层：不展示说明和合集 */
	picker: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'applied', 'preview', 'preview-close'])
const pickerMode = computed(() => props.picker)
const { t, locale } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle, heroTitleStyle } = useCollapsingTitle({
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
const PAGE_SIZE = 24
const step = ref('list') // list | preview
const selectedKey = ref('')
const selectedId = computed(() => {
	const k = String(selectedKey.value || '')
	const i = k.indexOf(':')
	if (i < 0) return null
	const raw = k.slice(i + 1)
	const n = Number(raw)
	return Number.isFinite(n) && raw !== '' ? n : raw || null
})
const following = ref(false)
const applying = ref(false)
const selecting = ref(false)
const checkedMap = ref({})
const clearDialogOpen = ref(false)

const displayTags = ref([])
const collections = ref([])
const wallpaperList = ref([])
const wallpaperPage = ref(1)
const wallpaperHasMore = ref(true)

const mixList = computed(() => collections.value.slice(0, 8))
const forYouList = computed(() => (isFollowedMode.value ? list.value : wallpaperList.value))
const checkedCount = computed(() => {
	let n = 0
	Object.keys(checkedMap.value || {}).forEach((k) => {
		if (checkedMap.value[k]) n += 1
	})
	return n
})
const navActionLabel = computed(() => {
	if (!selecting.value) return t('select')
	return checkedCount.value > 0 ? t('delete') : t('cancel')
})

const previewItem = computed(() => {
	const id = selectedId.value
	if (id == null || id === '') return null
	const hit = (rows) => rows.find((x) => String(x.id) === String(id)) || null
	return hit(wallpaperList.value) || hit(list.value)
})
const previewCover = computed(() => coverUrl(previewItem.value))

function topicListParams(page) {
	const params = { currentPage: page, pageSize: PAGE_SIZE }
	if (isFollowedMode.value) params.followed_only = 1
	return params
}

function collectionName(item) {
	return String(item?.name || item?.name_en || '').trim()
}

function collectionCountText(item) {
	const n = Number(item?.match_count ?? item?.wallpaper_count ?? item?.count ?? 0) || 0
	const zh = String(locale.value || '').startsWith('zh')
	if (zh) return `${n} 张壁纸`
	return `${n} wallpaper${n === 1 ? '' : 's'}`
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

async function loadCollections() {
	if (isFollowedMode.value || pickerMode.value) return
	try {
		const params = { currentPage: 1, pageSize: 8 }
		if (filter.value !== 'all') params.tag_id = filter.value
		const res = await apiWallpaperSearch(params)
		const bag = res.results || {}
		collections.value = normalizeCollections(bag.collections)
		fb('theme_collection_load_result', { load_result: 'suc' })
	} catch {
		collections.value = []
		fb('theme_collection_load_result', { load_result: 'fail' })
	}
}

function openCollection(item) {
	fb('theme_collection_click', { theme_collection_id: item?.id || '' })
	const name = encodeURIComponent(collectionName(item))
	uni.navigateTo({ url: `/pagesA/topics/mixes?collection_id=${item.id}&name=${name}` })
}

function topicLabel(item) {
	return cmsLabel(item?.name)
}

function coverUrl(item) {
	const url = String(item?.cover_url || item?.image_url || '').trim()
	if (!url || url.endsWith('/')) return ''
	return url
}

function darkAa(i) {
	return i === 7 || i === 12
}

function applyPage1(payload) {
	const rows = payload?.results || []
	list.value = rows
	pageNo.value = 2
	const totalPages = payload?.pagination?.total_pages || 1
	hasMore.value = 1 < totalPages
}

function normalizeDisplayTags(rows) {
	const bag = Array.isArray(rows) ? rows : (Array.isArray(rows?.list) ? rows.list : [])
	return bag.map((tag) => {
		if (!tag || typeof tag !== 'object') return null
		const name = String(tag.name || '').trim()
		const id = tag.id ?? tag.pk
		if (!name || id == null || id === '') return null
		return { ...tag, id, name }
	}).filter(Boolean)
}

function wallpaperParams(page) {
	const params = { currentPage: page, pageSize: 10 }
	if (filter.value !== 'all') params.tag_id = filter.value
	return params
}

async function loadWallpapers(reset = true) {
	if (isFollowedMode.value) return
	if (!reset && (loadingMore.value || !wallpaperHasMore.value)) return
	if (!reset) {
		themeSwipeCount += 1
		fb('theme_item_swipe', { swipe_count: themeSwipeCount })
	}
	const page = reset ? 1 : wallpaperPage.value
	loadingMore.value = true
	try {
		const res = await apiWallpaperSearch(wallpaperParams(page))
		const bag = res.results || {}
		const rows = Array.isArray(bag.wallpapers) ? bag.wallpapers : []
		wallpaperList.value = reset ? rows : wallpaperList.value.concat(rows)
		wallpaperPage.value = page + 1
		const totalPages = res.pagination?.total_pages || bag.pagination?.total_pages
		wallpaperHasMore.value = totalPages ? page < totalPages : rows.length >= 10
	} catch {
		if (reset) wallpaperList.value = []
	} finally {
		loadingMore.value = false
	}
}

async function loadDisplayTags() {
	try {
		const res = await apiDisplayTags('wallpaper')
		displayTags.value = normalizeDisplayTags(res.results || res.data || [])
	} catch {
		displayTags.value = []
	}
}

function bootstrap() {
	loadDisplayTags()
	loadCollections()
	if (!isFollowedMode.value) loadWallpapers(true)

	const { hydrated, refresh } = silentListRefresh(
		listCacheKey.value,
		async () => {
			const res = await apiTopics(topicListParams(1))
			return { results: res.results || [], pagination: res.pagination || null }
		},
		applyPage1,
	)
	if (isFollowedMode.value && !hydrated) loadingMore.value = true
	refresh
		.catch(() => {})
		.finally(() => {
			if (isFollowedMode.value) loadingMore.value = false
		})
}

function fb(name, params) {
	try { logFirebaseEvent(name, params) } catch (e) {}
}

const themeItemExposure = createExposure(getCurrentInstance()?.proxy, '.expo-theme', {
	onShow: (id) => fb('theme_page_show', { theme_item_id: id }),
})
const themeCollectionExposure = createExposure(getCurrentInstance()?.proxy, '.expo-mix', {
	onShow: (id) => fb('theme_collection_show', { theme_collection_id: id }),
})
watch([forYouList, mixList], () => nextTick(() => {
	themeItemExposure.start()
	themeCollectionExposure.start()
}))
onBeforeUnmount(() => {
	themeItemExposure.stop()
	themeCollectionExposure.stop()
})

function onThemeImage(item, ok) {
	fb('theme_item_load_result', {
		load_result: ok ? 'suc' : 'fail',
		theme_item_id: item?.id ?? '',
	})
}

let collectionSwipeTimer = null
let collectionSwipeId = ''
function onCollectionSwipe() {
	const first = mixList.value[0]
	collectionSwipeId = first?.id || ''
	clearTimeout(collectionSwipeTimer)
	collectionSwipeTimer = setTimeout(() => {
		fb('theme_collection_swipe', { theme_collection_id: collectionSwipeId })
	}, 280)
}

let themeSwipeCount = 0

async function loadMore() {
	if (!isFollowedMode.value) {
		await loadWallpapers(false)
		return
	}
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
	if (props.picker) return
	pageMode.value = (q?.mode === 'followed') ? 'followed' : 'browse'
	bootstrap()
})

onMounted(() => {
	if (!props.picker) return
	bootstrap()
})

onReachBottom(loadMore)

function goBack() {
	if (pickerMode.value && step.value !== 'preview' && !selecting.value) {
		emit('close')
		return
	}
	if (step.value === 'preview') {
		leavePreview()
		return
	}
	if (selecting.value) {
		exitSelecting()
		return
	}
	fb('theme_page_leave')
	safeBack(isFollowedMode.value ? '/pages/profile/profile' : '/pages/home/home')
}

function isChecked(id) {
	return !!checkedMap.value[id]
}

function toggleCheck(id) {
	checkedMap.value = {
		...checkedMap.value,
		[id]: !checkedMap.value[id],
	}
}

function exitSelecting() {
	selecting.value = false
	checkedMap.value = {}
}

function onNavAction() {
	if (!isFollowedMode.value || !list.value.length) return
	if (!selecting.value) {
		selecting.value = true
		checkedMap.value = {}
		selectedKey.value = ''
		return
	}
	if (checkedCount.value <= 0) {
		exitSelecting()
		return
	}
	clearDialogOpen.value = true
}

function onCardTap(item, zone = 'fy') {
	if (selecting.value && isFollowedMode.value) {
		toggleCheck(item.id)
		return
	}
	if (pickerMode.value) fb('share_edit_changeTheme_click', { theme_id: item?.id || '' })
	else fb('theme_item_click', { theme_item_id: item?.id || '' })
	selectTheme(item, zone)
}

async function doDeleteFollowed() {
	try {
		const ids = Object.keys(checkedMap.value)
			.filter((k) => checkedMap.value[k])
			.map((k) => {
				const n = Number(k)
				return Number.isFinite(n) ? n : k
			})
		if (!ids.length) {
			exitSelecting()
			return
		}
		await Promise.all(ids.map((id) => apiFollowTopic(id, false)))
		ids.forEach((id) => clearHomeFeedTopicIf(id))
		const drop = new Set(ids.map((id) => String(id)))
		list.value = list.value.filter((x) => !drop.has(String(x.id)))
		selectedKey.value = ''
		exitSelecting()
		clearPageCache(listCacheKey.value)
		uni.showToast({ title: t('cleared'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	}
}

function setFilter(id) {
	const next = id == null || id === '' ? 'all' : id
	if (String(filter.value) === String(next)) return
	fb('theme_category_click', { categoyr_id: next })
	filter.value = next
	selectedKey.value = ''
	if (!isFollowedMode.value) {
		loadCollections()
		loadWallpapers(true)
	}
}

function surprise() {
	fb('theme_surprise_click')
	const pool = forYouList.value.filter((x) => !x.locked)
	const pick = pool[Math.floor(Math.random() * pool.length)] || forYouList.value[0]
	if (pick) selectTheme(pick)
}

function onSeeAll() {
	fb('theme_collection_seeall_click')
	const tag = filter.value !== 'all' ? String(filter.value) : ''
	// 用主题页已有合集预热二级页缓存，进页秒开、不闪 loading
	if (collections.value.length) {
		writePageCache(wallpaperCollectionsKey(tag || 'all'), { results: collections.value })
	}
	const q = tag ? `?tag_id=${encodeURIComponent(tag)}` : ''
	uni.navigateTo({ url: `/pagesA/topics/mixes${q}` })
}

function selectTheme(item, zone = 'fy') {
	if (item.locked) {
		goVip('topic_lock')
		return
	}
	selectedKey.value = `${zone}:${item.id}`
	following.value = !!item.followed
}

function goPreview() {
	if (!selectedId.value) return
	if (pickerMode.value) emit('preview')
	step.value = 'preview'
}

function leavePreview() {
	if (pickerMode.value) emit('preview-close')
	step.value = 'list'
}

function skipPreview() {
	if (pickerMode.value) emit('preview-close')
	step.value = 'list'
	selectedKey.value = ''
}

async function applyCurrent() {
	if (applying.value) return
	const item = previewItem.value
	if (!item) {
		step.value = 'list'
		return
	}
	if (pickerMode.value) fb('share_theme_select_click')
	if (item.locked) {
		goVip(isFollowedMode.value ? 'topic_lock' : 'wallpaper_lock')
		return
	}
	if (!isFollowedMode.value) {
		applying.value = true
		try {
			await apiSetWallpaper(item.id)
			await rememberWallpaper({
				id: item.id,
				image_url: previewCover.value || coverUrl(item),
			})
			const u = getUser() || {}
			u.wallpaper_id = item.id
			setUser(u)
			import('@/utils/widgetDesktopSync.js')
				.then((mod) => mod.syncWidgetWallpaperFromSession())
				.catch(() => {})
			markHomeFeedStale()
			if (!pickerMode.value) fb('theme_apply_result', { apply_result: 'suc' })
			uni.showToast({ title: t('applied'), icon: 'none' })
			if (pickerMode.value) {
				emit('applied', {
					id: item.id,
					image_url: previewCover.value || coverUrl(item),
				})
				return
			}
			setTimeout(() => {
				safeBack('/pages/home/home')
			}, 400)
		} catch (e) {
			uni.showToast({ title: t('request_failed'), icon: 'none' })
			if (!pickerMode.value) fb('theme_apply_result', { apply_result: 'fail' })
		} finally {
			applying.value = false
		}
		return
	}
	const topicId = Number(item.id)
	if (getHomeFeedTopicId() === topicId) {
		uni.showToast({ title: t('theme_already_applied'), icon: 'none' })
		markHomeFeedStale()
		try { uni.$emit(HOME_THEME_APPLY_EVENT, { topicId }) } catch (e) {}
		setTimeout(() => {
			safeBack('/pages/home/home')
		}, 400)
		return
	}
	applying.value = true
	try {
		if (!item.followed) {
			await apiFollowTopic(item.id, true)
			item.followed = true
			following.value = true
		}
		await applyHomeThemeLook(item.id, previewCover.value || coverUrl(item))
		if (getHomeFeedTopicId() !== topicId) {
			uni.showToast({ title: t('theme_apply_failed'), icon: 'none' })
			fb('theme_apply_result', { apply_result: 'fail' })
			return
		}
		clearPageCache(TOPICS_PAGE1_KEY)
		clearPageCache('topics_followed_v1')
		fb('theme_apply_result', { apply_result: 'suc' })
		uni.showToast({ title: t('applied'), icon: 'none' })
		setTimeout(() => {
			safeBack('/pages/home/home')
		}, 400)
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
		fb('theme_apply_result', { apply_result: 'fail' })
	} finally {
		applying.value = false
	}
}

defineExpose({ loadMore })
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
	margin: 28rpx 32rpx 12rpx;
	will-change: opacity, transform;
}
.hero-subtitle {
	display: block;
	font-size: 26rpx;
	line-height: 1.45;
	color: $selah-muted;
	margin: 0 32rpx 24rpx;
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
	padding: 16rpx 8rpx 16rpx 32rpx;
	flex-shrink: 0;
	min-height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: flex-end;
}
.sec-link {
	font-size: 28rpx;
	color: #0a0a0a;
	line-height: 1.2;
}
.sec-link-hit:active .sec-link {
	opacity: 0.55;
}
/* 主题合集：横滑 3:4 卡片 + 居中斜体标题 */
.mix-rail {
	width: 100%;
	white-space: nowrap;
	margin-bottom: 8rpx;
}
.mix-rail-row {
	display: inline-flex;
	flex-direction: row;
	align-items: stretch;
	padding: 0 32rpx 8rpx;
	box-sizing: border-box;
}
.mix-card {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 336rpx;
	height: 448rpx; /* 3:4 */
	margin-right: 16rpx;
	border-radius: 32rpx;
	overflow: hidden;
	flex-shrink: 0;
	vertical-align: top;
	background: #e8e4dc;
	box-sizing: border-box;
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
	height: calc(218rpx * 4 / 3);
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
.fy-card.checked {
	border-color: $selah-ink;
}
.fy-img {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
}
.check-ico {
	position: absolute;
	left: 12rpx;
	top: 12rpx;
	z-index: 3;
	width: 40rpx;
	height: 40rpx;
}
.aa {
	position: absolute;
	left: 0;
	right: 0;
	top: 50%;
	transform: translateY(-50%);
	text-align: center;
	font-family: $selah-font-display;
	font-size: 32rpx;
	font-weight: 700;
	color: $selah-ink;
	z-index: 1;
	pointer-events: none;
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
	height: calc(686rpx * 4 / 3);
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
