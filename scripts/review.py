#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
review.py
=========
Scan thư mục data_import/, tạo review.html để chọn tên/mô tả truyện.
Đồng thời khởi động local API server (port 8765) để HTML gọi 2 tính năng:
  - Kiểm tra trùng chương  (GET /check?slug=xxx)
  - Xử lý văn bản           (GET /process?slug=xxx&type=codai|hiendai)

Chạy:
  python review.py
  python review.py --dir "D:\\Webtruyen\\pdcraw\\data_import"
"""

import os
import sys
import json
import re
import argparse
import unicodedata
import threading
import subprocess
from pathlib import Path
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
from urllib.parse import urlparse, parse_qs

# ── Crawl subprocess tracking ─────────────────────────────────────────────────
_crawl_procs: dict = {}   # slug → subprocess.Popen
_crawl_logs:  dict = {}   # slug → list[str]
_crawl_lock   = threading.Lock()

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env.upload")

STORIES_DIR  = os.getenv("STORIES_DIR", r"D:\Webtruyen\pdcraw\data_import")
OUTPUT_HTML  = Path(__file__).parent / "review.html"
SERVER_PORT  = 8765

# Upload API
WEB_API_URL      = os.getenv("WEB_API_URL", "")
UPLOAD_SECRET    = os.getenv("UPLOAD_SECRET", "")
_BA_USER         = os.getenv("BASIC_AUTH_USER", "")
_BA_PASS         = os.getenv("BASIC_AUTH_PASS", "")
_BASIC_AUTH      = (_BA_USER, _BA_PASS) if _BA_USER else None
BATCH_MAX_BYTES  = int(os.getenv("BATCH_MAX_BYTES", str(15_000_000)))

# Tham chiếu đến thư mục truyện — server dùng
_STORIES_DIR_PATH: Path | None = None


# ══════════════════════════════════════════════════════════════════════════════
#  CONTENT CHECK  (logic từ check-trung-chuong-local-v3.py)
# ══════════════════════════════════════════════════════════════════════════════

def _remove_accents(s: str) -> str:
    if not s: return ""
    s = unicodedata.normalize('NFD', s)
    s = "".join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.replace('đ', 'd').replace('Đ', 'D').lower()


def _clean_fingerprint(text: str) -> set:
    if not text: return set()
    text = _remove_accents(text)
    text = re.sub(
        r'(truyen duoc convert boi|chuc ban doc truyen vui ve|nguon:|website:|'
        r'truyenfull|metruyenchu|wikidich|tangthuvien|ban dang doc truyen tai|'
        r'u p l o a d|t r u y e n|arrow_forward_ios|doc them|read more)',
        '', text, flags=re.IGNORECASE)
    text = re.sub(r'^(chương|trang|phần|quyển|hoi|hồi|chuong|phan|quyen)\s*\d+.*?\n',
                  '', text, flags=re.IGNORECASE)
    words = re.findall(r'[a-z]{2,}', text.lower())
    STOP = {
        'va','la','co','cua','da','thi','ma','trong','voi','cho','den','nhu',
        'nhung','lai','ra','the','nao','nay','mot','hai','ba','bon','nam','sau',
        'bay','tam','chin','muoi','cai','con','chiec','kia','do','dau','day',
        'ay','nhe','nhi','chu','vay','roi','cung','tu','luc','khi','can','cu',
        'chi','ca','cach','duoc','duoi','no','han','le','vi','de','so','nua',
        'moi','dang','se','khong','chang','chua','tung','nhieu','it','vai',
        'cac','het','tat','nguoi','ta','chung','ho','ben','tren','ngoai','giua',
        'canh','phia','truoc','biet','muon','thay','noi','lam','di','xong',
        'phai','theo','nen','lien','nhanh','cham','rat','qua','hon','nhat',
        'oi','ao','em','anh','bac','ong','chau',
    }
    clean = [w for w in words if w not in STOP]
    return set(clean[:500]) if clean else set()


def _chapter_num(filename: str):
    # Ưu tiên pattern chuẩn: {title}_{NNNN}.txt
    m = re.match(r'^.+?_(\d+)\.txt$', filename, re.IGNORECASE)
    if m: return int(m.group(1))
    # Fallback: 1.txt, 2.txt
    m2 = re.match(r'^(\d+)$', Path(filename).stem)
    if m2: return int(m2.group(1))
    return None


def check_story_content(story_dir: Path) -> dict:
    """Kiểm tra chương trùng / lỗi / sai số / thiếu — chỉ báo cáo, không sửa file."""
    all_files = [f for f in os.listdir(story_dir) if _chapter_num(f) is not None]
    sorted_files = sorted(all_files, key=lambda fn: (_chapter_num(fn) or 999999))

    pool         = []   # [(filename, fingerprint)]
    duplicates   = []
    errors       = []
    misnamed     = []
    ok_indices   = []   # index hợp lệ (để tính missing)
    all_indices  = []   # tất cả index tồn tại (kể cả file lỗi) — dùng tính gap
    ok_count     = 0
    last_num     = 0

    for filename in sorted_files:
        fp_path = story_dir / filename
        if not fp_path.is_file(): continue
        num = _chapter_num(filename)
        if num is None: continue

        all_indices.append(num)   # file tồn tại → luôn ghi nhận index

        try:
            content = fp_path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue

        file_size = fp_path.stat().st_size
        if file_size < 3 * 1024:  # dưới 3KB — tồn tại nhưng nghi lỗi
            preview = content[:500].replace('\r', '').strip()
            errors.append({'file': filename, 'size_kb': round(file_size / 1024, 2), 'preview': preview})
            continue

        fp = _clean_fingerprint(content[:5000])

        is_dup = False
        for old_fn, old_fp in pool:
            if not fp or not old_fp: continue
            inter = fp & old_fp
            ratio = len(inter) / min(len(fp), len(old_fp))
            if ratio > 0.98 and len(inter) > 50:
                duplicates.append({'file': filename, 'matches': old_fn, 'word_count': len(inter)})
                is_dup = True
                break

        if not is_dup:
            if num <= last_num:
                misnamed.append({'file': filename, 'num': num, 'expected': last_num + 1})
                last_num += 1
            else:
                last_num = num
            pool.append((filename, fp))
            ok_indices.append(num)
            ok_count += 1

    # Tìm chương bị thiếu — dùng all_indices (kể cả file lỗi) để không báo sai
    missing = []
    if all_indices:
        ok_set   = set(all_indices)
        min_idx  = min(all_indices)
        max_idx  = max(all_indices)
        gaps     = sorted(i for i in range(min_idx, max_idx + 1) if i not in ok_set)
        # Gom các số liên tiếp thành range để hiển thị gọn
        if gaps:
            start = gaps[0]
            prev  = gaps[0]
            for g in gaps[1:]:
                if g == prev + 1:
                    prev = g
                else:
                    missing.append({'from': start, 'to': prev,
                                    'count': prev - start + 1})
                    start = prev = g
            missing.append({'from': start, 'to': prev,
                            'count': prev - start + 1})

    return {
        'total':      len(sorted_files),
        'ok':         ok_count,
        'duplicates': duplicates,
        'errors':     errors,
        'misnamed':   misnamed,
        'missing':    missing,
        'missing_count': sum(r['count'] for r in missing),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  TEXT PROCESSING  (logic từ xulyvanban-codai-v5.py / xulyvanban-hiendai-v4.py)
# ══════════════════════════════════════════════════════════════════════════════

_SC_CODAI   = r'[\*\-=\[\]\(\)\{\}<>#@%~/&~\\\$\\\\∞☆]'
_SC_HIENDAI = r'[\*\-=\[\]\(\)\{\}<>#@%~/&~\\\\∞☆]'
_TARGET_LINE = "Tuyệt vời, đây là bản chỉnh sửa của đoạn văn bản bạn cung cấp"
_REINE_LINE  = "Truyện được đăng bởi Reine"

_VN_CHARS = set(
    "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡ"
    "ùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨ"
    "ÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ"
)
_EN_STOPS = {
    "the","be","to","of","and","a","in","that","have","i","it","for","not","on",
    "with","he","as","you","do","at","this","but","his","by","from","they","we",
    "say","her","she","or","an","will","my","one","all","would","there","their",
    "what","so","up","out","if","about","who","get","which","go","me","when",
    "make","can","like","time","no","just","him","know","take","people","into",
    "year","your","good","some","could","them","see","other","than","then","now",
    "look","only","come","its","over","think","also","back","after","use","two",
    "how","our","work","first","well","way","even","new","want","because","any",
    "these","give","day","most","us","chapter","edit","translation","version",
    "story","sure","here","is","help","please","next","more","should","feel","free","ask",
}
_BOT_TRIGGERS = [
    "here is the edited version","here's the revised version",
    "let me know if you would like","let me know if you want me to continue",
]
_BOT_SENTENCES = [
    "Mình đã điều chỉnh để văn phong trang trọng và gãy gọn hơn. Bạn có muốn tiếp tục với chương tiếp theo không?",
    "Gợi ý bước tiếp theo: Bạn có muốn mình tiếp tục chỉnh sửa các chương tiếp theo không?",
    "Tôi có thể giúp gì thêm cho bạn với bộ truyện này không?",
    "Hy vọng bản chỉnh sửa này làm bạn hài lòng.",
    "Chúc bạn đọc truyện vui vẻ!",
    "Nếu cần chỉnh sửa gì thêm, hãy báo mình nhé.",
    "Tôi có thể giúp bạn tinh chỉnh đoạn văn này để ngôn ngữ tự nhiên",
    "Tuy nhiên, nếu bạn muốn điều chỉnh sâu hơn về các quy tắc hành văn",
    "I'll do my best to forget everything.",
    "Tôi rất sẵn lòng hỗ trợ bạn biên tập chương tiếp theo này.",
]


def _merge_dotted_words(text: str) -> str:
    while True:
        t = re.sub(r'(\w)\s+·\s+(\w)', r'\1 \2', text)
        if t == text: break
        text = t
    while True:
        t = re.sub(r'(\w)\s*·\s*(\w)', r'\1\2', text)
        if t == text: break
        text = t
    return text


def _is_english_line(text: str, style: str) -> bool:
    if style == 'hiendai' and re.search(r'["""]', text):
        return False
    if not set(text).isdisjoint(_VN_CHARS):
        return False
    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    if not words: return False
    en = sum(1 for w in words if w in _EN_STOPS)
    if len(words) > 3 and en / len(words) > 0.4:
        return True
    tl = text.lower()
    return any(t in tl for t in _BOT_TRIGGERS)


def _clean_line(line: str, style: str) -> str:
    sc = _SC_CODAI if style == 'codai' else _SC_HIENDAI
    # Xóa dòng "Index:1", "Index: 123", "index:1" ... ở đầu chương
    if re.match(r'^\s*index\s*:\s*\d+\s*$', line, re.IGNORECASE):
        return ''
    if re.search(r'\.{2,}', line) and not re.search(r'[\w\d]', line):
        return ''
    line = _merge_dotted_words(line)
    line = re.sub(r'(\w)\.(\w)', r'\1\2', line)
    if style == 'hiendai':
        line = re.sub(r'\$(?=\w)', '', line)
        line = re.sub(r'(?<=\w)\$', '', line)
    line = re.sub(r'[—–―]', '-', line)
    line = re.sub(r'\s*[-–—]+\s*', ' ', line)
    line = re.sub(sc, ' ', line)
    line = re.sub(re.escape(_TARGET_LINE), ' ', line)
    line = re.sub(re.escape(_REINE_LINE),  ' ', line)
    line = re.sub(r'(?i)[\(\s]*\bChương\s+này\s+hết\b[\)\s]*', ' ', line)
    line = re.sub(r'(?i)[\(\s]*\bTấu\s+chương\s+xong\b[\)\s]*', ' ', line)
    line = re.sub(r'(?i)[\(\s]*\bTáu\s+chương\s+xong\b[\)\s]*', ' ', line)
    line = re.sub(r'(?i)[\(\s]*\bHết\s+chương\b[\)\s]*', ' ', line)
    line = re.sub(r'(?i)Would you like.*', ' ', line)
    for s in _BOT_SENTENCES:
        if s in line: line = line.replace(s, ' ')
    line = re.sub(r'(?i)^\s*Chào bạn[\.,!]?\s*(?:mình|em|tôi|dưới đây|đây là|bạn xem|đã|hãy).*?(?=\bChương\s+\d|$)', ' ', line)
    line = re.sub(r'(?i)^\s*Bạn xem qua (?:nội dung|bản|chương).*?(?=\bChương\s+\d|$)', ' ', line)
    line = re.sub(r'(?i)^\s*Dưới đây là.*?(?=\bChương\s+\d|$)', ' ', line)
    line = re.sub(r'(?i)^\s*Đây là bản (?:chỉnh sửa|edit|lại|nháp|viết lại).*?(?=\bChương\s+\d|$)', ' ', line)
    line = re.sub(r'(?i)^[\ufeff\s]*Nội dung\s+(?:của|này|chương|tiếp theo).*?(?=\bChương\s+\d|$)', ' ', line)
    line = re.sub(r'(?i)^\s*Gửi bạn.*?chương.*?(?=\bChương\s+\d|$)', ' ', line)
    line = re.sub(r'\b0+(\d+)', r'\1', line)
    line = re.sub(r'\s+', ' ', line).strip()
    if _is_english_line(line, style):
        return ' '
    return line


def _file_prefix(filename: str) -> str:
    fn = filename.lower()
    if 'trang' in fn: return 'Trang'
    if 'phan' in fn or 'phần' in fn: return 'Phần'
    if 'quyen' in fn or 'quyển' in fn: return 'Quyển'
    return 'Chương'


def _process_file(file_path: Path, filename: str, style: str):
    prefix = _file_prefix(filename)
    raw_lines = file_path.read_text(encoding='utf-8-sig', errors='ignore').splitlines()
    if not raw_lines: return

    first = raw_lines[0]
    if style == 'codai':
        first = re.sub(r'(?i)<thought>.*?</thought>|thought(ful|s)?', '', first).strip()
    else:
        first = re.sub(r'(?i)(thoughtful|thoughts)', '', first).strip()

    nums = re.findall(r'\d+', first)
    if len(nums) >= 2 and int(nums[0].lstrip('0') or '0') == int(nums[1].lstrip('0') or '0'):
        if re.match(r'^\s*\d+', first):
            first = re.sub(r'^\s*\d+\.\s*\d+\s*', f'{prefix} {nums[0]} ', first)
        elif re.match(rf'^\s*{prefix}', first, re.IGNORECASE):
            first = re.sub(r'(\s*\d+\s*:\s*)\d+\s*', r'\1', first)

    # Xóa dòng tiêu đề chương đầu file: "Chương 1: Tên...", "Chương 1 Tên...", "CHƯƠNG 1. Tên..."
    # Chỉ xóa nếu nó là dòng đầu tiên có nội dung (bỏ qua các dòng trắng đầu)
    _CHAPTER_TITLE_RE = re.compile(
        r'^\s*(chương|trang|phần|quyển)\s+\d+\s*[:\.\-–—]?\s*\S',
        re.IGNORECASE
    )
    _first_content_idx = next((i for i, l in enumerate(raw_lines) if l.strip()), None)
    if _first_content_idx is not None and _CHAPTER_TITLE_RE.match(raw_lines[_first_content_idx]):
        raw_lines[_first_content_idx] = ''
        if _first_content_idx == 0:
            first = ''  # cập nhật luôn biến first vì vòng lặp dùng first cho i==0

    out = []
    for i, line in enumerate(raw_lines):
        src = first if i == 0 else line
        processed = _clean_line(src, style)
        if re.search(r'(?i)p[/\s]?s[:\.]', processed):
            processed = re.sub(r'(?i)p[/\s]?s[:\.].*', '', processed).strip()
        if "Tôi đã lưu các quy tắc bạn yêu cầu" in processed:
            part = processed.split("Tôi đã lưu các quy tắc bạn yêu cầu")[0].strip()
            if part: out.append(part)
            break
        if processed.strip() or not line.strip():
            out.append(processed)

    file_path.write_text('\n'.join(out), encoding='utf-8')


def process_story_text(story_dir: Path, style: str) -> dict:
    """Xử lý văn bản trực tiếp tất cả file .txt trong thư mục."""
    processed, failed = 0, []
    for filename in sorted(os.listdir(story_dir)):
        if _chapter_num(filename) is None:   # chỉ xử lý file chương _XXXX.txt
            continue
        try:
            _process_file(story_dir / filename, filename, style)
            processed += 1
        except Exception as e:
            failed.append({'file': filename, 'error': str(e)})
    return {'processed': processed, 'failed': failed, 'style': style}


# ══════════════════════════════════════════════════════════════════════════════
#  UPLOAD  (gọi Web API trực tiếp, không cần Neon DB)
# ══════════════════════════════════════════════════════════════════════════════

_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]

def _normalize_slug(s: str) -> str:
    """đ/Đ không phân giải được bằng NFD — cần replace thủ công trước."""
    s = s.replace('đ', 'd').replace('Đ', 'D')
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-z0-9]+', '-', s.lower())
    return s.strip('-')


def _find_cover(story_dir: Path):
    for ext in _IMAGE_EXTS:
        for f in list(story_dir.glob(f"*{ext}")) + list(story_dir.glob(f"*{ext.upper()}")):
            return f
    return None


def _compress_cover(img_path: Path) -> bytes:
    from PIL import Image
    import io
    img = Image.open(img_path)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    if img.width > 800:
        img = img.resize((800, int(img.height * 800 / img.width)), Image.LANCZOS)
    quality, buf = 85, io.BytesIO()
    while quality >= 50:
        buf.seek(0); buf.truncate()
        img.save(buf, format="WEBP", quality=quality, method=6)
        if buf.tell() <= 300_000: break
        quality -= 5
    return buf.getvalue()


def _upload_cover_api(story_dir: Path, slug: str) -> str:
    import requests as _req
    img = _find_cover(story_dir)
    if not img: return ""
    try:
        data = _compress_cover(img)
    except Exception:
        return ""
    base = WEB_API_URL.rstrip("/")
    api  = base.rsplit("/stories", 1)[0] + "/upload-image" if base.endswith("/stories") \
           else base.rsplit("/", 1)[0] + "/upload-image"
    try:
        r = _req.post(api,
            headers={"X-Upload-Secret": UPLOAD_SECRET},
            files={"image": (f"{slug}.webp", data, "image/webp")},
            data={"slug": slug}, auth=_BASIC_AUTH, timeout=60)
        if r.status_code == 200 and r.json().get("success"):
            return r.json()["url"]
    except Exception:
        pass
    return ""


def _read_chapters_local(story_dir: Path) -> list[dict]:
    # Pattern: {title}_{NNNN}.txt  — index là 4 chữ số cuối trước .txt
    PDCRAW = re.compile(r'^(.+?)_(\d+)\.txt$', re.IGNORECASE)
    SIMPLE = re.compile(r'^(\d+)$')
    chapters = []
    for f in story_dir.glob("*.txt"):
        m = PDCRAW.match(f.name)
        if m:
            idx        = int(m.group(2))
            # Title = phần trước _NNNN, thay _ thành space
            title_raw  = m.group(1).replace("_", " ").strip()
            title      = title_raw if title_raw else f"Chương {idx}"
        else:
            m2 = SIMPLE.match(f.stem)
            if not m2: continue
            idx   = int(m2.group(1))
            title = f"Chương {idx}"

        try:
            content = f.read_text(encoding='utf-8', errors='ignore').strip()
        except Exception:
            continue
        if not content: continue
        chapters.append({"index": idx, "title": title, "content": content})
    chapters.sort(key=lambda c: c["index"])
    return chapters


def _split_batches(chapters: list, story_part: dict) -> list[list]:
    overhead  = len(json.dumps({"story": story_part, "chapters": []}, ensure_ascii=False).encode())
    effective = BATCH_MAX_BYTES - overhead
    batches, cur, cur_sz = [], [], 0
    for ch in chapters:
        sz = len(json.dumps(ch, ensure_ascii=False).encode())
        if cur and cur_sz + sz > effective:
            batches.append(cur); cur = [ch]; cur_sz = sz
        else:
            cur.append(ch); cur_sz += sz
    if cur: batches.append(cur)
    return batches


def upload_story_card(slug: str, title: str, description: str,
                      genres: list, category: str) -> dict:
    """Upload 1 truyện từ review card — không cần Neon DB."""
    import requests as _req
    import time as _t

    if not WEB_API_URL:
        return {"success": False, "message": "Chưa cấu hình WEB_API_URL trong .env.upload"}

    story_dir = _STORIES_DIR_PATH / slug
    if not story_dir.exists():
        return {"success": False, "message": f"Không tìm thấy thư mục: {slug}"}

    # 1. Upload cover
    cover_url = _upload_cover_api(story_dir, slug)

    # 2. Đọc chapters
    chapters = _read_chapters_local(story_dir)
    if not chapters:
        return {"success": False, "message": "Không có chapter nào trong thư mục"}

    # 3. Genres
    if not genres and category:
        genres = [g.strip() for g in category.split(",") if g.strip()]

    # Slug ưu tiên từ title đã chọn, fallback về folder name
    resolved_slug = _normalize_slug(title) if title else _normalize_slug(slug)
    story_part = {
        "slug": resolved_slug, "title": title or slug, "author": "Unknown",
        "description": description or "", "cover_url": cover_url,
        "book_status": "Ongoing", "genres": genres,
        "boiCanh": [], "luuPhai": [], "tinhCach": [], "thiGiac": [],
        "viewCount": 0, "likeCount": 0, "ratingScore": 0.0,
    }

    # 4. Upload batch
    batch_queue   = _split_batches(chapters, story_part)
    total_inserted = 0
    b_idx          = 0

    while batch_queue:
        batch = batch_queue.pop(0)
        b_idx += 1
        payload = {"story": story_part, "chapters": batch}

        result = None
        for attempt in range(1, 4):
            try:
                r = _req.post(WEB_API_URL, json=payload,
                    headers={"X-Upload-Secret": UPLOAD_SECRET,
                             "Content-Type": "application/json"},
                    auth=_BASIC_AUTH, timeout=120)
                if r.status_code == 413:
                    mid = len(batch) // 2
                    if mid == 0: break
                    batch_queue.insert(0, batch[mid:])
                    batch_queue.insert(0, batch[:mid])
                    b_idx -= 1; result = None; break
                r.raise_for_status()
                result = r.json()
                break
            except Exception as e:
                if attempt == 3:
                    return {"success": False,
                            "inserted": total_inserted, "total": len(chapters),
                            "message": f"Batch {b_idx} lỗi: {e}"}
                _t.sleep(2 ** attempt)

        if result and result.get("success"):
            total_inserted += result.get("newChapters", 0)

    return {
        "success":  True,
        "inserted": total_inserted,
        "total":    len(chapters),
        "cover":    cover_url,
        "message":  f"Đã upload {total_inserted} chương mới / {len(chapters)} tổng",
    }


# ══════════════════════════════════════════════════════════════════════════════
#  LOCAL HTTP SERVER
# ══════════════════════════════════════════════════════════════════════════════

class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass  # tắt log

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == '/ping':
            return self._json({'ok': True})

        if parsed.path == '/get-state':
            return self._json({
                'selections':    load_prev_selections(),
                'upload_status': load_upload_status(),
            })

        slug = params.get('slug', [''])[0]
        if not slug:
            return self._json({'error': 'missing slug'}, 400)

        story_dir = _STORIES_DIR_PATH / slug
        if not story_dir.exists():
            return self._json({'error': f'Không tìm thấy thư mục: {slug}'}, 404)

        if parsed.path == '/open-folder':
            try:
                import subprocess, platform
                p = platform.system()
                if p == 'Windows':
                    subprocess.Popen(['explorer', str(story_dir)])
                elif p == 'Darwin':
                    subprocess.Popen(['open', str(story_dir)])
                else:
                    subprocess.Popen(['xdg-open', str(story_dir)])
                self._json({'ok': True})
            except Exception as e:
                self._json({'error': str(e)}, 500)

        elif parsed.path == '/check':
            try:
                self._json(check_story_content(story_dir))
            except Exception as e:
                self._json({'error': str(e)}, 500)

        elif parsed.path == '/process':
            style = params.get('type', ['codai'])[0]
            try:
                self._json(process_story_text(story_dir, style))
            except Exception as e:
                self._json({'error': str(e)}, 500)

        elif parsed.path == '/crawl-log':
            with _crawl_lock:
                proc  = _crawl_procs.get(slug)
                lines = list(_crawl_logs.get(slug, []))
                running = proc is not None and proc.poll() is None
            self._json({'lines': lines, 'running': running})

        else:
            self._json({'error': 'not found'}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == '/crawl-missing':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body   = json.loads(self.rfile.read(length).decode('utf-8'))
            except Exception as e:
                return self._json({'error': f'Bad request: {e}'}, 400)

            slug    = body.get('slug', '').strip()
            url     = body.get('url', '').strip()
            missing = body.get('missing', [])  # list of int (gợi ý từ check)

            if not slug or not url:
                return self._json({'error': 'Thiếu slug / url'}, 400)

            script = Path(__file__).parent / 'crawl_missing.py'
            # Truyền missing-hint để hiện gợi ý trong CMD, user tự nhập xác nhận
            hint_str = ','.join(str(i) for i in missing) if missing else ''
            cmd_args = [
                sys.executable, str(script),
                '--slug',          slug,
                '--url',           url,
                '--stories-dir',   str(_STORIES_DIR_PATH),
            ]
            if hint_str:
                cmd_args += ['--missing-hint', hint_str]

            import platform, tempfile
            try:
                if platform.system() == 'Windows':
                    # Ghi ra .bat tạm để tránh vấn đề quoting trong cmd /k
                    inner_cmd = subprocess.list2cmdline(cmd_args)
                    bat_path  = Path(tempfile.gettempdir()) / f'crawl_{slug}.bat'
                    bat_path.write_text(
                        f'@echo off\nchcp 65001 >nul\n{inner_cmd}\npause\n',
                        encoding='utf-8'
                    )
                    subprocess.Popen(
                        ['cmd', '/k', str(bat_path)],
                        creationflags=subprocess.CREATE_NEW_CONSOLE,
                    )
                else:
                    # Linux/macOS — thử x-terminal-emulator hoặc xterm
                    term = 'x-terminal-emulator'
                    subprocess.Popen([term, '-e', subprocess.list2cmdline(cmd_args)])
                return self._json({'ok': True, 'message': f'Đã mở cửa sổ CMD — nhập index trong cửa sổ đó.'})
            except Exception as e:
                return self._json({'error': f'Không mở được CMD: {e}'}, 500)

        if parsed.path == '/delete-file':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body   = json.loads(self.rfile.read(length).decode('utf-8'))
            except Exception as e:
                return self._json({'error': f'Bad request: {e}'}, 400)
            slug     = body.get('slug', '').strip()
            filename = body.get('filename', '').strip()
            if not slug or not filename:
                return self._json({'error': 'Thiếu slug / filename'}, 400)
            # Bảo vệ: chỉ cho phép xóa file .txt nằm trong stories_dir/slug/
            file_path = _STORIES_DIR_PATH / slug / filename
            if not file_path.exists():
                return self._json({'error': 'File không tồn tại'}, 404)
            if file_path.suffix.lower() != '.txt':
                return self._json({'error': 'Chỉ cho phép xóa file .txt'}, 400)
            try:
                file_path.unlink()
                return self._json({'ok': True, 'deleted': filename})
            except Exception as e:
                return self._json({'error': str(e)}, 500)

        if parsed.path == '/save-selections':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body   = json.loads(self.rfile.read(length).decode('utf-8'))
                SELECTIONS_JSON.write_text(
                    json.dumps(body, ensure_ascii=False, indent=2), encoding='utf-8')
                self._json({'ok': True})
            except Exception as e:
                self._json({'error': str(e)}, 500)
            return

        if parsed.path != '/upload':
            return self._json({'error': 'not found'}, 404)
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length).decode('utf-8'))
        except Exception as e:
            return self._json({'error': f'Bad request: {e}'}, 400)

        slug = body.get('slug', '').strip()
        if not slug:
            return self._json({'error': 'missing slug'}, 400)

        try:
            result = upload_story_card(
                slug        = slug,
                title       = body.get('title', ''),
                description = body.get('description', ''),
                genres      = body.get('genres', []),
                category    = body.get('category', ''),
            )
            if result.get('success'):
                save_upload_status(slug, {
                    'uploaded_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
                    'chapters':    result.get('total', 0),
                    'inserted':    result.get('inserted', 0),
                    'cover':       result.get('cover', ''),
                    'title':       body.get('title', ''),
                })
            self._json(result)
        except Exception as e:
            self._json({'success': False, 'message': str(e)}, 500)

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def start_local_server(stories_dir: Path, port: int = SERVER_PORT) -> bool:
    global _STORIES_DIR_PATH
    _STORIES_DIR_PATH = stories_dir
    try:
        srv = ThreadingHTTPServer(('localhost', port), _Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        print(f"   → Local API server: http://localhost:{port}")
        return True
    except OSError:
        print(f"   ⚠  Port {port} đang bận — nút check/xử lý có thể không hoạt động")
        return False


# ══════════════════════════════════════════════════════════════════════════════
#  SCAN STORIES
# ══════════════════════════════════════════════════════════════════════════════

def scan_stories(stories_dir: Path) -> list[dict]:
    stories = []
    if not stories_dir.exists():
        print(f"[!] Không tìm thấy thư mục: {stories_dir}")
        return stories

    dirs = sorted([d for d in stories_dir.iterdir() if d.is_dir()])
    print(f"Tìm thấy {len(dirs)} thư mục. Đang đọc dữ liệu...")

    for story_dir in dirs:
        slug = story_dir.name
        meta_path   = story_dir / "meta.json"
        upload_path = story_dir / "upload.json"
        if not meta_path.exists() and not upload_path.exists():
            continue

        meta, upload = {}, {}
        if meta_path.exists():
            try: meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception as e: print(f"  [!] {slug}/meta.json lỗi: {e}")
        if upload_path.exists():
            try: upload = json.loads(upload_path.read_text(encoding="utf-8"))
            except Exception as e: print(f"  [!] {slug}/upload.json lỗi: {e}")

        chapter_count = len([
            f for f in story_dir.glob("*.txt")
            if f.stem != "meta" and not f.name.startswith(".")
        ])
        IMAGE_EXTS = {"*.jpg","*.jpeg","*.png","*.webp","*.gif"}
        has_image  = any(next(story_dir.glob(ext), None) is not None for ext in IMAGE_EXTS)
        has_meta   = meta_path.exists()
        has_upload = upload_path.exists()
        is_ready   = has_meta and has_upload and has_image

        stories.append({
            "slug":           slug,
            "story_id":       meta.get("story_id") or upload.get("story_id") or "",
            "original_title": meta.get("original_title") or slug,
            "category":       meta.get("category") or "",
            "description_raw":meta.get("description") or "",
            "source":         meta.get("source") or "PD",
            "url":            meta.get("url") or "",
            "chapter_count":  chapter_count,
            "has_upload_json":has_upload,
            "has_image":      has_image,
            "is_ready":       is_ready,
            "ten_truyen":     upload.get("ten_truyen") or [],
            "van_an":         upload.get("van_an") or [],
        })

    print(f"Đã đọc {len(stories)} truyện có dữ liệu.")
    return stories


# ══════════════════════════════════════════════════════════════════════════════
#  HTML TEMPLATE
# ══════════════════════════════════════════════════════════════════════════════

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WebTruyen Review — Chọn tên & mô tả</title>
<style>
  :root {
    --bg: #0f1117; --surface: #1a1d27; --card: #21253a;
    --border: #2e3352; --accent: #f97316; --accent2: #3b82f6;
    --text: #ffffff; --muted: #c0c8d8; --green: #22c55e; --red: #ef4444;
    --purple: #a78bfa; --amber: #f59e0b;
    --radius: 12px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', sans-serif; font-size: 20px; }

  /* ── Header ── */
  .header {
    position: sticky; top: 0; z-index: 100;
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 12px 24px; display: flex; align-items: center; gap: 16px;
  }
  .header h1 { font-size: 24px; font-weight: 700; color: var(--accent); }
  .progress-wrap { flex: 1; display: flex; align-items: center; gap: 10px; }
  .progress-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width .3s; }
  .progress-text { font-size: 19px; color: var(--muted); white-space: nowrap; }
  .btn-export {
    padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 20px;
    background: var(--accent); color: white; transition: opacity .2s;
  }
  .btn-export:hover { opacity: .85; }

  /* ── Filter bar ── */
  .filter-bar {
    padding: 10px 24px; background: var(--surface); border-bottom: 1px solid var(--border);
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
  }
  .filter-btn {
    padding: 4px 14px; border-radius: 20px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer; font-size: 18px; transition: all .2s;
  }
  .filter-btn.active { background: var(--accent); border-color: var(--accent); color: white; }
  .search-input {
    padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border);
    background: var(--card); color: var(--text); font-size: 18px; width: 200px;
  }
  .search-input:focus { outline: none; border-color: var(--accent); }

  /* ── Story list ── */
  .story-list { padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; }

  /* ── Story card ── */
  .story-card {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden; transition: border-color .2s;
  }
  .story-card.done   { border-color: var(--green); }
  .story-card.skip   { border-color: var(--red); opacity: .6; }
  .story-card.hidden { display: none; }

  .card-header {
    padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start;
    cursor: pointer; user-select: none;
  }
  .card-header:hover { background: rgba(255,255,255,.03); }

  .story-num  { font-size: 17px; color: var(--muted); min-width: 28px; padding-top: 2px; }
  .story-info { flex: 1; }
  .story-original     { font-size: 18px; color: var(--muted); }
  .story-title-preview{ font-size: 21px; font-weight: 600; color: var(--text); margin: 2px 0; }
  .story-meta { font-size: 17px; color: var(--muted); display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 16px; font-weight: 600;
    background: var(--border); color: var(--muted);
  }
  .badge.green  { background: rgba(34,197,94,.15);  color: var(--green); }
  .badge.red    { background: rgba(239,68,68,.15);   color: var(--red); }
  .badge.blue   { background: rgba(59,130,246,.15);  color: var(--accent2); }

  .card-status { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-width: 90px; }
  .status-icon { font-size: 20px; }

  /* ── Card body ── */
  .card-body { padding: 0 16px 16px; display: none; border-top: 1px solid var(--border); }
  .card-body.open { display: block; }

  .section-label {
    font-size: 17px; font-weight: 700; color: var(--accent); text-transform: uppercase;
    letter-spacing: .8px; margin: 14px 0 8px;
  }

  /* ── Option rows ── */
  .option-list { display: flex; flex-direction: column; gap: 6px; }
  .option-item {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);
    cursor: pointer; transition: all .2s; background: var(--surface);
  }
  .option-item:hover   { border-color: var(--accent); background: rgba(249,115,22,.05); }
  .option-item.selected{ border-color: var(--accent); background: rgba(249,115,22,.1); }
  .option-item input[type=radio] { margin-top: 3px; accent-color: var(--accent); flex-shrink: 0; }
  .option-content { flex: 1; }
  .option-tag {
    display: inline-block; font-size: 16px; font-weight: 700; padding: 1px 7px;
    border-radius: 10px; margin-bottom: 4px; background: rgba(59,130,246,.2); color: var(--accent2);
  }
  .option-tag.original { background: rgba(139,92,246,.2); color: var(--purple); }
  .option-main { font-size: 20px; font-weight: 600; color: var(--text); }
  .option-note { font-size: 18px; color: var(--muted); margin-top: 3px; line-height: 1.5; }
  .option-hashtags { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 4px; }
  .hashtag {
    font-size: 16px; padding: 2px 6px; border-radius: 4px;
    background: rgba(248,250,252,.06); color: var(--muted);
  }

  /* ── Action buttons ── */
  .card-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  .btn-ready {
    flex: 1; padding: 8px; border-radius: 8px; border: 1px solid var(--green);
    background: rgba(34,197,94,.1); color: var(--green); cursor: pointer; font-weight: 600;
    font-size: 19px; transition: all .2s;
  }
  .btn-ready:hover  { background: rgba(34,197,94,.2); }
  .btn-ready.active {
    background: var(--green); color: #000; border-color: var(--green); cursor: default;
  }
  .btn-skip {
    padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer; font-size: 19px; transition: all .2s;
  }
  .btn-skip:hover { border-color: var(--red); color: var(--red); }
  .btn-check {
    padding: 8px 14px; border-radius: 8px; border: 1px solid var(--accent2);
    background: rgba(59,130,246,.1); color: var(--accent2); cursor: pointer;
    font-size: 19px; font-weight: 600; transition: all .2s;
  }
  .btn-check:hover    { background: rgba(59,130,246,.2); }
  .btn-check.loading  { opacity: .6; cursor: wait; }
  .btn-process {
    padding: 8px 14px; border-radius: 8px; border: 1px solid var(--purple);
    background: rgba(139,92,246,.1); color: var(--purple); cursor: pointer;
    font-size: 19px; font-weight: 600; transition: all .2s;
  }
  .btn-process:hover { background: rgba(139,92,246,.2); }

  /* ── Tool result panel ── */
  .tool-result {
    display: none; margin-top: 12px; padding: 14px; border-radius: 8px;
    background: rgba(0,0,0,.35); border: 1px solid var(--border); font-size: 18px; line-height: 1.7;
  }
  .tool-result.show { display: block; }
  .tr-ok    { color: var(--green); }
  .tr-warn  { color: var(--amber); }
  .tr-err   { color: var(--red); }
  .tr-item  { padding: 2px 0 2px 14px; color: var(--muted); font-size: 16px;
               border-bottom: 1px solid rgba(255,255,255,.04); }
  .tr-title { font-weight: 700; margin-bottom: 6px; }
  .proc-btn {
    padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 18px; font-weight: 600; transition: all .2s;
  }
  .proc-codai   { border: 1px solid var(--accent);  background: rgba(249,115,22,.1); color: var(--accent); }
  .proc-hiendai { border: 1px solid var(--purple);  background: rgba(139,92,246,.1); color: var(--purple); }
  .proc-cancel  { border: 1px solid var(--border); background: transparent;         color: var(--muted); }
  .proc-codai:hover   { background: rgba(249,115,22,.25); }
  .proc-hiendai:hover { background: rgba(139,92,246,.25); }
  .proc-cancel:hover  { border-color: var(--red); color: var(--red); }
  .btn-upload {
    padding: 8px 14px; border-radius: 8px; border: 1px solid var(--green);
    background: rgba(34,197,94,.1); color: var(--green); cursor: pointer;
    font-size: 19px; font-weight: 600; transition: all .2s;
  }
  .btn-upload:hover    { background: rgba(34,197,94,.2); }
  .btn-upload:disabled { opacity: .5; cursor: wait; }
  .btn-upload.uploaded {
    border-color: var(--accent2); background: rgba(59,130,246,.1);
    color: var(--accent2); font-size: 17px;
  }
  .btn-upload.uploaded:hover { background: rgba(59,130,246,.2); }
  .btn-header-upload {
    padding: 3px 12px; border-radius: 6px; border: none;
    background: #16a34a; color: #fff; cursor: pointer;
    font-size: 13px; font-weight: 700; transition: background .15s;
    white-space: nowrap;
  }
  .btn-header-upload:hover    { background: #15803d; }
  .btn-header-upload:disabled { opacity: .5; cursor: wait; }

  /* ── Genres display ── */
  .genres-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .genre-tag {
    padding: 3px 10px; border-radius: 20px; font-size: 17px;
    background: rgba(249,115,22,.1); color: var(--accent); border: 1px solid rgba(249,115,22,.3);
  }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 999;
    background: var(--green); color: white; padding: 10px 20px;
    border-radius: 8px; font-weight: 600; opacity: 0; transition: opacity .3s;
    pointer-events: none;
  }
  .toast.show { opacity: 1; }
</style>
</head>
<body>

<div class="header">
  <h1>📚 WebTruyen Review</h1>
  <div class="progress-wrap">
    <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
    <span class="progress-text" id="progressText">0 / 0 đã chọn</span>
  </div>
  <button class="btn-export" onclick="exportSelections()">⬇ Export selections.json</button>
</div>

<div class="filter-bar" id="filterBar">
  <button class="filter-btn active" onclick="setFilter('all', this)">Tất cả</button>
  <button class="filter-btn" onclick="setFilter('ready', this)">🟢 Đủ điều kiện</button>
  <button class="filter-btn" onclick="setFilter('pending', this)">⏳ Chưa chọn</button>
  <button class="filter-btn" onclick="setFilter('done', this)">✅ Đã chọn</button>
  <button class="filter-btn" onclick="setFilter('skip', this)">⏭ Bỏ qua</button>
  <button class="filter-btn" onclick="setFilter('uploaded', this)">🚀 Đã upload</button>
  <span style="width:1px;background:var(--border);align-self:stretch;margin:0 4px"></span>
  <span id="sourceFilters"></span>
  <input class="search-input" type="text" placeholder="🔍 Tìm theo tên..." oninput="filterSearch(this.value)" />
  <span style="width:1px;background:var(--border);align-self:stretch;margin:0 4px"></span>
  <input id="batchCheckCount" type="number" min="1" max="999" value="10"
    style="width:60px;padding:4px 8px;border-radius:20px;border:1px solid var(--border);
           background:var(--card);color:var(--text);font-size:15px;text-align:center" />
  <button id="batchCheckBtn" onclick="startBatchCheck()"
    style="padding:4px 14px;border-radius:20px;border:1px solid #2563eb;
           background:rgba(37,99,235,.15);color:#93c5fd;cursor:pointer;font-size:15px;font-weight:600;white-space:nowrap">
    🔁 Kiểm tra trùng
  </button>
  <button id="batchUploadBtn" onclick="startBatchUpload()"
    style="padding:4px 14px;border-radius:20px;border:1px solid #16a34a;
           background:rgba(22,163,74,.15);color:#86efac;cursor:pointer;font-size:15px;font-weight:600;white-space:nowrap">
    🚀 Upload tất cả
  </button>
</div>

<div class="story-list" id="storyList"></div>
<div class="toast" id="toast"></div>

<script>
const STORIES = __STORIES_DATA__;
const PREV_SELECTIONS = __PREV_SELECTIONS__;
const UPLOAD_STATUS = __UPLOAD_STATUS__;
const API = 'http://localhost:__SERVER_PORT__';

const state = {};

function applyState(selections, uploadStatus) {
  STORIES.forEach(s => {
    const prev = selections[s.slug];
    const up   = uploadStatus[s.slug] || null;
    if (prev) {
      let descIdx = null;
      if (prev.description) {
        const fi = s.van_an.findIndex(v => v.noi_dung === prev.description);
        if      (fi >= 0)                              descIdx = fi;
        else if (prev.description === s.description_raw) descIdx = 'raw';
        else                                           descIdx = 'manual';  // nhập tay
      }
      let titleIdx = null;
      if (prev.title) {
        const ti = s.ten_truyen.findIndex(t => t.ten === prev.title);
        if      (ti >= 0)                              titleIdx = ti;
        else if (prev.title === s.original_title)      titleIdx = 'original';
        else                                           titleIdx = 'manual';  // nhập tay
      }
      state[s.slug] = {
        title:       prev.title       || null,
        description: prev.description || null,
        hashtags:    prev.hashtags    || [],
        genres:      prev.genres      || null,   // null = dùng mặc định từ meta
        status:      prev.skipped ? 'skip' : prev.ready ? 'done' : null,
        uploaded:    up,
        descIdx, titleIdx,
      };
    } else {
      state[s.slug] = {
        title: null, description: null, hashtags: [], genres: null,
        status: null, uploaded: up, descIdx: null, titleIdx: null,
      };
    }
  });
}

async function init() {
  // Fetch state mới nhất từ server (tránh dùng data bake cứng trong HTML)
  try {
    const res  = await fetch(`${API}/get-state`);
    const data = await res.json();
    applyState(data.selections || {}, data.upload_status || {});
  } catch(e) {
    // Server chưa kịp start hoặc offline → dùng data bake sẵn
    applyState(PREV_SELECTIONS, UPLOAD_STATUS);
  }
  buildSourceFilters();
  renderAll();
  updateProgress();
}

function renderAll() {
  document.getElementById('storyList').innerHTML = STORIES.map((s, i) => renderCard(s, i)).join('');
}

function renderCard(s, i) {
  const st = state[s.slug];
  const statusClass = st.status === 'done' ? 'done' : st.status === 'skip' ? 'skip' : '';
  const statusIcon  = st.status === 'done' ? '✅' : st.status === 'skip' ? '⏭' : '⏳';
  const statusBadge = st.status === 'done'
    ? '<span class="badge green">Sẵn sàng</span>'
    : st.status === 'skip'
    ? '<span class="badge red">Bỏ qua</span>'
    : '<span class="badge">Chưa chọn</span>';

  const selectedTitle = st.title || s.original_title;
  const genres = s.category ? s.category.split(',').map(g => g.trim()).filter(Boolean) : [];

  const titleOptions = [
    ...s.ten_truyen.map((t, ti) => `
      <label class="option-item ${st.titleIdx === ti ? 'selected' : ''}" onclick="selectTitle('${esc(s.slug)}', ${ti})">
        <input type="radio" name="title_${esc(s.slug)}" value="${ti}" ${st.titleIdx === ti ? 'checked' : ''}>
        <div class="option-content">
          <span class="option-tag">${esc(t.loai)}</span>
          <div class="option-main">${esc(t.ten)}</div>
          <div class="option-note">${esc(t.ghi_chu)}</div>
        </div>
      </label>`),
    `<label class="option-item ${st.titleIdx === 'original' || st.titleIdx === null ? 'selected' : ''}"
       onclick="selectTitle('${esc(s.slug)}', 'original')">
      <input type="radio" name="title_${esc(s.slug)}" value="original"
        ${st.titleIdx === 'original' || st.titleIdx === null ? 'checked' : ''}>
      <div class="option-content">
        <span class="option-tag original">Tên gốc</span>
        <div class="option-main">${esc(s.original_title)}</div>
      </div>
    </label>`,
    `<label class="option-item ${st.titleIdx === 'manual' ? 'selected' : ''}"
       onclick="selectTitle('${esc(s.slug)}', 'manual')">
      <input type="radio" name="title_${esc(s.slug)}" value="manual" ${st.titleIdx === 'manual' ? 'checked' : ''}>
      <div class="option-content">
        <span class="option-tag" style="background:#7c3aed;color:#fff">✏️ Nhập tay</span>
        <input type="text" id="manualTitle_${esc(s.slug)}"
          placeholder="Nhập tên truyện..."
          value="${st.titleIdx === 'manual' ? esc(st.title || '') : ''}"
          onclick="event.stopPropagation(); selectTitle('${esc(s.slug)}', 'manual')"
          oninput="updateManualTitle('${esc(s.slug)}', this.value)"
          style="margin-top:4px;width:100%;background:#1e2533;border:1px solid #4b5563;border-radius:6px;padding:6px 10px;color:#f1f5f9;font-size:15px;outline:none">
      </div>
    </label>`
  ].join('');

  const descOptions = [
    ...s.van_an.map((v, di) => {
      const tags = (v.hashtag || []).map(h => `<span class="hashtag">${esc(h)}</span>`).join('');
      return `
        <label class="option-item ${st.descIdx === di ? 'selected' : ''}"
          onclick="selectDesc('${esc(s.slug)}', ${di})">
          <input type="radio" name="desc_${esc(s.slug)}" value="${di}" ${st.descIdx === di ? 'checked' : ''}>
          <div class="option-content">
            <span class="option-tag">${esc(v.phong_cach)}</span>
            <div class="option-note">${esc(v.noi_dung)}</div>
            <div class="option-hashtags">${tags}</div>
          </div>
        </label>`;
    }),
    s.description_raw ? `
      <label class="option-item ${st.descIdx === 'raw' ? 'selected' : ''}"
        onclick="selectDesc('${esc(s.slug)}', 'raw')">
        <input type="radio" name="desc_${esc(s.slug)}" value="raw" ${st.descIdx === 'raw' ? 'checked' : ''}>
        <div class="option-content">
          <span class="option-tag original">Mô tả gốc</span>
          <div class="option-note">${esc(s.description_raw)}</div>
        </div>
      </label>` : '',
    `<label class="option-item ${st.descIdx === 'manual' ? 'selected' : ''}"
       onclick="selectDesc('${esc(s.slug)}', 'manual')">
      <input type="radio" name="desc_${esc(s.slug)}" value="manual" ${st.descIdx === 'manual' ? 'checked' : ''}>
      <div class="option-content">
        <span class="option-tag" style="background:#7c3aed;color:#fff">✏️ Nhập tay</span>
        <textarea id="manualDesc_${esc(s.slug)}"
          placeholder="Nhập mô tả truyện..."
          rows="4"
          onclick="event.stopPropagation(); selectDesc('${esc(s.slug)}', 'manual')"
          oninput="updateManualDesc('${esc(s.slug)}', this.value)"
          style="margin-top:4px;width:100%;background:#1e2533;border:1px solid #4b5563;border-radius:6px;padding:6px 10px;color:#f1f5f9;font-size:14px;outline:none;resize:vertical;line-height:1.5">${st.descIdx === 'manual' ? esc(st.description || '') : ''}</textarea>
      </div>
    </label>`
  ].join('');

  const genresHtml = genres.map(g => `<span class="genre-tag">${esc(g)}</span>`).join('');

  return `
  <div class="story-card ${statusClass}" id="card_${esc(s.slug)}" data-slug="${esc(s.slug)}" data-title="${esc(s.original_title)}">
    <div class="card-header" onclick="toggleCard('${esc(s.slug)}')">
      <span class="story-num">#${i + 1}</span>
      <div class="story-info">
        <div class="story-original">${esc(s.original_title)}</div>
        <div class="story-title-preview">${esc(selectedTitle)}</div>
        <div class="story-meta">
          <span>📂 ${esc(s.slug)}</span>
          <span>📖 ${s.chapter_count} chương</span>
          ${s.source ? `<span>${esc(s.source)}</span>` : ''}
          ${s.url ? `<a href="${esc(s.url)}" target="_blank" title="${esc(s.url)}" style="color:#60a5fa;text-decoration:none" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">🔗 Link gốc</a>` : ''}
        </div>
      </div>
      <div class="card-status">
        <span class="status-icon">${statusIcon}</span>
        ${statusBadge}
        ${st.uploaded
          ? '<span class="badge" style="background:#1d4ed8;color:#fff;font-weight:700">🚀 Đã upload</span>'
          : st.status === 'done'
            ? `<button class="btn-header-upload" id="headerUploadBtn_${esc(s.slug)}"
                 onclick="event.stopPropagation(); uploadStory('${esc(s.slug)}', this, true)">
                 🚀 Upload
               </button>`
            : ''
        }
        ${s.is_ready        ? '<span class="badge green">🟢 Đủ điều kiện</span>' : ''}
        ${s.has_upload_json ? '<span class="badge blue">Gemini ✓</span>'        : '<span class="badge" title="Thiếu upload.json">❌ No Gemini</span>'}
        ${s.has_image       ? '' : '<span class="badge" title="Thiếu ảnh bìa">🖼️ No image</span>'}
      </div>
    </div>

    <div class="card-body" id="body_${esc(s.slug)}">
      <div class="section-label">Thể loại</div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:6px">
        ${genresHtml || '<span style="color:var(--muted);font-size:13px">Chưa có thể loại từ meta.json</span>'}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="text" id="genreInput_${esc(s.slug)}"
          placeholder="Nhập thể loại, cách nhau bởi dấu phẩy (VD: Đô Thị, Đam Mỹ, Ngược)"
          value="${esc((st.genres !== null ? st.genres : (s.category || '')))}"
          oninput="updateGenres('${esc(s.slug)}', this.value)"
          style="flex:1;background:#1e2533;border:1px solid #4b5563;border-radius:6px;padding:6px 10px;color:#f1f5f9;font-size:14px;outline:none">
        <button onclick="resetGenres('${esc(s.slug)}')"
          style="padding:5px 10px;border-radius:6px;border:1px solid #4b5563;background:transparent;color:#9ca3af;cursor:pointer;font-size:12px;white-space:nowrap">
          ↩ Mặc định
        </button>
      </div>

      <div class="section-label">Chọn tên truyện</div>
      <div class="option-list">${titleOptions}</div>

      <div class="section-label">Chọn mô tả</div>
      <div class="option-list">${descOptions}</div>

      <div class="card-actions">
        <button class="btn-ready ${st.status === 'done' ? 'active' : ''}"
          onclick="markReady('${esc(s.slug)}')">
          ${st.status === 'done' ? '✅ Đã đánh dấu' : '☑ Sẵn sàng upload'}
        </button>
        <button class="btn-skip"    onclick="markSkip('${esc(s.slug)}')">⏭ Bỏ qua</button>
        <button class="btn-check"   onclick="checkDuplicate('${esc(s.slug)}', this)">🔍 Kiểm tra trùng</button>
        <button class="btn-process" onclick="showProcessMenu('${esc(s.slug)}')">✏️ Xử lý văn bản</button>
        ${st.uploaded
          ? `<button class="btn-upload uploaded" id="uploadBtn_${esc(s.slug)}" onclick="uploadStory('${esc(s.slug)}', this)" title="Upload lại">✅ Đã upload (${esc(st.uploaded.uploaded_at)})</button>`
          : `<button class="btn-upload" id="uploadBtn_${esc(s.slug)}" onclick="uploadStory('${esc(s.slug)}', this)">🚀 Upload</button>`
        }
      </div>

      <div class="tool-result" id="toolResult_${esc(s.slug)}"></div>
    </div>
  </div>`;
}

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,' ');
}

function showResult(slug, html) {
  const el = document.getElementById('toolResult_' + slug);
  if (!el) return;
  el.innerHTML = html;
  el.classList.add('show');
}

// ── Mở thư mục ──────────────────────────────────────────────────────────────
async function openFolder(slug) {
  try {
    await fetch(`${API}/open-folder?slug=${encodeURIComponent(slug)}`);
  } catch(e) {}
}

// ── Kiểm tra trùng ──────────────────────────────────────────────────────────
async function checkDuplicate(slug, btn) {
  if (btn) { btn.classList.add('loading'); btn.disabled = true; }
  showResult(slug, '<span style="color:var(--muted)">⏳ Đang kiểm tra...</span>');
  try {
    const res = await fetch(`${API}/check?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) {
      showResult(slug, `<span class="tr-err">❌ Lỗi server: ${res.status}</span>`);
      return;
    }
    const d = await res.json();
    if (d.error) { showResult(slug, `<span class="tr-err">❌ ${d.error}</span>`); return; }

    let html = `<div class="tr-title" style="display:flex;align-items:center;justify-content:space-between">
      <span>📊 Kết quả kiểm tra — ${d.total} file .txt</span>
      <button onclick="openFolder('${slug}')" style="padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--muted);cursor:pointer;font-size:15px">📂 Mở thư mục</button>
    </div>`;
    html += `<div class="tr-ok">✅ OK: ${d.ok} chương</div>`;

    if (d.duplicates.length) {
      const dupFiles = d.duplicates.map(x => x.file);
      html += `<div class="tr-err" style="margin-top:8px;display:flex;align-items:center;justify-content:space-between">
        <span>🔁 Trùng lặp: ${d.duplicates.length} chương</span>
        <button onclick="deleteAllDuplicates('${slug}', ${JSON.stringify(dupFiles).replace(/"/g,'&quot;')})"
          style="padding:2px 10px;border-radius:5px;border:none;background:#dc2626;color:#fff;cursor:pointer;font-size:12px;font-weight:600;margin-left:10px">
          🗑 Xóa ${d.duplicates.length} file trùng
        </button>
      </div>`;
      d.duplicates.slice(0,20).forEach(x =>
        html += `<div class="tr-item">${x.file} → giống ${x.matches} (${x.word_count} từ trùng)</div>`
      );
      if (d.duplicates.length > 20) html += `<div class="tr-item">... và ${d.duplicates.length-20} chương nữa</div>`;
    }
    // ── Nghi lỗi crawl (<3KB) — file TỒN TẠI nhưng nội dung ngắn ──────────────
    if (d.errors.length) {
      html += `<div style="margin-top:10px;border:1px solid #854d0e;border-radius:8px;overflow:hidden">
        <div style="background:#422006;padding:6px 12px;font-weight:700;color:#fbbf24;font-size:14px">
          ⚠️ Nghi lỗi crawl (&lt;3 KB) — ${d.errors.length} file TỒN TẠI nhưng nội dung có thể thiếu
        </div>
        <div style="padding:6px 12px">`;
      d.errors.forEach(x => {
        const safePreview = (x.preview || '(trống)').replace(/`/g,"'").replace(/\\/g,'\\\\').replace(/\n/g,'\\n');
        html += `<div class="tr-item" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span style="cursor:default;flex:1"
            onmouseenter="showPreviewTooltip(event,'${safePreview}')"
            onmouseleave="hidePreviewTooltip()"
          >${x.file} — ${x.size_kb} KB</span>
          <button onclick="deleteSingleFile('${slug}','${x.file}',this)"
            style="padding:1px 8px;border-radius:4px;border:none;background:#7f1d1d;color:#fca5a5;cursor:pointer;font-size:12px;white-space:nowrap;flex-shrink:0">
            🗑 Xóa
          </button>
        </div>`;
      });
      html += `</div></div>`;
    }

    if (d.misnamed.length) {
      html += `<div class="tr-warn" style="margin-top:8px">🔢 Sai số thứ tự: ${d.misnamed.length} chương</div>`;
      d.misnamed.slice(0,10).forEach(x =>
        html += `<div class="tr-item">${x.file} — số ${x.num}, cần ${x.expected}</div>`
      );
    }

    // ── Thiếu chương — index KHÔNG TỒN TẠI trong thư mục ─────────────────────
    if (d.missing && d.missing.length) {
      const missingIndices = [];
      d.missing.forEach(x => { for (let i = x.from; i <= x.to; i++) missingIndices.push(i); });
      const storyMeta = STORIES.find(x => x.slug === slug);
      const storyUrl  = storyMeta ? (storyMeta.url || '') : '';

      html += `<div style="margin-top:10px;border:1px solid #991b1b;border-radius:8px;overflow:hidden">
        <div style="background:#450a0a;padding:6px 12px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:700;color:#f87171;font-size:14px">🕳 Thiếu chương — ${d.missing_count} index KHÔNG TỒN TẠI</span>
          ${storyUrl
            ? `<button onclick="startCrawlMissing('${slug}', '${storyUrl.replace(/'/g,"\\'")}', ${JSON.stringify(missingIndices)})"
                 style="padding:3px 12px;border-radius:6px;border:none;background:#2563eb;color:#fff;cursor:pointer;font-size:13px;font-weight:600">
                 🔄 Crawl chương thiếu
               </button>`
            : '<span style="font-size:12px;color:#9ca3af">(thiếu URL gốc trong meta.json)</span>'
          }
        </div>
        <div style="padding:8px 12px">`;

      // Hiện từng range — click để copy danh sách index vào clipboard
      d.missing.forEach(x => {
        const indices = [];
        for (let i = x.from; i <= x.to; i++) indices.push(i);
        const label   = x.from === x.to ? `#${x.from}` : `#${x.from} → #${x.to}`;
        const count   = x.count > 1 ? ` <span style="color:#9ca3af;font-size:12px">(${x.count} chương)</span>` : '';
        const idxStr  = indices.join(', ');
        html += `<div class="tr-item" style="cursor:pointer" title="Click để copy index"
                   onclick="navigator.clipboard.writeText('${idxStr}').then(()=>showToast('📋 Đã copy: ${idxStr.slice(0,40)}${idxStr.length>40?'...':''}'))">
                   ${label}${count}
                   <span style="color:#6b7280;font-size:11px;margin-left:6px">[${idxStr}]</span>
                 </div>`;
      });

      html += `<div style="margin-top:6px;font-size:12px;color:#6b7280">
        Tất cả: <span style="color:#93c5fd;cursor:pointer"
          onclick="navigator.clipboard.writeText('${missingIndices.join(',')}').then(()=>showToast('📋 Đã copy ${missingIndices.length} index'))"
          title="Click để copy tất cả">
          ${missingIndices.join(', ')}
        </span>
      </div>`;
      html += `</div></div>`;
    }

    if (!d.duplicates.length && !d.errors.length && !d.misnamed.length && !d.missing_count)
      html += `<div class="tr-ok" style="margin-top:4px">🎉 Không phát hiện vấn đề!</div>`;

    showResult(slug, html);
  } catch(e) {
    showResult(slug,
      '<span class="tr-err">❌ Không kết nối được server (localhost:__SERVER_PORT__). ' +
      'Đảm bảo review.py đang chạy.</span>');
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }
}

// ── Xử lý văn bản ───────────────────────────────────────────────────────────
function showProcessMenu(slug) {
  showResult(slug, `
    <div class="tr-title">✏️ Chọn loại văn bản để xử lý (sẽ sửa trực tiếp file gốc):</div>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button class="proc-btn proc-codai"   onclick="processText('${slug}','codai')">📜 Cổ đại</button>
      <button class="proc-btn proc-hiendai" onclick="processText('${slug}','hiendai')">🏙 Hiện đại</button>
      <button class="proc-btn proc-cancel"  onclick="document.getElementById('toolResult_${slug}').classList.remove('show')">✕ Hủy</button>
    </div>`
  );
}

async function processText(slug, type) {
  const label = type === 'codai' ? 'Cổ đại' : 'Hiện đại';
  showResult(slug, `<span style="color:var(--muted)">⏳ Đang xử lý văn bản (${label})…</span>`);
  try {
    const res = await fetch(`${API}/process?slug=${encodeURIComponent(slug)}&type=${type}`);
    if (!res.ok) {
      showResult(slug, `<span class="tr-err">❌ Lỗi server: ${res.status}</span>`);
      return;
    }
    const d = await res.json();
    if (d.error) { showResult(slug, `<span class="tr-err">❌ ${d.error}</span>`); return; }

    let html = `<div class="tr-title">✏️ Xử lý văn bản (${label}) — hoàn tất</div>`;
    html += `<div class="tr-ok">✅ Đã xử lý: ${d.processed} file</div>`;
    if (d.failed && d.failed.length) {
      html += `<div class="tr-err" style="margin-top:8px">❌ Lỗi: ${d.failed.length} file</div>`;
      d.failed.forEach(x => html += `<div class="tr-item">${x.file}: ${x.error}</div>`);
    }
    showResult(slug, html);
  } catch(e) {
    showResult(slug,
      '<span class="tr-err">❌ Không kết nối được server (localhost:__SERVER_PORT__).</span>');
  }
}

// ── Upload lên server ────────────────────────────────────────────────────────
async function uploadStory(slug, btn, fromHeader = false) {
  const s  = STORIES.find(x => x.slug === slug);
  const st = state[slug];

  // Bắt buộc phải đánh dấu Sẵn sàng trước
  if (st.status !== 'done') {
    alert('⚠️ Vui lòng nhấn "Sẵn sàng upload" trước khi upload!');
    return;
  }

  const title = st.title || s.original_title;
  if (!confirm(`Upload "${title}" lên server?\n(${s.chapter_count} chương)`)) return;

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang upload…'; }
  showResult(slug, '<span style="color:var(--muted)">⏳ Đang upload lên server… (có thể mất vài phút)</span>');

  // Ưu tiên genres nhập tay; fallback về meta category
  const genreSource = (st.genres !== null && st.genres !== undefined) ? st.genres : (s.category || '');
  const genres = genreSource.split(',').map(g => g.trim()).filter(Boolean);

  try {
    const res = await fetch(`${API}/upload`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        slug,
        title,
        description: st.description || s.description_raw || '',
        genres,
        category: s.category || '',
      })
    });
    const d = await res.json();
    if (d.success) {
      const now = new Date().toLocaleString('vi-VN', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
      state[slug].uploaded = { uploaded_at: now, chapters: d.total, inserted: d.inserted, cover: d.cover||'' };

      // Cập nhật header button → badge "Đã upload" (không rebuild card, tránh collapse)
      const headerBtn = document.getElementById(`headerUploadBtn_${slug}`);
      if (headerBtn) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.cssText = 'background:#1d4ed8;color:#fff;font-weight:700';
        badge.textContent = '🚀 Đã upload';
        headerBtn.replaceWith(badge);
      }

      let html = `<div class="tr-title">🚀 Upload hoàn tất!</div>`;
      html += `<div class="tr-ok">✅ ${d.message}</div>`;
      if (d.cover) html += `<div style="color:var(--muted);font-size:16px;margin-top:4px">🖼 Cover: ${d.cover}</div>`;

      if (fromHeader) {
        showToast(`🚀 Upload "${title}" thành công!`);
      } else {
        showResult(slug, html);
        // Đổi nút trong card-body
        if (btn) {
          btn.classList.add('uploaded');
          btn.textContent = `✅ Đã upload (${now})`;
          btn.disabled = false;
        }
      }
      updateProgress();
      autoSave();
      return;
    } else {
      showResult(slug, `<span class="tr-err">❌ ${d.message || d.error || 'Lỗi không xác định'}</span>`);
    }
  } catch(e) {
    showResult(slug,
      `<span class="tr-err">❌ Không kết nối được server (localhost:__SERVER_PORT__): ${e.message}</span>`);
  } finally {
    if (btn && !btn.classList.contains('uploaded')) {
      btn.disabled = false; btn.textContent = '🚀 Upload';
    }
  }
}

// ── Existing functions ───────────────────────────────────────────────────────
function toggleCard(slug) {
  document.getElementById('body_' + slug).classList.toggle('open');
}
function selectTitle(slug, idx) {
  const s = STORIES.find(x => x.slug === slug);
  state[slug].titleIdx = idx;
  if (idx === 'original')     state[slug].title = s.original_title;
  else if (idx === 'manual')  state[slug].title = document.getElementById(`manualTitle_${slug}`)?.value || '';
  else                        state[slug].title = s.ten_truyen[idx].ten;
  document.getElementById('card_' + slug).querySelector('.story-title-preview').textContent = state[slug].title;
  document.querySelectorAll(`[name="title_${slug}"]`).forEach(r => r.closest('.option-item').classList.remove('selected'));
  const sel = document.querySelector(`[name="title_${slug}"][value="${idx}"]`);
  if (sel) sel.closest('.option-item').classList.add('selected');
  autoSave();
}
function updateManualTitle(slug, value) {
  state[slug].titleIdx = 'manual';
  state[slug].title    = value;
  document.getElementById('card_' + slug).querySelector('.story-title-preview').textContent = value;
  document.querySelectorAll(`[name="title_${slug}"]`).forEach(r => r.closest('.option-item').classList.remove('selected'));
  const sel = document.querySelector(`[name="title_${slug}"][value="manual"]`);
  if (sel) sel.closest('.option-item').classList.add('selected');
  autoSave();
}
function selectDesc(slug, idx) {
  const s = STORIES.find(x => x.slug === slug);
  state[slug].descIdx = idx;
  if (idx === 'raw')          { state[slug].description = s.description_raw; state[slug].hashtags = []; }
  else if (idx === 'manual')  { state[slug].description = document.getElementById(`manualDesc_${slug}`)?.value || ''; state[slug].hashtags = []; }
  else                        { state[slug].description = s.van_an[idx].noi_dung; state[slug].hashtags = s.van_an[idx].hashtag || []; }
  document.querySelectorAll(`[name="desc_${slug}"]`).forEach(r => r.closest('.option-item').classList.remove('selected'));
  const sel = document.querySelector(`[name="desc_${slug}"][value="${idx}"]`);
  if (sel) sel.closest('.option-item').classList.add('selected');
  autoSave();
}
function updateGenres(slug, value) {
  state[slug].genres = value;   // lưu string thô, parse lúc upload
  autoSave();
}
function resetGenres(slug) {
  const s = STORIES.find(x => x.slug === slug);
  state[slug].genres = null;    // null = về mặc định meta
  const el = document.getElementById(`genreInput_${slug}`);
  if (el) el.value = s.category || '';
  autoSave();
}
function updateManualDesc(slug, value) {
  state[slug].descIdx      = 'manual';
  state[slug].description  = value;
  state[slug].hashtags     = [];
  document.querySelectorAll(`[name="desc_${slug}"]`).forEach(r => r.closest('.option-item').classList.remove('selected'));
  const sel = document.querySelector(`[name="desc_${slug}"][value="manual"]`);
  if (sel) sel.closest('.option-item').classList.add('selected');
  autoSave();
}
function buildSelectionsPayload() {
  const result = STORIES.map(s => {
    const st     = state[s.slug];
    const genres = s.category ? s.category.split(',').map(g => g.trim()).filter(Boolean) : [];
    return {
      slug:        s.slug,
      story_id:    s.story_id,
      title:       st.title || s.original_title,
      description: st.description || s.description_raw || '',
      hashtags:    st.hashtags || [],
      genres:      st.genres !== null && st.genres !== undefined ? st.genres : null,
      category:    s.category,
      genres,
      ready:       st.status === 'done',
      skipped:     st.status === 'skip',
    };
  });
  const done    = result.filter(r => r.ready).length;
  const skipped = result.filter(r => r.skipped).length;
  return { generated: new Date().toISOString(), total: result.length, ready: done, skipped, selections: result };
}

async function autoSave() {
  try {
    await fetch(`${API}/save-selections`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(buildSelectionsPayload()),
    });
  } catch(e) {}
}

function markReady(slug) {
  const s  = STORIES.find(x => x.slug === slug);
  const st = state[slug];
  // Title mặc định (bỏ qua nếu đã chọn manual và có nội dung)
  if (st.titleIdx === null || (st.titleIdx === 'manual' && !st.title)) {
    if (s.ten_truyen.length) { st.titleIdx = 0; st.title = s.ten_truyen[0].ten; }
    else                     { st.titleIdx = 'original'; st.title = s.original_title; }
  }
  // Desc mặc định (bỏ qua nếu đã chọn manual và có nội dung)
  if (st.descIdx === null || (st.descIdx === 'manual' && !st.description)) {
    if (s.van_an.length)         { st.descIdx = 0; st.description = s.van_an[0].noi_dung; st.hashtags = s.van_an[0].hashtag || []; }
    else if (s.description_raw)  { st.descIdx = 'raw'; st.description = s.description_raw; }
  }
  st.status = 'done';
  refreshCard(slug); updateProgress();
  autoSave();
  showToast('✅ Đã đánh dấu: ' + st.title);
}
function markSkip(slug) {
  state[slug].status = 'skip';
  refreshCard(slug); updateProgress();
  autoSave();
}
function refreshCard(slug) {
  const s    = STORIES.find(x => x.slug === slug);
  const i    = STORIES.indexOf(s);
  const card = document.getElementById('card_' + slug);
  const temp = document.createElement('div');
  temp.innerHTML = renderCard(s, i);
  card.parentNode.replaceChild(temp.firstElementChild, card);
}
function updateProgress() {
  const done  = Object.values(state).filter(s => s.status === 'done').length;
  const total = STORIES.length;
  document.getElementById('progressFill').style.width = (total ? Math.round(done/total*100) : 0) + '%';
  document.getElementById('progressText').textContent  = `${done} / ${total} đã chọn`;
}

let currentFilter = 'all', currentSource = 'all';

function buildSourceFilters() {
  const sources = [...new Set(STORIES.map(s => (s.source||'').trim()).filter(Boolean))].sort();
  document.getElementById('sourceFilters').innerHTML = sources.map(src =>
    `<button class="filter-btn src-btn" data-src="${src}" onclick="setSource('${src}', this)">${src}</button>`
  ).join('');
}
function setSource(src, btn) {
  currentSource = (currentSource === src) ? 'all' : src;
  document.querySelectorAll('.src-btn').forEach(b => b.classList.remove('active'));
  if (currentSource !== 'all') btn.classList.add('active');
  applyFilters();
}
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn:not(.src-btn)').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}
function filterSearch(q) { applyFilters(q); }
function applyFilters(searchQ) {
  const q = (searchQ || document.querySelector('.search-input').value || '').toLowerCase();
  document.querySelectorAll('.story-card').forEach(card => {
    const slug  = card.dataset.slug;
    const title = card.dataset.title.toLowerCase();
    const st    = state[slug];
    const story = STORIES.find(x => x.slug === slug);
    let show = true;
    if (currentFilter === 'ready'    && (!story.is_ready || st.uploaded || st.status === 'skip')) show = false;
    if (currentFilter === 'done'     && st.status !== 'done')             show = false;
    if (currentFilter === 'skip'     && st.status !== 'skip')             show = false;
    if (currentFilter === 'pending'  && st.status !== null)               show = false;
    if (currentFilter === 'uploaded' && !st.uploaded)                     show = false;
    if (currentSource !== 'all' && (story.source||'').trim() !== currentSource) show = false;
    if (q && !slug.includes(q) && !title.includes(q))        show = false;
    card.classList.toggle('hidden', !show);
  });
}

function exportSelections() {
  const output = buildSelectionsPayload();
  const blob   = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const a      = Object.assign(document.createElement('a'), { href: url, download: 'selections.json' });
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✅ Đã export ${output.ready} truyện sẵn sàng upload!`);
}

// ── Batch upload — upload tuần tự tất cả truyện đang có nút Upload ───────────
let _batchUploadRunning = false;

async function startBatchUpload() {
  if (_batchUploadRunning) {
    _batchUploadRunning = false;
    const btn = document.getElementById('batchUploadBtn');
    btn.textContent = '🚀 Upload tất cả';
    btn.style.background = 'rgba(22,163,74,.15)';
    btn.style.color = '#86efac';
    return;
  }

  // Lấy danh sách slug có nút headerUploadBtn đang hiển thị (status=done, chưa upload)
  const slugs = [...document.querySelectorAll('[id^="headerUploadBtn_"]')]
    .filter(el => !el.disabled && el.closest('.story-card:not(.hidden)'))
    .map(el => el.id.replace('headerUploadBtn_', ''));

  if (!slugs.length) { showToast('Không có truyện nào sẵn sàng upload'); return; }

  if (!confirm(`Upload ${slugs.length} truyện tuần tự?\nSẽ lần lượt từng truyện một.`)) return;

  _batchUploadRunning = true;
  const btn = document.getElementById('batchUploadBtn');
  btn.style.background = 'rgba(220,38,38,.2)';
  btn.style.color = '#fca5a5';

  let done = 0, failed = 0;
  for (let i = 0; i < slugs.length; i++) {
    if (!_batchUploadRunning) break;
    const slug = slugs[i];
    btn.textContent = `⏹ Dừng (${i+1}/${slugs.length})`;

    // Scroll card vào view
    const card = document.getElementById('card_' + slug);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Lấy nút upload của card đó và gọi uploadStory
    const headerBtn = document.getElementById('headerUploadBtn_' + slug);
    if (!headerBtn || headerBtn.disabled) { failed++; continue; }

    // Dùng Promise để chờ uploadStory xong (uploadStory là async)
    try {
      await uploadStory(slug, headerBtn, true);
      done++;
    } catch(e) {
      failed++;
    }

    // Nghỉ nhỏ giữa 2 lần
    if (i < slugs.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  _batchUploadRunning = false;
  btn.textContent = '🚀 Upload tất cả';
  btn.style.background = 'rgba(22,163,74,.15)';
  btn.style.color = '#86efac';
  showToast(`✅ Đã upload xong: ${done} thành công${failed ? ` · ❌ ${failed} lỗi` : ''}`);
}

// ── Batch kiểm tra trùng — lấy N truyện đang hiển thị, check lần lượt ───────
let _batchCheckRunning = false;

async function startBatchCheck() {
  if (_batchCheckRunning) {
    _batchCheckRunning = false;          // nhấn lần 2 → dừng
    document.getElementById('batchCheckBtn').textContent = '🔁 Kiểm tra trùng';
    document.getElementById('batchCheckBtn').style.background = 'rgba(37,99,235,.15)';
    document.getElementById('batchCheckBtn').style.color = '#93c5fd';
    return;
  }

  // Tự động chuyển sang filter "Đủ điều kiện" trước khi check
  const readyBtn = [...document.querySelectorAll('.filter-btn')].find(b => b.textContent.includes('Đủ điều kiện'));
  if (readyBtn) setFilter('ready', readyBtn);

  const n = parseInt(document.getElementById('batchCheckCount').value) || 10;

  // Lấy danh sách slug theo thứ tự đang hiển thị (dùng class hidden, không phải inline style)
  const visibleSlugs = [...document.querySelectorAll('.story-card:not(.hidden)')]
    .slice(0, n)
    .map(el => el.dataset.slug);

  if (!visibleSlugs.length) { showToast('Không có truyện nào để kiểm tra'); return; }

  _batchCheckRunning = true;
  const btn = document.getElementById('batchCheckBtn');
  btn.style.background = 'rgba(220,38,38,.2)';
  btn.style.color = '#fca5a5';

  for (let i = 0; i < visibleSlugs.length; i++) {
    if (!_batchCheckRunning) break;
    const slug = visibleSlugs[i];
    btn.textContent = `⏹ Dừng (${i+1}/${visibleSlugs.length})`;

    // Mở card nếu chưa mở
    const body = document.getElementById('body_' + slug);
    if (body && !body.classList.contains('open')) body.classList.add('open');

    // Scroll card vào view
    const card = document.getElementById('card_' + slug);
    if (card) card.scrollIntoView({behavior: 'smooth', block: 'center'});

    // Chạy check (await để xong mới sang cái tiếp theo)
    await checkDuplicate(slug, null);

    // Nghỉ nhỏ giữa 2 lần để tránh quá tải server
    if (i < visibleSlugs.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  _batchCheckRunning = false;
  btn.textContent = '🔁 Kiểm tra trùng';
  btn.style.background = 'rgba(37,99,235,.15)';
  btn.style.color = '#93c5fd';
  showToast(`✅ Đã kiểm tra xong ${visibleSlugs.length} truyện`);
}

// ── Xóa file trùng lặp (xóa tất cả file có index cao hơn) ───────────────────
async function deleteAllDuplicates(slug, files) {
  if (!confirm(`Xóa ${files.length} file trùng lặp (index cao hơn)?\nThao tác không thể hoàn tác!`)) return;
  let ok = 0, fail = 0;
  for (const filename of files) {
    try {
      const res = await fetch(`${API}/delete-file`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({slug, filename}),
      });
      const d = await res.json();
      if (d.ok) ok++; else fail++;
    } catch { fail++; }
  }
  showToast(`✅ Đã xóa ${ok} file trùng${fail ? ` · ❌ ${fail} lỗi` : ''}`);
  checkStory(slug);
}

// ── Xóa từng file nghi lỗi crawl ────────────────────────────────────────────
async function deleteSingleFile(slug, filename, btn) {
  if (!confirm(`Xóa "${filename}"?\nThao tác không thể hoàn tác!`)) return;
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/delete-file`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({slug, filename}),
    });
    const d = await res.json();
    if (d.ok) {
      showToast(`✅ Đã xóa ${filename}`);
      checkStory(slug);
    } else {
      showToast(`❌ Lỗi: ${d.error}`);
      btn.disabled = false;
    }
  } catch(e) {
    showToast(`❌ ${e.message}`);
    btn.disabled = false;
  }
}

// ── Tooltip hiển thị nội dung khi hover chương nghi lỗi ─────────────────────
function showPreviewTooltip(event, text) {
  let tip = document.getElementById('_previewTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = '_previewTip';
    tip.style.cssText = [
      'position:fixed','z-index:9999','max-width:420px','max-height:260px',
      'overflow-y:auto','background:#1e293b','color:#e2e8f0',
      'border:1px solid #475569','border-radius:8px','padding:10px 12px',
      'font-size:12px','line-height:1.6','white-space:pre-wrap',
      'box-shadow:0 8px 24px rgba(0,0,0,.5)','pointer-events:none',
    ].join(';');
    document.body.appendChild(tip);
  }
  tip.textContent = text.replace(/\\n/g, '\n');
  const x = Math.min(event.clientX + 14, window.innerWidth - 440);
  const y = Math.min(event.clientY + 14, window.innerHeight - 280);
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
  tip.style.display = 'block';
}

function hidePreviewTooltip() {
  const tip = document.getElementById('_previewTip');
  if (tip) tip.style.display = 'none';
}

async function startCrawlMissing(slug, url, missingIndices) {
  try {
    const res  = await fetch(`${API}/crawl-missing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, url, missing: missingIndices }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast(`🖥️ Đã mở CMD — nhập index trong cửa sổ mới (gợi ý: ${missingIndices.length} chương)`);
    } else {
      showToast('⚠️ ' + (data.message || data.error || 'Lỗi không xác định'));
    }
  } catch(e) {
    showToast('❌ Không kết nối được server review.py');
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

init();
</script>
</body>
</html>"""


# ══════════════════════════════════════════════════════════════════════════════
#  SELECTIONS RESTORE
# ══════════════════════════════════════════════════════════════════════════════

SELECTIONS_JSON    = Path(__file__).parent / "selections.json"
UPLOAD_STATUS_JSON = Path(__file__).parent / "upload_status.json"
_upload_status_lock = threading.Lock()


def load_upload_status() -> dict:
    if not UPLOAD_STATUS_JSON.exists(): return {}
    try:
        return json.loads(UPLOAD_STATUS_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_upload_status(slug: str, data: dict):
    """Ghi ngay vào upload_status.json (thread-safe)."""
    with _upload_status_lock:
        try:
            status = load_upload_status()
            status[slug] = data
            UPLOAD_STATUS_JSON.write_text(
                json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"  [!] Không ghi được upload_status.json: {e}")


def load_prev_selections() -> dict:
    if not SELECTIONS_JSON.exists(): return {}
    try:
        data = json.loads(SELECTIONS_JSON.read_text(encoding="utf-8"))
        result = {}
        for item in data.get("selections", []):
            slug = item.get("slug")
            if slug:
                result[slug] = {
                    "title":       item.get("title"),
                    "description": item.get("description"),
                    "hashtags":    item.get("hashtags", []),
                    "ready":       item.get("ready", False),
                    "skipped":     item.get("skipped", False),
                }
        return result
    except Exception as e:
        print(f"  [!] Không đọc được selections.json: {e}")
        return {}


def generate_html(stories: list[dict], prev_selections: dict,
                  upload_status: dict, port: int) -> str:
    stories_json  = json.dumps(stories,        ensure_ascii=False, indent=2)
    prev_sel_json = json.dumps(prev_selections, ensure_ascii=False, indent=2)
    up_status_json = json.dumps(upload_status,  ensure_ascii=False, indent=2)
    return (HTML_TEMPLATE
            .replace("__STORIES_DATA__",    stories_json)
            .replace("__PREV_SELECTIONS__", prev_sel_json)
            .replace("__UPLOAD_STATUS__",   up_status_json)
            .replace("__SERVER_PORT__",     str(port)))


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Generate review.html từ data_import/")
    parser.add_argument("--dir",  help="Override STORIES_DIR")
    parser.add_argument("--port", type=int, default=SERVER_PORT, help="Port cho local API server")
    args = parser.parse_args()

    stories_dir = Path(args.dir) if args.dir else Path(STORIES_DIR)
    print(f"\n{'═'*55}")
    print(f"  WebTruyen Review Generator")
    print(f"  Thư mục: {stories_dir}")
    print(f"{'═'*55}\n")

    stories = scan_stories(stories_dir)
    if not stories:
        print("[!] Không có truyện nào để review.")
        return

    prev_selections = load_prev_selections()
    if prev_selections:
        print(f"↩  Restore {len(prev_selections)} selections từ selections.json")

    upload_status = load_upload_status()
    if upload_status:
        print(f"📦 Upload status: {len(upload_status)} truyện đã upload trước đó")

    # Khởi động local API server
    start_local_server(stories_dir, args.port)

    html = generate_html(stories, prev_selections, upload_status, args.port)
    OUTPUT_HTML.write_text(html, encoding="utf-8")

    print(f"\n✅ Đã tạo: {OUTPUT_HTML}")
    print(f"   → Mở file đó bằng Chrome/Edge để review")
    print(f"   → Server đang chạy tại localhost:{args.port} — GIỮ CỬA SỔ NÀY MỞ\n")

    try:
        import webbrowser
        webbrowser.open(OUTPUT_HTML.as_uri())
        print("   → Đang mở trình duyệt...")
    except Exception:
        pass

    # Giữ process sống để server hoạt động (dùng sleep loop — tương thích Windows)
    print("\n[Ctrl+C để thoát]\n")
    try:
        import time
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n👋 Đã tắt server.")


if __name__ == "__main__":
    main()
