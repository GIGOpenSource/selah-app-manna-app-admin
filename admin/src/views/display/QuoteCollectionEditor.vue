<template>
  <div class="container">
    <div class="pro-toolbar">
      <div>
        <div class="pro-toolbar-title">{{ form.id ? '编辑文字合集标题' : '新建文字合集标题' }}</div>
        <p class="cms-hint">配置前端合集标题、所属文字模块及其收录的语录。</p>
      </div>
    </div>
    <div class="pro-form-pad">
      <div class="cms-form-grid">
        <LocaleCopyFields
          class="full"
          en-label="展示名称（英语）"
          es-label="展示名称（西语）"
          pt-label="展示名称（葡语）"
          :en="form.name_en"
          :es="form.name_es"
          :pt="form.name_pt"
          @update:en="form.name_en = $event"
          @update:es="form.name_es = $event"
          @update:pt="form.name_pt = $event"
        />
        <div class="full">
          <label class="cms-field-label">所属文字模块 <span class="cms-req">*</span></label>
          <el-select v-model="form.parent_id" style="width: 100%">
            <el-option v-for="col in visibleColumns" :key="col.id" :label="col.name_en" :value="col.id" />
          </el-select>
        </div>
        <div class="full">
          <div class="cms-switch-row">
            <div>
              <strong>VIP 文字合集</strong>
              <div class="cms-hint">开启后，前端文字合集标题显示锁标识。</div>
            </div>
            <el-switch v-model="form.vip" />
          </div>
        </div>
        <div>
          <label class="cms-field-label">显示排序 <span class="cms-req">*</span></label>
          <el-input-number v-model="form.sort" :min="1" :step="1" controls-position="right" style="width: 100%" />
        </div>
        <div class="full">
          <InclusionFields
            v-model:mode="form.mode"
            v-model:match="form.match"
            v-model:conditions="form.conditions"
            v-model:manual-ids="form.manual_ids"
            :applicable-types="applicableTypes"
            :tags="tags"
            :items="items"
            auto-label="映射隐性标签对应的语录"
            manual-label="直接选择具体语录"
            manual-title="手动选择语录"
            manual-copy="点击语录选项，下方实时汇总已选内容。"
          />
        </div>
      </div>
      <div class="cms-editor-foot">
        <span class="cms-editor-state">{{ footer }}</span>
        <div>
          <el-button @click="$emit('cancel')">取消</el-button>
          <el-button v-if="form.id" type="danger" plain @click="$emit('delete')">删除</el-button>
          <el-button v-if="form.status === 'published'" @click="$emit('save', 'disabled')">停用</el-button>
          <el-button v-if="form.status !== 'published'" @click="$emit('save', 'disabled')">保存为已停用</el-button>
          <el-button type="primary" @click="$emit('save', 'published')">{{ form.status === 'published' ? '保存' : '保存并展示' }}</el-button>
        </div>
      </div>
    </div>
    <MatchPreview
      :title="form.mode === 'manual' ? '已选择语录预览' : '标签匹配语录预览'"
      :copy="form.mode === 'manual'
        ? '随上方勾选实时更新；已停用语录也会保留显示，便于核对收录范围。'
        : `按“${form.match === 'all' ? '同时满足全部条件' : '满足任一条件'}”实时计算；橙色标签表示当前命中的收录条件。`"
      :count-text="form.mode === 'manual' ? `已选择 ${preview.items.length} 条语录` : `当前匹配 ${preview.items.length} 条语录`"
      :items="preview.items"
      :empty="emptyCopy"
    />
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import InclusionFields from './InclusionFields.vue'
import MatchPreview from './MatchPreview.vue'
import LocaleCopyFields from '../../components/LocaleCopyFields.vue'

const props = defineProps({
  model: { type: Object, required: true },
  visibleColumns: { type: Array, default: () => [] },
  applicableTypes: { type: Array, default: () => [] },
  tags: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  preview: { type: Object, default: () => ({ items: [] }) },
})
defineEmits(['cancel', 'save', 'delete'])

const form = reactive({ name_es: '', name_pt: '', ...props.model })
watch(() => props.model, (v) => Object.assign(form, v), { deep: true })

const footer = computed(() => {
  if (!form.id) return '保存后返回列表，需要统一确认发布才会同步 App。'
  return form.status === 'published'
    ? '已启用 · 返回后需要统一确认发布才会同步 App。'
    : '已停用 · 返回后需要统一确认发布才会同步 App。'
})
const emptyCopy = computed(() => {
  if (form.mode === 'manual') return '尚未选择语录。点击上方语录选项后，所选内容会立即显示在这里。'
  if ((form.conditions || []).length) return '当前标签条件没有匹配到语录，请调整标签或条件关系。'
  return '尚未选择标签。选择标签后，符合条件的语录会立即显示在这里。'
})

defineExpose({ form })
</script>
