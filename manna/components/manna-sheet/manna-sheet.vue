<!--
  Manna 底部选择面板：对齐 Bible 页 sheet（白底 + handle + Lexend）。
-->
<template>
	<view v-if="visible" class="mask" @tap="onMask">
		<view class="sheet" @tap.stop>
			<view class="handle" />
			<text v-if="title" class="title">{{ title }}</text>
			<scroll-view scroll-y class="list" :style="{ maxHeight: maxHeight }">
				<view
					v-for="(item, i) in items"
					:key="itemKey(item, i)"
					:class="['row', isActive(item, i) ? 'on' : '']"
					@tap="onPick(item, i)"
				>
					<text class="label">{{ itemLabel(item) }}</text>
					<view v-if="isActive(item, i)" class="check" />
				</view>
			</scroll-view>
			<view class="cancel" @tap="onCancel">
				<text class="cancel-text">{{ cancelText || 'Cancel' }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
const props = defineProps({
	visible: { type: Boolean, default: false },
	title: { type: String, default: '' },
	items: { type: Array, default: () => [] },
	/** 当前选中：index 或 code/value 字符串 */
	modelValue: { type: [Number, String], default: null },
	valueKey: { type: String, default: 'code' },
	labelKey: { type: String, default: 'label' },
	cancelText: { type: String, default: '' },
	maxHeight: { type: String, default: '52vh' },
	closeOnMask: { type: Boolean, default: true },
})

const emit = defineEmits(['update:visible', 'update:modelValue', 'select', 'cancel'])

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
	const v = typeof item === 'string' ? item : (item[props.valueKey] ?? item.code ?? item.value ?? i)
	emit('update:modelValue', v)
	emit('select', { item, index: i, value: v })
	emit('update:visible', false)
}

function onCancel() {
	emit('cancel')
	emit('update:visible', false)
}

function onMask() {
	if (!props.closeOnMask) return
	onCancel()
}
</script>

<style lang="scss" scoped>
@import '../../styles/manna-theme.scss';

.mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 1000;
	background: rgba(33, 33, 33, 0.28);
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
}

.sheet {
	background: $manna-white;
	border-radius: 40rpx 40rpx 0 0;
	padding: 16rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 20rpx;
}

.handle {
	align-self: center;
	width: 96rpx;
	height: 12rpx;
	border-radius: 20rpx;
	background: rgba(33, 33, 33, 0.1);
}

.title {
	display: block;
	font-family: $manna-font-body;
	font-size: 32rpx;
	font-weight: 700;
	color: $manna-btn-text;
	text-align: left;
	padding: 0 8rpx;
}

.list {
	background: rgba(33, 33, 33, 0.04);
	border-radius: 28rpx;
	overflow: hidden;
}

.row {
	min-height: 104rpx;
	padding: 28rpx 32rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1rpx solid rgba(33, 33, 33, 0.06);
	box-sizing: border-box;
}

.row:last-child {
	border-bottom: none;
}

.row.on .label {
	font-weight: 600;
}

.label {
	font-family: $manna-font-body;
	font-size: 32rpx;
	color: $manna-btn-text;
}

.check {
	width: 36rpx;
	height: 36rpx;
	border-radius: 50%;
	background: $manna-btn-text;
	position: relative;
}

.check::after {
	content: '';
	position: absolute;
	left: 11rpx;
	top: 8rpx;
	width: 10rpx;
	height: 16rpx;
	border: solid #fff;
	border-width: 0 4rpx 4rpx 0;
	transform: rotate(45deg);
}

.cancel {
	height: 88rpx;
	border-radius: $manna-radius-btn;
	background: rgba(33, 33, 33, 0.06);
	display: flex;
	align-items: center;
	justify-content: center;
}

.cancel-text {
	font-family: $manna-font-body;
	font-size: 30rpx;
	font-weight: 600;
	color: $manna-btn-text;
}
</style>
