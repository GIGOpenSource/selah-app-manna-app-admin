/**
 * 没有逐句时间戳时，按字数把整章时长分到每一节。
 *
 * 统一规则：
 * 1. 播放器真实时长与 currentTime 同源 → 原样作时间轴，禁止再拉长/压缩
 * 2. 仅接口估算时长 → 按 128kbps→48kbps 校正一次
 * 3. 高亮相对切节边界固定滞后，避免「先亮后读」
 */

/** 接口时长假设的码率 / 文件真实码率 */
const DURATION_SCALE = 128 / 48
/** 高于此字速说明时长被缩短了 */
const FAST_CHARS_PER_SEC = 18
const NORMAL_CHARS_PER_SEC = 11.5

/**
 * 高亮滞后（秒）：数字越大文字越晚翻页。
 * 校准：uni.setStorageSync('manna_cue_lag_v2', 0.5)
 */
const CUE_LAG_DEFAULT_SEC = 0.35

function readLagOverride() {
	try {
		if (typeof uni === 'undefined' || !uni.getStorageSync) return null
		// 换 key，避免旧的 1.2+ 校准值继续把高亮拖慢
		const raw = uni.getStorageSync('manna_cue_lag_v2')
		if (raw === '' || raw === null || raw === undefined) return null
		const n = Number(raw)
		return Number.isFinite(n) ? Math.max(0, Math.min(4, n)) : null
	} catch (e) {
		return null
	}
}

let cueLagSec = (() => {
	const o = readLagOverride()
	return o == null ? CUE_LAG_DEFAULT_SEC : o
})()

export function setCueLag(sec) {
	const n = Number(sec)
	if (!Number.isFinite(n)) return cueLagSec
	cueLagSec = Math.max(0, Math.min(4, n))
	return cueLagSec
}

export function getCueLag() {
	return cueLagSec
}

/** @deprecated 已改为滞后 */
export function setCueAhead() {
	return 0
}

export function getCueAhead() {
	return 0
}

function weightsOf(list) {
	return (list || []).map((v) => Math.max(8, String(v.text || v.content || '').length))
}

function charCount(list) {
	return weightsOf(list).reduce((a, b) => a + b, 0)
}

/** 仅校正接口估算时长；播放器真实时长不要传入 */
export function correctSpokenDuration(durationSec, list) {
	const d = Number(durationSec) || 0
	const chars = charCount(list)
	if (d > 1 && chars >= 24) {
		const rate = chars / d
		if (rate > FAST_CHARS_PER_SEC) {
			const scaled = d * DURATION_SCALE
			const scaledRate = chars / scaled
			if (scaledRate >= 5 && scaledRate <= FAST_CHARS_PER_SEC) return scaled
		}
		return d
	}
	if (d > 1) return d
	if (chars > 0) return Math.max(8, chars / NORMAL_CHARS_PER_SEC)
	return 0
}

/** 书名+章名口播预留：各章统一比例（过大时后面整章高亮都会偏慢） */
function titleLeadSec(dur) {
	const d = Number(dur) || 0
	if (d <= 1) return 0
	return Math.min(2.0, Math.max(0.8, d * 0.01))
}

/**
 * @param durationSec 最终时间轴（播放器时长或已校正接口时长），此处不再二次校正
 */
export function rawVerseSpans(list, durationSec) {
	const rows = list || []
	const weights = weightsOf(rows)
	const total = weights.reduce((a, b) => a + b, 0) || 1
	const dur = Math.max(0.5, Number(durationSec) || 0)
	const lead = rows.length ? titleLeadSec(dur) : 0
	const body = Math.max(0.5, dur - lead)
	let acc = 0
	return rows.map((v, i) => {
		const start = lead + (acc / total) * body
		acc += weights[i]
		return {
			verse: Number(v.verse) || i + 1,
			start,
			end: lead + (acc / total) * body,
		}
	})
}

export function verseSpokenAt(list, tSec, durationSec) {
	const spans = rawVerseSpans(list, durationSec)
	if (!spans.length) return 0
	// 时间后移：先听声音，再切高亮
	const t = Math.max(0, (Number(tSec) || 0) - cueLagSec)
	let verse = spans[0].verse
	for (let i = 0; i < spans.length; i++) {
		if (t >= spans[i].start) verse = spans[i].verse
		else break
	}
	return verse
}

export function verseFractionAt(list, verse, tSec, durationSec) {
	const w = rawVerseSpans(list, durationSec).find((item) => item.verse === Number(verse))
	if (!w) return 0
	const span = Math.max(0.05, w.end - w.start)
	return Math.max(0, Math.min(0.92, ((Number(tSec) || 0) - w.start) / span))
}

export function resumeSecForVerse(list, verse, frac, durationSec) {
	const spans = rawVerseSpans(list, durationSec)
	const w = spans.find((item) => item.verse === Number(verse))
	if (!w) return 0
	const span = Math.max(0.05, w.end - w.start)
	const f = Math.max(0, Math.min(0.92, Number(frac) || 0))
	const dur = spans.length ? spans[spans.length - 1].end : 0
	const cap = dur > 1 ? Math.max(0, dur - 0.15) : w.end
	return Math.max(0, Math.min(cap, Math.min(w.end - 0.05, w.start + span * f)))
}
