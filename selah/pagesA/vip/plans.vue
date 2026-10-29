<!--
  VIP 二级套餐页 — 「其他」入口：年卡/月卡选择 + 试用/订阅 CTA + 开通成功弹窗
-->
<template>
	<view class="plans-page">
		<view class="plans-grad" />

		<view class="head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="close-wrap" @tap.stop="goBack">
				<image class="close-ico" src="/static/ui/vip/ico-close.svg" mode="aspectFit" />
			</view>
			<text class="title">{{ t('try_premium') }}</text>
			<view class="head-spacer" />
		</view>

		<scroll-view class="main-scroll" scroll-y :show-scrollbar="false" :bounces="false">
			<view class="main">
				<view class="benefits">
					<view v-for="(b, i) in benefitRows" :key="i" class="benefit">
						<image class="benefit-ico" :src="b.icon" mode="aspectFit" />
						<text class="benefit-text">{{ b.text }}</text>
					</view>
				</view>

				<view class="plan-row">
					<view
						:class="['plan-card', selected === 'yearly' ? 'on' : '']"
						@tap.stop="selectPlan('yearly')"
					>
						<view v-if="trialAvailable && trialDays > 0" class="plan-badge">
							<text class="plan-badge-t">{{ t('vip_plans_trial_badge', { n: trialDays }) }}</text>
						</view>
						<text class="plan-name">{{ t('vip_plans_annual') }}</text>
						<view class="plan-price-col">
							<text class="plan-price">{{ yearlyNow }}</text>
							<text v-if="yearlyWas" class="plan-was">{{ yearlyWas }}</text>
						</view>
						<text class="plan-hint">{{ yearlyHint }}</text>
					</view>

					<view
						:class="['plan-card', selected === 'monthly' ? 'on' : '']"
						@tap.stop="selectPlan('monthly')"
					>
						<text class="plan-name">{{ t('vip_plans_monthly') }}</text>
						<view class="plan-price-col">
							<text class="plan-price">{{ monthlyNow }}</text>
							<text v-if="monthlyWas" class="plan-was">{{ monthlyWas }}</text>
						</view>
						<text class="plan-hint">{{ t('vip_plans_cancel_anytime') }}</text>
					</view>
				</view>

				<view class="dock">
					<text class="cta-sub">{{ ctaSub }}</text>
					<view class="cta" @tap.stop="pay">
						<text class="cta-text">{{ ctaLabel }}</text>
					</view>
					<view class="foot">
						<text class="foot-link" @tap.stop="restore">{{ t('restore_short') }}</text>
						<text class="foot-link" @tap.stop="openLegalPage('subscription')">{{ t('legal_terms_full') }}</text>
						<text class="foot-link" @tap.stop="openLegalPage('privacy')">{{ t('legal_privacy') }}</text>
					</view>
				</view>
			</view>
		</scroll-view>

		<view v-if="successOpen" class="success-mask" @tap.stop>
			<view class="success-card" @tap.stop>
				<image class="success-ico" src="/static/ui/vip/ico-premium-crown.svg" mode="aspectFit" />
				<text class="success-title">{{ t('vip_premium_title') }}</text>
				<text class="success-body">{{ t('vip_premium_thanks') }}</text>
				<view class="success-cta" @tap.stop="onSuccessOk">
					<text class="success-cta-t">{{ t('ok') }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { apiVipPlans, apiVipStartTrial, apiVipVerify, apiVipRestore } from '@/api/membership.js'
import { getUser, setUser } from '@/utils/session.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { isVipActive } from '@/utils/vip.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { VIP_PLANS_KEY } from '@/utils/wallpaperCache.js'
import { APP_KEY } from '@/config/config.js'
import { t } from '@/i18n/index.js'
import { purchaseIap, restoreIapPurchases, finishIapTransaction } from '@/utils/iap.js'
import { setTrialEndReminder } from '@/utils/reminder.js'
import { safeBack } from '@/utils/nav.js'

const VIP_ACTIVATED_EVENT = 'selah_vip_activated'

const statusBarPx = getStatusBarPx()
const payTrigger = ref('other')
const info = ref({})
const trialDays = ref(3)
const selected = ref('yearly')
const planOptions = ref([])
const trialAvailable = ref(false)
const paying = ref(false)
const successOpen = ref(false)
const trialRemind = ref(uni.getStorageSync('vip_trial_remind') === true)

onLoad((q) => {
	payTrigger.value = q?.pay_trigger_source || 'other'
})

const benefitRows = computed(() => {
	const n = Number(info.value.vip_daily_quota) || 100
	return [
		{ icon: '/static/ui/vip/ico-benefit-spark.svg', text: t('vip_plans_benefit_ai', { n }) },
		{ icon: '/static/ui/vip/ico-benefit-bell.svg', text: t('vip_plans_benefit_themes') },
		{ icon: '/static/ui/vip/ico-benefit-nolimit.svg', text: t('vip_plans_benefit_nolimit') },
	]
})

function devicePlatform() {
	try {
		const sys = uni.getSystemInfoSync?.() || {}
		return /android/i.test(sys.platform || sys.osName || '') ? 'android' : 'ios'
	} catch (e) {
		return 'ios'
	}
}

function planKey(plan) {
	return String(plan?.plan_type || plan?.plan_id || '').toLowerCase()
}

function findPlan(planType) {
	const want = String(planType || '').toLowerCase()
	if (!want) return null
	return planOptions.value.find((p) => planKey(p) === want) || null
}

function storeProductId(plan) {
	return String(plan?.product_id || plan?.store_product_id || '').trim()
}

function currencySymbol(currency, display) {
	const cur = String(currency || 'USD').toUpperCase()
	if (cur === 'CNY' || cur === 'JPY') return '¥'
	if (cur === 'USD') return '$'
	const fromDisplay = String(display || '').replace(/[\d.,\s]/g, '')[0]
	return fromDisplay || `${cur} `
}

function moneyLabel(cents, currency, display) {
	const shown = String(display || '').trim()
	if (shown) return shown.replace(/\s*\/\s*(year|yr|month|mo|年|月).*$/i, '').trim()
	const n = Number(cents || 0)
	if (!(n > 0)) return ''
	const symbol = currencySymbol(currency, '')
	return `${symbol}${(n / 100).toFixed(2)}`
}

/** 划线原价：优先接口 original_price_display，其次 original_price_cents */
function originalMoney(plan) {
	if (!plan) return ''
	const display = String(plan.original_price_display || '').trim()
	if (display) return moneyLabel(0, plan.currency, display)
	const cents = Number(plan.original_price_cents || 0)
	if (cents > 0) return moneyLabel(cents, plan.currency, '')
	return ''
}

const yearlyPlan = computed(() => findPlan('yearly'))
const monthlyPlan = computed(() => findPlan('monthly'))

const yearlyNow = computed(() => {
	const p = yearlyPlan.value || {}
	return moneyLabel(p.price_cents, p.currency, p.price_display) || '—'
})

const yearlyWas = computed(() => originalMoney(yearlyPlan.value))

const monthlyNow = computed(() => {
	const p = monthlyPlan.value || {}
	return moneyLabel(p.price_cents, p.currency, p.price_display) || '—'
})

const monthlyWas = computed(() => originalMoney(monthlyPlan.value))

const yearlyHint = computed(() => {
	const p = yearlyPlan.value || {}
	const cents = Number(p.price_cents || 0)
	const symbol = currencySymbol(p.currency, p.price_display)
	let monthly = ''
	if (cents > 0) {
		monthly = `${symbol}${(cents / 100 / 12).toFixed(1).replace(/\.0$/, '')}`
	} else if (yearlyNow.value && /[\d.]+/.test(yearlyNow.value)) {
		const num = parseFloat(String(yearlyNow.value).replace(/[^\d.]/g, ''))
		if (!Number.isNaN(num) && num > 0) {
			const sym = String(yearlyNow.value).replace(/[\d.,\s]/g, '')[0] || symbol
			monthly = `${sym}${(num / 12).toFixed(1).replace(/\.0$/, '')}`
		}
	}
	if (!monthly) return t('vip_plans_cancel_anytime')
	return t('vip_plans_only_month', { monthly })
})

const ctaSub = computed(() => {
	if (selected.value === 'yearly' && trialAvailable.value) {
		const n = Number(trialDays.value) || 3
		return t('vip_plans_trial_then', { n, yearly: yearlyNow.value })
	}
	return t('vip_plans_cancel_anytime')
})

const ctaLabel = computed(() => {
	if (selected.value === 'yearly' && trialAvailable.value) return t('vip_plans_start_trial')
	return t('vip_plans_subscribe')
})

function selectPlan(kind) {
	const plan = findPlan(kind)
	if (!plan) return
	selected.value = planKey(plan) || kind
}

async function loadPlans() {
	const platform = devicePlatform()
	try {
		await loadWithCache(
			VIP_PLANS_KEY,
			async () => (await apiVipPlans({ platform })).results || {},
			(results) => {
				info.value = results || {}
				const td = Number(info.value.trial_days)
				trialDays.value = Number.isFinite(td) && td > 0 ? td : 3
				trialAvailable.value = info.value.trial_available === true
					|| info.value.trial_available === 1
					|| info.value.trial_available === '1'
				const products = (info.value.products || []).filter((p) => {
					const ak = (p.app_key || '').trim()
					if (ak && ak !== APP_KEY) return false
					return String(p.platform || '').toLowerCase() === platform
				})
				const byPlan = {}
				products.forEach((p) => {
					const key = planKey(p) || 'monthly'
					byPlan[key] = {
						...p,
						plan_id: key,
						plan_type: p.plan_type || key,
						platform,
						product_id: p.product_id || p.store_product_id,
					}
				})
				planOptions.value = Object.values(byPlan)
				selected.value = findPlan('yearly')?.plan_id
					|| planOptions.value[0]?.plan_id
					|| 'yearly'
			},
		)
	} catch (e) {}
}

function purchaseResultCode(e) {
	const code = String((e && e.code) || '')
	if (code === 'USER_CANCELED' || code === '1' || code === '2' || code === '7') return 'fail1'
	return 'fail2'
}

function payFailToast(e) {
	const code = String((e && e.code) || '')
	const msg = String((e && (e.message || e.msg)) || '')
	if (
		code === 'USER_CANCELED'
		|| code === '1'
		|| code === '2'
		|| code === '7'
		|| code === 'ITEM_ALREADY_OWNED'
		|| /already.?own|already.?subscri|已订阅|已拥有/i.test(msg)
	) return
	uni.showToast({
		title: code === 'STORE_UNAVAILABLE' ? t('vip_store_unavailable') : (msg || t('network_error')),
		icon: 'none',
	})
}

function notifyActivated(user) {
	try { uni.$emit(VIP_ACTIVATED_EVENT, user || null) } catch (e) {}
}

function trialUserFrom(res) {
	const results = res?.results
	if (!results || typeof results !== 'object') return null
	if (results.user && typeof results.user === 'object') return results.user
	if (results.vip_level || results.is_trial != null || results.vip_expire_at) return results
	return null
}

/** 「开始免费试用」：直调试用接口，不拉起商店支付 */
async function startFreeTrial() {
	if (paying.value || !trialAvailable.value) return
	try { logFirebaseEvent('trial_start_click') } catch (e) {}
	paying.value = true
	try {
		const res = await apiVipStartTrial()
		const user = trialUserFrom(res)
		if (user) {
			setUser(user)
			info.value.vip_level = user.vip_level || 'vip'
			info.value.is_trial = user.is_trial !== false
			info.value.vip_expire_at = user.vip_expire_at || ''
			if (trialRemind.value && user.is_trial && user.vip_expire_at) {
				setTrialEndReminder({ enabled: true, endAt: user.vip_expire_at })
			}
		}
		trialAvailable.value = false
		info.value.trial_available = false
		try { logFirebaseEvent('purchase_flow_result', { purchase_result: 'suc' }) } catch (e) {}
		try { logFirebaseEvent('subscription_entitlement_result') } catch (e) {}
		notifyActivated(user)
		successOpen.value = true
	} catch (e) {
		try { logFirebaseEvent('purchase_flow_result', { purchase_result: 'fail2' }) } catch (err) {}
		const msg = String((e && (e.msg || e.message)) || '')
		uni.showToast({ title: msg || t('network_error'), icon: 'none' })
	} finally {
		paying.value = false
	}
}

async function pay() {
	if (paying.value) return
	const kind = String(selected.value || 'yearly').toLowerCase()
	if (trialAvailable.value && kind === 'yearly') {
		await startFreeTrial()
		return
	}
	const plan = findPlan(kind) || {}
	const platform = devicePlatform()
	const productId = storeProductId(plan)
	if (!productId) {
		uni.showToast({ title: t('network_error'), icon: 'none' })
		try { logFirebaseEvent('purchase_flow_result', { purchase_result: 'fail2' }) } catch (e) {}
		return
	}
	paying.value = true
	const alreadyVip = isVipActive() || String(info.value.vip_level || '') === 'vip'
	const user = getUser() || {}
	const username = String(user.username || user.display_name || user.user_id || user.id || '').trim()
	try {
		const bought = await purchaseIap(productId, 'subs', { username })
		const res = await apiVipVerify({
			platform: plan.platform || bought.platform || platform,
			product_id: productId,
			transaction_id: bought.transaction_id,
			receipt_data: bought.receipt_data,
		})
		await finishIapTransaction(bought)
		const nextUser = res.results?.user
		if (nextUser) setUser(nextUser)
		try { logFirebaseEvent('purchase_flow_result', { purchase_result: 'suc' }) } catch (e) {}
		try { logFirebaseEvent('subscription_entitlement_result') } catch (e) {}
		if (trialRemind.value && nextUser?.is_trial && nextUser?.vip_expire_at) {
			setTrialEndReminder({ enabled: true, endAt: nextUser.vip_expire_at })
		}
		if (alreadyVip || res.results?.already) {
			notifyActivated(nextUser)
			successOpen.value = true
			return
		}
		info.value.vip_level = 'vip'
		info.value.is_trial = !!nextUser?.is_trial
		info.value.vip_expire_at = nextUser?.vip_expire_at
		notifyActivated(nextUser)
		successOpen.value = true
	} catch (e) {
		try { logFirebaseEvent('purchase_flow_result', { purchase_result: purchaseResultCode(e) }) } catch (err) {}
		payFailToast(e)
	} finally {
		paying.value = false
	}
}

async function restore() {
	if (paying.value) return
	try { logFirebaseEvent('paywall_restore_click') } catch (e) {}
	paying.value = true
	try {
		const rows = await restoreIapPurchases()
		if (!rows.length) {
			uni.showToast({ title: t('vip_store_unavailable'), icon: 'none' })
			try { logFirebaseEvent('paywall_restore_result', { restore_result: 'fail1' }) } catch (e) {}
			return
		}
		let last = null
		for (const row of rows) {
			last = await apiVipRestore({
				transaction_id: row.transaction_id,
				original_transaction_id: row.original_transaction_id,
			})
		}
		if (last?.results?.user) {
			setUser(last.results.user)
			notifyActivated(last.results.user)
			try { logFirebaseEvent('paywall_restore_result', { restore_result: 'suc' }) } catch (e) {}
			try { logFirebaseEvent('subscription_entitlement_result') } catch (e) {}
			successOpen.value = true
		} else {
			try { logFirebaseEvent('paywall_restore_result', { restore_result: 'fail2' }) } catch (e) {}
			uni.showToast({ title: t('restored'), icon: 'none' })
		}
	} catch (e) {
		try { logFirebaseEvent('paywall_restore_result', { restore_result: 'fail2' }) } catch (err) {}
		payFailToast(e)
	} finally {
		paying.value = false
	}
}

function goBack() {
	safeBack('/pagesA/vip/vip')
}

function onSuccessOk() {
	successOpen.value = false
	const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	let delta = 1
	for (let i = stack.length - 2; i >= 0; i--) {
		const route = String(stack[i]?.route || '')
		if (route.includes('pagesA/vip/')) {
			delta = stack.length - 1 - i + 1
			continue
		}
		break
	}
	if (stack.length > 1) {
		uni.navigateBack({
			delta: Math.min(delta, stack.length - 1),
			fail: () => safeBack('/pages/home/home'),
		})
		return
	}
	safeBack('/pages/home/home')
}

onMounted(() => {
	try {
		logFirebaseEvent('paywall_show', {
			source: String(payTrigger.value || 'vip_plans'),
		})
	} catch (e) {}
	loadPlans()
})
</script>

<style>
page {
	height: 100%;
	overflow: hidden;
	background: #fbf8f2;
}
</style>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.plans-page {
	position: relative;
	width: 100%;
	height: 100vh;
	height: 100dvh;
	background: #fbf8f2;
	overflow: hidden;
	box-sizing: border-box;
}
.plans-grad {
	position: absolute;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background: linear-gradient(180deg, #fff3df 0%, #f7f1e8 42%, #f3f3f3 100%);
}
.head {
	position: relative;
	z-index: 30;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding-left: 28rpx;
	padding-right: 28rpx;
	padding-bottom: 12rpx;
	min-height: 88rpx;
	box-sizing: border-box;
}
.close-wrap {
	width: 72rpx;
	height: 72rpx;
	flex-shrink: 0;
}
.close-ico {
	width: 72rpx;
	height: 72rpx;
}
.title {
	flex: 1;
	font-family: $selah-font-display;
	font-size: 35rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #191919;
	// text-align: center;
	padding: 0 12rpx;
}
.head-spacer {
	width: 72rpx;
	height: 72rpx;
	flex-shrink: 0;
}
.main-scroll {
	position: relative;
	z-index: 5;
	width: 100%;
	height: calc(100% - 100rpx);
	box-sizing: border-box;
}
.main {
	display: flex;
	flex-direction: column;
	padding-left: 40rpx;
	padding-right: 40rpx;
	padding-top: 24rpx;
	padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
	min-height: 100%;
}
.benefits {
	display: flex;
	flex-direction: column;
	gap: 36rpx;
	padding: 40rpx 36rpx;
	margin-bottom: 48rpx;
	background: #ffffff;
	border-radius: 40rpx;
	box-sizing: border-box;
}
.benefit {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 24rpx;
}
.benefit-ico {
	width: 60rpx;
	height: 60rpx;
	flex-shrink: 0;
}
.benefit-text {
	flex: 1;
	min-width: 0;
	font-family: $selah-font-display;
	font-size: 26rpx;
	font-weight: 700;
	line-height: 1.4;
	color: #191919;
}
.plan-row {
	display: flex;
	flex-direction: row;
	align-items: stretch;
	gap: 24rpx;
	margin-bottom: 56rpx;
	padding-top: 28rpx;
}
.plan-card {
	position: relative;
	flex: 1;
	min-width: 0;
	min-height: 260rpx;
	padding: 52rpx 20rpx 36rpx;
	border-radius: 36rpx;
	background: #FEFBF3;
	border: 3rpx solid transparent;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	gap: 14rpx;
}
.plan-card.on {
	border-color: #2a2a3a;
	background: linear-gradient(165deg, #FAF6F5 0%, #D7D2F9 45%, #A49EFF 100%);
}
.plan-badge {
	position: absolute;
	top: -22rpx;
	left: 50%;
	transform: translateX(-50%);
	padding: 0rpx 20rpx;
	padding-bottom: 5rpx;
	border-radius: 999rpx;
	background: linear-gradient(to right, #FFDEA5, #FFAA54);
	white-space: nowrap;
}
.plan-badge-t {
	font-size: 18rpx;
	font-weight: 600;
	color: #191919;
	line-height: 1.2;
	white-space: nowrap;
}
.plan-name {
	font-family: $selah-font-display;
	font-size: 30rpx;
	font-weight: 700;
	color: #191919;
	line-height: 1.3;
}
.plan-price-col {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 6rpx;
}
.plan-price {
	font-family: $selah-font-display;
	font-size: 44rpx;
	font-weight: 700;
	color: #191919;
	line-height: 1.15;
}
.plan-was {
	font-size: 24rpx;
	color: rgba(25, 25, 25, 0.42);
	text-decoration: line-through;
	line-height: 1.2;
}
.plan-hint {
	font-size: 22rpx;
	color: rgba(25, 25, 25, 0.62);
	line-height: 1.35;
}
.dock {
	margin-top: auto;
	padding-top: 12rpx;
}
.cta-sub {
	display: block;
	text-align: center;
	font-size: 24rpx;
	line-height: 1.4;
	color: rgba(25, 25, 25, 0.72);
	padding: 0 12rpx 20rpx;
}
.cta {
	padding: 32rpx 24rpx;
	border-radius: 32rpx;
	background: #191919;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.cta-text {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
	line-height: normal;
}
.foot {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 8rpx 8rpx;
}
.foot-link {
	flex: 1;
	text-align: center;
	font-size: 22rpx;
	line-height: normal;
	color: #191919;
	opacity: 0.6;
}
.success-mask {
	position: absolute;
	inset: 0;
	z-index: 50;
	background: rgba(25, 25, 25, 0.45);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	box-sizing: border-box;
}
.success-card {
	width: 100%;
	max-width: 560rpx;
  background: linear-gradient(180deg, #FFE3AB 0%, #FFFFFF 50%, #FFFFFF 100%);
	border-radius: 40rpx;
	padding: 48rpx 40rpx 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	box-sizing: border-box;
}
.success-ico {
	width: 144rpx;
	height: 144rpx;
	margin-bottom: 28rpx;
}
.success-title {
	font-family: $selah-font-display;
	font-size: 40rpx;
	font-weight: 700;
	color: #191919;
	text-align: center;
	margin-bottom: 16rpx;
}
.success-body {
	font-size: 28rpx;
	line-height: 1.45;
	color: rgba(25, 25, 25, 0.72);
	text-align: center;
	margin-bottom: 40rpx;
}
.success-cta {
	width: 100%;
	padding: 28rpx 24rpx;
	border-radius: 32rpx;
	background: #191919;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.success-cta-t {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
}
</style>
