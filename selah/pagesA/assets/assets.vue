<!--
  我的资产：喜欢/收藏/历史/肯定语；收藏夹管理、清空历史。
-->
<template>
	<page-meta :overflow="collectPageOverflow" :page-style="collectPageStyle" />
	<view :class="['page-wrap', isFeedOpen ? 'page-wrap-feed' : '', collectDockPinned ? 'dock-pinned' : '', collectDockPinned && searchKeyboardOpen ? 'kb-open' : '']">
	<view :class="['page', (isCollectUi || (isAffirmUi && !affComposeOpen)) ? 'page-collect' : '', folderDialogOpen ? 'page-collect-form' : '', isFeedOpen ? 'page-feed' : '', affComposeOpen ? 'page-aff-compose' : '']" :style="collectPagePadStyle">
		<template v-if="isFeedOpen">
			<image v-if="feedBgUrl && !feedBgVideoUrl" class="bg" :src="feedBgUrl" mode="aspectFill" @error="onFeedBgError" />
			<video
				v-if="feedBgVideoUrl"
				id="collectBgVideo"
				class="bg bg-video"
				:src="feedBgVideoUrl"
				:autoplay="true"
				:loop="true"
				:muted="true"
				:controls="false"
				:playsinline="true"
				:show-center-play-btn="false"
				:show-play-btn="false"
				:show-fullscreen-btn="false"
				:show-mute-btn="false"
				:show-loading="false"
				:enable-progress-gesture="false"
				object-fit="cover"
			/>
			<view class="veil" />
			<view class="page-head feed-head" :style="{ paddingTop: statusBarPx + 'px' }">
				<view class="custom-nav collect-nav">
					<view class="collect-nav-left">
						<view class="collect-back-hit" @click.stop="closeFeed">
							<image class="collect-back" src="/static/ui/ico-back.svg" mode="aspectFit" />
						</view>
						<text class="collect-title">{{ pageTitle }}</text>
					</view>
				</view>
			</view>
			<swiper
				class="feed"
				vertical
				:current="feedCurrent"
				:duration="280"
				:circular="false"
				:disable-touch="true"
				@change="onFeedSwipe"
			>
				<swiper-item v-for="(q, idx) in feedList" :key="assetRowKey(q, idx)">
					<!-- 与首页一致：关掉原生跟手，自定义竖滑切页；长文 scroll-view 仅在触顶/触底时把滑动交给切页 -->
					<view
						class="card"
						@touchstart="onFeedTouchStart"
						@touchmove.stop.prevent="onFeedTouchMove"
						@touchend="onFeedTouchEnd"
						@touchcancel="onFeedTouchEnd"
						@longpress="onQuoteLongpress(q)"
					>
						<view class="quote-block">
							<scroll-view
								scroll-y
								:class="['quote-scroll', idx === feedCurrent ? 'is-on' : '']"
								:scroll-top="idx === feedCurrent ? feedQuoteScrollTop : 0"
								:show-scrollbar="false"
								:enable-flex="true"
								@scroll="onFeedQuoteScroll(idx, $event)"
								@touchstart.stop="onFeedQuoteTouchStart(idx, $event)"
								@touchmove.stop="onFeedQuoteTouchMove"
								@touchend.stop="onFeedQuoteTouchEnd(idx, $event)"
								@touchcancel.stop="onFeedQuoteTouchEnd(idx, $event)"
							>
								<view class="quote-inner">
									<text class="quote">{{ q.content }}</text>
									<text v-if="feedCite(q)" class="cite">-{{ feedCite(q) }}</text>
								</view>
							</scroll-view>
						</view>
					</view>
				</swiper-item>
			</swiper>
			<view v-if="feedQuote" class="mid-actions">
				<view class="icon-btn" @click.stop="onFeedShare">
					<image class="act-img" src="/static/ui/ico-share.svg" mode="aspectFit" />
				</view>
				<view class="icon-btn" @click.stop="onFeedLike">
					<image
						class="act-img"
						:src="isFeedLiked ? '/static/ui/like-current.svg' : '/static/ui/like.svg'"
						mode="aspectFit"
					/>
				</view>
			</view>
		</template>

		<template v-else>
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" :class="{ 'head-glass-collect': isCollectUi || (isAffirmUi && !affComposeOpen), 'head-glass-compose': affComposeOpen }" />
			<view v-if="isCollectUi && folderDialogOpen" class="custom-nav history-nav">
				<view class="nav-pill" @click.stop="onNavBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="collect-form-title">{{ collectNavTitle }}</text>
				<view class="nav-spacer" />
			</view>
			<view v-else-if="isCollectUi" class="custom-nav collect-nav">
				<view class="collect-nav-left">
					<view class="collect-back-hit" @click.stop="onNavBack">
						<image class="collect-back" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="collect-title">{{ collectNavTitle }}</text>
				</view>
				<view v-if="collectBrowse"
					class="collect-add"
					@click.stop="openFolderDialog('create')"
				>
					<text class="collect-add-text">{{ t('add_new') }}</text>
				</view>
				<view v-else class="collect-nav-right">
					<view class="collect-tool-pill">
						<view class="collect-ico-hit" @click.stop="openCollectSortSheet">
							<image class="collect-tool-ico" src="/static/ui/ico-sort.svg" mode="aspectFit" />
						</view>
						<view class="collect-ico-hit" @click.stop="openCollectMoreMenu">
							<image class="collect-tool-ico" src="/static/ui/ico-ellipsis.svg" mode="aspectFit" />
						</view>
					</view>
					<view
						:class="['collect-follow', collectFollowed ? 'on' : '']"
						@click.stop="toggleCollectFollow"
					>
						<text class="collect-follow-text">{{ collectFollowed ? t('following') : t('follow') }}</text>
					</view>
				</view>
			</view>
			<view v-else-if="isAffirmUi && affComposeOpen" class="custom-nav">
				<view class="nav-pill" @tap.stop="onNavBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title">{{ affNavTitle }}</text>
				<view class="nav-spacer" />
			</view>
			<view v-else-if="isHistoryUi" class="custom-nav history-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="history-title">{{ pageTitle }}</text>
				<text
					v-if="list.length"
					class="hist-clear"
					@click.stop="clearHistoryConfirm"
				>{{ t('clear_history') }}</text>
				<view v-else class="nav-spacer" />
			</view>
			<view v-else-if="isAffirmUi" class="custom-nav collect-nav">
				<view class="collect-nav-left">
					<view class="collect-back-hit" @click.stop="onNavBack">
						<image class="collect-back" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<text class="collect-title">{{ affNavTitle }}</text>
				</view>
				<view class="collect-nav-right">
					<view
						v-if="!affirmations.length && !affQuery"
						class="collect-add"
						@click.stop="openAffCompose()"
					>
						<text class="collect-add-text">{{ t('add') }}</text>
					</view>
					<view v-else class="collect-tool-pill">
						<view class="collect-ico-hit" @click.stop="openAffSortSheet">
							<image class="collect-tool-ico" src="/static/ui/ico-sort.svg" mode="aspectFit" />
						</view>
					</view>
					<view
						v-if="affirmations.length"
						:class="['collect-follow', affFollowed ? 'on' : '', affFollowBusy ? 'busy' : '']"
						@click.stop="toggleAffFollow"
					>
						<text class="collect-follow-text">{{ affFollowed ? t('following') : t('follow') }}</text>
					</view>
				</view>
			</view>
			<view v-else class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ pageTitle }}</text>
				<view class="nav-spacer" />
			</view>
		</view>

		<view v-if="isCollectUi && folderDialogOpen" class="collect-form">
			<text v-if="folderDialogMode !== 'rename'" class="collect-form-hint">{{ t('new_collection_hint') }}</text>
			<input
				:key="'fn-' + folderDialogMode + '-' + (folderId || 'new')"
				class="collect-input"
				type="text"
				:value="folderDialogName"
				:placeholder="t('new_collection_placeholder')"
				placeholder-class="collect-input-ph"
				:maxlength="64"
				:focus="true"
				:adjust-position="false"
				confirm-type="done"
				@input="onFolderNameInput"
				@confirm="onFolderDialogConfirm"
			/>
			<view class="collect-form-dock" :style="{ bottom: collectSaveBottom }">
				<view
					:class="['collect-cta', canSaveFolder ? '' : 'disabled']"
					@click.stop="onFolderDialogConfirm"
				>
					<text class="collect-cta-text">{{ t('save') }}</text>
				</view>
			</view>
		</view>

		<view v-else-if="isAffirmUi && affComposeOpen" class="aff-form">
			<view class="aff-card">
				<textarea
					class="aff-quote-input"
					:value="draft"
					:placeholder="t('quote_placeholder')"
					placeholder-class="aff-quote-ph"
					:maxlength="160"
					:show-confirm-bar="false"
					:focus="true"
					@input="onAffDraftInput"
				/>
				<input
					class="aff-author-input"
					type="text"
					:value="authorDraft"
					:placeholder="t('author_optional')"
					placeholder-class="aff-author-ph"
					:maxlength="64"
					@input="onAffAuthorInput"
				/>
				<view class="aff-card-hint-wrap">
					<text class="aff-card-hint">{{ t('quote_private_hint') }}</text>
				</view>
			</view>
			<view
				:class="['collect-cta', canSaveAff ? '' : 'disabled']"
				@click.stop="onSaveAff"
			>
				<text class="collect-cta-text">{{ t('save') }}</text>
			</view>
		</view>

		<scroll-view v-else-if="isAffirmUi" scroll-y class="aff-pane page-body-scroll" :style="pageBodyScrollStyle" :show-scrollbar="false">
			<view v-if="affSearching" class="aff-search-loading">
				<view class="list-spinner" />
			</view>
			<view v-else-if="!affVisibleList.length" class="collect-empty">
				<view class="collect-empty-main">
					<image class="collect-empty-art aff-empty-art" src="/static/ui/art-own-quotes-book.svg" mode="aspectFit" />
					<text class="collect-empty-title">{{
						affQuery.trim() ? t('empty') : t('own_quotes_empty_title')
					}}</text>
				</view>
				<view
					v-if="!affQuery.trim()"
					class="collect-cta collect-empty-cta"
					@click.stop="openAffCompose()"
				>
					<text class="collect-cta-text">{{ t('add_quote') }}</text>
				</view>
			</view>
			<template v-else>
				<view
					v-if="affVisibleList.length"
					class="collect-cta ghost collect-feed-cta"
					@click.stop="openAffFeed"
				>
					<text class="collect-cta-text">{{ t('show_all_in_feed') }}</text>
				</view>
				<view v-for="a in affVisibleList" :key="assetRowKey(a)" class="q q-collect">
					<view class="q-aff-top">
						<view class="q-aff-copy">
							<text class="q-body">{{ a.content }}</text>
							<text v-if="affAuthor(a)" class="q-cite">-{{ affAuthor(a) }}</text>
						</view>
						<view class="q-card-more" @click.stop="openAffCardMenu(a)">
							<image class="q-card-more-ico" src="/static/ui/ico-ellipsis.svg" mode="aspectFit" />
						</view>
					</view>
					<view class="q-collect-foot">
						<text v-if="assetDayPretty(a)" class="q-date q-date-inline">{{ assetDayPretty(a) }}</text>
						<view class="icon-actions icon-actions-inline">
							<view class="ico-hit" @click.stop="onLikeHit(a)">
								<image
									class="row-ico"
									:src="isLiked(a) ? '/static/ui/like-current.svg' : '/static/ui/like.svg'"
									mode="aspectFit"
								/>
							</view>
							<view class="ico-hit" @click.stop="onCollectHit(a)">
								<image
									class="row-ico"
									:src="isCollected(a) ? '/static/ui/collect-curretn.svg' : '/static/ui/collect.svg'"
									mode="aspectFit"
								/>
							</view>
							<view class="ico-hit" @click.stop="onShareHit(a)">
								<image class="row-ico" src="/static/ui/ico-share.svg" mode="aspectFit" />
							</view>
						</view>
					</view>
				</view>
				<view class="search-spacer search-spacer-aff" :style="affSearchSpacerStyle" />
			</template>
		</scroll-view>

		<scroll-view v-else-if="collectBrowse" scroll-y class="collect-browse page-body-scroll" :style="pageBodyScrollStyle" :show-scrollbar="false">
			<view v-if="foldersReady && !folders.length" class="collect-empty">
				<view class="collect-empty-main">
					<image class="collect-empty-art" src="/static/ui/art-collection-bookmark.svg" mode="aspectFit" />
					<text class="collect-empty-title">{{ t('collections_empty_title') }}</text>
					<text class="collect-empty-desc">{{ t('collections_empty_desc') }}</text>
				</view>
				<view
					class="collect-cta collect-empty-cta"
					@click.stop="openFolderDialog('create')"
				>
					<text class="collect-cta-text">{{ t('create_collection') }}</text>
				</view>
			</view>
			<view
				v-for="f in folders"
				:key="f.id"
				class="collect-row"
				@click.stop="openFolder(f)"
				@longpress="folderActions(f)"
			>
				<view class="collect-row-copy">
					<text class="collect-row-name">{{ folderLabel(f) }}</text>
					<text class="collect-row-meta">{{ folderMeta(f) }}</text>
				</view>
				<image class="collect-row-chevron" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</scroll-view>

		<scroll-view
			v-else-if="isCollectUi"
			scroll-y
			class="collect-scroll"
			:bounces="false"
			:show-scrollbar="false"
		>
			<view
				v-if="kind === 'collect' && collectVisibleList.length"
				class="collect-cta collect-feed-cta"
				@click.stop="openCollectFeed"
			>
				<text class="collect-cta-text">{{ t('show_all_in_feed') }}</text>
			</view>
			<view
				v-for="q in visibleQuotes"
				:key="assetRowKey(q)"
				:class="['q', (kind === 'collect' || kind === 'history' || kind === 'like') ? 'q-collect' : '']"
				@longpress="onQuoteLongpress(q)"
			>
				<text class="q-body">{{ q.content }}</text>
				<text v-if="quoteSource(q)" class="q-cite">{{ citeMark(q) }}{{ quoteSource(q) }}</text>
				<view v-if="kind === 'collect' || kind === 'history' || kind === 'like'" class="q-collect-foot">
					<text v-if="kind === 'like' ? assetDay(q) : assetDayPretty(q)" class="q-date q-date-inline">{{
						kind === 'like' ? assetDay(q) : assetDayPretty(q)
					}}</text>
					<view v-else class="q-date q-date-inline" />
					<view class="icon-actions icon-actions-inline">
						<view class="ico-hit" @click.stop="onLikeHit(q)">
							<image
								class="row-ico"
								:src="isLiked(q) ? '/static/ui/like-current.svg' : '/static/ui/like.svg'"
								mode="aspectFit"
							/>
						</view>
						<view class="ico-hit" @click.stop="onCollectHit(q)">
							<image
								class="row-ico"
								:src="isCollected(q) ? '/static/ui/collect-curretn.svg' : '/static/ui/collect.svg'"
								mode="aspectFit"
							/>
						</view>
						<view class="ico-hit" @click.stop="onShareHit(q)">
							<image class="row-ico" src="/static/ui/ico-share.svg" mode="aspectFit" />
						</view>
					</view>
				</view>
				<template v-else>
					<text v-if="assetDay(q)" class="q-date">{{ assetDay(q) }}</text>
					<view class="icon-actions">
						<view class="ico-hit" @click.stop="onLikeHit(q)">
							<image
								class="row-ico"
								:src="isLiked(q) ? '/static/ui/like-current.svg' : '/static/ui/like.svg'"
								mode="aspectFit"
							/>
						</view>
						<view class="ico-hit" @click.stop="onCollectHit(q)">
							<image
								class="row-ico"
								:src="isCollected(q) ? '/static/ui/collect-curretn.svg' : '/static/ui/collect.svg'"
								mode="aspectFit"
							/>
						</view>
						<view class="ico-hit" @click.stop="onShareHit(q)">
							<image class="row-ico" src="/static/ui/ico-share.svg" mode="aspectFit" />
						</view>
					</view>
				</template>
			</view>
			<view
				v-if="loadingMore && !visibleQuotes.length"
				class="empty"
				:class="{ 'collect-folder-empty': kind === 'collect' }"
			>
				<view class="list-spinner" />
			</view>
			<view
				v-else-if="!loadingMore && !visibleQuotes.length"
				class="empty"
				:class="{ 'collect-folder-empty': kind === 'collect', 'likes-empty': kind === 'like' }"
			>
				<template v-if="kind === 'collect'">
					<image class="collect-empty-art collect-folder-art" src="/static/ui/art-collection-bookmark.svg" mode="aspectFit" />
					<text class="collect-empty-title">{{
						collectQuery.trim() ? t('empty') : t('collection_empty_title')
					}}</text>
				</template>
				<template v-else-if="kind === 'like'">
					<image class="empty-art" src="/static/ui/themes/like.png" mode="aspectFill" />
					<text class="likes-empty-title">{{ t('likes_empty_title') }}</text>
				</template>
				<template v-else>
					<image
						class="empty-art"
						src="/static/ui/themes/like.png"
						mode="aspectFill"
					/>
					<text>{{ t('empty') }}</text>
				</template>
			</view>
			<view v-if="kind === 'collect' && (list.length || collectQuery)" class="search-spacer" :style="collectSearchSpacerStyle" />
		</scroll-view>
		<scroll-view v-else scroll-y class="page-body-scroll" :style="pageBodyScrollStyle" :show-scrollbar="false">
			<view
				v-for="q in visibleQuotes"
				:key="assetRowKey(q)"
				:class="['q', (kind === 'history' || kind === 'like') ? 'q-collect' : '']"
				@longpress="onQuoteLongpress(q)"
			>
				<text class="q-body">{{ q.content }}</text>
				<text v-if="quoteSource(q)" class="q-cite">{{ citeMark(q) }}{{ quoteSource(q) }}</text>
				<view v-if="kind === 'history' || kind === 'like'" class="q-collect-foot">
					<text v-if="kind === 'like' ? assetDay(q) : assetDayPretty(q)" class="q-date q-date-inline">{{
						kind === 'like' ? assetDay(q) : assetDayPretty(q)
					}}</text>
					<view v-else class="q-date q-date-inline" />
					<view class="icon-actions icon-actions-inline">
						<view class="ico-hit" @click.stop="onLikeHit(q)">
							<image
								class="row-ico"
								:src="isLiked(q) ? '/static/ui/like-current.svg' : '/static/ui/like.svg'"
								mode="aspectFit"
							/>
						</view>
						<view class="ico-hit" @click.stop="onCollectHit(q)">
							<image
								class="row-ico"
								:src="isCollected(q) ? '/static/ui/collect-curretn.svg' : '/static/ui/collect.svg'"
								mode="aspectFit"
							/>
						</view>
						<view class="ico-hit" @click.stop="onShareHit(q)">
							<image class="row-ico" src="/static/ui/ico-share.svg" mode="aspectFit" />
						</view>
					</view>
				</view>
			</view>
			<view v-if="loadingMore && !visibleQuotes.length" class="empty" :class="{ 'likes-empty': kind === 'like' }">
				<view class="list-spinner" />
			</view>
			<view
				v-else-if="!loadingMore && !visibleQuotes.length"
				class="empty"
				:class="{ 'likes-empty': kind === 'like' }"
			>
				<template v-if="kind === 'like'">
					<image class="empty-art" src="/static/ui/themes/like.png" mode="aspectFill" />
					<text class="likes-empty-title">{{ t('likes_empty_title') }}</text>
				</template>
				<template v-else>
					<image class="empty-art" src="/static/ui/themes/like.png" mode="aspectFill" />
					<text>{{ t('empty') }}</text>
				</template>
			</view>
		</scroll-view>
		<view v-if="loadingMore && visibleQuotes.length" class="tip">...</view>
		</template>
	</view>

		<view
			v-if="isAffirmUi && !affComposeOpen && !affFeedOpen && (affirmations.length || affSearchDraft || affQuery)"
			class="search-dock affirm-dock"
			:class="{ 'search-dock-kb': searchKeyboardOpen }"
			:style="{ bottom: searchDockBottom }"
		>
			<view
				v-if="!searchKeyboardOpen"
				class="collect-cta"
				@click.stop="openAffCompose()"
			>
				<text class="collect-cta-text">{{ t('add_quote') }}</text>
			</view>
			<view class="search-bar">
				<image class="search-ico" src="/static/ui/explore/ico-search.svg" mode="aspectFit" />
				<input
					v-model="affSearchDraft"
					class="search-input"
					:placeholder="t('search')"
					confirm-type="search"
					:adjust-position="false"
					:hold-keyboard="true"
					:disabled="affSearching"
					placeholder-class="search-ph"
					@confirm="onAffSearchConfirm"
					@focus="onOwnSearchFocus"
					@blur="onSearchBlur"
				/>
				<view v-if="affSearching" class="search-spin" />
			</view>
		</view>

		<view
			v-if="isCollectUi && !collectBrowse && !folderDialogOpen && !collectFeedOpen && (list.length || collectSearchDraft || collectQuery)"
			class="search-dock collect-search-dock"
			:class="{ 'search-dock-kb': searchKeyboardOpen }"
		>
			<view class="search-bar">
				<image class="search-ico" src="/static/ui/explore/ico-search.svg" mode="aspectFit" />
				<input
					v-model="collectSearchDraft"
					class="search-input"
					:placeholder="t('search')"
					confirm-type="search"
					:adjust-position="false"
					:hold-keyboard="true"
					:disabled="collectSearching"
					placeholder-class="search-ph"
					@confirm="onCollectSearchConfirm"
					@focus="onCollectSearchFocus"
					@blur="onSearchBlur"
				/>
				<view v-if="collectSearching" class="search-spin" />
			</view>
		</view>
		<view
			v-if="isCollectUi && !collectBrowse && !folderDialogOpen && !collectFeedOpen && (list.length || collectSearchDraft || collectQuery)"
			class="collect-kb-spacer"
			:style="{ height: (searchKeyboardOpen ? keyboardLiftPx : 0) + 'px' }"
		/>

		<selah-sheet
			v-model:visible="collectSortSheetOpen"
			v-model="collectSort"
			:items="collectSortItems"
			:cancel-text="t('cancel')"
			@select="onCollectSortSelect"
			@cancel="onCollectSortCancel"
		/>
		<selah-sheet
			v-model:visible="folderSheetOpen"
			:title="t('more')"
			:items="folderSheetItems"
			:cancel-text="t('cancel')"
			@select="onFolderSheetSelect"
		/>
		<selah-sheet
			v-model:visible="affSortSheetOpen"
			:items="affSortItems"
			:cancel-text="t('cancel')"
			@select="onAffSortSelect"
			@cancel="onAffSortCancel"
		/>
		<selah-sheet
			v-model:visible="affCardSheetOpen"
			:items="affCardItems"
			:cancel-text="t('cancel')"
			@select="onAffCardSelect"
		/>
		<selah-sheet
			v-model:visible="moveSheetOpen"
			:title="collectSheetMode === 'collect' ? t('add_to_collection') : t('move_folder')"
			:items="moveSheetItems"
			:cancel-text="t('cancel')"
			@select="onMoveSheetSelect"
			@cancel="onMoveSheetCancel"
		/>
		<view
			v-if="saveToastOpen"
			class="save-toast"
			:style="{ top: saveToastTop }"
		>
			<text class="save-toast-text">{{ saveToastText }}</text>
			<view class="save-toast-btn" @click.stop="onSaveToastChange">
				<text class="save-toast-btn-text">{{ t('change') }}</text>
			</view>
		</view>

		<selah-dialog
			v-model:visible="folderDeleteOpen"
			:title="folderDeleteTitle"
			:content="t('folder_delete_confirm')"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="confirmFolderDelete"
			@cancel="closeFolderDelete"
		/>
		<selah-dialog
			v-if="!isCollectUi"
			v-model:visible="folderDialogOpen"
			v-model:prompt-value="folderDialogName"
			editable
			:title="folderDialogMode === 'rename' ? t('rename') : t('new_folder')"
			:placeholder="t('folder_name')"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="onFolderDialogConfirm"
		/>
		<selah-dialog
			v-model:visible="clearDialogOpen"
			:title="t('clear_history')"
			:content="t('clear_history_confirm')"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="doClearHistory"
			@cancel="onClearHistoryCancel"
		/>
	</view>
</template>

<script setup>
/**
 * 我的资产：点赞/收藏/历史/肯定语；收藏夹 CRUD 与移动。
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { onBackPress, onPageScroll } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useKeyboardLift } from '@/utils/keyboardLift.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import {
	getActiveWallpaper, wallpaperDisplayUrl, wallpaperOverlayVideoUrl,
	FALLBACK_WALLPAPER, playWallpaperVideo,
} from '@/utils/wallpaperCache.js'
import { useAssetsFolders } from './useAssetsFolders.js'
import { useAssetsList } from './useAssetsList.js'
import { logFirebaseEvent } from '@/utils/firebase.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle } = useCollapsingTitle({
	mode: 'bar',
	statusBarPx,
	fontStartRpx: 40,
	fontEndRpx: 34,
	leftStartPercent: 16,
})

/** 列表与收藏夹共用的核心状态 */
const kind = ref('like')
const list = ref([])
const hasMore = ref(true)
const loadingMore = ref(false)
/** 跨 composable 回填：load / invalidateListCache / patchRow / setLoading */
const deps = {}

const folder = useAssetsFolders({
	t,
	kind,
	list,
	loadingMore,
	hasMore,
	deps,
})
const {
	folders,
	foldersReady,
	folderId,
	savingFolder,
	collectBrowse,
	openFolderMeta,
	folderSheetOpen,
	folderSheetItems,
	moveSheetOpen,
	moveSheetItems,
	collectSheetMode,
	folderDialogOpen,
	folderDialogMode,
	folderDialogName,
	folderDeleteOpen,
	folderDeleteTarget,
	openFolder,
	folderLabel,
	folderMeta,
	openFolderDialog,
	closeFolderDialog,
	onFolderDialogConfirm,
	confirmFolderDelete,
	closeFolderDelete,
	folderActions,
	openCollectMoreMenu,
	onFolderSheetSelect,
	toggleFolderFollow,
	moveCollect,
	openCollectFolderSheet,
	onMoveSheetSelect,
	patchFolderCount,
} = folder

const folderDeleteTitle = computed(() => {
	const name = folderLabel(folderDeleteTarget.value) || t('collections')
	const raw = t('folder_delete_title', { name })
	return String(raw).replace('{name}', name)
})

const affSort = ref('newest')
const collectSort = ref('newest')
const listSort = computed(() => (
	kind.value === 'collect' ? collectSort.value : affSort.value
))
const assets = useAssetsList({
	t,
	kind,
	list,
	hasMore,
	loadingMore,
	folderId,
	collectBrowse,
	openFolderMeta,
	folderLabel,
	loadFolders: folder.loadFolders,
	openCollectFolderSheet,
	deps,
	patchFolderCount,
	listSort,
})
const {
	affirmations,
	affFollowed,
	affFollowBusy,
	toggleAffFollow,
	draft,
	authorDraft,
	editingId,
	savingAff,
	draftLen,
	affAuthor,
	pageTitle,
	clearDialogOpen,
	filteredList,
	load,
	invalidateListCache,
	goBack,
	clearHistoryConfirm,
	doClearHistory,
	editAff,
	cancelEditAff,
	saveAff,
	delAff,
	goShareAff,
	quoteSource,
	assetDay,
	assetDayPretty,
	assetStamp,
	isLiked,
	isCollected,
	isAffirmationItem,
	assetRowKey,
	citeMark,
	onLikeHit,
	onCollectHit,
	onShareHit,
} = assets

function fb(name, params) {
	try { logFirebaseEvent(name, params) } catch (e) {}
}
deps.folders = folders
deps.folderName = () => (openFolderMeta.value ? folderLabel(openFolderMeta.value) : '')

const isCollectUi = computed(() => kind.value === 'collect')
const isAffirmUi = computed(() => kind.value === 'affirmation')
const isHistoryUi = computed(() => kind.value === 'history')
const collectQuery = ref('')
const collectSearchDraft = ref('')
const collectSearching = ref(false)
const collectSortSheetOpen = ref(false)
const collectFollowed = computed(() => !!(openFolderMeta.value && openFolderMeta.value.followed))
const collectFeedOpen = ref(false)
const collectFeedCurrent = ref(0)
const affComposeOpen = ref(false)
const affFeedOpen = ref(false)
const affFeedCurrent = ref(0)
const affQuery = ref('')
const affSearchDraft = ref('')
const affSearching = ref(false)
const affSortSheetOpen = ref(false)
const affCardSheetOpen = ref(false)
const affCardTarget = ref(null)
const feedBgUrl = ref('')
const feedBgVideoUrl = ref('')
/** 信息流长文滚动：与切页手势协调（触顶/触底才切下一条） */
const feedQuoteScrollTop = ref(0)
const feedQuoteMetric = ref({ top: 0, height: 0, viewH: 0 })
let feedTouchY = 0
let feedQuoteStartAtTop = true
let feedQuoteStartAtBottom = true
let feedNavAt = 0

const collectDockPinned = computed(() => (
	isCollectUi.value
	&& !collectBrowse.value
	&& !folderDialogOpen.value
	&& !collectFeedOpen.value
	&& !!(list.value.length || collectSearchDraft.value || collectQuery.value)
))
const collectPageOverflow = computed(() => (collectDockPinned.value ? 'hidden' : 'visible'))
const collectPageStyle = computed(() => (
	collectDockPinned.value
		? 'overflow:hidden;height:100%;width:100%;position:fixed;top:0;left:0;background:#ffffff;'
		: ''
))
const collectHeadPx = computed(() => {
	const nav = typeof uni.upx2px === 'function' ? uni.upx2px(96) : 48
	return statusBarPx + nav
})
const collectPagePadStyle = computed(() => ({}))
const pageBodyScrollStyle = computed(() => {
	try {
		const info = uni.getSystemInfoSync() || {}
		const windowHeight = Number(info.windowHeight) || 0
		const height = windowHeight - collectHeadPx.value
		if (height > 160) return { height: `${Math.floor(height)}px` }
	} catch (e) {}
	return { height: '70vh' }
})

const collectNavTitle = computed(() => {
	if (folderDialogOpen.value) {
		return folderDialogMode.value === 'rename' ? t('rename') : t('new_collection')
	}
	return pageTitle.value
})

const affNavTitle = computed(() => {
	if (affComposeOpen.value) return editingId.value ? t('edit') : t('add_a_quote')
	return pageTitle.value
})

const canSaveFolder = computed(() => !!(folderDialogName.value || '').trim() && !savingFolder.value)
const canSaveAff = computed(() => !!(draft.value || '').trim() && !savingAff.value)
const {
	liftPx: keyboardLiftPx,
	open: searchKeyboardOpen,
	rawPx: keyboardRawPx,
	reset: resetKeyboardLift,
	refresh: refreshKeyboardLift,
} = useKeyboardLift({ selector: '.collect-search-dock, .affirm-dock' })

const collectSaveBottom = computed(() => {
	if (searchKeyboardOpen.value) return `calc(${keyboardLiftPx.value + 16}px + 100rpx)`
	return 'calc(34vh + 100rpx)'
})

/** 肯定语搜索条仍按键盘差额抬。收藏搜索条改贴在可视区域底部，不跟页面滚。 */
const searchDockBottom = computed(() => {
	if (searchKeyboardOpen.value) return `${keyboardLiftPx.value + 8}px`
	return 'calc(16rpx + env(safe-area-inset-bottom))'
})

const collectFrameTop = ref(0)
const collectFrameHeight = ref(0)

function readWindowHeight() {
	try {
		if (typeof window !== 'undefined' && window.innerHeight > 0) return Math.round(window.innerHeight)
	} catch (e) {}
	try {
		return Number((uni.getSystemInfoSync() || {}).windowHeight) || 0
	} catch (e) {}
	return 0
}

/** 键盘盖住底部时，外壳只占键盘以上的可视高度，搜索条贴在这块的底边 */
function readVisualFrame() {
	let top = 0
	let height = 0
	let inner = 0
	try {
		const vv = typeof window !== 'undefined' ? window.visualViewport : null
		inner = readWindowHeight()
		if (vv && vv.height > 0) {
			top = Math.max(0, Math.round(vv.offsetTop || 0))
			height = Math.round(vv.height)
		} else {
			height = inner
		}
	} catch (e) {
		height = readWindowHeight()
	}
	if (searchKeyboardOpen.value) {
		const lift = Math.max(0, Number(keyboardLiftPx.value) || 0)
		const raw = Math.max(0, Number(keyboardRawPx.value) || 0)
		const shrunk = inner > 0 && height > 0 && height < inner - 40
		if (!shrunk) {
			const cut = lift > 0 ? lift : raw
			if (cut > 0) height = Math.max(160, height - cut)
		}
	}
	return { top, height }
}

function alignCollectFrame() {
	if (!collectDockPinned.value) return
	lockCollectPageScroll()
}

function applyCollectPageLock(locked) {
	try {
		if (typeof document === 'undefined') return
		const root = document.documentElement
		const body = document.body
		if (!root || !body) return
		if (locked) {
			root.style.overflow = 'hidden'
			root.style.height = '100%'
			body.style.overflow = 'hidden'
			body.style.height = '100%'
			body.style.position = 'fixed'
			body.style.top = '0'
			body.style.left = '0'
			body.style.right = '0'
			body.style.width = '100%'
		} else {
			root.style.overflow = ''
			root.style.height = ''
			body.style.overflow = ''
			body.style.height = ''
			body.style.position = ''
			body.style.top = ''
			body.style.left = ''
			body.style.right = ''
			body.style.width = ''
		}
	} catch (e) {}
}

function lockCollectPageScroll() {
	if (!collectDockPinned.value) return
	try {
		if (typeof uni.pageScrollTo === 'function') uni.pageScrollTo({ scrollTop: 0, duration: 0 })
	} catch (e) {}
	try {
		if (typeof window === 'undefined') return
		const root = document.scrollingElement || document.documentElement
		const y = window.scrollY || (root && root.scrollTop) || (document.body && document.body.scrollTop) || 0
		if (y > 1) {
			window.scrollTo(0, 0)
			if (root) root.scrollTop = 0
			if (document.body) document.body.scrollTop = 0
		}
	} catch (e) {}
}

let collectFrameRaf = 0
let collectFrameBound = false
function onCollectViewport() {
	if (!collectDockPinned.value) return
	if (collectFrameRaf) return
	const run = () => {
		collectFrameRaf = 0
		lockCollectPageScroll()
		alignCollectFrame()
	}
	if (typeof requestAnimationFrame === 'function') collectFrameRaf = requestAnimationFrame(run)
	else collectFrameRaf = setTimeout(run, 16)
}

function bindCollectFrame() {
	if (collectFrameBound || typeof window === 'undefined') return
	collectFrameBound = true
	window.addEventListener('resize', onCollectViewport)
	window.addEventListener('scroll', onCollectViewport, true)
	if (window.visualViewport) {
		window.visualViewport.addEventListener('resize', onCollectViewport)
		window.visualViewport.addEventListener('scroll', onCollectViewport)
	}
}

function unbindCollectFrame() {
	if (!collectFrameBound || typeof window === 'undefined') return
	collectFrameBound = false
	window.removeEventListener('resize', onCollectViewport)
	window.removeEventListener('scroll', onCollectViewport, true)
	if (window.visualViewport) {
		window.visualViewport.removeEventListener('resize', onCollectViewport)
		window.visualViewport.removeEventListener('scroll', onCollectViewport)
	}
}

/** 只抬搜索条本身。页面保持铺满，避免底下露出黄色底色。 */
const collectSearchDockStyle = computed(() => {
	if (!searchKeyboardOpen.value) return {}
	const lift = Math.max(0, Math.round(Number(keyboardLiftPx.value) || 0))
	return { bottom: `${lift}px` }
})

/** 内容区只占吸顶导航和搜索条之间 */
const collectScrollStyle = computed(() => {
	if (!collectDockPinned.value) return {}
	try {
		const info = uni.getSystemInfoSync() || {}
		const windowHeight = Number(info.windowHeight) || readWindowHeight()
		const safeBottom = Number(info.safeAreaInsets && info.safeAreaInsets.bottom) || 0
		const dock = (typeof uni.upx2px === 'function' ? uni.upx2px(104) : 52) + (searchKeyboardOpen.value ? Math.max(0, Number(keyboardLiftPx.value) || 0) : safeBottom)
		const height = windowHeight - collectHeadPx.value - dock
		if (height > 160) return { height: `${Math.floor(height)}px` }
	} catch (e) {}
	return { height: '60vh' }
})

/** 搜索条已经在列表外面，底部只留一点空隙 */
const collectSearchSpacerStyle = computed(() => ({ height: '24rpx' }))

watch(collectDockPinned, (locked) => {
	if (locked) lockCollectPageScroll()
})
watch([collectDockPinned, searchKeyboardOpen, keyboardLiftPx], () => {
	nextTick(() => onCollectViewport())
})
onPageScroll((e) => {
	if (!collectDockPinned.value) return
	if (e && e.scrollTop > 0) lockCollectPageScroll()
})
onMounted(() => {
	bindCollectFrame()
	alignCollectFrame()
})
onBeforeUnmount(() => {
	unbindCollectFrame()
	applyCollectPageLock(false)
})
const affSearchSpacerStyle = computed(() => {
	if (!searchKeyboardOpen.value) return {}
	// 键盘弹起后「添加」按钮会收起，底部只要给搜索条留位
	return { height: `calc(120rpx + ${keyboardLiftPx.value}px)` }
})

watch(folderDialogOpen, (dialogOpen) => {
	if (!dialogOpen) resetKeyboardLift()
})
watch(affComposeOpen, (composeOpen) => {
	if (composeOpen) resetKeyboardLift()
})

function onCollectSearchFocus() {
	refreshKeyboardLift()
}
function onSearchBlur() {
	setTimeout(() => {
		try {
			const el = typeof document !== 'undefined' ? document.activeElement : null
			const tag = String(el && el.tagName || '').toUpperCase()
			if (tag === 'INPUT' || tag === 'TEXTAREA') {
				refreshKeyboardLift()
				return
			}
		} catch (e) {}
		if (keyboardRawPx.value < 40) resetKeyboardLift()
		else refreshKeyboardLift()
	}, 80)
}
const saveToastOpen = ref(false)
const saveToastText = ref('')
const saveToastQuote = ref(null)
let saveToastTimer = null
const saveToastTop = computed(() => `${statusBarPx + 56}px`)

function showSavedToast(q, folderName) {
	const name = folderName || t('collections')
	const raw = t('saved_to_folder', { name })
	saveToastQuote.value = q
	saveToastText.value = String(raw).replace('{name}', name)
	saveToastOpen.value = true
	clearTimeout(saveToastTimer)
	saveToastTimer = setTimeout(() => {
		saveToastOpen.value = false
	}, 4000)
}

function onSaveToastChange() {
	saveToastOpen.value = false
	clearTimeout(saveToastTimer)
	const q = saveToastQuote.value
	if (q) openCollectFolderSheet(q)
}

deps.onCollected = (q, _folderId, folderName) => {
	if (kind.value !== 'history') return
	showSavedToast(q, folderName)
}

const affSortItems = computed(() => ([
	{ code: 'newest', label: t('sort_newest') },
	{ code: 'oldest', label: t('sort_oldest') },
	{ code: 'az', label: t('sort_az') },
]))
const affCardItems = computed(() => ([
	{ code: 'edit', label: t('edit') },
	{ code: 'delete', label: t('delete') },
]))

const affVisibleList = computed(() => {
	const q = affQuery.value.trim().toLowerCase()
	let rows = (affirmations.value || []).slice()
	if (q) {
		rows = rows.filter((row) => {
			const text = String(row.content || '').toLowerCase()
			const author = affAuthor(row).toLowerCase()
			return text.includes(q) || author.includes(q)
		})
	}
	if (affSort.value === 'az') {
		rows.sort((a, b) => String(a.content || '').localeCompare(String(b.content || '')))
	} else {
		rows.sort((a, b) => {
			const ta = assetStamp(a)
			const tb = assetStamp(b)
			return affSort.value === 'oldest' ? ta - tb : tb - ta
		})
	}
	return rows
})

async function onAffSearchConfirm(e) {
	const raw = e?.detail?.value
	if (raw != null) affSearchDraft.value = String(raw)
	const next = affSearchDraft.value.trim()
	if (affSearching.value) return
	affSearching.value = true
	try {
		await new Promise((resolve) => setTimeout(resolve, 220))
		affQuery.value = next
		affSearchDraft.value = next
	} finally {
		affSearching.value = false
	}
}

async function onCollectSearchConfirm(e) {
	const raw = e?.detail?.value
	if (raw != null) collectSearchDraft.value = String(raw)
	const next = collectSearchDraft.value.trim()
	if (collectSearching.value) return
	collectSearching.value = true
	try {
		await new Promise((resolve) => setTimeout(resolve, 220))
		collectQuery.value = next
		collectSearchDraft.value = next
	} finally {
		collectSearching.value = false
	}
}

const collectVisibleList = computed(() => {
	const q = collectQuery.value.trim().toLowerCase()
	let rows = (filteredList.value || []).slice()
	if (q) {
		rows = rows.filter((row) => {
			const text = String(row.content || '').toLowerCase()
			const src = quoteSource(row).toLowerCase()
			return text.includes(q) || src.includes(q)
		})
	}
	if (collectSort.value === 'az') {
		rows.sort((a, b) => String(a.content || '').localeCompare(String(b.content || '')))
	} else {
		rows.sort((a, b) => {
			const ta = assetStamp(a)
			const tb = assetStamp(b)
			return collectSort.value === 'oldest' ? ta - tb : tb - ta
		})
	}
	return rows
})

const visibleQuotes = computed(() => (
	kind.value === 'collect' ? collectVisibleList.value : filteredList.value
))

const isFeedOpen = computed(() => collectFeedOpen.value || affFeedOpen.value)
const feedList = computed(() => (isAffirmUi.value ? affVisibleList.value : collectVisibleList.value))
const feedCurrent = computed({
	get: () => (isAffirmUi.value ? affFeedCurrent.value : collectFeedCurrent.value),
	set: (v) => {
		if (isAffirmUi.value) affFeedCurrent.value = v
		else collectFeedCurrent.value = v
	},
})
const feedQuote = computed(() => feedList.value[feedCurrent.value] || null)
const isFeedLiked = computed(() => {
	const q = feedQuote.value
	if (!q) return false
	return isLiked(q)
})

watch(folderId, () => {
	collectQuery.value = ''
	collectSearchDraft.value = ''
	collectSearching.value = false
	collectSort.value = 'newest'
	collectFeedOpen.value = false
	collectFeedCurrent.value = 0
})

function onFolderNameInput(e) {
	folderDialogName.value = e?.detail?.value ?? e?.target?.value ?? ''
}

function onQuoteLongpress(q) {
	if (kind.value === 'collect') moveCollect(q)
}

function onNavBack() {
	if (folderDialogOpen.value) {
		closeFolderDialog()
		return
	}
	if (affComposeOpen.value) {
		closeAffCompose()
		return
	}
	if (isFeedOpen.value) {
		closeFeed()
		return
	}
	if (folderId.value && openFolderMeta.value) {
		const n = list.value.length
		if (n > 0) patchFolderCount(folderId.value, Math.max(Number(openFolderMeta.value.item_count) || 0, n))
	}
	goBack()
}

const collectSortItems = computed(() => ([
	{ code: 'newest', label: t('sort_newest') },
	{ code: 'oldest', label: t('sort_oldest') },
	{ code: 'az', label: t('sort_az') },
]))

function sortTypeOf(value) {
	if (value === 'az') return 'a-z'
	if (value === 'newest') return 'new'
	return value || 'new'
}

function openCollectSortSheet() {
	fb('collection_quote_sort')
	collectSortSheetOpen.value = true
}

async function reloadSortedList(sortRef, value) {
	if (!value) return
	const same = value === sortRef.value
	sortRef.value = value
	uni.showLoading({ title: ' ', mask: true })
	try {
		if (!same && typeof invalidateListCache === 'function') invalidateListCache()
		await load(true)
	} finally {
		uni.hideLoading()
	}
}

function onCollectSortSelect({ value }) {
	fb('collection_quote_sortpop_click', { sortType: sortTypeOf(value) })
	reloadSortedList(collectSort, value)
}

function onCollectSortCancel() {
	fb('collection_quote_sortpop_cancel')
}

function toggleCollectFollow() {
	toggleFolderFollow()
}

function applyFeedWallpaper() {
	const snap = getActiveWallpaper()
	feedBgUrl.value = wallpaperDisplayUrl(snap) || FALLBACK_WALLPAPER
	feedBgVideoUrl.value = wallpaperOverlayVideoUrl(snap)
}

function feedQuoteOverflows() {
	const { height, viewH } = feedQuoteMetric.value
	// scroll-view 在内容刚好放下时也会多报几像素，阈值太小会把短文当成长文，滑回顶部后无法切下一条
	return viewH > 0 && height > viewH + 48
}

function feedQuoteAtTop() {
	return feedQuoteMetric.value.top <= 2
}

function feedQuoteAtBottom() {
	const { top, height, viewH } = feedQuoteMetric.value
	if (!viewH || height <= viewH + 8) return true
	return top + viewH >= height - 4
}

function measureFeedQuote() {
	nextTick(() => {
		uni.createSelectorQuery()
			.select('.page-feed .quote-scroll.is-on')
			.boundingClientRect()
			.select('.page-feed .quote-scroll.is-on .quote-inner')
			.boundingClientRect()
			.exec((res) => {
				const box = res && res[0]
				const inner = res && res[1]
				if (!box) return
				feedQuoteMetric.value = {
					top: feedQuoteMetric.value.top,
					height: Number(inner?.height) || 0,
					viewH: Number(box?.height) || 0,
				}
			})
	})
}

function resetFeedQuoteScroll() {
	feedQuoteScrollTop.value = feedQuoteScrollTop.value === 0 ? 0.01 : 0
	feedQuoteMetric.value = { top: 0, height: 0, viewH: feedQuoteMetric.value.viewH }
	measureFeedQuote()
}

function goFeedByDelta(dy) {
	if (Math.abs(dy) < 48) return
	const now = Date.now()
	if (now - feedNavAt < 280) return
	const toNext = dy < 0
	const rows = feedList.value
	const cur = feedCurrent.value
	if (toNext) {
		if (cur >= rows.length - 1) {
			load(false)
			return
		}
		feedNavAt = now
		feedCurrent.value = cur + 1
		resetFeedQuoteScroll()
		if (rows.length - (cur + 1) <= 4) load(false)
		return
	}
	if (cur <= 0) return
	feedNavAt = now
	feedCurrent.value = cur - 1
	resetFeedQuoteScroll()
}

function onFeedTouchStart(e) {
	const touch = e?.touches?.[0] || e?.changedTouches?.[0]
	feedTouchY = Number(touch?.clientY ?? touch?.pageY) || 0
	feedQuoteStartAtTop = true
	feedQuoteStartAtBottom = true
}

function onFeedTouchMove() {}

function onFeedTouchEnd(e) {
	const touch = e?.changedTouches?.[0]
	const endY = Number(touch?.clientY ?? touch?.pageY)
	if (!Number.isFinite(endY)) return
	goFeedByDelta(endY - feedTouchY)
}

function onFeedQuoteScroll(idx, e) {
	if (idx !== feedCurrent.value) return
	const top = Number(e?.detail?.scrollTop) || 0
	const height = Number(e?.detail?.scrollHeight) || 0
	feedQuoteMetric.value = {
		top,
		height: height || feedQuoteMetric.value.height,
		viewH: feedQuoteMetric.value.viewH,
	}
}

function onFeedQuoteTouchStart(idx, e) {
	if (idx !== feedCurrent.value) return
	const touch = e?.touches?.[0] || e?.changedTouches?.[0]
	feedTouchY = Number(touch?.clientY ?? touch?.pageY) || 0
	measureFeedQuote()
	feedQuoteStartAtTop = feedQuoteAtTop()
	feedQuoteStartAtBottom = feedQuoteAtBottom()
}

function onFeedQuoteTouchMove() {
	/* 交给 scroll-view 滚长文；切页只在 touchend 触顶/触底时触发 */
}

function onFeedQuoteTouchEnd(idx, e) {
	if (idx !== feedCurrent.value) return
	const touch = e?.changedTouches?.[0]
	const endY = Number(touch?.clientY ?? touch?.pageY)
	if (!Number.isFinite(endY)) return
	const dy = endY - feedTouchY
	if (feedQuoteOverflows()) {
		const toNext = dy < 0
		// 须从底部再上滑才进下一条；从顶部再下滑才回上一条
		if (toNext && !feedQuoteStartAtBottom) return
		if (!toNext && !feedQuoteStartAtTop) return
	}
	goFeedByDelta(dy)
}

function openCollectFeed() {
	const name = openFolderMeta.value ? folderLabel(openFolderMeta.value) : ''
	const source = (openFolderMeta.value && (openFolderMeta.value.is_default || openFolderMeta.value.isDefault)) || /favorite/i.test(name)
		? 'favorites'
		: (name || 'favorites')
	fb('collection_showInFeed_click', { source })
	if (!collectVisibleList.value.length) return
	collectQuery.value = ''
	collectSearchDraft.value = ''
	collectFeedCurrent.value = 0
	applyFeedWallpaper()
	collectFeedOpen.value = true
	resetFeedQuoteScroll()
	nextTick(() => {
		if (feedBgVideoUrl.value) playWallpaperVideo('collectBgVideo')
		measureFeedQuote()
	})
}

function closeFeed() {
	collectFeedOpen.value = false
	collectFeedCurrent.value = 0
	affFeedOpen.value = false
	affFeedCurrent.value = 0
}

function onFeedSwipe(e) {
	const cur = e.detail.current
	if (isAffirmUi.value) affFeedCurrent.value = cur
	else collectFeedCurrent.value = cur
	resetFeedQuoteScroll()
	if (feedList.value.length - cur <= 4) load(false)
}

function feedCite(q) {
	if (!q) return ''
	if (isAffirmUi.value || isAffirmationItem(q)) return affAuthor(q)
	return quoteSource(q)
}

function onFeedShare() {
	const q = feedQuote.value
	if (!q) return
	if (isAffirmUi.value || isAffirmationItem(q)) goShareAff(q)
	else onShareHit(q)
}

function onFeedLike() {
	const q = feedQuote.value
	if (!q) return
	onLikeHit(q)
}

function onFeedBgError() {
	if (feedBgUrl.value !== FALLBACK_WALLPAPER) feedBgUrl.value = FALLBACK_WALLPAPER
}

let affFieldLogged = false

function onAffDraftInput(e) {
	draft.value = e?.detail?.value ?? e?.target?.value ?? ''
	if (!affFieldLogged) {
		affFieldLogged = true
		fb('own_quote_field_edit')
	}
}

function onAffAuthorInput(e) {
	authorDraft.value = e?.detail?.value ?? e?.target?.value ?? ''
	if (!affFieldLogged) {
		affFieldLogged = true
		fb('own_quote_field_edit')
	}
}

function openAffCompose(row = null) {
	if (!row) fb('own_quote_add_click')
	affFieldLogged = false
	if (row) editAff(row)
	else cancelEditAff()
	affComposeOpen.value = true
}

function closeAffCompose() {
	if (affComposeOpen.value) fb('own_quote_editor_exit')
	affComposeOpen.value = false
	cancelEditAff()
}

async function onSaveAff() {
	fb('own_quote_save_click')
	const ok = await saveAff()
	if (ok) affComposeOpen.value = false
}

function openAffFeed() {
	fb('own_quote_show_feed_click')
	if (!affVisibleList.value.length) return
	affQuery.value = ''
	affSearchDraft.value = ''
	affFeedCurrent.value = 0
	applyFeedWallpaper()
	affFeedOpen.value = true
	resetFeedQuoteScroll()
	nextTick(() => {
		if (feedBgVideoUrl.value) playWallpaperVideo('collectBgVideo')
		measureFeedQuote()
	})
}

function openAffSortSheet() {
	fb('own_quote_sort')
	affSortSheetOpen.value = true
}

function onAffSortSelect({ value }) {
	fb('own_quote_sortpop_click', { sortType: sortTypeOf(value) })
	reloadSortedList(affSort, value)
}

function onAffSortCancel() {
	fb('own_quote_sortpop_cancel')
}

function onOwnSearchFocus() {
	fb('own_quote_search_click')
	onCollectSearchFocus()
}

function onMoveSheetCancel() {
	if (kind.value === 'like') fb('topic_likePage_collection_popup_cancel')
}

function onClearHistoryCancel() {
	fb('history_quote_clear_popup_cancel')
}

function openAffCardMenu(a) {
	affCardTarget.value = a
	affCardSheetOpen.value = true
}

function onAffCardSelect({ value }) {
	const a = affCardTarget.value
	if (!a) return
	if (value === 'edit') {
		openAffCompose(a)
		return
	}
	if (value === 'delete') delAff(a.id)
}

onBackPress(() => {
	if (isAffirmUi.value) {
		if (affComposeOpen.value) {
			closeAffCompose()
			return true
		}
		if (affFeedOpen.value) {
			closeFeed()
			return true
		}
		return false
	}
	if (!isCollectUi.value) return false
	if (folderDeleteOpen.value) {
		closeFolderDelete()
		return true
	}
	if (folderDialogOpen.value) {
		closeFolderDialog()
		return true
	}
	if (collectFeedOpen.value) {
		closeFeed()
		return true
	}
	if (folderId.value) {
		goBack()
		return true
	}
	return false
})
</script>


<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page-wrap {
	min-height: 100vh;
	position: relative;
}
.page-wrap.dock-pinned {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	width: auto;
	height: auto;
	min-height: 0;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	background: #ffffff;
	overscroll-behavior: none;
}
.page-wrap.dock-pinned .page {
	flex: 1;
	min-height: 0;
	height: auto;
	max-height: none;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	padding-top: 0 !important;
	padding-bottom: 0 !important;
	background: #ffffff;
}
.page-wrap.dock-pinned .page-head {
	position: relative;
	flex-shrink: 0;
	z-index: 8;
	background: #ffffff;
}
.page-wrap.dock-pinned .collect-scroll {
	position: relative;
	z-index: 8;
	flex: 1;
	height: 0;
	min-height: 0;
	width: 100%;
}
.page-wrap.dock-pinned .collect-search-dock {
	position: relative;
	left: auto;
	right: auto;
	bottom: auto;
	flex-shrink: 0;
	z-index: 8;
	margin: 0 32rpx 12rpx;
}
.collect-kb-spacer {
	flex-shrink: 0;
	width: 100%;
	pointer-events: none;
}
.page-wrap-feed {
	height: 100vh;
	height: 100dvh;
	overflow: hidden;
}
.page {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-collect {
	background: #ffffff;
	padding-bottom: 48rpx;
}
.page-collect-form {
	padding-left: 40rpx;
	padding-right: 40rpx;
}
.page-feed {
	position: relative;
	height: 100vh;
	height: 100dvh;
	min-height: 100vh;
	padding: 0;
	overflow: hidden;
	background-color: #fbf8f2;
	background-image: linear-gradient(180deg, #b6badf 0%, #fff0d9 48%, #f5dfbc 100%);
}
.bg {
	position: absolute;
	left: 0;
	top: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
	opacity: 0.22;
	pointer-events: none;
}
.bg.bg-video {
	z-index: 0;
	opacity: 1;
}
.veil {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 1;
	background: linear-gradient(180deg, rgba(251, 248, 242, 0.08), rgba(251, 248, 242, 0.42));
	pointer-events: none;
}
.page-head {
	@include selah-sticky-head;
}
.feed-head {
	position: absolute;
	left: 0;
	right: 0;
	z-index: 20;
	padding-left: 32rpx;
	padding-right: 32rpx;
	background: transparent;
}
.head-glass {
	@include selah-sticky-head-glass($selah-bg-gray);
}
.head-glass-collect {
	@include selah-sticky-head-glass(#ffffff);
}
.head-glass-compose {
	display: none;
}
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 0 0 8rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.collect-nav {
	gap: 12rpx;
}
.collect-nav-left {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 8rpx;
}
.collect-back-hit {
	width: 64rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: flex-start;
	flex-shrink: 0;
}
.collect-back {
	width: 48rpx;
	height: 48rpx;
	flex-shrink: 0;
}
.collect-title {
	flex: 1;
	min-width: 0;
	font-size: 34rpx;
	font-weight: 700;
	color: $selah-ink;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.collect-nav-right {
	display: flex;
	flex-direction: row;
	align-items: center;
	flex-shrink: 0;
	gap: 12rpx;
}
.collect-tool-pill {
	height: 64rpx;
	padding: 0 6rpx;
	border-radius: $selah-radius-pill;
	background: #f2f2f2;
	display: flex;
	flex-direction: row;
	align-items: center;
}
.collect-ico-hit {
	position: relative;
	z-index: 2;
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.collect-tool-ico {
	width: 36rpx;
	height: 36rpx;
	pointer-events: none;
}
.collect-follow {
	height: 64rpx;
	padding: 0 28rpx;
	border-radius: $selah-radius-pill;
	background: #f2f2f2;
	display: flex;
	align-items: center;
	justify-content: center;
}
.collect-follow.on {
	background: #eceae4;
}
.collect-follow.busy {
	opacity: 0.5;
}
.collect-follow-text {
	font-size: 26rpx;
	font-weight: 600;
	color: $selah-ink;
}
.collect-add {
	height: 64rpx;
	padding: 0 28rpx;
	border-radius: $selah-radius-pill;
	background: #f2f2f2;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}
.collect-add-text {
	font-size: 26rpx;
	font-weight: 600;
	color: $selah-ink;
}
.nav-spacer-sm {
	width: 24rpx;
	height: 64rpx;
	flex-shrink: 0;
}
.nav-pill {
	@include selah-nav-circle;
	position: relative;
	z-index: 2;
	flex-shrink: 0;
}
.nav-ico { width: 48rpx; height: 48rpx; }
.nav-title {
	@include selah-display-title;
	flex: 1;
	text-align: center;
}
.nav-spacer {
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
	visibility: hidden;
}
.history-nav {
	gap: 16rpx;
}
.history-title {
	@include selah-display-title;
	flex: 1;
	min-width: 0;
	font-size: 40rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.save-toast {
	position: fixed;
	left: 32rpx;
	right: 32rpx;
	z-index: 300;
	min-height: 88rpx;
	padding: 16rpx 28rpx;
	background: #2c2c2c;
	border-radius: $selah-radius-pill;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	box-sizing: border-box;
	box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.18);
}
.save-toast-text {
	flex: 1;
	min-width: 0;
	font-size: 28rpx;
	font-weight: 600;
	color: #ffffff;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.save-toast-btn {
	flex-shrink: 0;
	padding: 8rpx 4rpx 8rpx 12rpx;
}
.save-toast-btn-text {
	font-size: 28rpx;
	font-weight: 600;
	color: #d0d0d0;
}
.collect-browse {
	padding: 8rpx 0 24rpx;
}
.collect-row {
	display: flex;
	flex-direction: row;
	align-items: center;
	background: #f6f6f6;
	border-radius: 28rpx;
	padding: 36rpx 28rpx;
	margin-bottom: 16rpx;
}
.collect-row-copy {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}
.collect-row-name {
	font-size: 30rpx;
	font-weight: 700;
	color: $selah-ink;
	line-height: 1.3;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.collect-row-meta {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: $selah-muted;
}
.collect-row-chevron {
	width: 32rpx;
	height: 32rpx;
	flex-shrink: 0;
	opacity: 0.55;
}
.collect-empty {
	min-height: calc(100vh - 220rpx);
	display: flex;
	flex-direction: column;
	align-items: center;
}
.collect-empty-main {
	flex: 1;
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 48rpx 24rpx 24rpx;
	box-sizing: border-box;
}
.collect-empty-art {
	width: 168rpx;
	height: 168rpx;
	margin-bottom: 36rpx;
}
.collect-empty-title {
	@include selah-display-title;
	display: block;
	width: 100%;
	font-size: 40rpx;
	line-height: 1.3;
	text-align: center;
	padding: 0 12rpx;
	box-sizing: border-box;
}
.collect-empty-desc {
	display: block;
	margin-top: 16rpx;
	font-size: 26rpx;
	line-height: 1.45;
	color: $selah-muted;
	text-align: center;
	padding: 0 28rpx;
}
.collect-empty-cta {
	margin-bottom: calc(24rpx + env(safe-area-inset-bottom));
}
.collect-folder-empty {
	width: 100%;
	min-height: calc(100vh - 240rpx);
	margin-top: 0;
	padding: 48rpx 16rpx 80rpx;
	box-sizing: border-box;
	justify-content: center;
}
.collect-folder-art {
	width: 360rpx;
	height: 360rpx;
	margin-bottom: 40rpx;
}
.collect-form-title {
	flex: 1;
	min-width: 0;
	font-size: 36rpx;
	font-weight: 700;
	color: $selah-ink;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.collect-form {
	padding: 28rpx 0 0;
	box-sizing: border-box;
}
.collect-form-hint {
	display: block;
	font-size: 28rpx;
	line-height: 1.45;
	font-weight: 500;
	color: $selah-ink;
	margin-bottom: 32rpx;
}
.collect-input {
	width: 100%;
	height: 96rpx;
	padding: 0 36rpx;
	background: #f2f2f2;
	border-radius: $selah-radius-pill;
	font-size: 30rpx;
	color: $selah-ink;
	box-sizing: border-box;
}
.collect-input-ph {
	color: #b3b3b3;
}
.collect-form-dock {
	position: fixed;
	left: 40rpx;
	right: 40rpx;
	z-index: 40;
}
.collect-form .collect-cta {
	height: 96rpx;
	border-radius: $selah-radius-pill;
}
.collect-cta {
	width: 100%;
	height: 96rpx;
	border-radius: 28rpx;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.collect-cta.disabled {
	background: #c8c8c8;
	pointer-events: none;
}
.collect-cta.ghost {
	background: #ffffff;
	border: 2rpx solid $selah-ink;
}
.collect-cta.ghost .collect-cta-text {
	color: $selah-ink;
}
.collect-cta-text {
	color: #ffffff;
	font-size: 30rpx;
	font-weight: 700;
}
.collect-feed-cta {
	margin: 8rpx 0 24rpx;
}
.hist-clear {
	font-size: 24rpx;
	color: $selah-muted;
	padding: 8rpx 4rpx;
	flex-shrink: 0;
}
.q {
	padding: 32rpx;
	margin-bottom: 16rpx;
	background: $selah-card;
	border-radius: $selah-radius-card;
	color: $selah-ink;
}
.page-collect .q {
	box-shadow: 0 8rpx 28rpx rgba(25, 25, 25, 0.04);
	border: 1rpx solid rgba(25, 25, 25, 0.04);
}
.q-body {
	display: block;
	font-family: $selah-font-display;
	font-size: 32rpx;
	line-height: 1.45;
	color: $selah-ink;
}
.q-cite {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	color: $selah-muted;
}
.q-date {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	letter-spacing: 0.04em;
	color: $selah-muted;
}
.q-date-inline {
	margin-top: 0;
	flex: 1;
}
.q-collect-foot {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	margin-top: 20rpx;
}
.icon-actions {
	position: relative;
	z-index: 2;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 8rpx;
	margin-top: 20rpx;
}
.icon-actions-inline {
	margin-top: 0;
	gap: 0;
}
.ico-hit {
	position: relative;
	z-index: 3;
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
}
.row-ico {
	width: 40rpx;
	height: 40rpx;
	pointer-events: none;
}
.page-aff-compose {
	background: #ffffff;
}
.aff-form {
	padding: 48rpx 0 40rpx;
}
.aff-card {
	min-height: 480rpx;
	padding: 48rpx 8rpx 24rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	box-sizing: border-box;
	margin-bottom: 28rpx;
	background: transparent;
	box-shadow: none;
}
.aff-quote-input {
	width: 100%;
	flex: 1;
	min-height: 220rpx;
	padding-top: 24rpx;
	font-family: $selah-font-display;
	font-size: 48rpx;
	line-height: 1.35;
	font-weight: 700;
	color: $selah-ink;
	text-align: center;
	box-sizing: border-box;
}
.aff-quote-ph {
	color: #c8c8c8;
	font-family: $selah-font-display;
	font-weight: 700;
	text-align: center;
}
.aff-author-input {
	width: 100%;
	height: 64rpx;
	margin-top: 24rpx;
	font-size: 28rpx;
	color: $selah-ink;
	text-align: center;
}
.aff-author-ph {
	color: #c8c8c8;
	text-align: center;
}
.aff-card-hint-wrap {
	width: 100%;
	margin-top: 80rpx;
	display: flex;
	justify-content: center;
}
.aff-card-hint {
	font-size: 22rpx;
	color: #b3b3b3;
	text-align: center;
}
.aff-empty-art {
	width: 280rpx;
	height: 220rpx;
}
.q-aff-top {
	display: flex;
	flex-direction: row;
	align-items: flex-start;
	gap: 12rpx;
}
.q-aff-copy {
	flex: 1;
	min-width: 0;
}
.q-card-more {
	width: 56rpx;
	height: 56rpx;
	margin: -8rpx -8rpx 0 0;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}
.q-card-more-ico {
	width: 32rpx;
	height: 32rpx;
	opacity: 0.7;
}
.composer {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 28rpx 32rpx 24rpx;
	margin-bottom: 24rpx;
}
.composer-input {
	width: 100%;
	min-height: 160rpx;
	font-family: $selah-font-display;
	font-size: 32rpx;
	line-height: 1.45;
	color: $selah-ink;
	box-sizing: border-box;
}
.composer-foot {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	margin-top: 20rpx;
	padding-top: 16rpx;
	border-top: 1rpx solid $selah-divider;
}
.composer-count {
	font-size: 22rpx;
	color: $selah-muted;
}
.composer-actions {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 20rpx;
}
.composer-cancel {
	font-size: 26rpx;
	color: $selah-muted;
	padding: 12rpx 8rpx;
}
.composer-save {
	min-width: 140rpx;
	padding: 16rpx 36rpx;
	border-radius: $selah-radius-pill;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.composer-save.disabled {
	opacity: 0.35;
}
.composer-save-text {
	font-size: 26rpx;
	font-weight: 600;
	color: #ffffff;
}
.row-actions {
	display: flex;
	flex-direction: row;
	margin-top: 12rpx;
}
.del {
	color: #e07a7a;
	font-size: 22rpx;
	margin-left: 24rpx;
	flex-shrink: 0;
}
.link {
	color: $selah-ink-soft;
	font-size: 22rpx;
	display: inline-block;
	margin-top: 16rpx;
}
.row-actions .link {
	margin-top: 0;
	margin-right: 24rpx;
	display: inline-block;
}
.row-actions .del {
	margin-left: 0;
}
.tag-sec {
	display: flex;
	flex-direction: column;
	padding: 8rpx 0 20rpx;
}
.tag-sec-label {
	flex-shrink: 0;
	font-size: 22rpx;
	line-height: 32rpx;
	color: $selah-muted;
	margin-bottom: 16rpx;
}
.tag-rail {
	width: 100%;
	height: 72rpx;
	white-space: nowrap;
}
.tag-row {
	display: inline-flex;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: center;
	height: 72rpx;
	padding-right: 24rpx;
}
.tag-chip {
	display: flex;
	flex-direction: row;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	height: 56rpx;
	padding: 0 28rpx;
	margin-right: 12rpx;
	border-radius: 28rpx;
	background: $selah-card;
	box-sizing: border-box;
}
.tag-chip.on {
	background: $selah-ink;
	color: #ffffff;
}
.tag-chip-text {
	font-size: 24rpx;
	font-weight: 600;
	line-height: 56rpx;
	color: $selah-ink;
	white-space: nowrap;
}
.tag-chip.on .tag-chip-text,
.tag-chip.on text {
	color: #ffffff;
}
.empty {
	color: $selah-muted;
	text-align: center;
	margin-top: 80rpx;
	font-size: 26rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.empty-art {
	width: 200rpx;
	height: 200rpx;
	border-radius: 32rpx;
	margin-bottom: 20rpx;
	opacity: 0.85;
}
.empty.likes-empty {
	margin-top: 0;
	min-height: calc(100vh - 220rpx);
	justify-content: center;
	padding: 0 72rpx 80rpx;
	box-sizing: border-box;
}
.likes-empty .empty-art {
	margin-bottom: 72rpx;
}
.likes-empty-title {
	@include selah-display-title;
	display: block;
	width: 100%;
	max-width: 480rpx;
	font-size: 44rpx;
	line-height: 1.28;
	font-weight: 700;
	text-align: center;
	color: #191919;
}
.tip { color: $selah-muted; text-align: center; padding: 16rpx; font-size: 22rpx; }
.list-spinner {
	width: 48rpx;
	height: 48rpx;
	border: 4rpx solid rgba(17, 17, 17, 0.12);
	border-top-color: $selah-ink;
	border-radius: 50%;
	animation: list-spin 0.7s linear infinite;
}
@keyframes list-spin {
	to { transform: rotate(360deg); }
}
.search-spacer {
	height: calc(140rpx + env(safe-area-inset-bottom));
}
.search-spacer-aff {
	height: calc(260rpx + env(safe-area-inset-bottom));
}
.search-dock {
	position: fixed;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(16rpx + env(safe-area-inset-bottom));
	z-index: 20;
}
.search-dock-kb {
	/* 键盘上方只留搜索条，避免整块被顶到屏幕中间 */
	padding-bottom: 0;
}
.affirm-dock {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}
.aff-search-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 80rpx 0 40rpx;
}
.search-bar {
	height: 88rpx;
	padding: 0 28rpx;
	border-radius: 44rpx;
	background: $selah-card;
	box-shadow: 0 12rpx 40rpx rgba(25, 25, 25, 0.08);
	display: flex;
	flex-direction: row;
	align-items: center;
}
.search-ico { width: 36rpx; height: 36rpx; margin-right: 12rpx; flex-shrink: 0; }
.search-input {
	flex: 1;
	height: 88rpx;
	font-size: 28rpx;
	color: $selah-ink;
}
.search-ph { color: $selah-muted; }
.search-spin {
	width: 28rpx;
	height: 28rpx;
	margin-left: 12rpx;
	border: 3rpx solid rgba(17, 17, 17, 0.12);
	border-top-color: $selah-ink;
	border-radius: 50%;
	flex-shrink: 0;
	animation: list-spin 0.7s linear infinite;
}
.feed {
	position: relative;
	height: 100%;
	z-index: 2;
	background: transparent;
}
.feed :deep(uni-swiper),
.feed :deep(uni-swiper-item),
.feed :deep(.uni-swiper-wrapper) {
	background: transparent;
}
.card {
	height: 100%;
	width: 100%;
	position: relative;
	box-sizing: border-box;
	overflow: hidden;
}
.quote-block {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	/* 稿 Frame 36：y=311；底边对齐操作条（y=662）上方，避免与分享/喜欢重叠 */
	top: calc(100% * 311 / 2000);
	bottom: max(
		calc(100% * (812 - 662) / 812 + 24rpx),
		calc(72rpx + 40rpx + 24rpx + constant(safe-area-inset-bottom))
	);
	bottom: max(
		calc(100% * (812 - 662) / 812 + 24rpx),
		calc(72rpx + 40rpx + 24rpx + env(safe-area-inset-bottom))
	);
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	overflow: hidden;
	box-sizing: border-box;
}
.quote-scroll {
	width: 100%;
	height: 100%;
	box-sizing: border-box;
}
.quote-inner {
	width: 100%;
	/* 撑满可视区：短文垂直居中；长文超过可视区时高度随内容增长，仍可滚动 */
	min-height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	padding-bottom: 8rpx;
}
.quote {
	display: block;
	font-family: $selah-font-display;
	font-size: 48rpx;
	line-height: 1.28;
	color: #191919;
	text-align: center;
	font-weight: 700;
	width: 100%;
}
.cite {
	display: block;
	margin-top: 20rpx;
	font-family: $selah-font-display;
	font-size: 28rpx;
	color: #191919;
	text-align: center;
	width: 100%;
}
.quote-hit {
	position: absolute;
	left: 48rpx;
	right: 48rpx;
	top: 30%;
	bottom: 22%;
	z-index: 1;
}
.mid-actions {
	position: absolute;
	left: 0;
	right: 0;
	top: min(calc(100% * 662 / 812), calc(100% - 72rpx - 40rpx - constant(safe-area-inset-bottom)));
	top: min(calc(100% * 662 / 812), calc(100% - 72rpx - 40rpx - env(safe-area-inset-bottom)));
	height: 72rpx;
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
	z-index: 7;
	pointer-events: auto;
}
.icon-btn {
	width: 72rpx;
	height: 72rpx;
	margin: 0 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.act-img {
	width: 72rpx;
	height: 72rpx;
}
</style>
