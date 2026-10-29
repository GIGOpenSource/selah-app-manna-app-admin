<!--
  运营预置肯定语模板：按 app×语言×设备维护，供 App 空态一键填入。
-->
<template>
  <div class="container">
    <ScopeFilter
      mode="browse"
      v-model:app-key="appKey"
      v-model:language="language"
      v-model:platform="platform"
      @change="onScopeChange"
    />
    <p class="plugins-tips">空维=不过滤（看全部）；选具体维才精确筛。</p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">肯定语模板</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading" class="tpl-table" style="width: 100%">
      <el-table-column prop="id" label="ID" width="100" />
      <el-table-column label="正文" min-width="240" class-name="col-content">
        <template #default="{ row }">
          <el-tooltip
            :content="row.content || '—'"
            placement="top"
            :disabled="!row.content"
            :show-after="300"
          >
            <span class="content-ellipsis">{{ row.content || '—' }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="app_key" label="App" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '空维' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" min-width="100" width="100">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column v-if="showPlat" prop="platform" label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="sort_weight" label="权重" width="90" />
      <el-table-column prop="status" label="启用" min-width="90" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
            {{ row.status === 1 ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="168" fixed="right">
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

    <el-dialog v-model="visible" :title="form.id ? '编辑模板' : '新建模板'" width="560px" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="正文">
          <el-input v-model="form.content" type="textarea" rows="3" maxlength="160" show-word-limit />
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="权重"><el-input-number v-model="form.sort_weight" :min="0" /></el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import {
  fetchAffirmationTemplatesAdmin,
  saveAffirmationTemplate,
  deleteAffirmationTemplate,
} from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { LANG_OPTIONS } from '../utils/enumZh'
import { shouldHidePlatform } from '../utils/productContext'

const appKey = ref('')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const showPlat = !shouldHidePlatform()

function onScopeChange() {
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const res = await fetchAffirmationTemplatesAdmin({
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
        content: '',
        sort_weight: 0,
        status: 1,
        app_key: defaultCreateAppKey(appKey.value),
        language: language.value || '',
        platform: platform.value || '',
      }
  visible.value = true
}

async function save() {
  try {
    await saveAffirmationTemplate({
      ...form.value,
      app_key: defaultCreateAppKey(appKey.value),
      platform: '',
    })
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await deleteAffirmationTemplate(id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.tpl-table :deep(.cell) {
  text-overflow: clip;
}
.tpl-table :deep(.col-content .cell) {
  overflow: hidden;
  text-overflow: ellipsis;
}
.content-ellipsis {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
