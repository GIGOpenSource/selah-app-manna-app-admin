<template>
  <div class="container">
    <div class="pro-toolbar">
      <div>
        <div class="pro-toolbar-title">编辑壁纸合集：{{ form.name_en }}</div>
        <p class="cms-hint">直接选择具体壁纸，或映射隐性标签对应的壁纸；保存后返回外层统一发布。</p>
      </div>
    </div>
    <div class="pro-form-pad">
      <InclusionFields
        v-model:mode="form.mode"
        v-model:match="form.match"
        v-model:conditions="form.conditions"
        v-model:manual-ids="form.manual_ids"
        :applicable-types="applicableTypes"
        :tags="tags"
        :items="items"
        wallpaper
        auto-label="映射隐性标签对应的壁纸"
        manual-label="直接选择具体壁纸"
        manual-title="手动选择壁纸"
        manual-copy="点击带预览图的壁纸卡片，下方实时汇总已选内容。"
      />
      <div class="cms-editor-foot">
        <span class="cms-editor-state">修改后需返回外层统一确认发布</span>
        <div>
          <el-button @click="$emit('cancel')">返回</el-button>
          <el-button type="primary" @click="$emit('save')">保存合集内容</el-button>
        </div>
      </div>
    </div>
    <MatchPreview
      wallpaper
      :title="form.mode === 'manual' ? '已选择壁纸预览' : '标签匹配壁纸预览'"
      :copy="form.mode === 'manual'
        ? '随上方勾选实时更新；已停用壁纸也会保留显示，便于核对收录范围。'
        : `按“${form.match === 'all' ? '同时满足全部条件' : '满足任一条件'}”实时计算；橙色标签表示当前命中的收录条件。`"
      :count-text="form.mode === 'manual' ? `已选择 ${preview.items.length} 张壁纸` : `当前匹配 ${preview.items.length} 张壁纸`"
      :items="preview.items"
      :empty="emptyCopy"
    />
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import InclusionFields from './InclusionFields.vue'
import MatchPreview from './MatchPreview.vue'

const props = defineProps({
  model: { type: Object, required: true },
  applicableTypes: { type: Array, default: () => [] },
  tags: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  preview: { type: Object, default: () => ({ items: [] }) },
})
defineEmits(['cancel', 'save'])

const form = reactive({ ...props.model })
watch(() => props.model, (v) => Object.assign(form, v), { deep: true })

const emptyCopy = computed(() => {
  if (form.mode === 'manual') return '尚未选择壁纸。点击上方带预览图的壁纸卡片后，所选内容会立即显示在这里。'
  if ((form.conditions || []).length) return '当前标签条件没有匹配到壁纸，请调整标签或条件关系。'
  return '尚未选择标签。选择标签后，符合条件的壁纸会立即显示在这里。'
})

defineExpose({ form })
</script>
