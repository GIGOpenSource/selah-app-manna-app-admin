<!--
  协议详情页：隐私 / 条款 / 订阅 / 帮助。
  交互与设置页一致：吸顶毛玻璃 + 圆形返回 + 衬线标题 + 灰底白卡正文。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ pageTitle }}</text>
				<view class="nav-spacer" />
			</view>
		</view>

		<view class="meta-card">
			<text class="meta-text">{{ doc.meta }}</text>
		</view>

		<view
			v-for="(sec, i) in doc.sections"
			:key="i"
			class="card"
		>
			<text class="sec-heading">{{ sec.heading }}</text>
			<text
				v-for="(p, j) in sec.paragraphs"
				:key="j"
				class="sec-body"
			>{{ p }}</text>
		</view>

		<view v-if="slug === 'help' && hotlines.length" class="card">
			<text class="sec-heading">{{ t('crisis_resources') }}</text>
			<text
				v-for="(h, i) in hotlines"
				:key="h.id || i"
				class="sec-body hl-row"
				@tap="openHotline(h)"
			>{{ h.label }} · {{ h.phone_or_url }}</text>
		</view>

		<view class="foot-links">
			<text
				v-for="item in otherLinks"
				:key="item.slug"
				class="foot-link"
				@tap="openSlug(item.slug)"
			>{{ item.label }}</text>
		</view>
	</view>
</template>

<script setup>
/**
 * 协议详情：slug=privacy|terms|subscription|help；Help 附带公开热线列表。
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { getLegalDoc, listLegalSlugs } from '@/utils/legalDocs.js'
import { apiHotlines } from '@/api/content.js'
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

const slug = ref('privacy')
const doc = ref(getLegalDoc('privacy'))
const hotlines = ref([])

const pageTitle = computed(() => {
	try {
		return t(doc.value.titleKey) || doc.value.fallbackTitle
	} catch (e) {
		return doc.value.fallbackTitle
	}
})

const otherLinks = computed(() => {
	const labels = {
		privacy: t('legal_privacy'),
		terms: t('legal_terms'),
		subscription: t('legal_subscription'),
		help: t('legal_help'),
	}
	return listLegalSlugs()
		.filter((s) => s !== slug.value)
		.map((s) => ({ slug: s, label: labels[s] || s }))
})

async function loadHotlines() {
	if (slug.value !== 'help') {
		hotlines.value = []
		return
	}
	try {
		const res = await apiHotlines()
		const data = res.results || res.data || {}
		hotlines.value = data.list || data.results || (Array.isArray(data) ? data : [])
	} catch (e) {
		hotlines.value = []
	}
}

function applySlug(s) {
	const next = getLegalDoc(s)
	slug.value = next.slug
	doc.value = next
	uni.pageScrollTo({ scrollTop: 0, duration: 0 })
	loadHotlines()
}

function openSlug(s) {
	// 同页切换 slug，禁止 redirectTo 整页重挂载
	applySlug(s)
}

function openHotline(h) {
	const raw = String((h && h.phone_or_url) || '').trim()
	if (!raw) return
	if (/^https?:\/\//i.test(raw)) {
		// #ifdef H5
		window.open(raw, '_blank')
		// #endif
		// #ifdef APP-PLUS
		plus.runtime.openURL(raw)
		// #endif
		return
	}
	const tel = raw.replace(/[^\d+]/g, '')
	if (tel) uni.makePhoneCall({ phoneNumber: tel, fail: () => {} })
}

function goBack() {
	safeBack('/pagesA/settings/settings')
}

onLoad((q) => {
	applySlug(q?.slug || 'privacy')
})
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
	justify-content: space-between;
	padding: 0 0 12rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.nav-pill {
	@include selah-nav-circle;
	position: relative;
	z-index: 2;
	flex-shrink: 0;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.nav-title {
	@include selah-display-title;
}
.nav-spacer {
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
	visibility: hidden;
}
.meta-card {
	margin-top: 8rpx;
	margin-bottom: 16rpx;
	padding: 24rpx 32rpx;
	background: #f2f1ed;
	border: 2rpx solid rgba(25, 25, 25, 0.1);
	border-radius: 32rpx;
	box-sizing: border-box;
}
.meta-text {
	font-size: 22rpx;
	line-height: 1.5;
	color: $selah-ink-soft;
	white-space: pre-line;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 32rpx;
	margin-bottom: 16rpx;
	box-sizing: border-box;
}
.sec-heading {
	display: block;
	font-family: $selah-font-display;
	font-size: 34rpx;
	font-weight: 700;
	color: $selah-ink;
	margin-bottom: 16rpx;
	line-height: 1.3;
}
.sec-body {
	display: block;
	font-size: 28rpx;
	line-height: 1.55;
	color: $selah-ink;
	opacity: 0.88;
	margin-bottom: 20rpx;
	white-space: pre-line;
}
.sec-body.hl-row {
	text-decoration: underline;
	opacity: 1;
}
.sec-body:last-child {
	margin-bottom: 0;
}
.foot-links {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	justify-content: center;
	padding: 32rpx 8rpx 16rpx;
}
.foot-link {
	font-size: 24rpx;
	color: $selah-ink;
	opacity: 0.55;
	margin: 8rpx 16rpx;
	text-decoration: underline;
}
</style>
