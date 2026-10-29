<!--
  数据看板：时间区间 + App×语言×设备三维 + 国家码，拉取 overview、DAU、留存、收入等统计。
-->
<template>
  <div>
    <div class="container filter-card">
      <ScopeFilter
        mode="browse"
        v-model:app-key="appKey"
        v-model:language="language"
        v-model:platform="platform"
      />
      <div class="pro-search" style="padding-bottom: 16px">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          :clearable="false"
          style="width: 260px"
        />
        <el-select
          v-model="registerCountry"
          clearable
          filterable
          placeholder="国家"
          style="width: 160px"
        >
          <el-option
            v-for="c in COUNTRY_OPTIONS.filter((x) => x.value !== 'GLOBAL')"
            :key="c.value"
            :label="c.label"
            :value="c.value"
          />
        </el-select>
        <div class="pro-search-actions">
          <el-button type="primary" :loading="loading" @click="reload">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>
    </div>

    <div class="container" style="margin-top: 16px">
      <el-tabs v-model="tab" @tab-change="onTabChange">
        <el-tab-pane label="总览" name="overview" />
        <el-tab-pane label="每日 DAU" name="dau" />
        <el-tab-pane label="每日新增" name="newUsers" />
        <el-tab-pane label="0-30 留存" name="retention" />
        <el-tab-pane v-if="appKey === 'manna'" label="Manna 功课" name="practice" />
        <el-tab-pane v-if="appKey === 'manna'" label="内容打开" name="contentOpens" />
        <el-tab-pane v-if="appKey !== 'manna'" label="每日充值" name="revenue" />
        <el-tab-pane label="地区/设备" name="geo" />
        <el-tab-pane label="语言分布" name="lang" />
        <el-tab-pane v-if="appKey !== 'manna'" label="订单 KPI" name="orders" />
        <el-tab-pane label="页面/按钮" name="events" />
        <el-tab-pane label="激活漏斗" name="activation" />
        <el-tab-pane v-if="appKey !== 'manna'" label="付费漏斗" name="paywall" />
      </el-tabs>

      <div v-loading="loading" class="dash-body">
        <!-- 总览 -->
        <template v-if="tab === 'overview'">
          <div class="kpi-row">
            <div class="kpi-item" v-for="k in kpiCards" :key="k.label">
              <div class="kpi-label">{{ k.label }}</div>
              <div class="kpi-value">{{ k.value }}</div>
            </div>
          </div>
          <div ref="chartRef" class="chart-box" />
        </template>

        <!-- DAU -->
        <el-table v-else-if="tab === 'dau'" :data="dauRows">
          <el-table-column prop="date" label="日期" width="140" />
          <el-table-column prop="count" label="DAU" />
        </el-table>

        <!-- 新增 -->
        <el-table v-else-if="tab === 'newUsers'" :data="newUserRows">
          <el-table-column prop="date" label="日期" width="140" />
          <el-table-column prop="count" label="新增用户" />
        </el-table>

        <!-- 留存：D0–D30 列固定宽度，避免 100.0% 被裁切；横向滚动看全列 -->
        <div v-else-if="tab === 'retention'" class="retention-wrap">
          <p class="retention-hint">左右滑动查看 D0–D30，单元格为当日留存率</p>
          <el-table
            ref="retentionTableRef"
            class="retention-table"
            :data="retentionRows"
            border
            scrollbar-always-on
            :header-cell-style="retentionCellStyle"
            :cell-style="retentionCellStyle"
          >
            <el-table-column prop="cohort_date" label="注册日" width="128" fixed />
            <el-table-column prop="cohort_size" label="人数" width="72" fixed align="center" />
            <el-table-column
              v-for="n in 31"
              :key="n - 1"
              :label="`D${n - 1}`"
              width="88"
              align="center"
            >
              <template #default="{ row }">
                {{ formatRet(row.retention?.[n - 1]) }}
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 充值 -->
        <el-table v-else-if="tab === 'revenue'" :data="revenueRows">
          <el-table-column prop="date" label="日期" width="140" />
          <el-table-column label="成交额">
            <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
          </el-table-column>
          <el-table-column prop="order_count" label="订单数" width="100" />
          <el-table-column prop="payer_count" label="成交用户" width="100" />
        </el-table>

        <!-- 地区设备 -->
        <div v-else-if="tab === 'geo'" class="split-tables">
          <div>
            <div class="pro-toolbar"><div class="pro-toolbar-title">国家分布</div></div>
            <el-table :data="geo.countries || []">
              <el-table-column prop="register_country" label="国家" />
              <el-table-column prop="count" label="用户数" width="120" />
            </el-table>
          </div>
          <div>
            <div class="pro-toolbar"><div class="pro-toolbar-title">设备分布</div></div>
            <el-table :data="geo.devices || []">
              <el-table-column prop="platform" label="设备" />
              <el-table-column prop="count" label="用户数" width="120" />
            </el-table>
          </div>
        </div>

        <!-- 语言 -->
        <el-table v-else-if="tab === 'lang'" :data="langRows">
          <el-table-column prop="system_lang" label="语言" />
          <el-table-column prop="count" label="用户数" width="120" />
        </el-table>

        <!-- 订单 KPI -->
        <el-table v-else-if="tab === 'orders'" :data="orderKpiRows">
          <el-table-column prop="date" label="日期" width="140" />
          <el-table-column prop="order_count" label="订单数" width="90" />
          <el-table-column prop="payer_count" label="成交用户" width="100" />
          <el-table-column prop="dau" label="DAU" width="90" />
          <el-table-column label="付费率" width="100">
            <template #default="{ row }">{{ formatPct(row.pay_rate) }}</template>
          </el-table-column>
          <el-table-column label="ARPPU">
            <template #default="{ row }">{{ formatMoney(row.arppu_cents) }}</template>
          </el-table-column>
          <el-table-column label="成交额">
            <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
          </el-table-column>
        </el-table>

        <!-- Manna 功课 -->
        <template v-else-if="tab === 'practice'">
          <div class="kpi-row">
            <div class="kpi-item" v-for="k in practiceKpiCards" :key="k.label">
              <div class="kpi-label">{{ k.label }}</div>
              <div class="kpi-value">{{ k.value }}</div>
            </div>
          </div>
          <el-table :data="practiceDaily" style="margin-top: 16px">
            <el-table-column prop="date" label="日期" width="140" />
            <el-table-column prop="dau" label="打开 DAU" />
            <el-table-column prop="practice_dau" label="功课 DAU" />
          </el-table>
        </template>

        <!-- 内容打开 -->
        <template v-else-if="tab === 'contentOpens'">
          <p class="retention-hint" style="padding: 8px 24px 0">
            统计各内容被打开的 PV / UV，用于免费产品兴趣筛选；优先看 UV。日期按 UTC。上线前历史可能接近空。
          </p>
          <div class="pro-search" style="padding: 8px 24px 0">
            <el-select
              v-model="contentOpenType"
              clearable
              placeholder="内容类型（空=全部）"
              style="width: 200px"
              @change="reload"
            >
              <el-option label="全部类型" value="" />
              <el-option
                v-for="t in CONTENT_OPEN_TYPES"
                :key="t.value"
                :label="t.label"
                :value="t.value"
              />
            </el-select>
            <el-select v-model="contentOpenLimit" style="width: 120px" @change="reload">
              <el-option :value="20" label="Top 20" />
              <el-option :value="50" label="Top 50" />
              <el-option :value="100" label="Top 100" />
              <el-option :value="200" label="Top 200" />
            </el-select>
            <el-button @click="copyTopUvIds">复制 Top UV ID</el-button>
          </div>
          <div class="kpi-row kpi-row--3">
            <div class="kpi-item" v-for="k in contentOpenKpiCards" :key="k.label">
              <div class="kpi-label">{{ k.label }}</div>
              <div class="kpi-value">{{ k.value }}</div>
            </div>
          </div>
          <div class="pro-toolbar" style="margin-top: 8px">
            <div class="pro-toolbar-title">类型分布（点击筛选）</div>
          </div>
          <el-table :data="contentOpenByType" @row-click="onContentTypeRow">
            <el-table-column label="类型" min-width="160">
              <template #default="{ row }">{{ contentOpenTypeLabel(row.content_type) }}</template>
            </el-table-column>
            <el-table-column prop="content_type" label="标识" min-width="160" />
            <el-table-column prop="uv" label="UV" width="100" sortable />
            <el-table-column prop="pv" label="PV" width="100" sortable />
          </el-table>
          <div class="pro-toolbar" style="margin-top: 16px">
            <div class="pro-toolbar-title">Top 内容（兴趣筛选优先 UV）</div>
          </div>
          <el-table :data="contentOpenItems" :default-sort="{ prop: 'uv', order: 'descending' }">
            <el-table-column label="类型" width="140">
              <template #default="{ row }">{{ contentOpenTypeLabel(row.content_type) }}</template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">{{ row.title || '—' }}</template>
            </el-table-column>
            <el-table-column prop="content_id" label="content_id" min-width="160" show-overflow-tooltip />
            <el-table-column prop="uv" label="UV" width="100" sortable />
            <el-table-column prop="pv" label="PV" width="100" sortable />
          </el-table>
        </template>

        <!-- 事件 -->
        <template v-else-if="tab === 'events'">
          <div class="event-kind-bar">
            <el-input
              v-model="eventNameQuery"
              clearable
              placeholder="搜索 event_name"
              style="width: 240px"
              @keyup.enter="searchEvents"
            />
            <el-select v-model="eventKind" style="width: 140px">
              <el-option label="全部类型" value="all" />
              <el-option label="页面" value="page" />
              <el-option label="按钮" value="button" />
              <el-option label="其他" value="other" />
            </el-select>
            <el-button type="primary" :loading="loading" @click="searchEvents">搜索</el-button>
          </div>
          <el-table :data="eventRows">
            <el-table-column prop="event_label" label="中文名" min-width="180">
              <template #default="{ row }">{{ row.event_label || row.event_name }}</template>
            </el-table-column>
            <el-table-column prop="event_name" label="event_name" min-width="220" />
            <el-table-column prop="kind" label="kind" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="row.kind === 'page' ? 'success' : row.kind === 'button' ? 'warning' : 'info'">
                  {{ kindLabel(row.kind) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="pv" label="PV" width="100" />
            <el-table-column prop="uv" label="UV" width="100" />
          </el-table>
        </template>

        <template v-else-if="tab === 'activation' || tab === 'paywall'">
          <p class="retention-hint" style="padding: 8px 24px 0">
            {{ tab === 'activation'
              ? '区间内触发即计入，不要求严格先后顺序。无上报时各步 UV 为 0。'
              : '购买结果按触发 purchase_flow_result 计 UV，含成功和失败。无上报时各步 UV 为 0。' }}
          </p>
          <div v-if="!(activeFunnel.steps || []).length" class="cms-empty">这个区间还没有漏斗数据</div>
          <div v-else class="funnel">
            <div v-for="(step, index) in activeFunnel.steps" :key="step.step" class="funnel-step">
              <div class="funnel-index">{{ index + 1 }}</div>
              <div class="funnel-main">
                <div class="funnel-head">
                  <strong>{{ step.label }}</strong>
                  <span class="funnel-metrics">UV {{ step.uv ?? 0 }} · PV {{ step.pv ?? 0 }}</span>
                </div>
                <div class="funnel-track">
                  <div class="funnel-bar" :style="{ width: funnelWidth(step) }" />
                </div>
                <div class="funnel-rates">
                  <span>相对上一步 {{ formatPct(step.conversion_from_prev) }}</span>
                  <span>相对起点 {{ formatPct(step.conversion_from_start) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 数据看板脚本：ScopeFilter 三维 + 日期/国家 → 按 Tab 拉取 stats API → 总览 ECharts。
 * 空维不传后端（browse 语义）；language 映射为 system_lang。
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import ScopeFilter from '../components/ScopeFilter.vue'
import {
  fetchStatsOverview,
  fetchStatsDau,
  fetchStatsNewUsers,
  fetchStatsRetention,
  fetchStatsRevenue,
  fetchStatsGeoDevice,
  fetchStatsLanguage,
  fetchStatsOrdersKpi,
  fetchStatsEvents,
  fetchStatsActivationFunnel,
  fetchStatsPaywallFunnel,
  fetchStatsMannaPractice,
  fetchStatsMannaContentOpens,
} from '../api'
import { COUNTRY_OPTIONS } from '../utils/enumZh'

const CONTENT_OPEN_TYPES = [
  { value: 'daily_verse', label: '今日经文' },
  { value: 'prayer', label: '祷告' },
  { value: 'devotion_series', label: '灵修系列' },
  { value: 'devotion_session', label: '灵修课时' },
  { value: 'bible_chapter', label: '圣经章节' },
  { value: 'quiz_level', label: '测验关卡' },
  { value: 'quiz_story', label: '圣经故事' },
  { value: 'wallpaper', label: '壁纸' },
  { value: 'quote', label: '语录' },
]

/** 默认近 30 天（含今天）：from = today-29，ISO 日期字符串 */
function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - 29)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return [fmt(from), fmt(to)]
}

const dateRange = ref(defaultRange())
/** App × 语言 × 设备；空=不限（与内容库 browse 一致） */
const appKey = ref('')
const language = ref('')
const platform = ref('')
/** 国家码（ISO2）；空=不限 */
const registerCountry = ref('')
const tab = ref('overview')
const loading = ref(false)

// ---- 各 Tab 数据源（与 loadTab 分支一一对应）----
const overview = ref(null)       // fetchStatsOverview → kpi + series
const dauRows = ref([])          // fetchStatsDau
const newUserRows = ref([])      // fetchStatsNewUsers
const retentionRows = ref([])    // fetchStatsRetention（cohort × D0~D30）
const revenueRows = ref([])      // fetchStatsRevenue（amount_cents 为分）
const geo = ref({ countries: [], devices: [] }) // fetchStatsGeoDevice
const langRows = ref([])         // fetchStatsLanguage
const orderKpiRows = ref([])     // fetchStatsOrdersKpi
const eventRows = ref([])        // fetchStatsEvents（埋点 UV/PV）
const eventKind = ref('all')
const eventNameQuery = ref('')
const activationFunnel = ref({ steps: [] })
const paywallFunnel = ref({ steps: [] })
const practice = ref(null)
const contentOpens = ref(null)
const contentOpenType = ref('')
const contentOpenLimit = ref(50)

const chartRef = ref(null)
const retentionTableRef = ref(null)
const retentionCellStyle = { padding: '8px 6px' }
let chart = null
let chartRo = null

/**
 * 组装 API 查询参数：日期取自 dateRange；
 * 空筛选转 undefined 避免后端当成空串过滤；国家码强制大写。
 * ScopeFilter.language → stats 的 system_lang（用户系统语言）。
 */
const queryFilters = computed(() => ({
  from: dateRange.value?.[0],
  to: dateRange.value?.[1],
  system_lang: language.value || undefined,
  register_country: (registerCountry.value || '').toUpperCase() || undefined,
  platform: platform.value || undefined,
  app_key: appKey.value || undefined,
}))

/** 总览 KPI 卡片：金额类走 formatMoney（分→美元），比率走 formatPct */
const kpiCards = computed(() => {
  const k = overview.value?.kpi || {}
  const base = [
    { label: '区间活跃用户', value: k.unique_active ?? '-' },
    { label: '新增用户', value: k.new_users ?? '-' },
  ]
  if (appKey.value === 'manna') return base
  return [
    ...base,
    { label: '成交额', value: formatMoney(k.amount_cents) },
    { label: '订单数', value: k.order_count ?? '-' },
    { label: '付费率', value: formatPct(k.pay_rate) },
    { label: 'ARPPU', value: formatMoney(k.arppu_cents) },
  ]
})

const practiceKpiCards = computed(() => {
  const k = practice.value?.kpi || {}
  return [
    { label: 'D0 赠币率', value: formatPct(k.d0_grant_rate) },
    { label: 'D0 首笔任务币', value: formatPct(k.d0_first_task_rate) },
    { label: '功课 DAU 占比', value: formatPct(k.practice_dau_rate) },
    { label: 'D1 功课留存', value: formatPct(k.d1_practice_retention) },
    { label: 'D7 功课留存', value: formatPct(k.d7_practice_retention) },
    { label: 'Quiz 结算率', value: formatPct(k.quiz_settle_rate) },
    { label: 'Quiz 通关率', value: formatPct(k.quiz_pass_rate) },
    { label: '失败再战率', value: formatPct(k.fail_retry_rate) },
    { label: '周赚扣比', value: k.earn_spend_ratio ?? '-' },
    { label: '余额=0 占比', value: formatPct(k.zero_balance_share) },
    { label: '重复发放', value: k.duplicate_grants ?? '-' },
  ]
})

const practiceDaily = computed(() => practice.value?.daily || [])

const contentOpenKpiCards = computed(() => {
  const k = contentOpens.value?.kpi || {}
  return [
    { label: '总打开次数 PV', value: k.total_pv ?? '-' },
    { label: '打开用户 UV', value: k.total_uv ?? '-' },
    { label: '内容类型数', value: k.types ?? '-' },
  ]
})
const contentOpenByType = computed(() => contentOpens.value?.by_type || [])
const contentOpenItems = computed(() => contentOpens.value?.items || [])
const activeFunnel = computed(() => (tab.value === 'paywall' ? paywallFunnel.value : activationFunnel.value))

function kindLabel(kind) {
  if (kind === 'page') return '页面'
  if (kind === 'button') return '按钮'
  return '其他'
}

function funnelWidth(step) {
  const steps = activeFunnel.value?.steps || []
  const base = Number(steps[0]?.uv) || 0
  const uv = Number(step?.uv) || 0
  if (!base) return uv ? '100%' : '0%'
  return `${Math.max(uv ? 4 : 0, Math.round((uv / base) * 100))}%`
}

function contentOpenTypeLabel(v) {
  return CONTENT_OPEN_TYPES.find((t) => t.value === v)?.label || v || '—'
}

function onContentTypeRow(row) {
  const next = row?.content_type || ''
  if (contentOpenType.value === next) return
  contentOpenType.value = next
  reload()
}

async function copyTopUvIds() {
  const ids = [...contentOpenItems.value]
    .sort((a, b) => (Number(b.uv) || 0) - (Number(a.uv) || 0))
    .map((x) => String(x.content_id || '').trim())
    .filter(Boolean)
  if (!ids.length) {
    ElMessage.warning('暂无 content_id 可复制')
    return
  }
  try {
    await navigator.clipboard.writeText(ids.join(','))
    ElMessage.success(`已复制 ${ids.length} 个 content_id（按 UV）`)
  } catch {
    ElMessage.error('复制失败')
  }
}

/** 金额：后端存分（cents），展示为 $x.xx */
function formatMoney(cents) {
  if (cents == null || cents === '') return '-'
  return `$${(Number(cents) / 100).toFixed(2)}`
}

/** 比率：后端 0~1，展示百分数 */
function formatPct(rate) {
  if (rate == null) return '-'
  return `${(Number(rate) * 100).toFixed(2)}%`
}

/** 留存单元格：取 retention[n].rate */
function formatRet(cell) {
  if (!cell || cell.rate == null) return '-'
  return `${(cell.rate * 100).toFixed(1)}%`
}

/** 重置筛选为默认近 30 天 + 空维度，并重新拉取当前 Tab */
function onReset() {
  dateRange.value = defaultRange()
  appKey.value = ''
  language.value = ''
  platform.value = ''
  registerCountry.value = ''
  contentOpenType.value = ''
  contentOpenLimit.value = 50
  eventKind.value = 'all'
  eventNameQuery.value = ''
  reload()
}

/** 带 loading 拉取当前 Tab 数据；loading 结束后再 resize，避免遮罩期间尺寸不准 */
async function reload() {
  loading.value = true
  try {
    await loadTab(tab.value)
  } finally {
    loading.value = false
    await nextTick()
    if (tab.value === 'overview') chart?.resize()
  }
}

/** 页面/按钮：每次点搜索都重新请求 stats/events */
function searchEvents() {
  if (tab.value !== 'events') tab.value = 'events'
  reload()
}

/** Tab 切换时重新请求（各 Tab 独立接口，不做跨 Tab 缓存） */
async function onTabChange() {
  await reload()
}

/**
 * 按 Tab 名分发到对应 stats 接口：
 * overview → KPI+折线；dau/newUsers/revenue/orders/events → 表格行；
 * retention → 队列矩阵；geo → 国家+设备；lang → 语言分布。
 */
async function loadTab(name) {
  const f = queryFilters.value
  if (name === 'overview') {
    const res = await fetchStatsOverview(f)
    overview.value = res.results || {}
    await nextTick()
    renderChart()
    return
  }
  if (name === 'dau') {
    dauRows.value = (await fetchStatsDau(f)).results || []
    return
  }
  if (name === 'newUsers') {
    newUserRows.value = (await fetchStatsNewUsers(f)).results || []
    return
  }
  if (name === 'retention') {
    retentionRows.value = (await fetchStatsRetention(f)).results || []
    await nextTick()
    retentionTableRef.value?.doLayout?.()
    return
  }
  if (name === 'revenue') {
    revenueRows.value = (await fetchStatsRevenue(f)).results || []
    return
  }
  if (name === 'geo') {
    geo.value = (await fetchStatsGeoDevice(f)).results || { countries: [], devices: [] }
    return
  }
  if (name === 'lang') {
    langRows.value = (await fetchStatsLanguage(f)).results || []
    return
  }
  if (name === 'orders') {
    orderKpiRows.value = (await fetchStatsOrdersKpi(f)).results || []
    return
  }
  if (name === 'events') {
    const results = (await fetchStatsEvents({
      ...f,
      event_name: eventNameQuery.value.trim() || undefined,
      kind: eventKind.value !== 'all' ? eventKind.value : undefined,
    })).results
    eventRows.value = Array.isArray(results) ? results : []
    return
  }
  if (name === 'activation') {
    activationFunnel.value = (await fetchStatsActivationFunnel(f)).results || { steps: [] }
    return
  }
  if (name === 'paywall') {
    paywallFunnel.value = (await fetchStatsPaywallFunnel(f)).results || { steps: [] }
    return
  }
  if (name === 'practice') {
    practice.value = (await fetchStatsMannaPractice(f)).results || {}
    return
  }
  if (name === 'contentOpens') {
    contentOpens.value = (await fetchStatsMannaContentOpens({
      from: f.from,
      to: f.to,
      app_key: 'manna',
      language: language.value || undefined,
      country: (registerCountry.value || '').toUpperCase() || undefined,
      platform: platform.value || undefined,
      content_type: contentOpenType.value || undefined,
      limit: contentOpenLimit.value,
    })).results || {}
  }
}

/** 销毁图表实例（切走总览时 v-if 会拆掉 DOM，必须同步 dispose） */
function disposeChart() {
  chartRo?.disconnect()
  chartRo = null
  chart?.dispose()
  chart = null
}

function bindChartResize() {
  if (!chartRef.value || typeof ResizeObserver === 'undefined') return
  chartRo?.disconnect()
  chartRo = new ResizeObserver(() => chart?.resize())
  chartRo.observe(chartRef.value)
}

/**
 * 总览图：双 Y 轴（人数/单 vs 金额）；
 * 序列来自 overview.series：dau、new_users、revenue（分转美元）。
 */
function renderChart() {
  if (!chartRef.value) return
  // DOM 被 v-if 重建后旧实例已失效，需重新 init
  if (!chart || chart.getDom() !== chartRef.value) {
    chart?.dispose()
    chart = null
    chart = echarts.init(chartRef.value)
    bindChartResize()
  }
  const s = overview.value?.series || {}
  const dates = (s.dau || []).map((x) => x.date)
  const mannaOnly = appKey.value === 'manna'
  const legendNames = mannaOnly ? ['DAU', '新增'] : ['DAU', '新增', '成交额($)', '订单数']
  const series = [
    { name: 'DAU', type: 'line', data: (s.dau || []).map((x) => x.count) },
    { name: '新增', type: 'line', data: (s.new_users || []).map((x) => x.count) },
  ]
  if (!mannaOnly) {
    series.push(
      {
        name: '成交额($)',
        type: 'line',
        yAxisIndex: 1,
        data: (s.revenue || []).map((x) => Number(x.amount_cents || 0) / 100),
      },
      {
        name: '订单数',
        type: 'bar',
        barMaxWidth: 18,
        data: (s.revenue || []).map((x) => x.order_count),
      },
    )
  }
  chart.setOption(
    {
      color: ['#1677ff', '#52c41a', '#fa8c16', '#722ed1'],
      tooltip: { trigger: 'axis' },
      // 图例放底部，避免与双 Y 轴 name（默认在顶部）抢同一行导致「图例文字 ↔ 色块」视觉重合
      legend: {
        data: legendNames.map((name) => ({ name, icon: 'roundRect' })),
        bottom: 4,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 32,
        formatter: (name) => ` ${name} `,
        textStyle: {
          fontSize: 12,
          lineHeight: 16,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
      },
      grid: { left: 56, right: 64, top: 24, bottom: 56 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { hideOverlap: true },
      },
      yAxis: mannaOnly
        ? [{ type: 'value', name: '人数', nameLocation: 'middle', nameGap: 42 }]
        : [
            { type: 'value', name: '人数/单', nameLocation: 'middle', nameGap: 42 },
            {
              type: 'value',
              name: '金额($)',
              nameLocation: 'middle',
              nameGap: 48,
              splitLine: { show: false },
            },
          ],
      series,
    },
    { notMerge: true },
  )
  chart.resize()
}

function onResize() {
  chart?.resize()
}

onMounted(() => {
  reload()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  disposeChart()
})

// 切走总览 → dispose；切回 → nextTick 再 init（DOM 刚挂上）
watch(tab, (v) => {
  if (v !== 'overview') {
    disposeChart()
    return
  }
  nextTick(() => renderChart())
})

watch(appKey, (v) => {
  if (v === 'manna' && (tab.value === 'revenue' || tab.value === 'orders' || tab.value === 'paywall')) {
    tab.value = 'practice'
  }
  if (v !== 'manna' && (tab.value === 'practice' || tab.value === 'contentOpens')) {
    tab.value = 'overview'
  }
  reload()
})
</script>

<style scoped>
.filter-card :deep(.pro-search::after) {
  display: none;
}

.dash-body {
  min-height: 320px;
  padding: 0 0 16px;
  overflow: visible;
}

.event-kind-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  padding: 8px 24px 16px;
}

.kpi-row--3 {
  grid-template-columns: repeat(3, 1fr);
}

.kpi-item {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px 16px;
}

.kpi-label {
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
  margin-bottom: 8px;
}

.kpi-value {
  font-size: 22px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.chart-box {
  height: 360px;
  margin: 0 16px 16px;
}

.funnel {
  display: grid;
  gap: 12px;
  padding: 16px 24px 8px;
}

.funnel-step {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.funnel-index {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  margin-top: 2px;
  border-radius: 7px;
  background: #17221e;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.funnel-main {
  flex: 1;
  min-width: 0;
}

.funnel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.funnel-metrics {
  flex: none;
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
}

.funnel-track {
  height: 8px;
  margin-top: 8px;
  border-radius: 99px;
  background: #f0f0f0;
  overflow: hidden;
}

.funnel-bar {
  height: 100%;
  border-radius: 99px;
  background: #1677ff;
}

.funnel-rates {
  display: flex;
  gap: 16px;
  margin-top: 6px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.retention-wrap {
  overflow-x: auto;
  overflow-y: visible;
  padding: 8px 16px 24px;
}

.retention-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.retention-table {
  min-width: 2928px;
}

.retention-wrap :deep(.el-table .cell) {
  overflow: visible;
  text-overflow: unset;
  padding-left: 0;
  padding-right: 0;
  line-height: 22px;
}

.retention-wrap :deep(.el-table th.el-table__cell),
.retention-wrap :deep(.el-table td.el-table__cell) {
  padding: 8px 6px;
}

.split-tables {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding-bottom: 16px;
}

@media (max-width: 960px) {
  .kpi-row,
  .kpi-row--3 {
    grid-template-columns: repeat(2, 1fr);
  }
  .split-tables {
    grid-template-columns: 1fr;
  }
}

:deep(.el-tabs__header) {
  padding: 0 16px;
  margin-bottom: 0;
}
</style>
