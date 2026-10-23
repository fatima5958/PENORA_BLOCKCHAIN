// src/components/story/VotingStrengthModal.tsx
// Steemit-Style Weighted Voting Strength Selector & Curation Modal
// Compact, touch-friendly, adhering to PENORA navy/teal/cyan design tokens

import React, { useState, useEffect } from 'react';
import { Sliders, Zap, ShieldCheck, X, AlertCircle } from 'lucide-react';
import {
  fetchVoterPowerState,
  calculateManaConsumptionBps,
  calculateInfluenceScore,
  castOnChainCurationVote,
  type VoterPowerState,
} from '../../lib/voting/votingClient';

export interface VotingStrengthModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleId: string;
  articleTitle?: string;
  direction: 1 | -1;
  onConfirmSocialVote: (weightPercent: number) => Promise<void>;
  walletAddress?: string | null;
}

const PRESET_CHIPS = [10, 25, 50, 75, 100];

export const VotingStrengthModal: React.FC<VotingStrengthModalProps> = ({
  isOpen,
  onClose,
  articleId,
  articleTitle,
  direction,
  onConfirmSocialVote,
  walletAddress,
}) => {
  const [weight, setWeight] = useState<number>(100);
  const [powerState, setPowerState] = useState<VoterPowerState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voteMode, setVoteMode] = useState<'onchain' | 'social'>('social');

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setStatusMessage(null);
      return;
    }

    let active = true;
    setIsLoading(true);

    fetchVoterPowerState(walletAddress)
      .then((state) => {
        if (active) {
          setPowerState(state);
          if (state.isEligibleForFinancialVoting) {
            setVoteMode('onchain');
          } else {
            setVoteMode('social');
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, walletAddress]);

  if (!isOpen) return null;

  const currentManaBps = powerState?.manaBps ?? 10000;
  const currentManaPct = powerState?.manaPercent ?? 100;
  const consumedBps = calculateManaConsumptionBps(currentManaBps, weight);
  const consumedPct = (consumedBps / 100).toFixed(2);
  const effectivePP = powerState?.effectivePowerPnr ?? 0;
  const influenceScore = calculateInfluenceScore(effectivePP, weight, currentManaPct);

  const handleConfirm = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (voteMode === 'onchain' && powerState?.isEligibleForFinancialVoting) {
        setStatusMessage('Broadcasting on-chain curation vote...');
        const res = await castOnChainCurationVote({
          contentRawId: articleId,
          weightPercent: weight,
          isUpvote: direction === 1,
          onProgress: (msg) => setStatusMessage(msg),
        });

        if (!res.success) {
          setErrorMessage(res.error || 'On-chain vote transaction failed.');
          setSubmitting(false);
          return;
        }
      }

      // Record social vote to update UI metrics & post feeds
      setStatusMessage('Updating social curation count...');
      await onConfirmSocialVote(weight);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to cast vote.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Voting Strength Selector"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2540]/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-[#FFFFFF] dark:bg-[#0D2035] rounded-3xl p-6 w-full max-w-sm sm:max-w-md shadow-2xl border border-[#007C8B]/20 space-y-5 text-[#0A2540] dark:text-[#E6F0FA]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#007C8B]/10 text-[#007C8B]">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold flex items-center gap-1.5">
                Steemit Voting Strength
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    direction === 1
                      ? 'bg-[#EEFBFC] text-[#006573] dark:bg-[#007C8B]/30 dark:text-[#00E5F4]'
                      : 'bg-[#FFF0F0] text-[#D93838] dark:bg-[#D93838]/20 dark:text-[#FF8080]'
                  }`}
                >
                  {direction === 1 ? '▲ Upvote' : '▼ Downvote'}
                </span>
              </h3>
              <p className="text-xs text-[#6E7D90] dark:text-[#8FA3BC] truncate max-w-[220px]">
                {articleTitle || 'Curate post with weighted influence'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#6E7D90]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Voting Strength Percentage Display */}
        <div className="bg-[#F8FAFC] dark:bg-[#081726] rounded-2xl p-4 border border-[#007C8B]/15 text-center space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#6E7D90] dark:text-[#8FA3BC]">
            Voting Weight
          </div>
          <div className="text-4xl font-extrabold font-mono text-[#007C8B] dark:text-[#00E5F4]">
            {weight}%
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {PRESET_CHIPS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setWeight(pct)}
                className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  weight === pct
                    ? 'bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white shadow-sm'
                    : 'bg-[#EEFBFC] dark:bg-[#0F2B44] text-[#006573] dark:text-[#8FA3BC] hover:bg-[#007C8B]/20'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Slider Control */}
          <div className="pt-2 px-1">
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={weight}
              onChange={(e) => setWeight(parseInt(e.target.value, 10))}
              className="w-full accent-[#007C8B] cursor-pointer h-2 bg-[#E2E8F0] dark:bg-[#1A3854] rounded-lg"
              aria-label="Voting strength slider"
            />
            <div className="flex justify-between text-[10px] text-[#6E7D90] font-mono pt-1">
              <span>1%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Influence & Mana Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#081726] border border-black/5 dark:border-white/5 space-y-1">
            <span className="text-[11px] text-[#6E7D90] dark:text-[#8FA3BC] flex items-center gap-1">
              <Zap className="h-3 w-3 text-[#007C8B]" /> Voting Mana
            </span>
            <div className="font-mono font-semibold text-[#0A2540] dark:text-[#E6F0FA]">
              {currentManaPct}%
            </div>
            <div className="text-[10px] text-[#D93838]">
              Consumes ~{consumedPct}%
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#081726] border border-black/5 dark:border-white/5 space-y-1">
            <span className="text-[11px] text-[#6E7D90] dark:text-[#8FA3BC] flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-[#007C8B]" /> Effective Power
            </span>
            <div className="font-mono font-semibold text-[#0A2540] dark:text-[#E6F0FA]">
              {effectivePP > 0 ? `${effectivePP.toLocaleString()} PP` : '0 PP (Social)'}
            </div>
            <div className="text-[10px] text-[#007C8B] dark:text-[#00E5F4]">
              {effectivePP > 0 ? `Est. Score: ${influenceScore.toFixed(1)}` : 'Social Vote'}
            </div>
          </div>
        </div>

        {/* Policy Explanation Note */}
        <div className="p-3 rounded-xl bg-[#EEFBFC]/60 dark:bg-[#007C8B]/10 border border-[#007C8B]/20 text-[11px] text-[#006573] dark:text-[#00E5F4] leading-relaxed">
          {powerState?.isEligibleForFinancialVoting ? (
            <p>
              <strong>On-Chain Curation Vote:</strong> Uses your verified stake-weighted PENORA Power. Regenerates 20% mana per day (100% in 5 days).
            </p>
          ) : (
            <p>
              <strong>Standard Social Vote:</strong> You have not staked PNR Power. This vote counts towards community feed discovery without drawing from the on-chain reward pool.
            </p>
          )}
        </div>

        {statusMessage && (
          <div className="p-2.5 rounded-xl bg-[#EEFBFC] dark:bg-[#007C8B]/20 text-xs text-[#006573] dark:text-[#00E5F4] animate-pulse text-center">
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-[#FFF0F0] dark:bg-[#D93838]/20 text-xs text-[#D93838] dark:text-[#FF8080] flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || isLoading}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#007C8B] to-[#00E5F4] text-white text-xs font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? 'Confirming...' : `Confirm ${direction === 1 ? '▲ Upvote' : '▼ Downvote'} (${weight}%)`}
          </button>
        </div>
      </div>
    </div>
  );
};
