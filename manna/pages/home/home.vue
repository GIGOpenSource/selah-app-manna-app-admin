<template>
	<!-- Figma Home 279:364；背景 fixed，页面本身不滚动 -->
	<view class="home" :style="{ paddingTop: statusBar + 'px' }">
		<image class="home__bg" src="/static/ui/home/bg-279-364.png" mode="aspectFill" />

		<view class="home__top">
			<view
				class="home__top-btn"
				:class="{ 'is-spinning': listening }"
				hover-class="home__top-btn--press"
				@click.stop="onMusic"
			>
				<image
					class="home__top-ico"
					:class="{ 'is-listening': listening }"
					src="/static/ui/home/ico-music.svg"
					mode="aspectFit"
				/>
			</view>
			<view class="home__top-right">
				<view class="home__top-btn" hover-class="home__top-btn--press" @click.stop="onShare">
					<image class="home__top-ico" src="/static/ui/home/ico-share.svg" mode="aspectFit" />
				</view>
				<view class="home__top-btn" hover-class="home__top-btn--press" @click.stop="onLike">
					<image
						class="home__top-ico"
						:class="{ 'is-liked': liked }"
						src="/static/ui/home/ico-heart.svg"
						mode="aspectFit"
					/>
				</view>
			</view>
		</view>

		<!-- Figma 279:368：God → mid → storm → ref；key 固定，避免卡片挂载时 H5 复用错位 -->
		<view
			class="home__stage"
			:class="{ 'home__stage--poetic': !!poetic }"
			:style="poetic ? poeticStageStyle : undefined"
		>
			<template v-if="poetic">
				<text :key="'pg-' + poetic.line1" class="home__god">{{ poetic.line1 }}</text>
				<text :key="'pm-' + poetic.mid" class="home__mid">{{ poetic.mid }}</text>
				<text :key="'ps-' + poetic.line2" class="home__storm">{{ poetic.line2 }}</text>
				<text :key="'pr-' + (reference || 'ref')" class="home__ref">{{ reference || t('home_ref_placeholder') }}</text>
			</template>
			<template v-else>
				<text :key="'solo-title'" class="home__god home__god--solo">{{ displayTitle }}</text>
				<text :key="'solo-body'" class="home__body">{{ verseText || t('home_verse_placeholder') }}</text>
				<text :key="'solo-ref'" class="home__ref">{{ reference || t('home_ref_placeholder') }}</text>
			</template>
		</view>

		<view class="home__foot">
			<button
				class="home__amen"
				hover-class="home__amen--press"
				:disabled="amenBusy"
				@click="onAmen"
			>
				<image class="home__amen-ico" src="/static/ui/home/ico-amen.svg" mode="aspectFit" />
				<text class="home__amen-txt">{{ amenDone ? t('amen_done') : t('amen') }}</text>
			</button>
			<text v-if="loadHint" class="home__hint">{{ loadHint }}</text>
			<!-- 运营卡：每张卡一个容器，title/subtitle 各一个 text，勿拆词 -->
			<scroll-view
				v-if="cards.length"
				scroll-x
				class="home__cards"
				:show-scrollbar="false"
				enable-flex
			>
				<view class="home__cards-inner">
					<view
						v-for="c in cards"
						:key="'card-' + c.id"
						class="home__card"
						hover-class="home__card--press"
						@click="onCard(c)"
					>
						<text class="home__card-t">{{ c.title }}</text>
						<text class="home__card-s">{{ c.subtitle }}</text>
					</view>
				</view>
			</scroll-view>
		</view>

		<MannaTabBar v-if="tabOn" active="home" variant="dark" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch, getCurrentInstance } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { ensureLogin } from '@/utils/session.js'
import {
	apiDailyVerse,
	apiMannaAmen,
	apiMannaFavoriteToggle,
	apiMannaSharePayload,
	apiMannaHomeCards,
} from '@/api/manna.js'
import { apiBibleChapter } from '@/api/bible.js'
import { host } from '@/config/config.js'
import { copyShareText } from '@/utils/share.js'
import { track } from '@/utils/analytics.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import MannaTabBar from '@/components/MannaTabBar.vue'

const LISTEN_KEY = 'manna_bible_listen'

function absolutizeMedia(url) {
	if (!url) return ''
	if (/^https?:\/\//i.test(url)) return url
	const origin = String(host || '').replace(/\/api\/?$/, '')
	return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}

const statusBar = getStatusBarPx()
const tabOn = ref(true)
const verseText = ref('')
const reference = ref('')
const bibleBook = ref('')
const bibleChapter = ref(0)
const amenDone = ref(false)
const amenBusy = ref(false)
const loadHint = ref('')
const liked = ref(false)
const cards = ref([])
const listening = ref(false)
let homeAudio = null

function stopHomeAudio() {
	if (homeAudio) {
		try { homeAudio.stop() } catch (e) {}
		try { homeAudio.destroy() } catch (e) {}
		homeAudio = null
	}
	listening.value = false
}

function playHomeAudio(url) {
	stopHomeAudio()
	homeAudio = uni.createInnerAudioContext()
	homeAudio.src = url
	homeAudio.onEnded(() => { listening.value = false })
	homeAudio.onError(() => {
		listening.value = false
		uni.showToast({ title: t('bible_audio_fail'), icon: 'none' })
	})
	homeAudio.play()
	listening.value = true
}

const poetic = computed(() => {
	const refTxt = (reference.value || '').toUpperCase().replace(/\s+/g, ' ').trim()
	if (refTxt.includes('ISAIAH 41:10') || refTxt.includes('ISAIAH41:10')) {
		return {
			line1: 'God',
			// 副标题单节点两行，避免拆成两个 mid 对象被 H5 复用错位
			mid: 'is with you\nin every',
			line2: 'storm',
		}
	}
	return null
})

/** 375 设计稿字号；窄屏/宽屏用 clamp，再用 fit 缩放避免花体折行叠字 */
const POETIC_FS = {
	godMin: 72,
	godMax: 128,
	midMin: 24,
	midMax: 36,
	refMin: 22,
	refMax: 28,
}

const poeticFit = ref(1)
const poeticStageStyle = computed(() => {
	const fit = poeticFit.value
	return {
		'--poetic-fit': String(fit),
		'--poetic-god': `clamp(${POETIC_FS.godMin}rpx, 17.06vw, ${POETIC_FS.godMax}rpx)`,
		'--poetic-mid': `clamp(${POETIC_FS.midMin}rpx, 4.8vw, ${POETIC_FS.midMax}rpx)`,
		'--poetic-ref': `clamp(${POETIC_FS.refMin}rpx, 3.73vw, ${POETIC_FS.refMax}rpx)`,
	}
})

const proxy = getCurrentInstance()?.proxy

function fitPoeticStage() {
	if (!poetic.value) {
		poeticFit.value = 1
		return
	}
	poeticFit.value = 1
	nextTick(() => {
		try {
			const q = uni.createSelectorQuery().in(proxy)
			q.select('.home__stage--poetic').boundingClientRect()
			q.select('.home__god').boundingClientRect()
			q.select('.home__storm').boundingClientRect()
			q.select('.home__mid').boundingClientRect()
			q.exec((res) => {
				const stage = res?.[0]
				const god = res?.[1]
				const storm = res?.[2]
				const mid = res?.[3]
				if (!stage?.width) return
				const pad = 24
				const maxW = Math.max(1, stage.width - pad)
				const need = Math.max(god?.width || 0, storm?.width || 0, mid?.width || 0)
				if (need <= maxW) {
					poeticFit.value = 1
					return
				}
				poeticFit.value = Math.min(1, Math.max(0.72, (maxW / need) * 0.98))
			})
		} catch (e) {
			poeticFit.value = 1
		}
	})
}

watch(poetic, () => fitPoeticStage(), { immediate: true })
watch(reference, () => fitPoeticStage())

const displayTitle = computed(() => {
	const v = (verseText.value || '').trim()
	if (!v) return t('brand')
	const word = v.split(/\s+/).find((w) => w.length > 2) || t('brand')
	return word.replace(/[^a-zA-Z']/g, '') || t('brand')
})

const verseKey = computed(() =>
	(reference.value || verseText.value || 'today').slice(0, 120),
)

async function loadVerse() {
	try {
		const res = await apiDailyVerse()
		const d = res?.results || {}
		if (d.verse_text) {
			verseText.value = d.verse_text
			reference.value = d.reference || ''
			bibleBook.value = (d.bible_book || '').trim()
			bibleChapter.value = Number(d.chapter) || 0
			loadHint.value = ''
		} else {
			loadHint.value = t('home_empty_hint')
		}
	} catch (e) {
		loadHint.value = t('home_load_fail')
	}
	await nextTick()
	try {
		if (typeof document !== 'undefined' && document.fonts?.ready) {
			await document.fonts.ready
		}
	} catch (e) {}
	fitPoeticStage()
}

async function loadCards() {
	try {
		const res = await apiMannaHomeCards()
		const list = Array.isArray(res?.results) ? res.results : []
		// 规范化：保证每张卡 title/subtitle 完整，不因空字段被拆碎
		cards.value = list.map((c, i) => ({
			id: c.id ?? `card-${i}`,
			card_type: c.card_type || '',
			title: String(c.title || '').trim(),
			subtitle: String(c.subtitle || '').trim(),
			cover_url: c.cover_url || '',
			link_path: String(c.link_path || '').trim(),
			payload: c.payload || {},
		})).filter((c) => c.title)
	} catch (e) {
		cards.value = []
	}
}

onShow(() => {
	tabOn.value = true
	hideNativeTabBar()
	fitPoeticStage()
})

onHide(() => {
	tabOn.value = false
	stopHomeAudio()
})

onUnload(() => {
	tabOn.value = false
	stopHomeAudio()
})

onMounted(async () => {
	tabOn.value = true
	hideNativeTabBar()
	try {
		await ensureLogin({ explicit: true })
	} catch (e) {}
	// 先经文后卡片，避免 H5 同步挂载时 text 节点复用错位
	await loadVerse()
	await nextTick()
	await loadCards()
	await nextTick()
	fitPoeticStage()
})

watch(cards, () => {
	nextTick(() => fitPoeticStage())
})

async function onAmen() {
	if (amenBusy.value) return
	amenBusy.value = true
	try {
		await apiMannaAmen({ scene: 'home', ref: reference.value || '' })
		amenDone.value = true
		uni.vibrateShort?.({ type: 'light' })
		track('manna_amen', { scene: 'home' })
		uni.showToast({ title: t('amen_done'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: e?.message || t('amen_fail'), icon: 'none' })
	} finally {
		amenBusy.value = false
	}
}

async function onLike() {
	try {
		const res = await apiMannaFavoriteToggle({
			target_type: 'daily_verse',
			target_key: verseKey.value,
		})
		liked.value = !!(res?.results?.liked)
		track('manna_favorite', { liked: liked.value })
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

async function onShare() {
	const fallbackText = verseText.value || ''
	const fallbackRef = reference.value || ''
	try {
		const res = await apiMannaSharePayload({
			scene: 'daily_verse',
			ref: fallbackRef,
			text: fallbackText,
		})
		const d = res?.results || {}
		const text = d.raw_text || fallbackText
		const ref = d.reference || fallbackRef
		if (!text) {
			uni.showToast({ title: t('home_empty_hint'), icon: 'none' })
			return
		}
		uni.setStorageSync('manna_versecard_payload', {
			text,
			ref,
			brand: d.brand || 'MANNA',
			shareLine: d.text || `${text} — ${ref}`,
		})
		uni.navigateTo({ url: '/pagesA/share/versecard' })
	} catch (e) {
		if (!fallbackText) {
			uni.showToast({ title: t('share_failed'), icon: 'none' })
			return
		}
		uni.setStorageSync('manna_versecard_payload', {
			text: fallbackText,
			ref: fallbackRef,
			brand: 'MANNA',
			shareLine: `${fallbackText} — ${fallbackRef}`,
		})
		uni.navigateTo({
			url: '/pagesA/share/versecard',
			fail: () => copyShareText(`${fallbackText}\n${fallbackRef}`),
		})
	}
}

/** 听经：进全屏听经页（缺音频/经文时页内 demo 填充） */
async function onMusic() {
	if (listening.value) {
		stopHomeAudio()
		return
	}
	const book = bibleBook.value || 'genesis'
	const chapter = bibleChapter.value || 1
	track('manna_home_listen', { book, chapter })
	uni.navigateTo({
		url: `/pagesA/bible/listen?book=${encodeURIComponent(book)}&chapter=${chapter}&autoplay=1`,
	})
}

function onCard(c) {
	const p = c.payload || {}
	const TAB_ROOTS = new Set([
		'/pages/home/home',
		'/pages/quiz/quiz',
		'/pages/devotion/list',
		'/pages/bible/bible',
		'/pages/profile/profile',
	])
	const DETAIL_ROOTS = new Set([
		'/pagesA/devotion/detail',
		'/pagesA/quiz/play',
	])

	let path = String(c.link_path || '').trim()
	// 兼容旧数据：仅有 card_type、无 link_path
	if (!path) {
		const type = c.card_type || c.type
		if (type === 'daily_quiz') path = '/pages/quiz/quiz'
		else if (type === 'daily_devotion') {
			path = p.series_id ? '/pagesA/devotion/detail' : '/pages/devotion/list'
		} else if (type === 'story') path = '/pagesA/quiz/stories'
		else if (type === 'testimony') path = '/pages/profile/profile'
	}
	if (!path) return

	const root = path.split('?')[0]
	let url = path.startsWith('/') ? path : `/${path}`
	const targetId = p.target_id ?? p.series_id ?? p.story_id ?? p.level_id ?? p.testimony_id
	if (targetId != null && targetId !== '' && !url.includes('?') && DETAIL_ROOTS.has(root)) {
		url += `?id=${encodeURIComponent(String(targetId))}`
	}

	if (TAB_ROOTS.has(root)) {
		uni.switchTab({ url: root })
		return
	}
	uni.navigateTo({ url })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.home {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	box-sizing: border-box;
	overflow: hidden;
	color: $manna-white;
}

.home__bg {
	position: fixed;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
	pointer-events: none;
}

.home__top,
.home__stage,
.home__foot {
	position: relative;
	z-index: 2;
}

/* Figma 顶栏 h=58 @ top 51 — 紧贴状态栏，不额外加空 */
.home__top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 96rpx;
	padding: 0 40rpx;
	box-sizing: border-box;
}

.home__top-right {
	display: flex;
	align-items: center;
}

.home__top-right .home__top-btn + .home__top-btn {
	margin-left: 32rpx;
}

.home__top-btn {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.home__top-btn--press {
	opacity: 0.7;
}

.home__top-ico {
	width: 64rpx;
	height: 64rpx;
}

.home__top-ico.is-liked {
	filter: drop-shadow(0 0 8rpx rgba(255, 120, 140, 0.85));
}

.home__top-btn.is-spinning {
	animation: home-music-spin 4.5s linear infinite;
}

.home__top-ico.is-listening {
	filter: drop-shadow(0 0 10rpx rgba(255, 255, 255, 0.85));
	opacity: 1;
}

@keyframes home-music-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

.home__stage {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	/* Figma Group 279:368 top≈98 → 状态栏下顶栏后约 16–24px */
	margin-top: 16rpx;
	padding: 0 24rpx;
	box-sizing: border-box;
}

/*
 * Figma 279:368 阅读序：God → mid → storm → ref
 * mid 轻压 storm 上沿（负边距叠字）；字号 clamp(min,vw,max) + --poetic-fit 防折行重叠
 */
.home__stage--poetic {
	width: 100%;
	max-width: 670rpx;
	margin: 12rpx auto 0;
	padding: 0 16rpx;
	gap: 0;
	transform: scale(var(--poetic-fit, 1));
	transform-origin: top center;
	will-change: transform;
}

.home__stage--poetic .home__god,
.home__stage--poetic .home__storm {
	display: block;
	font-family: $manna-font-script !important;
	font-weight: 400;
	font-size: var(--poetic-god, 128rpx);
	line-height: 0.92;
	height: auto;
	max-width: 100%;
	color: $manna-white;
	text-align: center;
	white-space: nowrap;
	overflow: visible;
	word-break: keep-all;
}

.home__stage--poetic .home__god {
	position: relative;
	z-index: 1;
	padding: 0 0 0.08em;
}

.home__stage--poetic .home__storm {
	position: relative;
	z-index: 1;
	/* 上沿留给 mid 叠字，避免花体 ink 顶到 mid */
	margin-top: -0.42em;
	padding-top: 0.12em;
}

.home__mid {
	position: relative;
	z-index: 3;
	display: block;
	margin-top: -0.08em;
	margin-bottom: -0.28em;
	font-family: $manna-font-serif !important;
	font-weight: 400;
	font-size: var(--poetic-mid, 36rpx);
	line-height: 1.25;
	color: $manna-white;
	text-align: center;
	white-space: pre-line;
	word-break: keep-all;
	pointer-events: none;
}

.home__god--solo {
	display: block;
	width: 100%;
	height: auto;
	line-height: 1.1;
	margin-bottom: 24rpx;
	font-family: $manna-font-script !important;
	font-size: clamp(72rpx, 17vw, 128rpx);
	color: $manna-white;
	white-space: nowrap;
}

.home__body {
	font-family: $manna-font-serif !important;
	font-size: 32rpx;
	line-height: 1.45;
	max-width: 580rpx;
	padding: 0 32rpx;
	color: $manna-white;
}

.home__ref {
	font-family: $manna-font-serif !important;
	font-size: 28rpx;
	line-height: 1.2;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: rgba(255, 255, 255, 0.95);
	text-align: center;
	white-space: nowrap;
}

.home__stage--poetic .home__ref {
	display: block;
	position: relative;
	z-index: 2;
	margin-top: 0.55em;
	font-size: var(--poetic-ref, 28rpx);
	max-width: 100%;
}

.home__stage:not(.home__stage--poetic) .home__ref {
	display: block;
	margin-top: 36rpx;
}

/* Amen @580 / 812；运营卡在 Amen 下，不抢主构图 */
.home__foot {
	position: absolute;
	left: 0;
	right: 0;
	bottom: calc(#{$manna-page-pad-bottom} + env(safe-area-inset-bottom, 0px));
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 0 40rpx;
	box-sizing: border-box;
}

.home__amen {
	@include manna-cta-cream;
	/* Figma 279:374：160×52 · blur 4 · shadow 0 2 6 */
	width: 320rpx;
	height: 104rpx;
	padding: 0;
	margin: 0;
	border: none;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	backdrop-filter: blur(8rpx);
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.home__amen::after {
	border: none;
}

.home__amen--press {
	transform: scale(0.97);
	opacity: 0.92;
}

.home__amen-ico {
	width: 48rpx;
	height: 48rpx;
	margin-right: 8rpx;
	flex-shrink: 0;
}

.home__amen-txt {
	font-family: $manna-font-body !important;
	font-weight: 700;
	font-size: 36rpx;
	color: $manna-btn-text;
	line-height: 1;
}

.home__hint {
	margin-top: 12rpx;
	font-size: 22rpx;
	color: $manna-ink-mute;
}

.home__cards {
	margin-top: 20rpx;
	width: 100%;
	/* 隔离 nowrap，避免影响舞台标题；稿无卡，有数据时轻量露出 */
	isolation: isolate;
	opacity: 0.92;
}

.home__cards-inner {
	display: flex;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: stretch;
	width: max-content;
}

.home__card {
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	box-sizing: border-box;
	flex: 0 0 auto;
	width: 280rpx;
	min-height: 140rpx;
	margin-right: 16rpx;
	padding: 22rpx 24rpx;
	@include manna-panel;
}

.home__card--press { opacity: 0.88; }

.home__card-t {
	display: block;
	font-family: $manna-font-body !important;
	font-weight: 600;
	font-size: 26rpx;
	line-height: 1.3;
	color: $manna-white;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.home__card-s {
	display: block;
	margin-top: 8rpx;
	font-family: $manna-font-body !important;
	font-size: 22rpx;
	color: $manna-ink-mute;
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
