/**
 * Manna 徽章：新发暂存、功课跳转、品类 ICON。
 */
const STASH_KEY = 'manna_newly_earned'
const TAB_PATHS = {
	'/pages/home/home': true,
	'/pages/quiz/quiz': true,
	'/pages/devotion/list': true,
	'/pages/bible/bible': true,
	'/pages/profile/profile': true,
}

export function stashNewlyEarned(list) {
	const incoming = Array.isArray(list) ? list.filter(Boolean) : []
	if (!incoming.length) return
	let prev = []
	try {
		prev = uni.getStorageSync(STASH_KEY) || []
	} catch (e) {
		prev = []
	}
	if (!Array.isArray(prev)) prev = []
	const map = {}
	prev.concat(incoming).forEach((b) => {
		const key = String(b.code || b.id || '')
		if (key) map[key] = b
	})
	try {
		uni.setStorageSync(STASH_KEY, Object.keys(map).map((k) => map[k]))
	} catch (e) {}
}

export function takeNewlyEarned() {
	let list = []
	try {
		list = uni.getStorageSync(STASH_KEY) || []
		uni.removeStorageSync(STASH_KEY)
	} catch (e) {
		list = []
	}
	return Array.isArray(list) ? list : []
}

export function clearNewlyEarned() {
	try {
		uni.removeStorageSync(STASH_KEY)
	} catch (e) {}
}

export function goBadgeCta(path) {
	const raw = String(path || '').trim()
	if (!raw) return
	const base = raw.split('?')[0]
	if (TAB_PATHS[base]) {
		uni.switchTab({ url: base, fail: () => uni.navigateTo({ url: raw }) })
		return
	}
	uni.navigateTo({
		url: raw,
		fail: () => uni.switchTab({ url: '/pages/home/home' }),
	})
}

export function badgeTone(b) {
	const code = String(b?.code || b?.series || '')
	if (code.includes('quiz')) return 'quiz'
	if (code.includes('prayer') || code.includes('dawn') || code.includes('night') || code.includes('pray')) return 'pray'
	if (code.includes('devotion')) return 'devotion'
	if (code.includes('story')) return 'story'
	if (code.includes('amen')) return 'amen'
	if (code.includes('bible') || code.includes('read') || code.includes('page')) return 'bible'
	if (code.includes('streak') || code.includes('held') || code.includes('present')) return 'streak'
	return 'base'
}

export function badgeShareLine(b) {
	const title = String(b?.title || '').trim()
	const date = String(b?.earned_at || '').slice(0, 10)
	const parts = []
	if (title) parts.push(title)
	if (date) parts.push(date)
	parts.push('MANNA')
	if (parts.length === 1) return parts[0]
	if (parts.length === 2) return `${parts[0]} · ${parts[1]}`
	return `${parts[0]} — ${parts[1]} · ${parts[2]}`
}

export function openBadgeShare(b) {
	const title = String(b?.title || '').trim()
	const date = String(b?.earned_at || '').slice(0, 10)
	const line = badgeShareLine(b)
	try {
		uni.setStorageSync('manna_versecard_payload', {
			kind: 'badge',
			text: title,
			ref: date,
			brand: 'MANNA',
			shareLine: line,
		})
	} catch (e) {}
	uni.navigateTo({ url: '/pagesA/share/versecard' })
}

export function badgeIcon(b) {
	if (b?.hidden && !b?.earned) return '/static/ui/me/ico-badges.svg'
	const code = String(b?.code || b?.series || '')
	if (code.includes('quiz')) return '/static/ui/me/ico-quiz.svg'
	if (code.includes('prayer') || code.includes('dawn') || code.includes('night')) return '/static/ui/me/ico-pray.svg'
	if (code.includes('devotion')) return '/static/ui/me/ico-devotion.svg'
	if (code.includes('story')) return '/static/ui/me/ico-stories-fill.svg'
	if (code.includes('amen')) return '/static/ui/home/ico-amen.svg'
	if (code.includes('bible') || code.includes('read') || code.includes('page')) return '/static/ui/me/ico-bible-fill.svg'
	if (code.includes('streak') || code.includes('held') || code.includes('present')) return '/static/ui/me/ico-calendar.svg'
	return '/static/ui/me/ico-badges.svg'
}
