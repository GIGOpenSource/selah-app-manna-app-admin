/**
 * 分享封装：More 必保；Ins/FB/X 已安装才展示；未安装隐藏。
 * 优先分享海报图（imageUrl）；失败再退到文案复制。
 * 下载链仅用运营配置的 url_download；空则不拼 Source / 不传 href。
 */
import { t } from '@/i18n/index.js'

/** 复制「语录 + 可选 Source 下载链」到剪贴板（系统分享失败时的兜底） */
export function copyShareText(quote, downloadUrl) {
	const href = String(downloadUrl || '').trim()
	const text = href ? `${quote}\n\nSource: ${href}` : String(quote || '')
	uni.setClipboardData({
		data: text,
		success: () => uni.showToast({ title: t('copied'), icon: 'none' }),
	})
}

/**
 * 系统分享面板。
 * - 有 imageUrl → 分享图片（海报含背景 + logo）
 * - 否则 → 文案 / 链接
 */
export function systemShare({ title, summary, href, imageUrl }) {
	const payloadTitle = title || 'Selah'
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
							copyShareText(payloadSummary, payloadHref)
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
				copyShareText(payloadSummary, payloadHref)
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
		},
	})
	return
	// #endif

	// #ifdef H5
	if (imageUrl && typeof navigator !== 'undefined' && navigator.share) {
		fetch(imageUrl)
			.then((r) => r.blob())
			.then((blob) => {
				const file = new File([blob], 'selah-share.png', { type: blob.type || 'image/png' })
				return navigator.share({
					title: payloadTitle,
					text: payloadSummary,
					files: [file],
				})
			})
			.catch(() => copyShareText(payloadSummary, payloadHref))
		return
	}
	// #endif
	copyShareText(payloadSummary, payloadHref)
}

/** 保存图片到系统相册 */
export function saveImageToAlbum(filePath) {
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
