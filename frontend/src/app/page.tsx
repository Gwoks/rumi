'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Filter, Heart, SlidersHorizontal, Sparkles } from 'lucide-react';
import { PublicNav } from '@/components/public/public-nav';
import { WhoWeAre } from '@/components/public/who-we-are';
import { InfoCard } from '@/components/common/info-card';
import { ScheduleCard } from '@/components/public/schedule-card';
import { ProductCard } from '@/components/public/product-card';
import { RumiFooter } from '@/components/public/rumi-footer';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { api, PopUpClass, PlayKit } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<PopUpClass[]>([]);
  const [products, setProducts] = useState<PlayKit[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<PlayKit | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showSchedule, setShowSchedule] = useState(true);
  const [filters, setFilters] = useState({ location: 'All locations', time: 'All times' });

  const flashToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [classesRes, kitsRes] = await Promise.all([
          api.classes.list(),
          api.playKits.list()
        ]);
        setClasses(classesRes.classes);
        setProducts(kitsRes.play_kits);
      } catch (err) {
        console.error('Failed to load public page data:', err);
      }
    }
    loadData();
  }, []);

  const filteredClasses = classes.filter((c) => {
    if (filters.location !== 'All locations' && !c.location.includes(filters.location)) return false;
    if (filters.time === 'Morning' && !c.time.includes('AM')) return false;
    if (filters.time === 'Afternoon' && !c.time.includes('PM')) return false;
    return true;
  });

  return (
    <div className="pt-12 min-h-screen bg-[#FDFBF7] text-[#2D3748]">
      <PublicNav onEnroll={() => flashToast('Enrollment interest noted — welcome to RUMI!')} />

      <main>
        {/* Hero Section */}
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-20 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-8 lg:pt-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#FFF1E6] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#D86D29]">
              <span className="h-2 w-2 rounded-full bg-[#FA8C42]" /> Weekend learning for ages 3–6
            </div>
            <h1 className="max-w-2xl text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.045em] text-[#2D3748] sm:text-6xl">
              A little room to <span className="text-[#2A9D8F]">wonder.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              RUMI is a warm Montessori pop-up where young children explore faith, independence, and the joy of learning — with their whole selves.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-xl bg-[#2A9D8F] px-5 py-3.5 font-semibold text-white shadow-lg shadow-[#2A9D8F]/15 transition hover:-translate-y-0.5 hover:bg-[#238276] cursor-pointer"
              >
                Find a weekend class <ArrowRight className="ml-2 inline" size={17} />
              </button>
              <button
                onClick={() => document.getElementById('philosophy')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-semibold text-[#2D3748] hover:border-[#2A9D8F] transition cursor-pointer"
              >
                How RUMI works
              </button>
            </div>
            <div className="mt-10 flex items-center gap-5 text-sm text-slate-500">
              <div className="flex -space-x-2">
                <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#FDFBF7] bg-[#FAD02C] text-xs font-bold text-[#2D3748]">
                  N
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#FDFBF7] bg-[#E7F4F0] text-xs font-bold text-[#2A9D8F]">
                  S
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#FDFBF7] bg-[#FFF1E6] text-xs font-bold text-[#FA8C42]">
                  A
                </div>
              </div>
              <span>Loved by 120+ RUMI families</span>
            </div>
          </div>

          {/* Montessori Visual Art Display */}
          <div className="relative min-h-[390px] overflow-hidden rounded-[36px] bg-[#E7F4F0] p-6 sm:min-h-[490px] shadow-sm">
            <div className="absolute right-8 top-8 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold text-[#2A9D8F]">
              Saturday mornings
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-2/3 rounded-t-[45%] bg-[#FAD02C]/80" />
            <div className="absolute bottom-14 left-1/2 grid h-52 w-52 -translate-x-1/2 place-items-center rounded-full border-[22px] border-white/80 bg-[#FA8C42] text-center shadow-xl">
              <div>
                <div className="mb-2 text-5xl text-white">☾</div>
                <div className="text-xs font-bold uppercase tracking-[.2em] text-white">
                  grow with wonder
                </div>
              </div>
            </div>
            <div className="absolute bottom-12 left-7 grid h-20 w-20 place-items-center rounded-[24px] bg-white text-3xl shadow-lg">
              ✦
            </div>
            <div className="absolute bottom-24 right-8 grid h-24 w-24 place-items-center rounded-full bg-[#2A9D8F] text-3xl text-white shadow-lg">
              ◌
            </div>
            <div className="absolute left-8 top-24 max-w-[170px] text-2xl font-semibold leading-tight text-[#2D3748]">
              Beautiful materials. Big questions.
            </div>
          </div>
        </section>

        {/* Who We Are */}
        <WhoWeAre />

        {/* The RUMI Way */}
        <section id="philosophy" className="border-y border-slate-100 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
            <div className="max-w-xl">
              <p className="text-sm font-bold uppercase tracking-[.16em] text-[#FA8C42]">The RUMI way</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#2D3748] sm:text-4xl">
                A prepared space for curious hearts.
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                Every pop-up is designed to feel unhurried, purposeful, and joyful — a place where children can choose meaningful work and find their own rhythm.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <InfoCard
                icon={<Heart size={22} className="text-[#2A9D8F]" />}
                title="Rooted in adab"
                text="Faith is woven gently into stories, songs, and how we care for one another."
                color="teal"
              />
              <InfoCard
                icon={<SlidersHorizontal size={22} className="text-[#FA8C42]" />}
                title="Hands before screens"
                text="Children learn through real materials, movement, and the satisfaction of doing."
                color="orange"
              />
              <InfoCard
                icon={<Sparkles size={22} className="text-[#8D7100]" />}
                title="Wonder is welcome"
                text="We make room for questions, concentration, mistakes, and delight."
                color="yellow"
              />
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section id="schedule" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.16em] text-[#2A9D8F]">
                Come play with us
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#2D3748]">
                Upcoming pop-ups
              </h2>
            </div>
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className="flex items-center gap-2 text-sm font-semibold text-[#2A9D8F] cursor-pointer hover:underline"
            >
              {showSchedule ? 'Hide filters' : 'Show filters'} <Filter size={16} />
            </button>
          </div>

          {showSchedule && (
            <div className="mt-7 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3 shadow-sm">
              <Select
                label="Location"
                value={filters.location}
                options={['All locations', 'The Grove, KL', 'The Hive, PJ']}
                onChange={(v) => setFilters({ ...filters, location: v })}
              />
              <Select
                label="Time"
                value={filters.time}
                options={['All times', 'Morning', 'Afternoon']}
                onChange={(v) => setFilters({ ...filters, time: v })}
              />
              <div className="flex items-end">
                <button
                  onClick={() => flashToast('Showing matching weekend classes')}
                  className="w-full rounded-xl bg-[#E7F4F0] px-4 py-3 text-sm font-semibold text-[#2A9D8F] hover:bg-[#d6ece6] transition cursor-pointer"
                >
                  Update results
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredClasses.length === 0 ? (
              <p className="col-span-3 text-center py-10 text-slate-500">
                No classes match the chosen filters.
              </p>
            ) : (
              filteredClasses.map((c) => (
                <ScheduleCard
                  key={c.id}
                  date={c.date_day}
                  month={c.date_month}
                  title={c.title}
                  location={c.location}
                  time={c.time}
                  tag={c.tag}
                  onEnroll={() => flashToast(`Class "${c.title}" held for your family!`)}
                />
              ))
            )}
          </div>
        </section>

        {/* Play Kits Section */}
        <section id="shop" className="bg-[#E7F4F0]/50 border-t border-slate-100">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[.16em] text-[#FA8C42]">
                  Bring RUMI home
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#2D3748]">
                  Play kits for little learners
                </h2>
              </div>
              <button
                onClick={() => router.push('/parent')}
                className="hidden text-sm font-semibold text-[#2A9D8F] hover:underline sm:block cursor-pointer"
              >
                Shop in parent portal <ArrowRight className="ml-1 inline" size={15} />
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onClick={() => setSelectedProduct(p)}
                  onAdd={() => flashToast(`${p.title} added to interest list!`)}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      <RumiFooter />

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <Modal
            title={selectedProduct.title}
            onClose={() => setSelectedProduct(null)}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div
                className="grid min-h-52 place-items-center rounded-2xl"
                style={{ background: selectedProduct.color || '#E7F4F0' }}
              >
                <span className="text-7xl text-[#2D3748]/70">
                  {selectedProduct.icon || '✦'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#2A9D8F]">
                  {selectedProduct.category}
                </p>
                <p className="mt-3 leading-7 text-slate-600">
                  {selectedProduct.description || 'Gentle tactile materials for focused home exploration.'}
                </p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-2xl font-semibold text-[#2D3748]">
                    ${selectedProduct.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      flashToast(`${selectedProduct.title} added to bag`);
                    }}
                    className="rounded-xl bg-[#FA8C42] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#E77E36] transition cursor-pointer"
                  >
                    Add to bag
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage && <Toast message={toastMessage} />}
      </AnimatePresence>
    </div>
  );
}
