<!--
  Topics you follow：与 Explore 相同分组，单项/分组关注。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ t('profile_topics_you_follow') }}</text>
				<view class="nav-spacer" />
			</view>
		</view>
		<text class="hero-title" :style="heroTitleStyle">{{ t('profile_topics_you_follow') }}</text>

		<view class="search-wrap">
			<input
				v-model="keyword"
				class="search"
				:placeholder="t('search_topics')"
				confirm-type="search"
			/>
		</view>

		<view v-for="group in visibleGroups" :key="group.key" class="group">
			<view class="group-head">
				<text class="group-title">{{ group.title }}</text>
				<view
					v-if="canFollowGroup(group)"
					:class="['follow-all', groupBusy ? 'busy' : '']"
					@tap.stop="onFollowAll(group)"
				>
					<text class="follow-all-text">{{ groupAllFollowed(group) ? t('unfollow_all') : t('follow_all') }}</text>
				</view>
			</view>
			<view v-for="item in group.items" :key="item.key" class="row">
				<text class="row-label">{{ item.name }}</text>
				<view
					v-if="canFollowItem(item)"
					:class="['follow-btn', item.followed ? 'on' : '', busyId === item.id ? 'busy' : '']"
					@click.stop="onToggle(item)"
				>
					<text class="follow-text">{{ item.followed ? t('following') : t('follow') }}</text>
				</view>
				<view v-else class="follow-btn locked" @click.stop="onUnavailable(item)">
					<image class="lock-ico" src="/static/ui/explore/ico-lock.svg" mode="aspectFit" />
				</view>
			</view>
		</view>
		<view v-if="!visibleGroups.length && !loading" class="empty">{{ t('empty') }}</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiDisplayTags, apiFollowDisplayTag, apiFollowDisplayColumn } from '@/api/content.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { goVip } from '@/utils/vip.js'
import { getUser } from '@/utils/session.js'
import { createTapLock } from '@/utils/tapLock.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle, heroTitleStyle } = useCollapsingTitle({
	mode: 'hero',
	statusBarPx,
	fontStartRpx: 48,
	fontEndRpx: 34,
	titleBlockRpx: 72,
})
const fromProfile = ref(false)
const user = ref(getUser())
const isVip = computed(() => String(user.value?.vip_level || 'free') !== 'free')
const keyword = ref('')
const tags = ref([])
const loading = ref(false)
const busyId = ref(0)
const groupBusy = ref(false)
const tapLock = createTapLock(420)

function tagName(row) {
	const lang = String(getCurrentLanguage() || 'en').slice(0, 2)
	const localized = lang === 'es' ? row?.name_es : lang === 'pt' ? row?.name_pt : row?.name_en
	return String(localized || row?.name_en || row?.name || '').trim()
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
			.map((item) => ({
				key: 'c' + item.id,
				id: item.id,
				name: tagName(item),
				followed: !!item.followed,
				locked: !!(item.locked || item.vip || item.is_vip),
			})),
	})).filter((group) => group.title && group.items.length)
})

const visibleGroups = computed(() => {
	const q = keyword.value.trim().toLowerCase()
	if (!q) return groups.value
	return groups.value
		.map((g) => ({
			...g,
			items: g.items.filter((item) => String(item.name || '').toLowerCase().includes(q)),
		}))
		.filter((g) => g.items.length)
})

function goBack() {
	safeBack(fromProfile.value ? '/pages/profile/profile' : '/pagesA/explore/explore')
}

function applyFollowed(id, followed) {
	const nid = Number(id)
	tags.value = tags.value.map((row) => (
		Number(row.id) === nid ? { ...row, followed } : row
	))
}

function itemNeedsVip(item) {
	return !!(item?.locked)
}

function canFollowItem(item) {
	return !!(item?.id) && (isVip.value || !itemNeedsVip(item))
}

function canFollowGroup(group) {
	const items = group?.items || []
	return !!(group?.columnId && items.length && items.every((item) => canFollowItem(item)))
}

function onUnavailable() {
	goVip('topic_lock')
}

function onToggle(item) {
	tapLock.run(() => toggle(item))
}

function followableItems(group) {
	const seen = new Set()
	return (group.items || []).filter((x) => {
		const id = Number(x?.id || 0)
		if (!id || seen.has(id)) return false
		seen.add(id)
		return true
	})
}

function groupAllFollowed(group) {
	const items = followableItems(group)
	return items.length > 0 && items.every((x) => x.followed)
}

function onFollowAll(group) {
	if (!canFollowGroup(group)) {
		onUnavailable()
		return
	}
	tapLock.run(() => toggleGroup(group))
}

async function toggle(item, follow) {
	if (!canFollowItem(item)) {
		onUnavailable()
		return false
	}
	if (!item?.id) {
		onUnavailable()
		return false
	}
	if (busyId.value === item.id) return false
	const next = typeof follow === 'boolean' ? follow : !item.followed
	if (!!item.followed === !!next) return true
	busyId.value = item.id
	try { logFirebaseEvent(next ? 'topic_follow_click' : 'topic_follow_cancel', { topicID: item.id }) } catch (e) {}
	try {
		await apiFollowDisplayTag(item.id, next)
		applyFollowed(item.id, next)
		await bootstrap()
		return true
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
		return false
	} finally {
		busyId.value = 0
	}
}

async function toggleGroup(group) {
	if (groupBusy.value || !group.columnId) return
	const unfollow = groupAllFollowed(group)
	try {
		logFirebaseEvent(unfollow ? 'topic_unfollow_all_click' : 'topic_follow_all_click', { topicTagID: group.columnId })
	} catch (e) {}
	groupBusy.value = true
	try {
		await apiFollowDisplayColumn(group.columnId, !unfollow)
		const ids = new Set(followableItems(group).map((item) => Number(item.id)))
		tags.value = tags.value.map((row) => {
			if (Number(row.id) === Number(group.columnId)) return { ...row, followed_all: !unfollow }
			if (ids.has(Number(row.id))) return { ...row, followed: !unfollow }
			return row
		})
		await bootstrap()
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		groupBusy.value = false
	}
}

let loadSeq = 0
function bootstrap() {
	const seq = ++loadSeq
	loading.value = true
	return apiDisplayTags('quote', { followed_only: 1 }, { showLoading: true, loadingTime: 0, loadingMask: true })
		.then((res) => {
			if (seq !== loadSeq) return
			const bag = res.results ?? res.data ?? []
			tags.value = Array.isArray(bag) ? bag : (Array.isArray(bag.list) ? bag.list : [])
		})
		.catch(() => {
			if (seq !== loadSeq) return
			tags.value = []
		})
		.finally(() => {
			if (seq === loadSeq) loading.value = false
		})
}

onLoad((q) => {
	fromProfile.value = String(q?.from || '') === 'profile'
})
onShow(() => {
	user.value = getUser()
	bootstrap()
})
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
.page-head { @include selah-sticky-head; }
.head-glass { @include selah-sticky-head-glass($selah-bg-gray); }
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
}
.nav-pill { @include selah-nav-circle; }
.nav-ico { width: 48rpx; height: 48rpx; }
.nav-title { @include selah-display-title; flex: 1; text-align: center; }
.nav-spacer { width: 88rpx; height: 88rpx; visibility: hidden; }
.hero-title {
	@include selah-display-title;
	display: block;
	font-size: 48rpx;
	margin: 8rpx 0 24rpx;
}
.search-wrap { margin-bottom: 24rpx; }
.search {
	width: 100%;
	height: 80rpx;
	padding: 0 28rpx;
	background: $selah-card;
	border-radius: 40rpx;
	font-size: 28rpx;
	box-sizing: border-box;
}
.group { margin-bottom: 28rpx; }
.group-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 8rpx 8rpx 12rpx;
}
.group-title { font-size: 24rpx; color: $selah-muted; font-weight: 600; }
.follow-all {
	padding: 8rpx 4rpx 8rpx 16rpx;
	margin: -8rpx -4rpx -8rpx 0;
	cursor: pointer;
	z-index: 2;
	position: relative;
}
.follow-all.busy { opacity: 0.5; }
.follow-all-text { font-size: 24rpx; color: $selah-ink; font-weight: 600; }
.row {
	display: flex;
	align-items: center;
	background: $selah-card;
	border-radius: 24rpx;
	padding: 20rpx 24rpx;
	margin-bottom: 12rpx;
}
.row-label { flex: 1; font-size: 30rpx; }
.follow-btn {
	padding: 10rpx 20rpx;
	border-radius: 32rpx;
	background: $selah-ink;
	cursor: pointer;
}
.follow-btn.on { background: #eceae4; }
.follow-btn.busy { opacity: 0.6; }
.follow-btn.locked {
	background: #eceae4;
	padding: 10rpx 16rpx;
}
.lock-ico { width: 32rpx; height: 32rpx; display: block; }
.follow-text { font-size: 24rpx; color: #fff; font-weight: 600; }
.follow-btn.on .follow-text { color: $selah-ink; }
.empty { text-align: center; color: $selah-muted; padding: 80rpx 0; }
</style>
