<!--
  页面内自定义底部选择（不跳路由）。
-->
<template>
	<view
		v-if="visible"
		class="ss-root"
		@touchmove.stop.prevent
	>
		<view
			v-if="maskReady"
			class="ss-mask"
			@click.stop="onMask"
		/>
		<view class="ss-panel" @tap.stop>
			<text v-if="title" class="ss-title">{{ title }}</text>
			<scroll-view scroll-y class="ss-list" :style="{ maxHeight: maxHeight }" :bounces="false">
				<view
					v-for="(item, i) in items"
					:key="itemKey(item, i)"
					:class="['ss-row', isActive(item, i) ? 'on' : '']"
					@click.stop="onPick(item, i)"
				>
					<text class="ss-label">{{ itemLabel(item) }}</text>
					<view v-if="isActive(item, i)" class="ss-check" />
				</view>
			</scroll-view>
			<view class="ss-cancel" @click.stop="onCancel">
				<text class="ss-cancel-text">{{ cancelText || 'Cancel' }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
	visible: { type: Boolean, default: false },
	title: { type: String, default: '' },
	items: { type: Array, default: () => [] },
	modelValue: { type: [Number, String], default: null },
	valueKey: { type: String, default: 'code' },
	labelKey: { type: String, default: 'label' },
	cancelText: { type: String, default: '' },
	maxHeight: { type: String, default: '52vh' },
	closeOnMask: { type: Boolean, default: true },
})

const emit = defineEmits(['update:visible', 'update:modelValue', 'select', 'cancel'])

const maskReady = ref(false)
let maskTimer = null
let pickLockUntil = 0

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

function itemLabel(item) {
	if (item == null) return ''
	if (typeof item === 'string') return item
	return item[props.labelKey] ?? item.label ?? String(item)
}

function itemKey(item, i) {
	if (item && typeof item === 'object') {
		return item[props.valueKey] ?? item.code ?? item.value ?? i
	}
	return i
}

function isActive(item, i) {
	if (props.modelValue == null || props.modelValue === '') return false
	if (typeof props.modelValue === 'number') return props.modelValue === i
	if (typeof item === 'string') return props.modelValue === item
	const v = item[props.valueKey] ?? item.code ?? item.value
	return v === props.modelValue
}

function onPick(item, i) {
	if (!maskReady.value) return
	const now = Date.now()
	if (now < pickLockUntil) return
	pickLockUntil = now + 400
	const v = typeof item === 'string' ? item : (item[props.valueKey] ?? item.code ?? item.value ?? i)
	emit('update:modelValue', v)
	emit('select', { item, index: i, value: v })
	emit('update:visible', false)
}

function onCancel() {
	if (!maskReady.value) return
	emit('cancel')
	emit('update:visible', false)
}

function onMask() {
	if (!props.closeOnMask || !maskReady.value) return
	onCancel()
}

watch(
	() => props.visible,
	(v) => {
		if (v) armMask()
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
</script>

<style lang="scss" scoped>
.ss-root {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	width: 100%;
	height: 100%;
	z-index: 99998;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	background-color: rgba(25, 25, 25, 0.45);
	box-sizing: border-box;
}
.ss-mask {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 0;
}
.ss-panel {
	position: relative;
	z-index: 1;
	background: #f5f5f5;
	border-radius: 32rpx 32rpx 0 0;
	padding: 28rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}
.ss-title {
	display: block;
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 36rpx;
	font-weight: 700;
	color: #191919;
	text-align: center;
	margin-bottom: 20rpx;
}
.ss-list {
	background: #ffffff;
	border-radius: 32rpx;
	overflow: hidden;
}
.ss-row {
	min-height: 104rpx;
	padding: 28rpx 32rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1rpx solid rgba(25, 25, 25, 0.06);
	box-sizing: border-box;
	cursor: pointer;
}
.ss-row:last-child {
	border-bottom: none;
}
.ss-row.on .ss-label {
	font-weight: 600;
}
.ss-label {
	flex: 1;
	min-width: 0;
	font-size: 32rpx;
	line-height: 1.3;
	color: #191919;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.ss-check {
	width: 36rpx;
	height: 36rpx;
	border-radius: 50%;
	background: #191919;
}
.ss-cancel {
	margin-top: 16rpx;
	height: 96rpx;
	border-radius: 32rpx;
	background: #ffffff;
	display: flex;
	align-items: center;
	justify-content: center;
}
.ss-cancel-text {
	font-size: 32rpx;
	font-weight: 600;
	color: #191919;
}
</style>
