/**
 * StoreKit / Play Billing：真机 plus.payment；H5 与无通道一律失败闭合，不拼假收据。
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
	const prefer = ['appleiap', 'googleiap', 'iap']
	for (const id of prefer) {
		const hit = list.find((c) => String(c.id || '').toLowerCase() === id)
		if (hit) return hit
	}
	return list.find((c) => /iap|apple|google/i.test(String(c.id || ''))) || null
}

function normalizePaymentResult(result, fallbackProductId) {
	const r = result || {}
	const tx = String(
		r.transactionIdentifier || r.transaction_id || r.orderId || r.tradeno || r.transactionId || '',
	)
	const receipt = String(
		r.transactionReceipt || r.receipt || r.purchaseToken || r.token || r.paymentReceipt || '',
	)
	const productId = String(r.productId || r.productid || r.product_id || fallbackProductId || '')
	const original = String(r.originalTransactionIdentifier || r.original_transaction_id || tx)
	return {
		platform: platformOf(),
		product_id: productId,
		transaction_id: tx,
		original_transaction_id: original,
		receipt_data: receipt,
		sandbox: false,
	}
}

function getIapChannel() {
	return new Promise((resolve, reject) => {
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

/**
 * @param {string} productId 商店 product_id
 * @returns {Promise<{platform, product_id, transaction_id, receipt_data, sandbox}>}
 */
export async function purchaseIap(productId) {
	const pid = String(productId || '').trim()
	if (!pid) throw storeUnavailable()
	const channel = await getIapChannel()
	return new Promise((resolve, reject) => {
		plus.payment.request(
			channel,
			{ productid: pid },
			(result) => {
				const row = normalizePaymentResult(result, pid)
				if (!row.transaction_id && !row.receipt_data) {
					reject(storeUnavailable())
					return
				}
				resolve(row)
			},
			(err) => {
				const e = new Error((err && (err.message || err.msg)) || 'iap failed')
				e.code = (err && err.code) || 'IAP_FAIL'
				reject(e)
			},
		)
	})
}

/**
 * @returns {Promise<Array<{platform, product_id, transaction_id, receipt_data, original_transaction_id}>>}
 */
export async function restoreIapPurchases() {
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
