// src/components/profile/CreatorProfileView.tsx
// PENORA Blockchain — Creator Profile V7 Adapter
import React from 'react';
import { CreatorProfileV7 } from './CreatorProfileV7';
import type { Author, Article, Topic, Community } from '../../types';

export interface CreatorProfileViewProps {
  author: Author;
  articles: Article[];
  topics: Topic[];
  communities: Community[];
}

export const CreatorProfileView: React.FC<CreatorProfileViewProps> = (props) => {
  return <CreatorProfileV7 {...props} />;
};
