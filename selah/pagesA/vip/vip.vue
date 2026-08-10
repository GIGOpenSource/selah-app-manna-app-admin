<!--
  VIP 订阅试用页 — 对齐 Figma 9:1538「How your free trial works」
  结构：奶油渐变 · 右上关闭 · 标题/副标题 · 四步时间线白卡 · Reminder · 黑 CTA · 价签 · Restore/Terms/Other
-->
<template>
	<view class="vip">
		<view class="vip-grad" />

		<view class="close-wrap" :style="{ top: (statusBarPx + 18) + 'px' }" @tap.stop="goBack">
			<image class="close-ico" src="/static/ui/vip/ico-close.svg" mode="aspectFit" />
		</view>

		<view class="main" :style="{ paddingTop: (statusBarPx + 64) + 'px' }">
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

				<view class="cta" @tap="pay">
					<text class="cta-text">{{ ctaText }}</text>
				</view>

				<view class="price">
					<text class="price-plain">{{ pricePrefix }}</text>
					<text class="price-bold">{{ priceYearly }}</text>
				</view>

				<view class="foot">
					<text class="foot-link" @tap="restore">{{ t('restore_short') }}</text>
					<text class="foot-link" @tap="openLegalPage('subscription')">{{ t('legal_terms_full') }}</text>
					<text class="foot-link" @tap="goBack">{{ t('other') }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
/**
 * Figma 9:1538：试用时间线 + Reminder + Try $0；价签由年付 SKU 组装；开关仅本地偏好。
 */
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiVipPlans, apiVipVerify, apiVipRestore } from '@/api/membership.js'
import { setUser } from '@/utils/session.js'
import { track } from '@/utils/analytics.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { VIP_PLANS_KEY } from '@/utils/wallpaperCache.js'
import { APP_KEY } from '@/config/config.js'

const { t, locale } = useI18n()
const statusBarPx = getStatusBarPx()
const info = ref({})
const trialDays = ref(null)
const selected = ref('yearly')
const planOptions = ref([])
const benefits = ref([])
const ctaText = ref('Try for $0.00')
const payTrigger = ref('other')
const trialRemind = ref(uni.getStorageSync('vip_trial_remind') === true)

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const currentPlan = computed(() =>
	planOptions.value.find((p) => p.plan_id === selected.value) || planOptions.value[0] || {}
)

function addDays(base, n) {
	const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
	d.setDate(d.getDate() + n)
	return d
}

function formatVipDay(date) {
	const loc = String(locale.value || 'en')
	if (loc.startsWith('zh')) {
		return `${date.getMonth() + 1}月${date.getDate()}日`
	}
	const day = String(date.getDate()).padStart(2, '0')
	return `${day} ${MONTHS_EN[date.getMonth()]}`
}

function planMoney() {
	const plan = currentPlan.value
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
	const { yearlyLabel, monthlyLabel } = planMoney()
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
	// 提醒 / 扣费：相对打开页当日固定 +2 / +3（与试用文案天数解耦）
	const today = new Date()
	const remindAt = addDays(today, 2)
	const memberAt = addDays(today, 3)
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

onLoad((q) => {
	payTrigger.value = q.pay_trigger_source || 'other'
	track('vip_page_view', { pay_trigger_source: payTrigger.value })
	track('vip_popup_show', { pay_trigger_source: payTrigger.value, lock_content_id: '' })
})

onMounted(async () => {
	try {
		await loadWithCache(
			VIP_PLANS_KEY,
			async () => (await apiVipPlans()).results || {},
			(results) => {
				info.value = results || {}
				const td = Number(info.value.trial_days)
				trialDays.value = Number.isFinite(td) && td > 0 ? td : null
				benefits.value = Array.isArray(info.value.benefits)
					? info.value.benefits.filter(Boolean)
					: []
				ctaText.value = (info.value.cta_text || '').trim() || t('try_for_zero')
				const products = (info.value.products || []).filter((p) => {
					const ak = (p.app_key || '').trim()
					return !ak || ak === APP_KEY
				})
				const sys = uni.getSystemInfoSync?.() || {}
				const platform = /android/i.test(sys.platform || sys.osName || '') ? 'android' : 'ios'
				const byPlan = {}
				products.forEach((p) => {
					if (p.platform && p.platform !== platform) return
					byPlan[p.plan_id || p.plan_type || 'monthly'] = p
				})
				planOptions.value = Object.values(byPlan)
				if (!planOptions.value.length && products[0]) {
					planOptions.value = [{
						...products[0],
						plan_id: products[0].plan_id || products[0].plan_type || 'yearly',
					}]
				}
				selected.value = planOptions.value.find((p) => p.plan_id === 'yearly')?.plan_id
					|| planOptions.value[0]?.plan_id
					|| 'yearly'
			},
		)
	} catch (e) {}
})

function goBack() {
	safeBack('/pages/home/home')
}

function toggleRemind() {
	trialRemind.value = !trialRemind.value
	uni.setStorageSync('vip_trial_remind', trialRemind.value)
}

async function pay() {
	const plan = currentPlan.value
	const sys = uni.getSystemInfoSync?.() || {}
	const platform = /android/i.test(sys.platform || sys.osName || '') ? 'android' : 'ios'
	track('vip_plan_select', {
		plan_id: plan.plan_id || selected.value,
		plan_type: plan.plan_type || selected.value,
		pay_trigger_source: payTrigger.value,
	})
	track('vip_pay_start', {
		plan_id: plan.plan_id || selected.value,
		pay_trigger_source: payTrigger.value,
	})
	try {
		const tx = 'sandbox_' + Date.now()
		const res = await apiVipVerify({
			platform: plan.platform || platform,
			product_id: plan.product_id || plan.store_product_id,
			transaction_id: tx,
			sandbox: true,
			is_trial: true,
			pay_trigger_source: payTrigger.value,
		})
		setUser(res.results.user)
		info.value.vip_level = 'vip'
		info.value.is_trial = true
		info.value.vip_expire_at = res.results.user?.vip_expire_at
		track('vip_pay_success', {
			plan_id: plan.plan_id || selected.value,
			order_id: tx,
			pay_trigger_source: payTrigger.value,
			is_trial: true,
		})
		track('vip_trial_start', { plan_id: plan.plan_id || selected.value })
		uni.showToast({ title: t('vip_activated'), icon: 'none' })
	} catch (e) {
		track('vip_pay_fail', {
			plan_id: plan.plan_id || selected.value,
			reason: String((e && e.message) || 'fail'),
		})
	}
}

async function restore() {
	track('vip_restore_click', { platform: 'ios' })
	uni.showModal({
		title: t('restore_purchases'),
		editable: true,
		placeholderText: 'transaction_id',
		success: async (r) => {
			if (!r.confirm) return
			try {
				const res = await apiVipRestore({ transaction_id: r.content })
				setUser(res.results.user)
				track('vip_restore_result', { success: true })
				uni.showToast({ title: t('restored'), icon: 'none' })
			} catch (e) {
				track('vip_restore_result', { success: false, reason: 'not_found' })
			}
		},
	})
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.vip {
	position: relative;
	width: 100%;
	min-height: 100vh;
	overflow-x: hidden;
	overflow-y: auto;
	background: #fbf8f2;
	box-sizing: border-box;
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
	z-index: 20;
	width: 72rpx;
	height: 72rpx;
}
.close-ico {
	width: 72rpx;
	height: 72rpx;
}
.main {
	position: relative;
	z-index: 5;
	display: flex;
	flex-direction: column;
	min-height: 100vh;
	padding-left: 32rpx;
	padding-right: 32rpx;
	padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
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
	margin-top: auto;
	padding-top: 32rpx;
	box-sizing: border-box;
}
.active {
	margin-bottom: 16rpx;
	padding: 20rpx 24rpx;
	background: #ffffff;
	border-radius: 32rpx;
}
.active-t {
	font-size: 26rpx;
	color: #191919;
}
.exp {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #8a8a8a;
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
