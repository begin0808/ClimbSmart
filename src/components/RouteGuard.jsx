import { useState, useEffect, useRef, useCallback } from "react";
import { Route, Upload, LocateFixed, Play, Pause, BellOff, Bell, Gauge, AlertTriangle, Crosshair, Trash2, CheckCircle2 } from "lucide-react";
import L from "leaflet";
import { parseGPX, getMapTile, saveMapTile } from "../utils/db";
import RouteElevationProfile from "./RouteElevationProfile";

// ====== localStorage 鍵 ======
const ROUTE_KEY = "tw100peaks_planned_route";
const SETTINGS_KEY = "tw100peaks_routeguard_settings";

// ====== 幾何工具（離線、純前端計算） ======
const R_EARTH = 6371000; // 公尺

// 兩經緯度間距離（Haversine，公尺）
function haversine(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

// 將經緯度投影到以 (lat0,lng0) 為原點的局部平面座標（公尺），短距離內誤差可忽略
function toXY(lat, lng, lat0, lng0) {
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return { x: (lng - lng0) * mPerDegLng, y: (lat - lat0) * mPerDegLat };
}

// 點到線段最短距離（公尺）
function distPointToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

// 當前位置到整條路線的最短距離（公尺）
function distanceToRoute(lat, lng, route) {
  if (!route || route.length === 0) return Infinity;
  const [lat0, lng0] = route[0];
  const p = toXY(lat, lng, lat0, lng0);
  if (route.length === 1) {
    const a = toXY(route[0][0], route[0][1], lat0, lng0);
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let min = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = toXY(route[i][0], route[i][1], lat0, lng0);
    const b = toXY(route[i + 1][0], route[i + 1][1], lat0, lng0);
    const d = distPointToSegment(p, a, b);
    if (d < min) min = d;
  }
  return min;
}

// 路線總長（公里）
function routeLengthKm(route) {
  if (!route || route.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += haversine(route[i][0], route[i][1], route[i + 1][0], route[i + 1][1]);
  }
  return total / 1000;
}

// 預設設定
const DEFAULT_SETTINGS = { threshold: 50, consecutive: 3 };

const loadRoute = () => {
  try {
    return JSON.parse(localStorage.getItem(ROUTE_KEY)) || null;
  } catch {
    return null;
  }
};
const loadSettings = () => {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

const createOfflineTileLayer = (urlTemplate, options) => {
  const OfflineTileLayer = L.TileLayer.extend({
    createTile: function (coords, done) {
      const tile = document.createElement("img");

      L.DomEvent.on(tile, "load", L.Util.bind(this._tileOnLoad, this, done, tile));
      L.DomEvent.on(tile, "error", L.Util.bind(this._tileOnError, this, done, tile));

      if (this.options.crossOrigin || this.options.crossOrigin === "") {
        tile.crossOrigin = this.options.crossOrigin === true ? "" : this.options.crossOrigin;
      }
      tile.alt = "";

      const url = this.getTileUrl(coords);

      getMapTile(url)
        .then((blob) => {
          if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            tile.src = objectUrl;
            L.DomEvent.on(tile, "unload", () => {
              URL.revokeObjectURL(objectUrl);
            });
          } else {
            fetch(url)
              .then((res) => {
                if (!res.ok) throw new Error("Tile fetch failed");
                return res.blob();
              })
              .then((blob) => {
                saveMapTile(url, blob);
                const objectUrl = URL.createObjectURL(blob);
                tile.src = objectUrl;
                L.DomEvent.on(tile, "unload", () => {
                  URL.revokeObjectURL(objectUrl);
                });
              })
              .catch(() => {
                tile.src = url;
              });
          }
        })
        .catch(() => {
          tile.src = url;
        });

      return tile;
    }
  });

  return new OfflineTileLayer(urlTemplate, options);
};

export default function RouteGuard() {
  const [route, setRoute] = useState(loadRoute); // { name, points, importedAt }
  const [settings, setSettings] = useState(loadSettings);
  const [importError, setImportError] = useState(null);

  // 地圖與高度剖面圖狀態及 refs
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routePolylineRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const hoverMarkerRef = useRef(null);

  // 追蹤狀態
  const [isTracking, setIsTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState(null); // { lat, lng }
  const [accuracy, setAccuracy] = useState(null);
  const [distToRoute, setDistToRoute] = useState(null);
  const [offRoute, setOffRoute] = useState(false);
  const [maxDeviation, setMaxDeviation] = useState(0);
  const [muted, setMuted] = useState(false);
  const [trackError, setTrackError] = useState(null);

  const watchIdRef = useRef(null);
  const offCountRef = useRef(0);
  const audioCtxRef = useRef(null);
  const alarmIntervalRef = useRef(null);
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // ====== 初始化與更新 Leaflet 地圖 ======
  useEffect(() => {
    if (!mapRef.current) return;

    // 1. 初始化地圖實體
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([23.6, 121.0], 8);

      // 使用與主地圖同款的 OpenTopoMap 底圖（支援離線快取）
      const topoUrl = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
      const offlineLayer = createOfflineTileLayer(topoUrl, {
        maxZoom: 17
      });
      offlineLayer.addTo(map);

      // 加入 Zoom 控制項於右上角，不遮蔽主 UI
      L.control.zoom({ position: "topright" }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // 清除舊圖層
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }

    // 2. 若有計畫路線，繪製軌跡
    if (route && route.points && route.points.length >= 2) {
      const latLngs = route.points.map(([lat, lon]) => [lat, lon]);

      // 繪製軌跡線
      const polyline = L.polyline(latLngs, {
        color: "var(--primary-light)",
        weight: 4,
        opacity: 0.85,
        lineJoin: "round"
      }).addTo(map);
      routePolylineRef.current = polyline;

      // 雙向連動：滑鼠滑過地圖上的軌跡線時，尋找最近點以同步高度圖
      polyline.on("mousemove", (e) => {
        const mouseLatLng = e.latlng;
        let minDist = Infinity;
        let closestIdx = 0;

        route.points.forEach((pt, idx) => {
          const d = Math.hypot(pt[0] - mouseLatLng.lat, pt[1] - mouseLatLng.lng);
          if (d < minDist) {
            minDist = d;
            closestIdx = idx;
          }
        });
        setHoveredIndex(closestIdx);
      });

      polyline.on("mouseout", () => {
        setHoveredIndex(null);
      });

      // 繪製起點與終點標記
      const startPt = route.points[0];
      const endPt = route.points[route.points.length - 1];

      const greenDotIcon = L.divIcon({
        className: "",
        html: `<div style="width: 12px; height: 12px; border-radius: 50%; background-color: var(--success); border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const redDotIcon = L.divIcon({
        className: "",
        html: `<div style="width: 12px; height: 12px; border-radius: 50%; background-color: var(--diff-c-plus); border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      startMarkerRef.current = L.marker([startPt[0], startPt[1]], { icon: greenDotIcon })
        .addTo(map)
        .bindPopup("🟢 起點");

      endMarkerRef.current = L.marker([endPt[0], endPt[1]], { icon: redDotIcon })
        .addTo(map)
        .bindPopup("🟤 終點");

      // 自動調整地圖範圍以容納整條路線
      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    }

    // 元件卸載清理
    return () => {
      // 這裡不直接銷毀 map 實體，保留給後續更新
    };
  }, [route]);

  // 當元件真正卸載時，銷毀地圖實體
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ====== 更新使用者 GPS 位置標記 ======
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (currentPos) {
      const userIcon = L.divIcon({
        className: "",
        html: `
          <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: var(--accent-sky); opacity: 0.35;" class="leaflet-marker-pulse"></div>
            <div style="width: 10px; height: 10px; border-radius: 50%; background-color: var(--accent-sky); border: 1.5px solid white; box-shadow: 0 0 6px var(--accent-sky);"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      userMarkerRef.current = L.marker([currentPos.lat, currentPos.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup("🔵 您的目前位置");
    }
  }, [currentPos]);

  // ====== 處理剖面圖 Hover 的 Pulsing Marker 連動 ======
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.remove();
      hoverMarkerRef.current = null;
    }

    if (hoveredIndex !== null && route && route.points && route.points[hoveredIndex]) {
      const pt = route.points[hoveredIndex];
      
      const pulseIcon = L.divIcon({
        className: "",
        html: `
          <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 3px solid #ff5400; animation: leaflet-pulse 1.5s infinite ease-in-out;"></div>
            <div style="width: 10px; height: 10px; border-radius: 50%; background-color: #ff5400; border: 2px solid white; box-shadow: 0 0 6px #ff5400;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      hoverMarkerRef.current = L.marker([pt[0], pt[1]], { icon: pulseIcon }).addTo(map);
    }
  }, [hoveredIndex, route]);

  // ====== 聲音警報 ======
  const beep = useCallback(() => {
    if (mutedRef.current) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch {
      /* 忽略音訊錯誤 */
    }
  }, []);

  // 啟動／停止重複警報（偏離期間每 3 秒提醒）
  const startAlarm = useCallback(() => {
    if (alarmIntervalRef.current) return;
    const fire = () => {
      beep();
      if (navigator.vibrate && !mutedRef.current) navigator.vibrate([300, 150, 300]);
    };
    fire();
    alarmIntervalRef.current = setInterval(fire, 3000);
  }, [beep]);

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
  }, []);

  // ====== GPS 位置更新處理 ======
  const handlePosition = useCallback(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCurrentPos({ lat, lng });
      setAccuracy(pos.coords.accuracy);
      setTrackError(null);

      if (!route || !route.points || route.points.length === 0) return;
      const d = distanceToRoute(lat, lng, route.points);
      setDistToRoute(d);
      setMaxDeviation((prev) => Math.max(prev, d));

      if (d > settings.threshold) {
        offCountRef.current += 1;
        // 連續超標達門檻才觸發，避免 GPS 飄移造成的假警報
        if (offCountRef.current >= settings.consecutive) {
          setOffRoute((wasOff) => {
            if (!wasOff) startAlarm();
            return true;
          });
        }
      } else {
        offCountRef.current = 0;
        setOffRoute((wasOff) => {
          if (wasOff) stopAlarm();
          return false;
        });
      }
    },
    [route, settings.threshold, settings.consecutive, startAlarm, stopAlarm]
  );

  const handlePosError = useCallback((err) => {
    let msg = "無法取得定位。";
    if (err.code === err.PERMISSION_DENIED) msg = "權限遭拒：請允許位置權限。";
    else if (err.code === err.POSITION_UNAVAILABLE) msg = "GPS 訊號太弱，請到開闊處。";
    else if (err.code === err.TIMEOUT) msg = "定位超時。";
    setTrackError(msg);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setTrackError("此瀏覽器不支援 GPS 定位。");
      return;
    }
    if (!route) {
      setTrackError("請先匯入計畫路線。");
      return;
    }
    // 喚醒音訊（需在使用者手勢中），確保之後能發聲
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    } catch {
      /* 略 */
    }
    offCountRef.current = 0;
    setMaxDeviation(0);
    setOffRoute(false);
    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handlePosError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 2000,
    });
    setIsTracking(true);
  }, [route, handlePosition, handlePosError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    stopAlarm();
    setIsTracking(false);
    setOffRoute(false);
  }, [stopAlarm]);

  // 卸載清理
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, []);

  // ====== 匯入 GPX 計畫路線 ======
  const handleImportGPX = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const points = parseGPX(ev.target.result);
        if (!points || points.length < 2) {
          setImportError("此 GPX 內的軌跡點不足（需至少 2 點）。");
          return;
        }
        const newRoute = { name: file.name.replace(/\.gpx$/i, ""), points, importedAt: Date.now() };
        setRoute(newRoute);
        localStorage.setItem(ROUTE_KEY, JSON.stringify(newRoute));
      } catch {
        setImportError("GPX 解析失敗，請確認為標準 XML / GPX 格式。");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // 允許重複匯入同檔
  };

  const clearRoute = () => {
    if (isTracking) stopTracking();
    setRoute(null);
    setDistToRoute(null);
    localStorage.removeItem(ROUTE_KEY);
  };

  const updateSettings = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  return (
    <div style={{ flex: 1, padding: "24px", maxWidth: "960px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 標題 */}
      <div className="mist-card" style={{ padding: "16px 20px", display: "flex", gap: "14px", alignItems: "center", borderLeft: "5px solid var(--primary)" }}>
        <Route size={28} style={{ color: "var(--primary)", flexShrink: 0 }} />
        <div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: "800", color: "var(--primary)" }}>路線守護 · 偏移警示</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
            匯入計畫路線後即時追蹤 GPS，偏離超過設定距離自動震動 + 警示音。完全離線運作。
          </p>
        </div>
      </div>

      {/* 全螢幕偏離警示橫幅 */}
      {offRoute && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "var(--diff-c-plus)", color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", animation: "rgBlink 1s infinite" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={22} />
            <div>
              <div style={{ fontWeight: "800", fontSize: "1rem" }}>⚠️ 已偏離計畫路線</div>
              <div style={{ fontSize: "0.8rem", opacity: 0.95 }}>偏離約 {distToRoute != null ? Math.round(distToRoute) : "—"} 公尺，請循原路返回路線。</div>
            </div>
          </div>
          <button onClick={() => setMuted((m) => !m)} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.6)", color: "#fff", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            {muted ? <Bell size={14} /> : <BellOff size={14} />} {muted ? "解除靜音" : "靜音"}
          </button>
        </div>
      )}

      {/* ====== 計畫路線匯入 ====== */}
      <div className="mist-card" style={{ padding: "20px" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
          <Upload size={16} /> 計畫路線
        </h3>

        {route ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <div style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "0.95rem" }}>📍 {route.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  {route.points.length} 個航點 · 約 {routeLengthKm(route.points).toFixed(1)} km · 匯入於 {new Date(route.importedAt).toLocaleDateString()}
                </div>
              </div>
              <button onClick={clearRoute} className="btn-secondary" style={{ padding: "6px 10px", fontSize: "0.75rem", borderColor: "var(--text-muted)", color: "var(--text-muted)" }}>
                <Trash2 size={13} /> 移除路線
              </button>
            </div>

            {/* 實體 Leaflet 地圖預覽 */}
            <div
              id="routeguard-map"
              ref={mapRef}
              style={{
                width: "100%",
                height: "320px",
                borderRadius: "12px",
                border: "1.5px solid var(--border-glass)",
                position: "relative",
                zIndex: 1
              }}
            />

            {/* 高度剖面圖 */}
            <RouteElevationProfile
              points={route.points}
              hoveredIndex={hoveredIndex}
              onHoverPointChange={(idx) => setHoveredIndex(idx)}
            />
            
            <div style={{ display: "flex", gap: "12px", fontSize: "0.7rem", color: "var(--text-muted)", flexWrap: "wrap", marginTop: "-4px" }}>
              <span>🟢 起點</span><span>🔴 終點</span><span>🔵 你的位置</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "24px", border: "2px dashed var(--inset-border)", borderRadius: "10px" }}>
            <Route size={32} style={{ color: "var(--primary-light)", opacity: 0.6, marginBottom: "8px" }} />
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "12px" }}>尚未匯入計畫路線。請上傳出發前規劃好的 .gpx 軌跡檔。</p>
          </div>
        )}

        <button onClick={() => document.getElementById("rg-gpx-input").click()} className="btn-primary" style={{ marginTop: "12px", padding: "10px", width: "100%", justifyContent: "center", fontWeight: "600" }}>
          <Upload size={15} /> {route ? "更換 GPX 路線檔" : "匯入 GPX 計畫路線"}
        </button>
        <input id="rg-gpx-input" type="file" accept=".gpx" onChange={handleImportGPX} style={{ display: "none" }} />
        {importError && (
          <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "var(--diff-c-plus)", background: "rgba(214,40,40,0.06)", padding: "8px", borderRadius: "6px", fontWeight: "600" }}>{importError}</div>
        )}
      </div>

      {/* ====== 即時追蹤 ====== */}
      <div className="mist-card" style={{ padding: "20px" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
          <LocateFixed size={16} /> 即時路線追蹤
        </h3>

        {/* 狀態大卡 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "14px" }}>
          <div style={{ padding: "12px", background: offRoute ? "rgba(214,40,40,0.08)" : "var(--inset-bg)", borderRadius: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>路線偏移</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "800", fontFamily: "Outfit", color: offRoute ? "var(--diff-c-plus)" : "var(--primary)" }}>
              {distToRoute != null ? `${Math.round(distToRoute)}m` : "—"}
            </div>
          </div>
          <div style={{ padding: "12px", background: "var(--inset-bg)", borderRadius: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>GPS 精度</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "800", fontFamily: "Outfit", color: "var(--text-main)" }}>
              {accuracy != null ? `±${Math.round(accuracy)}m` : "—"}
            </div>
          </div>
          <div style={{ padding: "12px", background: "var(--inset-bg)", borderRadius: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>最大偏移</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "800", fontFamily: "Outfit", color: "var(--secondary)" }}>
              {maxDeviation > 0 ? `${Math.round(maxDeviation)}m` : "—"}
            </div>
          </div>
        </div>

        {/* 狀態列 */}
        {isTracking && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", marginBottom: "12px", background: offRoute ? "rgba(214,40,40,0.08)" : "rgba(45,90,39,0.06)", color: offRoute ? "var(--diff-c-plus)" : "var(--success)", fontWeight: "700", fontSize: "0.85rem" }}>
            {offRoute ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {offRoute ? `偏離路線 ${distToRoute != null ? Math.round(distToRoute) : ""}m，請返回！` : "在路線上 · 追蹤中"}
          </div>
        )}

        {trackError && (
          <div style={{ fontSize: "0.8rem", color: "var(--diff-c-plus)", background: "rgba(214,40,40,0.06)", padding: "8px", borderRadius: "6px", fontWeight: "600", marginBottom: "12px" }}>{trackError}</div>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          {isTracking ? (
            <button onClick={stopTracking} className="btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "12px", borderColor: "var(--diff-c-plus)", color: "var(--diff-c-plus)", fontWeight: "700" }}>
              <Pause size={15} /> 停止追蹤
            </button>
          ) : (
            <button onClick={startTracking} className="btn-primary" style={{ flex: 1, justifyContent: "center", padding: "12px", fontWeight: "700" }} disabled={!route}>
              <Play size={15} /> 開始路線追蹤
            </button>
          )}
          <button onClick={() => setMuted((m) => !m)} className="btn-secondary" style={{ padding: "12px 14px", borderColor: muted ? "var(--diff-c-plus)" : "var(--primary)", color: muted ? "var(--diff-c-plus)" : "var(--primary)" }} title={muted ? "目前靜音中" : "點擊靜音"}>
            {muted ? <BellOff size={16} /> : <Bell size={16} />}
          </button>
        </div>
        {isTracking && (
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "10px", lineHeight: 1.5 }}>
            ⚠️ 持續追蹤會較耗電。建議搭配行動電源，或在不需警示時停止追蹤。請保持本頁開啟（背景分頁可能被系統暫停定位）。
          </p>
        )}
      </div>

      {/* ====== 警示設定 ====== */}
      <div className="mist-card" style={{ padding: "20px" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
          <Gauge size={16} /> 警示靈敏度設定
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* 偏移門檻 */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
              <span style={{ color: "var(--text-main)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}><Crosshair size={14} /> 偏移警示距離</span>
              <span style={{ fontWeight: "800", color: "var(--primary)", fontFamily: "Outfit" }}>{settings.threshold} m</span>
            </div>
            <input type="range" min="20" max="200" step="10" value={settings.threshold} onChange={(e) => updateSettings({ threshold: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--primary)" }} />
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
              偏離路線超過此距離才會警示。密林/峽谷 GPS 易飄，建議 50–80m；開闊稜線可調小。
            </div>
          </div>

          {/* 連續次數緩衝 */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
              <span style={{ color: "var(--text-main)", fontWeight: "600" }}>防假警報緩衝</span>
              <span style={{ fontWeight: "800", color: "var(--primary)", fontFamily: "Outfit" }}>連續 {settings.consecutive} 次</span>
            </div>
            <input type="range" min="1" max="6" step="1" value={settings.consecutive} onChange={(e) => updateSettings({ consecutive: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--primary)" }} />
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
              需連續這麼多次定位都超標才警示，可過濾 GPS 瞬間飄移造成的假警報（數字越大越不易誤報，但反應越慢）。
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rgBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.78; } }
      `}</style>
    </div>
  );
}
