<!--
  PUSH 记录：按批次聚合的发送汇总 + 投递明细。
  主列表用 push-logs-summary；点进明细用该行 detail 拼 push-deliveries。
-->
<template>
  <div>
    <div class="container">
      <div class="pro-search">
        <el-select v-model="pushType" clearable placeholder="类型" style="width: 140px" @change="load(1)">
          <el-option label="日常 PUSH" value="daily" />
          <el-option label="运营 PUSH" value="campaign" />
        </el-select>
        <el-select v-model="lang" clearable filterable placeholder="语言" style="width: 130px" @change="load(1)">
          <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
        </el-select>
        <el-select v-model="slot" clearable placeholder="时段" style="width: 140px" @change="load(1)">
          <el-option v-for="s in PUSH_SLOT_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-select v-model="channel" clearable placeholder="渠道" style="width: 130px" @change="load(1)">
          <el-option label="本地拉取" value="local" />
          <el-option label="服务端下发" value="fcm" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 260px"
          @change="load(1)"
        />
        <el-input
          v-model="campaignId"
          clearable
          placeholder="运营任务 ID"
          style="width: 140px"
          @keyup.enter="load(1)"
          @clear="load(1)"
        />
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">PUSH 记录</div>
      </div>

      <el-table :data="rows" v-loading="loading" row-key="summary_key">
        <el-table-column label="PUSH 类型" width="110">
          <template #default="{ row }">
            <el-tag :type="row.push_type === 'campaign' ? 'warning' : ''" size="small">
              {{ labelZh(PUSH_TYPE_ZH, row.push_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="文案内容" min-width="220">
          <template #default="{ row }">
            <div class="copy-title">{{ row.title || '—' }}</div>
            <div class="sub">{{ row.body || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="lang" label="语言" width="80" />
        <el-table-column label="时段" width="120">
          <template #default="{ row }">
            {{ row.slot ? labelZh(PUSH_SLOT_ZH, row.slot) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="渠道" width="110">
          <template #default="{ row }">{{ channelLabel(row.channel) }}</template>
        </el-table-column>
        <el-table-column prop="target_count" label="目标用户数" width="110" />
        <el-table-column prop="sent_count" label="实际发送用户数" width="130" />
        <el-table-column prop="success_count" label="发送成功数" width="110" />
        <el-table-column prop="fail_count" label="发送失败数" width="110" />
        <el-table-column prop="delivered_count" label="送达人数" width="100" />
        <el-table-column prop="click_count" label="PUSH 点击人数" width="130" />
        <el-table-column label="PUSH 点击率" width="120">
          <template #default="{ row }">{{ formatRate(row.click_rate) }}</template>
        </el-table-column>
        <el-table-column prop="open_count" label="点击后进入 APP 人数" width="160" />
        <el-table-column label="发送时间" width="178" fixed="right">
          <template #default="{ row }">{{ sentTimeText(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">明细</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        :page-size="pageSize"
        v-model:current-page="page"
        @current-change="load"
      />
    </div>

    <el-drawer v-model="detailVisible" title="投递明细" size="760px" destroy-on-close>
      <template v-if="currentLog">
        <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
          <el-descriptions-item label="类型">{{ labelZh(PUSH_TYPE_ZH, currentLog.push_type) }}</el-descriptions-item>
          <el-descriptions-item label="渠道">{{ channelLabel(currentLog.channel) }}</el-descriptions-item>
          <el-descriptions-item label="标题" :span="2">{{ currentLog.title || '—' }}</el-descriptions-item>
          <el-descriptions-item label="正文" :span="2">{{ currentLog.body || '—' }}</el-descriptions-item>
          <el-descriptions-item label="语言">{{ currentLog.lang || '—' }}</el-descriptions-item>
          <el-descriptions-item label="时段">
            {{ currentLog.slot ? labelZh(PUSH_SLOT_ZH, currentLog.slot) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="送达">{{ currentLog.delivered_count ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="点击率">{{ formatRate(currentLog.click_rate) }}</el-descriptions-item>
          <el-descriptions-item label="发送时间" :span="2">{{ sentTimeText(currentLog) }}</el-descriptions-item>
        </el-descriptions>

        <el-table :data="deliveries" v-loading="deliveriesLoading" size="small">
          <el-table-column prop="user_id" label="用户 ID" width="100" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">{{ labelZh(PUSH_TARGET_STATUS_ZH, row.status, row.status) }}</template>
          </el-table-column>
          <el-table-column prop="title" label="标题" min-width="120" show-overflow-tooltip />
          <el-table-column label="时段" width="100">
            <template #default="{ row }">
              {{ row.slot ? labelZh(PUSH_SLOT_ZH, row.slot) : '—' }}
            </template>
          </el-table-column>
          <el-table-column prop="local_date" label="当地日" width="110" />
          <el-table-column label="点击/进端" width="100">
            <template #default="{ row }">
              {{ row.clicked ? '是' : '否' }} / {{ row.opened ? '是' : '否' }}
            </template>
          </el-table-column>
          <el-table-column prop="error" label="错误" min-width="120" show-overflow-tooltip />
          <el-table-column label="发送时间" width="178">
            <template #default="{ row }">{{ formatDateTime(row.sent_at) }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          class="pagination"
          small
          layout="total, prev, pager, next"
          :total="deliveriesTotal"
          :page-size="pageSize"
          v-model:current-page="deliveriesPage"
          @current-change="loadDeliveries"
        />
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchPushLogsSummary, fetchPushDeliveries } from '../api'
import { getAdminProduct } from '../utils/productContext'
import {
  LANG_OPTIONS,
  PUSH_TYPE_ZH,
  PUSH_SLOT_ZH,
  PUSH_SLOT_OPTIONS,
  PUSH_TARGET_STATUS_ZH,
  labelZh,
} from '../utils/enumZh'

const route = useRoute()
const rows = ref([])
const page = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const pushType = ref('')
const lang = ref('')
const slot = ref('')
const channel = ref('')
const campaignId = ref('')
const dateRange = ref(defaultRange())

const detailVisible = ref(false)
const currentLog = ref(null)
const deliveries = ref([])
const deliveriesPage = ref(1)
const deliveriesTotal = ref(0)
const deliveriesLoading = ref(false)

function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - 29)
  const fmt = (d) => {
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  return [fmt(from), fmt(to)]
}

function appKey() {
  return getAdminProduct() || 'selah'
}

function channelLabel(channel) {
  if (channel === 'local') return '本地拉取'
  if (channel === 'fcm') return '服务端下发'
  return channel || '—'
}

function formatRate(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  if (n <= 1) return `${(n * 100).toFixed(1)}%`
  return `${n.toFixed(1)}%`
}

function formatDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).replace('T', ' ').slice(0, 19)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function sentTimeText(row) {
  if (!row) return '—'
  if (row.push_type !== 'campaign' && row.local_date) {
    return row.planned_local_time ? `${row.local_date} ${row.planned_local_time}` : row.local_date
  }
  return formatDateTime(row.sent_at)
}

function deliveryQuery(row) {
  const detail = row?.detail && typeof row.detail === 'object' ? row.detail : {}
  const params = {
    app_key: detail.app_key || row.app_key || appKey(),
  }
  const pushTypeValue = detail.push_type || row.push_type
  if (pushTypeValue) params.push_type = pushTypeValue
  const keys = ['copy_id', 'slot', 'local_date', 'channel', 'send_log_id', 'campaign_id']
  keys.forEach((key) => {
    const value = detail[key] ?? (key === 'campaign_id' ? row.campaign_id : undefined)
    if (value != null && value !== '') params[key] = value
  })
  if (!params.campaign_id && row.push_type === 'campaign' && row.campaign_id) {
    params.campaign_id = row.campaign_id
  }
  return params
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = {
      app_key: appKey(),
      currentPage: page.value,
      pageSize,
    }
    if (pushType.value) params.push_type = pushType.value
    if (lang.value) params.lang = lang.value
    if (slot.value) params.slot = slot.value
    if (channel.value) params.channel = channel.value
    if (dateRange.value?.[0]) params.date_from = dateRange.value[0]
    if (dateRange.value?.[1]) params.date_to = dateRange.value[1]
    if (campaignId.value) params.campaign_id = campaignId.value
    const res = await fetchPushLogsSummary(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || rows.value.length
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function onReset() {
  pushType.value = ''
  lang.value = ''
  slot.value = ''
  channel.value = ''
  campaignId.value = ''
  dateRange.value = defaultRange()
  load(1)
}

function applyRouteQuery() {
  const q = route.query || {}
  if (q.push_type) pushType.value = String(q.push_type)
  if (q.campaign_id) campaignId.value = String(q.campaign_id)
}

function openDetail(row) {
  currentLog.value = row
  detailVisible.value = true
  deliveriesPage.value = 1
  loadDeliveries(1)
}

async function loadDeliveries(p = deliveriesPage.value) {
  if (!currentLog.value) return
  deliveriesPage.value = p
  deliveriesLoading.value = true
  try {
    const res = await fetchPushDeliveries({
      ...deliveryQuery(currentLog.value),
      currentPage: deliveriesPage.value,
      pageSize,
    })
    deliveries.value = res.results || []
    deliveriesTotal.value = res.pagination?.total || deliveries.value.length
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载明细失败')
  } finally {
    deliveriesLoading.value = false
  }
}

onMounted(() => {
  applyRouteQuery()
  load(1)
})
</script>

<style scoped>
.copy-title {
  line-height: 1.4;
}
.sub {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}
</style>
