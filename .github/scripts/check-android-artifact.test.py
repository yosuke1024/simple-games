#!/usr/bin/env python3
"""Permission/descriptor audit regressions using synthetic manifest/APK fixtures.

The DEX fixture is only descriptor text for this audit's scanner, not executable
bytecode. Native compilation and the real release APK audit run separately.
"""
from pathlib import Path
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from android_permission_policy import source_errors, CONTINUITY

A = "{http://schemas.android.com/apk/res/android}"
SCRIPT = Path(__file__).with_name("check-android-artifact.sh")
PLUGIN = "Lcom/pixapps/simplegames/nearby/NearbyPlayPlugin;"
LEGACY = ("BLUETOOTH", "BLUETOOTH_ADMIN", "ACCESS_FINE_LOCATION")
MODERN = ("BLUETOOTH_SCAN", "BLUETOOTH_ADVERTISE", "BLUETOOTH_CONNECT")


def manifest():
    root = ET.Element("manifest")
    for name in LEGACY + MODERN:
        permission = ET.SubElement(root, "uses-permission", {A + "name": "android.permission." + name})
        if name in LEGACY:
            permission.set(A + "maxSdkVersion", "30")
        if name == "BLUETOOTH_SCAN":
            permission.set(A + "usesPermissionFlags", "neverForLocation")
    ET.SubElement(root, "uses-feature", {A + "name": "android.hardware.bluetooth_le", A + "required": "false"})
    for name in CONTINUITY:
        ET.SubElement(root, "uses-permission", {A + "name": name})
    for name in ("android.hardware.bluetooth", "android.hardware.location"):
        ET.SubElement(root, "uses-feature", {A + "name": name, A + "required": "false"})
    app = ET.SubElement(root, "application")
    ET.SubElement(app, "service", {A + "name": ".nearby.NearbyConnectionService", A + "exported": "false", A + "foregroundServiceType": "connectedDevice", A + "stopWithTask": "true"})
    return root


def permission(root, name):
    return next(p for p in root.findall("uses-permission") if p.get(A + "name") == "android.permission." + name)


class AndroidArtifactTest(unittest.TestCase):
    def audit(self, root, descriptors=(PLUGIN,), mode="off"):
        with tempfile.TemporaryDirectory(prefix="nearby-artifact-test-") as directory:
            app = Path(directory)
            merged = app / "build/intermediates/merged_manifests/release/fixture/AndroidManifest.xml"
            merged.parent.mkdir(parents=True)
            ET.ElementTree(root).write(merged, encoding="utf-8", xml_declaration=True)
            apk = app / "build/outputs/apk/release/app-release-unsigned.apk"
            apk.parent.mkdir(parents=True)
            with zipfile.ZipFile(apk, "w") as output:
                output.writestr("classes.dex", "\n".join(descriptors))
            return subprocess.run(["bash", str(SCRIPT), mode, str(app)], text=True, capture_output=True)

    def accepted(self, root, **options):
        result = self.audit(root, **options)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def rejected(self, root, message, **options):
        result = self.audit(root, **options)
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(message, result.stdout + result.stderr)

    def test_accepts_exact_nearby_contract(self):
        self.accepted(manifest())

    def test_rejects_missing_or_unbounded_legacy_permissions(self):
        for name in LEGACY:
            for maximum in (None, "29", "31"):
                with self.subTest(name=name, maximum=maximum):
                    root = manifest()
                    p = permission(root, name)
                    if maximum is None:
                        p.attrib.pop(A + "maxSdkVersion")
                    else:
                        p.set(A + "maxSdkVersion", maximum)
                    self.rejected(root, "maxSdkVersion")

    def test_rejects_missing_or_duplicate_permission(self):
        for name in LEGACY + MODERN:
            with self.subTest(name=name):
                root = manifest()
                root.remove(permission(root, name))
                self.rejected(root, "一度だけ宣言")
        root = manifest()
        ET.SubElement(root, "uses-permission-sdk-23", {A + "name": "android.permission.BLUETOOTH_SCAN"})
        self.rejected(root, "一度だけ宣言")

    def test_rejects_capped_modern_bluetooth_permissions(self):
        root = manifest()
        permission(root, "BLUETOOTH_CONNECT").set(A + "maxSdkVersion", "30")
        self.rejected(root, "maxSdkVersion")

    def test_scan_requires_only_never_for_location(self):
        for flags in ("0x00010000", "65536"):
            root = manifest()
            permission(root, "BLUETOOTH_SCAN").set(A + "usesPermissionFlags", flags)
            self.accepted(root)
        for flags in (None, "", "neverForLocation|unexpected", "0x00010001"):
            with self.subTest(flags=flags):
                root = manifest()
                if flags is None:
                    permission(root, "BLUETOOTH_SCAN").attrib.pop(A + "usesPermissionFlags")
                else:
                    permission(root, "BLUETOOTH_SCAN").set(A + "usesPermissionFlags", flags)
                self.rejected(root, "neverForLocation")

    def test_bluetooth_hardware_stays_optional(self):
        for required in (None, "true"):
            root = manifest()
            feature = root.find("uses-feature")
            if required is None:
                feature.attrib.pop(A + "required")
            else:
                feature.set(A + "required", required)
            self.rejected(root, "required=false")
        root = manifest()
        root.remove(root.find("uses-feature"))
        self.rejected(root, "required=false")
        root = manifest()
        ET.SubElement(root, "uses-feature", {A + "name": "android.hardware.bluetooth"})
        self.rejected(root, "必須条件")

    def test_location_and_bluetooth_require_explicit_optional_features(self):
        for name in ("android.hardware.bluetooth", "android.hardware.location"):
            root = manifest()
            root.remove(next(el for el in root.findall("uses-feature") if el.get(A + "name") == name))
            self.rejected(root, "required=false")

    def test_connected_service_is_narrow_and_stops_with_task(self):
        for key, value in (("exported", "true"), ("foregroundServiceType", "location"), ("stopWithTask", "false")):
            root = manifest()
            root.find("application/service").set(A + key, value)
            self.rejected(root, "NearbyConnectionService")

    def test_other_permissions_remain_denied(self):
        for name in ("ACCESS_BACKGROUND_LOCATION", "ACCESS_LOCAL_NETWORK", "NEARBY_WIFI_DEVICES"):
            root = manifest()
            ET.SubElement(root, "uses-permission", {A + "name": "android.permission." + name})
            self.rejected(root, "許可リスト外")

    def test_rejects_removed_product_plugin_and_prototype_leak(self):
        self.rejected(manifest(), "NearbyPlayPlugin", descriptors=())
        self.rejected(manifest(), "PoC", descriptors=(PLUGIN, "Lcom/pixapps/nearbypoc/NearbyPocPlugin;"))

    def test_meta_off_still_excludes_meta_classes(self):
        self.rejected(manifest(), "com/facebook", descriptors=(PLUGIN, "Lcom/facebook/core/Core;"))

    def test_meta_on_still_requires_explicit_opt_out_flags(self):
        root = manifest()
        app = root.find("application")
        for name in ("AutoInitEnabled", "AutoLogAppEventsEnabled", "AdvertiserIDCollectionEnabled"):
            ET.SubElement(app, "meta-data", {A + "name": "com.facebook.sdk." + name, A + "value": "false"})
        query = ET.SubElement(root, "queries")
        ET.SubElement(query, "provider", {A + "authorities": "com.facebook.katana.provider.AttributionIdProvider"})
        self.accepted(root, mode="on", descriptors=(PLUGIN, "Lcom/facebook/core/Core;"))
        app.find("meta-data").set(A + "value", "true")
        self.rejected(root, "false", mode="on", descriptors=(PLUGIN, "Lcom/facebook/core/Core;"))


class AndroidSourcePermissionTest(unittest.TestCase):
    def test_product_source_contract_accepts_network_state(self):
        root = manifest()
        ET.SubElement(root, "uses-permission", {A + "name": "android.permission.ACCESS_NETWORK_STATE"})
        self.assertEqual(source_errors(root, is_product=True), [])

    def test_nearby_exception_does_not_extend_to_other_apps(self):
        root = manifest()
        ET.SubElement(root, "uses-permission", {A + "name": "android.permission.ACCESS_NETWORK_STATE"})
        errors = source_errors(root, is_product=False)
        self.assertEqual(len(errors), 10)
        self.assertTrue(all("許可リスト外" in error for error in errors))

    def test_core_source_allowlist_is_preserved(self):
        root = ET.Element("manifest")
        for name in ("android.permission.INTERNET", "com.android.vending.BILLING", "com.google.android.gms.permission.AD_ID"):
            ET.SubElement(root, "uses-permission", {A + "name": name})
        self.assertEqual(source_errors(root, is_product=False), [])
        ET.SubElement(root, "uses-permission-sdk-23", {A + "name": "android.permission.CAMERA"})
        self.assertIn("CAMERA", source_errors(root, is_product=False)[0])

    def test_xml_formatting_and_alternate_permission_tag_cannot_hide_violation(self):
        root = ET.fromstring('''<manifest xmlns:a="http://schemas.android.com/apk/res/android">
            <uses-permission-sdk-23
              a:maxSdkVersion="30"
              a:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
            </manifest>''')
        self.assertTrue(any("ACCESS_BACKGROUND_LOCATION" in error for error in source_errors(root, is_product=True)))

    def test_source_enforces_same_nearby_bounds_as_merged_manifest(self):
        for change, message in (
            (lambda root: permission(root, "ACCESS_FINE_LOCATION").attrib.pop(A + "maxSdkVersion"), "maxSdkVersion"),
            (lambda root: permission(root, "BLUETOOTH_SCAN").attrib.pop(A + "usesPermissionFlags"), "neverForLocation"),
            (lambda root: root.find("uses-feature").set(A + "required", "true"), "required=false"),
        ):
            root = manifest()
            change(root)
            self.assertTrue(any(message in error for error in source_errors(root, is_product=True)))

    def test_source_cli_does_not_authorize_same_filename_outside_product_path(self):
        with tempfile.TemporaryDirectory(prefix="nearby-source-test-") as directory:
            path = Path(directory) / "apps/simple-games/android/app/src/main/AndroidManifest.xml"
            path.parent.mkdir(parents=True)
            ET.ElementTree(manifest()).write(path, encoding="utf-8", xml_declaration=True)
            result = subprocess.run(["python3", str(SCRIPT.with_name("android_permission_policy.py")), str(path)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("許可リスト外", result.stdout)


if __name__ == "__main__":
    unittest.main()
