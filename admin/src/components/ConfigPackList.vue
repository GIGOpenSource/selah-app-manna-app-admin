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
      <el-table-column prop="app_key" label="App" width="100">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="90">
        <template #default="{ row }">{{ langLabel(row.language) }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" width="90">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" width="80" />
      <el-table-column label="摘要" min-width="220">
        <template #default="{ row }">
          <slot name="summary" :pack="row">{{ defaultSummary(row) }}</slot>
        </template>
      </el-table-column>
      <el-table-column label="键数" width="70">
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
      :title="editing ? '编辑配置包' : '新建配置包'"
      :width="dialogWidth"
      destroy-on-close
      append-to-body
    >
      <el-form label-width="140px">
        <el-form-item label="App">
          <el-select v-model="form.app_key" filterable :disabled="editing" style="width: 100%">
            <el-option label="全部 App" value="" />
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" :disabled="editing" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="form.platform" :disabled="editing" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" :disabled="editing" />
          <span class="hint">同维冲突时数字大优先；App 只读一条时取最大</span>
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
import { APP_KEYS, LANG_OPTIONS } from '../utils/enumZh'

const props = defineProps({
  title: { type: String, default: '配置' },
  tips: {
    type: String,
    default: '空维=不过滤（看全部包）；同维可多优先级并存，App 单读取数字更大者。',
  },
  keys: { type: Array, required: true },
  defaults: { type: Object, default: () => ({}) },
  remark: { type: String, default: '' },
  dialogWidth: { type: String, default: '640px' },
  /** 可选：从 meta 生成顶栏提示（如 AI Key 状态） */
  metaHintFn: { type: Function, default: null },
  /** 摘要列用到的优先键 */
  summaryKeys: { type: Array, default: () => [] },
  /** 保存前校验；返回错误文案则中止 */
  validateFn: { type: Function, default: null },
})

const emit = defineEmits(['loaded'])

const filterApp = ref('')
const filterLang = ref('')
const filterPlat = ref('')
const loading = ref(false)
const saving = ref(false)
const packs = ref([])
const meta = ref({})
const visible = ref(false)
const editing = ref(false)
const form = ref({})

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
    form.value = {
      app_key: row.app_key || '',
      language: row.language || '',
      platform: row.platform || '',
      priority: Number(row.priority) || 0,
      ...cloneDefaults(),
      ...cloneValues(row.values),
    }
  } else {
    editing.value = false
    form.value = {
      app_key: defaultCreateAppKey(filterApp.value),
      language: filterLang.value || '',
      platform: filterPlat.value || '',
      priority: 0,
      ...cloneDefaults(),
    }
  }
  visible.value = true
}

async function save() {
  const scope = {
    app_key: form.value.app_key || '',
    language: form.value.language || '',
    platform: form.value.platform || '',
    priority: Number(form.value.priority) || 0,
  }
  const sk = scopeKey(scope.app_key, scope.language, scope.platform, scope.priority)
  if (!editing.value && packs.value.some((p) => scopeKey(p.app_key, p.language, p.platform, p.priority) === sk)) {
    ElMessage.warning('该维度+优先级已有配置包，请直接编辑或先删除')
    return
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
    for (const k of props.keys) {
      let val = form.value[k]
      if (val === undefined) val = props.defaults[k] ?? null
      if (Array.isArray(val)) val = val.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => x !== '')
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
  margin-bottom: 12px;
}
.plugins-tips {
  margin: 0 0 12px;
  color: #666;
  font-size: 13px;
  line-height: 1.5;
}
.hint {
  margin-left: 8px;
  color: #888;
  font-size: 12px;
}
</style>
