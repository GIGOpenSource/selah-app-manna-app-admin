<!--
  Onboarding 题目：按App × 语言 × 设备维护多套问卷（含 2.0 扩展题）。
-->
<template>
  <div class="container">
    <p class="plugins-tips">
      引导题按 <strong>App × 语言 × 设备</strong> 分套配置；空维=不过滤（看全部），选具体维才精确筛。
      App 按用户 system_lang / platform 回退选最匹配一套。
      2.0 扩展题 key 默认可运营开启；多选选项勾选「多选」或填入推荐枚举（含 type=multi）。
    </p>
    <ScopeFilter
      mode="browse"
      v-model:app-key="appKey"
      v-model:language="language"
      v-model:platform="platform"
      @change="onScopeChange"
    />
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">Onboarding 题目</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建题目</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column label="Key" min-width="220">
        <template #default="{ row }">
          <div class="key-cell">
            <span class="key-zh">{{ keyLabel(row.question_key) }}</span>
            <span class="key-en">{{ row.question_key }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" />
      <el-table-column prop="app_key" label="App" width="90">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="80">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" width="90">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="sort_order" label="顺序" width="80" />
      <el-table-column label="选项" min-width="200">
        <template #default="{ row }">
          <div v-if="(row.options || []).length" class="opt-preview">
            <span
              v-for="(o, i) in (row.options || []).slice(0, 4)"
              :key="i"
              class="opt-chip"
              :title="o.value"
            >{{ optValueZh(o.value, row.question_key) }}</span>
            <span v-if="(row.options || []).length > 4" class="opt-more">+{{ (row.options || []).length - 4 }}</span>
          </div>
          <span v-else class="opt-empty">0</span>
        </template>
      </el-table-column>
      <el-table-column prop="enabled" label="启用" width="80">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="pagination"
      background
      layout="total, prev, pager, next, jumper"
      :total="total"
      v-model:current-page="page"
      @current-change="load"
    />

    <el-dialog v-model="visible" title="题目" width="720px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="Key">
          <el-select v-model="form.question_key" filterable style="width: 100%" placeholder="选择题目 Key">
            <el-option
              v-for="k in keyPresets"
              :key="k.value"
              :label="`${k.label}（${k.value}）`"
              :value="k.value"
            />
          </el-select>
          <div v-if="form.question_key" class="key-hint">{{ keyLabel(form.question_key) }} · 机器名勿随意改</div>
        </el-form-item>
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="App">
          <el-select v-model="form.app_key" filterable style="width: 100%">
            <el-option label="全局（两 App 可见）" value="" />
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" filterable style="width: 100%">
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
        <el-form-item label="顺序"><el-input-number v-model="form.sort_order" /></el-form-item>
        <el-form-item label="选项">
          <div class="opts">
            <p class="opts-tip">
              <template v-if="allowCustomOptions">
                标准项：从枚举选<strong>数据名</strong>（对照中文），右侧<strong>展示文案</strong>可改字符串。
                自定义项：两侧都手输字符串（数据名建议 <code>snake_case</code>）。
              </template>
              <template v-else>
                本题为 1.0 硬枚举（<code>{{ form.question_key }}</code>），App 提交会校验白名单，
                <strong>不支持自定义数据名</strong>。只能选标准项；右侧展示文案可改字符串。
              </template>
            </p>
            <div class="opt-head">
              <span class="opt-h-value">{{ allowCustomOptions ? '数据名' : '数据名（标准）' }}</span>
              <span class="opt-h-label">展示文案（字符串）</span>
              <span class="opt-h-multi">多选</span>
              <span class="opt-h-act" />
            </div>
            <div v-for="(opt, idx) in options" :key="opt.uid" class="opt-row">
              <template v-if="opt.mode === 'preset'">
                <el-select
                  v-model="opt.value"
                  class="opt-value"
                  filterable
                  placeholder="选标准数据名"
                  @change="onPresetValuePick(opt)"
                >
                  <el-option
                    v-for="p in presetOptionsForKey"
                    :key="p.value"
                    :label="`${optValueZh(p.value, form.question_key)}（${p.value}）`"
                    :value="p.value"
                  />
                </el-select>
              </template>
              <template v-else>
                <el-input
                  v-model="opt.value"
                  class="opt-value"
                  clearable
                  placeholder="数据名字符串，如 quiet_time"
                />
              </template>

              <el-input
                v-model="opt.label"
                class="opt-label"
                clearable
                placeholder="展示给用户的文案字符串"
              />
              <el-checkbox v-model="opt.multi" class="opt-multi">多选</el-checkbox>
              <el-button link type="danger" @click="options.splice(idx, 1)">删</el-button>
            </div>
            <div class="opt-actions">
              <el-button size="small" @click="addPresetOption">+ 标准选项</el-button>
              <el-button
                size="small"
                :disabled="!allowCustomOptions"
                @click="addCustomOption"
              >+ 自定义选项</el-button>
              <el-button size="small" text @click="fillPreset">填入本题推荐枚举</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchOnboarding, saveOnboarding, fetchContentEnums } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { ONBOARDING_KEY_ZH, APP_KEYS, LANG_OPTIONS } from '../utils/enumZh'

/** Key → 中文对照（对齐后端 ONBOARDING_KEYS） */
const KEY_LABEL_ZH = ONBOARDING_KEY_ZH

/** 选项 value → 中文（按题 key 优先，避免同 value 歧义） */
const OPTION_VALUE_ZH_BY_KEY = {
  faith_type: {
    new: '新约取向',
    old: '旧约取向',
    other: '其他',
    learning: '探索中 / 学习中',
    exploring: '探索中（旧值→learning）',
  },
  prayer_frequency: {
    daily: '每天',
    weekly: '每周',
    occasionally: '偶尔',
    just_started: '刚开始',
  },
  interest_tags: {
    prayer: '祷告',
    family: '家庭',
    anxiety: '焦虑缓解',
    gratitude: '感恩',
    courage: '勇气',
    work: '工作与使命',
    peace: '平安',
    hope: '盼望',
    relationships: '人际关系',
    healing: '医治',
  },
  acquisition_channel: {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    friend: '朋友推荐',
    search: '搜索',
    store: '应用商店',
    other: '其他',
  },
  emotion_status: {
    single: '单身',
    dating: '恋爱中',
    married: '已婚',
    prefer_not: '不愿透露',
  },
  faith_transition: {
    growing: '成长中',
    returning: '回归中',
    exploring: '探索中',
    steady: '稳定',
  },
  scripture_familiarity: {
    new: '初识经文',
    some: '有一些了解',
    deep: '很熟悉',
  },
  faith_practice: {
    prayer: '祷告',
    study: '查经',
    community: '团契/社群',
    other: '其他',
  },
  closeness_to_god: {
    close: '亲近',
    seeking: '寻求中',
    distant: '疏远',
  },
  denomination_pref: {
    none: '无偏好',
    protestant: '新教',
    catholic: '天主教',
    orthodox: '东正教',
    other: '其他',
  },
  habit_help_style: {
    reminders: '提醒',
    streaks: '连续打卡',
    community: '社群',
    quiet: '安静默想',
  },
  relationship_with_god: {
    friend: '朋友',
    father: '天父',
    guide: '引导者',
    mystery: '奥秘',
  },
  recent_feeling: {
    peaceful: '平静',
    anxious: '焦虑',
    grateful: '感恩',
    tired: '疲惫',
    hopeful: '有盼望',
  },
  current_struggle: {
    anxiety: '焦虑',
    loneliness: '孤独',
    work: '工作',
    family: '家庭',
    faith: '信仰疑惑',
  },
  current_goal: {
    peace: '更多平安',
    prayer: '更深祷告',
    habits: '每日习惯',
    healing: '医治',
    purpose: '人生目标',
  },
}

const OPTION_VALUE_ZH_FALLBACK = {
  prefer_not: '不愿透露',
  female: '女',
  male: '男',
  non_binary: '非二元',
  u18: '18 岁以下',
  '18-24': '18–24',
  '25-34': '25–34',
  '35-44': '35–44',
  '45-54': '45–54',
  '55+': '55+',
}

const appKey = ref('')
const language = ref('')
const platform = ref('')
const keyPresets = ref([])
const presets = ref({})
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const options = ref([])
let _optUid = 1
function nextOptUid() {
  _optUid += 1
  return `opt_${_optUid}`
}

/** 1.0 列字段：complete 接口硬校验枚举，自定义 value 会被 400 */
const LOCKED_OPTION_KEYS = new Set(['faith_type', 'prayer_frequency', 'interest_tags'])

const allowCustomOptions = computed(() => {
  const k = form.value.question_key
  if (!k || k === 'basic_info') return false
  return !LOCKED_OPTION_KEYS.has(k)
})

const presetOptionsForKey = computed(() => {
  const list = presets.value[form.value.question_key] || []
  return list.map((o) => ({
    value: o.value,
    label: o.label || o.value,
    multi: o.type === 'multi' || !!o.multi,
  }))
})

function keyLabel(key) {
  const k = String(key || '').trim()
  if (!k) return '—'
  return KEY_LABEL_ZH[k] || keyPresets.value.find((x) => x.value === k)?.label || k
}

function optValueZh(value, questionKey) {
  const v = String(value || '').trim()
  if (!v) return '—'
  const qk = questionKey || form.value.question_key
  const scoped = OPTION_VALUE_ZH_BY_KEY[qk]
  if (scoped && scoped[v]) return scoped[v]
  if (OPTION_VALUE_ZH_FALLBACK[v]) return OPTION_VALUE_ZH_FALLBACK[v]
  return v
}

function isKnownValue(value, questionKey) {
  const v = String(value || '').trim()
  if (!v) return false
  const qk = questionKey || form.value.question_key
  const list = presets.value[qk] || []
  if (list.some((o) => o.value === v)) return true
  return !!(OPTION_VALUE_ZH_BY_KEY[qk] && OPTION_VALUE_ZH_BY_KEY[qk][v])
}

function normalizeOptRow(o, questionKey) {
  const value = o.value || ''
  const locked = LOCKED_OPTION_KEYS.has(questionKey)
  const known = isKnownValue(value, questionKey)
  return {
    uid: nextOptUid(),
    mode: locked || known ? 'preset' : 'custom',
    value,
    label: o.label || '',
    multi: o.type === 'multi' || !!o.multi,
  }
}

function onPresetValuePick(opt) {
  const hit = presetOptionsForKey.value.find((p) => p.value === opt.value)
  if (hit) {
    if (!opt.label || opt.label === hit.label) {
      opt.label = hit.label
    }
    opt.multi = !!hit.multi || opt.multi
  }
}

function addPresetOption() {
  const first = presetOptionsForKey.value[0]
  if (!first) {
    ElMessage.info(form.value.question_key === 'basic_info'
      ? 'basic_info 无需选项，由 App 渲染称呼/性别/年龄'
      : (allowCustomOptions.value
        ? '本题暂无标准枚举，请用「自定义选项」手输数据名'
        : '本题无标准枚举且不支持自定义'))
    return
  }
  options.value.push({
    uid: nextOptUid(),
    mode: 'preset',
    value: first.value,
    label: first.label,
    multi: !!first.multi,
  })
}

function addCustomOption() {
  if (!allowCustomOptions.value) {
    ElMessage.warning(
      `「${keyLabel(form.value.question_key)}」不支持自定义数据名（App 会按固定枚举校验）。请改展示文案，或换 2.0 扩展题。`,
    )
    return
  }
  options.value.push({
    uid: nextOptUid(),
    mode: 'custom',
    value: '',
    label: '',
    multi: false,
  })
}

function cacheKey() {
  return `onboarding_questions_${appKey.value || ''}_${language.value || ''}_${platform.value || ''}_p${page.value}`
}

function onScopeChange() {
  load(1)
}

function mergeKeyPresets(data) {
  const a = data.onboarding_keys || []
  const b = data.onboarding_keys_2_0 || []
  const seen = new Set()
  const out = []
  for (const k of [...a, ...b]) {
    if (!k?.value || seen.has(k.value)) continue
    seen.add(k.value)
    out.push({
      value: k.value,
      label: KEY_LABEL_ZH[k.value] || k.label || k.value,
    })
  }
  for (const [value, label] of Object.entries(KEY_LABEL_ZH)) {
    if (seen.has(value) || value === 'legacy_disabled' || value === 'display_basics' || value === 'age_range') continue
    seen.add(value)
    out.push({ value, label })
  }
  return out
}

async function loadEnums() {
  await loadWithCache('onboarding_enums_v3', async () => {
    const res = await fetchContentEnums()
    const data = res.results || {}
    return {
      keyPresets: mergeKeyPresets(data),
      presets: data.onboarding_presets || {},
    }
  }, (data) => {
    keyPresets.value = data.keyPresets || []
    presets.value = data.presets || {}
  })
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    await loadWithCache(cacheKey(), async () => {
      const res = await fetchOnboarding({
        ...browseScopeParams({
          appKey: appKey.value,
          language: language.value,
          platform: platform.value,
        }),
        currentPage: page.value,
        pageSize: 20,
      })
      return {
        rows: res.results || [],
        total: res.pagination?.total || (res.results || []).length,
      }
    }, (data) => {
      rows.value = data.rows || []
      total.value = data.total || 0
    })
  } finally {
    loading.value = false
  }
}

function open(row) {
  form.value = row
    ? { ...row }
    : {
        question_key: 'faith_type',
        title: '',
        sort_order: 0,
        enabled: true,
        options: [],
        app_key: defaultCreateAppKey(appKey.value),
        language: language.value || '',
        platform: platform.value || '',
      }
  const qk = form.value.question_key
  options.value = (form.value.options || []).map((o) => normalizeOptRow(o, qk))
  visible.value = true
}

function fillPreset() {
  const list = presets.value[form.value.question_key]
  if (!list) {
    ElMessage.info(form.value.question_key === 'basic_info'
      ? 'basic_info 由 App 渲染称呼/性别/年龄，无需选项'
      : '当前 Key 无推荐枚举')
    return
  }
  options.value = list.map((o) => ({
    uid: nextOptUid(),
    mode: 'preset',
    value: o.value || '',
    label: o.label || '',
    multi: o.type === 'multi' || !!o.multi,
  }))
}

async function save() {
  const qk = form.value.question_key
  if (LOCKED_OPTION_KEYS.has(qk)) {
    const badCustom = options.value.find((o) => o.mode === 'custom' || !isKnownValue(o.value, qk))
    if (badCustom && String(badCustom.value || '').trim()) {
      ElMessage.warning(`「${keyLabel(qk)}」只能使用标准数据名，请删掉自定义项或改回标准枚举`)
      return
    }
  }
  const cleaned = []
  for (const o of options.value) {
    const value = (o.value || '').trim()
    const label = (o.label || '').trim()
    if (!value && !label) continue
    if (!value) {
      ElMessage.warning('请填写数据名（value），空项已跳过前请补全')
      return
    }
    if (!label) {
      ElMessage.warning(`数据名「${value}」缺少展示文案`)
      return
    }
    if (/\s/.test(value)) {
      ElMessage.warning(`数据名不要含空格：${value}`)
      return
    }
    const item = { value, label }
    if (o.multi) item.type = 'multi'
    cleaned.push(item)
  }
  form.value.options = cleaned
  form.value.language = form.value.language || ''
  form.value.platform = form.value.platform || ''
  try {
    await saveOnboarding(form.value)
    ElMessage.success('已保存')
    visible.value = false
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await ElMessageBox.confirm('确认删除该题目？', '提示', { type: 'warning' })
    await saveOnboarding({ delete_id: id })
    ElMessage.success('已删除')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(async () => {
  await Promise.all([loadEnums(), load()])
})
</script>

<style scoped>
.plugins-tips {
  margin: 0 0 12px;
  color: #666;
  font-size: 13px;
  line-height: 1.5;
}
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
}
.key-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #8a8a8a;
}
.opts {
  width: 100%;
}
.opts-tip {
  margin: 0 0 10px;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}
.opts-tip code {
  font-size: 12px;
  background: #f5f5f5;
  padding: 0 4px;
  border-radius: 4px;
}
.opt-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #8a8a8a;
}
.opt-h-value { width: 240px; flex-shrink: 0; }
.opt-h-label { flex: 1; }
.opt-h-multi { width: 52px; flex-shrink: 0; text-align: center; }
.opt-h-act { width: 36px; flex-shrink: 0; }
.opt-row {
  display: flex;
  margin-bottom: 8px;
  align-items: center;
  gap: 8px;
}
.opt-value { width: 240px; flex-shrink: 0; }
.opt-label { flex: 1; min-width: 120px; }
.opt-multi { width: 52px; flex-shrink: 0; margin-right: 0; }
.opt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.opt-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.opt-chip {
  display: inline-block;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  background: #f5f5f5;
  border-radius: 4px;
  color: #191919;
}
.opt-more {
  font-size: 12px;
  color: #8a8a8a;
  line-height: 20px;
}
.opt-empty {
  color: #8a8a8a;
}
</style>
