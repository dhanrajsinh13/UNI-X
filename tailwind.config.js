module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        accent: "#02fa97",
        text: "#1E1E1E"
      },
      borderRadius: {
        card: "1rem"
      },
      boxShadow: {
        card: "0 2px 8px 0 rgba(30,30,30,0.08)"
      }
    }
  },
  plugins: []
};
