'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { AdminDashboardFrame } from '@/components/admin/admin-frame';
import { AdminOperations } from '@/components/admin/admin-operations';
import { StudentDirectory } from '@/components/admin/student-directory';
import { AdminAssessmentForm } from '@/components/admin/admin-assessment-form';
import { BatchPhotoUploader } from '@/components/admin/batch-photo-uploader';
import { StoreAdmin } from '@/components/admin/store-admin';
import { Toast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { api, Child, AdminMetrics, Order, PlayKit } from '@/lib/api';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, switchDemoUser } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('Operations');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [students, setStudents] = useState<Child[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [playKits, setPlayKits] = useState<PlayKit[]>([]);
  const [toastMessage, setToastMessage] = useState('');

  const flashToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // Auto-switch to admin role for preview convenience
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      switchDemoUser('admin');
    }
  }, [authLoading, user, switchDemoUser]);

  const loadAdminData = useCallback(async () => {
    try {
      const [metricsRes, studentsRes, ordersRes, kitsRes] = await Promise.all([
        api.metrics.get().catch(() => ({ metrics: null })),
        api.children.list().catch(() => ({ children: [] })),
        api.orders.list().catch(() => ({ orders: [] })),
        api.playKits.list().catch(() => ({ play_kits: [] }))
      ]);

      if (metricsRes.metrics) setMetrics(metricsRes.metrics);
      setStudents(studentsRes.children);
      setOrders(ordersRes.orders);
      setPlayKits(kitsRes.play_kits);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminData();
    }
  }, [user, loadAdminData]);

  const handleSaveAssessment = async (data: { child_id: number; domain: string; score: number; notes: string }) => {
    try {
      await api.assessments.create(data);
      flashToast('Assessment successfully logged to student portfolio');
    } catch (err: any) {
      flashToast(err.message || 'Failed to save assessment');
    }
  };

  const handleUploadPhotos = async (childIds: number[], photoUrls: string[], caption: string) => {
    try {
      await api.photos.uploadBatch({
        child_ids: childIds,
        photo_urls: photoUrls,
        caption
      });
      flashToast(`Successfully tagged & uploaded photos to ${childIds.length} children`);
    } catch (err: any) {
      flashToast(err.message || 'Failed to upload photos');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      await api.orders.updateStatus(orderId, { shipping_status: status });
      await loadAdminData();
      flashToast(`Order #RM-${orderId + 1040} status updated to ${status}`);
    } catch (err: any) {
      flashToast(err.message || 'Failed to update order status');
    }
  };

  const handleAddProduct = async (productData: Partial<PlayKit>) => {
    try {
      await api.playKits.create(productData);
      await loadAdminData();
      flashToast(`Play kit "${productData.title}" added to store`);
    } catch (err: any) {
      flashToast(err.message || 'Failed to add product');
    }
  };

  const handleUpdateStock = async (kitId: number, newStock: number) => {
    try {
      await api.playKits.updateStock(kitId, newStock);
      await loadAdminData();
      flashToast('Inventory restocked successfully');
    } catch (err: any) {
      flashToast(err.message || 'Failed to update stock');
    }
  };

  return (
    <AdminDashboardFrame activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-slate-500 font-medium">RUMI operations</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#2D3748]">
            A calm center for good work.
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => flashToast('Weekly attendance and progress report exported')}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D3748] shadow-sm hover:bg-slate-50 transition cursor-pointer"
          >
            Export report
          </button>
          <button
            onClick={() => setActiveTab('Photos')}
            className="rounded-xl bg-[#FA8C42] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#E77E36] transition cursor-pointer"
          >
            + Add update
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-200 pb-px">
        {['Operations', 'Students', 'Assessments', 'Photos', 'Store & orders'].map((tab) => (
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

      {/* Tab views */}
      {activeTab === 'Operations' && (
        <AdminOperations metrics={metrics} onTabChange={setActiveTab} />
      )}

      {activeTab === 'Students' && (
        <StudentDirectory students={students} />
      )}

      {activeTab === 'Assessments' && (
        <AdminAssessmentForm
          students={students}
          onSaveAssessment={handleSaveAssessment}
        />
      )}

      {activeTab === 'Photos' && (
        <BatchPhotoUploader
          students={students}
          onUploadPhotos={handleUploadPhotos}
        />
      )}

      {activeTab === 'Store & orders' && (
        <StoreAdmin
          orders={orders}
          playKits={playKits}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onAddProduct={handleAddProduct}
          onUpdateStock={handleUpdateStock}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && <Toast message={toastMessage} />}
      </AnimatePresence>
    </AdminDashboardFrame>
  );
}
