/**
 * 分享封装：More 必保；Ins/FB/X 已安装才展示；未安装隐藏。
 * 优先分享海报图（imageUrl）；失败再退到文案复制。
 * App 走 Share 模块：uni.shareWithSystem / uni.share。
 * 下载链：只用运营配置的 url_download，接口返回啥用啥，不拼 /legal/download/。
 */
import { t } from '@/i18n/index.js'
import { host } from '@/config/config.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

/** 落地页可用的主题图：仅 http(s) 或站内 /static 路径 */
export function publicShareBgUrl(src) {
	const raw = String(src || '').trim()
	if (!raw) return ''
	if (/^(blob:|data:|file:|wxfile:|content:)/i.test(raw)) return ''
	if (raw.startsWith('/') && !raw.startsWith('//')) {
		const origin = String(host || '').replace(/\/api\/?$/i, '').replace(/\/$/, '')
		return origin ? `${origin}${raw}` : raw
	}
	if (/^https?:\/\//i.test(raw)) return raw
	return ''
}

/**
 * 分享用下载链：接口 url_download 原样返回；空则空。
 * extra 仅在有值时附加到已有 URL 的 query（海报 id/text/bg 等），不回落 /legal/download/。
 */
export function resolveDownloadUrl(cfgUrl, extra) {
	const fromCfg = String(cfgUrl || '').trim()
	if (!fromCfg) return ''
	const pack = extra && typeof extra === 'object' ? extra : {}
	const entries = Object.keys(pack).filter((key) => {
		const val = pack[key]
		return val != null && String(val).trim() !== ''
	})
	if (!entries.length) return fromCfg
	try {
		const u = new URL(fromCfg)
		entries.forEach((key) => {
			u.searchParams.set(key, String(pack[key]))
		})
		return u.toString()
	} catch (e) {
		return fromCfg
	}
}

const SHARE_PAGE = '/pagesA/share/share'
const SHARE_TEXT_QUERY_MAX = 500
const SHARE_DRAFT_KEY = 'share_draft_payload'
let openShareUntil = 0

/**
 * 进入海报分享页。海报文案以本次传入的 text 为准（点哪条消息就用哪条）。
 * query 带短文；全文另存草稿，避免 H5 截断或语录库覆盖。
 */
export function openSharePage(opts = {}) {
	const now = Date.now()
	if (now < openShareUntil) return
	openShareUntil = now + 700
	const q = []
	const id = opts.id ?? opts.contentId ?? opts.content_id
	if (id != null && String(id).trim() !== '' && Number(id) > 0) {
		q.push(`id=${encodeURIComponent(id)}`)
		q.push(`cid=${encodeURIComponent(id)}`)
	}
	const mode = String(opts.mode || '').trim()
	if (mode) q.push(`mode=${encodeURIComponent(mode)}`)
	if (opts.days != null && opts.days !== '') {
		q.push(`days=${encodeURIComponent(opts.days)}`)
	}
	const from = String(opts.fbSource || '').trim()
	if (from) q.push(`fb_source=${encodeURIComponent(from)}`)
	const cite = String(opts.cite || opts.source_ref || '').trim()
	if (cite) q.push(`cite=${encodeURIComponent(cite.slice(0, 120))}`)
	const body = String(opts.text || opts.content || '').trim()
	if (body) {
		const draftId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
		try {
			uni.setStorageSync(SHARE_DRAFT_KEY, {
				id: draftId,
				contentId: Number(id) > 0 ? Number(id) : null,
				text: body,
				cite,
				mode,
				collected: opts.collected === true || opts.collected === false ? !!opts.collected : null,
				historyDate: String(opts.historyDate || opts.date || '').trim(),
				fbSource: from,
			})
		} catch (e) {}
		q.push(`draft=${encodeURIComponent(draftId)}`)
		if (body.length <= SHARE_TEXT_QUERY_MAX) {
			q.push(`text=${encodeURIComponent(body)}`)
		}
	}
	uni.navigateTo({ url: q.length ? `${SHARE_PAGE}?${q.join('&')}` : SHARE_PAGE })
}

/** 读取并消费本次分享草稿；token 对不上则忽略，避免串到别的海报。 */
export function takeShareDraft(draftId) {
	const want = String(draftId || '').trim()
	if (!want) return null
	try {
		const raw = uni.getStorageSync(SHARE_DRAFT_KEY)
		uni.removeStorageSync(SHARE_DRAFT_KEY)
		uni.removeStorageSync('share_draft_text')
		uni.removeStorageSync('share_draft_cite')
		if (!raw || typeof raw !== 'object') return null
		if (String(raw.id || '') !== want) return null
		return {
			text: String(raw.text || '').trim(),
			cite: String(raw.cite || '').trim(),
			mode: String(raw.mode || '').trim(),
			contentId: Number(raw.contentId) > 0 ? Number(raw.contentId) : null,
			collected: raw.collected === true || raw.collected === false ? !!raw.collected : null,
			historyDate: String(raw.historyDate || '').trim(),
			fbSource: String(raw.fbSource || '').trim(),
		}
	} catch (e) {
		return null
	}
}

/** 语录正文后附带下载链；已含同一 URL 时不重复，不加品牌前缀 */
export function buildShareCaption(quote, downloadUrl) {
	const href = String(downloadUrl || '').trim()
	const body = String(quote || '').replace(/\s+$/, '')
	if (!href) return body
	if (body.includes(href)) return body
	return body ? `${body}\n\n${href}` : href
}

/** 复制「语录 + 可选下载链」到剪贴板（系统分享失败时的兜底） */
export function copyShareText(quote, downloadUrl, toastTitle, brand = 'Selah') {
	const text = buildShareCaption(quote, downloadUrl, brand)
	return new Promise((resolve) => {
		uni.setClipboardData({
			data: text,
			success: () => {
				uni.showToast({
					title: toastTitle || t('copied'),
					icon: 'none',
					duration: 2200,
				})
				resolve(true)
			},
			fail: () => resolve(false),
		})
	})
}

function h5DownloadImage(filePath) {
	if (!filePath || typeof document === 'undefined') return false
	try {
		const a = document.createElement('a')
		a.href = filePath
		a.download = 'selah-share.png'
		a.rel = 'noopener'
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		return true
	} catch (e) {
		return false
	}
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
	if (/^(sharewithsystem:fail|share:fail)$/.test(compact)) return true
	return /cancel|cancelled|canceled|abort|dismiss/.test(msg) || /\b-2\b/.test(msg)
}

function isIosApp() {
	try {
		return typeof plus !== 'undefined' && String(plus.os && plus.os.name).toLowerCase() === 'ios'
	} catch (e) {
		return false
	}
}

/** iOS 分享扩展要可读的本地文件地址，_doc 相对路径只有部分 App（如微信）能打开 */
function iosShareImageUrl(path) {
	const src = String(path || '').trim()
	if (!src || /^file:\/\//i.test(src) || /^https?:\/\//i.test(src)) return src
	try {
		if (typeof plus !== 'undefined' && plus.io && typeof plus.io.convertLocalFileSystemURL === 'function') {
			const abs = plus.io.convertLocalFileSystemURL(src)
			if (abs) return abs
		}
	} catch (e) {}
	return src
}

/**
 * 系统分享。
 * 安卓可以同时带文案、下载链和海报。
 * iOS 系统面板里三者一起传时，微信取图片，信息 / 邮件等取文字；有海报时只传图片。
 */
export function systemShare({ title, summary, href, imageUrl, onSuccess, onResult }) {
	const quote = String(summary || '').replace(/\s+$/, '')
	const payloadTitle = quote || title || 'Selah'
	const payloadHref = String(href || '').trim()
	const shareHref = payloadHref || undefined
	const caption = buildShareCaption(quote, payloadHref)
	const report = (ok) => {
		try { typeof onResult === 'function' && onResult(!!ok) } catch (e) {}
	}
	let panelLogged = false
	const markPanel = () => {
		if (panelLogged) return
		panelLogged = true
		try { logFirebaseEvent('system_share_show') } catch (e) {}
	}
	const done = () => {
		markPanel()
		report(true)
		try { typeof onSuccess === 'function' && onSuccess() } catch (e) {}
	}
	const copyFallback = () => {
		copyShareText(quote, payloadHref, t('share_fallback_copied'))
		report(false)
	}

	// #ifdef APP-PLUS
	const textOnly = !imageUrl
	const iosImageOnly = !textOnly && isIosApp()
	const shareImage = iosImageOnly ? iosShareImageUrl(imageUrl) : imageUrl
	const shareByUni = () => {
		uni.share({
			provider: 'system',
			type: textOnly ? 1 : (iosImageOnly ? 2 : 0),
			...(shareImage ? { imageUrl: shareImage } : {}),
			...(iosImageOnly ? {} : {
				title: payloadTitle,
				summary: textOnly ? caption : quote,
				...(textOnly || !shareHref ? {} : { href: shareHref }),
			}),
			success: () => { done() },
			fail: (err) => {
				if (isShareUserCancel(err)) {
					markPanel()
					report(false)
					return
				}
				copyFallback()
			},
		})
	}
	if (typeof uni.shareWithSystem === 'function') {
		uni.shareWithSystem({
			type: textOnly ? 'text' : 'image',
			...(shareImage ? { imageUrl: shareImage } : {}),
			...(iosImageOnly ? {} : {
				summary: textOnly ? caption : quote,
				...(shareHref ? { href: shareHref } : {}),
			}),
			success: () => { done() },
			fail: (err) => {
				// 面板已拉起后用户关掉，不再二次分享、不再提示「无法唤起」
				if (isShareUserCancel(err)) {
					markPanel()
					report(false)
					return
				}
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
		const shareAll = async (file) => {
			const payload = {
				title: payloadTitle,
				text: caption,
			}
			if (shareHref) payload.url = shareHref
			if (file) {
				const fileOk = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })
				if (fileOk) payload.files = [file]
			}
			try {
				await navigator.share(payload)
				markPanel()
				report(true)
				return
			} catch (e) {
				if (e && e.name === 'AbortError') {
					markPanel()
					report(false)
					return
				}
			}
			if (payload.files) {
				try {
					const textOnly = { title: payloadTitle, text: caption }
					if (shareHref) textOnly.url = shareHref
					await navigator.share(textOnly)
					markPanel()
					report(true)
					return
				} catch (e) {
					if (e && e.name === 'AbortError') {
						markPanel()
						report(false)
						return
					}
				}
			}
			h5ShareFallback(imageUrl, quote, payloadHref)
			report(false)
		}
		if (imageUrl) {
			fetch(imageUrl)
				.then((r) => r.blob())
				.then((blob) => {
					const type = blob.type || 'image/png'
					const file = new File([blob], 'selah-share.png', { type })
					return shareAll(file)
				})
				.catch(() => shareAll())
			return
		}
		shareAll()
		return
	}
	h5ShareFallback(imageUrl, quote, payloadHref)
	report(false)
	return
	// #endif

	copyShareText(quote, payloadHref, t('share_fallback_copied'))
	report(false)
}

/** 远程壁纸转成本域地址，避免 H5 canvas 因 COS 无 CORS 画不出背景 */
export function canvasSafeImageUrl(src) {
	const raw = String(src || '').trim()
	if (!raw) return ''
	if (/^(data:|blob:|file:|wxfile:|content:)/i.test(raw)) return raw
	if (raw.startsWith('/') && !raw.startsWith('//')) return raw
	let abs = raw
	try {
		if (typeof window !== 'undefined') {
			abs = new URL(raw, window.location.href).href
		}
	} catch (e) {
		return raw
	}
	try {
		const u = new URL(abs)
		if (typeof window !== 'undefined' && u.origin === window.location.origin) return abs
		const hostName = String(u.hostname || '').toLowerCase()
		const remote = (
			hostName.endsWith('.myqcloud.com')
			|| hostName.endsWith('.qcloud.com')
			|| hostName.endsWith('.amazonaws.com')
			|| hostName.endsWith('.aliyuncs.com')
		)
		if (!remote) return abs
		const api = String(host || '').replace(/\/$/, '')
		if (!api) return abs
		return `${api}/content/media-proxy/?url=${encodeURIComponent(abs)}`
	} catch (e) {
		return raw
	}
}

function loadHtmlImage(src) {
	return new Promise((resolve, reject) => {
		if (typeof Image === 'undefined') {
			reject(new Error('no_image'))
			return
		}
		const url = canvasSafeImageUrl(src) || src
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => resolve(img)
		img.onerror = () => reject(new Error('img'))
		img.src = url
	})
}

function coverDraw(ctx, img, x, y, w, h) {
	const iw = img.naturalWidth || img.width
	const ih = img.naturalHeight || img.height
	if (!iw || !ih) return
	const ir = iw / ih
	const br = w / h
	let sx = 0
	let sy = 0
	let sw = iw
	let sh = ih
	if (ir > br) {
		sw = ih * br
		sx = (iw - sw) / 2
	} else {
		sh = iw / br
		sy = (ih - sh) / 2
	}
	ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

export const SHARE_POSTER_W_RPX = 574
export const SHARE_POSTER_MIN_H_RPX = 908

/** 水印胶囊按品牌名量宽，避免固定宽导致 logo+文字在胶囊里偏左。 */
export function measureShareWatermarkLayout(brand) {
	const name = String(brand || 'Selah').trim() || 'Selah'
	let textW = 0
	Array.from(name).forEach((ch) => {
		textW += /[\u0000-\u00ff]/.test(ch) ? 13.2 : 22
	})
	const mark = (Array.from(name)[0] || 'S').toUpperCase()
	textW = Math.max(48, Math.ceil(textW + 4))
	const padX = 16
	const logo = 32
	const gap = 8
	const fontSize = 22
	const height = 52
	const width = padX + logo + gap + textW + padX
	const letterSize = 18
	return {
		name,
		mark,
		width,
		height,
		padX,
		gap,
		logoSize: logo,
		logoBg: '#9c7a52',
		letterSize,
		fontSize,
	}
}

/** 按中英混排估算海报行数，用于预览加高和离屏长图 */
export function countSharePosterLines(text) {
	const src = String(text || '').trim()
	if (!src) return 1
	const charsPerLine = 12
	let lines = 0
	src.split(/\r?\n/).forEach((para) => {
		const chars = Array.from(para)
		if (!chars.length) {
			lines += 1
			return
		}
		let w = 0
		let n = 1
		chars.forEach((ch) => {
			const cw = /[\u0000-\u00ff]/.test(ch) ? 0.52 : 1
			w += cw
			if (w > charsPerLine) {
				n += 1
				w = cw
			}
		})
		lines += n
	})
	return Math.max(1, lines)
}

/** 预览 / l-painter 长图尺寸（rpx） */
export function measureSharePosterLayout(text, cite) {
	const lineH = 56
	const padTop = 80
	const padBottom = 140
	const citeH = cite ? 50 : 0
	const block = countSharePosterLines(text) * lineH + citeH
	const height = Math.max(SHARE_POSTER_MIN_H_RPX, padTop + block + padBottom)
	const textTop = padTop + block + padBottom <= SHARE_POSTER_MIN_H_RPX
		? Math.round((SHARE_POSTER_MIN_H_RPX - block) / 2)
		: padTop
	return {
		width: SHARE_POSTER_W_RPX,
		height,
		textTop,
		wmTop: height - 92,
	}
}

function wrapPosterLines(ctx, text, maxWidth) {
	const src = String(text || '').trim()
	if (!src) return []
	const lines = []
	const tokens = src.split(/(\s+)/)
	let cur = ''
	const pushChar = (ch) => {
		const next = cur + ch
		if (!cur || ctx.measureText(next).width <= maxWidth) {
			cur = next
			return
		}
		lines.push(cur)
		cur = ch
	}
	tokens.forEach((tok) => {
		if (!tok) return
		if (/\s+/.test(tok)) {
			if (cur && ctx.measureText(cur + tok).width <= maxWidth) cur += tok
			return
		}
		if (ctx.measureText(tok).width <= maxWidth) {
			const next = cur ? `${cur}${tok}` : tok
			if (!cur || ctx.measureText(next).width <= maxWidth) cur = next
			else {
				lines.push(cur.trim())
				cur = tok
			}
			return
		}
		Array.from(tok).forEach(pushChar)
	})
	if (cur.trim()) lines.push(cur.trim())
	return lines
}

function roundRectPath(ctx, x, y, w, h, r) {
	const rad = Math.min(r, w / 2, h / 2)
	ctx.beginPath()
	ctx.moveTo(x + rad, y)
	ctx.arcTo(x + w, y, x + w, y + h, rad)
	ctx.arcTo(x + w, y + h, x, y + h, rad)
	ctx.arcTo(x, y + h, x, y, rad)
	ctx.arcTo(x, y, x + w, y, rad)
	ctx.closePath()
}

/** H5：用当前背景图合成海报；文字过多时加高成完整长图 */
export async function composeSharePoster({ bgSrc, text, cite, showWatermark, brand }) {
	if (typeof document === 'undefined') throw new Error('not_h5')
	const W = 1148
	const MIN_H = 1816
	const padTop = 160
	const padBottom = 280
	const lineH = 112
	const citeGap = cite ? 68 : 0
	const measure = document.createElement('canvas').getContext('2d')
	measure.font = '700 80px "SelahDisplay", "Libre Baskerville", Georgia, serif'
	const lines = wrapPosterLines(measure, text, W - 160)
	const blockH = Math.max(lines.length, 1) * lineH + citeGap
	const H = Math.max(MIN_H, padTop + blockH + padBottom)
	const canvas = document.createElement('canvas')
	canvas.width = W
	canvas.height = H
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = '#fbf8f2'
	ctx.fillRect(0, 0, W, H)
	try {
		const img = await loadHtmlImage(bgSrc)
		coverDraw(ctx, img, 0, 0, W, H)
	} catch (e) {}
	ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
	ctx.fillRect(0, 0, W, H)
	ctx.fillStyle = '#ffffff'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.font = '700 80px "SelahDisplay", "Libre Baskerville", Georgia, serif'
	const startY = H <= MIN_H && padTop + blockH + padBottom <= MIN_H
		? H / 2 - blockH / 2 + lineH / 2
		: padTop + lineH / 2
	let y = startY
	lines.forEach((line) => {
		ctx.fillText(line, W / 2, y)
		y += lineH
	})
	if (cite) {
		ctx.font = '700 48px "SelahDisplay", "Libre Baskerville", Georgia, serif'
		ctx.fillText(String(cite), W / 2, y + 8)
	}
	if (showWatermark) {
		const brandLabel = String(brand || 'Selah')
		ctx.font = '600 44px sans-serif'
		const textW = Math.max(ctx.measureText(brandLabel).width, 80)
		const padX = 32
		const logoSize = 64
		const gap = 16
		const pillH = 104
		const pillW = padX + logoSize + gap + textW + padX
		const px = (W - pillW) / 2
		const py = H - 80 - pillH
		ctx.fillStyle = 'rgba(255,255,255,0.45)'
		roundRectPath(ctx, px, py, pillW, pillH, 32)
		ctx.fill()
		const logoX = px + padX
		const logoY = py + (pillH - logoSize) / 2
		const logoR = 16
		ctx.fillStyle = '#9c7a52'
		roundRectPath(ctx, logoX, logoY, logoSize, logoSize, logoR)
		ctx.fill()
		ctx.fillStyle = '#ffffff'
		ctx.font = '700 36px "SelahDisplay", "Libre Baskerville", Georgia, serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		const mark = (Array.from(brandLabel)[0] || 'S').toUpperCase()
		ctx.fillText(mark, logoX + logoSize / 2, logoY + logoSize / 2)
		ctx.fillStyle = '#191919'
		ctx.font = '600 44px sans-serif'
		ctx.textAlign = 'left'
		ctx.textBaseline = 'middle'
		ctx.fillText(brandLabel, px + padX + logoSize + gap, py + pillH / 2)
	}
	const dataUrl = canvas.toDataURL('image/png')
	if (!dataUrl || dataUrl === 'data:,') throw new Error('empty_poster')
	return dataUrl
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
			const bitmap = new plus.nativeObj.Bitmap(`selah_save_${Date.now()}`)
			bitmap.loadBase64Data(
				dataUrl,
				() => {
					const filePath = `_doc/uniapp_temp/selah_save_${Date.now()}.${format}`
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
		a.download = 'selah-share.png'
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
			const id = `selah_share_${Date.now()}`
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
			title: title || 'Selah',
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
			title: title || 'Selah',
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
