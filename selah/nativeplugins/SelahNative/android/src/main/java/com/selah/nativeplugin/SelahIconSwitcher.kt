package com.selah.nativeplugin

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

object SelahIconSwitcher {
    fun apply(context: Context, iconKey: String): Boolean {
        val pm = context.packageManager
        val pkg = context.packageName
        val targetAlias = SelahConstants.ICON_ALIASES[iconKey]
            ?: SelahConstants.ICON_ALIASES["default"]
            ?: return false

        SelahConstants.ICON_ALIASES.values.forEach { suffix ->
            val cn = ComponentName(pkg, pkg + suffix)
            val state = if (suffix == targetAlias) {
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            } else {
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            }
            try {
                pm.setComponentEnabledSetting(cn, state, PackageManager.DONT_KILL_APP)
            } catch (_: Exception) {
                // alias not present in this build
            }
        }
        return true
    }
}
