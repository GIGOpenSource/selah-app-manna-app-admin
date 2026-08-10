<!--
  小组件配置：对齐 Figma 136:24700（预览 + Widget configuration 行表）。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-left">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-title">{{
						kind === 'lock' ? t('widgets_lock_title') : t('widgets_home_title')
					}}</text>
				</view>
			</view>
		</view>

		<text class="setup">{{ t('widgets_setup') }}</text>

		<view class="preview-stage">
			<view class="preview-phone">
				<view class="preview-widget">
					<text v-if="payload.empty || !payload.quote" class="preview-empty">{{
						t('widgets_preview_empty')
					}}</text>
					<text v-else class="preview-quote">{{ payload.quote.content }}</text>
				</view>
				<view class="preview-icons">
					<view v-for="n in 4" :key="n" class="preview-icon" />
				</view>
			</view>
		</view>

		<text class="hint">{{ t('widgets_reflect') }}</text>

		<text class="section-title">{{ t('widgets_config_title') }}</text>
		<view class="card">
			<view class="row">
				<text class="row-label">{{ t('widgets_customize') }}</text>
				<switch
					:checked="prefs.customize"
					color="#191919"
					@change="onToggle('customize', $event)"
				/>
			</view>
			<view class="row" @tap="pickSource">
				<text class="row-label">{{ t('widgets_topics') }}</text>
				<view class="row-trail">
					<text class="row-value">{{ sourceLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row" @tap="pickTheme">
				<text class="row-label">{{ t('widgets_theme') }}</text>
				<view class="row-trail">
					<text class="row-value">{{ themeLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row">
				<text class="row-label">{{ t('widgets_border') }}</text>
				<switch
					:checked="prefs.border_key !== 'plain'"
					color="#191919"
					@change="onBorderToggle"
				/>
			</view>
			<view class="row" @tap="pickRefresh">
				<text class="row-label">{{ t('widgets_refresh') }}</text>
				<view class="row-trail">
					<text class="row-value">{{ refreshLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row last">
				<text class="row-label">{{ t('widgets_show_buttons') }}</text>
				<switch
					:checked="!!prefs.show_buttons"
					color="#191919"
					@change="onToggle('show_buttons', $event)"
				/>
			</view>
		</view>

		<view class="footer">
			<view :class="['cta', saving ? 'disabled' : '']" @tap="onSave">
				<text class="cta-text">{{ t('save') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import {
	apiWidgetPrefsGet,
	apiWidgetPrefsSave,
	apiWidgetPayload,
} from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { goVip } from '@/utils/vip.js'
import { track } from '@/utils/analytics.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const kind = ref('home')
const fromProfile = ref(false)
const saving = ref(false)
const prefs = ref({
	theme_key: 'default',
	border_key: 'plain',
	refresh: 'hourly',
	quote_source: 'recommend',
	followed_topic_ids: [],
	customize: true,
	show_buttons: false,
})
const payload = ref({ empty: true, quote: null })

const themeOpts = computed(() => [
	{ key: 'default', label: t('widgets_theme_default') },
	{ key: 'lavender', label: t('widgets_theme_lavender') },
	{ key: 'cream', label: t('widgets_theme_cream') },
])
const refreshOpts = computed(() => [
	{ key: 'hourly', label: t('widgets_refresh_hourly') },
	{ key: 'daily', label: t('widgets_refresh_daily') },
	{ key: 'manual', label: t('widgets_refresh_manual') },
])
const sourceOpts = computed(() => [
	{ key: 'recommend', label: t('widgets_source_recommend') },
	{ key: 'followed', label: t('widgets_source_followed') },
])

const themeLabel = computed(
	() => themeOpts.value.find((o) => o.key === prefs.value.theme_key)?.label || '',
)
const refreshLabel = computed(
	() => refreshOpts.value.find((o) => o.key === prefs.value.refresh)?.label || '',
)
const sourceLabel = computed(
	() => sourceOpts.value.find((o) => o.key === prefs.value.quote_source)?.label || '',
)

onLoad((q) => {
	kind.value = q?.kind === 'lock' ? 'lock' : 'home'
	fromProfile.value = q?.from === 'profile'
})

function goBack() {
	safeBack(fromProfile.value ? '/pages/profile/profile' : '/pagesA/settings/settings')
}

function onToggle(key, e) {
	prefs.value[key] = !!(e?.detail?.value)
}

function onBorderToggle(e) {
	const on = !!(e?.detail?.value)
	if (on) {
		prefs.value.border_key = 'soft'
	} else {
		prefs.value.border_key = 'plain'
	}
}

function pickSheet(title, items, current, onPick) {
	uni.showActionSheet({
		itemList: items.map((i) => i.label),
		success: (res) => {
			const opt = items[res.tapIndex]
			if (!opt) return
			onPick(opt)
		},
	})
}

function pickTheme() {
	pickSheet(t('widgets_theme'), themeOpts.value, prefs.value.theme_key, (opt) => {
		prefs.value.theme_key = opt.key
	})
}

function pickRefresh() {
	pickSheet(t('widgets_refresh'), refreshOpts.value, prefs.value.refresh, (opt) => {
		prefs.value.refresh = opt.key
	})
}

function pickSource() {
	pickSheet(t('widgets_topics'), sourceOpts.value, prefs.value.quote_source, (opt) => {
		prefs.value.quote_source = opt.key
	})
}

async function load() {
	try {
		const [pRes, payRes] = await Promise.all([apiWidgetPrefsGet(), apiWidgetPayload()])
		prefs.value = {
			...prefs.value,
			...(pRes.results || {}),
			customize: pRes.results?.customize !== false,
			show_buttons: !!pRes.results?.show_buttons,
		}
		payload.value = payRes.results || { empty: true }
		try {
			const { nativeWriteWidgetPayload } = await import('@/utils/selahNative.js')
			await nativeWriteWidgetPayload(payload.value)
			uni.setStorageSync('widget_payload_last', JSON.stringify(payload.value || {}))
		} catch (e) {}
	} catch (e) {}
}

async function onSave() {
	if (saving.value) return
	saving.value = true
	try {
		const res = await apiWidgetPrefsSave({
			theme_key: prefs.value.theme_key,
			border_key: prefs.value.border_key,
			refresh: prefs.value.refresh,
			quote_source: prefs.value.quote_source,
			followed_topic_ids: prefs.value.followed_topic_ids || [],
			show_buttons: !!prefs.value.show_buttons,
			customize: !!prefs.value.customize,
		})
		prefs.value = { ...prefs.value, ...(res.results || {}) }
		track('widget_pref_change', {
			kind: kind.value,
			theme_key: prefs.value.theme_key,
			border_key: prefs.value.border_key,
			refresh: prefs.value.refresh,
			quote_source: prefs.value.quote_source,
		})
		const payRes = await apiWidgetPayload()
		payload.value = payRes.results || payload.value
		try {
			const { nativeWriteWidgetPayload } = await import('@/utils/selahNative.js')
			await nativeWriteWidgetPayload(payload.value)
			uni.setStorageSync('widget_payload_last', JSON.stringify(payload.value || {}))
		} catch (e) {}
		uni.showToast({ title: t('saved'), icon: 'none' })
	} catch (e) {
		if (e?.code === 403) {
			goVip('widget_border')
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
	padding: 0 32rpx 180rpx;
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
	justify-content: space-between;
	min-height: 88rpx;
}
.nav-left {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 20rpx;
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
.setup {
	display: block;
	margin-top: 16rpx;
	text-align: center;
	font-size: 32rpx;
	line-height: 1.35;
	color: $selah-ink;
}
.preview-stage {
	margin-top: 28rpx;
	display: flex;
	justify-content: center;
}
.preview-phone {
	width: 582rpx;
	min-height: 360rpx;
	border-radius: 44rpx 44rpx 0 0;
	background: linear-gradient(180deg, #ddd2c4 0%, rgba(221, 210, 196, 0) 100%);
	padding: 48rpx 40rpx 24rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: row;
	align-items: flex-end;
	gap: 22rpx;
}
.preview-widget {
	width: 240rpx;
	height: 240rpx;
	border-radius: 64rpx;
	background: linear-gradient(180deg, $selah-grad-top 0%, $selah-grad-mid 100%);
	padding: 24rpx;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
}
.preview-quote {
	font-size: 28rpx;
	line-height: 1.35;
	text-align: center;
	color: $selah-ink;
}
.preview-empty {
	font-size: 24rpx;
	color: $selah-muted;
	text-align: center;
}
.preview-icons {
	width: 240rpx;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 22rpx;
}
.preview-icon {
	width: 108rpx;
	height: 108rpx;
	border-radius: 40rpx;
	background: rgba(221, 206, 186, 0.3);
}
.hint {
	display: block;
	margin: 24rpx 0 8rpx;
	text-align: center;
	font-size: 24rpx;
	line-height: 1.4;
	color: $selah-ink;
	opacity: 0.85;
}
.section-title {
	display: block;
	margin: 16rpx 0 12rpx;
	@include selah-display-title;
	font-size: 36rpx;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	overflow: hidden;
}
.row {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	min-height: 112rpx;
	padding: 24rpx 32rpx;
	border-bottom: 1rpx solid $selah-divider;
	box-sizing: border-box;
}
.row.last {
	border-bottom: none;
}
.row-label {
	font-size: 32rpx;
}
.row-trail {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 8rpx;
	max-width: 55%;
}
.row-value {
	font-size: 28rpx;
	color: $selah-ink;
	opacity: 0.6;
}
.chev {
	width: 40rpx;
	height: 40rpx;
	opacity: 0.45;
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
</style>
