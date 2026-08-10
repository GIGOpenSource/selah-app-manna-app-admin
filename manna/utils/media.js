import { host } from '@/config/config.js'

/** 相对媒体路径转绝对 URL（本地 /static 保持原样） */
export function absolutizeMedia(url) {
	if (!url) return ''
	if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url
	if (/^\/static\//i.test(url)) return url
	const origin = String(host || '').replace(/\/api\/?$/, '')
	return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}
