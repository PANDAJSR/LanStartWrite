const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..', '..')

module.exports = {
  content: [path.join(projectRoot, 'src/**/*.{ts,tsx,html}')],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      keyframes: {
        'ls-pop-in': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0px) scale(1)' }
        },
        'ls-soft-pulse': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-1px)' }
        }
      },
      animation: {
        'ls-pop-in': 'ls-pop-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'ls-soft-pulse': 'ls-soft-pulse 1600ms ease-in-out infinite'
      }
    }
  },
  plugins: []
}
