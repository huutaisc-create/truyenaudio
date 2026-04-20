#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
upload_to_web.py
================
Bulk upload truyện từ local lên webtruyen-app qua API.

Luồng hoạt động:
  1. Đọc selections.json (do review.py tạo) nếu có
  2. Kết nối Neon PostgreSQL (pdcraw DB) lấy danh sách truyện cần upload
  3. Với mỗi truyện: lấy title/description từ selections.json, fallback về meta.json
  4. Đọc nội dung chương từ folder local
  5. POST lên /api/admin/stories
  6. Cập nhật web_upload_status / web_uploaded_chapters vào Neon DB

Workflow chuẩn:
  1. python review.py          → tạo review.html
  2. Mở review.html → chọn tên/mô tả → Export selections.json
  3. python upload_to_web.py   → upload với đúng tên/mô tả đã chọn

Cài đặt:
  pip install psycopg2-binary requests tqdm python-dotenv

Chạy:
  python upload_to_web.py
  python upload_to_web.py --slug "ten-truyen"        # upload 1 truyện cụ thể
  python upload_to_web.py --retry-errors              # upload lại các truyện bị lỗi
  python upload_to_web.py --dry-run                   # chỉ hiện thống kê, không upload
"""

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from datetime import datetime

import requests
import psycopg2
import psycopg2.extras
from tqdm import tqdm
from dotenv import load_dotenv

# ── Load .env nếu có ───────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent / ".env.upload")

# ── File selections.json (output từ review.html) ──────────────────────────────
SELECTIONS_FILE = Path(__file__).parent / "selections.json"

# ══════════════════════════════════════════════════════════════════════════════
#  CẤU HÌNH  —  sửa các giá trị này hoặc đặt trong file .env.upload
# ══════════════════════════════════════════════════════════════════════════════

# Neon PostgreSQL của hệ thống pdcraw
NEON_DB_URL = os.getenv(
    "NEON_DB_URL",
    "postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require"
)

# URL API của webtruyen-app (đã deploy trên Contabo)
WEB_API_URL = os.getenv(
    "WEB_API_URL",
    "https://yourdomain.com/api/admin/stories"
)

# URL API upload ảnh bìa (tự derive từ WEB_API_URL)
def _cover_api_url() -> str:
    base = WEB_API_URL.rstrip("/")
    # Thay /api/admin/stories → /api/admin/upload-image
    if base.endswith("/api/admin/stories"):
        return base[:-len("/stories")] + "/upload-image"
    return base.rsplit("/", 1)[0] + "/upload-image"

# Secret khớp với UPLOAD_SECRET trong .env của Next.js
UPLOAD_SECRET = os.getenv(
    "UPLOAD_SECRET",
    "df5e8753a931894d842645d812d2b23fe89917d87def1633c8926f2c67728a5c"
)

# Basic Auth của Nginx (đặt trống nếu không có)
BASIC_AUTH_USER = os.getenv("BASIC_AUTH_USER", "")
BASIC_AUTH_PASS = os.getenv("BASIC_AUTH_PASS", "")
BASIC_AUTH = (BASIC_AUTH_USER, BASIC_AUTH_PASS) if BASIC_AUTH_USER else None

# Thư mục gốc chứa dữ liệu truyện local.
# Cấu trúc mong đợi:
#   STORIES_DIR/
#     └── <slug>/
#           ├── 1.txt          # nội dung chương 1
#           ├── 2.txt          # nội dung chương 2
#           ├── meta.json      # metadata (description, genres, ...)  [tuỳ chọn]
#           └── titles.json    # {"1": "Tên chương 1", ...}           [tuỳ chọn]
STORIES_DIR = os.getenv("STORIES_DIR", r"D:\Webtruyen\data")

# Tên máy hiện tại (lọc theo cột storage_label trong Neon DB)
# Để None hoặc "" để lấy tất cả truyện không phân biệt máy
MACHINE_NAME = os.getenv("MACHINE_NAME", "")

# Trạng thái crawl được coi là "sẵn sàng upload"
READY_STATUSES = {"done", "completed", "full", "ready"}

# Giới hạn kích thước mỗi batch tính theo bytes JSON (tránh 413)
# Nginx đã set 20MB → đặt 15MB để có margin an toàn
BATCH_MAX_BYTES = int(os.getenv("BATCH_MAX_BYTES", str(15_000_000)))

# Số giây chờ giữa các truyện (tránh spam API)
DELAY_SECONDS = float(os.getenv("DELAY_SECONDS", "0.3"))

# Số lần retry khi API lỗi
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))

# Timeout mỗi request (giây)
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "120"))

# ══════════════════════════════════════════════════════════════════════════════

# Cấu hình logging
LOG_FILE = Path(__file__).parent / f"upload_log_{datetime.now():%Y%m%d_%H%M%S}.txt"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


# ── Database helpers ───────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(NEON_DB_URL)


def ensure_upload_columns(conn):
    """Tạo các cột tracking upload nếu chưa có (idempotent)."""
    with conn.cursor() as cur:
        cur.execute("""
            ALTER TABLE stories ADD COLUMN IF NOT EXISTS web_upload_status    VARCHAR(30)   DEFAULT NULL;
            ALTER TABLE stories ADD COLUMN IF NOT EXISTS web_upload_at        TIMESTAMPTZ   DEFAULT NULL;
            ALTER TABLE stories ADD COLUMN IF NOT EXISTS web_uploaded_chapters INTEGER       DEFAULT 0;
        """)
        conn.commit()
    log.info("Đã kiểm tra/tạo cột tracking upload trong Neon DB.")


def fetch_stories(conn, slug_filter=None, retry_errors=False):
    """
    Lấy danh sách truyện cần upload từ Neon DB.

    Ưu tiên:
      - Chưa upload (web_upload_status IS NULL)
      - Khi --retry-errors: cả những truyện bị lỗi trước đó
      - Bỏ qua truyện đã done thành công
    """
    conditions = []
    params = []

    if slug_filter:
        conditions.append("slug = %s")
        params.append(slug_filter)
        # --slug vẫn bỏ qua 'done' trừ khi kết hợp với --retry-errors
        if not retry_errors:
            conditions.append("web_upload_status IS DISTINCT FROM 'done'")
    else:
        # Lọc theo crawl_status
        conditions.append("crawl_status = ANY(%s)")
        params.append(list(READY_STATUSES))

        # Loại bỏ đã upload thành công
        if retry_errors:
            conditions.append("web_upload_status IS DISTINCT FROM 'done'")
        else:
            conditions.append("(web_upload_status IS NULL OR web_upload_status IN ('error', 'uploading'))")

        # Lọc theo máy
        if MACHINE_NAME:
            conditions.append("storage_label = %s")
            params.append(MACHINE_NAME)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    sql = f"""
        SELECT
            id, title, slug, author, category,
            cover_url, book_status, views, likes, rating,
            actual_chapters, web_upload_status, storage_label
        FROM stories
        WHERE {where_clause}
        ORDER BY id ASC
    """
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(sql, params or None)
        return [dict(row) for row in cur.fetchall()]


def update_upload_status(conn, story_id: int, status: str, uploaded_chapters: int = 0):
    """Cập nhật kết quả upload vào Neon DB."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE stories
            SET web_upload_status      = %s,
                web_upload_at          = NOW(),
                web_uploaded_chapters  = %s
            WHERE id = %s
        """, (status, uploaded_chapters, story_id))
        conn.commit()


# ── Selections helpers (từ review.html) ───────────────────────────────────────

def load_selections() -> dict:
    """
    Đọc selections.json do review.html export ra.
    Trả về dict: { slug → { title, description, hashtags, genres, category } }
    """
    if not SELECTIONS_FILE.exists():
        return {}

    try:
        data = json.loads(SELECTIONS_FILE.read_text(encoding="utf-8"))
        result = {}
        for item in data.get("selections", []):
            if item.get("ready"):  # chỉ lấy truyện đã đánh dấu sẵn sàng
                result[item["slug"]] = {
                    "title":       item.get("title", ""),
                    "description": item.get("description", ""),
                    "hashtags":    item.get("hashtags", []),
                    "category":    item.get("category", ""),
                    "genres":      item.get("genres", []),
                }
        log.info(f"Đã đọc selections.json: {len(result)} truyện sẵn sàng upload.")
        return result
    except Exception as e:
        log.warning(f"Không đọc được selections.json: {e}")
        return {}


# ── Cover image helpers ────────────────────────────────────────────────────────

IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]

def find_cover_image(story_dir: Path) -> Path | None:
    """Tìm file ảnh đầu tiên trong thư mục truyện."""
    for ext in IMAGE_EXTS:
        matches = list(story_dir.glob(f"*{ext}")) + list(story_dir.glob(f"*{ext.upper()}"))
        if matches:
            return matches[0]
    return None


COVER_MAX_WIDTH  = 800    # resize nếu rộng hơn (px)
COVER_WEBP_Q     = 85    # WebP quality ban đầu
COVER_WEBP_MIN_Q = 50    # quality tối thiểu khi cần nén thêm
COVER_MAX_BYTES  = 300_000  # mục tiêu ≤ 300KB sau khi nén


def _compress_to_webp(img_path: Path) -> bytes:
    """
    Đọc ảnh gốc (bất kỳ format), resize nếu quá rộng,
    convert sang WebP và nén xuống dưới COVER_MAX_BYTES.
    Yêu cầu: pip install Pillow
    """
    from PIL import Image
    import io

    img = Image.open(img_path)

    # Giữ transparency nếu có (RGBA), còn lại convert RGB
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    # Resize nếu quá rộng, giữ tỷ lệ
    if img.width > COVER_MAX_WIDTH:
        ratio = COVER_MAX_WIDTH / img.width
        img = img.resize((COVER_MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)

    # Encode WebP, giảm quality dần cho đến khi đạt mục tiêu
    quality = COVER_WEBP_Q
    buf = io.BytesIO()
    while quality >= COVER_WEBP_MIN_Q:
        buf.seek(0); buf.truncate()
        img.save(buf, format="WEBP", quality=quality, method=6)
        if buf.tell() <= COVER_MAX_BYTES:
            break
        quality -= 5

    size_kb = buf.tell() // 1024
    log.info(f"  🗜  Compressed → WebP  {size_kb}KB  (quality={quality})")
    return buf.getvalue()


def upload_cover_image(story_dir: Path, slug: str,
                       max_retries: int = MAX_RETRIES,
                       timeout: int = REQUEST_TIMEOUT) -> str | None:
    """
    Tìm ảnh bìa trong story_dir, compress nếu cần, upload lên /api/admin/upload-image.
    Trả về URL ảnh (vd: /covers/slug.jpg) hoặc None nếu không có / lỗi.
    """
    img_path = find_cover_image(story_dir)
    if not img_path:
        return None

    api_url = _cover_api_url()

    try:
        img_bytes = _compress_to_webp(img_path)
    except ImportError:
        log.error("  ✗ Cần cài Pillow: pip install Pillow")
        return None
    except Exception as e:
        log.error(f"  ✗ Lỗi xử lý ảnh {img_path.name}: {e}")
        return None

    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.post(
                api_url,
                headers={"X-Upload-Secret": UPLOAD_SECRET},
                files={"image": (f"{slug}.webp", img_bytes, "image/webp")},
                data={"slug": slug},
                auth=BASIC_AUTH,
                timeout=timeout,
            )
            if resp.status_code == 200 and resp.json().get("success"):
                url = resp.json()["url"]
                log.info(f"  🖼  Cover uploaded: {url}  ({len(img_bytes)//1024}KB)")
                return url
            else:
                log.warning(f"  [!] Cover upload lỗi (attempt {attempt}): {resp.text[:200]}")
        except Exception as e:
            log.warning(f"  [!] Cover upload exception (attempt {attempt}): {e}")
        if attempt < max_retries:
            time.sleep(1)

    log.error(f"  ✗ Không upload được ảnh bìa cho {slug}")
    return None


# ── Local file helpers ─────────────────────────────────────────────────────────

def read_meta(story_dir: Path) -> dict:
    """
    Đọc meta.json nếu tồn tại.
    Format linh hoạt — hỗ trợ nhiều key khác nhau từ Gemini extract.
    """
    meta_path = story_dir / "meta.json"
    if not meta_path.exists():
        return {}
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        log.warning(f"  meta.json lỗi: {e}")
        return {}


def read_titles(story_dir: Path) -> dict:
    """
    Đọc titles.json nếu có: {"1": "Tên chương 1", "2": "..."}
    Fallback: lấy dòng đầu tiên của file txt.
    """
    titles_path = story_dir / "titles.json"
    if titles_path.exists():
        try:
            data = json.loads(titles_path.read_text(encoding="utf-8"))
            return {str(k): str(v) for k, v in data.items()}
        except Exception:
            pass
    return {}


def read_chapters(story_dir: Path, titles: dict) -> list[dict]:
    """
    Đọc tất cả file chương từ thư mục truyện.

    Hỗ trợ 2 định dạng tên file của pdcraw:
      - Kiểu pdcraw: <ten-truyen>_0001.txt  (regex: _(\d+)\.txt$)
      - Kiểu đơn giản: 1.txt, 2.txt, ...    (stem là số nguyên thuần)

    Trả về list đã sort theo index tăng dần.
    """
    import re as _re

    # Pattern: {title}_{NNNN}.txt — index là số cuối trước .txt, title là phần còn lại
    PDCRAW_PATTERN = _re.compile(r'^(.+?)_(\d+)\.txt$', _re.IGNORECASE)
    SIMPLE_PATTERN = _re.compile(r'^(\d+)$')   # 1.txt, 2.txt

    chapters = []
    for txt_file in story_dir.glob("*.txt"):
        m = PDCRAW_PATTERN.match(txt_file.name)
        if m:
            index     = int(m.group(2))
            # Title lấy thẳng từ tên file, replace _ thành space
            title_raw = m.group(1).replace("_", " ").strip()
            title     = titles.get(str(index)) or (title_raw if title_raw else f"Chương {index}")
        else:
            m2 = SIMPLE_PATTERN.match(txt_file.stem)
            if not m2:
                continue   # bỏ meta.json, upload.json, ...
            index = int(m2.group(1))
            title = titles.get(str(index)) or f"Chương {index}"

        try:
            content = txt_file.read_text(encoding="utf-8", errors="ignore").strip()
        except Exception as e:
            log.warning(f"  Không đọc được {txt_file.name}: {e}")
            continue

        if not content:
            continue

        chapters.append({
            "index":   index,
            "title":   title,
            "content": content,
        })

    # Sort theo index tăng dần
    chapters.sort(key=lambda c: c["index"])
    return chapters


# ── Payload builder ────────────────────────────────────────────────────────────

def _normalize_slug(s: str) -> str:
    """đ/Đ không phân giải được bằng NFD — replace thủ công trước."""
    import unicodedata as _ud, re as _re
    s = s.replace('đ', 'd').replace('Đ', 'D')
    s = _ud.normalize('NFD', s)
    s = ''.join(c for c in s if _ud.category(c) != 'Mn')
    s = _re.sub(r'[^a-z0-9]+', '-', s.lower())
    return s.strip('-')


def _parse_count(val) -> int:
    """Chuyển '1.2K', '5M', '123,456' thành số nguyên."""
    if not val:
        return 0
    s = str(val).strip().upper().replace(",", "")
    try:
        if s.endswith("K"):
            return int(float(s[:-1]) * 1_000)
        if s.endswith("M"):
            return int(float(s[:-1]) * 1_000_000)
        return int(float(s))
    except Exception:
        return 0


def _parse_rating(val) -> float:
    """Chuyển '8.5/10', '8.5', '85%' thành float 0-10."""
    if not val:
        return 0.0
    try:
        s = str(val).strip()
        if "%" in s:
            return round(float(s.replace("%", "")) / 10, 2)
        return round(float(s.split("/")[0].strip()), 2)
    except Exception:
        return 0.0


def build_payload(story: dict, meta: dict, chapters: list[dict],
                  selection: dict | None = None,
                  cover_url_override: str | None = None) -> dict:
    """
    Tạo JSON payload gửi lên API.

    Thứ tự ưu tiên:
      title       → selection (review.html) > Neon DB > meta.json
      description → selection (review.html) > meta.json
      genres      → selection (review.html) > meta.json > Neon DB category
    """

    # ── Title ──────────────────────────────────────────────────────────────────
    title = (
        (selection.get("title") if selection else None)
        or story.get("title")
        or meta.get("original_title")
        or story["slug"]
    )

    # ── Slug ───────────────────────────────────────────────────────────────────
    # Ưu tiên slug từ title đã chọn (review.html) để URL khớp tên hiển thị
    resolved_slug = _normalize_slug(title) if title else _normalize_slug(story["slug"])

    # ── Description ────────────────────────────────────────────────────────────
    description = (
        (selection.get("description") if selection else None)
        or meta.get("description")
        or meta.get("intro")
        or ""
    )

    # ── Genres ─────────────────────────────────────────────────────────────────
    if selection and selection.get("genres"):
        genres = selection["genres"]
    elif selection and selection.get("category"):
        genres = [g.strip() for g in selection["category"].split(",") if g.strip()]
    elif meta.get("category"):
        genres = [g.strip() for g in str(meta["category"]).split(",") if g.strip()]
    elif story.get("category"):
        genres = [g.strip() for g in str(story["category"]).split(",") if g.strip()]
    else:
        genres = []

    def _list(key, *aliases):
        for k in [key] + list(aliases):
            v = meta.get(k)
            if v:
                return v if isinstance(v, list) else [v]
        return []

    return {
        "story": {
            "slug":        resolved_slug,
            "title":       title,
            "author":      story.get("author") or "Unknown",
            "description": description,
            "cover_url":   cover_url_override if cover_url_override is not None else (story.get("cover_url") or ""),
            "book_status": story.get("book_status") or "Ongoing",
            "genres":      genres,
            "boiCanh":     _list("boiCanh",  "boi_canh"),
            "luuPhai":     _list("luuPhai",  "luu_phai"),
            "tinhCach":    _list("tinhCach", "tinh_cach"),
            "thiGiac":     _list("thiGiac",  "thi_giac"),
            "viewCount":   _parse_count(story.get("views")),
            "likeCount":   _parse_count(story.get("likes")),
            "ratingScore": _parse_rating(story.get("rating")),
        },
        "chapters": chapters,
    }


# ── Batch helpers ─────────────────────────────────────────────────────────────

def split_chapters_by_payload_size(chapters: list[dict], story_part: dict,
                                    max_bytes: int = BATCH_MAX_BYTES) -> list[list[dict]]:
    """
    Chia chapters thành batches sao cho FULL JSON payload ≤ max_bytes.
    Tính cả story object overhead để không bị 413.
    """
    story_bytes = len(json.dumps({"story": story_part, "chapters": []},
                                 ensure_ascii=False).encode("utf-8"))
    effective_max = max_bytes - story_bytes

    batches: list[list[dict]] = []
    current: list[dict] = []
    current_size = 0

    for ch in chapters:
        ch_bytes = len(json.dumps(ch, ensure_ascii=False).encode("utf-8"))
        if current and current_size + ch_bytes > effective_max:
            batches.append(current)
            current = [ch]
            current_size = ch_bytes
        else:
            current.append(ch)
            current_size += ch_bytes

    if current:
        batches.append(current)

    return batches


# ── API call ───────────────────────────────────────────────────────────────────

def upload_story(payload: dict) -> dict:
    """POST lên web API. Trả về dict response."""
    resp = requests.post(
        WEB_API_URL,
        json=payload,
        headers={
            "X-Upload-Secret": UPLOAD_SECRET,
            "Content-Type":    "application/json",
        },
        auth=BASIC_AUTH,
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


# ── Main ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Bulk upload truyện từ local lên webtruyen-app")
    p.add_argument("--slug",         help="Upload 1 truyện theo slug cụ thể")
    p.add_argument("--retry-errors", action="store_true", help="Upload lại những truyện bị lỗi")
    p.add_argument("--dry-run",      action="store_true", help="Chỉ thống kê, không upload")
    p.add_argument("--limit",        type=int, default=0, help="Giới hạn số truyện xử lý (0 = không giới hạn)")
    return p.parse_args()


def main():
    args = parse_args()
    stories_dir = Path(STORIES_DIR)

    print(f"\n{'═'*62}")
    print(f"  WebTruyen Bulk Uploader  |  {datetime.now():%Y-%m-%d %H:%M:%S}")
    print(f"  API : {WEB_API_URL}")
    print(f"  DIR : {stories_dir}")
    if MACHINE_NAME:
        print(f"  MÁY : {MACHINE_NAME}")
    print(f"{'═'*62}\n")

    # Kết nối DB
    try:
        conn = get_conn()
    except Exception as e:
        log.error(f"Không kết nối được Neon DB: {e}")
        sys.exit(1)

    ensure_upload_columns(conn)

    # Lấy danh sách truyện
    stories = fetch_stories(conn, slug_filter=args.slug, retry_errors=args.retry_errors)

    if not stories:
        print("✅ Không có truyện nào cần upload.")
        conn.close()
        return

    if args.limit:
        stories = stories[:args.limit]

    total = len(stories)
    print(f"📚 Tìm thấy {total} truyện cần upload\n")

    if args.dry_run:
        print("── DRY RUN — danh sách sẽ được xử lý ──")
        for s in stories:
            story_dir = stories_dir / s["slug"]
            has_dir = "✓" if story_dir.exists() else "✗"
            print(f"  [{has_dir}] {s['slug']}  ({s.get('web_upload_status') or 'chưa upload'})")
        conn.close()
        return

    # ── Đọc selections.json nếu có ────────────────────────────────
    selections = load_selections()
    if not selections:
        print("⚠️  Không tìm thấy selections.json.")
        print("   → Chạy review.py → chọn truyện → Export selections.json rồi mới upload.")
        conn.close()
        return

    tqdm.write(f"📋 selections.json: {len(selections)} truyện sẵn sàng upload\n")
    ready_slugs = set(selections.keys())
    stories = [s for s in stories if s["slug"] in ready_slugs]
    if not stories:
        print("⚠️  Các truyện trong selections.json đã được upload hết rồi.")
        conn.close()
        return
    tqdm.write(f"🔎 Sẽ upload: {len(stories)} truyện\n")

    # ── Bắt đầu upload ────────────────────────────────────────────
    counts = {"ok": 0, "error": 0, "skip": 0}

    for i, story in enumerate(tqdm(stories, desc="Upload", unit="truyện"), 1):
        slug      = story["slug"]
        story_dir = stories_dir / slug
        title_display = (story.get("title") or slug)[:60]

        tqdm.write(f"\n{'─'*62}")
        tqdm.write(f"[{i}/{len(stories)}] {title_display}")
        tqdm.write(f"  slug    : {slug}")
        log.info(f"--- BẮT ĐẦU [{i}/{len(stories)}] {slug} ---")

        # ── [1] Kiểm tra thư mục ──────────────────────────────────
        tqdm.write(f"  [1/6] Kiểm tra thư mục local...")
        if not story_dir.exists():
            tqdm.write(f"  ⚠  SKIP — Không tìm thấy thư mục: {story_dir}")
            log.warning(f"SKIP {slug}: thư mục không tồn tại")
            counts["skip"] += 1
            continue
        tqdm.write(f"  ✓  Thư mục OK: {story_dir}")

        # ── [2] Đọc meta & chapters ───────────────────────────────
        tqdm.write(f"  [2/6] Đọc meta.json và chapters...")
        meta     = read_meta(story_dir)
        titles   = read_titles(story_dir)
        chapters = read_chapters(story_dir, titles)

        if not chapters:
            tqdm.write(f"  ⚠  SKIP — Không có file chapter nào")
            log.warning(f"SKIP {slug}: không có chapter")
            counts["skip"] += 1
            continue

        selection = selections.get(slug)
        tqdm.write(f"  ✓  {len(chapters)} chương  |  meta: {'✓' if meta else '✗'}  |  title nguồn: {'selections.json' if selection else 'meta.json/DB'}")
        log.info(f"  chapters={len(chapters)}  meta={'yes' if meta else 'no'}")

        # ── [3] Lấy title / description ───────────────────────────
        tqdm.write(f"  [3/6] Xác định title & description...")
        _tmp_payload = build_payload(story, meta, [], selection=selection, cover_url_override="")
        tqdm.write(f"  ✓  Title     : {_tmp_payload['story']['title']}")
        tqdm.write(f"  ✓  Desc      : {str(_tmp_payload['story'].get('description',''))[:80]}{'...' if len(str(_tmp_payload['story'].get('description',''))) > 80 else ''}")
        tqdm.write(f"  ✓  Genres    : {_tmp_payload['story'].get('genres')}")

        # ── [4] Upload ảnh bìa ────────────────────────────────────
        tqdm.write(f"  [4/6] Upload ảnh bìa...")
        cover_url = story.get("cover_url") or ""
        if cover_url:
            tqdm.write(f"  ✓  Cover đã có trong DB: {cover_url}")
            log.info(f"  cover: đã có trong DB")
        else:
            img_path = find_cover_image(story_dir)
            if img_path:
                tqdm.write(f"  →  Tìm thấy ảnh: {img_path.name}  ({img_path.stat().st_size // 1024}KB gốc)")
                cover_url = upload_cover_image(story_dir, slug) or ""
                if cover_url:
                    tqdm.write(f"  ✓  Cover uploaded: {cover_url}")
                    log.info(f"  cover: {cover_url}")
                else:
                    tqdm.write(f"  ⚠  Cover upload thất bại — tiếp tục không có ảnh bìa")
                    log.warning(f"  cover: upload failed")
            else:
                tqdm.write(f"  ⚠  Không tìm thấy file ảnh trong thư mục")
                log.warning(f"  cover: không có file ảnh")

        # ── [5] Upload chapters theo batch ────────────────────────
        tqdm.write(f"  [5/6] Upload chapters...")

        # Resume: gửi toàn bộ chapters, API tự dedup bằng chapter index
        # → không bao giờ bị trùng, không cần đoán cái nào đã upload
        already_uploaded = story.get("web_uploaded_chapters") or 0
        if already_uploaded > 0:
            tqdm.write(f"  →  Resume từ lần trước: {already_uploaded}/{len(chapters)} chương đã có trên server")
            tqdm.write(f"  →  Gửi toàn bộ {len(chapters)} chương, server tự bỏ qua phần đã có")
            log.info(f"  resume: already={already_uploaded}, sending all {len(chapters)} (API will dedup)")

        # Lấy story part để tính overhead khi split
        _story_part = build_payload(story, meta, [], selection=selection,
                                    cover_url_override=cover_url if cover_url else None)["story"]
        batches   = split_chapters_by_payload_size(chapters, _story_part, BATCH_MAX_BYTES)
        n_batches = len(batches)
        sizes_kb  = [
            len(json.dumps({"story": _story_part, "chapters": b}, ensure_ascii=False).encode()) // 1024
            for b in batches
        ]
        tqdm.write(f"  →  {len(chapters)} chương → {n_batches} batch  (max {max(sizes_kb) if sizes_kb else 0}KB/batch, limit {BATCH_MAX_BYTES//1024}KB)")

        story_ok       = True
        total_inserted = 0
        last_err       = None

        # Dùng queue để hỗ trợ tự động cắt đôi khi 413
        batch_queue = list(batches)
        b_idx = 0

        while batch_queue:
            batch = batch_queue.pop(0)
            b_idx += 1
            ch_from  = batch[0]["index"]
            ch_to    = batch[-1]["index"]
            size_kb  = len(json.dumps({"story": _story_part, "chapters": batch},
                                      ensure_ascii=False).encode()) // 1024
            tqdm.write(f"  →  Batch {b_idx}: chương {ch_from}–{ch_to} ({len(batch)} chương, ~{size_kb}KB)...")

            payload = build_payload(
                story, meta, batch,
                selection=selection,
                # Luôn truyền cover_url nếu có — tránh batch sau overwrite coverImage thành ""
                cover_url_override=cover_url if cover_url else None,
            )

            result   = None
            last_err = None
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    result = upload_story(payload)
                    break
                except requests.exceptions.HTTPError as e:
                    last_err = str(e)
                    status_code = e.response.status_code if e.response is not None else 0
                    if status_code == 413:
                        # Cắt đôi batch rồi thử lại — không tính là lần retry
                        mid = len(batch) // 2
                        if mid == 0:
                            tqdm.write(f"     ✗  Batch chỉ còn 1 chương mà vẫn 413 — bỏ qua")
                            break
                        tqdm.write(f"     ⚡ 413 — tự động cắt đôi: {len(batch)} → {mid} + {len(batch)-mid} chương")
                        log.warning(f"  batch {b_idx}: 413, split {len(batch)} → {mid}+{len(batch)-mid}")
                        batch_queue.insert(0, batch[mid:])
                        batch_queue.insert(0, batch[:mid])
                        result = None
                        last_err = "413_split"
                        break   # ra khỏi retry loop, lấy batch mới từ queue
                    tqdm.write(f"     ↩  Lần {attempt}: HTTP {status_code} — {last_err[:80]}")
                    log.warning(f"  batch {b_idx} attempt {attempt}: {last_err}")
                    if status_code < 500:
                        break
                    time.sleep(2 ** attempt)
                except requests.exceptions.Timeout:
                    last_err = "timeout"
                    tqdm.write(f"     ↩  Lần {attempt}: timeout, thử lại...")
                    log.warning(f"  batch {b_idx} attempt {attempt}: timeout")
                    time.sleep(2 ** attempt)
                except Exception as e:
                    last_err = str(e)
                    tqdm.write(f"     ↩  Lần {attempt}: {last_err[:80]}")
                    log.warning(f"  batch {b_idx} attempt {attempt}: {last_err}")
                    time.sleep(2 ** attempt)

            if last_err == "413_split":
                b_idx -= 1   # không đếm batch bị split
                continue

            if result and result.get("success"):
                inserted = result.get("newChapters", 0)
                total_inserted += inserted
                tqdm.write(f"  ✓  Batch {b_idx} — {inserted} chương mới (tổng: {total_inserted})")
                log.info(f"  batch {b_idx}: OK  inserted={inserted}")
                saved = already_uploaded + total_inserted
                update_upload_status(conn, story["id"], "uploading", saved)
                tqdm.write(f"     💾 DB saved: uploading  {saved}/{len(chapters)} chương")
                log.info(f"  DB: uploading  saved={saved}")
            else:
                msg = (result.get("message") if result else None) or last_err or "unknown"
                tqdm.write(f"  ❌ Batch {b_idx} THẤT BẠI: {msg}")
                log.error(f"  batch {b_idx}: FAIL — {msg}")
                story_ok = False
                break

        # ── [6] Cập nhật DB ───────────────────────────────────────
        tqdm.write(f"  [6/6] Cập nhật Neon DB...")
        if story_ok:
            update_upload_status(conn, story["id"], "done", len(chapters))
            tqdm.write(f"  ✓  DB updated: done  |  tổng {total_inserted}/{len(chapters)} chương mới")
            log.info(f"  DB: done  total_inserted={total_inserted}/{len(chapters)}")
            tqdm.write(f"  ✅ HOÀN THÀNH: {title_display}")
            log.info(f"OK {slug}: {total_inserted} chương mới")
            counts["ok"] += 1
        else:
            update_upload_status(conn, story["id"], "error", total_inserted)
            tqdm.write(f"  ✗  DB updated: error  |  {total_inserted} chương đã upload trước khi lỗi")
            log.error(f"  DB: error  partial={total_inserted}")
            tqdm.write(f"  ❌ THẤT BẠI: {title_display}")
            counts["error"] += 1

        if i < len(stories):
            time.sleep(DELAY_SECONDS)

    conn.close()

    # ── Tổng kết ──────────────────────────────────────────────────
    print(f"\n{'═'*62}")
    print(f"  ✅ Thành công : {counts['ok']}")
    print(f"  ❌ Lỗi       : {counts['error']}")
    print(f"  ⏭  Bỏ qua    : {counts['skip']}")
    print(f"  📄 Log file  : {LOG_FILE.name}")
    print(f"{'═'*62}\n")


if __name__ == "__main__":
    main()
