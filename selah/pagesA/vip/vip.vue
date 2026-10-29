<!--
  VIP 订阅试用页 — 复用 selah-vip-lock 全量面板（与 Feed 锁定弹层一致）
-->
<template>
	<selah-vip-lock
		mode="page"
		:pay-trigger-source="payTrigger"
		:lock-content-id="lockContentId"
		@close="goBack"
		@activated="onActivated"
	/>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { safeBack } from '@/utils/nav.js'

const payTrigger = ref('other')
const lockContentId = ref('')

onLoad((q) => {
	payTrigger.value = q.pay_trigger_source || 'other'
	try {
		lockContentId.value = Number(uni.getStorageSync('selah_vip_lock_content_id') || 0) || ''
	} catch (e) {
		lockContentId.value = ''
	}
})

function goBack() {
	safeBack('/pages/home/home')
}

function onActivated() {
	safeBack('/pages/home/home')
}
</script>

<style>
page {
	height: 100%;
	overflow: hidden;
	background: #fbf8f2;
}
</style>
