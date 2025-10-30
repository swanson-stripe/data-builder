/**
 * Lightweight SQL syntax highlighter using regex
 * Returns HTML string with Tailwind classes for theming
 */
export function highlightSQL(sql: string, theme: 'light' | 'dark'): string {
  if (!sql || sql.trim() === '') {
    return '';
  }

  // Define color classes based on theme
  const colors = {
    keyword: theme === 'light' ? 'text-purple-600' : 'text-purple-300',
    function: theme === 'light' ? 'text-blue-600' : 'text-blue-300',
    string: theme === 'light' ? 'text-green-600' : 'text-green-300',
    number: theme === 'light' ? 'text-orange-600' : 'text-orange-300',
    comment: theme === 'light' ? 'text-gray-500' : 'text-gray-400',
    operator: theme === 'light' ? 'text-gray-700' : 'text-gray-200',
    base: theme === 'light' ? 'text-gray-900' : 'text-gray-200',
  };

  // SQL Keywords (case-insensitive)
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
    'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
    'AS', 'DISTINCT', 'HAVING', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN',
    'ELSE', 'END', 'TRUE', 'FALSE'
  ];

  // SQL Functions
  const functions = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'FLOOR', 'CEIL',
    'UPPER', 'LOWER', 'SUBSTRING', 'CONCAT', 'LENGTH', 'TRIM',
    'DATE', 'NOW', 'YEAR', 'MONTH', 'DAY', 'COALESCE', 'CAST'
  ];

  let result = sql;

  // Escape HTML special characters first
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Highlight single-line comments (-- comment)
  result = result.replace(
    /(--[^\n]*)/g,
    `<span class="${colors.comment}">$1</span>`
  );

  // Highlight multi-line comments (/* comment */)
  result = result.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    `<span class="${colors.comment}">$1</span>`
  );

  // Highlight strings (single quotes)
  result = result.replace(
    /('(?:[^']|'')*')/g,
    `<span class="${colors.string}">$1</span>`
  );

  // Highlight numbers
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    `<span class="${colors.number}">$1</span>`
  );

  // Highlight SQL functions
  const funcPattern = new RegExp(
    `\\b(${functions.join('|')})\\b`,
    'gi'
  );
  result = result.replace(
    funcPattern,
    (match) => `<span class="${colors.function}">${match.toUpperCase()}</span>`
  );

  // Highlight SQL keywords
  const keywordPattern = new RegExp(
    `\\b(${keywords.join('|')})\\b`,
    'gi'
  );
  result = result.replace(
    keywordPattern,
    (match) => `<span class="${colors.keyword}">${match.toUpperCase()}</span>`
  );

  // Wrap entire result in base color span for unhighlighted text
  return `<span class="${colors.base}">${result}</span>`;
}

