<!--
  小组件刷新频率：单选列表，点选后回配置页。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="custom-nav">
				<view class="nav-left">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-title">{{ t('widgets_refresh_title') }}</text>
				</view>
			</view>
		</view>

		<text class="hint">{{ t('widgets_refresh_hint') }}</text>
		<view class="list">
			<view
				v-for="opt in options"
				:key="opt.code"
				:class="['row', selected === opt.code ? 'on' : '']"
				@tap="onPick(opt.code)"
			>
				<text class="label">{{ opt.label }}</text>
				<image
					class="radio"
					:src="selected === opt.code ? '/static/ui/radio-on.svg' : '/static/ui/radio-off.svg'"
					mode="aspectFit"
				/>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import {
	REFRESH_KEYS,
	refreshLabelKey,
	readWidgetUiPrefs,
	writeWidgetUiPrefs,
} from './refreshOptions.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const selected = ref('off')

const options = computed(() =>
	REFRESH_KEYS.map((code) => ({
		code,
		label: t(refreshLabelKey(code)),
	})),
)

onLoad(() => {
	const local = readWidgetUiPrefs()
	const refresh = typeof local.refresh === 'string' ? local.refresh : 'off'
	selected.value = REFRESH_KEYS.includes(refresh) ? refresh : 'off'
})

function goBack() {
	safeBack('/pagesA/widgets/widgets?from=profile&kind=home')
}

function onPick(code) {
	if (!REFRESH_KEYS.includes(code)) return
	selected.value = code
	writeWidgetUiPrefs({ refresh: code })
	setTimeout(goBack, 180)
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
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
	margin: 8rpx 8rpx 28rpx;
	font-size: 26rpx;
	line-height: 1.45;
	color: $selah-ink-soft;
}
.list {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}
.row {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	min-height: 104rpx;
	padding: 0 32rpx;
	border-radius: 28rpx;
	background: #ffffff;
	box-sizing: border-box;
}
.row.on {
	background: #ead9bc;
}
.label {
	font-size: 30rpx;
	color: $selah-ink;
}
.radio {
	width: 44rpx;
	height: 44rpx;
	flex-shrink: 0;
}
</style>
