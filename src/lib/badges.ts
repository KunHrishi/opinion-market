export type BadgeRarity = "common" | "rare" | "elite";

export interface Badge {
  id: string;
  label: string;
  icon: string;
  description: string;
  rarity: BadgeRarity;
}

export const BADGES: Badge[] = [
  /* =======================
     ENTRY / ONBOARDING
  ======================= */
  {
    id: "first_market",
    label: "First Market",
    icon: "🎉",
    description: "Placed your first prediction",
    rarity: "common",
  },
  {
    id: "first_win",
    label: "Bullseye",
    icon: "🎯",
    description: "First correct prediction",
    rarity: "common",
  },
  {
    id: "early_user",
    label: "Early User",
    icon: "🚀",
    description: "Joined the platform early",
    rarity: "common",
  },

  /* =======================
     ACCURACY & SKILL
  ======================= */
  {
    id: "probability_pro",
    label: "Probability Pro",
    icon: "🧮",
    description: "Maintained high accuracy over many predictions",
    rarity: "rare",
  },
  {
    id: "market_reader",
    label: "Market Reader",
    icon: "📊",
    description: "Consistently beats market odds",
    rarity: "rare",
  },
  {
    id: "sharp_eye",
    label: "Sharp Eye",
    icon: "🔍",
    description: "Correctly predicted a low-probability outcome",
    rarity: "rare",
  },

  /* =======================
     STREAKS & CONSISTENCY
  ======================= */
  {
    id: "win_streak_5",
    label: "Win Streak",
    icon: "🔥",
    description: "5 correct predictions in a row",
    rarity: "rare",
  },
  {
    id: "win_streak_10",
    label: "Hot Hand",
    icon: "🌋",
    description: "10 correct predictions in a row",
    rarity: "elite",
  },
  {
    id: "no_misses_week",
    label: "No Misses",
    icon: "🛡️",
    description: "No incorrect predictions in a week",
    rarity: "rare",
  },
  {
    id: "consistent_forecaster",
    label: "Consistent Forecaster",
    icon: "⏳",
    description: "Active and predicting consistently for 30 days",
    rarity: "rare",
  },

  /* =======================
     RISK & CAPITAL
  ======================= */
  {
    id: "risk_manager",
    label: "Risk Manager",
    icon: "💼",
    description: "Avoided major drawdowns over time",
    rarity: "rare",
  },
  {
    id: "balanced_trader",
    label: "Balanced Trader",
    icon: "⚖️",
    description: "Uses multiple options responsibly",
    rarity: "common",
  },
  {
    id: "capital_preserver",
    label: "Capital Preserver",
    icon: "🧱",
    description: "Finished a month net positive",
    rarity: "rare",
  },
  {
    id: "high_conviction",
    label: "High Conviction",
    icon: "🚀",
    description: "Large correct stake on a risky outcome",
    rarity: "elite",
  },

  /* =======================
     ADVANCED STRATEGY
  ======================= */
  {
    id: "contrarian",
    label: "Contrarian",
    icon: "🧠",
    description: "Won against majority sentiment",
    rarity: "elite",
  },
  {
    id: "early_adopter",
    label: "Early Adopter",
    icon: "🧪",
    description: "Entered markets early and won",
    rarity: "rare",
  },
  {
    id: "sniper",
    label: "Sniper",
    icon: "🏹",
    description: "Correct prediction just before resolution",
    rarity: "rare",
  },
  {
    id: "market_maker",
    label: "Market Maker",
    icon: "📈",
    description: "Provided early liquidity in many markets",
    rarity: "rare",
  },

  /* =======================
     ELITE PERFORMANCE
  ======================= */
  {
    id: "elite_forecaster",
    label: "Elite Forecaster",
    icon: "🏆",
    description: "Top percentile by ROI",
    rarity: "elite",
  },
  {
    id: "legend",
    label: "Legend",
    icon: "🏅",
    description: "One of the best predictors on the platform",
    rarity: "elite",
  },

  /* =======================
     LONG TERM / VETERAN
  ======================= */
  {
    id: "veteran_3m",
    label: "Veteran",
    icon: "🕰️",
    description: "Active for 3 months",
    rarity: "common",
  },
  {
    id: "veteran_6m",
    label: "Seasoned",
    icon: "🧓",
    description: "Active for 6 months",
    rarity: "rare",
  },
  {
    id: "veteran_12m",
    label: "Institution",
    icon: "🏛️",
    description: "Active for 1 year",
    rarity: "elite",
  },
];
