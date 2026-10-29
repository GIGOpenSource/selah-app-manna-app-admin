<!--
  后台壳布局：Header + Sidebar + Tabs + router-view。
-->
<template>
  <div class="wrapper">
    <Header />
    <Sidebar :key="currentAppKey" />
    <div class="content-box" :class="{ 'content-collapse': sidebar.collapse }">
      <Tabs />
      <el-alert
        v-if="appBanner"
        class="app-switch-banner"
        :type="appBanner.type"
        :closable="false"
        show-icon
        :title="appBanner.title"
      />
      <div class="content" ref="contentRef">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="`${$route.path}-${currentAppKey}`" />
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Header from '../components/Header.vue'
import Sidebar from '../components/Sidebar.vue'
import Tabs from '../components/Tabs.vue'
import { useSidebarStore } from '../store/sidebar'
import { useAuthStore } from '../store/auth'
import { fetchMe } from '../api'
import { currentAppKey, syncAppKeyToAllowed } from '../utils/productContext'
import { landingPathForApp } from '../components/menu'

const sidebar = useSidebarStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const contentRef = ref(null)

const appBanner = computed(() => {
  const app = currentAppKey.value
  const path = route.path || ''
  if (app === 'manna') {
    return {
      type: 'warning',
      title: '当前 App = Manna：标签 / Quiz / 配置会写到 Manna，不是 Selah。请确认后再改。',
    }
  }
  if (path.includes('/manna')) {
    return {
      type: 'warning',
      title: '你正在编辑 Manna 专属页面；与 Selah 标签库 / Selah Quiz 数据隔离。',
    }
  }
  if (app === 'selah') {
    return {
      type: 'info',
      title: '当前 App = selah（只读上下文）。语录 / 壁纸 / 标签统一维护 English；显性结构需确认发布后才同步 App。',
    }
  }
  return null
})

watch(
  () => route.path,
  async () => {
    await nextTick()
    if (contentRef.value) contentRef.value.scrollTop = 0
  },
)

watch(
  [currentAppKey, () => route.path],
  ([app, path]) => {
    const target = landingPathForApp(app, path)
    if (target && target !== path) router.replace(target)
  },
  { immediate: true },
)

/** 挂载时用 fetchMe 刷新会话权限；无 token 跳过；401 由 api 拦截器清会话并跳登录 */
onMounted(async () => {
  if (!localStorage.getItem('admin_token')) return
  try {
    const res = await fetchMe()
    const data = res.results || {}
    auth.setSession({
      username: data.username,
      user_id: data.user_id,
      role: data.role,
      permissions: data.permissions || [],
      app_keys: data.app_keys || [],
    })
    syncAppKeyToAllowed(data.app_keys || [])
  } catch {
    // HTTP/业务 401 已在 axios 拦截器处理；其它错误不阻断页面
  }
})
</script>

<style>
.wrapper {
  height: 100vh;
  overflow: hidden;
  background: var(--pro-bg-layout);
}

.content-box {
  position: absolute;
  left: 208px;
  right: 0;
  top: var(--pro-header-height);
  bottom: 0;
  padding-bottom: 0;
  background: var(--pro-bg-layout);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content {
  width: auto;
  flex: 1;
  min-height: 0;
  padding: 16px 24px 24px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  box-sizing: border-box;
}

.content::-webkit-scrollbar {
  width: 6px;
}

.content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

.content-collapse {
  left: 64px;
}

.app-switch-banner {
  margin: 8px 16px 0;
}
</style>
