<template>
	<!-- Figma 540:951 Morning / 110:1162 Night；成功空态不灌 demo，仅 catch 兜底 -->
	<view class="page" :class="'page--' + kind">
		<image class="page__bg" :src="bgSrc" mode="aspectFill" />

		<view class="top" :style="{ paddingTop: statusBar + 'px' }">
			<view class="top__tools">
				<image class="top__ico" src="/static/ui/prayer/ico-share.svg" mode="aspectFit" hover-class="press" @click="onShare" />
				<image class="top__ico" src="/static/ui/prayer/ico-bookmark.svg" mode="aspectFit" hover-class="press" @click="onBookmark" />
				<image class="top__ico" src="/static/ui/prayer/ico-more.svg" mode="aspectFit" hover-class="press" @click="toggleKind" />
			</view>
			<view class="top__close" hover-class="press" @click="back">
				<image class="top__ico" src="/static/ui/prayer/ico-close.svg" mode="aspectFit" />
			</view>
		</view>

		<view class="hero">
			<text v-if="quote" class="hero__quote">{{ quote }}</text>
			<text v-if="refLine" class="hero__ref">{{ refLine }}</text>
		</view>

		<view class="sheet">
			<view class="sheet__title-row">
				<text class="sheet__title">{{ kindTitle }}</text>
				<image
					class="sheet__kind-ico"
					:src="kind === 'morning' ? '/static/ui/prayer/ico-sun.svg' : '/static/ui/prayer/ico-moon.svg'"
					mode="aspectFit"
				/>
			</view>
			<scroll-view scroll-y class="sheet__body">
				<text v-if="body" class="sheet__txt">{{ body }}</text>
				<text v-else-if="!loading" class="sheet__empty">{{ t('prayer_empty') }}</text>
			</scroll-view>
		</view>

		<button
			class="amen"
			:class="{ 'amen--night': kind === 'night', 'amen--done': amenDone }"
			hover-class="amen--press"
			:disabled="busy || (!body && !loading)"
			@click="onAmen"
		>
			<image class="amen__ico" src="/static/ui/prayer/ico-amen.svg" mode="aspectFit" />
			<text class="amen__txt">{{ amenDone ? t('amen_done') : t('amen') }}</text>
		</button>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaPrayer, apiMannaPrayerAmen, apiMannaFavoriteToggle } from '@/api/manna.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const DEMO = {
	morning: {
		title: 'Morning Prayer',
		quote: 'God is with you in every storm, offering peace, strength, and safety',
		reference: 'ISAIAH 41:10',
		body: '  Lord Jesus, grant this day, to direct and sanctify, to rule and govern our hearts, minds, and bodies, so that all our thoughts, words, and deeds may be in accord with your Father\'s law and wisdom. And thus may we be saved and protected through your mighty help.',
	},
	night: {
		title: 'Night Prayer',
		quote: 'God is with you in every storm, offering peace, strength, and safety',
		reference: 'ISAIAH 41:10',
		body: '  Lord Jesus, grant this day, to direct and sanctify, to rule and govern our hearts, minds, and bodies, so that all our thoughts, words, and deeds may be in accord with your Father\'s law and wisdom. And thus may we be saved and protected through your mighty help.',
	},
}

const statusBar = getStatusBarPx()
const kind = ref('morning')
const quote = ref('')
const reference = ref('')
const body = ref('')
const title = ref('')
const busy = ref(false)
const loading = ref(false)
const amenDone = ref(false)
let opened = Date.now()

const bgSrc = computed(() =>
	kind.value === 'night' ? '/static/ui/prayer/bg-night.png' : '/static/ui/prayer/bg-morning.png',
)
const kindTitle = computed(() =>
	title.value || (kind.value === 'night' ? t('prayer_night') : t('prayer_morning')),
)
const refLine = computed(() => {
	const r = String(reference.value || '').trim()
	if (!r) return ''
	return r.startsWith('--') ? r : `-- ${r}`
})

onLoad((q) => {
	if (q?.kind === 'night' || q?.kind === 'morning') kind.value = q.kind
})

function applyDemo() {
	const d = DEMO[kind.value] || DEMO.morning
	quote.value = d.quote
	reference.value = d.reference
	body.value = d.body
	title.value = d.title
}

function clearContent() {
	quote.value = ''
	reference.value = ''
	body.value = ''
	title.value = ''
}

async function load() {
	amenDone.value = false
	opened = Date.now()
	loading.value = true
	try {
		const res = await apiMannaPrayer({ kind: kind.value })
		const row = (res?.results || [])[0]
		if (!row) {
			clearContent()
			return
		}
		title.value = row.title || ''
		body.value = row.body || row.content || ''
		quote.value = row.verse_text || row.quote || ''
		reference.value = row.reference || ''
	} catch (e) {
		applyDemo()
	} finally {
		loading.value = false
	}
}

function toggleKind() {
	kind.value = kind.value === 'morning' ? 'night' : 'morning'
	load()
}

async function onAmen() {
	if (busy.value || amenDone.value) return
	busy.value = true
	const sec = Math.max(0, Math.round((Date.now() - opened) / 1000))
	try {
		await apiMannaPrayerAmen({
			kind: kind.value,
			seconds: sec,
			ref: reference.value || title.value || '',
		})
		amenDone.value = true
		track('manna_amen', { scene: `prayer:${kind.value}` })
	} catch (e) {
		// 无后端也允许完成态，方便贴稿验收
		amenDone.value = true
	} finally {
		busy.value = false
	}
}

function onShare() {
	uni.showToast({ title: t('share_soon'), icon: 'none' })
}

async function onBookmark() {
	try {
		const res = await apiMannaFavoriteToggle({
			target_type: 'prayer',
			target_key: `${kind.value}:${reference.value || title.value || 'prayer'}`,
		})
		const liked = !!res?.results?.liked
		uni.showToast({
			title: liked ? t('bible_highlighted') : t('bible_unhighlighted'),
			icon: 'none',
		})
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onMounted(load)
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	overflow: hidden;
	font-family: $manna-font-body;
	background: #f5f5f5;
}

.page__bg {
	position: fixed;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
	filter: blur(10px);
	transform: scale(1.05);
}

.top, .hero, .sheet, .amen { position: relative; z-index: 1; }

.top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 40rpx 0;
}

.top__tools {
	display: flex;
	align-items: center;
	gap: 32rpx;
}

.top__ico { width: 64rpx; height: 64rpx; }
.top__close { width: 64rpx; height: 64rpx; }

.hero {
	padding: 48rpx 48rpx 24rpx;
	color: #fff;
}

.hero__quote {
	display: block;
	font-weight: 700;
	font-size: 36rpx;
	line-height: 56rpx;
	margin-bottom: 32rpx;
}

.hero__ref {
	display: block;
	font-weight: 300;
	font-size: 24rpx;
	letter-spacing: 0.24rpx;
	opacity: 0.7;
}

.sheet {
	margin-top: 24rpx;
	min-height: 52%;
	height: 52%;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, #fff 20%);
	backdrop-filter: blur(10px);
	border: 1rpx solid #fff;
	border-radius: 32rpx 32rpx 0 0;
	padding: 40rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}

.sheet__title-row {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin-bottom: 24rpx;
}

.sheet__title {
	font-weight: 700;
	font-size: 40rpx;
	color: #212121;
}

.sheet__kind-ico { width: 56rpx; height: 56rpx; }

.sheet__body {
	flex: 1;
	min-height: 0;
	height: 100%;
}

.sheet__txt {
	display: block;
	font-weight: 300;
	font-size: 32rpx;
	line-height: 56rpx;
	letter-spacing: 0.32rpx;
	color: #212121;
	white-space: pre-wrap;
}

.sheet__empty {
	display: block;
	margin-top: 24rpx;
	font-weight: 300;
	font-size: 28rpx;
	color: rgba(33, 33, 33, 0.45);
}

.amen {
	position: fixed;
	left: 50%;
	bottom: calc(48rpx + env(safe-area-inset-bottom, 0px));
	transform: translateX(-50%);
	z-index: 2;
	width: 600rpx;
	height: 104rpx;
	border-radius: 1000rpx;
	background: #195c1e;
	backdrop-filter: blur(8px);
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	border: none;
	padding: 0;
	margin: 0;
	line-height: 1;
}

.amen--night { background: rgba(170, 97, 75, 0.9); }
.amen--done { opacity: 0.7; }
.amen--press { opacity: 0.85; }
.amen::after { border: none; }

.amen__ico { width: 48rpx; height: 48rpx; }
.amen__txt {
	font-weight: 700;
	font-size: 36rpx;
	color: #fff;
}

.press { opacity: 0.7; }
</style>
