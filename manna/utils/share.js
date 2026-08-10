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
 */
export function systemShare({ title, summary, href, imageUrl }) {
	const payloadTitle = title || 'Manna'
	const payloadSummary = summary || ''
	const payloadHref = String(href || '').trim()
	const shareHref = payloadHref || undefined

	// #ifdef APP-PLUS
	if (imageUrl) {
		if (typeof uni.shareWithSystem === 'function') {
			uni.shareWithSystem({
				type: 'image',
				imageUrl,
				summary: payloadSummary,
				...(shareHref ? { href: shareHref } : {}),
				success: () => {},
				fail: () => {
					uni.share({
						provider: 'system',
						type: 2,
						imageUrl,
						title: payloadTitle,
						summary: payloadSummary,
						...(shareHref ? { href: shareHref } : {}),
						success: () => {},
						fail: () => {
							uni.showToast({ title: t('share_failed'), icon: 'none' })
							copyShareText(payloadSummary, payloadHref, t('share_fallback_copied'))
						},
					})
				},
			})
			return
		}
		uni.share({
			provider: 'system',
			type: 2,
			imageUrl,
			title: payloadTitle,
			summary: payloadSummary,
			...(shareHref ? { href: shareHref } : {}),
			success: () => {},
			fail: () => {
				uni.showToast({ title: t('share_failed'), icon: 'none' })
				copyShareText(payloadSummary, payloadHref, t('share_fallback_copied'))
			},
		})
		return
	}
	uni.share({
		provider: 'system',
		type: 0,
		title: payloadTitle,
		summary: payloadSummary,
		...(shareHref ? { href: shareHref } : {}),
		success: () => {},
		fail: () => {
			uni.showToast({ title: t('share_failed'), icon: 'none' })
			copyShareText(payloadSummary, payloadHref, t('share_fallback_copied'))
		},
	})
	return
	// #endif

	// #ifdef H5
	const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	if (canWebShare) {
		const shareText = async () => {
			try {
				await navigator.share({
					title: payloadTitle,
					text: payloadSummary,
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
					const data = { title: payloadTitle, text: payloadSummary, files: [file] }
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

/** H5 无系统分享面板时：尽量下载海报 + 复制文案，并说明原因 */
function h5ShareFallback(imageUrl, summary, downloadUrl) {
	const downloaded = imageUrl ? h5DownloadImage(imageUrl) : false
	copyShareText(
		summary,
		downloadUrl,
		downloaded ? t('share_h5_fallback_with_image') : t('share_fallback_copied'),
	)
}

/** 保存图片到系统相册；H5 改为触发浏览器下载 */
export function saveImageToAlbum(filePath) {
	if (!filePath) {
		uni.showToast({ title: t('save_failed'), icon: 'none' })
		return
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
		uni.showToast({ title: t('saved'), icon: 'none' })
		return
	} catch (e) {
		uni.showToast({ title: t('save_failed'), icon: 'none' })
		return
	}
	// #endif
	uni.saveImageToPhotosAlbum({
		filePath,
		success: () => uni.showToast({ title: t('saved'), icon: 'none' }),
		fail: () => uni.showToast({ title: t('save_failed'), icon: 'none' }),
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
