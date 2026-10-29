<template>
  <div>
    <p class="cms-mapped-note">只读取适用于壁纸的二级隐性标签，无需新建；一级标签仅用于后台分组。来源启用且前端展示开启并完成发布后，才会出现在 App。</p>
    <div v-for="group in groups" :key="group.key" class="cms-filter-group">
      <div class="cms-filter-head">{{ group.label }}</div>
      <el-table :data="group.items" class="allow-wrap">
        <el-table-column label="标签名称" min-width="180">
          <template #default="{ row }">
            <div class="cms-name-line">
              <span>{{ displayName(row) }}</span>
              <el-tag v-for="chip in missChips(row)" :key="chip" type="danger" size="small" effect="light">{{ chip }}</el-tag>
            </div>
            <div class="cms-sub">#{{ row.id }} · {{ row.code }}</div>
          </template>
        </el-table-column>
        <el-table-column label="来源状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '已启用' : '已停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="前端展示" width="140">
          <template #default="{ row }">
            <el-switch
              :model-value="!!row.display_enabled"
              @change="(v) => $emit('toggle', row, !!v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="App 有效" width="120">
          <template #default="{ row }">
            <el-tag :type="row.frontend_enabled ? 'success' : 'info'" size="small">
              {{ row.frontend_enabled ? '前端显示' : '前端不显示' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div v-if="!filters.length" class="cms-empty">还没有适用于壁纸的隐性标签，请先到隐性标签库新建。</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  lang: { type: String, default: 'en' },
  filters: { type: Array, default: () => [] },
})

function displayName(row) {
  const english = String(row?.name || row?.name_en || '').trim()
  if (props.lang === 'es') return String(row?.name_es || '').trim() || english
  if (props.lang === 'pt') return String(row?.name_pt || '').trim() || english
  return english
}
function missChips(row) {
  const chips = []
  if (!String(row?.name_es || '').trim()) chips.push('西缺')
  if (!String(row?.name_pt || '').trim()) chips.push('葡缺')
  return chips
}
defineEmits(['toggle'])

const groups = computed(() => {
  const map = new Map()
  for (const item of props.filters || []) {
    const key = item.type
    if (!map.has(key)) map.set(key, { key, label: item.type_label || key, items: [] })
    map.get(key).items.push(item)
  }
  return [...map.values()]
})
</script>
