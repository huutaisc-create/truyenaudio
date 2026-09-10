import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// GET /api/affiliate/config?deviceId=xxx
// Trả về toàn bộ cấu hình popup + danh sách campaign (đã gắn cờ inSession/boosted theo device)
export async function GET(req: NextRequest) {
  try {
    const deviceId = (req.nextUrl.searchParams.get("deviceId") || "").trim();

    const cfg = await db.affiliatePopupConfig.findUnique({ where: { id: "singleton" } });
    const config = cfg ?? {
      enabled: true,
      onAppOpen: true,
      onAfterChapters: false,
      chaptersThreshold: 3,
      onEnterListen: false,
      onTabChange: false,
      cooldownMinutes: 30,
      sessionDays: 7,
      expiredWeightBoost: 3,
    };

    if (!config.enabled) {
      return NextResponse.json({ enabled: false, triggers: {}, campaigns: [] });
    }

    const now = new Date();

    const campaigns = await db.affiliateCampaign.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      select: {
        id: true,
        imageUrl: true,
        targetUrl: true,
        weight: true,
        incentiveText: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // click-session của riêng device này
    const sessions = deviceId
      ? await db.affiliateClickSession.findMany({
          where: { deviceId },
          select: { campaignId: true, expiresAt: true },
        })
      : [];
    const sessionMap = new Map(sessions.map((s) => [s.campaignId, s.expiresAt]));

    const mapped = campaigns.map((c) => {
      const exp = sessionMap.get(c.id);
      const inSession = exp ? exp > now : false;         // đang trong 7 ngày → app loại khỏi vòng xoay
      const expiredBefore = exp ? exp <= now : false;    // đã từng click & hết hạn → boost để "làm mới" chu kỳ
      const weight = expiredBefore
        ? Math.max(1, c.weight) * (config.expiredWeightBoost || 1)
        : c.weight;
      return {
        id: c.id,
        imageUrl: c.imageUrl,
        targetUrl: c.targetUrl,
        incentiveText: c.incentiveText,
        weight,
        inSession,
        boosted: expiredBefore,
      };
    });

    return NextResponse.json({
      enabled: true,
      triggers: {
        onAppOpen: config.onAppOpen,
        onAfterChapters: config.onAfterChapters,
        chaptersThreshold: config.chaptersThreshold,
        onEnterListen: config.onEnterListen,
        onTabChange: config.onTabChange,
      },
      cooldownMinutes: config.cooldownMinutes,
      sessionDays: config.sessionDays,
      campaigns: mapped,
    });
  } catch (e) {
    console.error("GET /api/affiliate/config error:", e);
    return NextResponse.json(
      { enabled: false, triggers: {}, campaigns: [] },
      { status: 500 }
    );
  }
}
