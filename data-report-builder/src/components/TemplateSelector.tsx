// src/components/TemplateSelector.tsx
'use client';
import { useState } from 'react';
import { useApp } from '@/state/app';
import TemplatePromptInput from './TemplatePromptInput';
import TemplateCarousel from './TemplateCarousel';

export default function TemplateSelector() {
  const { dispatch } = useApp();

  const handleExploreOwn = () => {
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

          {/* Template Carousel */}
          <div className="w-full">
            <TemplateCarousel onExploreOwn={handleExploreOwn} />
          </div>
        </div>
      </div>
    </div>
  );
}

