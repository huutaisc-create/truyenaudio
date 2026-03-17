export default function Loading() {
    return (
        <div className="min-h-screen bg-[#fdf6ee]">
            {/* Top bar */}
            <div className="h-14 bg-white border-b border-orange-100 px-4 flex items-center gap-4 sticky top-0 z-10">
                <div className="w-8 h-8 rounded-lg bg-orange-100 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                    <div className="w-48 h-4 rounded bg-orange-200 animate-pulse" />
                    <div className="w-32 h-3 rounded bg-orange-100 animate-pulse" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-orange-100 animate-pulse" />
                <div className="w-8 h-8 rounded-lg bg-orange-100 animate-pulse" />
            </div>

            {/* Chapter title */}
            <div className="max-w-3xl mx-auto px-4 pt-10 pb-4 text-center space-y-3">
                <div className="w-24 h-4 rounded bg-orange-100 animate-pulse mx-auto" />
                <div className="w-2/3 h-7 rounded-lg bg-orange-200 animate-pulse mx-auto" style={{ animationDelay: '0.1s' }} />
                <div className="w-8 h-1 rounded-full bg-orange-300 animate-pulse mx-auto" style={{ animationDelay: '0.15s' }} />
            </div>

            {/* Content lines */}
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
                {[
                    95, 100, 88, 92, 97,
                    40,
                    100, 93, 87, 96, 91, 98,
                    55,
                    94, 89, 100, 85, 92, 96,
                    35,
                    91, 97, 88, 100, 93,
                    60,
                    96, 84, 99, 90, 95,
                ].map((w, i) => (
                    <div
                        key={i}
                        className={`h-4 rounded bg-orange-100 animate-pulse ${w < 50 ? 'mt-5' : ''}`}
                        style={{
                            width: `${w}%`,
                            animationDelay: `${0.02 * i}s`,
                        }}
                    />
                ))}
            </div>

            {/* Bottom nav skeleton */}
            <div className="max-w-3xl mx-auto px-4 py-8 flex justify-between items-center">
                <div className="w-28 h-10 rounded-lg bg-orange-100 animate-pulse" />
                <div className="w-10 h-10 rounded-full bg-orange-200 animate-pulse" />
                <div className="w-28 h-10 rounded-lg bg-orange-400 animate-pulse opacity-60" />
            </div>

            {/* Floating book icon animation */}
            <div className="fixed bottom-8 right-8 pointer-events-none">
                <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500 shadow-lg shadow-orange-200 flex items-center justify-center animate-bounce">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-300 animate-ping" />
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.35; }
                }
                .animate-pulse {
                    animation: pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.8,0,1,1); }
                    50% { transform: translateY(-8px); animation-timing-function: cubic-bezier(0,0,0.2,1); }
                }
                .animate-bounce {
                    animation: bounce 1.2s infinite;
                }
                @keyframes ping {
                    75%, 100% { transform: scale(1.8); opacity: 0; }
                }
                .animate-ping {
                    animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
                }
            `}</style>
        </div>
    );
}
