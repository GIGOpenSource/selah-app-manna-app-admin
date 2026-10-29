<!--
  小组件名称：独立页输入，保存后回小组件配置。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="custom-nav">
				<view class="nav-left">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-title">{{ t('widgets_name_title') }}</text>
				</view>
			</view>
		</view>

		<text class="hint">{{ t('widgets_name_hint') }}</text>
		<input
			v-model="draft"
			class="field"
			type="text"
			:maxlength="32"
			:focus="focused"
			:placeholder="t('widgets_name_placeholder')"
			placeholder-class="field-ph"
			confirm-type="done"
			@confirm="onSave"
		/>
		<view :class="['cta', saving ? 'disabled' : '']" @tap="onSave">
			<text class="cta-text">{{ t('save') }}</text>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const UI_PREFS_KEY = 'widget_ui_prefs'
const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const draft = ref('')
const focused = ref(false)
const saving = ref(false)

function readUiPrefs() {
	try {
		const raw = uni.getStorageSync(UI_PREFS_KEY)
		if (!raw) return {}
		const data = typeof raw === 'string' ? JSON.parse(raw) : raw
		return data && typeof data === 'object' ? data : {}
	} catch (e) {
		return {}
	}
}

function writeUiPrefs(patch) {
	const next = { ...readUiPrefs(), ...patch }
	try {
		uni.setStorageSync(UI_PREFS_KEY, JSON.stringify(next))
	} catch (e) {}
}

onLoad(() => {
	const local = readUiPrefs()
	draft.value = typeof local.name === 'string' ? local.name : ''
	setTimeout(() => {
		focused.value = true
	}, 240)
})

function goBack() {
	safeBack('/pagesA/widgets/widgets?from=profile&kind=home')
}

function onSave() {
	if (saving.value) return
	saving.value = true
	writeUiPrefs({ name: String(draft.value || '').trim() })
	goBack()
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 40rpx 80rpx;
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
.hint {
	display: block;
	margin: 24rpx 8rpx 32rpx;
	font-size: 28rpx;
	line-height: 1.45;
	color: $selah-ink-soft;
}
.field {
	height: 96rpx;
	padding: 0 32rpx;
	border-radius: 28rpx;
	background: rgba(25, 25, 25, 0.08);
	font-size: 30rpx;
	color: $selah-ink;
	box-sizing: border-box;
}
.field-ph {
	color: rgba(25, 25, 25, 0.35);
}
.cta {
	margin-top: 28rpx;
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.cta.disabled {
	opacity: 0.4;
}
.cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
</style>
