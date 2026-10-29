<!--
  配置维度筛选：语言 × 设备。App 由顶栏全局切换，本组件只同步、不再选手动 App。
  mode=exact（默认）：空=精确全局行（ops / ColdStart）。
  mode=browse：空=不限/不过滤（内容库列表）。
-->
<template>
  <div class="scope-filter">
    <span class="label">配置维度</span>
    <el-select
      :model-value="language"
      clearable
      filterable
      :placeholder="isBrowse ? '语言（空=不限）' : '语言（空=全局行）'"
      style="width: 180px"
      @update:model-value="onLang"
    >
      <el-option :label="isBrowse ? '不限语言' : '全局语言（空维）'" value="" />
      <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
    </el-select>
    <el-select
      v-if="showPlatform"
      :model-value="platform"
      clearable
      :placeholder="isBrowse ? '设备（空=不限）' : '设备（空=全局行）'"
      style="width: 160px; margin-left: 12px"
      @update:model-value="onPlat"
    >
      <el-option :label="isBrowse ? '不限设备' : '全局设备（空维）'" value="" />
      <el-option label="iOS" value="ios" />
      <el-option label="Android" value="android" />
    </el-select>
    <span class="hint">{{ hintText }}</span>
  </div>
</template>

<script setup>
/**
 * 配置维度筛选：app_key 跟顶栏；language × platform 本页可筛。
 * exact：空串写/筛全局行；browse：空=省略参数看全部。
 */
import { computed, onMounted, watch } from 'vue'
import { LANG_OPTIONS } from '../utils/enumZh'
import { currentAppKey, getAdminProduct, shouldHidePlatform } from '../utils/productContext'

const props = defineProps({
  /** 应用标识；空时由顶栏当前 App 锁定 */
  appKey: { type: String, default: '' },
  language: { type: String, default: '' },
  platform: { type: String, default: '' },
  mode: { type: String, default: 'exact', validator: (v) => ['exact', 'browse'].includes(v) },
  keepPlatform: { type: Boolean, default: false },
})

const emit = defineEmits(['update:appKey', 'update:language', 'update:platform', 'change'])

const isBrowse = computed(() => props.mode === 'browse')
const lockedApp = computed(() => getAdminProduct() || props.appKey || 'selah')
const showPlatform = computed(() => !shouldHidePlatform(props.keepPlatform))

function syncLockedApp() {
  if (props.appKey !== lockedApp.value) {
    emit('update:appKey', lockedApp.value)
  }
}

onMounted(syncLockedApp)

watch(currentAppKey, () => {
  syncLockedApp()
  emit('change')
})

const emptyLangLabel = computed(() => (isBrowse.value ? '不限语言' : '全局语言'))
const emptyPlatLabel = computed(() => (isBrowse.value ? '不限设备' : '全局设备'))

const hintText = computed(() => {
  const app = lockedApp.value
  const langItem = LANG_OPTIONS.find((l) => l.value === props.language)
  const lang = !props.language ? emptyLangLabel.value : (langItem?.label || props.language)
  const plat = showPlatform.value
    ? (props.platform === '' || props.platform == null ? emptyPlatLabel.value : props.platform)
    : '全部设备'
  return `当前范围：${app} × ${lang} × ${plat} · App 在顶栏切换`
})
/** 语言变更：clearable 清空时归一为 ''，再通知父页刷新 */
function onLang(v) {
  emit('update:language', v == null ? '' : v)
  emit('change')
}
/** 平台变更：同上 */
function onPlat(v) {
  emit('update:platform', v == null ? '' : v)
  emit('change')
}
</script>

<style scoped>
.scope-filter {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 24px 0;
  padding: 12px 14px;
  background: #f7f8fc;
  border-radius: 8px;
}
.label {
  font-size: 13px;
  color: #606266;
  margin-right: 4px;
}
.hint {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
