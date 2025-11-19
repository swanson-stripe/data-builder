// src/components/TemplateSelector.tsx
'use client';
import { useState } from 'react';
import { useApp } from '@/state/app';
import TemplatePromptInput from './TemplatePromptInput';
import TemplateCarousel from './TemplateCarousel';
import CategoryFilter, { FilterPath } from './CategoryFilter';

export default function TemplateSelector() {
  const { dispatch } = useApp();
  const [filterPath, setFilterPath] = useState<FilterPath>({});

  const handleExploreOwn = () => {
    // Reset to blank state and hide template selector
    dispatch({ type: 'RESET_ALL' });
    dispatch({ type: 'HIDE_TEMPLATE_SELECTOR' });
    dispatch({ type: 'SET_USER_MADE_CHANGES', payload: false });
  };

  return (
    <div className="absolute flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', top: '56px', left: 0, right: 0, bottom: 0 }}>
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full" style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* AI Prompt Section */}
          <div className="w-full">
            <TemplatePromptInput onSuccess={() => {}} />
          </div>

          {/* Category Filter */}
          <div className="w-full">
            <CategoryFilter filterPath={filterPath} setFilterPath={setFilterPath} />
          </div>

          {/* Template Carousel */}
          <div className="w-full">
            <TemplateCarousel onExploreOwn={handleExploreOwn} filterPath={filterPath} />
          </div>
        </div>
      </div>
    </div>
  );
}

