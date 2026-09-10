import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// POST /api/affiliate/event
// body: { deviceId, campaignId, type: "impression" | "click", userId? }
// - Ghi log event (cho thống kê)
// - Tăng counter nhanh trên campaign
// - Nếu click: mở/reset click-session (chu kỳ sessionDays)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceId = (body.deviceId || "").toString().trim();
    const campaignId = (body.campaignId || "").toString().trim();
    const type = (body.type || "").toString().toLowerCase();
    const userId = body.userId ? body.userId.toString() : null;

    if (!deviceId || !campaignId || (type !== "impression" && type !== "click")) {
      return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
    }

    const campaign = await db.affiliateCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!campaign) {
      return NextResponse.json({ success: false, message: "Campaign not found" }, { status: 404 });
    }

    const typeEnum = type === "click" ? "CLICK" : "IMPRESSION";
    await db.affiliateEvent.create({
      data: { campaignId, deviceId, userId, type: typeEnum },
    });

    if (type === "click") {
      await db.affiliateCampaign.update({
        where: { id: campaignId },
        data: { clicks: { increment: 1 } },
      });

      const cfg = await db.affiliatePopupConfig.findUnique({
        where: { id: "singleton" },
        select: { sessionDays: true },
      });
      const days = cfg?.sessionDays ?? 7;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      await db.affiliateClickSession.upsert({
        where: { deviceId_campaignId: { deviceId, campaignId } },
        create: { deviceId, campaignId, clickedAt: now, expiresAt },
        update: { clickedAt: now, expiresAt },
      });
    } else {
      await db.affiliateCampaign.update({
        where: { id: campaignId },
        data: { impressions: { increment: 1 } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/affiliate/event error:", e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
