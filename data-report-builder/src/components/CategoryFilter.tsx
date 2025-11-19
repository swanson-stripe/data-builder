// CategoryFilter.tsx
// Waterfall category filtering with 4-level hierarchical chip navigation
// Level 1: Category → Level 2: Topic → Level 3: SubTopic → Level 4: Report
'use client';
import { useState } from 'react';
import { TEMPLATE_TAXONOMY } from '@/data/templateTaxonomy';

export interface FilterPath {
  categoryId?: string;
  topicId?: string;
  subTopicId?: string;
  reportId?: string;
}

interface Props {
  filterPath: FilterPath;
  setFilterPath: (path: FilterPath) => void;
}

export default function CategoryFilter({ filterPath, setFilterPath }: Props) {
  const handleCategoryClick = (categoryId: string) => {
    if (filterPath.categoryId === categoryId) {
      // Clicking the same category deselects it (reset to root)
      setFilterPath({});
    } else {
      // Select new category, clear topic, subTopic, and report
      setFilterPath({ categoryId });
    }
  };

  const handleTopicClick = (topicId: string) => {
    if (filterPath.topicId === topicId) {
      // Clicking the same topic deselects it (go back to category level)
      setFilterPath({ categoryId: filterPath.categoryId });
    } else {
      // Select new topic, clear subTopic and report
      setFilterPath({ categoryId: filterPath.categoryId, topicId });
    }
  };

  const handleSubTopicClick = (subTopicId: string) => {
    if (filterPath.subTopicId === subTopicId) {
      // Clicking the same subTopic deselects it (go back to topic level)
      setFilterPath({ categoryId: filterPath.categoryId, topicId: filterPath.topicId });
    } else {
      // Select new subTopic, clear report
      setFilterPath({ categoryId: filterPath.categoryId, topicId: filterPath.topicId, subTopicId });
    }
  };

  const handleReportClick = (reportId: string) => {
    if (filterPath.reportId === reportId) {
      // Clicking the same report deselects it (go back to subTopic level)
      setFilterPath({ 
        categoryId: filterPath.categoryId, 
        topicId: filterPath.topicId,
        subTopicId: filterPath.subTopicId 
      });
    } else {
      // Select new report
      setFilterPath({ 
        categoryId: filterPath.categoryId, 
        topicId: filterPath.topicId,
        subTopicId: filterPath.subTopicId,
        reportId 
      });
    }
  };

  // Get current category, topic, subTopic objects
  const currentCategory = TEMPLATE_TAXONOMY.find(cat => cat.id === filterPath.categoryId);
  const currentTopic = currentCategory?.topics.find(topic => topic.id === filterPath.topicId);
  const currentSubTopic = currentTopic?.subTopics?.find(st => st.id === filterPath.subTopicId);

  // Determine which chips to show
  const showTopics = !!filterPath.categoryId;
  const showSubTopics = !!filterPath.topicId;
  const showReports = !!filterPath.subTopicId;

  return (
    <div className="w-full flex flex-col" style={{ gap: '12px' }}>
      {/* Level 1: Top-level categories */}
      <div className="flex items-center" style={{ gap: '8px', overflowX: 'auto' }}>
        {TEMPLATE_TAXONOMY.map((category) => {
          const isSelected = filterPath.categoryId === category.id;
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
            const isSelected = filterPath.topicId === topic.id;
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

      {/* Level 3: SubTopics (shown when topic is selected) */}
      {showSubTopics && currentTopic && currentTopic.subTopics && currentTopic.subTopics.length > 0 && (
        <div className="flex items-center" style={{ gap: '8px', overflowX: 'auto', paddingLeft: '32px' }}>
          {currentTopic.subTopics.map((subTopic) => {
            const isSelected = filterPath.subTopicId === subTopic.id;
            return (
              <button
                key={subTopic.id}
                onClick={() => handleSubTopicClick(subTopic.id)}
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
                {subTopic.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Level 4: Reports (shown when subTopic is selected) */}
      {showReports && currentSubTopic && currentSubTopic.reports.length > 0 && (
        <div className="flex items-center" style={{ gap: '8px', overflowX: 'auto', paddingLeft: '48px' }}>
          {currentSubTopic.reports.map((report) => {
            const isSelected = filterPath.reportId === report.id;
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
