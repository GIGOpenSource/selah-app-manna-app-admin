<!--
  App 图标选择：列表 + select-app-icon；VIP 锁走 goVip。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
			</view>
			<text class="page-title">{{ t('icons_title') }}</text>
			<text class="page-lead">{{ t('icons_lead') }}</text>
		</view>

		<view v-if="loading" class="tip">{{ t('requesting') }}</view>
		<view v-else-if="!list.length" class="empty">{{ t('icons_empty') }}</view>

		<view class="grid">
			<view
				v-for="ic in list"
				:key="ic.icon_key"
				:class="['tile', selected === ic.icon_key ? 'on' : '']"
				@tap="onPick(ic)"
			>
				<image
					v-if="ic.preview_url"
					class="face"
					:src="ic.preview_url"
					mode="aspectFill"
				/>
				<view v-else class="face face-fallback">
					<text class="face-letter">{{ (ic.title || ic.icon_key || '?').slice(0, 1) }}</text>
				</view>
				<text v-if="ic.locked" class="lock">VIP</text>
				<image
					v-if="selected === ic.icon_key"
					class="check"
					src="/static/ui/icons/check.svg"
					mode="aspectFit"
				/>
				<text class="label">{{ ic.title || ic.icon_key }}</text>
			</view>
		</view>

		<view class="footer">
			<view :class="['cta', !selected || saving ? 'disabled' : '']" @tap="onConfirm">
				<text class="cta-text">{{ t('icons_apply') }}</text>
			</view>
			<text class="hint">{{ t('icons_hint') }}</text>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiAppIcons, apiSelectAppIcon } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { goVip } from '@/utils/vip.js'
import { track } from '@/utils/analytics.js'
import { getUser, setUser } from '@/utils/session.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const list = ref([])
const selected = ref('')
const loading = ref(true)
const saving = ref(false)
const fromProfile = ref(false)

onLoad((q) => {
	fromProfile.value = q?.from === 'profile'
})

function goBack() {
	safeBack(fromProfile.value ? '/pages/profile/profile' : '/pagesA/settings/settings')
}

async function load() {
	loading.value = true
	try {
		const res = await apiAppIcons()
		list.value = res.results || []
		const cur = list.value.find((x) => x.selected)
		selected.value = cur?.icon_key || list.value[0]?.icon_key || ''
	} catch (e) {
		list.value = []
	} finally {
		loading.value = false
	}
}

function onPick(ic) {
	if (ic.locked) {
		goVip('app_icon')
		return
	}
	selected.value = ic.icon_key
}

async function onConfirm() {
	if (!selected.value || saving.value) return
	const hit = list.value.find((x) => x.icon_key === selected.value)
	if (hit?.locked) {
		goVip('app_icon')
		return
	}
	saving.value = true
	try {
		await apiSelectAppIcon(selected.value)
		try {
			const { nativeSetAppIcon } = await import('@/utils/selahNative.js')
			await nativeSetAppIcon(selected.value)
		} catch (e) {}
		const u = getUser() || {}
		u.selected_icon_key = selected.value
		setUser(u)
		list.value = list.value.map((x) => ({
			...x,
			selected: x.icon_key === selected.value,
		}))
		track('app_icon_change', { icon: selected.value, applied: true })
		uni.showToast({ title: t('saved'), icon: 'none' })
		setTimeout(goBack, 420)
	} catch (e) {
		if (e?.code === 403) {
			goVip('app_icon')
			return
		}
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		saving.value = false
	}
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 200rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head {
	@include selah-sticky-head;
}
.head-glass {
	@include selah-sticky-head-glass($selah-bg-gray);
}
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	min-height: 88rpx;
}
.nav-pill {
	@include selah-nav-circle;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.page-title {
	display: block;
	position: relative;
	z-index: 1;
	@include selah-display-title;
	font-size: 44rpx;
	margin-top: 8rpx;
}
.page-lead {
	display: block;
	position: relative;
	z-index: 1;
	font-size: 28rpx;
	color: $selah-ink-soft;
	line-height: 1.4;
	margin: 12rpx 0 28rpx;
}
.grid {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	justify-content: space-between;
}
.tile {
	position: relative;
	width: 212rpx;
	padding: 24rpx 16rpx 20rpx;
	margin-bottom: 20rpx;
	border-radius: 32rpx;
	background: $selah-card;
	border: 2rpx solid transparent;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.tile.on {
	border-color: $selah-ink;
}
.face {
	width: 100rpx;
	height: 100rpx;
	border-radius: 22rpx;
	background: #e8e0d4;
}
.face-fallback {
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(160deg, #191919, #3a3a3a);
}
.face-letter {
	color: #fff;
	font-size: 40rpx;
	font-weight: 700;
}
.lock {
	position: absolute;
	top: 12rpx;
	left: 12rpx;
	background: $selah-ink;
	color: #fff;
	font-size: 18rpx;
	padding: 2rpx 10rpx;
	border-radius: 999rpx;
}
.check {
	position: absolute;
	top: -8rpx;
	right: -8rpx;
	width: 48rpx;
	height: 48rpx;
}
.label {
	margin-top: 16rpx;
	font-size: 22rpx;
	text-align: center;
	color: $selah-ink;
	max-width: 180rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.tip,
.empty {
	text-align: center;
	color: $selah-muted;
	padding: 80rpx 24rpx;
	font-size: 28rpx;
}
.footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(245, 245, 245, 0) 0%, $selah-bg-gray 28%);
}
.cta {
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
.hint {
	display: block;
	margin-top: 16rpx;
	text-align: center;
	font-size: 22rpx;
	color: $selah-muted;
	line-height: 1.4;
}
</style>
