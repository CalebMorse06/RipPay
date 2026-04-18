export const Colors = {
  // Backgrounds
  background: '#FFFFFF',
  surface: '#F7F8FA',
  surfaceAlt: '#EDEEF2',

  // Borders
  border: '#E4E6EB',
  borderStrong: '#C8CAD0',

  // Brand / primary action
  primary: '#3D95CE',
  primaryDark: '#2176AE',
  primaryLight: '#EBF5FC',

  // Text
  textPrimary: '#1A1D23',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  // Semantic
  success: '#00B386',
  successLight: '#E6F8F3',
  error: '#E53E3E',
  errorLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FFFBEB',

  // Amount display
  amountText: '#1A1D23',

  // Nav / header
  headerBackground: '#FFFFFF',
  headerTint: '#1A1D23',
};

export const Typography = {
  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 26,
  xxl: 38,

  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    shadowColor: '#3D95CE',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
};
