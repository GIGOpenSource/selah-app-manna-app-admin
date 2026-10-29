/**
 * 系统闹钟：到点拉起应用并弹出响铃页。
 * 安卓用 AlarmManager.setAlarmClock，进程没在前台也会响。
 * iOS 26 用 AlarmKit，锁屏上按选定铃声循环响，直到关掉。
 * 26.6 之前（含 26.1）应用停在前台时，AlarmKit 的打开信号会晚到，响铃页就跟着晚。
 * 这些系统前台改由到点定时器直接弹响铃页。26.6 起系统会准时回调，不再加这层。
 * 更早的 iOS 用每周重复的本地通知，点开后再进响铃页。
 */
import { t } from '@/i18n/index.js'

const RING_KEY = 'selah_alarm_ringing'
const OPEN_PAGE_KEY = 'selah_alarm_open_page'
const ALARM_PAGE = '/pagesA/alarm/alarm?from=profile'
const REQUEST = 88021
const ACTION = 'selah.action.ALARM'
const RING_TTL = 3 * 60 * 1000

function androidMain() {
	if (typeof plus === 'undefined' || !plus.android) return null
	return plus.android.runtimeMainActivity()
}

function isIosApp() {
	try {
		return typeof plus !== 'undefined' && String(plus.os && plus.os.name).toLowerCase() === 'ios'
	} catch (e) {
		return false
	}
}

function alarmPendingIntent(main) {
	const Intent = plus.android.importClass('android.content.Intent')
	const PendingIntent = plus.android.importClass('android.app.PendingIntent')
	const Build = plus.android.importClass('android.os.Build')
	const intent = new Intent(main, main.getClass())
	intent.setAction(ACTION)
	intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
	intent.putExtra('selah_alarm', '1')
	let flags = 0x08000000
	if (Build.VERSION.SDK_INT >= 23) flags |= 0x04000000
	return PendingIntent.getActivity(main, REQUEST, intent, flags)
}

function alarmManager(main) {
	const Context = plus.android.importClass('android.content.Context')
	const am = main.getSystemService(Context.ALARM_SERVICE)
	plus.android.importClass(am)
	return am
}

export function canScheduleExactAlarm() {
	// #ifdef APP-PLUS
	try {
		if (isIosApp()) {
			const ok = plus.ios.invoke('SelahAlarmClock', 'authorizationGranted')
			return !(ok === false || ok === 0)
		}
		const main = androidMain()
		if (!main) return true
		const Build = plus.android.importClass('android.os.Build')
		if (Build.VERSION.SDK_INT < 31) return true
		const am = alarmManager(main)
		if (am && typeof am.canScheduleExactAlarms === 'function') return !!am.canScheduleExactAlarms()
	} catch (e) {}
	// #endif
	return true
}

/** 安卓 12+ 精确闹钟、iOS 闹钟都要用户允许，否则到点拉不醒。 */
export function openExactAlarmSettings() {
	// #ifdef APP-PLUS
	try {
		if (isIosApp()) {
			plus.ios.invoke('SelahAlarmClock', 'openSettings')
			return true
		}
		const main = androidMain()
		if (!main) return false
		const Intent = plus.android.importClass('android.content.Intent')
		const Uri = plus.android.importClass('android.net.Uri')
		const intent = new Intent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM')
		intent.setData(Uri.parse('package:' + main.getPackageName()))
		main.startActivity(intent)
		return true
	} catch (e) {}
	// #endif
	return false
}

const SOUND_FILES = {
	graceful: 'graceful.mp3',
	nature: 'nature.mp3',
	brisk: 'brisk.mp3',
	system: 'alarm.mp3',
	bell: 'alarm.mp3',
}

function alarmPrefs() {
	try {
		return uni.getStorageSync('selah_alarm_prefs') || {}
	} catch (e) {
		return {}
	}
}

function alarmSoundFile() {
	return SOUND_FILES[String(alarmPrefs().sound_id || '')] || 'alarm.mp3'
}

function alarmWeekdays() {
	const days = alarmPrefs().weekdays
	if (!Array.isArray(days) || !days.length) return '0,1,2,3,4,5,6'
	return days.map((day) => Number(day)).filter((day) => day >= 0 && day <= 6).join(',')
}

/** 弹出系统闹钟授权。iOS 第一次打开闹钟时要过这一步。 */
export function requestExactAlarmPermission() {
	return new Promise((resolve) => {
		// #ifdef APP-PLUS
		try {
			if (isIosApp()) {
				let settled = false
				const finish = (granted) => {
					if (settled) return
					settled = true
					resolve(!!granted)
				}
				plus.ios.invoke('SelahAlarmClock', 'requestAuthorization:', (granted) => {
					finish(granted === true || granted === 1)
				})
				setTimeout(() => finish(canScheduleExactAlarm()), 12000)
				return
			}
		} catch (e) {
			resolve(true)
			return
		}
		if (!canScheduleExactAlarm()) {
			openExactAlarmSettings()
			resolve(false)
			return
		}
		// #endif
		resolve(true)
	})
}

function alarmNotificationCopy() {
	try {
		const title = String(t('alarm') || '').trim()
		const body = String(t('alarm_notif_body') || '').trim()
		const dismiss = String(t('alarm_dismiss') || '').trim()
		return {
			title: title || 'Alarm',
			body: body || 'Time to practice affirmations',
			dismiss: dismiss || 'Dismiss',
		}
	} catch (e) {
		return {
			title: 'Alarm',
			body: 'Time to practice affirmations',
			dismiss: 'Dismiss',
		}
	}
}

/** 把当前语言写进系统闹钟。到点时进程可能已经不在，文案必须提前存好。 */
export function syncAndroidAlarmCopy() {
	// #ifdef APP-PLUS
	try {
		if (isIosApp()) return
		const main = androidMain()
		if (!main) return
		const copy = alarmNotificationCopy()
		plus.android.invoke(
			'com.gig.selah.AlarmClock',
			'setCopy',
			main.getApplicationContext(),
			copy.title,
			copy.body,
			copy.dismiss,
		)
	} catch (e) {}
	// #endif
}

function scheduleIosAlarmClock(when) {
	try {
		const at = when.getTime ? when.getTime() : Number(when)
		if (!Number.isFinite(at) || at <= Date.now()) return false
		const ok = plus.ios.invoke(
			'SelahAlarmClock',
			'armClock:sound:weekdays:',
			String(Math.round(at)),
			alarmSoundFile(),
			alarmWeekdays(),
		)
		return ok === true || ok === 1
	} catch (e) {
		return false
	}
}

export function scheduleAndroidAlarmClock(when) {
	// #ifdef APP-PLUS
	try {
		if (isIosApp()) return scheduleIosAlarmClock(when)
		const main = androidMain()
		if (!main || !when) return false
		const at = when.getTime ? when.getTime() : Number(when)
		if (!Number.isFinite(at) || at <= Date.now()) return false
		const ctx = main.getApplicationContext()
		const sound = alarmSoundFile()
		const days = alarmWeekdays()
		const stamp = String(Math.round(at))
		const copy = alarmNotificationCopy()
		try {
			const ok = plus.android.invoke(
				'com.gig.selah.AlarmClock',
				'armClockCopy',
				ctx,
				stamp,
				sound,
				days,
				copy.title,
				copy.body,
				copy.dismiss,
			)
			if (ok === true || ok === 1) return true
		} catch (e) {}
		try {
			const ok = plus.android.invoke('com.gig.selah.AlarmClock', 'armClock', ctx, stamp, sound, days)
			if (ok === true || ok === 1) return true
		} catch (e) {}
		const AlarmClock = plus.android.importClass('com.gig.selah.AlarmClock')
		const ok = AlarmClock.schedule(ctx, at, sound, days)
		return ok === true || ok === 1
	} catch (e) {}
	// #endif
	return false
}

/** 下一次该响的本地时间。notBefore 用来跳过刚刚已经弹过的这一分钟。 */
function nextAlarmTimestamp(notBefore = 0) {
	const prefs = alarmPrefs()
	const hour = Number(prefs.hour)
	const minute = Number(prefs.minute)
	const days = Array.isArray(prefs.weekdays) ? prefs.weekdays : []
	if (!prefs.enabled || !Number.isFinite(hour) || !Number.isFinite(minute) || !days.length) return 0
	const allow = new Set(days.map((day) => Number(day)))
	const when = new Date()
	when.setSeconds(0, 0)
	when.setHours(hour, minute, 0, 0)
	const earliest = Math.max(Date.now(), Number(notBefore) || 0)
	if (when.getTime() <= earliest) when.setDate(when.getDate() + 1)
	let guard = 0
	while (guard < 8 && !allow.has(when.getDay())) {
		when.setDate(when.getDate() + 1)
		guard += 1
	}
	if (!allow.has(when.getDay())) return 0
	return when.getTime()
}

/** 闹钟页自己画提示框时用。不走透明新页，26.1 上那一页盖在闹钟页上会是空白。 */
export function nextAlarmAt() {
	return nextAlarmTimestamp(0)
}

/** 按本地已保存的闹钟重新向系统登记。改时间时必须走这里，才能换掉上一次的触发点。 */
export function rescheduleSavedAlarm() {
	// #ifdef APP-PLUS
	const at = nextAlarmTimestamp()
	if (!at) {
		cancelAndroidAlarmClock()
		clearForegroundAlarmTimer()
		return false
	}
	const ok = scheduleAndroidAlarmClock(new Date(at))
	armForegroundAlarmTimer()
	return ok
	// #endif
	return false
}

export function cancelAndroidAlarmClock() {
	// #ifdef APP-PLUS
	try {
		if (isIosApp()) {
			plus.ios.invoke('SelahAlarmClock', 'cancel')
			return
		}
		const main = androidMain()
		if (!main) return
		const AlarmClock = plus.android.importClass('com.gig.selah.AlarmClock')
		AlarmClock.cancel(main.getApplicationContext())
	} catch (e) {}
	// #endif
}

export function wakeScreenForAlarm() {
	// #ifdef APP-PLUS
	try {
		const main = androidMain()
		if (!main) return
		const Build = plus.android.importClass('android.os.Build')
		if (Build.VERSION.SDK_INT >= 27) {
			main.setShowWhenLocked(true)
			main.setTurnScreenOn(true)
		}
	} catch (e) {}
	// #endif
}

/** 用户从 iOS 闹钟点了打开。读过就清掉，避免每次回前台再弹。 */
export function takeIosAlarmLaunch() {
	// #ifdef APP-PLUS
	try {
		if (!isIosApp()) return false
		const ok = plus.ios.invoke('SelahAlarmClock', 'takeLaunch')
		return ok === true || ok === 1
	} catch (e) {}
	// #endif
	return false
}

function currentRoute() {
	try {
		const pages = getCurrentPages() || []
		const cur = pages.length ? pages[pages.length - 1] : null
		return String((cur && cur.route) || '')
	} catch (e) {
		return ''
	}
}

function normalizeAlarmPage(page) {
	const text = String(page || '').trim()
	if (text.indexOf('alarm/alarm') < 0) return ''
	return text.charAt(0) === '/' ? text : `/${text}`
}

/** 冷启还在欢迎页时先记下，等 boot 再进闹钟页。 */
export function consumeAlarmOpenPage() {
	let page = ''
	try { page = normalizeAlarmPage(uni.getStorageSync(OPEN_PAGE_KEY)) } catch (e) {}
	try { uni.removeStorageSync(OPEN_PAGE_KEY) } catch (e) {}
	return page
}

/** 通知卡片点开。读过就清掉，避免下次回到前台再跳一次。 */
export function takeAndroidAlarmPage() {
	let page = ''
	// #ifdef APP-PLUS
	try {
		if (!isIosApp()) {
			const raw = plus.android.invoke('com.gig.selah.AlarmClock', 'takeOpenPage')
			page = normalizeAlarmPage(raw)
		}
	} catch (e) {}
	try {
		const main = androidMain()
		const intent = main && main.getIntent && main.getIntent()
		const extra = intent && intent.getStringExtra && intent.getStringExtra('selah_alarm_page')
		if (!page) page = normalizeAlarmPage(extra)
		if (extra) {
			try { intent.removeExtra('selah_alarm_page') } catch (e) {}
			try { main.setIntent(intent) } catch (e) {}
		}
	} catch (e) {}
	// #endif
	if (!page) return ''
	try { uni.setStorageSync(OPEN_PAGE_KEY, page) } catch (e) {}
	return page
}

function openAlarmSettingsFromNotification(page) {
	const url = normalizeAlarmPage(page) || ALARM_PAGE
	const route = currentRoute()
	if (!route || route.indexOf('boot/boot') >= 0) return
	if (route.indexOf('alarm/alarm') >= 0) {
		consumeAlarmOpenPage()
		return
	}
	consumeAlarmOpenPage()
	clearAlarmRinging()
	uni.navigateTo({
		url,
		fail: () => uni.reLaunch({ url }),
	})
}

/** 本次启动是不是闹钟拉起来的。读过就清掉，避免每次回前台再弹。 */
export function takeAndroidAlarmLaunch() {
	// #ifdef APP-PLUS
	try {
		const main = androidMain()
		if (!main) return false
		const intent = main.getIntent()
		if (!intent) return false
		const flag = intent.getStringExtra && intent.getStringExtra('selah_alarm')
		const action = intent.getAction && intent.getAction()
		if (flag !== '1' && action !== ACTION) return false
		try { intent.removeExtra('selah_alarm') } catch (e) {}
		try { intent.setAction(null) } catch (e) {}
		try { main.setIntent(intent) } catch (e) {}
		return true
	} catch (e) {}
	// #endif
	return false
}

export function markAlarmRinging() {
	try { uni.setStorageSync(RING_KEY, Date.now()) } catch (e) {}
}

export function peekAlarmRinging() {
	try {
		const at = Number(uni.getStorageSync(RING_KEY) || 0)
		if (!at || Date.now() - at > RING_TTL) {
			uni.removeStorageSync(RING_KEY)
			return false
		}
		return true
	} catch (e) {
		return false
	}
}

export function clearAlarmRinging() {
	try { uni.removeStorageSync(RING_KEY) } catch (e) {}
}

let openingRing = false

export function openAlarmRingPage() {
	if (openingRing) return true
	let route = ''
	try {
		const pages = getCurrentPages() || []
		const cur = pages.length ? pages[pages.length - 1] : null
		route = String((cur && cur.route) || '')
	} catch (e) {}
	if (!route || route.indexOf('boot/boot') >= 0) return false
	if (route.indexOf('alarm/ring') >= 0) return true
	// 人已经在闹钟设置页时也要打开响铃页。应用内这层才是第二个弹窗。
	openingRing = true
	const done = () => { openingRing = false }
	uni.navigateTo({
		url: '/pagesA/alarm/ring',
		fail: () => uni.reLaunch({ url: '/pagesA/alarm/ring', complete: done }),
	})
	setTimeout(done, 1500)
	return true
}

let alarmPageRing = null

/** 闹钟设置页在前台时自己弹出提示。返回 true 表示已经画出来了，不要再跳透明页。 */
export function bindAlarmPageRing(handler) {
	alarmPageRing = typeof handler === 'function' ? handler : null
}

function deliverAlarmRing() {
	if (alarmPageRing) {
		try {
			if (alarmPageRing() !== false) return true
		} catch (e) {}
	}
	return openAlarmRingPage()
}

/**
 * 26.0–26.5 的 AlarmKit 在前台会晚一点才把「打开」交给应用，26.6 起会准时。
 * 读不到版本时按会迟到处理，避免 26.1 又空等。
 */
function iosAlarmSignalLags() {
	try {
		let raw = ''
		if (typeof plus !== 'undefined' && plus.os) raw = String(plus.os.version || '')
		if (!raw && typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
			const info = uni.getSystemInfoSync() || {}
			raw = String(info.system || info.osVersion || '')
		}
		const match = raw.match(/(\d+)\.(\d+)/)
		if (!match) return true
		const major = Number(match[1])
		const minor = Number(match[2])
		if (major !== 26) return false
		return minor < 6
	} catch (e) {
		return true
	}
}

let iosWatchTimer = null
let foregroundTimer = null
let foregroundTarget = 0
let handledStamp = 0

function clearForegroundAlarmTimer() {
	if (foregroundTimer) {
		clearTimeout(foregroundTimer)
		foregroundTimer = null
	}
	foregroundTarget = 0
}

/** 这一次已经弹过。只挡住同一次迟到的系统回调，换了时间不受影响。 */
function lateSignalSuppressed() {
	return handledStamp > 0 && Date.now() - handledStamp < 3 * 60 * 1000
}

function fireInAppAlarm(stamp) {
	if (stamp && handledStamp === stamp) return true
	markAlarmRinging()
	wakeScreenForAlarm()
	const opened = deliverAlarmRing()
	if (!opened) return false
	handledStamp = stamp || Date.now()
	// 先弹页面，再去读系统标志。26.1 上这次原生调用本身就会拖住界面。
	setTimeout(() => {
		try { takeIosAlarmLaunch() } catch (e) {}
	}, 0)
	return true
}

function scheduleForegroundWait(at) {
	clearForegroundAlarmTimer()
	if (!at || !isIosApp() || !iosAlarmSignalLags()) return
	foregroundTarget = at
	const left = at - Date.now()
	let wait = 0
	if (left > 40) {
		// 长定时器在 26.1 上会被系统推迟，所以最多睡 20 秒就回来对一次表。
		wait = left > 2500 ? Math.min(left - 1000, 20000) : left
	}
	foregroundTimer = setTimeout(tickForegroundAlarm, wait)
}

function tickForegroundAlarm() {
	foregroundTimer = null
	const at = foregroundTarget
	if (!at || !isIosApp()) return
	const left = at - Date.now()
	if (left > 40) {
		scheduleForegroundWait(at)
		return
	}
	foregroundTarget = 0
	if (!fireInAppAlarm(at)) {
		foregroundTarget = at
		foregroundTimer = setTimeout(tickForegroundAlarm, 200)
		return
	}
	const follow = nextAlarmTimestamp(at)
	if (follow) scheduleForegroundWait(follow)
}

function armForegroundAlarmTimer() {
	if (!isIosApp() || !iosAlarmSignalLags()) {
		clearForegroundAlarmTimer()
		return
	}
	const at = nextAlarmTimestamp(handledStamp)
	if (!at) {
		clearForegroundAlarmTimer()
		return
	}
	scheduleForegroundWait(at)
}

function pokeIosAlarm() {
	if (iosAlarmSignalLags() && foregroundTarget) {
		const left = foregroundTarget - Date.now()
		// 到点前别打原生桥，26.1 上这次调用会把响铃页拖晚。
		if (left < 2000 && left > -300) return
	}
	const suppressLate = lateSignalSuppressed()
	if (takeIosAlarmLaunch()) {
		if (!suppressLate) markAlarmRinging()
	}
	if (peekAlarmRinging() && !suppressLate) {
		wakeScreenForAlarm()
		deliverAlarmRing()
	}
}

/** 前台一直盯着。只盯几秒的话，人停在闹钟页等到点，标志位来了也没人打开响铃页。 */
function watchIosAlarmLaunch() {
	if (!isIosApp() || iosWatchTimer) return
	iosWatchTimer = setInterval(pokeIosAlarm, 400)
}

export function stopForegroundAlarmWatch() {
	if (iosWatchTimer) {
		clearInterval(iosWatchTimer)
		iosWatchTimer = null
	}
	clearForegroundAlarmTimer()
}

/** App 回到前台或被闹钟拉起时调用。 */
export function handleAlarmLaunch() {
	const alarmPage = takeAndroidAlarmPage()
	if (alarmPage) {
		openAlarmSettingsFromNotification(alarmPage)
		syncAndroidAlarmCopy()
		return
	}
	const suppressLate = lateSignalSuppressed()
	if (takeAndroidAlarmLaunch() || takeIosAlarmLaunch()) {
		if (!suppressLate) markAlarmRinging()
	}
	if (peekAlarmRinging() && !suppressLate) {
		wakeScreenForAlarm()
		deliverAlarmRing()
	}
	watchIosAlarmLaunch()
	armForegroundAlarmTimer()
	syncAndroidAlarmCopy()
}
