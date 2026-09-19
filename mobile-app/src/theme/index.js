/**
 * Brand palette — derived from the Onco Health Mart logo.
 *
 * Ink        #023350   deep navy from the logo mark, used for headings/dark surfaces
 * Blue 500   #2E9FE3   primary brand blue
 * Blue 600   #1C7DC4   pressed/darker blue
 * Success    #17A673   delivered, paid, verified
 * Pending    #F5A623   pending, under review, out for delivery
 * Rx / Alert #FF6B57   prescription flags, destructive actions, discount badges
 * Paper      #F6FAFA   app background
 * Graphite   #14171A   body text
 */
export const brand = {
  ink: '#023350',
  blue500: '#2E9FE3',
  blue600: '#1C7DC4',
  success: '#17A673',
  pending: '#F5A623',
  alert: '#FF6B57',
  paper: '#F6FAFA',
  graphite: '#14171A',
};

export const colors = {
  // core
  primary: brand.blue500,
  primaryDark: brand.blue600,
  primaryLight: '#E4F2FC', // soft tint of Blue 500 for icon tiles and chips
  ink: brand.ink,

  accent: brand.alert,
  accentLight: '#FFEDEA',

  bg: brand.paper,
  card: '#FFFFFF',

  text: brand.graphite,
  muted: '#6B7A85',
  border: '#DDE7EC',

  // status
  success: brand.success,
  successLight: '#E3F6EF',
  warn: brand.pending,
  warnLight: '#FEF3E0',
  red: brand.alert,
  green: brand.success,

  // misc
  dark: brand.ink,
  disabled: '#A8CEEA',
};

export const radius = {
  lg: 16,
  md: 12,
  sm: 10,
  xs: 8,
  pill: 20,
};

export const shadow = {
  shadowColor: brand.ink,
  shadowOpacity: 0.1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export const font = {
  h1: { fontSize: 20, fontWeight: '700', color: colors.text },
  h2: { fontSize: 16, fontWeight: '700', color: colors.text },
  h3: { fontSize: 14, fontWeight: '600', color: colors.text },
  body: { fontSize: 13, color: colors.text },
  small: { fontSize: 11, color: colors.muted },
  tiny: { fontSize: 10, color: colors.muted },
};

export default { brand, colors, radius, shadow, font };
