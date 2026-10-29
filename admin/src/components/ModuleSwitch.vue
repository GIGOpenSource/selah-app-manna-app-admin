<!--
  内容模块内切换：话语内容（语录 / 肯定话语模板）、主题与壁纸。
-->
<template>
  <el-tabs
    class="module-switch"
    :model-value="route.path"
    @tab-change="onChange"
  >
    <el-tab-pane
      v-for="tab in tabs"
      :key="tab.path"
      :label="tab.label"
      :name="tab.path"
    />
  </el-tabs>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'

defineProps({
  tabs: { type: Array, required: true },
})

const route = useRoute()
const router = useRouter()

function onChange(path) {
  if (path && path !== route.path) router.push(path)
}
</script>

<style scoped>
.module-switch {
  margin: 0 0 8px;
}
.module-switch :deep(.el-tabs__header) {
  margin-bottom: 8px;
}
.module-switch :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.module-switch :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 600;
}
</style>
