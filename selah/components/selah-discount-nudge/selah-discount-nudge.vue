<!--
  首页会员折扣弹窗：注册满一周、浏览 10 条后出现。Continue 进入现有 VIP 开通流。
-->
<template>
	<view
		v-if="visible"
		class="dn-root"
		@touchmove.stop.prevent
	>
		<view
			v-if="maskReady"
			class="dn-mask"
			@click.stop="onMask"
		/>
		<view class="dn-sheet" @tap.stop>
			<view class="dn-close" @click.stop="onClose">
				<image class="dn-close-ico" src="/static/ui/ico-close.svg" mode="aspectFit" />
			</view>

			<text class="dn-badge">{{ t('home_discount_badge') }}</text>

			<swiper
				class="dn-swiper"
				:current="slide"
				:autoplay="false"
				@change="onSlide"
			>
				<swiper-item v-for="(s, i) in slides" :key="i">
					<view class="dn-slide">
						<view class="dn-art" aria-hidden="true">
							<image class="dn-art-img" src="/static/ui/art-dove.png" mode="aspectFit" />
						</view>
						<text class="dn-title">{{ s.title }}</text>
						<text class="dn-body">{{ s.body }}</text>
					</view>
				</swiper-item>
			</swiper>

			<view class="dn-dots">
				<view
					v-for="(_, i) in slides"
					:key="i"
					:class="['dn-dot', i === slide ? 'on' : '']"
				/>
			</view>

			<text class="dn-price">
				<text v-if="priceWas" class="dn-was">{{ priceWas }}</text>
				<text class="dn-now">{{ priceNow }}</text>
			</text>

			<view class="dn-cta" @click.stop="onContinue">
				<text class="dn-cta-text">{{ t('continue') }}</text>
			</view>

			<view class="dn-foot">
				<text class="dn-link" @tap.stop="onRestore">{{ t('restore_short') }}</text>
				<text class="dn-link" @tap.stop="openLegalPage('subscription')">{{ t('legal_terms_full') }}</text>
				<text class="dn-link" @tap.stop="onClose">{{ t('other') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { t } from '@/i18n/index.js'
import { apiVipPlans, apiVipRestore } from '@/api/membership.js'
import { setUser } from '@/utils/session.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { VIP_PLANS_KEY } from '@/utils/wallpaperCache.js'
import { APP_KEY } from '@/config/config.js'

const props = defineProps({
	visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'continue', 'activated', 'dismiss'])

const maskReady = ref(false)
const slide = ref(0)
const yearlyLabel = ref('')
const wasLabel = ref('')
let maskTimer = null
let loadedPlans = false

const slides = computed(() => [
	{ title: t('home_discount_slide1_title'), body: t('home_discount_slide1_body') },
	{ title: t('home_discount_slide2_title'), body: t('home_discount_slide2_body') },
	{ title: t('home_discount_slide3_title'), body: t('home_discount_slide3_body') },
	{ title: t('home_discount_slide4_title'), body: t('home_discount_slide4_body') },
	{ title: t('home_discount_slide5_title'), body: t('home_discount_slide5_body') },
])

const priceWas = computed(() => wasLabel.value)
const priceNow = computed(() => {
	const now = yearlyLabel.value || ''
	if (!now) return t('home_discount_price_fallback')
	return t('home_discount_price_now', { now })
})

function armMask() {
	if (maskTimer) {
		clearTimeout(maskTimer)
		maskTimer = null
	}
	maskReady.value = false
	maskTimer = setTimeout(() => {
		maskReady.value = true
		maskTimer = null
	}, 280)
}

function moneyLabel(cents, currency, display) {
	const shown = String(display || '').trim()
	if (shown) return shown.replace(/\s*\/\s*(year|yr|年).*$/i, '')
	const n = Number(cents || 0)
	if (!(n > 0)) return ''
	const cur = String(currency || 'USD').toUpperCase()
	const symbol = cur === 'CNY' || cur === 'JPY' ? '¥' : cur === 'USD' ? 'US$' : `${cur} `
	return `${symbol}${(n / 100).toFixed(2)}`
}

async function loadPlans() {
	if (loadedPlans) return
	loadedPlans = true
	try {
		await loadWithCache(
			VIP_PLANS_KEY,
			async () => (await apiVipPlans()).results || {},
			(results) => {
				const products = (results?.products || []).filter((p) => {
					const ak = (p.app_key || '').trim()
					return !ak || ak === APP_KEY
				})
				const sys = uni.getSystemInfoSync?.() || {}
				const platform = /android/i.test(sys.platform || sys.osName || '') ? 'android' : 'ios'
				const yearly = products.find((p) => {
					if (p.platform && p.platform !== platform) return false
					return (p.plan_id || p.plan_type) === 'yearly'
				}) || products.find((p) => (p.plan_id || p.plan_type) === 'yearly')
				const monthly = products.find((p) => {
					if (p.platform && p.platform !== platform) return false
					return (p.plan_id || p.plan_type) === 'monthly'
				})
				if (yearly) {
					yearlyLabel.value = moneyLabel(yearly.price_cents, yearly.currency, yearly.price_display)
				}
				if (monthly) {
					const cents = Number(monthly.price_cents || 0) * 12
					wasLabel.value = moneyLabel(cents, monthly.currency, '')
				} else if (yearly && Number(yearly.price_cents || 0) > 0) {
					wasLabel.value = moneyLabel(Math.round(Number(yearly.price_cents) / 0.25), yearly.currency, '')
				}
			},
		)
	} catch (e) {}
}

watch(
	() => props.visible,
	(v) => {
		if (v) {
			slide.value = 0
			armMask()
			loadPlans()
		} else {
			maskReady.value = false
			if (maskTimer) {
				clearTimeout(maskTimer)
				maskTimer = null
			}
		}
	},
	{ immediate: true },
)

onBeforeUnmount(() => {
	if (maskTimer) clearTimeout(maskTimer)
})

function onSlide(e) {
	slide.value = Number(e?.detail?.current || 0)
}

function close() {
	if (!maskReady.value) return
	emit('dismiss')
	emit('update:visible', false)
}

function onMask() {
	close()
}

function onClose() {
	close()
}

function onContinue() {
	if (!maskReady.value) return
	emit('continue')
	emit('update:visible', false)
}

async function onRestore() {
	if (!maskReady.value) return
	uni.showModal({
		title: t('restore_purchases'),
		editable: true,
		placeholderText: 'transaction_id',
		success: async (r) => {
			if (!r.confirm) return
			try {
				const res = await apiVipRestore({ transaction_id: r.content })
				setUser(res.results.user)
				uni.showToast({ title: t('restored'), icon: 'none' })
				emit('activated', res.results.user)
				emit('update:visible', false)
			} catch (e) {
			}
		},
	})
}
</script>

<style lang="scss" scoped>
@import '@/styles/selah-theme.scss';

.dn-root {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 99991;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
}
.dn-mask {
	position: absolute;
	inset: 0;
	background: rgba(25, 25, 25, 0.45);
}
.dn-sheet {
	position: relative;
	z-index: 1;
	width: 100%;
	min-height: 86%;
	padding: 24rpx 40rpx calc(20rpx + env(safe-area-inset-bottom));
	background: $selah-bg;
	border-radius: 40rpx 40rpx 0 0;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}
.dn-close {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.dn-close-ico {
	width: 36rpx;
	height: 36rpx;
	opacity: 0.7;
}
.dn-badge {
	display: block;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 44rpx;
	font-weight: 700;
	color: $selah-ink;
	margin: 8rpx 0 8rpx;
}
.dn-swiper {
	flex: 1;
	min-height: 420rpx;
	height: 48vh;
}
.dn-slide {
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 0 16rpx;
	box-sizing: border-box;
}
.dn-art {
	width: 280rpx;
	height: 220rpx;
	margin-bottom: 28rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.dn-art-img {
	width: 260rpx;
	height: 200rpx;
}
.dn-title {
	display: block;
	text-align: center;
	font-family: $selah-font-display;
	font-size: 48rpx;
	font-weight: 700;
	color: $selah-ink;
	margin-bottom: 12rpx;
}
.dn-body {
	display: block;
	text-align: center;
	font-size: 30rpx;
	line-height: 1.4;
	color: $selah-ink-soft;
}
.dn-dots {
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
	gap: 10rpx;
	margin: 12rpx 0 20rpx;
}
.dn-dot {
	width: 10rpx;
	height: 10rpx;
	border-radius: 50%;
	background: rgba(25, 25, 25, 0.18);
}
.dn-dot.on {
	width: 28rpx;
	border-radius: 999rpx;
	background: #c9a46a;
}
.dn-price {
	display: block;
	text-align: center;
	font-size: 28rpx;
	color: $selah-ink;
	margin-bottom: 20rpx;
}
.dn-was {
	margin-right: 12rpx;
	color: $selah-muted;
	text-decoration: line-through;
}
.dn-now {
	font-weight: 600;
}
.dn-cta {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: linear-gradient(90deg, #e8c48a 0%, #c9a46a 100%);
	display: flex;
	align-items: center;
	justify-content: center;
}
.dn-cta-text {
	color: $selah-ink;
	font-size: 32rpx;
	font-weight: 700;
}
.dn-foot {
	margin-top: 18rpx;
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	padding: 0 8rpx;
}
.dn-link {
	font-size: 22rpx;
	color: $selah-muted;
}
</style>
