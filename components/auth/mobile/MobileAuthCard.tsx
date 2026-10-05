"use client";

type Props = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function MobileAuthCard({
  title,
  description,
  children,
}: Props) {
  return (
    <div
      className="w-full rounded-[22px] border border-[rgba(0,215,255,0.35)] px-5 py-5 shadow-[0_0_28px_rgba(0,215,255,0.14)]"
      style={{ background: "rgba(4,14,34,.94)" }}
    >
      <h2 className="text-[22px] font-bold text-white">{title}</h2>
      <p className="mt-1.5 text-[13px] leading-snug text-cyan-100/70">
        {description}
      </p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
