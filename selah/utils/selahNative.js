/**
 * Selah 3.0 原生桥：写 Widget 缓存 / 换图标 / 刷新小组件。
 *
 * 优先级：
 * 1) 本地插件 SelahNative（自定义基座 / 离线包）
 * 2) plus.ios / plus.android 直调（图标资源在离线工程：打包苹果/selah、打包安卓/selah）
 * 3) H5 / 无原生环境 → skipped（不打断业务）
 *
 * 桌面 Widget Extension 本身仍须进离线壳（见 native/packager/MINIMAL.md）。
 */

export const SELAH_APP_GROUP = 'group.com.selah.app'
/** 离线壳小组件实际使用的 App Group，和 widgetExtension.entitlements 一致 */
export const SELAH_WIDGET_GROUP = 'group.gig.selah'
export const SELAH_PREFS = 'selah_widget'
export const SELAH_PAYLOAD_KEY = 'widget_payload_json'
export const SELAH_STYLE_KEY = 'widget_style_json'
export const SELAH_QUOTE_KEY = 'quote_content'
export const SELAH_ACCENT_KEY = 'accent'
export const SELAH_UPDATED_KEY = 'updated_at'

let _mod = null

function getMod() {
	// #ifdef APP-PLUS
	if (_mod === null) {
		try {
			_mod = uni.requireNativePlugin('SelahNative') || false
		} catch (e) {
			_mod = false
		}
	}
	return _mod || null
	// #endif
	// #ifndef APP-PLUS
	return null
	// #endif
}

function callPluginAsync(method, payload = {}) {
	const mod = getMod()
	if (!mod || typeof mod[method] !== 'function') {
		return null
	}
	return new Promise((resolve) => {
		try {
			mod[method](payload, (ret) => resolve(ret || { ok: false }))
		} catch (e) {
			resolve({ ok: false, error: e?.message || 'native_call_failed' })
		}
	})
}

function parsePayloadFields(json) {
	let content = 'Selah'
	let accent = '#B6BADD'
	let updated = new Date().toISOString()
	try {
		const obj = typeof json === 'string' ? JSON.parse(json) : json
		if (obj?.quote?.content) content = String(obj.quote.content)
		if (obj?.accent) accent = String(obj.accent)
		if (obj?.updated_at) updated = String(obj.updated_at)
	} catch (e) {}
	return { content, accent, updated }
}

function writePayloadIos(json) {
	// #ifdef APP-PLUS
	try {
		const NSUserDefaults = plus.ios.importClass('NSUserDefaults')
		const suite = NSUserDefaults.alloc().initWithSuiteName(SELAH_APP_GROUP)
		if (!suite) return { ok: false, error: 'app_group_unavailable', via: 'plus.ios' }
		const fields = parsePayloadFields(json)
		suite.setObjectforKey(json, SELAH_PAYLOAD_KEY)
		suite.setObjectforKey(fields.content, SELAH_QUOTE_KEY)
		suite.setObjectforKey(fields.accent, SELAH_ACCENT_KEY)
		suite.setObjectforKey(fields.updated, SELAH_UPDATED_KEY)
		suite.synchronize()
		plus.ios.deleteObject(suite)
		return { ok: true, via: 'plus.ios' }
	} catch (e) {
		return { ok: false, error: e?.message || 'plus_ios_failed', via: 'plus.ios' }
	}
	// #endif
	// #ifndef APP-PLUS
	return { ok: false, skipped: true }
	// #endif
}

function writePayloadAndroid(json) {
	// #ifdef APP-PLUS
	try {
		const main = plus.android.runtimeMainActivity()
		const prefs = main.getSharedPreferences(SELAH_PREFS, 0)
		const editor = prefs.edit()
		const fields = parsePayloadFields(json)
		editor.putString(SELAH_PAYLOAD_KEY, json)
		editor.putString(SELAH_QUOTE_KEY, fields.content)
		editor.putString(SELAH_ACCENT_KEY, fields.accent)
		editor.putString(SELAH_UPDATED_KEY, fields.updated)
		editor.commit()
		try {
			const Intent = plus.android.importClass('android.content.Intent')
			const ComponentName = plus.android.importClass('android.content.ComponentName')
			const AppWidgetManager = plus.android.importClass('android.appwidget.AppWidgetManager')
			const mgr = AppWidgetManager.getInstance(main)
			const cn = new ComponentName(main, 'com.selah.nativeplugin.SelahAppWidgetProvider')
			const ids = mgr.getAppWidgetIds(cn)
			if (ids && ids.length) {
				const upd = new Intent(main, plus.android.importClass('com.selah.nativeplugin.SelahAppWidgetProvider'))
				upd.setAction('android.appwidget.action.APPWIDGET_UPDATE')
				upd.putExtra('appWidgetIds', ids)
				main.sendBroadcast(upd)
			}
		} catch (e2) {
			/* Provider 未打进包时忽略刷新 */
		}
		return { ok: true, via: 'plus.android' }
	} catch (e) {
		return { ok: false, error: e?.message || 'plus_android_failed', via: 'plus.android' }
	}
	// #endif
	// #ifndef APP-PLUS
	return { ok: false, skipped: true }
	// #endif
}

/** icon_key 与 /content/app-icons/ 一致；别名在离线工程 打包安卓/selah */
const ANDROID_ICON_ALIASES = {
	default: '.LauncherDefault',
	cross_light: '.LauncherCrossLight',
	cross_dark: '.LauncherCrossDark',
	classic: '.LauncherClassic',
	lavender: '.LauncherLavender',
	dusk: '.LauncherDusk',
	bloom: '.LauncherBloom',
	meadow: '.LauncherMeadow',
	stone: '.LauncherStone',
}

function normalizeIconKey(iconKey) {
	const raw = String(iconKey || 'default').trim()
	if (!raw || raw === 'primary') return 'default'
	const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_')
	if (
		slug === 'default' ||
		slug === 'launcher_default' ||
		slug === 'icon_default'
	) {
		return 'default'
	}
	if (slug === 'cross_light' || slug === 'icon_cross_light' || slug === 'launcher_cross_light') {
		return 'cross_light'
	}
	if (slug === 'cross_dark' || slug === 'icon_cross_dark' || slug === 'launcher_cross_dark') {
		return 'cross_dark'
	}
	return raw
}

function androidInt(v) {
	if (typeof v === 'number' && !Number.isNaN(v)) return v
	if (v == null) return -1
	try {
		const n = plus.android.invoke(v, 'intValue')
		if (typeof n === 'number' && !Number.isNaN(n)) return n
	} catch (e) {}
	const parsed = parseInt(String(v), 10)
	return Number.isNaN(parsed) ? -1 : parsed
}

/** 挡住回调被回收；系统弹窗点完之前不能再发下一次切换 */
let iosIconCallback = null

function setIconIos(iconKey) {
	// #ifdef APP-PLUS
	return new Promise((resolve) => {
		let app = null
		let settled = false
		const finish = (ret, release = true) => {
			if (settled) return
			settled = true
			if (release) iosIconCallback = null
			try {
				if (release && app) plus.ios.deleteObject(app)
			} catch (e) {}
			resolve(ret)
		}
		try {
			const UIApplication = plus.ios.importClass('UIApplication')
			app = UIApplication.sharedApplication()
			const supported = plus.ios.invoke(app, 'supportsAlternateIcons')
			if (supported === false || supported === 0) {
				finish({
					ok: false,
					error: 'alternate_icons_unsupported',
					via: 'plus.ios',
				})
				return
			}
			const key = normalizeIconKey(iconKey)
			const name = key === 'default' ? null : key
			let acceptCallback = false
			iosIconCallback = (error) => {
				let msg = ''
				if (error) {
					try {
						msg = plus.ios.invoke(error, 'localizedDescription') || ''
					} catch (e) {
						msg = ''
					}
				}
				msg = String(msg || '').trim()
				if (!msg || msg === 'null' || msg === '(null)' || msg === 'nil') {
					finish({ ok: true, icon_key: key, via: 'plus.ios' })
					return
				}
				// 桥会在 invoke 当帧塞一次假失败，丢掉它，等系统真正回调
				if (!acceptCallback) return
				finish({ ok: false, error: msg, via: 'plus.ios' })
			}
			plus.ios.invoke(app, 'setAlternateIconName:completionHandler:', name, iosIconCallback)
			acceptCallback = true
			// 等系统确认。提前当成成功会让下一次切换叠上去，图标就不生效
			setTimeout(
				() => finish({ ok: false, error: 'icon_change_timeout', via: 'plus.ios' }, false),
				20000,
			)
		} catch (e) {
			finish({
				ok: false,
				error: e?.message || 'plus_ios_icon_failed',
				via: 'plus.ios',
			})
		}
	})
	// #endif
	// #ifndef APP-PLUS
	return Promise.resolve({ ok: false, skipped: true })
	// #endif
}

function androidComponentState(pm, pkg, suffix) {
	const cn = plus.android.newObject('android.content.ComponentName', pkg, pkg + suffix)
	return androidInt(pm.getComponentEnabledSetting(cn))
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function setAndroidAlias(pm, pkg, suffix, state, flag) {
	const cn = plus.android.newObject('android.content.ComponentName', pkg, pkg + suffix)
	pm.setComponentEnabledSetting(cn, state, flag)
}

async function setIconAndroid(iconKey) {
	// #ifdef APP-PLUS
	try {
		const key = normalizeIconKey(iconKey)
		const suffix = ANDROID_ICON_ALIASES[key]
		if (!suffix) {
			return { ok: false, error: 'alternate_icons_unsupported', via: 'plus.android' }
		}
		const main = plus.android.runtimeMainActivity()
		const pkg = String(main.getPackageName())
		const pm = main.getPackageManager()
		plus.android.importClass('android.content.pm.PackageManager')
		const ENABLED = 1
		const DISABLED = 2
		const DONT_KILL = 1
		androidComponentState(pm, pkg, suffix)
		const commit = async () => {
			setAndroidAlias(pm, pkg, suffix, ENABLED, DONT_KILL)
			await sleep(120)
			Object.keys(ANDROID_ICON_ALIASES).forEach((k) => {
				if (k === key) return
				try {
					setAndroidAlias(pm, pkg, ANDROID_ICON_ALIASES[k], DISABLED, DONT_KILL)
				} catch (e) {}
			})
		}
		await commit()
		await sleep(180)
		await commit()
		await sleep(60)
		let state = -1
		try {
			state = androidComponentState(pm, pkg, suffix)
		} catch (e) {}
		// 2 = 仍是禁用。这时再写一次并让系统刷新启动器，否则桌面图标会停在旧的
		if (state === DISABLED) {
			setAndroidAlias(pm, pkg, suffix, ENABLED, 0)
		}
		return { ok: true, icon_key: key, via: 'plus.android' }
	} catch (e) {
		return {
			ok: false,
			error: e?.message || 'launcher_alias_missing',
			via: 'plus.android',
		}
	}
	// #endif
	// #ifndef APP-PLUS
	return { ok: false, skipped: true }
	// #endif
}

function getIconIos() {
	// #ifdef APP-PLUS
	try {
		const UIApplication = plus.ios.importClass('UIApplication')
		const app = UIApplication.sharedApplication()
		const supported = plus.ios.invoke(app, 'supportsAlternateIcons')
		if (!supported) {
			plus.ios.deleteObject(app)
			return { ok: false, error: 'alternate_icons_unsupported', via: 'plus.ios' }
		}
		const name = plus.ios.invoke(app, 'alternateIconName')
		plus.ios.deleteObject(app)
		const key = typeof name === 'string' && name ? name : 'default'
		return { ok: true, icon_key: key, via: 'plus.ios' }
	} catch (e) {
		return { ok: false, error: e?.message || 'plus_ios_icon_failed', via: 'plus.ios' }
	}
	// #endif
	// #ifndef APP-PLUS
	return { ok: false, skipped: true }
	// #endif
}

function getIconAndroid() {
	// #ifdef APP-PLUS
	try {
		const main = plus.android.runtimeMainActivity()
		const pkg = String(main.getPackageName())
		const pm = main.getPackageManager()
		let explicit = ''
		let seen = 0
		Object.keys(ANDROID_ICON_ALIASES).forEach((k) => {
			try {
				const state = androidComponentState(pm, pkg, ANDROID_ICON_ALIASES[k])
				seen += 1
				if (state === 1) explicit = k
			} catch (e) {}
		})
		if (!seen) {
			return { ok: false, error: 'launcher_alias_missing', via: 'plus.android' }
		}
		return { ok: true, icon_key: explicit || 'default', via: 'plus.android' }
	} catch (e) {
		return { ok: false, error: e?.message || 'plus_android_icon_failed', via: 'plus.android' }
	}
	// #endif
	// #ifndef APP-PLUS
	return { ok: false, skipped: true }
	// #endif
}

function platform() {
	// #ifdef APP-PLUS
	try {
		return String(uni.getSystemInfoSync().platform || '').toLowerCase()
	} catch (e) {
		return ''
	}
	// #endif
	// #ifndef APP-PLUS
	return ''
	// #endif
}

/** 将 widget-payload 写入共享区，并尽量刷新 Widget */
export async function nativeWriteWidgetPayload(payload) {
	const json = typeof payload === 'string' ? payload : JSON.stringify(payload || {})
	const plugin = callPluginAsync('writeWidgetPayload', { json })
	if (plugin) {
		const ret = await plugin
		if (ret?.ok) return ret
	}
	const p = platform()
	if (p === 'ios') return writePayloadIos(json)
	if (p === 'android') return writePayloadAndroid(json)
	return { ok: false, skipped: true, error: 'native_unavailable' }
}

function reloadIosWidgets() {
	// #ifdef APP-PLUS
	try {
		const bridge = plus.ios.importClass('SelahWidgetReload')
		if (bridge) {
			plus.ios.invoke(bridge, 'reload')
			return
		}
	} catch (e) {}
	try {
		const center = plus.ios.invoke('WidgetCenter', 'shared')
		if (center) plus.ios.invoke(center, 'reloadAllTimelines')
	} catch (e) {}
	// #endif
}

function writeStyleIos(json) {
	// #ifdef APP-PLUS
	try {
		let stored = false
		try {
			plus.ios.invoke('SelahWidgetStore', 'writeStyle:', json)
			stored = true
		} catch (e) {
			try {
				const store = plus.ios.importClass('SelahWidgetStore')
				if (store) {
					plus.ios.invoke(store, 'writeStyle:', json)
					stored = true
				}
			} catch (e2) {}
		}
		try {
			const NSUserDefaults = plus.ios.importClass('NSUserDefaults')
			const suite = NSUserDefaults.alloc().initWithSuiteName(SELAH_WIDGET_GROUP)
			if (suite) {
				plus.ios.invoke(suite, 'setObject:forKey:', json, SELAH_STYLE_KEY)
				plus.ios.invoke(suite, 'synchronize')
				plus.ios.deleteObject(suite)
				stored = true
			}
		} catch (e) {}
		reloadIosWidgets()
		return stored
			? { ok: true, via: 'plus.ios' }
			: { ok: false, error: 'app_group_unavailable', via: 'plus.ios' }
	} catch (e) {
		return { ok: false, error: e?.message || 'plus_ios_failed', via: 'plus.ios' }
	}
	// #endif
	// #ifndef APP-PLUS
	return { ok: false, skipped: true }
	// #endif
}

function notifyAndroidWidgets(main) {
	try {
		const bridge = plus.android.importClass('com.gig.selah.WidgetBridge')
		bridge.reload(main)
	} catch (e) {
		try {
			plus.android.invoke('com.gig.selah.WidgetBridge', 'reload', main)
		} catch (e2) {}
	}
	try {
		const Intent = plus.android.importClass('android.content.Intent')
		const ComponentName = plus.android.importClass('android.content.ComponentName')
		const refresh = new Intent('com.gig.selah.action.WIDGET_QUOTE_REFRESH')
		refresh.setComponent(new ComponentName(main, 'com.gig.selah.WidgetRefreshReceiver'))
		main.sendBroadcast(refresh)
	} catch (e) {}
}

function writeStyleAndroid(json) {
	// #ifdef APP-PLUS
	try {
		const main = plus.android.runtimeMainActivity()
		const prefs = plus.android.invoke(main, 'getSharedPreferences', SELAH_PREFS, 0)
		const editor = plus.android.invoke(prefs, 'edit')
		plus.android.invoke(editor, 'putString', SELAH_STYLE_KEY, json)
		plus.android.invoke(editor, 'commit')
		notifyAndroidWidgets(main)
		return { ok: true, via: 'plus.android' }
	} catch (e) {
		return { ok: false, error: e?.message || 'plus_android_failed', via: 'plus.android' }
	}
	// #endif
	// #ifndef APP-PLUS
	return { ok: false, skipped: true }
	// #endif
}

/** 首页壁纸 + 小组件名称/边框/语录/刷新频率，写入桌面小组件并立刻刷新 */
export async function nativeWriteWidgetStyle(payload) {
	const json = typeof payload === 'string' ? payload : JSON.stringify(payload || {})
	const p = platform()
	if (p === 'ios') return writeStyleIos(json)
	if (p === 'android') return writeStyleAndroid(json)
	return { ok: false, skipped: true, error: 'native_unavailable' }
}

let iconChangeChain = Promise.resolve()

/** 切换桌面图标。同一时间只跑一次，避免叠加上一次系统切换。 */
export function nativeSetAppIcon(iconKey) {
	const job = iconChangeChain.then(() => applyNativeAppIcon(iconKey))
	iconChangeChain = job.then(
		() => {},
		() => {},
	)
	return job
}

async function applyNativeAppIcon(iconKey) {
	const key = normalizeIconKey(iconKey)
	const once = async () => {
		const plugin = callPluginAsync('setAppIcon', { icon_key: key })
		if (plugin) {
			const ret = await plugin
			if (ret?.ok) return ret
		}
		const p = platform()
		if (p === 'ios') return setIconIos(key)
		if (p === 'android') return setIconAndroid(key)
		return { ok: false, skipped: true, error: 'native_unavailable' }
	}
	const first = await once()
	if (!first || first.ok || first.skipped) return first
	await sleep(400)
	return once()
}

/** 读取当前桌面图标；标准基座没有备用图标时返回 ok:false */
export async function nativeGetAppIcon() {
	const plugin = callPluginAsync('getAppIcon', {})
	if (plugin) {
		const ret = await plugin
		if (ret?.ok && ret.icon_key) return ret
	}
	const p = platform()
	if (p === 'ios') return getIconIos()
	if (p === 'android') return getIconAndroid()
	return { ok: false, skipped: true, error: 'native_unavailable' }
}

export async function nativeReloadWidgets() {
	const plugin = callPluginAsync('reloadWidgets', {})
	if (plugin) {
		const ret = await plugin
		if (ret?.ok) return ret
	}
	// 无插件时：Android 尝试广播；iOS 依赖 Timeline 策略
	if (platform() === 'android') {
		return writePayloadAndroid(
			uni.getStorageSync('widget_payload_last') ||
				JSON.stringify({ empty: true, quote: null, accent: '#B6BADD' }),
		)
	}
	return { ok: true, via: 'noop' }
}

export function nativeGetCachedPayload() {
	const mod = getMod()
	if (mod && typeof mod.getCachedPayload === 'function') {
		try {
			return mod.getCachedPayload({}) || ''
		} catch (e) {}
	}
	// #ifdef APP-PLUS
	try {
		if (platform() === 'ios') {
			const NSUserDefaults = plus.ios.importClass('NSUserDefaults')
			const suite = NSUserDefaults.alloc().initWithSuiteName(SELAH_APP_GROUP)
			const v = suite ? suite.stringForKey(SELAH_PAYLOAD_KEY) : ''
			if (suite) plus.ios.deleteObject(suite)
			return v || ''
		}
		if (platform() === 'android') {
			const main = plus.android.runtimeMainActivity()
			const prefs = main.getSharedPreferences(SELAH_PREFS, 0)
			return prefs.getString(SELAH_PAYLOAD_KEY, '') || ''
		}
	} catch (e) {}
	// #endif
	return ''
}

export function isSelahNativeAvailable() {
	if (getMod()) return true
	// #ifdef APP-PLUS
	return true
	// #endif
	// #ifndef APP-PLUS
	return false
	// #endif
}

/**
 * 解析 selah:// Deep Link → 站内路径
 * @returns {string|null}
 */
export function routeFromSelahDeepLink(raw) {
	if (!raw || typeof raw !== 'string') return null
	const s = raw.trim()
	const lower = s.toLowerCase()
	if (!lower.startsWith('selah://')) return null
	const rest = s.slice('selah://'.length)
	const path = rest.split('?')[0].replace(/^\/+/, '')
	if (path === 'widgets' || path.startsWith('widgets/')) {
		return '/pagesA/widgets/widgets?from=deeplink'
	}
	if (path === 'icons' || path.startsWith('icons/')) {
		return '/pagesA/icons/icons?from=deeplink'
	}
	if (path === 'watch' || path.startsWith('watch/')) {
		return '/pagesA/watch/watch?from=deeplink'
	}
	if (path.startsWith('quote/')) {
		const id = path.split('/')[1]
		return id ? `/pages/home/home?quote_id=${encodeURIComponent(id)}` : '/pages/home/home'
	}
	return null
}
