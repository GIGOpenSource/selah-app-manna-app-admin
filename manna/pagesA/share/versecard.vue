<template>
	<!-- 经文卡：先选主题点对勾确认，再下载/转发；水印同首页分享、位置更低 -->
	<view class="vc" :class="{ 'vc--capturing': capturing, 'vc--done': confirmed }">
		<image class="vc__bg" :src="bgSrc" mode="aspectFill" />
		<view class="vc__scrim" />

		<!-- 离屏合成：下载 / 转发（含水印） -->
		<l-painter
			ref="painter"
			:key="paintKey"
			:width="posterLayout.width + 'rpx'"
			:height="posterLayout.height + 'rpx'"
			path-type="url"
			:hidden="true"
			:pixel-ratio="2"
			:useCORS="true"
		>
			<l-painter-view :css="posterRootCss">
				<l-painter-image
					:src="bgSrc"
					:css="posterFillCss + ' object-fit: cover;'"
				/>
				<l-painter-view
					:css="posterFillCss + ' background: linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.06) 42%, rgba(0,0,0,0.28) 100%);'"
				/>
				<l-painter-view :css="posterTextWrapCss">
					<l-painter-text
						:text="verseLine"
						:css="posterVerseCss"
					/>
					<l-painter-text
						v-if="refLine"
						:text="refLine"
						:css="posterRefCss"
					/>
					<l-painter-text
						v-if="isBadge"
						:text="brandLine"
						:css="posterBrandCss"
					/>
				</l-painter-view>
				<l-painter-view :css="posterWmCss">
					<l-painter-view :css="posterWmLineCss" />
					<l-painter-text :text="posterWmText" :css="posterWmTextCss" />
					<l-painter-view :css="posterWmLineCss" />
				</l-painter-view>
			</l-painter-view>
		</l-painter>

		<view v-show="!capturing" class="vc__top" :style="{ paddingTop: (statusBar + 8) + 'px' }">
			<view class="vc__round" hover-class="vc__round--press" @click="back">
				<image class="vc__round-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
			</view>
			<view
				v-if="!confirmed"
				class="vc__round"
				:class="{ 'vc__round--busy': confirmBusy }"
				hover-class="vc__round--press"
				@click="onConfirm"
			>
				<image class="vc__round-ico" src="/static/ui/share/ico-check.svg" mode="aspectFit" />
			</view>
			<view v-else class="vc__top-right">
				<view class="vc__round" hover-class="vc__round--press" @click="onShare">
					<image class="vc__round-ico" src="/static/ui/share/ico-share-via.svg" mode="aspectFit" />
				</view>
				<view class="vc__round" hover-class="vc__round--press" @click="onSave">
					<image class="vc__round-ico" src="/static/ui/share/ico-save.svg" mode="aspectFit" />
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="vc__body" :show-scrollbar="false">
			<view class="vc__copy">
				<text class="vc__verse">{{ verseLine }}</text>
				<text v-if="refLine" class="vc__ref">{{ refLine }}</text>
				<text v-if="isBadge" class="vc__brand">{{ brandLine }}</text>
			</view>
		</scroll-view>

		<!-- 确认后显示水印（截图/预览）；下载转发走 painter 也带水印 -->
		<view v-if="confirmed" class="vc__wm" aria-hidden="true">
			<view class="vc__wm-line" />
			<text class="vc__wm-txt">{{ posterWmText }}</text>
			<view class="vc__wm-line" />
		</view>

		<view v-show="!capturing && !confirmed" class="vc__sheet">
			<view class="vc__handle" />
			<scroll-view scroll-x class="vc__themes" :show-scrollbar="false">
				<view
					v-for="th in themes"
					:key="th.id"
					class="vc__theme"
					:class="{ 'vc__theme--on': themeId === th.id }"
					@click="pickTheme(th.id)"
				>
					<image class="vc__theme-img" :src="th.bg" mode="aspectFill" />
				</view>
			</scroll-view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaSharePayload, apiMannaFavoriteToggle, apiMannaVerseCardSave } from '@/api/manna.js'
import { systemShare, saveImageToAlbum, captureWebviewImage } from '@/utils/share.js'
import LPainter from 'lime-painter/components/l-painter/l-painter.vue'
import LPainterView from 'lime-painter/components/l-painter-view/l-painter-view.vue'
import LPainterImage from 'lime-painter/components/l-painter-image/l-painter-image.vue'
import LPainterText from 'lime-painter/components/l-painter-text/l-painter-text.vue'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { SHARE_THEME_KEY } from '@/utils/wallpaperCache.js'
import { decodeAssetPath, isHomePoolBg } from '@/utils/homeBg.js'
import { absolutizeMedia } from '@/utils/media.js'

const PAYLOAD_KEY = 'manna_versecard_payload'

/** 接口未返回 themes 时的本地兜底 */
const FALLBACK_THEMES = [
	{ id: 'field', bg: '/static/ui/share/bg-field.png' },
	{ id: 'path', bg: '/static/ui/share/bg-path.png' },
	{ id: 'beach', bg: '/static/ui/share/bg-beach.png' },
	{ id: 'heart', bg: '/static/ui/share/bg-heart.png' },
	{ id: 'embrace', bg: '/static/ui/share/bg-embrace.png' },
	{ id: 'home', bg: '/static/ui/home/bg-279-364.png' },
]

const themes = ref(FALLBACK_THEMES.map((th) => ({ ...th })))

const statusBar = getStatusBarPx()
const painter = ref(null)
const text = ref('')
const reference = ref('')
const brand = ref('MANNA')
const shareLine = ref('')
const kind = ref('')
const themeId = ref('embrace')
const busy = ref(false)
const confirmBusy = ref(false)
const pendingAction = ref('') // 'save' | 'share'
const capturing = ref(false)
const confirmed = ref(false)

/**
 * 后端专属「经文卡保存」就绪后改为 true。
 * false 时点对勾走收藏接口占位，仍会 toast。
 */
const VERSECARD_SAVE_API_READY = false

const isBadge = computed(() => kind.value === 'badge')
const brandLine = computed(() => 'MANNA')

const bgSrc = computed(() => {
	const list = themes.value
	const hit = list.find((th) => th.id === themeId.value)
	return hit?.bg || list[0]?.bg || FALLBACK_THEMES[0].bg
})

const verseLine = computed(() => text.value || (isBadge.value ? '' : t('home_verse_placeholder')))
const refLine = computed(() => reference.value || (isBadge.value ? '' : t('home_ref_placeholder')))

const POSTER_W = 750
const POSTER_MIN_H = 1334
const POSTER_TEXT_W = 670
const POSTER_PAD_TOP = 180
const POSTER_PAD_BOTTOM = 200
const VERSE_SIZE = 48
const VERSE_LH = 80
const REF_SIZE = 40
const REF_LH = 56
const BRAND_SIZE = 28
const BRAND_LH = 40
const REF_GAP = 48
const BRAND_GAP = 32

/** 与首页分享水印同款；字号更小、更靠底 */
function spaceShareWm(raw) {
	const s = String(raw || '').trim()
	if (!s) return ''
	return ` ${Array.from(s).map((ch) => (ch === ' ' ? '  ' : ch)).join('  ')} `
}
const posterWmText = computed(() => spaceShareWm(t('home_share_wm')))
const POSTER_WM_BOTTOM = 56
const POSTER_WM_SIDE = 40
const POSTER_WM_SIZE = 22
const POSTER_WM_LH = 32
const POSTER_WM_LINE_W = 36
const POSTER_WM_GAP = 24

function countPosterLines(text, charsPerLine) {
	const src = String(text || '')
	if (!src) return 0
	let lines = 0
	src.split(/\r?\n/).forEach((para) => {
		const chars = Array.from(para)
		if (!chars.length) {
			lines += 1
			return
		}
		let w = 0
		let n = 1
		chars.forEach((ch) => {
			const cw = /[\u0000-\u00ff]/.test(ch) ? 0.55 : 1
			w += cw
			if (w > charsPerLine) {
				n += 1
				w = cw
			}
		})
		lines += n
	})
	return Math.max(1, lines)
}

const posterLayout = computed(() => {
	const verse = verseLine.value
	const ref = refLine.value
	const brand = isBadge.value ? brandLine.value : ''
	const versePerLine = Math.max(8, Math.floor(POSTER_TEXT_W / (VERSE_SIZE * 1.2)))
	const refPerLine = Math.max(10, Math.floor(POSTER_TEXT_W / (REF_SIZE * 1.2)))
	const verseLines = countPosterLines(verse, versePerLine)
	const refLines = ref ? countPosterLines(ref, refPerLine) : 0
	const verseH = verseLines * VERSE_LH
	const refH = refLines * REF_LH
	const brandH = brand ? BRAND_LH : 0
	const gaps = (ref ? REF_GAP : 0) + (brand ? BRAND_GAP : 0)
	const block = verseH + gaps + refH + brandH
	const height = Math.max(POSTER_MIN_H, POSTER_PAD_TOP + block + POSTER_PAD_BOTTOM)
	const textTop = height <= POSTER_MIN_H
		? Math.max(POSTER_PAD_TOP, Math.round((height - block) / 2))
		: POSTER_PAD_TOP
	return { width: POSTER_W, height, textTop }
})

const posterRootCss = computed(() =>
	`width: ${posterLayout.value.width}rpx; height: ${posterLayout.value.height}rpx; position: relative; background: #0a0a0a; overflow: hidden;`,
)
const posterFillCss = computed(() =>
	`position: absolute; left: 0; top: 0; width: ${posterLayout.value.width}rpx; height: ${posterLayout.value.height}rpx;`,
)
const posterTextWrapCss = computed(() =>
	`position: absolute; left: 40rpx; top: ${posterLayout.value.textTop}rpx; width: ${POSTER_TEXT_W}rpx; display: flex; flex-direction: column; align-items: center;`,
)
const posterVerseCss = computed(() =>
	`width: ${POSTER_TEXT_W}rpx; font-size: ${VERSE_SIZE}rpx; font-weight: 700; color: #ffffff; line-height: ${VERSE_LH}rpx; letter-spacing: 0.48rpx; text-align: center; white-space: pre-wrap;`,
)
const posterRefCss = computed(() =>
	`margin-top: ${REF_GAP}rpx; width: ${POSTER_TEXT_W}rpx; font-size: ${REF_SIZE}rpx; color: rgba(255,255,255,0.7); line-height: ${REF_LH}rpx; letter-spacing: 0.4rpx; text-align: center;`,
)
const posterBrandCss = computed(() =>
	`margin-top: ${BRAND_GAP}rpx; width: ${POSTER_TEXT_W}rpx; font-size: ${BRAND_SIZE}rpx; font-weight: 700; color: rgba(255,255,255,0.85); line-height: ${BRAND_LH}rpx; letter-spacing: 4rpx; text-align: center;`,
)
const posterWmCss = computed(() =>
	`position: absolute; left: ${POSTER_WM_SIDE}rpx; bottom: ${POSTER_WM_BOTTOM}rpx; width: ${POSTER_W - POSTER_WM_SIDE * 2}rpx; height: ${POSTER_WM_LH}rpx; display: flex; flex-direction: row; align-items: center; justify-content: center;`,
)
const posterWmLineCss =
	`width: ${POSTER_WM_LINE_W}rpx; height: 2rpx; background: rgba(255,255,255,0.55); flex-shrink: 0;`
const posterWmTextCss =
	`margin: 0 ${POSTER_WM_GAP}rpx; font-size: ${POSTER_WM_SIZE}rpx; font-weight: 400; color: rgba(255,255,255,0.72); line-height: ${POSTER_WM_LH}rpx; text-align: center; flex-shrink: 0;`

const paintKey = computed(() =>
	`${kind.value}|${themeId.value}|${verseLine.value}|${refLine.value}|${brandLine.value}|${posterWmText.value}|${posterLayout.value.height}|wm1`,
)

function safeDecode(v) {
	if (v == null || v === '') return ''
	try {
		return decodeURIComponent(String(v))
	} catch (e) {
		return String(v)
	}
}

function themeBg(url) {
	const raw = decodeAssetPath(url)
	return absolutizeMedia(raw) || raw
}

function mapApiThemes(list) {
	if (!Array.isArray(list) || !list.length) return []
	return list
		.map((row, i) => {
			const id = String(row?.key || row?.id || '').trim()
			const bg = themeBg(row?.image_url || row?.bg || '')
			if (!id || !bg) return null
			return {
				id,
				bg,
				isDefault: !!row.is_default,
				sortOrder: Number(row.sort_order) || (i + 1) * 10,
			}
		})
		.filter(Boolean)
		.sort((a, b) => a.sortOrder - b.sortOrder)
}

function applyApiThemes(d) {
	const mapped = mapApiThemes(d?.themes)
	if (!mapped.length) return
	const session = themes.value.find((th) => th.id === 'session')
	const keepSession = session && !mapped.some((th) => th.id === session.id || th.bg === session.bg)
	themes.value = keepSession ? [session, ...mapped] : mapped
	const saved = (() => {
		try { return String(uni.getStorageSync(SHARE_THEME_KEY) || '').trim() } catch (e) { return '' }
	})()
	const apiKey = String(d?.theme_key || '').trim()
	const defKey = themes.value.find((th) => th.isDefault)?.id || ''
	const sessionOn = themeId.value === 'session' && themes.value.some((th) => th.id === 'session')
	const pick = [sessionOn ? 'session' : '', saved, apiKey, defKey, themes.value[0]?.id]
		.find((id) => id && themes.value.some((th) => th.id === id))
	if (pick) themeId.value = pick
}

function applyPayload(d) {
	if (!d || typeof d !== 'object') return
	if (d.text || d.raw_text) text.value = d.text || d.raw_text || text.value
	if (d.ref || d.reference) reference.value = d.ref || d.reference || reference.value
	if (d.brand) brand.value = d.brand
	if (d.kind) kind.value = String(d.kind)
	if (d.shareLine || d.share_text) shareLine.value = d.shareLine || d.share_text
	applyApiThemes(d)
	if (d.bg) {
		const bg = themeBg(d.bg)
		if (bg && !isHomePoolBg(bg)) {
			const exists = themes.value.find((th) => th.id === 'session')
			if (exists) exists.bg = bg
			else themes.value = [{ id: 'session', bg }, ...themes.value]
			themeId.value = 'session'
		}
	}
}

onLoad((q) => {
	confirmed.value = q.confirm?true:false
	try {
		const stored = uni.getStorageSync(PAYLOAD_KEY)
		if (stored && typeof stored === 'object') applyPayload(stored)
	} catch (e) {}
	const qt = safeDecode(q?.text)
	const qr = safeDecode(q?.ref)
	if (qt) text.value = qt
	if (qr) reference.value = qr
	if (String(q?.kind || '') === 'badge') kind.value = 'badge'
	try {
		const savedTheme = uni.getStorageSync(SHARE_THEME_KEY)
		if (savedTheme && themes.value.some((th) => th.id === savedTheme)) themeId.value = savedTheme
	} catch (e) {}
})

async function load() {
	const badge = kind.value === 'badge'
	try {
		const res = await apiMannaSharePayload({
			scene: badge ? 'badge' : 'daily_verse',
			text: text.value,
			ref: reference.value,
		})
		const d = res?.results || {}
		applyApiThemes(d)
		if (badge) {
			brand.value = 'MANNA'
			if (!text.value && d.raw_text) text.value = d.raw_text
			if (!reference.value && d.reference) reference.value = d.reference
			shareLine.value = d.text || [text.value, reference.value, 'MANNA'].filter(Boolean).join(' · ')
			uni.setStorageSync(PAYLOAD_KEY, {
				kind: 'badge',
				text: text.value,
				ref: reference.value,
				brand: 'MANNA',
				shareLine: shareLine.value,
				themes: d.themes || [],
				theme_key: d.theme_key || themeId.value,
			})
			return
		}
		if (d.raw_text) text.value = d.raw_text
		if (d.reference) reference.value = d.reference
		brand.value = d.brand || brand.value
		shareLine.value = d.text || `${text.value} — ${reference.value}`
		uni.setStorageSync(PAYLOAD_KEY, {
			text: text.value,
			ref: reference.value,
			brand: brand.value,
			shareLine: shareLine.value,
			themes: d.themes || [],
			theme_key: d.theme_key || themeId.value,
		})
	} catch (e) {
		if (!shareLine.value) {
			shareLine.value = badge
				? [text.value, reference.value, 'MANNA'].filter(Boolean).join(' · ')
				: [text.value, reference.value].filter(Boolean).join(' — ')
		}
	}
}

function pickTheme(id) {
	if (confirmed.value) return
	themeId.value = id
	try { uni.setStorageSync(SHARE_THEME_KEY, id) } catch (e) {}
}

function onConfirm() {
	confirmCard()
}

function verseCardKey() {
	return `${reference.value || ''}|${text.value || ''}`.slice(0, 255)
}

function persistLocalCover() {
	try {
		const key = verseCardKey()
		if (!key) return
		const covers = uni.getStorageSync('manna_verse_card_covers') || {}
		covers[key] = bgSrc.value
		uni.setStorageSync('manna_verse_card_covers', covers)
	} catch (e) {}
}

async function confirmCard() {
	if (confirmBusy.value || confirmed.value) return
	confirmBusy.value = true
	const payload = {
		text: text.value,
		ref: reference.value,
		theme_key: themeId.value,
		bg: bgSrc.value,
		brand: brand.value || 'MANNA',
		kind: kind.value || 'verse',
	}
	try {
		if (VERSECARD_SAVE_API_READY) {
			await apiMannaVerseCardSave(payload)
		} else {
			// 专属保存接口未就绪：先用收藏占位，后端好了改 VERSECARD_SAVE_API_READY
			await apiMannaFavoriteToggle({
				target_type: 'verse_card',
				target_key: verseCardKey(),
			})
		}
		persistLocalCover()
		confirmed.value = true
		uni.showToast({ title: t('versecard_saved'), icon: 'none' })
		track('manna_versecard_save', { theme: themeId.value, ready: VERSECARD_SAVE_API_READY })
	} catch (e) {
		uni.showToast({ title: e?.message || t('versecard_save_failed'), icon: 'none' })
	} finally {
		confirmBusy.value = false
	}
}

function summary() {
	return shareLine.value || [text.value, reference.value].filter(Boolean).join(' — ')
}

async function onSave() {
	if (busy.value || !confirmed.value) return
	track(isBadge.value ? 'badge_share' : 'manna_versecard_share', { channel: 'save' })
	await exportPoster('save')
}

async function onShare() {
	if (busy.value || !confirmed.value) return
	track(isBadge.value ? 'badge_share' : 'manna_versecard_share', { channel: 'system' })
	await exportPoster('share')
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
		const timer = setTimeout(() => reject(new Error('timeout')), 2500)
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
	const inst = painterInst()
	if (inst) {
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
		uni.showToast({ title: action === 'save' ? t('save_failed') : t('share_failed'), icon: 'none' })
		return
	}
	if (action === 'save') {
		saveImageToAlbum(path)
		return
	}
	if (action === 'share') {
		systemShare({
			title: isBadge.value ? 'MANNA' : (brand.value || 'Manna'),
			summary: summary(),
			imageUrl: path,
		})
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/home' }) })
}

onMounted(load)
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.vc {
	position: relative;
	height: 100vh;
	height: 100dvh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	background: #0a0a0a;
	box-sizing: border-box;
}

.vc__bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
}

.vc__scrim {
	position: absolute;
	inset: 0;
	z-index: 1;
	background:
		linear-gradient(180deg, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0.08) 40%, rgba(0, 0, 0, 0.2) 100%);
	pointer-events: none;
}

.vc__top {
	position: relative;
	z-index: 3;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
	padding-left: 32rpx;
	padding-right: 32rpx;
	padding-bottom: 8rpx;
	box-sizing: content-box;
}

.vc__top-right {
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.vc__round {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.vc__round--press {
	opacity: 0.72;
}

.vc__round--busy {
	opacity: 0.45;
	pointer-events: none;
}

.vc__round-ico {
	width: 64rpx;
	height: 64rpx;
}

.vc__body {
	position: relative;
	z-index: 2;
	flex: 1;
	height: 0;
	width: 100%;
	min-height: 0;
	box-sizing: border-box;
}

.vc--capturing .vc__copy {
	padding-top: 120rpx;
	padding-bottom: 160rpx;
}

.vc__copy {
	min-height: 100%;
	padding: 32rpx 40rpx 24rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.vc__verse {
	width: 100%;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 48rpx;
	line-height: 80rpx;
	letter-spacing: 0.01em;
	color: #ffffff;
	text-align: center;
	white-space: pre-wrap;
}

.vc__ref {
	width: 100%;
	margin-top: 48rpx;
	font-family: $manna-font-body;
	font-weight: 400;
	font-size: 40rpx;
	line-height: 56rpx;
	color: rgba(255, 255, 255, 0.7);
	text-align: center;
	letter-spacing: 0.01em;
}

.vc__brand {
	width: 100%;
	margin-top: 32rpx;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 28rpx;
	line-height: 40rpx;
	letter-spacing: 0.28em;
	color: rgba(255, 255, 255, 0.85);
	text-align: center;
}

.vc__wm {
	position: absolute;
	left: 40rpx;
	right: 40rpx;
	bottom: calc(28rpx + env(safe-area-inset-bottom, 0px));
	z-index: 2;
	height: 32rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	pointer-events: none;
}

.vc__wm-line {
	width: 36rpx;
	height: 2rpx;
	background: rgba(255, 255, 255, 0.55);
	flex-shrink: 0;
}

.vc__wm-txt {
	margin: 0 24rpx;
	font-family: $manna-font-body;
	font-size: 22rpx;
	font-weight: 400;
	color: rgba(255, 255, 255, 0.72);
	line-height: 32rpx;
	text-align: center;
	flex-shrink: 0;
	white-space: pre;
}

.vc__sheet {
	position: relative;
	z-index: 3;
	flex-shrink: 0;
	width: 100%;
	background: #ffffff;
	border: 1rpx solid rgba(33, 33, 33, 0.1);
	border-radius: 40rpx 40rpx 0 0;
	padding: 20rpx 0 calc(32rpx + env(safe-area-inset-bottom));
	display: flex;
	flex-direction: column;
	align-items: center;
	box-sizing: border-box;
}

.vc__handle {
	width: 96rpx;
	height: 12rpx;
	border-radius: 20rpx;
	background: rgba(33, 33, 33, 0.1);
	margin-bottom: 28rpx;
}

.vc__themes {
	width: 100%;
	white-space: nowrap;
	padding: 16rpx 40rpx;
	box-sizing: border-box;
}

.vc__theme {
	display: inline-block;
	width: 144rpx;
	height: 144rpx;
	border-radius: 24rpx;
	overflow: hidden;
	margin-right: 24rpx;
	border: 4rpx solid transparent;
	vertical-align: top;
	box-sizing: border-box;
}

.vc__theme--on {
	border-color: $manna-tag-on;
}

.vc__theme-img {
	width: 100%;
	height: 100%;
}
</style>
