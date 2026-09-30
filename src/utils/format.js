/**
 * Formats a numeric value by removing unnecessary trailing zeroes (e.g. 100.00 -> 100, 100.50 -> 100.5).
 * Uses comma separators for readability (e.g. 12,500).
 * 
 * @param {number|string} val - The numeric value to format
 * @param {number} [maxDecimals=2] - Maximum decimal places
 * @returns {string} Formatted number string
 */
export const formatAmount = (val, maxDecimals = 2) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  const num = Number(val);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
};

/**
 * Formats raw numeric value without commas (for input values or simple strings) removing trailing zeroes.
 * e.g. 100.00 -> "100", 100.50 -> "100.5"
 */
export const formatPlainNumber = (val, maxDecimals = 2) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  const num = Number(val);
  return parseFloat(num.toFixed(maxDecimals)).toString();
};
