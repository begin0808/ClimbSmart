import React, { useMemo, useRef, useState, useEffect } from "react";

// Haversine formula to compute distance in meters
function haversine(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export default function RouteElevationProfile({
  points = [], // [lat, lon, ele]
  hoveredIndex = null,
  onHoverPointChange = () => {}
}) {
  const svgRef = useRef(null);
  const [localHoverIdx, setLocalHoverIdx] = useState(null);

  // 1. 計算每一點的累積距離與高度
  const profileData = useMemo(() => {
    if (!points || points.length === 0) return [];

    const data = [];
    let accumulatedDistance = 0;

    data.push({
      distance: 0,
      elevation: points[0][2] || 0,
      lat: points[0][0],
      lng: points[0][1],
      index: 0
    });

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dist = haversine(prev[0], prev[1], curr[0], curr[1]) / 1000; // 轉為公里
      accumulatedDistance += dist;

      data.push({
        distance: parseFloat(accumulatedDistance.toFixed(3)),
        elevation: curr[2] || 0,
        lat: curr[0],
        lng: curr[1],
        index: i
      });
    }
    return data;
  }, [points]);

  // 2. SVG 尺寸與邊界設定
  const width = 600;
  const height = 150;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };

  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // 3. 計算比例尺邊界
  const scale = useMemo(() => {
    if (profileData.length === 0) return null;

    const distances = profileData.map((d) => d.distance);
    const elevations = profileData.map((d) => d.elevation);

    const maxDistance = Math.max(...distances) || 1;
    const minElevation = Math.max(0, Math.min(...elevations) - 50);
    const maxElevation = Math.max(...elevations) + 50;
    const elevationSpan = maxElevation - minElevation || 1;

    return {
      maxDistance,
      minElevation,
      maxElevation,
      elevationSpan
    };
  }, [profileData]);

  // 4. 將里程與高度映射到 SVG 座標系統
  const mappedPoints = useMemo(() => {
    if (!scale || profileData.length === 0) return [];

    return profileData.map((d) => {
      const x = padding.left + (d.distance / scale.maxDistance) * graphWidth;
      const y =
        padding.top +
        (1 - (d.elevation - scale.minElevation) / scale.elevationSpan) * graphHeight;
      return { ...d, x, y };
    });
  }, [profileData, scale, graphWidth, graphHeight]);

  // 5. 構建繪圖路徑
  const svgPaths = useMemo(() => {
    if (mappedPoints.length === 0) return { line: "", fill: "" };

    const linePath = mappedPoints
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    const fillPath = `
      ${linePath}
      L ${mappedPoints[mappedPoints.length - 1].x} ${height - padding.bottom}
      L ${mappedPoints[0].x} ${height - padding.bottom}
      Z
    `;

    return { line: linePath, fill: fillPath };
  }, [mappedPoints]);

  if (profileData.length === 0 || !scale) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", padding: "20px 0" }}>
        暫無軌跡高度剖面資訊
      </div>
    );
  }

  // 6. 滑鼠懸停互動處理：依據 X 軸座標尋找最靠近的軌跡點
  const handleMouseMove = (e) => {
    if (!svgRef.current || mappedPoints.length === 0) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    
    // 計算滑鼠對應在 SVG viewBox 中的 X 座標
    const svgX = (clientX / rect.width) * width;
    
    // 限制在繪圖區內
    if (svgX < padding.left || svgX > width - padding.right) return;

    // 尋找距離 svgX 最近的軌跡點
    let closestPt = mappedPoints[0];
    let minDiff = Math.abs(mappedPoints[0].x - svgX);

    for (let i = 1; i < mappedPoints.length; i++) {
      const diff = Math.abs(mappedPoints[i].x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestPt = mappedPoints[i];
      }
    }

    setLocalHoverIdx(closestPt.index);
    onHoverPointChange(closestPt.index);
  };

  const handleMouseLeave = () => {
    setLocalHoverIdx(null);
    onHoverPointChange(null);
  };

  // 整合外部傳入與本地產生的懸停指標
  const activeIdx = hoveredIndex !== null ? hoveredIndex : localHoverIdx;
  const activePoint = activeIdx !== null && mappedPoints[activeIdx] ? mappedPoints[activeIdx] : null;

  // 繪製垂直刻度與網格線 (Y 軸高度線)
  const yGridLines = [];
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const ratio = i / yTicks;
    const ele = Math.round(scale.minElevation + ratio * scale.elevationSpan);
    const y = padding.top + (1 - ratio) * graphHeight;
    yGridLines.push({ y, elevation: ele });
  }

  return (
    <div
      style={{
        width: "100%",
        background: "var(--bg-glass)",
        borderRadius: "12px",
        border: "1px solid var(--border-glass)",
        padding: "12px 14px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px"
        }}
      >
        <span style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--primary-light)" }}>
          ⛰️ 路線高度剖面圖
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          總里程：{scale.maxDistance.toFixed(2)} km &bull; 最高高度：{Math.round(scale.maxElevation - 50)}m
        </span>
      </div>

      <div style={{ position: "relative", width: "100%", height: `${height}px` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ overflow: "visible", cursor: "crosshair" }}
        >
          <defs>
            {/* 漸層填滿高度剖面 */}
            <linearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary-light)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--primary-light)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* X 軸與 Y 軸格線 */}
          {yGridLines.map((line, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={line.y}
                x2={width - padding.right}
                y2={line.y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 8}
                y={line.y + 4}
                fill="var(--text-muted)"
                fontSize="9"
                fontWeight="500"
                fontFamily="Outfit"
                textAnchor="end"
              >
                {line.elevation}m
              </text>
            </g>
          ))}

          {/* 填充區域與外框線 */}
          <path d={svgPaths.fill} fill="url(#elevationGrad)" />
          <path
            d={svgPaths.line}
            fill="none"
            stroke="var(--primary-light)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X 軸里程標示 */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="rgba(0,0,0,0.08)"
          />
          <text
            x={padding.left}
            y={height - padding.bottom + 14}
            fill="var(--text-muted)"
            fontSize="9"
            fontFamily="Outfit"
          >
            0.0 km
          </text>
          <text
            x={width - padding.right}
            y={height - padding.bottom + 14}
            fill="var(--text-muted)"
            fontSize="9"
            fontFamily="Outfit"
            textAnchor="end"
          >
            {scale.maxDistance.toFixed(1)} km
          </text>

          {/* 懸停連動指示線與標記 */}
          {activePoint && (
            <g>
              {/* 垂直指示虛線 */}
              <line
                x1={activePoint.x}
                y1={padding.top}
                x2={activePoint.x}
                y2={height - padding.bottom}
                stroke="var(--primary)"
                strokeWidth="1.5"
                strokeDasharray="3,3"
                opacity="0.8"
              />

              {/* 剖面圖上的指示圓點 */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
                fill="var(--primary)"
                stroke="white"
                strokeWidth="2"
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="10"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.5"
                opacity="0.5"
              />
            </g>
          )}
        </svg>

        {/* 懸停對齊的 HTML Tooltip */}
        {activePoint && (
          <div
            style={{
              position: "absolute",
              left: `${(activePoint.x / width) * 100}%`,
              top: `${Math.max(10, (activePoint.y / height) * 100 - 32)}%`,
              transform: "translateX(-50%)",
              background: "rgba(20, 30, 45, 0.95)",
              color: "white",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "0.72rem",
              fontWeight: "600",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.12)",
              pointerEvents: "none",
              zIndex: 5,
              display: "flex",
              flexDirection: "column",
              gap: "1px"
            }}
          >
            <div>里程：{activePoint.distance.toFixed(2)} km</div>
            <div>高度：{Math.round(activePoint.elevation)} m</div>
          </div>
        )}
      </div>
    </div>
  );
}
