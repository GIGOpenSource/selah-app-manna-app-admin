<template>
	<!-- Figma Devotion 课节 296:2250：peach 壳 + 白圆返回 + 标题/经文 + 白卡片正文 + cream CTA -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="nav__back--press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="title">{{ session.title || t('devotion') }}</text>
		<text v-if="session.scripture_ref" class="ref">{{ session.scripture_ref }}</text>

		<scroll-view scroll-y class="body" :show-scrollbar="false">
			<view class="card">
				<text class="card__text">{{ session.body }}</text>
			</view>
			<view class="body__pad" />
		</scroll-view>

		<view class="foot">
			<button class="cta" hover-class="cta--press" :disabled="busy || done" @click="onComplete">
				{{ done ? t('devotion_done') : t('devotion_complete') }}
			</button>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiDevotionSession, apiDevotionComplete } from '@/api/devotion.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
/** 库内 session 多为数字 id；保留原字符串以免 Number('d1')→0 */
const sessionId = ref('')
const session = ref({})
const busy = ref(false)
const done = ref(false)
let started = Date.now()

function parseSessionId(raw) {
	const s = String(raw || '').trim()
	if (!s) return ''
	if (/^\d+$/.test(s)) return Number(s)
	return s
}

onLoad((q) => {
	sessionId.value = parseSessionId(q?.id)
})

async function load() {
	if (sessionId.value === '' || sessionId.value == null) return
	try {
		const res = await apiDevotionSession({ id: sessionId.value })
		session.value = res?.results || {}
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

async function onComplete() {
	if (busy.value || done.value) return
	busy.value = true
	const sec = Math.max(0, Math.round((Date.now() - started) / 1000))
	try {
		await apiDevotionComplete({
			session_id: sessionId.value,
			seconds: sec || session.value.duration_hint_sec || 0,
		})
		track('manna_devotion_complete', { session_id: sessionId.value, seconds: sec })
		done.value = true
		uni.showToast({ title: t('devotion_done'), icon: 'none' })
		setTimeout(() => {
			uni.navigateBack()
		}, 600)
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	} finally {
		busy.value = false
	}
}

function back() {
	uni.navigateBack()
}

onMounted(() => {
	started = Date.now()
	load()
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	padding: 8rpx 0 0;
	box-sizing: border-box;
	background: #fff3ee;
	color: $manna-btn-text;
	font-family: $manna-font-body;
	display: flex;
	flex-direction: column;
}

.nav {
	display: flex;
	align-items: center;
	padding: 8rpx 32rpx 16rpx;
	flex-shrink: 0;
}

.nav__back {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: $manna-white;
	box-shadow: $manna-shadow-card;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav__back--press {
	opacity: 0.7;
}

.nav__back-ico {
	width: 48rpx;
	height: 48rpx;
}

.title {
	display: block;
	padding: 8rpx 40rpx 12rpx;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 36rpx;
	line-height: 1.3;
	color: $manna-btn-text;
	flex-shrink: 0;
}

.ref {
	display: block;
	padding: 0 40rpx 24rpx;
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 24rpx;
	letter-spacing: 0.02em;
	color: rgba(33, 33, 33, 0.55);
	flex-shrink: 0;
}

.body {
	flex: 1;
	height: 0;
	padding: 0 40rpx;
	box-sizing: border-box;
}

.card {
	@include manna-white-card;
	padding: 40rpx 36rpx;
}

.card__text {
	font-family: $manna-font-body;
	font-weight: 400;
	font-size: 30rpx;
	line-height: 1.65;
	color: $manna-btn-text;
	white-space: pre-wrap;
}

.body__pad {
	height: 180rpx;
}

.foot {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 16rpx 40rpx calc(24rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(255, 243, 238, 0), #fff3ee 45%);
}

.cta {
	@include manna-cta-cream;
	width: 100%;
	height: 96rpx;
	line-height: 96rpx;
	margin: 0;
	padding: 0;
	border: none;
	background: $manna-peach-soft;
	color: $manna-btn-text;
	font-size: 30rpx;
	box-shadow: $manna-shadow;
}

.cta::after {
	border: none;
}

.cta--press {
	opacity: 0.88;
}

.cta[disabled] {
	opacity: 0.55;
}
</style>
