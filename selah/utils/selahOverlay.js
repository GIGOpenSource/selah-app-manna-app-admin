/**
 * 自定义弹层：主包独立页 + getApp().globalData 回调。
 * 不依赖 easycom / eventChannel / showModal / Android Studio 模块。
 */

export const SELAH_MODAL_PAYLOAD = 'selah_modal_payload_v2'
export const SELAH_SHEET_PAYLOAD = 'selah_sheet_payload_v2'

function ensureGlobal() {
	try {
		const app = getApp()
		if (app && !app.globalData) app.globalData = {}
		return app
	} catch (e) {
		return null
	}
}

/**
 * @param {object} payload
 * @returns {Promise<{ action: 'confirm'|'cancel', value?: string }>}
 */
export function openSelahModal(payload = {}) {
	const data = {
		title: payload.title || '',
		content: payload.content || '',
		editable: !!payload.editable,
		value: payload.value != null ? String(payload.value) : '',
		placeholder: payload.placeholder || '',
		confirmText: payload.confirmText || 'OK',
		cancelText: payload.cancelText || 'Cancel',
		showCancel: payload.showCancel !== false,
		closeOnMask: payload.closeOnMask !== false,
		extra: payload.extra || null,
	}
	try {
		uni.setStorageSync(SELAH_MODAL_PAYLOAD, data)
	} catch (e) {}

	return new Promise((resolve) => {
		const app = ensureGlobal()
		let settled = false
		const finish = (result) => {
			if (settled) return
			settled = true
			if (app && app.globalData) app.globalData.__selahModalResolve = null
			resolve(result || { action: 'cancel', value: '' })
		}
		if (app && app.globalData) {
			app.globalData.__selahModalResolve = finish
		}
		uni.navigateTo({
			url: '/pages/selah-overlay/modal',
			fail: (err) => {
				const msg = (err && (err.errMsg || err.message)) || 'navigateTo failed'
				try {
					uni.showToast({ title: String(msg).slice(0, 40), icon: 'none', duration: 2500 })
				} catch (e) {}
				finish({ action: 'cancel', value: '' })
			},
		})
	})
}

/**
 * @param {object} payload
 * @returns {Promise<{ action: 'confirm'|'cancel', index: number, value?: any, item?: any }>}
 */
export function openSelahSheet(payload = {}) {
	const data = {
		title: payload.title || '',
		items: Array.isArray(payload.items) ? payload.items : [],
		modelValue: payload.modelValue,
		valueKey: payload.valueKey || 'code',
		labelKey: payload.labelKey || 'label',
		cancelText: payload.cancelText || 'Cancel',
	}
	try {
		uni.setStorageSync(SELAH_SHEET_PAYLOAD, data)
	} catch (e) {}

	return new Promise((resolve) => {
		const app = ensureGlobal()
		let settled = false
		const finish = (result) => {
			if (settled) return
			settled = true
			if (app && app.globalData) app.globalData.__selahSheetResolve = null
			resolve(result || { action: 'cancel', index: -1 })
		}
		if (app && app.globalData) {
			app.globalData.__selahSheetResolve = finish
		}
		uni.navigateTo({
			url: '/pages/selah-overlay/sheet',
			fail: (err) => {
				const msg = (err && (err.errMsg || err.message)) || 'navigateTo failed'
				try {
					uni.showToast({ title: String(msg).slice(0, 40), icon: 'none', duration: 2500 })
				} catch (e) {}
				finish({ action: 'cancel', index: -1 })
			},
		})
	})
}

export function resolveSelahModal(result) {
	try {
		const app = ensureGlobal()
		const fn = app && app.globalData && app.globalData.__selahModalResolve
		if (typeof fn === 'function') fn(result)
	} catch (e) {}
}

export function resolveSelahSheet(result) {
	try {
		const app = ensureGlobal()
		const fn = app && app.globalData && app.globalData.__selahSheetResolve
		if (typeof fn === 'function') fn(result)
	} catch (e) {}
}
