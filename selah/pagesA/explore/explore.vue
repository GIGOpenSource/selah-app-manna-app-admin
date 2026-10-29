<!--
  Explore topics：对齐截图 — 玻璃 Edit、类型/译本目录（左图标+右锁）、底部 Go Premium + 搜索。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ t('explore_topics') }}</text>
				<view class="nav-edit" @tap.stop="goEdit">
					<text class="nav-edit-text">{{ t('edit') }}</text>
				</view>
			</view>
		</view>
		<text class="hero-title" :style="heroTitleStyle">{{ t('explore_topics') }}</text>
		<text class="hero-subtitle">{{ t('explore_topics_subtitle') }}</text>

		<view
			v-if="!pickForWidget && user.vip_level === 'free'"
			class="vip-banner"
			@tap="onAccessAll"
		>
			<view class="vip-copy">
				<text class="vip-title">{{ t('explore_vip_title') }}</text>
				<text class="vip-desc">{{ bannerBody }}</text>
			</view>
			<image class="vip-art" src="/static/ui/art-dove.png" mode="aspectFit" />
		</view>

		<view v-if="!pickForWidget" class="asset-grid">
			<view class="asset-card" @tap="onLikes">
				<image class="asset-art" src="/static/ui/grid-likes.png" mode="aspectFit" />
				<text class="asset-label">{{ t('likes') }}</text>
			</view>
			<view class="asset-card" @tap="onCollections">
				<image class="asset-art" src="/static/ui/grid-collections.png" mode="aspectFit" />
				<text class="asset-label">{{ t('collections') }}</text>
			</view>
			<view class="asset-card" @tap="onOwnQuotes">
				<image class="asset-art" src="/static/ui/grid-affirmations.png" mode="aspectFit" />
				<text class="asset-label">{{ t('my_own_quotes') }}</text>
			</view>
			<view class="asset-card" @tap="onHistory">
				<image class="asset-art" src="/static/ui/grid-history.png" mode="aspectFit" />
				<text class="asset-label">{{ t('history') }}</text>
			</view>
		</view>

		<view v-for="group in visibleGroups" :key="group.key" class="group">
			<view class="group-head">
				<text class="group-title">{{ group.title }}</text>
				<view
					v-if="canFollowGroup(group)"
					:class="['follow-all', groupBusy === group.columnId ? 'busy' : '']"
					@tap.stop="onFollowAll(group)"
				>
					<text class="follow-all-text">{{ group.followedAll ? t('unfollow_all') : t('follow_all') }}</text>
				</view>
			</view>
			<view
				v-for="item in group.items"
				:key="item.key"
				class="row"
				@tap.stop="openItem(item)"
			>
				<image class="row-ico" :src="item.icon" mode="aspectFit" />
				<text class="row-label">{{ item.name }}</text>
				<view
					v-if="canFollowItem(item)"
					:class="['follow-btn', item.followed ? 'on' : '', busyId === item.id ? 'busy' : '']"
					@tap.stop="onToggle(item)"
				>
					<text class="follow-text">{{ item.followed ? t('following') : t('follow') }}</text>
				</view>
				<image
					v-else
					class="row-lock"
					src="/static/ui/explore/ico-lock.svg"
					mode="aspectFit"
				/>
			</view>
		</view>

		<view v-if="user.vip_level === 'free'" class="premium" @tap="onUnlockAll">
			<text class="premium-title">{{ t('go_premium') }}</text>
			<text class="premium-desc">{{ t('unlock_all_topics') }}</text>
			<image class="premium-art" src="/static/ui/explore/art-bible.svg" mode="aspectFit" />
			<view class="premium-btn">
				<text class="premium-btn-text">{{ t('unlock_all') }}</text>
			</view>
		</view>

		<view v-if="!visibleGroups.length && !loading" class="empty">{{ t('empty') }}</view>
		<view class="search-spacer" />

		<view class="search-dock">
			<view class="search-bar">
				<image class="search-ico" src="/static/ui/explore/ico-search.svg" mode="aspectFit" />
				<input
					v-model="keyword"
					@focus="onSearchFocus"
					class="search-input"
					:placeholder="t('explore_search')"
					confirm-type="search"
					placeholder-class="search-ph"
				/>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiBibleTranslations, apiDisplayTags, apiFollowDisplayTag, apiFollowDisplayColumn } from '@/api/content.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { iconForItem, normalizeTranslations } from '@/utils/exploreCatalog.js'
import { goVip } from '@/utils/vip.js'
import { getUser } from '@/utils/session.js'
import { createTapLock } from '@/utils/tapLock.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

const statusBarPx = getStatusBarPx()
const { titleStyle, heroTitleStyle } = useCollapsingTitle({
	mode: 'hero',
	statusBarPx,
	fontStartRpx: 56,
	fontEndRpx: 34,
	titleBlockRpx: 72,
})
const rowTap = createTapLock(420)
const pickForWidget = ref(false)
const user = ref(getUser())
const isVip = computed(() => String(user.value?.vip_level || 'free') !== 'free')
const keyword = ref('')
const tags = ref([])
const loading = ref(false)
const busyId = ref(0)
const groupBusy = ref(0)
const translations = ref([])

function tagName(row) {
	const lang = String(getCurrentLanguage() || 'en').slice(0, 2)
	const localized = lang === 'es' ? row?.name_es : lang === 'pt' ? row?.name_pt : row?.name_en
	return String(localized || row?.name_en || row?.name || '').trim()
}

function toItem(item) {
	const name = tagName(item)
	return {
		key: 'c' + item.id,
		id: item.id,
		name,
		locked: !!(item.locked || item.vip || item.is_vip),
		followed: !!item.followed,
		icon: iconForItem({ name }),
		raw: item,
	}
}

const groups = computed(() => {
	const rows = tags.value
	const columns = rows
		.filter((row) => String(row.display_type || '').toLowerCase() === 'column')
		.sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
	const collections = rows
		.filter((row) => String(row.display_type || '').toLowerCase() === 'collection')
		.sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
	return columns.map((col) => ({
		key: 'col' + col.id,
		columnId: col.id,
		title: tagName(col),
		followedAll: !!col.followed_all,
		items: collections
			.filter((item) => String(item.parent_id) === String(col.id))
			.map(toItem),
	})).filter((group) => group.title && group.items.length)
})

const visibleGroups = computed(() => {
	const q = keyword.value.trim().toLowerCase()
	const src = groups.value.filter((g) => g.items.length)
	if (!q) return src
	return src
		.map((g) => ({
			...g,
			items: g.items.filter((item) => String(item.name || '').toLowerCase().includes(q)),
		}))
		.filter((g) => g.items.length)
})

const bannerBody = computed(() => {
	const names = normalizeTranslations(translations.value)
		.map((row) => {
			const code = String(row.code || '').toLowerCase()
			const key = 'bible_ver_' + code
			const localized = String(t(key) || '')
			if (localized && localized !== key) return localized
			return String(row.title || row.code || '').trim()
		})
		.filter(Boolean)
	const versions = names.length
		? names.slice(0, 3).join(' · ')
		: [t('bible_ver_kjv'), t('bible_ver_esv'), t('bible_ver_niv')].join(' · ')
	const n = Math.max(20, tags.value.filter((row) => row.display_type === 'collection').length)
	return t('explore_vip_body', { versions, n })
})

function fb(name, params) {
	try { logFirebaseEvent(name, params) } catch (e) {}
}

function followedTopicIds() {
	return tags.value
		.filter((row) => String(row.display_type || '').toLowerCase() === 'collection' && row.followed)
		.map((row) => row.id)
		.filter((id) => id != null && id !== '')
		.join(',')
}

let searchResultTimer = null
function onSearchFocus() {
	fb('topic_search_click')
}

watch(keyword, (value) => {
	const text = String(value || '').trim()
	clearTimeout(searchResultTimer)
	if (!text) return
	searchResultTimer = setTimeout(() => {
		const ids = []
		visibleGroups.value.forEach((group) => {
			(group.items || []).forEach((item) => {
				if (item?.id != null) ids.push(item.id)
			})
		})
		fb('topic_search_click_result', { search_result: ids.length ? ids.join(',') : 'null' })
	}, 400)
})

function goBack() {
	fb('topic_page_leave', { followTopic_result: followedTopicIds() })
	if (pickForWidget.value) {
		saveWidgetCategories()
		safeBack('/pagesA/widgets/widgets?from=profile&kind=home')
		return
	}
	safeBack('/pages/home/home')
}

function followedWidgetItems(extraItem) {
	const items = tags.value
		.filter((row) => String(row.display_type || '').toLowerCase() === 'collection' && row.followed)
		.map((row) => ({ id: row.id, name: tagName(row) }))
	if (extraItem?.id && !items.some((row) => String(row.id) === String(extraItem.id))) {
		items.push({ id: extraItem.id, name: extraItem.name || '' })
	}
	return items
}

function saveWidgetCategories(extraItem) {
	try {
		uni.setStorageSync('widget_category_pick', JSON.stringify({
			items: followedWidgetItems(extraItem),
		}))
	} catch (e) {}
}

function returnWidgetCategory(item) {
	if (!item?.id) return
	saveWidgetCategories(item)
	safeBack('/pagesA/widgets/widgets?from=profile&kind=home')
}

function go(url) {
	rowTap.run(() => {
		uni.navigateTo({
			url,
			fail: () => {
				// 同页重复打开会 fail，不能 redirectTo，否则会把探索页挤出栈
			},
		})
	})
}

function goEdit() {
	fb('topic_edit_click')
	uni.navigateTo({ url: '/pagesA/explore/follow' })
}

function openVip() {
	goVip('explore_banner')
}

function onAccessAll() {
	fb('topic_accessAll_click')
	openVip()
}

function onUnlockAll() {
	fb('topic_unlock_click')
	openVip()
}

function onLikes() {
	fb('topic_likes_click')
	go('/pagesA/assets/assets?kind=like&from=explore')
}

function onCollections() {
	fb('topic_collections_click')
	go('/pagesA/assets/assets?kind=collect&from=explore')
}

function onOwnQuotes() {
	fb('topic_own_quotes_click')
	go('/pagesA/assets/assets?kind=affirmation&from=explore')
}

function onHistory() {
	fb('topic_history_click')
	go('/pagesA/assets/assets?kind=history&from=explore')
}

function itemNeedsVip(item) {
	return !!(item?.locked)
}

function canFollowItem(item) {
	return isVip.value || !itemNeedsVip(item)
}

function canFollowGroup(group) {
	const items = group?.items || []
	return !!(group?.columnId && items.length && items.every((item) => canFollowItem(item)))
}

function openItem(item) {
	if (!canFollowItem(item)) {
		fb('topic_premium_click', { topicID: item?.id || '' })
		goVip('topic_lock')
		return
	}
	if (pickForWidget.value) {
		returnWidgetCategory(item)
		return
	}
	if (!item.id) return
	const name = encodeURIComponent(item.name || '')
	go(`/pagesA/topics/detail?display_tag=${item.id}&name=${name}&from=explore`)
}

function onToggle(item) {
	if (!canFollowItem(item)) {
		goVip('topic_lock')
		return
	}
	rowTap.run(() => toggleFollow(item))
}

async function toggleFollow(item) {
	if (!item?.id || busyId.value === item.id) return
	const next = !item.followed
	busyId.value = item.id
	try { logFirebaseEvent(next ? 'topic_follow_click' : 'topic_follow_cancel', { topicID: item.id }) } catch (e) {}
	try {
		await apiFollowDisplayTag(item.id, next)
		tags.value = tags.value.map((row) => (
			Number(row.id) === Number(item.id) ? { ...row, followed: next } : row
		))
		await loadTags()
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		busyId.value = 0
	}
}

function onFollowAll(group) {
	if (!canFollowGroup(group)) {
		goVip('topic_lock')
		return
	}
	rowTap.run(() => toggleColumn(group))
}

async function toggleColumn(group) {
	if (!group?.columnId || groupBusy.value) return
	const next = !group.followedAll
	fb(next ? 'topic_follow_all_click' : 'topic_unfollow_all_click', { topicTagID: group.columnId })
	groupBusy.value = group.columnId
	try {
		await apiFollowDisplayColumn(group.columnId, next)
		const ids = new Set((group.items || []).map((item) => Number(item.id)))
		tags.value = tags.value.map((row) => {
			if (Number(row.id) === Number(group.columnId)) return { ...row, followed_all: next }
			if (ids.has(Number(row.id))) return { ...row, followed: next }
			return row
		})
		await loadTags()
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		groupBusy.value = 0
	}
}

let tagSeq = 0
function loadTags() {
	const seq = ++tagSeq
	const first = !tags.value.length
	if (first) loading.value = true
	return apiDisplayTags('quote', {}, first
		? { showLoading: true, loadingTime: 0, loadingMask: true }
		: { showLoading: false })
		.then((res) => {
			if (seq !== tagSeq) return
			const bag = res.results ?? res.data ?? []
			tags.value = Array.isArray(bag) ? bag : (Array.isArray(bag.list) ? bag.list : [])
		})
		.catch(() => {
			if (seq !== tagSeq || !first) return
			tags.value = []
		})
		.finally(() => {
			if (seq === tagSeq) loading.value = false
		})
}

onLoad((q) => {
	pickForWidget.value = q?.from === 'widget'
	apiBibleTranslations()
		.then((res) => {
			translations.value = res.results || res.data || []
		})
		.catch(() => {
			translations.value = []
		})
})
onShow(() => {
	fb('topic_page_show')
	user.value = getUser()
	loadTags()
})
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 40rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head { @include selah-sticky-head; }
.head-glass { @include selah-sticky-head-glass($selah-bg-gray); }
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
}
.nav-pill { @include selah-nav-circle; }
.nav-ico { width: 48rpx; height: 48rpx; }
.nav-title { @include selah-display-title; flex: 1; text-align: center; }
.nav-edit {
	min-width: 120rpx;
	height: 72rpx;
	padding: 0 28rpx;
	border-radius: $selah-radius-pill;
	background: $selah-glass;
	box-shadow: $selah-shadow;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.nav-edit.spacer {
	background: transparent;
	box-shadow: none;
}
.nav-edit-text {
	font-size: 28rpx;
	font-weight: 600;
	color: $selah-ink;
}
.hero-title {
	@include selah-display-title;
	display: block;
	font-size: 56rpx;
	margin: 8rpx 0 12rpx;
}
.hero-subtitle {
	display: block;
	font-size: 26rpx;
	line-height: 1.45;
	color: $selah-muted;
	margin: 0 0 24rpx;
}
.vip-banner {
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 20rpx 20rpx 20rpx 32rpx;
	border-radius: 32rpx;
	margin-bottom: 24rpx;
	background: linear-gradient(90deg, #b6badf 0%, #dfe4f4 48%, #eef1f8 100%);
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
	line-height: 1.25;
	margin-bottom: 8rpx;
}
.vip-desc {
	display: block;
	font-size: 24rpx;
	color: $selah-ink;
	line-height: 1.35;
	opacity: 0.78;
}
.vip-art {
	width: 160rpx;
	height: 160rpx;
	flex-shrink: 0;
	border-radius: 50%;
	overflow: hidden;
}
.asset-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16rpx;
	margin-bottom: 32rpx;
}
.asset-card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 28rpx 24rpx;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	box-shadow: 0 8rpx 28rpx rgba(25, 25, 25, 0.04);
}
.asset-art { width: 72rpx; height: 72rpx; margin-bottom: 12rpx; }
.asset-label { font-size: 28rpx; font-weight: 600; }
.group { margin-bottom: 28rpx; }
.group-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 12rpx 8rpx 16rpx;
}
.group-title {
	@include selah-display-title;
	font-size: 32rpx;
	color: $selah-ink;
}
.follow-all { padding: 8rpx 0 8rpx 16rpx; }
.follow-all.busy { opacity: 0.5; }
.follow-all-text { font-size: 24rpx; color: $selah-ink; font-weight: 600; }
.follow-btn {
	padding: 10rpx 20rpx;
	border-radius: 32rpx;
	background: $selah-ink;
	flex-shrink: 0;
}
.follow-btn.on { background: #eceae4; }
.follow-btn.busy { opacity: 0.6; }
.follow-text { font-size: 24rpx; color: #fff; font-weight: 600; }
.follow-btn.on .follow-text { color: $selah-ink; }
.row {
	display: flex;
	flex-direction: row;
	align-items: center;
	background: $selah-card;
	border-radius: 24rpx;
	padding: 24rpx;
	margin-bottom: 12rpx;
}
.row-ico {
	width: 44rpx;
	height: 44rpx;
	margin-right: 20rpx;
	flex-shrink: 0;
}
.row-label { flex: 1; font-size: 30rpx; }
.row-lock { width: 36rpx; height: 36rpx; flex-shrink: 0; opacity: 0.7; }
.premium {
	margin: 48rpx 8rpx 16rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}
.premium-title {
	@include selah-display-title;
	font-size: 40rpx;
	display: block;
}
.premium-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 28rpx;
	color: $selah-muted;
}
.premium-art {
	width: 360rpx;
	height: 260rpx;
	margin: 24rpx 0 32rpx;
}
.premium-btn {
	width: 100%;
	height: 96rpx;
	border-radius: 28rpx;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.premium-btn-text {
	color: #fff;
	font-size: 30rpx;
	font-weight: 700;
}
.empty { text-align: center; color: $selah-muted; padding: 80rpx 0; }
.search-spacer {
	height: calc(140rpx + env(safe-area-inset-bottom));
}
.search-dock {
	position: fixed;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(16rpx + env(safe-area-inset-bottom));
	z-index: 20;
}
.search-bar {
	height: 88rpx;
	padding: 0 28rpx;
	border-radius: 44rpx;
	background: $selah-card;
	box-shadow: 0 12rpx 40rpx rgba(25, 25, 25, 0.08);
	display: flex;
	flex-direction: row;
	align-items: center;
}
.search-ico { width: 36rpx; height: 36rpx; margin-right: 12rpx; flex-shrink: 0; }
.search-input {
	flex: 1;
	height: 88rpx;
	font-size: 28rpx;
	color: $selah-ink;
}
.search-ph { color: $selah-muted; }
</style>
