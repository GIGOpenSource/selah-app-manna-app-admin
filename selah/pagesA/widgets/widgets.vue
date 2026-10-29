<!--
  小组件：主屏=预览+配置即时保存；锁屏=安装步骤+系统说明。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="custom-nav">
				<view class="nav-left">
					<view class="nav-pill" @tap.stop="goBack">
						<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="nav-title">{{
						kind === 'lock' ? t('widgets_lock_title') : t('widgets_home_title')
					}}</text>
				</view>
				<view v-if="kind !== 'lock'" class="nav-save" @tap.stop="openSaveDialog">
					<text class="nav-save-text">{{ t('save') }}</text>
				</view>
			</view>
		</view>

		<!-- 锁屏：安装步骤 -->
		<template v-if="kind === 'lock'">
			<text class="setup">{{ t('widget_lock_hero_title') }}</text>
			<text class="lock-body">{{ t('widget_lock_hero_body') }}</text>
			<view class="steps card">
				<view v-for="(s, i) in lockSteps" :key="i" class="step-row">
					<text class="step-num">{{ i + 1 }}</text>
					<text class="step-text">{{ s }}</text>
				</view>
			</view>
			<text class="hint">{{ t('lock_screen_widgets_body') }}</text>
			<view class="footer">
				<view :class="['cta', saving ? 'disabled' : '']" @tap="onInstallLock">
					<text class="cta-text">{{ t('widgets_install') }}</text>
				</view>
			</view>
		</template>

		<!-- 主屏：预览 + 配置 -->
		<template v-else>
			<text class="setup">{{ t('widgets_setup') }}</text>

			<view class="preview-stage">
				<view :class="['preview-phone', widgetSize === 's44' ? 'phone-large' : '']">
					<view class="preview-top-slot" />
					<view
						:class="[
							'preview-widget',
							widgetSize,
							widgetBgUrl ? 'has-bg' : `theme-${prefs.theme_key}`,
							borderOn ? 'bordered' : '',
						]"
					>
						<image
							v-if="widgetBgUrl"
							class="preview-bg"
							:src="widgetBgUrl"
							mode="aspectFill"
							@error="onWidgetBgError"
						/>
						<view v-if="quoteText" :class="['preview-quote-wrap', previewName ? 'has-name' : '']">
							<text class="preview-quote">{{ quoteText }}</text>
						</view>
						<view v-if="previewName" class="preview-name-wrap">
							<text class="preview-name">{{ previewName }}</text>
						</view>
					</view>
				</view>
			</view>

			<text class="hint">{{ t('widgets_theme_hint') }}</text>

			<text class="section-title">{{ t('widgets_config_title') }}</text>
			<view class="card">
				<view class="row" @tap="openName">
					<text class="row-label">{{ t('widgets_name') }}</text>
					<view class="row-trail">
						<text class="row-value">{{ nameLabel }}</text>
						<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
					</view>
				</view>
				<view class="row" @tap="openCategory">
					<text class="row-label">{{ t('widgets_topics') }}</text>
					<view class="row-trail">
						<text class="row-value">{{ categoryLabel }}</text>
						<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
					</view>
				</view>
				<view class="row">
					<text class="row-label">{{ t('widgets_border') }}</text>
					<switch
						:checked="borderOn"
						color="#191919"
						@change="onBorderToggle"
					/>
				</view>
				<view class="row last" @tap="pickRefresh">
					<text class="row-label">{{ t('widgets_refresh') }}</text>
					<view class="row-trail">
						<text class="row-value">{{ refreshLabel }}</text>
						<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
					</view>
				</view>
			</view>
			<text class="hint-foot">{{ t('widgets_remove_hint') }}</text>
			<text v-if="statusHint" class="status">{{ statusHint }}</text>
		</template>
		<selah-dialog
			v-model:visible="saveDialogOpen"
			:title="t('widgets_unsaved_title')"
			:hide-actions="true"
			:close-on-mask="true"
		>
			<view class="save-actions">
				<view class="save-btn solid" @tap.stop="onSaveConfirm">
					<text class="save-btn-text solid">{{ t('widgets_unsaved_confirm') }}</text>
				</view>
				<view class="save-btn ghost" @tap.stop="onSaveClose">
					<text class="save-btn-text ghost">{{ t('widgets_unsaved_close') }}</text>
				</view>
			</view>
		</selah-dialog>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import {
	apiWidgetSave,
	apiWidgetPayload,
	apiWidgets,
	apiDisplayTagQuotes,
} from '@/api/content.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { markWidgetSetupDone } from '@/utils/homePopups.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import {
	FALLBACK_WALLPAPER,
	getActiveWallpaper,
	resolveActiveWallpaper,
	wallpaperDisplayUrl,
} from '@/utils/wallpaperCache.js'
import {
	quoteAt,
	syncWidgetSlot,
} from '@/utils/widgetDesktopSync.js'
import {
	EDIT_ITEM_KEY,
	REFRESH_KEYS,
	refreshLabelKey,
	refreshFromApi,
	refreshToApi,
	readWidgetUiPrefs,
	writeWidgetUiPrefs,
} from './refreshOptions.js'

const CATEGORY_PICK_KEY = 'widget_category_pick'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const kind = ref('home')
const fromProfile = ref(false)
const fromHome = ref(false)
const widgetId = ref(null)
const widgetShape = ref('wide')
const saving = ref(false)
const saveDialogOpen = ref(false)
const statusHint = ref('')
const prefs = ref({
	name: '',
	theme_key: 'default',
	border_key: 'plain',
	refresh: 'off',
	quote_source: 'recommend',
	followed_topic_ids: [],
	customize: true,
	show_buttons: false,
})
const selectedCategory = ref({ id: '', name: '', ids: [] })
const payload = ref({ empty: true, quote: null })
const widgetBgUrl = ref(FALLBACK_WALLPAPER)
const listImageUrl = ref('')

const borderOn = computed(() => prefs.value.border_key && prefs.value.border_key !== 'plain')
const widgetSize = computed(() => {
	const raw = String(widgetShape.value || '').toLowerCase()
	if (raw === 'square') return 's22'
	if (raw === 'large_square' || raw === 'large' || raw === 'extra_large') return 's44'
	return 's42'
})

const lockSteps = computed(() => [
	t('widgets_lock_step_1'),
	t('widgets_lock_step_2'),
	t('widgets_lock_step_3'),
])

const nameLabel = computed(() => prefs.value.name || t('display_name_empty'))
const previewName = computed(() => String(prefs.value.name || '').trim())
const quoteText = computed(() => String(payload.value?.quote?.content || '').trim())
const categoryLabel = computed(() => selectedCategory.value.name || t('widgets_theme_unset'))

function displayTagName(row) {
	const lang = String(getCurrentLanguage() || 'en').slice(0, 2)
	const localized = lang === 'es' ? row?.name_es : lang === 'pt' ? row?.name_pt : row?.name_en
	return String(localized || row?.name_en || row?.name || '').trim()
}

function applyCategoryItems(items, silent = false) {
	const rows = (items || []).filter((row) => row && row.id != null && row.id !== '')
	if (!rows.length) {
		selectedCategory.value = { id: '', name: '', ids: [] }
		if (!silent) writeUiPrefs({ category: { items: [] } })
		return
	}
	const ids = rows.map((row) => row.id)
	selectedCategory.value = {
		id: ids.join(','),
		name: rows.length === 1 ? (rows[0].name || displayTagName(rows[0])) : t('widgets_topics_mixed'),
		ids,
	}
	if (!silent) {
		writeUiPrefs({ category: { items: rows.map((row) => ({ id: row.id, name: row.name || displayTagName(row) })) } })
	}
}

function quoteFromDisplayRes(res) {
	const bag = res?.results || res || {}
	const list = Array.isArray(bag.list) ? bag.list : (Array.isArray(bag) ? bag : [])
	const first = list[0]
	if (!first) return { empty: true, quote: null }
	return { empty: false, quote: first }
}

async function loadCategoryQuotes() {
	const ids = selectedCategory.value.ids || []
	if (!ids.length) return
	try {
		const res = await apiDisplayTagQuotes(ids.join(','), { currentPage: 1, pageSize: 10 })
		payload.value = quoteFromDisplayRes(res)
		if (kind.value === 'home') await writeNative(payload.value)
	} catch (e) {}
}

const refreshLabel = computed(() => t(refreshLabelKey(prefs.value.refresh || 'off')))

function readUiPrefs() {
	return readWidgetUiPrefs()
}

function writeUiPrefs(patch) {
	writeWidgetUiPrefs(patch)
}

function applyLocalUi() {
	const local = readUiPrefs()
	if (typeof local.name === 'string') prefs.value.name = local.name
	const cat = local.category
	if (Array.isArray(cat?.items) && cat.items.length) {
		applyCategoryItems(cat.items)
	} else if (cat && cat.id != null && cat.id !== '') {
		applyCategoryItems([{ id: cat.id, name: String(cat.name || '') }])
	}
	if (typeof local.border_on === 'boolean') {
		prefs.value.border_key = local.border_on ? 'soft' : 'plain'
	}
	if (typeof local.show_buttons === 'boolean') {
		prefs.value.show_buttons = local.show_buttons
	}
	const refresh = typeof local.refresh === 'string' ? local.refresh : prefs.value.refresh
	prefs.value.refresh = REFRESH_KEYS.includes(refresh) ? refresh : 'off'
}

function consumeCategoryPick() {
	let raw = ''
	try {
		raw = uni.getStorageSync(CATEGORY_PICK_KEY)
	} catch (e) {
		raw = ''
	}
	if (!raw) return false
	try {
		uni.removeStorageSync(CATEGORY_PICK_KEY)
	} catch (e) {}
	let data = null
	try {
		data = typeof raw === 'string' ? JSON.parse(raw) : raw
	} catch (e) {
		data = null
	}
	if (Array.isArray(data.items)) {
		applyCategoryItems(data.items)
		loadCategoryQuotes()
		return true
	}
	if (!data || data.id == null || data.id === '') return false
	applyCategoryItems([{ id: data.id, name: String(data.name || '') }])
	loadCategoryQuotes()
	return true
}

function readEditItem() {
	try {
		const raw = uni.getStorageSync(EDIT_ITEM_KEY)
		const data = typeof raw === 'string' ? JSON.parse(raw) : raw
		return data && typeof data === 'object' ? data : null
	} catch (e) {
		return null
	}
}

function hydrateFromListItem(slot) {
	const row = readEditItem() || {}
	if (slot) widgetId.value = slot
	else if (row.id != null) widgetId.value = row.id
	prefs.value.name = String(row.name || '')
	prefs.value.border_key = row.border_enabled ? 'soft' : 'plain'
	prefs.value.refresh = refreshFromApi(row.refresh)
	widgetShape.value = String(row.shape || 'wide').toLowerCase()
	if (row.display_tag_id != null && row.display_tag_id !== '') {
		applyCategoryItems([{ id: row.display_tag_id, name: String(row.display_tag_name || '') }], true)
	} else {
		selectedCategory.value = {
			id: '',
			name: String(row.display_tag_name || ''),
			ids: [],
		}
	}
	const quoteContent = String(row.quote_content || row.quote?.content || '').trim()
	payload.value = quoteContent
		? { empty: false, quote: { content: quoteContent } }
		: { empty: true, quote: null }
	const image = String(row.image_url || '').trim()
	if (image) {
		listImageUrl.value = image
		widgetBgUrl.value = image
	}
	writeUiPrefs({
		name: prefs.value.name,
		refresh: prefs.value.refresh,
		border_on: !!row.border_enabled,
		category: row.display_tag_id != null && row.display_tag_id !== ''
			? { items: [{ id: row.display_tag_id, name: String(row.display_tag_name || '') }] }
			: { items: [] },
	})
}

onLoad((q) => {
	kind.value = q?.kind === 'lock' ? 'lock' : 'home'
	fromProfile.value = q?.from === 'profile'
	fromHome.value = q?.from === 'home'
	if (kind.value !== 'lock') hydrateFromListItem(q?.slot)
})

function goBack() {
	if (kind.value !== 'lock') {
		try {
			logFirebaseEvent('homeWidget_config_save_result', {
				topic: categoryLabel.value || '',
				theme: prefs.value.theme_key || '',
				boder: borderOn.value ? 'on' : 'off',
			})
		} catch (e) {}
	}
	if (fromHome.value) {
		safeBack('/pages/home/home')
		return
	}
	safeBack(fromProfile.value ? '/pagesA/widgets/center?from=profile' : '/pagesA/settings/settings')
}

function onBorderToggle(e) {
	try { logFirebaseEvent('homeWidget_border_click') } catch (err) {}
	const on = !!(e?.detail?.value)
	prefs.value.border_key = on ? 'soft' : 'plain'
	writeUiPrefs({ border_on: on })
	try { logFirebaseEvent('homeWidget_preview_result') } catch (err) {}
}

function openName() {
	uni.navigateTo({ url: '/pagesA/widgets/name' })
}

function openCategory() {
	try { logFirebaseEvent('homeWidget_topics_click') } catch (e) {}
	uni.navigateTo({ url: '/pagesA/explore/explore?from=widget' })
}

function pickRefresh() {
	try { logFirebaseEvent('homeWidget_refresh_click') } catch (e) {}
	uni.navigateTo({ url: '/pagesA/widgets/refresh' })
}

function openSaveDialog() {
	saveDialogOpen.value = true
}

async function onSaveConfirm() {
	saveDialogOpen.value = false
	await persistAndPreview()
}

function onSaveClose() {
	saveDialogOpen.value = false
}

async function writeNative(pay) {
	try {
		const { nativeWriteWidgetPayload } = await import('@/utils/selahNative.js')
		const nr = await nativeWriteWidgetPayload(pay)
		uni.setStorageSync('widget_payload_last', JSON.stringify(pay || {}))
		if (nr && (nr.skipped || nr.ok === false)) {
			statusHint.value = t('widgets_native_unavailable')
			return false
		}
		statusHint.value = ''
		return true
	} catch (e) {
		statusHint.value = t('widgets_native_unavailable')
		return false
	}
}

function quoteTextOf(row) {
	if (!row || typeof row !== 'object') return ''
	const raw = row.content ?? row.text ?? row.body
	if (typeof raw === 'string') return raw.trim()
	if (row.quote && typeof row.quote === 'object') return quoteTextOf(row.quote)
	return ''
}

async function collectQuoteTexts() {
	const ids = selectedCategory.value.ids || []
	if (ids.length) {
		try {
			const res = await apiDisplayTagQuotes(ids.join(','), { currentPage: 1, pageSize: 30 })
			const bag = res?.results || res || {}
			const list = Array.isArray(bag.list) ? bag.list : []
			const texts = list.map(quoteTextOf).filter(Boolean)
			if (texts.length) return texts
		} catch (e) {}
	}
	const current = String(payload.value?.quote?.content || '').trim()
	return current ? [current] : []
}

function wallpaperRemoteUrl() {
	const snap = getActiveWallpaper()
	const candidates = [snap?.image_url, snap?.poster_url, widgetBgUrl.value]
	return candidates.find((url) => /^https?:\/\//i.test(String(url || '').trim())) || ''
}

function wallpaperLocalPath() {
	const snap = getActiveWallpaper()
	const candidates = [snap?.local_url, widgetBgUrl.value]
	return candidates.find((url) => {
		const value = String(url || '').trim()
		return value && !/^https?:\/\//i.test(value)
	}) || ''
}

function rowQuote(row) {
	const quote = row?.quote
	if (quote && typeof quote === 'object') {
		const text = quote.content || quote.text || ''
		if (String(text).trim()) return String(text).trim()
	}
	if (typeof quote === 'string' && quote.trim()) return quote.trim()
	return String(row?.quote_content || row?.text || row?.content || '').trim()
}

async function pushDesktopStyle(quotes) {
	try {
		const wallpaper = wallpaperRemoteUrl()
		const localImage = wallpaperLocalPath()
		const visible = String(quoteText.value || '').trim()
		const lines = (Array.isArray(quotes) ? quotes : [])
			.map((item) => String(item || '').trim())
			.filter(Boolean)
		const packed = lines.length ? lines : (visible ? [visible] : [])
		if (!wallpaper && !localImage && !packed.length && !String(prefs.value.name || '').trim()) return
		let rows = []
		try {
			const res = await apiWidgets({}, { showLoading: false })
			rows = res?.results?.list || []
		} catch (e) {}
		const previewImage = String(listImageUrl.value || widgetBgUrl.value || '').trim()
		const mine = {
			shape: widgetShape.value,
			name: prefs.value.name,
			quotes: packed,
			refresh: prefs.value.refresh,
			border: borderOn.value,
			image_url: previewImage,
		}
		const iosPreviews = [mine]
		rows.forEach((row) => {
			if (widgetId.value != null && String(row?.id) === String(widgetId.value)) return
			const text = rowQuote(row)
			iosPreviews.push({
				shape: row?.shape,
				name: String(row?.name || ''),
				quotes: text ? [text] : [],
				refresh: row?.refresh,
				border: !!row?.border_enabled,
				image_url: String(row?.image_url || row?.cover_url || row?.card_image_url || '').trim(),
			})
		})
		await syncWidgetSlot({
			shape: widgetShape.value,
			name: prefs.value.name,
			border: borderOn.value,
			refresh: prefs.value.refresh,
			show_buttons: !!prefs.value.show_buttons,
			quotes: packed,
			displayTagIds: selectedCategory.value.ids || [],
			wallpaperUrl: wallpaper,
			localImage,
			wallpaperSet: true,
			iosPreviews,
		})
	} catch (e) {}
}

let reportPreview = false

async function refreshPreviewQuote() {
	try {
		const quotes = await collectQuoteTexts()
		const shown = quoteAt(quotes, prefs.value.refresh)
		if (shown) applyQuoteContent(shown)
		await pushDesktopStyle(quotes)
	} finally {
		if (reportPreview) {
			reportPreview = false
			try { logFirebaseEvent('homeWidget_preview_result') } catch (e) {}
		}
	}
}

function saveDisplayTagId() {
	const ids = selectedCategory.value.ids || []
	if (ids.length === 1) {
		const n = Number(ids[0])
		return Number.isFinite(n) ? n : ids[0]
	}
	return null
}

async function persistAndPreview() {
	if (kind.value === 'lock' || saving.value) return
	saving.value = true
	try {
		const body = {
			name: String(prefs.value.name || ''),
			display_tag_id: saveDisplayTagId(),
			border_enabled: !!borderOn.value,
			refresh: refreshToApi(prefs.value.refresh),
		}
		if (widgetId.value != null && widgetId.value !== '') body.id = Number(widgetId.value) || widgetId.value
		await apiWidgetSave(body)
		const quotes = await collectQuoteTexts()
		const shown = quoteAt(quotes, prefs.value.refresh) || quoteText.value
		if (shown) applyQuoteContent(shown)
		await pushDesktopStyle(quotes)
		try { logFirebaseEvent('homeWidget_preview_result') } catch (e) {}
		uni.showToast({ title: t('save'), icon: 'none' })
	} catch (e) {
		if (e?.code === 403) return
		statusHint.value = e?.message || t('request_failed')
		uni.showToast({ title: statusHint.value, icon: 'none' })
	} finally {
		saving.value = false
	}
}

async function onInstallLock() {
	saving.value = true
	try {
		const payRes = await apiWidgetPayload()
		payload.value = payRes.results || payload.value
		const ok = await writeNative(payload.value)
		try { logFirebaseEvent('homeWidget_install_result') } catch (e) {}
		// #ifdef APP-PLUS
		try {
			const { openAppNotificationSettings } = await import('@/utils/alarm.js')
			// 无专用小组件设置 URI 时回落到应用设置，并提示系统步骤
			uni.showModal({
				title: t('widgets_install'),
				content: t('widgets_lock_install_guide'),
				confirmText: t('alarm_go_settings'),
				cancelText: t('ok'),
				success: (r) => {
					if (r.confirm) openAppNotificationSettings()
				},
			})
			return
		} catch (e) {}
		// #endif
		uni.showToast({
			title: ok ? t('widgets_install_done') : t('widgets_native_unavailable'),
			icon: 'none',
		})
	} finally {
		saving.value = false
	}
}

function applyQuoteContent(content) {
	const text = String(content || '').trim()
	if (!text) return false
	payload.value = { empty: false, quote: { ...(payload.value?.quote || {}), content: text } }
	return true
}

async function loadWidgetQuote() {
	if (quoteText.value || widgetId.value == null || widgetId.value === '') return
	try {
		const res = await apiWidgets({}, { showLoading: false })
		const rows = res?.results?.list || []
		const row = rows.find((item) => String(item?.id) === String(widgetId.value))
		applyQuoteContent(row?.quote?.content)
	} catch (e) {}
}

async function load() {
	if (kind.value === 'lock') {
		try {
			const payRes = await apiWidgetPayload()
			payload.value = payRes.results || { empty: true }
			await writeNative(payload.value)
			markWidgetSetupDone()
		} catch (e) {
			statusHint.value = t('request_failed')
		}
		return
	}
	applyLocalUi()
	if (!quoteText.value) await loadWidgetQuote()
	markWidgetSetupDone()
}

onShow(() => {
	if (kind.value === 'lock') return
	applyLocalUi()
	const picked = consumeCategoryPick()
	if (picked) reportPreview = true
	if (!picked && !quoteText.value && (selectedCategory.value.ids || []).length) {
		loadCategoryQuotes()
	}
	applyWidgetWallpaper().then(() => refreshPreviewQuote())
})

/** 从列表进来时用那张卡片的图。没有列表图时才跟首页壁纸。 */
async function applyWidgetWallpaper() {
	if (listImageUrl.value) {
		widgetBgUrl.value = listImageUrl.value
		return
	}
	try {
		const hasToken = !!uni.getStorageSync('token')
		const snap = await resolveActiveWallpaper(null, { allowNetwork: hasToken })
		const url = wallpaperDisplayUrl(snap) || FALLBACK_WALLPAPER
		if (url) widgetBgUrl.value = url
	} catch (e) {
		if (!widgetBgUrl.value) widgetBgUrl.value = FALLBACK_WALLPAPER
	}
}

function onWidgetBgError() {
	if (widgetBgUrl.value !== FALLBACK_WALLPAPER) widgetBgUrl.value = FALLBACK_WALLPAPER
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
	background: $selah-bg-gray;
}
.custom-nav {
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
.nav-save {
	min-width: 128rpx;
	height: 72rpx;
	padding: 0 36rpx;
	border-radius: $selah-radius-pill;
	background: #ffffff;
	box-shadow: $selah-shadow;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.nav-save-text {
	font-size: 28rpx;
	font-weight: 600;
	color: $selah-ink;
}
.setup {
	display: block;
	margin-top: 16rpx;
	text-align: center;
	font-size: 32rpx;
	line-height: 1.35;
	color: $selah-ink;
}
.lock-body {
	display: block;
	margin: 16rpx 8rpx 28rpx;
	text-align: center;
	font-size: 28rpx;
	line-height: 1.45;
	color: $selah-ink-soft;
}
.step-row {
	display: flex;
	flex-direction: row;
	align-items: flex-start;
	padding: 20rpx 0;
	border-bottom: 1rpx solid rgba(25, 25, 25, 0.08);
}
.step-row:last-child {
	border-bottom: none;
}
.step-num {
	width: 44rpx;
	height: 44rpx;
	border-radius: 22rpx;
	background: $selah-ink;
	color: #fff;
	font-size: 24rpx;
	font-weight: 600;
	text-align: center;
	line-height: 44rpx;
	margin-right: 20rpx;
	flex-shrink: 0;
}
.step-text {
	flex: 1;
	font-size: 28rpx;
	line-height: 1.4;
	color: $selah-ink;
}
.preview-stage {
	margin-top: 28rpx;
	display: flex;
	justify-content: center;
}
.preview-phone {
	position: relative;
	width: 582rpx;
	height: 400rpx;
	border-radius: 44rpx 44rpx 0 0;
	background: linear-gradient(180deg, #ddd2c4 0%, rgba(221, 210, 196, 0) 100%);
	padding: 80rpx 40rpx 24rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
}
.preview-top-slot {
	position: absolute;
	top: 22rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 120rpx;
	height: 32rpx;
	border-radius: 16rpx;
	background: rgba(255, 255, 255, 0.45);
}
.preview-widget {
	position: relative;
	border-radius: 48rpx;
	background: linear-gradient(180deg, $selah-grad-top 0%, $selah-grad-mid 100%);
	box-sizing: border-box;
	overflow: hidden;
	flex-shrink: 0;
}
.preview-widget.s22 {
	width: 268rpx;
	height: 268rpx;
}
.preview-widget.s42 {
	width: 100%;
	height: 248rpx;
}
.preview-phone.phone-large {
	height: 620rpx;
}
.preview-widget.s44 {
	width: 420rpx;
	height: 420rpx;
}
.preview-bg {
	position: absolute;
	left: 0;
	top: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
}
.preview-quote-wrap {
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24rpx;
	box-sizing: border-box;
}
.preview-quote-wrap.has-name {
	bottom: 72rpx;
}
.preview-name-wrap {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 2;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding: 0 20rpx 20rpx;
	box-sizing: border-box;
	height: 72rpx;
}
.preview-widget.theme-lavender {
	background: linear-gradient(180deg, #e8dff5 0%, #c9b8e0 100%);
}
.preview-widget.theme-cream {
	background: linear-gradient(180deg, #f7efe3 0%, #e8d9c4 100%);
}
.preview-widget.bordered {
	border: 8rpx solid #ffffff;
}
.preview-quote {
	width: 100%;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 24rpx;
	line-height: 1.35;
	font-weight: 600;
	color: $selah-ink;
	overflow: hidden;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 5;
}
.preview-widget.has-bg .preview-quote {
	color: #fff;
	text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.45);
}
.preview-name {
	width: 100%;
	text-align: center;
	font-size: 26rpx;
	line-height: 1.3;
	font-weight: 600;
	color: $selah-ink;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.preview-widget.has-bg .preview-name {
	color: #fff;
	text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.45);
}
.hint {
	display: block;
	margin: 24rpx 8rpx;
	text-align: center;
	font-size: 24rpx;
	color: $selah-muted;
	line-height: 1.4;
}
.hint-foot {
	display: block;
	margin: 16rpx 8rpx 0;
	text-align: center;
	font-size: 24rpx;
	color: $selah-muted;
	line-height: 1.4;
}
.status {
	display: block;
	margin-top: 16rpx;
	text-align: center;
	font-size: 24rpx;
	color: #a33;
}
.section-title {
	display: block;
	margin: 8rpx 0 16rpx;
	font-size: 28rpx;
	font-weight: 600;
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
	color: $selah-ink;
}
.row-trail {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.row-value {
	max-width: 280rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 28rpx;
	color: $selah-ink-soft;
	margin-right: 8rpx;
}
.chev {
	width: 28rpx;
	height: 28rpx;
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
.save-actions {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
	margin-top: 24rpx;
}
.save-btn {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.save-btn.solid {
	background: $selah-ink;
}
.save-btn.ghost {
	background: #ffffff;
	border: 2rpx solid $selah-ink;
}
.save-btn-text {
	font-size: 30rpx;
	font-weight: 600;
}
.save-btn-text.solid {
	color: #ffffff;
}
.save-btn-text.ghost {
	color: $selah-ink;
}
</style>
