/**
 * 连续打卡 7 格。
 *
 * - buildCalendarWeek：严格按接口 week 返回顺序展示；用 date 算周几标签。
 * - buildStreakProgressWeek：从左往右点亮（弹窗），不把今天钉在最右侧。
 *
 * 接口 week 项字段：
 * - date：ISO 日期，用来显示周几（第一条是哪天，第一格就是哪天）
 * - checked：是否已打卡
 * - frozen：未打卡时是否用爱心冻结
 * （兼容旧字段 state: checked | frozen | empty）
 *
 * 格状态：
 * - checked：该日成功打开并打卡（粉色勾）
 * - frozen：漏打但用爱心冻结（灰色雪花），保连续、不加天数
 * - empty：尚未到来，或过去未打且未冻结
 */

export const STREAK_WEEK_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const DOW_KEYS = ['dow_mo', 'dow_tu', 'dow_we', 'dow_th', 'dow_fr', 'dow_sa', 'dow_su']

/** 当前语言下的一周缩写；无 t 时回落到英文 Mo…Su */
export function streakWeekLabels(t) {
	if (typeof t !== 'function') return STREAK_WEEK_LABELS.slice()
	return DOW_KEYS.map((key, i) => {
		const label = String(t(key) || '')
		return label && label !== key ? label : STREAK_WEEK_LABELS[i]
	})
}

/** 取 YYYY-MM-DD；兼容带时间的 ISO 字符串 */
function isoDay(iso) {
	const m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
	return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}

/** 解析 ISO 日期；失败返回 null */
function parseIsoDate(iso) {
	const day = isoDay(iso)
	if (!day) return null
	const parts = day.split('-')
	const y = Number(parts[0])
	const m = Number(parts[1])
	const d = Number(parts[2])
	if (!y || !m || !d) return null
	const dt = new Date(y, m - 1, d)
	if (Number.isNaN(dt.getTime())) return null
	if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
	return dt
}

/** 周一=0 … 周日=6；无效日期返回 -1 */
function dowIndexForIso(iso) {
	const dt = parseIsoDate(iso)
	if (!dt) return -1
	return (dt.getDay() + 6) % 7
}

function todayIso() {
	const d = new Date()
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

/**
 * 从接口日对象得到 UI 状态。
 * checked 优先；未打卡再看 frozen。
 */
export function resolveWeekDayState(d) {
	if (!d) return 'empty'
	const legacy = d.state
	if (legacy === 'checked' || legacy === 'frozen') return legacy
	if (legacy === 'empty') return 'empty'
	if (d.checked === true || d.checked === 1 || d.checked === 'true') return 'checked'
	if (d.frozen === true || d.frozen === 1 || d.frozen === 'true') return 'frozen'
	return 'empty'
}

function addDaysIso(iso, plusDays) {
	const dt = parseIsoDate(iso)
	if (!dt) return ''
	dt.setDate(dt.getDate() + plusDays)
	const y = dt.getFullYear()
	const m = String(dt.getMonth() + 1).padStart(2, '0')
	const d = String(dt.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

function labelForIsoDate(iso, labels, fallbackIndex) {
	const dow = dowIndexForIso(iso)
	if (dow < 0) return labels[fallbackIndex] || STREAK_WEEK_LABELS[fallbackIndex]
	return labels[dow] || labels[fallbackIndex] || STREAK_WEEK_LABELS[fallbackIndex]
}

function mapApiDay(d, labels, fallbackIndex) {
	const date = (d && d.date) || `week-${fallbackIndex}`
	const today = todayIso()
	const day = isoDay(date)
	const isToday = d && Object.prototype.hasOwnProperty.call(d, 'is_today')
		? !!d.is_today
		: day === today
	const isFuture = d && Object.prototype.hasOwnProperty.call(d, 'is_future')
		? !!d.is_future
		: !!(day && day > today)
	return {
		date,
		state: resolveWeekDayState(d),
		label: labelForIsoDate(d && d.date, labels, fallbackIndex),
		is_today: isToday,
		is_future: isFuture,
	}
}

/**
 * 把接口 week 按返回顺序转成 UI 7 格（不重排成周一→周日）。
 * 用每条 date 算出周几标签；checked / frozen 决定格子状态。
 * streakDays 仅兼容旧调用。
 * @param {number} [_streakDays]
 * @param {Array<{ date?: string, checked?: boolean, frozen?: boolean, state?: string, is_today?: boolean, is_future?: boolean }>} [apiWeek]
 * @param {string[]} [labels]
 */
export function buildCalendarWeek(_streakDays, apiWeek = [], labels) {
	const weekLabels = Array.isArray(labels) && labels.length === 7
		? labels
		: STREAK_WEEK_LABELS
	const src = Array.isArray(apiWeek) ? apiWeek.filter(Boolean) : []

	if (src.length) {
		return src.slice(0, 7).map((d, i) => mapApiDay(d, weekLabels, i))
	}

	return weekLabels.map((label, i) => ({
		date: `week-${i}`,
		state: 'empty',
		label,
		is_today: false,
		is_future: false,
	}))
}

/**
 * 从左往右点亮：已打卡 / 冻结靠左，右侧补后续空日（标签接着排）。
 * 无 week 数据时用连续天数点亮 min(streak, 7) 格。
 */
export function buildStreakProgressWeek(streakDays, apiWeek = [], labels) {
	const weekLabels = Array.isArray(labels) && labels.length === 7
		? labels
		: STREAK_WEEK_LABELS
	const src = Array.isArray(apiWeek) ? apiWeek.filter(Boolean) : []
	const filled = src
		.filter((d) => {
			const state = resolveWeekDayState(d)
			return state === 'checked' || state === 'frozen'
		})
		.slice()
		.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))

	if (filled.length) {
		const out = filled.slice(0, 7).map((d, i) => mapApiDay(d, weekLabels, i))
		const lastIso = out[out.length - 1] && out[out.length - 1].date
		let pad = 1
		while (out.length < 7) {
			const iso = addDaysIso(lastIso, pad)
			out.push({
				date: iso || `streak-${out.length}`,
				state: 'empty',
				label: iso ? labelForIsoDate(iso, weekLabels, out.length) : (weekLabels[out.length] || ''),
				is_today: false,
				is_future: true,
			})
			pad += 1
		}
		return out
	}

	const n = Math.max(0, Math.min(7, Number(streakDays) || 0))
	return weekLabels.map((label, i) => ({
		date: `streak-${i}`,
		state: i < n ? 'checked' : 'empty',
		label,
		is_today: n > 0 && i === n - 1,
		is_future: i >= n,
	}))
}

/**
 * 从 week 回推连续天数：自本地今天（或最近非未来日）往前，
 * checked +1，frozen 保连续不加天，empty 中断。
 * 本地今天优先于接口 is_today，避免时区把「今天」标在前一天时少算今天。
 */
export function streakDaysFromWeek(apiWeek = []) {
	const src = (Array.isArray(apiWeek) ? apiWeek : []).filter(Boolean)
	if (!src.length) return 0
	const today = todayIso()
	const sorted = src
		.slice()
		.sort((a, b) => {
			const da = isoDay(a.date) || String(a.date || '')
			const db = isoDay(b.date) || String(b.date || '')
			return da.localeCompare(db)
		})
	let end = sorted.findIndex((d) => isoDay(d.date) === today)
	if (end < 0) end = sorted.findIndex((d) => d.is_today === true)
	if (end < 0) {
		end = -1
		for (let i = sorted.length - 1; i >= 0; i -= 1) {
			const d = sorted[i]
			if (d && d.is_future) continue
			const day = isoDay(d.date)
			if (day && day > today) continue
			end = i
			break
		}
	}
	if (end < 0) return 0
	const endState = resolveWeekDayState(sorted[end])
	if (endState !== 'checked' && endState !== 'frozen') return 0
	let n = 0
	for (let i = end; i >= 0; i -= 1) {
		const state = resolveWeekDayState(sorted[i])
		if (state === 'checked') n += 1
		else if (state === 'frozen') continue
		else break
	}
	return n
}

/**
 * 解析连续打卡天数。
 * 周历从今天往前的连续勾选比接口字段大时，用周历（接口偶发少算今天）。
 * 接口更大时保留：连续可能早于本周这 7 格。
 * @param {object} [data] checkin status / do 的 results
 * @param {number} [fallback]
 */
export function resolveStreakDays(data, fallback = 0) {
	const fb = Number(fallback)
	const safeFb = Number.isFinite(fb) && fb > 0 ? Math.floor(fb) : 0
	if (!data || typeof data !== 'object') return safeFb
	const candidates = [
		data.streak_days,
		data.checkin_streak,
		data.current_streak,
		data.streak,
	]
	let apiDays = null
	for (let i = 0; i < candidates.length; i += 1) {
		const raw = candidates[i]
		if (raw == null || raw === '') continue
		const n = Number(raw)
		if (Number.isFinite(n) && n >= 0) {
			apiDays = Math.floor(n)
			break
		}
	}
	const fromWeek = streakDaysFromWeek(data.week || [])
	if (fromWeek > 0 && (apiDays == null || fromWeek > apiDays)) return fromWeek
	if (apiDays != null && apiDays > 0) return apiDays
	if (apiDays === 0) return 0
	return safeFb
}

/** @deprecated 使用 buildCalendarWeek；保留别名避免旧引用断裂 */
export function buildStreakCycleWeek(streakDays, apiWeek = [], labels) {
	return buildCalendarWeek(streakDays, apiWeek, labels)
}
