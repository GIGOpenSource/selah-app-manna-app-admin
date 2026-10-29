/**
 * 我的资产：列表分页、肯定语、行内喜欢/收藏/分享、历史清空。
 */
import { ref, computed } from 'vue'
import { onLoad, onReachBottom, onShow } from '@dcloudio/uni-app'
import {
	apiMyAssets, apiAffirmations, apiAffirmationSave, apiAffirmationDelete,
	apiFollowAllAffirmations, apiUncollect, apiLike, apiHistoryClear, apiDisplayTags,
	contentTargetType,
} from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { silentListRefresh, clearPageCache } from '@/utils/pageCache.js'
import { ASSETS_FOLDERS_KEY, assetsListKey } from '@/utils/wallpaperCache.js'
import { recordLikeStatus, writeQuoteStatusCache } from '@/utils/likeSync.js'
import { createTapLock } from '@/utils/tapLock.js'
import { openSharePage } from '@/utils/share.js'
import { getLocale } from '@/i18n/index.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

/**
 * @param {{
 *   t: Function,
 *   kind: import('vue').Ref,
 *   list: import('vue').Ref,
 *   hasMore: import('vue').Ref,
 *   loadingMore: import('vue').Ref,
 *   folderId: import('vue').Ref,
 *   collectBrowse: import('vue').ComputedRef,
 *   openFolderMeta: import('vue').ComputedRef,
 *   folderLabel: Function,
 *   loadFolders: Function,
 *   openCollectFolderSheet: Function,
 *   deps: Record<string, any>,
 *   listSort?: import('vue').Ref,
 * }} opts
 */
export function useAssetsList({
	t,
	kind,
	list,
	hasMore,
	loadingMore,
	folderId,
	collectBrowse,
	openFolderMeta,
	folderLabel,
	loadFolders,
	openCollectFolderSheet,
	deps,
	patchFolderCount,
	listSort,
}) {
	const rowTap = createTapLock(420)
	const backTap = createTapLock(500)
	const affirmations = ref([])
	const affFollowed = ref(false)
	const affFollowBusy = ref(false)
	const draft = ref('')
	const authorDraft = ref('')
	const editingId = ref(null)
	const savingAff = ref(false)
	const draftLen = computed(() => (draft.value || '').length)
	const pageTitle = computed(() => {
		if (kind.value === 'collect') {
			if (openFolderMeta.value) return folderLabel(openFolderMeta.value)
			return t('collections')
		}
		if (kind.value === 'affirmation') return t('my_own_quotes')
		if (kind.value === 'history') return t('history')
		if (kind.value === 'like') return t('likes')
		return t('my_content')
	})
	const page = ref(1)
	const PAGE_SIZE = 20
	const clearDialogOpen = ref(false)
	const displayTags = ref([])
	const displayFilter = ref('')
	const showDisplayFilters = computed(() => kind.value === 'like')
	const filteredList = computed(() => list.value)
	/** 防止 H5 onShow 与 onLoad 首屏双拉 */
	let booted = false
	let skipNextShow = false
	let loading = false
	const fromExplore = ref(false)

	function setLoading(v) {
		loading = !!v
	}

	function cacheKey() {
		const base = assetsListKey(kind.value, kind.value === 'collect' ? folderId.value : 0)
		const sort = listSort && listSort.value
		let key = base
		if (sort && (kind.value === 'affirmation' || kind.value === 'collect')) {
			key = `${base}_${sort}`
		}
		if (kind.value === 'like' && displayFilter.value) {
			key = `${key}_tag_${displayFilter.value}`
		}
		return key
	}

	function listQuery(pageNo) {
		const params = { currentPage: pageNo, pageSize: PAGE_SIZE }
		const sort = listSort && listSort.value
		if (sort && (kind.value === 'affirmation' || kind.value === 'collect')) {
			params.sort = sort
		}
		if (kind.value === 'like' && displayFilter.value) {
			params.display_tag_id = displayFilter.value
		}
		return params
	}

	function parseAffirmationList(res) {
		const bag = res?.results
		if (Array.isArray(bag)) return bag
		if (Array.isArray(bag?.list)) return bag.list
		if (Array.isArray(bag?.items)) return bag.items
		if (Array.isArray(bag?.results)) return bag.results
		return []
	}

	function readFollowedFlag(payload) {
		if (!payload || typeof payload !== 'object') return null
		const bags = [payload, payload.results, payload.extra, payload.meta, payload.data]
		for (const bag of bags) {
			if (!bag || typeof bag !== 'object' || Array.isArray(bag)) continue
			const v = bag.followed ?? bag.is_followed ?? bag.following ?? bag.follow_all ?? bag.followed_all ?? bag.follow
			if (v != null && v !== '') return !!v
		}
		return null
	}

	function applyAffFollowed(payload) {
		const flag = readFollowedFlag(payload)
		if (flag != null) affFollowed.value = flag
	}

	let ownEmptyLogged = false
	function noteOwnQuoteEmpty() {
		if (ownEmptyLogged || kind.value !== 'affirmation') return
		if ((affirmations.value || []).length) return
		ownEmptyLogged = true
		fb('own_quote_empty_show')
	}

	function applyListPage1(payload) {
		const rows = payload?.results || []
		if (kind.value === 'affirmation') {
			affirmations.value = normalizeAffirmationRows(rows)
			applyAffFollowed(payload)
		} else {
			list.value = normalizeAssetRows(rows)
		}
		page.value = 2
		const totalPages = payload?.pagination?.total_pages || 1
		hasMore.value = 1 < totalPages
		if (kind.value === 'affirmation' && !rows.length) noteOwnQuoteEmpty()
		if (kind.value === 'collect' && folderId.value && typeof patchFolderCount === 'function') {
			const total = Number(payload?.pagination?.total ?? payload?.pagination?.total_count)
			const n = Number.isFinite(total) && total >= 0
				? total
				: (totalPages > 1 ? Math.max(rows.length, (totalPages - 1) * PAGE_SIZE) : rows.length)
			patchFolderCount(folderId.value, n)
		}
	}

	/** 与列表接口 item_type 对齐（quote / affirmation / ai_message） */
	function rowTargetType(q) {
		if (kind.value === 'affirmation') return 'affirmation'
		return contentTargetType(q)
	}

	function isAffirmationItem(q) {
		return rowTargetType(q) === 'affirmation'
	}

	function likeCollectOpts(q) {
		return { target_type: rowTargetType(q) }
	}

	function assetRowKey(q, idx) {
		const id = q?.id ?? q?.content_id ?? idx
		return `${rowTargetType(q)}-${id}`
	}

	function citeMark(q) {
		if (kind.value === 'history' || isAffirmationItem(q)) return '-'
		return '— '
	}

	function normalizeAffirmationRows(rows) {
		return (Array.isArray(rows) ? rows : []).map((row) => ({
			...row,
			item_type: 'affirmation',
			liked: !!row.liked,
			collected: !!row.collected,
			content: String(row.content || row.text || '').trim() || (row.content || ''),
		}))
	}

	function normalizeAssetRows(rows) {
		return (Array.isArray(rows) ? rows : []).map((row) => {
			const next = { ...row }
			// 保留接口 item_type，供 like / uncollect / dislike 回传 target_type
			next.item_type = contentTargetType(row)
			if (next.content == null || next.content === '') {
				next.content = String(next.text || next.quote || next.body || '')
			}
			if (kind.value === 'like') next.liked = true
			if (kind.value === 'collect') next.collected = true
			return next
		})
	}

	function normalizeDisplayTags(rows) {
		const list = Array.isArray(rows) ? rows : []
		return list.map((tag) => {
			if (!tag || typeof tag !== 'object') return null
			const id = Number(tag.id ?? tag.pk)
			if (!Number.isFinite(id) || id <= 0) return null
			const nameEn = String(tag.name_en || tag.nameEn || '').trim()
			return {
				...tag,
				id,
				name_en: nameEn || String(tag.name || '').trim(),
			}
		}).filter((tag) => tag && tag.name_en)
	}

	async function loadDisplayTags() {
		if (!showDisplayFilters.value) {
			displayTags.value = []
			displayFilter.value = ''
			return
		}
		try {
			const res = await apiDisplayTags('quote')
			displayTags.value = normalizeDisplayTags(res.results || res.data || [])
		} catch {
			displayTags.value = []
		}
	}

	async function setDisplayFilter(id) {
		const next = id == null || id === '' ? '' : Number(id)
		const tagId = Number.isFinite(next) && next > 0 ? next : ''
		if (String(displayFilter.value || '') === String(tagId || '')) return
		displayFilter.value = tagId
		list.value = []
		loading = false
		uni.showLoading({ title: ' ', mask: true })
		try {
			await load(true)
		} finally {
			uni.hideLoading()
		}
	}

	/** 首屏静默刷新当前 kind；有缓存不挡 UI */
	function bootstrapList() {
		const key = cacheKey()
		const { hydrated, refresh } = silentListRefresh(
			key,
			async () => {
				const params = listQuery(1)
				if (kind.value === 'affirmation') {
					const res = await apiAffirmations(params)
					return {
						results: parseAffirmationList(res),
						pagination: res.pagination || null,
						followed: readFollowedFlag(res),
					}
				}
				if (kind.value === 'collect') {
					const res = await apiMyAssets('collect', folderId.value, params)
					return { results: res.results || [], pagination: res.pagination || null }
				}
				const res = await apiMyAssets(kind.value, null, params)
				return { results: res.results || [], pagination: res.pagination || null }
			},
			applyListPage1,
		)
		const hasItems = kind.value === 'affirmation'
			? !!affirmations.value.length
			: !!list.value.length
		if (!hydrated || !hasItems) loadingMore.value = true
		else loadingMore.value = false
		return refresh
			.catch(() => {})
			.finally(() => { loadingMore.value = false })
	}

	/** 按 kind/folder 拉取；reset=首页静默，翻页才 loading */
	async function load(reset = true) {
		if (!reset) {
			if (loadingMore.value || !hasMore.value || loading) return
			loadingMore.value = true
			try {
				const next = page.value
				const params = listQuery(next)
				if (kind.value === 'affirmation') {
					const res = await apiAffirmations(params)
					const rows = normalizeAffirmationRows(parseAffirmationList(res))
					affirmations.value = affirmations.value.concat(rows)
					applyAffFollowed(res)
					const totalPages = res.pagination?.total_pages || 1
					hasMore.value = next < totalPages
				} else if (kind.value === 'collect') {
					if (!folderId.value) await loadFolders()
					const res = await apiMyAssets('collect', folderId.value, params)
					const rows = res.results || []
					list.value = list.value.concat(normalizeAssetRows(rows))
					const totalPages = res.pagination?.total_pages || 1
					hasMore.value = next < totalPages
				} else {
					const res = await apiMyAssets(kind.value, null, params)
					const rows = res.results || []
					list.value = list.value.concat(normalizeAssetRows(rows))
					const totalPages = res.pagination?.total_pages || 1
					hasMore.value = next < totalPages
				}
				page.value = next + 1
			} finally {
				loadingMore.value = false
			}
			return
		}

		if (loading) return
		loading = true
		hasMore.value = true
		page.value = 1
		if (kind.value === 'collect' && folderId.value && !list.value.length) {
			loadingMore.value = true
		}
		try {
			if (kind.value === 'collect') {
				await loadFolders()
				if (!folderId.value) {
					list.value = []
					hasMore.value = false
					loadingMore.value = false
					return
				}
			}
			await bootstrapList()
		} finally {
			loading = false
			if (kind.value === 'collect') loadingMore.value = false
		}
	}

	function invalidateListCache() {
		clearPageCache(cacheKey())
		if (kind.value === 'collect') clearPageCache(ASSETS_FOLDERS_KEY)
	}

	function clearLikeCollectCaches() {
		clearPageCache(assetsListKey('like', 0))
		const collectBase = assetsListKey('collect', 0)
		clearPageCache(collectBase)
		;['newest', 'oldest', 'az'].forEach((sort) => {
			clearPageCache(`${collectBase}_${sort}`)
		})
		clearPageCache(ASSETS_FOLDERS_KEY)
	}

	function sameAssetId(a, b) {
		return a != null && b != null && String(a) === String(b)
	}

	function assetContentId(q) {
		if (!q) return null
		return q.id ?? q.content_id ?? q.contentId ?? null
	}

	function patchRow(id, patch, itemType) {
		const type = itemType || patch?.item_type || patch?.target_type
		const match = (row) => {
			if (!sameAssetId(row.id, id) && !sameAssetId(assetContentId(row), id)) return false
			if (!type) return true
			return rowTargetType(row) === type
		}
		list.value = list.value.map((row) => (match(row) ? { ...row, ...patch } : row))
		affirmations.value = affirmations.value.map((row) => (sameAssetId(row.id, id) ? { ...row, ...patch } : row))
	}

	// 回填给 folders composable（openFolder / 对话框等）
	deps.load = load
	deps.invalidateListCache = invalidateListCache
	deps.clearLikeCollectCaches = clearLikeCollectCaches
	deps.patchRow = patchRow
	deps.setLoading = setLoading

	function inFolderDetail() {
		return kind.value === 'collect' && folderId.value != null && String(folderId.value) !== ''
	}

	function leaveFolderDetail() {
		folderId.value = null
		list.value = []
		hasMore.value = false
		loadingMore.value = false
		uni.pageScrollTo({ scrollTop: 0, duration: 0 })
		if (typeof loadFolders === 'function') loadFolders()
	}

	function fb(name, params) {
		try { logFirebaseEvent(name, params) } catch (e) {}
	}

	function quoteIds() {
		const rows = kind.value === 'affirmation' ? (affirmations.value || []) : (list.value || [])
		return rows.map((row) => assetContentId(row)).filter((id) => id != null && id !== '').join(',')
	}

	function goBack() {
		backTap.run(() => {
			if (inFolderDetail()) {
				leaveFolderDetail()
				return
			}
			if (kind.value === 'like') fb('topic_likePage_leave', { cotentId: quoteIds() })
			else if (kind.value === 'history') fb('history_page_leave', { quote_id: quoteIds() })
			else if (kind.value === 'affirmation') fb('own_quote_leave', { quote_id: quoteIds() })
			else if (kind.value === 'collect') {
				const folders = deps.folders && deps.folders.value ? deps.folders.value : []
				const names = folders.map((f) => String(f.name || '').trim()).filter(Boolean).join(',')
				const quoteCount = folders.reduce((sum, f) => sum + (Number(f.item_count || f.count || 0) || 0), 0)
				fb('collection_page_leave', { list_name: names, quoteCount })
			}
			safeBack(fromExplore.value ? '/pagesA/explore/explore' : '/pages/profile/profile')
		})
	}

	async function toggleAffFollow() {
		if (affFollowBusy.value) return
		const next = !affFollowed.value
		fb('own_quote_follow_click')
		affFollowed.value = next
		affFollowBusy.value = true
		try {
			const res = await apiFollowAllAffirmations(next)
			const server = readFollowedFlag(res)
			affFollowed.value = server != null ? server : next
			fb('own_quote_follow_result', { is_follow: !!affFollowed.value })
			invalidateListCache()
		} catch (e) {
			affFollowed.value = !next
			fb('own_quote_follow_result', { is_follow: !!affFollowed.value })
			uni.showToast({ title: t('request_failed'), icon: 'none' })
		} finally {
			affFollowBusy.value = false
		}
	}

	async function uncollect(id, q) {
		await apiUncollect(id, likeCollectOpts(q))
		invalidateListCache()
		hasMore.value = true
		load(true)
	}

	async function unlike(q) {
		const id = q?.id ?? q?.content_id
		if (id == null) return
		const type = rowTargetType(q)
		if (type !== 'affirmation') {
			recordLikeStatus(id, false)
			if (q?.content_id != null && String(q.content_id) !== String(id)) {
				recordLikeStatus(q.content_id, false)
			}
		}
		try {
			await apiLike(id, false, likeCollectOpts(q))
			invalidateListCache()
			hasMore.value = true
			await load(true)
		} catch (e) {
			if (type !== 'affirmation') recordLikeStatus(id, true)
		}
	}

	function clearHistoryConfirm() {
		fb('history_quote_clear')
		clearDialogOpen.value = true
		fb('history_quote_clear_popup')
	}

	async function doClearHistory() {
		fb('history_quote_clear_popup_click')
		try {
			await apiHistoryClear()
			invalidateListCache()
			list.value = []
			hasMore.value = false
			uni.showToast({ title: t('cleared'), icon: 'none' })
		} catch (e) {}
	}

	function affAuthor(a) {
		if (!a) return ''
		const direct = String(a.author || a.source_ref || '').trim()
		if (direct) return direct
		const meta = a.meta
		if (meta && typeof meta === 'object') return String(meta.author || meta.source || '').trim()
		if (typeof meta === 'string' && meta) {
			try {
				const parsed = JSON.parse(meta)
				return String(parsed.author || parsed.source || '').trim()
			} catch (e) {}
		}
		return ''
	}

	function editAff(a) {
		editingId.value = a.id
		draft.value = a.content || ''
		authorDraft.value = affAuthor(a)
	}

	function cancelEditAff() {
		editingId.value = null
		draft.value = ''
		authorDraft.value = ''
	}

	async function saveAff() {
		const content = (draft.value || '').trim()
		if (!content || savingAff.value) return false
		if (content.length > 160) {
			uni.showToast({ title: t('write_affirm'), icon: 'none' })
			return false
		}
		savingAff.value = true
		try {
			const current = (affirmations.value || []).find((x) => x.id === editingId.value)
			const prevMeta = current && current.meta && typeof current.meta === 'object' ? { ...current.meta } : {}
			const payload = {
				content,
				meta: { ...prevMeta, author: (authorDraft.value || '').trim() },
			}
			if (editingId.value) payload.id = editingId.value
			const res = await apiAffirmationSave(payload)
			const saved = res?.results || {}
			const quoteId = saved.id || saved.affirmation_id || payload.id || ''
			fb('own_quote_save_result', { quote_id: quoteId, quote_quote: content })
			draft.value = ''
			authorDraft.value = ''
			editingId.value = null
			invalidateListCache()
			hasMore.value = true
			await load(true)
			return true
		} catch (e) {
			fb('own_quote_save_result', { quote_id: editingId.value || '', quote_quote: content })
			return false
		} finally {
			savingAff.value = false
		}
	}

	async function delAff(id) {
		fb('own_quote_remove', { quote_id: id })
		try {
			await apiAffirmationDelete(id)
			if (editingId.value === id) cancelEditAff()
			invalidateListCache()
			clearLikeCollectCaches()
			hasMore.value = true
			await load(true)
		} catch (e) {}
	}

	function goShare(q) {
		const type = rowTargetType(q)
		if (type === 'ai_message') {
			openSharePage({
				id: q.id,
				content_id: q.id,
				mode: 'ai',
				text: q.content,
				cite: q.source_ref,
				collected: isCollected(q),
			})
			return
		}
		openSharePage({ id: q.id, text: q.content, cite: q.source_ref, collected: isCollected(q), fbSource: kind.value === 'history' ? 'history_quote_share' : '' })
	}

	function goShareAff(a) {
		openSharePage({
			mode: 'affirmation',
			id: a.id,
			text: a.content,
			cite: affAuthor(a),
			collected: isCollected(a),
		})
	}

	function formatDay(raw) {
		if (raw == null || raw === '') return ''
		if (typeof raw === 'number' && Number.isFinite(raw)) {
			const ms = raw < 1e12 ? raw * 1000 : raw
			const dt = new Date(ms)
			if (!Number.isNaN(dt.getTime())) {
				const y = dt.getFullYear()
				const mo = String(dt.getMonth() + 1).padStart(2, '0')
				const d = String(dt.getDate()).padStart(2, '0')
				return `${y}-${mo}-${d}`
			}
		}
		const s = String(raw).trim()
		if (!s || s === 'None' || s === 'null' || s === '[object Object]') return ''
		const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
		if (m) {
			const y = m[1]
			const mo = m[2].padStart(2, '0')
			const d = m[3].padStart(2, '0')
			return `${y}-${mo}-${d}`
		}
		const ts = Date.parse(s)
		if (!Number.isNaN(ts)) {
			const dt = new Date(ts)
			const y = dt.getFullYear()
			const mo = String(dt.getMonth() + 1).padStart(2, '0')
			const d = String(dt.getDate()).padStart(2, '0')
			return `${y}-${mo}-${d}`
		}
		return ''
	}

	function firstDay(row, keys) {
		if (!row) return ''
		for (const key of keys) {
			const day = formatDay(row[key])
			if (day) return day
		}
		return ''
	}

	function parseStamp(raw) {
		if (raw == null || raw === '') return 0
		if (typeof raw === 'number' && Number.isFinite(raw)) {
			return raw < 1e12 ? raw * 1000 : raw
		}
		const s = String(raw).trim()
		if (!s || s === 'None' || s === 'null' || s === '[object Object]') return 0
		const ts = Date.parse(s)
		return Number.isNaN(ts) ? 0 : ts
	}

	function assetStamp(row) {
		if (!row) return 0
		const common = ['action_at', 'created_at', 'create_time', 'updated_at', 'createTime', 'createdAt']
		const keys = kind.value === 'like'
			? ['liked_at', 'likedAt', ...common]
			: kind.value === 'collect'
				? ['collected_at', 'collectedAt', ...common]
				: kind.value === 'history'
					? ['viewed_at', 'viewedAt', 'latest_at', ...common]
					: common
		for (const key of keys) {
			const ts = parseStamp(row[key])
			if (ts) return ts
		}
		return 0
	}

	function quoteSource(q) {
		if (!q) return ''
		if (isAffirmationItem(q)) return affAuthor(q)
		return String(q.source_ref || q.source || q.citation || q.author || '').trim()
	}

	function assetDay(row) {
		if (!row) return ''
		const common = ['action_at', 'created_at', 'create_time', 'updated_at', 'createTime', 'createdAt']
		if (kind.value === 'like') return firstDay(row, ['liked_at', 'likedAt', ...common])
		if (kind.value === 'collect') return firstDay(row, ['collected_at', 'collectedAt', ...common])
		if (kind.value === 'history') return firstDay(row, ['viewed_at', 'viewedAt', 'latest_at', ...common])
		if (kind.value === 'affirmation') return firstDay(row, common)
		return firstDay(row, ['liked_at', 'collected_at', 'viewed_at', ...common])
	}

	function assetDayPretty(row) {
		const ts = assetStamp(row)
		if (!ts) return assetDay(row)
		const dt = new Date(ts)
		if (Number.isNaN(dt.getTime())) return assetDay(row)
		const locRaw = getLocale() || 'en'
		const locMap = {
			zh: 'zh-CN', en: 'en-US', es: 'es', pt: 'pt-BR', ja: 'ja', ko: 'ko',
			ar: 'ar', ru: 'ru', fr: 'fr', de: 'de', fil: 'fil', it: 'it',
		}
		const loc = locMap[locRaw] || 'en-US'
		const day = dt.getDate()
		const year = dt.getFullYear()
		const month = datePart(dt, loc, 'month', { month: 'short' })
			|| ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()]
		return `${month} ${day} ${year}`
	}

	function datePart(dt, loc, type, opt) {
		try {
			const parts = new Intl.DateTimeFormat(loc, opt).formatToParts(dt)
			const hit = parts.find((p) => p.type === type)
			if (hit && hit.value && hit.value.length <= 8) return hit.value
		} catch (e) {}
		return ''
	}

	function isLiked(q) {
		return !!q?.liked
	}

	function isCollected(q) {
		return !!q?.collected
	}

	function onLikeHit(q) {
		rowTap.run(() => toggleLikeRow(q))
	}

	function onCollectHit(q) {
		rowTap.run(() => toggleCollectRow(q))
	}

	function onShareHit(q) {
		rowTap.run(() => {
			const id = assetContentId(q)
			if (kind.value === 'like') fb('topic_likePage_share', { cotentId: id })
			else if (kind.value === 'affirmation' || isAffirmationItem(q)) fb('own_quote_share', { quote_id: id })
			else if (kind.value === 'history') fb('history_quote_share')
			if (kind.value === 'affirmation' || isAffirmationItem(q)) goShareAff(q)
			else goShare(q)
		})
	}

	async function toggleLikeRow(q) {
		const id = assetContentId(q)
		if (id == null) return
		const type = rowTargetType(q)
		const likedNow = isLiked(q)
		const next = !likedNow
		try {
			if (kind.value === 'like' && next) logFirebaseEvent('quote_like_click')
			else if (kind.value === 'collect') logFirebaseEvent(next ? 'collection_quote_like' : 'collection_quote_unlike', { list_name: deps.folderName ? deps.folderName() : '', quoteID: id })
			else if (kind.value === 'affirmation') logFirebaseEvent('own_quote_like', { quote_id: id })
			else if (kind.value === 'history' && next) logFirebaseEvent('history_quote_like')
		} catch (e) {}
		patchRow(id, { liked: next }, type)
		if (type !== 'affirmation') recordLikeStatus(id, next)
		try {
			await apiLike(id, next, likeCollectOpts(q))
			if (!next && kind.value === 'like') {
				try { logFirebaseEvent('quote_like_cancel', { source: 'like' }) } catch (e) {}
			}
			if (type === 'affirmation') clearLikeCollectCaches()
			if (kind.value === 'like' && !next) {
				list.value = list.value.filter((x) => !(sameAssetId(assetContentId(x), id) && rowTargetType(x) === type))
			}
		} catch (e) {
			patchRow(id, { liked: likedNow }, type)
			if (type !== 'affirmation') recordLikeStatus(id, likedNow)
			uni.showToast({ title: t('request_failed'), icon: 'none' })
		}
	}

	async function toggleCollectRow(q) {
		const id = assetContentId(q)
		if (id == null) return
		const type = rowTargetType(q)
		const collectedNow = isCollected(q)
		try {
			if (kind.value === 'like') {
				logFirebaseEvent(collectedNow ? 'topic_likePage_collection_cancel' : 'topic_likePage_collection_click', { cotentId: id })
			} else if (kind.value === 'collect' && collectedNow) {
				logFirebaseEvent('collection_quote_remove', { list_name: deps.folderName ? deps.folderName() : '', quoteID: id })
			} else if (kind.value === 'affirmation' && !collectedNow) {
				logFirebaseEvent('own_quote_collection', { quote_id: id })
			} else if (kind.value === 'history' && !collectedNow) {
				logFirebaseEvent('history_quote_collection')
			}
		} catch (e) {}
		try {
			if (collectedNow) {
				await apiUncollect(id, likeCollectOpts(q))
				if (type === 'affirmation') clearLikeCollectCaches()
				writeQuoteStatusCache(id, { collected: false })
				if (kind.value === 'collect') {
					list.value = list.value.filter((x) => !(sameAssetId(assetContentId(x), id) && rowTargetType(x) === type))
					return
				}
				patchRow(id, { collected: false }, type)
				return
			}
			await openCollectFolderSheet({ ...q, id, item_type: type, target_type: type })
		} catch (e) {
			uni.showToast({ title: t('request_failed'), icon: 'none' })
		}
	}

	onLoad((q) => {
		// 必须在 onLoad 里设 kind 并拉数：H5 上 onMounted 可能早于 onLoad，
		// 否则会按默认 like 拉完再切到 collect，列表/文件夹错位。
		kind.value = (q && q.kind) || 'like'
		fromExplore.value = String(q?.from || '') === 'explore'
		if (kind.value === 'history') fb('history_page_show')
		booted = true
		skipNextShow = true
		load(true)
	})

	onShow(() => {
		if (!booted || loading) return
		if (skipNextShow) {
			skipNextShow = false
			return
		}
		if (kind.value === 'history') fb('history_page_show')
		if (kind.value === 'collect' || kind.value === 'like' || kind.value === 'affirmation') {
			load(true)
		}
	})

	onReachBottom(() => {
		if (collectBrowse.value) return
		load(false)
	})

	return {
		affirmations,
		affFollowed,
		affFollowBusy,
		toggleAffFollow,
		draft,
		authorDraft,
		editingId,
		savingAff,
		draftLen,
		affAuthor,
		pageTitle,
		clearDialogOpen,
		displayTags,
		displayFilter,
		showDisplayFilters,
		filteredList,
		setDisplayFilter,
		load,
		invalidateListCache,
		patchRow,
		goBack,
		uncollect,
		unlike,
		clearHistoryConfirm,
		doClearHistory,
		editAff,
		cancelEditAff,
		saveAff,
		delAff,
		goShare,
		goShareAff,
		quoteSource,
		assetDay,
		assetDayPretty,
		assetStamp,
		isLiked,
		isCollected,
		isAffirmationItem,
		assetRowKey,
		citeMark,
		onLikeHit,
		onCollectHit,
		onShareHit,
		toggleLikeRow,
		toggleCollectRow,
	}
}
