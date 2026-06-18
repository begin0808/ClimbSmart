import { useState, useEffect, useRef, useCallback } from "react";
import { Route, Upload, LocateFixed, Play, Pause, BellOff, Bell, Gauge, AlertTriangle, Crosshair, Trash2, CheckCircle2 } from "lucide-react";
import { parseGPX } from "../utils/db";

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

export default function RouteGuard() {
  const [route, setRoute] = useState(loadRoute); // { name, points, importedAt }
  const [settings, setSettings] = useState(loadSettings);
  const [importError, setImportError] = useState(null);

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

  // ====== SVG 路線預覽座標計算 ======
  const buildPreview = () => {
    if (!route || route.points.length < 2) return null;
    const pts = route.points;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    pts.forEach(([la, ln]) => {
      minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
      minLng = Math.min(minLng, ln); maxLng = Math.max(maxLng, ln);
    });
    if (currentPos) {
      minLat = Math.min(minLat, currentPos.lat); maxLat = Math.max(maxLat, currentPos.lat);
      minLng = Math.min(minLng, currentPos.lng); maxLng = Math.max(maxLng, currentPos.lng);
    }
    const W = 320, H = 200, pad = 16;
    const spanLat = maxLat - minLat || 1e-6;
    const spanLng = maxLng - minLng || 1e-6;
    const proj = (la, ln) => {
      const x = pad + ((ln - minLng) / spanLng) * (W - 2 * pad);
      const y = pad + (1 - (la - minLat) / spanLat) * (H - 2 * pad); // 緯度高在上
      return [x, y];
    };
    const poly = pts.map(([la, ln]) => proj(la, ln).join(",")).join(" ");
    const start = proj(pts[0][0], pts[0][1]);
    const end = proj(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    const me = currentPos ? proj(currentPos.lat, currentPos.lng) : null;
    return { W, H, poly, start, end, me };
  };
  const preview = buildPreview();

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

            {/* SVG 路線預覽 */}
            {preview && (
              <div style={{ background: "var(--inset-bg)", borderRadius: "12px", padding: "8px", display: "flex", justifyContent: "center" }}>
                <svg width={preview.W} height={preview.H} style={{ maxWidth: "100%" }}>
                  <polyline points={preview.poly} fill="none" stroke={offRoute ? "var(--diff-c-plus)" : "var(--primary)"} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
                  <circle cx={preview.start[0]} cy={preview.start[1]} r="5" fill="var(--success)" stroke="#fff" strokeWidth="1.5" />
                  <circle cx={preview.end[0]} cy={preview.end[1]} r="5" fill="var(--secondary)" stroke="#fff" strokeWidth="1.5" />
                  {preview.me && (
                    <>
                      <circle cx={preview.me[0]} cy={preview.me[1]} r="9" fill={offRoute ? "var(--diff-c-plus)" : "var(--accent-sky)"} opacity="0.25" />
                      <circle cx={preview.me[0]} cy={preview.me[1]} r="5" fill={offRoute ? "var(--diff-c-plus)" : "var(--accent-sky)"} stroke="#fff" strokeWidth="2" />
                    </>
                  )}
                </svg>
              </div>
            )}
            <div style={{ display: "flex", gap: "12px", fontSize: "0.7rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
              <span>🟢 起點</span><span>🟤 終點</span><span>🔵 你的位置</span>
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
