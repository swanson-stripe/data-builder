// CategoryFilter.tsx
// Waterfall category filtering with hierarchical chip navigation
'use client';
import { useState } from 'react';
import { TEMPLATE_TAXONOMY } from '@/data/templateTaxonomy';

export interface FilterPath {
  categoryId?: string;
  topicId?: string;
  reportId?: string;
}

interface Props {
  onFilterChange: (path: FilterPath) => void;
}

export default function CategoryFilter({ onFilterChange }: Props) {
  const [selectedPath, setSelectedPath] = useState<FilterPath>({});

  const handleCategoryClick = (categoryId: string) => {
    if (selectedPath.categoryId === categoryId) {
      // Clicking the same category deselects it (reset to root)
      const newPath = {};
      setSelectedPath(newPath);
      onFilterChange(newPath);
    } else {
      // Select new category, clear topic and report
      const newPath = { categoryId };
      setSelectedPath(newPath);
      onFilterChange(newPath);
    }
  };

  const handleTopicClick = (topicId: string) => {
    if (selectedPath.topicId === topicId) {
      // Clicking the same topic deselects it (go back to category level)
      const newPath = { categoryId: selectedPath.categoryId };
      setSelectedPath(newPath);
      onFilterChange(newPath);
    } else {
      // Select new topic, clear report
      const newPath = { categoryId: selectedPath.categoryId, topicId };
      setSelectedPath(newPath);
      onFilterChange(newPath);
    }
  };

  const handleReportClick = (reportId: string) => {
    if (selectedPath.reportId === reportId) {
      // Clicking the same report deselects it (go back to topic level)
      const newPath = { categoryId: selectedPath.categoryId, topicId: selectedPath.topicId };
      setSelectedPath(newPath);
      onFilterChange(newPath);
    } else {
      // Select new report
      const newPath = { categoryId: selectedPath.categoryId, topicId: selectedPath.topicId, reportId };
      setSelectedPath(newPath);
      onFilterChange(newPath);
    }
  };

  // Get current category, topic objects
  const currentCategory = TEMPLATE_TAXONOMY.find(cat => cat.id === selectedPath.categoryId);
  const currentTopic = currentCategory?.topics.find(topic => topic.id === selectedPath.topicId);

  // Determine which chips to show
  const showTopics = !!selectedPath.categoryId;
  const showReports = !!selectedPath.topicId;

  return (
    <div className="w-full flex flex-col" style={{ gap: '12px' }}>
      {/* Level 1: Top-level categories */}
      <div className="flex items-center" style={{ gap: '8px', overflowX: 'auto' }}>
        {TEMPLATE_TAXONOMY.map((category) => {
          const isSelected = selectedPath.categoryId === category.id;
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: isSelected ? 'var(--button-secondary-bg-active)' : 'var(--bg-surface)',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: `1px solid ${isSelected ? 'var(--border-medium)' : 'var(--border-default)'}`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }
              }}
            >
              {category.label}
            </button>
          );
        })}
      </div>

      {/* Level 2: Topics (shown when category is selected) */}
      {showTopics && currentCategory && currentCategory.topics.length > 0 && (
        <div className="flex items-center" style={{ gap: '8px', overflowX: 'auto', paddingLeft: '16px' }}>
          {currentCategory.topics.map((topic) => {
            const isSelected = selectedPath.topicId === topic.id;
            return (
              <button
                key={topic.id}
                onClick={() => handleTopicClick(topic.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isSelected ? 'var(--button-secondary-bg-active)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${isSelected ? 'var(--border-medium)' : 'var(--border-default)'}`,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.borderColor = 'var(--border-medium)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }
                }}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Level 3: Reports (shown when topic is selected) */}
      {showReports && currentTopic && currentTopic.reports.length > 0 && (
        <div className="flex items-center" style={{ gap: '8px', overflowX: 'auto', paddingLeft: '32px' }}>
          {currentTopic.reports.map((report) => {
            const isSelected = selectedPath.reportId === report.id;
            return (
              <button
                key={report.id}
                onClick={() => handleReportClick(report.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isSelected ? 'var(--button-secondary-bg-active)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${isSelected ? 'var(--border-medium)' : 'var(--border-default)'}`,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.borderColor = 'var(--border-medium)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }
                }}
              >
                {report.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

