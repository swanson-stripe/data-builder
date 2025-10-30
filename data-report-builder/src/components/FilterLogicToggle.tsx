'use client';

type FilterLogicToggleProps = {
  logic: 'AND' | 'OR';
  onToggle: () => void;
};

export function FilterLogicToggle({ logic, onToggle }: FilterLogicToggleProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Filters are combined with:
      </span>
      <button
        onClick={onToggle}
        className="px-3 py-1 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        {logic}
      </button>
      <span className="text-xs text-gray-600 dark:text-gray-400">
        ({logic === 'AND' ? 'All conditions must match' : 'Any condition can match'})
      </span>
    </div>
  );
}

