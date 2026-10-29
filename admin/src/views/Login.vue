<!--
  登录页：账号密码登录，写入 token/权限后跳转首个可访问路由。
-->
<template>
  <div class="login-bg">
    <div class="login-container">
      <div class="login-header">
        <img class="logo mr10" src="../assets/img/logo.svg" alt="" />
        <div class="login-title">Selah 运营后台</div>
      </div>
      <el-form :model="param" :rules="rules" ref="loginRef" size="large" @submit.prevent="submitForm">
        <el-form-item prop="username">
          <el-input v-model="param.username" placeholder="用户名">
            <template #prepend>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            type="password"
            placeholder="密码"
            v-model="param.password"
            show-password
            @keyup.enter="submitForm"
          >
            <template #prepend>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <div class="remember-row">
          <el-checkbox class="remember-check" v-model="checked" label="记住账号" />
        </div>
        <el-button class="login-btn" type="primary" size="large" :loading="loading" @click="submitForm">
          登录
        </el-button>
        <p class="login-tips">运营账号见 SELAH_DEV.md</p>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { adminLogin } from '../api'
import { useTabsStore } from '../store/tabs'
import { useAuthStore } from '../store/auth'
import { syncAppKeyToAllowed } from '../utils/productContext'

const router = useRouter()
const tabs = useTabsStore()
const auth = useAuthStore()
tabs.clearTabs()

const lgStr = localStorage.getItem('login-param')
const defParam = lgStr ? JSON.parse(lgStr) : null
const checked = ref(!!lgStr)
const loading = ref(false)
const loginRef = ref()

const param = reactive({
  username: defParam?.username || 'selah_admin',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

/**
 * 校验表单 → adminLogin → setSession(token/role/permissions)。
 * 「记住用户名」只存 login-param（不含密码）；登录成功跳转 /。
 */
async function submitForm() {
  const formEl = loginRef.value
  if (!formEl) return
  const valid = await formEl.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const res = await adminLogin(param.username, param.password)
    const data = res.results || {}
    auth.setSession({
      token: data.token,
      username: data.username || param.username,
      user_id: data.user_id,
      role: data.role,
      permissions: data.permissions || [],
      app_keys: data.app_keys || [],
    })
    syncAppKeyToAllowed(data.app_keys || [])
    if (checked.value) {
      localStorage.setItem('login-param', JSON.stringify({ username: param.username }))
    } else {
      localStorage.removeItem('login-param')
    }
    ElMessage.success('登录成功')
    router.push('/')
  } catch (e) {
    ElMessage.error(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-bg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  background: url(../assets/img/login-bg.jpg) center/cover no-repeat;
}

.login-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
}

.logo {
  width: 35px;
}

.login-title {
  font-size: 22px;
  color: #333;
  font-weight: bold;
}

.login-container {
  width: 450px;
  border-radius: 8px;
  background: #fff;
  padding: 40px 50px 50px;
  box-sizing: border-box;
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08), 0 9px 28px 0 rgba(0, 0, 0, 0.05),
    0 12px 48px 16px rgba(0, 0, 0, 0.03);
}

.remember-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  margin: -10px 0 10px;
  color: #787878;
}

.remember-check {
  height: auto;
}

.login-btn {
  display: block;
  width: 100%;
}

.login-tips {
  font-size: 12px;
  color: #999;
  margin-top: 12px;
}

:deep(.el-form-item.is-error) {
  margin-bottom: 42px;
}
</style>
