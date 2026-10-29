<template>
	<!-- Figma Devotion-List 279:453；成功空列表走空态，仅 catch 可选 demo -->
	<view class="page">
		<view class="page__bg" />
		<view class="page__body" :style="{ paddingTop: statusBar + 'px' }">
			<text class="page__title">{{ t('devotion_daily') }}</text>

			<scroll-view scroll-x class="tags" :show-scrollbar="false" enable-flex>
				<view class="tags__inner">
					<view
						v-for="tag in tags"
						:key="tag.key"
						class="tag"
						:class="{ 'tag--on': tag.key === activeTag }"
						@click="onTag(tag)"
					>
						{{ tag.display_name || (tag.i18n ? t(tag.i18n) : tag.key) }}
					</view>
				</view>
			</scroll-view>

			<scroll-view
				scroll-y
				class="page__scroll"
				:style="scrollStyle"
				:show-scrollbar="false"
				enable-flex
			>
				<view class="page__list">
					<view v-if="!featured && !restList.length && !loading" class="empty">{{ activeTag === TAG_MINE ? t('devotion_mine_empty') : t('devotion_empty') }}</view>

					<!-- 精选：大封面 + 课节预览（对齐稿） -->
					<view
						v-if="featured"
						class="feat"
						hover-class="feat--press"
						@click="openSeries(featured)"
					>
						<view class="feat__cover">
							<image
								v-if="coverOf(featured)"
								class="feat__img"
								:src="coverOf(featured)"
								mode="aspectFill"
							/>
							<view class="feat__grad" />
							<view class="feat__meta">
								<text class="feat__title">{{ featured.title }}</text>
								<text class="feat__sub">{{ statusLabel(featured) }}</text>
							</view>
						</view>
						<view
							v-for="(ps, pi) in featuredPreviews"
							:key="'fp' + (ps.id || pi)"
							class="feat__row"
							@click.stop="openPreview(featured, ps)"
						>
							<image class="feat__row-ico" src="/static/ui/devotion/ico-session-dot.svg" mode="aspectFit" />
							<view class="feat__row-body">
								<text class="feat__row-t">{{ ps.title }}</text>
								<text class="feat__row-m">{{ ps.scripture_ref || '' }}</text>
							</view>
							<image class="feat__row-chev" src="/static/ui/devotion/ico-chevron.svg" mode="aspectFit" />
						</view>
					</view>

					<!-- 列表行：左缩略封面 -->
					<view
						v-for="s in restList"
						:key="s.id"
						class="row"
						:class="'row--' + (s.status || 'not_started')"
						hover-class="row--press"
						@click="openSeries(s)"
					>
						<image
							v-if="coverOf(s)"
							class="row__thumb"
							:src="coverOf(s)"
							mode="aspectFill"
						/>
						<view v-else class="row__thumb row__thumb--empty" />
						<view class="row__body">
							<text class="row__title">{{ s.title }}</text>
							<text class="row__sub">{{ statusLabel(s) }}</text>
						</view>
						<image class="row__chev" src="/static/ui/devotion/ico-chevron.svg" mode="aspectFit" />
					</view>

					<view class="page__pad" />
				</view>
			</scroll-view>
		</view>

		<MannaTabBar v-show="tabOn" active="devotion" variant="light" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, getCurrentInstance } from 'vue'
import { onShow, onHide, onReady } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { ensureLogin } from '@/utils/session.js'
import { apiDevotionSeries } from '@/api/devotion.js'
import { apiBibleTags } from '@/api/bible.js'
import { absolutizeMedia } from '@/utils/media.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { hideNativeTabBar, scheduleCustomTabBarHide, setTabUiKey } from '@/utils/tabbar.js'
import { track } from '@/utils/analytics.js'
import MannaTabBar from '@/components/MannaTabBar.vue'

const TAG_ALL = 'All'
const TAG_MINE = 'My Devotions'
const PINNED_TAGS = [
	{ key: TAG_ALL, i18n: 'devotion_all' },
	{ key: TAG_MINE, i18n: 'devotion_mine' },
]

const statusBar = getStatusBarPx()
const tabOn = ref(true)
let tabHideTimer = null
const tags = ref(PINNED_TAGS.slice())
const activeTag = ref(TAG_ALL)
const featured = ref(null)
const restList = ref([])
const loading = ref(false)
const scrollH = ref(0)
const proxy = getCurrentInstance()?.proxy
let loadSeq = 0

const featuredPreviews = computed(() => {
	const list = featured.value?.preview_sessions || []
	return list.slice(0, 2)
})
const scrollStyle = computed(() =>
	scrollH.value > 0 ? { height: `${scrollH.value}px` } : {},
)

/** 封面只来自数据库 cover_url（COS）；本地 static 不再兜底 */
function coverOf(s) {
	const raw = String(s?.cover_url || '').trim()
	if (!raw) return ''
	return absolutizeMedia(raw) || raw
}

function measureScroll() {
	nextTick(() => {
		try {
			const q = uni.createSelectorQuery().in(proxy)
			q.select('.page__body').boundingClientRect()
			q.select('.page__title').boundingClientRect()
			q.select('.tags').boundingClientRect()
			q.exec((res) => {
				const body = res?.[0]
				const title = res?.[1]
				const tagsEl = res?.[2]
				if (!body?.height) return
				const used = (title?.height || 0) + (tagsEl?.height || 0)
				scrollH.value = Math.max(120, Math.floor(body.height - used))
			})
		} catch (e) {}
	})
}

function onTag(tag) {
	const key = tag?.key || tag
	if (!key) return
	activeTag.value = key
	load({ mask: true })
}

function showTagLoading() {
	try {
		uni.showLoading({ title: t('loading'), mask: true })
	} catch (e) {}
}

function hideTagLoading() {
	try {
		uni.hideLoading()
	} catch (e) {}
}

function isContentTag(key) {
	return !!(key && key !== TAG_ALL && key !== TAG_MINE)
}

function seriesDetailId(s) {
	return s?.id
}

function parseSeriesPayload(res) {
	const d = res?.results
	if (Array.isArray(d)) {
		return { featured: null, list: d.slice() }
	}
	const feat = d?.featured && typeof d.featured === 'object' ? d.featured : null
	const list = Array.isArray(d?.list) ? d.list.slice() : []
	const hasFeat = !!(feat && (feat.id || feat.title))
	return { featured: hasFeat ? feat : null, list }
}

function parseApiTags(res) {
	const raw = Array.isArray(res?.results)
		? res.results
		: Array.isArray(res?.data)
			? res.data
			: Array.isArray(res)
				? res
				: []
	const seen = new Set()
	return raw
		.map((tg) => {
			if (!tg || typeof tg !== 'object') return null
			const key = String(tg.key || '').trim()
			const display_name = String(tg.display_name || '').trim()
			if (!key && !display_name) return null
			return {
				key: key || display_name,
				display_name: display_name || key,
				sort: Number(tg.sort_order) || 0,
			}
		})
		.filter(Boolean)
		.sort((a, b) => a.sort - b.sort)
		.filter((tg) => {
			const id = tg.key.toLowerCase()
			if (seen.has(id) || id === 'all' || tg.key === TAG_ALL || tg.key === TAG_MINE) return false
			seen.add(id)
			return true
		})
		.map(({ key, display_name }) => ({ key, display_name }))
}

function statusLabel(s) {
	const n = s.session_count || 0
	const done = s.completed_count || 0
	if (s.status === 'done') return `${t('devotion_status_done')} · ${n}`
	if (s.status === 'in_progress') return `${t('devotion_status_mid')} · ${done}/${n}`
	const base = t('devotion_sessions', { n })
	return s.locked ? `${base} · ${t('devotion_vip_badge')}` : base
}

async function load({ mask = false } = {}) {
	const seq = ++loadSeq
	loading.value = true
	if (mask) showTagLoading()
	try {
		const params = {}
		if (isContentTag(activeTag.value)) params.tag = activeTag.value
		const [seriesRes, tagRes] = await Promise.all([
			apiDevotionSeries(params),
			apiBibleTags().catch(() => null),
		])
		if (seq !== loadSeq) return
		tags.value = [...PINNED_TAGS, ...parseApiTags(tagRes)]
		const parsed = parseSeriesPayload(seriesRes)
		if (activeTag.value === TAG_MINE) {
			featured.value = null
			const all = [parsed.featured, ...parsed.list].filter(Boolean)
			restList.value = all
				.filter((s) => s.status === 'in_progress' || s.status === 'done')
				.sort((a, b) => {
					const ta = new Date(a.last_studied_at || a.updated_at || 0).getTime()
					const tb = new Date(b.last_studied_at || b.updated_at || 0).getTime()
					return tb - ta
				})
		} else {
			featured.value = parsed.featured
			restList.value = parsed.list
		}
	} catch (e) {
		if (seq !== loadSeq) return
		featured.value = null
		restList.value = []
		if (!tags.value.length) tags.value = PINNED_TAGS.slice()
	} finally {
		if (seq === loadSeq) {
			loading.value = false
			hideTagLoading()
			measureScroll()
		}
	}
}

function openSeries(s) {
	if (s.locked) {
		uni.showToast({ title: t('devotion_vip_locked'), icon: 'none' })
		return
	}
	const id = seriesDetailId(s)
	uni.navigateTo({ url: `/pagesA/devotion/detail?id=${encodeURIComponent(id)}` })
}

function openPreview(series, session) {
	if (series.locked) {
		uni.showToast({ title: t('devotion_vip_locked'), icon: 'none' })
		return
	}
	if (session?.id && !String(session.id).startsWith('d') && !String(session.id).startsWith('demo')) {
		uni.navigateTo({
			url: `/pagesA/devotion/session?id=${session.id}&series_id=${encodeURIComponent(seriesDetailId(series))}`,
		})
		return
	}
	openSeries(series)
}

onReady(() => measureScroll())

onMounted(async () => {
	tabOn.value = true
	setTabUiKey('devotion')
	hideNativeTabBar()
	measureScroll()
	try {
		await ensureLogin({ explicit: true })
	} catch (e) {}
	await load()
})

onShow(() => {
	if (tabHideTimer) {
		clearTimeout(tabHideTimer)
		tabHideTimer = null
	}
	tabOn.value = true
	setTabUiKey('devotion')
	hideNativeTabBar()
	measureScroll()
	load()
	track('page_view', { page_name: 'devotion' })
})

onHide(() => {
	tabHideTimer = scheduleCustomTabBarHide(() => {
		tabOn.value = false
		tabHideTimer = null
	})
	hideTagLoading()
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	height: 100vh;
	overflow: hidden;
	box-sizing: border-box;
	background: #fff3ee;
}

.page__bg {
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background: #fff3ee;
}

.page__body {
	position: relative;
	z-index: 1;
	height: 100%;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	padding-bottom: calc(#{$manna-page-pad-bottom} + env(safe-area-inset-bottom, 0px));
	overflow: hidden;
}

.page__title {
	display: block;
	padding: 8rpx 40rpx 16rpx;
	font-family: $manna-font-body !important;
	font-weight: 700;
	font-size: 40rpx;
	color: #000;
	flex-shrink: 0;
}

.tags {
	padding: 0 40rpx 28rpx;
	width: 100%;
	box-sizing: border-box;
	flex-shrink: 0;
	height: 96rpx;
}

.tags__inner {
	display: flex;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: center;
	width: max-content;
}

.tag {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 16rpx 24rpx;
	margin-right: 16rpx;
	border-radius: 80rpx;
	border: 1rpx solid rgba(0, 0, 0, 0.1);
	background: transparent;
	font-family: $manna-font-body;
	font-weight: 500;
	font-size: 24rpx;
	color: $manna-btn-text;
	flex-shrink: 0;
}

.tag--on {
	background: #fad02c;
	border-color: #fad02c;
}

.page__scroll {
	width: 100%;
	flex: 1;
	min-height: 0;
	box-sizing: border-box;
	overscroll-behavior: contain;
	-webkit-overflow-scrolling: touch;
}

.page__list {
	padding-bottom: 8rpx;
}

.page__pad {
	height: 24rpx;
}

.feat {
	margin: 0 40rpx 24rpx;
	background: #fff;
	border-radius: 32rpx;
	overflow: hidden;
	box-shadow: $manna-shadow-card;
}

.feat--press {
	transform: scale(0.99);
}

.feat__cover {
	position: relative;
	height: 360rpx;
	overflow: hidden;
	background: linear-gradient(135deg, #e8a070, #8b4a2e);
}

.feat__img {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}

.feat__grad {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 136rpx;
	z-index: 1;
	background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.55) 100%);
}

.feat__meta {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	bottom: 28rpx;
	z-index: 2;
}

.feat__title {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 40rpx;
	color: $manna-white;
}

.feat__sub {
	display: block;
	margin-top: 4rpx;
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.7);
}

.feat__row {
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 24rpx; }
	padding: 16rpx 32rpx;
}

.feat__row-ico {
	width: 44rpx;
	height: 44rpx;
	flex-shrink: 0;
}

.feat__row-body {
	flex: 1;
	min-width: 0;
}

.feat__row-t {
	display: block;
	font-weight: 700;
	font-size: 28rpx;
	color: #212121;
}

.feat__row-m {
	display: block;
	margin-top: 4rpx;
	font-weight: 300;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.7);
}

.feat__row-chev {
	width: 44rpx;
	height: 44rpx;
	opacity: 0.45;
	flex-shrink: 0;
}

.row {
	margin: 0 40rpx 24rpx;
	padding: 24rpx 32rpx;
	background: #fff;
	border-radius: 32rpx;
	box-shadow: $manna-shadow-card;
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 24rpx; }
	box-sizing: border-box;
}

.row--press {
	opacity: 0.92;
}

.row__thumb {
	width: 96rpx;
	height: 96rpx;
	border-radius: 16rpx;
	flex-shrink: 0;
	background: #d9d9d9;
}

.row__thumb--empty {
	background: linear-gradient(135deg, #f0c9a8, #c9896a);
}

.row__body {
	flex: 1;
	min-width: 0;
}

.row__title {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 36rpx;
	color: $manna-btn-text;
}

.row__sub {
	display: block;
	margin-top: 4rpx;
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 28rpx;
	color: rgba(33, 33, 33, 0.7);
}

.row--done { opacity: 0.72; }
.row--in_progress .row__title { color: #195c1e; }
.row--not_started { }

.row__chev {
	width: 44rpx;
	height: 44rpx;
	flex-shrink: 0;
	opacity: 0.45;
}

.empty {
	margin: 48rpx 40rpx;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
	font-family: $manna-font-body;
}
</style>
