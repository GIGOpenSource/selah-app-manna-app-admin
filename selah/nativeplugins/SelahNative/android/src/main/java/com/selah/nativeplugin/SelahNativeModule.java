package com.selah.nativeplugin;

import android.content.Context;

import com.alibaba.fastjson.JSONObject;

import io.dcloud.feature.uniapp.annotation.UniJSMethod;
import io.dcloud.feature.uniapp.common.UniModule;
import io.dcloud.feature.uniapp.common.UniJSCallback;

/**
 * uni-app native module. JS: uni.requireNativePlugin('SelahNative')
 */
public class SelahNativeModule extends UniModule {

    @UniJSMethod(uiThread = false)
    public void writeWidgetPayload(JSONObject options, UniJSCallback callback) {
        JSONObject ret = new JSONObject();
        try {
            String json = options != null ? options.getString("json") : null;
            if (json == null || json.length() == 0) {
                ret.put("ok", false);
                ret.put("error", "missing_json");
                if (callback != null) callback.invoke(ret);
                return;
            }
            Context ctx = mUniSDKInstance.getContext();
            boolean ok = SelahPayloadStore.INSTANCE.writePayloadJson(ctx, json);
            SelahAppWidgetProvider.Companion.updateAll(ctx);
            ret.put("ok", ok);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", e.getMessage() != null ? e.getMessage() : "write_failed");
        }
        if (callback != null) callback.invoke(ret);
    }

    @UniJSMethod(uiThread = true)
    public void setAppIcon(JSONObject options, UniJSCallback callback) {
        JSONObject ret = new JSONObject();
        try {
            String key = options != null ? options.getString("icon_key") : "default";
            if (key == null || key.length() == 0) key = "default";
            Context ctx = mUniSDKInstance.getContext();
            boolean ok = SelahIconSwitcher.INSTANCE.apply(ctx, key);
            ret.put("ok", ok);
            ret.put("icon_key", key);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", e.getMessage() != null ? e.getMessage() : "icon_failed");
        }
        if (callback != null) callback.invoke(ret);
    }

    @UniJSMethod(uiThread = false)
    public void reloadWidgets(JSONObject options, UniJSCallback callback) {
        JSONObject ret = new JSONObject();
        try {
            Context ctx = mUniSDKInstance.getContext();
            SelahAppWidgetProvider.Companion.updateAll(ctx);
            ret.put("ok", true);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", e.getMessage());
        }
        if (callback != null) callback.invoke(ret);
    }

    @UniJSMethod(uiThread = false)
    public String getCachedPayload(JSONObject options) {
        try {
            Context ctx = mUniSDKInstance.getContext();
            return SelahPayloadStore.INSTANCE.readPayloadJson(ctx);
        } catch (Exception e) {
            return "";
        }
    }
}
