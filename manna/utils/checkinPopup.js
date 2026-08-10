/**
 * 打卡弹层文案本地化（首页自动弹层 / 打卡页手动结果共用）。
 *
 * scenario：
 * - normal  : 普通签到成功
 * - restart : 断签重启（可能因 no_hearts 冻心耗尽）
 * - revive  : 冻心复活连续天数
 * hit_cap   : 额度已达上限，不发奖励文案改提示封顶
 *
 * @param {object} data 打卡接口 results
 * @param {Function} t i18n
 * @param {{ miss_reset_days?: number }} [opts] 可选覆盖断签天数（来自 app-config）
 */
export function localizeCheckinPopup(data, t, opts = {}) {
	const streak = data.streak_days || 0
	const scenario = data.scenario || 'normal'
	const missDays = Number(data.miss_reset_days || opts.miss_reset_days || 3) || 3
	let title = t('checkin_pop_title')
	let subtitle = streak > 0 ? t('checkin_pop_sub', { n: streak }) : t('checkin_pop_sub_start')
	if (scenario === 'restart') {
		title = t('checkin_restart_title')
		subtitle = (data.popup && data.popup.reason === 'no_hearts')
			? t('checkin_restart_hearts')
			: t('checkin_restart_sub', { n: missDays })
	} else if (scenario === 'revive') {
		title = t('checkin_revive_title')
		subtitle = t('checkin_revive_sub', { n: streak })
	}
	let quotaLine = ''
	if ((data.granted_quota || 0) > 0) {
		quotaLine = t('checkin_quota_line', { n: data.granted_quota })
	} else if (data.hit_cap) {
		quotaLine = t('checkin_quota_cap')
	}
	return {
		...(data.popup || {}),
		title,
		subtitle,
		cta: t('checkin_pop_cta'),
		quota_line: quotaLine,
	}
}
