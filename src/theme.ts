import { createTheme } from '@mantine/core'

export const theme = createTheme({
  // Keep your current “system” feel
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  headings: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    fontWeight: '650',
  },

  // Solid, nutrition-friendly brand color (emerald-ish), no gradients needed
  colors: {
    brand: [
      '#ecfdf5',
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857',
      '#065f46',
      '#064e3b',
    ],
  },

  primaryColor: 'brand',
  primaryShade: 7,
  defaultRadius: 'md',
})
