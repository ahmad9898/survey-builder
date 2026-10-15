import { createTheme } from '@mui/material/styles';

// Tokens MUI's palette has no slot for (the warning-banner's four-color
// system, the saved-indicator success tint). Kept off `theme.palette` so
// components reach for `theme.custom.*` explicitly rather than overloading
// palette.warning/success in ways that'd also repaint MUI's built-in
// Alert/Chip color="warning" usages.
export interface CustomTokens {
  warningBanner: {
    bg: string;
    border: string;
    iconBg: string;
    icon: string;
    textStrong: string;
    text: string;
  };
  successBanner: {
    bg: string;
    text: string;
  };
}

declare module '@mui/material/styles' {
  interface Theme {
    custom: CustomTokens;
  }
  interface ThemeOptions {
    custom?: CustomTokens;
  }
}

const custom: CustomTokens = {
  warningBanner: {
    bg: '#fffbeb',
    border: '#fde68a',
    iconBg: '#fef3c7',
    icon: '#d97706',
    textStrong: '#78350f',
    text: '#92400e',
  },
  successBanner: {
    bg: '#ecfdf5',
    text: '#10b981',
  },
};

const cardShadow = '0 1px 2px rgba(16,24,40,0.04)';

const DEFAULT_PRIMARY_MAIN = '#4f46e5';

/**
 * Builds the theme both components render under. `primaryColor`, when
 * given, replaces every `primary.main`/`.dark`/`.light`/`.contrastText`
 * usage throughout the library (buttons, selected-state borders/fills,
 * progress rail, etc. -- all of it reads `theme.palette.primary.*`, so one
 * color in here reaches everywhere at once) -- MUI derives `dark`/`light`/
 * `contrastText` from it automatically. Omitted, this reproduces the
 * library's hand-picked default palette exactly (not just a close
 * approximation from the auto-derivation).
 */
export function createLibraryTheme(primaryColor?: string) {
  const primary = primaryColor
    ? { main: primaryColor }
    : { main: DEFAULT_PRIMARY_MAIN, dark: '#4338ca', light: '#eef2ff', contrastText: '#ffffff' };

  return createTheme({
    custom,
    palette: {
      text: {
        primary: '#14171f',
        secondary: '#6b7280',
        disabled: '#94a3b8',
      },
      divider: '#e2e8f0',
      background: {
        default: '#f8fafc',
        paper: '#ffffff',
      },
      primary,
      warning: {
        main: '#d97706',
        light: '#fde68a',
        dark: '#92400e',
      },
      success: {
        main: '#10b981',
        light: '#ecfdf5',
      },
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: '"Plus Jakarta Sans", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { boxShadow: cardShadow },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: cardShadow,
            borderRadius: 14,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 500 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { boxShadow: 'none' },
        },
      },
    },
  });
}

export const theme = createLibraryTheme();
