<!--
  话题详情：浅色衬线标题 + 白卡语录列表。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<view class="nav-pill" @click="toggle">
					<text class="follow-mini">{{ followed ? t('unfollow') : t('follow') }}</text>
				</view>
			</view>
			<view class="title-spacer" :style="spacerStyle" />
			<text class="title" :style="titleStyle">{{ name }}</text>
		</view>
		<view v-if="!list.length && loaded" class="empty">
			<image class="empty-art" src="/static/ui/themes/fy-1.jpg" mode="aspectFill" />
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
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiTopicQuotes, apiFollowTopic } from '@/api/content.js'
import { track } from '@/utils/analytics.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { silentListRefresh } from '@/utils/pageCache.js'
import { topicQuotesKey } from '@/utils/wallpaperCache.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle, spacerStyle } = useCollapsingTitle({
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
const PAGE_SIZE = 20

onLoad((q) => {
	id.value = Number(q.id)
	name.value = decodeURIComponent(q.name || '')
	list.value = []
	loaded.value = false
	hasMore.value = true
	page.value = 1
	bootstrap()
})

function applyPage1(payload) {
	const rows = payload?.list || payload?.results?.list || []
	list.value = rows
	page.value = 2
	const totalPages = payload?.pagination?.total_pages || 1
	hasMore.value = 1 < totalPages
	if (payload?.followed != null) followed.value = !!payload.followed
	if (payload?.topic?.name) name.value = payload.topic.name
	loaded.value = true
}

function bootstrap() {
	if (!id.value) {
		loaded.value = true
		return
	}
	const { hydrated, refresh } = silentListRefresh(
		topicQuotesKey(id.value),
		async () => {
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
		.catch(() => {})
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
		const res = await apiTopicQuotes(id.value, { currentPage: next, pageSize: PAGE_SIZE })
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

onReachBottom(loadMore)

function goBack() {
	safeBack('/pagesA/topics/topics')
}

async function toggle() {
	const next = !followed.value
	await apiFollowTopic(id.value, next)
	followed.value = next
	track(next ? 'topic_follow' : 'topic_unfollow', { topic_id: id.value })
}

function goShare(q) {
	uni.navigateTo({ url: `/pagesA/share/share?id=${q.id}` })
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
.title-spacer {
	position: relative;
	z-index: 0;
	pointer-events: none;
}
.title {
	@include selah-display-title;
}
.empty {
	margin: 80rpx 0 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
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
