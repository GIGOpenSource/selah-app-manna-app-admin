<template>
  <el-dialog
    :model-value="modelValue"
    :title="op === 'add' ? '加标签' : '移除标签'"
    width="520px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @open="reset"
  >
    <p class="cms-hint" style="margin-top: 0">
      已选 {{ count }} 条。每次只处理一个一级标签，可反复添加。
      {{ op === 'add' ? '追加后原有标签保留。' : '只去掉勾选的二级标签，其余不动。' }}
    </p>
    <el-form label-width="96px">
      <el-form-item label="一级标签">
        <el-select v-model="typeKey" filterable placeholder="选择一级标签" style="width: 100%" @change="names = []">
          <el-option v-for="t in types" :key="t.key" :label="zhTypeLabel(t)" :value="t.key" />
        </el-select>
      </el-form-item>
      <el-form-item label="二级标签">
        <div v-if="!typeKey" class="cms-hint">先选择一级标签</div>
        <div v-else-if="!options.length" class="cms-hint">这个一级下没有可选的二级标签</div>
        <el-checkbox-group v-else v-model="names" class="batch-tag-options">
          <el-checkbox v-for="tag in options" :key="tag.id || tag.name" :label="tag.name">
            {{ tag.name }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!typeKey || !names.length" @click="apply">
        {{ op === 'add' ? '追加到所选' : '从所选移除' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { zhTypeLabel } from '../utils/tagLibrary'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  op: { type: String, default: 'add' },
  types: { type: Array, default: () => [] },
  tags: { type: Array, default: () => [] },
  count: { type: Number, default: 0 },
})
const emit = defineEmits(['update:modelValue', 'apply'])

const typeKey = ref('')
const names = ref([])

const options = computed(() => (props.tags || []).filter((tag) => {
  if (tag.type !== typeKey.value) return false
  if (props.op === 'add') return !!tag.enabled
  return true
}))

function reset() {
  typeKey.value = ''
  names.value = []
}

function apply() {
  emit('apply', { type: typeKey.value, names: [...names.value] })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.batch-tag-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
</style>
