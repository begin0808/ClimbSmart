import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, RotateCcw, AlertTriangle, CheckSquare, Dumbbell, ShieldAlert, Printer, Milestone, ExternalLink, CloudSun } from "lucide-react";
import { ROUTE_TEMPLATES, PEAKS } from "../data/peaks";
import { MINI_PEAKS } from "../data/miniPeaks";
import { loadGearPlans, saveGearPlan } from "../utils/db";

const CATEGORIES = [
  { id: "clothing", name: "衣物與穿著", color: "#4ea8de" },
  { id: "sleep", name: "睡眠與遮蔽", color: "#a87c53" },
  { id: "kitchen", name: "炊事與水糧", color: "#e76f51" },
  { id: "emergency", name: "安全與緊急", color: "#d62828" },
  { id: "other", name: "其他裝備", color: "#6b7c75" }
];

// WMO 天氣代碼與中文字義/圖示對照
const getWeatherDisplay = (code) => {
  if (code === 0) return { label: "晴朗", emoji: "☀️", color: "#f39c12" };
  if ([1, 2, 3].includes(code)) return { label: "多雲", emoji: "🌤️", color: "#7f8c8d" };
  if ([45, 48].includes(code)) return { label: "有霧", emoji: "🌫️", color: "#bdc3c7" };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { label: "有雨", emoji: "🌧️", color: "#3498db" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "降雪", emoji: "❄️", color: "#ecf0f1" };
  if ([95, 96, 99].includes(code)) return { label: "雷雨", emoji: "⛈️", color: "#9b59b6" };
  return { label: "陰天", emoji: "☁️", color: "#95a5a6" };
};

export default function GearPlanner({ dataset, onLocateOnMap }) {
  const [selectedRouteId, setSelectedRouteId] = useState(ROUTE_TEMPLATES[0].id);
  const [gears, setGears] = useState([]);
  
  // 新增裝備表單狀態
  const [newItemName, setNewItemName] = useState("");
  const [newItemWeight, setNewItemWeight] = useState(0);
  const [newItemCategory, setNewItemCategory] = useState("clothing");

  // 剖面圖互動狀態
  const [hoveredWaypoint, setHoveredWaypoint] = useState(null);
  const [hoveredX, setHoveredX] = useState(null);

  // 天氣預報狀態與快取
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);
  const [weatherUpdateTime, setWeatherUpdateTime] = useState(null);
  const [isOfflineWeather, setIsOfflineWeather] = useState(false);
  const [selectedWeatherLoc, setSelectedWeatherLoc] = useState(null);

  // 載入路線裝備
  useEffect(() => {
    const savedPlans = loadGearPlans();
    if (savedPlans[selectedRouteId]) {
      setGears(savedPlans[selectedRouteId]);
    } else {
      const template = ROUTE_TEMPLATES.find((r) => r.id === selectedRouteId);
      setGears(template ? template.gears : []);
    }
  }, [selectedRouteId]);

  // 儲存裝備
  const updateAndSaveGears = (newGears) => {
    setGears(newGears);
    saveGearPlan(selectedRouteId, newGears);
  };

  const currentRoute = useMemo(() => {
    return ROUTE_TEMPLATES.find((r) => r.id === selectedRouteId) || ROUTE_TEMPLATES[0];
  }, [selectedRouteId]);

  // 當路線切換時，預設將天氣定位點設為該路線的登山口
  useEffect(() => {
    if (currentRoute?.elevationProfile?.length > 0) {
      const trailhead = currentRoute.elevationProfile[0];
      setSelectedWeatherLoc({
        name: trailhead.name || `${currentRoute.name} 登山口`,
        lat: trailhead.lat,
        lng: trailhead.lng,
        id: `waypoint:0`
      });
    } else {
      setSelectedWeatherLoc(null);
    }
  }, [currentRoute]);

  // 載入與快取氣象預報（綁定 selectedWeatherLoc）
  useEffect(() => {
    if (!selectedWeatherLoc || !selectedWeatherLoc.lat || !selectedWeatherLoc.lng) {
      setWeatherData(null);
      return;
    }

    const cacheKey = `weather_cache_${selectedWeatherLoc.lat.toFixed(4)}_${selectedWeatherLoc.lng.toFixed(4)}`;
    const mainCacheKey = "tw100peaks_weather_cache";
    
    // 優先嘗試讀取快取
    const loadCachedWeather = () => {
      try {
        const cacheRaw = localStorage.getItem(mainCacheKey);
        if (cacheRaw) {
          const cache = JSON.parse(cacheRaw);
          if (cache[cacheKey]) {
            setWeatherData(cache[cacheKey].data);
            setWeatherUpdateTime(cache[cacheKey].timestamp);
            setIsOfflineWeather(true);
            return true;
          }
        }
      } catch (e) {
        console.error("讀取天氣快取失敗:", e);
      }
      return false;
    };

    const fetchWeather = async () => {
      setWeatherLoading(true);
      setWeatherError(null);
      setIsOfflineWeather(false);

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedWeatherLoc.lat}&longitude=${selectedWeatherLoc.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia/Taipei`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("天氣伺服器回應錯誤");
        
        const data = await response.json();
        const daily = data.daily;
        
        // 格式化 5 天的預報資料
        const forecastList = [];
        for (let i = 0; i < 5; i++) {
          forecastList.push({
            date: daily.time[i],
            weatherCode: daily.weathercode[i],
            tempMax: Math.round(daily.temperature_2m_max[i]),
            tempMin: Math.round(daily.temperature_2m_min[i]),
            precip: daily.precipitation_sum[i]
          });
        }

        // 更新 State
        setWeatherData(forecastList);
        const now = Date.now();
        setWeatherUpdateTime(now);

        // 寫入快取
        try {
          const cacheRaw = localStorage.getItem(mainCacheKey);
          const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
          cache[cacheKey] = {
            data: forecastList,
            timestamp: now
          };
          localStorage.setItem(mainCacheKey, JSON.stringify(cache));
        } catch (e) {
          console.error("儲存天氣快取失敗:", e);
        }
      } catch (err) {
        console.warn("無法連接天氣 API，嘗試載入快取...", err);
        const hasCache = loadCachedWeather();
        if (!hasCache) {
          setWeatherError("無法獲取天氣預報（目前處於離線狀態且無快取紀錄）");
        }
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [selectedWeatherLoc]);

  // 處理氣象位置選單切換
  const handleWeatherLocChange = (e) => {
    const val = e.target.value;
    if (!val) return;

    const [type, idStr] = val.split(":");
    if (type === "waypoint") {
      const idx = parseInt(idStr, 10);
      const waypoint = currentRoute.elevationProfile?.[idx];
      if (waypoint) {
        setSelectedWeatherLoc({
          name: waypoint.name || `${currentRoute.name} 點位 ${idx + 1}`,
          lat: waypoint.lat,
          lng: waypoint.lng,
          id: `waypoint:${idx}`
        });
      }
    } else if (type === "peak") {
      const peakId = parseInt(idStr, 10);
      const peaksList = dataset === "mini" ? MINI_PEAKS : PEAKS;
      const peak = peaksList.find((p) => p.id === peakId);
      if (peak) {
        setSelectedWeatherLoc({
          name: peak.name,
          lat: peak.lat,
          lng: peak.lng,
          id: `peak:${peak.id}`
        });
      }
    }
  };

  // 重量計算
  const weightStats = useMemo(() => {
    const checkedGears = gears.filter((g) => g.checked);
    const totalWeight = checkedGears.reduce((sum, g) => sum + g.weight, 0);
    const baseWeight = checkedGears
      .filter((g) => g.category !== "kitchen")
      .reduce((sum, g) => sum + g.weight, 0);

    return {
      totalG: totalWeight,
      totalKg: (totalWeight / 1000).toFixed(2),
      baseG: baseWeight,
      baseKg: (baseWeight / 1000).toFixed(2),
      packedCount: checkedGears.length,
      totalCount: gears.length
    };
  }, [gears]);

  // 切換勾選
  const handleToggleCheck = (gearId) => {
    const updated = gears.map((g) => (g.id === gearId ? { ...g, checked: !g.checked } : g));
    updateAndSaveGears(updated);
  };

  // 修改重量
  const handleWeightChange = (gearId, weightVal) => {
    const weight = Math.max(0, parseInt(weightVal, 10) || 0);
    const updated = gears.map((g) => (g.id === gearId ? { ...g, weight } : g));
    updateAndSaveGears(updated);
  };

  // 刪除裝備
  const handleDeleteGear = (gearId) => {
    const updated = gears.filter((g) => g.id !== gearId);
    updateAndSaveGears(updated);
  };

  // 重設為模板
  const handleResetToTemplate = () => {
    if (window.confirm("確定要重設裝備清單為預設模板嗎？這會覆寫您目前的自訂裝備。")) {
      const template = ROUTE_TEMPLATES.find((r) => r.id === selectedRouteId);
      updateAndSaveGears(template ? template.gears : []);
    }
  };

  // 新增自訂裝備
  const handleAddGear = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem = {
      id: "custom_" + Date.now(),
      name: newItemName.trim(),
      category: newItemCategory,
      weight: Math.max(0, newItemWeight),
      checked: true
    };

    updateAndSaveGears([...gears, newItem]);
    setNewItemName("");
    setNewItemWeight(0);
  };

  // 觸發列印模式
  const handlePrint = () => {
    window.print();
  };

  // ----------------------------------------------------
  // SVG 海拔剖面圖點位映射計算
  // ----------------------------------------------------
  const svgProfileData = useMemo(() => {
    const profile = currentRoute.elevationProfile || [];
    if (profile.length === 0) return null;

    const svgWidth = 600;
    const svgHeight = 160;
    const paddingLeft = 50;
    const paddingRight = 30;
    const paddingTop = 25;
    const paddingBottom = 30;

    const distances = profile.map((p) => p.distance);
    const elevations = profile.map((p) => p.elevation);

    const maxDistance = Math.max(...distances) || 1;
    const maxElevation = 4000; // 台灣百岳高度頂點大約 4000m
    const minElevation = 2400; // 最低給 2400m，以便展示爬升高度差

    const points = profile.map((p) => {
      const x = paddingLeft + (p.distance / maxDistance) * (svgWidth - paddingLeft - paddingRight);
      const y = svgHeight - paddingBottom - ((p.elevation - minElevation) / (maxElevation - minElevation)) * (svgHeight - paddingTop - paddingBottom);
      return { ...p, x, y };
    });

    // 建立折線 Path 的 d 屬性
    const linePath = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    // 建立下方填充陰影區域的 Path
    const fillPath = `
      ${linePath} 
      L ${points[points.length - 1].x} ${svgHeight - paddingBottom} 
      L ${points[0].x} ${svgHeight - paddingBottom} 
      Z
    `;

    return {
      svgWidth,
      svgHeight,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      points,
      linePath,
      fillPath,
      minElevation,
      maxElevation
    };
  }, [currentRoute]);

  return (
    <div style={{ flex: 1, padding: "24px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* 列印專用抬頭 (僅在列印時顯示，被 CSS 控制) */}
      <div className="gear-checklist-print-header" style={{ display: "none" }}>
        <h2>智行百岳登山裝備確認清單</h2>
        <p style={{ fontSize: "1rem", marginTop: "5px" }}>路線：{currentRoute.name} &bull; 天數：{currentRoute.days} 天</p>
        <p style={{ fontSize: "0.9rem", color: "#444" }}>
          裝備基礎重量：{weightStats.baseKg} kg &bull; 總重量：{weightStats.totalKg} kg
        </p>
      </div>

      {/* 頂部路線選擇列 */}
      <div className="mist-card hide-on-print" style={{ padding: "20px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
        <div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--primary)" }}>山系裝備規劃器</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2px" }}>
            依據不同百岳路線規劃裝備，動態計算您的背包負重。
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {ROUTE_TEMPLATES.map((route) => (
              <button
                key={route.id}
                onClick={() => setSelectedRouteId(route.id)}
                className={selectedRouteId === route.id ? "btn-primary" : "btn-secondary"}
                style={{ padding: "6px 14px", fontSize: "0.85rem" }}
              >
                {route.name}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="btn-secondary"
            style={{
              padding: "7px 12px",
              fontSize: "0.85rem",
              borderColor: "var(--primary-light)",
              color: "var(--primary-light)",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
            title="列印或匯出 PDF 裝備確認表"
          >
            <Printer size={16} /> 匯出 PDF / 列印
          </button>
        </div>
      </div>

      {/* 主版面 */}
      <div
        className="gear-planner-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          alignItems: "start"
        }}
      >
        
        {/* 左側：裝備分類清單與新增 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* 新增自訂裝備 */}
          <div className="mist-card hide-on-print" style={{ padding: "16px 20px" }}>
            <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Plus size={16} /> 新增自訂裝備
            </h4>
            <form onSubmit={handleAddGear} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="裝備名稱 (如：保暖防滑手套)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  required
                  style={{
                    flex: 2,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1.5px solid var(--border-glass)",
                    background: "rgba(255, 255, 255, 0.8)",
                    fontSize: "0.85rem"
                  }}
                />
                <input
                  type="number"
                  placeholder="重量 (g)"
                  value={newItemWeight || ""}
                  onChange={(e) => setNewItemWeight(parseInt(e.target.value, 10) || 0)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1.5px solid var(--border-glass)",
                    background: "rgba(255, 255, 255, 0.8)",
                    fontSize: "0.85rem"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1.5px solid var(--border-glass)",
                    background: "rgba(255, 255, 255, 0.8)",
                    fontSize: "0.85rem"
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-primary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                  新增至清單
                </button>
              </div>
            </form>
          </div>

          {/* 分類裝備清單 */}
          <div className="mist-card print-full-width" style={{ padding: "20px" }}>
            <div className="hide-on-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)" }}>裝備檢查清單</h4>
              <button
                onClick={handleResetToTemplate}
                className="btn-secondary"
                style={{
                  padding: "4px 8px",
                  fontSize: "0.75rem",
                  borderColor: "var(--text-muted)",
                  color: "var(--text-main)",
                  borderWidth: "1px"
                }}
              >
                <RotateCcw size={12} /> 還原模板
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {CATEGORIES.map((category) => {
                const categoryGears = gears.filter((g) => g.category === category.id);
                if (categoryGears.length === 0) return null;

                return (
                  <div key={category.id} style={{ borderBottom: "1px solid rgba(0, 0, 0, 0.05)", paddingBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                      <div className="hide-on-print" style={{ width: "4px", height: "14px", borderRadius: "2px", background: category.color }} />
                      <span style={{ fontWeight: "700", fontSize: "0.85rem", color: "var(--text-main)" }}>
                        {category.name} ({categoryGears.length})
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {categoryGears.map((gear) => (
                        <div
                          key={gear.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            background: gear.checked ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.01)",
                            opacity: gear.checked ? 1 : 0.6
                          }}
                          className="print-list-row"
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                            <input
                              type="checkbox"
                              className="climb-checkbox"
                              checked={gear.checked}
                              onChange={() => handleToggleCheck(gear.id)}
                            />
                            <span style={{ fontSize: "0.85rem", color: "var(--text-main)", fontWeight: gear.checked ? "600" : "400" }}>
                              {gear.name}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="number"
                              value={gear.weight || ""}
                              onChange={(e) => handleWeightChange(gear.id, e.target.value)}
                              className="hide-on-print"
                              style={{
                                width: "60px",
                                padding: "4px",
                                border: "1px solid var(--border-glass)",
                                borderRadius: "4px",
                                textAlign: "right",
                                fontSize: "0.8rem",
                                background: "rgba(255,255,255,0.6)"
                              }}
                            />
                            <span style={{ fontSize: "0.85rem", fontFamily: "Outfit", color: "var(--text-main)" }} className="show-on-print">
                              {gear.weight}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>g</span>
                            <button
                              onClick={() => handleDeleteGear(gear.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                padding: "4px",
                                display: "flex"
                              }}
                              className="delete-gear-btn hide-on-print"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右側：負重分析與海拔剖面圖 */}
        <div className="print-full-width" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* 重量統計看板 */}
          <div className="mist-card" style={{ padding: "20px" }}>
            <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Dumbbell size={18} /> 背包負重分析
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
              {/* 基礎重量 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                  <div>
                    <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-muted)" }}>基礎重量 (Base Weight)</span>
                    <p className="hide-on-print" style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "0" }}>排除水、食物等消耗品</p>
                  </div>
                  <span style={{ fontSize: "1.4rem", fontWeight: "800", fontFamily: "Outfit", color: "var(--primary)" }}>
                    {weightStats.baseKg} <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>kg</span>
                  </span>
                </div>
                <div className="hide-on-print" style={{ width: "100%", height: "8px", background: "rgba(0,0,0,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (weightStats.baseG / currentRoute.baseWeightLimit) * 100)}%`,
                      background: weightStats.baseG > currentRoute.baseWeightLimit ? "var(--diff-c-plus)" : "var(--primary-light)",
                      borderRadius: "4px",
                      transition: "width 0.4s ease"
                    }}
                  />
                </div>
                <div className="hide-on-print" style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  <span>建議上限：{(currentRoute.baseWeightLimit / 1000).toFixed(1)} kg</span>
                  {weightStats.baseG > currentRoute.baseWeightLimit && (
                    <span style={{ color: "var(--diff-c-plus)", fontWeight: "600", display: "flex", alignItems: "center", gap: "2px" }}>
                      <AlertTriangle size={12} /> 超出負擔！
                    </span>
                  )}
                </div>
              </div>

              {/* 總重量 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                  <div>
                    <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-muted)" }}>出發總重量 (Total Weight)</span>
                    <p className="hide-on-print" style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "0" }}>出發起點的所有打包重量</p>
                  </div>
                  <span style={{ fontSize: "1.4rem", fontWeight: "800", fontFamily: "Outfit", color: "var(--primary)" }}>
                    {weightStats.totalKg} <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>kg</span>
                  </span>
                </div>
                <div className="hide-on-print" style={{ width: "100%", height: "8px", background: "rgba(0,0,0,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (weightStats.totalG / currentRoute.totalWeightLimit) * 100)}%`,
                      background: weightStats.totalG > currentRoute.totalWeightLimit ? "var(--diff-c-plus)" : "var(--accent-sky)",
                      borderRadius: "4px",
                      transition: "width 0.4s ease"
                    }}
                  />
                </div>
                <div className="hide-on-print" style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  <span>打包建議上限：{(currentRoute.totalWeightLimit / 1000).toFixed(1)} kg</span>
                </div>
              </div>
            </div>

            {/* 打包比例 */}
            <div
              style={{
                background: "rgba(45, 90, 39, 0.05)",
                borderRadius: "10px",
                padding: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckSquare size={16} style={{ color: "var(--primary-light)" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>已打包項目比例</span>
              </div>
              <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)" }}>
                {weightStats.packedCount} / {weightStats.totalCount} 項 ({weightStats.totalCount > 0 ? Math.round((weightStats.packedCount / weightStats.totalCount) * 100) : 0}%)
              </span>
            </div>
          </div>

          {/* 天氣預報暫存看板 */}
          <div className="mist-card hide-on-print" style={{ padding: "20px" }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              flexWrap: "wrap", 
              gap: "10px", 
              marginBottom: "14px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              paddingBottom: "10px"
            }}>
              <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <CloudSun size={18} style={{ color: "var(--secondary)" }} />
                {selectedWeatherLoc ? `${selectedWeatherLoc.name}天氣預報` : "登山口天氣預報"}
              </h4>
              
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={selectedWeatherLoc?.id || ""}
                  onChange={handleWeatherLocChange}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1.5px solid var(--border-glass)",
                    background: "rgba(255, 255, 255, 0.8)",
                    fontSize: "0.8rem",
                    color: "var(--text-main)",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  {currentRoute?.elevationProfile?.length > 0 && (
                    <optgroup label="當前路線點位">
                      {currentRoute.elevationProfile.map((wp, idx) => (
                        <option key={`wp-${idx}`} value={`waypoint:${idx}`}>
                          {wp.name || `點位 ${idx + 1}`}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={dataset === "mini" ? "熱門小百岳" : "熱門百岳"}>
                    {(dataset === "mini" ? MINI_PEAKS : PEAKS).slice(0, 10).map((peak) => (
                      <option key={`hot-peak-${peak.id}`} value={`peak:${peak.id}`}>
                        {peak.name} ({peak.elevation}m)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={dataset === "mini" ? "所有小百岳" : "所有百岳"}>
                    {(dataset === "mini" ? MINI_PEAKS : PEAKS).map((peak) => (
                      <option key={`peak-${peak.id}`} value={`peak:${peak.id}`}>
                        {peak.name} ({peak.elevation}m)
                      </option>
                    ))}
                  </optgroup>
                </select>

                <a
                  href="https://www.cwa.gov.tw/V8/C/W/Mountain/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--primary-light)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    textDecoration: "none",
                    fontWeight: "600",
                    background: "rgba(45, 90, 39, 0.05)",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    transition: "all 0.2s ease"
                  }}
                  title="連結至中央氣象署查看更多氣象、衛星雲圖與豪大雨特報"
                >
                  <ExternalLink size={12} /> CWA 氣象署山岳氣象
                </a>
              </div>
            </div>

            {weatherLoading ? (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                正在載入天氣資訊...
              </div>
            ) : weatherError ? (
              <div style={{ padding: "10px", background: "rgba(214,40,40,0.05)", borderRadius: "6px", color: "var(--diff-c-plus)", fontSize: "0.8rem", fontWeight: "600" }}>
                {weatherError}
              </div>
            ) : weatherData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {isOfflineWeather && (
                  <div style={{ fontSize: "0.75rem", color: "#d35400", background: "rgba(243,156,18,0.1)", padding: "6px 10px", borderRadius: "6px", fontWeight: "600" }}>
                    ⚠️ 離線模式：顯示快取天氣（如遇天候惡劣請謹慎評估）
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
                  {weatherData.map((day, idx) => {
                    const display = getWeatherDisplay(day.weatherCode);
                    const dateObj = new Date(day.date);
                    const weekDays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
                    const label = idx === 0 ? "今日" : weekDays[dateObj.getDay()];

                    return (
                      <div
                        key={day.date}
                        style={{
                          background: "rgba(0,0,0,0.02)",
                          borderRadius: "8px",
                          padding: "8px 4px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px",
                          border: "1px solid rgba(0,0,0,0.03)"
                        }}
                      >
                        <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-main)" }}>
                          {label}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {day.date.split("-").slice(1).join("/")}
                        </span>
                        <span style={{ fontSize: "1.5rem", margin: "4px 0" }} title={display.label}>
                          {display.emoji}
                        </span>
                        <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--primary)", fontFamily: "Outfit" }}>
                          {day.tempMin}°~{day.tempMax}°
                        </span>
                        {day.precip > 0 ? (
                          <span style={{ fontSize: "0.65rem", color: "#3498db", fontWeight: "600", fontFamily: "Outfit" }}>
                            💧 {day.precip}mm
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", opacity: 0.6 }}>
                            無雨
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {weatherUpdateTime && (
                  <div style={{ textAlign: "right", fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "6px" }}>
                    數據源：Open-Meteo • 氣象更新時間：{new Date(weatherUpdateTime).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                無天氣預報資料。
              </div>
            )}
          </div>

          {/* 互動式海拔剖面圖 */}
          {svgProfileData && (
            <div className="mist-card hide-on-print" style={{ padding: "20px" }}>
              <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Milestone size={18} style={{ color: "var(--secondary)" }} /> 路線海拔剖面示意圖
              </h4>
              
              <div style={{ position: "relative" }}>
                {/* SVG 渲染 */}
                {/* SVG 渲染 */}
                <svg
                  viewBox={`0 0 ${svgProfileData.svgWidth} ${svgProfileData.svgHeight}`}
                  style={{ width: "100%", height: "auto", touchAction: "none" }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * svgProfileData.svgWidth;
                    if (x >= svgProfileData.paddingLeft && x <= svgProfileData.svgWidth - svgProfileData.paddingRight) {
                      setHoveredX(x);
                      let closestPt = null;
                      let minDist = Infinity;
                      svgProfileData.points.forEach((pt) => {
                        const dist = Math.abs(pt.x - x);
                        if (dist < minDist) {
                          minDist = dist;
                          closestPt = pt;
                        }
                      });
                      setHoveredWaypoint(closestPt);
                    }
                  }}
                  onTouchMove={(e) => {
                    if (e.touches && e.touches[0]) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.touches[0].clientX - rect.left) / rect.width) * svgProfileData.svgWidth;
                      if (x >= svgProfileData.paddingLeft && x <= svgProfileData.svgWidth - svgProfileData.paddingRight) {
                        setHoveredX(x);
                        let closestPt = null;
                        let minDist = Infinity;
                        svgProfileData.points.forEach((pt) => {
                          const dist = Math.abs(pt.x - x);
                          if (dist < minDist) {
                            minDist = dist;
                            closestPt = pt;
                          }
                        });
                        setHoveredWaypoint(closestPt);
                      }
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredX(null);
                    setHoveredWaypoint(null);
                  }}
                  onTouchEnd={() => {
                    setHoveredX(null);
                    setHoveredWaypoint(null);
                  }}
                >
                  {/* 背景漸層 */}
                  <defs>
                    <linearGradient id="chart-glow" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(45, 90, 39, 0.2)" />
                      <stop offset="100%" stopColor="rgba(255, 255, 255, 0.0)" />
                    </linearGradient>
                  </defs>

                  {/* 網格虛線 (海拔高度 2500m, 3000m, 3500m) */}
                  {[2500, 3000, 3500, 4000].map((elev) => {
                    const y = svgProfileData.svgHeight - svgProfileData.paddingBottom - ((elev - svgProfileData.minElevation) / (svgProfileData.maxElevation - svgProfileData.minElevation)) * (svgProfileData.svgHeight - svgProfileData.paddingTop - svgProfileData.paddingBottom);
                    return (
                      <g key={elev}>
                        <line
                          x1={svgProfileData.paddingLeft}
                          y1={y}
                          x2={svgProfileData.svgWidth - svgProfileData.paddingRight}
                          y2={y}
                          stroke="rgba(0,0,0,0.06)"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={svgProfileData.paddingLeft - 8}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="9"
                          fill="var(--text-muted)"
                          fontFamily="Outfit"
                        >
                          {elev}m
                        </text>
                      </g>
                    );
                  })}

                  {/* 填充高度下方陰影 */}
                  <path d={svgProfileData.fillPath} fill="url(#chart-glow)" />

                  {/* 互動式垂直追蹤虛線 */}
                  {hoveredX && (
                    <line
                      x1={hoveredX}
                      y1={svgProfileData.paddingTop}
                      x2={hoveredX}
                      y2={svgProfileData.svgHeight - svgProfileData.paddingBottom}
                      stroke="var(--secondary)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      pointerEvents="none"
                    />
                  )}

                  {/* 折線主路徑 */}
                  <path
                    d={svgProfileData.linePath}
                    fill="none"
                    stroke="var(--primary-light)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* 航點標記圓圈 */}
                  {svgProfileData.points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredWaypoint?.name === p.name ? 6 : 3.5}
                      fill={hoveredWaypoint?.name === p.name ? "var(--secondary)" : "var(--primary-light)"}
                      stroke="white"
                      strokeWidth="1.5"
                      style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                    />
                  ))}
                </svg>

                {/* 浮動 Tooltip 顯示地標細節 */}
                <div
                  style={{
                    minHeight: "44px",
                    background: "rgba(255,255,255,0.9)",
                    border: "1px solid var(--border-glass)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    marginTop: "8px",
                    fontSize: "0.8rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center"
                  }}
                >
                  {hoveredWaypoint ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <div>
                        <span style={{ fontWeight: "700", color: "var(--primary)", fontSize: "0.85rem" }}>
                          {hoveredWaypoint.name}
                        </span>
                        <span style={{ marginLeft: "8px", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                          里程：{hoveredWaypoint.distance} km &bull; 海拔：{hoveredWaypoint.elevation} m
                        </span>
                      </div>
                      {hoveredWaypoint.lat && (
                        <button
                          onClick={() => {
                            if (onLocateOnMap) {
                              onLocateOnMap({
                                lat: hoveredWaypoint.lat,
                                lng: hoveredWaypoint.lng,
                                name: hoveredWaypoint.name,
                                elevation: hoveredWaypoint.elevation
                              });
                            }
                          }}
                          style={{
                            background: "var(--primary)",
                            color: "white",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "background 0.2s ease"
                          }}
                          className="btn-hover-effect"
                        >
                          📍 在地圖中定位
                        </button>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      💡 滑動或觸摸剖面圖，即可檢視航點詳情，點選「在地圖中定位」可同步跳轉至地形圖查看位置。
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 輕量化建議 (列印時隱藏) */}
          <div className="mist-card hide-on-print" style={{ padding: "20px", display: "flex", gap: "12px" }}>
            <ShieldAlert size={24} style={{ color: "var(--secondary)", flexShrink: 0 }} />
            <div>
              <h4 style={{ fontSize: "0.9rem", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>輕量化登山建議</h4>
              <ul style={{ fontSize: "0.8rem", color: "var(--text-muted)", paddingLeft: "14px", display: "flex", flexDirection: "column", gap: "4px", margin: "0" }}>
                <li><b>優先減輕大三件</b>：帳篷、睡袋、背包是核心重量來源，可挑選輕量化材質。</li>
                <li><b>食物脫水化</b>：以脫水蔬菜、乾燥飯取代罐頭與生鮮，可大幅縮減重量與垃圾量。</li>
                <li><b>多功能合一</b>：例如登山杖可兼營帳支柱、套鍋可以共用，避免帶重複性質的裝備。</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* 列印樣式與懸浮 CSS 注入 */}
      <style>{`
        .delete-gear-btn:hover {
          color: var(--diff-c-plus) !important;
        }
        
        /* 列印媒體樣式控制 */
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .hide-on-print, .sidebar, .mobile-header, .app-container > aside {
            display: none !important;
          }
          .app-container {
            display: block !important;
            min-height: auto !important;
          }
          .main-content {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .gear-planner-grid {
            display: block !important;
          }
          .print-full-width {
            width: 100% !important;
            margin-top: 20px !important;
          }
          .mist-card {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            transform: none !important;
          }
          .climb-checkbox {
            border-color: black !important;
          }
          .print-list-row {
            background: transparent !important;
            border-bottom: 1px solid #ddd !important;
            padding: 4px 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
