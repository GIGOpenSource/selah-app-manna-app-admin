<!--
  教育夹层：对齐 Figma 136:*（奶油渐变 · 上区插画 · 居中深色标题 · 黑底 CTA）。
  文案走 interstitial API；插画用本地按 kind 样式，不用整页截图当背景。
  query: kind（必填）+ 可选 next / redirect。
-->
<template>
	<view class="page">
		<view class="bg" aria-hidden="true" />

		<view class="art" aria-hidden="true">
			<view class="art-glow" />
			<view :class="['art-frame', `art-${kind}`]">
				<image
					v-if="illusSrc"
					class="art-img"
					:src="illusSrc"
					mode="aspectFit"
				/>
				<view v-else class="art-fallback">
					<image class="art-ico" :src="kindIcon" mode="aspectFit" />
				</view>
			</view>
		</view>

		<view class="copy">
			<text class="title">{{ displayTitle }}</text>
			<text v-if="displaySubtitle" class="subtitle">{{ displaySubtitle }}</text>
		</view>

		<view class="footer">
			<view class="cta" :class="{ disabled: busy }" @click="continueNext">
				<text class="cta-text">{{ displayCta }}</text>
			</view>
			<view
				v-if="kind === 'push_nudge'"
				class="cta-ghost"
				:class="{ disabled: busy }"
				@click="skipNext"
			>
				<text class="cta-ghost-text">{{ t('interstitial_not_ready') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
/**
 * Figma 夹层屏：样式本地还原；运营只配 title / subtitle / cta（可选小插画 URL）。
 */
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiInterstitial } from '@/api/content.js'
import { getUser } from '@/utils/session.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { ensureLocalAsset } from '@/utils/assetCache.js'
import { markInterstitialSeen } from '@/utils/vip.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { interstitialCacheKey } from '@/utils/wallpaperCache.js'
import { interstitialRevision } from '@/utils/bootstrap.js'
import { runBusy } from '@/utils/tapLock.js'
import { cmsText } from '@/utils/cmsI18n.js'

const KIND_ICONS = {
	personalize_intro: '/static/ui/ico-profile.svg',
	prefs_intro: '/static/ui/ico-settings.svg',
	push_nudge: '/static/ui/ico-surprise.svg',
	devotion_custom: '/static/ui/ico-prayer.svg',
	value_edu: '/static/ui/ico-star.svg',
	trial_intro: '/static/ui/ico-vip.svg',
}

const KIND_I18N = {
	personalize_intro: {
		title: 'interstitial_personalize_intro_title',
		subtitle: 'interstitial_personalize_intro_sub',
		cta: 'continue',
	},
	prefs_intro: {
		title: 'interstitial_prefs_intro_title',
		cta: 'continue',
	},
	value_edu: {
		title: 'interstitial_value_edu_title',
		cta: 'continue',
	},
	devotion_custom: {
		title: 'interstitial_devotion_custom_title',
		cta: 'continue',
	},
	push_nudge: {
		title: 'interstitial_push_nudge_title',
		subtitle: 'interstitial_push_nudge_sub',
		cta: 'interstitial_push_nudge_cta',
	},
	trial_intro: {
		title: 'interstitial_trial_intro_title',
		subtitle: 'interstitial_trial_intro_sub',
		cta: 'continue',
	},
}

const { t } = useI18n()
const busy = ref(false)
const kind = ref('personalize_intro')
const nextUrl = ref('')
const screen = ref({
	title: '',
	subtitle: '',
	cta_text: '',
	image_url: '',
	version: 1,
	kind: '',
})

const kindIcon = computed(() => KIND_ICONS[kind.value] || '/static/ui/ico-star.svg')
/** 仅当运营上传了插画（非整页截图）时展示；空则用 kind 图标 */
const illusSrc = computed(() => (screen.value.image_url || '').trim())

const kindCopy = computed(() => KIND_I18N[kind.value] || {})
const displayTitle = computed(() => {
	const key = kindCopy.value.title
	if (!key) return screen.value.title || ''
	return cmsText(screen.value.title, key)
})
const displaySubtitle = computed(() => {
	const key = kindCopy.value.subtitle
	const raw = String(screen.value.subtitle || '').trim()
	if (!key) return raw
	if (!raw) return t(key)
	return cmsText(raw, key)
})
const displayCta = computed(() => {
	const key = kindCopy.value.cta || 'continue'
	return cmsText(screen.value.cta_text, key) || t('continue')
})

onLoad((q) => {
	kind.value = (q.kind || 'personalize_intro').trim()
	const raw = q.next || q.redirect || ''
	if (raw) {
		try {
			nextUrl.value = decodeURIComponent(raw)
		} catch (e) {
			nextUrl.value = raw
		}
	}
})

function goFallback() {
	const user = getUser() || {}
	if (!user.onboarding_completed && !user.onboarding_skipped) {
		uni.reLaunch({ url: '/pagesA/onboarding/onboarding' })
		return
	}
	uni.reLaunch({ url: '/pages/home/home' })
}

function leave() {
	const dest = (nextUrl.value || '').trim()
	if (dest) {
		if (dest.startsWith('/pages/') && !dest.startsWith('/pagesA/')) {
			const path = dest.split('?')[0]
			if (['/pages/home/home', '/pages/ai/ai', '/pages/profile/profile'].includes(path)) {
				uni.reLaunch({ url: dest })
				return
			}
		}
		uni.redirectTo({
			url: dest,
			fail: () => {
				uni.navigateTo({
					url: dest,
					fail: () => goFallback(),
				})
			},
		})
		return
	}
	goFallback()
}

function continueNext() {
	if (busy.value) return
	runBusy(async () => {
		markInterstitialSeen(kind.value, screen.value.version)
		if (kind.value === 'trial_intro') {
			try { logFirebaseEvent('premium_intro_continue_click') } catch (e) {}
		}
		leave()
	}, { busy, cooldownMs: 800 })
}

function skipNext() {
	if (busy.value) return
	runBusy(async () => {
		markInterstitialSeen(kind.value, screen.value.version)
		leave()
	}, { busy, cooldownMs: 800 })
}

/**
 * 过滤误配的整页截图：运营若仍留着旧 seed 截图 URL，则忽略，改用本地 kind 样式。
 */
function isLikelyFullBleedScreenshot(url) {
	const u = String(url || '').toLowerCase()
	if (!u) return false
	return u.includes('/interstitial/') && (
		u.includes('personalize_intro')
		|| u.includes('prefs_intro')
		|| u.includes('push_nudge')
		|| u.includes('devotion_custom')
		|| u.includes('value_edu')
		|| u.includes('trial_intro')
	)
}

async function applyScreen(data) {
	if (!data || !(data.title || data.subtitle || data.cta_text)) return
	let imageUrl = (data.image_url || '').trim()
	if (isLikelyFullBleedScreenshot(imageUrl)) {
		imageUrl = ''
	} else if (imageUrl && !imageUrl.startsWith('/static/')) {
		imageUrl = await ensureLocalAsset(imageUrl)
	}
	screen.value = {
		title: data.title || '',
		subtitle: data.subtitle || '',
		cta_text: data.cta_text || '',
		image_url: imageUrl,
		version: Number(data.version || 1),
		kind: data.kind || kind.value,
	}
}

async function load() {
	try {
		await loadWithCache(
			interstitialCacheKey(kind.value),
			async () => {
				const res = await apiInterstitial(kind.value).catch(() => null)
				return res?.results || null
			},
			async (data) => { await applyScreen(data) },
			{ getRevision: interstitialRevision },
		)
	} catch (e) {
		console.warn('interstitial load failed', e)
	}
	if (kind.value === 'trial_intro') {
		try { logFirebaseEvent('premium_intro_show') } catch (e) {}
	}
	if (!(screen.value.title || '').trim()) {
		markInterstitialSeen(kind.value, 1)
		leave()
	}
}

onMounted(load)
</script>

<style lang="scss" scoped>
@import '@/styles/selah-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	width: 100%;
	overflow: hidden;
	background: $selah-bg;
	box-sizing: border-box;
}

.bg {
	position: absolute;
	inset: 0;
	pointer-events: none;
	background: linear-gradient(180deg, $selah-grad-mid 0%, $selah-bg-gray 97%);
}

.art {
	position: absolute;
	left: 0;
	right: 0;
	top: 18%;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 320rpx;
	pointer-events: none;
}
.art-glow {
	position: absolute;
	width: 280rpx;
	height: 200rpx;
	border-radius: 50%;
	background: radial-gradient(
		ellipse at center,
		rgba(207, 162, 255, 0.35) 0%,
		rgba(255, 243, 211, 0.2) 45%,
		rgba(255, 243, 211, 0) 70%
	);
	filter: blur(4rpx);
}
.art-frame {
	position: relative;
	width: 176rpx;
	height: 176rpx;
	border-radius: 88rpx;
	background: linear-gradient(180deg, #fff3d3 0%, #cfa2ff 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	box-shadow: 0 12rpx 40rpx rgba(25, 25, 25, 0.08);
}
.art-prefs_intro,
.art-push_nudge {
	width: 126rpx;
	height: 202rpx;
	border-radius: 28rpx;
	border: 3rpx solid $selah-ink;
	background: linear-gradient(180deg, #fff3d3 0%, #cfa2ff 100%);
}
.art-img {
	width: 100%;
	height: 100%;
}
.art-fallback {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}
.art-ico {
	width: 72rpx;
	height: 72rpx;
}

.copy {
	position: absolute;
	left: 64rpx;
	right: 64rpx;
	top: 48%;
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	transform: translateY(-20%);
}
.title {
	display: block;
	width: 100%;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 48rpx;
	font-weight: 700;
	color: $selah-ink;
	line-height: 1.25;
}
.subtitle {
	display: block;
	width: 100%;
	margin-top: 24rpx;
	text-align: center;
	font-family: $selah-font-body;
	font-size: 32rpx;
	font-weight: 400;
	color: $selah-ink;
	line-height: 1.4;
	opacity: 0.88;
}

.footer {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(48rpx + env(safe-area-inset-bottom));
	z-index: 2;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
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
.cta.disabled,
.cta-ghost.disabled {
	opacity: 0.55;
	pointer-events: none;
}
.cta-text {
	font-family: $selah-font-body;
	font-size: 32rpx;
	font-weight: 600;
	color: #ffffff;
}
.cta-ghost {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	display: flex;
	align-items: center;
	justify-content: center;
}
.cta-ghost-text {
	font-family: $selah-font-body;
	font-size: 32rpx;
	font-weight: 600;
	color: $selah-ink;
}
</style>
