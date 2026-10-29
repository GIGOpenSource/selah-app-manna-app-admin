import { computed, nextTick, ref } from 'vue'

/** 勾选跨页保留。翻页后把当前页里已选的行重新勾上。 */
export function usePageSelection(rows) {
  const selectedMap = ref(new Map())
  const tableRef = ref(null)
  let restoring = false

  const selectedRows = computed(() => [...selectedMap.value.values()])
  const selectedIds = computed(() => [...selectedMap.value.keys()])

  function onSelectionChange(pageRows) {
    if (restoring) return
    const visible = new Set((rows.value || []).map((row) => row.id))
    const picked = new Set((pageRows || []).map((row) => row.id))
    const next = new Map(selectedMap.value)
    for (const id of visible) {
      if (!picked.has(id)) next.delete(id)
    }
    for (const row of pageRows || []) next.set(row.id, row)
    selectedMap.value = next
  }

  async function restoreSelection() {
    restoring = true
    await nextTick()
    const table = tableRef.value
    table?.clearSelection?.()
    for (const row of rows.value || []) {
      if (selectedMap.value.has(row.id)) table?.toggleRowSelection?.(row, true)
    }
    await nextTick()
    restoring = false
  }

  function clearSelection() {
    selectedMap.value = new Map()
    tableRef.value?.clearSelection?.()
  }

  function selectIds(ids) {
    const next = new Map()
    for (const id of ids || []) next.set(id, { id })
    selectedMap.value = next
  }

  return {
    tableRef,
    selectedRows,
    selectedIds,
    onSelectionChange,
    restoreSelection,
    clearSelection,
    selectIds,
  }
}
