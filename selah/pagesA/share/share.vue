<!--
  分享：对齐主带 Figma 8:133 — 关闭 + 海报卡（背景图 + Selah logo 水印）+ 动作墙。
  导出 / Share via / Messages 一律走 l-painter 合成图，避免纯文字丢失背景与 logo。
-->
<template>
	<view class="share">
		<view class="custom-nav" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="nav-pill" @tap.stop="goBack">
				<image class="nav-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
			</view>
		</view>

		<!-- 离屏合成：背景图 + 文案 + logo 水印 -->
		<l-painter
			ref="painter"
			path-type="url"
			:hidden="true"
			@success="onPainted"
			@fail="onPaintFail"
		>
			<l-painter-view css="width: 574rpx; height: 908rpx; position: relative; background: #fbf8f2; border-radius: 48rpx; overflow: hidden;">
				<l-painter-image
					:src="bgSrc"
					css="position: absolute; left: 0; top: 0; width: 574rpx; height: 908rpx; object-fit: cover;"
				/>
				<l-painter-view
					css="position: absolute; left: 0; top: 0; width: 574rpx; height: 908rpx; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80rpx 40rpx; box-sizing: border-box;"
				>
					<l-painter-text
						:text="cardText"
						css="font-size: 40rpx; color: #191919; line-height: 1.4; text-align: center; width: 494rpx; font-weight: 700;"
					/>
					<l-painter-text
						v-if="citeLine"
						:text="citeLine"
						css="margin-top: 16rpx; font-size: 24rpx; color: #191919; text-align: center; width: 494rpx; font-weight: 700;"
					/>
				</l-painter-view>
				<l-painter-view
					v-if="showWatermark"
					css="position: absolute; left: 167rpx; bottom: 40rpx; display: flex; flex-direction: row; align-items: center; padding: 10rpx 16rpx; border-radius: 16rpx; background: rgba(255,255,255,0.45);"
				>
					<l-painter-image
						src="/static/ui/share/logo-mark.png"
						css="width: 32rpx; height: 32rpx; border-radius: 8rpx;"
					/>
					<l-painter-text
						:text="brandName"
						css="margin-left: 8rpx; font-size: 22rpx; color: #191919;"
					/>
				</l-painter-view>
			</l-painter-view>
		</l-painter>

		<view class="poster">
			<image class="poster-bg" :src="bgSrc" mode="aspectFill" />
			<view class="poster-body">
				<text class="body">{{ cardText }}</text>
				<text v-if="citeLine" class="cite">{{ citeLine }}</text>
			</view>
			<view v-if="showWatermark" class="wm-pill">
				<image class="wm-logo" src="/static/ui/share/logo-mark.png" mode="aspectFit" />
				<text class="wm-text">{{ brandName }}</text>
			</view>
		</view>

		<view v-if="themePicker" class="theme-row">
			<view
				v-for="th in themes"
				:key="th.id"
				:class="['theme-dot', themeId === th.id ? 'on' : '']"
				@tap="pickTheme(th.id)"
			>
				<image class="theme-thumb" :src="th.bg" mode="aspectFill" />
			</view>
		</view>

		<view class="wall">
			<view class="act" @tap="onEditTheme">
				<view class="act-btn">
					<image class="act-ico" src="/static/ui/share/ico-edit-theme.svg" mode="aspectFit" />
				</view>
				<text class="act-label">{{ t('edit_theme') }}</text>
			</view>
			<view class="act" @tap="onSave">
				<view class="act-btn">
					<image class="act-ico" src="/static/ui/share/ico-save.svg" mode="aspectFit" />
				</view>
				<text class="act-label">{{ t('save_image') }}</text>
			</view>
			<view class="act" @tap="onCollect">
				<view class="act-btn">
					<image class="act-ico" src="/static/ui/share/ico-collect.svg" mode="aspectFit" />
				</view>
				<text class="act-label">{{ t('add_to_collection') }}</text>
			</view>
			<view class="act" @tap="onCopy">
				<view class="act-btn">
					<text class="act-glyph">A</text>
				</view>
				<text class="act-label">{{ t('copy_text') }}</text>
			</view>
			<view class="act" @tap="toggleWm">
				<view class="act-btn">
					<image class="act-ico" src="/static/ui/share/ico-hide-wm.svg" mode="aspectFit" />
				</view>
				<text class="act-label">{{ showWatermark ? t('hide_watermark') : t('show_watermark') }}</text>
			</view>
			<view v-if="sourceRef" class="act" @tap="onAboutSource">
				<view class="act-btn">
					<text class="act-glyph">i</text>
				</view>
				<text class="act-label">{{ t('about_source') }}</text>
			</view>
		</view>

		<view class="wall second">
			<view class="act" @tap="onMessages">
				<view class="act-btn messages">
					<image class="act-ico" src="/static/ui/share/ico-messages.svg" mode="aspectFit" />
				</view>
				<text class="act-label">{{ t('messages') }}</text>
			</view>
			<view class="act" @tap="onMore">
				<view class="act-btn">
					<image class="act-ico" src="/static/ui/share/ico-share-via.svg" mode="aspectFit" />
				</view>
				<text class="act-label">{{ t('share_via') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
/**
 * 海报背景：用户壁纸优先，否则渐变底图 / 主题图；水印 logo 用 static/ui/share/logo-mark.png。
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { getUser } from '@/utils/session.js'
import { copyShareText, systemShare, saveImageToAlbum } from '@/utils/share.js'
import { apiAppConfig, apiQuote } from '@/api/content.js'
import { track } from '@/utils/analytics.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { loadWithCache } from '@/utils/pageCache.js'
import {
	APP_CONFIG_KEY,
	SHARE_THEME_KEY,
	getActiveWallpaper,
	resolveActiveWallpaper,
	wallpaperDisplayUrl,
} from '@/utils/wallpaperCache.js'
import { goVip as navigateVip } from '@/utils/vip.js'

const DEFAULT_THEMES = [
	{ id: 'lavender', bg: '/static/ui/share/bg-lavender.jpg' },
	{ id: 'cream', bg: '/static/ui/share/bg-cream.jpg' },
	{ id: 'peach', bg: '/static/ui/share/bg-peach.jpg' },
	{ id: 'dusk', bg: '/static/ui/share/bg-dusk.jpg' },
	{ id: 'fy1', bg: '/static/ui/themes/fy-1.jpg' },
	{ id: 'fy2', bg: '/static/ui/themes/fy-2.jpg' },
	{ id: 'fy5', bg: '/static/ui/themes/fy-5.jpg' },
	{ id: 'mix1', bg: '/static/ui/themes/mix-1.jpg' },
]

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const painter = ref(null)
const contentId = ref(null)
const text = ref('')
const sourceRef = ref('')
const mode = ref('quote')
const days = ref(0)
const showWatermark = ref(true)
const user = ref(getUser())
const downloadUrl = ref('')
const brandName = ref('Selah')
const saving = ref(false)
const pendingAction = ref('') // 'save' | 'share'
const savedThemeId = (() => {
	try {
		return uni.getStorageSync(SHARE_THEME_KEY) || ''
	} catch (e) {
		return ''
	}
})()
const themeId = ref(savedThemeId || 'lavender')
const themePicker = ref(false)
const themes = ref([...DEFAULT_THEMES])

/** 同步灌入已缓存壁纸，避免每次打开再等网络才出背景 */
function applyWallpaperSnap(snap) {
	const bg = wallpaperDisplayUrl(snap)
	if (!bg) return
	themes.value = [{ id: 'wallpaper', bg }, ...DEFAULT_THEMES]
	const prefer = themeId.value || savedThemeId
	if (prefer && themes.value.some((x) => x.id === prefer)) {
		themeId.value = prefer
	} else {
		themeId.value = 'wallpaper'
	}
}

applyWallpaperSnap(getActiveWallpaper())

const cardText = computed(() =>
	mode.value === 'streak' ? `${days.value} ${t('day_streak')}` : text.value
)
const citeLine = computed(() => {
	if (mode.value === 'streak') return t('practice_affirm')
	return sourceRef.value ? `-${sourceRef.value}` : ''
})
const activeTheme = computed(() => themes.value.find((x) => x.id === themeId.value) || themes.value[0])
const bgSrc = computed(() => activeTheme.value?.bg || DEFAULT_THEMES[0].bg)

onLoad(async (q) => {
	contentId.value = q.id ? Number(q.id) : null
	mode.value = q.mode || 'quote'
	days.value = Number(q.days || 0)
	if (q.text) {
		try {
			text.value = decodeURIComponent(q.text)
		} catch (e) {
			text.value = q.text
		}
	}
	// AI 转发：长文走本地草稿，避免 query 过长截断
	if (!text.value && mode.value === 'ai') {
		try {
			text.value = uni.getStorageSync('share_draft_text') || ''
			uni.removeStorageSync('share_draft_text')
		} catch (e) {}
	}
	if (contentId.value && !text.value) {
		try {
			const res = await apiQuote(contentId.value)
			text.value = res.results.content || ''
			sourceRef.value = res.results.source_ref || ''
		} catch (e) {}
	}
})

onMounted(async () => {
	try {
		await loadWithCache(
			APP_CONFIG_KEY,
			async () => (await apiAppConfig()).results || {},
			(cfg) => {
				if (cfg?.url_download) downloadUrl.value = cfg.url_download
				else downloadUrl.value = ''
				const bn = (cfg?.brand_name || '').trim()
				if (bn) brandName.value = bn
			},
		)
	} catch (e) {}
	await loadWallpaperTheme()
})

/** 壁纸主题：本地快照秒开，后台静默刷新并落盘 */
async function loadWallpaperTheme() {
	try {
		const snap = await resolveActiveWallpaper(user.value)
		applyWallpaperSnap(snap)
	} catch (e) {}
}

function pickTheme(id) {
	themeId.value = id
	try {
		uni.setStorageSync(SHARE_THEME_KEY, id)
	} catch (e) {}
	themePicker.value = false
}

function goBack() {
	safeBack('/pages/home/home')
}

function summary() {
	return mode.value === 'streak' ? `${days.value} ${t('day_streak')} · ${brandName.value}` : text.value
}

function onEditTheme() {
	themePicker.value = !themePicker.value
}

function onCopy() {
	track('quote_share', { content_id: contentId.value || 0, channel: 'copy' })
	copyShareText(summary(), downloadUrl.value)
}

function onCollect() {
	const q = contentId.value ? `?kind=collect&id=${contentId.value}` : '?kind=collect'
	uni.navigateTo({ url: `/pagesA/assets/assets${q}` })
}

async function onMore() {
	track('quote_share', { content_id: contentId.value || 0, channel: 'more' })
	await sharePosterImage()
}

async function onMessages() {
	track('quote_share', { content_id: contentId.value || 0, channel: 'messages' })
	await sharePosterImage()
}

function toggleWm() {
	if (user.value.vip_level === 'free') {
		goVip()
		return
	}
	showWatermark.value = !showWatermark.value
}

async function onSave() {
	saving.value = true
	pendingAction.value = 'save'
	track('quote_share', { content_id: contentId.value || 0, channel: 'save' })
	await nextTick()
	exportPoster()
}

/** 先合成海报再走系统分享（带图） */
async function sharePosterImage() {
	saving.value = true
	pendingAction.value = 'share'
	await nextTick()
	exportPoster()
}

function exportPoster() {
	try {
		if (!painter.value) {
			finishFail()
			return
		}
		painter.value.canvasToTempFilePathSync({
			fileType: 'png',
			pathType: 'url',
			quality: 1,
			success: (res) => {
				const path = res.tempFilePath || res.path
				handleExport(path)
			},
			fail: () => finishFail(),
		})
	} catch (e) {
		finishFail()
	}
}

function handleExport(path) {
	const action = pendingAction.value
	pendingAction.value = ''
	saving.value = false
	if (!path) {
		uni.showToast({ title: t('share_failed'), icon: 'none' })
		return
	}
	if (action === 'save') {
		saveImageToAlbum(path)
		return
	}
	if (action === 'share') {
		systemShare({
			title: brandName.value,
			summary: summary(),
			href: downloadUrl.value,
			imageUrl: path,
		})
	}
}

function onPainted(path) {
	if (!pendingAction.value) return
	handleExport(path)
}

function onPaintFail() {
	finishFail()
}

function finishFail() {
	pendingAction.value = ''
	saving.value = false
	uni.showToast({ title: t('share_failed'), icon: 'none' })
}

function goVip() {
	navigateVip('watermark', { lockContentId: contentId.value || '' })
}

function onAboutSource() {
	if (!sourceRef.value) return
	uni.showModal({
		title: t('about_source'),
		content: sourceRef.value,
		showCancel: false,
		confirmText: t('ok') || 'OK',
	})
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.share {
	min-height: 100vh;
	padding: 0 0 48rpx;
	background: #f5f5f5;
	box-sizing: border-box;
}
.custom-nav {
	@include selah-sticky-head;
	display: flex;
	justify-content: flex-start;
	padding: 0 32rpx 8rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.head-glass {
	@include selah-sticky-head-glass(#f5f5f5);
}
.nav-pill {
	position: relative;
	z-index: 1;
	@include selah-nav-circle;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.poster {
	width: 574rpx;
	height: 908rpx;
	margin: 16rpx auto 0;
	border-radius: 48rpx;
	box-sizing: border-box;
	overflow: hidden;
	position: relative;
	box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.08);
	border: 2rpx solid rgba(25, 25, 25, 0.05);
	background: #fbf8f2;
}
.poster-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}
.poster-body {
	position: absolute;
	inset: 0;
	padding: 64rpx 40rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	z-index: 1;
}
.body {
	font-family: $selah-font-display;
	font-size: 40rpx;
	line-height: 1.4;
	text-align: center;
	font-weight: 700;
	color: $selah-ink;
}
.cite {
	margin-top: 16rpx;
	font-family: $selah-font-display;
	font-size: 24rpx;
	font-weight: 700;
	color: $selah-ink;
	text-align: center;
}
.wm-pill {
	position: absolute;
	bottom: 40rpx;
	left: 50%;
	transform: translateX(-50%);
	z-index: 2;
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 10rpx 16rpx;
	border-radius: 16rpx;
	background: rgba(255, 255, 255, 0.45);
	box-shadow: 0 0 20rpx rgba(0, 0, 0, 0.05);
}
.wm-logo {
	width: 32rpx;
	height: 32rpx;
	border-radius: 8rpx;
	margin-right: 8rpx;
}
.wm-text {
	font-size: 22rpx;
	color: $selah-ink;
}
.theme-row {
	display: flex;
	flex-direction: row;
	justify-content: center;
	flex-wrap: wrap;
	padding: 20rpx 24rpx 0;
}
.theme-dot {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	margin: 8rpx 12rpx;
	border: 4rpx solid transparent;
	box-sizing: border-box;
	overflow: hidden;
}
.theme-dot.on {
	border-color: $selah-ink;
}
.theme-thumb {
	width: 100%;
	height: 100%;
}
.wall {
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
	padding: 40rpx 64rpx 0;
	flex-wrap: nowrap;
	overflow-x: auto;
}
.wall.second {
	padding-top: 28rpx;
}
.act {
	width: 112rpx;
	margin-right: 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	flex-shrink: 0;
}
.act-btn {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	background: #fbfaf6;
	border: 2rpx solid rgba(25, 25, 25, 0.05);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 16rpx;
	box-sizing: border-box;
}
.act-btn.messages {
	background: linear-gradient(180deg, #00fa62, #00c000);
	border-color: transparent;
}
.act-ico {
	width: 52rpx;
	height: 52rpx;
}
.act-glyph {
	font-size: 32rpx;
	font-weight: 700;
	color: $selah-ink;
}
.act-label {
	font-size: 22rpx;
	color: $selah-ink;
	text-align: center;
	line-height: 1.25;
	width: 112rpx;
}
</style>
