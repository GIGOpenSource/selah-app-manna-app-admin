<template>
  <div>
    <StructurePublishBar
      :dirty="dirty"
      :publishing="publishing"
      :discarding="discarding"
      @publish="$emit('publish')"
      @discard="$emit('discard')"
    />
    <div v-loading="moving" class="cms-hierarchy" element-loading-text="正在调整顺序">
      <section v-for="(column, index) in columns" :key="column.id" class="cms-column-card" :class="{ disabled: column.status !== 'published' }">
        <div class="cms-column-head">
          <div class="cms-column-title">
            <span class="cms-column-order">{{ index + 1 }}</span>
            <div>
              <div class="cms-name-line">
                <strong>{{ displayName(column) }}</strong>
                <el-tag v-for="chip in missChips(column)" :key="chip" type="danger" size="small" effect="light">{{ chip }}</el-tag>
              </div>
              <span>{{ childrenOf(column).length }} 个文字合集标题 · {{ column.status === 'published' ? '已展示' : '未展示' }}</span>
            </div>
          </div>
          <div class="cms-structure-actions">
            <el-button size="small" :disabled="moving || index === 0" @click="$emit('move', column.id, -1)">上移</el-button>
            <el-button size="small" :disabled="moving || index === columns.length - 1" @click="$emit('move', column.id, 1)">下移</el-button>
            <el-button link type="primary" @click="openColumn(column)">编辑模块</el-button>
            <el-button link type="danger" @click="$emit('delete-column', column)">删除</el-button>
            <el-button :disabled="column.status !== 'published'" @click="$emit('add-collection', column)">＋ 新增文字合集标题</el-button>
          </div>
        </div>
        <div class="cms-collection-list">
          <div v-if="!childrenOf(column).length" class="cms-collection-empty">
            <span>暂时没有文字合集标题</span>
            <el-button link type="primary" :disabled="column.status !== 'published'" @click="$emit('add-collection', column)">＋ 新增第一个合集</el-button>
          </div>
          <div v-for="(col, cIndex) in childrenOf(column)" :key="col.id" class="cms-collection-row" :class="{ disabled: col.status !== 'published' }">
            <div>
              <div class="cms-name-line">
                <strong>{{ displayName(col) }}</strong>
                <el-tag v-if="col.vip" size="small" type="warning">VIP</el-tag>
                <el-tag v-for="chip in missChips(col)" :key="chip" type="danger" size="small" effect="light">{{ chip }}</el-tag>
              </div>
              <div class="cms-hint">{{ col.count || 0 }} 条命中 / {{ col.enabled_count || 0 }} 条前台有效 · {{ col.status === 'published' ? '已启用' : '已停用' }}</div>
            </div>
            <div class="cms-collection-source">
              <b>{{ col.mode === 'manual' ? '直接关联具体语录' : '映射隐性标签' }}</b>
              <div>{{ conditionText(col, types) }}</div>
            </div>
            <div class="cms-structure-actions">
              <el-select
                :model-value="col.parent_id"
                size="small"
                style="width: 140px"
                :disabled="column.status !== 'published'"
                @change="(v) => $emit('move-parent', col.id, v)"
              >
                <el-option v-for="p in visibleColumns" :key="p.id" :label="p.name_en" :value="p.id" />
              </el-select>
              <el-button size="small" :disabled="moving || column.status !== 'published' || cIndex === 0" @click="$emit('move', col.id, -1)">上移</el-button>
              <el-button size="small" :disabled="moving || column.status !== 'published' || cIndex === childrenOf(column).length - 1" @click="$emit('move', col.id, 1)">下移</el-button>
              <el-button link type="primary" :disabled="column.status !== 'published'" @click="$emit('edit-collection', col)">编辑</el-button>
              <el-button link type="danger" @click="$emit('delete-collection', col)">删除</el-button>
            </div>
          </div>
        </div>
      </section>
      <div v-if="!columns.length" class="cms-empty">还没有文字模块标题，点击右上角新建。</div>
    </div>

    <el-dialog v-model="columnVisible" :title="columnForm.id ? '编辑文字模块标题' : '新建文字模块标题'" width="640px" destroy-on-close>
      <el-form label-width="180px">
        <LocaleCopyFields
          variant="form"
          en-label="展示名称（英语）"
          es-label="展示名称（西语）"
          pt-label="展示名称（葡语）"
          :en="columnForm.name_en"
          :es="columnForm.name_es"
          :pt="columnForm.name_pt"
          @update:en="columnForm.name_en = $event"
          @update:es="columnForm.name_es = $event"
          @update:pt="columnForm.name_pt = $event"
        />
        <el-form-item label="前端展示">
          <el-switch v-model="columnForm.visible" />
          <div class="cms-hint">关闭后模块及其合集不在 App 展示，子合集配置保留。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="columnVisible = false">取消</el-button>
        <el-button type="primary" @click="saveColumn">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { conditionText, missingEnglish } from '../../utils/tagLibrary'
import LocaleCopyFields from '../../components/LocaleCopyFields.vue'
import StructurePublishBar from './StructurePublishBar.vue'

const props = defineProps({
  lang: { type: String, default: 'en' },
  columns: { type: Array, default: () => [] },
  collections: { type: Array, default: () => [] },
  types: { type: Array, default: () => [] },
  dirty: { type: Boolean, default: false },
  publishing: { type: Boolean, default: false },
  discarding: { type: Boolean, default: false },
  moving: { type: Boolean, default: false },
})
const emit = defineEmits(['publish', 'discard', 'move', 'move-parent', 'add-collection', 'edit-collection', 'save-column', 'delete-column', 'delete-collection'])

const visibleColumns = computed(() => props.columns.filter((c) => c.status === 'published'))
const columnVisible = ref(false)
const columnForm = ref({ id: null, name_en: '', name_es: '', name_pt: '', visible: true })

function displayName(row) {
  const english = String(row?.name_en || '').trim()
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

function childrenOf(column) {
  return props.collections.filter((c) => Number(c.parent_id) === Number(column.id))
}

function openColumn(row = null) {
  columnForm.value = row
    ? {
      id: row.id,
      name_en: row.name_en,
      name_es: row.name_es || '',
      name_pt: row.name_pt || '',
      visible: row.status === 'published',
    }
    : { id: null, name_en: '', name_es: '', name_pt: '', visible: true }
  columnVisible.value = true
}

function saveColumn() {
  if (missingEnglish(columnForm.value.name_en).length) {
    ElMessage.warning('请填写 English 名称')
    return
  }
  const dup = props.columns.find((c) => (
    c.id !== columnForm.value.id
    && String(c.name_en || '').toLowerCase() === columnForm.value.name_en.trim().toLowerCase()
  ))
  if (dup) {
    ElMessage.warning('已存在相同的 English 文字模块标题')
    return
  }
  emit('save-column', { ...columnForm.value })
  columnVisible.value = false
}

defineExpose({ openColumn })
</script>

<style scoped>
.is-missing { color: var(--el-color-warning); }
</style>
