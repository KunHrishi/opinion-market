interface BadgeStats {
  marketsParticipated: number;
  wins: number;
  losses: number;
  breakeven: number;
  winStreak: number;
  bestStreak: number;
  netProfitLoss: number;
  avgStake: number;
  avgProfit: number;
  riskScore: "Conservative" | "Balanced" | "Aggressive";
  joinedAt: Date | null;
}

export function evaluateBadges(stats: BadgeStats): string[] {
  const badges: string[] = [];

  /* ---------- ENTRY ---------- */
  if (stats.marketsParticipated >= 1) {
    badges.push("first_market");
  }

  if (stats.wins >= 1) {
    badges.push("first_win");
  }

  /* ---------- STREAKS ---------- */
  if (stats.winStreak >= 5) {
    badges.push("win_streak_5");
  }

  if (stats.winStreak >= 10) {
    badges.push("win_streak_10");
  }

  if (stats.bestStreak >= 10) {
    badges.push("hot_hand");
  }

  /* ---------- PERFORMANCE ---------- */
  if (stats.netProfitLoss > 0 && stats.wins >= 5) {
    badges.push("capital_preserver");
  }

  if (stats.avgProfit > 20 && stats.wins >= 10) {
    badges.push("market_reader");
  }

  /* ---------- RISK ---------- */
  if (stats.riskScore === "Balanced" && stats.marketsParticipated >= 10) {
    badges.push("balanced_trader");
  }

  if (stats.riskScore === "Conservative" && stats.netProfitLoss > 0) {
    badges.push("risk_manager");
  }

  /* ---------- LONG TERM ---------- */
  if (stats.joinedAt) {
    const daysActive =
      (Date.now() - stats.joinedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysActive >= 30) badges.push("consistent_forecaster");
    if (daysActive >= 90) badges.push("veteran_3m");
    if (daysActive >= 180) badges.push("veteran_6m");
    if (daysActive >= 365) badges.push("veteran_12m");
  }

  return badges;
}
