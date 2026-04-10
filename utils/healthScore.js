// ─── Health Score Calculation Utilities ─────────────────────────────────────
// Used by HealthDashboard and HomeScreen

/** Get the most-recent report matching a test type keyword */
export function getLatestByType(reports, typeKeyword) {
  const kw = typeKeyword.toLowerCase();
  const filtered = reports
    .filter((r) => String(r.testType || "").toLowerCase().includes(kw))
    .sort((a, b) => {
      const aTime = a.testDate?.seconds ?? (a.testDate instanceof Date ? a.testDate.getTime() / 1000 : 0);
      const bTime = b.testDate?.seconds ?? (b.testDate instanceof Date ? b.testDate.getTime() / 1000 : 0);
      return bTime - aTime;
    });
  return filtered[0] || null;
}

/** Convert a Firestore Timestamp or Date to a JS Date */
export function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val.seconds != null) return new Date(val.seconds * 1000);
  return new Date(val);
}

// ─── Individual scoring functions (return 0-100) ────────────────────────────

export function scoreHbA1c(value) {
  if (value == null || isNaN(value)) return null;
  if (value < 5.7) return 100;
  if (value <= 6.4) return Math.round(95 - (value - 5.7) * 21.4);
  if (value <= 6.9) return Math.round(75 - (value - 6.5) * 30);
  if (value <= 8.0) return Math.round(55 - (value - 7.0) * 15);
  return Math.max(0, Math.round(35 - (value - 8.0) * 10));
}

export function scoreFBS(value) {
  if (value == null || isNaN(value)) return null;
  if (value >= 70 && value <= 100) return 100;
  if (value < 70) return Math.max(0, Math.round(100 - (70 - value) * 2));
  if (value <= 125) return Math.round(95 - (value - 100) * 1.2);
  if (value <= 180) return Math.round(65 - (value - 126) * 0.65);
  return Math.max(0, Math.round(25 - (value - 180) * 0.5));
}

export function scorePPBS(value) {
  if (value == null || isNaN(value)) return null;
  if (value < 140) return 100;
  if (value <= 180) return Math.round(95 - (value - 140) * 0.75);
  if (value <= 250) return Math.round(60 - (value - 181) * 0.5);
  return Math.max(0, Math.round(20 - (value - 250) * 0.2));
}

export function scoreConsistency(reports) {
  if (!reports?.length) return 0;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recent = reports.filter((r) => {
    const d = toDate(r.testDate);
    return d && d >= sixMonthsAgo;
  });

  const monthKeys = new Set(
    recent.map((r) => {
      const d = toDate(r.testDate);
      return d ? `${d.getMonth()}-${d.getFullYear()}` : null;
    }).filter(Boolean)
  );

  return Math.round((monthKeys.size / 6) * 100);
}

export function scoreTrend(reports) {
  if (!reports?.length) return 50;
  const hba1cReports = reports
    .filter((r) => String(r.testType || "").toLowerCase().includes("hba1c"))
    .sort((a, b) => {
      const aTime = toDate(a.testDate)?.getTime() ?? 0;
      const bTime = toDate(b.testDate)?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  if (hba1cReports.length < 2) return 50;
  const latest = hba1cReports[0].value;
  const oldest = hba1cReports[hba1cReports.length - 1].value;
  const change = oldest - latest; // positive = improvement

  if (change >= 0.5) return 100;
  if (change >= 0.2) return 80;
  if (change >= -0.2) return 60;
  if (change >= -0.5) return 30;
  return 0;
}

// ─── Main composite score ────────────────────────────────────────────────────

export function calculateHealthScore(reports) {
  if (!reports?.length) return null;

  const latestHbA1c  = getLatestByType(reports, "hba1c");
  const latestFBS    = getLatestByType(reports, "fbs");
  const latestPPBS   = getLatestByType(reports, "ppbs");

  const hba1cScore  = latestHbA1c  ? scoreHbA1c(latestHbA1c.value)  : null;
  const fbsScore    = latestFBS    ? scoreFBS(latestFBS.value)        : null;
  const ppbsScore   = latestPPBS   ? scorePPBS(latestPPBS.value)      : null;
  const consScore   = scoreConsistency(reports);
  const trendScore  = scoreTrend(reports);

  // Fallback weights when a category is missing
  let total = 0, weight = 0;
  if (hba1cScore != null) { total += hba1cScore * 0.40; weight += 0.40; }
  if (fbsScore   != null) { total += fbsScore   * 0.25; weight += 0.25; }
  if (ppbsScore  != null) { total += ppbsScore  * 0.20; weight += 0.20; }
  total += consScore  * 0.10; weight += 0.10;
  total += trendScore * 0.05; weight += 0.05;

  return weight > 0 ? Math.round(total / weight) : null;
}

// ─── Score breakdown for UI bars ─────────────────────────────────────────────

export function getScoreBreakdown(reports) {
  const latestHbA1c = getLatestByType(reports, "hba1c");
  const latestFBS   = getLatestByType(reports, "fbs");
  const latestPPBS  = getLatestByType(reports, "ppbs");
  const consScore   = scoreConsistency(reports);
  const trendScore  = scoreTrend(reports);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentMonths = new Set(
    reports.filter(r => { const d = toDate(r.testDate); return d && d >= sixMonthsAgo; })
           .map(r => { const d = toDate(r.testDate); return d ? `${d.getMonth()}-${d.getFullYear()}` : null; })
           .filter(Boolean)
  ).size;

  const trendLabel = trendScore >= 80 ? "Improving" : trendScore >= 50 ? "Stable" : "Declining";
  const trendIcon  = trendScore >= 80 ? "trending-up" : trendScore >= 50 ? "minus" : "trending-down";

  return [
    {
      label: "HbA1c Score",
      weight: "40%",
      score: latestHbA1c ? scoreHbA1c(latestHbA1c.value) : null,
      valueLabel: latestHbA1c ? `HbA1c: ${latestHbA1c.value}%` : "No data",
    },
    {
      label: "Fasting Sugar",
      weight: "25%",
      score: latestFBS ? scoreFBS(latestFBS.value) : null,
      valueLabel: latestFBS ? `FBS: ${latestFBS.value} mg/dL` : "No data",
    },
    {
      label: "Post-Prandial",
      weight: "20%",
      score: latestPPBS ? scorePPBS(latestPPBS.value) : null,
      valueLabel: latestPPBS ? `PPBS: ${latestPPBS.value} mg/dL` : "No data",
    },
    {
      label: "Test Consistency",
      weight: "10%",
      score: consScore,
      valueLabel: `${recentMonths}/6 months`,
    },
    {
      label: "Trend Direction",
      weight: "5%",
      score: trendScore,
      valueLabel: trendLabel,
      icon: trendIcon,
    },
  ];
}

// ─── Historical scores per month ─────────────────────────────────────────────

export function buildMonthlyScores(reports) {
  if (!reports?.length) return [];

  // Last 6 calendar months
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({ month: d.getMonth(), year: d.getFullYear() });
  }

  return months.map(({ month, year }) => {
    const monthReports = reports.filter((r) => {
      const d = toDate(r.testDate);
      return d && d.getMonth() === month && d.getFullYear() === year;
    });
    const score = monthReports.length ? calculateHealthScore(monthReports) : null;
    const label = new Date(year, month, 1).toLocaleString("default", { month: "short" });
    return { label, score, month, year };
  });
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export function scoreStatus(score) {
  if (score == null) return { label: "No Data", color: "#94A3B8", bg: "#F1F5F9" };
  if (score >= 80) return { label: "Excellent",          color: "#10B981", bg: "#D1FAE5" };
  if (score >= 60) return { label: "Good",               color: "#F59E0B", bg: "#FEF3C7" };
  if (score >= 40) return { label: "Needs Improvement",  color: "#F97316", bg: "#FFEDD5" };
  return               { label: "High Risk",             color: "#EF4444", bg: "#FEE2E2" };
}

export function scoreBarColor(score) {
  if (score == null) return "#CBD5E1";
  if (score >= 80) return "#10B981";
  if (score >= 60) return "#F59E0B";
  if (score >= 40) return "#F97316";
  return "#EF4444";
}

// ─── AI-style recommendations ────────────────────────────────────────────────

export function getRecommendations(reports) {
  const recs = [];
  const latestHbA1c = getLatestByType(reports, "hba1c");
  const latestFBS   = getLatestByType(reports, "fbs");
  const latestPPBS  = getLatestByType(reports, "ppbs");

  if (latestHbA1c && latestHbA1c.value >= 7.0) {
    recs.push({
      icon: "alert-circle",
      iconColor: "#EF4444",
      title: "HbA1c Elevated",
      description: `Your HbA1c is ${latestHbA1c.value}% (target <7.0%). Consider consulting your doctor to adjust your management plan.`,
    });
  } else if (latestHbA1c && latestHbA1c.value < 5.7) {
    recs.push({
      icon: "check-circle",
      iconColor: "#10B981",
      title: "HbA1c in Normal Range",
      description: `Excellent! Your HbA1c is ${latestHbA1c.value}%, well within normal range. Keep up your healthy habits.`,
    });
  }

  if (latestPPBS && latestPPBS.value > 180) {
    recs.push({
      icon: "walk",
      iconColor: "#F59E0B",
      title: "Post-Meal Sugar Spikes",
      description: `Your PPBS is ${latestPPBS.value} mg/dL. Try a 15-minute walk after meals — it can reduce post-meal sugar by up to 20%.`,
    });
  }

  if (latestFBS && latestFBS.value > 125) {
    recs.push({
      icon: "food-apple",
      iconColor: "#F97316",
      title: "Fasting Sugar High",
      description: `Fasting sugar at ${latestFBS.value} mg/dL. Avoid late-night snacks and stay hydrated before your morning test.`,
    });
  }

  const consScore = scoreConsistency(reports);
  if (consScore < 70) {
    recs.push({
      icon: "calendar-clock",
      iconColor: "#8B5CF6",
      title: "Irregular Testing",
      description: "You've missed tests in some months. Regular monitoring (at least monthly) helps catch changes early and track progress.",
    });
  }

  const trendScore = scoreTrend(reports);
  if (trendScore >= 80) {
    recs.push({
      icon: "trending-up",
      iconColor: "#10B981",
      title: "Great Progress!",
      description: "Your HbA1c has been improving over your last few tests. Keep up your current routine — it's working!",
    });
  }

  if (recs.length === 0) {
    recs.push({
      icon: "heart-pulse",
      iconColor: "#2E75B6",
      title: "Upload Your Reports",
      description: "Upload your HbA1c, Fasting Sugar, and Post-Prandial Sugar reports to get personalised AI recommendations.",
    });
  }

  return recs;
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export function getAchievements(reports, healthScore) {
  const badges = [];

  if (reports.length >= 1) {
    badges.push({ id: "first", icon: "🎯", title: "First Upload", subtitle: "Uploaded your first report" });
  }
  if (reports.length >= 10) {
    badges.push({ id: "dedicated", icon: "📋", title: "Dedicated Tracker", subtitle: "10+ reports uploaded" });
  }

  const consScore = scoreConsistency(reports);
  if (consScore === 100) {
    badges.push({ id: "consistent", icon: "🎖️", title: "6-Month Streak", subtitle: "Tested every month" });
  } else if (consScore >= 50) {
    badges.push({ id: "streak", icon: "🔥", title: "On a Streak", subtitle: "Regular monitoring" });
  }

  if (healthScore != null && healthScore >= 80) {
    badges.push({ id: "excellent", icon: "🏆", title: "Excellent Control", subtitle: `Score: ${healthScore}/100` });
  }

  const trendScore = scoreTrend(reports);
  if (trendScore >= 80) {
    badges.push({ id: "improving", icon: "📈", title: "Improved Score", subtitle: "HbA1c trending down" });
  }

  return badges;
}
