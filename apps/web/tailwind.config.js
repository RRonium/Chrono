module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#050a14',
        card: '#0b1424',
        accent: '#d4a64a',
        // Palette: deep navy terminal with a gold accent
        cyber: {
          bg: '#050a14',
          card: '#0b1424',
          border: 'rgba(212,166,74,0.22)',
          accent: '#d4a64a',
          green: '#22c55e',
          red: '#ef4444',
        },
        gold: { DEFAULT: '#d4a64a', soft: '#e8c882', dim: '#8a6d2f' },
        ink: { DEFAULT: '#e6edf7', muted: '#8fa0b8', faint: '#5d6e88' },
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
};
