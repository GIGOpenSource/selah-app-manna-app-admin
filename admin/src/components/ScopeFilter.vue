<!--
  配置维度筛选：App × 语言 × 设备。
  mode=exact（默认）：空=精确全局行（ops / ColdStart）。
  mode=browse：空=不限/不过滤（内容库列表）。
-->
<template>
  <div class="scope-filter">
    <span class="label">配置维度</span>
    <el-select
      :model-value="appKey"
      clearable
      filterable
      :placeholder="isBrowse ? 'App（空=不限）' : 'App（空=全局行）'"
      style="width: 160px"
      @update:model-value="onApp"
    >
      <el-option :label="isBrowse ? '不限 App' : '全局 App（空维）'" value="" />
      <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
    </el-select>
    <el-select
      :model-value="language"
      clearable
      filterable
      :placeholder="isBrowse ? '语言（空=不限）' : '语言（空=全局行）'"
      style="width: 180px; margin-left: 12px"
      @update:model-value="onLang"
    >
      <el-option :label="isBrowse ? '不限语言' : '全局语言（空维）'" value="" />
      <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
    </el-select>
    <el-select
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
 * 配置维度筛选：app_key × language × platform。
 * exact：空串写/筛全局行；browse：空=省略参数看全部。
 */
import { computed } from 'vue'
import { APP_KEYS, LANG_OPTIONS } from '../utils/enumZh'

const props = defineProps({
  /** 应用标识；'' = 全局或不限（视 mode） */
  appKey: { type: String, default: '' },
  /** 语言码；'' = 全局或不限 */
  language: { type: String, default: '' },
  /** 设备平台 ios/android；'' = 全局或不限 */
  platform: { type: String, default: '' },
  /** exact=精确全局行（默认）；browse=空维不过滤 */
  mode: { type: String, default: 'exact', validator: (v) => ['exact', 'browse'].includes(v) },
})

const emit = defineEmits(['update:appKey', 'update:language', 'update:platform', 'change'])

const isBrowse = computed(() => props.mode === 'browse')

const emptyAppLabel = computed(() => (isBrowse.value ? '不限 App' : '全局 App'))
const emptyLangLabel = computed(() => (isBrowse.value ? '不限语言' : '全局语言'))
const emptyPlatLabel = computed(() => (isBrowse.value ? '不限设备' : '全局设备'))

/** 展示文案：空值按 mode 显示「不限」或「全局」 */
const scopeLabel = computed(() => {
  const app = !props.appKey ? emptyAppLabel.value : props.appKey
  const langItem = LANG_OPTIONS.find((l) => l.value === props.language)
  const lang = !props.language ? emptyLangLabel.value : (langItem?.label || props.language)
  const plat = props.platform === '' || props.platform == null ? emptyPlatLabel.value : props.platform
  return `${app} × ${lang} × ${plat}`
})

const hintText = computed(() => {
  if (isBrowse.value) {
    return `当前筛选：${scopeLabel.value} · 空维=不过滤看全部；选具体维才精确筛`
  }
  return `当前编辑：${scopeLabel.value} · 空维=精确全局行；App 端按 app×语言×设备回退`
})

function onApp(v) {
  emit('update:appKey', v == null ? '' : String(v).trim().toLowerCase())
  emit('change')
}
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
  margin-bottom: 16px;
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
