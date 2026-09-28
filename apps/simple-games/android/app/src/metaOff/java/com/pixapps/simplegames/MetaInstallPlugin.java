package com.pixapps.simplegames;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The Meta install measurement plugin as every build has it unless a release
 * asked for Meta by name (issue #204, docs/META_ANDROID_ACQUISITION.md):
 * nothing. It answers "unavailable", keeps no state, and reports nothing,
 * which is what makes the JavaScript side draw no question and no Settings
 * row.
 *
 * It exists so MainActivity can register the same class in every variant.
 * The real one lives in src/metaOn and is compiled instead of this file only
 * into a release built with SG_META_ANDROID_ENABLED=true (app/build.gradle);
 * this variant has no Meta SDK on its classpath at all, so there is nothing
 * here that could be switched on by accident.
 */
@CapacitorPlugin(name = "MetaInstall")
public class MetaInstallPlugin extends Plugin {

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(unavailable());
    }

    @PluginMethod
    public void setConsent(PluginCall call) {
        call.resolve(unavailable());
    }

    @PluginMethod
    public void reportInstall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("started", false);
        call.resolve(ret);
    }

    private static JSObject unavailable() {
        JSObject ret = new JSObject();
        ret.put("available", false);
        return ret;
    }
}
