<!-- 主包自定义底部选择页（App/H5） -->
<template>
	<view class="root" @touchmove.stop.prevent>
		<view class="mask" @tap="onCancel" />
		<view class="panel" @tap.stop>
			<text v-if="title" class="title">{{ title }}</text>
			<scroll-view scroll-y class="list" style="max-height: 52vh" :bounces="false">
				<view
					v-for="(item, i) in items"
					:key="keyOf(item, i)"
					:class="['row', active(item, i) ? 'on' : '']"
					@tap.stop="onPick(item, i)"
				>
					<text class="label">{{ labelOf(item) }}</text>
					<view v-if="active(item, i)" class="check" />
				</view>
			</scroll-view>
			<view class="cancel" @tap.stop="onCancel">
				<text class="cancel-text">{{ cancelText }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { SELAH_SHEET_PAYLOAD, resolveSelahSheet } from '@/utils/selahOverlay.js'

const title = ref('')
const items = ref([])
const modelValue = ref(null)
const valueKey = ref('code')
const labelKey = ref('label')
const cancelText = ref('Cancel')
let done = false

onLoad(() => {
	let data = null
	try {
		data = uni.getStorageSync(SELAH_SHEET_PAYLOAD)
	} catch (e) {}
	if (data && typeof data === 'object') {
		title.value = data.title || ''
		items.value = Array.isArray(data.items) ? data.items : []
		modelValue.value = data.modelValue
		valueKey.value = data.valueKey || 'code'
		labelKey.value = data.labelKey || 'label'
		cancelText.value = data.cancelText || 'Cancel'
	}
})

onUnload(() => {
	finish({ action: 'cancel', index: -1 })
	try {
		uni.removeStorageSync(SELAH_SHEET_PAYLOAD)
	} catch (e) {}
})

function labelOf(item) {
	if (item == null) return ''
	if (typeof item === 'string') return item
	return item[labelKey.value] ?? item.label ?? String(item)
}

function keyOf(item, i) {
	if (item && typeof item === 'object') {
		return item[valueKey.value] ?? item.code ?? item.value ?? i
	}
	return i
}

function active(item, i) {
	if (modelValue.value == null || modelValue.value === '') return false
	if (typeof modelValue.value === 'number') return modelValue.value === i
	if (typeof item === 'string') return modelValue.value === item
	const v = item[valueKey.value] ?? item.code ?? item.value
	return v === modelValue.value
}

function finish(result) {
	if (done) return
	done = true
	resolveSelahSheet(result)
}

function onCancel() {
	finish({ action: 'cancel', index: -1 })
	uni.navigateBack({ fail: () => {} })
}

function onPick(item, i) {
	const v = typeof item === 'string' ? item : (item[valueKey.value] ?? item.code ?? item.value ?? i)
	finish({ action: 'confirm', index: i, value: v, item })
	uni.navigateBack({ fail: () => {} })
}
</script>

<style lang="scss" scoped>
.root {
	width: 100%;
	min-height: 100vh;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	background-color: rgba(25, 25, 25, 0.45);
	box-sizing: border-box;
}
.mask {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
}
.panel {
	position: relative;
	z-index: 2;
	background: #f5f5f5;
	border-radius: 32rpx 32rpx 0 0;
	padding: 28rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}
.title {
	display: block;
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 36rpx;
	font-weight: 700;
	color: #191919;
	text-align: center;
	margin-bottom: 20rpx;
}
.list {
	background: #ffffff;
	border-radius: 32rpx;
	overflow: hidden;
}
.row {
	min-height: 104rpx;
	padding: 28rpx 32rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1rpx solid rgba(25, 25, 25, 0.06);
	box-sizing: border-box;
}
.row:last-child {
	border-bottom: none;
}
.row.on .label {
	font-weight: 600;
}
.label {
	flex: 1;
	min-width: 0;
	font-size: 32rpx;
	line-height: 1.3;
	color: #191919;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.check {
	width: 36rpx;
	height: 36rpx;
	border-radius: 50%;
	background: #191919;
}
.cancel {
	margin-top: 16rpx;
	height: 96rpx;
	border-radius: 32rpx;
	background: #ffffff;
	display: flex;
	align-items: center;
	justify-content: center;
}
.cancel-text {
	font-size: 32rpx;
	font-weight: 600;
	color: #191919;
}
</style>
