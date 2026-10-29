/**
 * StoreKit / Play Billing：Android 只走离线包原生插件 Selah-GoogleIap；
 * iOS 走 uni.getProvider + requestOrder + uni.requestPayment（appleiap）。
 * H5 与无通道一律失败闭合，不拼假收据。
 */

function storeUnavailable() {
	const err = new Error('STORE_UNAVAILABLE')
	err.code = 'STORE_UNAVAILABLE'
	return err
}

function platformOf() {
	try {
		const sys = uni.getSystemInfoSync?.() || {}
		return /android/i.test(sys.platform || sys.osName || '') ? 'android' : 'ios'
	} catch (e) {
		return 'ios'
	}
}

function pickIapChannel(channels) {
	const list = Array.isArray(channels) ? channels : []
	const hit = list.find((c) => String(c.id || '').toLowerCase() === 'appleiap')
	return hit || null
}

function normalizePaymentResult(result, fallbackProductId) {
	const r = result || {}
	const tx = String(
		r.transactionIdentifier || r.transaction_id || r.orderId || r.tradeno || r.transactionId || '',
	)
	const receipt = String(
		r.transactionReceipt || r.receipt || r.purchaseToken || r.token || r.paymentReceipt || r.receipt_data || '',
	)
	const productId = String(r.productId || r.productid || r.product_id || fallbackProductId || '')
	const original = String(r.originalTransactionIdentifier || r.original_transaction_id || tx)
	return {
		platform: platformOf(),
		product_id: productId,
		product_type: String(r.product_type || r.productType || ''),
		transaction_id: tx,
		original_transaction_id: original,
		receipt_data: receipt,
		sandbox: !!r.sandbox,
	}
}

function nativeFail(row) {
	const code = String((row && (row.errCode || row.code)) || 'IAP_FAIL')
	const msg = String((row && (row.message || row.msg)) || '').trim()
	const e = new Error(msg || code)
	e.code = code
	return e
}

function getNativeGoogleIap() {
	try {
		if (typeof uni === 'undefined' || typeof uni.requireNativePlugin !== 'function') return null
		const mod = uni.requireNativePlugin('Selah-GoogleIap')
		if (mod && typeof mod.purchase === 'function') return mod
	} catch (e) {}
	return null
}

function normalizeProductType(productType) {
	const raw = String(productType || 'inapp').toLowerCase()
	if (raw === 'subs' || raw === 'subscription' || raw === 'sub') return 'subs'
	return 'inapp'
}

function purchaseViaNative(mod, pid, productType) {
	return new Promise((resolve, reject) => {
		mod.purchase({ productId: pid, productType }, (res) => {
			const row = res || {}
			const code = Number(row.code)
			if (code === 7) {
				const e = new Error('ITEM_ALREADY_OWNED')
				e.code = 'ITEM_ALREADY_OWNED'
				reject(e)
				return
			}
			if (code !== 0) {
				reject(nativeFail(row))
				return
			}
			const out = normalizePaymentResult(row, pid)
			if (!out.transaction_id && !out.receipt_data) {
				reject(storeUnavailable())
				return
			}
			resolve(out)
		})
	})
}

function restoreViaNative(mod) {
	return new Promise((resolve, reject) => {
		mod.restore({}, (res) => {
			const row = res || {}
			if (Number(row.code) !== 0) {
				reject(nativeFail(row))
				return
			}
			const list = Array.isArray(row.list) ? row.list : []
			resolve(list.map((item) => normalizePaymentResult(item, '')).filter((r) => r.transaction_id || r.receipt_data))
		})
	})
}

function paymentFail(err) {
	const code = String((err && (err.errCode ?? err.code)) || 'IAP_FAIL')
	const msg = String((err && (err.errMsg || err.message || err.msg)) || '').trim()
	const e = new Error(msg || code)
	if (code === '2' || /cancel/i.test(msg)) e.code = 'USER_CANCELED'
	else e.code = code
	return e
}

function getIapChannel() {
	return new Promise((resolve, reject) => {
		if (typeof uni.getProvider === 'function') {
			uni.getProvider({
				service: 'payment',
				success: (res) => {
					const ch = pickIapChannel(res && res.providers)
					if (!ch) {
						reject(storeUnavailable())
						return
					}
					resolve(ch)
				},
				fail: () => reject(storeUnavailable()),
			})
			return
		}
		if (typeof plus === 'undefined' || !plus.payment || typeof plus.payment.getChannels !== 'function') {
			reject(storeUnavailable())
			return
		}
		plus.payment.getChannels((channels) => {
			const ch = pickIapChannel(channels)
			if (!ch) {
				reject(storeUnavailable())
				return
			}
			resolve(ch)
		}, () => reject(storeUnavailable()))
	})
}

function requestAppleOrder(channel, productId) {
	return new Promise((resolve, reject) => {
		const done = (list, err) => {
			if (err) {
				reject(paymentFail(err))
				return
			}
			const rows = Array.isArray(list) ? list : []
			if (!rows.length) {
				reject(storeUnavailable())
				return
			}
			resolve(rows[0])
		}
		if (typeof channel.requestOrder === 'function') {
			channel.requestOrder([productId], (list) => done(list), (err) => done(null, err))
			return
		}
		if (typeof channel.requestProduct === 'function') {
			channel.requestProduct([productId], (list) => done(list), (err) => done(null, err))
			return
		}
		reject(storeUnavailable())
	})
}

function purchaseViaAppleIap(productId, username) {
	return (async () => {
		const channel = await getIapChannel()
		const productInfo = await requestAppleOrder(channel, productId)
		const pid = String((productInfo && productInfo.productid) || productId)
		return new Promise((resolve, reject) => {
			uni.requestPayment({
				provider: 'appleiap',
				orderInfo: {
					productid: pid,
					username: String(username || ''),
					manualFinishTransaction: true,
				},
				success: (res) => {
					const row = normalizePaymentResult(res, pid)
					if (!row.transaction_id && !row.receipt_data) {
						reject(storeUnavailable())
						return
					}
					row._transaction = res
					resolve(row)
				},
				fail: (err) => {
					reject(paymentFail(err))
				},
			})
		})
	})()
}

/**
 * 服务端验单通过后关闭 Apple IAP 交易。
 * @param {{ _transaction?: object, transaction_id?: string }} bought
 */
export function finishIapTransaction(bought) {
	if (platformOf() !== 'ios') return Promise.resolve()
	const transaction = bought && (bought._transaction || bought.transaction_id)
	if (!transaction) return Promise.resolve()
	return getIapChannel().then((channel) => {
		if (!channel || typeof channel.finishTransaction !== 'function') return
		return new Promise((resolve) => {
			try {
				channel.finishTransaction(transaction, () => resolve(), () => resolve())
			} catch (e) {
				try { channel.finishTransaction(bought.transaction_id) } catch (e2) {}
				resolve()
			}
		})
	}).catch(() => {})
}

/**
 * @param {string} productId 商店 product_id（接口返回什么就传什么）
 * @param {'inapp'|'subs'} [productType='inapp'] inapp 一次性，subs 订阅
 * @param {{ username?: string }} [opts]
 */
export async function purchaseIap(productId, productType = 'inapp', opts = {}) {
	const pid = String(productId || '').trim()
	const type = normalizeProductType(productType)
	const username = String((opts && opts.username) || '').trim()
	if (!pid) throw storeUnavailable()
	if (platformOf() === 'android') {
		const native = getNativeGoogleIap()
		if (!native) throw storeUnavailable()
		return purchaseViaNative(native, pid, type)
	}
	return purchaseViaAppleIap(pid, username)
}

/**
 * @returns {Promise<Array<{platform, product_id, transaction_id, receipt_data, original_transaction_id}>>}
 */
export async function restoreIapPurchases() {
	if (platformOf() === 'android') {
		const native = getNativeGoogleIap()
		if (native && typeof native.restore === 'function') return restoreViaNative(native)
		throw storeUnavailable()
	}
	const channel = await getIapChannel()
	return new Promise((resolve, reject) => {
		const finish = (raw) => {
			const list = Array.isArray(raw) ? raw : (raw ? [raw] : [])
			resolve(list.map((item) => normalizePaymentResult(item, '')).filter((r) => r.transaction_id || r.receipt_data))
		}
		if (typeof channel.restoreComplateRequest === 'function') {
			channel.restoreComplateRequest({ manual: true }, finish, (err) => {
				const e = new Error((err && (err.message || err.msg)) || 'restore failed')
				e.code = (err && err.code) || 'IAP_RESTORE_FAIL'
				reject(e)
			})
			return
		}
		if (plus.payment && typeof plus.payment.restoreComplateRequest === 'function') {
			plus.payment.restoreComplateRequest({ manual: true }, finish, () => resolve([]))
			return
		}
		resolve([])
	})
}
