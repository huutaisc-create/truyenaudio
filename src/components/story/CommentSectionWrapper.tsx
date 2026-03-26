"use client";

import { useSession } from "next-auth/react";
import CommentSection from "./CommentSection";

export default function CommentSectionWrapper({ storySlug }: { storySlug: string }) {
    const { data: session, status } = useSession();

    // Chờ session resolve — tránh flash "Đăng nhập để bình luận"
    if (status === "loading") return null;

    const currentUser = session?.user
        ? {
              id: session.user.id as string,
              name: session.user.name ?? "Ẩn danh",
              image: session.user.image ?? null,
              role: (session.user as any).role ?? "USER",
          }
        : null;

    return <CommentSection storySlug={storySlug} currentUser={currentUser} />;
}
