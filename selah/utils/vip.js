/**
 * VIP 导航：trial_intro_enabled 且未看过 trial_intro 时先夹层再进 VIP。
 * 已是会员则跳过买量弹层，直接进订阅管理页。
 */
import { apiAppConfig } from '@/api/content.js'
import { readPageCache, writePageCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { appConfigRevision, resolveInterstitialScreen } from '@/utils/bootstrap.js'

/** VIP/Plus 且未过期（expire_at 空视为仍有效）。 */
export function isVipActive(user) {
	let u = user
	if (!u) {
		try {
			u = uni.getStorageSync('userInfo') || {}
		} catch (e) {
			u = {}
		}
	}
	if (u.vip_level !== 'vip' && u.vip_level !== 'plus_vip') return false
	if (u.vip_expire_at) {
		const ts = Date.parse(u.vip_expire_at)
		if (!Number.isNaN(ts) && ts < Date.now()) return false
	}
	return true
}

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

function openVipUrl(url) {
	uni.navigateTo({
		url,
		fail: () => {
			uni.redirectTo({
				url,
				fail: () => uni.reLaunch({ url }),
			})
		},
	})
}

/**
 * @param {string} [payTriggerSource='']
 * @param {object} [opts]
 * @param {number|string} [opts.lockContentId]
 * @param {boolean} [opts.manage] 会员管理入口；已开通时也自动按管理走
 * @param {boolean} [opts.skipTrialIntro] 已确认购买时跳过买量夹层，直接进订阅页
 */
export async function goVip(payTriggerSource = '', opts = {}) {
	const src = payTriggerSource || 'unknown'
	const manage = opts.manage === true || isVipActive()
	if (opts.lockContentId) {
		try {
			uni.setStorageSync('selah_vip_lock_content_id', Number(opts.lockContentId) || 0)
		} catch (e) {}
	}
	const vipUrl = `/pagesA/vip/vip?pay_trigger_source=${encodeURIComponent(src)}`
	if (manage || opts.skipTrialIntro) {
		openVipUrl(vipUrl)
		return
	}
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
					openVipUrl(`/pagesA/interstitial/interstitial?kind=trial_intro&next=${next}`)
					return
				}
			}
		}
	} catch (e) {
		console.warn('trial_intro gate skipped', e)
	}
	openVipUrl(vipUrl)
}
