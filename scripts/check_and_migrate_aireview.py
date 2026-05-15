"""
check_and_migrate_aireview.py
─────────────────────────────
Bước 1: Kết nối Neon Postgres của webtruyen-app, in cấu trúc bảng "Story"
Bước 2: Thêm cột aiReview TEXT nếu chưa có (idempotent — chạy nhiều lần cũng an toàn)

Chạy:
    pip install psycopg2-binary python-dotenv
    python scripts/check_and_migrate_aireview.py

Hoặc truyền DATABASE_URL thủ công:
    python scripts/check_and_migrate_aireview.py --url "postgresql://..."
"""

import argparse
import os
import sys

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit('[!] Thiếu psycopg2. Chạy: pip install psycopg2-binary')

# ── Lấy DATABASE_URL ──────────────────────────────────────────────────────────
def get_database_url(cli_url: str = '') -> str:
    if cli_url:
        return cli_url

    # Thử đọc từ .env.local hoặc .env (cùng thư mục gốc project)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir   = os.path.dirname(script_dir)  # webtruyen-app/

    for env_file in ['.env.local', '.env']:
        path = os.path.join(root_dir, env_file)
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('DATABASE_URL='):
                        url = line.split('=', 1)[1].strip().strip('"').strip("'")
                        print(f'  Dùng DATABASE_URL từ: {env_file}')
                        return url

    # Thử biến môi trường
    url = os.environ.get('DATABASE_URL', '')
    if url:
        print('  Dùng DATABASE_URL từ biến môi trường.')
        return url

    sys.exit('[!] Không tìm thấy DATABASE_URL. Dùng --url hoặc set biến môi trường.')


# ── In cấu trúc bảng ──────────────────────────────────────────────────────────
def print_table_structure(cur, table_name: str):
    cur.execute("""
        SELECT
            ordinal_position,
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    cols = cur.fetchall()

    if not cols:
        print(f'  [!] Không tìm thấy bảng "{table_name}" trong DB.')
        return

    print(f'\n{"═"*65}')
    print(f'  TABLE: "{table_name}"  ({len(cols)} cột)')
    print(f'{"═"*65}')
    print(f'  {"#":<4} {"Tên cột":<28} {"Kiểu dữ liệu":<20} {"NULL?":<6} {"Default"}')
    print(f'  {"─"*60}')
    for c in cols:
        dtype   = c['data_type']
        maxlen  = f'({c["character_maximum_length"]})' if c['character_maximum_length'] else ''
        null    = 'YES' if c['is_nullable'] == 'YES' else 'NO '
        default = c['column_default'] or ''
        if len(default) > 30:
            default = default[:27] + '...'
        print(f'  {c["ordinal_position"]:<4} {c["column_name"]:<28} {dtype+maxlen:<20} {null:<6} {default}')
    print(f'{"═"*65}')


# ── Migration: thêm cột aiReview ─────────────────────────────────────────────
def migrate_add_aireview(cur, conn):
    # Kiểm tra cột đã tồn tại chưa
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'Story'
          AND column_name  = 'aiReview'
    """)
    exists = cur.fetchone()

    if exists:
        print('\n  [✓] Cột "aiReview" đã tồn tại — không cần làm gì thêm.')
        return False

    print('\n  → Đang thêm cột "aiReview" TEXT vào bảng "Story"...')
    cur.execute('ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "aiReview" TEXT')
    conn.commit()
    print('  [✓] Đã thêm cột "aiReview" thành công!')
    return True


# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Kiểm tra DB và migrate aiReview')
    parser.add_argument('--url',      type=str, default='', help='DATABASE_URL (nếu không set trong .env)')
    parser.add_argument('--check-only', action='store_true', help='Chỉ xem cấu trúc, không migrate')
    args = parser.parse_args()

    print('\n' + '='*65)
    print('  webtruyen-app — DB Structure Check & Migration')
    print('='*65)

    db_url = get_database_url(args.url)

    print(f'\n  Đang kết nối Neon Postgres...')
    try:
        conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor, connect_timeout=10)
        conn.autocommit = False
        cur = conn.cursor()
        print('  [✓] Kết nối thành công!')
    except Exception as e:
        sys.exit(f'  [!] Kết nối thất bại: {e}')

    # ── Bước 1: In cấu trúc bảng Story ──────────────────────────────────────
    print('\n[BƯỚC 1] Cấu trúc bảng "Story" hiện tại:')
    print_table_structure(cur, 'Story')

    # ── Bước 2: Migration ────────────────────────────────────────────────────
    if not args.check_only:
        print('\n[BƯỚC 2] Migration — thêm cột aiReview:')
        try:
            changed = migrate_add_aireview(cur, conn)
        except Exception as e:
            conn.rollback()
            sys.exit(f'  [!] Migration thất bại: {e}')

        if changed:
            # In lại cấu trúc sau khi migrate
            print('\n[KẾT QUẢ] Cấu trúc bảng "Story" sau khi migrate:')
            print_table_structure(cur, 'Story')
    else:
        print('\n  [--check-only] Bỏ qua migration.')

    cur.close()
    conn.close()
    print('\n  Done.\n')


if __name__ == '__main__':
    main()
