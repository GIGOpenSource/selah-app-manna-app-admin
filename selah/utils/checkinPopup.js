/**
 * 打卡弹层文案本地化（首页自动弹层 / 打卡页手动结果共用）。
 *
 * scenario：
 * - normal  : 普通签到成功
 * - restart : 断签重启（可能因 no_hearts 冻心耗尽）
 * - revive  : 冻心复活；copy_key 三选一（与后端随机池对齐）
 * hit_cap   : 额度已达上限，不发奖励文案改提示封顶
 *
 * 注意：必须用 @/i18n 导出的 t（含 {n} 手动插值兜底）；
 * useI18n().t 在部分 App 真机上会留下字面量 {n}。
 *
 * @param {object} data 打卡接口 results
 * @param {Function} [_t] 兼容旧调用；实际使用安全 t
 * @param {{ miss_reset_days?: number }} [opts] 可选覆盖断签天数（来自 app-config）
 */
import { t } from '@/i18n/index.js'
import { resolveStreakDays } from '@/utils/streakWeek.js'

const REVIVE_COPY = {
	revive_streak: {
		title: 'checkin_revive_title',
		subtitle: 'checkin_revive_sub_streak',
		cta: 'checkin_pop_cta',
	},
	revive_keep: {
		title: 'checkin_revive_title',
		subtitle: 'checkin_revive_sub_keep',
		cta: 'checkin_pop_cta',
	},
	revive_challenge7: {
		title: 'checkin_revive_title',
		subtitle: 'checkin_revive_sub_7',
		cta: 'checkin_challenge_cta',
	},
}

function reviveCopyKey(popup = {}) {
	const key = String(popup.copy_key || '')
	if (REVIVE_COPY[key]) return key
	if (popup.cta_key === 'challenge7') return 'revive_challenge7'
	return 'revive_streak'
}

export function localizeCheckinPopup(data, _t, opts = {}) {
	const streak = resolveStreakDays(data, 0)
	const scenario = data.scenario || 'normal'
	const popup = data.popup || {}
	const missDays = Number(data.miss_reset_days || opts.miss_reset_days || 3) || 3
	let title = t('checkin_pop_title')
	let subtitle = streak > 0 ? t('checkin_pop_sub', { n: streak }) : t('checkin_pop_sub_start')
	let cta = t('checkin_pop_cta')
	if (scenario === 'restart') {
		title = t('checkin_restart_title')
		subtitle = popup.reason === 'no_hearts'
			? t('checkin_restart_hearts')
			: t('checkin_restart_sub', { n: missDays })
	} else if (scenario === 'revive') {
		const pack = REVIVE_COPY[reviveCopyKey(popup)]
		title = t(pack.title)
		subtitle = t(pack.subtitle, { n: streak })
		cta = t(pack.cta)
	}
	let quotaLine = ''
	if ((data.granted_quota || 0) > 0) {
		quotaLine = t('checkin_quota_line', { n: data.granted_quota })
	} else if (data.hit_cap) {
		quotaLine = t('checkin_quota_cap')
	}
	return {
		...popup,
		title,
		subtitle,
		cta,
		quota_line: quotaLine,
	}
}
