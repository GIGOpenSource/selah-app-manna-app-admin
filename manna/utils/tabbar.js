/**
 * 原生 tabBar 隐藏；实际底栏为各页 MannaTabBar。
 * App 冷启时 hideTabBar 常需延后多打几次才生效；听经返回时勿改 webview 几何（易崩）。
 */
import { reactive } from 'vue'
import { TAB_URLS } from '@/utils/nav.js'

export function applyTabBarLocale() {}

let lastHideTabBarAt = 0
let hideTimers = []

function clearHideTimers() {
	while (hideTimers.length) {
		clearTimeout(hideTimers.pop())
	}
}

function runHideTabBar() {
	try {
		const ret = uni.hideTabBar({ animation: false })
		if (ret && typeof ret.then === 'function') {
			ret.catch(() => {})
		}
	} catch (e) {}
}

/**
 * @param {{ force?: boolean }} [opts]
 */
export function hideNativeTabBar(opts = {}) {
	const force = !!(opts && opts.force)
	const now = Date.now()
	// 短时间重复调用仍补一次立即 hide，但避免叠太多定时器
	if (!force && now - lastHideTabBarAt < 800) {
		runHideTabBar()
		return
	}
	lastHideTabBarAt = now
	clearHideTimers()
	runHideTabBar()
	// 冷启：原生底栏晚于首帧创建，需补刀（日常切 Tab 不再叠定时器）
	if (force) {
		;[60, 320, 800].forEach((ms) => {
			hideTimers.push(setTimeout(runHideTabBar, ms))
		})
	}
}

/** @deprecated 兼容旧调用；现由页面内 MannaTabBar 的 active 控制 */
export function setTabBarSelected() {
	hideNativeTabBar({ force: true })
}

function normalizeRoute(route) {
	const raw = String(route || '').split('?')[0].trim()
	if (!raw) return ''
	return raw.startsWith('/') ? raw : `/${raw}`
}

export function topPageRoute() {
	try {
		const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
		const cur = pages[pages.length - 1]
		return normalizeRoute(cur?.route || '')
	} catch (e) {
		return ''
	}
}

export function isTabPageRoute(route) {
	return TAB_URLS.includes(normalizeRoute(route))
}

/** 全局底栏选中态：切 Tab 前先改，避免旧页卸栏 / 新页挂栏空窗闪动 */
export const tabUi = reactive({
	key: 'home',
})

const TAB_VARIANTS = {
	home: 'dark',
	quiz: 'dark',
	devotion: 'light',
	bible: 'light',
	me: 'light',
}

export function setTabUiKey(key) {
	const k = String(key || '').trim()
	if (!k) return
	tabUi.key = k
}

export function tabVariantFor(key) {
	return TAB_VARIANTS[key] || 'dark'
}

/**
 * Tab 页 onHide：
 * - 切到其它底栏页：不要卸自定义底栏（卸了会空窗闪）
 * - 进入子页：立刻卸，避免 fixed 底栏透到上层
 */
export function scheduleCustomTabBarHide(hideFn) {
	const route = topPageRoute()
	if (isTabPageRoute(route)) {
		return null
	}
	try {
		hideFn()
	} catch (e) {}
	return null
}
