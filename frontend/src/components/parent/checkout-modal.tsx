'use client';

import React, { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

export function CheckoutModal({
  total,
  onClose,
  onDone,
  isSubmitting = false
}: {
  total: number;
  onClose: () => void;
  onDone: () => void;
  isSubmitting?: boolean;
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: 'Nadia Rahman',
    address: '12 Jalan Damai, Kuala Lumpur',
    city: 'Kuala Lumpur',
    postcode: '50450'
  });

  const steps = ['Details', 'Payment', 'Done'];

  return (
    <Modal
      title={step === 3 ? "You're all set" : 'Complete your order'}
      onClose={onClose}
    >
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                step > i
                  ? 'bg-[#2A9D8F] text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step > i + 1 ? <Check size={15} /> : i + 1}
            </div>
            <span
              className={`hidden text-xs font-semibold sm:block ${
                step === i + 1 ? 'text-[#2D3748]' : 'text-slate-400'
              }`}
            >
              {s}
            </span>
            {i < 2 && <div className="h-px flex-1 bg-slate-200" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Field
            label="Full name"
            placeholder="Nadia Rahman"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Field
            label="Delivery address"
            placeholder="12 Jalan Damai, Kuala Lumpur"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="City"
              placeholder="Kuala Lumpur"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <Field
              label="Postcode"
              placeholder="50450"
              value={formData.postcode}
              onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
            />
          </div>
          <Button
            onClick={() => setStep(2)}
            className="mt-3 w-full py-3.5"
          >
            Continue to payment
          </Button>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="rounded-xl border-2 border-[#2A9D8F] bg-[#E7F4F0]/50 p-4">
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-[#2A9D8F]" />
              <div>
                <p className="text-sm font-semibold text-[#2D3748]">Mock card payment</p>
                <p className="text-xs text-slate-500">•••• 4242 · No real charge will be made</p>
              </div>
              <Check className="ml-auto text-[#2A9D8F]" size={18} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <span className="text-slate-500 font-medium">Order total</span>
            <strong className="text-2xl text-[#2D3748]">${total.toFixed(2)}</strong>
          </div>

          <button
            onClick={async () => {
              await onDone();
              setStep(3);
            }}
            disabled={isSubmitting}
            className="mt-6 w-full rounded-xl bg-[#FA8C42] py-3.5 font-semibold text-white transition hover:bg-[#E77E36] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Processing order...' : 'Place mock order'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#E7F4F0] text-[#2A9D8F]">
            <Check size={30} />
          </div>
          <p className="mt-5 text-lg font-semibold text-[#2D3748]">Your RUMI kit is on its way.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            We&apos;ve sent a pretend receipt to your registered email. Thank you for bringing more wonder home.
          </p>
          <Button
            onClick={onClose}
            className="mt-7 w-full py-3.5"
          >
            Back to my dashboard
          </Button>
        </div>
      )}
    </Modal>
  );
}
