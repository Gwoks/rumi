import React from 'react';
import { ProductCard } from '@/components/public/product-card';
import { PlayKit } from '@/lib/api';

export function ShopView({
  products = [],
  onAddToCart,
  onViewProduct
}: {
  products: PlayKit[];
  onAddToCart: (product: PlayKit) => void;
  onViewProduct?: (product: PlayKit) => void;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#2D3748]">The RUMI shelf</h3>
          <p className="mt-1 text-sm text-slate-500">Thoughtful materials for home discovery.</p>
        </div>
        <span className="text-sm font-medium text-slate-500">{products.length} kits available</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onClick={() => onViewProduct ? onViewProduct(p) : onAddToCart(p)}
            onAdd={() => onAddToCart(p)}
          />
        ))}
      </div>
    </section>
  );
}
