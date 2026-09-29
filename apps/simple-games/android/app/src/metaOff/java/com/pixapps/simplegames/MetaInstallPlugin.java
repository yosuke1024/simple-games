package com.pixapps.simplegames;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The Meta install measurement as every build has it unless a release asked
 * for Meta by name (issue #204, docs/META_ANDROID_ACQUISITION.md): nothing.
 * It keeps no state and reports nothing.
 *
 * It exists so MainActivity can register the same class in every variant.
 * The real one lives in src/metaOn and is compiled instead of this file only
 * into a release built with SG_META_ANDROID_ENABLED=true (app/build.gradle);
 * this variant has no Meta SDK on its classpath at all, so there is nothing
 * here that could be switched on by accident.
 */
@CapacitorPlugin(name = "MetaInstall")
public class MetaInstallPlugin extends Plugin {}
