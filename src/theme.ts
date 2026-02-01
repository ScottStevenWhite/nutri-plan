import { Badge, Button, Card, NavLink, createTheme, rem } from '@mantine/core'

export const theme = createTheme({
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  headings: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    fontWeight: '750',
  },

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
  primaryShade: 6,

  defaultRadius: 'lg',

  components: {
    Card: Card.extend({
      defaultProps: {
        radius: 'lg',
        withBorder: true,
      },
    }),

    Button: Button.extend({
      defaultProps: {
        radius: 'md',
      },
    }),

    Badge: Badge.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),

    NavLink: NavLink.extend({
      styles: theme => ({
        root: {
          borderRadius: theme.radius.md,
          padding: `${rem(10)} ${rem(10)}`,
        },
        label: {
          fontWeight: 800,
        },
        description: {
          fontSize: theme.fontSizes.xs,
          color: theme.colors.gray[6],
        },
      }),
    }),
  },
})
