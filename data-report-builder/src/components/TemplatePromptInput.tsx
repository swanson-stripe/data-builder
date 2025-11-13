// src/components/TemplatePromptInput.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/state/app';
import { AIParseResult } from '@/types/ai';

type Props = {
  onSuccess?: () => void;
};

const ROTATING_PROMPTS = [
  'Customers with a successful payment in October',
  'Payment acceptance rate for North America',
  'Payment volume for product A',
  'Monthly recurring revenue from active subscriptions',
  'Refunds issued in the last quarter',
  'New customer acquisition by week',
];

export default function TemplatePromptInput({ onSuccess }: Props) {
  const { dispatch } = useApp();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderOpacity, setPlaceholderOpacity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Rotate placeholder text every 3 seconds with fade effect
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderOpacity(0);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PROMPTS.length);
        setPlaceholderOpacity(1);
      }, 450);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/parse-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const result: AIParseResult = await response.json();

      console.log('🤖 [TemplatePromptInput] AI Parse Result:', result);

      if (result.success) {
        console.log('🤖 [TemplatePromptInput] Applying AI config:', result.config);
        console.log('🤖 [TemplatePromptInput] Objects order:', result.config.objects);
        console.log('🤖 [TemplatePromptInput] Filters:', result.config.filters);
        console.log('🤖 [TemplatePromptInput] Metric source:', result.config.metric.source);
        
        // Apply the AI-generated configuration
        dispatch({ type: 'APPLY_AI_CONFIG', payload: result.config });
        onSuccess?.();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={ROTATING_PROMPTS[placeholderIndex]}
            className="w-full outline-none text-base template-prompt-input"
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--text-purple)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            disabled={loading}
          />
          <style jsx>{`
            .template-prompt-input {
              color: var(--text-primary) !important;
              background-color: transparent !important;
              border: 1px solid var(--border-subtle) !important;
              border-radius: 100px !important;
              padding: 12px 24px !important;
              transition: border-color 0.2s;
            }
            
            .template-prompt-input::placeholder {
              opacity: ${placeholderOpacity};
              transition: opacity 0.45s ease-in-out;
            }
          `}</style>
        </div>
      </form>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-error)' }}>{error}</p>
        </div>
      )}
    </div>
  );
}

