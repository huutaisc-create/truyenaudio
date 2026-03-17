export default function Loading() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#faf7f2' }}>
            <div style={{
                width: 40,
                height: 40,
                border: '3px solid rgba(249,115,22,0.2)',
                borderTopColor: '#f97316',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 14, color: '#a08470' }}>Đang tải...</p>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
