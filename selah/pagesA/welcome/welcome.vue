<!--
  冷启 Welcome：贴齐 Figma 25:5706（浅色雾感底 + 居中深色文案 + 黑底 CTA）。
  文案 / 背景图均走 Welcome API（运营台可配）；本地 mist 仅作缺图回落。
-->
<template>
	<view class="welcome">
		<view class="bg" aria-hidden="true">
			<view class="bg-base" />
			<image class="bg-photo" :src="heroSrc" mode="aspectFill" />
			<view class="bg-fade" />
		</view>

		<view class="copy">
			<text class="title">{{ screen.title || t('brand') }}</text>
			<text v-if="screen.subtitle" class="subtitle">{{ screen.subtitle }}</text>
		</view>

		<view class="footer">
			<view class="cta" :class="{ disabled: busy }" @click="continueNext">
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
/**
 * Welcome：title / subtitle / cta / image_url 全部来自运营 Welcome 配置。
 */
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
import { runBusy } from '@/utils/tapLock.js'

/** 仅当运营未配图时回落 */
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

function markSeen() {
	const ver = Number(screen.value.version || 1)
	uni.setStorageSync(WELCOME_SEEN_KEY, ver)
}

/** Continue → 登录页（再按是否新用户分流问卷 / 首页） */
function continueNext() {
	if (busy.value) return
	runBusy(async () => {
		markSeen()
		track('welcome_continue', { version: Number(screen.value.version || 1) })
		uni.reLaunch({ url: '/pagesA/login/login' })
	}, { busy, cooldownMs: 800 })
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
	/* Figma 25:5934：顶奶油色向下淡出，保证标题区可读 */
	position: absolute;
	inset: 0;
	background: linear-gradient(
		180deg,
		$selah-grad-mid 0%,
		rgba(245, 245, 245, 0) 59.4%
	);
}

.copy {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	top: 50%;
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
	bottom: calc(48rpx + env(safe-area-inset-bottom));
	z-index: 2;
}
.cta {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 24rpx;
	box-sizing: border-box;
}
.cta.disabled {
	opacity: 0.55;
	pointer-events: none;
}
.cta-text {
	font-family: $selah-font-body;
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
