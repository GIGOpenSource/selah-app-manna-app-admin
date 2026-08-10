/**
 * 轻量反馈：尊重 muted / sound_enabled；无本地音效文件时仅震动。
 * userInfo.muted=true 或 sound_enabled=false 时直接 return。
 */
export function playSfx() {
	const u = uni.getStorageSync('userInfo') || {}
	if (u.muted) return
	if (u.sound_enabled === false) return
	try {
		uni.vibrateShort({ type: 'light' })
	} catch (e) {}
}
