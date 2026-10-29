<!--
  分享：对齐主带 Figma 8:133 — 关闭 + 海报卡（背景图 + Selah logo 水印）+ 动作墙。
  导出 / Share via / Messages 走 l-painter 合成图，失败再截 WebView；App 分享走 Share 模块。
-->
<template>
	<view class="share">
		<view v-show="!capturing" class="custom-nav" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="nav-pill" @tap.stop="goBack">
				<image class="nav-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
			</view>
		</view>

		<!-- 离屏合成：背景图强制铺满 -->
		<l-painter
			:key="paintKey"
			ref="painter"
			width="574rpx"
			:height="posterLayout.height + 'rpx'"
			path-type="url"
			:hidden="true"
			:pixel-ratio="2"
			:useCORS="true"
		>
			<l-painter-view :css="'width: 574rpx; height: ' + posterLayout.height + 'rpx; position: relative;'">
				<l-painter-image
					:src="paintBgSrc"
					:css="'width: 574rpx; height: ' + posterLayout.height + 'rpx; object-fit: cover;'"
				/>
				<l-painter-view :css="'position: absolute; left: 0; top: 0; width: 574rpx; height: ' + posterLayout.height + 'rpx; background: rgba(0,0,0,0.4);'" />
				<l-painter-view :css="'position: absolute; left: 40rpx; top: ' + posterLayout.textTop + 'rpx; width: 494rpx;'">
					<l-painter-text
						:text="String(cardText || '')"
						css="width: 494rpx; font-size: 40rpx; color: #ffffff; line-height: 56rpx; text-align: center;"
					/>
					<l-painter-text
						v-if="citeLine"
						:text="String(citeLine)"
						css="margin-top: 16rpx; width: 494rpx; font-size: 24rpx; color: #ffffff; line-height: 34rpx; text-align: center;"
					/>
				</l-painter-view>
				<l-painter-view
					v-if="showWatermark"
					:css="'position: absolute; left: 0; top: ' + posterLayout.wmTop + 'rpx; width: 574rpx; height: ' + wmLayout.height + 'rpx; display: flex; flex-direction: row; align-items: center; justify-content: center;'"
				>
					<l-painter-view
						:css="'width: ' + wmLayout.width + 'rpx; height: ' + wmLayout.height + 'rpx; padding: 0 ' + wmLayout.padX + 'rpx; box-sizing: border-box; border-radius: 16rpx; background: rgba(255,255,255,0.45); display: flex; flex-direction: row; align-items: center; justify-content: center;'"
					>
						<l-painter-view
							:css="'width: ' + wmLayout.logoSize + 'rpx; height: ' + wmLayout.logoSize + 'rpx; border-radius: 8rpx; background: ' + wmLayout.logoBg + '; display: flex; flex-direction: row; align-items: center; justify-content: center;'"
						>
							<l-painter-text
								:text="wmLayout.mark"
								:css="'font-size: ' + wmLayout.letterSize + 'rpx; line-height: 1em; color: #ffffff; text-align: center; vertical-align: middle;'"
							/>
						</l-painter-view>
						<l-painter-text
							:text="wmLayout.name"
							:css="'margin-left: ' + wmLayout.gap + 'rpx; font-size: ' + wmLayout.fontSize + 'rpx; line-height: 1em; color: #191919; vertical-align: middle;'"
						/>
					</l-painter-view>
				</l-painter-view>
			</l-painter-view>
		</l-painter>

		<scroll-view class="poster-scroll" scroll-y :show-scrollbar="false" :bounces="false" @scroll="onPreviewScroll">
			<view class="poster" :style="{ minHeight: posterLayout.height + 'rpx' }">
				<image class="poster-bg" :src="bgSrc" mode="aspectFill" />
				<view class="poster-veil" />
				<view class="poster-copy">
					<text class="body">{{ cardText }}</text>
					<text v-if="citeLine" class="cite">{{ citeLine }}</text>
				</view>
				<view v-if="showWatermark" class="wm-pill">
					<view class="wm-logo-mark">
						<view class="wm-logo-letter-wrap">
							<text class="wm-logo-letter" :include-font-padding="false">{{ wmLayout.mark }}</text>
						</view>
					</view>
					<text class="wm-text" :include-font-padding="false">{{ brandName }}</text>
				</view>
			</view>
		</scroll-view>

		<view v-if="themePicker && !capturing" class="theme-row">
			<view
				v-for="th in themes"
				:key="th.id"
				:class="['theme-dot', themeId === th.id ? 'on' : '']"
				@tap="pickTheme(th.id)"
			>
				<image class="theme-thumb" :src="th.bg" mode="aspectFill" />
			</view>
		</view>

		<view v-show="!capturing" class="actions">
		<!-- scroll-x only：避免 overflow-x:auto 在 App 上横滑时连带上下晃 -->
		<scroll-view
			scroll-x
			class="wall"
			:show-scrollbar="false"
			:enable-flex="true"
			:scroll-with-animation="false"
			@scroll="onToolbarScroll"
		>
			<view class="wall-row" :style="{ width: wallRowWidth }">
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
				<view v-if="canCollect" class="act" @tap.stop="onCollect">
					<view class="act-btn">
						<image
							v-show="collected"
							class="act-ico"
							src="/static/ui/share/ico-collect-on.svg"
							mode="aspectFit"
						/>
						<image
							v-show="!collected"
							class="act-ico"
							src="/static/ui/share/ico-collect.svg"
							mode="aspectFit"
						/>
					</view>
					<text class="act-label">{{ collected ? t('collected') : t('add_to_collection') }}</text>
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
				<view v-if="mode === 'quote' && contentId" class="act" @tap="onSetWallpaper">
					<view class="act-btn">
						<text class="act-glyph">W</text>
					</view>
					<text class="act-label">{{ t('set_as_wallpaper') }}</text>
				</view>
				<view v-if="mode === 'quote' && contentId" class="act" @tap="onToggleDislike">
					<view :class="['act-btn', disliked ? 'on' : '']">
						<image
							v-show="disliked"
							class="act-ico"
							src="/static/ui/share/ico-dislike-on.svg"
							mode="aspectFit"
						/>
						<image
							v-show="!disliked"
							class="act-ico"
							src="/static/ui/share/ico-dislike.svg"
							mode="aspectFit"
						/>
					</view>
					<text class="act-label">{{ t('dislike') }}</text>
				</view>
				<view v-if="mode === 'quote' && contentId" class="act" @tap="onReport">
					<view class="act-btn">
						<text class="act-glyph">!</text>
					</view>
					<text class="act-label">{{ t('report') }}</text>
				</view>
			</view>
		</scroll-view>

		<view class="wall-second">
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

		<selah-sheet
			v-model:visible="reportSheetOpen"
			:title="t('report')"
			:items="reportSheetItems"
			:cancel-text="t('cancel')"
			@select="onReportSelect"
		/>
		<selah-sheet
			v-model:visible="collectSheetOpen"
			:title="t('add_to_collection')"
			:items="collectSheetItems"
			:cancel-text="t('cancel')"
			@select="onCollectSelect"
		/>
		<view v-if="themeSheetOpen && !capturing" class="theme-sheet-root">
			<view class="theme-sheet-mask" @click="closeThemeSheet" />
			<view class="theme-sheet-panel" @tap.stop>
				<scroll-view scroll-y class="theme-sheet-scroll" :show-scrollbar="false" @scrolltolower="onThemeSheetMore">
					<topics-page
						ref="topicsRef"
						picker
						@close="closeThemeSheet"
						@preview="onShareThemePreview"
						@preview-close="onShareThemePreviewClose"
						@applied="onShareThemeApplied"
					/>
				</scroll-view>
			</view>
		</view>
	</view>
</template>

<script setup>
/**
 * 海报背景：用户壁纸优先，否则渐变底图 / 主题图；水印 logo 用 static/ui/share/logo-mark.png。
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { getUser } from '@/utils/session.js'
import { copyShareText, systemShare, saveImageToAlbum, captureWebviewImage, canvasSafeImageUrl, composeSharePoster, takeShareDraft, measureSharePosterLayout, measureShareWatermarkLayout } from '@/utils/share.js'
import { setSystemWallpaper } from '@/utils/systemWallpaper.js'
import LPainter from 'lime-painter/components/l-painter/l-painter.vue'
import LPainterView from 'lime-painter/components/l-painter-view/l-painter-view.vue'
import LPainterImage from 'lime-painter/components/l-painter-image/l-painter-image.vue'
import LPainterText from 'lime-painter/components/l-painter-text/l-painter-text.vue'
import { apiAppConfig, apiQuote, apiDislike, apiReport, apiContentEnums, apiShareSuccess, apiFolders, apiCollect, parseFolderList, normalizeFolderItem } from '@/api/content.js'
import { apiAiHistory } from '@/api/ai.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { loadWithCache, clearPageCache, readPageCache } from '@/utils/pageCache.js'
import {
	APP_CONFIG_KEY,
	SHARE_THEME_KEY,
	ASSETS_FOLDERS_KEY,
	assetsListKey,
	getActiveWallpaper,
	resolveActiveWallpaper,
	wallpaperDisplayUrl,
} from '@/utils/wallpaperCache.js'
import { goVip as navigateVip } from '@/utils/vip.js'
import { recordDislikeStatus, readDislikedField, readCachedDisliked, quoteStatusCacheKey, writeQuoteStatusCache } from '@/utils/likeSync.js'
import { createTapLock } from '@/utils/tapLock.js'
import TopicsPage from '@/pagesA/topics/topics.vue'

const DEFAULT_THEMES = [
	{ id: 'lavender', bg: '/static/ui/share/bg-lavender.jpg' },
	{ id: 'cream', bg: '/static/ui/share/bg-cream.jpg' },
	{ id: 'peach', bg: '/static/ui/share/bg-peach.jpg' },
	{ id: 'dusk', bg: '/static/ui/share/bg-dusk.jpg' },
	{ id: 'fy1', bg: '/static/ui/themes/like.png' },
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
const shareEntry = ref('')
const days = ref(0)
const showWatermark = ref(true)
const user = ref(getUser())
const downloadUrl = ref('')
const brandName = ref('Selah')
const busy = ref(false)
const pendingAction = ref('') // 'save' | 'share'
const capturing = ref(false)
const savedThemeId = (() => {
	try {
		return uni.getStorageSync(SHARE_THEME_KEY) || ''
	} catch (e) {
		return ''
	}
})()
const themeId = ref(savedThemeId || '')
const themePicker = ref(false)
const themeSheetOpen = ref(false)
const topicsRef = ref(null)
const themes = ref([...DEFAULT_THEMES])
const disliked = ref(false)
const collected = ref(false)
const dislikeBusy = ref(false)
const reportSheetOpen = ref(false)
const reportSheetItems = ref([])
const collectSheetOpen = ref(false)
const collectSheetItems = ref([])
const collectFolders = ref([])
const collectBusy = ref(false)
/** 拉取收藏夹并打开弹窗中；与选夹 collectBusy 分离，避免互清 */
const collectOpening = ref(false)
const collectTap = createTapLock(420)
/** 祷告分享：用于 /api/ai/history/ 回查 collected 的日期（空=当天） */
const aiHistoryDate = ref('')
const REPORT_I18N = {
	inappropriate: 'report_inappropriate',
	hate: 'report_hate',
	spam: 'report_spam',
	copyright: 'report_copyright',
	other: 'report_other',
}

/** 同步灌入已缓存壁纸，避免每次打开再等网络才出背景 */
function applyWallpaperSnap(snap) {
	const bg = wallpaperDisplayUrl(snap)
	if (bg) {
		themes.value = [{ id: 'wallpaper', bg }, ...DEFAULT_THEMES]
	} else {
		themes.value = [...DEFAULT_THEMES]
	}
	if (savedThemeId && themes.value.some((x) => x.id === savedThemeId)) {
		themeId.value = savedThemeId
	} else if (bg) {
		themeId.value = 'wallpaper'
	} else if (!themes.value.some((x) => x.id === themeId.value)) {
		themeId.value = 'lavender'
	}
}

applyWallpaperSnap(getActiveWallpaper())

const cardText = computed(() =>
	mode.value === 'streak' ? `${days.value} ${t('streak_share_unit')}` : text.value
)
const citeLine = computed(() => {
	if (mode.value === 'streak') return t('practice_affirm')
	return sourceRef.value ? `-${sourceRef.value}` : ''
})
const activeTheme = computed(() => themes.value.find((x) => x.id === themeId.value) || themes.value[0])
const bgSrc = computed(() => activeTheme.value?.bg || DEFAULT_THEMES[0].bg)
const paintBgSrc = computed(() => canvasSafeImageUrl(bgSrc.value) || bgSrc.value)
const posterLayout = computed(() => measureSharePosterLayout(cardText.value, citeLine.value))
const wmLayout = computed(() => measureShareWatermarkLayout(brandName.value))
const paintKey = computed(() =>
	[paintBgSrc.value, cardText.value, citeLine.value, showWatermark.value ? 'wm' : 'nowm', brandName.value, posterLayout.value.height, wmLayout.value.width].join('|'),
)
/** 动作条按按钮数撑开，避免 enable-flex 把行宽锁成 100% 导致横滑失效 */
const canCollect = computed(() => {
	// 测验 / 连续打卡分享无内容 id，不展示加入收藏夹
	if (mode.value === 'quiz' || mode.value === 'streak') return false
	return Number(contentId.value) > 0
})
const wallActionCount = computed(() => {
	let n = 4 // 编辑主题 / 保存 / 复制 / 水印
	if (canCollect.value) n += 1
	if (mode.value === 'quote' && contentId.value) n += 3
	return n
})
const wallRowWidth = computed(() => `${wallActionCount.value * 152 + 128}rpx`)

let lockMessageCopy = false
let skipNextShowSync = false

onLoad(async (q) => {
	skipNextShowSync = true
	q = q || {}
	shareEntry.value = String(q.fb_source || '')
	mode.value = q.mode || 'quote'
	contentId.value = parseShareContentId(q.cid || q.content_id || q.id)
	days.value = Number(q.days || 0)
	const draft = takeShareDraft(q.draft)
	if (draft) {
		if (!contentId.value && draft.contentId) contentId.value = draft.contentId
		if (draft.text) text.value = draft.text
		if (draft.cite) sourceRef.value = String(draft.cite).replace(/^[-—–]\s*/, '')
		if (draft.mode && !q.mode) mode.value = draft.mode
		if (draft.historyDate) aiHistoryDate.value = draft.historyDate
		if (draft.fbSource) shareEntry.value = draft.fbSource
	}
	if (mode.value === 'quote') hydrateDislikeFromCache()
	// 肯定语无 /content/quote/ 可回查，收藏态靠草稿 + 本地缓存秒开
	if (mode.value === 'ai' || mode.value === 'affirmation') hydrateCollectedFromCache()
	if (draft && (draft.collected === true || draft.collected === false)) {
		collected.value = draft.collected
		if (contentId.value) writeQuoteStatusCache(contentId.value, { collected: draft.collected })
	}
	if (q.text && !text.value) {
		try {
			text.value = decodeURIComponent(q.text)
		} catch (e) {
			text.value = q.text
		}
	}
	if (q.cite && !sourceRef.value) {
		try {
			sourceRef.value = decodeURIComponent(q.cite)
		} catch (e) {
			sourceRef.value = q.cite
		}
		sourceRef.value = String(sourceRef.value || '').replace(/^[-—–]\s*/, '')
	}
	// AI 转发：海报只用点中的那条消息，不用语录库正文覆盖
	lockMessageCopy = mode.value === 'ai' && !!text.value
	if (mode.value === 'quote') syncQuoteStatus({ fillCopy: !lockMessageCopy }).catch(() => {})
	if (mode.value === 'ai') syncAiCollected().catch(() => {})
	fb('share_preview_show', shareEntry.value ? { source: shareEntry.value } : {})
})

function hydrateDislikeFromCache() {
	if (!contentId.value) return
	const cached = readCachedDisliked(contentId.value)
	if (cached != null) disliked.value = cached
}

function hydrateCollectedFromCache() {
	if (!contentId.value) return
	const snap = readPageCache(quoteStatusCacheKey(contentId.value))
	if (!snap || typeof snap !== 'object') return
	if (snap.collected === true || snap.collected === false) collected.value = !!snap.collected
}

function readCollectedField(payload) {
	if (!payload || typeof payload !== 'object') return null
	const raw = payload.collected
	if (raw === undefined || raw === null) return null
	return !!raw
}

function applyQuoteStatus(data, { fillCopy = false } = {}) {
	if (!data || typeof data !== 'object') return
	if (fillCopy) {
		if (!text.value) text.value = data.content || ''
		if (!sourceRef.value) sourceRef.value = data.source_ref || ''
	}
	const serverDisliked = readDislikedField(data)
	if (serverDisliked != null) {
		if (disliked.value !== serverDisliked) disliked.value = serverDisliked
		recordDislikeStatus(contentId.value, serverDisliked)
	}
	const serverCollected = readCollectedField(data)
	if (serverCollected == null) return
	if (collected.value !== serverCollected) collected.value = serverCollected
	writeQuoteStatusCache(contentId.value, { collected: serverCollected })
}

/** 不喜欢按钮：先用缓存秒开，后台再拉 /content/quote/，结果没变就不重绘。 */
async function syncQuoteStatus({ fillCopy = false } = {}) {
	if (!contentId.value) return
	try {
		await loadWithCache(
			quoteStatusCacheKey(contentId.value),
			async () => {
				const res = await apiQuote(contentId.value)
				return res?.results || res || {}
			},
			(data) => applyQuoteStatus(data, { fillCopy }),
			{ getRevision: (d) => `${d?.liked ? 1 : 0}:${d?.disliked ? 1 : 0}:${d?.collected ? 1 : 0}:${d?.content || ''}:${d?.source_ref || ''}` },
		)
	} catch (e) {}
}

/** 祷告分享收藏态：以 /api/ai/history/ messages[].collected 为准 */
function matchAiHistoryMessage(rows, wantId) {
	const want = Number(wantId)
	if (!Number.isFinite(want) || want <= 0) return null
	const list = Array.isArray(rows) ? rows : []
	for (const m of list) {
		if (!m) continue
		if (Number(m.id) === want) return m
		const candidates = [
			m.content_id,
			m.contentId,
			m.quote_id,
			m.quoteId,
			m.quote && m.quote.id,
			m.quote && m.quote.content_id,
		]
		for (const c of candidates) {
			if (Number(c) === want) return m
		}
	}
	return null
}

async function syncAiCollected() {
	if (!contentId.value || mode.value !== 'ai') return
	try {
		const date = String(aiHistoryDate.value || '').trim() || undefined
		const res = await apiAiHistory(date)
		const bag = res?.results || res || {}
		const msg = matchAiHistoryMessage(bag.messages || [], contentId.value)
		if (!msg) return
		const serverCollected = readCollectedField(msg)
		if (serverCollected == null) return
		if (collected.value !== serverCollected) collected.value = serverCollected
		writeQuoteStatusCache(contentId.value, { collected: serverCollected })
	} catch (e) {}
}

onShow(() => {
	if (skipNextShowSync) {
		skipNextShowSync = false
		return
	}
	if (!contentId.value) return
	if (mode.value === 'quote') syncQuoteStatus({ fillCopy: false }).catch(() => {})
	else if (mode.value === 'ai') syncAiCollected().catch(() => {})
})

onMounted(async () => {
	try {
		await loadWithCache(
			APP_CONFIG_KEY,
			async () => (await apiAppConfig()).results || {},
			(cfg) => {
				downloadUrl.value = String(cfg?.url_download || '').trim()
				const bn = (cfg?.brand_name || '').trim()
				if (bn) brandName.value = bn
			},
		)
	} catch (e) {}
	// 缓存可能是旧的空链：现场再拉一次，与设置页分享一致
	if (!downloadUrl.value) {
		try {
			const res = await apiAppConfig()
			const fresh = (res && res.results) || {}
			downloadUrl.value = String(fresh.url_download || '').trim()
			if (fresh && typeof fresh === 'object') {
				const bn = String(fresh.brand_name || '').trim()
				if (bn) brandName.value = bn
			}
		} catch (e) {}
	}
	await loadWallpaperTheme()
	try {
		await loadWithCache(
			'report_reasons_v1',
			async () => {
				const enums = await apiContentEnums()
				return (enums.results || {}).report_reasons || []
			},
			(reasons) => {
				const rows = Array.isArray(reasons) ? reasons.filter((r) => r && r.value && r.enabled !== false) : []
				rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
				reportSheetItems.value = (rows.length ? rows : [
					{ value: 'inappropriate' },
					{ value: 'hate' },
					{ value: 'spam' },
					{ value: 'copyright' },
					{ value: 'other' },
				]).map((r) => ({
					code: r.value,
					label: t(REPORT_I18N[r.value] || 'report_other'),
				}))
			},
		)
	} catch (e) {}
})

/** 壁纸主题：本地快照秒开，后台静默刷新并落盘 */
async function loadWallpaperTheme() {
	try {
		const snap = await resolveActiveWallpaper(user.value)
		applyWallpaperSnap(snap)
	} catch (e) {}
}

function fb(name, params) {
	try { logFirebaseEvent(name, params) } catch (e) {}
}

let toolbarScrollTimer = null
function onToolbarScroll() {
	clearTimeout(toolbarScrollTimer)
	toolbarScrollTimer = setTimeout(() => fb('share_toolbar_scroll'), 280)
}

let previewScrollTimer = null
function onPreviewScroll() {
	clearTimeout(previewScrollTimer)
	previewScrollTimer = setTimeout(() => fb('share_preview_scroll'), 280)
}

function pickTheme(id) {
	fb('share_theme_select_click')
	if (String(themeId.value) !== String(id)) fb('share_edit_changeTheme_click', { theme_id: id })
	themeId.value = id
	try {
		uni.setStorageSync(SHARE_THEME_KEY, id)
	} catch (e) {}
	themePicker.value = false
}

function goBack() {
	fb('share_preview_close_click')
	safeBack('/pages/home/home')
}

function shareQuoteText() {
	if (mode.value === 'streak') return `${days.value} ${t('streak_share_unit')}`
	const body = String(text.value || '').trim()
	const cite = String(citeLine.value || '').trim()
	return cite ? `${body}\n${cite}` : body
}

function shareHref() {
	// 与设置页一致：接口 url_download 原样分享，不拼 /legal/download/
	return String(downloadUrl.value || '').trim()
}

function onEditTheme() {
	fb('share_edit_theme_click', { theme_id: themeId.value || '' })
	themePicker.value = false
	themeSheetOpen.value = true
}

function closeThemeSheet() {
	themeSheetOpen.value = false
}

function onThemeSheetMore() {
	topicsRef.value?.loadMore?.()
}

function onShareThemePreview() {
	fb('share_preview_show', shareEntry.value ? { source: shareEntry.value } : {})
}

function onShareThemePreviewClose() {
	fb('share_preview_close_click')
}

function onShareThemeApplied(item) {
	const bg = String(item?.image_url || '').trim()
	const id = item?.id != null ? `topic-${item.id}` : ''
	if (bg && id) {
		themes.value = [{ id, bg }, ...themes.value.filter((x) => x.id !== id)]
		themeId.value = id
		try { uni.setStorageSync(SHARE_THEME_KEY, id) } catch (e) {}
	}
	themeSheetOpen.value = false
}

function onCopy() {
	fb('share_copy_text_click', { quote_id: contentId.value || '' })
	const body = String(shareQuoteText() || '')
		.replace(/\n*https?:\/\/[^\s]*\/legal\/download\/?[^\s]*/gi, '')
		.replace(/\s+$/g, '')
	Promise.resolve(copyShareText(body, '')).then((ok) => {
		fb('copy_text_result', { share_result: ok === true })
	})
}

function folderLabel(f) {
	if (!f) return ''
	const name = String(f.name || '').trim()
	if (name) return name
	if (f.is_default || f.isDefault) return t('default_collection')
	return t('collections')
}

function parseShareContentId(raw) {
	const v = Array.isArray(raw) ? raw[0] : raw
	const n = Number(v)
	return Number.isFinite(n) && n > 0 ? n : null
}

function applyFolderRows(rows) {
	collectFolders.value = (rows || []).map(normalizeFolderItem).filter(Boolean)
	collectSheetItems.value = collectFolders.value.map((f) => ({
		code: String(f.id),
		label: folderLabel(f),
	}))
	return collectFolders.value
}

function toastSavedToFolder(folderId) {
	const f = collectFolders.value.find((x) => String(x.id) === String(folderId))
	const name = folderLabel(f) || t('collections')
	const raw = t('saved_to_folder', { name })
	uni.showToast({ title: String(raw).replace('{name}', name), icon: 'none' })
}

function clearCollectCaches(folderId) {
	clearPageCache(ASSETS_FOLDERS_KEY)
	clearPageCache(assetsListKey('collect', folderId))
	clearPageCache(assetsListKey('collect', 0))
	clearPageCache(assetsListKey('affirmation', 0))
}

function onCollect() {
	fb('share_addCollection_click')
	collectTap.run(() => doCollect())
}

async function doCollect() {
	if (!canCollect.value || collectOpening.value) return
	const cid = Number(contentId.value)
	if (!Number.isFinite(cid) || cid <= 0) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
		return
	}
	// 已打开则忽略重复点击，避免静默刷新结束后再次把弹窗打开
	if (collectSheetOpen.value) return
	collectOpening.value = true
	let openedEarly = false
	try {
		const cached = readPageCache(ASSETS_FOLDERS_KEY)
		if (cached) applyFolderRows(parseFolderList(cached))
		if (collectFolders.value.length) {
			collectSheetOpen.value = true
			openedEarly = true
		}
		try {
			const res = await apiFolders(openedEarly ? {} : { showLoading: true })
			const next = parseFolderList(res).map(normalizeFolderItem).filter(Boolean)
			if (next.length) applyFolderRows(next)
		} catch (e) {
			if (openedEarly || collectFolders.value.length) return
			throw e
		}
		if (!collectFolders.value.length) {
			uni.showToast({ title: t('collections_empty_title'), icon: 'none' })
			return
		}
		// 仅用缓存提前打开过时不再二次赋值，否则选夹成功关窗后会被重新打开
		if (!openedEarly) collectSheetOpen.value = true
	} catch (e) {
		if (!collectFolders.value.length) {
			uni.showToast({ title: t('request_failed'), icon: 'none' })
		}
	} finally {
		collectOpening.value = false
	}
}

/** 祷告/语录分享收藏：/content/collect/ 只传 content_id + folder_id + target_type */
async function onCollectSelect({ value }) {
	if (collectBusy.value) return
	const folderIdNum = Number(value)
	if (!Number.isFinite(folderIdNum) || folderIdNum <= 0) return
	const cid = Number(contentId.value)
	if (!Number.isFinite(cid) || cid <= 0) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
		return
	}
	collectBusy.value = true
	try {
		const targetType = mode.value === 'ai'
			? 'ai_message'
			: (mode.value === 'affirmation' ? 'affirmation' : 'quote')
		await apiCollect(cid, folderIdNum, { target_type: targetType })
		collected.value = true
		writeQuoteStatusCache(cid, { collected: true })
		clearCollectCaches(folderIdNum)
		toastSavedToFolder(folderIdNum)
	} catch (e) {
		const msg = e?.msg || e?.message
		if (!msg) uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		collectBusy.value = false
	}
}

function toggleWm() {
	if (showWatermark.value) fb('share_hideWatermark_click')
	if (user.value.vip_level === 'free') {
		fb('share_watermark_result', { share_result: false })
		goVip()
		return
	}
	showWatermark.value = !showWatermark.value
	fb('share_watermark_result', { share_result: true })
}

async function onSave() {
	if (busy.value) return
	fb('share_save_image_click', { theme_id: themeId.value || '' })
	await exportPoster('save')
}

async function onShare() {
	if (busy.value) return
	await exportPoster('share')
}

async function onMore() {
	fb('share_system_click')
	await onShare()
}

async function onMessages() {
	fb('share_messages_click', { quote_id: contentId.value || '' })
	await onShare()
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function painterInst() {
	const p = painter.value
	if (!p) return null
	if (typeof p.canvasToTempFilePathSync === 'function') return p
	if (p.$vm && typeof p.$vm.canvasToTempFilePathSync === 'function') return p.$vm
	return null
}

function painterToPath(inst, pathType) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('timeout')), 8000)
		try {
			inst.canvasToTempFilePathSync({
				fileType: 'png',
				pathType,
				quality: 1,
				success: (res) => {
					clearTimeout(timer)
					const path = res?.tempFilePath || res?.path || (typeof res === 'string' ? res : '')
					if (path) resolve(path)
					else reject(new Error('empty'))
				},
				fail: (err) => {
					clearTimeout(timer)
					reject(err || new Error('fail'))
				},
			})
		} catch (e) {
			clearTimeout(timer)
			reject(e)
		}
	})
}

async function captureVisiblePoster() {
	capturing.value = true
	await nextTick()
	await sleep(120)
	try {
		return await captureWebviewImage()
	} finally {
		capturing.value = false
	}
}

async function exportPoster(action) {
	busy.value = true
	pendingAction.value = action
	uni.showLoading({ title: t('poster_preparing'), mask: true })
	await nextTick()
	await sleep(180)
	let path = ''
	// #ifdef H5
	try {
		path = await composeSharePoster({
			bgSrc: paintBgSrc.value || bgSrc.value,
			text: cardText.value,
			cite: citeLine.value,
			showWatermark: showWatermark.value,
			brand: brandName.value,
		})
	} catch (e) {}
	// #endif
	const inst = painterInst()
	if (!path && inst) {
		const types = []
		// #ifdef APP-PLUS
		types.push('local')
		// #endif
		// #ifndef APP-PLUS
		types.push('url')
		// #endif
		for (let i = 0; i < types.length; i++) {
			try {
				path = await painterToPath(inst, types[i])
				if (path) break
			} catch (e) {}
		}
	}
	if (!path) {
		try { uni.hideLoading() } catch (e) {}
		try {
			path = await captureVisiblePoster()
		} catch (e) {}
	}
	handleExport(path)
}

function handleExport(path) {
	const action = pendingAction.value
	pendingAction.value = ''
	busy.value = false
	try { uni.hideLoading() } catch (e) {}
	if (!path) {
		uni.showToast({ title: action === 'save' || action === 'wallpaper' ? t('save_failed') : t('share_failed'), icon: 'none' })
		if (action === 'save') fb('share_save_image_result', { share_result: false })
		else if (action === 'wallpaper') fb('wallpaper_set_result', { share_result: false })
		else if (action === 'share') fb('share_dispatch_result', { share_result: false })
		return
	}
	if (action === 'wallpaper') {
		fb('share_setAsWallpaper_permission_result', {
			wallpaper_id: contentId.value || '',
			permission_result: true,
		})
		setSystemWallpaper(path, { t }).then(() => {
			fb('wallpaper_set_result', { share_result: true })
		}).catch(() => {
			fb('wallpaper_set_result', { share_result: false })
			uni.showToast({ title: t('wp_set_failed'), icon: 'none' })
		})
		return
	}
	if (action === 'save') {
		Promise.resolve(saveImageToAlbum(path)).then((ok) => {
			fb('share_save_image_result', { share_result: ok === true })
		}).catch(() => {
			fb('share_save_image_result', { share_result: false })
		})
		return
	}
	if (action === 'share') {
		systemShare({
			title: shareQuoteText() || brandName.value || 'Selah',
			summary: shareQuoteText(),
			href: shareHref(),
			imageUrl: path,
			onResult: (ok) => fb('share_dispatch_result', { share_result: !!ok }),
			onSuccess: () => {
				const cid = contentId.value
				if (cid) apiShareSuccess(cid).catch(() => {})
			},
		})
	}
}

function goVip() {
	navigateVip('watermark', { lockContentId: contentId.value || '' })
}

async function onSetWallpaper() {
	if (busy.value) return
	fb('share_setAsWallpaper_click', { wallpaper_id: contentId.value || '' })
	await exportPoster('wallpaper')
}

async function onToggleDislike() {
	fb('share_dislike_click')
	if (!contentId.value || dislikeBusy.value) return
	dislikeBusy.value = true
	const next = !disliked.value
	disliked.value = next
	try {
		const res = await apiDislike(contentId.value, next, {
			target_type: mode.value === 'affirmation' ? 'affirmation' : 'quote',
		})
		const serverDisliked = readDislikedField(res?.results) ?? readDislikedField(res)
		disliked.value = serverDisliked != null ? serverDisliked : next
		recordDislikeStatus(contentId.value, disliked.value)
	} catch (e) {
		disliked.value = !next
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	} finally {
		dislikeBusy.value = false
	}
}

function onReport() {
	if (!contentId.value) return
	fb('share_report_click')
	if (!reportSheetItems.value.length) {
		reportSheetItems.value = ['inappropriate', 'hate', 'spam', 'copyright', 'other'].map((value) => ({
			code: value,
			label: t(REPORT_I18N[value] || 'report_other'),
		}))
	}
	reportSheetOpen.value = true
}

async function onReportSelect({ value }) {
	if (!contentId.value) return
	const reason = value || 'other'
	fb('share_report_quote_click', { report_quote: reason })
	try {
		await apiReport(contentId.value, reason)
		uni.showToast({ title: t('reported'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
	}
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.share {
	height: 100vh;
	height: 100dvh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	background: #f5f5f5;
	box-sizing: border-box;
}
.poster-scroll {
	flex: 1;
	height: 0;
	width: 100%;
	box-sizing: border-box;
	min-height: 0;
}
.actions {
	flex-shrink: 0;
	width: 100%;
	background: #f5f5f5;
	padding-bottom: env(safe-area-inset-bottom);
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
	min-height: 908rpx;
	height: auto;
	margin: 16rpx auto 0;
	border-radius: 48rpx;
	box-sizing: border-box;
	overflow: hidden;
	position: relative;
	display: flex;
	flex-direction: column;
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
.poster-veil {
	position: absolute;
	inset: 0;
	z-index: 1;
	background: rgba(0, 0, 0, 0.4);
	pointer-events: none;
}
.poster-copy {
	position: relative;
	z-index: 2;
	flex: 1;
	min-height: 720rpx;
	padding: 80rpx 40rpx 24rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}
.body {
	width: 100%;
	font-family: $selah-font-display;
	font-size: 40rpx;
	line-height: 1.4;
	text-align: center;
	font-weight: 700;
	color: #ffffff;
}
.cite {
	margin-top: 16rpx;
	font-family: $selah-font-display;
	font-size: 24rpx;
	font-weight: 700;
	color: #ffffff;
	text-align: center;
}
.wm-pill {
	position: relative;
	z-index: 2;
	display: flex;
	flex-direction: row;
	align-items: center;
	align-self: center;
	margin: 16rpx auto 40rpx;
	padding: 10rpx 16rpx;
	border-radius: 16rpx;
	background: rgba(255, 255, 255, 0.45);
	box-shadow: 0 0 20rpx rgba(0, 0, 0, 0.05);
}
.wm-logo-mark {
	position: relative;
	width: 32rpx;
	height: 32rpx;
	border-radius: 8rpx;
	margin-right: 8rpx;
	background: #9c7a52;
	flex-shrink: 0;
	overflow: hidden;
}
.wm-logo-letter-wrap {
	position: absolute;
	left: 0;
	right: 0;
	top: 50%;
	height: 18rpx;
	transform: translateY(-50%);
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
}
.wm-logo-letter {
	font-family: $selah-font-display;
	font-size: 18rpx;
	line-height: 18rpx;
	height: 18rpx;
	font-weight: 700;
	color: #ffffff;
	text-align: center;
}
.wm-text {
	font-size: 22rpx;
	line-height: 32rpx;
	height: 32rpx;
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
.theme-sheet-root {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 80;
}
.theme-sheet-mask {
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	background: rgba(25, 25, 25, 0.45);
}
.theme-sheet-panel {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 88vh;
	border-radius: 32rpx 32rpx 0 0;
	overflow: hidden;
	background: #f5f5f5;
}
.theme-sheet-scroll {
	height: 100%;
}
.theme-thumb {
	width: 100%;
	height: 100%;
}
.wall {
	width: 100%;
	margin-top: 24rpx;
	/* 锁死竖向，只走横向 scroll-view */
	overflow: hidden;
	white-space: nowrap;
	box-sizing: border-box;
}
.wall-row {
	display: flex;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: flex-start;
	padding: 0 64rpx;
	box-sizing: border-box;
}
.wall-second {
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
	padding: 20rpx 64rpx 24rpx;
	box-sizing: border-box;
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
.act-btn.on {
	background: $selah-ink;
	border-color: $selah-ink;
	color: #fff;
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
.act-btn.on .act-glyph {
	color: #fbf8f2;
}
.act-label {
	font-size: 22rpx;
	color: $selah-ink;
	text-align: center;
	line-height: 1.25;
	width: 112rpx;
}
</style>
