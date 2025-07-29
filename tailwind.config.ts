import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'spin-reverse': 'spin 25s linear infinite reverse',
        'float': 'float 3s ease-out forwards',
        'fadeOut': 'fadeOut 3s ease-out forwards',
        'slideDown': 'slideDown 0.5s ease-out',
        'slideUp': 'slideUp 0.5s ease-out 4.5s forwards',
      },
      keyframes: {
        float: {
          '0%': { transform: 'translateY(0px) scale(1)', opacity: '1' },
          '50%': { transform: 'translateY(-20px) scale(1.1)', opacity: '0.8' },
          '100%': { transform: 'translateY(-40px) scale(0.8)', opacity: '0' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideDown: {
          '0%': { transform: 'translateX(-50%) translateY(-100%)' },
          '100%': { transform: 'translateX(-50%) translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateX(-50%) translateY(0)', opacity: '1' },
          '100%': { transform: 'translateX(-50%) translateY(-100%)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
export default config
