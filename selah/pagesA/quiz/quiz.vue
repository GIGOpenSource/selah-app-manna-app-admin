<!--
  Quiz 列表：拉取 /content/quiz/list/，点选开始。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
			</view>
			<text class="page-title">{{ t('quiz_title') }}</text>
			<text class="page-lead">{{ t('quiz_lead') }}</text>
		</view>

		<view v-if="loading" class="tip">{{ t('requesting') }}</view>
		<view v-else-if="!list.length" class="empty">{{ t('quiz_empty') }}</view>

		<view
			v-for="q in list"
			:key="q.id"
			:id="'expo-' + q.id"
			:data-xid="q.id"
			class="card expo-quiz"
			@tap="onStart(q)"
		>
			<image
				v-if="q.cover_url"
				class="cover"
				:src="q.cover_url"
				mode="aspectFill"
			/>
			<view v-else class="cover cover-fallback">
				<image class="cover-art" src="/static/ui/art-quiz.png" mode="aspectFit" />
			</view>
			<view class="body">
				<view class="title-row">
					<text class="title">{{ q.title }}</text>
					<text v-if="q.locked" class="lock">VIP</text>
				</view>
				<text v-if="q.subtitle" class="sub">{{ q.subtitle }}</text>
				<text class="meta">{{ t('quiz_questions_n', { n: q.question_count || 0 }) }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { t } from '@/i18n/index.js'
import { apiQuizList, apiQuizStart } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { goVip } from '@/utils/vip.js'

const statusBarPx = getStatusBarPx()
const list = ref([])
const loading = ref(true)
const starting = ref(false)

function goBack() {
	safeBack('/pages/profile/profile')
}

async function load() {
	loading.value = true
	try {
		const res = await apiQuizList()
		list.value = res.results || []
	} catch (e) {
		list.value = []
	} finally {
		loading.value = false
	}
}

async function onStart(q) {
	if (starting.value) return
	if (q.locked) {
		goVip('quiz_lock')
		return
	}
	starting.value = true
	try {
		const res = await apiQuizStart(q.id)
		const data = res.results || {}
		try {
			uni.setStorageSync('quiz_play_payload', data)
		} catch (e) {}
		uni.navigateTo({
			url: `/pagesA/quiz/play?attempt_id=${data.attempt_id}&quiz_id=${data.quiz_id}`,
		})
	} catch (e) {
		if (e?.code === 403) {
			goVip('quiz_lock')
			return
		}
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		starting.value = false
	}
}

onMounted(load)
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
	align-items: center;
	min-height: 88rpx;
}
.nav-pill {
	@include selah-nav-circle;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.page-title {
	display: block;
	position: relative;
	z-index: 1;
	@include selah-display-title;
	font-size: 48rpx;
	margin-top: 8rpx;
}
.page-lead {
	display: block;
	position: relative;
	z-index: 1;
	font-size: 28rpx;
	color: $selah-ink-soft;
	line-height: 1.4;
	margin: 12rpx 0 28rpx;
}
.card {
	display: flex;
	flex-direction: row;
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 24rpx;
	margin-bottom: 16rpx;
	box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.04);
}
.cover {
	width: 140rpx;
	height: 140rpx;
	border-radius: 24rpx;
	flex-shrink: 0;
	background: #e8e0d4;
	overflow: hidden;
}
.cover-fallback {
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(145deg, #b6badf, #fff0d9);
}
.cover-art {
	width: 100rpx;
	height: 100rpx;
}
.body {
	flex: 1;
	min-width: 0;
	padding-left: 24rpx;
	display: flex;
	flex-direction: column;
	justify-content: center;
}
.title-row {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.title {
	flex: 1;
	font-size: 30rpx;
	font-weight: 600;
	color: $selah-ink;
}
.lock {
	margin-left: 12rpx;
	background: $selah-ink;
	color: #fff;
	font-size: 20rpx;
	padding: 4rpx 12rpx;
	border-radius: 999rpx;
}
.sub {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: $selah-ink-soft;
	line-height: 1.35;
}
.meta {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	color: $selah-muted;
}
.tip,
.empty {
	text-align: center;
	color: $selah-muted;
	padding: 80rpx 24rpx;
	font-size: 28rpx;
}
</style>
