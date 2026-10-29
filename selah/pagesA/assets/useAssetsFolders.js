/**
 * 我的资产：收藏夹 CRUD、移动/加入收藏 Sheet。
 */
import { ref, computed } from 'vue'
import {
	apiFolders, apiFolderSave, apiFolderDelete, apiFollowFolder, apiCollect, apiMyAssets, parseFolderList, normalizeFolderItem, isAffirmationTarget, contentTargetType,
} from '@/api/content.js'
import { silentListRefresh, clearPageCache } from '@/utils/pageCache.js'
import { ASSETS_FOLDERS_KEY } from '@/utils/wallpaperCache.js'
import { writeQuoteStatusCache } from '@/utils/likeSync.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

/**
 * @param {{
 *   t: Function,
 *   kind: import('vue').Ref,
 *   list: import('vue').Ref,
 *   loadingMore: import('vue').Ref,
 *   hasMore: import('vue').Ref,
 *   deps: Record<string, any>,
 * }} opts
 * deps 回填：load / invalidateListCache / patchRow
 */
export function useAssetsFolders({
	t,
	kind,
	list,
	loadingMore,
	hasMore,
	deps,
}) {
	const folders = ref([])
	const foldersReady = ref(false)
	const folderId = ref(null)
	const savingFolder = ref(false)
	const followBusy = ref(false)
	const collectBrowse = computed(() => kind.value === 'collect' && !folderId.value)
	const openFolderMeta = computed(() => {
		if (folderId.value == null) return null
		return folders.value.find((f) => String(f.id) === String(folderId.value)) || null
	})

	const folderSheetOpen = ref(false)
	const folderSheetItems = ref([])
	const folderSheetTarget = ref(null)
	const moveSheetOpen = ref(false)
	const moveSheetItems = ref([])
	const moveSheetQuote = ref(null)
	const collectSheetMode = ref('move')
	const pendingCollectQuote = ref(null)
	const folderDialogOpen = ref(false)
	const folderDialogMode = ref('create')
	const folderDialogName = ref('')
	const folderDialogTarget = ref(null)
	const folderDeleteOpen = ref(false)
	const folderDeleteTarget = ref(null)

	function pickCount(obj) {
		if (!obj || typeof obj !== 'object') return null
		const keys = [
			'item_count', 'itemCount', 'quote_count', 'quoteCount',
			'quotes_count', 'quotesCount', 'content_count', 'contentCount',
			'collect_count', 'collectCount', 'count', 'total', 'total_count', 'totalCount',
		]
		for (const k of keys) {
			if (obj[k] == null || obj[k] === '') continue
			const n = Number(obj[k])
			if (Number.isFinite(n) && n >= 0) return n
		}
		return null
	}

	function readFolderCount(f) {
		const direct = pickCount(f)
		if (direct != null && direct > 0) return direct
		const nested = pickCount(f?.stats) ?? pickCount(f?.meta)
		if (nested != null) return nested
		return direct || 0
	}

	function readAssetsTotal(res) {
		const p = res?.pagination || {}
		const preferred = [p.total, p.total_count, p.totalCount, p.item_count, res?.total, res?.total_count]
		for (const v of preferred) {
			const n = Number(v)
			if (Number.isFinite(n) && n >= 0) return n
		}
		const rows = res?.results
		const rowN = Array.isArray(rows) ? rows.length : 0
		const pages = Number(p.total_pages || p.totalPages)
		const size = Number(p.page_size || p.pageSize || p.size)
		if (Number.isFinite(pages) && pages >= 0 && (size === 1 || !Number.isFinite(size))) {
			if (rowN === 0 && pages <= 1) return 0
			return pages
		}
		return rowN
	}

	function normalizeFolder(f) {
		const row = normalizeFolderItem(f)
		if (!row) return null
		return {
			...row,
			item_count: readFolderCount(row),
			followed: readFollowed(row),
		}
	}

	function readFollowed(f) {
		if (!f || typeof f !== 'object') return false
		return !!(f.followed ?? f.is_followed ?? f.following)
	}

	function patchFolderFollow(id, followed) {
		if (id == null) return
		folders.value = (folders.value || []).map((f) => (
			String(f.id) === String(id) ? { ...f, followed: !!followed } : f
		))
	}

	function patchFolderCount(id, count) {
		const n = Number(count)
		if (id == null || !Number.isFinite(n) || n < 0) return
		folders.value = (folders.value || []).map((f) => (
			String(f.id) === String(id) ? { ...f, item_count: n } : f
		))
	}

	function bumpFolderCount(id, delta) {
		const f = (folders.value || []).find((x) => String(x.id) === String(id))
		if (!f) return
		patchFolderCount(id, Math.max(0, readFolderCount(f) + Number(delta || 0)))
	}

	async function fillMissingCounts(rows) {
		const list = Array.isArray(rows) ? rows : []
		await Promise.all(list.map(async (f, i) => {
			if (!f?.id || readFolderCount(f) > 0) return
			try {
				const res = await apiMyAssets('collect', f.id, { currentPage: 1, pageSize: 1 })
				list[i] = { ...f, item_count: Math.max(readAssetsTotal(res), (res.results || []).length) }
			} catch (e) {}
		}))
		return list
	}

	/** 拉取收藏夹：缓存秒开 + 静默刷新 */
	function loadFoldersSilent() {
		const { refresh } = silentListRefresh(
			ASSETS_FOLDERS_KEY,
			async () => {
				const res = await apiFolders()
				const rows = parseFolderList(res).map(normalizeFolder).filter(Boolean)
				await fillMissingCounts(rows)
				return { results: rows }
			},
			(payload) => {
				folders.value = (payload?.results || []).map(normalizeFolder).filter(Boolean)
			},
		)
		return refresh
	}

	async function loadFolders() {
		try {
			await loadFoldersSilent()
		} catch (e) {}
		foldersReady.value = true
	}

	function collectOpts(q) {
		return { target_type: contentTargetType(q) }
	}

	function collectTargetType(q) {
		return contentTargetType(q)
	}

	function afterCollectSuccess(q) {
		const id = q?.id
		if (id != null && Number(id) > 0) writeQuoteStatusCache(id, { collected: true })
		if (!isAffirmationTarget(q)) return
		if (typeof deps.clearLikeCollectCaches === 'function') deps.clearLikeCollectCaches()
	}

	function fb(name, params) {
		try { logFirebaseEvent(name, params) } catch (e) {}
	}

	function openFolder(f) {
		if (!f?.id) return
		fb('collection_list_click', { list_name: folderLabel(f), quoteCount: readFolderCount(f) })
		folderId.value = f.id
		hasMore.value = true
		list.value = []
		loadingMore.value = true
		if (typeof deps.setLoading === 'function') deps.setLoading(false)
		uni.pageScrollTo({ scrollTop: 0, duration: 0 })
		if (typeof deps.load === 'function') deps.load(true)
	}

	function folderLabel(f) {
		if (!f) return ''
		const name = String(f.name || '').trim()
		if (name) return name
		if (f.is_default || f.isDefault) return t('default_collection')
		return t('collections')
	}

	function folderMeta(f) {
		const count = readFolderCount(f)
		if (count === 1) return t('quotes_count_one')
		const raw = t('quotes_count', { n: count })
		return String(raw).replace('{n}', String(count))
	}

	function folderHasContent(f) {
		if (!f) return false
		if (folderId.value === f.id && !loadingMore.value) {
			return list.value.length > 0
		}
		return readFolderCount(f) > 0
	}

	function openFolderDialog(mode, folder = null) {
		if (mode === 'create') fb('collection_addNew_click')
		folderDialogMode.value = mode
		const target = folder?.id
			? ((folders.value || []).find((x) => String(x.id) === String(folder.id)) || folder)
			: folder
		folderDialogTarget.value = target
		folderDialogName.value = mode === 'rename' ? String(target?.name || '').trim() : ''
		folderDialogOpen.value = true
	}

	function closeFolderDialog() {
		folderDialogOpen.value = false
		folderDialogName.value = ''
		folderDialogTarget.value = null
		pendingCollectQuote.value = null
	}

	async function onFolderDialogConfirm() {
		const name = (folderDialogName.value || '').trim()
		if (!name || savingFolder.value) return
		if (folderDialogMode.value === 'create') fb('collection_addNew_save_click', { list_name: name })
		savingFolder.value = true
		try {
			if (folderDialogMode.value === 'rename' && folderDialogTarget.value) {
				await apiFolderSave({ id: folderDialogTarget.value.id, name })
				clearPageCache(ASSETS_FOLDERS_KEY)
				await loadFolders()
				closeFolderDialog()
				return
			}
			const res = await apiFolderSave({ name })
			if (typeof deps.invalidateListCache === 'function') deps.invalidateListCache()
			await loadFolders()
			const createdId = res.results?.id
			const pending = pendingCollectQuote.value
			pendingCollectQuote.value = null
			closeFolderDialog()
			if (pending && createdId) {
				await apiCollect(pending.id, createdId, collectOpts(pending))
				bumpFolderCount(createdId, 1)
				if (typeof deps.onCollected === 'function') deps.onCollected(pending, createdId, name)
				afterCollectSuccess(pending)
				if (kind.value === 'collect' && folderId.value) {
					hasMore.value = true
					if (typeof deps.load === 'function') deps.load(true)
				} else if (kind.value !== 'collect') {
					if (typeof deps.patchRow === 'function') {
						deps.patchRow(pending.id, { collected: true }, collectTargetType(pending))
					}
				}
			}
		} catch (e) {
		} finally {
			savingFolder.value = false
		}
	}

	function folderActions(f) {
		if (!f) return
		folderSheetTarget.value = f
		folderSheetItems.value = [
			{ code: 'rename', label: t('rename') },
			{ code: 'delete', label: t('delete') },
		]
		folderSheetOpen.value = true
		fb('collection_list_edit_popup', { list_name: folderLabel(f) })
	}

	/** 收藏夹详情顶栏「更多」：编辑名称 / 移除 / 关注 */
	function openCollectMoreMenu() {
		const f = openFolderMeta.value || (folderId.value != null ? { id: folderId.value } : null)
		if (!f) return
		folderSheetTarget.value = f
		folderSheetItems.value = [
			{ code: 'rename', label: t('edit_name') },
			{ code: 'remove', label: t('remove') },
			{ code: 'follow', label: readFollowed(f) ? t('following') : t('follow') },
		]
		folderSheetOpen.value = true
		fb('collection_list_edit_popup', { list_name: folderLabel(f) })
	}

	async function toggleFolderFollow(target) {
		const f = target || openFolderMeta.value || (folderId.value != null ? { id: folderId.value } : null)
		const id = f?.id
		if (!id || followBusy.value) return
		const next = !readFollowed(openFolderMeta.value || f)
		patchFolderFollow(id, next)
		followBusy.value = true
		try {
			const res = await apiFollowFolder(id, next)
			const server = res?.results?.followed ?? res?.results?.follow ?? res?.followed ?? next
			patchFolderFollow(id, !!server)
			fb('collection_list_edit_follow_result', { is_follow: !!server })
			clearPageCache(ASSETS_FOLDERS_KEY)
		} catch (e) {
			patchFolderFollow(id, !next)
			fb('collection_list_edit_follow_result', { is_follow: !next })
			uni.showToast({ title: t('request_failed'), icon: 'none' })
		} finally {
			followBusy.value = false
		}
	}

	async function onFolderSheetSelect({ value }) {
		const f = folderSheetTarget.value
		if (!f) return
		const name = folderLabel(f)
		if (value === 'follow') {
			fb('collection_list_edit_follow', { list_name: name })
			await toggleFolderFollow(f)
			return
		}
		if (value === 'rename') {
			fb('collection_list_edit_name', { list_name: name })
			openFolderDialog('rename', f)
			return
		}
		if (value === 'remove' || value === 'delete') {
			fb('collection_list_edit_remove', { list_name: name })
			askDeleteFolder(f)
		}
	}

	function askDeleteFolder(f) {
		if (!f?.id) return
		folderDeleteTarget.value = f
		folderDeleteOpen.value = true
	}

	function closeFolderDelete() {
		folderDeleteOpen.value = false
		folderDeleteTarget.value = null
	}

	async function confirmFolderDelete() {
		const f = folderDeleteTarget.value
		if (!f?.id || savingFolder.value) return
		savingFolder.value = true
		try {
			await apiFolderDelete(f.id)
			clearPageCache(ASSETS_FOLDERS_KEY)
			if (typeof deps.invalidateListCache === 'function') deps.invalidateListCache()
			if (String(folderId.value) === String(f.id)) folderId.value = null
			hasMore.value = true
			closeFolderDelete()
			await loadFolders()
			if (typeof deps.load === 'function') deps.load(true)
		} catch (e) {
			closeFolderDelete()
			if (e && e.code === 409) {
				uni.showToast({ title: t('folder_delete_not_empty'), icon: 'none' })
			}
		} finally {
			savingFolder.value = false
		}
	}

	function moveCollect(q) {
		collectSheetMode.value = 'move'
		pendingCollectQuote.value = null
		const targets = folders.value.filter((f) => f.id !== folderId.value)
		if (!targets.length) {
			uni.showToast({ title: t('empty'), icon: 'none' })
			return
		}
		moveSheetQuote.value = q
		moveSheetItems.value = targets.map((f) => ({ code: String(f.id), label: folderLabel(f) }))
		moveSheetOpen.value = true
	}

	async function openCollectFolderSheet(q) {
		await loadFolders()
		collectSheetMode.value = 'collect'
		moveSheetQuote.value = q
		const rows = (folders.value || []).map((f) => ({ code: String(f.id), label: folderLabel(f) }))
		moveSheetItems.value = rows
		moveSheetOpen.value = true
	}

	async function onMoveSheetSelect({ value }) {
		const q = moveSheetQuote.value
		if (!q) return
		const folderIdNum = Number(value)
		const picked = folders.value.find((x) => String(x.id) === String(value))
		const listName = picked ? folderLabel(picked) : ''
		const contentId = q.id ?? q.content_id
		if (kind.value === 'like') {
			fb('topic_likePage_collection_popup_click', { cotentId: contentId, list_name: listName })
		}
		try {
			await apiCollect(q.id, folderIdNum, collectOpts(q))
		} catch (e) {
			if (kind.value === 'like') {
				fb('topic_likePage_collection_result', { result: 'fail', cotentId: contentId, list_name: listName })
			}
			uni.showToast({ title: t('request_failed'), icon: 'none' })
			return
		}
		if (kind.value === 'like') {
			fb('topic_likePage_collection_result', { result: 'suc', cotentId: contentId, list_name: listName })
		}
		if (typeof deps.invalidateListCache === 'function') deps.invalidateListCache()
		afterCollectSuccess(q)
		bumpFolderCount(folderIdNum, 1)
		const f = folders.value.find((x) => String(x.id) === String(value))
		if (typeof deps.onCollected === 'function') deps.onCollected(q, folderIdNum, f ? folderLabel(f) : '')
		if (collectSheetMode.value === 'collect' && kind.value !== 'collect') {
			if (typeof deps.patchRow === 'function') {
				deps.patchRow(q.id, { collected: true }, collectTargetType(q))
			}
			return
		}
		hasMore.value = true
		if (typeof deps.load === 'function') deps.load(true)
	}

	return {
		folders,
		foldersReady,
		folderId,
		savingFolder,
		collectBrowse,
		openFolderMeta,
		folderSheetOpen,
		folderSheetItems,
		moveSheetOpen,
		moveSheetItems,
		collectSheetMode,
		folderDialogOpen,
		folderDialogMode,
		folderDialogName,
		folderDeleteOpen,
		folderDeleteTarget,
		loadFolders,
		openFolder,
		folderLabel,
		folderMeta,
		openFolderDialog,
		closeFolderDialog,
		onFolderDialogConfirm,
		confirmFolderDelete,
		closeFolderDelete,
		folderActions,
		openCollectMoreMenu,
		onFolderSheetSelect,
		toggleFolderFollow,
		moveCollect,
		openCollectFolderSheet,
		onMoveSheetSelect,
		patchFolderCount,
		readAssetsTotal,
	}
}
