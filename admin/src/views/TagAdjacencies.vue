<!--
  相邻标签：源 → 目标映射；名称与语录/兴趣打标字符串一致（大小写敏感）。
-->
<template>
  <div>
    <div class="container">
      <div class="pro-search">
        <el-input
          v-model="sourceFilter"
          clearable
          placeholder="按源标签筛选，如 Peace"
          style="width: 240px"
          @keyup.enter="load"
        />
        <div class="pro-search-actions">
          <el-button type="primary" @click="load">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">相邻标签</div>
        <div class="pro-toolbar-actions">
          <el-button type="primary" @click="openCreate">新建映射</el-button>
        </div>
      </div>
      <p class="plugins-tips">
        有源标签兴趣的用户可召到目标标签内容。标签名建议与隐性标签库英文名对齐（大小写敏感）。
      </p>

      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="source_tag" label="源标签" min-width="140" />
        <el-table-column prop="target_tag" label="目标标签" min-width="140" />
        <el-table-column prop="sort_order" label="排序" width="90" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(v) => toggleEnabled(row, v)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="visible" :title="form.id ? '编辑映射' : '新建映射'" width="480px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="源标签" required>
          <el-input v-model="form.source_tag" placeholder="如 anxious / Peace" />
        </el-form-item>
        <el-form-item label="目标标签" required>
          <el-input v-model="form.target_tag" placeholder="如 Peace / Hope" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
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
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchTagAdjacencies,
  saveTagAdjacency,
  deleteTagAdjacency,
} from '../api'

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const visible = ref(false)
const sourceFilter = ref('')
const form = ref(emptyForm())

function emptyForm() {
  return {
    id: null,
    source_tag: '',
    target_tag: '',
    enabled: true,
    sort_order: 0,
  }
}

async function load() {
  loading.value = true
  try {
    const params = {}
    if (sourceFilter.value?.trim()) params.source_tag = sourceFilter.value.trim()
    const res = await fetchTagAdjacencies(params)
    const data = res.results || res
    rows.value = data.list || (Array.isArray(data) ? data : [])
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onReset() {
  sourceFilter.value = ''
  load()
}

function openCreate() {
  form.value = emptyForm()
  visible.value = true
}

function openEdit(row) {
  form.value = { ...emptyForm(), ...row }
  visible.value = true
}

async function save() {
  if (!form.value.source_tag?.trim() || !form.value.target_tag?.trim()) {
    ElMessage.warning('请填写源标签与目标标签')
    return
  }
  saving.value = true
  try {
    await saveTagAdjacency({
      ...form.value,
      source_tag: form.value.source_tag.trim(),
      target_tag: form.value.target_tag.trim(),
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
    await saveTagAdjacency({ ...row, enabled: !!v })
    load()
  } catch (e) {
    ElMessage.error(e.message || '更新失败')
    load()
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`删除「${row.source_tag} → ${row.target_tag}」？`, '确认')
    await deleteTagAdjacency(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.pro-toolbar-actions { display: flex; gap: 8px; }
</style>
