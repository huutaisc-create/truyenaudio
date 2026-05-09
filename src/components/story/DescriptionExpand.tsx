'use client';

import { useState } from 'react';

export default function DescriptionExpand({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p className={`text-[15px] text-[#d4ccc4] leading-relaxed whitespace-pre-line ${!expanded ? 'line-clamp-3' : ''}`}>
        {text}
      </p>
      <button
        onClick={() => setExpanded(v => !v)}
        className="mt-2 text-[#e8580a] text-[14px] font-semibold"
      >
        {expanded ? 'Thu gọn ▲' : 'Xem thêm ▼'}
      </button>
    </div>
  );
}
