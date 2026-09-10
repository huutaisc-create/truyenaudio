import {
  getAffiliateCampaigns,
  getAffiliateConfig,
  getAffiliateStats,
} from '@/actions/admin';
import CreateCampaignButton from './CreateCampaignButton';
import CampaignEditButton from './CampaignEditButton';
import DeleteCampaignButton from './DeleteCampaignButton';
import AffiliateConfigForm from './AffiliateConfigForm';

export const dynamic = 'force-dynamic';

export default async function AffiliatePage() {
  const [campaigns, config, stats] = await Promise.all([
    getAffiliateCampaigns(),
    getAffiliateConfig(),
    getAffiliateStats(),
  ]);

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Affiliate Popup</h1>

      {/* Cấu hình */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-zinc-200">Cấu hình hiển thị</h2>
        <AffiliateConfigForm config={JSON.parse(JSON.stringify(config))} />
      </section>

      {/* Chiến dịch */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-zinc-200">Chiến dịch ({campaigns.length})</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c: any) => {
            const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : '0.0';
            return (
              <div key={c.id} className={`rounded-xl ring-1 p-4 bg-white dark:bg-zinc-800 ${c.isActive ? 'ring-orange-300 dark:ring-orange-500/40' : 'ring-gray-200 dark:ring-zinc-700 opacity-60'}`}>
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt={c.name} className="w-full h-28 object-cover rounded-lg mb-3 bg-gray-100 dark:bg-zinc-700" />
                ) : (
                  <div className="w-full h-28 rounded-lg mb-3 bg-gray-100 dark:bg-zinc-700 flex items-center justify-center text-xs text-gray-400">Chưa có ảnh</div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{c.name}</p>
                  <span className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 ${c.isActive ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-gray-100 text-gray-500'}`}>{c.isActive ? 'Bật' : 'Tắt'}</span>
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{c.targetUrl}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500 dark:text-zinc-400">
                  <span>Tỷ trọng: <b className="text-gray-700 dark:text-zinc-200">{c.weight}</b></span>
                  <span>Hiện: {c.impressions}</span>
                  <span>Click: {c.clicks}</span>
                  <span>CTR: {ctr}%</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <CampaignEditButton campaign={JSON.parse(JSON.stringify(c))} />
                  <DeleteCampaignButton id={c.id} name={c.name} />
                </div>
              </div>
            );
          })}
          <CreateCampaignButton />
        </div>
      </section>

      {/* Thống kê 7 ngày */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-zinc-200">Thống kê 7 ngày gần nhất</h2>
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 dark:ring-zinc-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">
              <tr>
                <th className="text-left font-medium px-4 py-2">Chiến dịch</th>
                <th className="text-right font-medium px-4 py-2">Hiện (7n)</th>
                <th className="text-right font-medium px-4 py-2">Click (7n)</th>
                <th className="text-right font-medium px-4 py-2">CTR (7n)</th>
                <th className="text-right font-medium px-4 py-2">Tổng hiện</th>
                <th className="text-right font-medium px-4 py-2">Tổng click</th>
              </tr>
            </thead>
            <tbody>
              {stats.campaigns.map((c: any) => {
                const r = (stats.recentMap as any)[c.id] || { imp: 0, clk: 0 };
                const ctr = r.imp > 0 ? ((r.clk / r.imp) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={c.id} className="border-t border-gray-100 dark:border-zinc-700/60">
                    <td className="px-4 py-2 text-gray-800 dark:text-zinc-200">{c.name}</td>
                    <td className="px-4 py-2 text-right">{r.imp}</td>
                    <td className="px-4 py-2 text-right">{r.clk}</td>
                    <td className="px-4 py-2 text-right">{ctr}%</td>
                    <td className="px-4 py-2 text-right text-gray-400">{c.impressions}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{c.clicks}</td>
                  </tr>
                );
              })}
              {stats.campaigns.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Chưa có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
