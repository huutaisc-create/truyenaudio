// src/components/common/RealmIcon.tsx
// SVG icons chính xác từ thiết kế, màu gốc từng cảnh giới

export const REALMS = [
  { name: 'Luyện Khí',        min: 0,      color: '#aaaaaa', glow: 'rgba(180,180,180,0.25)', world: 'Phàm Giới' },
  { name: 'Trúc Cơ',          min: 100,    color: '#7ec87e', glow: 'rgba(126,200,126,0.3)',  world: 'Phàm Giới' },
  { name: 'Kim Đan',          min: 300,    color: '#f0c040', glow: 'rgba(240,192,64,0.35)',  world: 'Phàm Giới' },
  { name: 'Nguyên Anh',       min: 700,    color: '#80c8ff', glow: 'rgba(128,200,255,0.35)', world: 'Phàm Giới' },
  { name: 'Hóa Thần',         min: 1400,   color: '#c080ff', glow: 'rgba(192,128,255,0.35)', world: 'Phàm Giới' },
  { name: 'Luyện Hư',         min: 2600,   color: '#50d8d8', glow: 'rgba(80,216,216,0.35)',  world: 'Phàm Giới' },
  { name: 'Hợp Thể',          min: 5000,   color: '#ff9840', glow: 'rgba(255,152,64,0.35)',  world: 'Phàm Giới' },
  { name: 'Đại Thừa',         min: 10000,  color: '#ff5050', glow: 'rgba(255,80,80,0.35)',   world: 'Phàm Giới' },
  { name: 'Độ Kiếp',          min: 16000,  color: '#e0e0ff', glow: 'rgba(220,220,255,0.5)',  world: 'Phàm Giới' },
  { name: 'Tiên Nhân',        min: 24000,  color: '#ffe880', glow: 'rgba(255,232,128,0.4)',  world: 'Tiên Giới' },
  { name: 'Chân Tiên',        min: 34000,  color: '#80ffb0', glow: 'rgba(128,255,176,0.4)',  world: 'Tiên Giới' },
  { name: 'Huyền Tiên',       min: 46000,  color: '#a080ff', glow: 'rgba(160,128,255,0.4)',  world: 'Tiên Giới' },
  { name: 'Kim Tiên',         min: 60000,  color: '#ffd700', glow: 'rgba(255,215,0,0.5)',    world: 'Tiên Giới' },
  { name: 'Thái Ất Kim Tiên', min: 80000,  color: '#ffb040', glow: 'rgba(255,176,64,0.45)',  world: 'Tiên Giới' },
  { name: 'Đại La Kim Tiên',  min: 100000, color: '#ff80ff', glow: 'rgba(255,128,255,0.45)', world: 'Tiên Giới' },
  { name: 'Đạo Tổ',           min: 160000, color: '#ffffff', glow: 'rgba(255,255,255,0.6)',  world: 'Tiên Giới' },
];

export function getRealm(chaptersRead: number) {
  let idx = 0;
  for (let i = 0; i < REALMS.length; i++) {
    if (chaptersRead >= REALMS[i].min) idx = i;
    else break;
  }
  const realm = REALMS[idx];
  const next = REALMS[idx + 1];
  let stars = 9, progressPct = 100, chaptersToNext = 0;
  if (next) {
    const range = next.min - realm.min;
    const progress = chaptersRead - realm.min;
    stars = Math.min(9, Math.max(1, Math.floor((progress / range) * 9) + 1));
    progressPct = Math.min(100, Math.floor((progress / range) * 100));
    chaptersToNext = next.min - chaptersRead;
  }
  return { ...realm, idx, stars, progressPct, chaptersToNext, nextName: next?.name };
}

// SVG scale helper - lấy viewBox 80x80 (hoặc 120x120 cho Đạo Tổ) scale ra size
function RealmSVGInner({ idx, size }: { idx: number; size: number }) {
  const vb = idx === 15 ? 120 : 80;
  const svgs: Record<number, React.ReactNode> = {
    0: <>
      <defs><radialGradient id="rg0" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#e0e0e8"/><stop offset="100%" stopColor="#404050"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(160,160,180,0.07)" stroke="#888899" strokeWidth="0.8"/>
      <path d="M40 20 Q55 25 56 40 Q55 55 40 58 Q25 55 24 40 Q25 25 40 20" fill="none" stroke="#aaaaaa" strokeWidth="1.2" opacity="0.5"/>
      <path d="M40 26 Q51 30 52 40 Q51 50 40 53 Q29 50 28 40 Q29 30 40 26" fill="none" stroke="#aaaaaa" strokeWidth="0.8" opacity="0.35"/>
      <path d="M32 32 Q40 20 48 32 Q56 44 48 52 Q40 60 32 52 Q24 44 32 32" fill="url(#rg0)" opacity="0.25"/>
      <circle cx="40" cy="40" r="8" fill="url(#rg0)" opacity="0.7"/>
      <circle cx="40" cy="40" r="4" fill="#d0d0d8" opacity="0.4"/>
      <line x1="40" y1="12" x2="40" y2="18" stroke="#aaaaaa" strokeWidth="1" opacity="0.4"/>
      <line x1="57" y1="21" x2="53" y2="26" stroke="#aaaaaa" strokeWidth="1" opacity="0.35"/>
      <line x1="64" y1="40" x2="58" y2="40" stroke="#aaaaaa" strokeWidth="1" opacity="0.35"/>
      <line x1="57" y1="59" x2="53" y2="54" stroke="#aaaaaa" strokeWidth="1" opacity="0.35"/>
      <line x1="40" y1="68" x2="40" y2="62" stroke="#aaaaaa" strokeWidth="1" opacity="0.4"/>
      <line x1="23" y1="59" x2="27" y2="54" stroke="#aaaaaa" strokeWidth="1" opacity="0.35"/>
      <line x1="16" y1="40" x2="22" y2="40" stroke="#aaaaaa" strokeWidth="1" opacity="0.35"/>
      <line x1="23" y1="21" x2="27" y2="26" stroke="#aaaaaa" strokeWidth="1" opacity="0.35"/>
    </>,
    1: <>
      <defs><radialGradient id="rg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#b8f0b8"/><stop offset="100%" stopColor="#2d6b2d"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(126,200,126,0.08)" stroke="#7ec87e" strokeWidth="0.8"/>
      <path d="M40 62 L40 36" stroke="#5a9a5a" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M40 50 Q26 42 28 26 Q38 30 40 46" fill="url(#rg1)" opacity="0.9"/>
      <path d="M40 46 Q54 38 52 22 Q42 26 40 42" fill="url(#rg1)" opacity="0.85"/>
      <ellipse cx="40" cy="63" rx="11" ry="3.5" fill="#1a3a1a" opacity="0.5"/>
      <circle cx="40" cy="40" r="35" fill="none" stroke="#7ec87e" strokeWidth="0.4" opacity="0.3" strokeDasharray="3 4"/>
    </>,
    2: <>
      <defs><radialGradient id="rg2" cx="38%" cy="32%" r="60%"><stop offset="0%" stopColor="#fff4a0"/><stop offset="55%" stopColor="#c89820"/><stop offset="100%" stopColor="#6a4800"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(240,192,64,0.07)" stroke="#f0c040" strokeWidth="0.8"/>
      <circle cx="40" cy="40" r="24" fill="rgba(240,192,64,0.12)"/>
      <circle cx="40" cy="40" r="17" fill="url(#rg2)"/>
      <ellipse cx="34" cy="33" rx="5.5" ry="3.5" fill="white" opacity="0.22" transform="rotate(-35 34 33)"/>
      <path d="M40 24 Q52 31 47 40 Q40 50 30 44 Q20 37 30 28 Q36 23 40 24" fill="none" stroke="#ffe88a" strokeWidth="0.8" opacity="0.45"/>
    </>,
    3: <>
      <defs><radialGradient id="rg3" cx="50%" cy="38%" r="55%"><stop offset="0%" stopColor="#e8f6ff"/><stop offset="50%" stopColor="#5098d8"/><stop offset="100%" stopColor="#18407a"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(128,200,255,0.07)" stroke="#80c8ff" strokeWidth="0.8"/>
      <ellipse cx="40" cy="44" rx="9" ry="12" fill="url(#rg3)" opacity="0.85"/>
      <circle cx="40" cy="24" r="8" fill="url(#rg3)"/>
      <ellipse cx="40" cy="38" rx="15" ry="19" fill="none" stroke="#80c8ff" strokeWidth="0.8" opacity="0.35"/>
      <ellipse cx="40" cy="38" rx="22" ry="26" fill="none" stroke="#80c8ff" strokeWidth="0.4" opacity="0.18"/>
      <circle cx="37" cy="21" r="2" fill="white" opacity="0.35"/>
    </>,
    4: <>
      <defs><radialGradient id="rg4" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#f0d8ff"/><stop offset="55%" stopColor="#7030b8"/><stop offset="100%" stopColor="#280050"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(192,128,255,0.07)" stroke="#c080ff" strokeWidth="0.8"/>
      <path d="M40 13 Q60 18 64 40 Q60 62 40 67 Q20 62 16 40 Q20 18 40 13" fill="none" stroke="#c080ff" strokeWidth="1.2" opacity="0.5"/>
      <circle cx="40" cy="40" r="14" fill="url(#rg4)"/>
      <ellipse cx="40" cy="40" rx="5" ry="6.5" fill="#f0d8ff" opacity="0.75"/>
      <ellipse cx="40" cy="40" rx="2.5" ry="3.2" fill="#280050"/>
      <circle cx="38.5" cy="38.2" r="1.2" fill="white" opacity="0.55"/>
    </>,
    5: <>
      <defs><radialGradient id="rg5" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#b0ffff"/><stop offset="50%" stopColor="#189898"/><stop offset="100%" stopColor="#003838"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(80,216,216,0.07)" stroke="#50d8d8" strokeWidth="0.8"/>
      <circle cx="40" cy="40" r="26" fill="none" stroke="#50d8d8" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.45"/>
      <circle cx="40" cy="40" r="12" fill="url(#rg5)" opacity="0.6"/>
      <path d="M18 40 Q29 32 40 40 Q51 48 62 40" fill="none" stroke="#50d8d8" strokeWidth="1.5" opacity="0.6"/>
      <path d="M18 40 Q29 48 40 40 Q51 32 62 40" fill="none" stroke="#50d8d8" strokeWidth="0.8" opacity="0.3"/>
    </>,
    6: <>
      <defs>
        <radialGradient id="rg6a" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffe0a0"/><stop offset="100%" stopColor="#7a3800"/></radialGradient>
        <radialGradient id="rg6b" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#a8c8ff"/><stop offset="100%" stopColor="#001870"/></radialGradient>
      </defs>
      <circle cx="40" cy="40" r="35" fill="rgba(255,152,64,0.07)" stroke="#ff9840" strokeWidth="0.8"/>
      <path d="M40 14 A26 26 0 0 1 40 66 A13 13 0 0 1 40 40 A13 13 0 0 0 40 14" fill="url(#rg6a)"/>
      <path d="M40 14 A26 26 0 0 0 40 66 A13 13 0 0 0 40 40 A13 13 0 0 1 40 14" fill="url(#rg6b)" opacity="0.85"/>
      <circle cx="40" cy="27" r="4" fill="#001870"/>
      <circle cx="40" cy="53" r="4" fill="#7a3800"/>
      <circle cx="40" cy="40" r="26" fill="none" stroke="#ff9840" strokeWidth="1.2"/>
    </>,
    7: <>
      <defs><radialGradient id="rg7" cx="50%" cy="38%" r="60%"><stop offset="0%" stopColor="#ffe0d8"/><stop offset="40%" stopColor="#e83030"/><stop offset="100%" stopColor="#580000"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(255,80,80,0.07)" stroke="#ff5050" strokeWidth="0.8"/>
      <path d="M14 58 Q20 34 32 28 Q42 22 48 28 Q58 34 56 46 Q54 58 44 60 Q32 64 22 56" fill="none" stroke="#ff5050" strokeWidth="2.8" strokeLinecap="round" opacity="0.75"/>
      <ellipse cx="54" cy="28" rx="11" ry="7.5" fill="url(#rg7)" transform="rotate(-35 54 28)"/>
      <circle cx="58" cy="23" r="2.2" fill="#ffe0d8"/>
      <circle cx="58" cy="23" r="1" fill="#280000"/>
      <path d="M56 19 L61 12" stroke="#ff5050" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M64 26 Q72 18 68 10 Q62 18 65 13 Q57 20 62 17 Q56 24 64 26" fill="#ff6820" opacity="0.85"/>
    </>,
    8: <>
      <defs><radialGradient id="rg8o" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.18"/><stop offset="100%" stopColor="#ffffff" stopOpacity="0"/></radialGradient></defs>
      <circle cx="40" cy="40" r="38" fill="url(#rg8o)"/>
      <circle cx="40" cy="40" r="35" fill="rgba(255,255,255,0.04)" stroke="#d0d0ff" strokeWidth="0.8"/>
      <path d="M40 8 L33 32 L42 32 L30 60 L47 34 L37 34 Z" fill="#ffe840" opacity="0.92"/>
      <path d="M40 8 L33 32 L42 32 L30 60 L47 34 L37 34 Z" fill="none" stroke="white" strokeWidth="0.6" opacity="0.7"/>
      <line x1="40" y1="6" x2="40" y2="2" stroke="white" strokeWidth="1.5" opacity="0.6"/>
      <line x1="62" y1="18" x2="65" y2="15" stroke="white" strokeWidth="1.5" opacity="0.6"/>
      <line x1="18" y1="18" x2="15" y2="15" stroke="white" strokeWidth="1.5" opacity="0.6"/>
      <line x1="68" y1="40" x2="72" y2="40" stroke="white" strokeWidth="1.5" opacity="0.6"/>
      <line x1="12" y1="40" x2="8" y2="40" stroke="white" strokeWidth="1.5" opacity="0.6"/>
    </>,
    9: <>
      <defs><radialGradient id="rgt1" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#ffffff"/><stop offset="40%" stopColor="#ffe880"/><stop offset="100%" stopColor="#806000"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(255,232,128,0.07)" stroke="#ffe880" strokeWidth="0.8"/>
      <ellipse cx="40" cy="46" rx="8" ry="10" fill="url(#rgt1)" opacity="0.8"/>
      <circle cx="40" cy="26" r="7" fill="url(#rgt1)"/>
      <path d="M32 40 Q16 28 18 16 Q28 22 32 36" fill="#ffe880" opacity="0.3"/>
      <path d="M48 40 Q64 28 62 16 Q52 22 48 36" fill="#ffe880" opacity="0.3"/>
      <path d="M32 40 Q16 28 18 16 Q28 22 32 36" fill="none" stroke="#ffe880" strokeWidth="0.8" opacity="0.6"/>
      <path d="M48 40 Q64 28 62 16 Q52 22 48 36" fill="none" stroke="#ffe880" strokeWidth="0.8" opacity="0.6"/>
      <ellipse cx="40" cy="26" rx="12" ry="4" fill="none" stroke="#ffe880" strokeWidth="0.7" opacity="0.45" transform="rotate(-10 40 26)"/>
    </>,
    10: <>
      <defs><radialGradient id="rgt2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#e0fff0"/><stop offset="50%" stopColor="#20c860"/><stop offset="100%" stopColor="#006030"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(128,255,176,0.07)" stroke="#80ffb0" strokeWidth="0.8"/>
      <rect x="38.5" y="10" width="3" height="46" rx="1.5" fill="url(#rgt2)"/>
      <rect x="32" y="52" width="16" height="3.5" rx="1.5" fill="#80ffb0" opacity="0.7"/>
      <rect x="36.5" y="55" width="7" height="8" rx="1" fill="#80ffb0" opacity="0.5"/>
      <line x1="40" y1="8" x2="40" y2="4" stroke="#80ffb0" strokeWidth="2" opacity="0.7"/>
      <line x1="40" y1="8" x2="36" y2="5" stroke="#80ffb0" strokeWidth="1" opacity="0.5"/>
      <line x1="40" y1="8" x2="44" y2="5" stroke="#80ffb0" strokeWidth="1" opacity="0.5"/>
    </>,
    11: <>
      <defs><radialGradient id="rgt3" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#e8e0ff"/><stop offset="50%" stopColor="#6040c0"/><stop offset="100%" stopColor="#180040"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(160,128,255,0.07)" stroke="#a080ff" strokeWidth="0.8"/>
      <circle cx="40" cy="40" r="24" fill="none" stroke="#a080ff" strokeWidth="1" opacity="0.4"/>
      <circle cx="40" cy="16" r="2.5" fill="#a080ff" opacity="0.8"/>
      <circle cx="57" cy="23" r="2.5" fill="#a080ff" opacity="0.7"/>
      <circle cx="64" cy="40" r="2.5" fill="#a080ff" opacity="0.6"/>
      <circle cx="57" cy="57" r="2.5" fill="#a080ff" opacity="0.7"/>
      <circle cx="40" cy="64" r="2.5" fill="#a080ff" opacity="0.8"/>
      <circle cx="23" cy="57" r="2.5" fill="#a080ff" opacity="0.7"/>
      <circle cx="16" cy="40" r="2.5" fill="#a080ff" opacity="0.6"/>
      <circle cx="23" cy="23" r="2.5" fill="#a080ff" opacity="0.7"/>
      <circle cx="40" cy="40" r="13" fill="url(#rgt3)"/>
    </>,
    12: <>
      <defs><radialGradient id="rgt4" cx="50%" cy="35%" r="60%"><stop offset="0%" stopColor="#ffffff"/><stop offset="30%" stopColor="#ffd700"/><stop offset="70%" stopColor="#b08800"/><stop offset="100%" stopColor="#604000"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(255,215,0,0.07)" stroke="#ffd700" strokeWidth="0.8"/>
      <path d="M40 12 L43.5 32 L62 28 L47 40 L62 52 L43.5 48 L40 68 L36.5 48 L18 52 L33 40 L18 28 L36.5 32 Z" fill="url(#rgt4)" opacity="0.85"/>
      <circle cx="40" cy="40" r="8" fill="#fff8a0" opacity="0.6"/>
      <circle cx="40" cy="40" r="4" fill="white" opacity="0.45"/>
    </>,
    13: <>
      <defs><radialGradient id="rgt5" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fff0d0"/><stop offset="40%" stopColor="#ff9020"/><stop offset="100%" stopColor="#602000"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(255,176,64,0.07)" stroke="#ffb040" strokeWidth="0.8"/>
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const r = deg * Math.PI / 180;
        return <line key={i} x1={40+Math.cos(r)*16} y1={40+Math.sin(r)*16} x2={40+Math.cos(r)*28} y2={40+Math.sin(r)*28} stroke="#ffb040" strokeWidth="2.2" strokeLinecap="round" opacity="0.7"/>;
      })}
      <circle cx="40" cy="40" r="18" fill="url(#rgt5)"/>
      <circle cx="36" cy="36" r="4" fill="white" opacity="0.2"/>
    </>,
    14: <>
      <defs><radialGradient id="rgt6" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffe0ff"/><stop offset="45%" stopColor="#c020c0"/><stop offset="100%" stopColor="#400040"/></radialGradient></defs>
      <circle cx="40" cy="40" r="35" fill="rgba(255,128,255,0.07)" stroke="#ff80ff" strokeWidth="0.8"/>
      <circle cx="40" cy="40" r="30" fill="none" stroke="#ff80ff" strokeWidth="1" opacity="0.45"/>
      <circle cx="40" cy="40" r="22" fill="none" stroke="#ff80ff" strokeWidth="0.7" opacity="0.3"/>
      <line x1="14" y1="14" x2="66" y2="66" stroke="#ff80ff" strokeWidth="0.5" opacity="0.2"/>
      <line x1="66" y1="14" x2="14" y2="66" stroke="#ff80ff" strokeWidth="0.5" opacity="0.2"/>
      <line x1="40" y1="10" x2="40" y2="70" stroke="#ff80ff" strokeWidth="0.5" opacity="0.2"/>
      <line x1="10" y1="40" x2="70" y2="40" stroke="#ff80ff" strokeWidth="0.5" opacity="0.2"/>
      <circle cx="40" cy="40" r="11" fill="url(#rgt6)"/>
      <path d="M28 26 L32 18 L37 24 L40 16 L43 24 L48 18 L52 26" fill="none" stroke="#ff80ff" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
    </>,
    15: <>
      <defs>
        <radialGradient id="rgt7" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffffff"/><stop offset="30%" stopColor="#e8e0ff"/><stop offset="65%" stopColor="#8060ff"/><stop offset="100%" stopColor="#100030"/></radialGradient>
        <radialGradient id="rgt7o" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.15"/><stop offset="100%" stopColor="#ffffff" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#rgt7o)"/>
      <circle cx="60" cy="60" r="54" fill="rgba(255,255,255,0.03)" stroke="white" strokeWidth="0.6" opacity="0.35"/>
      <circle cx="60" cy="60" r="44" fill="none" stroke="white" strokeWidth="0.7" opacity="0.2" strokeDasharray="4 5"/>
      {[[60,8,60,2],[89,16,93,12],[108,38,113,34],[116,60,120,60],[108,82,113,86],[89,104,93,108],[60,112,60,118],[31,104,27,108],[12,82,7,86],[4,60,0,60],[12,38,7,34],[31,16,27,12]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="2" opacity="0.6"/>
      ))}
      <circle cx="60" cy="60" r="22" fill="url(#rgt7)"/>
      <text x="60" y="68" textAnchor="middle" fontSize="24" fill="white" opacity="0.88" fontFamily="serif" fontWeight="bold">道</text>
    </>,
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} style={{ display: 'block' }}>
      {svgs[idx]}
    </svg>
  );
}

interface RealmIconProps {
  chaptersRead: number;
  size?: number;
  showStars?: boolean;
  showName?: boolean;
  className?: string;
}

export default function RealmIcon({ chaptersRead, size = 48, showStars = false, showName = false, className = '' }: RealmIconProps) {
  const realm = getRealm(chaptersRead);
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div style={{ filter: `drop-shadow(0 0 ${size * 0.12}px ${realm.glow})` }}>
        <RealmSVGInner idx={realm.idx} size={size} />
      </div>
      {showName && <span className="text-xs font-bold" style={{ color: realm.color }}>{realm.name}</span>}
      {showStars && (
        <div className="flex gap-0.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} style={{ color: i < realm.stars ? realm.color : '#2a2a3a', fontSize: size * 0.15 }}>★</span>
          ))}
        </div>
      )}
    </div>
  );
}
