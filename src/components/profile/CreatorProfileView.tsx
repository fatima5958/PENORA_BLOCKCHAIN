import React, { useState } from 'react';
import type { Author, Article, Topic, Community } from '../../types';
import { CompactPostCard } from '../feed/CompactPostCard';
import { RightSidebar } from '../layout/RightSidebar';
import {
  MapPin,
  Calendar,
  Clock,
  Award,
  Check,
  Plus,
  BookOpen,
  MessageSquare,
  Repeat,
  Compass,
  Sparkles,
} from 'lucide-react';

interface CreatorProfileViewProps {
  author: Author;
  articles: Article[];
  topics: Topic[];
  communities: Community[];
}

export const CreatorProfileView: React.FC<CreatorProfileViewProps> = ({
  author,
  articles,
  topics,
}) => {
  const [activeTab, setActiveTab] = useState<'blog' | 'posts' | 'comments' | 'replies'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(author.followersCount || 30);

  const handleFollowToggle = () => {
    if (isFollowing) {
      setFollowersCount(prev => prev - 1);
      setIsFollowing(false);
    } else {
      setFollowersCount(prev => prev + 1);
      setIsFollowing(true);
    }
  };

  const authorArticles = articles.filter(a => a.author.handle === author.handle || a.author.id === author.id);
  const displayArticles = authorArticles.length > 0 ? authorArticles : articles.slice(0, 2);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      
      {/* Top Profile Header Banner */}
      <div className="pn-card overflow-hidden mb-6">
        
        {/* Cover Photo / Brand Canvas */}
        <div className="relative h-44 sm:h-52 w-full bg-[#0A2540] overflow-hidden">
          {author.coverImage ? (
            <img
              src={author.coverImage}
              alt={author.name}
              className="w-full h-full object-cover opacity-50"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#0A2540] via-[#0B2D4E] to-[#007C8B]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A2540] via-[#0A2540]/30 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#007C8B] to-[#00E5F4]" />
        </div>

        {/* Profile Card Body */}
        <div className="relative px-6 pb-6 pt-0 text-[#0A2540]">
          {/* Avatar and Action row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
            
            <div className="flex items-end gap-4">
              <div className="relative p-1 rounded-full bg-gradient-to-tr from-[#007C8B] to-[#00E5F4] shadow-lg">
                <img
                  src={author.avatar}
                  alt={author.name}
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover ring-4 ring-white bg-white"
                />
                <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-[#007C8B] ring-2 ring-white flex items-center justify-center text-white text-[10px] font-bold">
                  ✓
                </span>
              </div>

              <div className="mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0A2540] tracking-tight">
                    {author.name}
                  </h1>
                  <span className="pn-tag font-mono">
                    {author.reputationScore} Rep
                  </span>
                </div>
                <p className="text-xs text-[#4A5E75] font-medium">@{author.handle}</p>
              </div>
            </div>

            {/* Follow Button */}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={handleFollowToggle}
                className={`pn-btn px-5 py-2 rounded-full text-xs ${
                  isFollowing
                    ? 'pn-btn-secondary'
                    : 'pn-btn-brand'
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Follow Creator</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Biography snippet */}
          <p className="text-sm text-[#4A5E75] max-w-2xl leading-relaxed mb-4">
            {author.bio || 'Architecting decentralized editorial systems and high-signal Web3 publishing.'}
          </p>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-4 rounded-xl bg-[#F8FAFC] border border-[#0A2540]/8 text-xs font-semibold text-[#0A2540] mb-4">
            <div>
              <span className="font-bold text-[#0A2540]">{followersCount}</span>{' '}
              <span className="text-[#4A5E75] font-normal">followers</span>
            </div>
            <div className="text-[#0A2540]/20">•</div>
            <div>
              <span className="font-bold text-[#0A2540]">{author.postsCount || 1013}</span>{' '}
              <span className="text-[#4A5E75] font-normal">posts</span>
            </div>
            <div className="text-[#0A2540]/20">•</div>
            <div>
              <span className="font-bold text-[#0A2540]">{author.followingCount || 3}</span>{' '}
              <span className="text-[#4A5E75] font-normal">following</span>
            </div>
            <div className="text-[#0A2540]/20">•</div>
            <div className="flex items-center gap-1 text-[#007C8B]">
              <Award className="h-3.5 w-3.5" />
              <span>{author.reputationScore * 25} Rep Points</span>
            </div>
            <div className="text-[#0A2540]/20">•</div>
            <div className="text-[#4A5E75] font-normal">
              Rank #{author.reputationScore >= 90 ? '42' : '60,632'}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#4A5E75]">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#007C8B]" />
              <span>{author.location || 'Decentralized Node'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#007C8B]" />
              <span>{author.joinedDate || 'Joined November 2024'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#7B8FA6]" />
              <span>{author.activeStatus || 'Active today'}</span>
            </span>
          </div>

        </div>
      </div>

      {/* 3-Column Steemit-Style Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Sidebar */}
        <div className="hidden lg:block lg:col-span-3 sticky top-20">
          <div className="pn-panel p-3 space-y-1">
            <a
              href="/"
              className="pn-nav-item"
            >
              <Compass className="h-4 w-4 text-[#4A5E75]" />
              <span>Explore Feed</span>
            </a>
            
            <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#7B8FA6]">
              Creator Profile
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`pn-nav-item w-full text-left ${activeTab === 'posts' ? 'active' : ''}`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Posts ({displayArticles.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('blog')}
              className={`pn-nav-item w-full text-left ${activeTab === 'blog' ? 'active' : ''}`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Blog Curation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`pn-nav-item w-full text-left ${activeTab === 'comments' ? 'active' : ''}`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Comments (38)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('replies')}
              className={`pn-nav-item w-full text-left ${activeTab === 'replies' ? 'active' : ''}`}
            >
              <Repeat className="h-4 w-4" />
              <span>Replies (19)</span>
            </button>
          </div>
        </div>

        {/* Center Feed Column */}
        <main className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-lg font-bold text-[#0A2540] capitalize">
              {author.name}'s {activeTab}
            </h2>
            <span className="text-xs text-[#4A5E75]">
              {displayArticles.length} published dispatches
            </span>
          </div>

          <div className="space-y-3.5">
            {displayArticles.map((article) => (
              <CompactPostCard key={article.id} article={article} />
            ))}
          </div>
        </main>

        {/* Right Sidebar Column */}
        <div className="hidden lg:block lg:col-span-3 sticky top-20">
          <RightSidebar topics={topics} />
        </div>

      </div>

    </div>
  );
};
