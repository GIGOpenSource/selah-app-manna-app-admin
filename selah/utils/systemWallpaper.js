/**
 * 系统壁纸：与 pagesA/wallpaper/wallpaper 的 setwallpaper / ios 同款。
 * Android 直写 WallpaperManager；iOS 先存相册再唤起 SetWallpaper 快捷指令。
 */
import { t as i18nT } from '@/i18n/index.js'
import { openSelahModal } from '@/utils/selahOverlay.js'
import { saveImageToAlbum } from '@/utils/share.js'

const IOS_SHORTCUT_KNOWN_KEY = 'wp_ios_shortcut_known'

function tr(key, t) {
	if (typeof t === 'function') return t(key)
	return i18nT(key)
}

function isLocalImagePath(src) {
	const s = String(src || '').trim()
	if (!s) return false
	if (s.startsWith('data:image')) return true
	if (/^(file:|wxfile:|content:|_doc|_www|\/var\/|\/data\/)/i.test(s)) return true
	if (!/^https?:\/\//i.test(s) && !s.startsWith('blob:')) return true
	return false
}

function ensureLocalPath(imageUrl) {
	const src = String(imageUrl || '').trim()
	if (!src) return Promise.reject(new Error('empty'))
	if (isLocalImagePath(src) && !/^https?:\/\//i.test(src)) {
		return Promise.resolve(src)
	}
	return new Promise((resolve, reject) => {
		uni.downloadFile({
			url: src,
			success: (res) => {
				if (res.statusCode === 200 && res.tempFilePath) resolve(res.tempFilePath)
				else reject(new Error('download_fail'))
			},
			fail: () => reject(new Error('download_fail')),
		})
	})
}

async function openIosShortcutGuide(t) {
	const result = await openSelahModal({
		title: tr('wp_shortcut_guide_title', t),
		content: tr('wp_shortcut_guide_body', t),
		confirmText: tr('wp_shortcut_run_now', t),
		cancelText: tr('wp_shortcut_go_create', t),
		closeOnMask: false,
		extra: {
			steps: [
				tr('wp_shortcut_step_1', t),
				tr('wp_shortcut_step_2', t),
				tr('wp_shortcut_step_3', t),
				tr('wp_shortcut_step_4', t),
				tr('wp_shortcut_step_5', t),
			],
		},
	})
	if (result.action === 'confirm') {
		try {
			uni.setStorageSync(IOS_SHORTCUT_KNOWN_KEY, 1)
		} catch (e) {}
		runSetWallpaperShortcut(t)
		return
	}
	if (result.action === 'cancel') {
		// #ifdef APP-PLUS
		plus.runtime.openURL('shortcuts://')
		// #endif
	}
}

function runSetWallpaperShortcut(t) {
	// #ifdef APP-PLUS
	const shortcutName = encodeURIComponent('SetWallpaper')
	const url = `shortcuts://run-shortcut?name=${shortcutName}`
	plus.runtime.openURL(url, () => {
		try {
			uni.removeStorageSync(IOS_SHORTCUT_KNOWN_KEY)
		} catch (e) {}
		openIosShortcutGuide(t)
	})
	// #endif
}

async function setSystemWallpaperIos(imageUrl, t) {
	uni.showLoading({ title: tr('wp_preparing', t), mask: true })
	try {
		const localPath = await ensureLocalPath(imageUrl)
		await new Promise((resolve, reject) => {
			uni.saveImageToPhotosAlbum({
				filePath: localPath,
				success: resolve,
				fail: (err) => {
					const msg = String(err?.errMsg || '')
					if (/auth deny|authorize|permission|denied|隐私|权限/i.test(msg)) {
						uni.showModal({
							title: tr('wp_album_perm_title', t),
							content: tr('wp_album_perm_body', t),
							confirmText: tr('ok', t),
							cancelText: tr('cancel', t),
							success: (modalRes) => {
								if (modalRes.confirm) {
									// #ifdef APP-PLUS
									plus.runtime.openURL('app-settings:')
									// #endif
								}
							},
						})
					}
					reject(err)
				},
			})
		})
		await new Promise((resolve) => setTimeout(resolve, 500))
		uni.hideLoading()
		if (!uni.getStorageSync(IOS_SHORTCUT_KNOWN_KEY)) {
			await openIosShortcutGuide(t)
			return true
		}
		runSetWallpaperShortcut(t)
		return true
	} catch (err) {
		try { uni.hideLoading() } catch (e) {}
		uni.showToast({ title: tr('wp_set_failed', t), icon: 'none' })
		return false
	}
}

async function setSystemWallpaperAndroid(imageUrl, t) {
	uni.showLoading({ title: tr('wp_downloading', t) })
	try {
		const localPath = await ensureLocalPath(imageUrl)
		// #ifdef APP-PLUS
		const imagePath = plus.io.convertLocalFileSystemURL(localPath)
		const WallpaperManager = plus.android.importClass('android.app.WallpaperManager')
		const BitmapFactory = plus.android.importClass('android.graphics.BitmapFactory')
		const MainActivity = plus.android.runtimeMainActivity()
		const wallpaperManager = WallpaperManager.getInstance(MainActivity)
		const bitmap = BitmapFactory.decodeFile(imagePath)
		if (!bitmap) throw new Error('decode_fail')
		wallpaperManager.setBitmap(bitmap)
		const Build = plus.android.importClass('android.os.Build')
		if (Build.VERSION.SDK_INT >= 24) {
			wallpaperManager.setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK)
		}
		uni.hideLoading()
		uni.showToast({ title: tr('wallpaper_saved', t), icon: 'none' })
		return true
		// #endif
		uni.hideLoading()
		return false
	} catch (err) {
		try { uni.hideLoading() } catch (e) {}
		uni.showToast({ title: tr('wp_set_failed', t), icon: 'none' })
		return false
	}
}

/**
 * @param {string} imageUrl 本地路径或 http(s) 图
 * @param {{ t?: Function }} [opts]
 * @returns {Promise<boolean>}
 */
export async function setSystemWallpaper(imageUrl, opts = {}) {
	const t = opts.t
	const src = String(imageUrl || '').trim()
	if (!src) {
		uni.showToast({ title: tr('wp_pick_image', t), icon: 'none' })
		return false
	}

	// #ifdef APP-PLUS
	const platform = uni.getSystemInfoSync().platform
	if (platform !== 'android') {
		return setSystemWallpaperIos(src, t)
	}
	return setSystemWallpaperAndroid(src, t)
	// #endif

	// H5 等非 App：无法写系统壁纸，退化为保存图片（saveImageToAlbum 自带成功提示）
	return !!(await saveImageToAlbum(src))
}
