<template>
	<view class="lmini" hover-class="lmini--press" @click="expandListenMini">
		<view class="lmini__play" hover-class="lmini__play--press" @click.stop="toggleListenPlayback">
			<image
				class="lmini__ico"
				:class="{ 'lmini__ico--play': !listenSession.playing }"
				:src="listenSession.playing ? '/static/ui/bible/ico-pause.svg' : '/static/ui/bible/listen/ico-play.svg'"
				mode="aspectFit"
			/>
		</view>
		<view class="lmini__meta">
			<text class="lmini__t">{{ listenSession.bookName }} {{ listenSession.chapter }}</text>
			<text class="lmini__m">{{ fmtListenTime(listenSession.currentSec) }} / {{ fmtListenTime(listenSession.durationSec) }}</text>
		</view>
		<view class="lmini__close" hover-class="lmini__close--press" @click.stop="closeListenMini">
			<image class="lmini__x" src="/static/ui/ico-close.svg" mode="aspectFit" />
		</view>
	</view>
</template>

<script setup>
import {
	listenSession,
	fmtListenTime,
	toggleListenPlayback,
	closeListenMini,
	expandListenMini,
} from '@/utils/listenSession.js'
</script>

<style scoped lang="scss">
@import '../styles/manna-theme.scss';

.lmini {
	@include manna-listen-mini;
	margin-bottom: 16rpx;
}

.lmini--press { opacity: 0.92; }

.lmini__play {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background: #ffffff;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 16rpx;
	flex-shrink: 0;
	box-shadow: 0 8rpx 20rpx rgba(33, 33, 33, 0.12);
}

.lmini__play--press { opacity: 0.8; }

.lmini__ico {
	width: 36rpx;
	height: 36rpx;
}

.lmini__ico--play {
	filter: brightness(0);
	width: 28rpx;
	height: 28rpx;
	margin-left: 4rpx;
}

.lmini__meta { flex: 1; min-width: 0; }

.lmini__t {
	display: block;
	font-family: $manna-font-body;
	color: $manna-btn-text;
	font-weight: 700;
	font-size: 28rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.lmini__m {
	display: block;
	font-family: $manna-font-body;
	color: rgba(33, 33, 33, 0.45);
	font-size: 22rpx;
	margin-top: 4rpx;
}

.lmini__close {
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.lmini__close--press { opacity: 0.7; }

.lmini__x {
	width: 40rpx;
	height: 40rpx;
	filter: brightness(0) opacity(0.45);
}
</style>
