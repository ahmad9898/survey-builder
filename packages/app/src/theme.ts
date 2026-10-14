import { createTheme } from '@mui/material/styles';

// This app's own shell theme (the home/survey-list page) -- independent of
// <SurveyBuilder>/<SurveyRunner>'s internal theme, which each component
// carries (and scopes via its own Emotion cache) on its own.
const cardShadow = '0 1px 2px rgba(16,24,40,0.04)';

export const theme = createTheme({
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
    primary: {
      main: '#4f46e5',
      dark: '#4338ca',
      light: '#eef2ff',
      contrastText: '#ffffff',
    },
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
