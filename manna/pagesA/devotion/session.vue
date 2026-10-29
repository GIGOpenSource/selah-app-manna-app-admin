<template>
	<!-- 课节阅读：课包封面头图 + 课名/经文卡 + 正文 + Amen -->
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
			<view class="hero__meta">
				<text class="hero__title">{{ seriesTitle }}</text>
				<text v-if="sessionMeta" class="hero__sub">{{ sessionMeta }}</text>
			</view>
		</view>

		<scroll-view scroll-y class="sheet" :show-scrollbar="false">
			<text class="lesson">{{ session.title || t('devotion') }}</text>

			<view v-if="hasScripture" class="verse">
				<text v-if="scriptureText" class="verse__t">{{ scriptureText }}</text>
				<text v-if="scriptureRef" class="verse__ref">{{ scriptureRef }}</text>
			</view>

			<text v-for="(p, i) in paragraphs" :key="i" class="para">{{ p }}</text>
			<text v-if="!paragraphs.length" class="empty">{{ t('devotion_empty') }}</text>
			<view class="sheet__pad" />
		</scroll-view>

		<button
			class="amen"
			:class="{ 'amen--done': done }"
			hover-class="amen--press"
			:disabled="busy || done"
			@click="onComplete"
		>
			<image class="amen__ico" src="/static/ui/prayer/ico-amen.svg" mode="aspectFit" />
			<text class="amen__txt">{{ done ? t('amen_done') : t('amen') }}</text>
		</button>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiDevotionSession, apiDevotionComplete } from '@/api/devotion.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { stashNewlyEarned } from '@/utils/badges.js'
import { absolutizeMedia } from '@/utils/media.js'

const statusBar = getStatusBarPx()
/** 库内 session 多为数字 id；保留原字符串以免 Number('d1')→0 */
const sessionId = ref('')
const seriesId = ref('')
const session = ref({})
const busy = ref(false)
const done = ref(false)
const loading = ref(false)
let started = Date.now()

const cover = computed(() => {
	const raw = String(session.value.cover_url || session.value.series_cover_url || '').trim()
	return raw ? (absolutizeMedia(raw) || raw) : ''
})

const seriesTitle = computed(() => {
	return session.value.series_title || t('devotion')
})

const sessionMeta = computed(() => {
	const n = Number(session.value.session_index || 0)
	const total = Number(session.value.session_count || 0)
	if (n > 0 && total > 0) return t('devotion_sessions_progress', { done: n, n: total })
	if (total > 0) return t('devotion_sessions', { n: total })
	return ''
})

const scriptureText = computed(() => String(session.value.scripture_text || '').trim())
const scriptureRef = computed(() => String(session.value.scripture_ref || '').trim())
const hasScripture = computed(() => !!(scriptureText.value || scriptureRef.value))

const paragraphs = computed(() => {
	return String(session.value.body || '')
		.split(/\n+/)
		.map((s) => s.trim())
		.filter(Boolean)
})

function parseSessionId(raw) {
	const s = String(raw || '').trim()
	if (!s) return ''
	if (/^\d+$/.test(s)) return Number(s)
	return s
}

onLoad((q) => {
	sessionId.value = parseSessionId(q?.id)
	seriesId.value = String(q?.series_id || '').trim()
})

async function load() {
	if (sessionId.value === '' || sessionId.value == null) return
	loading.value = true
	try {
		const res = await apiDevotionSession({ id: sessionId.value })
		session.value = res?.results || {}
		if (!seriesId.value && session.value.series_id) {
			seriesId.value = String(session.value.series_id)
		}
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	} finally {
		loading.value = false
	}
}

async function onComplete() {
	if (busy.value || done.value) return
	busy.value = true
	const sec = Math.max(0, Math.round((Date.now() - started) / 1000))
	try {
		const res = await apiDevotionComplete({
			session_id: sessionId.value,
			seconds: Math.max(sec, Number(session.value.duration_hint_sec) || 0, 60),
		})
		track('manna_devotion_complete', { session_id: sessionId.value, seconds: sec })
		done.value = true
		const d = res?.results || {}
		stashNewlyEarned(d.newly_earned)
		const q = [
			`delta=${d.manna_delta || 0}`,
			`balance=${d.balance ?? ''}`,
			`sec=${d.seconds || sec}`,
			`session_id=${encodeURIComponent(sessionId.value)}`,
		]
		if (seriesId.value) q.push(`series_id=${encodeURIComponent(seriesId.value)}`)
		uni.navigateTo({
			url: `/pagesA/devotion/result?${q.join('&')}`,
		})
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	} finally {
		busy.value = false
	}
}

function back() {
	uni.navigateBack({
		fail: () => {
			if (seriesId.value) {
				uni.redirectTo({ url: `/pagesA/devotion/detail?id=${encodeURIComponent(seriesId.value)}` })
				return
			}
			uni.switchTab({ url: '/pages/devotion/list' })
		},
	})
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
	height: 100vh;
	box-sizing: border-box;
	background: #fff;
	color: $manna-btn-text;
	font-family: $manna-font-body;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.hero {
	position: relative;
	height: 420rpx;
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
	inset: 0;
	background: linear-gradient(180deg, rgba(0, 0, 0, 0.18) 0%, rgba(0, 0, 0, 0.05) 42%, rgba(0, 0, 0, 0.55) 100%);
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

.hero__meta {
	position: absolute;
	left: 40rpx;
	right: 40rpx;
	bottom: 28rpx;
	z-index: 2;
}

.hero__title {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 40rpx;
	line-height: 1.25;
	color: #fff;
}

.hero__sub {
	display: block;
	margin-top: 6rpx;
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.78);
}

.sheet {
	flex: 1;
	height: 0;
	padding: 40rpx 40rpx 0;
	box-sizing: border-box;
}

.lesson {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 40rpx;
	line-height: 1.3;
	color: $manna-btn-text;
	margin-bottom: 28rpx;
}

.verse {
	padding: 28rpx 32rpx;
	margin-bottom: 36rpx;
	border-radius: 24rpx;
	background: #fff4ee;
}

.verse__t {
	display: block;
	font-family: $manna-font-serif;
	font-weight: 400;
	font-size: 32rpx;
	line-height: 1.45;
	color: $manna-btn-text;
}

.verse__ref {
	display: block;
	margin-top: 16rpx;
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.45);
}

.para {
	display: block;
	font-family: $manna-font-body;
	font-weight: 400;
	font-size: 28rpx;
	line-height: 1.7;
	color: rgba(33, 33, 33, 0.78);
	margin-bottom: 28rpx;
}

.empty {
	display: block;
	text-align: center;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
	padding: 48rpx 0;
}

.sheet__pad {
	height: 220rpx;
}

.amen {
	position: fixed;
	left: 50%;
	bottom: calc(40rpx + env(safe-area-inset-bottom, 0px));
	transform: translateX(-50%);
	z-index: 3;
	width: 600rpx;
	height: 104rpx;
	padding: 0;
	margin: 0;
	border: none;
	border-radius: $manna-radius-btn;
	font-family: $manna-font-body;
	font-weight: 700;
	/* 参考图：实色暖棕胶囊 + 白字白图标；压过 uni button 默认/禁用灰态 */
	background: $manna-amen-solid !important;
	color: #fff !important;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	opacity: 0.95;
}

.amen::after { border: none; }

.amen--press {
	transform: translateX(-50%) scale(0.97);
	opacity: 1;
}

/* 禁用/完成：保持实色，勿用整钮 opacity（App 端会叠默认灰态→几乎看不见） */
.amen[disabled],
.amen.amen--done {
	opacity: 1 !important;
	background: #e8d4c4 !important;
	color: $manna-btn-text !important;
}

.amen__ico {
	width: 44rpx;
	height: 44rpx;
	margin-right: 8rpx;
	flex-shrink: 0;
	/* amen.png 为深色线稿，靠反相换成白色以贴合暖棕底 */
	filter: brightness(0) invert(1);
}

.amen[disabled] .amen__ico,
.amen.amen--done .amen__ico {
	filter: none;
}

.amen__txt {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 32rpx;
	color: #fff;
	line-height: 1;
}
</style>
