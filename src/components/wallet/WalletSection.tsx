import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Mobile keeps secondary tools one tap away; desktop keeps the full overview. */
export function WalletSection({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <section className="wallet-secondary">
      <button type="button" className="wallet-secondary-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
        <span>{title}</span><ChevronDown size={18} aria-hidden="true" className={expanded ? 'rotate-180' : ''} />
      </button>
      <div id={id} className={`wallet-secondary-content space-y-4 ${expanded ? 'is-expanded' : ''}`}>
        {children}
      </div>
    </section>
  );
}
