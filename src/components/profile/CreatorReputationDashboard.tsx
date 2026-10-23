// src/components/profile/CreatorReputationDashboard.tsx
// PENORA Creator Reputation V2 Dashboard & Verified Achievement Showcase

import React, { useState, useEffect } from 'react';
import {
  Award,
  Sparkles,
  PenLine,
  BookOpen,
  MessageSquare,
  Heart,
  Crown,
  Shield,
  ArrowUpRight,
  CheckCircle2,
  Lock,
  Info,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import {
  computeCreatorLevel,
  getCreatorAchievements,
} from '../../lib/api/reputation';
import type {
  AchievementBadge,
  CreatorLevelInfo,
  ReputationBreakdown,
} from '../../lib/api/types';
import type { Author } from '../../types';

interface CreatorReputationDashboardProps {
  author: Author;
}

export const CreatorReputationDashboard: React.FC<CreatorReputationDashboardProps> = ({ author }) => {
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<AchievementBadge[]>([]);
  const [stats, setStats] = useState<ReputationBreakdown | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    getCreatorAchievements(author.id, author.reputationScore).then((res) => {
      if (!mounted) return;
      setBadges(res.badges);
      setStats(res.stats);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [author.id, author.reputationScore]);

  const effectiveScore = stats?.total ?? author.reputationScore ?? 25;
  const levelInfo: CreatorLevelInfo = computeCreatorLevel(effectiveScore);

  const getBadgeIcon = (iconName: string, isEarned: boolean) => {
    const className = `h-5 w-5 ${isEarned ? 'text-[#007C8B]' : 'text-[#8C9BAE]'}`;
    switch (iconName) {
      case 'PenLine':
        return <PenLine className={className} />;
      case 'BookOpen':
        return <BookOpen className={className} />;
      case 'MessageSquare':
        return <MessageSquare className={className} />;
      case 'Heart':
        return <Heart className={className} />;
      case 'Sparkles':
        return <Sparkles className={className} />;
      case 'Crown':
        return <Crown className={className} />;
      default:
        return <Award className={className} />;
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#52657C] bg-white rounded-3xl border border-[#0A2540]/8 space-y-2">
        <Loader2 className="h-6 w-6 animate-spin text-[#007C8B] mx-auto" />
        <p>Loading creator reputation ledger and verified badges…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── 1. LEVEL & PROGRESSION HERO CARD ─── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white via-white to-[#EBF7F9] border border-[#007C8B]/20 shadow-sm space-y-6 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#00E5F4]/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#007C8B]/10 text-[#007C8B] text-xs font-bold uppercase tracking-wider mb-2">
              <Award className="h-3.5 w-3.5" />
              <span>Level {levelInfo.level} Creator</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0A2540]">
              {levelInfo.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52657C] mt-1 max-w-xl">
              Reputation is earned exclusively from genuine publication, community curation, and discussion quality.
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="inline-flex items-baseline gap-1">
              <span className="font-serif text-4xl sm:text-5xl font-black text-[#007C8B]">
                {effectiveScore}
              </span>
              <span className="text-xs font-semibold text-[#6E7D90]">/ 100 Rep</span>
            </div>
            <span className="block text-[11px] text-[#52657C]">
              {levelInfo.level < 5
                ? `${levelInfo.pointsNeeded} pts to Level ${levelInfo.level + 1}`
                : 'Maximum Tier Achieved'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#52657C]">
            <span>Level {levelInfo.level} Progress</span>
            <span>{levelInfo.percentToNext}%</span>
          </div>
          <div className="h-2.5 w-full bg-[#0A2540]/8 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#007C8B] via-[#00B3C4] to-[#00E5F4] rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${Math.max(4, Math.min(100, levelInfo.percentToNext))}%` }}
            />
          </div>
        </div>
      </div>

      {/* ─── 2. REPUTATION SIGNALS BREAKDOWN (4-METRIC GRID) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#0A2540]/8 space-y-1">
          <span className="text-[11px] text-[#6E7D90] font-medium block">Starting Base</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-[#0A2540]">{stats?.base ?? 25}</span>
            <span className="text-[10px] text-[#007C8B] font-semibold">pts</span>
          </div>
          <span className="text-[10px] text-[#52657C] block truncate">Account creation</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#0A2540]/8 space-y-1">
          <span className="text-[11px] text-[#6E7D90] font-medium block">Original Stories</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-[#007C8B]">+{stats?.articlesPoints ?? 0}</span>
            <span className="text-[10px] text-[#007C8B] font-semibold">pts</span>
          </div>
          <span className="text-[10px] text-[#52657C] block truncate">{stats?.publishedCount ?? 0} published stories</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#0A2540]/8 space-y-1">
          <span className="text-[11px] text-[#6E7D90] font-medium block">Curation Upvotes</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-[#007C8B]">+{stats?.votesPoints ?? 0}</span>
            <span className="text-[10px] text-[#007C8B] font-semibold">pts</span>
          </div>
          <span className="text-[10px] text-[#52657C] block truncate">{stats?.votesCastCount ?? 0} genuine votes</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#0A2540]/8 space-y-1">
          <span className="text-[11px] text-[#6E7D90] font-medium block">Circle & Discussions</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-[#007C8B]">
              +{(stats?.commentsPoints ?? 0) + (stats?.communitiesPoints ?? 0)}
            </span>
            <span className="text-[10px] text-[#007C8B] font-semibold">pts</span>
          </div>
          <span className="text-[10px] text-[#52657C] block truncate">Guilds & comments</span>
        </div>
      </div>

      {/* ─── 3. VERIFIED ACHIEVEMENT BADGES SHOWCASE ─── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#0A2540]/8 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#0A2540]/8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#007C8B]" />
            <h3 className="font-serif text-lg font-bold text-[#0A2540]">
              Verified Creator Achievements
            </h3>
          </div>
          <span className="text-xs font-semibold text-[#007C8B] bg-[#007C8B]/10 px-2.5 py-1 rounded-full">
            {badges.filter((b) => b.isEarned).length} of {badges.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((badge) => {
            return (
              <div
                key={badge.key}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  badge.isEarned
                    ? 'border-[#007C8B]/30 bg-gradient-to-br from-white to-[#F0FAFB] shadow-xs'
                    : 'border-[#0A2540]/8 bg-white/70 opacity-80'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        badge.isEarned
                          ? 'bg-[#007C8B]/10 text-[#007C8B]'
                          : 'bg-[#0A2540]/5 text-[#8C9BAE]'
                      }`}
                    >
                      {getBadgeIcon(badge.icon, badge.isEarned)}
                    </div>

                    {badge.isEarned ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        <span>Earned</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6E7D90] bg-gray-100 px-2 py-0.5 rounded-full">
                        <Lock className="h-2.5 w-2.5" />
                        <span>In Progress</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-serif text-sm font-bold text-[#0A2540]">{badge.title}</h4>
                    <p className="text-[11px] text-[#52657C] leading-relaxed mt-0.5">{badge.description}</p>
                  </div>
                </div>

                {/* Progress Footer */}
                <div className="pt-2 border-t border-[#0A2540]/6 text-[10px] text-[#6E7D90]">
                  {badge.isEarned ? (
                    <span className="text-emerald-700 font-medium">
                      Unlocked on {badge.awardedAt ? new Date(badge.awardedAt).toLocaleDateString() : 'Verified'}
                    </span>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Milestone:</span>
                        <span className="font-semibold text-[#0A2540]">{badge.progressText}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#0A2540]/8 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#007C8B] rounded-full"
                          style={{ width: `${badge.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 4. TRANSPARENCY & COMMUNITY ELIGIBILITY INFO CARD ─── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#F8FBFD] border border-[#0A2540]/8 space-y-3 text-xs text-[#52657C]">
        <div className="flex items-center gap-2 font-bold text-[#0A2540]">
          <Info className="h-4 w-4 text-[#007C8B]" />
          <span>PENORA Transparent Scoring Protocol</span>
        </div>
        <p className="leading-relaxed">
          Reputation starts at base score 25. High quality, verified original publications earn +3 points, curation upvotes earn +1 point per 2 votes, and discussion comments earn +1 point. Reaching <strong>Reputation 65</strong> permanently unlocks decentralized guild creation rights. Unwanted spam and verified policy reports apply anti-spam penalties.
        </p>
      </div>
    </div>
  );
};
