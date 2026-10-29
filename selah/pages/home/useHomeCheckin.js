/**
 * 首页签到弹窗与 localize。
 */
import { ref, computed } from 'vue'
import { apiCheckinDo } from '@/api/checkin.js'
import { getUser, setUser } from '@/utils/session.js'
import { logFirebaseEvent } from '@/utils/firebase.js'
import { localizeCheckinPopup } from '@/utils/checkinPopup.js'
import { buildStreakProgressWeek, streakWeekLabels, resolveStreakDays } from '@/utils/streakWeek.js'

/**
 * @param {{
 *   t: Function,
 *   config: import('vue').Ref,
 *   user: import('vue').Ref,
 *   maybeShowNewcomerSheet: Function,
 *   setCheckinSettled: Function,
 * }} opts
 */
export function useHomeCheckin({
	t,
	config,
	user,
	maybeShowNewcomerSheet,
	setCheckinSettled,
}) {
	const checkinPopup = ref(null)
	const week = ref([])
	const checkinDialogExtra = computed(() => ({
		quotaLine: (checkinPopup.value && checkinPopup.value.quota_line) || '',
		week: week.value || [],
	}))

	function onCheckinDialogVisible(v) {
		if (!v) {
			checkinPopup.value = null
			maybeShowNewcomerSheet()
		}
	}

	/** 将签到结果交给 localizeCheckinPopup 做 i18n 文案。 */
	function localizeCheckinPopupLocal(data) {
		const miss = Number((config.value || {}).streak_miss_reset_days)
		return localizeCheckinPopup(data, t, {
			miss_reset_days: Number.isFinite(miss) && miss > 0 ? miss : undefined,
		})
	}

	function todayKey() {
		const d = new Date()
		const m = String(d.getMonth() + 1).padStart(2, '0')
		const day = String(d.getDate()).padStart(2, '0')
		return `${d.getFullYear()}-${m}-${day}`
	}

	function recordEnabled() {
		const sessionUser = getUser()
		if (sessionUser && typeof sessionUser === 'object') user.value = sessionUser
		return user.value?.checkin_record_enabled !== false
	}

	/**
	 * 进首页：当天未打卡才走 /checkin/do/；已打卡直接跳过。
	 * 打卡记录开着且本次为新打卡 → 弹窗；开关关着 → 静默打卡不弹。
	 */
	async function runCheckin() {
		const day = todayKey()
		// 本地已记「今日已打卡」则不再请求
		if (uni.getStorageSync('selah_checkin_done_day') === day
			|| uni.getStorageSync('selah_checkin_popup_day') === day) {
			setCheckinSettled(true)
			maybeShowNewcomerSheet()
			return
		}
		setCheckinSettled(false)
		const showPopup = recordEnabled()
		try {
			const res = await apiCheckinDo()
			const data = res.results || {}
			const days = resolveStreakDays(data, user.value?.checkin_streak || 0)
			week.value = buildStreakProgressWeek(days, data.week || [], streakWeekLabels(t))
			if (data.user || days > 0) {
				const next = {
					...(data.user || user.value || {}),
					checkin_record_enabled: user.value?.checkin_record_enabled !== false,
					checkin_streak: days > 0
						? days
						: Number((data.user && data.user.checkin_streak) || user.value?.checkin_streak || 0),
				}
				setUser(next)
				user.value = next
			}
			// 无论新打卡还是 already，都记为今日已打卡，后续进首页不再走
			uni.setStorageSync('selah_checkin_done_day', day)
			uni.setStorageSync('selah_checkin_popup_day', day)

			if (data.already) {
				checkinPopup.value = null
				return
			}
			try { logFirebaseEvent('daily_checkin_result', { streak_days: days }) } catch (e) {}
			try { logFirebaseEvent('reward_grant_result', { rewardCount: Number(data.granted_quota || 0) }) } catch (e) {}


			if (showPopup) {
				checkinPopup.value = localizeCheckinPopupLocal(data)
				try { logFirebaseEvent('daily_checkin_show') } catch (e) {}
			} else {
				checkinPopup.value = null
			}
		} catch (e) {
			try { logFirebaseEvent('reward_grant_result', { rewardCount: 0 }) } catch (err) {}
		} finally {
			setCheckinSettled(true)
			maybeShowNewcomerSheet()
		}
	}

	return {
		checkinPopup,
		week,
		checkinDialogExtra,
		onCheckinDialogVisible,
		localizeCheckinPopupLocal,
		runCheckin,
	}
}
