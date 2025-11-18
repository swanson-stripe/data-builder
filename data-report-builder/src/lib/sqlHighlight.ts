/**
 * Lightweight SQL syntax highlighter using regex
 * Returns HTML string with inline styles using CSS custom properties
 */
export function highlightSQL(sql: string, theme: 'light' | 'dark'): string {
  if (!sql || sql.trim() === '') {
    return '';
  }

  // Define colors using CSS custom properties from globals.css
  const colors = {
    keyword: 'var(--syntax-keyword)',    // Purple: #675DFF (light) / #c792ea (dark)
    function: 'var(--syntax-function)',   // Blue: #3b82f6 (light) / #82aaff (dark)
    string: 'var(--syntax-string)',       // Green: #22c55e (light) / #89ddaa (dark)
    number: 'var(--syntax-number)',       // Orange: #f59e0b (light) / #f78c6c (dark)
    comment: 'var(--syntax-comment)',     // Gray: #9ca3af (light) / #6b7280 (dark)
    identifier: 'var(--text-link)',       // Link color for table.column names
    base: 'var(--text-primary)',
  };

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
    `<span style="color: ${colors.comment}">$1</span>`
  );

  // Highlight multi-line comments (/* comment */)
  result = result.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    `<span style="color: ${colors.comment}">$1</span>`
  );

  // Highlight strings (single quotes)
  result = result.replace(
    /('(?:[^']|'')*')/g,
    `<span style="color: ${colors.string}">$1</span>`
  );

  // Highlight table.column identifiers (standard SQL pattern)
  // Must come before number highlighting to avoid matching dots as decimals
  result = result.replace(
    /\b([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\b/gi,
    `<span style="color: ${colors.identifier}">$1</span>`
  );

  // Highlight numbers
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    `<span style="color: ${colors.number}">$1</span>`
  );

  // Highlight SQL functions
  const funcPattern = new RegExp(
    `\\b(${functions.join('|')})\\b`,
    'gi'
  );
  result = result.replace(
    funcPattern,
    (match) => `<span style="color: ${colors.function}">${match.toUpperCase()}</span>`
  );

  // Highlight SQL keywords
  const keywordPattern = new RegExp(
    `\\b(${keywords.join('|')})\\b`,
    'gi'
  );
  result = result.replace(
    keywordPattern,
    (match) => `<span style="color: ${colors.keyword}">${match.toUpperCase()}</span>`
  );

  // Wrap entire result in base color span for unhighlighted text
  return `<span style="color: ${colors.base}">${result}</span>`;
}

