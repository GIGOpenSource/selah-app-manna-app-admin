<!--
  页面内自定义居中弹窗（不跳路由）。
  App/H5 同款：半透明遮罩 + 白卡。
-->
<template>
	<view
		v-if="visible"
		class="sd-root"
		@touchmove.stop.prevent
	>
		<view
			v-if="maskReady"
			class="sd-mask"
			@tap.stop="onMask"
		/>
		<view class="sd-card" @tap.stop>
			<text v-if="title" class="sd-title">{{ title }}</text>
			<text v-if="content && !editable" class="sd-body">{{ content }}</text>
			<text v-if="quotaLine && !editable" class="sd-quota">{{ quotaLine }}</text>
			<view v-if="weekDays.length && !editable" class="sd-week">
				<view
					v-for="d in weekDays"
					:key="d.date || d.key"
					class="sd-day"
					:class="d.state"
				>
					<text v-if="d.state === 'checked'">✓</text>
					<text v-else-if="d.state === 'frozen'">❄</text>
				</view>
			</view>
			<view v-if="editable" class="sd-field">
				<input
					class="sd-input"
					type="text"
					:value="innerValue"
					:placeholder="placeholder"
					placeholder-class="sd-ph"
					:maxlength="64"
					:focus="inputFocus"
					:adjust-position="true"
					confirm-type="done"
					@input="onInput"
				/>
			</view>
			<slot v-if="!editable" />
			<view v-if="!hideActions" class="sd-actions">
				<view
					v-if="showCancel"
					class="sd-btn ghost"
					@tap.stop="onCancel"
				>
					<text class="sd-txt ghost">{{ cancelText || 'Cancel' }}</text>
				</view>
				<view class="sd-btn solid" @tap.stop="onConfirm">
					<text class="sd-txt solid">{{ confirmText || 'OK' }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps({
	visible: { type: Boolean, default: false },
	title: { type: String, default: '' },
	content: { type: String, default: '' },
	confirmText: { type: String, default: '' },
	cancelText: { type: String, default: '' },
	showCancel: { type: Boolean, default: true },
	hideActions: { type: Boolean, default: false },
	closeOnMask: { type: Boolean, default: true },
	editable: { type: Boolean, default: false },
	promptValue: { type: String, default: '' },
	placeholder: { type: String, default: '' },
	extra: { type: Object, default: null },
})

const emit = defineEmits(['update:visible', 'update:promptValue', 'confirm', 'cancel'])

const maskReady = ref(false)
const innerValue = ref('')
const inputFocus = ref(false)
let maskTimer = null
let focusTimer = null

const quotaLine = computed(() => (props.extra && props.extra.quotaLine) || '')
const weekDays = computed(() => {
	const w = props.extra && props.extra.week
	return Array.isArray(w) ? w : []
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
	}, 320)
}

function onInput(e) {
	innerValue.value = e?.detail?.value ?? ''
	emit('update:promptValue', innerValue.value)
}

watch(
	() => props.visible,
	(v) => {
		if (focusTimer) {
			clearTimeout(focusTimer)
			focusTimer = null
		}
		inputFocus.value = false
		if (v) {
			innerValue.value = String(props.promptValue ?? '')
			armMask()
			if (props.editable) {
				nextTick(() => {
					focusTimer = setTimeout(() => {
						inputFocus.value = true
						focusTimer = null
					}, 360)
				})
			}
		} else {
			maskReady.value = false
			if (maskTimer) {
				clearTimeout(maskTimer)
				maskTimer = null
			}
		}
	},
)

watch(
	() => props.promptValue,
	(v) => {
		if (props.visible) innerValue.value = String(v ?? '')
	},
)

onBeforeUnmount(() => {
	if (maskTimer) clearTimeout(maskTimer)
	if (focusTimer) clearTimeout(focusTimer)
})

async function onConfirm() {
	inputFocus.value = false
	if (props.editable) {
		emit('update:promptValue', String(innerValue.value ?? ''))
		await nextTick()
	}
	emit('confirm')
	emit('update:visible', false)
}

function onCancel() {
	inputFocus.value = false
	emit('cancel')
	emit('update:visible', false)
}

function onMask() {
	if (!props.closeOnMask || !maskReady.value) return
	onCancel()
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
	background-color: rgba(25, 25, 25, 0.45);
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
	background: #ffffff;
	border-radius: 32rpx;
	padding: 48rpx 40rpx 36rpx;
	box-sizing: border-box;
}
.sd-title {
	display: block;
	@include manna-overlay-title;
	font-size: 40rpx;
	text-align: center;
	margin-bottom: 16rpx;
}
.sd-body {
	display: block;
	font-family: $manna-font-body;
	font-size: 28rpx;
	line-height: 1.45;
	color: #5c5c5c;
	text-align: center;
	margin-bottom: 16rpx;
}
.sd-quota {
	display: block;
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: #8a8a8a;
	text-align: center;
	margin-bottom: 16rpx;
}
.sd-week {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	margin: 8rpx 0 28rpx;
}
.sd-day {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	background: #f5f5f5;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24rpx;
	color: #191919;
}
.sd-day.checked {
	background: #191919;
	color: #ffffff;
}
.sd-day.frozen {
	background: #dfe7ff;
}
.sd-field {
	margin: 8rpx 0 28rpx;
	padding: 24rpx 28rpx;
	background: #f5f5f5;
	border-radius: 20rpx;
	box-sizing: border-box;
}
.sd-input {
	width: 100%;
	height: 44rpx;
	line-height: 44rpx;
	font-family: $manna-font-body;
	font-size: 30rpx;
	color: #191919;
	text-align: center;
}
.sd-ph {
	color: #8a8a8a;
	text-align: center;
}
.sd-actions {
	display: flex;
	flex-direction: row;
}
.sd-btn {
	flex: 1;
	height: 96rpx;
	border-radius: 32rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.sd-btn + .sd-btn {
	margin-left: 16rpx;
}
.sd-btn.ghost {
	background: #f5f5f5;
}
.sd-btn.solid {
	background: #191919;
}
.sd-txt {
	font-family: $manna-font-body;
	font-size: 30rpx;
	font-weight: 300;
}
.sd-txt.ghost {
	color: #191919;
}
.sd-txt.solid {
	color: #ffffff;
}
</style>
