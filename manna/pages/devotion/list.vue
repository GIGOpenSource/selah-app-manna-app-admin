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
						:key="tag"
						class="tag"
						:class="{ 'tag--on': tag === activeTag }"
						@click="onTag(tag)"
					>
						{{ tag }}
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
					<view v-if="!seriesList.length && !loading" class="empty">{{ t('devotion_empty') }}</view>

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
								<text class="feat__sub">{{ featured.session_count || 0 }} sessions</text>
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
							<text class="row__sub">{{ s.session_count || 0 }} sessions{{ s.locked ? ' · VIP' : '' }}</text>
						</view>
						<image class="row__chev" src="/static/ui/devotion/ico-chevron.svg" mode="aspectFit" />
					</view>

					<view class="page__pad" />
				</view>
			</scroll-view>
		</view>

		<MannaTabBar v-if="tabOn" active="devotion" variant="light" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, getCurrentInstance } from 'vue'
import { onShow, onHide, onReady } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { ensureLogin } from '@/utils/session.js'
import { apiDevotionSeries, apiDevotionSeriesDetail } from '@/api/devotion.js'
import { withDemoSeriesList } from '@/utils/devotionDemo.js'
import { absolutizeMedia } from '@/utils/media.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import MannaTabBar from '@/components/MannaTabBar.vue'

const DEFAULT_TAGS = ['All', 'Family', 'Love', 'Anxiety', 'Healing', 'Hope']

const statusBar = getStatusBarPx()
const tabOn = ref(true)
const tags = ref(DEFAULT_TAGS.slice())
const activeTag = ref('All')
const seriesList = ref([])
const loading = ref(false)
const scrollH = ref(0)
const proxy = getCurrentInstance()?.proxy

const featured = computed(() => seriesList.value[0] || null)
const restList = computed(() => seriesList.value.slice(1))
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
	activeTag.value = tag
	load()
}

async function enrichFeaturedSessions(list) {
	const first = list[0]
	if (!first || !first.id || String(first.id).startsWith('demo-')) return list
	if (first.preview_sessions?.length) return list
	try {
		const res = await apiDevotionSeriesDetail({ id: first.id })
		const sessions = res?.results?.sessions || []
		if (sessions.length) {
			first.preview_sessions = sessions.slice(0, 2).map((s) => ({
				id: s.id,
				title: s.title,
				scripture_ref: s.scripture_ref || '',
				completed: !!s.completed,
			}))
			if (!first.cover_url && res?.results?.cover_url) {
				first.cover_url = res.results.cover_url
			}
		}
	} catch (e) {}
	return list
}

async function load() {
	loading.value = true
	try {
		const params = {}
		if (activeTag.value && activeTag.value !== 'All') params.tag = activeTag.value
		const res = await apiDevotionSeries(params)
		let list = Array.isArray(res?.results) ? res.results.slice() : []
		list = await enrichFeaturedSessions(list)
		seriesList.value = list
		const set = new Set(DEFAULT_TAGS)
		list.forEach((s) => (s.tags || []).forEach((tg) => set.add(tg)))
		tags.value = Array.from(set)
	} catch (e) {
		seriesList.value = withDemoSeriesList([])
		tags.value = DEFAULT_TAGS.slice()
	} finally {
		loading.value = false
		measureScroll()
	}
}

function openSeries(s) {
	if (s.locked) {
		uni.showToast({ title: t('devotion_vip_locked'), icon: 'none' })
		return
	}
	uni.navigateTo({ url: `/pagesA/devotion/detail?id=${encodeURIComponent(s.id)}` })
}

function openPreview(series, session) {
	if (series.locked) {
		uni.showToast({ title: t('devotion_vip_locked'), icon: 'none' })
		return
	}
	if (session?.id && !String(session.id).startsWith('d') && !String(session.id).startsWith('demo')) {
		uni.navigateTo({
			url: `/pagesA/devotion/session?id=${session.id}&series_id=${series.id}`,
		})
		return
	}
	openSeries(series)
}

onReady(() => measureScroll())

onMounted(async () => {
	tabOn.value = true
	hideNativeTabBar()
	measureScroll()
	try {
		await ensureLogin({ explicit: true })
	} catch (e) {}
	await load()
})

onShow(() => {
	tabOn.value = true
	hideNativeTabBar()
	measureScroll()
	load()
})

onHide(() => {
	tabOn.value = false
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
	font-size: 36rpx;
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
	gap: 24rpx;
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
	gap: 24rpx;
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
