/**
 * 圣经阅读 API
 */
import { getRequest, postRequest } from '@/utils/http.js'

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

export function apiBibleReadProgress(params = {}, other = {}) {
	return postRequest('/bible/read-progress/', params, { showLoading: false, ...other })
}

export function apiBibleTranslate(params = {}, other = {}) {
	return postRequest('/bible/translate/', params, { showLoading: false, ...other })
}

export function apiBibleTags(params = {}, other = {}) {
	return getRequest('/bible/tags/', params, { showLoading: false, ...other })
}
