import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindcssTypography from "@tailwindcss/typography";
import plugin from "tailwindcss/plugin";

// Squircle utilities — Story 81-1+ (Epic 81 Squircle Design System).
// NOTE: `squircle-full` is intentionally an alias for `rounded-full` (9999px).
// A perfect circle is a degenerate squircle, so no real shape change is required.
// Kept under `squircle-*` namespace only for naming consistency across the design system.
const squirclePlugin = plugin(({ addUtilities }) => {
  addUtilities({
    ".squircle-sm": { borderRadius: "var(--squircle-radius-sm)" },
    ".squircle-md": { borderRadius: "var(--squircle-radius-md)" },
    ".squircle-lg": { borderRadius: "var(--squircle-radius-lg)" },
    ".squircle-2xl": { borderRadius: "var(--squircle-radius-2xl)" },
    ".squircle-full": { borderRadius: "9999px" },
  });
});

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        /* ── v2 Design Token Colors ── */
        "v2-canvas": "hsl(var(--v2-bg-canvas))",
        "v2-card": "hsl(var(--v2-bg-card))",
        "v2-text": {
          primary: "hsl(var(--v2-text-primary))",
          secondary: "hsl(var(--v2-text-secondary))",
          tertiary: "hsl(var(--v2-text-tertiary))",
        },
        "v2-accent": {
          primary: "hsl(var(--v2-accent-primary))",
          warm: "hsl(var(--v2-accent-warm))",
        },
        "v2-border": "hsl(var(--v2-border-subtle))",
        nav: {
          dashboard: "hsl(var(--nav-dashboard))",
          "dashboard-bg": "hsl(var(--nav-dashboard-bg))",
          gestione: "hsl(var(--nav-gestione))",
          "gestione-bg": "hsl(var(--nav-gestione-bg))",
          strumenti: "hsl(var(--nav-strumenti))",
          "strumenti-bg": "hsl(var(--nav-strumenti-bg))",
          supporto: "hsl(var(--nav-supporto))",
          "supporto-bg": "hsl(var(--nav-supporto-bg))",
          admin: "hsl(var(--nav-admin))",
          "admin-bg": "hsl(var(--nav-admin-bg))",
          messaggi: "hsl(var(--nav-messaggi))",
          "messaggi-bg": "hsl(var(--nav-messaggi-bg))",
          pianificazione: "hsl(var(--nav-pianificazione))",
          "pianificazione-bg": "hsl(var(--nav-pianificazione-bg))",
        },
      },
      spacing: {
        "v2-section": "var(--v2-space-section)",
        "v2-card-pad": "var(--v2-space-card-padding)",
        "v2-hero-pad": "var(--v2-space-hero-padding)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "v2-card": "var(--v2-radius-card)",
        "v2-inner": "var(--v2-radius-inner)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ['"DM Sans"', "Inter", "system-ui", "sans-serif"],
        caveat: ["Caveat", "cursive"],
      },
      boxShadow: {
        elevated: "0 4px 24px -4px rgba(0,0,0,0.1), 0 2px 8px -2px rgba(0,0,0,0.06)",
        "v2-card": "var(--v2-shadow-card)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-from-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "v2-fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-in-from-left": "slide-in-from-left 0.3s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.3s ease-out",
        "fade-in-up": "fade-in-up 0.4s ease-out both",
        "v2-fade-in-up": "v2-fade-in-up 0.5s ease-out both",
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindcssTypography, squirclePlugin],
} satisfies Config;
