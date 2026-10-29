<template>
  <div>
    <div>
      <label class="cms-field-label">收录方式 <span class="cms-req">*</span></label>
      <el-select :model-value="mode" style="width: 100%" @update:model-value="emit('update:mode', $event)">
        <el-option :label="autoLabel" value="auto" />
        <el-option :label="manualLabel" value="manual" />
      </el-select>
    </div>
    <div v-if="mode === 'auto'" class="full" style="margin-top: 16px">
      <div class="cms-section-head">
        <strong>自动收录条件</strong>
        <span>可跨标签类型多选；选择后下方实时预览。</span>
      </div>
      <div style="margin-top: 14px">
        <label class="cms-field-label">条件关系</label>
        <el-select :model-value="match" style="width: 280px" @update:model-value="emit('update:match', $event)">
          <el-option label="满足任一条件" value="any" />
          <el-option label="同时满足全部条件" value="all" />
        </el-select>
      </div>
      <div class="cms-cond-groups">
        <section v-for="t in applicableTypes" :key="t.key" class="cms-cond-group">
          <strong>{{ zhTypeLabel(t) }}</strong>
          <div class="cms-chip-row">
            <el-check-tag
              v-for="tag in enabledTagsOf(tags, t.key)"
              :key="tag.id"
              :checked="hasCondition(t.key, tag.name)"
              @change="toggleCondition(t.key, tag.name)"
            >{{ tag.name }}</el-check-tag>
          </div>
        </section>
      </div>
    </div>
    <div v-else class="full" style="margin-top: 16px">
      <div class="cms-section-head">
        <strong>{{ manualTitle }}</strong>
        <span>{{ manualCopy }}</span>
      </div>
      <el-table
        v-if="!wallpaper"
        :data="items"
        class="allow-wrap cms-manual-table"
        max-height="420"
        row-key="id"
        :row-class-name="manualRowClass"
        @row-click="onManualRowClick"
      >
        <el-table-column width="48">
          <template #default="{ row }">
            <el-checkbox
              :model-value="isPicked(row.id)"
              @click.stop
              @change="(v) => toggleManual(row.id, v)"
            />
          </template>
        </el-table-column>
        <el-table-column type="index" label="序号" width="72" :index="(i) => i + 1" />
        <el-table-column label="ID" width="96" sortable :sort-method="sortById">
          <template #default="{ row }">
            <span class="cms-id">#{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="语录内容" min-width="180">
          <template #default="{ row }">
            <strong>{{ row.title || '未命名' }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '已启用' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="200">
          <template #default="{ row }">
            <div v-if="secondaryTags(row).length" class="cms-tag-scroller">
              <span v-for="tag in secondaryTags(row)" :key="tag" class="cms-sec-tag">{{ tag }}</span>
            </div>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>
      <div v-else class="cms-manual-list is-wallpaper">
        <label
          v-for="item in items"
          :key="item.id"
          class="cms-manual-item wallpaper"
          :class="{ selected: manualIds.includes(item.id) }"
        >
          <el-checkbox :model-value="manualIds.includes(item.id)" @change="(v) => toggleManual(item.id, v)" />
          <span v-if="item.thumb" class="cms-manual-thumb" :style="{ backgroundImage: `url(${item.thumb})` }" />
          <span class="cms-manual-copy">
            <strong>{{ item.title || '未命名' }}</strong>
            <small>#{{ item.id }} · {{ item.status === 1 ? '已启用' : '已停用' }}</small>
            <div v-if="secondaryTags(item).length" class="cms-tag-scroller">
              <span v-for="tag in secondaryTags(item)" :key="tag" class="cms-sec-tag">{{ tag }}</span>
            </div>
          </span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { enabledTagsOf, zhTypeLabel } from '../../utils/tagLibrary'

const props = defineProps({
  mode: { type: String, default: 'auto' },
  match: { type: String, default: 'any' },
  conditions: { type: Array, default: () => [] },
  manualIds: { type: Array, default: () => [] },
  applicableTypes: { type: Array, default: () => [] },
  tags: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  autoLabel: { type: String, default: '映射隐性标签对应的内容' },
  manualLabel: { type: String, default: '直接选择具体内容' },
  manualTitle: { type: String, default: '手动选择内容' },
  manualCopy: { type: String, default: '点击选项后，下方实时汇总已选内容。' },
  wallpaper: { type: Boolean, default: false },
})
const emit = defineEmits(['update:mode', 'update:match', 'update:conditions', 'update:manualIds'])

function hasCondition(type, name) {
  return (props.conditions || []).some((c) => c.type === type && c.name === name)
}
function toggleCondition(type, name) {
  const cur = props.conditions || []
  emit('update:conditions', hasCondition(type, name)
    ? cur.filter((c) => !(c.type === type && c.name === name))
    : [...cur, { type, name }])
}
function isPicked(id) {
  return (props.manualIds || []).includes(id)
}
function toggleManual(id, checked) {
  const cur = props.manualIds || []
  emit('update:manualIds', checked ? [...new Set([...cur, id])] : cur.filter((x) => x !== id))
}
function manualRowClass({ row }) {
  return isPicked(row.id) ? 'is-picked' : ''
}
function onManualRowClick(row, _column, event) {
  if (event?.target?.closest?.('.el-checkbox')) return
  toggleManual(row.id, !isPicked(row.id))
}
function sortById(a, b) {
  return Number(a.id) - Number(b.id)
}

function secondaryTags(item) {
  return [...new Set((item.tags || []).map((t) => String(t || '').trim()).filter(Boolean))]
}
</script>
