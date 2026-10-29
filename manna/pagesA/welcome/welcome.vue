<!--
  冷启 Welcome：文案/背景走 Welcome API。
  接口未返回前只显示 loading，避免本地底图一闪再换成 CMS 图。
-->
<template>
	<view class="welcome">
		<!-- 加载中：纯色底 + loading，不挂本地底图 -->
		<view v-if="booting" class="boot">
			<view class="boot__spin" />
			<text class="boot__txt">{{ t('loading') }}</text>
		</view>

		<template v-else>
			<view class="bg" aria-hidden="true">
				<image
					v-if="heroSrc"
					class="bg-photo"
					:src="heroSrc"
					mode="aspectFill"
				/>
				<view class="bg-fade" />
			</view>

			<view class="copy">
				<text class="title">{{ screen.title || t('brand') }}</text>
				<text v-if="screen.subtitle" class="subtitle">{{ screen.subtitle }}</text>
			</view>

			<view class="footer">
				<view class="cta" @click="continueNext">
					<text class="cta-text">{{ screen.cta_text || t('continue') }}</text>
				</view>
				<view class="legal">
					<text class="legal-plain">{{ t('welcome_legal_prefix') }}</text>
					<text class="legal-link" @click.stop="openLegalPage('terms')">{{ t('legal_terms') }}</text>
					<text class="legal-plain">{{ t('welcome_legal_mid') }}</text>
					<text class="legal-link" @click.stop="openLegalPage('privacy')">{{ t('legal_privacy') }}</text>
				</view>
			</view>
		</template>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiWelcome } from '@/api/content.js'
import { track } from '@/utils/analytics.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { readPageCache, writePageCache } from '@/utils/pageCache.js'
import { WELCOME_CACHE_KEY } from '@/utils/wallpaperCache.js'
import { WELCOME_SEEN_KEY } from '@/utils/coldStart.js'
import { welcomeRevision } from '@/utils/bootstrap.js'
import { ensureLocalAsset } from '@/utils/assetCache.js'
import { absolutizeMedia } from '@/utils/media.js'

/** 仅当接口与缓存都无图时回落（不会在 loading 阶段展示） */
const LOCAL_HERO = '/static/ui/home/bg-279-364.png'

const { t } = useI18n()
/** 接口未完成前为 true，整页 loading */
const booting = ref(true)
const screen = ref({
	title: '',
	subtitle: '',
	cta_text: '',
	image_url: '',
	version: 1,
})

const heroSrc = computed(() => {
	const cms = String(screen.value.image_url || '').trim()
	if (cms) return cms
	return LOCAL_HERO
})

function markSeen() {
	const ver = Number(screen.value.version || 1)
	uni.setStorageSync(WELCOME_SEEN_KEY, ver)
}

function continueNext() {
	markSeen()
	track('welcome_continue', { version: Number(screen.value.version || 1) })
	uni.reLaunch({ url: '/pagesA/login/login' })
}

/** 空 results / 无文案无图 → 视为未配置 */
function normalizeWelcome(data) {
	if (!data || typeof data !== 'object') return null
	const title = String(data.title || '').trim()
	const subtitle = String(data.subtitle || '').trim()
	const cta_text = String(data.cta_text || '').trim()
	const image_url = String(data.image_url || '').trim()
	if (!title && !subtitle && !cta_text && !image_url) return null
	return {
		...data,
		title,
		subtitle,
		cta_text,
		image_url,
		version: Number(data.version || 1),
	}
}

async function resolveImageUrl(raw) {
	let imageUrl = String(raw || '').trim()
	if (!imageUrl) return ''
	if (imageUrl.startsWith('/static/')) return imageUrl
	imageUrl = absolutizeMedia(imageUrl)
	try {
		imageUrl = await ensureLocalAsset(imageUrl)
	} catch (e) {}
	return imageUrl || ''
}

/** 等底图可解码再揭幕，避免 loading 结束后再闪一次空白/旧图 */
function waitImageReady(src, timeoutMs = 3500) {
	const url = String(src || '').trim()
	if (!url) return Promise.resolve()
	return new Promise((resolve) => {
		let done = false
		const finish = () => {
			if (done) return
			done = true
			clearTimeout(timer)
			resolve()
		}
		const timer = setTimeout(finish, timeoutMs)
		try {
			uni.getImageInfo({
				src: url,
				success: finish,
				fail: finish,
			})
		} catch (e) {
			finish()
		}
	})
}

async function applyWelcome(data) {
	const row = normalizeWelcome(data)
	if (!row) return false
	const imageUrl = await resolveImageUrl(row.image_url)
	screen.value = {
		title: row.title || '',
		subtitle: row.subtitle || '',
		cta_text: row.cta_text || '',
		image_url: imageUrl || '',
		version: row.version,
	}
	return true
}

function applyFallbackCopy() {
	if (screen.value.title) return
	screen.value = {
		...screen.value,
		title: t('brand'),
		subtitle: screen.value.subtitle || t('welcome_fallback_sub'),
		cta_text: screen.value.cta_text || t('continue'),
	}
}

function persistIfChanged(fresh) {
	if (!fresh) return
	const cached = readPageCache(WELCOME_CACHE_KEY)
	const a = welcomeRevision(cached)
	const b = welcomeRevision(fresh)
	if (a !== '' && b !== '' && String(a) === String(b)) return
	writePageCache(WELCOME_CACHE_KEY, fresh)
}

async function load() {
	booting.value = true
	try {
		// 先等接口；不把缓存/本地图提前画上，避免一闪
		const wRes = await apiWelcome().catch(() => null)
		const fresh = normalizeWelcome(wRes?.results)
		if (fresh) {
			persistIfChanged(fresh)
			await applyWelcome(fresh)
		} else {
			const cached = normalizeWelcome(readPageCache(WELCOME_CACHE_KEY))
			if (cached) await applyWelcome(cached)
		}
	} catch (e) {
		console.warn('welcome load failed', e)
		const cached = normalizeWelcome(readPageCache(WELCOME_CACHE_KEY))
		if (cached) await applyWelcome(cached)
	} finally {
		applyFallbackCopy()
		await waitImageReady(heroSrc.value)
		booting.value = false
		track('welcome_page_view', { version: Number(screen.value.version || 1) })
	}
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '@/styles/manna-theme.scss';

.welcome {
	position: relative;
	min-height: 100vh;
	width: 100%;
	overflow: hidden;
	background: $manna-peach;
}

.boot {
	position: absolute;
	inset: 0;
	z-index: 3;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 24rpx;
	background: $manna-peach;
}

.boot__spin {
	width: 48rpx;
	height: 48rpx;
	border-radius: 50%;
	border: 4rpx solid rgba(33, 33, 33, 0.12);
	border-top-color: $manna-btn-text;
	animation: welcome-spin 0.75s linear infinite;
}

.boot__txt {
	font-family: $manna-font-body;
	font-size: 28rpx;
	color: rgba(33, 33, 33, 0.55);
}

@keyframes welcome-spin {
	to {
		transform: rotate(360deg);
	}
}

.bg {
	position: absolute;
	inset: 0;
	pointer-events: none;
	background: $manna-peach;
}
.bg-photo {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}
.bg-fade {
	position: absolute;
	inset: 0;
	background: linear-gradient(
		180deg,
		rgba(255, 244, 238, 0.92) 0%,
		rgba(255, 244, 238, 0) 55%,
		rgba(28, 25, 21, 0.35) 100%
	);
}

.copy {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	top: 42%;
	transform: translateY(-50%);
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 24rpx 0;
	box-sizing: border-box;
}
.title {
	display: block;
	width: 100%;
	text-align: center;
	font-family: $manna-font-serif;
	font-size: 64rpx;
	font-weight: 400;
	color: $manna-btn-text;
	line-height: 1.2;
}
.subtitle {
	display: block;
	width: 100%;
	margin-top: 24rpx;
	text-align: center;
	font-family: $manna-font-body;
	font-size: 32rpx;
	font-weight: 400;
	color: rgba(33, 33, 33, 0.72);
	line-height: 1.35;
}

.footer {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(48rpx + env(safe-area-inset-bottom));
	z-index: 2;
}
.cta {
	height: 96rpx;
	border-radius: $manna-radius-btn;
	background: $manna-btn-text;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 24rpx;
	box-sizing: border-box;
}
.cta-text {
	font-family: $manna-font-body;
	font-size: 32rpx;
	font-weight: 600;
	color: #ffffff;
}
.legal {
	margin-top: 8rpx;
	padding: 24rpx 0;
	text-align: center;
}
.legal-plain,
.legal-link {
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: $manna-btn-text;
	line-height: 1.4;
}
.legal-link {
	font-weight: 700;
	text-decoration: underline;
}
</style>
