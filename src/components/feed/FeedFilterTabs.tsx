import React from 'react';

interface FeedFilterTabsProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  className?: string;
}

export const FeedFilterTabs: React.FC<FeedFilterTabsProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  className = '',
}) => {
  return (
    <div
      role="tablist"
      aria-label="Feed topic filter"
      className={`flex items-center gap-2 overflow-x-auto p-1.5 rounded-full liquid-glass shadow-spatial-sm no-scrollbar ${className}`}
    >
      {categories.map(category => {
        const isSelected = selectedCategory === category;
        return (
          <button
            key={category}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectCategory(category)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
              isSelected
                ? 'bg-penora-cocoa text-white shadow-spatial-sm'
                : 'text-penora-cocoa-muted hover:text-penora-cocoa hover:bg-white/60'
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
};
