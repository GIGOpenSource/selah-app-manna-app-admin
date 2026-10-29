<!--
  小组件中心：四种主屏小组件，自定义进配置；添加先出三步引导。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="custom-nav">
				<view class="nav-left">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-title">{{ t('widgets_center_title') }}</text>
				</view>
			</view>
		</view>

		<view v-if="loading && !slots.length" class="tip">{{ t('requesting') }}</view>
		<view
			v-for="item in slots"
			:key="item.key"
			class="card"
			@tap="onCard(item)"
		>
			<view :class="['preview-stage', item.size]">
				<view :class="['preview', item.size, item.imageUrl ? 'has-bg' : '']">
					<image
						v-if="item.imageUrl"
						class="preview-bg"
						:src="item.imageUrl"
						mode="aspectFill"
					/>
					<text class="preview-quote">{{ previewQuote(item) }}</text>
				</view>
			</view>
			<view class="meta">
				<text class="meta-name">{{ t(item.labelKey) }}</text>
				<view
					:class="['meta-btn', wallpaperChanged ? 'ghost' : 'solid']"
					@tap.stop="onCard(item)"
				>
					<text class="meta-btn-text">{{
						wallpaperChanged ? t('widgets_customize') : t('widgets_center_add')
					}}</text>
				</view>
			</view>
		</view>

		<view v-if="stepsOpen" class="overlay" @touchmove.stop.prevent>
			<view class="mask" @tap.stop="closeSteps" />
			<view class="sheet" @tap.stop>
				<image class="badge" src="/static/ui/Mask group.svg" mode="aspectFit" />
				<text class="sheet-title">{{ t('widgets_add_steps_title') }}</text>
				<view class="steps">
					<view class="step">
						<text class="step-num">1</text>
						<text class="step-text">{{ t('widgets_add_step_1') }}</text>
					</view>
					<view class="step">
						<text class="step-num">2</text>
						<text class="step-text">{{ t('widgets_add_step_2') }}</text>
					</view>
					<view class="step">
						<text class="step-num">3</text>
						<text class="step-text">{{ t('widgets_add_step_3') }}</text>
					</view>
				</view>
				<view class="sheet-cta" @tap.stop="onGoHomeScreen">
					<text class="sheet-cta-text">{{ t('widgets_go_home_screen') }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiWidgets } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { publishWidgetCatalog } from '@/utils/widgetDesktopSync.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const stepsOpen = ref(false)
const pendingItem = ref(null)
const loading = ref(false)
const slots = ref([])
const wallpaperChanged = ref(false)

function sizeClass(shape) {
	const raw = String(shape || '').toLowerCase()
	if (raw === 'square') return 's22'
	if (raw === 'wide') return 's42'
	if (raw === 'large_square' || raw === 'large' || raw === 'extra_large') return 's44'
	return 's42'
}

function labelKeyFor(size) {
	if (size === 's22') return 'widgets_slot_2x2'
	if (size === 's44') return 'widgets_slot_4x4'
	return 'widgets_slot_4x2'
}

function normalizeWidget(row) {
	const size = sizeClass(row.shape)
	return {
		key: String(row.id),
		id: row.id,
		name: String(row.name || '').trim(),
		size,
		shape: String(row.shape || ''),
		labelKey: labelKeyFor(size),
		fallbackKey: size === 's44' ? 'widgets_slot_preview_c' : 'widgets_slot_preview_a',
		imageUrl: cardImage(row),
		preview: cardQuote(row),
		displayTagId: row.display_tag_id,
		displayTagName: String(row.display_tag_name || '').trim(),
		borderEnabled: !!row.border_enabled,
		refresh: String(row.refresh || ''),
	}
}

function cardImage(row) {
	return String(row?.image_url || row?.cover_url || row?.card_image_url || '').trim()
}

function cardQuote(row) {
	const quote = row?.quote
	if (quote && typeof quote === 'object') {
		const text = quote.content || quote.text || ''
		if (String(text).trim()) return String(text).trim()
	}
	if (typeof quote === 'string' && quote.trim()) return quote.trim()
	return String(row?.text || row?.quote_content || row?.content || '').trim()
}

function previewQuote(item) {
	return item.preview || t(item.fallbackKey)
}

function goBack() {
	safeBack('/pages/profile/profile')
}

function goConfig(item) {
	if (!item) return
	try {
		uni.setStorageSync('widget_edit_item', JSON.stringify({
			id: item.id,
			name: item.name || '',
			display_tag_id: item.displayTagId ?? null,
			display_tag_name: item.displayTagName || '',
			border_enabled: !!item.borderEnabled,
			refresh: item.refresh || '',
			image_url: item.imageUrl || '',
			shape: item.shape || '',
			quote_content: item.preview || '',
		}))
	} catch (e) {}
	uni.navigateTo({
		url: `/pagesA/widgets/widgets?from=profile&kind=home&slot=${encodeURIComponent(item.key)}`,
	})
}

function onCard(item) {
	if (wallpaperChanged.value) {
		try { logFirebaseEvent('homeWidget_customize_click') } catch (e) {}
		goConfig(item)
		return
	}
	pendingItem.value = item
	stepsOpen.value = true
}

function closeSteps() {
	stepsOpen.value = false
	pendingItem.value = null
}

function onGoHomeScreen() {
	const item = pendingItem.value || slots.value[0]
	wallpaperChanged.value = true
	stepsOpen.value = false
	pendingItem.value = null
	goConfig(item)
}

async function loadList() {
	loading.value = true
	try {
		const res = await apiWidgets()
		const bag = res?.results || {}
		wallpaperChanged.value = !!bag.wallpaper_changed
		const rows = (Array.isArray(bag.list) ? bag.list : []).map(normalizeWidget)
		slots.value = rows
		publishWidgetCatalog(bag)
	} catch (e) {
		slots.value = []
	} finally {
		loading.value = false
	}
}

onMounted(loadList)
onShow(() => {
	if (slots.value.length) loadList()
})
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
	background: #f5f5f5;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head {
	@include selah-sticky-head;
	background: #f5f5f5;
}
.custom-nav {
	display: flex;
	flex-direction: row;
	align-items: center;
	min-height: 88rpx;
}
.nav-left {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.nav-left .nav-title {
	margin-left: 20rpx;
}
.nav-pill {
	@include selah-nav-circle;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.nav-title {
	@include selah-display-title;
	font-size: 40rpx;
}
.tip {
	padding: 48rpx 16rpx;
	text-align: center;
	font-size: 26rpx;
	color: $selah-muted;
}
.card {
	margin-top: 24rpx;
	padding: 28rpx 28rpx 24rpx;
	border-radius: 36rpx;
	background: #ffffff;
	box-sizing: border-box;
}
.preview-stage {
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx dashed rgba(25, 25, 25, 0.18);
	border-radius: 36rpx;
	box-sizing: border-box;
}
.preview-stage.s22 {
	width: 100%;
	height: 300rpx;
	padding: 20rpx 48rpx;
}
.preview-stage.s42 {
	width: 100%;
	height: 348rpx;
	padding: 50rpx 28rpx;
}
.preview-stage.s44 {
	width: 100%;
	height: 620rpx;
	padding: 28rpx 48rpx;
}
.preview {
	position: relative;
	border-radius: 48rpx;
	background: linear-gradient(180deg, #f8e6d8 0%, #f4d0c4 55%, #f7efe6 100%);
	padding: 32rpx 36rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}
.preview.s22 {
	width: 260rpx;
	height: 260rpx;
}
.preview.s42 {
	width: 100%;
	height: 248rpx;
}
.preview.s44 {
	width: 520rpx;
	height: 520rpx;
}
.preview-bg {
	position: absolute;
	left: 0;
	top: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
}
.preview-quote {
	position: relative;
	z-index: 1;
	width: 100%;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 28rpx;
	line-height: 1.4;
	color: $selah-ink;
}
.preview.has-bg .preview-quote {
	color: #fff;
	text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.45);
}
.meta {
	margin-top: 20rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}
.meta-name {
	flex: 1;
	padding-right: 16rpx;
	font-size: 26rpx;
	color: $selah-ink-soft;
}
.meta-btn {
	height: 56rpx;
	padding: 0 28rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	box-sizing: border-box;
}
.meta-btn.ghost {
	background: #f3f3f3;
}
.meta-btn.solid {
	background: #f3f3f3;
}
.meta-btn-text {
	font-size: 24rpx;
	font-weight: 600;
	color: $selah-ink;
}
.overlay {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 99999;
	display: flex;
	align-items: flex-end;
	justify-content: center;
}
.mask {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	background: rgba(25, 25, 25, 0.45);
}
.sheet {
	position: relative;
	z-index: 1;
	width: 100%;
	padding: 56rpx 40rpx calc(40rpx + env(safe-area-inset-bottom));
	border-radius: 48rpx 48rpx 0 0;
	background: #f6efe4;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.badge {
	width: 369rpx;
	height: 248rpx;
	margin: -24rpx 0 4rpx;
}
.sheet-title {
	display: block;
	margin-bottom: 28rpx;
	font-family: $selah-font-display;
	font-size: 44rpx;
	font-weight: 700;
	color: $selah-ink;
	text-align: center;
}
.steps {
	width: 100%;
	margin-bottom: 36rpx;
}
.step {
	display: flex;
	flex-direction: row;
	align-items: flex-start;
	margin-bottom: 18rpx;
}
.step-num {
	width: 44rpx;
	height: 44rpx;
	border-radius: 15rpx;
	background: $selah-ink;
	color: #fff;
	font-size: 24rpx;
	font-weight: 600;
	text-align: center;
	line-height: 44rpx;
	margin-right: 16rpx;
	flex-shrink: 0;
}
.step-text {
	flex: 1;
	padding-top: 4rpx;
	font-size: 28rpx;
	line-height: 1.4;
	color: $selah-ink;
}
.sheet-cta {
	width: 100%;
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.sheet-cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
</style>
