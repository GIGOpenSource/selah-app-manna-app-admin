<!--
  节日日历：预热/核心期 + 国家；festival_key 须与标签库 festival 二级名一致。
-->
<template>
  <div>
    <div class="container">
      <div class="pro-toolbar">
        <div class="pro-toolbar-title">节日日历</div>
        <div class="pro-toolbar-actions">
          <el-button :loading="seeding" @click="onSeed">写入种子节日</el-button>
          <el-button type="primary" @click="openCreate">新建节日</el-button>
        </div>
      </div>
      <p class="plugins-tips">
        <code>festival_key</code> 须与隐性标签一级 <code>festival</code> 下的二级名一致（如 Christmas）。
        <code>countries</code> 空=全球；priority 越大重叠时越优先。语录需打上对应 festival 标签后才会召回。
      </p>

      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="festival_key" label="Key" width="140" />
        <el-table-column prop="label" label="名称" width="140" />
        <el-table-column label="国家" width="120">
          <template #default="{ row }">
            {{ (row.countries || []).length ? row.countries.join(', ') : '全球' }}
          </template>
        </el-table-column>
        <el-table-column label="预热期" min-width="140">
          <template #default="{ row }">{{ formatRule(row.warmup_rule) }}</template>
        </el-table-column>
        <el-table-column label="核心期" min-width="140">
          <template #default="{ row }">{{ formatRule(row.core_rule) }}</template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(v) => toggleEnabled(row, v)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="visible" :title="form.id ? '编辑节日' : '新建节日'" width="560px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="festival_key" required>
          <el-input v-model="form.festival_key" placeholder="与标签库二级名一致，如 Christmas" />
        </el-form-item>
        <el-form-item label="显示名" required>
          <el-input v-model="form.label" />
        </el-form-item>
        <el-form-item label="国家">
          <el-select
            v-model="form.countries"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="空=全球；可填 US 等"
            style="width: 100%"
          >
            <el-option label="US" value="US" />
            <el-option label="GB" value="GB" />
            <el-option label="CA" value="CA" />
            <el-option label="AU" value="AU" />
          </el-select>
        </el-form-item>
        <el-form-item label="预热开始">
          <div class="md-row">
            <span class="md-label">月</span>
            <el-input-number v-model="form.warmup_rule.start.month" :min="1" :max="12" size="small" />
            <span class="md-label">日</span>
            <el-input-number v-model="form.warmup_rule.start.day" :min="1" :max="31" size="small" />
          </div>
        </el-form-item>
        <el-form-item label="预热结束">
          <div class="md-row">
            <span class="md-label">月</span>
            <el-input-number v-model="form.warmup_rule.end.month" :min="1" :max="12" size="small" />
            <span class="md-label">日</span>
            <el-input-number v-model="form.warmup_rule.end.day" :min="1" :max="31" size="small" />
          </div>
        </el-form-item>
        <el-form-item label="核心开始">
          <div class="md-row">
            <span class="md-label">月</span>
            <el-input-number v-model="form.core_rule.start.month" :min="1" :max="12" size="small" />
            <span class="md-label">日</span>
            <el-input-number v-model="form.core_rule.start.day" :min="1" :max="31" size="small" />
          </div>
        </el-form-item>
        <el-form-item label="核心结束">
          <div class="md-row">
            <span class="md-label">月</span>
            <el-input-number v-model="form.core_rule.end.month" :min="1" :max="12" size="small" />
            <span class="md-label">日</span>
            <el-input-number v-model="form.core_rule.end.day" :min="1" :max="31" size="small" />
          </div>
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" :min="0" />
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
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchFestivalCalendars,
  saveFestivalCalendar,
  seedFestivalCalendars,
} from '../api'

const rows = ref([])
const loading = ref(false)
const seeding = ref(false)
const saving = ref(false)
const visible = ref(false)
const form = ref(emptyForm())

function emptyForm() {
  return {
    id: null,
    festival_key: '',
    label: '',
    countries: [],
    warmup_rule: { start: { month: 12, day: 15 }, end: { month: 12, day: 19 } },
    core_rule: { start: { month: 12, day: 20 }, end: { month: 12, day: 25 } },
    priority: 50,
    enabled: true,
    remark: '',
  }
}

function formatRule(rule) {
  if (!rule?.start || !rule?.end) return '—'
  const s = rule.start
  const e = rule.end
  return `${s.month}/${s.day} – ${e.month}/${e.day}`
}

async function load() {
  loading.value = true
  try {
    const res = await fetchFestivalCalendars()
    const data = res.results || res
    rows.value = data.list || (Array.isArray(data) ? data : [])
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = emptyForm()
  visible.value = true
}

function openEdit(row) {
  form.value = {
    ...emptyForm(),
    ...row,
    countries: [...(row.countries || [])],
    warmup_rule: {
      start: { ...(row.warmup_rule?.start || { month: 1, day: 1 }) },
      end: { ...(row.warmup_rule?.end || { month: 1, day: 1 }) },
    },
    core_rule: {
      start: { ...(row.core_rule?.start || { month: 1, day: 1 }) },
      end: { ...(row.core_rule?.end || { month: 1, day: 1 }) },
    },
  }
  visible.value = true
}

async function save() {
  if (!form.value.festival_key?.trim() || !form.value.label?.trim()) {
    ElMessage.warning('请填写 festival_key 与显示名')
    return
  }
  saving.value = true
  try {
    await saveFestivalCalendar({
      ...form.value,
      festival_key: form.value.festival_key.trim(),
      label: form.value.label.trim(),
      countries: form.value.countries || [],
    })
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
    await saveFestivalCalendar({ ...row, enabled: !!v })
    load()
  } catch (e) {
    ElMessage.error(e.message || '更新失败')
    load()
  }
}

async function onSeed() {
  seeding.value = true
  try {
    await seedFestivalCalendars()
    ElMessage.success('种子节日已写入（幂等）')
    await load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '写入失败')
  } finally {
    seeding.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.pro-toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.plugins-tips code {
  font-size: 12px;
  background: #f4f4f5;
  padding: 1px 4px;
  border-radius: 3px;
}
.md-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.md-label { color: #909399; font-size: 12px; }
</style>
