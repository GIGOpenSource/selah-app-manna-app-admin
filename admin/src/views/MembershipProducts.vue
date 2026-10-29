<!--
  会员 SKU：商店商品 ID + 多语言 VIP 文案（权益 / CTA / 试用天数）。
-->
<template>
  <div>
    <div class="container">
      <p class="plugins-tips">
        商店商品 ID 按 <strong>App × 平台</strong> 配置。下方 VIP 权益 / CTA / 试用天数为维度打包列表；Sandbox 开关始终写全局。
        快捷槽位与列表受当前 App 筛选约束，避免双品牌 SKU 串台。
      </p>

      <ConfigPackList
        title="VIP 权益与 CTA"
        tips="空维=看全部文案包；新建默认落到具体 App。App 端按用户语言回退。"
        :keys="BENEFIT_KEYS"
        :defaults="benefitDefaults"
        remark="VIP 权益"
        dialog-width="640px"
        :summary-keys="['vip_cta_text', 'trial_days']"
      >
        <template #form="{ form: bForm }">
          <el-form-item label="VIP 页 CTA">
            <el-input v-model="bForm.vip_cta_text" placeholder="Try for $0.00 / 试用 $0.00" />
          </el-form-item>
          <el-form-item label="试用天数">
            <el-input-number v-model="bForm.trial_days" :min="1" :max="30" />
          </el-form-item>
          <el-form-item label="权益列表">
            <div class="benefits">
              <div v-for="(b, i) in (bForm.vip_benefits || [])" :key="i" class="benefit-row">
                <el-input v-model="bForm.vip_benefits[i]" placeholder="可用 {vip_daily_quota}" />
                <el-button link type="danger" @click="bForm.vip_benefits.splice(i, 1)">删除</el-button>
              </div>
              <el-button size="small" @click="(bForm.vip_benefits || (bForm.vip_benefits = [])).push('')">添加一条</el-button>
            </div>
          </el-form-item>
        </template>
      </ConfigPackList>

      <el-alert
        v-if="iapUnverifiedAllowed"
        type="error"
        :closable="false"
        show-icon
        title="危险：已开启「未验签联调」"
        description="生产环境仍须同时设置环境变量 ALLOW_IAP_UNVERIFIED=1 才会放行；否则仅 CMS 开关无效。该选项默认关闭，仅用于本地/联调，切勿在生产长期开启。"
        style="margin: 0 0 16px"
      />

      <el-form class="sandbox-row" v-loading="sandboxLoading" label-width="168px">
        <el-form-item label="Sandbox 验单">
          <el-switch v-model="iapSandboxAllowed" @change="saveSandbox" />
          <span class="hint">全局；生产仍须 ALLOW_IAP_SANDBOX=1</span>
        </el-form-item>
        <el-form-item label="IAP 验单">
          <el-switch v-model="iapVerifyEnabled" @change="(v) => saveIapFlag('iap_verify_enabled', v, 'IAP 验单')" />
        </el-form-item>
        <el-form-item label="恢复购买">
          <el-switch v-model="iapRestoreEnabled" @change="(v) => saveIapFlag('iap_restore_enabled', v, 'IAP 恢复')" />
        </el-form-item>
        <el-form-item label="未验签联调">
          <el-switch
            v-model="iapUnverifiedAllowed"
            active-color="var(--el-color-danger)"
            @change="onUnverifiedChange"
          />
          <span class="hint">默认关闭；生产须 ALLOW_IAP_UNVERIFIED=1 且 CMS 同时开启</span>
        </el-form-item>
      </el-form>

      <ScopeFilter
        mode="browse"
        keep-platform
        v-model:app-key="skuAppKey"
        v-model:language="skuLang"
        v-model:platform="skuPlat"
        @change="onSkuScopeChange"
      />

      <div class="handle-box">
        <el-select v-model="platform" clearable placeholder="平台" style="width: 120px; margin-right: 12px" @change="applyFilter">
          <el-option label="iOS" value="ios" />
          <el-option label="Android" value="android" />
        </el-select>
        <el-select v-model="planType" clearable placeholder="套餐" style="width: 120px; margin-right: 12px" @change="applyFilter">
          <el-option label="月度" value="monthly" />
          <el-option label="年度" value="yearly" />
        </el-select>
        <el-button @click="load">刷新</el-button>
        <el-button @click="openSlots">快捷配置商店 ID</el-button>
        <el-button type="primary" :icon="CirclePlusFilled" @click="openEdit()">新建 SKU</el-button>
      </div>

      <el-table :data="rows" stripe border v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="app_key" label="App" min-width="110" width="110">
          <template #default="{ row }">{{ row.app_key || '空维' }}</template>
        </el-table-column>
        <el-table-column prop="plan_type" label="套餐" width="90">
          <template #default="{ row }">{{ row.plan_type === 'yearly' ? '年度' : '月度' }}</template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" min-width="100" width="100" />
        <el-table-column prop="store_product_id" label="商店商品ID" min-width="180" />
        <el-table-column prop="title" label="标题" min-width="140" />
        <el-table-column prop="price_display" label="价格文案" width="100" />
        <el-table-column prop="original_price_display" label="原价文案" width="100" />
        <el-table-column prop="price_cents" label="成交价(分)" width="100" />
        <el-table-column prop="currency" label="币种" width="70" />
        <el-table-column prop="duration_days" label="天数" width="70" />
        <el-table-column prop="enabled" label="启用" min-width="90" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort_weight" label="权重" width="70" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="slotsVisible"
      title="快捷配置商店 ID"
      width="560px"
      append-to-body
      align-center
      destroy-on-close
      class="sku-dialog"
    >
      <p class="dialog-tip">
        当前 App=<strong>{{ slotAppKey }}</strong>。按平台写入月度 / 年度商店商品 ID；保存后同步该 App 的 iap_*。
      </p>
      <el-form label-width="140px">
        <el-form-item label="iOS 月度">
          <el-input v-model="slots.monthly_ios" :placeholder="`${slotAppKey}.vip.monthly`" />
        </el-form-item>
        <el-form-item label="Android 月度">
          <el-input v-model="slots.monthly_android" :placeholder="`${slotAppKey}.vip.monthly`" />
        </el-form-item>
        <el-form-item label="iOS 年度">
          <el-input v-model="slots.yearly_ios" :placeholder="`${slotAppKey}.vip.yearly`" />
        </el-form-item>
        <el-form-item label="Android 年度">
          <el-input v-model="slots.yearly_android" :placeholder="`${slotAppKey}.vip.yearly`" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="slotsVisible = false">取消</el-button>
        <el-button type="primary" :loading="slotSaving" @click="saveSlots">保存 SKU</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="visible"
      :title="form.id ? '编辑 SKU' : '新建 SKU'"
      width="560px"
      append-to-body
      align-center
      destroy-on-close
      class="sku-dialog"
    >
      <el-form label-width="120px">
        <el-form-item label="套餐类型" required>
          <el-select v-model="form.plan_type" style="width: 100%" @change="onPlanChange">
            <el-option label="月度" value="monthly" />
            <el-option label="年度" value="yearly" />
          </el-select>
        </el-form-item>
        <el-form-item label="平台" required>
          <el-select v-model="form.platform" style="width: 100%">
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="商店商品ID" required>
          <el-input v-model="form.store_product_id" placeholder="如 selah.vip.monthly" />
        </el-form-item>
        <el-form-item label="展示标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="价格文案（默认）">
          <el-input v-model="form.price_display" placeholder="无对应语言时回落；真实价格以商店为准" />
        </el-form-item>
        <el-form-item label="价格文案多语言">
          <div class="i18n-grid">
            <div v-for="lang in PRICE_LANGS" :key="lang" class="i18n-row">
              <span class="i18n-lang">{{ lang }}</span>
              <el-input v-model="priceI18n[lang]" :placeholder="`${lang} 展示价`" />
            </div>
          </div>
        </el-form-item>
        <el-form-item label="原价文案（默认）">
          <el-input v-model="form.original_price_display" placeholder="划线原价；无对应语言时回落" />
        </el-form-item>
        <el-form-item label="原价文案多语言">
          <div class="i18n-grid">
            <div v-for="lang in PRICE_LANGS" :key="`orig-${lang}`" class="i18n-row">
              <span class="i18n-lang">{{ lang }}</span>
              <el-input v-model="originalPriceI18n[lang]" :placeholder="`${lang} 原价`" />
            </div>
          </div>
        </el-form-item>
        <el-form-item label="成交价(分)">
          <el-input-number v-model="form.price_cents" :min="0" :step="100" />
          <span class="hint">看板 ARPPU/充值按此金额快照；试用记 0</span>
        </el-form-item>
        <el-form-item label="币种">
          <el-select v-model="form.currency" filterable style="width: 220px">
            <el-option
              v-for="c in CURRENCY_OPTIONS"
              :key="c.value"
              :label="c.label"
              :value="c.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="开通天数">
          <el-input-number v-model="form.duration_days" :min="1" />
        </el-form-item>
        <el-form-item label="试用天数">
          <el-input-number v-model="form.trial_days" :min="0" />
          <span class="hint">留空则使用配置维度 trial_days</span>
        </el-form-item>
        <el-form-item label="排序权重">
          <el-input-number v-model="form.sort_weight" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" />
        </el-form-item>
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
 * 会员 SKU + 多语言 VIP 文案。
 * - 权益/CTA/trial_days：AppConfig，按 app×language×platform
 * - iap_sandbox_allowed：始终全局
 * - SKU：按 app_key 分行；快捷槽位绑定当前筛选 App
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import {
  fetchMembershipProducts,
  saveMembershipProduct,
  deleteMembershipProduct,
  saveConfig,
  fetchConfigs,
} from '../api'
import ConfigPackList from '../components/ConfigPackList.vue'
import ScopeFilter from '../components/ScopeFilter.vue'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { CURRENCY_OPTIONS, LANG_CODES } from '../utils/enumZh'

const PRICE_LANGS = LANG_CODES
const priceI18n = reactive(Object.fromEntries(PRICE_LANGS.map((l) => [l, ''])))
const originalPriceI18n = reactive(Object.fromEntries(PRICE_LANGS.map((l) => [l, ''])))

function resetI18nMap(target, src = {}) {
  const map = src && typeof src === 'object' ? src : {}
  for (const lang of PRICE_LANGS) {
    target[lang] = map[lang] || ''
  }
}

function collectI18nMap(source) {
  const out = {}
  for (const lang of PRICE_LANGS) {
    const v = String(source[lang] || '').trim()
    if (v) out[lang] = v
  }
  return out
}

function resetPriceI18n(src = {}) {
  resetI18nMap(priceI18n, src)
}

function collectPriceI18n() {
  return collectI18nMap(priceI18n)
}

function resetOriginalPriceI18n(src = {}) {
  resetI18nMap(originalPriceI18n, src)
}

function collectOriginalPriceI18n() {
  return collectI18nMap(originalPriceI18n)
}

const SLOT_META = [
  { key: 'monthly_ios', plan_type: 'monthly', platform: 'ios', days: 30, title: 'VIP Monthly', weight: 20 },
  { key: 'monthly_android', plan_type: 'monthly', platform: 'android', days: 30, title: 'VIP Monthly', weight: 20 },
  { key: 'yearly_ios', plan_type: 'yearly', platform: 'ios', days: 365, title: 'VIP Yearly', weight: 10 },
  { key: 'yearly_android', plan_type: 'yearly', platform: 'android', days: 365, title: 'VIP Yearly', weight: 10 },
]

const DEFAULT_BENEFITS = [
  'Unlock VIP themes & wallpapers',
  'Hide watermark on share cards',
  '{vip_daily_quota} AI messages / day',
]
const benefitDefaults = {
  vip_cta_text: 'Try for $0.00',
  trial_days: 3,
  vip_benefits: [...DEFAULT_BENEFITS],
}
const BENEFIT_KEYS = Object.keys(benefitDefaults)

const allRows = ref([])
const rows = ref([])
const loading = ref(false)
const visible = ref(false)
const slotsVisible = ref(false)
const saving = ref(false)
const slotSaving = ref(false)
const form = ref({})
const platform = ref(null)
const planType = ref(null)
const skuAppKey = ref('selah')
const skuLang = ref('')
const skuPlat = ref('')
const slots = ref({
  monthly_ios: '',
  monthly_android: '',
  yearly_ios: '',
  yearly_android: '',
})

const iapSandboxAllowed = ref(true)
const iapVerifyEnabled = ref(true)
const iapRestoreEnabled = ref(true)
const iapUnverifiedAllowed = ref(false)
const sandboxLoading = ref(false)

const slotAppKey = computed(() => defaultCreateAppKey(skuAppKey.value))

function fillSlots(list, app) {
  const scoped = (list || []).filter((r) => (r.app_key || '') === app)
  const bySlot = {}
  for (const r of scoped) {
    const k = `${r.plan_type}_${r.platform}`
    if (!bySlot[k] || (r.enabled && !bySlot[k].enabled)) bySlot[k] = r
  }
  const prefix = app || 'selah'
  slots.value = {
    monthly_ios: bySlot.monthly_ios?.store_product_id || `${prefix}.vip.monthly`,
    monthly_android: bySlot.monthly_android?.store_product_id || `${prefix}.vip.monthly`,
    yearly_ios: bySlot.yearly_ios?.store_product_id || `${prefix}.vip.yearly`,
    yearly_android: bySlot.yearly_android?.store_product_id || `${prefix}.vip.yearly`,
  }
}

function applyFilter() {
  let list = allRows.value
  if (skuAppKey.value) list = list.filter((r) => (r.app_key || '') === skuAppKey.value)
  if (platform.value) list = list.filter((r) => r.platform === platform.value)
  if (planType.value) list = list.filter((r) => r.plan_type === planType.value)
  rows.value = list
}

function onSkuScopeChange() {
  clearPageCache(cacheKey())
  load()
}

function onPlanChange() {}

function cacheKey() {
  return `membership_products_${skuAppKey.value || 'all'}`
}

async function loadSandbox() {
  sandboxLoading.value = true
  try {
    const res = await fetchConfigs({
      keys: 'iap_sandbox_allowed,iap_verify_enabled,iap_restore_enabled,iap_unverified_allowed',
      app_key: '',
      language: '',
      platform: '',
    })
    const rows = res.results || []
    const map = {}
    for (const r of rows) map[r.key] = r.value
    if (map.iap_sandbox_allowed != null) iapSandboxAllowed.value = !!map.iap_sandbox_allowed
    if (map.iap_verify_enabled != null) iapVerifyEnabled.value = !!map.iap_verify_enabled
    if (map.iap_restore_enabled != null) iapRestoreEnabled.value = !!map.iap_restore_enabled
    if (map.iap_unverified_allowed != null) iapUnverifiedAllowed.value = !!map.iap_unverified_allowed
  } catch {
    /* ignore */
  } finally {
    sandboxLoading.value = false
  }
}

async function saveIapFlag(key, val, label) {
  try {
    await saveConfig(key, !!val, label, { app_key: '', language: '', platform: '' })
    ElMessage.success(`${label}已保存（全局）`)
  } catch (e) {
    if (key === 'iap_verify_enabled') iapVerifyEnabled.value = !val
    if (key === 'iap_restore_enabled') iapRestoreEnabled.value = !val
    if (key === 'iap_unverified_allowed') iapUnverifiedAllowed.value = !val
    ElMessage.error(e?.message || e?.msg || '保存失败')
  }
}

async function onUnverifiedChange(val) {
  if (val) {
    try {
      await ElMessageBox.confirm(
        '开启后，服务端在 ALLOW_IAP_UNVERIFIED=1 时可能接受未验签的 IAP 凭证。生产环境默认应关闭。确认开启？',
        '未验签联调',
        { type: 'warning', confirmButtonText: '仍要开启', cancelButtonText: '取消' },
      )
    } catch {
      iapUnverifiedAllowed.value = false
      return
    }
  }
  await saveIapFlag('iap_unverified_allowed', val, 'IAP 未验签')
}

async function saveSandbox(val) {
  try {
    await saveConfig('iap_sandbox_allowed', !!val, 'IAP sandbox', { app_key: '', language: '', platform: '' })
    ElMessage.success('Sandbox 开关已保存（全局）')
  } catch (e) {
    iapSandboxAllowed.value = !val
    ElMessage.error(e?.message || e?.msg || '保存失败')
  }
}

async function load() {
  loading.value = true
  try {
    await loadWithCache(cacheKey(), async () => {
      const res = await fetchMembershipProducts({
        ...browseScopeParams({
          appKey: skuAppKey.value,
          language: skuLang.value,
          platform: skuPlat.value,
        }),
      })
      return {
        list: Array.isArray(res.results) ? res.results : [],
        trial_days: res.meta?.trial_days != null ? Number(res.meta.trial_days) : 3,
      }
    }, (data) => {
      const list = data.list || []
      allRows.value = list
      fillSlots(list, slotAppKey.value)
      applyFilter()
    })
    await loadSandbox()
  } catch (e) {
    ElMessage.error(e?.message || e?.msg || '加载失败')
    allRows.value = []
    rows.value = []
  } finally {
    loading.value = false
  }
}

function openSlots() {
  fillSlots(allRows.value, slotAppKey.value)
  slotsVisible.value = true
}

async function saveSlots() {
  const app = slotAppKey.value
  for (const meta of SLOT_META) {
    if (!(slots.value[meta.key] || '').trim()) {
      ElMessage.warning(`${meta.platform} ${meta.plan_type} 商品ID不能为空`)
      return
    }
  }
  slotSaving.value = true
  try {
    for (const meta of SLOT_META) {
      const pid = (slots.value[meta.key] || '').trim()
      const existing = allRows.value.find(
        (r) => (r.app_key || '') === app && r.plan_type === meta.plan_type && r.platform === meta.platform && r.enabled,
      ) || allRows.value.find(
        (r) => (r.app_key || '') === app && r.plan_type === meta.plan_type && r.platform === meta.platform,
      )
      await saveMembershipProduct({
        id: existing?.id,
        app_key: app,
        plan_type: meta.plan_type,
        platform: meta.platform,
        store_product_id: pid,
        title: existing?.title || `${app} ${meta.title}`,
        price_display: existing?.price_display_default || existing?.price_display || '',
        price_display_i18n: existing?.price_display_i18n || {},
        original_price_display: existing?.original_price_display_default || existing?.original_price_display || '',
        original_price_display_i18n: existing?.original_price_display_i18n || {},
        price_cents: existing?.price_cents ?? 0,
        currency: existing?.currency || 'USD',
        duration_days: existing?.duration_days || meta.days,
        trial_days: existing?.trial_days ?? null,
        enabled: true,
        sort_weight: existing?.sort_weight ?? meta.weight,
        remark: existing?.remark || `pack:${app}`,
      })
    }
    ElMessage.success(`SKU 已保存（${app}），iap_* 已按 App 同步`)
    slotsVisible.value = false
    clearPageCache(cacheKey())
    await load()
  } catch (e) {
    ElMessage.error(e?.message || e?.msg || '保存失败')
  } finally {
    slotSaving.value = false
  }
}

function openEdit(row) {
  const app = defaultCreateAppKey(skuAppKey.value)
  form.value = row
    ? {
        ...row,
        app_key: row.app_key || app,
        price_display: row.price_display_default || row.price_display || '',
        original_price_display: row.original_price_display_default || row.original_price_display || '',
        trial_days: row.trial_days ?? undefined,
      }
    : {
        app_key: app,
        plan_type: 'monthly',
        platform: 'ios',
        store_product_id: `${app}.vip.monthly`,
        title: `${app} VIP Monthly`,
        price_display: '',
        original_price_display: '',
        price_cents: 0,
        currency: 'USD',
        duration_days: 30,
        trial_days: undefined,
        enabled: true,
        sort_weight: 20,
        remark: `pack:${app}`,
      }
  resetPriceI18n(row?.price_display_i18n)
  resetOriginalPriceI18n(row?.original_price_display_i18n)
  visible.value = true
}

async function save() {
  form.value.app_key = defaultCreateAppKey(skuAppKey.value)
  if (!(form.value.store_product_id || '').trim()) {
    ElMessage.warning('请填写商店商品ID')
    return
  }
  saving.value = true
  try {
    const payload = { ...form.value }
    if (payload.trial_days === undefined || payload.trial_days === null || payload.trial_days === '') {
      payload.trial_days = null
    }
    payload.price_display_i18n = collectPriceI18n()
    payload.original_price_display_i18n = collectOriginalPriceI18n()
    delete payload.price_display_default
    delete payload.original_price_display_default
    await saveMembershipProduct(payload)
    ElMessage.success('已保存，iap_* 已按 App 同步')
    visible.value = false
    clearPageCache(cacheKey())
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确认删除「${row.store_product_id}」？`, '提示', { type: 'warning' })
  await deleteMembershipProduct(row.id)
  ElMessage.success('已删除')
  clearPageCache(cacheKey())
  await load()
}

onMounted(load)
</script>

<style scoped>
.sku-card {
  margin-bottom: 20px;
}
.handle-box {
  margin-bottom: 20px;
}
.hint {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}
.i18n-grid {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.i18n-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.i18n-lang {
  width: 36px;
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
}
.benefits {
  width: 100%;
}
.benefit-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.sandbox-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0 16px;
  padding: 8px 24px 0;
  margin: 0;
}
.sandbox-row :deep(.el-form-item) {
  margin-bottom: 12px;
}
.scope-tip {
  margin-bottom: 12px;
}
.dialog-tip {
  margin: 0 0 16px;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}
</style>

<style>
/* teleported dialog：长表单在视口内滚动，避免像嵌在页面里 */
.sku-dialog.el-dialog {
  margin-top: 0 !important;
  max-height: min(90vh, 860px);
  display: flex;
  flex-direction: column;
}
.sku-dialog .el-dialog__body {
  flex: 1;
  overflow-y: auto;
  max-height: min(70vh, 640px);
}
</style>
