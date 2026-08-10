<!--
  Manna 居中确认框：对齐 peach 轻壳 + Forum/Lexend。
-->
<template>
	<view v-if="visible" class="mask" @tap="onMask">
		<view class="card" @tap.stop>
			<text v-if="title" class="title">{{ title }}</text>
			<text v-if="content" class="body">{{ content }}</text>
			<view v-if="$slots.default" class="slot">
				<slot />
			</view>
			<view v-if="!hideActions" class="actions">
				<view v-if="showCancel" class="btn ghost" @tap="onCancel">
					<text class="btn-text ghost-text">{{ cancelText || 'Cancel' }}</text>
				</view>
				<view class="btn solid" @tap="onConfirm">
					<text class="btn-text solid-text">{{ confirmText || 'OK' }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
const props = defineProps({
	visible: { type: Boolean, default: false },
	title: { type: String, default: '' },
	content: { type: String, default: '' },
	confirmText: { type: String, default: '' },
	cancelText: { type: String, default: '' },
	showCancel: { type: Boolean, default: true },
	hideActions: { type: Boolean, default: false },
	closeOnMask: { type: Boolean, default: true },
})

const emit = defineEmits(['update:visible', 'confirm', 'cancel'])

function onConfirm() {
	emit('confirm')
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
	z-index: 1100;
	background: rgba(33, 33, 33, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
}

.card {
	width: 100%;
	max-width: 620rpx;
	background: $manna-white;
	border-radius: 40rpx;
	padding: 48rpx 40rpx 36rpx;
	box-sizing: border-box;
	box-shadow: $manna-shadow-card;
}

.title {
	display: block;
	font-family: $manna-font-serif;
	font-size: 40rpx;
	font-weight: 400;
	color: $manna-btn-text;
	text-align: center;
	margin-bottom: 16rpx;
}

.body {
	display: block;
	font-family: $manna-font-body;
	font-size: 28rpx;
	line-height: 1.45;
	color: rgba(33, 33, 33, 0.62);
	text-align: center;
	margin-bottom: 36rpx;
}

.slot {
	margin-bottom: 36rpx;
}

.actions {
	display: flex;
	flex-direction: row;
	gap: 16rpx;
}

.btn {
	flex: 1;
	height: 88rpx;
	border-radius: $manna-radius-btn;
	display: flex;
	align-items: center;
	justify-content: center;
}

.btn.ghost {
	background: rgba(33, 33, 33, 0.06);
}

.btn.solid {
	background: $manna-btn-text;
}

.btn-text {
	font-family: $manna-font-body;
	font-size: 30rpx;
	font-weight: 600;
}

.ghost-text {
	color: $manna-btn-text;
}

.solid-text {
	color: $manna-white;
}
</style>
