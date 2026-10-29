<!--
  测验管理（Selah 3.0）：套题 CRUD + 题目编辑。
-->
<template>
  <div class="cms-page">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="Selah 自有测验；与顶部 App 切换到 Manna 后的「Manna Quiz」不是同一套，切错会改到另一品牌数据。"
    />
    <el-tabs v-model="panel" style="margin-bottom: 8px" @tab-change="onPanelChange">
      <el-tab-pane label="测验列表" name="list" />
      <el-tab-pane label="回收站" name="trash" />
    </el-tabs>
    <div class="container">
      <p v-if="panel === 'trash'" class="plugins-tips">软删除的测验可在此恢复；恢复后回到「测验列表」。</p>
      <div class="pro-toolbar">
        <div class="pro-toolbar-actions">
          <el-button v-if="panel === 'list'" type="primary" :icon="CirclePlusFilled" @click="open()">新建测验</el-button>
          <el-button v-else @click="load(1)">刷新回收站</el-button>
        </div>
      </div>
      <el-table :data="rows" v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="封面" width="80">
        <template #default="{ row }">
          <el-image
            v-if="row.cover_url"
            class="table-td-thumb"
            :src="row.cover_url"
            :preview-src-list="[row.cover_url]"
            preview-teleported
            fit="cover"
          />
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="140" />
      <el-table-column prop="subtitle" label="副标题" min-width="140" />
      <el-table-column prop="question_count" label="题数" width="70" />
      <el-table-column prop="is_vip" label="VIP" width="70">
        <template #default="{ row }">
          <el-tag :type="row.is_vip ? 'warning' : 'info'" size="small">{{ row.is_vip ? '是' : '否' }}</el-tag>
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
      <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
      <el-table-column prop="enabled" label="启用" min-width="90" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <template v-if="panel === 'trash'">
            <el-button link type="primary" @click="onRestore(row.id)">恢复</el-button>
          </template>
          <template v-else>
            <el-button link type="primary" @click="open(row)">编辑</el-button>
            <el-button link type="primary" @click="openQuestions(row)">管理题目</el-button>
            <el-button link type="danger" @click="onDelete(row.id)">删除</el-button>
          </template>
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
    </div>

    <el-dialog v-model="visible" :title="form.id ? '编辑测验' : '新建测验'" width="560px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="128" show-word-limit />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" maxlength="255" />
        </el-form-item>
        <el-form-item label="封面">
          <el-upload
            :show-file-list="false"
            :auto-upload="false"
            accept="image/*"
            :on-change="onUploadCover"
          >
            <el-button :loading="uploading" size="small">上传 COS</el-button>
          </el-upload>
          <el-input v-model="form.cover_url" placeholder="上传后自动填入 URL" style="margin-top: 8px" />
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部语言" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" /></el-form-item>
        <el-form-item label="VIP"><el-switch v-model="form.is_vip" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="qVisible"
      :title="`题目管理 · ${activeQuiz?.title || ''}`"
      width="720px"
      destroy-on-close
      @closed="onQuestionsClosed"
    >
      <div class="pro-toolbar" style="margin-top: 0">
        <div class="pro-toolbar-title">题目列表</div>
        <div class="pro-toolbar-actions">
          <el-button type="primary" size="small" :icon="CirclePlusFilled" @click="openQuestion()">新建题目</el-button>
        </div>
      </div>
      <el-table :data="qRows" v-loading="qLoading" max-height="360">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="stem" label="题干" min-width="200" />
        <el-table-column prop="correct_key" label="正解" width="70" />
        <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
        <el-table-column prop="enabled" label="启用" min-width="90" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" @click="openQuestion(row)">编辑</el-button>
            <el-button link type="danger" @click="onDeleteQuestion(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog
        v-model="qFormVisible"
        :title="qForm.id ? '编辑题目' : '新建题目'"
        width="560px"
        append-to-body
        destroy-on-close
      >
        <el-form label-width="90px">
          <el-form-item label="题干" required>
            <el-input v-model="qForm.stem" type="textarea" rows="2" maxlength="512" show-word-limit />
          </el-form-item>
          <el-form-item label="选项" required>
            <div class="opt-list">
              <div v-for="(opt, i) in qForm.options" :key="i" class="opt-row">
                <el-input v-model="opt.key" placeholder="key" style="width: 72px" />
                <el-input v-model="opt.text" placeholder="选项文案" style="flex: 1" />
                <el-button link type="danger" :disabled="qForm.options.length <= 2" @click="qForm.options.splice(i, 1)">删</el-button>
              </div>
              <el-button size="small" @click="qForm.options.push({ key: '', text: '' })">添加选项</el-button>
            </div>
          </el-form-item>
          <el-form-item label="正解" required>
            <el-select v-model="qForm.correct_key" style="width: 100%" placeholder="选择正确选项 key">
              <el-option
                v-for="opt in qForm.options.filter((o) => o.key)"
                :key="opt.key"
                :label="`${opt.key} · ${opt.text || ''}`"
                :value="opt.key"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="解析">
            <el-input v-model="qForm.explain" maxlength="512" />
          </el-form-item>
          <el-form-item label="排序"><el-input-number v-model="qForm.sort_order" :min="0" /></el-form-item>
          <el-form-item label="启用"><el-switch v-model="qForm.enabled" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button type="primary" @click="saveQuestion">保存</el-button>
        </template>
      </el-dialog>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 测验套题 + 嵌套题目编辑。
 * 列表空维省略参数=不过滤；选具体维才精确筛。
 */
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import {
  fetchQuizzes,
  saveQuiz,
  deleteQuiz,
  restoreQuiz,
  fetchQuizQuestions,
  saveQuizQuestion,
  deleteQuizQuestion,
  uploadFile,
} from '../api'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { LANG_OPTIONS } from '../utils/enumZh'
import { currentAppKey, shouldHidePlatform } from '../utils/productContext'

const panel = ref('list')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const uploading = ref(false)

const qVisible = ref(false)
const activeQuiz = ref(null)
const qRows = ref([])
const qLoading = ref(false)
const qFormVisible = ref(false)
const qForm = ref({})
const showPlat = !shouldHidePlatform()
const showTrash = computed(() => panel.value === 'trash')

function cacheKey() {
  return `quizzes_p${page.value}_${currentAppKey.value || ''}_t${showTrash.value ? 1 : 0}`
}

function onPanelChange() {
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    await loadWithCache(cacheKey(), async () => {
      const params = {
        currentPage: page.value,
        pageSize: 20,
        ...browseScopeParams(),
      }
      if (showTrash.value) params.trashed = 1
      const res = await fetchQuizzes(params)
      return {
        rows: res.results || [],
        total: res.pagination?.total || (res.results || []).length,
      }
    }, (data) => {
      rows.value = data.rows || []
      total.value = data.total || 0
    })
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function open(row) {
  form.value = row
    ? {
        ...row,
        app_key: row.app_key || '',
        language: row.language || '',
        platform: row.platform || '',
      }
    : {
        title: '',
        subtitle: '',
        cover_url: '',
        app_key: defaultCreateAppKey(),
        language: '',
        platform: '',
        sort_order: 0,
        is_vip: false,
        enabled: true,
      }
  visible.value = true
}

async function onUploadCover(file) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'selah/quizzes')
    const url = res.results?.url || res.data?.url
    if (!url) throw new Error('未返回 URL')
    form.value.cover_url = url
    ElMessage.success('已上传，封面 URL 已填入')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function save() {
  if (!(form.value.title || '').trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  try {
    await saveQuiz({
      ...form.value,
      app_key: defaultCreateAppKey(),
      platform: '',
    })
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
    await ElMessageBox.confirm('确认删除该测验？可在回收站恢复。', '删除确认', { type: 'warning' })
    await deleteQuiz(id)
    ElMessage.success('已移入回收站')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

async function onRestore(id) {
  try {
    await restoreQuiz(id)
    ElMessage.success('已恢复')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '恢复失败')
  }
}

async function openQuestions(row) {
  activeQuiz.value = row
  qVisible.value = true
  await loadQuestions()
}

function onQuestionsClosed() {
  activeQuiz.value = null
  qRows.value = []
}

async function loadQuestions() {
  if (!activeQuiz.value?.id) return
  qLoading.value = true
  try {
    const res = await fetchQuizQuestions({
      quiz_id: activeQuiz.value.id,
      currentPage: 1,
      pageSize: 100,
    })
    qRows.value = res.results || []
  } catch (e) {
    ElMessage.error(e.message || e.msg || '题目加载失败')
  } finally {
    qLoading.value = false
  }
}

function openQuestion(row) {
  qForm.value = row
    ? {
        ...row,
        options: (row.options || []).map((o) => ({ key: o.key || '', text: o.text || '' })),
      }
    : {
        quiz_id: activeQuiz.value.id,
        stem: '',
        options: [
          { key: 'a', text: '' },
          { key: 'b', text: '' },
        ],
        correct_key: 'a',
        explain: '',
        sort_order: qRows.value.length,
        enabled: true,
      }
  if (!qForm.value.options?.length) {
    qForm.value.options = [
      { key: 'a', text: '' },
      { key: 'b', text: '' },
    ]
  }
  qFormVisible.value = true
}

async function saveQuestion() {
  const stem = (qForm.value.stem || '').trim()
  if (!stem) {
    ElMessage.warning('请填写题干')
    return
  }
  const options = (qForm.value.options || [])
    .map((o) => ({ key: String(o.key || '').trim(), text: String(o.text || '').trim() }))
    .filter((o) => o.key)
  if (options.length < 2) {
    ElMessage.warning('至少需要 2 个有效选项（含 key）')
    return
  }
  const want = String(qForm.value.correct_key || '').trim().toLowerCase()
  const correctHit = options.find((o) => String(o.key || '').trim().toLowerCase() === want)
  if (!correctHit) {
    ElMessage.warning('正解必须命中某个选项 key')
    return
  }
  try {
    await saveQuizQuestion({
      ...qForm.value,
      quiz_id: activeQuiz.value.id,
      stem,
      options,
      correct_key: correctHit.key,
    })
    ElMessage.success('题目已保存')
    qFormVisible.value = false
    await loadQuestions()
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDeleteQuestion(id) {
  try {
    await ElMessageBox.confirm('确认删除该题目？', '删除确认', { type: 'warning' })
    await deleteQuizQuestion(id)
    ElMessage.success('已删除')
    await loadQuestions()
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(load)
watch(currentAppKey, () => load(1))
</script>

<style scoped>
.table-td-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
}
.opt-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.opt-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.pro-toolbar-actions {
  margin-left: auto;
}
</style>
