/**
 * Lightweight SQL syntax highlighter using regex
 * Returns HTML string with inline styles using CSS custom properties
 */
export function highlightSQL(sql: string, theme: 'light' | 'dark'): string {
  if (!sql || sql.trim() === '') {
    return '';
  }

  console.log('[SQL Highlight] Theme:', theme);

  // Define colors with actual hex values that match the design system
  // Light mode: from lines 88-94 of globals.css
  // Dark mode: from lines 191-196 of globals.css
  const colors = theme === 'light' ? {
    keyword: '#675DFF',    // --syntax-keyword (light)
    function: '#3b82f6',   // --syntax-function (light)
    string: '#22c55e',     // --syntax-string (light)
    number: '#f59e0b',     // --syntax-number (light)
    comment: '#9ca3af',    // --syntax-comment (light)
    identifier: '#675DFF', // --text-link (light)
    base: '#374151',       // --text-primary (light)
  } : {
    keyword: '#c792ea',    // --syntax-keyword (dark)
    function: '#82aaff',   // --syntax-function (dark)
    string: '#89ddaa',     // --syntax-string (dark)
    number: '#f78c6c',     // --syntax-number (dark)
    comment: '#6b7280',    // --syntax-comment (dark)
    identifier: '#C4BBFF', // --text-link (dark)
    base: '#e5e7eb',       // --text-primary (dark)
  };
  
  console.log('[SQL Highlight] Colors:', colors);

  // SQL Keywords (case-insensitive)
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
    'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
    'AS', 'DISTINCT', 'HAVING', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN',
    'ELSE', 'END', 'TRUE', 'FALSE', 'WITH', 'EXISTS', 'OVER', 'PARTITION'
  ];

  // SQL Functions
  const functions = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'FLOOR', 'CEIL',
    'UPPER', 'LOWER', 'SUBSTRING', 'CONCAT', 'LENGTH', 'TRIM',
    'DATE', 'NOW', 'YEAR', 'MONTH', 'DAY', 'COALESCE', 'CAST',
    'DATE_TRUNC', 'EXTRACT', 'TO_CHAR', 'ARRAY_AGG'
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
    `<span style="color: ${colors.comment} !important">$1</span>`
  );

  // Highlight multi-line comments (/* comment */)
  result = result.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    `<span style="color: ${colors.comment} !important">$1</span>`
  );

  // Highlight strings (single quotes)
  result = result.replace(
    /('(?:[^']|'')*')/g,
    `<span style="color: ${colors.string} !important">$1</span>`
  );

  // Highlight table.column identifiers (standard SQL pattern)
  // Must come before number highlighting to avoid matching dots as decimals
  result = result.replace(
    /\b([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\b/gi,
    `<span style="color: ${colors.identifier} !important">$1</span>`
  );

  // Highlight numbers
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    `<span style="color: ${colors.number} !important">$1</span>`
  );

  // Highlight SQL functions
  const funcPattern = new RegExp(
    `\\b(${functions.join('|')})\\b`,
    'gi'
  );
  result = result.replace(
    funcPattern,
    (match) => `<span style="color: ${colors.function} !important">${match.toUpperCase()}</span>`
  );

  // Highlight SQL keywords
  const keywordPattern = new RegExp(
    `\\b(${keywords.join('|')})\\b`,
    'gi'
  );
  result = result.replace(
    keywordPattern,
    (match) => `<span style="color: ${colors.keyword} !important">${match.toUpperCase()}</span>`
  );

  // Return result without wrapping - let unhighlighted text inherit from parent
  return result;
}

