<!--
  兼容旧路由：重定向到 icons 选择页。
-->
<template>
	<view />
</template>

<script setup>
import { onLoad } from '@dcloudio/uni-app'

onLoad((q) => {
	const from = q?.from === 'profile' ? '?from=profile' : ''
	uni.redirectTo({
		url: `/pagesA/icons/icons${from}`,
	})
})
</script>
