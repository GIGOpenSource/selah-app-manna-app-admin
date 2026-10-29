/**
 * 圣经阅读 API
 */
import { getRequest, postRequest } from '@/utils/http.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import { withTz } from '@/utils/device.js'

export function apiBibleTranslations(params = {}, other = {}) {
	return getRequest('/bible/translations/', params, { showLoading: false, ...other })
}

export function apiBibleBooks(params = {}, other = {}) {
	return getRequest('/bible/books/', params, { showLoading: false, ...other })
}

export function apiBibleChapter(params = {}, other = {}) {
	return getRequest('/bible/chapter/', params, { showLoading: false, ...other })
}

export function apiBibleHighlights(params = {}, other = {}) {
	return getRequest('/bible/highlights/', params, { showLoading: false, ...other })
}

export function apiBibleHighlightSave(params = {}, other = {}) {
	return postRequest('/bible/highlights/', params, { showLoading: false, ...other })
}

export function apiBibleNotes(params = {}, other = {}) {
	return getRequest('/bible/notes/', params, { showLoading: false, ...other })
}

export function apiBibleNoteSave(params = {}, other = {}) {
	return postRequest('/bible/notes/', params, { showLoading: false, ...other })
}

export function apiBibleAmenVerse(params = {}, other = {}) {
	return postRequest('/bible/amen-verse/', params, { showLoading: false, ...other })
}

export function apiBibleAmenCounts(params = {}, other = {}) {
	return getRequest('/bible/amen-verse/', params, { showLoading: false, ...other })
}

export function apiBibleReadProgress(params = {}, other = {}) {
	return postRequest('/bible/read-progress/', withTz(params), {
		showLoading: false,
		skipAuthRetry: true,
		...other,
	})
}

export function apiBibleTranslate(params = {}, other = {}) {
	return postRequest('/bible/translate/', params, { showLoading: false, timeout: 120000, ...other })
}

export function apiBibleTags(params = {}, other = {}) {
	const language = params.language || getCurrentLanguage()
	return getRequest('/bible/tags/', { ...params, language }, { showLoading: false, ...other })
}

export function apiBibleSearch(params = {}, other = {}) {
	return getRequest('/bible/search/', params, { showLoading: false, ...other })
}
