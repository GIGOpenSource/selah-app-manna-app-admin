<!--
  圣经/译本语录列表：与话题详情同一套浅色衬线标题 + 白卡。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="title nav-title" :style="titleStyle">{{ title }}</text>
				<view v-if="topicId" class="nav-pill" @tap.stop="toggleFollow">
					<text class="follow-mini">{{ followed ? t('unfollow') : t('follow') }}</text>
				</view>
				<view v-else class="nav-spacer" />
			</view>
		</view>
		<text class="hero-title" :style="heroTitleStyle">{{ title }}</text>
		<view v-if="!list.length && loaded" class="empty">
			<image class="empty-art" src="/static/ui/themes/like.png" mode="aspectFill" />
			<text class="empty-text">{{ t('no_quotes') }}</text>
		</view>
		<view
			v-for="(q, idx) in list"
			:key="String(q.id || q.source_ref || idx) + '-' + idx"
			class="q"
			@click="goShare(q)"
		>
			<text class="q-text">{{ q.content }}</text>
			<text v-if="q.source_ref" class="q-cite">— {{ q.source_ref }}</text>
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
import { apiTopicQuotes, apiFollowTopic, apiFeed, apiBibleBooks, apiBibleChapter } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { cmsLabel } from '@/utils/cmsI18n.js'
import { openSharePage } from '@/utils/share.js'
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
const topicId = ref(0)
const title = ref('')
const list = ref([])
const followed = ref(false)
const loaded = ref(false)
const pageNo = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const translation = ref('')
const books = ref([])
const bookIdx = ref(0)
const chapterNum = ref(1)
const PAGE_SIZE = 20

function goBack() {
	safeBack('/pagesA/explore/explore')
}

function goShare(q) {
	if (!q) return
	openSharePage({
		id: q.id,
		text: q.content,
		cite: q.source_ref,
		mode: q.id && Number(q.id) > 0 ? undefined : 'ai',
	})
}

async function toggleFollow() {
	if (!topicId.value) return
	const next = !followed.value
	try { logFirebaseEvent(next ? 'topic_follow_click' : 'topic_follow_cancel', { topicID: topicId.value }) } catch (e) {}
	try {
		const res = await apiFollowTopic(topicId.value, next)
		followed.value = !!(res?.results?.followed ?? res?.followed ?? next)
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	}
}

function mapChapter(ch) {
	const bookName = ch.book_name || ch.book_key || ''
	return (ch.verses || []).map((v) => ({
		id: 0,
		content: v.text,
		source_ref: `${bookName} ${ch.chapter}:${v.verse}`,
		liked: false,
	}))
}

async function loadTranslationChapter() {
	const book = books.value[bookIdx.value]
	if (!book || !translation.value) return false
	const bookKey = book.book_key || book.code || book.slug
	const res = await apiBibleChapter(translation.value, bookKey, chapterNum.value)
	const ch = res.results || res.data || {}
	const rows = mapChapter(ch)
	if (!rows.length) return false
	list.value = list.value.concat(rows)
	const maxCh = Number(ch.chapter_count || book.chapter_count || chapterNum.value)
	if (chapterNum.value < maxCh) {
		chapterNum.value += 1
	} else if (bookIdx.value < books.value.length - 1) {
		bookIdx.value += 1
		chapterNum.value = 1
	} else {
		hasMore.value = false
	}
	return true
}

async function loadMore() {
	if (loadingMore.value || !hasMore.value) return
	loadingMore.value = true
	try {
		if (translation.value) {
			const ok = await loadTranslationChapter()
			if (!ok) hasMore.value = false
			return
		}
		const next = pageNo.value
		if (topicId.value) {
			const res = await apiTopicQuotes(topicId.value, { currentPage: next, pageSize: PAGE_SIZE })
			const rows = res.results?.list || res.results || []
			list.value = list.value.concat(rows)
			pageNo.value = next + 1
			hasMore.value = next < (res.pagination?.total_pages || 1)
		} else {
			const res = await apiFeed({ currentPage: next, pageSize: PAGE_SIZE })
			const rows = res.results || []
			list.value = list.value.concat(rows)
			pageNo.value = next + 1
			hasMore.value = next < (res.pagination?.total_pages || 1)
		}
	} finally {
		loadingMore.value = false
		loaded.value = true
	}
}

onReachBottom(loadMore)

onLoad(async (q) => {
	topicId.value = Number(q?.id || 0)
	translation.value = decodeURIComponent(q?.version || '').trim()
	try {
		const ver = String(translation.value || '').toLowerCase()
		const verLabel = ver ? t('bible_ver_' + ver) : ''
		if (verLabel && verLabel !== 'bible_ver_' + ver) {
			title.value = verLabel
		} else {
			title.value = cmsLabel(decodeURIComponent(q?.name || '')) || t('bible_verses')
		}
	} catch (e) {
		title.value = t('bible_verses')
	}
	loadingMore.value = true
	try {
		if (translation.value) {
			const booksRes = await apiBibleBooks(translation.value)
			books.value = booksRes.results || booksRes.data || []
			bookIdx.value = 0
			chapterNum.value = 1
			hasMore.value = true
			list.value = []
			await loadTranslationChapter()
			await loadTranslationChapter()
		} else if (topicId.value) {
			const res = await apiTopicQuotes(topicId.value, { currentPage: 1, pageSize: PAGE_SIZE })
			const data = res.results || {}
			list.value = data.list || []
			followed.value = !!data.followed
			pageNo.value = 2
			hasMore.value = 1 < (res.pagination?.total_pages || 1)
		} else {
			const res = await apiFeed({ currentPage: 1, pageSize: PAGE_SIZE })
			list.value = res.results || []
			pageNo.value = 2
			hasMore.value = 1 < (res.pagination?.total_pages || 1)
		}
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		loadingMore.value = false
		loaded.value = true
	}
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
.nav-spacer { width: 88rpx; height: 88rpx; visibility: hidden; }
.nav-ico { width: 48rpx; height: 48rpx; }
.follow-mini { font-size: 24rpx; color: $selah-ink; font-weight: 600; }
.title { @include selah-display-title; }
.nav-title { flex: 1; text-align: center; }
.hero-title {
	@include selah-display-title;
	display: block;
	font-size: 48rpx;
	line-height: 1.15;
	margin: 8rpx 0 24rpx;
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
.q-cite {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	color: $selah-muted;
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
