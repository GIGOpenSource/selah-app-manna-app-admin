/**
 * 弹出时间选择，返回 'HH:mm'；取消为空串。
 * App 走 plus.nativeUI.pickTime（系统原生）；H5 走 input[type=time]。
 * 不用 #ifdef：打进共享 chunk 时条件编译常把 App 分支裁掉，表现为「点了没反应」。
 */
function pad2(n) {
	return String(n).padStart(2, '0')
}

function getPlus() {
	try {
		if (typeof plus !== 'undefined' && plus) return plus
	} catch (e) {}
	try {
		if (typeof window !== 'undefined' && window.plus) return window.plus
	} catch (e) {}
	try {
		if (typeof globalThis !== 'undefined' && globalThis.plus) return globalThis.plus
	} catch (e) {}
	return null
}

function pickPlusTime(hour, minute, done) {
	const api = getPlus()
	if (!api || !api.nativeUI || typeof api.nativeUI.pickTime !== 'function') return false
	const time = new Date()
	time.setSeconds(0, 0)
	time.setHours(hour, minute, 0, 0)
	api.nativeUI.pickTime(
		(e) => {
			const d = (e && e.date) || time
			done(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`)
		},
		() => done(''),
		{ time, is24Hour: true },
	)
	return true
}

function pickHtmlTime(hour, minute, done) {
	if (typeof document === 'undefined') {
		done('')
		return
	}
	const input = document.createElement('input')
	input.type = 'time'
	input.step = '60'
	input.value = `${pad2(hour)}:${pad2(minute)}`
	input.style.cssText = [
		'position:fixed',
		'left:50%',
		'top:40%',
		'width:32px',
		'height:32px',
		'opacity:0.02',
		'z-index:2147483647',
		'border:0',
		'padding:0',
		'margin:0',
		'font-size:16px',
	].join(';')
	let finished = false
	const finish = (val) => {
		if (finished) return
		finished = true
		input.removeEventListener('change', onChange)
		input.removeEventListener('blur', onBlur)
		if (input.parentNode) input.parentNode.removeChild(input)
		done(val || '')
	}
	const onChange = () => finish(input.value)
	const onBlur = () => setTimeout(() => finish(input.value || ''), 400)
	input.addEventListener('change', onChange)
	input.addEventListener('blur', onBlur)
	document.body.appendChild(input)
	input.focus()
	try {
		if (typeof input.showPicker === 'function') input.showPicker()
		else input.click()
	} catch (e) {
		input.click()
	}
}

/**
 * @param {{ hour?: number, minute?: number }} [opts]
 * @returns {Promise<string>}
 */
export function pickNativeTime({ hour = 0, minute = 0 } = {}) {
	const h = Math.max(0, Math.min(23, Number(hour) || 0))
	const m = Math.max(0, Math.min(59, Number(minute) || 0))
	return new Promise((resolve) => {
		try {
			if (pickPlusTime(h, m, resolve)) return
		} catch (e) {}
		try {
			pickHtmlTime(h, m, resolve)
		} catch (e) {
			resolve('')
		}
	})
}
