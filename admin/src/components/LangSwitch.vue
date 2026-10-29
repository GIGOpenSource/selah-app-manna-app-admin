<template>
  <el-tabs
    :model-value="modelValue"
    class="lang-tabs"
    @tab-change="emit('update:modelValue', $event)"
  >
    <el-tab-pane label="英语" name="en" />
    <el-tab-pane label="西语" name="es" />
    <el-tab-pane label="葡萄牙语" name="pt" />
  </el-tabs>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: 'en' },
})
const emit = defineEmits(['update:modelValue'])
</script>

<style>
.lang-tabs {
  width: max-content;
  flex: none;
}
.lang-tabs.el-tabs {
  --el-tabs-header-height: 32px;
}
.lang-tabs .el-tabs__header {
  margin: 0;
}
.lang-tabs .el-tabs__content {
  display: none;
}
.lang-tabs .el-tabs__nav-wrap::after {
  display: none;
}
.lang-tabs .el-tabs__item {
  height: 32px;
  padding: 0 16px;
  font-size: 14px;
  line-height: 32px;
}
.lang-tabs .el-tabs__item.is-active {
  font-weight: 600;
}
</style>
