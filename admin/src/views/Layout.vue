<!--
  后台壳布局：Header + Sidebar + Tabs + router-view。
-->
<template>
  <div class="wrapper">
    <Header />
    <Sidebar />
    <div class="content-box" :class="{ 'content-collapse': sidebar.collapse }">
      <Tabs />
      <div class="content">
        <router-view v-slot="{ Component }">
          <transition name="move" mode="out-in">
            <component :is="Component" :key="$route.path" />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import Header from '../components/Header.vue'
import Sidebar from '../components/Sidebar.vue'
import Tabs from '../components/Tabs.vue'
import { useSidebarStore } from '../store/sidebar'
import { useAuthStore } from '../store/auth'
import { fetchMe } from '../api'

const sidebar = useSidebarStore()
const auth = useAuthStore()

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
    })
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
  transition: left 0.2s cubic-bezier(0.2, 0, 0, 1);
  background: var(--pro-bg-layout);
  overflow: hidden;
}

.content {
  width: auto;
  height: calc(100% - 40px);
  padding: 16px 24px 24px;
  overflow-y: auto;
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
</style>
