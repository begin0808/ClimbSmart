import { useMemo } from "react";
import { BarChart3, Trophy, TrendingUp, Mountain, Award, Layers, CalendarRange } from "lucide-react";

// 難度對應的 CSS 變數色
const DIFF_COLORS = {
  A: "var(--diff-a)",
  B: "var(--diff-b)",
  C: "var(--diff-c)",
  "C+": "var(--diff-c-plus)",
};

// 海拔分級（公尺）
const ELEV_BANDS = [
  { label: "≥ 3800", min: 3800, max: Infinity },
  { label: "3600–3799", min: 3600, max: 3800 },
  { label: "3400–3599", min: 3400, max: 3600 },
  { label: "3200–3399", min: 3200, max: 3400 },
  { label: "< 3200", min: 0, max: 3200 },
];

export default function Statistics({ peaks, dataset, records }) {
  const isMini = dataset === "mini";
  const stats = useMemo(() => {
    const completed = peaks.filter((p) => !!records[p.id]);
    const total = peaks.length;
    const completedCount = completed.length;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const totalElevation = completed.reduce((s, p) => s + p.elevation, 0);

    // 最高完登峰
    const highest = completed.reduce((max, p) => (!max || p.elevation > max.elevation ? p : max), null);

    // 難度分布
    const diffOrder = ["A", "B", "C", "C+"];
    const diffStats = diffOrder
      .map((d) => {
        const inDiff = peaks.filter((p) => p.difficulty === d);
        const done = inDiff.filter((p) => !!records[p.id]).length;
        return { level: d, total: inDiff.length, done, rate: inDiff.length ? Math.round((done / inDiff.length) * 100) : 0 };
      })
      .filter((d) => d.total > 0);

    // 山脈分布
    const rangeNames = [...new Set(peaks.map((p) => p.range))];
    const rangeStats = rangeNames
      .map((r) => {
        const inRange = peaks.filter((p) => p.range === r);
        const done = inRange.filter((p) => !!records[p.id]).length;
        return { name: r, total: inRange.length, done, rate: inRange.length ? Math.round((done / inRange.length) * 100) : 0 };
      })
      .sort((a, b) => b.total - a.total);

    // 海拔分布
    const elevStats = ELEV_BANDS.map((b) => {
      const inBand = peaks.filter((p) => p.elevation >= b.min && p.elevation < b.max);
      const done = inBand.filter((p) => !!records[p.id]).length;
      return { label: b.label, total: inBand.length, done };
    });

    // 完登時間軸（依年份）
    const yearMap = {};
    completed.forEach((p) => {
      const date = records[p.id]?.date;
      const year = date && /^\d{4}/.test(date) ? date.slice(0, 4) : "未填日期";
      yearMap[year] = (yearMap[year] || 0) + 1;
    });
    const yearStats = Object.entries(yearMap)
      .sort((a, b) => (a[0] === "未填日期" ? 1 : b[0] === "未填日期" ? -1 : a[0].localeCompare(b[0])))
      .map(([year, count]) => ({ year, count }));

    return { completedCount, total, completionRate, totalElevation, highest, diffStats, rangeStats, elevStats, yearStats };
  }, [peaks, records]);

  const hasData = stats.completedCount > 0;
  const maxBandTotal = Math.max(...stats.elevStats.map((b) => b.total), 1);
  const maxYearCount = Math.max(...stats.yearStats.map((y) => y.count), 1);

  return (
    <div style={{ flex: 1, padding: "24px", maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 標題 */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <BarChart3 size={24} style={{ color: "var(--primary)" }} />
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--primary)" }}>{isMini ? "小百岳統計視覺化" : "百岳統計視覺化"}</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
            從你的完登紀錄分析難度、海拔與時間趨勢。
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="mist-card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
          <Mountain size={48} style={{ margin: "0 auto 12px", opacity: 0.4, color: "var(--primary-light)" }} />
          <p style={{ fontSize: "1.05rem", fontWeight: "600" }}>尚無完登紀錄</p>
          <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>到儀表板登錄第一座百岳後，這裡就會出現你的專屬統計圖表。</p>
        </div>
      ) : (
        <>
          {/* ===== 總覽數字卡 ===== */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
            <StatCard icon={<Trophy size={20} />} label="完登進度" value={`${stats.completedCount} / ${stats.total}`} sub={`完登率 ${stats.completionRate}%`} />
            <StatCard icon={<TrendingUp size={20} />} label="累計登頂海拔" value={`${stats.totalElevation.toLocaleString()} m`} sub={`≈ ${(stats.totalElevation / 8848).toFixed(1)} 座聖母峰`} />
            <StatCard icon={<Award size={20} />} label="最高完登峰" value={stats.highest ? stats.highest.name : "—"} sub={stats.highest ? `${stats.highest.elevation} m` : ""} />
            <StatCard icon={<Layers size={20} />} label={isMini ? "跨越地區" : "跨越山脈"} value={`${stats.rangeStats.filter((r) => r.done > 0).length} / ${stats.rangeStats.length}`} sub={isMini ? "個地區" : "座主要山脈"} />
          </div>

          {/* ===== 海拔分布長條圖 ===== */}
          <div className="mist-card" style={{ padding: "20px" }}>
            <ChartTitle icon={<Mountain size={16} />} text="海拔分布（已完登 / 總數）" />
            <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "180px", marginTop: "16px", paddingBottom: "4px" }}>
              {stats.elevStats.map((b) => {
                const totalH = (b.total / maxBandTotal) * 140;
                const doneH = b.total ? (b.done / b.total) * totalH : 0;
                return (
                  <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-main)", fontFamily: "Outfit" }}>
                      {b.done}/{b.total}
                    </div>
                    <div style={{ width: "100%", maxWidth: "48px", height: `${totalH}px`, background: "var(--inset-bg-strong)", borderRadius: "6px 6px 0 0", position: "relative", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                      <div style={{ width: "100%", height: `${doneH}px`, background: "linear-gradient(180deg, var(--primary-light), var(--primary))", borderRadius: doneH >= totalH - 1 ? "6px 6px 0 0" : "0", transition: "height 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center", whiteSpace: "nowrap" }}>{b.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== 難度 + 山脈 雙欄 ===== */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            {/* 難度分布 */}
            <div className="mist-card" style={{ padding: "20px" }}>
              <ChartTitle icon={<BarChart3 size={16} />} text="難度完登分布" />
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
                {stats.diffStats.map((d) => (
                  <ProgressRow
                    key={d.level}
                    label={<span className={`difficulty-badge diff-${d.level.replace("+", "-plus")}`} style={{ minWidth: "32px", textAlign: "center" }}>{d.level}</span>}
                    done={d.done}
                    total={d.total}
                    rate={d.rate}
                    color={DIFF_COLORS[d.level]}
                  />
                ))}
              </div>
            </div>

            {/* 山脈分布 */}
            <div className="mist-card" style={{ padding: "20px" }}>
              <ChartTitle icon={<Layers size={16} />} text={isMini ? "地區完登率" : "山脈完登率"} />
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
                {stats.rangeStats.map((r) => (
                  <ProgressRow
                    key={r.name}
                    label={<span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-main)", minWidth: "72px" }}>{r.name}</span>}
                    done={r.done}
                    total={r.total}
                    rate={r.rate}
                    color="var(--primary-light)"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ===== 完登時間軸 ===== */}
          <div className="mist-card" style={{ padding: "20px" }}>
            <ChartTitle icon={<CalendarRange size={16} />} text="完登時間軸（依年份）" />
            <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", height: "160px", marginTop: "16px" }}>
              {stats.yearStats.map((y) => {
                const h = (y.count / maxYearCount) * 120;
                return (
                  <div key={y.year} style={{ flex: 1, minWidth: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: "800", color: "var(--primary)", fontFamily: "Outfit" }}>{y.count}</div>
                    <div style={{ width: "100%", maxWidth: "56px", height: `${h}px`, minHeight: "4px", background: "linear-gradient(180deg, var(--secondary-light), var(--secondary))", borderRadius: "6px 6px 0 0", transition: "height 0.6s ease" }} />
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{y.year}</div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "10px" }}>
              ※ 未填寫登頂日期的紀錄會歸入「未填日期」。
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ===== 小元件 =====
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="mist-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--secondary)" }}>
        {icon}
        <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.35rem", fontWeight: "800", color: "var(--text-main)", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

function ChartTitle({ icon, text }) {
  return (
    <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
      {icon} {text}
    </h3>
  );
}

function ProgressRow({ label, done, total, rate, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      {label}
      <div style={{ flex: 1, height: "10px", background: "var(--inset-bg-strong)", borderRadius: "5px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${rate}%`, background: color, borderRadius: "5px", transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", fontFamily: "Outfit", minWidth: "54px", textAlign: "right" }}>
        {done}/{total}
      </span>
    </div>
  );
}
