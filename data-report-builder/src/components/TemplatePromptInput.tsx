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
        console.log('🤖 [TemplatePromptInput] Has multiBlock:', !!result.config.multiBlock);
        if (result.config.multiBlock) {
          console.log('🤖 [TemplatePromptInput] MultiBlock config:', result.config.multiBlock);
        } else if (result.config.metric) {
          console.log('🤖 [TemplatePromptInput] Metric source:', result.config.metric.source);
        }
        
        // Apply the AI-generated configuration
        dispatch({ type: 'APPLY_AI_CONFIG', payload: result.config });
        onSuccess?.();
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('🤖 [TemplatePromptInput] Error:', err);
      setError('Failed to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isActive = prompt.trim().length > 0 && !loading;

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center gap-2">
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && isActive) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isActive}
            className="submit-button"
            aria-label={loading ? 'Processing' : 'Submit prompt'}
          >
            {loading ? (
              // Processing spinner
              <div className="spinner" />
            ) : (
              // Up arrow
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M12 19V5M12 5L5 12M12 5L19 12" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          
          <style jsx>{`
            .template-prompt-input {
              color: var(--text-primary) !important;
              background-color: transparent !important;
              border: 1px solid var(--border-subtle) !important;
              border-radius: 100px !important;
              padding: 12px 24px !important;
              padding-right: 16px !important;
              transition: border-color 0.2s;
            }
            
            .template-prompt-input::placeholder {
              opacity: ${placeholderOpacity};
              transition: opacity 0.45s ease-in-out;
            }
            
            .submit-button {
              position: absolute;
              right: 8px;
              width: 40px;
              height: 40px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: none;
              cursor: pointer;
              transition: all 0.2s ease;
              flex-shrink: 0;
            }
            
            /* Deactivated state */
            .submit-button:disabled {
              background-color: var(--bg-surface);
              color: var(--text-muted);
              cursor: not-allowed;
            }
            
            /* Activated state */
            .submit-button:not(:disabled) {
              background-color: var(--text-primary);
              color: white;
            }
            
            /* Hover state (activated only) */
            .submit-button:not(:disabled):hover {
              background-color: var(--text-primary);
              transform: scale(1.05);
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }
            
            /* Pressed state (activated only) */
            .submit-button:not(:disabled):active {
              transform: scale(0.95);
            }
            
            /* Processing spinner animation */
            .spinner {
              width: 20px;
              height: 20px;
              border: 2.5px solid rgba(255, 255, 255, 0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }
            
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
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

