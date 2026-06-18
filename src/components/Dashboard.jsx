import React, { useState, useMemo, useEffect } from "react";
import { Search, Filter, Trophy, TrendingUp, Compass, Calendar, Camera, MapPin } from "lucide-react";

export default function Dashboard({ peaks, dataset, records, photos, onOpenRecord }) {
  const isMini = dataset === "mini";
  // 篩選器與搜尋狀態
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRange, setSelectedRange] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all"); // all, done, todo
  const [sortBy, setSortBy] = useState("id-asc"); // id-asc, elev-desc, elev-asc, diff-asc

  // 切換資料集時重置可能不存在於新資料集的篩選條件
  useEffect(() => {
    setSelectedRange("all");
    setSelectedDifficulty("all");
  }, [dataset]);

  // 1. 數據統計計算
  const stats = useMemo(() => {
    const total = peaks.length;
    const completedList = peaks.filter((p) => !!records[p.id]);
    const completedCount = completedList.length;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    // 累計爬升高度
    const totalElevation = completedList.reduce((sum, p) => sum + p.elevation, 0);

    // 山脈/地區完登分布（依資料集動態取得）
    const ranges = [...new Set(peaks.map((p) => p.range))];
    const rangeStats = ranges.map((r) => {
      const totalInRange = peaks.filter((p) => p.range === r).length;
      const doneInRange = completedList.filter((p) => p.range === r).length;
      const rate = totalInRange > 0 ? Math.round((doneInRange / totalInRange) * 100) : 0;
      return { name: r, total: totalInRange, done: doneInRange, rate };
    });

    // 難度完登分布
    const diffs = ["A", "B", "C", "C+"];
    const diffStats = diffs.map((d) => {
      const totalInDiff = peaks.filter((p) => p.difficulty === d).length;
      const doneInDiff = completedList.filter((p) => p.difficulty === d).length;
      const rate = totalInDiff > 0 ? Math.round((doneInDiff / totalInDiff) * 100) : 0;
      return { level: d, total: totalInDiff, done: doneInDiff, rate };
    });

    return {
      completedCount,
      completionRate,
      totalElevation,
      rangeStats,
      diffStats
    };
  }, [peaks, records]);

  // 2. 資料過濾與排序
  const filteredPeaks = useMemo(() => {
    let result = [...peaks];

    // 搜尋關鍵字 (山名或縣市)
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.county.toLowerCase().includes(query) ||
          p.elevation.toString().includes(query)
      );
    }

    // 篩選山脈
    if (selectedRange !== "all") {
      result = result.filter((p) => p.range === selectedRange);
    }

    // 篩選難度
    if (selectedDifficulty !== "all") {
      result = result.filter((p) => p.difficulty === selectedDifficulty);
    }

    // 篩選狀態
    if (selectedStatus !== "all") {
      if (selectedStatus === "done") {
        result = result.filter((p) => !!records[p.id]);
      } else {
        result = result.filter((p) => !records[p.id]);
      }
    }

    // 排序
    result.sort((a, b) => {
      if (sortBy === "id-asc") return a.id - b.id;
      if (sortBy === "elev-desc") return b.elevation - a.elevation;
      if (sortBy === "elev-asc") return a.elevation - b.elevation;
      if (sortBy === "diff-asc") {
        const diffMap = { A: 1, B: 2, C: 3, "C+": 4 };
        return diffMap[a.difficulty] - diffMap[b.difficulty];
      }
      return 0;
    });

    return result;
  }, [peaks, records, searchQuery, selectedRange, selectedDifficulty, selectedStatus, sortBy]);

  return (
    <div style={{ flex: 1, padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* 1. 數據統計面板 */}
      <div
        className="stats-panel"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
          marginBottom: "30px"
        }}
      >
        {/* 主要進度卡 */}
        <div className="mist-card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "20px" }}>
          {/* SVG Progress Ring */}
          <div style={{ position: "relative", width: "90px", height: "90px", flexShrink: 0 }}>
            <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="50" cy="50" r="42" stroke="rgba(45, 90, 39, 0.08)" strokeWidth="8" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="var(--primary-light)"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="263.8"
                strokeDashoffset={263.8 - (263.8 * stats.completionRate) / 100}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center"
              }}
            >
              <span style={{ fontSize: "1.4rem", fontWeight: "800", fontFamily: "Outfit", color: "var(--primary)" }}>
                {stats.completionRate}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>%</span>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Trophy size={18} style={{ color: "var(--secondary)" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--primary)" }}>{isMini ? "小百岳完登進度" : "百岳完登進度"}</h3>
            </div>
            <p style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "6px", color: "var(--text-main)" }}>
              {stats.completedCount} <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "var(--text-muted)" }}>/ {peaks.length} 座</span>
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
              {isMini ? "台灣小百岳郊山健行收集" : "台灣百岳完登俱樂部認證起點"}
            </p>
          </div>
        </div>

        {/* 累計高度與資訊卡 */}
        <div className="mist-card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "var(--primary-glow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary-light)"
            }}
          >
            <TrendingUp size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-muted)" }}>累計登頂海拔高度</h3>
            <p style={{ fontSize: "1.6rem", fontWeight: "800", marginTop: "4px", color: "var(--text-main)" }}>
              {stats.totalElevation.toLocaleString()}{" "}
              <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "var(--text-muted)" }}>公尺</span>
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
              相當於攀登了 {(stats.totalElevation / 8848).toFixed(1)} 座珠穆朗瑪峰
            </p>
          </div>
        </div>

        {/* 山脈與難度分布卡 */}
        <div className="mist-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: "700", color: "var(--primary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Compass size={16} /> {isMini ? "地區完登率" : "山脈完登率"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {stats.rangeStats.map((r) => (
              <div key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: "600", marginBottom: "3px" }}>
                  <span>{r.name}</span>
                  <span style={{ color: "var(--primary-light)" }}>
                    {r.done} / {r.total} ({r.rate}%)
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "rgba(45, 90, 39, 0.08)", borderRadius: "3px" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${r.rate}%`,
                      background: "var(--primary-light)",
                      borderRadius: "3px",
                      transition: "width 0.6s ease"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. 篩選與搜尋面板 */}
      <div
        className="mist-card"
        style={{
          padding: "16px 20px",
          marginBottom: "24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        {/* 搜尋 */}
        <div style={{ position: "relative", minWidth: "220px", flex: "1 1 220px" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="搜尋百岳名稱、高度或縣市..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 36px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-glass)",
              background: "rgba(255, 255, 255, 0.7)",
              color: "var(--text-main)",
              fontSize: "0.9rem",
              fontFamily: "var(--font-family)"
            }}
          />
        </div>

        {/* 篩選群組 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          {/* 山脈/地區篩選（依資料集動態） */}
          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-glass)",
              background: "rgba(255, 255, 255, 0.7)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            <option value="all">{isMini ? "所有地區" : "所有山脈"}</option>
            {stats.rangeStats.map((r) => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>

          {/* 難度篩選 */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-glass)",
              background: "rgba(255, 255, 255, 0.7)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            <option value="all">所有難度</option>
            <option value="A">A 級 (入門)</option>
            <option value="B">B 級 (中階)</option>
            <option value="C">C 級 (挑戰)</option>
            <option value="C+">C+ 級 (特殊)</option>
          </select>

          {/* 狀態篩選 */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-glass)",
              background: "rgba(255, 255, 255, 0.7)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            <option value="all">全部狀態</option>
            <option value="done">已完登</option>
            <option value="todo">未完登</option>
          </select>

          {/* 排序 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-glass)",
              background: "rgba(255, 255, 255, 0.7)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            <option value="id-asc">依編號排序</option>
            <option value="elev-desc">高度由高至低</option>
            <option value="elev-asc">高度由低至高</option>
            <option value="diff-asc">依難度升序</option>
          </select>
        </div>
      </div>

      {/* 3. 百岳卡片列表 */}
      {filteredPeaks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <Compass size={48} style={{ margin: "0 auto 12px", opacity: 0.5, color: "var(--primary-light)" }} />
          <p style={{ fontSize: "1.1rem", fontWeight: "600" }}>找不到符合條件的百岳</p>
          <p style={{ fontSize: "0.9rem", opacity: 0.8, marginTop: "4px" }}>請嘗試調整篩選器或關鍵字</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "12px", fontWeight: "500" }}>
            共顯示 {filteredPeaks.length} 座山峰
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "16px"
            }}
          >
            {filteredPeaks.map((peak) => {
              const record = records[peak.id];
              const isClimbed = !!record;
              const photo = photos[peak.id];

              return (
                <div
                  key={peak.id}
                  className="mist-card"
                  onClick={() => onOpenRecord(peak)}
                  style={{
                    padding: "16px",
                    cursor: "pointer",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    borderLeft: isClimbed ? "5px solid var(--primary-light)" : "1px solid var(--border-glass)",
                    background: isClimbed ? "rgba(255, 255, 255, 0.85)" : "var(--bg-glass)"
                  }}
                >
                  <div>
                    {/* Header: ID & Checked Checkbox / Photo Indicator */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          fontFamily: "Outfit",
                          color: "var(--text-muted)",
                          background: "rgba(0,0,0,0.05)",
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}
                      >
                        #{String(peak.num || peak.id).padStart(3, "0")}
                      </span>

                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {isClimbed && photo && (
                          <Camera size={14} style={{ color: "var(--primary-light)" }} title="有上傳相片" />
                        )}
                        <input
                          type="checkbox"
                          className="climb-checkbox"
                          checked={isClimbed}
                          onChange={(e) => {
                            e.stopPropagation();
                            onOpenRecord(peak);
                          }}
                        />
                      </div>
                    </div>

                    {/* Peak Name */}
                    <h4 style={{ fontSize: "1.15rem", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>
                      {peak.name}
                    </h4>

                    {/* Height */}
                    <p style={{ fontSize: "0.85rem", fontWeight: "600", fontFamily: "Outfit", color: "var(--primary)" }}>
                      {peak.elevation} m
                    </p>
                  </div>

                  {/* Metadata & Footer */}
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {peak.range}
                      </span>
                      <span className={`difficulty-badge diff-${peak.difficulty.replace("+", "-plus")}`}>
                        {peak.difficulty}
                      </span>
                    </div>

                    {/* 所在地點：縣市 + 鄉鎮/區 */}
                    {peak.county && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "4px", marginTop: "8px", fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                        <MapPin size={12} style={{ flexShrink: 0, marginTop: "1px", color: "var(--primary-light)" }} />
                        <span>{peak.county}</span>
                      </div>
                    )}

                    {isClimbed && record.date && (
                      <div
                        style={{
                          marginTop: "8px",
                          paddingTop: "8px",
                          borderTop: "1px dashed rgba(0,0,0,0.06)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.75rem",
                          color: "var(--primary-light)",
                          fontWeight: "500"
                        }}
                      >
                        <Calendar size={12} /> {record.date} 登頂
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
