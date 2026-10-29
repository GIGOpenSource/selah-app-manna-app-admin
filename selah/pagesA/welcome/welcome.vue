<!--
  冷启 Welcome：贴齐 Figma 25:5706。
  CTA 使用原生 button，避免 App 端 view@tap 点不动。
-->
<template>
	<view class="welcome">
		<view class="bg" aria-hidden="true">
			<view class="bg-base" />
			<image class="bg-photo" :src="heroSrc" mode="aspectFill" />
			<view class="bg-fade" />
		</view>

		<view class="copy">
			<text class="title">{{ displayTitle }}</text>
			<text v-if="displaySubtitle" class="subtitle">{{ displaySubtitle }}</text>
		</view>

		<view class="footer">
			<button class="cta-btn" :disabled="busy" :loading="busy" hover-class="cta-hover" @click="continueNext">
				{{ displayCta }}
			</button>
			<view class="legal">
				<text class="legal-plain">{{ t('welcome_legal_prefix') }}</text>
				<text class="legal-link" @click="onTermsClick">{{ t('legal_terms') }}</text>
				<text class="legal-plain">{{ t('welcome_legal_mid') }}</text>
				<text class="legal-link" @click="onPrivacyClick">{{ t('legal_privacy') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
/**
 * Welcome：title / subtitle / cta / image_url 全部来自运营 Welcome 配置。
 * Continue：立刻 reLaunch 离开本页，不在点击链路里 await 网络。
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiWelcome } from '@/api/content.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { WELCOME_CACHE_KEY } from '@/utils/wallpaperCache.js'
import { WELCOME_SEEN_KEY } from '@/utils/coldStart.js'
import { welcomeRevision } from '@/utils/bootstrap.js'
import { ensureLocalAsset } from '@/utils/assetCache.js'
import { cmsText } from '@/utils/cmsI18n.js'
import { hasLocalSession, shouldForceLoginPage } from '@/utils/session.js'

const LOCAL_HERO = '/static/ui/welcome-mist.jpg'

const { t } = useI18n()
const busy = ref(false)
const screen = ref({
	title: '',
	subtitle: '',
	cta_text: '',
	image_url: '',
	version: 1,
})
const heroSrc = computed(() => (screen.value.image_url || LOCAL_HERO).trim() || LOCAL_HERO)
const displayTitle = computed(() => screen.value.title || t('brand'))
const displaySubtitle = computed(() => {
	const s = String(screen.value.subtitle || '').trim()
	if (!s) return t('welcome_subtitle')
	return cmsText(s, 'welcome_subtitle')
})
const displayCta = computed(() => cmsText(screen.value.cta_text, 'continue') || t('continue'))

function markSeen() {
	try {
		const ver = Number(screen.value.version || 1)
		uni.setStorageSync(WELCOME_SEEN_KEY, ver)
	} catch (e) { }
}

function leaveWelcome(url) {
	const u = String(url || '').trim() || '/pages/home/home'
	const tryGo = () => {
		uni.reLaunch({
			url: u,
			fail: () => {
				uni.redirectTo({
					url: u,
					fail: () => {
						setTimeout(() => uni.reLaunch({ url: u }), 200)
					},
				})
			},
		})
	}
	tryGo()
}

function resolveDest() {
	try {
		if (shouldForceLoginPage() || !hasLocalSession()) return '/pagesA/login/login'
		return '/pages/home/home'
	} catch (e) {
		return '/pagesA/login/login'
	}
}
function onTermsClick() {
	try {
		logFirebaseEvent('terms_click')
	} catch (e) { }
	openLegalPage('terms')
}

function onPrivacyClick() {
	try {
		logFirebaseEvent('privacy_click')
	} catch (e) { }
	openLegalPage('privacy')
}

function continueNext() {
	if (busy.value) return
	busy.value = true
	markSeen()
	try {
		logFirebaseEvent('allowPrivacy_click')
	} catch (e) { }

	leaveWelcome(resolveDest())

	setTimeout(() => {
		busy.value = false
	}, 1200)
}

function usableWelcomeImage(url) {
	const s = String(url || '').trim()
	if (!s) return false
	// placehold / picsum 常失败且会把字画进图；登录底图也不应出现在 Welcome
	if (/placehold\.co|placehold\.it|picsum\.photos|via\.placeholder/i.test(s)) return false
	if (/\/login-bg\.(jpe?g|png|webp)(\?|$)/i.test(s)) return false
	return true
}

async function applyWelcome(data) {
	if (!data || !(data.title || data.subtitle || data.cta_text || data.image_url)) return
	let imageUrl = (data.image_url || '').trim()
	if (!usableWelcomeImage(imageUrl)) {
		imageUrl = ''
	} else if (imageUrl && !imageUrl.startsWith('/static/')) {
		try {
			imageUrl = await ensureLocalAsset(imageUrl)
		} catch (e) { }
	}
	screen.value = {
		title: data.title || '',
		subtitle: data.subtitle || '',
		cta_text: data.cta_text || '',
		image_url: imageUrl || '',
		version: Number(data.version || 1),
	}
}

async function load() {
	try {
		await loadWithCache(
			WELCOME_CACHE_KEY,
			async () => {
				const wRes = await apiWelcome().catch(() => null)
				return wRes?.results || null
			},
			async (data) => { await applyWelcome(data) },
			{ getRevision: welcomeRevision },
		)
	} catch (e) {
		console.warn('welcome load failed', e)
	}
	if (!screen.value.title) {
		screen.value = {
			...screen.value,
			title: t('brand'),
			subtitle: screen.value.subtitle || t('welcome_fallback_sub'),
			cta_text: screen.value.cta_text || t('continue'),
		}
	}
}

onMounted(() => {
	try { logFirebaseEvent('welcome_show') } catch (e) {}
	load()
})
</script>

<style lang="scss" scoped>
@import '@/styles/selah-theme.scss';

.welcome {
	position: relative;
	min-height: 100vh;
	width: 100%;
	overflow: hidden;
	background: $selah-bg;
}

.bg {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 0;
}

.bg-base {
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, $selah-grad-top 0%, $selah-grad-mid 100%);
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
	background: linear-gradient(180deg,
			$selah-grad-mid 0%,
			rgba(245, 245, 245, 0) 59.4%);
}

.copy {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	top: 50%;
	transform: translateY(-50%);
	z-index: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 24rpx 0;
	box-sizing: border-box;
	pointer-events: none;
}

.title {
	display: block;
	width: 100%;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 64rpx;
	font-weight: 700;
	color: $selah-ink;
	line-height: 1.2;
}

.subtitle {
	display: block;
	width: 100%;
	margin-top: 24rpx;
	text-align: center;
	font-family: $selah-font-body;
	font-size: 40rpx;
	font-weight: 400;
	color: $selah-ink;
	line-height: 1.3;
}

.footer {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(48rpx + constant(safe-area-inset-bottom));
	bottom: calc(48rpx + env(safe-area-inset-bottom));
	z-index: 20;
	pointer-events: auto;
}

.cta-btn {
	width: 100%;
	height: 96rpx;
	line-height: 96rpx;
	padding: 0 24rpx;
	margin: 0;
	border: none;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	color: #ffffff;
	font-family: $selah-font-body;
	font-size: 32rpx;
	font-weight: 600;
	text-align: center;
	box-sizing: border-box;
}

.cta-btn::after {
	border: none;
}

.cta-hover {
	opacity: 0.88;
}

.cta-btn[disabled] {
	opacity: 0.55;
}

.legal {
	margin-top: 8rpx;
	padding: 24rpx 0;
	text-align: center;
}

.legal-plain,
.legal-link {
	font-family: $selah-font-body;
	font-size: 24rpx;
	color: $selah-ink;
	line-height: 1.4;
}

.legal-link {
	font-weight: 700;
	text-decoration: underline;
}
</style>
