// CategoryFilter.tsx
// Waterfall category filtering with 3 levels
// Level 1: Category (chip) → Level 2: Topic (chip) → Level 3: Report (carousel)
'use client';
import { useState } from 'react';
import { TEMPLATE_TAXONOMY } from '@/data/templateTaxonomy';

export interface FilterPath {
  categoryId?: string;
  topicId?: string;
}

interface Props {
  filterPath: FilterPath;
  setFilterPath: (path: FilterPath) => void;
}

// Small X icon with subtle background for dismissing selected chips
const CloseIcon = ({ isHovered }: { isHovered: boolean }) => (
  <span
    className="close-icon"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '16px',
      height: '16px',
      marginLeft: '8px',
      borderRadius: '9999px',
      backgroundColor: isHovered ? 'var(--border-medium)' : 'var(--bg-hover)',
      transition: 'background-color 0.15s ease',
    }}
  >
    <svg 
      width="10" 
      height="10" 
      viewBox="0 0 10 10" 
      fill="none" 
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" />
    </svg>
  </span>
);

// Chip component with hover state management
const CategoryChip = ({ 
  label, 
  isSelected, 
  onClick 
}: { 
  label: string; 
  isSelected: boolean; 
  onClick: () => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex-shrink-0 text-sm transition-colors flex items-center"
      style={{
        backgroundColor: isSelected ? 'var(--button-secondary-bg-active)' : 'var(--bg-surface)',
        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        border: `1px solid ${isSelected ? 'var(--border-medium)' : 'var(--border-default)'}`,
        borderRadius: '9999px',
        padding: isSelected ? '4px 6px 4px 8px' : '4px 8px',
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      {label}
      {isSelected && <CloseIcon isHovered={isHovered} />}
    </button>
  );
};

export default function CategoryFilter({ filterPath, setFilterPath }: Props) {
  const handleCategoryClick = (categoryId: string) => {
    if (filterPath.categoryId === categoryId) {
      // Clicking the same category deselects it (reset to root)
      setFilterPath({});
    } else {
      // Select new category, clear topic and report
      setFilterPath({ categoryId });
    }
  };

  const handleTopicClick = (topicId: string) => {
    if (filterPath.topicId === topicId) {
      // Clicking the same topic deselects it (go back to category level)
      setFilterPath({ categoryId: filterPath.categoryId });
    } else {
      // Select new topic (reports will show in carousel)
      setFilterPath({ categoryId: filterPath.categoryId, topicId });
    }
  };

  // Get current category object
  const currentCategory = TEMPLATE_TAXONOMY.find(cat => cat.id === filterPath.categoryId);

  // Determine selection states
  const hasSelectedCategory = !!filterPath.categoryId;
  const hasSelectedTopic = !!filterPath.topicId;

  return (
    <div className="w-full relative">
      {/* Single row: "Explore templates for" + chips with horizontal scroll */}
      <div 
        className="flex items-center" 
        style={{ 
          gap: '8px', 
          overflowX: 'auto',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          paddingRight: '32px', // Space for fade effect
        }}
      >
        {/* Leading text */}
        <span 
          className="flex-shrink-0 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          Explore templates for
        </span>

        {/* Category chips - show all when none selected, only selected when one is active */}
        {TEMPLATE_TAXONOMY.map((category) => {
          const isSelected = filterPath.categoryId === category.id;
          
          // Hide non-selected categories when one is selected
          if (hasSelectedCategory && !isSelected) {
            return null;
          }
          
          return (
            <CategoryChip
              key={category.id}
              label={category.label}
              isSelected={isSelected}
              onClick={() => handleCategoryClick(category.id)}
            />
          );
        })}

        {/* Topic chips - shown inline after the selected category */}
        {/* Hide other topics when one is selected */}
        {hasSelectedCategory && currentCategory && currentCategory.topics.map((topic) => {
          const isSelected = filterPath.topicId === topic.id;
          
          // Hide non-selected topics when one is selected
          if (hasSelectedTopic && !isSelected) {
            return null;
          }
          
          return (
            <CategoryChip
              key={topic.id}
              label={topic.label}
              isSelected={isSelected}
              onClick={() => handleTopicClick(topic.id)}
            />
          );
        })}
      </div>
      
      {/* Fade effect on right edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '48px',
          background: 'linear-gradient(to right, transparent, var(--bg-primary))',
          pointerEvents: 'none',
        }}
      />
      
      {/* Hide webkit scrollbar */}
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
