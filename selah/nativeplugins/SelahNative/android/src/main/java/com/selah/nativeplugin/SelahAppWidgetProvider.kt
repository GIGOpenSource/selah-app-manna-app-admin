package com.selah.nativeplugin

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Home-screen App Widget. Merge into main app module + AndroidManifest.
 * Layout: R.layout.selah_widget (res/layout/selah_widget_layout.xml → rename to selah_widget.xml when merging).
 */
class SelahAppWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (id in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id)
        }
    }

    companion object {
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val cn = ComponentName(context, SelahAppWidgetProvider::class.java)
            val ids = manager.getAppWidgetIds(cn)
            for (id in ids) {
                updateAppWidget(context, manager, id)
            }
        }

        fun updateAppWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
            // Resource name after merge: selah_widget / selah_widget_quote / selah_widget_cite
            val layoutId = context.resources.getIdentifier("selah_widget", "layout", context.packageName)
            val quoteId = context.resources.getIdentifier("selah_widget_quote", "id", context.packageName)
            val citeId = context.resources.getIdentifier("selah_widget_cite", "id", context.packageName)
            if (layoutId == 0) return

            val views = RemoteViews(context.packageName, layoutId)
            val quote = SelahPayloadStore.readQuote(context)
            val source = SelahPayloadStore.readSource(context)
            if (quoteId != 0) views.setTextViewText(quoteId, quote)
            if (citeId != 0) {
                views.setTextViewText(citeId, if (source.isNotEmpty()) "— $source" else "Selah")
            }

            val open = Intent(Intent.ACTION_VIEW, Uri.parse(SelahConstants.SCHEME_WIDGETS)).apply {
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            val pending = PendingIntent.getActivity(context, 1, open, flags)
            val rootId = context.resources.getIdentifier("selah_widget_root", "id", context.packageName)
            if (rootId != 0) {
                views.setOnClickPendingIntent(rootId, pending)
            }
            if (quoteId != 0) {
                views.setOnClickPendingIntent(quoteId, pending)
            }

            manager.updateAppWidget(appWidgetId, views)
        }
    }
}
