package com.selah.nativeplugin

import android.content.Context
import org.json.JSONObject

object SelahPayloadStore {
    fun writePayloadJson(context: Context, json: String): Boolean {
        val prefs = context.getSharedPreferences(SelahConstants.PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit().putString(SelahConstants.PAYLOAD_KEY, json)
        try {
            val obj = JSONObject(json)
            val quote = obj.optJSONObject("quote")
            val content = quote?.optString("content")?.takeIf { it.isNotEmpty() } ?: "Selah"
            val accent = obj.optString("accent", "#B6BADD")
            val updated = obj.optString("updated_at", "")
            editor.putString(SelahConstants.QUOTE_KEY, content)
            editor.putString(SelahConstants.ACCENT_KEY, accent)
            editor.putString(SelahConstants.UPDATED_KEY, updated)
        } catch (_: Exception) {
            // keep raw json only
        }
        return editor.commit()
    }

    fun readPayloadJson(context: Context): String =
        context.getSharedPreferences(SelahConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(SelahConstants.PAYLOAD_KEY, "") ?: ""

    fun readQuote(context: Context): String =
        context.getSharedPreferences(SelahConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(SelahConstants.QUOTE_KEY, "Open Selah to sync today’s word.")
            ?: "Open Selah to sync today’s word."

    fun readSource(context: Context): String {
        return try {
            val json = readPayloadJson(context)
            if (json.isEmpty()) return ""
            JSONObject(json).optJSONObject("quote")?.optString("source_ref") ?: ""
        } catch (_: Exception) {
            ""
        }
    }
}
