<!--
  手表表盘配置：顶部样式预览随主题/出处切换；保存后同步今日肯定语。
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
			<text class="page-title">{{ t('watch_face_title') }}</text>
			<text class="page-lead">{{ t('watch_face_lead') }}</text>
		</view>

		<!-- 表盘样式预览：主题 / 出处即时反映 -->
		<view class="preview-stage">
			<view class="watch-bezel">
				<view :class="['watch-face', `theme-${themeKey}`]">
					<text class="watch-time">{{ clockText }}</text>
					<text v-if="!quoteText" class="watch-empty">{{ t('widgets_preview_empty') }}</text>
					<template v-else>
						<text class="watch-quote">{{ quoteText }}</text>
						<text v-if="showRef && quoteRef" class="watch-ref">{{ quoteRef }}</text>
					</template>
				</view>
			</view>
			<view class="watch-crown" />
			<view class="watch-btn" />
		</view>
		<text class="preview-hint">{{ t('watch_preview_hint') }}</text>

		<view class="card">
			<view class="row" @tap="pickTheme">
				<text class="row-label">{{ t('widgets_theme') }}</text>
				<view class="row-trail">
					<text class="row-value">{{ themeLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row" @tap="pickRefresh">
				<text class="row-label">{{ t('widgets_refresh') }}</text>
				<view class="row-trail">
					<text class="row-value">{{ refreshLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row last">
				<text class="row-label">{{ t('watch_show_ref') }}</text>
				<switch :checked="showRef" color="#191919" @change="onToggleRef" />
			</view>
		</view>

		<text v-if="hint" class="hint">{{ hint }}</text>

		<view class="footer">
			<view :class="['cta', saving ? 'disabled' : '']" @tap="onSave">
				<text class="cta-text">{{ t('watch_apply_face') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiWidgetPayload } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
const KEY = 'selah_watch_face_prefs'
const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const saving = ref(false)
const hint = ref('')
const themeKey = ref('default')
const refresh = ref('daily')
const showRef = ref(true)
const quote = ref(null)
const now = ref(Date.now())
let clockTimer = null

const themeOpts = computed(() => [
	{ key: 'default', label: t('widgets_theme_default') },
	{ key: 'lavender', label: t('widgets_theme_lavender') },
	{ key: 'cream', label: t('widgets_theme_cream') },
])
const refreshOpts = computed(() => [
	{ key: 'hourly', label: t('widgets_refresh_hourly') },
	{ key: 'daily', label: t('widgets_refresh_daily') },
])
const themeLabel = computed(
	() => themeOpts.value.find((o) => o.key === themeKey.value)?.label || '',
)
const refreshLabel = computed(
	() => refreshOpts.value.find((o) => o.key === refresh.value)?.label || '',
)
const quoteText = computed(() => String(quote.value?.content || '').trim())
const quoteRef = computed(() => String(quote.value?.source_ref || '').trim())
const clockText = computed(() => {
	const d = new Date(now.value)
	const h = String(d.getHours()).padStart(2, '0')
	const m = String(d.getMinutes()).padStart(2, '0')
	return `${h}:${m}`
})

function goBack() {
	safeBack('/pages/profile/profile')
}

function loadLocal() {
	const p = uni.getStorageSync(KEY) || {}
	themeKey.value = p.theme_key || 'default'
	refresh.value = p.refresh || 'daily'
	showRef.value = p.show_ref !== false
}

function onToggleRef(e) {
	showRef.value = !!e?.detail?.value
}

function pickTheme() {
	uni.showActionSheet({
		itemList: themeOpts.value.map((o) => o.label),
		success: (res) => {
			const opt = themeOpts.value[res.tapIndex]
			if (opt) themeKey.value = opt.key
		},
	})
}

function pickRefresh() {
	uni.showActionSheet({
		itemList: refreshOpts.value.map((o) => o.label),
		success: (res) => {
			const opt = refreshOpts.value[res.tapIndex]
			if (opt) refresh.value = opt.key
		},
	})
}

async function loadQuote() {
	try {
		const pay = await apiWidgetPayload()
		quote.value = pay.results?.quote || null
	} catch (e) {
		quote.value = null
	}
}

async function onSave() {
	if (saving.value) return
	saving.value = true
	hint.value = ''
	try {
		const prefs = {
			theme_key: themeKey.value,
			refresh: refresh.value,
			show_ref: showRef.value,
			updated_at: Date.now(),
		}
		uni.setStorageSync(KEY, prefs)
		if (!quote.value) await loadQuote()
		let nativeOk = false
		try {
			const { nativeWriteWidgetPayload } = await import('@/utils/selahNative.js')
			const nr = await nativeWriteWidgetPayload({
				empty: !quote.value,
				quote: quote.value,
				watch: prefs,
			})
			nativeOk = !!(nr && nr.ok && !nr.skipped)
		} catch (e) {}
		if (!nativeOk) {
			hint.value = t('watch_native_unavailable')
			uni.showToast({ title: hint.value, icon: 'none' })
		} else {
			uni.showToast({ title: t('saved'), icon: 'none' })
		}
	} finally {
		saving.value = false
	}
}

onMounted(async () => {
	loadLocal()
	await loadQuote()
	clockTimer = setInterval(() => {
		now.value = Date.now()
	}, 30000)
})

onUnmounted(() => {
	if (clockTimer) clearInterval(clockTimer)
})
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
	margin: 12rpx 0 8rpx;
}
.preview-stage {
	position: relative;
	display: flex;
	justify-content: center;
	align-items: center;
	margin: 28rpx 0 12rpx;
	padding: 28rpx 0 12rpx;
}
.watch-bezel {
	width: 360rpx;
	height: 420rpx;
	border-radius: 88rpx;
	background: #1c1c1e;
	padding: 18rpx;
	box-sizing: border-box;
	box-shadow: 0 16rpx 40rpx rgba(25, 25, 25, 0.18);
}
.watch-face {
	width: 100%;
	height: 100%;
	border-radius: 72rpx;
	background: linear-gradient(180deg, $selah-grad-top 0%, $selah-grad-mid 100%);
	padding: 36rpx 28rpx 28rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.watch-face.theme-lavender {
	background: linear-gradient(180deg, #e8dff5 0%, #c9b8e0 100%);
}
.watch-face.theme-cream {
	background: linear-gradient(180deg, #f7efe3 0%, #e8d9c4 100%);
}
.watch-time {
	font-size: 40rpx;
	font-weight: 600;
	letter-spacing: 1rpx;
	color: $selah-ink;
	margin-bottom: 20rpx;
}
.watch-quote {
	flex: 1;
	width: 100%;
	font-family: $selah-font-display;
	font-size: 26rpx;
	line-height: 1.4;
	color: $selah-ink;
	text-align: center;
	overflow: hidden;
}
.watch-ref {
	margin-top: 16rpx;
	font-size: 20rpx;
	color: rgba(25, 25, 25, 0.55);
	text-align: center;
}
.watch-empty {
	flex: 1;
	display: flex;
	align-items: center;
	font-size: 24rpx;
	color: $selah-muted;
	text-align: center;
}
.watch-crown {
	position: absolute;
	right: calc(50% - 210rpx);
	top: 120rpx;
	width: 18rpx;
	height: 56rpx;
	border-radius: 8rpx;
	background: #2a2a2c;
}
.watch-btn {
	position: absolute;
	right: calc(50% - 208rpx);
	top: 220rpx;
	width: 14rpx;
	height: 36rpx;
	border-radius: 8rpx;
	background: #2a2a2c;
}
.preview-hint {
	display: block;
	text-align: center;
	font-size: 22rpx;
	color: $selah-muted;
	margin-bottom: 28rpx;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 8rpx 24rpx;
}
.row {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	min-height: 96rpx;
	border-bottom: 1rpx solid rgba(25, 25, 25, 0.08);
}
.row.last {
	border-bottom: none;
}
.row-label {
	font-size: 30rpx;
}
.row-trail {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.row-value {
	font-size: 28rpx;
	color: $selah-ink-soft;
	margin-right: 8rpx;
}
.chev {
	width: 28rpx;
	height: 28rpx;
	opacity: 0.45;
}
.hint {
	display: block;
	margin-top: 20rpx;
	text-align: center;
	font-size: 24rpx;
	color: $selah-muted;
	line-height: 1.4;
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
