import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchDisplayStructure, fetchLibraryTags, fetchQuotes, fetchTagTypes, fetchWallpapers,
  moveDisplayStructure, previewDisplayRule, publishDisplayStructure, discardDisplayStructure,
  saveDisplayTag, setDisplayTagStatus, deleteDisplayTags, setWallpaperFilterDisplay,
} from '../../api'
import { typeApplies } from '../../utils/tagLibrary'

export function useDisplayStructure() {
  const kind = ref('quote')
  const loading = ref(false)
  const serverDirty = ref(false)
  const orderBaseline = ref(new Map())
  const filterBaseline = ref(new Map())
  const publishedVersion = ref(0)
  const rows = ref([])
  const publishedRows = ref([])
  const wallpaperFilters = ref([])
  const publishedWallpaperFilters = ref([])
  const types = ref([])
  const allTags = ref([])
  const quoteItems = ref([])
  const wallpaperItems = ref([])
  const moving = ref(false)

  const columns = computed(() =>
    rows.value.filter((r) => r.display_type === 'column').sort((a, b) => a.sort - b.sort),
  )
  const collections = computed(() =>
    rows.value.filter((r) => r.display_type === 'collection').sort((a, b) => a.sort - b.sort),
  )
  const wallpaperGroups = computed(() =>
    rows.value.filter((r) => r.display_type === 'collection_group').sort((a, b) => a.sort - b.sort),
  )
  const visibleColumns = computed(() => columns.value.filter((c) => c.status === 'published'))
  const applicableTypes = computed(() =>
    types.value.filter((t) => typeApplies(t, kind.value === 'quote' ? 'text' : 'wallpaper')),
  )

  function rememberFilters(filters) {
    const map = new Map()
    for (const item of filters || []) map.set(String(item.id), !!item.display_enabled)
    filterBaseline.value = map
  }

  function rememberOrder(list) {
    const map = new Map()
    for (const row of list || []) map.set(String(row.id), Number(row.sort) || 0)
    orderBaseline.value = map
  }

  function groupKey(row) {
    return `${row.display_type}|${Number(row.parent_id || 0)}`
  }

  function sortByValue(list, valueOf) {
    return list.slice().sort((a, b) => (Number(valueOf(a)) || 0) - (Number(valueOf(b)) || 0) || a.id - b.id)
  }

  function baselineSort(row) {
    const key = String(row.id)
    return orderBaseline.value.has(key) ? orderBaseline.value.get(key) : row.sort
  }

  function orderChanged() {
    const groups = new Map()
    for (const row of rows.value) {
      const key = groupKey(row)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
    }
    for (const list of groups.values()) {
      const current = sortByValue(list, (row) => row.sort).map((row) => row.id).join(',')
      const baseline = sortByValue(list, baselineSort).map((row) => row.id).join(',')
      if (current !== baseline) return true
    }
    return false
  }

  function captureLocalSorts() {
    const map = new Map()
    for (const row of rows.value) {
      const key = String(row.id)
      if (!orderBaseline.value.has(key)) continue
      if (Number(row.sort) !== Number(orderBaseline.value.get(key))) map.set(key, Number(row.sort))
    }
    return map
  }

  function overlayLocalSorts(localSorts) {
    if (!localSorts?.size) return
    rows.value = rows.value.map((row) => {
      const key = String(row.id)
      if (!localSorts.has(key)) return row
      return { ...row, sort: localSorts.get(key) }
    })
  }

  function changedFilters() {
    return (wallpaperFilters.value || []).filter((item) => {
      const key = String(item.id)
      return filterBaseline.value.has(key) && !!item.display_enabled !== filterBaseline.value.get(key)
    })
  }

  const dirty = computed(() => serverDirty.value || changedFilters().length > 0 || orderChanged())

  function apply(data, localSorts = null) {
    serverDirty.value = !!data.dirty
    publishedVersion.value = data.published_version || 0
    rows.value = data.rows || []
    publishedRows.value = data.published_rows || []
    wallpaperFilters.value = data.wallpaper_filters || []
    publishedWallpaperFilters.value = data.published_wallpaper_filters || []
    rememberOrder(rows.value)
    overlayLocalSorts(localSorts)
    rememberFilters(wallpaperFilters.value)
  }

  async function loadMeta() {
    const [tr, tagsRes] = await Promise.all([
      fetchTagTypes(),
      fetchLibraryTags({ currentPage: 1, pageSize: 500 }),
    ])
    types.value = tr.results || []
    allTags.value = tagsRes.results || []
  }

  async function loadPickers() {
    const [qr, wr] = await Promise.all([
      fetchQuotes({ currentPage: 1, pageSize: 500, app_key: 'selah' }),
      fetchWallpapers({ currentPage: 1, pageSize: 500, app_key: 'selah' }),
    ])
    quoteItems.value = (qr.results || []).map((r) => ({
      id: r.id,
      title: r.content,
      status: r.status,
      tags: [
        r.content_type, r.theme, ...(r.scenario_tags || []), ...(r.emotion_tags || []),
        ...Object.values(r.taxonomy || {}).flat(),
      ].filter(Boolean),
    }))
    wallpaperItems.value = (wr.results || []).map((r) => ({
      id: r.id,
      title: r.name_en,
      thumb: (r.media_type === 'video' ? r.poster_url : r.image_url) || r.image_url,
      status: r.status,
      vip: !!r.is_vip,
      tags: [
        r.theme, ...(r.visual_tags || []), ...(r.scenario_tags || []), ...(r.emotion_tags || []),
        ...Object.values(r.taxonomy || {}).flat(),
      ].filter(Boolean),
    }))
  }

  async function load(nextKind = kind.value, localSorts = null) {
    kind.value = nextKind
    loading.value = true
    try {
      const res = await fetchDisplayStructure(nextKind)
      apply(res.results || res.data || {}, localSorts)
    } finally {
      loading.value = false
    }
  }

  function nextOrderMove() {
    const groups = new Map()
    for (const row of rows.value) {
      const key = groupKey(row)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
    }
    for (const list of groups.values()) {
      const current = sortByValue(list, (row) => row.sort)
      const baseline = sortByValue(list, baselineSort)
      for (let i = 0; i < current.length; i++) {
        if (current[i].id === baseline[i].id) continue
        const from = baseline.findIndex((row) => row.id === current[i].id)
        if (from > i) return { id: current[i].id, direction: -1 }
        throw new Error('顺序调整未能同步')
      }
    }
    return null
  }

  function applyMoveToBaseline({ id, direction }) {
    const row = rows.value.find((item) => item.id === id)
    if (!row) return
    const list = rows.value.filter((item) => groupKey(item) === groupKey(row))
    const ordered = sortByValue(list, baselineSort)
    const idx = ordered.findIndex((item) => item.id === id)
    const swapAt = idx + Number(direction)
    if (idx < 0 || swapAt < 0 || swapAt >= ordered.length) return
    const map = new Map(orderBaseline.value)
    const left = ordered[Math.min(idx, swapAt)]
    const right = ordered[Math.max(idx, swapAt)]
    let leftSort = Number(map.get(String(left.id)) ?? left.sort) || 0
    let rightSort = Number(map.get(String(right.id)) ?? right.sort) || 0
    if (leftSort === rightSort) {
      ordered.forEach((item, index) => map.set(String(item.id), (index + 1) * 10))
      leftSort = map.get(String(left.id))
      rightSort = map.get(String(right.id))
    }
    map.set(String(left.id), rightSort)
    map.set(String(right.id), leftSort)
    orderBaseline.value = map
  }

  async function flushOrderMoves() {
    let guard = 0
    while (guard < 500) {
      const step = nextOrderMove()
      if (!step) return
      await moveDisplayStructure(step)
      applyMoveToBaseline(step)
      serverDirty.value = true
      guard += 1
    }
    throw new Error('顺序调整未能同步')
  }

  async function publish() {
    await flushOrderMoves()
    const drafts = changedFilters()
    for (const item of drafts) {
      await setWallpaperFilterDisplay(item.id, !!item.display_enabled)
    }
    const res = await publishDisplayStructure(kind.value)
    apply(res.results || res.data || {})
    ElMessage.success(kind.value === 'quote' ? '文字模块与合集结构发布成功！' : '壁纸筛选与合集结构发布成功！')
  }

  function restoreLocalOrder() {
    rows.value = (rows.value || []).map((row) => {
      const key = String(row.id)
      if (!orderBaseline.value.has(key)) return row
      return { ...row, sort: orderBaseline.value.get(key) }
    })
  }

  function restoreLocalFilters() {
    wallpaperFilters.value = (wallpaperFilters.value || []).map((item) => {
      const key = String(item.id)
      if (!filterBaseline.value.has(key)) return item
      return { ...item, display_enabled: filterBaseline.value.get(key) }
    })
  }

  async function discard() {
    if (serverDirty.value) {
      await discardDisplayStructure(kind.value)
      await load(kind.value)
    } else {
      restoreLocalOrder()
      restoreLocalFilters()
    }
    ElMessage.success(kind.value === 'quote' ? '已取消语录显性结构的未发布调整' : '已取消壁纸显性结构的未发布调整')
  }

  function swapLocal(id, direction) {
    const row = rows.value.find((r) => r.id === id)
    if (!row) return false
    const siblings = rows.value
      .filter((r) => r.display_type === row.display_type && Number(r.parent_id || 0) === Number(row.parent_id || 0))
      .sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id)
    const idx = siblings.findIndex((r) => r.id === id)
    const next = idx + Number(direction)
    if (idx < 0 || next < 0 || next >= siblings.length) return false
    const a = siblings[idx]
    const b = siblings[next]
    const tmp = a.sort
    a.sort = b.sort
    b.sort = tmp
    rows.value = rows.value.slice()
    return true
  }

  function move(id, direction) {
    swapLocal(id, direction)
  }

  async function moveParent(id, parentId) {
    if (moving.value) return
    const localSorts = captureLocalSorts()
    localSorts.delete(String(id))
    moving.value = true
    try {
      const res = await moveDisplayStructure({ id, parent_id: parentId })
      apply(res.results || res.data || {}, localSorts)
    } finally {
      moving.value = false
    }
  }

  async function saveRow(payload) {
    const localSorts = captureLocalSorts()
    const res = await saveDisplayTag({ ...payload, kind: kind.value })
    await load(kind.value, localSorts)
    return res.results || res.data
  }

  async function deleteTags(idOrIds) {
    const localSorts = captureLocalSorts()
    await deleteDisplayTags(idOrIds)
    await load(kind.value, localSorts)
  }

  async function toggleRow(row) {
    await setDisplayTagStatus(row.id, row.status === 'published' ? 'disabled' : 'published')
    await load(kind.value)
    ElMessage.success(row.status === 'published' ? '已停用，确认发布后同步前端' : '已启用，确认发布后同步前端')
  }

  function toggleFilter(tag, enabled) {
    const on = !!enabled
    wallpaperFilters.value = (wallpaperFilters.value || []).map((item) => (
      String(item.id) === String(tag.id) ? { ...item, display_enabled: on } : item
    ))
  }

  async function preview(payload) {
    const res = await previewDisplayRule({ kind: kind.value, ...payload })
    return res.results || res.data || { items: [], count: 0, enabled_count: 0 }
  }

  return {
    kind, loading, moving, dirty, publishedVersion, rows, publishedRows,
    wallpaperFilters, publishedWallpaperFilters, types, allTags,
    quoteItems, wallpaperItems, columns, collections, wallpaperGroups,
    visibleColumns, applicableTypes,
    loadMeta, loadPickers, load, publish, discard, move, moveParent, saveRow, deleteTags, toggleRow, toggleFilter, preview,
  }
}
