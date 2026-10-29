/**
 * 分享封装：More 必保；Ins/FB/X 已安装才展示；未安装隐藏。
 * 优先分享海报图（imageUrl）；失败再退到文案复制。
 * 下载链仅用运营配置的 url_download；空则不拼 Source / 不传 href。
 */
import { t } from '@/i18n/index.js'

/** 复制「语录 + 可选 Source 下载链」到剪贴板（系统分享失败时的兜底） */
export function copyShareText(quote, downloadUrl, toastTitle) {
	const href = String(downloadUrl || '').trim()
	const text = href ? `${quote}\n\nSource: ${href}` : String(quote || '')
	uni.setClipboardData({
		data: text,
		success: () => uni.showToast({
			title: toastTitle || t('copied'),
			icon: 'none',
			duration: 2200,
		}),
	})
}

function h5DownloadImage(filePath) {
	if (!filePath || typeof document === 'undefined') return false
	try {
		const a = document.createElement('a')
		a.href = filePath
		a.download = 'manna-verse.png'
		a.rel = 'noopener'
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		return true
	} catch (e) {
		return false
	}
}

/**
 * 系统分享面板。
 * - 有 imageUrl → 分享图片（海报含背景 + logo）
 * - 否则 → 文案 / 链接
 * - H5 桌面端通常无 Web Share：下载海报并复制文案（明确提示，避免误以为点了「复制」）
 * - 用户关掉分享面板：不提示「无法唤起」、不复制兜底
 */
export function systemShare({ title, summary, href, imageUrl }) {
	const payloadTitle = title || 'Manna'
	const payloadSummary = summary || ''
	const payloadHref = String(href || '').trim()
	const shareHref = payloadHref || undefined
	const textOnly = !imageUrl
	// 纯文案分享：把下载链拼进文案，系统面板更稳
	const shareBody = textOnly
		? (payloadHref && !payloadSummary.includes(payloadHref)
			? (payloadSummary ? `${payloadSummary}\n\n${payloadHref}` : payloadHref)
			: payloadSummary)
		: payloadSummary

	const copyFallback = () => {
		copyShareText(payloadSummary, payloadHref, t('share_fallback_copied'))
	}

	// #ifdef APP-PLUS
	const shareByUni = () => {
		uni.share({
			provider: 'system',
			type: textOnly ? 0 : 2,
			...(imageUrl ? { imageUrl } : {}),
			title: payloadTitle,
			summary: shareBody,
			...(shareHref ? { href: shareHref } : {}),
			success: () => {},
			fail: (err) => {
				if (isShareUserCancel(err)) return
				copyFallback()
			},
		})
	}
	if (typeof uni.shareWithSystem === 'function') {
		uni.shareWithSystem({
			type: textOnly ? 'text' : 'image',
			...(imageUrl ? { imageUrl } : {}),
			summary: shareBody,
			content: shareBody,
			...(shareHref ? { href: shareHref } : {}),
			success: () => {},
			fail: (err) => {
				// 面板已拉起后用户关掉，不再二次分享、不再提示「无法唤起」
				if (isShareUserCancel(err)) return
				shareByUni()
			},
		})
		return
	}
	shareByUni()
	return
	// #endif

	// #ifdef H5
	const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	if (canWebShare) {
		const shareText = async () => {
			try {
				await navigator.share({
					title: payloadTitle,
					text: shareBody,
					...(shareHref ? { url: shareHref } : {}),
				})
			} catch (e) {
				if (e && e.name === 'AbortError') return
				h5ShareFallback(imageUrl, payloadSummary, payloadHref)
			}
		}
		if (imageUrl) {
			fetch(imageUrl)
				.then((r) => r.blob())
				.then(async (blob) => {
					const file = new File([blob], 'manna-share.png', { type: blob.type || 'image/png' })
					const data = { title: payloadTitle, text: shareBody, files: [file] }
					if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) {
						await shareText()
						return
					}
					try {
						await navigator.share(data)
					} catch (e) {
						if (e && e.name === 'AbortError') return
						await shareText()
					}
				})
				.catch(() => shareText())
			return
		}
		shareText()
		return
	}
	h5ShareFallback(imageUrl, payloadSummary, payloadHref)
	return
	// #endif

	copyShareText(payloadSummary, payloadHref, t('share_fallback_copied'))
}

/** 用户关掉系统分享面板：不当成失败，也不复制兜底 */
function isShareUserCancel(err) {
	if (err == null) return false
	if (err === 'cancel') return true
	const parts = []
	if (typeof err === 'string' || typeof err === 'number') {
		parts.push(String(err))
	} else if (typeof err === 'object') {
		;['errMsg', 'message', 'msg', 'code', 'errCode'].forEach((k) => {
			if (err[k] != null && err[k] !== '') parts.push(String(err[k]))
		})
	}
	const msg = parts.join(' ').toLowerCase()
	if (!msg.trim()) return false
	const compact = msg.replace(/\s+/g, '')
	// 部分机型取消只回 shareWithSystem:fail / share:fail，无 cancel 字样
	if (/^(sharewithsystem:fail|share:fail)$/.test(compact)) return true
	return /cancel|cancelled|canceled|abort|dismiss/.test(msg) || /\b-2\b/.test(msg)
}

/** H5 无系统分享面板时：尽量下载海报 + 复制文案，并说明原因 */
function h5ShareFallback(imageUrl, summary, downloadUrl) {
	const downloaded = imageUrl ? h5DownloadImage(imageUrl) : false
	copyShareText(
		summary,
		downloadUrl,
		downloaded ? t('share_h5_fallback_with_image') : t('share_fallback_copied'),
	)
}

function promptAlbumSetting() {
	uni.showModal({
		title: t('save_album'),
		content: t('save_need_album_auth'),
		confirmText: t('ok') || 'OK',
		cancelText: t('cancel'),
		success: (r) => {
			if (r.confirm && typeof uni.openSetting === 'function') {
				uni.openSetting({})
			}
		},
	})
}

function saveBase64ToLocal(dataUrl) {
	return new Promise((resolve, reject) => {
		// #ifdef APP-PLUS
		try {
			const m = /^data:image\/(\w+);base64,/.exec(dataUrl)
			const format = (m && m[1]) || 'png'
			const bitmap = new plus.nativeObj.Bitmap(`manna_save_${Date.now()}`)
			bitmap.loadBase64Data(
				dataUrl,
				() => {
					const filePath = `_doc/uniapp_temp/manna_save_${Date.now()}.${format}`
					bitmap.save(
						filePath,
						{},
						() => {
							bitmap.clear()
							resolve(filePath)
						},
						(err) => {
							bitmap.clear()
							reject(err || new Error('bitmap_save_fail'))
						},
					)
				},
				(err) => {
					bitmap.clear()
					reject(err || new Error('bitmap_load_fail'))
				},
			)
		} catch (e) {
			reject(e)
		}
		return
		// #endif
		reject(new Error('not_app'))
	})
}

function downloadToTemp(url) {
	return new Promise((resolve, reject) => {
		uni.downloadFile({
			url,
			success: (res) => {
				if (res.statusCode === 200 && res.tempFilePath) resolve(res.tempFilePath)
				else reject(new Error('download_fail'))
			},
			fail: () => reject(new Error('download_fail')),
		})
	})
}

function ensureLocalImagePath(filePath) {
	const src = String(filePath || '').trim()
	if (!src) return Promise.reject(new Error('empty'))
	if (src.startsWith('data:image')) return saveBase64ToLocal(src)
	if (/^https?:\/\//i.test(src)) return downloadToTemp(src)
	return Promise.resolve(src)
}

function plusGallerySave(path) {
	return new Promise((resolve) => {
		// #ifdef APP-PLUS
		try {
			if (typeof plus === 'undefined' || !plus.gallery || typeof plus.gallery.save !== 'function') {
				resolve(false)
				return
			}
			plus.gallery.save(
				path,
				() => resolve(true),
				() => resolve(false),
			)
			return
		} catch (e) {
			resolve(false)
			return
		}
		// #endif
		resolve(false)
	})
}

function uniSaveToAlbum(path) {
	return new Promise((resolve) => {
		uni.saveImageToPhotosAlbum({
			filePath: path,
			success: () => resolve(true),
			fail: (err) => resolve(err || false),
		})
	})
}

function authorizeAlbum() {
	return new Promise((resolve) => {
		if (typeof uni.authorize !== 'function') {
			resolve(true)
			return
		}
		uni.authorize({
			scope: 'scope.writePhotosAlbum',
			success: () => resolve(true),
			fail: () => resolve(true),
		})
	})
}

/** 保存图片到系统相册；H5 改为触发浏览器下载 */
export function saveImageToAlbum(filePath) {
	if (!filePath) {
		uni.showToast({ title: t('save_failed'), icon: 'none' })
		return Promise.resolve(false)
	}
	// #ifdef H5
	try {
		const a = document.createElement('a')
		a.href = filePath
		a.download = 'manna-verse.png'
		a.rel = 'noopener'
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		uni.showToast({ title: t('saved_to_downloads'), icon: 'none', duration: 2500 })
		return Promise.resolve(true)
	} catch (e) {
		uni.showToast({ title: t('save_failed'), icon: 'none' })
		return Promise.resolve(false)
	}
	// #endif

	return ensureLocalImagePath(filePath)
		.then((localPath) => authorizeAlbum().then(() => localPath))
		.then(async (localPath) => {
			const ok = await uniSaveToAlbum(localPath)
			if (ok === true) {
				uni.showToast({ title: t('saved'), icon: 'none' })
				return true
			}
			const viaPlus = await plusGallerySave(localPath)
			if (viaPlus) {
				uni.showToast({ title: t('saved'), icon: 'none' })
				return true
			}
			const msg = String(ok?.errMsg || ok?.message || '')
			if (/auth|authorize|permission|denied|隐私|权限/i.test(msg)) {
				promptAlbumSetting()
			} else {
				uni.showToast({ title: t('save_failed'), icon: 'none' })
			}
			return false
		})
		.catch(() => {
			uni.showToast({ title: t('save_failed'), icon: 'none' })
			return false
		})
}

/** App：截当前 WebView 为本地 png（l-painter 失败时的保存兜底） */
export function captureWebviewImage() {
	return new Promise((resolve, reject) => {
		// #ifdef APP-PLUS
		try {
			const pages = getCurrentPages()
			const page = pages[pages.length - 1]
			const wv = page && typeof page.$getAppWebview === 'function'
				? page.$getAppWebview()
				: plus.webview.currentWebview()
			if (!wv || typeof wv.draw !== 'function') {
				reject(new Error('no_webview_draw'))
				return
			}
			const id = `manna_verse_${Date.now()}`
			const bitmap = new plus.nativeObj.Bitmap(id)
			wv.draw(
				bitmap,
				() => {
					const filePath = `_doc/uniapp_temp/${id}.png`
					bitmap.save(
						filePath,
						{ overwrite: true, format: 'png' },
						() => {
							try { bitmap.clear() } catch (e) {}
							resolve(filePath)
						},
						(err) => {
							try { bitmap.clear() } catch (e) {}
							reject(err || new Error('bitmap_save_fail'))
						},
					)
				},
				(err) => {
					try { bitmap.clear() } catch (e) {}
					reject(err || new Error('webview_draw_fail'))
				},
				{ check: true },
			)
		} catch (e) {
			reject(e)
		}
		return
		// #endif
		reject(new Error('not_app'))
	})
}

/** 检测 scheme/包名是否已安装（仅 APP-PLUS） */
function appInstalled(schemes) {
	// #ifdef APP-PLUS
	try {
		if (typeof plus === 'undefined' || !plus.runtime || !plus.runtime.isApplicationExist) {
			return false
		}
		for (const s of schemes) {
			if (plus.runtime.isApplicationExist(s)) return true
		}
	} catch (e) {}
	// #endif
	return false
}

/**
 * 可用分享渠道列表：未安装的社交 App 不展示；
 * H5 仅返回 More；APP 按安装情况追加 Instagram/Facebook/X，末尾恒有 More。
 */
export function availableChannels() {
	const more = { id: 'more', label: 'More', installed: true }
	// #ifndef APP-PLUS
	return [more]
	// #endif
	// #ifdef APP-PLUS
	const social = []
	if (appInstalled([
		{ pname: 'com.instagram.android', action: 'instagram://app' },
		{ action: 'instagram://app' },
	])) {
		social.push({ id: 'instagram', label: 'Instagram', installed: true })
	}
	if (appInstalled([
		{ pname: 'com.facebook.katana', action: 'fb://' },
		{ action: 'fb://' },
	])) {
		social.push({ id: 'facebook', label: 'Facebook', installed: true })
	}
	if (appInstalled([
		{ pname: 'com.twitter.android', action: 'twitter://' },
		{ action: 'twitter://' },
	])) {
		social.push({ id: 'x', label: 'X', installed: true })
	}
	return [...social, more]
	// #endif
}

/**
 * 按渠道分享；有图时优先发图。
 * channelId=more 或未知 → 直接 systemShare。
 */
export function shareToChannel(channelId, payload) {
	const { title, summary, href, imageUrl } = payload || {}
	const shareHref = String(href || '').trim() || undefined
	// #ifdef APP-PLUS
	const providerMap = {
		instagram: 'instagram',
		facebook: 'facebook',
		x: 'twitter',
	}
	const provider = providerMap[channelId]
	if (provider && imageUrl) {
		uni.share({
			provider,
			type: 2,
			imageUrl,
			title: title || 'Manna',
			summary: summary || '',
			...(shareHref ? { href: shareHref } : {}),
			success: () => {},
			fail: () => systemShare({ title, summary, href, imageUrl }),
		})
		return
	}
	if (provider) {
		uni.share({
			provider,
			type: 0,
			title: title || 'Manna',
			summary: summary || '',
			...(shareHref ? { href: shareHref } : {}),
			success: () => {},
			fail: () => systemShare({ title, summary, href, imageUrl }),
		})
		return
	}
	// #endif
	systemShare({ title, summary, href, imageUrl })
}
