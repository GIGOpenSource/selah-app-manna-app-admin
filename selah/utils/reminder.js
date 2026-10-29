/**
 * 提醒中心：写作 / 练习 / 经典语句 / 打卡。
 * 时刻以提醒页各卡片的开关和时间为准，按手机本地时区调度。
 * 打卡没设过时，卡片默认 08:00；改过之后按卡片上的时间，不再写死。
 * 兼容旧字段 record_enabled / streak_remind_enabled / checkin_remind_enabled。
 */
import { t } from '@/i18n/index.js'
import { getUser } from '@/utils/session.js'
import { apiPushRemindersGet, apiPushDailyCopiesGet, apiPushOpen } from '@/api/push.js'
import { scheduleAndroidAlarmClock, cancelAndroidAlarmClock } from '@/utils/alarmClock.js'

const KEY_CHECKIN = 'selah_checkin_remind'
const PREFS_KEY = 'selah_reminder_prefs'
const ALARM_KEY = 'selah_alarm_prefs'
const TRIAL_REMIND_KEY = 'vip_trial_remind_schedule'
const TRIAL_REMIND_FLAG = 'vip_trial_remind'
const PLAN_KEY = 'selah_push_plan_v2'
const DAYPART_KEY = 'selah_daypart_prefs'
const DAYPART_COPY_KEY = 'selah_daypart_copies'
const CHECKIN_HOUR = 8
const CHECKIN_MINUTE = 0

/** 提醒页四个固定时段。钟点按手机本地时区，文案来自 /push/daily-copies/。 */
export const REMINDER_SLOTS = [
	{ id: 'morning', hour: 8, minute: 0, timeLabel: '8:00AM' },
	{ id: 'noon', hour: 12, minute: 0, timeLabel: '12:00PM' },
	{ id: 'afternoon', hour: 19, minute: 0, timeLabel: '19:00PM' },
	{ id: 'evening', hour: 21, minute: 0, timeLabel: '21:00PM' },
]

export const REMINDER_TYPES = ['writing', 'practice', 'classic', 'checkin']

/** 闹钟名称 → /checkin/reminder-times/ 的 key */
export const REMINDER_TIME_API_KEY = {
	writing: 'writing',
	practice: 'practice',
	classic: 'quotes',
	checkin: 'checkin',
}

export function reminderTimeApiKey(type) {
	return REMINDER_TIME_API_KEY[type] || type
}

export function reminderTypeFromApiKey(key) {
	const want = String(key || '')
	const hit = Object.keys(REMINDER_TIME_API_KEY).find((type) => REMINDER_TIME_API_KEY[type] === want)
	return hit || want
}

/** VIP 才可开写作 / 练习；经典 + 打卡免费 */
export const REMINDER_VIP_TYPES = new Set(['writing', 'practice'])

export function defaultReminderPrefs() {
	return {
		writing_enabled: false,
		writing_hour: 9,
		writing_minute: 0,
		writing_freq: 'daily',
		practice_enabled: false,
		practice_hour: 12,
		practice_minute: 0,
		practice_freq: 'daily',
		classic_enabled: true,
		classic_hour: 12,
		classic_minute: 8,
		classic_freq: 'daily',
		checkin_enabled: true,
		checkin_hour: CHECKIN_HOUR,
		checkin_minute: CHECKIN_MINUTE,
		checkin_freq: 'daily',
		// legacy mirrors
		record_enabled: true,
		streak_remind_enabled: true,
		checkin_remind_enabled: true,
	}
}

function _clampHour(h) {
	return Math.max(0, Math.min(23, parseInt(h, 10) || 0))
}
function _clampMinute(m) {
	return Math.max(0, Math.min(59, parseInt(m, 10) || 0))
}

/** 没有存过提醒配置时用默认值（打卡当地 08:00）。空对象不能当成「用户关了打卡」。 */
function migrateLegacy(raw = {}) {
	const base = defaultReminderPrefs()
	const hasNew = REMINDER_TYPES.some(
		(k) => `${k}_enabled` in raw || `${k}_hour` in raw,
	)
	if (hasNew) return { ...base, ...raw }
	const hasLegacy = 'record_enabled' in raw
		|| 'streak_remind_enabled' in raw
		|| 'checkin_remind_enabled' in raw
	if (!hasLegacy) return base

	const record = raw.record_enabled !== false
	const streak = !!raw.streak_remind_enabled
	const checkin = !!raw.checkin_remind_enabled
	return {
		...base,
		writing_enabled: false,
		practice_enabled: false,
		classic_enabled: record && streak,
		checkin_enabled: record && checkin,
		record_enabled: record,
		streak_remind_enabled: streak,
		checkin_remind_enabled: checkin,
	}
}

/** 账号页「打卡提醒」开关：开着才提醒。没有这个字段时，跟提醒页打卡开关走。 */
function accountCheckinRemindOn() {
	const user = getUser()
	if (!user || typeof user !== 'object' || !Object.keys(user).length) return null
	return user.checkin_record_enabled !== false && !!user.checkin_remind_enabled
}

export function normalizeReminderPrefs(raw = {}) {
	const m = migrateLegacy(raw)
	const out = defaultReminderPrefs()
	for (const type of REMINDER_TYPES) {
		out[`${type}_enabled`] = !!m[`${type}_enabled`]
		out[`${type}_hour`] = _clampHour(m[`${type}_hour`] ?? out[`${type}_hour`])
		out[`${type}_minute`] = _clampMinute(m[`${type}_minute`] ?? out[`${type}_minute`])
		const freq = String(m[`${type}_freq`] || out[`${type}_freq`] || 'daily')
		out[`${type}_freq`] = freq === 'weekdays' ? 'weekdays' : 'daily'
	}
	// 兼容列字段：任一开启则 record；打卡/经典镜像旧键
	out.checkin_remind_enabled = out.checkin_enabled
	out.streak_remind_enabled = out.classic_enabled
	out.record_enabled =
		out.writing_enabled ||
		out.practice_enabled ||
		out.classic_enabled ||
		out.checkin_enabled
	return out
}

/**
 * 合并服务端偏好到本地。
 * 写作/练习多为端侧调度，服务端常不落库或固定回 false，不能冲掉本地已开启状态。
 * 经典/打卡以服务端显式字段为准；缺省键保留本地。
 */
export function mergeReminderPrefs(local = {}, remote = {}) {
	const base = normalizeReminderPrefs(local)
	if (!remote || typeof remote !== 'object') return base
	const patch = {}
	const has = (key) => Object.prototype.hasOwnProperty.call(remote, key)

	for (const type of REMINDER_TYPES) {
		const vip = REMINDER_VIP_TYPES.has(type)
		if (has(`${type}_hour`)) patch[`${type}_hour`] = remote[`${type}_hour`]
		if (has(`${type}_minute`)) patch[`${type}_minute`] = remote[`${type}_minute`]
		if (vip) {
			// VIP 项：仅当服务端明确为 true 时采信开启；false/缺失一律保留本地
			if (has(`${type}_enabled`) && remote[`${type}_enabled`]) {
				patch[`${type}_enabled`] = true
			}
			if (has(`${type}_freq`) && remote[`${type}_enabled`]) {
				patch[`${type}_freq`] = remote[`${type}_freq`]
			}
			continue
		}
		if (has(`${type}_enabled`)) patch[`${type}_enabled`] = remote[`${type}_enabled`]
		if (has(`${type}_freq`)) patch[`${type}_freq`] = remote[`${type}_freq`]
	}

	if (has('quotes_enabled') && !has('classic_enabled')) {
		patch.classic_enabled = !!remote.quotes_enabled
	}

	const hasTypedEnabled = REMINDER_TYPES.some((type) => has(`${type}_enabled`))
		|| has('quotes_enabled')
	if (!hasTypedEnabled) {
		const legacy = migrateLegacy(remote)
		if (has('streak_remind_enabled') || has('record_enabled')) {
			patch.classic_enabled = legacy.classic_enabled
		}
		if (has('checkin_remind_enabled') || has('record_enabled')) {
			patch.checkin_enabled = legacy.checkin_enabled
		}
	}

	return normalizeReminderPrefs({ ...base, ...patch })
}

export function getLocalReminderPrefs() {
	return normalizeReminderPrefs(uni.getStorageSync(PREFS_KEY) || {})
}

export function formatRemindTime(hour, minute) {
	const h = _clampHour(hour)
	const m = _clampMinute(minute)
	const ampm = h >= 12 ? 'PM' : 'AM'
	const h12 = h % 12 || 12
	return `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

/**
 * 下一次触发用手机本地时区的钟面时间。
 * 安卓真机常没有 Intl，不能用 DateTimeFormat，否则 onShow 直接 ReferenceError。
 */
function _nextFireDate(hour, minute, freq) {
	const when = new Date()
	when.setSeconds(0, 0)
	when.setHours(hour, minute, 0, 0)
	if (when.getTime() <= Date.now() + 5000) when.setDate(when.getDate() + 1)
	if (freq === 'weekdays') {
		let guard = 0
		while (guard < 7 && (when.getDay() === 0 || when.getDay() === 6)) {
			when.setDate(when.getDate() + 1)
			guard += 1
		}
	}
	return when
}

function _ensureNotifyPermission() {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || plus.os.name !== 'Android') return
		const Build = plus.android.importClass('android.os.Build')
		if (Build.VERSION.SDK_INT < 33) return
		plus.android.requestPermissions(['android.permission.POST_NOTIFICATIONS'])
	} catch (e) {}
	// #endif
}

function _isAndroidApp() {
	try {
		return typeof plus !== 'undefined' && String(plus.os && plus.os.name).toLowerCase() === 'android'
	} catch (e) {
		return false
	}
}

function _isIosApp() {
	try {
		return typeof plus !== 'undefined' && String(plus.os && plus.os.name).toLowerCase() === 'ios'
	} catch (e) {
		return false
	}
}

/** 开机时刻（分钟）。重启后系统会清掉尚未触发的闹钟，需要重排。 */
function _bootId() {
	if (!_isAndroidApp()) return ''
	try {
		const SystemClock = plus.android.importClass('android.os.SystemClock')
		const boot = Date.now() - Number(SystemClock.elapsedRealtime())
		return String(Math.floor(boot / 60000))
	} catch (e) {
		return ''
	}
}

function _sameBoot(a, b) {
	if (a === b) return true
	const da = Number(a)
	const db = Number(b)
	if (!Number.isFinite(da) || !Number.isFinite(db)) return false
	return Math.abs(da - db) <= 2
}

function _clearNative() {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.push) return
		if (typeof plus.push.getAllMessage === 'function' && typeof plus.push.remove === 'function') {
			const list = plus.push.getAllMessage() || []
			for (let i = 0; i < list.length; i++) {
				try { plus.push.remove(list[i]) } catch (e) {}
			}
		}
		if (plus.push.clear) plus.push.clear()
	} catch (e) {}
	// #endif
}

function _createPush(content, payload, when, extra) {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.push || !plus.push.createMessage) return
		const options = {
			cover: false,
			title: 'Selah',
			delay: Math.max(1, Math.floor((when.getTime() - Date.now()) / 1000)),
		}
		if (extra && extra.sound) options.sound = extra.sound
		// 安卓同时传 when 和 delay 会各落一条通知。when 只影响通知上的时间，延迟发送时用触发时刻即可。
		if (!_isAndroidApp()) options.when = when
		plus.push.createMessage(content, payload, options)
	} catch (e) {}
	// #endif
}

function _remindContent(type) {
	const slot = REMINDER_SLOTS.find((item) => item.id === type)
	if (slot) {
		const line = t(`reminder_slot_${slot.id}_body`)
		if (line && line !== `reminder_slot_${slot.id}_body`) return line
	}
	if (type === 'checkin') return t('remind_checkin')
	const key = `reminder_${type}`
	const label = t(key)
	return label && label !== key ? label : 'Selah'
}

function _normalizeDaypart(raw = {}) {
	const out = {}
	REMINDER_SLOTS.forEach((slot) => {
		out[`${slot.id}_enabled`] = !!raw[`${slot.id}_enabled`]
		const hour = raw[`${slot.id}_hour`]
		out[`${slot.id}_hour`] = hour == null || hour === '' ? slot.hour : _clampHour(hour)
		const minute = raw[`${slot.id}_minute`]
		out[`${slot.id}_minute`] = minute == null || minute === '' ? slot.minute : _clampMinute(minute)
		out[`${slot.id}_freq`] = raw[`${slot.id}_freq`] === 'weekdays' ? 'weekdays' : 'daily'
	})
	return out
}

function _remoteDaypart(remote) {
	if (!remote || typeof remote !== 'object') return null
	const has = REMINDER_SLOTS.some((slot) => Object.prototype.hasOwnProperty.call(remote, `${slot.id}_enabled`))
	if (!has) return null
	return _normalizeDaypart(remote)
}

function _daypartFromRows(rows) {
	if (!Array.isArray(rows)) return null
	const out = {}
	let found = false
	rows.forEach((row) => {
		if (!row || typeof row !== 'object') return
		const key = String(row.key || row.slot || row.name || '')
		if (!REMINDER_SLOTS.some((slot) => slot.id === key)) return
		out[`${key}_enabled`] = !!row.enabled
		found = true
	})
	return found ? out : null
}

/** 把 GET /push/reminders/ 的结果收成 { morning_enabled, ... }。没有时段配置时返回 null。 */
export function daypartPrefsFromPush(payload) {
	const body = payload && typeof payload === 'object' && ('results' in payload || 'data' in payload)
		? (payload.results != null ? payload.results : payload.data)
		: payload
	if (!body) return null
	if (Array.isArray(body)) return _daypartFromRows(body)
	if (typeof body !== 'object') return null
	for (const key of ['results', 'items', 'list', 'reminders']) {
		if (Array.isArray(body[key])) {
			const parsed = _daypartFromRows(body[key])
			if (parsed) return parsed
		}
	}
	const out = {}
	let found = false
	REMINDER_SLOTS.forEach((slot) => {
		if (Object.prototype.hasOwnProperty.call(body, slot.id)) {
			const value = body[slot.id]
			out[`${slot.id}_enabled`] = !!(value && typeof value === 'object' ? value.enabled : value)
			found = true
			return
		}
		if (Object.prototype.hasOwnProperty.call(body, `${slot.id}_enabled`)) {
			out[`${slot.id}_enabled`] = !!body[`${slot.id}_enabled`]
			found = true
		}
	})
	return found ? out : null
}

/** 本地已初始化用本地；否则用后台时段开关；都没有则四个全开。 */
export function resolveDaypartPrefs(remote) {
	const raw = uni.getStorageSync(DAYPART_KEY)
	if (raw && typeof raw === 'object' && raw.inited) return _normalizeDaypart(raw)
	const fromRemote = _remoteDaypart(remote)
	if (fromRemote) return fromRemote
	const allOn = {}
	REMINDER_SLOTS.forEach((slot) => { allOn[`${slot.id}_enabled`] = true })
	return allOn
}

export function isDaypartRemindersInited() {
	const raw = uni.getStorageSync(DAYPART_KEY)
	return !!(raw && typeof raw === 'object' && raw.inited)
}

function _copyTitle(value) {
	if (!value || typeof value !== 'object') return ''
	const title = value.title || value.subject || value.headline || ''
	return typeof title === 'string' ? title.trim() : ''
}

function _copyText(value) {
	if (typeof value === 'string') return value.trim()
	if (!value || typeof value !== 'object') return ''
	const text = value.copy || value.content || value.text || value.body || value.message || value.desc || ''
	return typeof text === 'string' ? text.trim() : ''
}

function _copyId(value) {
	if (!value || typeof value !== 'object') return null
	const raw = value.copy_id != null ? value.copy_id : value.id
	const id = Number(raw)
	return Number.isFinite(id) && id > 0 ? id : null
}

function _deliveryId(value) {
	if (value == null || value === '') return null
	const raw = typeof value === 'object'
		? (value.delivery_id != null ? value.delivery_id : value.deliveryId)
		: value
	if (raw == null || raw === '') return null
	if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
	const text = String(raw).trim()
	if (!text) return null
	const num = Number(text)
	if (Number.isFinite(num) && String(num) === text) return num
	return text
}

function _storedCopy(entry) {
	if (typeof entry === 'string') return { title: '', text: entry.trim(), id: null, delivery_id: null }
	if (!entry || typeof entry !== 'object') return { title: '', text: '', id: null, delivery_id: null }
	return {
		title: String(entry.title || '').trim(),
		text: String(entry.text || '').trim(),
		id: _copyId(entry) || (Number(entry.id) > 0 ? Number(entry.id) : null),
		delivery_id: _deliveryId(entry),
	}
}

/** 把 GET /push/daily-copies/?slot= 收成 { morning: '文案', ... }。 */
export function dailyCopiesFromPush(payload, fallbackSlot = '') {
	const body = payload && typeof payload === 'object' && ('results' in payload || 'data' in payload)
		? (payload.results != null ? payload.results : payload.data)
		: payload
	const out = {}
	const rootDelivery = _deliveryId(payload) || (body && typeof body === 'object' && !Array.isArray(body) ? _deliveryId(body) : null)
	const assign = (key, value) => {
		if (!REMINDER_SLOTS.some((slot) => slot.id === key)) return
		const text = _copyText(value)
		const title = _copyTitle(value)
		const id = _copyId(value)
		const deliveryId = (value && typeof value === 'object' ? _deliveryId(value) : null) || rootDelivery
		if (!text && !title && id == null && deliveryId == null) return
		out[key] = { title, text, id, delivery_id: deliveryId }
	}
	const fromRows = (rows) => {
		if (!Array.isArray(rows)) return
		rows.forEach((row) => {
			if (!row || typeof row !== 'object') return
			assign(String(row.key || row.slot || row.name || fallbackSlot || ''), row)
		})
	}
	if (typeof body === 'string') {
		const text = body.trim()
		if (!text) return out
		if (fallbackSlot) assign(fallbackSlot, { copy: text })
		else REMINDER_SLOTS.forEach((slot) => { out[slot.id] = { title: '', text, id: null, delivery_id: null } })
		return out
	}
	if (Array.isArray(body)) {
		fromRows(body)
		return out
	}
	if (!body || typeof body !== 'object') return out
	for (const key of ['results', 'items', 'list', 'copies', 'reminders']) {
		if (Array.isArray(body[key])) fromRows(body[key])
	}
	REMINDER_SLOTS.forEach((slot) => {
		if (body[slot.id] != null) assign(slot.id, body[slot.id])
	})
	if (!Object.keys(out).length) {
		const slotName = String(body.slot || body.key || fallbackSlot || '')
		if (slotName) assign(slotName, body)
		else {
			const lone = _copyText(body)
			const title = _copyTitle(body)
			const id = _copyId(body)
			const deliveryId = _deliveryId(body)
			if (lone || title || id != null || deliveryId != null) {
				REMINDER_SLOTS.forEach((slot) => { out[slot.id] = { title, text: lone, id, delivery_id: deliveryId } })
			}
		}
	}
	return out
}

function _daypartJobs() {
	const raw = uni.getStorageSync(DAYPART_KEY)
	if (!raw || typeof raw !== 'object' || !raw.inited) return []
	const copies = uni.getStorageSync(DAYPART_COPY_KEY) || {}
	const jobs = []
	REMINDER_SLOTS.forEach((slot) => {
		if (!raw[`${slot.id}_enabled`]) return
		const hour = raw[`${slot.id}_hour`] == null ? slot.hour : raw[`${slot.id}_hour`]
		const minute = raw[`${slot.id}_minute`] == null ? slot.minute : raw[`${slot.id}_minute`]
		const freq = raw[`${slot.id}_freq`] === 'weekdays' ? 'weekdays' : 'daily'
		const when = _nextFireDate(hour, minute, freq)
		const stored = _storedCopy(copies[slot.id])
		const body = stored.text || (stored.title ? '' : _remindContent(slot.id))
		jobs.push({
			key: `slot_${slot.id}`,
			at: when.getTime(),
			title: stored.title,
			content: body,
			payload: JSON.stringify({
				kind: 'reminder',
				type: slot.id,
				push_type: 'daily',
				copy_id: stored.id,
				delivery_id: stored.delivery_id,
			}),
			when,
		})
	})
	return jobs
}

function _hasRemindTime(prefs, type) {
	const hour = Number(prefs[`${type}_hour`])
	const minute = Number(prefs[`${type}_minute`])
	return Number.isFinite(hour) && hour >= 0 && hour <= 23
		&& Number.isFinite(minute) && minute >= 0 && minute <= 59
}

function _typeJob(type, prefs) {
	if (!prefs[`${type}_enabled`] || !_hasRemindTime(prefs, type)) return null
	const when = _nextFireDate(prefs[`${type}_hour`], prefs[`${type}_minute`], prefs[`${type}_freq`])
	return {
		key: type,
		at: when.getTime(),
		content: _remindContent(type),
		payload: JSON.stringify({ kind: 'reminder', type }),
		when,
	}
}

function _nextAlarmDate(hour, minute, days) {
	const allow = new Set(
		(Array.isArray(days) && days.length ? days : [0, 1, 2, 3, 4, 5, 6]).map((d) => Number(d)),
	)
	const when = new Date()
	when.setSeconds(0, 0)
	when.setHours(_clampHour(hour), _clampMinute(minute), 0, 0)
	if (when.getTime() <= Date.now() + 5000) when.setDate(when.getDate() + 1)
	let guard = 0
	while (guard < 7 && !allow.has(when.getDay())) {
		when.setDate(when.getDate() + 1)
		guard += 1
	}
	return when
}

function _alarmJob() {
	const cur = uni.getStorageSync(ALARM_KEY) || {}
	if (!cur.enabled) return null
	const alarmDays = Array.isArray(cur.weekdays) ? cur.weekdays : cur.days
	if (!Array.isArray(alarmDays) || !alarmDays.length) return null
	if (cur.hour == null || cur.minute == null) return null
	const when = _nextAlarmDate(cur.hour, cur.minute, alarmDays)
	return {
		key: 'alarm',
		at: when.getTime(),
		content: 'Time to spend a moment with God',
		payload: 'Selah',
		when,
	}
}

let _pushSyncing = false
let _pushSyncAgain = false

function _readPlan() {
	const raw = uni.getStorageSync(PLAN_KEY)
	if (!raw || typeof raw !== 'object') return { boot: '', sig: '', fires: {} }
	return {
		boot: String(raw.boot || ''),
		sig: String(raw.sig || ''),
		fires: raw.fires && typeof raw.fires === 'object' ? raw.fires : {},
	}
}

function _configSig(prefs) {
	const parts = REMINDER_TYPES.map((type) => [
		type,
		prefs[`${type}_enabled`] ? 1 : 0,
		prefs[`${type}_hour`],
		prefs[`${type}_minute`],
		prefs[`${type}_freq`],
	].join(':'))
	const alarm = uni.getStorageSync(ALARM_KEY) || {}
	const alarmDayList = Array.isArray(alarm.weekdays) ? alarm.weekdays : alarm.days
	const alarmDays = Array.isArray(alarmDayList)
		? alarmDayList.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b).join(',')
		: ''
	parts.push([
		'alarm',
		alarm.enabled ? 1 : 0,
		_clampHour(alarm.hour ?? 8),
		_clampMinute(alarm.minute ?? 0),
		alarmDays,
	].join(':'))
	const trial = _trialState()
	parts.push(['trial', trial.enabled ? 1 : 0, trial.endAt || ''].join(':'))
	const daypart = uni.getStorageSync(DAYPART_KEY)
	if (daypart && daypart.inited) {
		const copies = uni.getStorageSync(DAYPART_COPY_KEY) || {}
		REMINDER_SLOTS.forEach((slot) => {
			const stored = _storedCopy(copies[slot.id])
			parts.push(['slot', slot.id, daypart[`${slot.id}_enabled`] ? 1 : 0, stored.id || '', stored.delivery_id || '', stored.title, stored.text].join(':'))
		})
	}
	return parts.join('|')
}

/** 安卓四个时段走系统闹钟。plus.push 的延时消息进程被划掉后不会响，前台又以为已经排过。 */
function _syncAndroidDayparts(jobs) {
	if (!_isAndroidApp()) return
	try {
		const main = plus.android.runtimeMainActivity()
		if (!main) return
		const ctx = main.getApplicationContext()
		const slots = REMINDER_SLOTS.map((slot) => {
			const job = jobs.find((item) => item.key === `slot_${slot.id}`)
			if (!job) return { id: slot.id, enabled: '0' }
			return {
				id: slot.id,
				enabled: '1',
				hour: String(slot.hour),
				minute: String(slot.minute),
				title: String(job.title || ''),
				body: String(job.content || ''),
				copy_id: _jobCopyId(job),
				delivery_id: _jobDeliveryId(job),
				at: String(job.at || ''),
			}
		})
		plus.android.invoke('com.gig.selah.DaypartReminder', 'sync', ctx, JSON.stringify(slots))
	} catch (e) {}
}

/** iOS 四个时段走每天重复的系统通知。plus.push 的延时消息会被 clear 清掉，到点就发不出来。 */
function _syncIosDayparts(jobs) {
	if (!_isIosApp()) return
	try {
		const slots = REMINDER_SLOTS.map((slot) => {
			const job = jobs.find((item) => item.key === `slot_${slot.id}`)
			if (!job) return { id: slot.id, enabled: '0' }
			return {
				id: slot.id,
				enabled: '1',
				hour: String(slot.hour),
				minute: String(slot.minute),
				title: String(job.title || ''),
				body: String(job.content || ''),
				copy_id: _jobCopyId(job),
				delivery_id: _jobDeliveryId(job),
			}
		})
		plus.ios.invoke('SelahAlarmClock', 'syncDayparts:', JSON.stringify(slots))
	} catch (e) {}
}

function _jobCopyId(job) {
	try {
		const data = JSON.parse(job && job.payload ? job.payload : '{}')
		const id = Number(data && data.copy_id)
		return Number.isFinite(id) && id > 0 ? String(id) : ''
	} catch (e) {
		return ''
	}
}

function _jobDeliveryId(job) {
	try {
		const data = JSON.parse(job && job.payload ? job.payload : '{}')
		const id = _deliveryId(data)
		return id == null ? '' : String(id)
	} catch (e) {
		return ''
	}
}

function _deliveryOfCopy(copyId) {
	try {
		const copies = uni.getStorageSync(DAYPART_COPY_KEY) || {}
		for (let i = 0; i < REMINDER_SLOTS.length; i++) {
			const stored = _storedCopy(copies[REMINDER_SLOTS[i].id])
			if (stored.id === copyId && stored.delivery_id != null) return stored.delivery_id
		}
	} catch (e) {}
	return null
}

function _syncDayparts(jobs) {
	_syncAndroidDayparts(jobs)
	_syncIosDayparts(jobs)
}

function _pushJobs(jobs) {
	jobs.forEach((job) => {
		if (job.trialPatch) uni.setStorageSync(TRIAL_REMIND_KEY, job.trialPatch)
		if (job.key === 'alarm' && (_isAndroidApp() || _isIosApp())) {
			scheduleAndroidAlarmClock(job.when)
			return
		}
		if (String(job.key || '').indexOf('slot_') === 0 && (_isAndroidApp() || _isIosApp())) return
		_createPush(job.content, job.payload, job.when, job.key === 'alarm' ? { sound: 'system' } : null)
	})
}

/**
 * 安卓 plus.push.clear 清不掉尚未触发的 delay 消息。
 * 每次进前台都重新 createMessage，到点就会一次弹出多条。
 * 同一配置、同一次触发只创建一条；时间或开关变了才整组换掉。
 */
function _syncNativePushes(prefs) {
	if (_pushSyncing) {
		_pushSyncAgain = true
		return
	}
	_pushSyncing = true
	try {
		const jobs = []
		REMINDER_TYPES.forEach((type) => {
			const job = _typeJob(type, prefs)
			if (job) jobs.push(job)
		})
		const alarm = _alarmJob()
		if (alarm) jobs.push(alarm)
		const trial = _trialJob()
		if (trial) jobs.push(trial)
		_daypartJobs().forEach((job) => jobs.push(job))

		const boot = _bootId()
		const sig = _configSig(prefs)
		const plan = _readPlan()
		const now = Date.now() + 5000
		const replaceAll = plan.sig !== sig || !_sameBoot(plan.boot, boot)

		if (replaceAll) {
			_clearNative()
			if ((_isAndroidApp() || _isIosApp()) && !jobs.some((job) => job.key === 'alarm')) cancelAndroidAlarmClock()
			_pushJobs(jobs)
			const fires = {}
			jobs.forEach((job) => { fires[job.key] = job.at })
			uni.setStorageSync(PLAN_KEY, { boot, sig, fires })
			_syncDayparts(jobs)
			return
		}

		const due = jobs.filter((job) => !(Number(plan.fires[job.key]) > now))
		if (!due.length) {
			_syncDayparts(jobs)
			return
		}
		_pushJobs(due)
		const fires = { ...plan.fires }
		due.forEach((job) => { fires[job.key] = job.at })
		Object.keys(fires).forEach((key) => {
			if (!jobs.some((job) => job.key === key)) delete fires[key]
		})
		uni.setStorageSync(PLAN_KEY, { boot, sig, fires })
		_syncDayparts(jobs)
	} finally {
		_pushSyncing = false
		if (_pushSyncAgain) {
			_pushSyncAgain = false
			_syncNativePushes(getLocalReminderPrefs())
		}
	}
}

/** 应用偏好：写本地 + 按各卡片开关和时间调度；打卡仍写旧 KEY 兼容 */
export function applyReminderPrefsLocal(prefs = {}, options = {}) {
	const next = normalizeReminderPrefs(prefs)
	uni.setStorageSync(PREFS_KEY, next)
	uni.setStorageSync(KEY_CHECKIN, {
		enabled: !!next.checkin_enabled,
		hour: next.checkin_hour,
		minute: next.checkin_minute,
		updated_at: Date.now(),
	})
	const anyOn = REMINDER_TYPES.some((type) => next[`${type}_enabled`])
	if (anyOn && options.askPermission !== false) _ensureNotifyPermission()
	_syncNativePushes(next)
	return next
}

/**
 * 提醒页四个时段。旧的写作 / 练习 / 经典语句不再从这页发出，打卡提醒仍走账号开关。
 */
let _daypartRefreshing = false
let _daypartRev = 0
let _pushClickBound = false
let _pushOpenStamp = ''

function _reportDailyPushOpen(payload) {
	let data = payload
	if (typeof data === 'string') {
		try { data = JSON.parse(data) } catch (e) { return }
	}
	if (!data || typeof data !== 'object') return
	if (data.kind && data.kind !== 'reminder') return
	if (data.push_type && data.push_type !== 'daily') return
	const copyId = Number(data.copy_id)
	if (!Number.isFinite(copyId) || copyId <= 0) return
	const deliveryId = _deliveryId(data) || _deliveryOfCopy(copyId)
	const stamp = `${copyId}:${deliveryId == null ? '' : deliveryId}:${Math.floor(Date.now() / 3000)}`
	if (stamp === _pushOpenStamp) return
	_pushOpenStamp = stamp
	apiPushOpen({
		push_type: 'daily',
		copy_id: copyId,
		delivery_id: deliveryId,
		clicked: true,
		opened: true,
	}).catch(() => {})
}

function _takeNativeCopyId() {
	let raw = ''
	try {
		if (plus.os && plus.os.name === 'Android') {
			const main = plus.android.runtimeMainActivity()
			if (main) raw = plus.android.invoke('com.gig.selah.DaypartReminder', 'takeOpenCopy', main)
		} else {
			raw = plus.ios.invoke('SelahAlarmClock', 'takeDaypartOpen')
		}
	} catch (e) {}
	const id = Number(raw == null ? '' : String(raw).trim())
	return Number.isFinite(id) && id > 0 ? id : 0
}

/** 从系统通知点进应用时，把这个时段的 copy_id 报给 /push/open/。 */
export function reportNativeDaypartOpen() {
	// #ifdef APP-PLUS
	const send = () => {
		const copyId = _takeNativeCopyId()
		if (!copyId) return
		_reportDailyPushOpen({ kind: 'reminder', push_type: 'daily', copy_id: copyId })
	}
	if (typeof plus === 'undefined') return
	send()
	setTimeout(send, 800)
	// #endif
}

/** 点开每日提醒通知时上报 /push/open/。 */
export function bindDailyPushOpen() {
	// #ifdef APP-PLUS
	const arm = () => {
		if (_pushClickBound || typeof plus === 'undefined' || !plus.push || !plus.push.addEventListener) return
		_pushClickBound = true
		try {
			plus.push.addEventListener('click', (msg) => {
				_reportDailyPushOpen(msg && msg.payload != null ? msg.payload : msg)
			}, false)
		} catch (e) {
			_pushClickBound = false
		}
	}
	if (typeof plus !== 'undefined') arm()
	else if (typeof document !== 'undefined') document.addEventListener('plusready', arm)
	// #endif
}

/**
 * 读提醒开关。打开的时段再拉当日文案，并按手机本地时间 8:00 / 12:00 / 19:00 / 21:00 排本地推送。
 */
export async function refreshDaypartPushes() {
	if (_daypartRefreshing) return
	_daypartRefreshing = true
	const rev = _daypartRev
	try {
		try {
			const res = await apiPushRemindersGet()
			const remote = daypartPrefsFromPush(res)
			if (remote && rev === _daypartRev) {
				const prev = uni.getStorageSync(DAYPART_KEY) || {}
				uni.setStorageSync(DAYPART_KEY, { ..._normalizeDaypart({ ...prev, ...remote }), inited: true })
			}
		} catch (e) {}
		const raw = uni.getStorageSync(DAYPART_KEY)
		const anyOn = !!(raw && raw.inited && REMINDER_SLOTS.some((slot) => raw[`${slot.id}_enabled`]))
		if (anyOn) {
			try {
				const enabledSlots = REMINDER_SLOTS.filter((slot) => raw[`${slot.id}_enabled`])
				const copies = {}
				await Promise.all(enabledSlots.map(async (slot) => {
					try {
						const copyRes = await apiPushDailyCopiesGet(slot.id)
						Object.assign(copies, dailyCopiesFromPush(copyRes, slot.id))
					} catch (e) {}
				}))
				if (Object.keys(copies).length) {
					const prev = uni.getStorageSync(DAYPART_COPY_KEY) || {}
					uni.setStorageSync(DAYPART_COPY_KEY, { ...prev, ...copies })
				}
			} catch (e) {}
		}
	} finally {
		_daypartRefreshing = false
		ensureCheckinReminderScheduled()
	}
}

export function applyDaypartPrefs(prefs = {}) {
	_daypartRev += 1
	const next = { ..._normalizeDaypart(prefs), inited: true }
	uni.setStorageSync(DAYPART_KEY, next)
	const cur = getLocalReminderPrefs()
	applyReminderPrefsLocal({
		...cur,
		writing_enabled: false,
		practice_enabled: false,
		classic_enabled: false,
	}, { askPermission: false })
	return next
}

/** 试用结束日的前一天本地 9:00。结束日已过返回 null。 */
function _trialRemindTarget(endAt) {
	const end = new Date(endAt)
	if (Number.isNaN(end.getTime())) return null
	const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
	if (endDay.getTime() <= Date.now()) return null
	const when = new Date(endDay)
	when.setDate(when.getDate() - 1)
	when.setHours(9, 0, 0, 0)
	return when
}

function _trialState() {
	const saved = uni.getStorageSync(TRIAL_REMIND_KEY) || {}
	const enabled = Object.prototype.hasOwnProperty.call(saved, 'enabled')
		? !!saved.enabled
		: uni.getStorageSync(TRIAL_REMIND_FLAG) === true
	let endAt = saved.end_at || ''
	if (!endAt) {
		const user = getUser() || {}
		if (user.is_trial && user.vip_expire_at) endAt = user.vip_expire_at
	}
	return { saved, enabled, endAt }
}

function _trialJob() {
	const { saved, enabled, endAt } = _trialState()
	if (!enabled || !endAt) return null
	const target = _trialRemindTarget(endAt)
	if (!target) return null
	const endKey = String(endAt)
	let when = target
	let trialPatch = { ...saved, enabled: true, end_at: endAt, armed_end: endKey }
	if (target.getTime() <= Date.now() + 5000) {
		if (saved.armed_end === endKey || saved.catchup_end === endKey) return null
		when = new Date(Date.now() + 60 * 1000)
		trialPatch = { ...saved, enabled: true, end_at: endAt, catchup_end: endKey }
	}
	return {
		key: 'trial',
		at: when.getTime(),
		content: t('trial_step_remind_desc'),
		payload: JSON.stringify({ kind: 'trial_end' }),
		when,
		trialPatch,
	}
}

/** 试用页「结束前提醒」。endAt 为试用结束日；关开关则不再排。 */
export function setTrialEndReminder({ enabled, endAt } = {}) {
	const prev = uni.getStorageSync(TRIAL_REMIND_KEY) || {}
	const next = {
		enabled: !!enabled,
		end_at: endAt != null && endAt !== '' ? endAt : (prev.end_at || null),
	}
	uni.setStorageSync(TRIAL_REMIND_KEY, next)
	uni.setStorageSync(TRIAL_REMIND_FLAG, next.enabled)
	ensureCheckinReminderScheduled()
	return next
}

/** 只改打卡开关。没传入时刻时，沿用提醒页「每日打卡提醒」已保存的时间。 */
export function scheduleCheckinReminder({ enabled, hour, minute } = {}) {
	const cur = getLocalReminderPrefs()
	const next = {
		...cur,
		checkin_enabled: !!enabled,
	}
	if (hour != null && hour !== '') next.checkin_hour = hour
	if (minute != null && minute !== '') next.checkin_minute = minute
	return applyReminderPrefsLocal(next)
}

export function ensureCheckinReminderScheduled() {
	const prefs = getLocalReminderPrefs()
	const switchOn = accountCheckinRemindOn()
	return applyReminderPrefsLocal({
		...prefs,
		checkin_enabled: switchOn == null ? !!prefs.checkin_enabled : switchOn,
	})
}

export function clearCheckinReminder() {
	const cur = getLocalReminderPrefs()
	return applyReminderPrefsLocal({ ...cur, checkin_enabled: false })
}

export function getCheckinReminder() {
	const p = getLocalReminderPrefs()
	return {
		enabled: !!p.checkin_enabled,
		hour: p.checkin_hour,
		minute: p.checkin_minute,
	}
}
