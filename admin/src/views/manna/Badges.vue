<!--
  徽章定义 CRUD。门槛数字 / 启用 / 三维可改；不发币、不撤销。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">徽章</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="code" label="代码" width="150" />
      <el-table-column prop="title" label="标题" min-width="150" />
      <el-table-column label="规则" min-width="180">
        <template #default="{ row }">
          <span>{{ ruleSummary(row.rule) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="隐藏" width="80">
        <template #default="{ row }">
          <el-tag v-if="isHidden(row.rule)" type="warning" size="small">是</el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
      <el-table-column prop="app_key" label="App名" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '空维' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" min-width="100" width="100">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="enabled" label="启用" min-width="90" width="90">
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

    <el-dialog v-model="visible" :title="form.id ? '编辑徽章' : '新建徽章'" width="640px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="代码"><el-input v-model="form.code" placeholder="first_amen" /></el-form-item>
        <el-form-item label="标题"><el-input v-model="form.title" placeholder="First Amen" /></el-form-item>
        <el-form-item label="图标URL"><el-input v-model="form.icon_url" /></el-form-item>
        <el-form-item label="达标键">
          <el-select v-model="ruleKey" style="width: 100%" @change="syncRuleJson">
            <el-option v-for="k in RULE_KEYS" :key="k.value" :label="k.label" :value="k.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="门槛">
          <el-input-number v-model="ruleTarget" :min="1" :max="9999" @change="syncRuleJson" />
        </el-form-item>
        <el-form-item label="隐藏章">
          <el-switch v-model="ruleHidden" @change="syncRuleJson" />
          <span class="field-hint">未获得只显示剪影，不写标准。全库建议 ≤2 枚。</span>
        </el-form-item>
        <el-form-item label="跳转路径">
          <el-input v-model="ruleCta" placeholder="空则按达标键默认功课页" @change="syncRuleJson" />
        </el-form-item>
        <el-form-item label="规则 JSON">
          <el-input v-model="ruleText" type="textarea" :rows="4" placeholder='{"amen_count":1}' @blur="parseRuleJson" />
          <span class="field-hint">一条只认一个达标键。改门槛数字即可，禁止发币 / 撤销 / 付费买章。已获徽章改高门槛不倒扣。</span>
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
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchBadgeDefs, saveBadgeDef } from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../../utils/scopeParams'
import { LANG_OPTIONS } from '../../utils/enumZh'

const RULE_KEYS = [
  { value: 'amen_count', label: 'amen_count · Amen 次数' },
  { value: 'morning_prayer', label: 'morning_prayer · 晨祷次数' },
  { value: 'night_prayer', label: 'night_prayer · 晚祷次数' },
  { value: 'quiz_count', label: 'quiz_count · 测验局数（含失败）' },
  { value: 'quiz_level', label: 'quiz_level · 已通关最大关卡' },
  { value: 'devotion_sessions', label: 'devotion_sessions · 灵修课时' },
  { value: 'story_unlocks', label: 'story_unlocks · 故事卡解锁' },
  { value: 'bible_read_days', label: 'bible_read_days · 读经满额天数' },
  { value: 'practice_days', label: 'practice_days · 功课天数' },
  { value: 'practice_streak', label: 'practice_streak · 连续功课日（历史最高）' },
  { value: 'return_after_gap_days', label: 'return_after_gap_days · 漏做后归回（隐藏章）' },
]
const STAT_KEY_SET = new Set(RULE_KEYS.map((k) => k.value))

const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const ruleText = ref('{}')
const ruleKey = ref('amen_count')
const ruleTarget = ref(1)
const ruleHidden = ref(false)
const ruleCta = ref('')

function isHidden(rule) {
  return !!(rule && rule.hidden)
}

function ruleSummary(rule) {
  if (!rule || typeof rule !== 'object') return '—'
  const key = RULE_KEYS.find((k) => k.value in rule)?.value
  if (!key) return JSON.stringify(rule)
  const bits = [`${key}:${rule[key]}`]
  if (rule.hidden) bits.push('hidden')
  return bits.join(' · ')
}

function applyRuleFields(rule) {
  const obj = rule && typeof rule === 'object' ? { ...rule } : {}
  const key = RULE_KEYS.find((k) => k.value in obj)?.value || 'amen_count'
  ruleKey.value = key
  ruleTarget.value = Math.max(1, parseInt(obj[key], 10) || 1)
  ruleHidden.value = !!obj.hidden
  ruleCta.value = String(obj.cta_path || '')
}

function buildRule() {
  let prev = {}
  try {
    prev = JSON.parse(ruleText.value || '{}')
  } catch (e) {
    prev = (form.value && form.value.rule && typeof form.value.rule === 'object')
      ? { ...form.value.rule }
      : {}
  }
  const obj = {}
  Object.keys(prev).forEach((k) => {
    if (!STAT_KEY_SET.has(k) && k !== 'hidden' && k !== 'cta_path') obj[k] = prev[k]
  })
  const key = STAT_KEY_SET.has(ruleKey.value) ? ruleKey.value : 'amen_count'
  obj[key] = Math.max(1, parseInt(ruleTarget.value, 10) || 1)
  if (ruleHidden.value) obj.hidden = true
  const cta = String(ruleCta.value || '').trim()
  if (cta) obj.cta_path = cta
  return obj
}

function syncRuleJson() {
  ruleText.value = JSON.stringify(buildRule(), null, 2)
}

function parseRuleJson() {
  try {
    const obj = JSON.parse(ruleText.value || '{}')
    applyRuleFields(obj)
    syncRuleJson()
  } catch (e) {
    /* keep textarea as typed until save validates */
  }
}

function onScopeChange() {
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const res = await fetchBadgeDefs({
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
      currentPage: page.value,
      pageSize: 20,
    })
    rows.value = res.results || []
    total.value = res.pagination?.total || 0
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function open(row) {
  form.value = row
    ? { ...row }
    : {
        code: '',
        title: '',
        icon_url: '',
        rule: { amen_count: 1 },
        sort_order: 0,
        enabled: true,
        app_key: defaultCreateAppKey(),
        language: language.value || '',
        platform: platform.value || '',
      }
  applyRuleFields(form.value.rule || {})
  syncRuleJson()
  visible.value = true
}

async function save() {
  if (!(form.value.code || '').trim() || !(form.value.title || '').trim()) {
    ElMessage.warning('请填写代码与标题')
    return
  }
  try {
    form.value.rule = JSON.parse(ruleText.value || '{}')
  } catch (e) {
    ElMessage.warning('规则 JSON 无效')
    return
  }
  const keys = Object.keys(form.value.rule || {}).filter((k) => STAT_KEY_SET.has(k))
  if (!keys.length) {
    ElMessage.warning('请选择一个达标键')
    return
  }
  try {
    await saveBadgeDef({ ...form.value, app_key: defaultCreateAppKey() })
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await ElMessageBox.confirm('确认删除该徽章？已发放记录不会回滚。', '提示', { type: 'warning' })
    await saveBadgeDef({ delete_id: id })
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
.field-hint { margin-left: 8px; color: #999; font-size: 12px; }
</style>
