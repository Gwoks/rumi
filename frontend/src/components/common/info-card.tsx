import React from 'react';

export function InfoCard({
  icon,
  title,
  text,
  color
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  color: 'teal' | 'orange' | 'yellow';
}) {
  const bg =
    color === 'teal' ? '#E7F4F0' : color === 'orange' ? '#FFF1E6' : '#FFF7CF';

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#FDFBF7] p-6 shadow-sm">
      <div
        className="mb-7 grid h-11 w-11 place-items-center rounded-xl text-[#2D3748]"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <h3 className="font-semibold text-lg text-[#2D3748]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}
