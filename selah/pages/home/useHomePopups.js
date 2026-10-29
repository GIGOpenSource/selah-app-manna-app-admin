/**
 * 首页 widget / 会员折扣弹窗：按独立曝光计数触发，且不与签到、新人、VIP 锁叠层。
 */
import { ref } from 'vue'
import {
	WIDGET_NUDGE_VIEWS,
	DISCOUNT_NUDGE_VIEWS,
	canShowWidgetNudge,
	canShowDiscountNudge,
	markWidgetNudgeShown,
	markDiscountNudgeShown,
} from '@/utils/homePopups.js'

/**
 * @param {{
 *   user: import('vue').Ref,
 *   deps: Record<string, any>,
 * }} opts
 * deps 回填：checkinPopup / showLikeSheet / vipLockOpen
 */
export function useHomePopups({ user, deps }) {
	const widgetNudgeOpen = ref(false)
	const discountNudgeOpen = ref(false)
	const viewedIds = new Set()

	function otherLayerOpen() {
		const settled = deps.getCheckinSettled
		if (typeof settled === 'function' && !settled()) return true
		const checkin = deps.checkinPopup
		if (checkin && checkin.value) return true
		const likeSheet = deps.showLikeSheet
		if (likeSheet && likeSheet.value) return true
		const vipLock = deps.vipLockOpen
		if (vipLock && vipLock.value) return true
		return widgetNudgeOpen.value || discountNudgeOpen.value
	}

	function tryShowHomePopups() {
		if (otherLayerOpen()) return
		const n = viewedIds.size
		const u = user.value || {}
		if (n >= WIDGET_NUDGE_VIEWS && canShowWidgetNudge(u)) {
			widgetNudgeOpen.value = true
			markWidgetNudgeShown()
			return
		}
		if (n >= DISCOUNT_NUDGE_VIEWS && canShowDiscountNudge(u)) {
			discountNudgeOpen.value = true
			markDiscountNudgeShown()
		}
	}

	/** 首页每条独立曝光计一次；达到阈值后再尝试弹层。 */
	function noteHomeView(id) {
		if (id == null || id === '') return
		const key = String(id)
		if (viewedIds.has(key)) return
		viewedIds.add(key)
		tryShowHomePopups()
	}

	function closeWidgetNudge() {
		if (!widgetNudgeOpen.value) return
		widgetNudgeOpen.value = false
		tryShowHomePopups()
	}

	function closeDiscountNudge() {
		if (!discountNudgeOpen.value) return
		discountNudgeOpen.value = false
	}

	return {
		widgetNudgeOpen,
		discountNudgeOpen,
		noteHomeView,
		tryShowHomePopups,
		closeWidgetNudge,
		closeDiscountNudge,
	}
}
