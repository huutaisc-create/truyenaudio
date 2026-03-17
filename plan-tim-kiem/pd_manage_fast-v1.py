import http.server
import socketserver
import socket
import mysql.connector
from mysql.connector import Error
import urllib.parse
import urllib.request
import http.client
import json
import os
import io
import sys
import subprocess
import re
import threading
import time



class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

# --- CONFIG ---
PORT = 8010

# --- DATABASE CONFIG (MARIADB) ---
DB_CONFIG = {
    'user': 'root',
    'password': '123456',
    'host': '127.0.0.1', # For main server, use 127.0.0.1. Clients will change this to Host IP.
    'database': 'pdcraw',
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci',
    'autocommit': True
}

def get_db_connection(retries=2, timeout=5):
    config = DB_CONFIG.copy()
    config['connection_timeout'] = timeout      # timeout kết nối ngắn
    config['connect_timeout']    = timeout
    config_file = os.path.join(BASE_DIR, 'db_config.json')
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r') as f:
                external_config = json.load(f)
                if 'host' in external_config:
                    config['host'] = external_config['host']
        except Exception as e:
            print(f"[!] Error reading db_config.json: {e}")

    for attempt in range(1, retries + 1):
        try:
            conn = mysql.connector.connect(**config)
            conn.ping(reconnect=True, attempts=1, delay=0)  # verify live
            return conn
        except Error as e:
            print(f"[!] MariaDB Connection Error (attempt {attempt}/{retries}): {e}")
            if attempt < retries:
                import time; time.sleep(1)
    return None

# --- ABSOLUTE PATH CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMPORT_DIR = os.path.join(BASE_DIR, 'data_import')
SCRAPER_SCRIPT = os.path.join(BASE_DIR, 'pd_scraper_fast-v1.py')
DISCOVERY_SCRIPT = os.path.join(BASE_DIR, 'pd_discovery_auto.py')
CHECK_UPDATE_SCRIPT = os.path.join(BASE_DIR, 'check_update.py')

if not os.path.exists(IMPORT_DIR):
    os.makedirs(IMPORT_DIR, exist_ok=True)

SCRAPER_PIDS = [] # Global list to track running scraper process IDs

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TruyenPhuongDong Admin</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0f172a; color: #f8fafc; }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); }
        .btn-cyan { background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); transition: all 0.3s ease; }
        .btn-green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .btn-orange { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .btn-red { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .status-badge { font-size: 10px; padding: 2px 10px; border-radius: 9999px; font-weight: 800; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1); }
        .status-crawling { background-color: #0ea5e9; animation: pulse 2s infinite; }
        .status-completed { background-color: #10b981; }
        .status-selected { background-color: #6366f1; }
        .status-paused { background-color: #f59e0b; border: 1px solid #fff; }
        .status-error { background-color: #ef4444; }
        .status-repairing { background-color: #8b5cf6; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .tab-active { border-bottom: 2px solid #06b6d4; color: #06b6d4; }
    </style>
</head>
<body class="p-4 md:p-8">
    <!-- SUPER FORCED LOGIN BUTTON -->
    <div style="position: fixed; top: 10px; right: 10px; z-index: 999999; background: #ea580c; color: white; padding: 10px 20px; border-radius: 99px; font-weight: bold; cursor: pointer; box-shadow: 0 0 20px rgba(0,0,0,0.5); border: 2px solid white;" 
         onclick="document.getElementById('modal-login').classList.remove('hidden')">
        👤 <span id="header-admin-name">LOGIN (CLICK ME)</span>
    </div>
    <div class="max-w-6xl mx-auto">
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
            <div>
                <h1 class="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500 mb-2">PDCraw Admin</h1>
                <div class="flex items-center gap-4">
                    <nav class="flex gap-6 mt-2">
                        <button onclick="switchTab('stories')" id="tab-stories" class="text-sm font-bold pb-2 tab-active">TRUYỆN</button>
                        <button onclick="switchTab('updates')" id="tab-updates" class="text-sm font-bold pb-2 text-slate-500">CHECK UPDATE</button>
                        <button onclick="switchTab('accounts')" id="tab-accounts" class="text-sm font-bold pb-2 text-slate-500">TÀI KHOẢN</button>
                    </nav>

                    <div class="px-4 py-1 bg-slate-800 rounded-full border border-slate-700 text-[10px] font-bold text-slate-400 flex gap-3">
                         <span>HÀNG ĐỢI: <span id="stat-queue" class="text-white">0</span></span>
                         <span class="w-px h-3 bg-slate-600"></span>
                         <span>ĐANG CHẠY: <span id="stat-run" class="text-white">0</span></span>
                    </div>
                </div>
            </div>
            
        </div>

        <div id="view-stories">
            <!-- Discovery Input -->
            <!-- Discovery V2 Input -->
            <div class="glass p-6 rounded-2xl mb-8 border border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.1)] relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                     <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                </div>
                <label class="block text-xs font-bold text-orange-500 mb-3 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                    Smart Discovery / Nhập Link:
                </label>
                <div class="flex gap-3 items-stretch">
                    <div class="relative w-32 shrink-0">
                         <select id="discovery-source" class="w-full h-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-3 outline-none focus:border-orange-500 text-xs font-bold text-orange-400 appearance-none">
                             <option value="PD">TruyenPD</option>
                             <option value="TTV">TangThuVien</option>
                             <option value="Metruyen">Metruyen</option>
                         </select>
                         <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                    </div>
                    <input type="text" id="discovery-url" placeholder="Paste link truyện hoặc trang lọc (VD: .../truyen/ten-truyen)" 
                        class="flex-grow bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-orange-500 transition-all font-mono text-sm text-white placeholder-slate-600">
                    <button onclick="submitDiscovery()" id="btn-discovery" class="btn-green px-8 font-black uppercase tracking-widest text-xs rounded-lg shadow-emerald-900/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                        <span>Quét</span>
                        <div id="discovery-spinner" class="hidden w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </button>
                </div>
                <div id="discovery-status" class="mt-2 text-[10px] font-mono text-slate-500 h-4"></div>
            </div>

            <!-- List Stories -->
            <div class="glass rounded-2xl overflow-hidden border border-white/5">
                <!-- Toolbar -->
                <div class="p-4 bg-slate-800/50 border-b border-white/5 space-y-4">
                    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div class="flex gap-2 items-center flex-wrap">
                             <input type="text" id="search" placeholder="Tìm tên truyện..." class="bg-slate-900 border border-slate-700 rounded px-4 py-1.5 text-xs outline-none focus:border-orange-500 w-48" onkeyup="if(event.key==='Enter') loadStories()">
                             <select id="category-filter" class="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs outline-none max-w-[150px]" onchange="loadStories()">
                                <option value="">Tất cả thể loại</option>
                             </select>
                             <select id="book-status-filter" class="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs outline-none" onchange="loadStories()">
                                <option value="">Tất cả tiến độ</option>
                                <option value="Full">Full (Đã hoàn thành)</option>
                                <option value="Ongoing">Ongoing (Chưa xong)</option>
                             </select>
                             <select id="status-filter" class="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs outline-none" onchange="loadStories()">
                                <option value="">Tất cả trạng thái</option>
                                <option value="pending">Chưa cào</option>
                                <option value="selected">Chờ cào</option>
                                <option value="crawling">Đang cào</option>
                                <option value="completed">Đã xong</option>
                                <option value="repairing">Repairing</option>
                                <option value="error">Lỗi</option>
                            </select>
                             <select id="check-filter" class="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs outline-none text-amber-400 font-bold" onchange="loadStories()">
                                <option value="" class="text-slate-400 font-normal">Tất cả nhãn</option>
                                <option value="warn">⚠ Cần kiểm tra</option>
                                <option value="error">❌ Lỗi nghiêm trọng</option>
                            </select>
                        </div>
                        <div class="flex gap-2 items-center">
                            <div class="flex items-center gap-2 mr-2 bg-slate-900 rounded border border-slate-700 px-3 py-1.5 h-full">
                                 <span class="text-[10px] text-slate-500 font-extrabold">LUỒNG:</span>
                                 <input type="number" id="threads" value="1" min="1" max="50" class="w-6 bg-transparent text-center font-bold text-orange-400 outline-none text-xs">
                            </div>
                            <button onclick="startScraper()" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-1.5 px-4 rounded text-xs shadow-lg shadow-orange-500/20 transition-all active:scale-95">START SCRAPER</button>
                            <button onclick="killScrapers()" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-4 rounded text-xs shadow-lg shadow-red-500/20 transition-all active:scale-95">STOP</button>
                            <button id="btn-sync" onclick="syncSelected()" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1.5 px-4 rounded text-xs shadow-lg shadow-indigo-500/20 transition-all active:scale-95">SYNC SELECTED</button>
                            <button id="btn-missing" onclick="crawlMissing()" class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1.5 px-4 rounded text-xs shadow-lg shadow-purple-500/20 transition-all active:scale-95">CRAWL MISSING</button>
                            <button id="btn-check-upload" onclick="openCheckUploadModal()" class="bg-teal-600 hover:bg-teal-500 text-white font-bold py-1.5 px-4 rounded text-xs shadow-lg shadow-teal-500/20 transition-all active:scale-95 flex items-center gap-1.5">
                                <span>⬆</span><span>CHECK & UPLOAD</span>
                            </button>
                        </div>
                    </div>
                    <!-- Legend -->
                    <div class="flex gap-2 flex-wrap items-center text-[10px] text-slate-400">
                        <span class="uppercase font-bold mr-2 text-slate-600">Chú thích:</span>
                        <span class="status-badge status-crawling">Đang cào</span>
                        <span class="status-badge status-paused">Tạm dừng</span>
                        <span class="status-badge status-selected">Chờ cào</span>
                        <span class="status-badge status-completed">Đã xong</span>
                        <span class="status-badge status-error">Lỗi</span>
                        <span class="status-badge status-repairing">Repairing</span>
                    </div>
                </div>

                <!-- Table -->
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-slate-900/80 text-[10px] uppercase font-black text-slate-500">
                            <tr>
                                <th class="p-4 w-16 text-center">
                                    <div class="flex flex-col items-center gap-1">
                                        <span>ID</span>
                                        <input type="checkbox" id="check-all" class="w-3 h-3 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 cursor-pointer" onchange="toggleAllPage(this.checked)">
                                    </div>
                                </th>
                                <th class="p-4">Truyện</th>
                                <th class="p-4 w-24 text-center">User</th>
                                <th class="p-4">Tiến độ (Web)</th>
                                <th class="p-4">Thực tế (File)</th>
                                <th class="p-4">Upload Web</th>
                                <th class="p-4 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody id="story-list" class="text-sm"></tbody>
                    </table>
                </div>
            </div>
            <div class="mt-4 flex justify-between items-center text-[11px] font-bold text-slate-500">
                <span id="story-stats">0 truyện</span>
                <div class="flex gap-2 items-center">
                    <button onclick="changePage(-1)" class="px-4 py-1 glass rounded hover:bg-slate-700">PREV</button>
                    <span id="page-num" class="bg-slate-800 px-3 py-1 rounded text-orange-400 text-center min-w-[30px]">1</span>
                    <button onclick="changePage(1)" class="px-4 py-1 glass rounded hover:bg-slate-700">NEXT</button>
                    <span class="text-slate-600 mx-1">|</span>
                    <span class="text-slate-600">Trang:</span>
                    <input type="number" id="jump-page" min="1" class="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center text-orange-400 font-bold outline-none focus:border-orange-500 text-xs"
                        onkeyup="if(event.key==='Enter'){ const p=parseInt(this.value); if(p>=1&&p<=totalPages){curPage=p;loadStories();} }"
                        placeholder="...">
                    <button onclick="const p=parseInt(document.getElementById('jump-page').value); if(p>=1&&p<=totalPages){curPage=p;loadStories();}" class="px-3 py-1 glass rounded hover:bg-slate-700 text-xs">GO</button>
                </div>
            </div>
        </div>

        <div id="view-accounts" class="hidden">
             <div class="glass p-6 rounded-2xl">
                <h3 class="text-xs font-black uppercase text-orange-500 mb-4 tracking-widest">Danh sách tài khoản (accounts.txt)</h3>
                <p class="text-[10px] text-slate-400 mb-4">File: d:\\Webtruyen\\pdcraw\\accounts.txt</p>
                <div class="bg-slate-900 p-4 rounded font-mono text-xs text-slate-300 whitespace-pre-line" id="account-content">
                    Loading...
                </div>
             </div>
        </div>

        <div id="view-updates" class="hidden">
            <div class="glass p-6 rounded-2xl mb-8 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                <div class="flex justify-between items-center mb-4">
                    <div>
                         <h2 class="text-lg font-bold text-blue-400 uppercase tracking-widest">Kiểm tra Chương Mới</h2>
                         <p class="text-xs text-slate-500">Quét các truyện chưa hoàn thành (Ongoing) để tìm chương mới.</p>
                    </div>
                    <button onclick="scanUpdates()" id="btn-scan-update" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-xs shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex gap-2 items-center">
                        <span>SCAN NOW / QUÉT NGAY</span>
                        <div id="scan-spinner" class="hidden w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </button>
                </div>
                <div id="scan-status" class="text-xs font-mono text-slate-400 mb-4 h-5"></div>
                
                <div class="overflow-hidden rounded-lg border border-white/5 bg-slate-900/50">
                     <table class="w-full text-left text-xs">
                         <thead class="bg-slate-900 text-slate-500 uppercase font-bold">
                             <tr>
                                 <th class="p-3 w-10"><input type="checkbox" onchange="toggleAllUpdates(this.checked)"></th>
                                 <th class="p-3">Truyện</th>
                                 <th class="p-3">Hiện tại (DB)</th>
                                 <th class="p-3 text-green-400">Mới nhất (Web)</th>
                                 <th class="p-3 text-center">Tình trạng</th>
                             </tr>
                         </thead>
                         <tbody id="update-list" class="text-slate-300 font-mono">
                             <!-- Items -->
                         </tbody>
                     </table>
                     <div id="update-empty" class="p-8 text-center text-slate-500 italic hidden">Chưa có kết quả quét. Bấm nút SCAN để bắt đầu.</div>
                </div>
                
                <div class="mt-4 flex justify-end">
                    <button onclick="addUpdateQueue()" id="btn-queue-update" class="hidden px-6 py-3 bg-green-600 hover:bg-green-500 rounded font-bold text-xs shadow-lg shadow-green-500/20 transition-all active:scale-95">
                        ĐẨY VÀO HÀNG ĐỢI (QUEUE SELECTED)
                    </button>
                </div>
            </div>
        </div>

        <!-- Conflict Modal -->
        <div id="modal-conflicts" class="fixed inset-0 bg-black/90 hidden flex items-center justify-center z-50 backdrop-blur-sm">
            <div class="bg-slate-900 p-8 rounded-2xl max-w-4xl w-full border border-orange-500/50 shadow-[0_0_50px_rgba(249,115,22,0.2)] transform transition-all scale-100">
                 <div class="flex items-center gap-4 mb-6">
                     <div class="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center text-2xl">⚠️</div>
                     <div>
                         <h2 class="text-2xl font-bold text-orange-500">Phát hiện trùng lặp</h2>
                         <p class="text-slate-400 text-xs">Các truyện sau đã tồn tại. Bạn có muốn cập nhật thông tin mới (Số chương/Nguồn) không?</p>
                     </div>
                 </div>
                 
                 <div class="max-h-[50vh] overflow-y-auto mb-6 bg-slate-950/50 p-4 rounded border border-white/5">
                     <table class="w-full text-left text-xs">
                         <thead class="text-slate-500 uppercase font-bold border-b border-white/5">
                             <tr>
                                 <th class="p-2"><input type="checkbox" onchange="toggleAllConflicts(this.checked)"></th>
                                 <th class="p-2">Truyện (Slug)</th>
                                 <th class="p-2">Nguồn Cũ (Chap)</th>
                                 <th class="p-2 text-green-400">Nguồn Mới (Chap)</th>
                             </tr>
                         </thead>
                         <tbody id="conflict-list" class="text-slate-300 font-mono"></tbody>
                     </table>
                 </div>
                 
                 <div class="flex justify-end gap-3 items-center">
                     <span class="text-xs text-slate-500 mr-auto italic" id="conflict-count-msg"></span>
                     <button onclick="closeModal('modal-conflicts')" class="px-6 py-2 rounded font-bold text-slate-400 hover:text-white transition-colors">Bỏ qua tất cả</button>
                     <button onclick="confirmOverwrite()" id="btn-overwrite" class="btn-orange px-6 py-2 rounded font-bold text-white shadow-lg shadow-orange-500/20 flex gap-2 items-center">
                         <span>Cập nhật (Overwrite)</span>
                     </button>
                 </div>
            </div>
        </div>
    </div>

    <!-- ============================================================ -->
    <!-- CHECK & UPLOAD MODAL                                        -->
    <!-- ============================================================ -->
    <div id="modal-check-upload" class="fixed inset-0 bg-black/90 hidden flex items-start justify-center z-50 backdrop-blur-sm overflow-y-auto">
        <div class="bg-slate-900 rounded-none md:rounded-2xl w-full min-h-screen md:min-h-0 md:my-4 md:max-w-6xl border-0 md:border border-teal-500/40 shadow-[0_0_60px_rgba(20,184,166,0.15)] md:mx-4 flex flex-col">
            
            <!-- Modal Header -->
            <div class="flex items-center justify-between p-6 border-b border-white/5">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center text-xl">⬆</div>
                    <div>
                        <h2 class="text-xl font-bold text-teal-400">Kiểm Tra & Upload Lên Web</h2>
                        <p class="text-slate-500 text-xs mt-0.5" id="cu-subtitle">Chọn truyện trên danh sách rồi nhấn CHECK & UPLOAD</p>
                    </div>
                </div>
                <button onclick="closeModal('modal-check-upload')" class="text-slate-500 hover:text-white text-2xl leading-none transition-colors">✕</button>
            </div>

            <!-- Config Bar -->
            <div class="flex flex-wrap items-center gap-4 px-6 py-3 bg-slate-800/40 border-b border-white/5">
                <div class="flex items-center gap-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Batch size:</label>
                    <input type="number" id="cu-batch-size" value="50" min="10" max="200"
                        class="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-teal-400 outline-none focus:border-teal-500 text-center">
                    <span class="text-[10px] text-slate-500">chương/lần</span>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngưỡng lỗi nội dung:</label>
                    <input type="number" id="cu-min-chars" value="500" min="50" max="5000"
                        class="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-teal-400 outline-none focus:border-teal-500 text-center">
                    <span class="text-[10px] text-slate-500">ký tự</span>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Web App URL:</label>
                    <input type="text" id="cu-web-url" value="http://localhost:3000"
                        class="w-52 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-teal-400 outline-none focus:border-teal-500">
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Secret Key:</label>
                    <input type="password" id="cu-secret" placeholder="X-Upload-Secret"
                        class="w-36 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-400 outline-none focus:border-teal-500">
                </div>
            </div>

            <!-- Story List to check -->
            <div class="px-6 pt-4 pb-2">
                <div id="cu-story-list" class="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                    <div class="text-center text-slate-500 text-xs italic py-6">Nhấn CHECK để bắt đầu kiểm tra...</div>
                </div>
            </div>

            <!-- Summary Stats Bar -->
            <div id="cu-summary" class="hidden mx-6 my-3 grid grid-cols-4 gap-3">
                <div class="bg-slate-800 rounded-lg p-3 text-center border border-white/5">
                    <div class="text-xl font-black text-white" id="cu-stat-total">0</div>
                    <div class="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Tổng truyện</div>
                </div>
                <div class="bg-slate-800 rounded-lg p-3 text-center border border-white/5">
                    <div class="text-xl font-black text-green-400" id="cu-stat-ok">0</div>
                    <div class="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Sẵn sàng</div>
                </div>
                <div class="bg-amber-900/30 rounded-lg p-3 text-center border border-amber-500/20">
                    <div class="text-xl font-black text-amber-400" id="cu-stat-warn">0</div>
                    <div class="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Cảnh báo</div>
                </div>
                <div class="bg-red-900/30 rounded-lg p-3 text-center border border-red-500/20">
                    <div class="text-xl font-black text-red-400" id="cu-stat-err">0</div>
                    <div class="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Lỗi nghiêm trọng</div>
                </div>
            </div>

            <!-- Upload Progress -->
            <div id="cu-upload-progress" class="hidden px-6 py-3">
                <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">
                    <span id="cu-progress-label">Đang upload...</span>
                    <span id="cu-progress-pct">0%</span>
                </div>
                <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div id="cu-progress-bar" class="h-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-300 shadow-[0_0_10px_rgba(20,184,166,0.5)]" style="width:0%"></div>
                </div>
                <div id="cu-progress-log" class="mt-2 text-[10px] font-mono text-slate-500 max-h-40 overflow-y-auto space-y-0.5"></div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center justify-between gap-3 p-6 border-t border-white/5">
                <div class="text-[10px] text-slate-500 italic" id="cu-status-msg"></div>
                <div class="flex gap-3">
                    <button id="btn-save-check" onclick="saveCheckCache(); loadStories();" class="hidden px-5 py-2 rounded font-bold text-teal-400 hover:text-teal-300 border border-teal-700 hover:bg-teal-900/30 transition-all text-xs">
                        💾 Lưu kết quả
                    </button>
                    <button onclick="closeModal('modal-check-upload')" class="px-5 py-2 rounded font-bold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-all text-xs">
                        ✕ Hủy
                    </button>
                    <button id="btn-do-check" onclick="doCheckContent()" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-white text-xs shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2">
                        <span>🔍</span><span>CHECK LẠI</span>
                        <div id="cu-check-spinner" class="hidden w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </button>
                    <button id="btn-do-upload-warn" onclick="doUpload(true)" class="hidden px-6 py-2 bg-amber-600 hover:bg-amber-500 rounded font-bold text-white text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95">
                        ⚠ Vẫn Upload (bỏ qua lỗi)
                    </button>
                    <button id="btn-do-upload-ok" onclick="doUpload(false)" class="hidden px-6 py-2 bg-teal-600 hover:bg-teal-500 rounded font-bold text-white text-xs shadow-lg shadow-teal-500/20 transition-all active:scale-95">
                        ✅ Upload
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Login Modal -->
    <div id="modal-login" class="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[100] backdrop-blur-md hidden">
        <div class="glass p-8 rounded-2xl w-full max-w-md border border-orange-500/30 text-center shadow-[0_0_100px_rgba(249,115,22,0.1)]">
             <div class="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 text-orange-500">👤</div>
             <h2 class="text-2xl font-black text-orange-500 uppercase tracking-widest mb-2">Web Admin Login</h2>
             <p class="text-slate-500 text-xs mb-6">Nhập tên định danh của bạn để bắt đầu quản lý.</p>
             
             <input type="text" id="admin-name-input" class="w-full bg-slate-900 border border-white/10 rounded p-3 text-center text-white font-bold mb-4 focus:border-orange-500 focus:outline-none placeholder-slate-600" placeholder="Ví dụ: Admin Huy, Admin Laptop...">
             
             <button onclick="doLogin()" class="w-full py-3 bg-orange-600 hover:bg-orange-500 rounded font-bold text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                 XÁC NHẬN (ENTER)
             </button>
        </div>
        <p class="mt-4 text-xs text-slate-600">Distributed Scraping System v2.0</p>
    </div>

    <script>
        let curPage = 1;
        let totalPages = 1;
        let currentTab = 'stories';

        function switchTab(tab) {
            currentTab = tab;
            document.getElementById('view-stories').classList.toggle('hidden', tab !== 'stories');
            document.getElementById('view-accounts').classList.toggle('hidden', tab !== 'accounts');
            document.getElementById('view-updates').classList.toggle('hidden', tab !== 'updates');
            
            document.getElementById('tab-stories').classList.toggle('tab-active', tab === 'stories');
            document.getElementById('tab-stories').classList.toggle('text-slate-500', tab !== 'stories');
            
            document.getElementById('tab-accounts').classList.toggle('tab-active', tab === 'accounts');
            document.getElementById('tab-accounts').classList.toggle('text-slate-500', tab !== 'accounts');
            
            document.getElementById('tab-updates').classList.toggle('tab-active', tab === 'updates');
            document.getElementById('tab-updates').classList.toggle('text-slate-500', tab !== 'updates');
            
            if (tab === 'accounts') loadAccounts();
            else if (tab === 'stories') loadStories();
            else if (tab === 'updates') loadUpdateList();
        }
        
        async function loadCategories() {
            const res = await fetch('/api?action=get_categories');
            const data = await res.json();
            const select = document.getElementById('category-filter');
            data.categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.innerText = c;
                select.appendChild(opt);
            });
        }

        async function loadStories() {
            try {
                const search = document.getElementById('search').value;
                const status = document.getElementById('status-filter').value;
                const category = document.getElementById('category-filter').value;
                const book_status = document.getElementById('book-status-filter').value;
                const curAdmin = localStorage.getItem('admin_name');
                const res = await fetch(`/api?action=list&page=${curPage}&search=${search}&status=${status}&category=${encodeURIComponent(category)}&book_status=${book_status}&admin=${curAdmin || ''}`);
                
                if (!res.ok) throw new Error(`Server Error: ${res.status} ${res.statusText}`);
                
                const data = await res.json();
                totalPages = data.total_pages;
                
                document.getElementById('page-num').innerText = curPage;
                document.getElementById('story-stats').innerText = `Tổng cộng ${data.total} truyện`;
                
                // Update Headers Stats
                if(data.stats) {
                    // Show: QUEUE: [MY] / [TOTAL]
                    const myQ = data.stats.my_queue !== undefined ? data.stats.my_queue : '?';
                    document.getElementById('stat-queue').innerHTML = `<span class="text-orange-400 border-b border-orange-500">${myQ}</span> <span class="text-slate-600">/</span> ${data.stats.queue}`;
                    document.getElementById('stat-run').innerText = data.stats.running;
                }
                
                const list = document.getElementById('story-list');

                // Lưu lại các ID của truyện 'completed' đang được tick trước khi render lại
                const prevCheckedCompleted = new Set(
                    Array.from(document.querySelectorAll('.story-ck-completed:checked'))
                        .map(c => parseInt(c.value))
                );

                // Filter theo nhãn kiểm tra (client-side vì checkCache lưu ở JS)
                const checkFilter = document.getElementById('check-filter').value;
                let stories = data.stories;
                if (checkFilter) {
                    stories = stories.filter(s => checkCache[s.id] && checkCache[s.id].status === checkFilter);
                }

                list.innerHTML = '';
                // data is now accessible here
                stories.forEach(s => {
                    const total = s.chapters || 0;
                    const current = s.downloaded_chapters || 0;
                    const progress = total > 0 ? Math.round((current / total) * 100) : 0;
                    
                    const tr = document.createElement('tr');
                    
                    // Admin Logic
                    const storyAdmin = s.admin_control;
                    const isLocked = false; // Tất cả admin đều có thể chọn mọi truyện
                    // DEBUG: Force log to console
                    if (storyAdmin) console.log(`DEBUG: ID ${s.id} | Story Admin: [${storyAdmin}] | Current Admin: [${curAdmin}] | Locked: ${isLocked}`);
    
                    const adminColor = isLocked ? 'bg-red-900/40 text-red-400 border-red-500/30' : 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30';
                    
                    // Checkbox logic: Auto-check chỉ khi đang trong scraper queue
                    // completed KHÔNG auto-check nhưng vẫn cho phép tick tay để Upload
                    const isChecked = ['selected', 'crawling', 'repairing'].includes(s.crawl_status);
                    
                    const uploaded = s.uploaded_chapters || 0;
                    const downloaded = s.downloaded_chapters || 0;
                    const uploadDelta = Math.max(0, downloaded - uploaded);
                    const uploadPct = downloaded > 0 ? Math.round((uploaded / downloaded) * 100) : 0;
                    let uploadHTML = '';
                    if (uploaded === 0 && downloaded === 0) {
                        uploadHTML = '<span class="text-slate-700 text-[10px]">—</span>';
                    } else if (uploaded === 0) {
                        uploadHTML = '<span class="text-[10px] text-slate-500 italic">Chưa upload</span>';
                    } else {
                        const upBarColor = uploadDelta === 0 ? 'from-teal-600 to-teal-400' : 'from-amber-600 to-amber-400';
                        const upPctColor = uploadDelta === 0 ? 'text-teal-400' : 'text-amber-400';
                        const upLabel = uploadDelta === 0
                            ? '<span class="text-teal-400 font-black text-[9px] uppercase tracking-widest ml-1">✓ Sync</span>'
                            : '<span class="text-amber-400 text-[9px] ml-1">+' + uploadDelta + ' mới</span>';
                        uploadHTML = '<div class="flex justify-between text-[10px] font-bold text-slate-500 mb-1">'
                            + '<span>' + uploaded + ' / ' + downloaded + upLabel + '</span>'
                            + '<span class="flex items-center gap-2">'
                            + '<span class="' + upPctColor + '">' + uploadPct + '%</span>'
                            + '<button onclick="resetUpload(' + s.id + ')" title="Xóa truyện trên web và reset upload" '
                            + 'class="text-[9px] px-1.5 py-0.5 rounded border border-red-800 text-red-500 hover:bg-red-900/40 hover:text-red-300 transition-all font-black uppercase tracking-wider">↺ RESET</button>'
                            + '</span>'
                            + '</div>'
                            + '<div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">'
                            + '<div class="h-full bg-gradient-to-r ' + upBarColor + ' transition-all" style="width:' + uploadPct + '%"></div>'
                            + '</div>';
                    }

                    tr.className = `border-t border-white/5 transition-all group ${isLocked ? 'opacity-50 grayscale pointer-events-none bg-slate-900/50' : 'hover:bg-white/5'}`;
    
                    tr.innerHTML = `
                        <!-- COL 1: ID / Checkbox -->
                        <td class="p-4 text-center">
                            ${isLocked 
                                ? `<span class="text-[10px] font-black text-red-500 border border-red-900 bg-red-900/20 px-1 py-0.5 rounded">LOCKED</span>`
                                : s.crawl_status === 'completed'
                                    ? `<input type="checkbox" class="story-ck story-ck-completed w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500 cursor-pointer" 
                                       value="${s.id}"
                                       title="Tick để chọn upload — không ảnh hưởng trạng thái scraper">`
                                    : `<input type="checkbox" class="story-ck w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 cursor-pointer" 
                                       value="${s.id}" 
                                       ${isChecked ? 'checked' : ''} 
                                       onchange="toggleSelect(${s.id}, this.checked)">`
                            }
                        </td>

                        <!-- COL 2: Truyện (Title) -->
                        <td class="p-4">
                            <div class="font-bold text-slate-100 group-hover:text-orange-400 flex items-center gap-2 flex-wrap">
                                ${s.book_status === 'Full' ? '<span class="text-[10px] bg-green-900 text-green-300 px-1 py-0.5 rounded shadow-green-900/50">FULL</span>' : ''}
                                ${s.book_status !== 'Full' ? '<span class="text-[10px] bg-blue-900 text-blue-300 px-1 py-0.5 rounded shadow-blue-900/50">ONGOING</span>' : ''}
                                <a href="${s.url}" target="_blank" class="decoration-none hover:underline truncate max-w-[250px] block" title="${s.title}">${s.title}</a>
                                ${storyAdmin ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${adminColor}">👤 ${storyAdmin}</span>` : ''}
                                ${checkCache[s.id] ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black border uppercase ${checkCache[s.id].status === 'warn' ? 'text-amber-400 border-amber-700 bg-amber-900/20' : 'text-red-400 border-red-700 bg-red-900/20'}" title="${checkCache[s.id].summary}">⚠ ${checkCache[s.id].label}</span>` : ''}
                            </div>
                            <div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wide flex gap-2">
                                 <span>${s.author}</span>
                                 <span class="text-slate-700">|</span>
                                 <span>${s.category || 'N/A'}</span>
                            </div>
                        </td>

                        <!-- COL 3: User (Bot/Admin) -->
                        <td class="p-4 text-center w-24">
                             ${s.last_account_idx != null && ['crawling','repairing','paused'].includes(s.crawl_status) 
                                ? `<span class="px-2 py-1 bg-indigo-900/40 text-indigo-300 text-[10px] font-bold rounded border border-indigo-500/20 inline-flex items-center gap-1 shadow-[0_0_10px_rgba(99,102,241,0.2)]">Bot ${s.last_account_idx}</span>` 
                                : '<span class="text-slate-700 text-[10px]">-</span>'}
                        </td>

                        <!-- COL 4: Tiến độ (Web) -->
                        <td class="p-4">
                            <div class="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1">
                                <span>${current} / ${total || '?'} ${s.mapped_count ? `<span class="text-indigo-400 font-black">/ ${s.mapped_count}</span>` : ''}</span>
                                <span class="${progress===100?'text-green-500':'text-orange-500'}">${progress}%</span>
                            </div>
                            <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all shadow-[0_0_10px_rgba(249,115,22,0.5)]" style="width: ${progress}%"></div></div>
                        </td>

                        <!-- COL 5: Thực tế (File) -->
                        <td class="p-4 font-mono text-xs text-indigo-400 font-bold text-center">
                            ${s.actual_chapters || 0}
                        </td>

                        <!-- COL 6: Upload Web -->
                        <td class="p-4 min-w-[140px]">
                            ${uploadHTML}
                        </td>

                        <!-- COL 6: Trạng thái -->
                        <td class="p-4 text-center">
                            <span class="status-badge status-${s.crawl_status}">${s.crawl_status}</span>
                            ${s.last_updated ? `<div class="text-[9px] text-slate-600 mt-1 font-mono">${new Date(s.last_updated).toLocaleTimeString()}</div>` : ''}
                            ${s.crawl_status === 'crawling' 
                                ? `<div class="mt-1"><button onclick="stopStory(${s.id})" class="text-[9px] text-red-400 hover:text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 transition-all uppercase font-bold tracking-wider">STOP</button></div>`
                                : ''}
                        </td>
                    `;
                    list.appendChild(tr);
                });

                // Restore trạng thái tick của các truyện 'completed' sau khi render lại
                if (prevCheckedCompleted.size > 0) {
                    document.querySelectorAll('.story-ck-completed').forEach(ck => {
                        if (prevCheckedCompleted.has(parseInt(ck.value))) {
                            ck.checked = true;
                        }
                    });
                }
    
            } catch(e) {
                console.error(e);
                // alert("Lỗi tải danh sách: " + e.message); // Optional: Uncomment if needed
                document.getElementById('story-list').innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Lỗi kết nối: ${e.message}</td></tr>`;
                return;
            }
        }

        async function loadAccounts() {
            const list = document.getElementById('account-content');
            list.innerHTML = '<div class="text-center text-slate-500 italic">Checking Account Pool...</div>'; // clear previous content
            list.className = "flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2"; // Remove previous classes if needed, or override

            const res = await fetch('/api?action=get_accounts');
            const data = await res.json();
            
            list.innerHTML = '';
            
            // Render nicer list with Locks
            const curAdmin = localStorage.getItem('admin_name');
            let myAccounts = [];
            
            if(data.accounts && data.accounts.length > 0) {
                 const container = document.createElement('div');
                 container.className = "flex flex-col gap-2";
                 
                 data.accounts.forEach(acc => {
                     const isLocked = !!acc.locked_by;
                     const isMine = acc.locked_by === curAdmin;
                     if(isMine) myAccounts.push(acc.index);
                     
                     const div = document.createElement('div');
                     div.className = `p-3 rounded flex justify-between items-center border transition-all ${isMine ? 'bg-orange-900/20 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : isLocked ? 'bg-slate-900/50 border-slate-800 opacity-60 grayscale' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`;
                     
                     div.innerHTML = `
                        <div class="flex items-center gap-3">
                            <span class="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold ${isMine ? 'text-orange-500 border-orange-500/30' : 'text-slate-400'} shadow-inner">${acc.index}</span>
                            <span class="font-mono text-xs ${isMine ? 'text-orange-200 font-bold' : 'text-slate-400'}">${acc.email}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            ${isLocked 
                                ? `<span class="px-2 py-1 rounded text-[9px] font-bold uppercase border tracking-wider ${isMine ? 'bg-orange-900/40 text-orange-400 border-orange-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}">Locked by ${acc.locked_by}</span>` 
                                : '<span class="px-2 py-1 rounded text-[9px] font-bold uppercase border tracking-wider bg-emerald-900/20 text-emerald-500 border-emerald-500/20">Available</span>'}
                        </div>
                     `;
                     container.appendChild(div);
                 });
                 list.appendChild(container);
                 
                 // Add Lock Controls (Sticky Footer or Top?)
                 // Inserting before list might be better, but let's append for now.
                 const controls = document.createElement('div');
                 controls.className = "mt-4 pt-4 border-t border-white/10 sticky bottom-0 bg-black/80 backdrop-blur p-4 rounded-xl border border-white/5 shadow-2xl z-10";
                 controls.innerHTML = `
                    <div class="flex flex-col gap-2">
                        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex justify-between">
                            <span>MY POOL CONTROL (ADMIN: <span class="text-orange-500">${curAdmin || 'Unknown'}</span>)</span>
                            <span class="text-xs text-orange-400">${myAccounts.length} Active</span>
                        </div>
                        <div class="flex gap-2">
                            <input type="text" id="pool-input" class="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:border-orange-500 focus:outline-none transition-colors" placeholder="Example: 1, 2, 3" value="${myAccounts.join(', ')}">
                            <button onclick="lockAccountPool()" class="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-bold rounded shadow-lg shadow-orange-500/20 flex items-center gap-2 uppercase tracking-wide transition-all active:scale-95 whitespace-nowrap">
                                🔒 LOCK POOL
                            </button>
                        </div>
                        <p class="text-[9px] text-slate-600 italic">* Nhập danh sách index (ví dụ: 1, 2, 5) để khóa các account này cho riêng bạn. Bỏ trống để nhả tất cả.</p>
                    </div>
                 `;
                 list.appendChild(controls); // Append INSIDE list, so it clears on reload
                 
            } else {
                 list.innerText = "No accounts found.";
            }
        }

        async function submitDiscovery() {
            const url = document.getElementById('discovery-url').value;
            const source = document.getElementById('discovery-source').value;
            const btn = document.getElementById('btn-discovery');
            const status = document.getElementById('discovery-status');
            const spinner = document.getElementById('discovery-spinner');
            
            btn.disabled = true; spinner.classList.remove('hidden');
            status.innerText = "Đang khởi động cào...";
            
            try {
                const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'submit_discovery', url: url, source: source})});
                const data = await res.json();
                if (data.success) {
                    status.innerText = "Scanner đang chạy... Vui lòng đợi...";
                    pollDiscovery();
                } else {
                    alert("Lỗi khởi động!");
                    resetDiscoveryUI();
                }
            } catch(e) { resetDiscoveryUI(); }
        }
        
        async function pollDiscovery() {
            const status = document.getElementById('discovery-status');
            const interval = setInterval(async () => {
                try {
                    const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'check_discovery'})});
                    const data = await res.json();
                    
                    if (data.status === 'finished') {
                        clearInterval(interval);
                        resetDiscoveryUI();
                        
                        // Handle Results
                        const results = data.results || {new: 0, conflicts: []};
                        status.innerText = `Hoàn tất. Thêm mới: ${results.new}. Trùng lặp: ${results.conflicts.length}`;
                        
                        if (results.new > 0) {
                            alert(`✅ Đã thêm mới ${results.new} truyện!`);
                            loadStories();
                        }
                        
                        if (results.conflicts.length > 0) {
                            showConflicts(results.conflicts);
                        }
                        
                    } else {
                        status.innerText = "Đang quét dữ liệu... (" + new Date().toLocaleTimeString() + ")";
                    }
                } catch(e) {
                    clearInterval(interval);
                    resetDiscoveryUI();
                }
            }, 2000);
        }
        
        function resetDiscoveryUI() {
            document.getElementById('btn-discovery').disabled = false;
            document.getElementById('discovery-spinner').classList.add('hidden');
        }
        
        // Conflict Handling
        let globalConflicts = [];
        function showConflicts(conflicts) {
            globalConflicts = conflicts;
            const tbody = document.getElementById('conflict-list');
            tbody.innerHTML = '';
            document.getElementById('modal-conflicts').classList.remove('hidden');
            
            conflicts.forEach((c, idx) => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-white/5 hover:bg-white/5";
                tr.innerHTML = `
                    <td class="p-2"><input type="checkbox" class="conflict-ck" value="${idx}" checked></td>
                    <td class="p-2 font-bold text-slate-200">
                        ${c.slug}
                        <div class="text-[10px] text-slate-500">${c.title}</div>
                    </td>
                    <td class="p-2 text-slate-400">
                        ${c.old_source} (${c.old_chapters} chap)
                    </td>
                    <td class="p-2 text-green-400 font-bold">
                        ${c.new_source} (${c.new_chapters} chap)
                    </td>
                `;
                tbody.appendChild(tr);
            });
            document.getElementById('conflict-count-msg').innerText = `Tổng: ${conflicts.length} truyện trùng.`;
        }
        
        function toggleAllConflicts(checked) {
            document.querySelectorAll('.conflict-ck').forEach(c => c.checked = checked);
        }
        
        function closeModal(id) {
            document.getElementById(id).classList.add('hidden');
            if (id === 'modal-check-upload') pauseAutoRefresh = false;
        }
        
        async function confirmOverwrite() {
            const checkboxes = document.querySelectorAll('.conflict-ck:checked');
            if(checkboxes.length === 0) return closeModal('modal-conflicts'); // Dismiss
            
            const selectedIndices = Array.from(checkboxes).map(c => parseInt(c.value));
            const updates = selectedIndices.map(i => globalConflicts[i]);
            
            const btn = document.getElementById('btn-overwrite');
            btn.innerText = "Updating..."; btn.disabled = true;
            
            try {
                const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'resolve_conflicts', updates: updates})});
                const data = await res.json();
                alert(`Đã cập nhật ${data.updated} truyện!`);
                closeModal('modal-conflicts');
                loadStories();
            } finally {
                btn.innerText = "Cập nhật (Overwrite)"; btn.disabled = false;
            }
        }

        async function startScraper() {
            const admin = localStorage.getItem('admin_name');
            if(!admin) { document.getElementById('modal-login').classList.remove('hidden'); return; }
            
            // Get my locked accounts
            const res = await fetch('/api?action=get_accounts');
            const data = await res.json();
            // Assuming data.accounts array exists
            const myAccounts = (data.accounts || []).filter(a => a.locked_by === admin).map(a => a.index);
            
            if(myAccounts.length === 0) return alert("Bạn chưa khóa Account nào! Vào tab Accounts để chọn Pool.");
            
            if(!confirm(`Khởi động cào với ${myAccounts.length} accounts đang khóa của bạn?\n(Accounts: ${myAccounts.join(', ')})`)) return;
            
            const threads = document.getElementById('threads').value; 
            
            try {
                const res2 = await fetch('/api', {method: 'POST', body: JSON.stringify({
                    action: 'start_scraper', 
                    admin: admin,
                    accounts: myAccounts,
                    threads: threads
                })});
                const data2 = await res2.json();
                if (data2.success) alert(data2.message);
                else alert('Error: ' + data2.message);
            } catch(e) { alert("Lỗi: " + e); }
        }

        async function killScrapers() {
            if (!confirm('Dừng tất cả các luồng cào đang chạy?')) return;
            await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'kill_scrapers'})});
            alert('Đã gửi lệnh dừng.');
        }

        async function syncProgress() {
            const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'sync_progress'})});
            const data = await res.json();
            if (data.success) { alert('Đã cập nhật xong tiến độ từ ổ đĩa!'); loadStories(); }
        }

        function showToast(msg, color='green') {
            const t = document.createElement('div');
            t.className = 'fixed bottom-6 right-6 z-[999] text-white text-xs font-bold px-5 py-3 rounded-xl shadow-2xl transition-all ' + (color === 'green' ? 'bg-emerald-700' : 'bg-red-700');
            t.innerText = msg;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 3000);
        }

        async function resetUpload(storyId) {
            // Đọc từ modal Check & Upload nếu có, nếu không prompt
            let webUrl = (document.getElementById('cu-web-url') ? document.getElementById('cu-web-url').value.trim() : '').replace(/\/$/, '');
            let secret = document.getElementById('cu-secret') ? document.getElementById('cu-secret').value.trim() : '';

            if (!webUrl) {
                webUrl = (prompt('Nhập WEB APP URL:', 'http://localhost:3000') || '').trim().replace(/\/$/, '');
                if (!webUrl) return;
                if (document.getElementById('cu-web-url')) document.getElementById('cu-web-url').value = webUrl;
            }
            if (!secret) {
                secret = (prompt('Nhập SECRET KEY:') || '').trim();
                if (!secret) return;
                if (document.getElementById('cu-secret')) document.getElementById('cu-secret').value = secret;
            }

            if (!confirm('Xác nhận xóa truyện này trên Web DB và reset trạng thái upload?')) return;

            try {
                const res = await fetch('/api', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'reset_upload', story_id: storyId, web_url: webUrl, secret: secret })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('✅ ' + data.message, 'green');
                    loadStories();
                } else {
                    showToast('❌ ' + data.message, 'red');
                }
            } catch(e) {
                showToast('❌ Lỗi: ' + e.message, 'red');
            }
        }

        async function toggleSelect(id, checked) {
            const admin = localStorage.getItem('admin_name');
            if(!admin) {
                alert("Bạn chưa đăng nhập!");
                // Revert
                const ck = document.querySelector(`.story-ck[value="${id}"]`);
                if(ck) ck.checked = !checked;
                return;
            }
            // Optimistic Update (Prevent Lag)
            // But we reload anyway.
            
            await fetch('/api', {method: 'POST', body: JSON.stringify({
                action: 'toggle_select', 
                id: id, 
                selected: checked,
                admin: admin
            })});
            // loadStories(); // Let user refresh manually? Or auto? 
            // Better to refresh to confirm lock state.
            loadStories();
        }

        async function toggleAllPage(checked) {
            const admin = localStorage.getItem('admin_name');
            if(!admin) {
                alert("Bạn chưa đăng nhập!");
                document.getElementById('check-all').checked = !checked;
                return;
            }
            
            const checkboxes = document.querySelectorAll('.story-ck');
            const ids = Array.from(checkboxes).map(c => parseInt(c.value));
            
            if(ids.length === 0) return;
            
            // Visual feedback
            checkboxes.forEach(c => c.checked = checked);
            
            try {
                const res = await fetch('/api', {method: 'POST', body: JSON.stringify({
                    action: 'batch_toggle_select',
                    ids: ids,
                    selected: checked,
                    admin: admin
                })});
                const data = await res.json();
                console.log(data.message);
                loadStories(); // Refresh to show locks
            } catch(e) {
                alert("Lỗi: " + e);
                loadStories(); // Revert on error
            }
        }

        async function syncSelected() {
            const checked = document.querySelectorAll('.story-ck:checked');
            if(checked.length === 0) return alert('Chưa chọn truyện nào!');
            
            const ids = Array.from(checked).map(c => parseInt(c.value));
            const btn = document.getElementById('btn-sync');
            const originalText = btn.innerText;
            btn.innerText = "⏳..."; btn.disabled = true;
            
            try {
                const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'sync_selected', ids: ids})});
                const data = await res.json();
                alert(data.message);
            } catch(e) {
                alert("Lỗi sync: " + e);
            }
            
            btn.innerText = originalText; btn.disabled = false;
            loadStories();
        }

        async function crawlMissing() {
            const checked = document.querySelectorAll('.story-ck:checked');
            if(checked.length === 0) return alert('Chưa chọn truyện nào!');
            
            const ids = Array.from(checked).map(c => parseInt(c.value));
            const btn = document.getElementById('btn-missing');
            const originalText = btn.innerText;
            btn.innerText = "⏳..."; btn.disabled = true;
            
            try {
                const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'crawl_missing', ids: ids})});
                const data = await res.json();
                alert(data.message);
            } catch(e) {
                alert("Lỗi: " + e);
            }
            btn.innerText = originalText; btn.disabled = false;
            loadStories();
        }

        function changePage(delta) {
            if (curPage + delta < 1 || curPage + delta > totalPages) return;
            curPage += delta; loadStories();
        }

        let pauseAutoRefresh = false;
        setInterval(() => { if (currentTab === 'stories' && !pauseAutoRefresh) loadStories(); }, 5000);

        // --- LOGIN & POOL LOGIC ---
        function checkLogin() {
            const admin = localStorage.getItem('admin_name');
            const headerName = document.getElementById('header-admin-name');
            console.log("DEBUG: ADMIN LOGIN SCRIPT LOADED v2 - Admin:", admin);
            
            if (admin) {
                 document.getElementById('modal-login').classList.add('hidden');
                 if(headerName) headerName.innerText = admin;
            } else {
                document.getElementById('modal-login').classList.remove('hidden');
                if(headerName) headerName.innerText = "LOGIN (CLICK ME)";
            }
        }
        
        function doLogin() {
            const val = document.getElementById('admin-name-input').value.trim();
            if(!val) return alert("Vui lòng nhập tên!");
            localStorage.setItem('admin_name', val);
            document.getElementById('modal-login').classList.add('hidden');
            location.reload(); 
        }
        
        // Ensure input exists before adding listener (it should)
        const loginInput = document.getElementById('admin-name-input');
        if(loginInput) {
            loginInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') doLogin();
            });
        }

        async function lockAccountPool() {
            const admin = localStorage.getItem('admin_name');
            if(!admin) return alert("Bạn chưa đăng nhập!");
            
            const raw = document.getElementById('pool-input').value;
            const parts = raw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
            
            const msg = parts.length === 0 
                ? "Bạn có chắc muốn TRẢ HẾT account đang giữ?" 
                : `Bạn muốn giành quyền quản lý ${parts.length} tài khoản này?\n(${parts.join(', ')})`;
                
            if(!confirm(msg)) return;
            
            try {
                const res = await fetch('/api', {method: 'POST', body: JSON.stringify({
                    action: 'lock_account_pool', 
                    admin: admin,
                    indexes: parts
                })});
                const data = await res.json();
                if(data.success) {
                    alert(data.message);
                    loadAccounts(); 
                } else {
                    alert("Lỗi: " + data.message);
                }
            } catch(e) { alert("Lỗi kết nối: " + e); }
        }

        // ============================================================
        // CHECK & UPLOAD FEATURE
        // ============================================================
        let checkResults = [];  // Store last check result for upload
        let checkCache = {};    // Cache check results by story id

        async function loadCheckCache() {
            try {
                const res = await fetch('/api', { method: 'POST', body: JSON.stringify({ action: 'load_check_cache' }) });
                const data = await res.json();
                if (data.success) checkCache = data.cache || {};
            } catch(e) { console.warn('[CheckCache]', e); }
        }

        async function saveCheckCache() {
            try {
                const res = await fetch('/api', { method: 'POST', body: JSON.stringify({ action: 'save_check_cache', cache: checkCache }) });
                const data = await res.json();
                showToast(data.success ? '💾 Đã lưu!' : '❌ Lưu thất bại', data.success ? 'green' : 'red');
            } catch(e) { showToast('❌ ' + e.message, 'red'); }
        }

        function removeCuRow(id) {
            const row = document.getElementById(`cu-row-${id}`);
            if (row) row.remove();
            checkResults = checkResults.filter(r => r.id !== id);
            const remaining = document.querySelectorAll('[id^="cu-row-"]').length;
            document.getElementById('cu-subtitle').innerText = `${remaining} truyện được chọn`;
            if (remaining === 0) closeModal('modal-check-upload');
        }

        async function saveOneCheckResult(storyId) {
            if (!checkCache[storyId]) return;
            try {
                await fetch('/api', { method: 'POST', body: JSON.stringify({ action: 'save_one_check_cache', story_id: storyId, entry: checkCache[storyId] }) });
                showToast('💾 Đã lưu!', 'green');
            } catch(e) { showToast('❌ ' + e.message, 'red'); }
        }

        function openCheckUploadModal() {
            const checked = document.querySelectorAll('.story-ck:checked');
            if (checked.length === 0) return alert('Chưa chọn truyện nào!');

            // Reset UI
            checkResults = [];
            document.getElementById('cu-summary').classList.add('hidden');
            document.getElementById('cu-upload-progress').classList.add('hidden');
            document.getElementById('btn-do-upload-warn').classList.add('hidden');
            document.getElementById('btn-do-upload-ok').classList.add('hidden');
            document.getElementById('cu-status-msg').innerText = '';
            document.getElementById('cu-progress-log').innerHTML = '';

            const ids = Array.from(checked).map(c => parseInt(c.value));
            const titles = Array.from(checked).map(c => {
                const row = c.closest('tr');
                const titleEl = row ? row.querySelector('td:nth-child(2) a') : null;
                return titleEl ? titleEl.innerText.trim() : `ID ${c.value}`;
            });

            // Show selected stories pending check
            const listEl = document.getElementById('cu-story-list');
            listEl.innerHTML = '';
            ids.forEach((id, i) => {
                const div = document.createElement('div');
                div.id = `cu-row-${id}`;
                div.className = 'flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-2.5 border border-white/5';
                div.innerHTML = `
                    <span class="text-slate-500 text-[10px] font-mono w-8 text-right">#${id}</span>
                    <span class="flex-1 text-sm font-bold text-slate-300 truncate">${titles[i]}</span>
                    <span id="cu-status-${id}" class="text-[10px] font-bold text-slate-500 italic">Chờ kiểm tra...</span>
                    <button onclick="removeCuRow(${id})" title="Bỏ chọn" class="text-slate-600 hover:text-red-400 text-xs px-1.5 py-0.5 rounded border border-slate-700 hover:border-red-500 font-bold">✕</button>
                `;
                listEl.appendChild(div);
            });

            document.getElementById('cu-subtitle').innerText = `${ids.length} truyện được chọn`;
            pauseAutoRefresh = true;
            document.getElementById('modal-check-upload').classList.remove('hidden');
        }

        async function doCheckContent() {
            const checked = document.querySelectorAll('.story-ck:checked');
            if (checked.length === 0) { closeModal('modal-check-upload'); return; }

            const ids = Array.from(checked).map(c => parseInt(c.value));
            const minChars = parseInt(document.getElementById('cu-min-chars').value) || 500;

            // Reset state
            checkResults = [];
            document.getElementById('cu-summary').classList.add('hidden');
            document.getElementById('btn-do-upload-warn').classList.add('hidden');
            document.getElementById('btn-do-upload-ok').classList.add('hidden');
            document.getElementById('btn-save-check').classList.add('hidden');
            document.getElementById('cu-status-msg').innerText = 'Đang kiểm tra...';
            Array.from(document.querySelectorAll('.story-ck:checked')).forEach(c => { delete checkCache[parseInt(c.value)]; });

            const spinner = document.getElementById('cu-check-spinner');
            const btn = document.getElementById('btn-do-check');
            spinner.classList.remove('hidden');
            btn.disabled = true;

            // Reset all row statuses
            ids.forEach(id => {
                const el = document.getElementById(`cu-status-${id}`);
                if (el) el.innerHTML = `<span class="text-slate-500 italic">Đang quét...</span>`;
                const row = document.getElementById(`cu-row-${id}`);
                if (row) row.className = 'flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-2.5 border border-white/5';
            });

            try {
                const res = await fetch('/api', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'check_upload_content', ids: ids, min_chars: minChars })
                });
                const data = await res.json();

                if (!data.success) throw new Error(data.message);

                checkResults = data.results;
                let countOk = 0, countWarn = 0, countErr = 0;

                data.results.forEach(r => {
                    const statusEl = document.getElementById(`cu-status-${r.id}`);
                    const rowEl = document.getElementById(`cu-row-${r.id}`);
                    
                    const hasGap = r.missing_indexes && r.missing_indexes.length > 0;
                    const hasContentErr = r.error_chapters && r.error_chapters.length > 0;
                    const isEmpty = r.total_files === 0;

                    let statusHTML = '';
                    let rowClass = 'flex items-center gap-3 rounded-lg px-4 py-2.5 border ';

                    if (isEmpty) {
                        // Critical: no files at all
                        countErr++;
                        statusHTML = `<span class="text-red-400 font-bold">❌ Không có file nào!</span>`;
                        rowClass += 'bg-red-900/20 border-red-500/30';
                    } else if (hasGap || hasContentErr) {
                        countWarn++;
                        let parts = [];
                        if (hasGap) {
                            const gapStr = r.missing_indexes.slice(0, 10).join(', ') + (r.missing_indexes.length > 10 ? ` ... (+${r.missing_indexes.length - 10})` : '');
                            parts.push(`<div class="mt-1.5 text-amber-300 text-[10px]">⚠ Thiếu index: <span class="font-mono font-bold">${gapStr}</span></div>`);
                        }
                        if (hasContentErr) {
                            r.error_chapters.forEach(ec => {
                                const label = ec.chars === 0 ? '❌ Trống' : `⚠ ${ec.chars} ký tự`;
                                const color = ec.chars === 0 ? 'text-red-400' : 'text-amber-400';
                                parts.push(`<div class="mt-0.5 ${color} text-[10px] font-mono">→ [${ec.index.toString().padStart(4,'0')}] ${ec.title.substring(0,40)} — <span class="font-bold">${label}</span></div>`);
                            });
                        }

                        // Expand row to show detail
                        const rowFull = document.getElementById(`cu-row-${r.id}`);
                        if (rowFull) {
                            rowFull.className = 'rounded-lg px-4 py-3 border bg-amber-900/10 border-amber-500/25';
                            const titleEl = rowFull.querySelector('.flex-1');
                            const okBadge = `<span class="text-[10px] text-slate-400 ml-2">${r.total_files} file | delta: ${r.delta} chương cần upload</span>`;
                            rowFull.innerHTML = `
                                <div class="flex items-center gap-3">
                                    <span class="text-slate-500 text-[10px] font-mono w-8 text-right">#${r.id}</span>
                                    <span class="flex-1 text-sm font-bold text-amber-300 truncate">${r.title}${okBadge}</span>
                                    <span class="text-amber-400 text-[10px] font-bold uppercase">⚠ Cần kiểm tra</span>
                                    <button onclick="openStoryFolder(${r.id})" title="Mở thư mục" class="text-slate-500 hover:text-teal-400 text-sm px-1">📁</button>
                                    <button onclick="saveOneCheckResult(${r.id}); this.disabled=true; this.innerText='✓ Đã lưu';" title="Lưu kết quả check" class="text-[9px] px-2 py-0.5 rounded border border-teal-700 text-teal-400 hover:bg-teal-900/30 font-bold">💾 Lưu</button>
                                    <button onclick="removeCuRow(${r.id})" title="Bỏ khỏi danh sách" class="text-[9px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-500 font-bold">✕</button>
                                </div>
                                <div class="ml-11 mt-1 space-y-0.5">${parts.join('')}</div>
                            `;
                        }
                        return;
                    } else {
                        countOk++;
                        statusHTML = `<span class="text-green-400 font-bold">✅ OK — delta: ${r.delta} chương</span>
                                      <button onclick="saveOneCheckResult(${r.id}); this.disabled=true; this.innerText='✓ Đã lưu';" title="Lưu kết quả check" class="ml-2 text-[9px] px-2 py-0.5 rounded border border-teal-700 text-teal-400 hover:bg-teal-900/30 font-bold">💾 Lưu</button>`;
                        rowClass += 'bg-green-900/10 border-green-500/20';
                    }

                    if (statusEl) statusEl.innerHTML = statusHTML;
                    if (rowEl) rowEl.className = rowClass;
                });

                // Summary
                document.getElementById('cu-stat-total').innerText = data.results.length;
                document.getElementById('cu-stat-ok').innerText = countOk;
                document.getElementById('cu-stat-warn').innerText = countWarn;
                document.getElementById('cu-stat-err').innerText = countErr;
                document.getElementById('cu-summary').classList.remove('hidden');

                // Build checkCache từ kết quả
                data.results.forEach(r => {
                    const hg = r.missing_indexes && r.missing_indexes.length > 0;
                    const he = r.error_chapters && r.error_chapters.length > 0;
                    const ie = r.total_files === 0;
                    if (hg || he || ie) {
                        let summary = [];
                        if (hg) summary.push('Thiếu index: ' + r.missing_indexes.slice(0,5).join(',') + (r.missing_indexes.length>5?'...':''));
                        if (he) summary.push(r.error_chapters.length + ' chương lỗi');
                        if (ie) summary.push('Không có file');
                        checkCache[r.id] = { status: ie ? 'error' : 'warn', label: ie ? 'LỖI' : 'CẦN KIỂM TRA', summary: summary.join(' | '), checked_at: new Date().toISOString() };
                    }
                });
                document.getElementById('btn-save-check').classList.remove('hidden');

                // Decide which upload button to show
                const okCount   = checkResults.filter(r => r.delta > 0 && r.total_files > 0 && r.missing_indexes.length === 0 && r.error_chapters.length === 0).length;
                const warnCount = checkResults.filter(r => r.delta > 0 && r.total_files > 0 && ((r.missing_indexes && r.missing_indexes.length > 0) || (r.error_chapters && r.error_chapters.length > 0))).length;

                if (countErr === 0 && countWarn === 0) {
                    // Tất cả OK → chỉ hiện Upload
                    document.getElementById('btn-do-upload-ok').classList.remove('hidden');
                    document.getElementById('btn-do-upload-warn').classList.add('hidden');
                    document.getElementById('cu-status-msg').innerText = `✅ Tất cả OK. Sẵn sàng upload ${checkResults.filter(r=>r.delta>0).reduce((a,r)=>a+r.delta,0)} chương mới.`;
                } else {
                    // Có cảnh báo:
                    // - Nút "Upload" → chỉ upload truyện OK (nếu có)
                    // - Nút "Vẫn Upload" → upload truyện bị cảnh báo
                    if (okCount > 0) {
                        document.getElementById('btn-do-upload-ok').classList.remove('hidden');
                    } else {
                        document.getElementById('btn-do-upload-ok').classList.add('hidden');
                    }
                    if (warnCount > 0) {
                        document.getElementById('btn-do-upload-warn').classList.remove('hidden');
                    } else {
                        document.getElementById('btn-do-upload-warn').classList.add('hidden');
                    }
                    if (countErr > 0) {
                        document.getElementById('cu-status-msg').innerText = `❌ ${countErr} truyện không có file. ⚠ ${warnCount} truyện cần kiểm tra. ✅ ${okCount} truyện sẵn sàng.`;
                    } else {
                        document.getElementById('cu-status-msg').innerText = `✅ ${okCount} truyện sẵn sàng upload. ⚠ ${warnCount} truyện cần kiểm tra (dùng "Vẫn Upload" để bỏ qua lỗi).`;
                    }
                }

            } catch(e) {
                document.getElementById('cu-status-msg').innerText = '❌ Lỗi: ' + e.message;
            } finally {
                spinner.classList.add('hidden');
                btn.disabled = false;
            }
        }

        async function doUpload(skipErrors) {
            if (checkResults.length === 0) return alert('Hãy CHECK trước khi upload!');

            const webUrl = document.getElementById('cu-web-url').value.trim().replace(/\/$/, '');
            const secret = document.getElementById('cu-secret').value.trim();
            if (!webUrl) return alert('Chưa nhập Web App URL!');
            if (!secret) return alert('Chưa nhập Secret Key!');

            // Hide buttons, show progress
            document.getElementById('btn-do-upload-ok').classList.add('hidden');
            document.getElementById('btn-do-upload-warn').classList.add('hidden');
            document.getElementById('btn-do-check').disabled = true;
            document.getElementById('cu-upload-progress').classList.remove('hidden');

            const logEl = document.getElementById('cu-progress-log');
            const barEl = document.getElementById('cu-progress-bar');
            const pctEl = document.getElementById('cu-progress-pct');
            const labelEl = document.getElementById('cu-progress-label');
            logEl.innerHTML = '';

            const addLog = (msg, color='text-slate-400') => {
                const d = document.createElement('div');
                d.className = color;
                d.innerText = msg;
                logEl.appendChild(d);
                logEl.scrollTop = logEl.scrollHeight;
            };

            const storiesToUpload = checkResults.filter(r => {
                if (r.total_files === 0 || r.delta <= 0) return false;
                const hasWarn = (r.missing_indexes && r.missing_indexes.length > 0) || (r.error_chapters && r.error_chapters.length > 0);
                if (skipErrors) {
                    return hasWarn; // Nút "Vẫn Upload" → chỉ chạy truyện bị cảnh báo
                } else {
                    return !hasWarn; // Nút "Upload" → chỉ chạy truyện OK
                }
            });
            let done = 0;

            for (const story of storiesToUpload) {
                const batchSize = parseInt(document.getElementById('cu-batch-size').value) || 50;
                const totalBatches = Math.ceil(story.delta / batchSize);
                labelEl.innerText = `Upload: ${story.title}`;
                addLog(`▶ Bắt đầu: ${story.title} (${story.delta} chương | ${totalBatches} batch)`);

                try {
                    const res = await fetch('/api', {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'do_upload',
                            story_id: story.id,
                            web_url: webUrl,
                            secret: secret,
                            skip_errors: skipErrors,
                            min_chars: parseInt(document.getElementById('cu-min-chars').value) || 500,
                            batch_size: batchSize
                        })
                    });
                    const result = await res.json();

                    if (result.success) {
                        // Hiển thị log từng batch từ Python
                        if (result.batch_logs && result.batch_logs.length > 0) {
                            result.batch_logs.forEach(log => addLog(log.msg, log.ok ? 'text-green-400' : 'text-red-400'));
                        }
                        addLog(`  🎯 Hoàn tất: ${result.inserted} chương — ${story.title}`, 'text-teal-400 font-bold');
                        const statusEl = document.getElementById(`cu-status-${story.id}`);
                        if (statusEl) statusEl.innerHTML = `<span class="text-green-400 font-bold">✅ Đã upload ${result.inserted} chương</span>`;
                    } else {
                        addLog(`  ❌ Lỗi: ${result.message} — ${story.title}`, 'text-red-400');
                    }
                } catch(e) {
                    addLog(`  ❌ Kết nối thất bại: ${e.message}`, 'text-red-400');
                }

                done++;
                const pct = Math.round((done / storiesToUpload.length) * 100);
                barEl.style.width = pct + '%';
                pctEl.innerText = pct + '%';
            }

            labelEl.innerText = `Hoàn tất! ${done}/${storiesToUpload.length} truyện đã xử lý.`;
            addLog(`\n🎉 Upload hoàn tất.`, 'text-teal-400 font-bold');
            document.getElementById('btn-do-check').disabled = false;
            loadStories();
        }



        async function openStoryFolder(storyId) {
            await fetch('/api', {
                method: 'POST',
                body: JSON.stringify({ action: 'open_story_folder', id: storyId })
            });
        }

        window.onload = () => {
            checkLogin();
            loadCategories();
            loadCheckCache().then(() => loadStories());
        };
        let foundUpdates = [];
        async function scanUpdates() {
            const btn = document.getElementById('btn-scan-update');
            const status = document.getElementById('scan-status');
            const spinner = document.getElementById('scan-spinner');
            
            btn.disabled = true; spinner.classList.remove('hidden');
            status.innerText = "Đang khởi động tiến trình quét...";
            
            try {
                const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'scan_updates'})});
                const data = await res.json();
                if(data.success) {
                    status.innerText = "Scanner is running... Please wait...";
                    pollUpdateStatus();
                } else {
                    alert('Error starting scan');
                    resetScanUI();
                }
            } catch(e) { resetScanUI(); }
        }
        
        async function pollUpdateStatus() {
             const status = document.getElementById('scan-status');
             const interval = setInterval(async () => {
                 try {
                     const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'check_update_status'})});
                     const data = await res.json();
                     
                     if (data.status === 'finished') {
                         clearInterval(interval);
                         resetScanUI();
                         renderUpdates(data.results);
                         status.innerText = `Hoàn tất. Tìm thấy ${data.results.length} truyện có chương mới.`;
                     } else {
                         status.innerText = "Đang quét... (" + new Date().toLocaleTimeString() + ")";
                     }
                 } catch(e) { clearInterval(interval); resetScanUI(); }
             }, 2000);
        }
        
        function resetScanUI() {
            document.getElementById('btn-scan-update').disabled = false;
            document.getElementById('scan-spinner').classList.add('hidden');
        }
        
        let ongoingStories = []; // Stores the full list from DB
        let scanResultsMap = {}; // Stores scan results by ID

        async function loadUpdateList() {
            const statusDiv = document.getElementById('scan-status');
            statusDiv.innerText = "Đang tải danh sách truyện...";
            try {
                const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'get_ongoing'})});
                const data = await res.json();
                if(data.success) {
                    ongoingStories = data.stories;
                    statusDiv.innerText = `Danh sách: ${ongoingStories.length} truyện.`;
                    renderUpdateTable();
                } else {
                     statusDiv.innerText = "Lỗi tải API: " + JSON.stringify(data);
                    console.error("API Error: ", data);
                }
            } catch(e) {
                statusDiv.innerText = "Lỗi kết nối: " + e;
                console.error("Fetch Error: ", e);
            }
        }

        function renderUpdateTable() {
             const tbody = document.getElementById('update-list');
             const empty = document.getElementById('update-empty');
             const btnQueue = document.getElementById('btn-queue-update'); // Get the button here
             tbody.innerHTML = '';
             
             if (ongoingStories.length === 0) {
                 empty.classList.remove('hidden');
                 btnQueue.classList.add('hidden'); // Hide button if no stories
                 return;
             }
             empty.classList.add('hidden');
             
             let updatesFound = 0; // Track if any updates are found to show/hide queue button
             
             ongoingStories.forEach(s => {
                 const update = scanResultsMap[s.id];
                 const hasUpdate = update && update.diff > 0;
                 const isChecked = hasUpdate; // Auto-check if update found
                 
                 if (hasUpdate) updatesFound++;
                 
                 const tr = document.createElement('tr');
                 tr.className = hasUpdate ? "bg-green-900/30 border-b border-green-700/50" : "border-b border-white/5 opacity-70";
                 
                 tr.innerHTML = `
                    <td class="p-3"><input type="checkbox" class="update-ck" value="${s.id}" ${isChecked ? 'checked' : ''} ${hasUpdate ? '' : 'disabled'}></td>
                    <td class="p-3">
                        <div class="font-bold text-slate-200">${s.title}</div>
                        <div class="text-[10px] text-slate-500">${s.source} | ${s.book_status}</div>
                    </td>
                    <td class="p-3 text-right font-mono">
                        <div class="text-slate-400">DB: ${s.chapters}</div> 
                    </td>
                    <td class="p-3 text-right font-mono">
                         ${hasUpdate ? `<div class="text-green-400 font-bold">New: ${update.new_chapters} (+${update.diff})</div>` : '<span class="text-slate-600">--</span>'}
                    </td>
                 `;
                 if(hasUpdate) {
                     // Store full update data attached to checkbox value for later retrieval? 
                     // No, better to use the map in addUpdateQueue
                 }
                 tbody.appendChild(tr);
             });
             
             // Show/hide queue button based on updatesFound
             if (updatesFound > 0) {
                 btnQueue.innerText = `ĐẨY ${updatesFound} TRUYỆN VÀO HÀNG ĐỢI`;
                 btnQueue.disabled = false;
                 btnQueue.classList.remove('hidden');
             } else {
                 btnQueue.classList.add('hidden');
             }
        }

        function renderUpdates(items) {
            // items is the list of results from check_update.py
            scanResultsMap = {};
            items.forEach(item => {
                scanResultsMap[item.id] = item;
            });
            renderUpdateTable(); // Re-render with new data
            
            // Re-enable queue button if any updates
            if (items.length > 0) {
                 const btnQueue = document.getElementById('btn-queue-update');
                 btnQueue.innerText = `ĐẨY ${items.length} TRUYỆN VÀO HÀNG ĐỢI`;
                 btnQueue.disabled = false;
                 btnQueue.classList.remove('hidden');
            }
        }
        
        function toggleAllUpdates(checked) {
            document.querySelectorAll('.update-ck').forEach(c => c.checked = checked);
        }
        
        async function addUpdateQueue() {
            const checkboxes = document.querySelectorAll('.update-ck:checked');
            if (checkboxes.length === 0) return alert("Chưa chọn truyện nào!");
            
            const selectedItems = Array.from(checkboxes).map(c => scanResultsMap[parseInt(c.value)]);
            const btn = document.getElementById('btn-queue-update');
            btn.innerText = "Processing..."; btn.disabled = true;
            
            try {
                const res = await fetch('/api', {method: 'POST', body: JSON.stringify({action: 'apply_updates', items: selectedItems})});
                const data = await res.json();
                alert(`Đã cập nhật ${data.updated} truyện vào hàng đợi!`);
                btn.classList.add('hidden');
                document.getElementById('update-list').innerHTML = '';
                document.getElementById('update-empty').classList.remove('hidden');
            } catch(e) { alert("Lỗi: " + e); }
            finally {
                btn.innerText = "ĐẨY VÀO HÀNG ĐỢI (QUEUE SELECTED)"; btn.disabled = false;
            }
        }

    </script>
</body>
</html>
"""

def save_pids(pids):
    try:
        with open(os.path.join(BASE_DIR, 'scraper_pids.json'), 'w') as f:
            json.dump(list(set(pids)), f)
    except: pass

def load_pids():
    try:
        path = os.path.join(BASE_DIR, 'scraper_pids.json')
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
    except: pass
    return []

def staggered_startup_worker(account_indexes, admin_name):
    global SCRAPER_PIDS
    python_exe = sys.executable
    
    conn = None
    try:
        conn = get_db_connection()
        if not conn: return
        cursor = conn.cursor(dictionary=True)
        
        # Load existing pids to avoid losing them
        existing_pids = load_pids()
        SCRAPER_PIDS = list(set(SCRAPER_PIDS + existing_pids))

        for idx in account_indexes:
            if os.path.exists('stop.signal'): 
                 break
            
            cmd = [python_exe, SCRAPER_SCRIPT, str(idx), '--admin', admin_name]
            print(f"[STAGGERED] CMD: {' '.join(cmd)}")
            proc = subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE, cwd=BASE_DIR)
            SCRAPER_PIDS.append(proc.pid)
            save_pids(SCRAPER_PIDS)
            
            if idx != account_indexes[-1]:
                start_wait = time.time()
                target_story_id = None
                initial_chapters = -1
                
                while time.time() - start_wait < 120:
                    if os.path.exists('stop.signal'): break
                    
                    if not target_story_id:
                        cursor.execute("SELECT id, downloaded_chapters FROM stories WHERE last_account_idx = %s AND crawl_status = 'crawling'", (idx,))
                        row = cursor.fetchone()
                        if row:
                            target_story_id = row['id']
                            initial_chapters = row['downloaded_chapters'] or 0
                        else:
                            time.sleep(2); continue
                    else:
                        cursor.execute("SELECT downloaded_chapters, crawl_status FROM stories WHERE id = %s", (target_story_id,))
                        row = cursor.fetchone()
                        if not row: break
                        if row['crawl_status'] != 'crawling' or (row['downloaded_chapters'] or 0) > initial_chapters:
                            break
                        time.sleep(3)
    except Exception as e:
        print(f"[STAGGERED] Global Error: {e}")
    finally:
        if conn: conn.close()

class ManageHandler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        import datetime
        def json_serial(obj):
            if isinstance(obj, (datetime.datetime, datetime.date)):
                return obj.isoformat()
            raise TypeError(f"Type {type(obj)} not serializable")
        self.wfile.write(json.dumps(data, default=json_serial, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/':
            self.send_response(200); self.send_header('Content-type', 'text/html; charset=utf-8'); self.end_headers()
            self.wfile.write(HTML_TEMPLATE.encode('utf-8'))
        elif self.path.startswith('/api'):
            parsed = urllib.parse.urlparse(self.path); params = urllib.parse.parse_qs(parsed.query)
            action = params.get('action', [None])[0]
            conn = get_db_connection()
            if not conn:
                try: self._send_json({"error": "DB connection failed", "stories": [], "total": 0, "page": 1, "total_pages": 1, "stats": {"queue":0,"running":0,"my_queue":0}})
                except: pass
                return
            try:
                cursor = conn.cursor(dictionary=True)
                if action == 'list':
                    search = params.get('search', [''])[0]; status = params.get('status', [''])[0]; page = int(params.get('page', [1])[0])
                    limit = 50; offset = (page-1)*limit
                    where = []; args = []
                    if search: where.append("(title LIKE %s OR slug LIKE %s)"); args.extend([f"%{search}%", f"%{search}%"])
                    if status: where.append("crawl_status = %s"); args.append(status)
                    category_filter = params.get('category', [''])[0]
                    if category_filter: where.append("category = %s"); args.append(category_filter)
                    book_status = params.get('book_status', [''])[0]
                    if book_status == 'Full': where.append("book_status = 'Full'")
                    elif book_status == 'Ongoing': where.append("book_status != 'Full'")
                    where_str = " WHERE " + " AND ".join(where) if where else ""
                    try: 
                        # Auto-cleanup stale 'crawling' tasks (> 10 mins) to keep 'Running' count accurate
                        cursor.execute("UPDATE stories SET crawl_status = 'paused' WHERE crawl_status = 'crawling' AND last_updated < NOW() - INTERVAL 10 MINUTE AND downloaded_chapters > 0")
                        cursor.execute("UPDATE stories SET crawl_status = 'selected' WHERE crawl_status = 'crawling' AND last_updated < NOW() - INTERVAL 10 MINUTE AND downloaded_chapters = 0")
                        cursor.execute("UPDATE stories SET crawl_status = 'completed' WHERE mapped_count > 0 AND downloaded_chapters = mapped_count AND crawl_status != 'completed'")
                        conn.commit()
                    except: pass
                    
                    order_clause = "ORDER BY CASE WHEN chapters > 0 AND downloaded_chapters >= chapters THEN 1 ELSE 0 END ASC, CASE crawl_status WHEN 'repairing' THEN 0 WHEN 'crawling' THEN 1 WHEN 'paused' THEN 2 WHEN 'selected' THEN 3 WHEN 'pending' THEN 4 WHEN 'error' THEN 5 WHEN 'completed' THEN 6 ELSE 7 END ASC, last_updated DESC"
                    cursor.execute(f"SELECT * FROM stories {where_str} {order_clause} LIMIT %s OFFSET %s", args + [limit, offset])
                    stories = cursor.fetchall()
                    cursor.execute(f"SELECT COUNT(*) as total FROM stories {where_str}", args)
                    total = cursor.fetchone()['total']
                    cursor.execute("SELECT COUNT(*) as q FROM stories WHERE crawl_status IN ('selected', 'repairing')")
                    q_count = cursor.fetchone()['q']
                    cursor.execute("SELECT COUNT(*) as r FROM stories WHERE crawl_status = 'crawling'")
                    r_count = cursor.fetchone()['r']
                    req_admin = params.get('admin', [None])[0]
                    q_mine = 0
                    if req_admin:
                        cursor.execute("SELECT COUNT(*) as qm FROM stories WHERE crawl_status IN ('selected', 'repairing') AND admin_control = %s", (req_admin,))
                        q_mine = cursor.fetchone()['qm']
                    self._send_json({"stories": stories, "total": total, "page": page, "total_pages": (total // limit) + 1 if total > 0 else 1, "stats": {"queue": q_count, "running": r_count, "my_queue": q_mine}})
                elif action == 'get_categories':
                    cursor.execute("SELECT DISTINCT category FROM stories WHERE category IS NOT NULL ORDER BY category")
                    cats = cursor.fetchall(); self._send_json({"categories": [c['category'] for c in cats]})
                elif action == 'get_accounts':
                    try:
                        with open('accounts.txt', 'r', encoding='utf-8') as f: raw_data = [l.strip() for l in f if '|' in l and not l.strip().startswith('#')]
                    except: raw_data = []
                    cursor.execute("SELECT account_email, locked_by FROM scraper_accounts_status")
                    lock_map = {row['account_email']: row['locked_by'] for row in cursor.fetchall()}
                    accounts = [{"index": i + 1, "email": line.split('|')[0], "locked_by": lock_map.get(line.split('|')[0])} for i, line in enumerate(raw_data)]
                    self._send_json({"accounts": accounts})
            except Exception as e:
                print(f"[!] do_GET error: {e}")
                try: self._send_json({"error": str(e), "stories": [], "total": 0, "page": 1, "total_pages": 1, "stats": {"queue":0,"running":0,"my_queue":0}})
                except: pass
            finally:
                try: conn.close()
                except: pass

    def do_POST(self):
        content_length = int(self.headers['Content-Length']); post_data = self.rfile.read(content_length); data = json.loads(post_data.decode('utf-8'))
        action = data.get('action')
        conn = get_db_connection()
        if not conn:
            try: self._send_json({"success": False, "message": "DB connection failed, thử lại sau"})
            except: pass
            return
        try:
            cursor = conn.cursor(dictionary=True)
            if action == 'start_scraper':
                admin = data.get('admin'); account_indexes = data.get('accounts', [])
                thread_limit = int(data.get('threads', len(account_indexes)))
                
                # SLICE account_indexes to respect the thread limit
                if len(account_indexes) > thread_limit:
                    print(f"[*] Thread Limit detected ({thread_limit}). Truncating pool from {len(account_indexes)} to {thread_limit}")
                    account_indexes = account_indexes[:thread_limit]
                
                if os.path.exists('stop.signal'): os.remove('stop.signal')
                threading.Thread(target=staggered_startup_worker, args=(account_indexes, admin)).start()
                self._send_json({"success": True, "message": f"Starting {len(account_indexes)} workers..."})
            elif action == 'kill_scrapers':
                 global SCRAPER_PIDS
                 with open('stop.signal', 'w') as f: f.write('STOP')
                 all_pids = list(set(SCRAPER_PIDS + load_pids()))
                 for pid in all_pids:
                     try: subprocess.run(f"taskkill /PID {pid} /F /T", shell=True, capture_output=True)
                     except: pass
                 SCRAPER_PIDS = []
                 if os.path.exists(os.path.join(BASE_DIR, 'scraper_pids.json')): os.remove(os.path.join(BASE_DIR, 'scraper_pids.json'))
                 try:
                     subprocess.run("taskkill /F /IM chromedriver.exe /T", shell=True, capture_output=True)
                     subprocess.run("taskkill /F /FI \"WINDOWTITLE eq pd_scraper_fast-v1.py*\" /T", shell=True, capture_output=True)
                 except: pass
                 cursor.execute("UPDATE stories SET crawl_status='paused' WHERE crawl_status='crawling' AND downloaded_chapters > 0")
                 cursor.execute("UPDATE stories SET crawl_status='selected' WHERE crawl_status='crawling' AND downloaded_chapters = 0")
                 self._send_json({"success": True, "message": "All scrapers killed."})
            elif action == 'lock_account_pool':
                admin = data.get('admin'); indexes = data.get('indexes', [])
                cursor.execute("UPDATE scraper_accounts_status SET locked_by = NULL WHERE locked_by = %s", (admin,))
                if indexes:
                    try:
                        with open('accounts.txt', 'r', encoding='utf-8') as f: raw_lines = [l.strip() for l in f if '|' in l and not l.strip().startswith('#')]
                    except: raw_lines = []
                    for idx in indexes:
                        if 1 <= idx <= len(raw_lines):
                            email = raw_lines[idx-1].split('|')[0]
                            cursor.execute("INSERT INTO scraper_accounts_status (account_email, account_index, locked_by) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE locked_by = VALUES(locked_by), last_heartbeat = CURRENT_TIMESTAMP", (email, idx, admin))
                self._send_json({"success": True})
            elif action == 'toggle_select':
                sid = data.get('id'); is_selected = data.get('selected'); admin = data.get('admin')
                cursor.execute("SELECT crawl_status, downloaded_chapters, admin_control FROM stories WHERE id = %s", (sid,))
                row = cursor.fetchone()
                if row:
                    if is_selected: cursor.execute("UPDATE stories SET crawl_status = 'selected', admin_control = %s WHERE id = %s", (admin, sid))
                    else:
                        new_status = 'paused' if (row['downloaded_chapters'] or 0) > 0 else 'pending'
                        cursor.execute("UPDATE stories SET crawl_status = %s, admin_control = NULL WHERE id = %s", (new_status, sid))
                self._send_json({"success": True})
            elif action == 'batch_toggle_select':
                ids = data.get('ids', []); is_selected = data.get('selected'); admin = data.get('admin')
                for sid in ids:
                    if is_selected: cursor.execute("UPDATE stories SET crawl_status = 'selected', admin_control = %s WHERE id = %s", (admin, sid))
                    else: cursor.execute("UPDATE stories SET crawl_status = CASE WHEN downloaded_chapters > 0 THEN 'paused' ELSE 'pending' END, admin_control = NULL WHERE id = %s", (sid,))
                self._send_json({"success": True})
            elif action == 'sync_selected':
                ids = data.get('ids', []); count = 0
                for sid in ids:
                    s, m = perform_sync(sid)
                    if s: count += 1
                self._send_json({"success": True, "message": f"Synced {count} stories."})
            elif action == 'crawl_missing':
                ids = data.get('ids', [])
                for sid in ids: cursor.execute("UPDATE stories SET crawl_status = 'repairing' WHERE id = %s", (sid,))
                self._send_json({"success": True})
            elif action == 'submit_discovery':
                url = data.get('url', ''); source = data.get('source', 'PD')
                if os.path.exists('discovery_conflicts.json'): os.remove('discovery_conflicts.json')
                with open('discovery.lock', 'w') as f: f.write('running')
                subprocess.Popen([sys.executable, DISCOVERY_SCRIPT, '--url', url, '--source', source], creationflags=subprocess.CREATE_NEW_CONSOLE, cwd=BASE_DIR)
                self._send_json({"success": True})
            elif action == 'check_discovery':
                finished = os.path.exists('discovery_conflicts.json')
                if finished:
                    try:
                        with open('discovery_conflicts.json', 'r', encoding='utf-8') as f: res = json.load(f)
                        self._send_json({"status": "finished", "results": res})
                    except: self._send_json({"status": "finished", "results": {"new": 0, "conflicts": []}})
                else: self._send_json({"status": "running"})
            elif action == 'resolve_conflicts':
                updates = data.get('updates', []); count = 0
                for item in updates:
                    f = item.get('full_data')
                    if f:
                        cursor.execute("UPDATE stories SET views=%s, likes=%s, chapters=%s, book_status=%s, cover_url=%s, rating=%s, source=%s WHERE slug=%s", (f.get('views'), f.get('likes'), f.get('chapters'), f.get('book_status'), f.get('cover_url'), f.get('rating'), f.get('source','PD'), f.get('slug')))
                        count += 1
                self._send_json({"success": True, "updated": count})
            elif action == 'scan_updates':
                if os.path.exists('update_results.json'): os.remove('update_results.json')
                subprocess.Popen([sys.executable, CHECK_UPDATE_SCRIPT], creationflags=subprocess.CREATE_NEW_CONSOLE, cwd=BASE_DIR)
                self._send_json({"success": True})
            elif action == 'check_update_status':
                if os.path.exists('update_results.json'):
                    try:
                        with open('update_results.json', 'r', encoding='utf-8') as f:
                            c = f.read().strip()
                            if c.startswith('[') and c.endswith(']'): self._send_json({"status": "finished", "results": json.loads(c)}); return
                    except: pass
                self._send_json({"status": "running"})
            elif action == 'apply_updates':
                items = data.get('items', [])
                for item in items: cursor.execute("UPDATE stories SET chapters=%s, crawl_status='selected' WHERE id=%s", (item.get('new_chapters'), item.get('id')))
                self._send_json({"success": True})
            elif action == 'get_ongoing':
                cursor.execute("SELECT id, title, source, chapters, downloaded_chapters, book_status FROM stories WHERE book_status != 'Full' ORDER BY last_updated DESC")
                res = [dict(s) for s in cursor.fetchall()]; self._send_json({"success": True, "stories": res})

            elif action == 'load_check_cache':
                cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'check_cache.json')
                try:
                    cache = {}
                    if os.path.exists(cache_path):
                        with open(cache_path, 'r', encoding='utf-8') as cf:
                            cache = json.load(cf)
                        cache = {int(k): v for k, v in cache.items()}
                    self._send_json({"success": True, "cache": cache})
                except Exception as e:
                    self._send_json({"success": False, "cache": {}, "message": str(e)})

            elif action == 'save_check_cache':
                cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'check_cache.json')
                try:
                    cache = data.get('cache', {})
                    with open(cache_path, 'w', encoding='utf-8') as cf:
                        json.dump(cache, cf, ensure_ascii=False, indent=2)
                    self._send_json({"success": True})
                except Exception as e:
                    self._send_json({"success": False, "message": str(e)})

            elif action == 'save_one_check_cache':
                cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'check_cache.json')
                try:
                    cache = {}
                    if os.path.exists(cache_path):
                        with open(cache_path, 'r', encoding='utf-8') as cf:
                            cache = json.load(cf)
                    cache[str(data.get('story_id'))] = data.get('entry', {})
                    with open(cache_path, 'w', encoding='utf-8') as cf:
                        json.dump(cache, cf, ensure_ascii=False, indent=2)
                    self._send_json({"success": True})
                except Exception as e:
                    self._send_json({"success": False, "message": str(e)})

            elif action == 'reset_upload':
                import urllib.request as _ureq
                sid     = data.get('story_id')
                web_url = data.get('web_url', '').rstrip('/')
                secret  = data.get('secret', '')

                cursor.execute("SELECT slug, title FROM stories WHERE id = %s", (sid,))
                row = cursor.fetchone()
                if not row:
                    self._send_json({"success": False, "message": "Không tìm thấy truyện"}); return

                slug  = row['slug']
                title = row['title']
                errors = []

                # 1. Gọi API DELETE trên web
                try:
                    req_del = _ureq.Request(
                        f"{web_url}/api/admin/stories/{slug}",
                        headers={'X-Upload-Secret': secret},
                        method='DELETE'
                    )
                    with _ureq.urlopen(req_del, timeout=15) as r:
                        result = json.loads(r.read().decode('utf-8'))
                        if not result.get('success'):
                            errors.append(result.get('message', 'unknown'))
                except Exception as e:
                    errors.append(str(e))
                    print(f"[Reset] Web delete error: {e}")

                # 2. Luôn reset uploaded_chapters về 0
                cursor.execute("UPDATE stories SET uploaded_chapters = 0 WHERE id = %s", (sid,))
                print(f"[Reset] Reset uploaded_chapters for story id={sid}")

                msg = f"Đã xóa '{title}' trên web và reset upload!" if not errors else f"Reset local OK. Web báo lỗi: {'; '.join(errors)}"
                self._send_json({"success": True, "message": msg})

            elif action == 'open_story_folder':
                sid = data.get('id')
                cursor.execute("SELECT slug FROM stories WHERE id = %s", (sid,))
                row = cursor.fetchone()
                if row:
                    folder = os.path.join(IMPORT_DIR, row['slug'])
                    if not os.path.exists(folder):
                        os.makedirs(folder, exist_ok=True)
                    subprocess.Popen(f'explorer "{folder}"', shell=True)
                self._send_json({"success": True})

            # ============================================================
            # CHECK UPLOAD CONTENT
            # ============================================================
            elif action == 'check_upload_content':
                ids = data.get('ids', [])
                min_chars = int(data.get('min_chars', 500))
                results = []

                for sid in ids:
                    cursor.execute("SELECT id, title, slug, chapters, downloaded_chapters, uploaded_chapters FROM stories WHERE id = %s", (sid,))
                    row = cursor.fetchone()
                    if not row:
                        results.append({"id": sid, "title": f"ID {sid}", "total_files": 0, "delta": 0,
                                        "missing_indexes": [], "error_chapters": [], "error": "Không tìm thấy truyện trong DB"})
                        continue

                    slug = row['slug']
                    title = row['title']
                    uploaded_idx = int(row.get('uploaded_chapters') or 0)
                    story_dir = os.path.join(IMPORT_DIR, slug)

                    if not os.path.exists(story_dir):
                        results.append({"id": sid, "title": title, "slug": slug, "total_files": 0,
                                        "delta": 0, "missing_indexes": [], "error_chapters": [],
                                        "error": f"Thư mục không tồn tại: {slug}"})
                        continue

                    # Scan all .txt files and extract real index
                    file_map = {}  # index -> filepath
                    for fname in os.listdir(story_dir):
                        m = re.search(r'_(\d+)\.txt$', fname)
                        if m:
                            idx = int(m.group(1))
                            file_map[idx] = os.path.join(story_dir, fname)

                    if not file_map:
                        results.append({"id": sid, "title": title, "slug": slug, "total_files": 0,
                                        "delta": 0, "missing_indexes": [], "error_chapters": []})
                        continue

                    all_indexes = sorted(file_map.keys())
                    max_index = max(all_indexes)
                    min_index = min(all_indexes)

                    # Delta: files with index > uploaded_idx
                    delta_indexes = [i for i in all_indexes if i > uploaded_idx]

                    # Find missing indexes in the delta range (gap detection)
                    if delta_indexes:
                        expected = set(range(min(delta_indexes), max(delta_indexes) + 1))
                        existing = set(delta_indexes)
                        missing_indexes = sorted(expected - existing)
                    else:
                        missing_indexes = []

                    # Check content quality - chỉ dùng filesize, không đọc file
                    error_chapters = []
                    for idx in delta_indexes:
                        fpath = file_map[idx]
                        fname = os.path.basename(fpath)
                        chapter_title = re.sub(r'_\d+\.txt$', '', fname).strip()
                        try:
                            fsize = os.path.getsize(fpath)
                            if fsize < min_chars * 2:
                                error_chapters.append({"index": idx, "title": chapter_title, "chars": fsize // 2})
                        except Exception as e:
                            error_chapters.append({"index": idx, "title": chapter_title, "chars": -1, "error": str(e)})

                    results.append({
                        "id": sid,
                        "title": title,
                        "slug": slug,
                        "total_files": len(all_indexes),
                        "delta": len(delta_indexes),
                        "uploaded_so_far": uploaded_idx,
                        "max_index": max_index,
                        "missing_indexes": missing_indexes,
                        "error_chapters": error_chapters
                    })

                self._send_json({"success": True, "results": results})

            # ============================================================
            # DO UPLOAD
            # ============================================================
            elif action == 'do_upload':
                import urllib.request
                sid = data.get('story_id')
                web_url = data.get('web_url', '').rstrip('/')
                secret = data.get('secret', '')
                skip_errors = data.get('skip_errors', False)
                min_chars = int(data.get('min_chars', 500))
                BATCH_SIZE = max(10, min(200, int(data.get('batch_size', 50))))
                print(f"[DO_UPLOAD] sid={sid} | web_url={web_url} | batch_size={BATCH_SIZE}")

                cursor.execute("SELECT * FROM stories WHERE id = %s", (sid,))
                row = cursor.fetchone()
                if not row:
                    print(f"[DO_UPLOAD] Truyện {sid} không tồn tại")
                    self._send_json({"success": False, "message": "Truyện không tồn tại"}); return

                slug = row['slug']
                uploaded_idx = int(row.get('uploaded_chapters') or 0)
                story_dir = os.path.join(IMPORT_DIR, slug)
                print(f"[DO_UPLOAD] slug={slug} | uploaded_idx={uploaded_idx} | story_dir={story_dir}")

                if not os.path.exists(story_dir):
                    print(f"[DO_UPLOAD] Thư mục không tồn tại: {story_dir}")
                    self._send_json({"success": False, "message": f"Thư mục {slug} không tồn tại"}); return

                # Build file map
                file_map = {}
                for fname in os.listdir(story_dir):
                    m = re.search(r'_(\d+)\.txt$', fname)
                    if m:
                        idx = int(m.group(1))
                        file_map[idx] = os.path.join(story_dir, fname)

                # Only delta chapters
                delta_keys = sorted([k for k in file_map if k > uploaded_idx])
                print(f"[DEBUG] story_dir: {story_dir}")
                print(f"[DEBUG] total files in map: {len(file_map)}")
                print(f"[DEBUG] uploaded_idx: {uploaded_idx}")
                print(f"[DEBUG] delta_keys count: {len(delta_keys)}")
                print(f"[DEBUG] delta sample: {delta_keys[:5]} ... {delta_keys[-5:] if len(delta_keys)>5 else ''}")
                if not delta_keys:
                    self._send_json({"success": True, "inserted": 0, "last_index": uploaded_idx,
                                     "message": f"Không có chương mới. Dir={story_dir} | Files={len(file_map)} | uploaded_idx={uploaded_idx}"}); return

                # Build chapters payload — skip error chapters if skip_errors=False
                chapters_payload = []
                skipped = 0

                # Tìm các index bị thiếu trong delta range → tạo placeholder
                if delta_keys:
                    full_range = set(range(delta_keys[0], delta_keys[-1] + 1))
                    missing_indexes = sorted(full_range - set(delta_keys))
                    for missing_idx in missing_indexes:
                        chapters_payload.append({
                            "index":   missing_idx,
                            "title":   f"Chương {missing_idx}",
                            "content": "Bị mất chương, cập nhật sau, mong các đạo hữu thông cảm."
                        })

                for idx in delta_keys:
                    fpath = file_map[idx]
                    fname = os.path.basename(fpath)
                    # Bỏ _index.txt ở cuối để lấy title gốc, giữ nguyên phần còn lại
                    chapter_title = re.sub(r'_\d+\.txt$', '', fname).strip()

                    try:
                        with open(fpath, 'r', encoding='utf-8') as f:
                            txt = f.read().strip()
                        txt = clean_chapter_content(txt)
                    except:
                        skipped += 1; continue

                    if len(txt) < min_chars and not skip_errors:
                        skipped += 1; continue

                    chapters_payload.append({
                        "index": idx,
                        "title": chapter_title,
                        "content": txt
                    })

                # Sắp xếp lại theo index sau khi thêm placeholder
                chapters_payload.sort(key=lambda x: x["index"])

                # --- Lấy thông tin truyện (chỉ cần 1 lần) ---
                cover_web_url       = None
                cover_url_src       = ''
                scraped_author      = ''
                scraped_categories  = []
                scraped_description = ''

                # Ưu tiên 1: metadata.json
                metadata_path = os.path.join(story_dir, 'metadata.json')
                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r', encoding='utf-8') as mf:
                            meta = json.load(mf)
                            cover_url_src = meta.get('cover_url', '') or meta.get('cover', '') or ''
                    except: pass

                # Ưu tiên 2: scrape từ trang nguồn (1 lần duy nhất)
                if row.get('url'):
                    try:
                        import urllib.parse
                        story_url = row['url']
                        req0 = urllib.request.Request(story_url, headers={
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        })
                        with urllib.request.urlopen(req0, timeout=15) as r0:
                            html = r0.read().decode('utf-8', errors='ignore')

                        if not cover_url_src:
                            m = re.search(r'url=(https?%3A%2F%2F[^&"\']+(?:cover|thumb)[^&"\']*)', html)
                            if m:
                                cover_url_src = urllib.parse.unquote(m.group(1))

                        m_author = re.search(r'href="/tac-gia/[^"]*">([^<]+)</a>', html)
                        if m_author:
                            scraped_author = m_author.group(1).strip()

                        scraped_categories = re.findall(r'href="/the-loai/[^"]*">([^<]+)</a>', html)

                        m_desc = re.search(r'class="whitespace-pre-line">(.*?)</div>', html, re.DOTALL)
                        if m_desc:
                            scraped_description = re.sub(r'<[^>]+>', '', m_desc.group(1)).strip()

                        print(f"[Scrape] Author={scraped_author} | Categories={scraped_categories} | Cover={'OK' if cover_url_src else 'N/A'}")
                    except Exception as e:
                        print(f"[Scrape] Lỗi: {e}")

                # Upload cover (1 lần)
                if cover_url_src and cover_url_src.startswith('http'):
                    try:
                        import io
                        cover_req = urllib.request.Request(cover_url_src, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(cover_req, timeout=15) as r:
                            img_bytes = r.read()
                        try:
                            from PIL import Image
                            img = Image.open(io.BytesIO(img_bytes))
                            img_buf = io.BytesIO()
                            img.save(img_buf, format='WebP', quality=85)
                            img_bytes_final = img_buf.getvalue()
                            img_ext = 'webp'; img_mime = 'image/webp'
                        except:
                            img_bytes_final = img_bytes
                            img_ext = 'jpg'; img_mime = 'image/jpeg'

                        boundary = b'----PDCrawBoundary'
                        body = b''.join([
                            b'--' + boundary + b'\r\n',
                            f'Content-Disposition: form-data; name="file"; filename="{slug}.{img_ext}"\r\n'.encode(),
                            f'Content-Type: {img_mime}\r\n\r\n'.encode(),
                            img_bytes_final,
                            b'\r\n--' + boundary + b'--\r\n'
                        ])
                        cover_req2 = urllib.request.Request(
                            f"{web_url}/api/upload", data=body,
                            headers={'Content-Type': f'multipart/form-data; boundary={boundary.decode()}',
                                     'X-Upload-Secret': secret, 'Content-Length': str(len(body))},
                            method='POST'
                        )
                        with urllib.request.urlopen(cover_req2, timeout=30) as r2:
                            cover_web_url = json.loads(r2.read().decode('utf-8')).get('url', cover_url_src)
                    except Exception as e:
                        cover_web_url = cover_url_src
                        print(f"[Cover] Lỗi upload: {e}")

                import random
                story_payload = {
                    "title":        row['title'],
                    "slug":         slug,
                    "author":       scraped_author or "",
                    "category":     ", ".join(scraped_categories) if scraped_categories else (row.get('category') or ''),
                    "description":  scraped_description or "",
                    "cover_url":    cover_web_url or cover_url_src or '',
                    "book_status":  row.get('book_status') or 'Ongoing',
                    "view_count":   random.randint(4000, 6000),
                    "like_count":   random.randint(70,   200),
                    "follow_count": random.randint(200,  500),
                }

                # Loop toàn bộ batch, trả về batch_logs để JS hiển thị
                total_inserted = 0
                last_ok_index  = uploaded_idx
                batch_logs     = []
                total_batches  = (len(chapters_payload) + BATCH_SIZE - 1) // BATCH_SIZE

                for i in range(0, len(chapters_payload), BATCH_SIZE):
                    batch    = chapters_payload[i:i+BATCH_SIZE]
                    batch_no = i // BATCH_SIZE + 1
                    payload_bytes = json.dumps({"story": story_payload, "chapters": batch}, ensure_ascii=False).encode('utf-8')

                    try:
                        parsed_url = urllib.parse.urlparse(web_url)
                        host       = parsed_url.hostname
                        port       = parsed_url.port
                        path       = parsed_url.path.rstrip('/') + '/api/admin/stories'
                        use_https  = parsed_url.scheme == 'https'

                        if use_https:
                            conn_http = http.client.HTTPSConnection(host, port or 443, timeout=60)
                        else:
                            conn_http = http.client.HTTPConnection(host, port or 80, timeout=60)

                        headers_http = {
                            'Content-Type':    'application/json; charset=utf-8',
                            'X-Upload-Secret': urllib.parse.quote(secret, safe=''),
                            'Content-Length':  str(len(payload_bytes)),
                        }
                        conn_http.request('POST', path, body=payload_bytes, headers=headers_http)
                        resp = conn_http.getresponse()
                        resp_body = resp.read().decode('utf-8')
                        conn_http.close()
                        if resp.status not in (200, 201):
                            raise Exception(f"HTTP {resp.status}: {resp_body[:200]}")
                        result = json.loads(resp_body)
                        inserted   = result.get('inserted', len(batch))
                        total_inserted += inserted
                        batch_max  = max(c['index'] for c in batch)
                        last_ok_index = batch_max

                        cursor.execute(
                            "UPDATE stories SET uploaded_chapters = %s, last_updated = CURRENT_TIMESTAMP WHERE id = %s",
                            (last_ok_index, sid)
                        )
                        batch_logs.append({"ok": True,  "msg": f"  ✅ Batch {batch_no}/{total_batches} — +{inserted} chương (tổng: {total_inserted})"})
                    except Exception as e:
                        batch_logs.append({"ok": False, "msg": f"  ❌ Batch {batch_no} lỗi: {e}"})
                        print(f"[Upload] Batch {batch_no} lỗi: {e}")
                        break

                self._send_json({
                    "success":    True,
                    "inserted":   total_inserted,
                    "skipped":    skipped,
                    "last_index": last_ok_index,
                    "batch_logs": batch_logs
                })
        except Exception as e: self._send_json({"success": False, "message": str(e)})
        finally: conn.close()

def split_sentences_in_paragraph(para: str) -> str:
    """Tach cau trong 1 doan van, tra ve cac cau noi lai bang \\n."""
    import re as _re
    UPPER = r'[A-ZAĂÂÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴĐ]'
    if not para or len(para) < 10:
        return para
    sentences = []
    current = ''
    i = 0
    while i < len(para):
        ch = para[i]
        current += ch
        if ch == '.':
            prev = para[i-1] if i > 0 else ''
            # Bo qua neu truoc la so: 1.000, 3.14
            if prev.isdigit():
                i += 1
                continue
            # Bo qua neu la ky tu don truoc dau cham: A.I, Dr.
            stripped = current.rstrip('.')
            if stripped and stripped.split() and len(stripped.split()[-1]) == 1 and stripped.split()[-1][0].isupper():
                i += 1
                continue
            rest = para[i+1:]
            m = _re.match(r'^(\s+)(' + UPPER + r')', rest)
            if m:
                sentences.append(current.strip())
                current = ''
                i += 1 + len(m.group(1))
                continue
        elif ch in ('!', '?'):
            # Chi tach neu cau du dai (>= 35 ky tu)
            if len(current.strip()) >= 35:
                rest = para[i+1:]
                m = _re.match(r'^(\s+)(' + UPPER + r')', rest)
                if m:
                    sentences.append(current.strip())
                    current = ''
                    i += 1 + len(m.group(1))
                    continue
        i += 1
    if current.strip():
        sentences.append(current.strip())
    return '\n'.join(sentences) if sentences else para


def apply_sentence_split(text: str) -> str:
    """Ap dung tach cau cho toan bo noi dung chuong."""
    paragraphs = text.split('\n')
    result = []
    for para in paragraphs:
        if para.strip():
            result.append(split_sentences_in_paragraph(para))
        else:
            result.append(para)
    return '\n'.join(result)


def clean_chapter_content(text):
    """Lam sach: bo Index, title chuong, separator, note dich gia, quang cao, dong trong thua"""
    import re as _re
    skip_patterns = [
        r'^Chương\s+\d+[:\s]',
        r'^Index:\s*\d+\s*$',
        r'^[–—-]+\s*$',
        r'^\[.*\]\s*$',
        r'^_{3,}\s*$', r'^-{3,}\s*$', r'^\*{3,}\s*$',
        r'^(Editor|Translator|TL|Dich|Bien tap|Biên tập)\s*[::.]',
        r'^Nguon\s*[::]', r'^https?://',
        r'tangthuvien\.vn|truyenfull|metruyencv|wattpad|truyenphuongdong',
        r'Chào mừng.*sang quyển',
    ]
    compiled = [_re.compile(p, _re.IGNORECASE) for p in skip_patterns]
    out = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        if any(p.search(s) for p in compiled):
            continue
        out.append(s)
    cleaned = '\n'.join(out).strip()
    # Ap dung tach cau sau khi lam sach
    return apply_sentence_split(cleaned)


def perform_sync(story_id):
    """
    Scans the data_import directory for the story's slug,
    counts actual files, finds max chapter number,
    and updates the database.
    """
    try:
        conn = get_db_connection()
        if not conn: return False, "DB Connection Failed"
        cursor = conn.cursor(dictionary=True)
        
        # Get slug
        cursor.execute("SELECT slug, chapters FROM stories WHERE id = %s", (story_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False, "Story not found"
        
        slug = row['slug']
        web_chapters = row['chapters'] or 0
        
        story_dir = os.path.join(IMPORT_DIR, slug)
        
        # 1. CALCULATE MAPPED COUNT FROM JSON
        mapped_count = web_chapters # Default fallback
        map_path = os.path.join(story_dir, "menu_map_v1.json")
        has_map_file = os.path.exists(map_path)
        
        if has_map_file:
             try:
                 with open(map_path, 'r', encoding='utf-8') as f:
                     data = json.load(f)
                     if data:
                         # Keys are string indices "1", "2"...
                         indices = [int(k) for k in data.keys() if k.isdigit()]
                         if indices: mapped_count = max(indices)
             except: pass

        if not os.path.exists(story_dir):
            # No directory -> 0 chapters
            cursor.execute("UPDATE stories SET downloaded_chapters = 0, actual_chapters = 0, mapped_count = %s, last_updated = CURRENT_TIMESTAMP WHERE id = %s", (mapped_count, story_id))
            conn.close()
            return True, "Dir not found"
            
        # Scan files
        files = [f for f in os.listdir(story_dir) if f.endswith('.txt')]
        actual_count = len(files)
        
        max_chap = 0
        for f in files:
            # Try parsing "Chapter_123.txt" or "chuong_123.txt"
            # Filename might be title based, so this is tricky if not standardized.
            # But earlier logic uses `safe_title` which comes from `chap_title`.
            # If standard scraping was used: "Chapter_123.txt" or similar.
            # Strategy: Extract first number found in filename?
            # Update Logic: Check for suffix index first (e.g. ..._0187.txt)
            # This is the "Real Index" from scraper v3+
            match = re.search(r'_(\d+)\.txt$', f)
            if match:
                num = int(match.group(1))
                if num > max_chap: max_chap = num
            else:
                 # Fallback for old files: First number found
                 match_old = re.search(r'(\d+)', f)
                 if match_old:
                     num = int(match_old.group(1))
                     if num > max_chap: max_chap = num
        
        # fallback: if max_chap is 0 but files exist, maybe use count?
        # But user wants "tiến độ là lấy số chương cao nhất".
        if max_chap == 0 and actual_count > 0:
            max_chap = actual_count # Best guess if naming is weird
            
        # If no menu map could be parsed, fallback mapped_count to web_chapters
        if not has_map_file:
             mapped_count = web_chapters
             
        # Nếu trạng thái đang là completed nhưng đồng bộ lại thấy chap < web_chapters thì chuyển về paused
        cursor.execute("SELECT crawl_status FROM stories WHERE id = %s", (story_id,))
        row_status = cursor.fetchone()
        if row_status and row_status['crawl_status'] == 'completed' and max_chap < web_chapters:
            cursor.execute("UPDATE stories SET crawl_status = 'paused' WHERE id = %s", (story_id,))
            
        cursor.execute("UPDATE stories SET downloaded_chapters = %s, actual_chapters = %s, mapped_count = %s, last_updated = CURRENT_TIMESTAMP WHERE id = %s", (max_chap, actual_count, mapped_count, story_id))
        conn.close()
        return True, f"Synced: Max {max_chap}"
        
    except Exception as e:
        print(f"Sync error for {story_id}: {e}")
        return False, str(e)



def cleanup_on_startup():
    print("[*] Cleaning up stuck tasks...")
    try:
        conn = get_db_connection()
        if not conn: return
        cursor = conn.cursor()
        # Reset 'crawling' -> 'paused' (if has chapters) or 'selected' (if new)
        # Actually safer to just set to 'paused' manually or 'selected' manually?
        # Let's mirror kill logic:
        # 1. Crawling + >0 chapters -> Paused
        cursor.execute("UPDATE stories SET crawl_status='paused' WHERE crawl_status='crawling' AND downloaded_chapters > 0")
        # 2. Crawling + 0 chapters -> Selected
        cursor.execute("UPDATE stories SET crawl_status='selected' WHERE crawl_status='crawling' AND downloaded_chapters = 0")
        conn.close()
    except Exception as e: print(f"  [!] Cleanup error: {e}")

def init_db():
    # No longer creating SQLite file, just ensuring MariaDB is ready (handled by migration script)
    print("[*] Verifying MariaDB Connection...")
    conn = get_db_connection()
    if conn:
        print("  [+] MariaDB is ONLINE.")
        # Auto-migrate: add uploaded_chapters column if not exists
        try:
            cur = conn.cursor()
            cur.execute("""
                ALTER TABLE stories 
                ADD COLUMN IF NOT EXISTS uploaded_chapters INT DEFAULT 0
            """)
            conn.commit()
            print("  [+] Column 'uploaded_chapters' verified.")
        except Exception as e:
            print(f"  [!] Migration warning: {e}")
        conn.close()
    else:
        print("  [!] MariaDB is OFFLINE. Please check server status.")

if __name__ == "__main__":
    try:
        init_db()  # Initialize schema first
        cleanup_on_startup()
        
        # IP Display
        hostname = socket.gethostname()
        try:
            lan_ip = socket.gethostbyname(hostname)
        except: lan_ip = "Unknown"

        print(f"[*] TruyenPhuongDong Admin started on PORT {PORT}")
        print(f"    - Local:   http://127.0.0.1:{PORT}")
        print(f"    - LAN:     http://{lan_ip}:{PORT} (Use this IP from other machines)")
        # Listen on all interfaces
        server = ThreadingHTTPServer(('0.0.0.0', PORT), ManageHandler)
        server.serve_forever()
    except Exception as e:
        print(f"[!] Critical Launch Error: {e}")
        input("Press Enter to exit...")
    except KeyboardInterrupt:
        pass
