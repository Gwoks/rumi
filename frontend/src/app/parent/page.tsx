'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { CircleUserRound, ChevronDown, ShoppingCart } from 'lucide-react';
import { ParentDashboardFrame } from '@/components/parent/dashboard-frame';
import { ParentOverview } from '@/components/parent/parent-overview';
import { GalleryView } from '@/components/parent/gallery-view';
import { AssessmentView } from '@/components/parent/assessment-view';
import { PaymentsView } from '@/components/parent/payments-view';
import { ShopView } from '@/components/parent/shop-view';
import { CartButton } from '@/components/parent/cart-button';
import { CheckoutModal } from '@/components/parent/checkout-modal';
import { Lightbox } from '@/components/ui/lightbox';
import { Toast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { api, Child, Assessment, Photo, PlayKit, Order } from '@/lib/api';

export default function ParentPage() {
  const router = useRouter();
  const { user, loading: authLoading, childrenList, selectedChild, setSelectedChild, switchDemoUser } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('Overview');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [playKits, setPlayKits] = useState<PlayKit[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<{ product: PlayKit; qty: number }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const flashToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // Auto-login fallback for preview convenience if accessed directly
  useEffect(() => {
    if (!authLoading && !user) {
      switchDemoUser('parent');
    }
  }, [authLoading, user, switchDemoUser]);

  // Load child-specific data (assessments, photos) whenever selectedChild changes
  const loadChildData = useCallback(async (childId: number) => {
    try {
      const [assessRes, photosRes] = await Promise.all([
        api.assessments.list(childId),
        api.photos.list(childId)
      ]);
      setAssessments(assessRes.assessments);
      setPhotos(photosRes.photos);
    } catch (err) {
      console.error('Failed to load child data:', err);
    }
  }, []);

  // Load global parent data (kits, orders)
  const loadParentData = useCallback(async () => {
    try {
      const [kitsRes, ordersRes] = await Promise.all([
        api.playKits.list(),
        api.orders.list()
      ]);
      setPlayKits(kitsRes.play_kits);
      setOrders(ordersRes.orders);
    } catch (err) {
      console.error('Failed to load parent data:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedChild) {
      loadChildData(selectedChild.id);
    }
  }, [selectedChild, loadChildData]);

  useEffect(() => {
    if (user) {
      loadParentData();
    }
  }, [user, loadParentData]);

  const handleAddToCart = (product: PlayKit) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    flashToast(`${product.title} added to your bag`);
  };

  const handleOrderSubmit = async () => {
    if (cart.length === 0) return;
    setIsSubmittingOrder(true);
    try {
      const items = cart.map((i) => ({
        kit_id: i.product.id,
        quantity: i.qty,
        price: i.product.price
      }));
      const totalAmount = cart.reduce((sum, i) => sum + i.product.price * i.qty, 0);

      await api.orders.create({ items, total_amount: totalAmount });
      setCart([]);
      await loadParentData();
      flashToast('Order confirmed — thank you for bringing wonder home!');
    } catch (err: any) {
      flashToast(err.message || 'Failed to place order');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const currentChildName = selectedChild?.name || 'Amina';

  return (
    <ParentDashboardFrame activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Header section with Child switcher and bag button */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-slate-500 font-medium">Your family space</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#2D3748]">
            {currentChildName}&apos;s RUMI journey
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Child Picker */}
          {childrenList.length > 1 ? (
            <div className="relative">
              <select
                value={selectedChild?.id || ''}
                onChange={(e) => {
                  const found = childrenList.find((c) => c.id === Number(e.target.value));
                  if (found) setSelectedChild(found);
                }}
                className="appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-8 text-sm font-semibold text-[#2D3748] outline-none shadow-sm cursor-pointer"
              >
                {childrenList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.class_group})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-2.5 top-3.5 text-slate-400"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D3748] shadow-sm">
              <CircleUserRound size={17} className="text-[#2A9D8F]" />
              <span>{currentChildName}</span>
              <span className="text-xs text-slate-400">({selectedChild?.class_group || 'Saffron'})</span>
            </div>
          )}

          {/* Cart Trigger */}
          <button
            onClick={() => setActiveTab('Shop')}
            aria-label="Open shop"
            className="relative grid h-11 w-11 place-items-center rounded-xl bg-[#2A9D8F] text-white shadow-sm hover:bg-[#238276] transition cursor-pointer"
          >
            <ShoppingCart size={18} />
            {cartItemCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#FA8C42] text-[10px] font-bold text-white shadow-sm">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-200 pb-px">
        {['Overview', 'Gallery', 'Assessment', 'Payments', 'Shop'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap border-b-2 px-4 pb-3 text-sm font-semibold transition cursor-pointer ${
              activeTab === tab
                ? 'border-[#2A9D8F] text-[#2A9D8F]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <ParentOverview
          childName={currentChildName}
          photos={photos}
          onTabChange={setActiveTab}
          onOpenPhoto={(idx) => setLightboxIndex(idx)}
        />
      )}

      {activeTab === 'Gallery' && (
        <GalleryView
          photos={photos}
          childName={currentChildName}
          onOpenLightbox={(idx) => setLightboxIndex(idx)}
        />
      )}

      {activeTab === 'Assessment' && (
        <AssessmentView assessments={assessments} childName={currentChildName} />
      )}

      {activeTab === 'Payments' && (
        <PaymentsView
          orders={orders}
          onDownloadAll={() => flashToast('Payment records exported')}
        />
      )}

      {activeTab === 'Shop' && (
        <ShopView
          products={playKits}
          onAddToCart={handleAddToCart}
          onViewProduct={(p) => {
            handleAddToCart(p);
            setIsCheckoutOpen(true);
          }}
        />
      )}

      {/* Lightbox Modal for Gallery */}
      <Lightbox
        items={photos}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={(idx) => setLightboxIndex(idx)}
      />

      {/* Floating Bag Button */}
      <AnimatePresence>
        {cartItemCount > 0 && activeTab !== 'Shop' && (
          <CartButton
            count={cartItemCount}
            total={cartTotal}
            onClick={() => setIsCheckoutOpen(true)}
          />
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <CheckoutModal
            total={cartTotal}
            isSubmitting={isSubmittingOrder}
            onClose={() => setIsCheckoutOpen(false)}
            onDone={handleOrderSubmit}
          />
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && <Toast message={toastMessage} />}
      </AnimatePresence>
    </ParentDashboardFrame>
  );
}
