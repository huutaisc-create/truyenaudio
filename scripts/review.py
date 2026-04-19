#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
review.py
=========
Scan thư mục data_import/, đọc meta.json + upload.json của từng truyện,
rồi tạo file review.html để mở bằng trình duyệt.

Trong trình duyệt, bạn chọn:
  - Tên truyện (1 trong 3 do Gemini đề xuất, hoặc giữ tên gốc)
  - Mô tả (1 trong 3 phong cách, hoặc dùng mô tả gốc)
  - Đánh dấu sẵn sàng upload / bỏ qua

Bấm "Export" → tải về selections.json
upload_to_web.py sẽ đọc file đó để upload đúng tên + mô tả.

Chạy:
  python review.py
  python review.py --dir "D:\\Webtruyen\\pdcraw\\data_import"
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env.upload")

STORIES_DIR = os.getenv("STORIES_DIR", r"D:\Webtruyen\pdcraw\data_import")
OUTPUT_HTML  = Path(__file__).parent / "review.html"


def scan_stories(stories_dir: Path) -> list[dict]:
    """Quét tất cả thư mục truyện, đọc meta.json + upload.json."""
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

        # Bỏ qua nếu không có cả 2 file
        if not meta_path.exists() and not upload_path.exists():
            continue

        meta   = {}
        upload = {}

        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception as e:
                print(f"  [!] {slug}/meta.json lỗi: {e}")

        if upload_path.exists():
            try:
                upload = json.loads(upload_path.read_text(encoding="utf-8"))
            except Exception as e:
                print(f"  [!] {slug}/upload.json lỗi: {e}")

        # Đếm số chapter file
        chapter_count = len([
            f for f in story_dir.glob("*.txt")
            if f.stem != "meta" and not f.name.startswith(".")
        ])

        # Kiểm tra có ảnh bìa không (jpg/jpeg/png/webp/gif)
        IMAGE_EXTS = {"*.jpg", "*.jpeg", "*.png", "*.webp", "*.gif"}
        has_image = any(
            next(story_dir.glob(ext), None) is not None
            for ext in IMAGE_EXTS
        )

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
            # Từ upload.json
            "ten_truyen":     upload.get("ten_truyen") or [],   # [{loai, ten, ghi_chu}]
            "van_an":         upload.get("van_an") or [],        # [{phong_cach, noi_dung, hashtag}]
        })

    print(f"Đã đọc {len(stories)} truyện có dữ liệu.")
    return stories


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
  .btn-export:disabled { opacity: .4; cursor: not-allowed; }

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

  .story-num { font-size: 17px; color: var(--muted); min-width: 28px; padding-top: 2px; }
  .story-info { flex: 1; }
  .story-original { font-size: 18px; color: var(--muted); }
  .story-title-preview { font-size: 21px; font-weight: 600; color: var(--text); margin: 2px 0; }
  .story-meta { font-size: 17px; color: var(--muted); display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap; }
  .story-meta span { display: flex; align-items: center; gap: 3px; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 16px; font-weight: 600;
    background: var(--border); color: var(--muted);
  }
  .badge.green { background: rgba(34,197,94,.15); color: var(--green); }
  .badge.red   { background: rgba(239,68,68,.15);  color: var(--red); }
  .badge.blue  { background: rgba(59,130,246,.15); color: var(--accent2); }

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
  .option-item:hover { border-color: var(--accent); background: rgba(249,115,22,.05); }
  .option-item.selected { border-color: var(--accent); background: rgba(249,115,22,.1); }
  .option-item input[type=radio] { margin-top: 3px; accent-color: var(--accent); flex-shrink: 0; }
  .option-content { flex: 1; }
  .option-tag {
    display: inline-block; font-size: 16px; font-weight: 700; padding: 1px 7px;
    border-radius: 10px; margin-bottom: 4px; background: rgba(59,130,246,.2); color: var(--accent2);
  }
  .option-tag.original { background: rgba(139,92,246,.2); color: #a78bfa; }
  .option-main { font-size: 20px; font-weight: 600; color: var(--text); }
  .option-note { font-size: 18px; color: var(--muted); margin-top: 3px; line-height: 1.5; }
  .option-hashtags { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 4px; }
  .hashtag {
    font-size: 16px; padding: 2px 6px; border-radius: 4px;
    background: rgba(248,250,252,.06); color: var(--muted);
  }

  /* ── Action buttons ── */
  .card-actions { display: flex; gap: 8px; margin-top: 14px; }
  .btn-ready {
    flex: 1; padding: 8px; border-radius: 8px; border: 1px solid var(--green);
    background: rgba(34,197,94,.1); color: var(--green); cursor: pointer; font-weight: 600; transition: all .2s;
  }
  .btn-ready:hover { background: rgba(34,197,94,.2); }
  .btn-skip {
    padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer; transition: all .2s;
  }
  .btn-skip:hover { border-color: var(--red); color: var(--red); }

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
  <button class="btn-export" id="btnExport" onclick="exportSelections()">⬇ Export selections.json</button>
</div>

<div class="filter-bar" id="filterBar">
  <button class="filter-btn active" onclick="setFilter('all', this)">Tất cả</button>
  <button class="filter-btn" onclick="setFilter('ready', this)">🟢 Đủ điều kiện</button>
  <button class="filter-btn" onclick="setFilter('pending', this)">⏳ Chưa chọn</button>
  <button class="filter-btn" onclick="setFilter('done', this)">✅ Đã chọn</button>
  <button class="filter-btn" onclick="setFilter('skip', this)">⏭ Bỏ qua</button>
  <span style="width:1px;background:var(--border);align-self:stretch;margin:0 4px"></span>
  <span id="sourceFilters"></span>
  <input class="search-input" type="text" placeholder="🔍 Tìm theo tên..." oninput="filterSearch(this.value)" />
</div>

<div class="story-list" id="storyList"></div>
<div class="toast" id="toast"></div>

<script>
const STORIES = __STORIES_DATA__;
const PREV_SELECTIONS = __PREV_SELECTIONS__;  // {} hoặc map slug→{title,description,hashtags,ready,skipped}

const state = {};   // slug → { title, description, hashtags, status: 'done'|'skip'|null }

function init() {
  STORIES.forEach(s => {
    const prev = PREV_SELECTIONS[s.slug];
    if (prev) {
      state[s.slug] = {
        title:       prev.title       || null,
        description: prev.description || null,
        hashtags:    prev.hashtags    || [],
        status:      prev.skipped ? 'skip' : prev.ready ? 'done' : null,
      };
    } else {
      state[s.slug] = { title: null, description: null, hashtags: [], status: null };
    }
  });
  buildSourceFilters();
  renderAll();
  updateProgress();
}

function renderAll() {
  const list = document.getElementById('storyList');
  list.innerHTML = STORIES.map((s, i) => renderCard(s, i)).join('');
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

  // Title options
  const titleOptions = [
    ...s.ten_truyen.map((t, idx) => `
      <label class="option-item ${st.title === t.ten ? 'selected' : ''}" onclick="selectTitle('${esc(s.slug)}', '${esc(t.ten)}')">
        <input type="radio" name="title_${esc(s.slug)}" value="${esc(t.ten)}" ${st.title === t.ten ? 'checked' : ''}>
        <div class="option-content">
          <span class="option-tag">${esc(t.loai)}</span>
          <div class="option-main">${esc(t.ten)}</div>
          <div class="option-note">${esc(t.ghi_chu)}</div>
        </div>
      </label>`),
    `<label class="option-item ${(!st.title || st.title === s.original_title) ? 'selected' : ''}"
       onclick="selectTitle('${esc(s.slug)}', '${esc(s.original_title)}')">
      <input type="radio" name="title_${esc(s.slug)}" value="${esc(s.original_title)}"
        ${(!st.title || st.title === s.original_title) ? 'checked' : ''}>
      <div class="option-content">
        <span class="option-tag original">Tên gốc</span>
        <div class="option-main">${esc(s.original_title)}</div>
      </div>
    </label>`
  ].join('');

  // Description options
  const descOptions = [
    ...s.van_an.map((v, idx) => {
      const tags = (v.hashtag || []).map(h => `<span class="hashtag">${esc(h)}</span>`).join('');
      return `
        <label class="option-item ${st.description === v.noi_dung ? 'selected' : ''}"
          onclick="selectDesc('${esc(s.slug)}', ${JSON.stringify(v.noi_dung)}, ${JSON.stringify(v.hashtag || [])})">
          <input type="radio" name="desc_${esc(s.slug)}" value="${idx}" ${st.description === v.noi_dung ? 'checked' : ''}>
          <div class="option-content">
            <span class="option-tag">${esc(v.phong_cach)}</span>
            <div class="option-note">${esc(v.noi_dung)}</div>
            <div class="option-hashtags">${tags}</div>
          </div>
        </label>`;
    }),
    s.description_raw ? `
      <label class="option-item ${st.description === s.description_raw ? 'selected' : ''}"
        onclick="selectDesc('${esc(s.slug)}', ${JSON.stringify(s.description_raw)}, [])">
        <input type="radio" name="desc_${esc(s.slug)}" value="raw" ${st.description === s.description_raw ? 'checked' : ''}>
        <div class="option-content">
          <span class="option-tag original">Mô tả gốc</span>
          <div class="option-note">${esc(s.description_raw)}</div>
        </div>
      </label>` : ''
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
          ${s.source ? `<span>🔗 ${esc(s.source)}</span>` : ''}
        </div>
      </div>
      <div class="card-status">
        <span class="status-icon">${statusIcon}</span>
        ${statusBadge}
        ${s.is_ready       ? '<span class="badge green">🟢 Đủ điều kiện</span>' : ''}
        ${s.has_upload_json ? '<span class="badge blue">Gemini ✓</span>' : '<span class="badge" title="Thiếu upload.json">❌ No Gemini</span>'}
        ${s.has_image       ? '' : '<span class="badge" title="Thiếu ảnh bìa">🖼️ No image</span>'}
      </div>
    </div>

    <div class="card-body" id="body_${esc(s.slug)}">
      ${genresHtml ? `
        <div class="section-label">Thể loại</div>
        <div class="genres-list">${genresHtml}</div>` : ''}

      ${s.ten_truyen.length > 0 ? `
        <div class="section-label">Chọn tên truyện</div>
        <div class="option-list">${titleOptions}</div>` : ''}

      ${(s.van_an.length > 0 || s.description_raw) ? `
        <div class="section-label">Chọn mô tả</div>
        <div class="option-list">${descOptions}</div>` : ''}

      <div class="card-actions">
        <button class="btn-ready" onclick="markReady('${esc(s.slug)}')">✅ Sẵn sàng upload</button>
        <button class="btn-skip"  onclick="markSkip('${esc(s.slug)}')">⏭ Bỏ qua</button>
      </div>
    </div>
  </div>`;
}

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,' ');
}

function toggleCard(slug) {
  const body = document.getElementById('body_' + slug);
  body.classList.toggle('open');
}

function selectTitle(slug, title) {
  state[slug].title = title;
  const card = document.getElementById('card_' + slug);
  card.querySelector('.story-title-preview').textContent = title;
}

function selectDesc(slug, desc, hashtags) {
  state[slug].description = desc;
  state[slug].hashtags = hashtags;
}

function markReady(slug) {
  const s = STORIES.find(x => x.slug === slug);
  // Auto-select defaults nếu chưa chọn
  if (!state[slug].title) state[slug].title = s.ten_truyen.length ? s.ten_truyen[0].ten : s.original_title;
  if (!state[slug].description && s.van_an.length) state[slug].description = s.van_an[0].noi_dung;
  if (!state[slug].description && s.description_raw) state[slug].description = s.description_raw;

  state[slug].status = 'done';
  refreshCard(slug);
  updateProgress();
  showToast('✅ Đã đánh dấu: ' + state[slug].title);
}

function markSkip(slug) {
  state[slug].status = 'skip';
  refreshCard(slug);
  updateProgress();
}

function refreshCard(slug) {
  const s = STORIES.find(x => x.slug === slug);
  const i = STORIES.indexOf(s);
  const card = document.getElementById('card_' + slug);
  const parent = card.parentNode;
  const temp = document.createElement('div');
  temp.innerHTML = renderCard(s, i);
  parent.replaceChild(temp.firstElementChild, card);
}

function updateProgress() {
  const done  = Object.values(state).filter(s => s.status === 'done').length;
  const total = STORIES.length;
  const pct   = total ? Math.round(done / total * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = `${done} / ${total} đã chọn`;
}

let currentFilter = 'all';
let currentSource = 'all';   // 'all' | 'PD' | 'Wiki' | ...

function buildSourceFilters() {
  const sources = [...new Set(STORIES.map(s => (s.source || '').trim()).filter(Boolean))].sort();
  const wrap = document.getElementById('sourceFilters');
  wrap.innerHTML = sources.map(src =>
    `<button class="filter-btn src-btn" data-src="${src}" onclick="setSource('${src}', this)">${src}</button>`
  ).join('');
}

function setSource(src, btn) {
  currentSource = (currentSource === src) ? 'all' : src;   // toggle
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

function filterSearch(q) {
  applyFilters(q);
}

function applyFilters(searchQ) {
  const q = (searchQ || document.querySelector('.search-input').value || '').toLowerCase();
  document.querySelectorAll('.story-card').forEach(card => {
    const slug   = card.dataset.slug;
    const title  = card.dataset.title.toLowerCase();
    const st     = state[slug];
    const story  = STORIES.find(x => x.slug === slug);
    let show = true;
    if (currentFilter === 'ready'   && !story.is_ready)      show = false;
    if (currentFilter === 'done'    && st.status !== 'done') show = false;
    if (currentFilter === 'skip'    && st.status !== 'skip') show = false;
    if (currentFilter === 'pending' && st.status !== null)   show = false;
    if (currentSource !== 'all'     && (story.source || '').trim() !== currentSource) show = false;
    if (q && !slug.includes(q) && !title.includes(q))       show = false;
    card.classList.toggle('hidden', !show);
  });
}

function exportSelections() {
  const result = STORIES.map(s => {
    const st = state[s.slug];
    const genres = s.category ? s.category.split(',').map(g => g.trim()).filter(Boolean) : [];
    return {
      slug:        s.slug,
      story_id:    s.story_id,
      title:       st.title || s.original_title,
      description: st.description || s.description_raw || '',
      hashtags:    st.hashtags || [],
      category:    s.category,
      genres:      genres,
      ready:       st.status === 'done',
      skipped:     st.status === 'skip',
    };
  });

  const skip = result.filter(r => r.skipped).map(r => r.slug);
  const done = result.filter(r => r.ready).length;

  const output = {
    generated: new Date().toISOString(),
    total: result.length,
    ready: done,
    skipped: skip.length,
    selections: result,
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'selections.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✅ Đã export ${done} truyện sẵn sàng upload!`);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

init();
</script>
</body>
</html>"""


SELECTIONS_JSON = Path(__file__).parent / "selections.json"


def load_prev_selections() -> dict:
    """Đọc selections.json (nếu có) → dict keyed by slug để restore state."""
    if not SELECTIONS_JSON.exists():
        return {}
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


def generate_html(stories: list[dict], prev_selections: dict) -> str:
    stories_json    = json.dumps(stories, ensure_ascii=False, indent=2)
    prev_sel_json   = json.dumps(prev_selections, ensure_ascii=False, indent=2)
    return (HTML_TEMPLATE
            .replace("__STORIES_DATA__", stories_json)
            .replace("__PREV_SELECTIONS__", prev_sel_json))


def main():
    parser = argparse.ArgumentParser(description="Generate review.html từ data_import/")
    parser.add_argument("--dir", help="Override STORIES_DIR")
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
        print(f"↩ Restore {len(prev_selections)} selections từ selections.json")

    html = generate_html(stories, prev_selections)
    OUTPUT_HTML.write_text(html, encoding="utf-8")

    print(f"\n✅ Đã tạo: {OUTPUT_HTML}")
    print(f"   → Mở file đó bằng Chrome/Edge để review\n")

    # Tự mở trình duyệt nếu chạy trên Windows
    try:
        import webbrowser
        webbrowser.open(OUTPUT_HTML.as_uri())
        print("   → Đang mở trình duyệt...")
    except Exception:
        pass


if __name__ == "__main__":
    main()
