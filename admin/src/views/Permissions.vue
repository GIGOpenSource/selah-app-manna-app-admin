<!--
  权限管理：按角色配置模块权限矩阵；保存后需重新登录生效。
-->
<template>
  <div>
    <div class="container">
      <p class="plugins-tips">
        按角色配置可访问的后台模块。超级管理员始终拥有全部权限；保存后需对应账号重新登录生效于菜单。
      </p>
      <div class="pro-toolbar">
        <div class="pro-toolbar-title">权限矩阵</div>
      </div>
      <el-table :data="tableRows" v-loading="loading">
        <el-table-column prop="label" label="模块" min-width="180" fixed />
        <el-table-column
          v-for="role in roleKeys"
          :key="role"
          :label="roleLabels[role] || role"
          min-width="140"
          align="center"
        >
          <template #default="{ row }">
            <el-checkbox
              v-model="matrix[role][row.code]"
              :disabled="role === 'super_admin' || saving"
            />
          </template>
        </el-table-column>
      </el-table>
      <div class="actions">
        <el-button type="primary" :loading="saving" @click="save">保存权限</el-button>
        <el-button @click="load">重置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * RBAC 权限矩阵：行=权限目录 catalog，列=角色（operator/admin/super_admin）。
 * super_admin 强制全勾且不可缺列；保存时把勾选 map 压成 code 数组提交。
 */
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPermissions, savePermissions } from '../api'

const loading = ref(false)
const saving = ref(false)
const catalog = ref([])
const roleLabels = ref({})
/** matrix[role][code] = boolean 勾选态 */
const matrix = ref({})

const roleKeys = computed(() => Object.keys(matrix.value))
const tableRows = computed(() => catalog.value)

/**
 * 拉取权限：catalog + roles → 布尔矩阵。
 * 缺列补齐；super_admin 一律全 true。
 */
async function load() {
  loading.value = true
  try {
    const res = await fetchPermissions()
    const data = res.results || {}
    catalog.value = data.catalog || []
    roleLabels.value = data.role_labels || {}
    const roles = data.roles || {}
    const next = {}
    for (const [role, perms] of Object.entries(roles)) {
      next[role] = {}
      for (const item of catalog.value) {
        next[role][item.code] = (perms || []).includes(item.code)
      }
    }
    // 保证三列齐全
    for (const role of ['operator', 'admin', 'super_admin']) {
      if (!next[role]) {
        next[role] = {}
        for (const item of catalog.value) {
          next[role][item.code] = role === 'super_admin'
        }
      }
      if (role === 'super_admin') {
        for (const item of catalog.value) next[role][item.code] = true
      }
    }
    matrix.value = next
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

/** 将布尔矩阵压成 { role: [code, ...] } 整包保存 */
async function save() {
  saving.value = true
  try {
    const roles = {}
    for (const [role, map] of Object.entries(matrix.value)) {
      roles[role] = Object.keys(map).filter((code) => map[code])
    }
    await savePermissions(roles)
    ElMessage.success('权限已保存')
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.actions {
  display: flex;
  gap: 8px;
  padding: 16px 24px 24px;
}
</style>
