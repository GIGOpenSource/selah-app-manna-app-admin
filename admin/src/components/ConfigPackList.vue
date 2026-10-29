<!--
  维度打包配置列表：一行 = App×语言×设备×优先级 一套 keys。
  空维浏览看全部包；弹窗内可选三维+优先级并编辑业务字段（#form slot）。
  硬规则：App 单读同维取 priority 数字更大者。
-->
<template>
  <div>
    <ScopeFilter
      mode="browse"
      v-model:app-key="filterApp"
      v-model:language="filterLang"
      v-model:platform="filterPlat"
      @change="load"
    />
    <p v-if="tips" class="plugins-tips">{{ tips }}</p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">{{ title }}</div>
      <div class="pro-toolbar-actions">
        <slot name="toolbar" :meta="meta" />
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-alert
      v-if="metaHint"
      class="meta-hint"
      type="info"
      :closable="false"
      :title="metaHint"
    />
      <el-table :data="packs" v-loading="loading">
      <el-table-column prop="app_key" label="App" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" min-width="140" width="140">
        <template #default="{ row }">{{ langLabel(row.language) }}</template>
      </el-table-column>
      <el-table-column v-if="showPlatform" prop="platform" label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" min-width="108" width="108" />
      <el-table-column label="摘要" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <slot name="summary" :pack="row">{{ defaultSummary(row) }}</slot>
        </template>
      </el-table-column>
      <el-table-column label="键数" min-width="80" width="80">
        <template #default="{ row }">{{ Object.keys(row.values).length }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="visible"
      class="config-pack-dialog"
      :title="editing ? '编辑配置包' : '新建配置包'"
      :width="dialogWidth"
      destroy-on-close
      append-to-body
      align-center
    >
      <el-form :label-width="labelWidth">
        <el-form-item label="语言">
          <el-select v-model="form.language" :teleported="false" style="width: 100%">
            <el-option label="全部" value="all" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="showPlatform" label="设备">
          <el-select v-model="form.platform" :teleported="false" style="width: 100%">
            <el-option label="全部" value="all" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" />
          <span class="hint">同维冲突时数字大优先；App 只读一条时取最大。编辑时改语言/设备/优先级，保存后整包迁移到新维度</span>
        </el-form-item>
        <el-divider content-position="left">配置内容</el-divider>
        <slot name="form" :form="form" :meta="meta" />
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 维度打包列表：keys 在同一 (app,lang,plat,priority) 下聚合成一行。
 */
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchConfigs, saveConfig, deleteConfigPack } from '../api'
import ScopeFilter from './ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { LANG_OPTIONS } from '../utils/enumZh'
import { getAdminProduct, shouldHidePlatform } from '../utils/productContext'

const props = defineProps({
  title: { type: String, default: '配置' },
  tips: {
    type: String,
    default: '空维=不过滤（看全部包）；同维可多优先级并存，App 单读取数字更大者。',
  },
  keepPlatform: { type: Boolean, default: false },
  keys: { type: Array, required: true },
  defaults: { type: Object, default: () => ({}) },
  remark: { type: String, default: '' },
  dialogWidth: { type: String, default: '640px' },
  /** 弹窗表单 label 宽度；长中文标签页可传 180px */
  labelWidth: { type: String, default: '140px' },
  /** 可选：从 meta 生成顶栏提示（如 AI Key 状态） */
  metaHintFn: { type: Function, default: null },
  /** 摘要列用到的优先键 */
  summaryKeys: { type: Array, default: () => [] },
  /** 保存前校验；返回错误文案则中止 */
  validateFn: { type: Function, default: null },
  /** 新建时默认 App（Manna 页传 manna，避免落到 selah） */
  defaultAppKey: { type: String, default: '' },
  /** 密钥键：列表已掩码，保存时空串/掩码跳过以免覆盖 */
  secretKeys: { type: Array, default: () => [] },
})

const emit = defineEmits(['loaded'])

const filterApp = ref(props.defaultAppKey || '')
const filterLang = ref('')
const filterPlat = ref('')
const loading = ref(false)
const saving = ref(false)
const packs = ref([])
const meta = ref({})
const visible = ref(false)
const editing = ref(false)
/** 编辑时的原始维度；改语言/设备/优先级保存时整包迁移 */
const originalScope = ref(null)
const form = ref({})
const showPlatform = computed(() => !shouldHidePlatform(props.keepPlatform))
const lockedApp = computed(() => getAdminProduct() || 'selah')

const metaHint = computed(() => {
  if (typeof props.metaHintFn === 'function') return props.metaHintFn(meta.value) || ''
  return ''
})

function scopeKey(app, lang, plat, priority = 0) {
  return `${app || ''}\t${lang || ''}\t${plat || ''}\t${Number(priority) || 0}`
}

function langLabel(code) {
  if (!code) return '全部'
  const hit = LANG_OPTIONS.find((l) => l.value === code)
  return hit ? hit.label : code
}

function defaultSummary(pack) {
  const prefer = props.summaryKeys.length ? props.summaryKeys : props.keys.slice(0, 3)
  const parts = []
  for (const k of prefer) {
    const v = pack.values[k]
    if (props.secretKeys.includes(k)) continue
    if (v === undefined || v === null || v === '') continue
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    parts.push(`${k}=${s.length > 40 ? `${s.slice(0, 40)}…` : s}`)
    if (parts.length >= 2) break
  }
  return parts.join(' · ') || '（已配置）'
}

function groupRows(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const pri = Number(r.priority) || 0
    const sk = scopeKey(r.app_key, r.language, r.platform, pri)
    if (!map.has(sk)) {
      map.set(sk, {
        app_key: r.app_key || '',
        language: r.language || '',
        platform: r.platform || '',
        priority: pri,
        values: {},
      })
    }
    map.get(sk).values[r.key] = r.value
  }
  return [...map.values()].sort((a, b) => {
    const ka = scopeKey(a.app_key, a.language, a.platform, a.priority)
    const kb = scopeKey(b.app_key, b.language, b.platform, b.priority)
    return ka.localeCompare(kb)
  })
}

async function load() {
  loading.value = true
  try {
    const res = await fetchConfigs({
      keys: props.keys,
      ...browseScopeParams({
        appKey: filterApp.value,
        language: filterLang.value,
        platform: filterPlat.value,
      }),
    })
    packs.value = groupRows(res.results || [])
    meta.value = res.meta || {}
    emit('loaded', { packs: packs.value, meta: meta.value })
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function cloneDefaults() {
  try {
    return JSON.parse(JSON.stringify(props.defaults || {}))
  } catch {
    return { ...(props.defaults || {}) }
  }
}

function cloneValues(values) {
  try {
    return JSON.parse(JSON.stringify(values || {}))
  } catch {
    return { ...(values || {}) }
  }
}

function open(row) {
  if (row) {
    editing.value = true
    originalScope.value = {
      app_key: row.app_key || '',
      language: row.language || '',
      platform: row.platform || '',
      priority: Number(row.priority) || 0,
    }
    form.value = {
      app_key: row.app_key || '',
      language: row.language || 'all',
      platform: showPlatform.value ? (row.platform || 'all') : 'all',
      priority: Number(row.priority) || 0,
      ...cloneDefaults(),
      ...cloneValues(row.values),
    }
  } else {
    editing.value = false
    originalScope.value = null
    form.value = {
      app_key: defaultCreateAppKey(filterApp.value, props.defaultAppKey),
      language: filterLang.value || 'all',
      platform: showPlatform.value ? (filterPlat.value || 'all') : 'all',
      priority: 0,
      ...cloneDefaults(),
    }
  }
  visible.value = true
}

async function save() {
  const scope = {
    app_key: lockedApp.value,
    language: form.value.language === 'all' ? '' : (form.value.language || ''),
    platform: showPlatform.value ? (form.value.platform === 'all' ? '' : (form.value.platform || '')) : '',
    priority: Number(form.value.priority) || 0,
  }
  const sk = scopeKey(scope.app_key, scope.language, scope.platform, scope.priority)
  const origin = originalScope.value
  const moved = !!(
    editing.value && origin
    && sk !== scopeKey(origin.app_key, origin.language, origin.platform, origin.priority)
  )
  if (!editing.value || moved) {
    if (packs.value.some((p) => scopeKey(p.app_key, p.language, p.platform, p.priority) === sk)) {
      ElMessage.warning('该维度+优先级已有配置包，请直接编辑或先删除')
      return
    }
  }
  if (typeof props.validateFn === 'function') {
    const err = props.validateFn(form.value)
    if (err) {
      ElMessage.warning(err)
      return
    }
  }
  saving.value = true
  try {
    // 维度变更：先删旧维度包再写入新维度，避免旧包残留
    if (moved) {
      await deleteConfigPack(props.keys, origin)
    }
    // Features 等：真开关与 teaser 键对齐
    const mirrors = {
      widget_teaser_enabled: 'widget_enabled',
      app_icon_teaser_enabled: 'app_icon_enabled',
      dynamic_wallpaper_tab_enabled: 'dynamic_wallpaper_enabled',
    }
    for (const [dst, src] of Object.entries(mirrors)) {
      if (props.keys.includes(dst) && props.keys.includes(src) && form.value[src] !== undefined) {
        form.value[dst] = form.value[src]
      }
    }
    for (const k of props.keys) {
      let val = form.value[k]
      if (val === undefined) val = props.defaults[k] ?? null
      if (Array.isArray(val)) val = val.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => x !== '')
      if (props.secretKeys.includes(k)) {
        const s = val == null ? '' : String(val).trim()
        if (!s || s.includes('••••') || /^\*+$/.test(s)) continue
      }
      await saveConfig(k, val, props.remark, scope)
    }
    ElMessage.success('已保存')
    visible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确认删除该维度包？\nApp=${row.app_key || '全部'} × 语言=${langLabel(row.language)} × 设备=${row.platform || '全部'} × 优先级=${Number(row.priority) || 0}`,
      '提示',
      { type: 'warning' },
    )
    await deleteConfigPack(props.keys, {
      app_key: row.app_key || '',
      language: row.language || '',
      platform: row.platform || '',
      priority: Number(row.priority) || 0,
    })
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

watch(() => props.keys, () => load(), { deep: true })

onMounted(load)

defineExpose({ load, open })
</script>

<style scoped>
.meta-hint {
  margin: 0 24px 12px;
}
.hint {
  margin-left: 8px;
  color: #888;
  font-size: 12px;
}
</style>

<style>
.el-overlay-dialog:has(.config-pack-dialog) {
  display: flex;
  align-items: center;
  justify-content: center;
}
.config-pack-dialog.el-dialog {
  margin: 0 auto !important;
  max-height: min(86vh, 880px);
  display: flex;
  flex-direction: column;
}
.config-pack-dialog .el-dialog__body {
  flex: 1;
  overflow-y: auto;
  max-height: min(70vh, 640px);
}
.config-pack-dialog .el-form-item__label {
  line-height: 1.4;
  white-space: normal;
}
</style>
