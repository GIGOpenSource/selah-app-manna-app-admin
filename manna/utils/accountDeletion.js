/**
 * 账号注销冷静期：登录/冷启弹一次提示；设置页读 me 展示倒计时。
 * 不要在登录时自动调 cancel-delete。
 */
import { t } from '@/i18n/index.js'
import { apiCancelDelete } from '@/api/auth.js'
import { getUser, setUser } from '@/utils/session.js'

let promptQueued = false

export function isDeletionPending(user) {
	const u = user || getUser() || {}
	return !!u.deletion_pending
}

export function deletionDaysLeft(user) {
	const u = user || getUser() || {}
	const n = Number(u.days_left)
	if (!Number.isFinite(n) || n < 0) return null
	return Math.max(0, Math.ceil(n))
}

export function formatDeletionDate(iso) {
	if (!iso) return ''
	try {
		const d = new Date(iso)
		if (Number.isNaN(d.getTime())) return ''
		const y = d.getFullYear()
		const m = String(d.getMonth() + 1).padStart(2, '0')
		const day = String(d.getDate()).padStart(2, '0')
		return `${y}-${m}-${day}`
	} catch (e) {
		return ''
	}
}

export function deletionPromptContent(user) {
	const u = user || getUser() || {}
	const n = deletionDaysLeft(u)
	if (n != null) return t('deletion_pending_body', { n })
	const date = formatDeletionDate(u.deletion_scheduled_at)
	if (date) return t('deletion_pending_body_date', { date })
	return t('deletion_pending_body_fallback')
}

export function deletionCountdownText(user) {
	const u = user || getUser() || {}
	const n = deletionDaysLeft(u)
	if (n != null) return t('deletion_countdown', { n })
	const date = formatDeletionDate(u.deletion_scheduled_at)
	if (date) return t('deletion_countdown_date', { date })
	return t('deletion_countdown_fallback')
}

/** 登录成功或冷启拉 me 后调用；仅排队一次，不自动撤销 */
export function queueDeletionPrompt(user) {
	promptQueued = isDeletionPending(user)
}

export function takeDeletionPrompt() {
	if (!promptQueued) return false
	promptQueued = false
	return isDeletionPending(getUser())
}

export async function cancelAccountDeletion() {
	const res = await apiCancelDelete({}, { silentBizCodes: [400] })
	const user = res?.results
	if (user && typeof user === 'object') setUser(user)
	return user
}
