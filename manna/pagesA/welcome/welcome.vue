<!--
  冷启 Welcome：对齐 Selah 流程（Continue → Login）。
  文案/背景走 Welcome API（app_key×语言×设备）；本地图仅作缺图回落。
-->
<template>
	<view class="welcome">
		<view class="bg" aria-hidden="true">
			<image class="bg-photo" :src="heroSrc" mode="aspectFill" />
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
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiWelcome } from '@/api/content.js'
import { track } from '@/utils/analytics.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { WELCOME_CACHE_KEY } from '@/utils/wallpaperCache.js'
import { WELCOME_SEEN_KEY } from '@/utils/coldStart.js'
import { welcomeRevision } from '@/utils/bootstrap.js'
import { ensureLocalAsset } from '@/utils/assetCache.js'

/** 仅当运营未配图时回落 */
const LOCAL_HERO = '/static/ui/home/bg-279-364.png'

const { t } = useI18n()
const screen = ref({
	title: '',
	subtitle: '',
	cta_text: '',
	image_url: '',
	version: 1,
})
const heroSrc = computed(() => (screen.value.image_url || LOCAL_HERO).trim() || LOCAL_HERO)

function markSeen() {
	const ver = Number(screen.value.version || 1)
	uni.setStorageSync(WELCOME_SEEN_KEY, ver)
}

function continueNext() {
	markSeen()
	track('welcome_continue', { version: Number(screen.value.version || 1) })
	uni.reLaunch({ url: '/pagesA/login/login' })
}

async function applyWelcome(data) {
	if (!data || !(data.title || data.subtitle || data.cta_text || data.image_url)) return
	let imageUrl = (data.image_url || '').trim()
	if (imageUrl && !imageUrl.startsWith('/static/')) {
		imageUrl = await ensureLocalAsset(imageUrl)
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
	track('welcome_page_view', { version: Number(screen.value.version || 1) })
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

.bg {
	position: absolute;
	inset: 0;
	pointer-events: none;
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
