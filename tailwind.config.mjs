/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        penora: {
          // Core Approved PENORA Blockchain Palette (Identity Board §08)
          navy: '#0A2540',
          'navy-deep': '#06182C',
          'navy-light': '#12345A',
          teal: '#007C8B',
          'teal-deep': '#006573',
          'teal-mid': '#00B3C4',
          bright: '#00E5F4',
          'teal-soft': '#EEFBFC',
          'teal-tint': '#D6F7FA',

          // Neutral & Surface Tokens
          canvas: '#F4F7FA',
          subtle: '#EEF2F6',
          surface: '#FFFFFF',
          slate: '#4A5B70',
          muted: '#6E7D90',
          border: 'rgba(10, 37, 64, 0.08)',
          'border-strong': 'rgba(10, 37, 64, 0.14)',

          // Legacy aliases mapped to the new PENORA Blockchain brand system
          ivory: '#F4F7FA',
          cream: '#FFFFFF',
          coral: '#007C8B',
          'coral-hover': '#006573',
          peach: '#00E5F4',
          'peach-light': '#EEFBFC',
          cocoa: '#0A2540',
          'cocoa-muted': '#4A5B70',
          'cocoa-dark': '#06182C',
          mint: '#007C8B',
          'mint-hover': '#006573',
          'mint-light': '#EEFBFC',
          glass: 'rgba(255, 255, 255, 0.78)',
          'glass-border': 'rgba(10, 37, 64, 0.08)',
          'glass-dark': 'rgba(10, 37, 64, 0.06)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        display: [
          'Sora',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        serif: [
          'Sora',
          'Inter',
          'Georgia',
          'sans-serif',
        ],
      },
      boxShadow: {
        'spatial-sm': '0 1px 2px rgba(10, 37, 64, 0.04), 0 4px 14px -6px rgba(10, 37, 64, 0.08)',
        'spatial-md': '0 2px 4px rgba(10, 37, 64, 0.04), 0 12px 28px -12px rgba(10, 37, 64, 0.14)',
        'spatial-lg': '0 4px 8px rgba(10, 37, 64, 0.04), 0 20px 44px -16px rgba(10, 37, 64, 0.18)',
        'spatial-xl': '0 32px 72px -20px rgba(6, 24, 44, 0.28), 0 0 0 1px rgba(10, 37, 64, 0.06)',
        'spatial-float': '0 12px 32px -10px rgba(0, 124, 139, 0.32)',
        'glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        'gloss-button': '0 8px 22px -10px rgba(0, 124, 139, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
        'gloss-dark': '0 10px 26px -12px rgba(6, 24, 44, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
        md: '12px',
        xl: '20px',
      },
    },
  },
  plugins: [],
};
