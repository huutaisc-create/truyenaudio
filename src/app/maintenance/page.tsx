export const metadata = {
    title: 'Bảo trì hệ thống — MyTruyenAudio',
    description: 'Website đang tạm thời bảo trì. Vui lòng quay lại sau.',
};

export default function MaintenancePage() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(232,88,10,0.12) 0%, transparent 60%), #0d0905',
            margin: 0,
            fontFamily: 'system-ui, sans-serif',
        }}>
            {/* Icon */}
            <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'rgba(232,88,10,0.12)',
                border: '1px solid rgba(232,88,10,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '2rem',
                fontSize: 36,
            }}>
                🔧
            </div>

            {/* Site name */}
            <div style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#E8580A',
                marginBottom: '1rem',
                opacity: 0.8,
            }}>
                MyTruyenAudio
            </div>

            {/* Heading */}
            <h1 style={{
                fontSize: 'clamp(1.6rem, 5vw, 2.5rem)',
                fontWeight: 900,
                color: '#f5efe8',
                margin: '0 0 1rem',
                lineHeight: 1.2,
            }}>
                Đang bảo trì hệ thống
            </h1>

            {/* Subtext */}
            <p style={{
                fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
                color: 'rgba(245,239,232,0.55)',
                maxWidth: 480,
                lineHeight: 1.7,
                margin: '0 0 2.5rem',
            }}>
                Website đang được nâng cấp để mang lại trải nghiệm tốt hơn cho bạn.
                Vui lòng quay lại sau ít phút.
            </p>

            {/* Divider */}
            <div style={{
                width: 48,
                height: 2,
                background: 'linear-gradient(90deg, transparent, #E8580A, transparent)',
                marginBottom: '2.5rem',
                borderRadius: 2,
            }} />

            {/* Info row */}
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                    { icon: '🎧', label: 'Truyện Audio' },
                    { icon: '📚', label: 'Kho truyện lớn' },
                    { icon: '⭐', label: 'Miễn phí' },
                ].map(item => (
                    <div key={item.label} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: 13,
                        color: 'rgba(245,239,232,0.4)',
                        fontWeight: 600,
                    }}>
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
