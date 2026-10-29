<!--
  后台标签选择器：可搜索、单选/多选。样式走 Element Plus。
-->
<template>
  <el-select
    :model-value="modelValue"
    :multiple="multiple"
    filterable
    clearable
    :placeholder="placeholder"
    style="width: 100%"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-option
      v-for="opt in options"
      :key="opt.name"
      :label="opt.name"
      :value="opt.name"
    >
      <div class="cms-option">
        <span>{{ opt.name }}</span>
        <span class="cms-option-code">{{ selectedSet.has(opt.name) ? '已选择' : (opt.code || '') }}</span>
      </div>
    </el-option>
    <template #empty>{{ emptyText }}</template>
  </el-select>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [Array, String], default: () => [] },
  options: { type: Array, default: () => [] },
  multiple: { type: Boolean, default: false },
  placeholder: { type: String, default: '请选择' },
  emptyText: { type: String, default: '没有匹配标签，请先到标签库新建' },
})
const emit = defineEmits(['update:modelValue'])

  const selectedSet = computed(() => {
  const v = props.multiple
    ? (Array.isArray(props.modelValue) ? props.modelValue : [])
    : (props.modelValue ? [props.modelValue] : [])
  return new Set(v)
})
</script>
