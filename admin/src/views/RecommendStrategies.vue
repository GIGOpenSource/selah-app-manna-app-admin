<!--
  命中策略（推荐 v2）：完整 action 分区表单 + Raw JSON；默认策略不可删不可关。
-->
<template>
  <div>
    <div class="container">
      <ScopeFilter
        mode="browse"
        v-model:app-key="appKey"
        v-model:language="language"
        v-model:platform="platform"
        @change="load"
      />
      <div class="pro-toolbar">
        <div class="pro-toolbar-title">命中策略</div>
        <div class="pro-toolbar-actions">
          <el-button :loading="upgrading" @click="onUpgradeDefault">升级默认策略为 v2</el-button>
          <el-button :loading="seeding" @click="onSeedTest">填充测试策略</el-button>
          <el-button type="primary" @click="openCreate">新建策略</el-button>
        </div>
      </div>
      <p class="plugins-tips">
        数字大的优先级先试；适用但没货试下一条。默认策略保底，不能删除或关闭。
        action.version=2 时走推荐 v2（召回占比 / 打分因子 / 冷启等）；关闭
        <code>action.enabled</code> 或全局 <code>recommend_v2_enabled</code> 回退旧 70/30。
      </p>

      <el-alert
        v-if="listTip"
        class="mgb12"
        type="warning"
        show-icon
        :closable="false"
        :title="listTip"
      />

      <el-empty
        v-if="!loading && !rows.length"
        description="暂无策略，请升级默认策略、填充测试策略或新建"
      >
        <el-button type="primary" @click="onUpgradeDefault">升级默认策略为 v2</el-button>
      </el-empty>

      <el-table v-else :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="名称" width="180" />
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column label="默认" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.is_default" type="warning" size="small">默认</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="v2" width="70">
          <template #default="{ row }">
            <el-tag v-if="isV2(row.action)" :type="row.action?.enabled === false ? 'info' : 'success'" size="small">
              {{ row.action?.enabled === false ? '关' : '开' }}
            </el-tag>
            <span v-else class="sub">旧</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" min-width="90" width="90">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :disabled="row.is_default"
              @change="(v) => toggleEnabled(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="条件" min-width="240">
          <template #default="{ row }">{{ formatConds(row.conditions) }}</template>
        </el-table-column>
        <el-table-column label="范围" width="180">
          <template #default="{ row }">
            {{ row.app_key || '全部' }} / {{ row.language || '全部' }} / {{ row.platform || '全部' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" :disabled="row.is_default" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="visible"
      :title="form.id ? '编辑策略' : '新建策略'"
      width="920px"
      top="4vh"
      destroy-on-close
      class="strategy-dialog"
    >
      <el-form label-width="120px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" :min="0" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" :disabled="form.is_default" />
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部语言" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="form.platform" style="width: 100%">
            <el-option label="全部设备" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!form.is_default" label="条件字段" required>
          <el-select v-model="condField" style="width: 100%" @change="onCondFieldChange">
            <el-option
              v-for="f in COND_FIELDS"
              :key="f.value"
              :label="f.label"
              :value="f.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!form.is_default" label="条件值" required>
          <el-select
            v-model="condValue"
            filterable
            style="width: 100%"
            :placeholder="condValuePlaceholder"
          >
            <el-option
              v-for="o in condValueOptions"
              :key="String(o.value)"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" />
        </el-form-item>

        <el-divider content-position="left">总控</el-divider>
        <el-form-item label="v2 引擎">
          <el-switch v-model="action.enabled" />
          <span class="hint">关闭后本策略 Feed 回退旧逻辑</span>
        </el-form-item>
        <el-form-item label="候选上限">
          <el-input-number v-model="action.candidate_limit" :min="100" :max="20000" :step="100" />
        </el-form-item>
        <el-form-item label="写快照">
          <el-switch v-model="action.write_snapshot" />
        </el-form-item>

        <el-divider content-position="left">打分因子</el-divider>
        <p class="section-tip">关闭 = 该维中性不进分；权重 0≈关闭，1=完整，&gt;1 放大偏离（慎用）</p>
        <el-table :data="scoreFactorRows" size="small" class="mgb12" border>
          <el-table-column prop="label" label="名称" width="160" />
          <el-table-column label="启用" width="90">
            <template #default="{ row }">
              <el-switch v-model="action.score_factors[row.key].enabled" @change="syncJsonFromAction" />
            </template>
          </el-table-column>
          <el-table-column label="权重 (0～2)">
            <template #default="{ row }">
              <div class="slider-row">
                <el-slider
                  v-model="action.score_factors[row.key].weight"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  :show-tooltip="true"
                  @change="syncJsonFromAction"
                />
                <span class="slider-val">{{ Number(action.score_factors[row.key].weight).toFixed(1) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="desc" label="说明" min-width="180" />
        </el-table>

        <el-divider content-position="left">正式召回占比</el-divider>
        <p class="section-tip" :class="{ warn: !recallSumOk }">
          建议之和 ≈ 1（当前 {{ recallSum.toFixed(2) }}）
        </p>
        <el-form-item v-for="r in RECALL_FIELDS" :key="r.key" :label="r.label">
          <div class="slider-row wide">
            <el-slider
              v-model="action.recall[r.key]"
              :min="0"
              :max="1"
              :step="0.01"
              @change="syncJsonFromAction"
            />
            <el-input-number
              v-model="action.recall[r.key]"
              :min="0"
              :max="1"
              :step="0.01"
              :precision="2"
              size="small"
              @change="syncJsonFromAction"
            />
          </div>
        </el-form-item>

        <el-divider content-position="left">冷启动</el-divider>
        <el-form-item label="曝光阈值">
          <el-input-number v-model="action.cold_start.max_exposes" :min="0" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="行为阈值">
          <el-input-number v-model="action.cold_start.max_actions" :min="0" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="毕业曝光">
          <el-input-number v-model="action.cold_start.graduate_exposes" :min="0" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="毕业行为">
          <el-input-number v-model="action.cold_start.graduate_actions" :min="0" @change="syncJsonFromAction" />
        </el-form-item>
        <p class="section-tip" :class="{ warn: !coldRatioSumOk }">
          形式占比建议之和 ≈ 1（当前 {{ coldRatioSum.toFixed(2) }}）
        </p>
        <el-form-item v-for="c in COLD_RATIO_FIELDS" :key="c.key" :label="c.label">
          <div class="slider-row wide">
            <el-slider
              v-model="action.cold_start[c.key]"
              :min="0"
              :max="1"
              :step="0.01"
              @change="syncJsonFromAction"
            />
            <el-input-number
              v-model="action.cold_start[c.key]"
              :min="0"
              :max="1"
              :step="0.01"
              :precision="2"
              size="small"
              @change="syncJsonFromAction"
            />
          </div>
        </el-form-item>

        <el-divider content-position="left">重排</el-divider>
        <el-form-item label="主题连续上限">
          <el-input-number v-model="action.rerank.max_theme_streak" :min="0" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="内容连续上限">
          <el-input-number v-model="action.rerank.max_content_streak" :min="0" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="场景连续上限">
          <el-input-number v-model="action.rerank.max_scenario_streak" :min="0" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="负向情绪连续">
          <el-input-number v-model="action.rerank.max_negative_emotion_streak" :min="0" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="探索比">
          <el-input-number
            v-model="action.rerank.explore_ratio"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            @change="syncJsonFromAction"
          />
        </el-form-item>

        <el-divider content-position="left">硬过滤 / 重复</el-divider>
        <el-form-item label="排除 Prayer">
          <el-switch v-model="action.hard_filter.exclude_prayer" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="排除已举报">
          <el-switch v-model="action.hard_filter.exclude_reported" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="重复窗口(天)">
          <el-input-number v-model="action.repeat.window_days" :min="1" :max="90" @change="syncJsonFromAction" />
        </el-form-item>
        <el-form-item label="重复系数">
          <el-input
            v-model="repeatCoefsText"
            placeholder="如 1.0, 0.7, 0.4, 0.0"
            @change="onRepeatCoefsChange"
          />
        </el-form-item>

        <el-divider content-position="left">高级（JSON）</el-divider>
        <el-form-item label="高级块">
          <el-input
            v-model="advancedJson"
            type="textarea"
            :rows="6"
            placeholder='可选：time_rules / preference / quality_weights / freshness'
            @blur="onAdvancedBlur"
          />
        </el-form-item>

        <el-divider content-position="left">Raw action JSON</el-divider>
        <div class="raw-toolbar">
          <el-button size="small" @click="resetActionFromSchema">从 schema 重置</el-button>
          <el-button size="small" @click="syncJsonFromAction">表单 → JSON</el-button>
          <el-button size="small" type="primary" plain @click="applyJsonToAction(true)">JSON → 表单</el-button>
        </div>
        <el-input
          v-model="actionJson"
          type="textarea"
          :rows="12"
          class="mono"
          @blur="applyJsonToAction(false)"
        />
        <p v-if="jsonError" class="json-err">{{ jsonError }}</p>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchRecommendStrategies,
  fetchRecommendStrategySchema,
  upgradeRecommendStrategyDefault,
  saveRecommendStrategy,
  deleteRecommendStrategy,
  seedRecommendTestStrategies,
  fetchLibraryTags,
} from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import {
  LANG_OPTIONS,
  FAITH_TYPE_OPTIONS,
  PRAYER_FREQ_OPTIONS,
  FAITH_TAG_ZH,
  PRAYER_FREQ_ZH,
} from '../utils/enumZh'

const COND_FIELDS = [
  { value: 'faith_type', label: '信仰类型' },
  { value: 'prayer_frequency', label: '祷告频率' },
  { value: 'interest_tags', label: '主主题包含' },
  { value: 'onboarding_skipped', label: '已跳过引导' },
]

const FIELD_LABEL = Object.fromEntries(COND_FIELDS.map((f) => [f.value, f.label]))

const SKIP_OPTIONS = [
  { value: true, label: '是（已跳过）' },
  { value: false, label: '否（未跳过）' },
]

const RECALL_FIELDS = [
  { key: 'strong_pref', label: '强偏好' },
  { key: 'adjacent', label: '相邻标签' },
  { key: 'time', label: '时间' },
  { key: 'festival', label: '节日' },
  { key: 'quality', label: '质量' },
  { key: 'explore', label: '探索' },
]

const COLD_RATIO_FIELDS = [
  { key: 'bible_verse', label: '经文' },
  { key: 'encouragement', label: '鼓励' },
  { key: 'quote', label: '语录' },
  { key: 'prayer', label: '祷告' },
  { key: 'time', label: '时间' },
  { key: 'explore', label: '探索' },
]

const SCORE_FACTOR_META = [
  { key: 'base_quality', label: '基础质量', desc: '关闭用中性质量分' },
  { key: 'user_preference', label: '用户偏好(标签)', desc: '标签偏好乘性因子' },
  { key: 'time_scene', label: '时间场景', desc: '晨晚等时间加权' },
  { key: 'freshness', label: '新鲜度', desc: '内容新旧' },
  { key: 'repeat_exposure', label: '重复曝光', desc: '关闭不再按近7天≥3次过滤' },
]

const FALLBACK_ACTION = {
  version: 2,
  enabled: true,
  candidate_limit: 2000,
  recall: {
    strong_pref: 0.3,
    adjacent: 0.2,
    time: 0.15,
    festival: 0.1,
    quality: 0.1,
    explore: 0.15,
  },
  cold_start: {
    max_exposes: 10,
    max_actions: 5,
    graduate_exposes: 20,
    graduate_actions: 5,
    bible_verse: 0.15,
    encouragement: 0.13,
    quote: 0.12,
    prayer: 0.1,
    time: 0.3,
    explore: 0.2,
  },
  rerank: {
    max_theme_streak: 2,
    max_content_streak: 3,
    max_scenario_streak: 2,
    explore_ratio: 0.15,
    max_negative_emotion_streak: 1,
  },
  hard_filter: {
    exclude_prayer: true,
    exclude_reported: true,
  },
  repeat: {
    window_days: 7,
    coefs: [1.0, 0.7, 0.4, 0.0],
  },
  score_factors: {
    base_quality: { enabled: true, weight: 1.0 },
    user_preference: { enabled: true, weight: 1.0 },
    time_scene: { enabled: true, weight: 1.0 },
    freshness: { enabled: true, weight: 1.0 },
    repeat_exposure: { enabled: true, weight: 1.0 },
  },
  write_snapshot: true,
}

const ADVANCED_KEYS = ['time_rules', 'preference', 'quality_weights', 'freshness']

const themeOptions = ref([])
const rows = ref([])
const loading = ref(false)
const seeding = ref(false)
const upgrading = ref(false)
const saving = ref(false)
const listTip = ref('')
const appKey = ref('')
const language = ref('')
const platform = ref('')
const visible = ref(false)
const form = ref({})
const condField = ref('faith_type')
const condValue = ref('')
const schemaAction = ref(null)
const actionJson = ref('')
const advancedJson = ref('{}')
const jsonError = ref('')
const repeatCoefsText = ref('1.0, 0.7, 0.4, 0.0')

const action = reactive(cloneAction(FALLBACK_ACTION))

const scoreFactorRows = SCORE_FACTOR_META

const condValueOptions = computed(() => {
  if (condField.value === 'faith_type') return FAITH_TYPE_OPTIONS
  if (condField.value === 'prayer_frequency') return PRAYER_FREQ_OPTIONS
  if (condField.value === 'interest_tags') return themeOptions.value
  if (condField.value === 'onboarding_skipped') return SKIP_OPTIONS
  return []
})

const condValuePlaceholder = computed(() => {
  if (condField.value === 'faith_type') return '选择信仰类型'
  if (condField.value === 'prayer_frequency') return '选择祷告频率'
  if (condField.value === 'interest_tags') return '选择标签库主主题'
  return '选择是否跳过'
})

const recallSum = computed(() => sumObj(action.recall, RECALL_FIELDS.map((f) => f.key)))
const recallSumOk = computed(() => Math.abs(recallSum.value - 1) <= 0.02)

const coldRatioSum = computed(() => sumObj(action.cold_start, COLD_RATIO_FIELDS.map((f) => f.key)))
const coldRatioSumOk = computed(() => Math.abs(coldRatioSum.value - 1) <= 0.02)

function cloneAction(src) {
  return JSON.parse(JSON.stringify(src || FALLBACK_ACTION))
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch ?? base
  const out = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v)
    } else {
      out[k] = v
    }
  }
  return out
}

function sumObj(obj, keys) {
  return keys.reduce((s, k) => s + (Number(obj?.[k]) || 0), 0)
}

function isV2(act) {
  return act && (act.version === 2 || act.recall || act.score_factors)
}

function ensureActionShape(raw) {
  const merged = deepMerge(FALLBACK_ACTION, raw && typeof raw === 'object' ? raw : {})
  merged.version = 2
  for (const f of SCORE_FACTOR_META) {
    if (!merged.score_factors[f.key]) {
      merged.score_factors[f.key] = { enabled: true, weight: 1.0 }
    }
  }
  return merged
}

function assignAction(next) {
  const shaped = ensureActionShape(next)
  Object.keys(action).forEach((k) => delete action[k])
  Object.assign(action, shaped)
  repeatCoefsText.value = (shaped.repeat?.coefs || []).join(', ')
  const adv = {}
  for (const k of ADVANCED_KEYS) {
    if (shaped[k] !== undefined) adv[k] = shaped[k]
  }
  advancedJson.value = JSON.stringify(adv, null, 2)
  syncJsonFromAction()
}

function syncJsonFromAction() {
  const payload = buildActionPayload()
  actionJson.value = JSON.stringify(payload, null, 2)
  jsonError.value = ''
}

function buildActionPayload() {
  const payload = cloneAction(action)
  payload.version = 2
  for (const k of ADVANCED_KEYS) {
    if (payload[k] === undefined) delete payload[k]
  }
  try {
    const adv = JSON.parse(advancedJson.value || '{}')
    if (adv && typeof adv === 'object') {
      for (const k of ADVANCED_KEYS) {
        if (adv[k] !== undefined) payload[k] = adv[k]
        else delete payload[k]
      }
    }
  } catch {
    /* keep existing advanced keys on action */
  }
  return payload
}

function applyJsonToAction(notify = false) {
  try {
    const parsed = JSON.parse(actionJson.value || '{}')
    if (!parsed || typeof parsed !== 'object') throw new Error('须为对象')
    assignAction(parsed)
    jsonError.value = ''
    if (notify) ElMessage.success('已应用到表单')
  } catch (e) {
    jsonError.value = e.message || 'JSON 无效'
  }
}

function onAdvancedBlur() {
  try {
    const adv = JSON.parse(advancedJson.value || '{}')
    if (!adv || typeof adv !== 'object') throw new Error('高级块须为对象')
    for (const k of ADVANCED_KEYS) {
      if (adv[k] !== undefined) action[k] = adv[k]
      else delete action[k]
    }
    syncJsonFromAction()
    jsonError.value = ''
  } catch (e) {
    jsonError.value = `高级 JSON：${e.message}`
  }
}

function onRepeatCoefsChange() {
  const parts = String(repeatCoefsText.value || '')
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
  if (!parts.length || parts.some((n) => Number.isNaN(n))) {
    ElMessage.warning('重复系数格式无效')
    return
  }
  action.repeat.coefs = parts
  syncJsonFromAction()
}

function valueZh(field, value) {
  if (field === 'faith_type') return FAITH_TAG_ZH[value] || FAITH_TAG_ZH[String(value)] || value
  if (field === 'prayer_frequency') return PRAYER_FREQ_ZH[value] || value
  if (field === 'interest_tags') return value
  if (field === 'onboarding_skipped') return value === true || value === 'true' || value === 1 ? '是' : '否'
  return value
}

function formatConds(conds) {
  if (!conds || !conds.length) return '无条件'
  return conds.map((c) => {
    const fl = FIELD_LABEL[c.field] || c.field
    const vl = valueZh(c.field, c.value)
    return `${fl} = ${vl}`
  }).join(' 且 ')
}

function scopeParams() {
  return browseScopeParams({
    appKey: appKey.value,
    language: language.value,
    platform: platform.value,
  })
}

function onCondFieldChange() {
  condValue.value = ''
}

async function loadSchema() {
  try {
    const res = await fetchRecommendStrategySchema()
    const data = res.results || res.data || res
    const act = data.action || data
    schemaAction.value = ensureActionShape(act)
  } catch {
    schemaAction.value = cloneAction(FALLBACK_ACTION)
  }
}

function resetActionFromSchema() {
  assignAction(schemaAction.value || FALLBACK_ACTION)
  ElMessage.success('已从 schema 重置 action')
}

async function loadThemes() {
  try {
    const res = await fetchLibraryTags({ type: 'theme', enabled: 1, currentPage: 1, pageSize: 200 })
    const list = res.results || []
    const arr = Array.isArray(list) ? list : []
    themeOptions.value = arr.map((t) => ({ value: t.name, label: t.name }))
  } catch {
    themeOptions.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const res = await fetchRecommendStrategies(scopeParams())
    const data = res.results || {}
    rows.value = data.list || (Array.isArray(data) ? data : [])
    listTip.value = data.tip || ''
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function onUpgradeDefault() {
  upgrading.value = true
  try {
    await upgradeRecommendStrategyDefault({ enabled: true })
    ElMessage.success('默认策略已升级为 v2')
    await load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '升级失败')
  } finally {
    upgrading.value = false
  }
}

async function onSeedTest() {
  seeding.value = true
  try {
    const res = await seedRecommendTestStrategies(scopeParams())
    const data = res.results || {}
    const n = (data.created || []).length
    const skip = (data.skipped || []).length
    ElMessage.success(`已填充 ${n} 条测试策略${skip ? `，跳过已存在 ${skip} 条` : ''}`)
    if (data.tip) listTip.value = data.tip
    await load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '填充失败')
  } finally {
    seeding.value = false
  }
}

function openCreate() {
  form.value = {
    name: '',
    priority: 10,
    enabled: true,
    is_default: false,
    app_key: defaultCreateAppKey(),
    language: language.value || '',
    platform: platform.value || '',
    remark: '',
  }
  condField.value = 'faith_type'
  condValue.value = ''
  assignAction(schemaAction.value || FALLBACK_ACTION)
  visible.value = true
}

function openEdit(row) {
  form.value = { ...row }
  const c0 = (row.conditions || [])[0] || {}
  condField.value = c0.field || 'faith_type'
  let v = c0.value
  if (condField.value === 'onboarding_skipped') {
    v = v === true || v === 'true' || v === 1 || v === '1'
  }
  condValue.value = v ?? ''
  assignAction(isV2(row.action) ? row.action : deepMerge(schemaAction.value || FALLBACK_ACTION, row.action || {}))
  visible.value = true
}

async function save() {
  if (!form.value.is_default && (condValue.value === '' || condValue.value === null || condValue.value === undefined)) {
    ElMessage.warning('请选择条件值')
    return
  }
  if (!recallSumOk.value) {
    try {
      await ElMessageBox.confirm(
        `正式召回占比之和为 ${recallSum.value.toFixed(2)}，建议 ≈ 1。仍要保存？`,
        '占比校验',
        { type: 'warning' },
      )
    } catch {
      return
    }
  }
  if (!coldRatioSumOk.value) {
    try {
      await ElMessageBox.confirm(
        `冷启形式占比之和为 ${coldRatioSum.value.toFixed(2)}，建议 ≈ 1。仍要保存？`,
        '占比校验',
        { type: 'warning' },
      )
    } catch {
      return
    }
  }

  let actionPayload
  try {
    actionPayload = JSON.parse(actionJson.value || '{}')
    actionPayload = ensureActionShape(actionPayload)
  } catch (e) {
    ElMessage.error(`action JSON 无效：${e.message}`)
    return
  }

  const payload = {
    ...form.value,
    app_key: defaultCreateAppKey(),
    conditions: form.value.is_default
      ? []
      : [{
          field: condField.value,
          op: condField.value === 'interest_tags' ? 'contains' : 'eq',
          value: condField.value === 'onboarding_skipped' ? !!condValue.value : condValue.value,
        }],
    action: actionPayload,
  }
  saving.value = true
  try {
    await saveRecommendStrategy(payload)
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(row, v) {
  try {
    await saveRecommendStrategy({ ...row, enabled: !!v })
    load()
  } catch (e) {
    ElMessage.error(e.message || '更新失败')
    load()
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`删除策略「${row.name}」？`, '确认')
    await deleteRecommendStrategy(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}

onMounted(async () => {
  await Promise.all([loadThemes(), loadSchema()])
  await load()
})
</script>

<style scoped>
.mgb12 { margin-bottom: 12px; }
.pro-toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.sub { color: #909399; font-size: 12px; }
.hint { margin-left: 12px; color: #909399; font-size: 12px; }
.section-tip { margin: -4px 0 12px 120px; color: #909399; font-size: 12px; }
.section-tip.warn { color: #e6a23c; }
.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.slider-row.wide { max-width: 520px; }
.slider-row .el-slider { flex: 1; }
.slider-val { width: 36px; text-align: right; font-variant-numeric: tabular-nums; }
.raw-toolbar { display: flex; gap: 8px; margin-bottom: 8px; }
.mono :deep(textarea) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
.json-err { color: #f56c6c; font-size: 12px; margin-top: 6px; }
code { font-size: 12px; background: #f4f4f5; padding: 1px 4px; border-radius: 3px; }
</style>
