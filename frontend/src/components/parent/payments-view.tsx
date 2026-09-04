import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Order } from '@/lib/api';

export function PaymentsView({
  orders = [],
  onDownloadAll
}: {
  orders: Order[];
  onDownloadAll?: () => void;
}) {
  const formatStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-[#E7F4F0] text-[#2A9D8F]';
      case 'pending':
        return 'bg-[#FFF7CF] text-[#8D7100]';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg text-[#2D3748]">Payment records</h3>
          <p className="mt-1 text-sm text-slate-500">Your tuition and play kit receipts.</p>
        </div>
        <button
          onClick={onDownloadAll}
          className="rounded-xl bg-[#E7F4F0] px-3.5 py-2 text-sm font-semibold text-[#2A9D8F] hover:bg-[#d6ece6] transition cursor-pointer"
        >
          Download all
        </button>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="pb-3 font-semibold">Description</th>
              <th className="pb-3 font-semibold">Date</th>
              <th className="pb-3 font-semibold">Amount</th>
              <th className="pb-3 font-semibold">Status</th>
              <th className="pb-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No payment records found.
                </td>
              </tr>
            ) : (
              orders.map((ord) => {
                const itemDesc = ord.items && ord.items.length > 0
                  ? ord.items.map(i => `${i.quantity}x ${i.kit_title || 'Play kit'}`).join(', ')
                  : `Tuition & workshop reservation (#RM-${ord.id + 1040})`;

                const formattedDate = ord.created_at
                  ? new Date(ord.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'Recent';

                return (
                  <tr key={ord.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-5 font-semibold text-[#2D3748]">{itemDesc}</td>
                    <td className="py-5 text-slate-500">{formattedDate}</td>
                    <td className="py-5 font-medium text-slate-800">${ord.total_amount.toFixed(2)}</td>
                    <td className="py-5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${formatStatus(ord.payment_status)}`}>
                        {ord.payment_status}
                      </span>
                    </td>
                    <td className="py-5 text-right">
                      <button className="text-[#2A9D8F] hover:text-[#238276] cursor-pointer">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
