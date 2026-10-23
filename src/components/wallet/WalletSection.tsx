import { type ReactNode } from 'react';

/** Clean semantic container for wallet sections without hidden accordions */
export function WalletSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 pt-1">
      <h3 className="font-serif text-sm font-bold text-[var(--wallet-text)] tracking-tight px-0.5">
        {title}
      </h3>
      <div className="space-y-3">
        {children}
      </div>
    </section>
  );
}
