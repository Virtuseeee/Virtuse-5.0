import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Independent static entry points — one HTML shell per module and
    // language (EN, SK, CS, DE; add a language by adding its four entries here
    // and to MODULE_LANGS in src/lib/i18n.ts). Originally: an EN, SK and CS HTML
    // shell per module (index/sk-concierge/cs-concierge,
    // stacking/sk-stacking/cs-stacking, tax-agent/sk-tax-agent/cs-tax-agent,
    // loan/sk-loan/cs-loan). Each language's entry points at the exact
    // same /src/main*.tsx entry script — the React component tree is a
    // single trilingual codebase (see src/lib/i18n.ts) that picks its
    // copy at runtime from <html lang>, not a forked per-language
    // build. No shared client-side routing between modules since
    // they're deployed as separate top-level pages on virtuse.com (EN
    // at the root, SK under sk/, CS under cs/).
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        stacking: path.resolve(__dirname, "stacking.html"),
        tax: path.resolve(__dirname, "tax-agent.html"),
        loan: path.resolve(__dirname, "loan.html"),
        skMain: path.resolve(__dirname, "sk-concierge.html"),
        skStacking: path.resolve(__dirname, "sk-stacking.html"),
        skTax: path.resolve(__dirname, "sk-tax-agent.html"),
        skLoan: path.resolve(__dirname, "sk-loan.html"),
        csMain: path.resolve(__dirname, "cs-concierge.html"),
        csStacking: path.resolve(__dirname, "cs-stacking.html"),
        csTax: path.resolve(__dirname, "cs-tax-agent.html"),
        csLoan: path.resolve(__dirname, "cs-loan.html"),
        deMain: path.resolve(__dirname, "de-concierge.html"),
        deStacking: path.resolve(__dirname, "de-stacking.html"),
        deTax: path.resolve(__dirname, "de-tax-agent.html"),
        deLoan: path.resolve(__dirname, "de-loan.html"),
        frMain: path.resolve(__dirname, "fr-concierge.html"),
        frStacking: path.resolve(__dirname, "fr-stacking.html"),
        frLoan: path.resolve(__dirname, "fr-loan.html"),
        frTax: path.resolve(__dirname, "fr-tax-agent.html"),
        esMain: path.resolve(__dirname, "es-concierge.html"),
        esStacking: path.resolve(__dirname, "es-stacking.html"),
        esLoan: path.resolve(__dirname, "es-loan.html"),
        esTax: path.resolve(__dirname, "es-tax-agent.html"),
        plMain: path.resolve(__dirname, "pl-concierge.html"),
        plStacking: path.resolve(__dirname, "pl-stacking.html"),
        plLoan: path.resolve(__dirname, "pl-loan.html"),
        plTax: path.resolve(__dirname, "pl-tax-agent.html"),
        huMain: path.resolve(__dirname, "hu-concierge.html"),
        huStacking: path.resolve(__dirname, "hu-stacking.html"),
        huLoan: path.resolve(__dirname, "hu-loan.html"),
        huTax: path.resolve(__dirname, "hu-tax-agent.html"),
        ukMain: path.resolve(__dirname, "uk-concierge.html"),
        ukStacking: path.resolve(__dirname, "uk-stacking.html"),
        ukLoan: path.resolve(__dirname, "uk-loan.html"),
        ukTax: path.resolve(__dirname, "uk-tax-agent.html"),
        ruMain: path.resolve(__dirname, "ru-concierge.html"),
        ruStacking: path.resolve(__dirname, "ru-stacking.html"),
        ruLoan: path.resolve(__dirname, "ru-loan.html"),
        ruTax: path.resolve(__dirname, "ru-tax-agent.html"),
      },
    },
  },
});
