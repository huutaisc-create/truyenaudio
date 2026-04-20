#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
crawl_missing.py — Crawl chương bị thiếu cho một truyện cụ thể.

Usage:
    python crawl_missing.py --slug "ten-truyen" --url "https://truyenphuongdong.com/sach/..." \
                            --missing "302,303,304,305,1740" --stories-dir "D:\\data"

- Không dùng profile cố định — mở Chrome mới, login, crawl, đóng.
- Login lấy từ accounts.txt (dòng đầu tiên).
- Lưu file vào {stories_dir}/{slug}/
- Log ra stdout (review.py đọc qua subprocess pipe).
"""

import os, sys, re, json, time, argparse
from pathlib import Path

# ── stdout UTF-8 ──────────────────────────────────────────────────────────────
import io
from datetime import datetime
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

def log(msg, tag=''):
    ts = datetime.now().strftime('%H:%M:%S')
    prefix = f"[{tag}] " if tag else ""
    print(f"[{ts}] {prefix}{msg}", flush=True)

def log_sep(title=''):
    bar = '─' * 50
    if title:
        print(f"\n┌{bar}", flush=True)
        print(f"│  {title}", flush=True)
        print(f"└{bar}", flush=True)
    else:
        print(f"{'─'*52}", flush=True)

# ── Selenium imports ──────────────────────────────────────────────────────────
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.common.keys import Keys
    from selenium.common.exceptions import TimeoutException
    from webdriver_manager.chrome import ChromeDriverManager
    from bs4 import BeautifulSoup
except ImportError as e:
    log(f"[!] Thiếu thư viện: {e}")
    log("    pip install selenium webdriver-manager beautifulsoup4")
    sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER — không dùng profile, mở Chrome mới hoàn toàn
# ══════════════════════════════════════════════════════════════════════════════

def setup_driver():
    import socket, tempfile
    def free_port():
        with socket.socket() as s:
            s.bind(('', 0))
            return s.getsockname()[1]

    options = Options()
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                         'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--start-maximized')
    options.add_argument('--disable-notifications')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)

    service = Service(ChromeDriverManager().install(), port=free_port())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver


# ══════════════════════════════════════════════════════════════════════════════
# LOGIN
# ══════════════════════════════════════════════════════════════════════════════

def login(driver, accounts_file: Path):
    """Đăng nhập bằng dòng đầu của accounts.txt. Trả True nếu thành công."""
    if not accounts_file.exists():
        log(f"Không tìm thấy {accounts_file}", '✗')
        return False

    lines = [l.strip() for l in accounts_file.read_text(encoding='utf-8').splitlines()
             if '|' in l and not l.startswith('#')]
    if not lines:
        log("accounts.txt trống hoặc sai format (cần email|password)", '✗')
        return False

    email, password = lines[0].split('|', 1)
    log(f"Đăng nhập với: {email}", 'LOGIN')

    driver.get("https://truyenphuongdong.com/login")
    time.sleep(3)

    try:
        btn = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[aria-label="Đóng"]'))
        )
        btn.click(); time.sleep(1)
    except: pass

    if '/user' in driver.current_url:
        log("Đã đăng nhập sẵn ✓", 'LOGIN')
        return True

    try:
        user_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='email'],input[name='username']"))
        )
        pass_input = driver.find_element(By.CSS_SELECTOR, "input[name='password']")
        user_input.clear(); user_input.send_keys(email)
        pass_input.clear(); pass_input.send_keys(password)
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        WebDriverWait(driver, 30).until(EC.url_contains('/user'))
        log("Đăng nhập thành công ✓", 'LOGIN')
        return True
    except Exception as e:
        log(f"Đăng nhập thất bại: {e}", '✗')
        return False


# ══════════════════════════════════════════════════════════════════════════════
# MENU MAP
# ══════════════════════════════════════════════════════════════════════════════

def load_or_scan_menu(driver, story_dir: Path, slug: str) -> dict:
    map_file = story_dir / 'menu_map_v1.json'
    if map_file.exists():
        data = json.loads(map_file.read_text(encoding='utf-8'))
        log(f"Đã có menu map: {len(data)} chương ✓", 'MENU')
        return data

    log("Chưa có menu map — bắt đầu scan...", 'MENU')
    menu_map = scan_menu(driver, map_file)
    return menu_map or {}


def scan_menu(driver, map_file: Path) -> dict:
    try:
        menu_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='menu']"))
        )
        menu_btn.click(); time.sleep(2)
    except:
        log("  [!] Không mở được menu.")
        return {}

    try:
        container = driver.find_element(By.CSS_SELECTOR, ".dark-scrollbar")
    except:
        log("  [!] Không tìm thấy scroll container.")
        return {}

    driver.execute_script("arguments[0].scrollTop = 0", container)
    time.sleep(1)

    collected = []
    current_scroll = 0
    total_height = driver.execute_script("return arguments[0].scrollHeight", container)
    stagnant = 0

    while True:
        buttons = container.find_elements(By.TAG_NAME, "button")
        visible = [b.text.strip() for b in buttons if b.text.strip()]

        if not collected:
            collected.extend(visible)
        elif visible:
            max_overlap = 0
            for ov in range(min(len(collected), len(visible)), 0, -1):
                if collected[-ov:] == visible[:ov]:
                    max_overlap = ov; break
            collected.extend(visible[max_overlap:])

        if current_scroll >= total_height:
            new_h = driver.execute_script("return arguments[0].scrollHeight", container)
            if new_h > total_height:
                total_height = new_h; stagnant = 0
            else:
                stagnant += 1
                if stagnant >= 3: break
            time.sleep(1); continue

        driver.execute_script("arguments[0].scrollBy(0, 800)", container)
        current_scroll += 800
        pct = min(100, int(current_scroll * 100 / max(total_height, 1)))
        print(f"\r[{datetime.now().strftime('%H:%M:%S')}] [MENU] Scanning... {pct}% | Đã tìm: {len(collected)} chương   ", end='', flush=True)
        time.sleep(0.5)

    menu_map = {str(i+1): t for i, t in enumerate(collected)}
    print(flush=True)
    log(f"Scan xong: {len(menu_map)} chương ✓", 'MENU')

    map_file.parent.mkdir(parents=True, exist_ok=True)
    map_file.write_text(json.dumps(menu_map, ensure_ascii=False, indent=2), encoding='utf-8')

    # Đóng menu
    try: ActionChains(driver).move_by_offset(200, 200).click().perform(); time.sleep(1)
    except: pass

    return menu_map


# ══════════════════════════════════════════════════════════════════════════════
# CRAWL HELPERS (rút gọn từ pd_scraper_fast)
# ══════════════════════════════════════════════════════════════════════════════

def is_saved(story_dir: Path, idx: int) -> bool:
    suffix = f"_{idx:04d}.txt"
    return any(f.endswith(suffix) for f in os.listdir(story_dir))


def save_chapter(story_dir: Path, idx: int, title: str, content: str):
    safe = re.sub(r'[\\/*?:"<>|]', '', title).strip() or f"Chapter_{idx}"
    fname = f"{safe}_{idx:04d}.txt"
    (story_dir / fname).write_text(
        f"{title}\nIndex:{idx}\n\n{content}", encoding='utf-8'
    )


def scrape_by_title(driver, idx: int, menu_map: dict) -> tuple:
    """Duyệt tất cả cặp (title_div, content_div) trong DOM,
    tìm cái có title khớp với menu_map[idx], trả về (title, content).
    DOM lazy-load nên có thể có nhiều chương cùng lúc — phải kiếm đúng cái.
    """
    expected = menu_map.get(str(idx), '').strip().lower()
    try:
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        title_divs   = soup.find_all('div', class_='text-center font-bold')
        content_divs = soup.find_all('div', class_=lambda x: x and 'space-y-[30px]' in x)
        pairs = list(zip(title_divs, content_divs))
        if not pairs:
            return '', ''

        # Tìm cặp khớp với expected title
        if expected:
            for td, cd in pairs:
                t = td.get_text().strip()
                if expected in t.lower() or t.lower() in expected:
                    c = cd.get_text('\n').strip()
                    if len(c) >= 50:
                        return t, c

        # Fallback: lấy cặp đầu tiên có nội dung đủ dài
        for td, cd in pairs:
            c = cd.get_text('\n').strip()
            if len(c) >= 50:
                return td.get_text().strip(), c
    except:
        pass
    return '', ''


def navigate_to(driver, idx: int, menu_map: dict):
    """Mở menu, scroll đến idx, click vào."""
    log(f"  [NAV] Nhảy tới chương {idx}...")
    try:
        try: ActionChains(driver).move_by_offset(10, 10).click().perform()
        except: pass

        menu_btn = WebDriverWait(driver, 8).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='menu']"))
        )
        menu_btn.click(); time.sleep(2)

        container = driver.find_element(By.CSS_SELECTOR, ".dark-scrollbar")
        btn_h = driver.execute_script("""
            const btns = arguments[0].querySelectorAll('button');
            return btns.length >= 2 ? btns[1].offsetTop - btns[0].offsetTop : 35;
        """, container)
        scroll_top = max(0, (idx - 1) * btn_h)
        driver.execute_script("arguments[0].scrollTop = arguments[1]", container, scroll_top)
        time.sleep(1)

        buttons = container.find_elements(By.TAG_NAME, "button")
        target_btn = None
        expected = menu_map.get(str(idx), '').strip()

        # Tìm theo title
        if expected:
            for b in buttons:
                if expected.lower() in b.text.strip().lower():
                    target_btn = b; break

        # Fallback: tìm theo số chương
        if not target_btn:
            for b in buttons:
                if re.search(r'\b' + str(idx) + r'\b', b.text):
                    target_btn = b; break

        if target_btn:
            target_btn.click(); time.sleep(5)
            return True
    except Exception as e:
        log(f"  [!] Nav error: {e}")
    return False


def get_footer_idx(driver):
    try:
        el = driver.find_element(By.CSS_SELECTOR, "div.fixed.bottom-0")
        txt = el.get_attribute("textContent").strip()
        m = re.search(r'Chương\s+(\d+)\s*/\s*(\d+)', txt, re.I)
        if m: return int(m.group(1)), int(m.group(2))
        m = re.search(r'(\d+)\s*/\s*(\d+)', txt)
        if m: return int(m.group(1)), int(m.group(2))
    except: pass
    return None, None


def crawl_one(driver, idx: int, menu_map: dict, story_dir: Path) -> bool:
    """Click đúng menu item → tìm title khớp trong DOM (lazy-load có nhiều chương) → lưu."""
    if is_saved(story_dir, idx):
        log(f"Chương {idx} — đã có sẵn, bỏ qua", '✓')
        return True

    log(f"Chương {idx} — click menu [{menu_map.get(str(idx), '?')}]", 'NAV')
    ok = navigate_to(driver, idx, menu_map)
    if not ok:
        log(f"Chương {idx} — không tìm thấy trong menu", '✗')
        return False

    # Duyệt DOM tìm đúng chương theo title
    fallback_title = menu_map.get(str(idx), f'Chương {idx}')
    title, content = scrape_by_title(driver, idx, menu_map)
    if title and content:
        save_chapter(story_dir, idx, title, content)
        log(f"Chương {idx} — lưu xong ✓  [{title}]", '✓')
        return True

    # Chờ lazy-load thêm rồi thử lại
    log(f"Chương {idx} — chưa thấy trong DOM, chờ thêm 4s...", 'HUNT')
    time.sleep(4)
    title, content = scrape_by_title(driver, idx, menu_map)
    if title and content:
        save_chapter(story_dir, idx, title, content)
        log(f"Chương {idx} — lưu xong (lần 2) ✓  [{title}]", '✓')
        return True

    log(f"Chương {idx} — không tìm được title [{fallback_title}] trong DOM", '✗')
    return False


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def parse_indices(s: str) -> list:
    """Parse '302, 305, 307-320' → [302, 305, 307, 308, ..., 320]"""
    result = set()
    for part in re.split(r'[,\s]+', s.strip()):
        part = part.strip()
        if not part:
            continue
        if '-' in part:
            ab = part.split('-', 1)
            try:
                a, b = int(ab[0]), int(ab[1])
                result.update(range(min(a, b), max(a, b) + 1))
            except ValueError:
                pass
        elif part.isdigit():
            result.add(int(part))
    return sorted(result)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--slug',          required=True)
    parser.add_argument('--url',           required=True)
    parser.add_argument('--stories-dir',   required=True)
    parser.add_argument('--missing',       default='',
                        help='Index cần crawl (VD: 302,305,307-320). Bỏ trống để nhập tương tác.')
    parser.add_argument('--missing-hint',  default='',
                        help='Gợi ý index thiếu (do review.py truyền vào, dùng làm mặc định).')
    args = parser.parse_args()

    # ── Xác định danh sách index ──────────────────────────────────────────────
    if args.missing.strip():
        missing_indices = parse_indices(args.missing)
    else:
        # Nhập tương tác trong cửa sổ CMD
        hint = args.missing_hint.strip()
        print()
        print('┌' + '─' * 54)
        print('│  CRAWL MISSING — nhập index chương cần tải')
        print('│')
        if hint:
            print(f'│  Phát hiện thiếu: {hint}')
            print('│  (Nhấn Enter để dùng danh sách trên)')
        print('│  Hỗ trợ: đơn lẻ (302), nhiều (302,305), khoảng (307-320)')
        print('└' + '─' * 54)
        try:
            user_input = input('  Nhập index > ').strip()
        except (EOFError, KeyboardInterrupt):
            print('\n  Đã hủy.')
            return
        if not user_input and hint:
            user_input = hint
        if not user_input:
            print('  Không có index nào. Thoát.')
            return
        missing_indices = parse_indices(user_input)

    if not missing_indices:
        print('  Không parse được index nào. Thoát.')
        return
    story_dir       = Path(args.stories_dir) / args.slug
    story_dir.mkdir(parents=True, exist_ok=True)

    accounts_file = Path(__file__).parent / 'accounts.txt'
    read_url = args.url.replace('/sach/', '/read/')

    log_sep(f"CRAWL MISSING — {args.slug}")
    log(f"URL đọc : {read_url}", 'INFO')
    log(f"Thư mục : {story_dir}", 'INFO')
    log(f"Cần crawl: {len(missing_indices)} chương — {missing_indices}", 'INFO')
    log_sep()

    driver = None
    start_time = datetime.now()
    try:
        log("Khởi động Chrome...", 'INIT')
        driver = setup_driver()
        log("Chrome đã mở ✓", 'INIT')

        # Login
        if not login(driver, accounts_file):
            log("Không đăng nhập được. Thoát.", '✗')
            return

        # Đến trang đọc
        log(f"Đang tải trang đọc...", 'NAV')
        driver.get(read_url)
        time.sleep(5)
        try:
            b = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[aria-label="Đóng"]'))
            )
            b.click(); time.sleep(1)
        except: pass
        log("Trang đã tải ✓", 'NAV')

        # Menu map
        menu_map = load_or_scan_menu(driver, story_dir, args.slug)
        if not menu_map:
            log("Không có menu map. Thoát.", '✗')
            return

        # Crawl từng chương thiếu
        log_sep("BẮT ĐẦU CRAWL")
        success, failed = [], []
        total = len(missing_indices)

        for i, idx in enumerate(missing_indices, 1):
            log(f"── [{i}/{total}] Xử lý chương {idx} ──────────────", 'CRAWL')
            ok = crawl_one(driver, idx, menu_map, story_dir)
            (success if ok else failed).append(idx)
            pct = int(i * 100 / total)
            log(f"Tiến độ: {i}/{total} ({pct}%) | ✓ {len(success)} | ✗ {len(failed)}", 'PROGRESS')

        elapsed = (datetime.now() - start_time).seconds
        log_sep("KẾT QUẢ")
        log(f"Thời gian  : {elapsed // 60}m {elapsed % 60}s", 'DONE')
        log(f"Thành công : {len(success)}/{total} chương", 'DONE')
        if success: log(f"  → {success}", 'DONE')
        if failed:
            log(f"Thất bại   : {len(failed)} chương — {failed}", 'WARN')
        else:
            log("Tất cả chương đã crawl thành công! 🎉", 'DONE')

    except KeyboardInterrupt:
        log("Dừng bởi người dùng.", 'STOP')
    except Exception as e:
        log(f"Lỗi nghiêm trọng: {e}", '✗')
        import traceback; traceback.print_exc()
    finally:
        if driver:
            try: driver.quit(); log("Chrome đã đóng.", 'INIT')
            except: pass


if __name__ == '__main__':
    main()
