// Shared colour palette for Number Rules.
//
// Matches the Koloso student-screen design system (Design Style Guide v11):
// a deep forest-green interior, white cards with hairline maroon borders,
// brand-yellow primary actions, and green / burnt-orange / deep-red semantics.
// Two text surfaces: light text on the green background, ink text on white cards.
export const COLORS = {
  // Surfaces
  bg: '#173404', // deep forest green — device interior (app background)
  card: '#FFFFFF', // white cards
  cardBorder: '#85210C', // hairline maroon

  // Text on the green background
  text: '#F8F3ED', // paper cream
  textMuted: '#A9C2A0', // soft sage

  // Text on white cards
  ink: '#203020', // ink green-black
  inkMuted: '#6E7B69', // muted grey-green

  // Brand actions & accents
  accent: '#F1C230', // brand yellow — primary buttons, highlights, links
  accentText: '#203020', // ink text on yellow
  indigo: '#4586C0', // cool counterpoint (secondary actions)

  // Semantic (Koloso timer & feedback states)
  correct: '#36781E', // teach-loop green
  warn: '#B46004', // burnt orange
  wrong: '#A50000', // deep red

  // Soft tints for the answer-reveal backgrounds on white cards
  selectBg: '#FDF0C6', // pale yellow — a rule you've selected
  correctBg: '#DDEBD2', // pale green — a true rule you got
  missBg: '#F6E2CC', // pale orange — a true rule you missed
  wrongBg: '#F3D6D6', // pale red — a false rule you picked
};
