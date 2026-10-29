<!--
  首页 widget 设置弹窗：对齐 Bible Widgets 主屏安装引导。
-->
<template>
	<view
		v-if="visible"
		class="wn-root"
		@touchmove.stop.prevent
	>
		<view
			v-if="maskReady"
			class="wn-mask"
			@click.stop="onMask"
		/>
		<view class="wn-sheet" @tap.stop>
			<view class="wn-phone" aria-hidden="true">
				<view class="wn-phone-top">
					<text class="wn-chip">{{ t('home_widget_nudge_edit') }}</text>
					<text class="wn-chip on">{{ t('home_widget_nudge_done') }}</text>
				</view>
				<view class="wn-grid">
					<view class="wn-icon selah">
						<image class="wn-cross" src="/static/ui/icons/cross-light.svg" mode="aspectFit" />
					</view>
					<view class="wn-icon ghost" />
					<view class="wn-icon ghost" />
					<view class="wn-icon ghost" />
				</view>
				<view class="wn-wide">
					<text class="wn-wide-text">{{ previewText }}</text>
				</view>
			</view>

			<text class="wn-title">{{ t('home_widget_nudge_title') }}</text>
			<text class="wn-body">{{ t('home_widget_nudge_body') }}</text>
			<view class="wn-cta" @click.stop="onLearn">
				<text class="wn-cta-text">{{ t('home_widget_nudge_cta') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { t } from '@/i18n/index.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

const props = defineProps({
	visible: { type: Boolean, default: false },
	quote: { type: String, default: '' },
})

const emit = defineEmits(['update:visible', 'learn', 'dismiss'])

const maskReady = ref(false)
let maskTimer = null

const previewText = computed(() => {
	const q = String(props.quote || '').trim()
	return q || t('home_widget_nudge_placeholder')
})

function armMask() {
	if (maskTimer) {
		clearTimeout(maskTimer)
		maskTimer = null
	}
	maskReady.value = false
	maskTimer = setTimeout(() => {
		maskReady.value = true
		maskTimer = null
	}, 280)
}

watch(
	() => props.visible,
	(v) => {
		if (v) {
			try { logFirebaseEvent('homeWidget_guide_show') } catch (e) {}
			armMask()
		} else {
			maskReady.value = false
			if (maskTimer) {
				clearTimeout(maskTimer)
				maskTimer = null
			}
		}
	},
	{ immediate: true },
)

onBeforeUnmount(() => {
	if (maskTimer) clearTimeout(maskTimer)
})

function dismiss() {
	if (!maskReady.value) return
	emit('dismiss')
	emit('update:visible', false)
}

function onMask() {
	dismiss()
}

function onLearn() {
	if (!maskReady.value) return
	emit('learn')
	emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
@import '@/styles/selah-theme.scss';

.wn-root {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 99990;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
}
.wn-mask {
	position: absolute;
	inset: 0;
	background: rgba(25, 25, 25, 0.42);
}
.wn-sheet {
	position: relative;
	z-index: 1;
	width: 100%;
	padding: 36rpx 40rpx calc(28rpx + env(safe-area-inset-bottom));
	background: $selah-bg;
	border-radius: 40rpx 40rpx 0 0;
	box-sizing: border-box;
}
.wn-phone {
	margin: 8rpx auto 36rpx;
	width: 420rpx;
	padding: 28rpx 24rpx 32rpx;
	border-radius: 36rpx;
	background: linear-gradient(180deg, #ece4d8 0%, #d8cfc2 100%);
	box-sizing: border-box;
}
.wn-phone-top {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	margin-bottom: 20rpx;
}
.wn-chip {
	padding: 6rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.72);
	font-size: 20rpx;
	color: $selah-ink;
}
.wn-chip.on {
	background: $selah-ink;
	color: #fff;
}
.wn-grid {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	width: 248rpx;
	margin-bottom: 16rpx;
}
.wn-icon {
	width: 108rpx;
	height: 108rpx;
	border-radius: 28rpx;
	margin: 0 16rpx 16rpx 0;
	background: rgba(255, 255, 255, 0.45);
}
.wn-icon.selah {
	background: linear-gradient(180deg, #8ec6e8 0%, #5a8fb8 100%);
	display: flex;
	align-items: center;
	justify-content: center;
}
.wn-cross {
	width: 44rpx;
	height: 44rpx;
}
.wn-wide {
	width: 100%;
	min-height: 132rpx;
	border-radius: 28rpx;
	background: linear-gradient(180deg, $selah-grad-top 0%, $selah-grad-mid 100%);
	padding: 20rpx 24rpx;
	box-sizing: border-box;
}
.wn-wide-text {
	font-family: $selah-font-display;
	font-size: 24rpx;
	line-height: 1.35;
	color: $selah-ink;
}
.wn-title {
	display: block;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 44rpx;
	font-weight: 700;
	color: $selah-ink;
	margin-bottom: 16rpx;
}
.wn-body {
	display: block;
	text-align: center;
	font-size: 28rpx;
	line-height: 1.45;
	color: $selah-ink-soft;
	margin-bottom: 36rpx;
}
.wn-cta {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.wn-cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
</style>
