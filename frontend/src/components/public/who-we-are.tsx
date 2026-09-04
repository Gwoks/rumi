import React from 'react';

export function WhoWeAre() {
  const people = [
    {
      name: 'Nadia Rahman',
      role: 'Founder & Learning Guide',
      text: 'A mother, Montessori guide, and lifelong student of how children make meaning.',
      initials: 'NR',
      tone: '#E7F4F0'
    },
    {
      name: 'Ustazah Mariam Yusuf',
      role: 'Lead Montessori Teacher',
      text: 'Brings 12 years of early childhood practice and a gentle love for stories.',
      initials: 'MY',
      tone: '#FFF1E6'
    },
    {
      name: 'Hana Karim',
      role: 'Islamic Studies Guide',
      text: 'Helps children discover adab, gratitude, and wonder through everyday moments.',
      initials: 'HK',
      tone: '#FFF7CF'
    }
  ];

  return (
    <section id="who-we-are" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
        <div>
          <div className="mb-4 inline-flex rounded-full bg-[#E7F4F0] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#2A9D8F]">
            The people behind RUMI
          </div>
          <h2 className="max-w-lg text-4xl font-semibold tracking-tight text-[#2D3748] sm:text-5xl">
            Small hands, held by a thoughtful village.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-600">
            RUMI began with one simple belief: children deserve a place where faith and curiosity can grow side by side. Our team creates calm, prepared spaces for that growth.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {people.map((person) => (
            <article key={person.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div
                className="mb-6 grid h-16 w-16 place-items-center rounded-2xl text-xl font-semibold text-[#2D3748]"
                style={{ background: person.tone }}
              >
                {person.initials}
              </div>
              <h3 className="font-semibold leading-5 text-[#2D3748]">{person.name}</h3>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#FA8C42]">
                {person.role}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-600">{person.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
