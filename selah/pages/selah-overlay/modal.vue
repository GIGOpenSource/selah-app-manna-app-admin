<!-- 主包自定义弹窗页：半透明遮罩 + 白卡（App/H5）——独立路由，保证盖住页面内 fixed / 原生层 -->
<template>
	<view class="root" @touchmove.stop.prevent>
		<view class="mask" @tap="onMask" />
		<view class="card" @tap.stop>
			<text v-if="title" class="title">{{ title }}</text>
			<text v-if="content && !editable" class="body">{{ content }}</text>
			<text v-if="quotaLine && !editable" class="quota">{{ quotaLine }}</text>
			<view v-if="weekDays.length && !editable" class="week">
				<view v-for="d in weekDays" :key="d.date || d.key" class="day" :class="[d.state || 'empty', { today: d.is_today }]">
					<text v-if="d.state === 'checked'">✓</text>
					<text v-else-if="d.state === 'frozen'">❄</text>
				</view>
			</view>
			<view v-if="steps.length && !editable" class="steps">
				<view v-for="(s, i) in steps" :key="i" class="step-row">
					<text class="step-num">{{ i + 1 }}</text>
					<text class="step-text">{{ s }}</text>
				</view>
			</view>
			<view v-if="editable" class="field">
				<input
					class="input"
					type="text"
					:value="draft"
					:placeholder="placeholder"
					placeholder-class="ph"
					:maxlength="64"
					:focus="focus"
					:adjust-position="true"
					confirm-type="done"
					@input="onInput"
				/>
			</view>
			<view class="actions">
				<view v-if="showCancel" class="btn ghost" @tap.stop="onCancel">
					<text class="txt ghost">{{ cancelText }}</text>
				</view>
				<view class="btn solid" @tap.stop="onConfirm">
					<text class="txt solid">{{ confirmText }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { SELAH_MODAL_PAYLOAD, resolveSelahModal } from '@/utils/selahOverlay.js'

const title = ref('')
const content = ref('')
const editable = ref(false)
const draft = ref('')
const placeholder = ref('')
const confirmText = ref('OK')
const cancelText = ref('Cancel')
const showCancel = ref(true)
const closeOnMask = ref(true)
const focus = ref(false)
const quotaLine = ref('')
const weekDays = ref([])
const steps = ref([])
let done = false

onLoad(() => {
	let data = null
	try {
		data = uni.getStorageSync(SELAH_MODAL_PAYLOAD)
	} catch (e) {}
	if (data && typeof data === 'object') {
		title.value = data.title || ''
		content.value = data.content || ''
		editable.value = !!data.editable
		draft.value = data.value != null ? String(data.value) : ''
		placeholder.value = data.placeholder || ''
		confirmText.value = data.confirmText || 'OK'
		cancelText.value = data.cancelText || 'Cancel'
		showCancel.value = data.showCancel !== false
		closeOnMask.value = data.closeOnMask !== false
		const extra = data.extra || {}
		quotaLine.value = extra.quotaLine || ''
		weekDays.value = Array.isArray(extra.week) ? extra.week : []
		steps.value = Array.isArray(extra.steps) ? extra.steps.map((s) => String(s || '')) : []
	}
	if (editable.value) {
		nextTick(() => {
			setTimeout(() => {
				focus.value = true
			}, 300)
		})
	}
})

onUnload(() => {
	finish({ action: 'dismiss', value: draft.value })
	try {
		uni.removeStorageSync(SELAH_MODAL_PAYLOAD)
	} catch (e) {}
})

function onInput(e) {
	draft.value = e?.detail?.value ?? ''
}

function finish(result) {
	if (done) return
	done = true
	resolveSelahModal(result)
}

function onMask() {
	if (!closeOnMask.value) return
	finish({ action: 'dismiss', value: draft.value })
	uni.navigateBack({ fail: () => {} })
}

function onCancel() {
	finish({ action: 'cancel', value: draft.value })
	uni.navigateBack({ fail: () => {} })
}

function onConfirm() {
	finish({ action: 'confirm', value: draft.value })
	uni.navigateBack({ fail: () => {} })
}
</script>

<style lang="scss" scoped>
.root {
	width: 100%;
	min-height: 100vh;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
	background-color: rgba(25, 25, 25, 0.45);
	overflow: hidden;
}
.mask {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
}
.card {
	position: relative;
	z-index: 2;
	width: 100%;
	max-width: 620rpx;
	max-height: 85vh;
	background: #ffffff;
	border-radius: 32rpx;
	padding: 48rpx 40rpx 36rpx;
	box-sizing: border-box;
	overflow-x: hidden;
	overflow-y: auto;
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
	margin-bottom: 16rpx;
}
.quota {
	display: block;
	font-size: 24rpx;
	color: #8a8a8a;
	text-align: center;
	margin-bottom: 16rpx;
}
.week {
	display: flex;
	flex-direction: row;
	direction: ltr;
	justify-content: space-between;
	margin: 8rpx 0 28rpx;
}
.day {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	background: transparent;
	border: 3rpx solid #e6e0d6;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24rpx;
	color: #ffffff;
}
.day.checked {
	background: #f3b4c4;
	border-color: #f3b4c4;
	color: #ffffff;
}
.day.frozen {
	background: #cfcfcf;
	border-color: #cfcfcf;
	color: #ffffff;
}
.steps {
	margin: 8rpx 0 24rpx;
	text-align: left;
}
.step-row {
	display: flex;
	flex-direction: row;
	align-items: flex-start;
	padding: 10rpx 0;
}
.step-num {
	width: 36rpx;
	height: 36rpx;
	border-radius: 18rpx;
	background: #191919;
	color: #fff;
	font-size: 20rpx;
	font-weight: 600;
	text-align: center;
	line-height: 36rpx;
	margin-right: 14rpx;
	flex-shrink: 0;
}
.step-text {
	flex: 1;
	font-size: 24rpx;
	line-height: 1.4;
	color: #191919;
	text-align: left;
}
.field {
	margin: 8rpx 0 28rpx;
	padding: 24rpx 28rpx;
	background: #f5f5f5;
	border-radius: 20rpx;
	box-sizing: border-box;
}
.input {
	width: 100%;
	height: 44rpx;
	line-height: 44rpx;
	font-size: 30rpx;
	color: #191919;
	text-align: center;
}
.ph {
	color: #8a8a8a;
	text-align: center;
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
.txt {
	font-size: 30rpx;
	font-weight: 600;
}
.txt.ghost {
	color: #191919;
}
.txt.solid {
	color: #ffffff;
}
</style>
