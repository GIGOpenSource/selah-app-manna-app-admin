package com.selah.nativeplugin

object SelahConstants {
    /** Replace with production applicationId when packaging. */
    const val PREFS_NAME = "selah_widget"
    const val PAYLOAD_KEY = "widget_payload_json"
    const val QUOTE_KEY = "quote_content"
    const val ACCENT_KEY = "accent"
    const val UPDATED_KEY = "updated_at"
    const val SCHEME_WIDGETS = "selah://widgets"
    const val SCHEME_ICONS = "selah://icons"
    const val SCHEME_WATCH = "selah://watch"

    /** activity-alias component suffixes — must match AndroidManifest. */
    val ICON_ALIASES = mapOf(
        "default" to ".LauncherDefault",
        "cross_light" to ".LauncherCrossLight",
        "cross_dark" to ".LauncherCrossDark",
    )
}
