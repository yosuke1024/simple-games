#!/usr/bin/env python3
"""Shared source/merged-manifest bounds for the product's Nearby permissions."""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

A = "{http://schemas.android.com/apk/res/android}"
LEGACY = tuple("android.permission." + name for name in (
    "BLUETOOTH", "BLUETOOTH_ADMIN", "ACCESS_FINE_LOCATION",
))
NEARBY = LEGACY + tuple("android.permission." + name for name in (
    "BLUETOOTH_SCAN", "BLUETOOTH_ADVERTISE", "BLUETOOTH_CONNECT",
))
CORE_SOURCE = {
    "android.permission.INTERNET",
    "com.android.vending.BILLING",
    "com.google.android.gms.permission.AD_ID",
}
PRODUCT_MANIFEST = Path(__file__).resolve().parents[2] / "apps/simple-games/android/app/src/main/AndroidManifest.xml"


def permissions(root):
    return [el for tag in ("uses-permission", "uses-permission-sdk-23") for el in root.findall(tag)]


def nearby_errors(root):
    errors = []
    elements = permissions(root)
    for name in NEARBY:
        declarations = [el for el in elements if el.get(A + "name") == name]
        if len(declarations) != 1:
            errors.append(f"Nearby 権限は一度だけ宣言する必要があります: {name}")
            continue
        permission = declarations[0]
        expected_max = "30" if name in LEGACY else None
        if permission.get(A + "maxSdkVersion") != expected_max:
            errors.append(f"Nearby 権限の maxSdkVersion が不正です: {name} (expected {expected_max})")
        flags = permission.get(A + "usesPermissionFlags")
        if name == "android.permission.BLUETOOTH_SCAN":
            if flags not in ("neverForLocation", "0x00010000", "65536"):
                errors.append("BLUETOOTH_SCAN には neverForLocation が必要です")
        elif flags is not None:
            errors.append(f"Nearby 権限に予期しない usesPermissionFlags があります: {name}")

    ble = [el for el in root.findall("uses-feature") if el.get(A + "name") == "android.hardware.bluetooth_le"]
    if len(ble) != 1 or ble[0].get(A + "required") != "false":
        errors.append("Nearby BLE hardware feature は required=false で一度だけ宣言してください")
    for feature in root.findall("uses-feature"):
        if (feature.get(A + "name") or "").startswith("android.hardware.bluetooth") and feature.get(A + "required") != "false":
            errors.append("Bluetooth hardware を製品全体の必須条件にできません")
    return errors


def source_errors(root, *, is_product):
    allowed = CORE_SOURCE | (set(NEARBY) | {"android.permission.ACCESS_NETWORK_STATE"} if is_product else set())
    errors = [f"許可リスト外の権限: {el.get(A + 'name')}" for el in permissions(root) if el.get(A + "name") not in allowed]
    if is_product:
        errors.extend(nearby_errors(root))
    return errors


def main(paths):
    failed = False
    for path in paths:
        source = Path(path)
        if not source.is_file():
            print(f"manifest が見つかりません: {path}")
            failed = True
            continue
        try:
            errors = source_errors(ET.parse(source).getroot(), is_product=source.resolve() == PRODUCT_MANIFEST)
        except ET.ParseError as error:
            errors = [f"manifest XML が不正です: {error}"]
        for error in errors:
            print(f"{path}: {error}")
        failed |= bool(errors)
    return int(failed)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
