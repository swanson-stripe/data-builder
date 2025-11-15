'use client';

/**
 * EmptyState component - displayed when no fields are selected
 */
export function EmptyState() {
  return (
    <div 
      className="flex items-center justify-center" 
      style={{ 
        position: 'fixed',
        top: '56px', // Below header
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--bg-primary)',
        zIndex: 1,
      }}
    >
      <div className="text-center">
        <p 
          className="text-sm" 
          style={{ 
            color: 'var(--text-secondary)',
            fontWeight: 400,
          }}
        >
          Select a field to begin building your report
        </p>
      </div>
    </div>
  );
}

