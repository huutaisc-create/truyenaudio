// D:\Webtruyen\webtruyen-app\src\app\api\stories\[slug]\comments\route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { rewardCredit } from '@/lib/credits';

const PAGE_SIZE = 20;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const limit = Math.min(Number(searchParams.get('limit') || PAGE_SIZE), 50);

    const story = await db.story.findUnique({ where: { slug }, select: { id: true } });
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

    const authUser = await getAuthUser(req);

    const comments = await db.comment.findMany({
      where: { storyId: story.id },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
        commentLikes: authUser
          ? { where: { userId: authUser.id }, select: { id: true } }
          : false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(after && { cursor: { id: after }, skip: 1 }),
    });

    const reversed = comments.reverse();
    return NextResponse.json({
      success: true,
      data: reversed.map(c => ({
        id: c.id,
        content: c.content,
        likeCount: c.likeCount,
        createdAt: c.createdAt,
        isLiked: authUser ? c.commentLikes.length > 0 : false,
        user: c.user,
      })),
      hasMore: comments.length === limit,
      nextCursor: reversed.length > 0 ? reversed[0].id : null,
    });
  } catch (error) {
    console.error('GET comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 });
    }

    const story = await db.story.findUnique({
      where: { slug },
      select: { id: true, title: true },
    });
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

    // Lưu bình luận trước — luôn thành công bất kể có tính credit hay không
    const comment = await db.comment.create({
      data: {
        content: content.trim(),
        userId: authUser.id,
        storyId: story.id,
      },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
      },
    });

    // Tính credit — chờ kết quả để trả về thông báo cho user
    // Điều kiện:
    //   - Nội dung >= 20 ký tự
    //   - Cooldown 60 giây giữa 2 lần liên tiếp
    //   - Mỗi truyện chỉ tính 1 lần/ngày (storyId check)
    //   - Tối đa 5 truyện khác nhau/ngày
    const rewardResult = await rewardCredit(
      authUser.id,
      'REWARD_COMMENT',
      // Embed storyId vào note để check "truyện khác nhau"
      `[${story.id}] Bình luận truyện: ${story.title}`,
      {
        content: content.trim(),
        amount: 0.2,
        maxPerDay: 5,
        minLength: 20,
        storyId: story.id,
        cooldownSeconds: 60,
      }
    );

    // Tạo message thông báo credit rõ ràng cho user
    let creditMessage: string;
    if (rewardResult.rewarded) {
      creditMessage = '✅ +0.2 credit cho bình luận này!';
    } else {
      creditMessage = `ℹ️ ${rewardResult.reason}`;
    }

    return NextResponse.json({
      success: true,
      creditMessage,
      data: {
        id: comment.id,
        content: comment.content,
        likeCount: comment.likeCount,
        createdAt: comment.createdAt,
        isLiked: false,
        user: comment.user,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('POST comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
