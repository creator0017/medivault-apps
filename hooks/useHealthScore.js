import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "../context/UserContext";
import { db } from "../firebaseConfig";
import {
  buildMonthlyScores,
  calculateHealthScore,
  getAchievements,
  getLatestByType,
  getRecommendations,
  getScoreBreakdown,
} from "../utils/healthScore";

export default function useHealthScore() {
  const { userData } = useUser();
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!userData?.uid) { setLoading(false); return; }

    setLoading(true);
    const q = query(
      collection(db, "users", userData.uid, "healthReports"),
      orderBy("testDate", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!isMounted.current) return;
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setReports(docs);
        setLoading(false);
      },
      (err) => {
        if (!isMounted.current) return;
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [userData?.uid]);

  const healthScore     = useMemo(() => calculateHealthScore(reports),         [reports]);
  const breakdown       = useMemo(() => getScoreBreakdown(reports),             [reports]);
  const monthlyScores   = useMemo(() => buildMonthlyScores(reports),            [reports]);
  const recommendations = useMemo(() => getRecommendations(reports),            [reports]);
  const achievements    = useMemo(() => getAchievements(reports, healthScore),  [reports, healthScore]);

  const latestHbA1c = useMemo(() => getLatestByType(reports, "hba1c"),  [reports]);
  const latestFBS   = useMemo(() => getLatestByType(reports, "fbs"),    [reports]);
  const latestPPBS  = useMemo(() => getLatestByType(reports, "ppbs"),   [reports]);

  // Month-over-month trend for the score number
  const scoreTrend = useMemo(() => {
    const filled = monthlyScores.filter((m) => m.score != null);
    if (filled.length < 2) return null;
    return filled[filled.length - 1].score - filled[filled.length - 2].score;
  }, [monthlyScores]);

  const totalTests  = reports.length;
  const thisMonth   = useMemo(() => {
    const now = new Date();
    return reports.filter((r) => {
      const d = r.testDate?.seconds ? new Date(r.testDate.seconds * 1000) : r.testDate instanceof Date ? r.testDate : null;
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [reports]);

  // Next recommended test: 30 days after the most recent report
  const nextTestDate = useMemo(() => {
    if (!reports.length) return null;
    const latest = reports[0];
    const d = latest.testDate?.seconds ? new Date(latest.testDate.seconds * 1000) : latest.testDate instanceof Date ? latest.testDate : null;
    if (!d) return null;
    const next = new Date(d);
    next.setDate(next.getDate() + 30);
    return next;
  }, [reports]);

  return {
    reports,
    loading,
    error,
    healthScore,
    breakdown,
    monthlyScores,
    recommendations,
    achievements,
    latestHbA1c,
    latestFBS,
    latestPPBS,
    scoreTrend,
    totalTests,
    thisMonth,
    nextTestDate,
  };
}
