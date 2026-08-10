/**
 * Selah 3.0 原生桥：写 Widget 缓存 / 换图标 / 刷新小组件。
 *
 * 优先级：
 * 1) 本地插件 SelahNative（自定义基座 / 离线包）
 * 2) plus.ios / plus.android 直调（云打包只要开了 App Group + plist 图标配置即可写缓存/换图标）
 * 3) H5 / 无原生环境 → skipped（不打断业务）
 *
 * 桌面 Widget Extension 本身仍须进离线壳（见 native/packager/MINIMAL.md）。
 */

export const SELAH_APP_GROUP = 'group.com.selah.app'
export const SELAH_PREFS = 'selah_widget'
export const SELAH_PAYLOAD_KEY = 'widget_payload_json'
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

function setIconIos(iconKey) {
	// #ifdef APP-PLUS
	try {
		const UIApplication = plus.ios.importClass('UIApplication')
		const app = UIApplication.sharedApplication()
		if (!app.supportsAlternateIcons()) {
			return Promise.resolve({
				ok: false,
				error: 'alternate_icons_unsupported',
				via: 'plus.ios',
			})
		}
		const name = !iconKey || iconKey === 'default' ? null : iconKey
		// completionHandler 传 null：系统仍会切换图标
		plus.ios.invoke(app, 'setAlternateIconName:completionHandler:', name, null)
		return Promise.resolve({ ok: true, icon_key: iconKey || 'default', via: 'plus.ios' })
	} catch (e) {
		return Promise.resolve({
			ok: false,
			error: e?.message || 'plus_ios_icon_failed',
			via: 'plus.ios',
		})
	}
	// #endif
	// #ifndef APP-PLUS
	return Promise.resolve({ ok: false, skipped: true })
	// #endif
}

function setIconAndroid(iconKey) {
	// #ifdef APP-PLUS
	try {
		const main = plus.android.runtimeMainActivity()
		const pkg = main.getPackageName()
		const pm = main.getPackageManager()
		const PackageManager = plus.android.importClass('android.content.pm.PackageManager')
		const ComponentName = plus.android.importClass('android.content.ComponentName')
		const aliases = {
			default: '.LauncherDefault',
			cross_light: '.LauncherCrossLight',
			cross_dark: '.LauncherCrossDark',
		}
		const target = aliases[iconKey] || aliases.default
		Object.keys(aliases).forEach((k) => {
			const suffix = aliases[k]
			const cn = new ComponentName(pkg, pkg + suffix)
			const state =
				suffix === target
					? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
					: PackageManager.COMPONENT_ENABLED_STATE_DISABLED
			try {
				pm.setComponentEnabledSetting(cn, state, PackageManager.DONT_KILL_APP)
			} catch (e) {}
		})
		return { ok: true, icon_key: iconKey || 'default', via: 'plus.android' }
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
		return uni.getSystemInfoSync().platform
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

/** 切换桌面图标；icon_key: default | cross_light | cross_dark */
export async function nativeSetAppIcon(iconKey) {
	const key = iconKey || 'default'
	const plugin = callPluginAsync('setAppIcon', { icon_key: key })
	if (plugin) {
		const ret = await plugin
		if (ret?.ok) return ret
	}
	const p = platform()
	if (p === 'ios') return setIconIos(key)
	if (p === 'android') return Promise.resolve(setIconAndroid(key))
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
