"""
fix_bad_reviews.py
──────────────────
Tìm và xóa các aiReview bị upload sai định dạng (HTML thô thay vì Markdown).

Dấu hiệu nhận biết review lỗi:
  - Chứa <!DOCTYPE html> hoặc <html
  - Chứa <style> block với @page / CSS
  - Chứa class="header-banner" hoặc class="info-box"
  - Chứa weasyprint / write_pdf (artifact từ script tạo PDF)

Cách dùng:
  python fix_bad_reviews.py          # chỉ preview, không xóa
  python fix_bad_reviews.py --fix    # xóa thật (set aiReview = NULL)
"""

import sys
import psycopg2
from pathlib import Path
from dotenv import load_dotenv
import os

# ── Load env ──────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent.parent / ".env.local"
if not env_path.exists():
    env_path = Path(__file__).parent / ".env.upload"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    print("❌ Không tìm thấy DATABASE_URL trong .env.local")
    sys.exit(1)

DRY_RUN = "--fix" not in sys.argv

# ── Patterns nhận diện review HTML lỗi ───────────────────────────────────────
BAD_PATTERNS = [
    "<!DOCTYPE html>",
    "<!doctype html>",
    "<html",
    "<style>",
    "@page {",
    "header-banner",
    "info-box",
    "weasyprint",
    "write_pdf",
    "font-family: 'Times New Roman'",
    "text-transform: uppercase",
    "border-left: 5px solid",
]

def is_bad_review(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    for pat in BAD_PATTERNS:
        if pat.lower() in lower:
            return True
    return False

def main():
    print("=" * 60)
    print("  Fix Bad AI Reviews — webtruyen-app DB")
    print(f"  Mode: {'🔍 DRY RUN (preview)' if DRY_RUN else '🗑️  FIX (xóa thật)'}")
    print("=" * 60)

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    # Lấy tất cả stories có aiReview
    cur.execute("""
        SELECT slug, title, "aiReview"
        FROM "Story"
        WHERE "aiReview" IS NOT NULL AND "aiReview" != ''
        ORDER BY title
    """)
    rows = cur.fetchall()
    print(f"\nTổng số truyện có aiReview: {len(rows)}")

    bad = []
    for slug, title, review in rows:
        if is_bad_review(review):
            bad.append((slug, title, review))

    print(f"Truyện có review HTML lỗi:   {len(bad)}\n")

    if not bad:
        print("✅ Không tìm thấy review lỗi nào!")
        cur.close(); conn.close()
        return

    print(f"{'STT':<4} {'Slug':<40} {'Tên truyện':<35} {'Dấu hiệu'}")
    print("-" * 120)
    for i, (slug, title, review) in enumerate(bad, 1):
        # Tìm pattern đầu tiên khớp
        found = next((p for p in BAD_PATTERNS if p.lower() in review.lower()), "?")
        print(f"{i:<4} {slug:<40} {(title or '')[:35]:<35} contains: {found!r}")

    if DRY_RUN:
        print(f"\n⚠️  DRY RUN — chưa xóa gì cả.")
        print(f"    Chạy lại với --fix để xóa {len(bad)} review lỗi:")
        print(f"    python fix_bad_reviews.py --fix")
    else:
        slugs = [s for s, _, _ in bad]
        cur.execute("""
            UPDATE "Story"
            SET "aiReview" = NULL
            WHERE slug = ANY(%s)
        """, (slugs,))
        conn.commit()
        print(f"\n✅ Đã xóa aiReview của {cur.rowcount} truyện.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
