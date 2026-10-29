/**
 * 首页运营弹窗（产品 §6）：
 * - widget 设置：未设置小组件时，刷满 4 条 Feed 后弹出；一周最多一次
 * - 会员折扣：从未开通过会员，注册满 7 天且刷满 10 条后弹出（每账号一次）
 *
 * 第二套 widget 弹窗文档标「不确定」，Learn how 进入 widgets 配置页作为下一步。
 */
import { isVipActive } from '@/utils/vip.js'
import { getUser } from '@/utils/session.js'

export const WIDGET_NUDGE_VIEWS = 4
export const DISCOUNT_NUDGE_VIEWS = 10
export const WIDGET_NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
export const DISCOUNT_NUDGE_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000

const KEY_WIDGET_SHOWN_AT = 'selah_home_widget_nudge_at'
const KEY_WIDGET_SETUP = 'selah_widget_setup_done'
const KEY_DISCOUNT_SHOWN = 'selah_home_discount_nudge_shown'
const KEY_FIRST_SEEN = 'selah_account_first_seen_at'

function readTs(key) {
	try {
		const n = Number(uni.getStorageSync(key) || 0)
		return Number.isFinite(n) ? n : 0
	} catch (e) {
		return 0
	}
}

function writeTs(key, ts) {
	try {
		uni.setStorageSync(key, ts)
	} catch (e) {}
}

function readFlag(key) {
	try {
		return !!uni.getStorageSync(key)
	} catch (e) {
		return false
	}
}

function writeFlag(key) {
	try {
		uni.setStorageSync(key, '1')
	} catch (e) {}
}

/** 用户走进小组件配置页 / 保存偏好后视为已设置，不再催。 */
export function markWidgetSetupDone() {
	writeFlag(KEY_WIDGET_SETUP)
}

export function isWidgetSetupDone() {
	if (readFlag(KEY_WIDGET_SETUP)) return true
	try {
		const last = uni.getStorageSync('widget_payload_last')
		if (last) return true
	} catch (e) {}
	return false
}

export function markWidgetNudgeShown() {
	writeTs(KEY_WIDGET_SHOWN_AT, Date.now())
}

export function markDiscountNudgeShown() {
	writeFlag(KEY_DISCOUNT_SHOWN)
}

function accountCreatedAt(user) {
	const u = user || getUser() || {}
	const raw = u.created_at || u.createdAt || ''
	const parsed = raw ? Date.parse(raw) : NaN
	if (Number.isFinite(parsed) && parsed > 0) return parsed
	let first = readTs(KEY_FIRST_SEEN)
	if (!first) {
		first = Date.now()
		writeTs(KEY_FIRST_SEEN, first)
	}
	return first
}

/** 历史上从未开通过会员（含试用）：当前非 VIP 且从未写过到期时间。 */
export function neverPurchasedMembership(user) {
	const u = user || getUser() || {}
	if (isVipActive(u) || u.is_vip_active) return false
	if (u.vip_expire_at || u.is_trial) return false
	const level = String(u.vip_level || '').toLowerCase()
	if (level === 'vip' || level === 'plus_vip') return false
	return true
}

export function canShowWidgetNudge(user) {
	void user
	if (isWidgetSetupDone()) return false
	const last = readTs(KEY_WIDGET_SHOWN_AT)
	if (last && Date.now() - last < WIDGET_NUDGE_COOLDOWN_MS) return false
	return true
}

export function canShowDiscountNudge(user) {
	const u = user || getUser() || {}
	if (readFlag(KEY_DISCOUNT_SHOWN)) return false
	if (!neverPurchasedMembership(u)) return false
	if (Date.now() - accountCreatedAt(u) < DISCOUNT_NUDGE_MIN_AGE_MS) return false
	return true
}
