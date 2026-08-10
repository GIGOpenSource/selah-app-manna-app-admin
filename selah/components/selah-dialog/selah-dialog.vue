<!--
  Selah 居中确认框：替代系统 showModal，与灰底白卡主壳一致。
-->
<template>
	<view v-if="visible" class="mask" @tap="onMask">
		<view class="card" @tap.stop>
			<text v-if="title" class="title">{{ title }}</text>
			<text v-if="content" class="body">{{ content }}</text>
			<slot />
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
.mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 1100;
	background: rgba(25, 25, 25, 0.35);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
}
.card {
	width: 100%;
	max-width: 620rpx;
	background: #ffffff;
	border-radius: 32rpx;
	padding: 48rpx 40rpx 36rpx;
	box-sizing: border-box;
}
.title {
	display: block;
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 40rpx;
	font-weight: 700;
	color: #191919;
	text-align: center;
	margin-bottom: 16rpx;
}
.body {
	display: block;
	font-size: 28rpx;
	line-height: 1.45;
	color: #5c5c5c;
	text-align: center;
	margin-bottom: 36rpx;
}
.actions {
	display: flex;
	flex-direction: row;
	gap: 16rpx;
}
.btn {
	flex: 1;
	height: 96rpx;
	border-radius: 32rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.btn.ghost {
	background: #f5f5f5;
}
.btn.solid {
	background: #191919;
}
.btn-text {
	font-size: 30rpx;
	font-weight: 600;
}
.ghost-text {
	color: #191919;
}
.solid-text {
	color: #ffffff;
}
</style>
