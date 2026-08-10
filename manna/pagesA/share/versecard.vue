<template>
	<!-- Figma versecard 413:3082：全幅壁纸 + 白字经文 + 底栏仅主题条；顶栏主题/保存/关闭 -->
	<view class="vc">
		<image class="vc__bg" :src="bgSrc" mode="aspectFill" />
		<view class="vc__scrim" />

		<!-- 离屏合成：全幅照片海报（分享 / 保存共用） -->
		<l-painter
			ref="painter"
			:key="paintKey"
			path-type="url"
			:hidden="true"
			@success="onPainted"
			@fail="onPaintFail"
		>
			<l-painter-view css="width: 750rpx; height: 1334rpx; position: relative; background: #0a0a0a; overflow: hidden;">
				<l-painter-image
					:src="bgSrc"
					css="position: absolute; left: 0; top: 0; width: 750rpx; height: 1334rpx; object-fit: cover;"
				/>
				<l-painter-view
					css="position: absolute; left: 0; top: 0; width: 750rpx; height: 1334rpx; background: linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.06) 42%, rgba(0,0,0,0.28) 100%);"
				/>
				<l-painter-view
					css="position: absolute; left: 40rpx; top: 400rpx; width: 670rpx; display: flex; flex-direction: column; align-items: center;"
				>
					<l-painter-text
						:text="verseLine"
						css="width: 670rpx; font-size: 48rpx; font-weight: 700; color: #ffffff; line-height: 80rpx; letter-spacing: 0.48rpx; text-align: center;"
					/>
					<l-painter-text
						:text="refLine"
						css="margin-top: 48rpx; width: 670rpx; font-size: 40rpx; color: rgba(255,255,255,0.7); letter-spacing: 0.4rpx; text-align: center;"
					/>
				</l-painter-view>
			</l-painter-view>
		</l-painter>

		<view class="vc__top" :style="{ paddingTop: statusBar + 'px' }">
			<view class="vc__top-left">
				<view class="vc__ico-btn" hover-class="vc__ico-btn--press" @click="cycleTheme">
					<image class="vc__ico" src="/static/ui/share/ico-edit-theme.svg" mode="aspectFit" />
				</view>
				<view class="vc__ico-btn" hover-class="vc__ico-btn--press" @click="onSave">
					<image class="vc__ico" src="/static/ui/share/ico-save.svg" mode="aspectFit" />
				</view>
				<view class="vc__ico-btn" hover-class="vc__ico-btn--press" @click="onShare">
					<image class="vc__ico" src="/static/ui/share/ico-share-via.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="vc__ico-btn" hover-class="vc__ico-btn--press" @click="back">
				<image class="vc__ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
			</view>
		</view>

		<view class="vc__body">
			<text class="vc__verse">{{ verseLine }}</text>
			<text class="vc__ref">{{ refLine }}</text>
		</view>

		<view class="vc__sheet">
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
import { apiMannaSharePayload } from '@/api/manna.js'
import { systemShare, saveImageToAlbum } from '@/utils/share.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { SHARE_THEME_KEY } from '@/utils/wallpaperCache.js'

const PAYLOAD_KEY = 'manna_versecard_payload'

/** Figma 413:3211 主题条 */
const themes = [
	{ id: 'field', bg: '/static/ui/share/bg-field.png' },
	{ id: 'path', bg: '/static/ui/share/bg-path.png' },
	{ id: 'beach', bg: '/static/ui/share/bg-beach.png' },
	{ id: 'heart', bg: '/static/ui/share/bg-heart.png' },
	{ id: 'embrace', bg: '/static/ui/share/bg-embrace.png' },
	{ id: 'home', bg: '/static/ui/home/bg-279-364.png' },
]

const statusBar = getStatusBarPx()
const painter = ref(null)
const text = ref('')
const reference = ref('')
const brand = ref('MANNA')
const shareLine = ref('')
const themeId = ref('embrace')
const busy = ref(false)
const pendingAction = ref('') // 'save' | 'share'

const bgSrc = computed(() => {
	const hit = themes.find((th) => th.id === themeId.value)
	return hit?.bg || themes[0].bg
})

const verseLine = computed(() => text.value || t('home_verse_placeholder'))
const refLine = computed(() => reference.value || t('home_ref_placeholder'))

const paintKey = computed(() => `${themeId.value}|${verseLine.value}|${refLine.value}`)

function safeDecode(v) {
	if (v == null || v === '') return ''
	try {
		return decodeURIComponent(String(v))
	} catch (e) {
		return String(v)
	}
}

function applyPayload(d) {
	if (!d || typeof d !== 'object') return
	if (d.text || d.raw_text) text.value = d.text || d.raw_text || text.value
	if (d.ref || d.reference) reference.value = d.ref || d.reference || reference.value
	if (d.brand) brand.value = d.brand
	if (d.shareLine || d.share_text) shareLine.value = d.shareLine || d.share_text
}

onLoad((q) => {
	try {
		const stored = uni.getStorageSync(PAYLOAD_KEY)
		if (stored && typeof stored === 'object') applyPayload(stored)
	} catch (e) {}
	const qt = safeDecode(q?.text)
	const qr = safeDecode(q?.ref)
	if (qt) text.value = qt
	if (qr) reference.value = qr
	try {
		const savedTheme = uni.getStorageSync(SHARE_THEME_KEY)
		if (savedTheme && themes.some((th) => th.id === savedTheme)) themeId.value = savedTheme
	} catch (e) {}
})

async function load() {
	try {
		const res = await apiMannaSharePayload({
			scene: 'daily_verse',
			text: text.value,
			ref: reference.value,
		})
		const d = res?.results || {}
		if (d.raw_text) text.value = d.raw_text
		if (d.reference) reference.value = d.reference
		brand.value = d.brand || brand.value
		shareLine.value = d.text || `${text.value} — ${reference.value}`
		uni.setStorageSync(PAYLOAD_KEY, {
			text: text.value,
			ref: reference.value,
			brand: brand.value,
			shareLine: shareLine.value,
		})
	} catch (e) {
		if (!shareLine.value) {
			shareLine.value = [text.value, reference.value].filter(Boolean).join(' — ')
		}
	}
}

function pickTheme(id) {
	themeId.value = id
	try { uni.setStorageSync(SHARE_THEME_KEY, id) } catch (e) {}
}

function cycleTheme() {
	const i = themes.findIndex((th) => th.id === themeId.value)
	const next = themes[(i + 1 + themes.length) % themes.length]
	pickTheme(next.id)
}

function summary() {
	return shareLine.value || [text.value, reference.value].filter(Boolean).join(' — ')
}

async function onSave() {
	if (busy.value) return
	track('manna_versecard_share', { channel: 'save' })
	await exportPoster('save')
}

async function onShare() {
	if (busy.value) return
	track('manna_versecard_share', { channel: 'system' })
	await exportPoster('share')
}

async function exportPoster(action) {
	busy.value = true
	pendingAction.value = action
	uni.showLoading({ title: t('poster_preparing'), mask: true })
	await nextTick()
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
	busy.value = false
	try { uni.hideLoading() } catch (e) {}
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
			title: brand.value || 'Manna',
			summary: summary(),
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
	busy.value = false
	try { uni.hideLoading() } catch (e) {}
	uni.showToast({ title: t('share_failed'), icon: 'none' })
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
	min-height: 100vh;
	overflow: hidden;
	background: #0a0a0a;
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
	display: flex;
	align-items: center;
	justify-content: space-between;
	/* Figma 417:3264：h58 · px20 */
	height: 116rpx;
	padding: 0 40rpx;
	box-sizing: border-box;
}

.vc__top-left {
	display: flex;
	align-items: center;
}

.vc__top-left .vc__ico-btn + .vc__ico-btn {
	margin-left: 32rpx;
}

.vc__ico-btn {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.vc__ico-btn--press {
	opacity: 0.7;
}

.vc__ico {
	width: 64rpx;
	height: 64rpx;
	filter: brightness(0) invert(1);
}

.vc__body {
	position: relative;
	z-index: 2;
	/* Figma 414:3230 top≈244 */
	margin-top: 160rpx;
	padding: 0 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
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
}

.vc__ref {
	width: 100%;
	margin-top: 48rpx;
	font-family: $manna-font-body;
	font-weight: 400;
	font-size: 40rpx;
	color: rgba(255, 255, 255, 0.7);
	text-align: center;
	letter-spacing: 0.01em;
}

.vc__sheet {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 3;
	background: #ffffff;
	border: 1rpx solid rgba(33, 33, 33, 0.1);
	border-radius: 40rpx 40rpx 0 0;
	padding: 20rpx 0 calc(32rpx + env(safe-area-inset-bottom));
	display: flex;
	flex-direction: column;
	align-items: center;
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
	/* Figma 72×72 · radius 12 */
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
