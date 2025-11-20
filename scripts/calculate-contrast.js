#!/usr/bin/env node

/**
 * WCAG Contrast Ratio Calculator
 * Calculates contrast ratios for color combinations and checks WCAG AA compliance
 */

// Color definitions from tailwind.config.js
const colors = {
  'text-primary': '#1a1a1a',
  'text-secondary': '#666666',
  accent: '#1d4ed8', // blue-700 (≥4.5:1 contrast)
  success: '#15803d', // green-700 (~5.02:1 contrast)
  warning: '#b45309', // amber-700 (~5.02:1 contrast)
  error: '#dc2626', // red-600 (~4.83:1 contrast)
  white: '#ffffff',
  'bg-secondary': '#f5f5f5',
  'bg-hover': '#e8e8e8',
  border: '#e0e0e0',
  // Trust badge colors
  'trust-official-bg': '#dcfce7', // green-100
  'trust-official-text': '#166534', // green-800
  'trust-verified-bg': '#dbeafe', // blue-100
  'trust-verified-text': '#1e40af', // blue-800
  'trust-community-bg': '#f3f4f6', // gray-100
  'trust-community-text': '#1f2937', // gray-800
  // Recency badge colors
  'recency-recent': '#15803d', // green-700
  'recency-medium': '#b45309', // amber-700
  'recency-old': '#4b5563', // gray-600
};

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance (WCAG formula)
 */
function getLuminance(rgb) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : ((val + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    return null;
  }

  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check WCAG compliance
 */
function checkWCAG(ratio, isLargeText = false) {
  const aaThreshold = isLargeText ? 3.0 : 4.5;
  const aaaThreshold = isLargeText ? 4.5 : 7.0;
  const level = ratio >= aaaThreshold ? 'AAA' : ratio >= aaThreshold ? 'AA' : 'FAIL';
  return {
    passes: ratio >= aaThreshold,
    level,
    threshold: aaThreshold,
  };
}

/**
 * Format contrast ratio result
 */
function formatResult(foreground, background, ratio, isLargeText = false) {
  const wcag = checkWCAG(ratio, isLargeText);
  const status = wcag.passes ? '✅' : '❌';
  const sizeNote = isLargeText ? ' (large text)' : '';
  const levelNote = wcag.level === 'AAA' ? ' (AAA)' : wcag.level === 'AA' ? ' (AA)' : '';

  return {
    foreground,
    background,
    ratio: ratio.toFixed(2),
    wcag: wcag.level,
    passes: wcag.passes,
    status,
    sizeNote,
    levelNote,
    threshold: wcag.threshold,
  };
}

// Test combinations from Part 2
const tests = [
  // Primary Text Colors
  {
    fg: colors['text-primary'],
    bg: colors.white,
    label: 'text-text-primary on white',
    large: false,
  },
  {
    fg: colors['text-primary'],
    bg: colors.white,
    label: 'text-text-primary on white',
    large: true,
  },
  {
    fg: colors['text-secondary'],
    bg: colors.white,
    label: 'text-text-secondary on white',
    large: false,
  },
  {
    fg: colors['text-secondary'],
    bg: colors.white,
    label: 'text-text-secondary on white',
    large: true,
  },
  { fg: colors.white, bg: colors.accent, label: 'White text on bg-accent', large: false },
  { fg: colors.white, bg: colors.accent, label: 'White text on bg-accent', large: true },

  // Status Colors
  { fg: colors.error, bg: colors.white, label: 'text-error on white', large: false },
  { fg: colors.error, bg: colors.white, label: 'text-error on white', large: true },
  { fg: colors.success, bg: colors.white, label: 'text-success on white', large: false },
  { fg: colors.success, bg: colors.white, label: 'text-success on white', large: true },
  { fg: colors.warning, bg: colors.white, label: 'text-warning on white', large: false },
  { fg: colors.warning, bg: colors.white, label: 'text-warning on white', large: true },

  // Interactive States
  { fg: colors.accent, bg: colors.white, label: 'text-accent (link) on white', large: false },
  { fg: colors.accent, bg: colors.white, label: 'text-accent (link) on white', large: true },

  // Trust Badges
  {
    fg: colors['trust-official-text'],
    bg: colors['trust-official-bg'],
    label: 'Trust badge: Official text on bg',
    large: false,
  },
  {
    fg: colors['trust-verified-text'],
    bg: colors['trust-verified-bg'],
    label: 'Trust badge: Verified text on bg',
    large: false,
  },
  {
    fg: colors['trust-community-text'],
    bg: colors['trust-community-bg'],
    label: 'Trust badge: Community text on bg',
    large: false,
  },

  // Recency Badges
  {
    fg: colors['recency-recent'],
    bg: colors.white,
    label: 'Recency badge: Recent (green) on white',
    large: false,
  },
  {
    fg: colors['recency-medium'],
    bg: colors.white,
    label: 'Recency badge: Medium (amber) on white',
    large: false,
  },
  {
    fg: colors['recency-old'],
    bg: colors.white,
    label: 'Recency badge: Old (gray) on white',
    large: false,
  },

  // Button states
  { fg: colors.white, bg: colors.error, label: 'Button: White text on error bg', large: false },
  { fg: colors.white, bg: colors.error, label: 'Button: White text on error bg', large: true },
  {
    fg: colors['text-primary'],
    bg: colors['bg-secondary'],
    label: 'Button: Text on bg-secondary',
    large: false,
  },
];

console.info('='.repeat(80));
console.info('WCAG Contrast Ratio Analysis - Part 2: Color Contrast Verification');
console.info('='.repeat(80));
console.info('');

const results = tests.map((test) => {
  const ratio = getContrastRatio(test.fg, test.bg);
  return {
    ...formatResult(test.fg, test.bg, ratio, test.large),
    label: test.label,
  };
});

// Group by category
console.info('## Primary Text Colors\n');
for (const r of results.filter(
  (r) =>
    r.label.includes('text-text-primary') ||
    r.label.includes('text-text-secondary') ||
    r.label.includes('White text on bg-accent')
)) {
  console.info(`${r.status} ${r.label}${r.sizeNote}: ${r.ratio}:1 ${r.levelNote}`);
}

console.info('\n## Status Colors\n');
for (const r of results.filter(
  (r) =>
    r.label.includes('text-error') ||
    r.label.includes('text-success') ||
    r.label.includes('text-warning')
)) {
  console.info(`${r.status} ${r.label}${r.sizeNote}: ${r.ratio}:1 ${r.levelNote}`);
}

console.info('\n## Interactive States\n');
for (const r of results.filter((r) => r.label.includes('text-accent'))) {
  console.info(`${r.status} ${r.label}${r.sizeNote}: ${r.ratio}:1 ${r.levelNote}`);
}

console.info('\n## Component-Specific Colors\n');
for (const r of results.filter(
  (r) =>
    r.label.includes('Trust badge') ||
    r.label.includes('Recency badge') ||
    r.label.includes('Button')
)) {
  console.info(`${r.status} ${r.label}${r.sizeNote}: ${r.ratio}:1 ${r.levelNote}`);
}

console.info(`\n${'='.repeat(80)}`);
console.info('Summary\n');

const failed = results.filter((r) => !r.passes);
const passed = results.filter((r) => r.passes);

console.info(`✅ Passed: ${passed.length}/${results.length}`);
console.info(`❌ Failed: ${failed.length}/${results.length}`);

if (failed.length > 0) {
  console.info('\n⚠️  Failed Combinations:\n');
  for (const r of failed) {
    const threshold = r.sizeNote.includes('large') ? '3.0' : '4.5';
    console.info(`  ${r.status} ${r.label}${r.sizeNote}: ${r.ratio}:1 (needs ${threshold}:1)`);
  }
}

console.info(`\n${'='.repeat(80)}`);
console.info('\nNote: Large text = 18px bold or 24px normal text');
console.info('WCAG AA requires: ≥4.5:1 for normal text, ≥3:1 for large text');
console.info('WCAG AAA requires: ≥7:1 for normal text, ≥4.5:1 for large text');
