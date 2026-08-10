<template>
	<!-- Figma Devotion-详情 296:2040 / 296:2250：封面头图 + 简介 + 课时列表 -->
	<view class="page">
		<view class="hero">
			<image
				v-if="detail.cover_url"
				class="hero__img"
				:src="detail.cover_url"
				mode="aspectFill"
			/>
			<view v-else class="hero__fallback" />
			<view class="hero__scrim" />
			<view class="hero__top" :style="{ paddingTop: statusBar + 'px' }">
				<view class="hero__back" hover-class="hero__back--press" @click="back">
					<image class="hero__back-ico" src="/static/ui/devotion/ico-back.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="hero__meta">
				<text class="hero__title">{{ detail.title || t('devotion') }}</text>
				<text class="hero__sub">{{ sessionMeta }}</text>
			</view>
		</view>

		<view class="about">
			<view
				class="about__avatar"
				:style="detail.cover_url ? { backgroundImage: `url(${detail.cover_url})` } : {}"
			/>
			<view class="about__body">
				<text class="about__name">{{ aboutName }}</text>
				<text class="about__desc">{{ detail.subtitle || t('devotion_sub') }}</text>
			</view>
		</view>
		<view class="rule" />

		<scroll-view scroll-y class="list" :show-scrollbar="false">
			<view
				v-for="(s, i) in sessions"
				:key="s.id"
				class="row"
				hover-class="row--press"
				@click="openSession(s, i)"
			>
				<image class="row__ico" src="/static/ui/devotion/ico-session.svg" mode="aspectFit" />
				<view class="row__body">
					<text class="row__t">{{ s.title }}</text>
					<text class="row__m">{{ s.scripture_ref || '' }}</text>
				</view>
				<image
					class="row__trail"
					:src="trailIcon(s, i)"
					mode="aspectFit"
				/>
			</view>
			<text v-if="!loading && !sessions.length" class="empty">{{ t('devotion_empty') }}</text>
			<view class="list__pad" />
		</scroll-view>

		<view v-if="continueSession" class="foot">
			<button class="cta" hover-class="cta--press" @click="openSession(continueSession.item, continueSession.index)">
				{{ t('devotion_continue') }}
			</button>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiDevotionSeriesDetail } from '@/api/devotion.js'
import { absolutizeMedia } from '@/utils/media.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const seriesId = ref(0)
const detail = ref({})
const loading = ref(false)

const sessions = computed(() => detail.value.sessions || [])

const sessionMeta = computed(() => {
	const n = detail.value.session_count || sessions.value.length || 0
	const done = sessions.value.filter((s) => s.completed).length
	if (done > 0 && n > 0) return `${done}/${n} sessions`
	return `${n} sessions`
})

const aboutName = computed(() => {
	const tags = detail.value.tags || []
	return tags[0] || t('brand')
})

const continueSession = computed(() => {
	if (detail.value.locked) return null
	const list = sessions.value
	for (let i = 0; i < list.length; i++) {
		if (!list[i].completed) return { item: list[i], index: i }
	}
	return null
})

onLoad((q) => {
	seriesId.value = Number(q?.id || 0)
})

async function load() {
	loading.value = true
	try {
		if (!seriesId.value) {
			detail.value = {}
			uni.showToast({ title: t('devotion_empty'), icon: 'none' })
			return
		}
		const res = await apiDevotionSeriesDetail({ id: seriesId.value })
		const d = res?.results || {}
		detail.value = {
			...d,
			cover_url: absolutizeMedia(d.cover_url || '') || '',
			sessions: Array.isArray(d.sessions) ? d.sessions : [],
			subtitle: d.subtitle || '',
			tags: Array.isArray(d.tags) ? d.tags : [],
		}
	} catch (e) {
		detail.value = {}
		uni.showToast({ title: t('devotion_empty'), icon: 'none' })
	} finally {
		loading.value = false
	}
}

function isLocked(index) {
	if (detail.value.locked) return true
	if (index <= 0) return false
	const prev = sessions.value[index - 1]
	return !prev?.completed
}

function trailIcon(s, index) {
	if (s.completed) return '/static/ui/devotion/ico-check.svg'
	if (isLocked(index)) return '/static/ui/devotion/ico-lock.svg'
	return '/static/ui/devotion/ico-chevron.svg'
}

function openSession(s, index) {
	if (detail.value.locked) {
		uni.showToast({ title: t('devotion_vip_locked'), icon: 'none' })
		return
	}
	if (isLocked(index)) {
		uni.showToast({ title: t('devotion_session_locked'), icon: 'none' })
		return
	}
	uni.navigateTo({ url: `/pagesA/devotion/session?id=${s.id}&series_id=${seriesId.value}` })
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/devotion/list' }) })
}

onMounted(load)
onShow(load)
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	box-sizing: border-box;
	background: #fff3ee;
	display: flex;
	flex-direction: column;
}

.hero {
	position: relative;
	height: 402rpx;
	overflow: hidden;
	background: #1a1a1a;
	flex-shrink: 0;
}

.hero__img {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}

.hero__fallback {
	position: absolute;
	inset: 0;
	background: linear-gradient(135deg, #e8a070, #8b4a2e);
}

.hero__scrim {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 136rpx;
	background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.55));
}

.hero__top {
	position: relative;
	z-index: 2;
	padding: 8rpx 40rpx 0;
}

.hero__back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.hero__back--press {
	opacity: 0.7;
}

.hero__back-ico {
	width: 48rpx;
	height: 48rpx;
}

.hero__meta {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	bottom: 28rpx;
	z-index: 2;
}

.hero__title {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 40rpx;
	color: #fff;
}

.hero__sub {
	display: block;
	margin-top: 4rpx;
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.7);
}

.about {
	display: flex;
	gap: 24rpx;
	padding: 16rpx 40rpx;
	align-items: flex-start;
}

.about__avatar {
	width: 80rpx;
	height: 80rpx;
	border-radius: 16rpx;
	flex-shrink: 0;
	background: linear-gradient(135deg, #f0c9a8, #c9896a);
	background-size: cover;
	background-position: center;
}

.about__body {
	flex: 1;
	min-width: 0;
}

.about__name {
	display: block;
	font-family: $manna-font-body;
	font-weight: 500;
	font-size: 32rpx;
	color: $manna-btn-text;
}

.about__desc {
	display: block;
	margin-top: 4rpx;
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 24rpx;
	line-height: 1.4;
	color: rgba(33, 33, 33, 0.7);
}

.rule {
	margin: 8rpx 40rpx 8rpx;
	height: 1rpx;
	background: rgba(33, 33, 33, 0.1);
}

.list {
	flex: 1;
	height: 0;
	padding-bottom: 24rpx;
}

.list__pad {
	height: 160rpx;
}

.row {
	display: flex;
	align-items: center;
	gap: 24rpx;
	padding: 16rpx 40rpx;
}

.row--press {
	opacity: 0.88;
	background: rgba(255, 255, 255, 0.35);
}

.row__ico {
	width: 44rpx;
	height: 44rpx;
	flex-shrink: 0;
}

.row__body {
	flex: 1;
	min-width: 0;
}

.row__t {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 28rpx;
	color: $manna-btn-text;
}

.row__m {
	display: block;
	margin-top: 4rpx;
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.7);
}

.row__trail {
	width: 44rpx;
	height: 44rpx;
	flex-shrink: 0;
}

.empty {
	margin: 48rpx 40rpx;
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}

.foot {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 16rpx 40rpx calc(24rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(255, 243, 238, 0), #fff3ee 40%);
}

.cta {
	height: 88rpx;
	line-height: 88rpx;
	margin: 0;
	padding: 0;
	border: none;
	border-radius: 500rpx;
	background: $manna-btn-text;
	color: #fff;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 28rpx;
}

.cta::after {
	border: none;
}

.cta--press {
	opacity: 0.88;
}
</style>
