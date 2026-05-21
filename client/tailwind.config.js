/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'San Francisco', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'soft': '1rem',      // 16px
        'soft-lg': '1.5rem', // 24px
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'soft-md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
        'soft-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
      colors: {
        // Theme Colors
        theme: {
          sidebar: '#0F172A', // Navy đậm
          main: '#F8FAFC', // Main background
          card: '#FFFFFF', // Card background
          primary: '#2563EB', // Xanh (Primary)
          warning: '#F59E0B', // Vàng (Warning)
          danger: '#DC2626', // Đỏ (Danger)
          text: '#0F172A', // Text chính
          textSecondary: '#64748B', // Text phụ
        },
        slate: {
          50: '#f8fafc',
          200: '#e2e8f0',
          300: '#cbd5e1', // Light Steel Blue for icons
          400: '#94a3b8', // Slate Gray for text/placeholders
          500: '#64748B', // Text phụ
          700: '#334155', // Slate Blue for borders
          800: '#1e293b', // Deep Slate
          900: '#0f172a', // Midnight Blue / Text chính
          950: '#020617',
        },
        blue: {
          400: '#60a5fa',
          500: '#3b82f6', // Electric Blue
          600: '#2563eb', // Royal Blue / Primary
          700: '#1d4ed8',
        },
        amber: {
          500: '#F59E0B', // Amber (pending) / Warning
        },
        red: {
          600: '#DC2626', // Danger
        },
        orange: {
          500: '#f97316', // Orange-500
          600: '#ea580c', // Orange-600 (Primary CTA)
          700: '#c2410c', // Orange-700 (Hover)
        },
        indigo: {
          600: '#4f46e5',
        },
        green: {
          500: '#10b981', // Accent Green (success)
        },
        rose: {
          500: '#f43f5e', // Accent Rose (error/warning)
        },
        emerald: {
          50: '#E6FFFA', // Soft Emerald (active background)
          900: '#004D40', // Deep Emerald (active border)
        },
        cyber: {
          blue: '#007BFF', // Cyber Blue (glow effect)
        },
        crimson: {
          red: '#EF4444', // Crimson Red (high priority)
        },
      },
      transitionDuration: {
        'procurement-hover': '100ms',
        'procurement-dropdown': '120ms',
        'procurement-page': '140ms',
        'procurement-modal': '180ms',
        'procurement-modal-close': '120ms',
        'procurement-drawer': '200ms',
        'procurement-notification': '220ms',
        'procurement-notification-exit': '140ms',
        'procurement-button': '80ms',
      },
      transitionTimingFunction: {
        'procurement': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite',
        shake: 'shake 0.5s ease-in-out',
        fadeIn: 'fadeIn 0.12s ease-out',
        scaleUp: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        fadeInScale: 'fadeInScale 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        slideUpFadeIn: 'slideUpFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        slideRight: 'slideRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'page-enter': 'pageEnter 0.14s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'modal-enter': 'modalOpen 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'modal-exit': 'modalClose 0.12s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'dropdown-enter': 'dropdownEnter 0.22s cubic-bezier(0.34, 1.2, 0.34, 1) forwards',
        'drawer-enter': 'drawerEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'notification-enter': 'notificationEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'notification-exit': 'notificationExit 0.14s ease-out forwards',
        'shimmer': 'shimmer 1.2s ease-in-out infinite',
        'shake-validation': 'shakeValidation 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        'widget-enter': 'widgetEnter 0.12s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        // Timeline Energy Animations
        'linear-flow': 'linearFlow 2s linear infinite',
        'halo-glow': 'haloGlow 1.5s ease-in-out infinite',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'path-glow': 'pathGlow 1.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 123, 255, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 123, 255, 0.8), 0 0 30px rgba(0, 123, 255, 0.4)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
        },
        shakeValidation: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleUp: {
          '0%': { transform: 'scale(0.98)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeInScale: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUpFadeIn: {
          '0%': { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pageEnter: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        modalOpen: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        modalClose: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.96)' },
        },
        dropdownEnter: {
          '0%': { opacity: '0', transform: 'translateY(-10px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        drawerEnter: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        notificationEnter: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        notificationExit: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        widgetEnter: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Timeline Energy Keyframes
        linearFlow: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '0% 200%' },
        },
        haloGlow: {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(99, 102, 241, 0.4)',
            transform: 'scale(1)',
          },
          '50%': {
            boxShadow: '0 0 0 6px rgba(99, 102, 241, 0.1)',
            transform: 'scale(1.05)',
          },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { opacity: '1', transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
        pathGlow: {
          '0%, 100%': { opacity: '0.6', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.3)' },
        },
      },
    },
  },
  plugins: [],
}
