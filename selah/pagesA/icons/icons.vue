<!--
  App 图标：点选未锁图标立即应用；当前不可重复选；锁定进 VIP。
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
				:id="'expo-' + ic.icon_key"
				:data-xid="ic.icon_key"
				:class="[
					'tile expo-icon',
					applied === ic.icon_key ? 'on' : '',
					ic.locked ? 'locked' : '',
					applying === ic.icon_key ? 'busy' : '',
				]"
				@tap.stop="onPick(ic)"
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
					v-if="applied === ic.icon_key"
					class="check"
					src="/static/ui/icons/check.svg"
					mode="aspectFit"
				/>
				<view v-if="applying === ic.icon_key" class="spin" />
				<text class="label">{{ ic.title || ic.icon_key }}</text>
			</view>
		</view>

		<text class="hint">{{ t('icons_hint') }}</text>

		<view v-if="applying" class="mask" @tap.stop>
			<view class="mask-card">
				<view class="spin spin-lg" />
				<text class="mask-text">{{ t('loading') }}</text>
			</view>
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
import { getUser, setUser } from '@/utils/session.js'
import { nativeGetAppIcon, nativeSetAppIcon } from '@/utils/selahNative.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const list = ref([])
/** 服务端已应用的当前图标 */
const applied = ref('')
/** 桌面图标是否已经跟 applied 对齐；没对齐时允许再点一次重试 */
const nativeSynced = ref(true)
const loading = ref(true)
const applying = ref('')
const fromProfile = ref(false)
let loadToken = 0

onLoad((q) => {
	fromProfile.value = q?.from === 'profile'
})

function goBack() {
	safeBack(fromProfile.value ? '/pages/profile/profile' : '/pagesA/settings/settings')
}

async function load() {
	const token = ++loadToken
	loading.value = true
	try {
		const res = await apiAppIcons()
		if (token !== loadToken || applying.value) return
		list.value = res.results || []
		const cur = list.value.find((x) => x.selected)
		applied.value = cur?.icon_key || ''
		nativeSynced.value = true
		try {
			const nr = await nativeGetAppIcon()
			if (token !== loadToken || applying.value) return
			if (nr?.ok && nr.icon_key && list.value.some((x) => x.icon_key === nr.icon_key)) {
				if (!applied.value) applied.value = nr.icon_key
				else nativeSynced.value = nr.icon_key === applied.value
			}
		} catch (e) {}
	} catch (e) {
		if (token === loadToken && !applying.value) list.value = []
	} finally {
		if (token === loadToken) loading.value = false
	}
}

async function onPick(ic) {
	if (!ic || applying.value) return
	if (ic.locked) {
		goVip('app_icon')
		return
	}
	// 已经选中且桌面也换成功时，不再重复点。桌面没换上时允许再点一次。
	if (ic.icon_key === applied.value && nativeSynced.value) {
		uni.showToast({ title: t('icons_already_current'), icon: 'none' })
		return
	}
	const prev = applied.value
	applying.value = ic.icon_key
	applied.value = ic.icon_key
	list.value = list.value.map((x) => ({
		...x,
		selected: x.icon_key === ic.icon_key,
	}))
	try {
		await apiSelectAppIcon(ic.icon_key)
		let nativeOk = true
		let skipped = false
		try {
			const nr = await nativeSetAppIcon(ic.icon_key)
			if (nr && nr.skipped) {
				skipped = true
				nativeOk = false
			} else if (nr && nr.ok === false) {
				nativeOk = false
			}
		} catch (e) {
			nativeOk = false
		}
		const u = getUser() || {}
		u.selected_icon_key = ic.icon_key
		setUser(u)
		nativeSynced.value = nativeOk || skipped
		if (skipped || !nativeOk) {
			uni.showToast({ title: t('icons_native_unavailable'), icon: 'none' })
		} else {
			uni.showToast({ title: t('saved'), icon: 'none' })
		}
	} catch (e) {
		applied.value = prev
		list.value = list.value.map((x) => ({
			...x,
			selected: x.icon_key === prev,
		}))
		if (e?.code === 403) {
			goVip('app_icon')
			return
		}
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		applying.value = ''
	}
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
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
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 20rpx;
}
.tile {
	position: relative;
	width: 100%;
	padding: 24rpx 16rpx 20rpx;
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
.tile.busy {
	opacity: 0.55;
}
.spin {
	position: absolute;
	top: 16rpx;
	right: 16rpx;
	width: 28rpx;
	height: 28rpx;
	border: 4rpx solid rgba(25, 25, 25, 0.18);
	border-top-color: #191919;
	border-radius: 50%;
	animation: icon-spin 0.7s linear infinite;
}
@keyframes icon-spin {
	to {
		transform: rotate(360deg);
	}
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
.hint {
	display: block;
	margin-top: 16rpx;
	text-align: center;
	font-size: 22rpx;
	color: $selah-muted;
	line-height: 1.4;
}
.mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 200;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(25, 25, 25, 0.28);
}
.mask-card {
	min-width: 200rpx;
	padding: 36rpx 40rpx;
	border-radius: 28rpx;
	background: #fff;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.mask-text {
	margin-top: 16rpx;
	font-size: 26rpx;
	color: $selah-ink;
}
.spin-lg {
	position: static;
	width: 44rpx;
	height: 44rpx;
}
</style>
