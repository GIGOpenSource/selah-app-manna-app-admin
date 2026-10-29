<!--
  Muted content：已屏蔽语录列表，Unmute 后移出。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ t('muted_content') }}</text>
				<view class="nav-spacer" />
			</view>
		</view>

		<view v-for="q in list" :key="q.id" class="q">
			<text class="q-body">{{ q.content }}</text>
			<text v-if="q.source_ref" class="q-cite">— {{ q.source_ref }}</text>
			<text v-if="q.muted_at" class="q-date">{{ String(q.muted_at).slice(0, 10) }}</text>
			<text class="unmute" @tap="unmute(q)">{{ t('unmute') }}</text>
		</view>
		<view v-if="!loading && !list.length" class="empty">{{ t('muted_empty') }}</view>
		<view v-if="loading" class="empty">...</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiMyAssets, apiDislike, contentTargetType } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle } = useCollapsingTitle({
	mode: 'bar',
	statusBarPx,
	fontStartRpx: 40,
	fontEndRpx: 34,
	leftStartPercent: 16,
})
const list = ref([])
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const PAGE_SIZE = 20

function goBack() {
	safeBack('/pagesA/settings/settings')
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
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		loading.value = false
	}
}

async function unmute(q) {
	try {
		await apiDislike(q.id, false, { target_type: contentTargetType(q) })
		list.value = list.value.filter((x) => x.id !== q.id)
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	}
}

onLoad(() => load(true))
onReachBottom(() => load(false))
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
.nav-title { @include selah-display-title; }
.nav-spacer { width: 88rpx; height: 88rpx; visibility: hidden; }
.q {
	padding: 32rpx;
	margin-top: 16rpx;
	background: $selah-card;
	border-radius: $selah-radius-card;
}
.q-body {
	display: block;
	font-family: $selah-font-display;
	font-size: 32rpx;
	line-height: 1.45;
}
.q-cite, .q-date {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	color: $selah-muted;
}
.unmute {
	display: inline-block;
	margin-top: 16rpx;
	font-size: 26rpx;
	font-weight: 600;
}
.empty { text-align: center; color: $selah-muted; padding: 80rpx 0; }
</style>
