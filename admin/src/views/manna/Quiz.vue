<!--
  Manna 测验：关卡 + 题目两级 CRUD。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">测验关卡</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="openLevel()">新建关卡</el-button>
      </div>
    </div>
    <el-table :data="levelRows" v-loading="loading" highlight-current-row @current-change="onSelectLevel">
      <el-table-column prop="level_no" label="关卡" width="80" />
      <el-table-column prop="title" label="标题" min-width="160" />
      <el-table-column prop="time_limit_sec" label="时限(s)" width="90" />
      <el-table-column prop="pass_score" label="通关分" width="80" />
      <el-table-column prop="reward_manna" label="奖励" width="80" />
      <el-table-column prop="fail_penalty" label="失败扣" width="80" />
      <el-table-column prop="app_key" label="App名" width="90">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="90">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" width="90">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="enabled" label="启用" width="80">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button link type="primary" @click="openLevel(row)">编辑</el-button>
          <el-button link type="primary" @click="selectAndLoadQuestions(row)">题目</el-button>
          <el-button link type="danger" @click="onDeleteLevel(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="pagination"
      background
      layout="total, prev, pager, next"
      :total="levelTotal"
      v-model:current-page="levelPage"
      @current-change="loadLevels"
    />

    <div class="pro-toolbar" style="margin-top: 24px">
      <div class="pro-toolbar-title">
        题目{{ activeLevel ? ` · L${activeLevel.level_no} ${activeLevel.title || ''}` : '（先选上方关卡）' }}
      </div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" @click="onNewQuestion">新建题目</el-button>
      </div>
    </div>
    <el-alert
      v-if="!activeLevel"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
      title="请先在上方关卡表点击一行，或点操作列「题目」，再新建题目。"
    />
    <el-table :data="qRows" v-loading="qLoading">
      <el-table-column prop="stem" label="题干" min-width="200" />
      <el-table-column prop="qtype" label="类型" width="90" />
      <el-table-column prop="answer_key" label="答案" width="90" />
      <el-table-column prop="sort_order" label="排序" width="70" />
      <el-table-column prop="enabled" label="启用" width="80">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openQuestion(row)">编辑</el-button>
          <el-button link type="danger" @click="onDeleteQuestion(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="levelVisible" :title="levelForm.id ? '编辑关卡' : '新建关卡'" width="560px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="关卡号"><el-input-number v-model="levelForm.level_no" :min="1" /></el-form-item>
        <el-form-item label="标题"><el-input v-model="levelForm.title" /></el-form-item>
        <el-form-item label="时限(s)"><el-input-number v-model="levelForm.time_limit_sec" :min="0" /></el-form-item>
        <el-form-item label="通关分"><el-input-number v-model="levelForm.pass_score" :min="1" /></el-form-item>
        <el-form-item label="奖励 Manna"><el-input-number v-model="levelForm.reward_manna" /></el-form-item>
        <el-form-item label="失败扣减"><el-input-number v-model="levelForm.fail_penalty" /></el-form-item>
        <el-form-item label="App" required>
          <el-select v-model="levelForm.app_key" filterable style="width: 100%">
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="levelForm.language" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="levelForm.platform" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="levelForm.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="levelForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="saveLevel">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="qVisible" :title="qForm.id ? '编辑题目' : '新建题目'" width="680px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="题干"><el-input v-model="qForm.stem" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="qForm.qtype" style="width: 160px">
            <el-option label="单选" value="single" />
            <el-option label="判断" value="tf" />
          </el-select>
        </el-form-item>
        <el-form-item label="选项 JSON">
          <el-input v-model="optionsText" type="textarea" :rows="4" placeholder='[{"key":"A","text":"..."},{"key":"B","text":"..."}]' />
        </el-form-item>
        <el-form-item label="答案 key"><el-input v-model="qForm.answer_key" placeholder="A" /></el-form-item>
        <el-form-item label="解析"><el-input v-model="qForm.explanation" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="qForm.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="qForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="saveQuestion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import {
  fetchMannaQuizLevels, saveMannaQuizLevel,
  fetchMannaQuizQuestions, saveMannaQuizQuestion,
} from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams } from '../../utils/scopeParams'
import { APP_KEYS, LANG_OPTIONS } from '../../utils/enumZh'

const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const levelRows = ref([])
const levelPage = ref(1)
const levelTotal = ref(0)
const loading = ref(false)
const activeLevel = ref(null)
const qRows = ref([])
const qLoading = ref(false)
const levelVisible = ref(false)
const levelForm = ref({})
const qVisible = ref(false)
const qForm = ref({})
const optionsText = ref('[]')

function onScopeChange() {
  activeLevel.value = null
  qRows.value = []
  loadLevels(1)
}

async function loadLevels(p = levelPage.value) {
  levelPage.value = p
  loading.value = true
  try {
    const res = await fetchMannaQuizLevels({
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
      currentPage: levelPage.value,
      pageSize: 20,
    })
    levelRows.value = res.results || []
    levelTotal.value = res.pagination?.total || 0
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function onSelectLevel(row) {
  if (row) selectAndLoadQuestions(row)
}

async function selectAndLoadQuestions(row) {
  activeLevel.value = row
  qLoading.value = true
  try {
    const res = await fetchMannaQuizQuestions({ level_id: row.id, currentPage: 1, pageSize: 100 })
    qRows.value = res.results || []
  } catch (e) {
    ElMessage.error(e.message || e.msg || '题目加载失败')
  } finally {
    qLoading.value = false
  }
}

function openLevel(row) {
  levelForm.value = row
    ? { ...row }
    : {
        level_no: 1,
        title: '',
        time_limit_sec: 120,
        pass_score: 1,
        reward_manna: 30,
        fail_penalty: 10,
        sort_order: 0,
        enabled: true,
        app_key: appKey.value || 'manna',
        language: language.value || '',
        platform: platform.value || '',
      }
  levelVisible.value = true
}

async function saveLevel() {
  if (!(levelForm.value.title || '').trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (!(levelForm.value.app_key || '').trim()) {
    ElMessage.warning('请指定 App（禁止空维）')
    return
  }
  try {
    await saveMannaQuizLevel(levelForm.value)
    ElMessage.success('已保存')
    levelVisible.value = false
    loadLevels()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDeleteLevel(id) {
  try {
    await ElMessageBox.confirm('确认删除该关卡？', '提示', { type: 'warning' })
    await saveMannaQuizLevel({ delete_id: id })
    ElMessage.success('已删除')
    if (activeLevel.value?.id === id) {
      activeLevel.value = null
      qRows.value = []
    }
    loadLevels()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

function openQuestion(row) {
  if (!activeLevel.value) {
    ElMessage.warning('请先选择关卡（点击上方关卡行或「题目」）')
    return
  }
  qForm.value = row
    ? { ...row }
    : {
        level_id: activeLevel.value.id,
        qtype: 'single',
        stem: '',
        options: [{ key: 'A', text: '' }, { key: 'B', text: '' }],
        answer_key: 'A',
        bible_ref: {},
        explanation: '',
        sort_order: 0,
        enabled: true,
      }
  optionsText.value = JSON.stringify(qForm.value.options || [], null, 2)
  qVisible.value = true
}

function onNewQuestion() {
  openQuestion()
}

async function saveQuestion() {
  if (!(qForm.value.stem || '').trim() || !(qForm.value.answer_key || '').trim()) {
    ElMessage.warning('请填写题干与答案')
    return
  }
  try {
    qForm.value.options = JSON.parse(optionsText.value || '[]')
  } catch (e) {
    ElMessage.warning('选项 JSON 无效')
    return
  }
  try {
    await saveMannaQuizQuestion(qForm.value)
    ElMessage.success('已保存')
    qVisible.value = false
    selectAndLoadQuestions(activeLevel.value)
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDeleteQuestion(id) {
  try {
    await ElMessageBox.confirm('确认删除该题目？', '提示', { type: 'warning' })
    await saveMannaQuizQuestion({ delete_id: id })
    ElMessage.success('已删除')
    selectAndLoadQuestions(activeLevel.value)
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(loadLevels)
</script>
