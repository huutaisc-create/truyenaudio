"""
Upload model files to VPS via /api/admin/upload-model

Usage:
    python scripts/upload_model.py ban_mai_vits

This uploads:
    public/models/custom/ban_mai_vits.onnx
    public/models/custom/ban_mai_vits.onnx.json

to https://mytruyenaudio.com/models/custom/
"""

import sys
import os
import requests
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
UPLOAD_SECRET = "df5e8753a931894d842645d812d2b23fe89917d87def1633c8926f2c67728a5c"
BASE_URL      = "https://mytruyenaudio.com"
API_URL       = f"{BASE_URL}/api/admin/upload-model"

SCRIPT_DIR    = Path(__file__).parent
MODELS_DIR    = SCRIPT_DIR.parent / "public" / "models" / "custom"

# ── Main ──────────────────────────────────────────────────────────────────────

def upload_file(local_path: Path, filename: str) -> bool:
    size_mb = local_path.stat().st_size / 1024 / 1024
    print(f"  → Uploading {filename} ({size_mb:.1f} MB)...")

    with open(local_path, "rb") as f:
        resp = requests.post(
            API_URL,
            headers={"x-upload-secret": UPLOAD_SECRET},
            files={"file": (filename, f)},
            data={"filename": filename},
            timeout=300,  # 5 min for large files
        )

    if resp.ok:
        print(f"  ✅ {resp.json()}")
        return True
    else:
        print(f"  ❌ HTTP {resp.status_code}: {resp.text[:200]}")
        return False


def main():
    model_name = sys.argv[1] if len(sys.argv) > 1 else "ban_mai_vits"

    onnx_file = MODELS_DIR / f"{model_name}.onnx"
    json_file = MODELS_DIR / f"{model_name}.onnx.json"

    for f in [onnx_file, json_file]:
        if not f.exists():
            print(f"❌ File not found: {f}")
            sys.exit(1)

    print(f"Uploading '{model_name}' to {BASE_URL}...")
    ok1 = upload_file(json_file, json_file.name)   # config first (small)
    ok2 = upload_file(onnx_file, onnx_file.name)   # model second (large)

    if ok1 and ok2:
        print(f"\n✅ Done! Verify:")
        print(f"   {BASE_URL}/models/custom/{model_name}.onnx.json")
        print(f"   {BASE_URL}/models/custom/{model_name}.onnx")
    else:
        print("\n❌ Some files failed to upload.")
        sys.exit(1)


if __name__ == "__main__":
    main()
