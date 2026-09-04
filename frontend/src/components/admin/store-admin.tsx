'use client';

import React, { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { Order, PlayKit } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

export function StoreAdmin({
  orders = [],
  playKits = [],
  onUpdateOrderStatus,
  onAddProduct,
  onUpdateStock
}: {
  orders: Order[];
  playKits: PlayKit[];
  onUpdateOrderStatus: (orderId: number, status: string) => Promise<void>;
  onAddProduct?: (data: Partial<PlayKit>) => Promise<void>;
  onUpdateStock?: (kitId: number, stock: number) => Promise<void>;
}) {
  const [orderStatuses, setOrderStatuses] = useState<Record<number, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKit, setNewKit] = useState({
    title: '',
    category: 'Practical Life',
    price: 30,
    stock: 10,
    description: ''
  });

  const handleStatusChange = (orderId: number, newStatus: string) => {
    setOrderStatuses((prev) => ({ ...prev, [orderId]: newStatus }));
  };

  const saveStatus = async (orderId: number) => {
    const status = orderStatuses[orderId];
    if (status) {
      await onUpdateOrderStatus(orderId, status);
    }
  };

  const handleCreateProduct = async () => {
    if (!newKit.title || !onAddProduct) return;
    await onAddProduct(newKit);
    setShowAddModal(false);
    setNewKit({ title: '', category: 'Practical Life', price: 30, stock: 10, description: '' });
  };

  return (
    <section className="mt-7 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      {/* Orders to Ship */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-[#2D3748]">Orders to ship</h3>
            <p className="mt-1 text-sm text-slate-500">
              Keep every little package moving to its family.
            </p>
          </div>
          <Package className="text-[#FA8C42]" size={24} />
        </div>

        <div className="mt-6 space-y-3">
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No active orders</p>
          ) : (
            orders.map((ord) => {
              const currentStatus = orderStatuses[ord.id] || ord.shipping_status || 'New';
              return (
                <div
                  key={ord.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#E7F4F0] p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#2D3748]">
                      #RM-{ord.id + 1040} · {ord.parent_name || 'Parent'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ord.items?.length || 1} items · ${ord.total_amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#2D3748] outline-none cursor-pointer"
                    >
                      <option value="New">New</option>
                      <option value="Packed">Packed</option>
                      <option value="Shipped">Shipped</option>
                    </select>
                    {orderStatuses[ord.id] && orderStatuses[ord.id] !== ord.shipping_status && (
                      <button
                        onClick={() => saveStatus(ord.id)}
                        className="rounded-lg bg-[#2A9D8F] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#238276] cursor-pointer"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Kit Stock */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg text-[#2D3748]">Kit stock</h3>
              <p className="mt-1 text-sm text-slate-500">{playKits.length} active products</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 rounded-xl bg-[#E7F4F0] px-3 py-2 text-xs font-semibold text-[#2A9D8F] hover:bg-[#d6ece6] transition cursor-pointer"
            >
              <Plus size={14} /> Add product
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {playKits.map((p) => {
              const percentage = Math.min((p.stock / 20) * 100, 100);
              const isLow = p.stock < 6;
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-[#2D3748]">{p.title}</span>
                    <div className="flex items-center gap-2">
                      <span className={isLow ? 'font-semibold text-[#FA8C42]' : 'text-slate-500'}>
                        {p.stock} in stock
                      </span>
                      {onUpdateStock && (
                        <button
                          onClick={() => onUpdateStock(p.id, p.stock + 5)}
                          title="Restock +5"
                          className="text-xs text-[#2A9D8F] hover:underline"
                        >
                          +5
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isLow ? 'bg-[#FA8C42]' : 'bg-[#2A9D8F]'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showAddModal && (
        <Modal title="Add Play Kit" onClose={() => setShowAddModal(false)}>
          <div className="space-y-4">
            <Field
              label="Product Title"
              placeholder="e.g. Wooden Counting Beads"
              value={newKit.title}
              onChange={(e) => setNewKit({ ...newKit, title: e.target.value })}
            />
            <Field
              label="Category"
              placeholder="Practical Life / Sensorial / Math"
              value={newKit.category}
              onChange={(e) => setNewKit({ ...newKit, category: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Price ($)"
                type="number"
                placeholder="28"
                value={String(newKit.price)}
                onChange={(e) => setNewKit({ ...newKit, price: Number(e.target.value) })}
              />
              <Field
                label="Stock"
                type="number"
                placeholder="10"
                value={String(newKit.stock)}
                onChange={(e) => setNewKit({ ...newKit, stock: Number(e.target.value) })}
              />
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Description
              <textarea
                value={newKit.description}
                onChange={(e) => setNewKit({ ...newKit, description: e.target.value })}
                placeholder="Short description of the materials..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#2A9D8F]"
              />
            </label>
            <Button onClick={handleCreateProduct} className="mt-2 w-full py-3">
              Save Product
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
