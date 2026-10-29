<!--
  VIP 试用面板 — 与 pagesA/vip/vip 同款内容（渐变 / 关闭 / 时间线 / Reminder / CTA / 价签 / 底栏）
  mode=overlay：全屏弹层；mode=page：独立页根节点
-->
<template>
	<view :class="['vip-panel', mode === 'overlay' ? 'is-overlay' : 'is-page']">
		<view class="vip-grad" />

		<view class="close-wrap" :style="{ top: (statusBarPx + 12) + 'px' }" @tap.stop="onClose">
			<image class="close-ico" src="/static/ui/vip/ico-close.svg" mode="aspectFit" />
		</view>

		<scroll-view
			class="main-scroll"
			scroll-y
			:show-scrollbar="false"
			:bounces="false"
		>
			<view class="main" :style="{ paddingTop: (statusBarPx + 72) + 'px' }">
				<view class="intro">
					<text class="intro-title">{{ t('trial_how_title') }}</text>
					<text class="intro-sub">{{ t('trial_how_sub') }}</text>
				</view>

				<view class="timeline">
					<view
						v-for="(step, idx) in steps"
						:key="idx"
						class="step"
					>
						<image class="step-ico" :src="step.icon" mode="aspectFit" />
						<view class="step-copy">
							<text :class="['step-title', step.done ? 'done' : '']">{{ step.title }}</text>
							<text class="step-desc">{{ step.desc }}</text>
						</view>
					</view>
				</view>

				<view v-if="benefits.length" class="benefits">
					<text
						v-for="(b, i) in benefits"
						:key="i"
						class="benefit-line"
					>{{ b }}</text>
				</view>

				<view class="dock">
					<view v-if="info.vip_level === 'vip'" class="active">
						<text class="active-t">{{ t('vip_active') }}{{ info.is_trial ? ' ' + t('vip_trial_tag') : '' }}</text>
						<text v-if="info.vip_expire_at" class="exp">{{ t('vip_until', { date: info.vip_expire_at.slice(0, 10) }) }}</text>
					</view>

					<view class="remind-card" @tap.stop>
						<text class="remind-label">{{ t('trial_reminder') }}</text>
						<view
							:class="['tog', trialRemind ? 'on' : '']"
							@tap.stop="toggleRemind"
						>
							<view class="tog-knob" />
						</view>
					</view>

					<view v-if="trialAvailable" class="cta" @tap.stop="startFreeTrial">
						<text class="cta-text">{{ ctaText }}</text>
					</view>

					<view class="price">
						<view class="price-hit" @tap.stop="payWithPlan('monthly')">
							<text class="price-plain">{{ pricePrefix }}</text>
						</view>
						<view class="price-hit" @tap.stop="payWithPlan('yearly')">
							<text class="price-bold">{{ priceYearly }}</text>
						</view>
					</view>

					<view class="foot">
						<text class="foot-link" @tap.stop="restore">{{ t('restore_short') }}</text>
						<text class="foot-link" @tap.stop="openLegalPage('subscription')">{{ t('legal_terms_full') }}</text>
						<text class="foot-link" @tap.stop="openOtherPlans">{{ t('other') }}</text>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiVipPlans, apiVipStartTrial, apiVipVerify, apiVipRestore } from '@/api/membership.js'
import { getUser, setUser } from '@/utils/session.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { isVipActive } from '@/utils/vip.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { VIP_PLANS_KEY } from '@/utils/wallpaperCache.js'
import { APP_KEY } from '@/config/config.js'
import { cmsText } from '@/utils/cmsI18n.js'
import { t, getLocale } from '@/i18n/index.js'
import { purchaseIap, restoreIapPurchases, finishIapTransaction } from '@/utils/iap.js'
import { setTrialEndReminder } from '@/utils/reminder.js'
import { requestNotificationPermission } from '@/utils/alarm.js'

const props = defineProps({
	/** page | overlay */
	mode: { type: String, default: 'overlay' },
	payTriggerSource: { type: String, default: 'quote_lock' },
	lockContentId: { type: [Number, String], default: '' },
})

const emit = defineEmits(['close', 'activated'])

const { locale } = useI18n()
const statusBarPx = getStatusBarPx()
const info = ref({})
const trialDays = ref(null)
const selected = ref('yearly')
const planOptions = ref([])
const benefits = ref([])
const ctaText = ref(t('try_for_zero'))
const trialAvailable = ref(false)
const trialRemind = ref(uni.getStorageSync('vip_trial_remind') === true)
const paying = ref(false)
let trackedOpen = false

function localizeBenefits(list) {
	const n = Number(info.value.vip_daily_quota) || 100
	const defaults = [
		t('vip_benefit_topics'),
		t('vip_benefit_watermark'),
		t('vip_benefit_ai', { n }),
	]
	const rows = (Array.isArray(list) ? list : []).filter(Boolean)
	if (!rows.length) return defaults
	const localeNow = getLocale() || 'en'
	if (localeNow === 'en') return rows
	return rows.map((b, i) => {
		const raw = String(b || '')
		if (/unlock vip topics/i.test(raw)) return t('vip_benefit_topics')
		if (/watermark/i.test(raw)) return t('vip_benefit_watermark')
		if (/ai messages/i.test(raw)) return t('vip_benefit_ai', { n })
		if (i < defaults.length && /^[\x00-\x7F]*$/.test(raw)) return defaults[i]
		return raw
	})
}

const MONTH_KEYS = [
	'month_jan', 'month_feb', 'month_mar', 'month_apr', 'month_may', 'month_jun',
	'month_jul', 'month_aug', 'month_sep', 'month_oct', 'month_nov', 'month_dec',
]

function formatVipDay(date) {
	const loc = String(getLocale() || locale.value || 'en')
	const month = t(MONTH_KEYS[date.getMonth()])
	const day = date.getDate()
	if (loc.startsWith('zh') || loc === 'ja') return `${month}${day}日`
	if (loc === 'ko') return `${month} ${day}일`
	return `${String(day).padStart(2, '0')} ${month}`
}

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

function addDays(base, n) {
	const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
	d.setDate(d.getDate() + n)
	return d
}

function planMoney() {
	const plan = findPlan('yearly') || {}
	const yearly = (plan.price_display || '').trim()
	const cents = Number(plan.price_cents || 0)
	const currency = (plan.currency || 'USD').toUpperCase()
	const symbol = currency === 'CNY' || currency === 'JPY' ? '¥' : currency === 'USD' ? '$' : ''

	let yearlyLabel = yearly
	if (!yearlyLabel && cents > 0) {
		yearlyLabel = `${symbol}${(cents / 100).toFixed(2)}`
	}
	if (!yearlyLabel) yearlyLabel = '—'

	let monthlyLabel = ''
	if (cents > 0) {
		monthlyLabel = `${symbol}${(cents / 100 / 12).toFixed(2)}`
	} else if (yearly && /[\d.]+/.test(yearly)) {
		const num = parseFloat(String(yearly).replace(/[^\d.]/g, ''))
		if (!Number.isNaN(num) && num > 0) {
			const sym = String(yearly).replace(/[\d.,\s]/g, '')[0] || symbol
			monthlyLabel = `${sym}${(num / 12).toFixed(2)}`
		}
	}
	return { yearlyLabel, monthlyLabel }
}

const pricePrefix = computed(() => {
	const { monthlyLabel } = planMoney()
	if (monthlyLabel) {
		return t('vip_billed_prefix', { monthly: monthlyLabel })
	}
	return t('vip_billed_prefix_short')
})

const priceYearly = computed(() => {
	const { yearlyLabel } = planMoney()
	return t('vip_billed_yearly', { yearly: yearlyLabel })
})

const steps = computed(() => {
	const raw = Number(trialDays.value)
	const n = Number.isFinite(raw) && raw > 0 ? raw : 3
	const today = new Date()
	const memberAt = addDays(today, n)
	const remindAt = addDays(today, Math.max(n - 1, 0))
	return [
		{
			icon: '/static/ui/vip/ico-step-install.svg',
			title: t('trial_step_install'),
			desc: t('trial_step_install_desc'),
			done: true,
		},
		{
			icon: '/static/ui/vip/ico-step-trial.svg',
			title: t('trial_step_start'),
			desc: t('trial_step_start_desc', { n }),
			done: false,
		},
		{
			icon: '/static/ui/vip/ico-step-remind.svg',
			title: t('trial_step_remind', { date: formatVipDay(remindAt) }),
			desc: t('trial_step_remind_desc'),
			done: false,
		},
		{
			icon: '/static/ui/vip/ico-step-member.svg',
			title: t('trial_step_member', { date: formatVipDay(memberAt) }),
			desc: t('trial_step_member_desc'),
			done: false,
		},
	]
})

function paywallSource(src) {
	const s = String(src || '')
	if (/topic|explore/i.test(s)) return 'topic'
	if (/wallpaper|theme/i.test(s)) return 'theme'
	if (/ai|prayer/i.test(s)) return 'prayer'
	return s
}

function trackOpen() {
	if (trackedOpen) return
	trackedOpen = true
	const src = props.payTriggerSource || 'quote_lock'
	try { logFirebaseEvent('paywall_show', { source: paywallSource(src) }) } catch (e) {}
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
				trialDays.value = Number.isFinite(td) && td > 0 ? td : null
				benefits.value = localizeBenefits(info.value.benefits)
				ctaText.value = cmsText(info.value.cta_text, 'try_for_zero') || t('try_for_zero')
				trialAvailable.value = info.value.trial_available === true || info.value.trial_available === 1 || info.value.trial_available === '1'
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
				if (trialRemind.value) {
					const saved = uni.getStorageSync('vip_trial_remind_schedule') || {}
					if (!saved.end_at) syncTrialReminder(true)
				}
			},
		)
	} catch (e) {}
}

function applyDismissCooldown() {
	try {
		if (!isVipActive()) {
			const until = Date.now() + 30000
			uni.setStorageSync('selah_vip_cooldown_until', until)
			const qid = Number(props.lockContentId || uni.getStorageSync('selah_vip_lock_content_id') || 0)
			if (qid) uni.setStorageSync('selah_vip_dismiss_content_id', qid)
			uni.removeStorageSync('selah_vip_lock_content_id')
		}
	} catch (e) {}
}

function onClose() {
	try { logFirebaseEvent('paywall_close_click') } catch (e) {}
	applyDismissCooldown()
	emit('close')
}

function openOtherPlans() {
	const src = props.payTriggerSource || 'other'
	uni.navigateTo({
		url: `/pagesA/vip/plans?pay_trigger_source=${encodeURIComponent(src)}`,
		fail: () => {
			uni.redirectTo({
				url: `/pagesA/vip/plans?pay_trigger_source=${encodeURIComponent(src)}`,
			})
		},
	})
}

function trialEndAt() {
	const user = getUser() || {}
	if (user.is_trial && user.vip_expire_at) return user.vip_expire_at
	const n = Number(trialDays.value)
	const days = Number.isFinite(n) && n > 0 ? n : 3
	return addDays(new Date(), days).getTime()
}

function syncTrialReminder(enabled) {
	setTrialEndReminder({
		enabled: !!enabled,
		endAt: enabled ? trialEndAt() : null,
	})
}

function toggleRemind() {
	try { logFirebaseEvent('trial_reminder_click') } catch (e) {}
	trialRemind.value = !trialRemind.value
	if (trialRemind.value) requestNotificationPermission()
	try {
		syncTrialReminder(trialRemind.value)
		logFirebaseEvent('trial_reminder_save_result', { trial_reminder_result: !!trialRemind.value })
	} catch (e) {
		try { logFirebaseEvent('trial_reminder_save_result', { trial_reminder_result: false }) } catch (err) {}
	}
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

function trialUserFrom(res) {
	const results = res?.results
	if (!results || typeof results !== 'object') return null
	if (results.user && typeof results.user === 'object') return results.user
	if (results.vip_level || results.is_trial != null || results.vip_expire_at) return results
	return null
}

/** 主 CTA「免费试用」：直调试用接口，不拉起商店支付 */
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
		uni.showToast({ title: t('vip_activated'), icon: 'none' })
		emit('activated', user)
	} catch (e) {
		try { logFirebaseEvent('purchase_flow_result', { purchase_result: 'fail2' }) } catch (err) {}
		const msg = String((e && (e.msg || e.message)) || '')
		uni.showToast({ title: msg || t('network_error'), icon: 'none' })
	} finally {
		paying.value = false
	}
}

async function payWithPlan(planType) {
	if (paying.value) return
	const kind = String(planType || selected.value || 'yearly').toLowerCase()
	const plan = findPlan(kind) || {}
	const platform = devicePlatform()
	const src = props.payTriggerSource || 'quote_lock'
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
		if (alreadyVip || res.results?.already) {
			if (res.results?.user) setUser(res.results.user)
			try { logFirebaseEvent('purchase_flow_result', { purchase_result: 'suc' }) } catch (e) {}
			try { logFirebaseEvent('subscription_entitlement_result') } catch (e) {}
			const prev = res.results?.user
			if (trialRemind.value && prev?.is_trial && prev?.vip_expire_at) {
				setTrialEndReminder({ enabled: true, endAt: prev.vip_expire_at })
			}
			return
		}
		setUser(res.results.user)
		try { logFirebaseEvent('purchase_flow_result', { purchase_result: 'suc' }) } catch (e) {}
		try { logFirebaseEvent('subscription_entitlement_result') } catch (e) {}
		info.value.vip_level = 'vip'
		info.value.is_trial = !!res.results.user?.is_trial
		info.value.vip_expire_at = res.results.user?.vip_expire_at
		if (trialRemind.value && res.results.user?.is_trial && res.results.user?.vip_expire_at) {
			setTrialEndReminder({ enabled: true, endAt: res.results.user.vip_expire_at })
		}
		uni.showToast({ title: t('vip_activated'), icon: 'none' })
		emit('activated', res.results.user)
	} catch (e) {
		try { logFirebaseEvent('purchase_flow_result', { purchase_result: purchaseResultCode(e) }) } catch (err) {}
		payFailToast(e)
	} finally {
		paying.value = false
	}
}

async function restore() {
	if (paying.value) return
	const platform = devicePlatform()
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
			emit('activated', last.results.user)
			try { logFirebaseEvent('paywall_restore_result', { restore_result: 'suc' }) } catch (e) {}
			try { logFirebaseEvent('subscription_entitlement_result') } catch (e) {}
		} else {
			try { logFirebaseEvent('paywall_restore_result', { restore_result: 'fail2' }) } catch (e) {}
		}
		uni.showToast({ title: t('restored'), icon: 'none' })
	} catch (e) {
		try { logFirebaseEvent('paywall_restore_result', { restore_result: 'fail2' }) } catch (err) {}
		payFailToast(e)
	} finally {
		paying.value = false
	}
}

onMounted(() => {
	trackOpen()
	loadPlans()
})

watch(
	() => props.payTriggerSource,
	() => {
		trackedOpen = false
		trackOpen()
	},
)
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.vip-panel {
	position: relative;
	width: 100%;
	height: 100vh;
	height: 100dvh;
	background: #fbf8f2;
	box-sizing: border-box;
	overflow: hidden;
}
.vip-panel.is-overlay {
	position: fixed;
	inset: 0;
	z-index: 1000;
}
.vip-grad {
	position: absolute;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background: linear-gradient(180deg, #fff0d9 0%, #f5f5f5 97.115%);
}
.close-wrap {
	position: absolute;
	right: 32rpx;
	z-index: 30;
	width: 72rpx;
	height: 72rpx;
}
.vip-panel.is-overlay .close-wrap {
	position: fixed;
}
.close-ico {
	width: 72rpx;
	height: 72rpx;
}
.main-scroll {
	position: relative;
	z-index: 5;
	width: 100%;
	height: 100%;
	box-sizing: border-box;
}
.main {
	display: flex;
	flex-direction: column;
	padding-left: 32rpx;
	padding-right: 32rpx;
	padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}
.intro {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 24rpx;
	padding: 0 0 32rpx;
	text-align: center;
}
.intro-title {
	font-family: $selah-font-display;
	font-size: 48rpx;
	font-weight: 700;
	line-height: normal;
	color: #191919;
	width: 100%;
	text-align: center;
}
.intro-sub {
	font-size: 28rpx;
	font-weight: 400;
	line-height: normal;
	color: #191919;
	width: 100%;
	text-align: center;
}
.benefits {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
	padding: 8rpx 8rpx 28rpx;
}
.benefit-line {
	font-size: 26rpx;
	line-height: 1.4;
	color: rgba(25, 25, 25, 0.72);
}
.timeline {
	display: flex;
	flex-direction: column;
	gap: 48rpx;
	padding: 48rpx 32rpx;
	background: #fffbf5;
	border: 2rpx solid #191919;
	border-radius: 48rpx;
	box-sizing: border-box;
}
.step {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 28rpx;
}
.step-ico {
	width: 72rpx;
	height: 72rpx;
	flex-shrink: 0;
}
.step-copy {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}
.step-title {
	font-family: $selah-font-display;
	font-size: 40rpx;
	font-weight: 700;
	line-height: normal;
	color: #191919;
}
.step-title.done {
	text-decoration: line-through;
}
.step-desc {
	font-size: 28rpx;
	font-weight: 400;
	line-height: normal;
	color: #191919;
}
.dock {
	padding-top: 16rpx;
	box-sizing: border-box;
}
.active {
	margin-bottom: 16rpx;
	padding: 24rpx 28rpx;
	background: #ffffff;
	border-radius: 32rpx;
}
.active-t {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #191919;
	line-height: 1.35;
}
.exp {
	display: block;
	margin-top: 10rpx;
	font-size: 28rpx;
	color: #5c5c5c;
	line-height: 1.4;
}
.remind-card {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 32rpx 24rpx;
	background: #ffffff;
	border-radius: 32rpx;
	margin-bottom: 24rpx;
	box-sizing: border-box;
}
.remind-label {
	font-size: 28rpx;
	color: #191919;
	line-height: normal;
}
.tog {
	width: 120rpx;
	height: 56rpx;
	border-radius: 28rpx;
	background: #bdb8b4;
	padding: 4rpx;
	box-sizing: border-box;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-start;
	flex-shrink: 0;
	transition: background 0.2s ease;
}
.tog.on {
	background: #191919;
	justify-content: flex-end;
}
.tog-knob {
	width: 70rpx;
	height: 48rpx;
	border-radius: 28rpx;
	background: #ffffff;
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
.price {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;
	padding: 24rpx 20rpx 0;
	box-sizing: border-box;
}
.price-hit {
	padding: 8rpx 4rpx;
}
.price-plain {
	font-size: 28rpx;
	font-weight: 400;
	line-height: normal;
	color: #191919;
	text-align: center;
}
.price-bold {
	font-size: 28rpx;
	font-weight: 600;
	line-height: normal;
	color: #191919;
	text-align: center;
}
.foot {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 20rpx 8rpx;
}
.foot-link {
	flex: 1;
	text-align: center;
	font-size: 22rpx;
	line-height: normal;
	color: #191919;
	opacity: 0.6;
}
</style>
