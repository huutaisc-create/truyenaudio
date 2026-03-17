import { auth } from '@/auth';
import db from '@/lib/db';
import { redirect } from 'next/navigation';
import { BookOpen, BookMarked, Clock, Settings } from 'lucide-react';
import Link from 'next/link';
import RealmIcon, { getRealm } from '@/components/common/RealmIcon';

export default async function TaiKhoanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, image: true,
      chaptersRead: true, createdAt: true,
      _count: { select: { library: true, readingHistory: true, reviews: true } },
    },
  });
  if (!user) redirect('/login');

  const library = await db.library.findMany({
    where: { userId: user.id },
    include: { story: { select: { slug: true, title: true, coverImage: true, author: true, status: true } } },
    orderBy: { addedAt: 'desc' },
    take: 12,
  });

  const history = await db.readingHistory.findMany({
    where: { userId: user.id },
    include: {
      story: { select: { slug: true, title: true, coverImage: true, author: true } },
      chapter: { select: { index: true, title: true } },
    },
    orderBy: { visitedAt: 'desc' },
    take: 12,
  });

  const realm = getRealm(user.chaptersRead);
  const ORANGE = '#f97316'; // Màu cam cố định cho trái/phải

  return (
    <div className="min-h-screen ">

      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #0a0a14 0%, #111827 50%, #0a0a14 100%)' }}>
        {/* Ambient glow theo màu cảnh giới ở giữa */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 50% 100% at 50% 50%, ${realm.color}14 0%, transparent 70%)` }}/>

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">

            {/* ── TRÁI: Avatar + Info + Stats (màu cam cố định) ── */}
            <div className="flex flex-col items-center md:items-start gap-4 shrink-0 md:w-52">
              {/* Avatar */}
              <div className="relative">
                {user.image ? (
                  <img src={user.image} alt={user.name || ''} className="h-20 w-20 rounded-full object-cover"
                    style={{ border: `3px solid ${ORANGE}`, boxShadow: `0 0 20px ${ORANGE}44` }}/>
                ) : (
                  <div className="h-20 w-20 flex items-center justify-center rounded-full text-3xl font-black text-white"
                    style={{ background: `radial-gradient(circle, ${ORANGE}88, ${ORANGE}33)`, border: `3px solid ${ORANGE}`, boxShadow: `0 0 20px ${ORANGE}44` }}>
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <Link href="/tai-khoan/cai-dat"
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-zinc-800 border border-zinc-600 hover:bg-zinc-700 transition-colors"
                  title="Đổi ảnh">
                  <Settings className="h-3 w-3 text-zinc-300" />
                </Link>
              </div>

              {/* Tên */}
              <div className="text-center md:text-left">
                <h1 className="text-xl font-black text-white">{user.name}</h1>
                <p className="text-sm font-bold mt-0.5" style={{ color: ORANGE }}>{realm.name}</p>
                <p className="text-[11px] text-zinc-500 mt-1">{user.email}</p>
              </div>

              {/* Stats - màu cam cố định */}
              <div className="flex md:flex-col gap-2 w-full">
                {[
                  { label: 'Tủ sách', value: user._count.library },
                  { label: 'Đã đọc',  value: user._count.readingHistory },
                  { label: 'Chương',  value: user.chaptersRead.toLocaleString('vi') },
                ].map(s => (
                  <div key={s.label} className="flex-1 md:flex-none flex md:flex-row items-center justify-between px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{s.label}</span>
                    <span className="text-base font-black" style={{ color: ORANGE }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── GIỮA: Card cảnh giới — màu theo từng level ── */}
            <div className="flex-1 flex justify-center">
              <div className="relative flex flex-col items-center gap-4 px-10 py-8 rounded-2xl" style={{
                background: 'linear-gradient(145deg, #141428, #0e0e1e)',
                border: `2px solid ${realm.color}55`,
                boxShadow: `0 0 50px ${realm.color}20, inset 0 0 40px ${realm.color}08`,
                minWidth: 240,
              }}>
                {/* Badge cấp */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase"
                  style={{ background: realm.color, color: '#0a0a14' }}>
                  CẤP {realm.idx + 1}
                </div>

                {/* Icon SVG to — màu gốc của cảnh giới */}
                <RealmIcon chaptersRead={user.chaptersRead} size={130} />

                {/* Tên cảnh giới */}
                <p className="text-2xl font-black" style={{ color: realm.color, textShadow: `0 0 20px ${realm.color}88` }}>
                  {realm.name}
                </p>

                {/* 9 sao — màu gốc */}
                <div className="flex gap-1">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i} className="text-xl"
                      style={{ color: i < realm.stars ? realm.color : '#2a2a3a', textShadow: i < realm.stars ? `0 0 8px ${realm.color}` : 'none' }}>★</span>
                  ))}
                </div>

                {/* Progress */}
                {realm.nextName ? (
                  <div className="w-full">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${realm.progressPct}%`, background: `linear-gradient(90deg, ${realm.color}88, ${realm.color})`, boxShadow: `0 0 8px ${realm.color}` }}/>
                    </div>
                    <div className="flex justify-between text-[10px] mt-1.5" style={{ color: realm.color + '77' }}>
                      <span>{user.chaptersRead.toLocaleString('vi')} chương</span>
                      <span>còn {realm.chaptersToNext.toLocaleString('vi')} → {realm.nextName}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: realm.color }}>✦ Vô thượng cảnh giới ✦</p>
                )}
              </div>
            </div>

            {/* ── PHẢI: Thông tin phụ (màu cam cố định) ── */}
            <div className="hidden md:flex flex-col gap-3 shrink-0 w-48">
              <div className="px-4 py-3 rounded-xl text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Thành viên từ</p>
                <p className="text-sm font-bold text-zinc-400">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</p>
              </div>
              <div className="px-4 py-3 rounded-xl text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Đánh giá</p>
                <p className="text-sm font-bold text-zinc-400">{user._count.reviews} bình luận</p>
              </div>
              <Link href="/tai-khoan/cai-dat"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-80"
                style={{ background: `${ORANGE}22`, border: `1px solid ${ORANGE}44`, color: ORANGE }}>
                <Settings className="h-4 w-4" /> Đổi ảnh đại diện
              </Link>
            </div>

          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">

        {/* Tủ sách */}
        <section>
          <div className="mb-5 border-l-4 pl-3" style={{ borderColor: ORANGE }}>
            <h2 className="text-lg font-bold uppercase text-zinc-800 flex items-center gap-2">
              <BookMarked className="h-5 w-5" style={{ color: ORANGE }} /> Tủ Sách
              <span className="text-sm font-normal text-zinc-400">({user._count.library})</span>
            </h2>
          </div>
          {library.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <BookMarked className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p>Chưa có truyện nào trong tủ sách</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12">
              {library.map(({ story }) => (
                <Link key={story.slug} href={`/truyen/${story.slug}`} className="group block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-100 shadow-sm transition-all group-hover:shadow-md">
                    {story.coverImage ? (
                      <img src={story.coverImage} alt={story.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-200">
                        <BookOpen className="h-6 w-6 text-zinc-300 opacity-20" />
                      </div>
                    )}
                    {story.status === 'COMPLETED' && (
                      <span className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-bold px-1 py-0.5 uppercase">Full</span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-6">
                      <h3 className="line-clamp-2 text-[10px] font-bold text-white">{story.title}</h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Lịch sử đọc */}
        <section>
          <div className="mb-5 border-l-4 pl-3" style={{ borderColor: ORANGE }}>
            <h2 className="text-lg font-bold uppercase text-zinc-800 flex items-center gap-2">
              <Clock className="h-5 w-5" style={{ color: ORANGE }} /> Lịch Sử Đọc
              <span className="text-sm font-normal text-zinc-400">({user._count.readingHistory})</span>
            </h2>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p>Chưa có lịch sử đọc</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {history.map(({ story, chapter, visitedAt }) => (
                <Link key={story.slug} href={`/truyen/${story.slug}`} className="group flex gap-3 p-2.5 rounded-xl bg-white border border-zinc-100 hover:shadow-md hover:border-zinc-200 transition-all">
                  <div className="shrink-0 w-[56px] h-[76px] rounded-lg overflow-hidden bg-zinc-100">
                    {story.coverImage ? (
                      <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300"><BookOpen size={16} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-800 line-clamp-1 group-hover:text-orange-500 transition-colors">{story.title}</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{story.author}</p>
                    </div>
                    <div>
                      {chapter && <p className="text-[11px] font-medium" style={{ color: ORANGE }}>Chương {chapter.index}: {chapter.title}</p>}
                      <p className="text-[10px] text-zinc-400 mt-0.5">{new Date(visitedAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
