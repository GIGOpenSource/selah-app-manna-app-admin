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
        <el-tab-pane label="每日充值" name="revenue" />
        <el-tab-pane label="地区/设备" name="geo" />
        <el-tab-pane label="语言分布" name="lang" />
        <el-tab-pane label="订单 KPI" name="orders" />
        <el-tab-pane label="页面/按钮" name="events" />
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

        <!-- 留存 -->
        <div v-else-if="tab === 'retention'" class="retention-wrap">
          <el-table :data="retentionRows" border>
            <el-table-column prop="cohort_date" label="注册日" width="120" fixed />
            <el-table-column prop="cohort_size" label="人数" width="80" fixed />
            <el-table-column
              v-for="n in 31"
              :key="n - 1"
              :label="`D${n - 1}`"
              :min-width="72"
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

        <!-- 事件 -->
        <el-table v-else-if="tab === 'events'" :data="eventRows">
          <el-table-column prop="event_label" label="事件名称" min-width="160">
            <template #default="{ row }">{{ row.event_label || row.event_name }}</template>
          </el-table-column>
          <el-table-column prop="event_name" label="事件标识" min-width="200" />
          <el-table-column prop="kind" label="类型" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.kind === 'page' ? 'success' : row.kind === 'button' ? 'warning' : 'info'">
                {{ row.kind === 'page' ? '页面' : row.kind === 'button' ? '按钮' : '其他' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="uv" label="人数 UV" width="100" />
          <el-table-column prop="pv" label="次数 PV" width="100" />
        </el-table>
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
} from '../api'
import { COUNTRY_OPTIONS } from '../utils/enumZh'

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

const chartRef = ref(null)
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
  return [
    { label: '区间活跃用户', value: k.unique_active ?? '-' },
    { label: '新增用户', value: k.new_users ?? '-' },
    { label: '成交额', value: formatMoney(k.amount_cents) },
    { label: '订单数', value: k.order_count ?? '-' },
    { label: '付费率', value: formatPct(k.pay_rate) },
    { label: 'ARPPU', value: formatMoney(k.arppu_cents) },
  ]
})

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
    eventRows.value = (await fetchStatsEvents(f)).results || []
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
  const legendNames = ['DAU', '新增', '成交额($)', '订单数']
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
      yAxis: [
        { type: 'value', name: '人数/单', nameLocation: 'middle', nameGap: 42 },
        {
          type: 'value',
          name: '金额($)',
          nameLocation: 'middle',
          nameGap: 48,
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'DAU',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: (s.dau || []).map((x) => x.count),
        },
        { name: '新增', type: 'bar', barMaxWidth: 18, data: (s.new_users || []).map((x) => x.count) },
        {
          name: '成交额($)',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: (s.revenue || []).map((x) => Number(((x.amount_cents || 0) / 100).toFixed(2))),
        },
        {
          name: '订单数',
          type: 'bar',
          barMaxWidth: 18,
          data: (s.revenue || []).map((x) => x.order_count),
        },
      ],
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
</script>

<style scoped>
.filter-card :deep(.pro-search::after) {
  display: none;
}

.dash-body {
  min-height: 320px;
  padding: 0 0 16px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  padding: 8px 24px 16px;
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

.retention-wrap {
  overflow-x: auto;
  padding: 0 8px 16px;
}

.split-tables {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding-bottom: 16px;
}

@media (max-width: 960px) {
  .kpi-row {
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
