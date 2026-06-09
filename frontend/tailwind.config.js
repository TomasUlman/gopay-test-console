export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        terminal: {
          bg: '#050a14',
          panel: '#0a1424',
          panel2: '#0d1b30',
          line: '#1c365d',
          text: '#d7fffb',
          muted: '#85a6bc',
          cyan: '#4dfcff',
          green: '#42ff9e',
          red: '#ff4d6d',
          orange: '#ffb84d',
          violet: '#a78bfa',
        },
      },
    },
  },
  plugins: [],
};
