'use client'
// D:\Webtruyen\webtruyen-app\src\app\tai-khoan\credits\CreditHubClient.tsx

import { useState, useRef, useEffect, useCallback } from 'react'

// ── TYPES ──────────────────────────────────────────────
interface UserData {
  id: string
  name: string
  image: string | null
  chaptersRead: number
  downloadCredits: number
  createdAt: string
  commentsCount: number
  reviewsCount: number
  nominationsCount: number
  lastCheckIn:   string | null   // ISO string hoặc null
  currentStreak: number
}

interface Transaction {
  id: string
  type: string        // 'ADD_APP' | 'ADD_WEB' | 'SPEND'
  amount: number
  balanceAfter: number
  note: string
  createdAt: string
}

interface StoryRequest {
  id: string
  title: string
  status: string      // 'PENDING' | 'DONE' | 'REJECTED'
  createdAt: string
  story: { slug: string; title: string } | null
}

interface Props {
  user: UserData
  transactions: Transaction[]
  storyRequests: StoryRequest[]
}

// ── LEVEL SYSTEM ────────────────────────────────────────
const LEVELS = [
  { name: 'Luyện Khí',     min: 0,    icon: '🌱', color: '#86efac' },
  { name: 'Trúc Cơ',       min: 50,   icon: '🔥', color: '#fb923c' },
  { name: 'Kim Đan',       min: 200,  icon: '💎', color: '#60a5fa' },
  { name: 'Nguyên Anh',    min: 500,  icon: '⚡', color: '#facc15' },
  { name: 'Hóa Thần',      min: 1000, icon: '🌟', color: '#f5a623' },
  { name: 'Luyện Hư',      min: 2000, icon: '🔮', color: '#c084fc' },
  { name: 'Hợp Thể',       min: 5000, icon: '🌙', color: '#818cf8' },
  { name: 'Đại Thừa',      min: 10000,icon: '☀️', color: '#fbbf24' },
  { name: 'Độ Kiếp',       min: 20000,icon: '👑', color: '#f5a623' },
]
function getLevel(chaptersRead: number) {
  let lv = LEVELS[0]
  for (const l of LEVELS) { if (chaptersRead >= l.min) lv = l }
  const idx    = LEVELS.indexOf(lv)
  const next   = LEVELS[idx + 1]
  const pct    = next
    ? Math.min(100, Math.round(((chaptersRead - lv.min) / (next.min - lv.min)) * 100))
    : 100
  return { ...lv, idx, next, pct, toNext: next ? next.min - chaptersRead : 0 }
}

// ── AD DURATION ─────────────────────────────────────────
const AD_SEC = 15

// ── FORMAT DATE ─────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ════════════════════════════════════════════════════════
export default function CreditHubClient({ user, transactions: initTx, storyRequests }: Props) {
  const lv                  = getLevel(user.chaptersRead)
  const [credits, setCredits]       = useState(user.downloadCredits)
  const [videoCount, setVideoCount] = useState(() =>
    initTx.filter(t => t.type === 'ADD_APP' || t.type === 'ADD_WEB').length
  )
  const [txList, setTxList]         = useState<Transaction[]>(initTx)
  const [filter, setFilter]         = useState<'all' | 'add' | 'spend'>('all')

  // Ad state
  const [adOpen, setAdOpen]         = useState(false)
  const [adSource, setAdSource]     = useState<'web' | 'app'>('web')
  const [adPhase, setAdPhase]       = useState<'watching' | 'done'>('watching')
  const [adSec, setAdSec]           = useState(AD_SEC)
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null)

  // Toast
  const [toast, setToast]           = useState<{ msg: string; ok: boolean; isBonus?: boolean } | null>(null)
  const toastTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const usable  = Math.floor(credits)
  const pending = Math.round((credits - usable) * 10) / 10

  // ── TOAST ──
  const showToast = useCallback((msg: string, ok: boolean, isBonus?: boolean) => {
    setToast({ msg, ok, isBonus })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), isBonus ? 5000 : 3000)
  }, [])

  // ── AD OPEN ──
  function openAd(src: 'web' | 'app') {
    setAdSource(src)
    setAdPhase('watching')
    setAdSec(AD_SEC)
    setAdOpen(true)
  }

  // ── AD TICK ──
  useEffect(() => {
    if (!adOpen || adPhase !== 'watching') {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      setAdSec(s => {
        if (s <= 1) {
          clearInterval(timerRef.current!)
          setAdPhase('done')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [adOpen, adPhase])

  // ── CLAIM CREDIT ──
  async function claimCredit() {
    const amount = adSource === 'app' ? 1.0 : 0.5
    try {
      const res  = await fetch('/api/credits/add', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ source: adSource }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const newCredits = data.downloadCredits as number
      setCredits(newCredits)
      setVideoCount(v => v + 1)

      // Prepend to local tx list
      const newTx: Transaction = {
        id:          crypto.randomUUID(),
        type:        adSource === 'app' ? 'ADD_APP' : 'ADD_WEB',
        amount,
        balanceAfter:newCredits,
        note:        adSource === 'app' ? 'Xem video rewarded (app)' : 'Xem video rewarded (web)',
        createdAt:   new Date().toISOString(),
      }
      setTxList(prev => [newTx, ...prev])
      setAdOpen(false)
      showToast(`✓ Nhận +${amount.toFixed(1)} credit! Số dư: ${newCredits.toFixed(1)}`, true)
    } catch (e: any) {
      showToast(e.message || 'Lỗi kết nối', false)
      setAdOpen(false)
    }
  }

  // ── CHECKIN STATE ──
  // Kiểm tra xem hôm nay (VN) đã điểm danh chưa
  function alreadyCheckedInToday(lastCheckIn: string | null): boolean {
    if (!lastCheckIn) return false
    const nowVN   = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const todayVN = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate()))
    const lastVN  = new Date(new Date(lastCheckIn).getTime() + 7 * 60 * 60 * 1000)
    const lastDay = new Date(Date.UTC(lastVN.getUTCFullYear(), lastVN.getUTCMonth(), lastVN.getUTCDate()))
    return todayVN.getTime() === lastDay.getTime()
  }

  const [checkedIn, setCheckedIn]     = useState(() => alreadyCheckedInToday(user.lastCheckIn))
  const [streak, setStreak]           = useState(user.currentStreak)
  const [checkInLoading, setCheckInLoading] = useState(false)

  // ── CHECKIN API ──
  async function doCheckIn() {
    if (checkedIn || checkInLoading) return
    setCheckInLoading(true)
    try {
      const res  = await fetch('/api/credits/checkin', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setCredits(data.downloadCredits)
      setStreak(data.currentStreak)
      setCheckedIn(true)

      // Prepend tx
      const newTx: Transaction = {
        id:           crypto.randomUUID(),
        type:         'ADD_WEB',
        amount:       data.earned,
        balanceAfter: data.downloadCredits,
        note:         data.isBonus
          ? `Điểm danh hằng ngày 🔥 Streak ${data.currentStreak} — Bonus x7!`
          : `Điểm danh hằng ngày 🔥 Streak ${data.currentStreak}`,
        createdAt:    new Date().toISOString(),
      }
      setTxList(prev => [newTx, ...prev])
      showToast(data.message, true, data.isBonus)
    } catch (e: any) {
      showToast(e.message || 'Lỗi kết nối', false)
    } finally {
      setCheckInLoading(false)
    }
  }

  // ── FILTERED TX ──
  const filteredTx = txList.filter(t => {
    if (filter === 'all')   return true
    if (filter === 'add')   return t.type.startsWith('ADD')
    if (filter === 'spend') return t.type === 'SPEND'
    return true
  })

  const pct = (AD_SEC - adSec) / AD_SEC * 100

  // ─────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .ch-root{
          --gold:#f5a623;--gold-dim:#c47f10;--gold-glow:rgba(245,166,35,.18);
          --green:#22c55e;--red:#ef4444;--blue:#60a5fa;
          --bg:#0d0d0f;--surface:#141418;--surface2:#1c1c22;
          --border:rgba(255,255,255,.07);--text:#f0ede8;--muted:#6b6b7a;
          --radius:16px;--mono:'JetBrains Mono',monospace;
          font-family:'Sora',sans-serif;
          background:var(--bg);color:var(--text);
          min-height:100vh;
        }
        .ch-page{max-width:860px;margin:0 auto;padding:32px 20px 80px}

        /* TOPBAR */
        .ch-topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px}
        .ch-logo{font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
        .ch-logo span{color:var(--gold)}
        .ch-user{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted)}
        .ch-avatar{width:34px;height:34px;border-radius:50%;background:var(--surface2);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px;object-fit:cover}

        /* HERO */
        .ch-hero{position:relative;border-radius:24px;padding:40px 36px 36px;margin-bottom:24px;overflow:hidden;background:linear-gradient(135deg,#1a1200 0%,#2a1a00 40%,#1a0f00 100%);border:1px solid rgba(245,166,35,.2)}
        .ch-glow{position:absolute;top:-60px;right:-60px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(245,166,35,.22) 0%,transparent 70%);pointer-events:none}
        .ch-hero-label{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);display:flex;align-items:center;gap:6px;margin-bottom:20px}
        .ch-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);animation:chPulse 2s infinite;flex-shrink:0}
        @keyframes chPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
        .ch-count{font-size:88px;font-weight:800;line-height:1;background:linear-gradient(135deg,#ffd86e 0%,#f5a623 50%,#c47f10 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-4px;transition:all .4s}
        .ch-unit{font-size:18px;font-weight:600;color:var(--gold-dim);padding-bottom:14px}
        .ch-sub{font-family:var(--mono);font-size:13px;color:rgba(245,166,35,.55);letter-spacing:.04em;margin-bottom:28px}
        .ch-sub b{color:rgba(245,166,35,.85)}
        .ch-divider{height:1px;background:rgba(245,166,35,.12);margin-bottom:20px}
        .ch-stats{display:grid;grid-template-columns:repeat(3,1fr)}
        .ch-stat{padding:0 20px;border-right:1px solid rgba(245,166,35,.1)}
        .ch-stat:first-child{padding-left:0}
        .ch-stat:last-child{border-right:none}
        .ch-stat-val{font-family:var(--mono);font-size:20px;font-weight:700;line-height:1;margin-bottom:4px}
        .ch-stat-lbl{font-size:11px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}

        /* SECTION */
        .ch-sec{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:14px;display:flex;align-items:center;gap:10px}
        .ch-sec::after{content:'';flex:1;height:1px;background:var(--border)}

        /* CARD BASE */
        .ch-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px 22px;margin-bottom:24px;position:relative;overflow:hidden}
        .ch-card-top{position:absolute;top:0;left:0;right:0;height:2px}

        /* CHECKIN */
        .ch-ci-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
        .ch-ci-header h3{font-size:15px;font-weight:700;margin-bottom:4px}
        .ch-ci-header p{font-size:12px;color:var(--muted)}
        .ch-streak{display:flex;align-items:center;gap:6px;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.25);border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;color:var(--blue);white-space:nowrap}
        .ch-days{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:16px}
        .ch-day{display:flex;flex-direction:column;align-items:center;gap:6px}
        .ch-day-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
        .ch-day-dot{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;border:1.5px solid var(--border);background:var(--surface2);color:var(--muted)}
        .ch-day-dot.done{background:rgba(34,197,94,.25);border-color:rgba(34,197,94,.7);color:#4ade80;font-weight:800;font-size:17px}
        .ch-day-dot.done.bonus{background:linear-gradient(135deg,rgba(245,166,35,.4),rgba(255,210,60,.18));border-color:var(--gold);border-width:2px;color:var(--gold);font-size:18px;animation:bonusGlow 1.8s ease-in-out infinite}
        @keyframes bonusGlow{0%,100%{box-shadow:0 0 10px rgba(245,166,35,.4)}50%{box-shadow:0 0 26px rgba(245,166,35,.75)}}
        .ch-day-dot.today{background:rgba(96,165,250,.18);border-color:rgba(96,165,250,.6);color:#93c5fd;animation:todayGlow 2s infinite}
        @keyframes todayGlow{0%,100%{box-shadow:0 0 12px rgba(96,165,250,.2)}50%{box-shadow:0 0 22px rgba(96,165,250,.5)}}
        .ch-day-dot.locked{opacity:.55;background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.3)}
        .ch-day-lbl.bonus-lbl{color:var(--gold);font-weight:700}
        .ch-ci-cta{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
        .ch-ci-cta p{font-size:12px;color:var(--muted)}
        .ch-ci-cta p b{color:var(--blue)}

        /* EARN */
        .ch-earn{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}
        .ch-earn-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px 22px 20px;position:relative;overflow:hidden;transition:border-color .2s,transform .2s;cursor:default}
        .ch-earn-card:hover{border-color:rgba(245,166,35,.35);transform:translateY(-2px)}
        .ch-earn-icon{width:42px;height:42px;border-radius:12px;background:var(--gold-glow);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px}
        .ch-earn-icon.blue{background:rgba(96,165,250,.12)}
        .ch-earn-reward{font-family:var(--mono);font-size:20px;font-weight:700;color:var(--gold);margin-bottom:2px}
        .ch-earn-card h3{font-size:15px;font-weight:700;margin-bottom:4px}
        .ch-earn-card p{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:16px}
        .ch-badge{position:absolute;top:16px;right:16px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:var(--green);font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;letter-spacing:.06em;text-transform:uppercase}

        /* BUTTONS */
        .ch-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:10px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;border:none;font-family:'Sora',sans-serif;transition:opacity .15s,transform .15s}
        .ch-btn:active{transform:scale(.97)}
        .ch-btn:disabled{opacity:.45;cursor:not-allowed}
        .ch-btn.gold{background:linear-gradient(135deg,#f5a623,#c47f10);color:#0d0d0f}
        .ch-btn.ghost{background:var(--surface2);color:var(--text);border:1px solid var(--border)}
        .ch-btn.full{width:100%;justify-content:center}

        /* TWO COL */
        .ch-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}
        .ch-achv{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px 22px}
        .ch-lv-row{display:flex;align-items:center;gap:14px;margin-bottom:16px}
        .ch-lv-badge{width:52px;height:52px;border-radius:14px;flex-shrink:0;background:linear-gradient(135deg,#2a1a00,#3d2600);border:1.5px solid rgba(245,166,35,.3);display:flex;align-items:center;justify-content:center;font-size:26px}
        .ch-lv-info h3{font-size:15px;font-weight:700}
        .ch-lv-info p{font-size:12px;color:var(--muted);margin-top:2px}
        .ch-xp-wrap{margin-bottom:14px}
        .ch-xp-lbl{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:6px;font-family:var(--mono)}
        .ch-xp-bar{height:6px;background:var(--surface2);border-radius:99px;overflow:hidden}
        .ch-xp-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--gold),#ffd86e);transition:width .8s cubic-bezier(.22,1,.36,1)}
        .ch-chips{display:flex;flex-wrap:wrap;gap:7px}
        .ch-chip{display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:8px;font-size:11px;font-weight:600;background:var(--surface2);border:1px solid var(--border)}
        .ch-app{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px 22px}
        .ch-cmp{width:100%;border-collapse:collapse;margin:14px 0}
        .ch-cmp th,.ch-cmp td{padding:10px 12px;text-align:left;font-size:12px;border-bottom:1px solid var(--border)}
        .ch-cmp th{color:var(--muted);font-weight:600;letter-spacing:.06em;text-transform:uppercase}
        .ch-cmp td:last-child{text-align:right}
        .ch-x2{display:inline-block;background:rgba(245,166,35,.15);border:1px solid rgba(245,166,35,.3);color:var(--gold);font-size:10px;font-weight:700;padding:1px 7px;border-radius:6px;margin-left:6px;vertical-align:middle}

        /* REQUESTS */
        .ch-req-list{display:flex;flex-direction:column;gap:10px}
        .ch-req-item{display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:10px;background:var(--surface2);border:1px solid var(--border)}
        .ch-req-icon{font-size:20px;flex-shrink:0}
        .ch-req-info{flex:1;min-width:0}
        .ch-req-info h4{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ch-req-info p{font-size:11px;color:var(--muted);margin-top:2px}
        .ch-status{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:7px;white-space:nowrap;flex-shrink:0}
        .ch-status.PENDING{background:rgba(245,166,35,.12);color:var(--gold);border:1px solid rgba(245,166,35,.25)}
        .ch-status.DONE{background:rgba(34,197,94,.12);color:var(--green);border:1px solid rgba(34,197,94,.25)}
        .ch-status.REJECTED{background:rgba(239,68,68,.12);color:var(--red);border:1px solid rgba(239,68,68,.25)}

        /* RULES */
        .ch-rules{display:flex;flex-direction:column;gap:10px}
        .ch-rule{display:flex;gap:12px;align-items:flex-start;font-size:13px;line-height:1.6;color:rgba(240,237,232,.75)}
        .ch-rule-num{width:22px;height:22px;border-radius:7px;flex-shrink:0;background:var(--gold-glow);border:1px solid rgba(245,166,35,.25);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--gold);margin-top:1px}

        /* AUDIT */
        .ch-filter{display:flex;gap:8px;margin-bottom:16px}
        .ch-fbtn{padding:6px 14px;border-radius:8px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'Sora',sans-serif;transition:all .15s}
        .ch-fbtn.on{background:var(--gold-glow);color:var(--gold);border-color:rgba(245,166,35,.3)}
        .ch-tx-row{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border)}
        .ch-tx-row:last-child{border-bottom:none}
        .ch-tx-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .ch-tx-icon.add{background:rgba(34,197,94,.12)}
        .ch-tx-icon.spend{background:rgba(239,68,68,.1)}
        .ch-tx-desc h4{font-size:13px;font-weight:600}
        .ch-tx-desc p{font-size:11px;color:var(--muted);margin-top:1px;font-family:var(--mono)}
        .ch-tx-amt{font-family:var(--mono);font-size:14px;font-weight:700;white-space:nowrap}
        .ch-tx-amt.pos{color:var(--green)}
        .ch-tx-amt.neg{color:var(--red)}
        .ch-tx-bal{font-family:var(--mono);font-size:11px;color:var(--muted);text-align:right;white-space:nowrap}
        .ch-empty{text-align:center;padding:32px 0;color:var(--muted);font-size:13px}

        /* AD OVERLAY */
        .ch-ad-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0);backdrop-filter:blur(0);transition:background .35s,backdrop-filter .35s;pointer-events:none;opacity:0}
        .ch-ad-overlay.open{background:rgba(0,0,0,.85);backdrop-filter:blur(8px);pointer-events:all;opacity:1}
        .ch-ad-box{width:min(560px,calc(100vw - 32px));background:#0f0f13;border:1px solid rgba(255,255,255,.1);border-radius:20px;overflow:hidden;transform:scale(.88) translateY(24px);transition:transform .4s cubic-bezier(.22,1,.36,1);box-shadow:0 40px 80px rgba(0,0,0,.6)}
        .ch-ad-overlay.open .ch-ad-box{transform:scale(1) translateY(0)}
        .ch-ad-video{position:relative;aspect-ratio:16/9;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
        .ch-ad-bg{position:absolute;inset:0;background:linear-gradient(135deg,#0a0a1a,#1a0a2e,#0a1a0a);animation:adBg 4s ease-in-out infinite alternate}
        @keyframes adBg{from{background:linear-gradient(135deg,#0a0a1a,#1a0a2e,#0a1a0a)}to{background:linear-gradient(135deg,#1a0a0a,#2e1a00,#0a0a1a)}}
        .ch-ad-video::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.015) 2px,rgba(255,255,255,.015) 4px);pointer-events:none}
        .ch-ad-lbl{position:absolute;top:12px;left:12px;background:rgba(245,166,35,.9);color:#000;font-size:10px;font-weight:800;letter-spacing:.08em;padding:3px 8px;border-radius:5px;text-transform:uppercase;z-index:2}
        .ch-ad-skip{position:absolute;top:12px;right:12px;z-index:2}
        .ch-ad-skip-badge{background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 12px;font-family:var(--mono);font-size:12px;font-weight:700;color:rgba(255,255,255,.6)}
        .ch-ad-prog-wrap{position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,.1)}
        .ch-ad-prog{height:100%;background:linear-gradient(90deg,var(--gold),#ffd86e);transition:width .1s linear}
        .ch-ad-mock{position:relative;z-index:1;text-align:center}
        .ch-ad-mock .brand{font-size:32px;font-weight:800;letter-spacing:-.02em;background:linear-gradient(135deg,#fff,rgba(255,255,255,.6));-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:block;margin-bottom:8px}
        .ch-ad-mock .tag{font-size:13px;color:rgba(255,255,255,.4);letter-spacing:.08em;text-transform:uppercase}
        .ch-ad-bottom{padding:20px 24px 24px}
        .ch-ad-btop{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
        .ch-ad-reward{display:flex;align-items:center;gap:10px}
        .ch-ad-r-icon{width:38px;height:38px;border-radius:10px;background:var(--gold-glow);border:1px solid rgba(245,166,35,.3);display:flex;align-items:center;justify-content:center;font-size:18px}
        .ch-ad-r-text h4{font-size:14px;font-weight:700}
        .ch-ad-r-text p{font-size:11px;color:var(--muted);margin-top:1px}
        .ch-ad-timer{font-family:var(--mono);font-size:13px;color:var(--muted)}
        .ch-ad-timer b{color:var(--gold)}
        .ch-ad-hint{font-size:12px;color:var(--muted);text-align:center;padding:10px 0 0;line-height:1.6}
        .ch-ad-done{text-align:center}
        .ch-ad-done-icon{font-size:52px;display:block;margin-bottom:12px;animation:popIn .5s cubic-bezier(.22,1,.36,1) both}
        @keyframes popIn{from{transform:scale(0) rotate(-10deg);opacity:0}to{transform:scale(1);opacity:1}}
        .ch-ad-done h3{font-size:20px;font-weight:800;margin-bottom:6px}
        .ch-ad-done p{font-size:13px;color:var(--muted);margin-bottom:20px}
        .ch-credit-pill{display:inline-flex;align-items:center;gap:8px;background:var(--gold-glow);border:1px solid rgba(245,166,35,.35);border-radius:99px;padding:8px 20px;font-family:var(--mono);font-size:22px;font-weight:800;color:var(--gold);margin-bottom:20px;animation:glowPulse 1.5s ease infinite}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 0 rgba(245,166,35,0)}50%{box-shadow:0 0 20px rgba(245,166,35,.25)}}
        .ch-claim-btn{width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#f5a623,#c47f10);color:#0d0d0f;font-size:15px;font-weight:800;letter-spacing:.04em;border:none;cursor:pointer;font-family:'Sora',sans-serif;transition:transform .15s,opacity .15s}
        .ch-claim-btn:hover{opacity:.9;transform:translateY(-1px)}

        /* TOAST */
        .ch-toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(16px);background:#18181f;border:2px solid rgba(255,255,255,.15);border-radius:16px;padding:18px 28px;display:flex;align-items:center;gap:14px;font-size:14px;font-weight:600;color:#ffffff;box-shadow:0 12px 40px rgba(0,0,0,.8),0 4px 12px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .3s ease,transform .3s cubic-bezier(.22,1,.36,1);z-index:99999;white-space:nowrap;font-family:'Sora',sans-serif;max-width:calc(100vw - 32px)}
        .ch-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
        .ch-toast.ok{background:#0d2118;border-color:rgba(34,197,94,.7);box-shadow:0 12px 40px rgba(0,0,0,.8),0 0 0 4px rgba(34,197,94,.1)}
        .ch-toast.warn{background:#200d0d;border-color:rgba(239,68,68,.7);box-shadow:0 12px 40px rgba(0,0,0,.8),0 0 0 4px rgba(239,68,68,.1)}
        .ch-toast.bonus{background:#1e1200;border-color:rgba(245,166,35,.9);box-shadow:0 12px 40px rgba(0,0,0,.8),0 0 0 4px rgba(245,166,35,.15),0 0 32px rgba(245,166,35,.2)}

        /* RESPONSIVE */
        @media(max-width:580px){
          .ch-earn,.ch-2col{grid-template-columns:1fr}
          .ch-count{font-size:64px}
          .ch-days{gap:5px}
          .ch-day-dot{width:30px;height:30px;font-size:13px;border-radius:8px}
          .ch-tx-row{grid-template-columns:auto 1fr auto}
          .ch-tx-bal{display:none}
          .ch-ci-header{flex-direction:column}
        }
      `}</style>

      {/* ── AD OVERLAY ── */}
      <div className={`ch-ad-overlay${adOpen ? ' open' : ''}`}
        onClick={e => { if (e.target === e.currentTarget && adPhase === 'done') setAdOpen(false) }}>
        <div className="ch-ad-box">
          {/* Video Area */}
          <div className="ch-ad-video">
            <div className="ch-ad-bg" />
            <div className="ch-ad-lbl">Quảng cáo</div>
            <div className="ch-ad-skip">
              {adPhase === 'watching' && (
                <div className="ch-ad-skip-badge">Bỏ qua sau {adSec}s</div>
              )}
            </div>
            <div className="ch-ad-mock">
              <span className="brand">WebTruyen</span>
              <span className="tag">Đọc · Nghe · Tải offline</span>
            </div>
            <div className="ch-ad-prog-wrap">
              <div className="ch-ad-prog" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Bottom */}
          <div className="ch-ad-bottom">
            <div className="ch-ad-btop">
              <div className="ch-ad-reward">
                <div className="ch-ad-r-icon">🎁</div>
                <div className="ch-ad-r-text">
                  <h4>Phần thưởng</h4>
                  <p>{adSource === 'app' ? '+1.0' : '+0.5'} credit sau khi xem xong</p>
                </div>
              </div>
              {adPhase === 'watching' && (
                <div className="ch-ad-timer">Còn <b>{adSec}s</b></div>
              )}
            </div>

            {adPhase === 'watching' ? (
              <div className="ch-ad-hint">
                Xem hết video để nhận credit · Không được tắt sớm theo chính sách quảng cáo
              </div>
            ) : (
              <div className="ch-ad-done">
                <span className="ch-ad-done-icon">🎉</span>
                <h3>Xem xong rồi!</h3>
                <p>Nhấn nhận để cộng credit vào tài khoản của bạn</p>
                <div className="ch-credit-pill">
                  {adSource === 'app' ? '+1.0' : '+0.5'} credit
                </div>
                <button className="ch-claim-btn" onClick={claimCredit}>
                  ✓ NHẬN CREDIT NGAY
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div className={`ch-toast show${toast.isBonus ? ' bonus' : toast.ok ? ' ok' : ' warn'}`}>
          {toast.isBonus ? (
            <>
              <span style={{ fontSize: 28, flexShrink:0 }}>🎉</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#ffd166', marginBottom: 3, textShadow:'0 1px 4px rgba(0,0,0,.8)' }}>
                  STREAK 7 NGÀY — BONUS ĐẠT!
                </div>
                <div style={{ fontSize: 13, color: '#ffe49a', fontWeight: 600 }}>
                  {toast.msg}
                </div>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: 24, flexShrink:0 }}>{toast.ok ? '✅' : '⚠️'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginBottom: 2, textShadow:'0 1px 4px rgba(0,0,0,.8)' }}>
                  {toast.ok ? 'ĐIỂM DANH THÀNH CÔNG!' : 'CÓ LỖI XẢY RA'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>
                  {toast.msg}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PAGE ── */}
      <div className="ch-root">
        <div className="ch-page">

          {/* TOPBAR */}
          <div className="ch-topbar">
            <div className="ch-logo">Web<span>Truyen</span> · Credit Hub</div>
            <div className="ch-user">
              {user.image
                ? <img src={user.image} alt="" className="ch-avatar" />
                : <div className="ch-avatar">{user.name.charAt(0)}</div>
              }
              <span>{user.name}</span>
            </div>
          </div>

          {/* HERO */}
          <div className="ch-hero">
            <div className="ch-glow" />
            <div className="ch-hero-label"><div className="ch-dot" /> Số dư hiện tại</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:20, marginBottom:8 }}>
              <div className="ch-count">{usable}</div>
              <div className="ch-unit">lượt tải</div>
            </div>
            <div className="ch-sub">
              Số dư tích lũy: <b>{credits.toFixed(1)}</b> credits
              {pending > 0 && ` · ${pending.toFixed(1)} credit đang cộng dồn`}
            </div>
            <div className="ch-divider" />
            <div className="ch-stats">
              <div className="ch-stat">
                <div className="ch-stat-val">{user.chaptersRead.toLocaleString('vi')}</div>
                <div className="ch-stat-lbl">Chương đã đọc</div>
              </div>
              <div className="ch-stat">
                <div className="ch-stat-val">{videoCount}</div>
                <div className="ch-stat-lbl">Video đã xem</div>
              </div>
              <div className="ch-stat">
                <div className="ch-stat-val">{lv.icon} {lv.name}</div>
                <div className="ch-stat-lbl">Cấp độ</div>
              </div>
            </div>

            {/* ── CHECKIN INLINE TRONG HERO ── */}
            <div className="ch-divider" />
            <div className="ch-ci-header">
              <div>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:3 }}>🔥 Điểm danh hằng ngày</h3>
                <p style={{ fontSize:11, color:'var(--muted)' }}>Streak 7 ngày → bonus +3 credit</p>
              </div>
              <div className="ch-streak">🔥 Streak {streak} ngày</div>
            </div>

            <div className="ch-days" style={{ marginBottom:14 }}>
              {Array.from({ length: 7 }).map((_, i) => {
                const dayNum  = i + 1
                const isDone  = dayNum < streak || (dayNum === streak && checkedIn)
                const isToday = dayNum === streak && !checkedIn
                const isBonus = dayNum === 7
                const dotCls  = `ch-day-dot ${isDone ? 'done' : isToday ? 'today' : 'locked'}${isBonus && isDone ? ' bonus' : ''}`
                return (
                  <div key={i} className="ch-day">
                    <div className={`ch-day-lbl${isBonus ? ' bonus-lbl' : ''}`}>
                      {`Ngày ${dayNum}`}
                    </div>
                    <div className={dotCls} title={isBonus ? 'Ngày 7 — nhận bonus +3 credit!' : undefined}>
                      {isDone ? (isBonus ? '★' : '✓') : isToday ? '★' : isBonus ? '🎁' : '○'}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
              <p style={{ fontSize:12, color:'var(--muted)' }}>
                {streak < 7
                  ? <>Còn <b style={{ color:'var(--blue)' }}>{7 - streak} ngày</b> nữa để nhận bonus +3 credit!</>
                  : <>🎉 Bạn đang ở <b style={{ color:'var(--gold)' }}>Streak {streak}</b> — tiếp tục giữ chuỗi nhé!</>
                }
              </p>
              <button
                className="ch-btn gold"
                disabled={checkedIn || checkInLoading}
                onClick={doCheckIn}
              >
                {checkInLoading ? '⏳ Đang xử lý...' : checkedIn ? '✓ Đã điểm danh hôm nay' : '★ Điểm danh hôm nay (+0.5)'}
              </button>
            </div>
          </div>

          {/* EARN */}
          <div className="ch-sec">Kiếm credits</div>
          <div className="ch-earn">
            <div className="ch-earn-card">
              <div className="ch-card-top" style={{ background:'linear-gradient(90deg,var(--gold),transparent)' }} />
              <div className="ch-earn-icon">▶️</div>
              <div className="ch-earn-reward">+0.5</div>
              <h3>Xem Video (Web)</h3>
              <p>Xem 1 video rewarded để nhận 0.5 credit. Xem 2 lần là đủ 1 lượt tải.</p>
              <button className="ch-btn gold" onClick={() => openAd('web')}>▶ XEM NGAY</button>
            </div>
            <div className="ch-earn-card">
              <div className="ch-card-top" style={{ background:'linear-gradient(90deg,var(--blue),transparent)' }} />
              <div className="ch-badge">X2 TỐC ĐỘ</div>
              <div className="ch-earn-icon blue">📱</div>
              <div className="ch-earn-reward" style={{ color:'var(--blue)' }}>+1.0</div>
              <h3>Xem Video (App)</h3>
              <p>Trên App mỗi video nhận ngay 1.0 credit — gấp đôi tốc độ so với Web.</p>
              <button className="ch-btn ghost" onClick={() => openAd('app')}>▶ XEM (GIẢ LẬP APP)</button>
            </div>
          </div>

          {/* ACHIEVEMENT + APP */}
          <div className="ch-sec">Thành tích & Đặc quyền App</div>
          <div className="ch-2col">
            <div className="ch-achv">
              <div className="ch-lv-row">
                <div className="ch-lv-badge">{lv.icon}</div>
                <div className="ch-lv-info">
                  <h3>{lv.name}</h3>
                  <p>Cấp {lv.idx + 1} · {user.chaptersRead.toLocaleString('vi')} chương đã đọc</p>
                </div>
              </div>
              {lv.next && (
                <div className="ch-xp-wrap">
                  <div className="ch-xp-lbl">
                    <span>{user.chaptersRead.toLocaleString('vi')} / {lv.next.min.toLocaleString('vi')} chương</span>
                    <span>→ {lv.next.name}</span>
                  </div>
                  <div className="ch-xp-bar">
                    <div className="ch-xp-fill" style={{ width:`${lv.pct}%` }} />
                  </div>
                </div>
              )}
              <div className="ch-chips">
                <div className="ch-chip">💬 {user.commentsCount} bình luận</div>
                <div className="ch-chip">⭐ {user.reviewsCount} đánh giá</div>
                <div className="ch-chip">🏅 {user.nominationsCount} đề cử</div>
              </div>
            </div>

            <div className="ch-app">
              <h3 style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Đặc quyền App</h3>
              <p style={{ fontSize:12, color:'var(--muted)' }}>So sánh tốc độ kiếm credit</p>
              <table className="ch-cmp">
                <thead>
                  <tr><th>Hành động</th><th></th><th>Credit</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Xem video</td>
                    <td><span style={{ fontSize:11, color:'var(--muted)' }}>Web</span></td>
                    <td><span style={{ color:'var(--muted)', fontFamily:'var(--mono)', fontWeight:700 }}>+0.5</span></td>
                  </tr>
                  <tr>
                    <td>Xem video</td>
                    <td><span style={{ fontSize:11, color:'var(--gold)' }}>App</span></td>
                    <td>
                      <span style={{ color:'var(--gold)', fontFamily:'var(--mono)', fontWeight:700 }}>+1.0</span>
                      <span className="ch-x2">X2</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Điểm danh</td><td></td>
                    <td><span style={{ color:'var(--gold)', fontFamily:'var(--mono)', fontWeight:700 }}>+0.5</span></td>
                  </tr>
                  <tr style={{ borderBottom:'none' }}>
                    <td>Tải 1 chương</td><td></td>
                    <td><span style={{ color:'var(--red)', fontFamily:'var(--mono)', fontWeight:700 }}>−1.0</span></td>
                  </tr>
                </tbody>
              </table>
              <button className="ch-btn gold full">📱 Tải App · Nhận X2</button>
            </div>
          </div>

          {/* STORY REQUESTS */}
          {storyRequests.length > 0 && <>
            <div className="ch-sec">Yêu cầu truyện của bạn</div>
            <div className="ch-card" style={{ marginBottom:24 }}>
              <div className="ch-req-list">
                {storyRequests.map(r => (
                  <div key={r.id} className="ch-req-item">
                    <div className="ch-req-icon">📖</div>
                    <div className="ch-req-info">
                      <h4>{r.title}</h4>
                      <p>Yêu cầu ngày {new Date(r.createdAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div className={`ch-status ${r.status}`}>
                      {r.status === 'PENDING'  && '⏳ Đang xử lý'}
                      {r.status === 'DONE'     && '✓ Hoàn thành'}
                      {r.status === 'REJECTED' && '✕ Từ chối'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* RULES */}
          <div className="ch-sec">Quy tắc & Hướng dẫn</div>
          <div className="ch-card">
            <div className="ch-rules">
              {[
                <>Cần ít nhất <b style={{color:'var(--gold)'}}>1.0 credit</b> để tải 1 chương. Số lẻ (vd 0.5) được giữ và cộng dồn tự động.</>,
                <>Credit <b style={{color:'var(--gold)'}}>không hết hạn</b> — tích lũy thoải mái, dùng khi nào cũng được.</>,
                <>Web: xem 2 video = 1 lượt tải. App: xem 1 video = 1 lượt (nhanh gấp đôi).</>,
                <>Điểm danh 7 ngày liên tiếp nhận <b style={{color:'var(--blue)'}}>bonus +1 lượt</b>.</>,
                <>Mọi giao dịch ghi log minh bạch trong bảng Lịch Sử — không lo bị móc túi.</>,
              ].map((rule, i) => (
                <div key={i} className="ch-rule">
                  <div className="ch-rule-num">{i + 1}</div>
                  <div>{rule}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AUDIT LOG */}
          <div className="ch-sec">Lịch sử giao dịch</div>
          <div className="ch-card">
            <div className="ch-filter">
              {(['all','add','spend'] as const).map(f => (
                <button
                  key={f}
                  className={`ch-fbtn${filter === f ? ' on' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Tất cả' : f === 'add' ? 'Nhận' : 'Dùng'}
                </button>
              ))}
            </div>

            {filteredTx.length === 0 ? (
              <div className="ch-empty">Chưa có giao dịch nào</div>
            ) : (
              filteredTx.map(t => {
                const isAdd = t.type !== 'SPEND'
                return (
                  <div key={t.id} className="ch-tx-row">
                    <div className={`ch-tx-icon ${isAdd ? 'add' : 'spend'}`}>
                      {t.type === 'ADD_APP' ? '📱' : t.type === 'ADD_WEB' ? '▶️' : '📥'}
                    </div>
                    <div className="ch-tx-desc">
                      <h4>{t.note || (isAdd ? 'Nhận credit' : 'Tải chương')}</h4>
                      <p>{fmtDate(t.createdAt)}</p>
                    </div>
                    <div className={`ch-tx-amt ${isAdd ? 'pos' : 'neg'}`}>
                      {isAdd ? '+' : ''}{t.amount.toFixed(1)}
                    </div>
                    <div className="ch-tx-bal">Dư: {t.balanceAfter.toFixed(1)}</div>
                  </div>
                )
              })
            )}
          </div>

          <div style={{ textAlign:'center', fontSize:11, color:'var(--muted)', letterSpacing:'.04em' }}>
            Credit <span style={{ color:'rgba(245,166,35,.5)' }}>không hết hạn</span> · Mọi giao dịch được lưu trữ an toàn
          </div>

        </div>
      </div>
    </>
  )
}
