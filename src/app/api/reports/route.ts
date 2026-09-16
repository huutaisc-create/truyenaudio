// src/app/api/reports/route.ts
// Báo cáo nội dung/người dùng — yêu cầu bắt buộc của chính sách UGC Google Play.
// POST tạo báo cáo mới; GET (chỉ admin/moderator) xem hàng đợi kiểm duyệt.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { rateLimit } from '@/lib/rateLimit';

const VALID_TARGET_TYPES = new Set([
  'COMMENT',
  'CHANNEL_POST',
  'CHANNEL_POST_COMMENT',
  'USER',
]);

const VALID_REASONS = new Set([
  'SPAM',
  'SEXUAL',
  'VIOLENCE',
  'HARASSMENT',
  'HATE',
  'OTHER',
]);

const MAX_NOTE_LEN = 500;

// POST /api/reports  body: { targetType, targetId, targetUserId?, reason, note? }
export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Chống spam báo cáo: tối đa 20 lượt / 10 phút / user.
    const rl = rateLimit(`report:${authUser.id}`, 20, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Bạn báo cáo quá nhiều, thử lại sau ít phút.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetType: string = body?.targetType;
    const targetId: string = body?.targetId;
    const targetUserId: string | undefined = body?.targetUserId || undefined;
    const reason: string = body?.reason;
    const note: string | undefined = typeof body?.note === 'string' ? body.note.trim() : undefined;

    if (!VALID_TARGET_TYPES.has(targetType)) {
      return NextResponse.json({ error: 'targetType không hợp lệ' }, { status: 400 });
    }
    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json({ error: 'targetId không hợp lệ' }, { status: 400 });
    }
    if (!VALID_REASONS.has(reason)) {
      return NextResponse.json({ error: 'reason không hợp lệ' }, { status: 400 });
    }
    if (note && note.length > MAX_NOTE_LEN) {
      return NextResponse.json({ error: `Ghi chú tối đa ${MAX_NOTE_LEN} ký tự` }, { status: 400 });
    }

    // targetType === 'USER' → targetId chính là id người bị báo cáo.
    const resolvedTargetUserId = targetType === 'USER' ? targetId : targetUserId;

    const report = await db.report.upsert({
      where: {
        reporterId_targetType_targetId: {
          reporterId: authUser.id,
          targetType,
          targetId,
        },
      },
      // Đã báo cáo rồi thì không tạo dòng mới, cũng không cần báo lỗi cho user —
      // với họ, bấm lại nút Báo cáo vẫn nên thấy "đã gửi thành công".
      update: {},
      create: {
        reporterId: authUser.id,
        targetType,
        targetId,
        targetUserId: resolvedTargetUserId,
        reason,
        note: note || null,
      },
    });

    return NextResponse.json({ success: true, data: { id: report.id } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/reports?status=PENDING&limit=50  → chỉ ADMIN/MODERATOR (hàng đợi kiểm duyệt)
export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['ADMIN', 'MODERATOR'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

    const reports = await db.report.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    console.error('GET /api/reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
