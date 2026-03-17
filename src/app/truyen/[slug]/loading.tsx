export default function Loading() {
    return (
        <div className="min-h-screen bg-[#fdf6ee]">
            {/* Navbar skeleton */}
            <div className="h-14 bg-white border-b border-orange-100 px-4 flex items-center gap-4">
                <div className="w-32 h-6 rounded-md bg-orange-100 animate-pulse" />
                <div className="flex-1" />
                <div className="w-48 h-8 rounded-full bg-orange-100 animate-pulse" />
                <div className="w-20 h-8 rounded-md bg-orange-100 animate-pulse" />
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Breadcrumb */}
                <div className="flex gap-2 mb-6">
                    <div className="w-16 h-4 rounded bg-orange-100 animate-pulse" />
                    <div className="w-4 h-4 rounded bg-orange-100 animate-pulse" />
                    <div className="w-32 h-4 rounded bg-orange-100 animate-pulse" />
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Cover image skeleton */}
                    <div className="flex-shrink-0">
                        <div
                            className="w-48 h-64 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 animate-pulse shadow-lg"
                            style={{ animationDelay: '0.1s' }}
                        />
                    </div>

                    {/* Story info skeleton */}
                    <div className="flex-1 space-y-4">
                        {/* Title */}
                        <div className="w-3/4 h-8 rounded-lg bg-orange-200 animate-pulse" style={{ animationDelay: '0.15s' }} />
                        <div className="w-1/2 h-8 rounded-lg bg-orange-200 animate-pulse" style={{ animationDelay: '0.2s' }} />

                        {/* Author */}
                        <div className="w-40 h-5 rounded bg-orange-100 animate-pulse" style={{ animationDelay: '0.25s' }} />

                        {/* Tags */}
                        <div className="flex gap-2 flex-wrap">
                            {[80, 100, 70, 90].map((w, i) => (
                                <div
                                    key={i}
                                    className="h-7 rounded-full bg-orange-100 animate-pulse"
                                    style={{ width: w, animationDelay: `${0.3 + i * 0.05}s` }}
                                />
                            ))}
                        </div>

                        {/* Stats row */}
                        <div className="flex gap-6 py-3 border-y border-orange-100">
                            {[60, 80, 70].map((w, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="w-8 h-4 rounded bg-orange-100 animate-pulse" style={{ animationDelay: `${0.4 + i * 0.05}s` }} />
                                    <div className={`h-5 rounded bg-orange-200 animate-pulse`} style={{ width: w, animationDelay: `${0.45 + i * 0.05}s` }} />
                                </div>
                            ))}
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <div className="w-32 h-10 rounded-lg bg-orange-400 animate-pulse opacity-60" style={{ animationDelay: '0.5s' }} />
                            <div className="w-32 h-10 rounded-lg bg-orange-200 animate-pulse" style={{ animationDelay: '0.55s' }} />
                            <div className="w-10 h-10 rounded-lg bg-orange-100 animate-pulse" style={{ animationDelay: '0.6s' }} />
                        </div>
                    </div>
                </div>

                {/* Description skeleton */}
                <div className="mt-8 space-y-3">
                    <div className="w-24 h-6 rounded bg-orange-200 animate-pulse" />
                    {[100, 95, 88, 92, 70].map((w, i) => (
                        <div
                            key={i}
                            className="h-4 rounded bg-orange-100 animate-pulse"
                            style={{ width: `${w}%`, animationDelay: `${0.6 + i * 0.05}s` }}
                        />
                    ))}
                </div>

                {/* Chapter list skeleton */}
                <div className="mt-8">
                    <div className="w-32 h-6 rounded bg-orange-200 animate-pulse mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-10 rounded-lg bg-orange-50 border border-orange-100 animate-pulse"
                                style={{ animationDelay: `${0.7 + i * 0.03}s` }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                .animate-pulse {
                    animation: pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}</style>
        </div>
    );
}
