/**
 * VIP 导航：trial_intro_enabled 且未看过 trial_intro 时先夹层再进 VIP。
 *
 * 目标页：`/pagesA/vip/vip`、`/pagesA/interstitial/interstitial`（已在 pages.json）。
 * Me：manna_vip_enabled 时调 goVip；失败软降 toast `me_vip_soon`。
 */
import { apiAppConfig } from '@/api/content.js'
import { track } from '@/utils/analytics.js'
import { readPageCache, writePageCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { appConfigRevision, resolveInterstitialScreen } from '@/utils/bootstrap.js'

export function interstitialStorageKey(kind, version) {
	return `interstitial_seen_${kind}_v${Number(version || 1)}`
}

export function hasSeenInterstitial(kind, version) {
	try {
		return !!uni.getStorageSync(interstitialStorageKey(kind, version))
	} catch (e) {
		return false
	}
}

export function markInterstitialSeen(kind, version) {
	try {
		uni.setStorageSync(interstitialStorageKey(kind, version), 1)
	} catch (e) {}
}

/**
 * @param {string} [payTriggerSource='']
 * @param {object} [opts]
 * @param {number|string} [opts.lockContentId]
 * @param {boolean} [opts.trackPopup=true]
 */
export async function goVip(payTriggerSource = '', opts = {}) {
	const src = payTriggerSource || 'unknown'
	if (opts.trackPopup !== false) {
		track('vip_popup_show', {
			pay_trigger_source: src,
			lock_content_id: opts.lockContentId || '',
		})
	}
	const vipUrl = `/pagesA/vip/vip?pay_trigger_source=${encodeURIComponent(src)}`
	try {
		let cfg = readPageCache(APP_CONFIG_KEY) || {}
		if (!Object.keys(cfg).length) {
			const cfgRes = await apiAppConfig().catch(() => null)
			cfg = cfgRes?.results || {}
			if (cfg && Object.keys(cfg).length) writePageCache(APP_CONFIG_KEY, cfg)
		} else {
			apiAppConfig().then((cfgRes) => {
				const fresh = cfgRes?.results
				if (!fresh) return
				const cached = readPageCache(APP_CONFIG_KEY)
				if (
					cached
					&& appConfigRevision(cached)
					&& appConfigRevision(fresh)
					&& String(appConfigRevision(cached)) === String(appConfigRevision(fresh))
				) {
					return
				}
				writePageCache(APP_CONFIG_KEY, fresh)
			}).catch(() => {})
		}
		if (cfg.trial_intro_enabled !== false) {
			const row = await resolveInterstitialScreen('trial_intro')
			if (row && (row.title || row.image_url)) {
				const ver = Number(row.version || 1)
				if (!hasSeenInterstitial('trial_intro', ver)) {
					const next = encodeURIComponent(vipUrl)
					await new Promise((resolve, reject) => {
						uni.navigateTo({
							url: `/pagesA/interstitial/interstitial?kind=trial_intro&next=${next}`,
							success: resolve,
							fail: reject,
						})
					})
					return
				}
			}
		}
	} catch (e) {
		console.warn('trial_intro gate skipped', e)
	}
	await new Promise((resolve, reject) => {
		uni.navigateTo({ url: vipUrl, success: resolve, fail: reject })
	})
}
