<template>
	<!-- 已读完故事正文：封面头图 + blocks 图文 -->
	<view class="page">
		<view class="hero">
			<image v-if="cover" class="hero__img" :src="cover" mode="aspectFill" />
			<view v-else class="hero__fallback" />
			<view class="hero__scrim" />
			<view v-if="loading" class="hero__loading">
				<view class="hero__spin" />
			</view>
			<view class="hero__top" :style="{ paddingTop: statusBar + 'px' }">
				<view class="hero__back" hover-class="hero__back--press" @click="back">
					<image class="hero__back-ico" src="/static/ui/devotion/ico-back.svg" mode="aspectFit" />
				</view>
			</view>
			<text class="hero__title">{{ title }}</text>
		</view>

		<view class="body">
			<template v-for="(b, i) in blocks" :key="i">
				<text v-if="b.type === 'text'" class="para">{{ b.text }}</text>
				<view v-else-if="b.type === 'image'" class="illust">
					<image v-if="b.url" class="illust__img" :src="b.url" mode="aspectFill" />
				</view>
			</template>
			<text v-if="!loading && !blocks.length" class="empty">{{ t('quiz_story_empty') }}</text>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiQuizStoryDetail } from '@/api/quiz.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { absolutizeMedia } from '@/utils/media.js'

const statusBar = getStatusBarPx()
const storyId = ref('')
const title = ref('')
const cover = ref('')
const blocks = ref([])
const loading = ref(false)

onLoad((q) => {
	storyId.value = String(q?.id || '')
	if (q?.title) title.value = decodeURIComponent(String(q.title))
	load()
})

function mediaUrl(raw) {
	const s = String(raw || '').trim()
	if (!s) return ''
	return absolutizeMedia(s) || s
}

function parseBlocks(raw) {
	let list = raw
	if (typeof list === 'string') {
		try { list = JSON.parse(list) } catch { list = [] }
	}
	return Array.isArray(list) ? list : []
}

function pushText(out, text) {
	String(text || '')
		.split(/\n+/)
		.map((s) => s.trim())
		.filter(Boolean)
		.forEach((line) => out.push({ type: 'text', text: line }))
}

function normalizeBlocks(raw) {
	const out = []
	const fromApi = parseBlocks(raw?.blocks)
	if (fromApi.length) {
		fromApi.forEach((b) => {
			if (b?.type === 'image') {
				out.push({ type: 'image', url: mediaUrl(b.url), alt: String(b.alt || '') })
				return
			}
			pushText(out, b?.text || b?.body || '')
		})
		return out
	}
	pushText(out, raw?.body || '')
	const img = mediaUrl(raw?.cover_url || raw?.card_url)
	if (img) out.push({ type: 'image', url: img })
	return out
}

async function load() {
	if (!storyId.value) {
		uni.showToast({ title: t('quiz_stories_empty'), icon: 'none' })
		return
	}
	loading.value = true
	try {
		const res = await apiQuizStoryDetail({ id: storyId.value })
		const d = res?.results || {}
		title.value = d.title || title.value
		cover.value = mediaUrl(d.cover_url || d.card_url)
		blocks.value = normalizeBlocks(d)
		if (!cover.value) {
			const firstImg = blocks.value.find((b) => b.type === 'image' && b.url)
			if (firstImg) cover.value = firstImg.url
		}
	} catch (e) {
		blocks.value = []
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	} finally {
		loading.value = false
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.navigateTo({ url: '/pagesA/quiz/stories' }) })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	background: #fff;
	box-sizing: border-box;
	font-family: $manna-font-body;
	color: $manna-btn-text;
}

.hero {
	position: relative;
	height: 420rpx;
	overflow: hidden;
	background: #1a1a1a;
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
	background: linear-gradient(160deg, #e8a070, #8b4a2e);
}

.hero__scrim {
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0.08) 42%, rgba(0, 0, 0, 0.55) 100%);
}

.hero__loading {
	position: absolute;
	inset: 0;
	z-index: 3;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.45);
	pointer-events: none;
}

.hero__spin {
	width: 68rpx;
	height: 68rpx;
	border: 6rpx solid rgba(255, 255, 255, 0.45);
	border-top-color: #fff;
	border-radius: 50%;
	animation: hero-spin 0.8s linear infinite;
}

@keyframes hero-spin {
	to { transform: rotate(360deg); }
}

.hero__top {
	position: relative;
	z-index: 2;
	padding: 8rpx 24rpx 0;
}

.hero__back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.hero__back--press { opacity: 0.7; }
.hero__back-ico { width: 48rpx; height: 48rpx; }

.hero__title {
	position: absolute;
	left: 40rpx;
	right: 40rpx;
	bottom: 28rpx;
	z-index: 2;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 40rpx;
	line-height: 1.25;
	color: #fff;
}

.body {
	padding: 40rpx 40rpx 80rpx;
}

.para {
	display: block;
	font-family: $manna-font-body;
	font-weight: 400;
	font-size: 28rpx;
	line-height: 1.7;
	color: rgba(33, 33, 33, 0.78);
	margin-bottom: 32rpx;
}

.illust {
	width: 100%;
	height: 280rpx;
	margin: 8rpx 0 36rpx;
	border-radius: 24rpx;
	overflow: hidden;
	background: #e8e8e8;
}

.illust__img {
	width: 100%;
	height: 100%;
	display: block;
}

.empty {
	display: block;
	text-align: center;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
	padding: 48rpx 0;
}
</style>
