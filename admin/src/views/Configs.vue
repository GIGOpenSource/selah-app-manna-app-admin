<!--
  其他配置：带 App×语言×设备 的 KV 规则列表（browse）。
-->
<template>
  <div class="container">
    <p class="plugins-tips">
      未被专用页接管的零散配置。空维=看全部维度行；新建时可选择 App / 语言 / 设备 / 优先级。
      同维同键多优先级时，App 单读取数字更大者。
    </p>
    <ScopeFilter
      mode="browse"
      v-model:app-key="appKey"
      v-model:language="language"
      v-model:platform="platform"
      @change="load"
    />
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">其他配置</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column label="配置项" min-width="200">
        <template #default="{ row }">
          <div class="key-cell">
            <span class="key-zh">{{ configKeyZh(row.key) }}</span>
            <span class="key-en">{{ row.key }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="app_key" label="App" width="90">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="80">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" width="90">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" width="80" />
      <el-table-column label="值" min-width="240">
        <template #default="{ row }">
          <el-switch
            v-if="isBoolConfig(row.key)"
            :model-value="asBool(row.edit)"
            @change="(v) => { row.edit = v }"
          />
          <el-input-number
            v-else-if="isNumberConfig(row.key)"
            :model-value="asNumber(row.edit)"
            @change="(v) => { row.edit = v }"
            style="width: 180px"
          />
          <el-input
            v-else
            v-model="row.edit"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
          />
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" width="140" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="save(row)">保存</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="visible" title="新建配置" width="560px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="配置键" required>
          <el-input v-model="form.key" placeholder="如 custom_flag" />
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="form.edit" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" />
        </el-form-item>
        <el-form-item label="App">
          <el-select v-model="form.app_key" filterable style="width: 100%">
            <el-option label="全部 App" value="" />
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="form.platform" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="create">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchConfigs, saveConfig, deleteConfigPack } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import {
  configKeyZh, BOOL_CONFIG_KEYS, NUMBER_CONFIG_KEYS, parseConfigEdit,
  APP_KEYS, LANG_OPTIONS,
} from '../utils/enumZh'

const OWNED = [
  'ai_provider', 'ai_model', 'ai_temperature', 'ai_timeout', 'ai_system_prompt', 'vip_daily_quota',
  'ai_greeting',
  'newcomer_bonus', 'checkin_reward', 'free_quota_cap', 'checkin_auto_popup', 'newcomer_like_goal',
  'newcomer_intro_title', 'newcomer_intro_body', 'newcomer_done_text', 'newcomer_congrats_text',
  'streak_miss_reset_days', 'streak_heart_initial', 'streak_heart_max',
  'streak_heart_refill_every', 'streak_heart_refill_amount', 'like_soft_signal', 'trial_days',
  'cold_start_interest_ratio', 'cold_start_ops_ratio',
  'brand_name', 'legal_entity_name', 'support_email',
  'url_privacy', 'url_terms', 'url_subscription', 'url_help', 'url_download',
  'url_instagram', 'url_tiktok', 'url_facebook',
  'legal_body_privacy', 'legal_body_terms', 'legal_body_subscription', 'legal_body_help', 'legal_body_download',
  'vip_benefits', 'vip_cta_text', 'iap_sandbox_allowed', 'welcome_enabled',
  'trial_intro_enabled', 'selah_2_0_features_enabled',
]

function isOwned(key) {
  if (OWNED.includes(key)) return true
  if (key.startsWith('safety_cat_') || key.startsWith('ai_refuse_') || key === 'ai_crisis_footer') return true
  if (key.startsWith('iap_')) return true
  if (key.startsWith('manna_') || key === 'versecard_brand' || key === 'share_text_template'
    || key === 'home_embed_quiz_manna_reward' || key === 'stats_card_enabled') return true
  return false
}

const appKey = ref('')
const language = ref('')
const platform = ref('')
const rows = ref([])
const loading = ref(false)
const visible = ref(false)
const form = ref({})

function isBoolConfig(key) {
  return BOOL_CONFIG_KEYS.has(key) || (String(key).startsWith('safety_cat_') && String(key).endsWith('_enabled'))
}

function isNumberConfig(key) {
  return NUMBER_CONFIG_KEYS.has(key)
}

function asBool(edit) {
  if (typeof edit === 'boolean') return edit
  const s = String(edit).trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes'
}

function asNumber(edit) {
  const n = Number(edit)
  return Number.isFinite(n) ? n : 0
}

async function load() {
  loading.value = true
  try {
    const res = await fetchConfigs({
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
    })
    rows.value = (res.results || [])
      .filter((r) => !isOwned(r.key))
      .map((r) => ({
        ...r,
        edit: (typeof r.value === 'object' && r.value !== null && !isBoolConfig(r.key))
          ? JSON.stringify(r.value)
          : r.value,
      }))
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function open() {
  form.value = {
    key: '',
    edit: '',
    remark: '',
    app_key: defaultCreateAppKey(appKey.value),
    language: language.value || '',
    platform: platform.value || '',
    priority: 0,
  }
  visible.value = true
}

async function create() {
  const key = String(form.value.key || '').trim()
  if (!key) {
    ElMessage.warning('请填写配置键')
    return
  }
  if (isOwned(key)) {
    ElMessage.warning('该键已由专用页管理，请到对应页面编辑')
    return
  }
  try {
    const value = parseConfigEdit(key, form.value.edit)
    await saveConfig(key, value, form.value.remark || '', {
      app_key: form.value.app_key || '',
      language: form.value.language || '',
      platform: form.value.platform || '',
      priority: Number(form.value.priority) || 0,
    })
    ElMessage.success('已创建')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function save(row) {
  const value = parseConfigEdit(row.key, row.edit)
  try {
    await saveConfig(row.key, value, row.remark || '', {
      app_key: row.app_key || '',
      language: row.language || '',
      platform: row.platform || '',
      priority: Number(row.priority) || 0,
    })
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.key}？`, '提示', { type: 'warning' })
    await deleteConfigPack([row.key], {
      app_key: row.app_key || '',
      language: row.language || '',
      platform: row.platform || '',
      priority: Number(row.priority) || 0,
    })
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.key-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;
}
.key-zh {
  color: #191919;
  font-weight: 600;
}
.key-en {
  color: #8a8a8a;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-all;
}
.plugins-tips {
  margin: 0 0 12px;
  color: #666;
  font-size: 13px;
  line-height: 1.5;
}
</style>
