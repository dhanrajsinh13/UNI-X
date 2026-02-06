module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      // Instagram-inspired color system
      colors: {
        background: "#FFFFFF",
        accent: "#FFAF50",
        text: "#1E1E1E",
        // Semantic colors
        success: "#00BA34",
        error: "#ED4956",
        warning: "#FFC107",
        info: "#0095F6",
        // Grayscale refinement
        border: "#DBDBDB",
        "border-light": "#EFEFEF",
        "text-secondary": "#737373",
        "text-tertiary": "#8E8E8E",
        // Dark mode support (future)
        "dark-bg": "#000000",
        "dark-surface": "#121212",
        "dark-border": "#262626",
      },
      // 8pt spacing scale (Instagram standard)
      spacing: {
        '18': '4.5rem',   // 72px
        '22': '5.5rem',   // 88px
        '30': '7.5rem',   // 120px
        '128': '32rem',   // 512px
        '144': '36rem',   // 576px
      },
      // Typography scale (Instagram-like)
      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '0.875rem' }],      // 10px
        'xs': ['0.75rem', { lineHeight: '1rem' }],            // 12px
        '13': ['0.8125rem', { lineHeight: '1.125rem' }],      // 13px - metadata
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],        // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],           // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],        // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],         // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],            // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],       // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],         // 36px
      },
      // Standardized border radius (Instagram style)
      borderRadius: {
        'sm': '0.25rem',   // 4px - small elements
        'DEFAULT': '0.5rem',  // 8px - buttons, inputs
        'md': '0.75rem',   // 12px - small cards
        'lg': '1rem',      // 16px - cards
        'xl': '1.25rem',   // 20px - large cards
        '2xl': '1.5rem',   // 24px - modals
        '3xl': '2rem',     // 32px - hero elements
      },
      // Elevation system (4 levels)
      boxShadow: {
        'subtle': '0 1px 3px rgba(0, 0, 0, 0.04)',
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        // Instagram-specific shadows
        'card': '0 2px 12px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.12)',
        'modal': '0 12px 40px rgba(0, 0, 0, 0.15)',
      },
      // Animation & transitions
      transitionDuration: {
        'fast': '150ms',
        '200': '200ms',
        'normal': '200ms',
        '300': '300ms',
        'slow': '300ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      // Container widths (Instagram-like)
      maxWidth: {
        'feed': '630px',      // Main feed width
        'story': '480px',     // Story/modal width
        'wide': '975px',      // Wide content
      },
      // Z-index scale
      zIndex: {
        'dropdown': '1000',
        'sticky': '1020',
        'fab': '1025',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
      },
    }
  },
  plugins: []
};
