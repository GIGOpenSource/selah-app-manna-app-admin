/**
 * 阿拉伯语等 RTL：只改文字方向，不镜像整页布局。
 * 不要给 html/page 设 dir=rtl，否则 flex 行会左右对调。
 */
const RTL_LOCALES = ['ar', 'he', 'fa', 'ur']

export function isRtlLocale(locale) {
	const s = String(locale || '').trim().toLowerCase().replace(/_/g, '-').split('-')[0]
	return RTL_LOCALES.includes(s)
}

export function applyTextDirection(locale) {
	const rtl = isRtlLocale(locale)
	try {
		if (typeof document === 'undefined') return
		const html = document.documentElement
		if (!html) return
		html.classList.toggle('selah-rtl', rtl)
		const lang = String(locale || 'en').trim().toLowerCase().split('-')[0] || 'en'
		html.setAttribute('lang', lang)
		html.removeAttribute('dir')
		const roots = [document.body, document.getElementById('app'), document.querySelector('uni-app')]
		roots.forEach((el) => {
			if (!el) return
			el.classList.toggle('selah-rtl', rtl)
			if (el !== document.body) return
			el.removeAttribute('dir')
		})
	} catch (e) {}
}
