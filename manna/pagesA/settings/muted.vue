<template>
	<!-- Muted content：已屏蔽内容，Unmute 后移出 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav" @click="goBack">
			<text class="nav__back">‹</text>
			<text class="nav__title">{{ t('muted_content') }}</text>
		</view>

		<view v-for="q in list" :key="q.id" class="q">
			<text class="q__body">{{ q.content || q.text || q.verse_text }}</text>
			<text v-if="q.source_ref || q.reference" class="q__cite">— {{ q.source_ref || q.reference }}</text>
			<text v-if="q.muted_at" class="q__date">{{ String(q.muted_at).slice(0, 10) }}</text>
			<text class="q__unmute" @click="unmute(q)">{{ t('unmute') }}</text>
		</view>
		<view v-if="!loading && !list.length" class="empty">{{ t('muted_empty') }}</view>
		<view v-if="loading" class="empty">...</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiMyAssets, apiDislike } from '@/api/content.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const { t } = useI18n()
const statusBar = getStatusBarPx()
const list = ref([])
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const PAGE_SIZE = 20

function goBack() {
	uni.navigateBack({ fail: () => uni.navigateTo({ url: '/pagesA/settings/settings' }) })
}

async function load(reset = true) {
	if (loading.value) return
	if (!reset && !hasMore.value) return
	loading.value = true
	try {
		const next = reset ? 1 : page.value
		const res = await apiMyAssets('dislike', null, { currentPage: next, pageSize: PAGE_SIZE })
		const rows = res.results || []
		list.value = reset ? rows : list.value.concat(rows)
		page.value = next + 1
		hasMore.value = next < (res.pagination?.total_pages || 1)
	} catch (e) {
		if (reset) list.value = []
	} finally {
		loading.value = false
	}
}

async function unmute(q) {
	try {
		await apiDislike(q.id, false)
		list.value = list.value.filter((x) => x.id !== q.id)
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	}
}

onLoad(() => load(true))
onReachBottom(() => load(false))
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	padding: 24rpx 40rpx 80rpx;
	box-sizing: border-box;
	@include manna-peach-page;
}

.nav {
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 8rpx; }
	margin-bottom: 24rpx;
}

.nav__back {
	font-size: 56rpx;
	line-height: 1;
	color: $manna-btn-text;
	padding-right: 8rpx;
}

.nav__title {
	@include manna-nav-title;
}

.q {
	@include manna-white-card;
	padding: 32rpx 28rpx;
	margin-bottom: 16rpx;
}

.q__body {
	display: block;
	font-family: $manna-font-serif;
	font-size: 32rpx;
	line-height: 1.45;
	color: $manna-btn-text;
}

.q__cite,
.q__date {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	color: rgba(33, 33, 33, 0.5);
}

.q__unmute {
	display: inline-block;
	margin-top: 16rpx;
	font-size: 26rpx;
	font-weight: 600;
	color: $manna-btn-text;
}

.empty {
	text-align: center;
	color: rgba(33, 33, 33, 0.45);
	padding: 80rpx 0;
	font-size: 26rpx;
}
</style>
