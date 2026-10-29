/**
 * uni InnerAudioContext.volume 在 H5 上不写到 HTMLAudioElement，
 * 必须同时设 ctx._audio.volume，否则滑条只改数字、声音不变。
 */
export const VOICE_VOL_KEY = 'manna_listen_voice_vol'
export const BGM_VOL_KEY = 'manna_listen_bgm_vol'
export const VOICE_VOL_DEFAULT = 1
/** 未点过听经音乐按钮时默认关闭；只有用户选档位才出声 */
export const BGM_VOL_DEFAULT = 0

export function clamp01(vol) {
	const n = Number(vol)
	if (!Number.isFinite(n)) return 0
	return Math.max(0, Math.min(1, n))
}

export function readStoredVol(key, fallback) {
	try {
		const raw = uni.getStorageSync(key)
		if (raw === '' || raw == null) return clamp01(fallback)
		const n = Number(raw)
		if (Number.isNaN(n)) return clamp01(fallback)
		return clamp01(n)
	} catch (e) {
		return clamp01(fallback)
	}
}

export function isListenBgmOn(vol) {
	const n = vol == null ? readStoredVol(BGM_VOL_KEY, BGM_VOL_DEFAULT) : clamp01(vol)
	return n > 0.001
}

export function writeStoredVol(key, vol) {
	try { uni.setStorageSync(key, clamp01(vol)) } catch (e) {}
}

export function setCtxVolume(ctx, vol) {
	const n = clamp01(vol)
	if (!ctx) return n
	try { ctx.volume = n } catch (e) {}
	try {
		if (ctx._audio) ctx._audio.volume = n
	} catch (e) {}
	return n
}

/** uni-slider / 原生 input 的 value，失败返回 null */
export function sliderPercent(e) {
	if (e == null) return null
	const raw = (e.detail && e.detail.value !== undefined)
		? e.detail.value
		: (e.target && e.target.value !== undefined ? e.target.value : e)
	const n = Number(raw)
	if (!Number.isFinite(n)) return null
	return Math.max(0, Math.min(100, n))
}
