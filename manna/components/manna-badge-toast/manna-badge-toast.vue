<!--
  功课结果页轻量祝贺。结构对齐能在 App 打开的居中弹窗。
-->
<template>
	<view
		v-if="visible && items.length"
		class="sd-root"
		@touchmove.stop.prevent
	>
		<view
			v-if="maskReady"
			class="sd-mask"
			@tap.stop="onContinue"
		/>
		<view class="sd-card" @tap.stop>
			<view class="icons">
				<view
					v-for="(b, i) in preview"
					:key="b.code || b.id || i"
					class="ico-wrap"
					:class="'ico-wrap--' + tone(b)"
				>
					<image class="ico" :src="b.icon_url || iconOf(b)" mode="aspectFit" />
				</view>
			</view>
			<text class="title">{{ headline }}</text>
			<text v-if="subtitle" class="sub">{{ subtitle }}</text>
			<view class="actions">
				<view class="btn solid" hover-class="press" @tap.stop="onContinue">
					<text class="btn-text solid-text">{{ t('continue') }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { t } from '@/i18n/index.js'
import { badgeIcon, badgeTone } from '@/utils/badges.js'
import { track } from '@/utils/analytics.js'

const props = defineProps({
	visible: { type: Boolean, default: false },
	modelValue: { type: [Boolean, String, Number], default: false },
	show: { type: Boolean, default: false },
	items: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:visible', 'continue'])

const maskReady = ref(false)
let maskTimer = null

function armMask() {
	if (maskTimer) {
		clearTimeout(maskTimer)
		maskTimer = null
	}
	maskReady.value = false
	maskTimer = setTimeout(() => {
		maskReady.value = true
		maskTimer = null
	}, 320)
}

watch(
	() => props.visible,
	(v) => {
		if (v && (props.items || []).length) armMask()
		else {
			maskReady.value = false
			if (maskTimer) {
				clearTimeout(maskTimer)
				maskTimer = null
			}
		}
	},
)

onBeforeUnmount(() => {
	if (maskTimer) clearTimeout(maskTimer)
})

const preview = computed(() => (props.items || []).slice(0, 3))
const headline = computed(() => {
	const n = (props.items || []).length
	if (n > 1) return t('badge_earned_n', { n })
	return (props.items && props.items[0] && props.items[0].title) || t('badge_earned_one')
})
const subtitle = computed(() => {
	const n = (props.items || []).length
	if (n > 1) return t('badge_earned_one')
	return t('badge_earned')
})

function tone(b) {
	return badgeTone(b)
}
function iconOf(b) {
	return badgeIcon(b)
}

function close() {
	emit('update:visible', false)
}

function onContinue() {
	if (!maskReady.value) return
	track('badge_unlock_toast', { action: 'continue', n: (props.items || []).length })
	close()
	emit('continue')
}
</script>

<style lang="scss" scoped>
@import '../../styles/manna-theme.scss';

.sd-root {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	width: 100%;
	height: 100%;
	z-index: 99999;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
	background-color: rgba(33, 33, 33, 0.4);
}

.sd-mask {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 0;
}

.sd-card {
	position: relative;
	z-index: 1;
	width: 100%;
	max-width: 620rpx;
	background: $manna-white;
	border-radius: 40rpx;
	padding: 48rpx 40rpx 36rpx;
	box-sizing: border-box;
	box-shadow: $manna-shadow-card;
}

.icons {
	display: flex;
	justify-content: center;
	margin-bottom: 24rpx;
}

.ico-wrap {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	border: 4rpx solid #d4a574;
	background: #fff7ee;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	margin-left: 8rpx;
	margin-right: 8rpx;
}

.ico-wrap--quiz { border-color: #c45c26; background: #fff1e6; }
.ico-wrap--pray { border-color: #2f6f4e; background: #e8f4ec; }
.ico-wrap--devotion { border-color: #3d5a80; background: #e8eef6; }
.ico-wrap--story { border-color: #8b5a2b; background: #f6ead8; }
.ico-wrap--amen { border-color: #b42318; background: #fde8e6; }
.ico-wrap--bible { border-color: #4a6fa5; background: #e8eef8; }
.ico-wrap--streak { border-color: #b8860b; background: #f7eed4; }

.ico { width: 52rpx; height: 52rpx; }

.title {
	display: block;
	@include manna-overlay-title;
	font-size: 40rpx;
	text-align: center;
	margin-bottom: 8rpx;
}

.sub {
	display: block;
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.55);
	text-align: center;
	margin-bottom: 36rpx;
}

.actions {
	display: flex;
	flex-direction: row;
}

.btn {
	flex: 1;
	height: 88rpx;
	border-radius: $manna-radius-btn;
	display: flex;
	align-items: center;
	justify-content: center;
}

.btn.solid {
	background: $manna-btn-text;
}

.btn-text {
	font-family: $manna-font-body;
	font-size: 30rpx;
	font-weight: 600;
}

.solid-text { color: $manna-white; }
.press { opacity: 0.82; }
</style>
