import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, Copy, Volume2, Phone, MessageSquare, ShieldAlert, Zap, Compass, RefreshCw, Users, Clock, Navigation, BatteryLow, CheckSquare, Plus, Trash2, Save, MapPin } from "lucide-react";

// ====== localStorage 工具 ======
const CONTACTS_KEY = "tw100peaks_emergency_contacts";
const CHECKLIST_KEY = "tw100peaks_safety_checklist";
const BREADCRUMB_KEY = "tw100peaks_breadcrumbs";
const SOS_TIMER_KEY = "tw100peaks_sos_timer";

const loadContacts = () => {
  try {
    return JSON.parse(localStorage.getItem(CONTACTS_KEY)) || [];
  } catch { return []; }
};
const saveContacts = (contacts) => {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
};

const DEFAULT_CHECKLIST = [
  { id: "c1", label: "頭燈電池是否充飽？", checked: false },
  { id: "c2", label: "行動電源是否充滿？", checked: false },
  { id: "c3", label: "緊急聯絡人是否已設定？", checked: false },
  { id: "c4", label: "已下載離線地圖圖磚？", checked: false },
  { id: "c5", label: "是否已告知親友預計下山時間？", checked: false },
  { id: "c6", label: "急救包與求生毯已帶齊？", checked: false },
  { id: "c7", label: "飲用水是否充足？", checked: false },
  { id: "c8", label: "天氣預報已確認無惡劣天候？", checked: false },
];

const loadChecklist = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CHECKLIST_KEY));
    if (saved && saved.length > 0) return saved;
  } catch {}
  return DEFAULT_CHECKLIST.map(c => ({ ...c }));
};
const saveChecklist = (list) => {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(list));
};

// WGS84 十進位緯經度轉度分秒格式 (DMS)
const toDMS = (val, isLat) => {
  const dir = isLat ? (val >= 0 ? "N" : "S") : (val >= 0 ? "E" : "W");
  const absolute = Math.abs(val);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
  return `${dir} ${degrees}°${minutes}'${seconds}"`;
};

// WGS84 經緯度投影轉換為台灣 TWD97 二度分帶坐標 (TM2) 數學投影公式
const wgs84ToTwd97 = (lat, lon) => {
  const a = 6378137.0;
  const b = 6356752.314245;
  const lon0 = 121.0 * Math.PI / 180.0;
  const k0 = 0.9999;
  const dx = 250000.0;
  
  const e = Math.sqrt(1 - Math.pow(b / a, 2));
  const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
  
  const phi = lat * Math.PI / 180.0;
  const lambda = lon * Math.PI / 180.0;
  
  const nu = a / Math.sqrt(1 - Math.pow(e * Math.sin(phi), 2));
  const p = lambda - lon0;
  
  const s = a * ((1 - Math.pow(e, 2)/4 - 3*Math.pow(e, 4)/64 - 5*Math.pow(e, 6)/256)*phi 
            - (3*Math.pow(e, 2)/8 + 3*Math.pow(e, 4)/32 + 45*Math.pow(e, 6)/1024)*Math.sin(2*phi)
            + (15*Math.pow(e, 4)/256 + 45*Math.pow(e, 6)/1024)*Math.sin(4*phi)
            - (35*Math.pow(e, 6)/3072)*Math.sin(6*phi));
             
  const T = Math.pow(Math.tan(phi), 2);
  const C = e2 * Math.pow(Math.cos(phi), 2);
  const A = p * Math.cos(phi);
  
  const x = k0 * nu * (A + (1 - T + C) * Math.pow(A, 3) / 6.0 + (5 - 18 * T + Math.pow(T, 2) + 72 * C - 58 * e2) * Math.pow(A, 5) / 120.0) + dx;
  const y = k0 * (s + nu * Math.tan(phi) * (Math.pow(A, 2) / 2.0 + (5 - T + 9 * C + 4 * Math.pow(C, 2)) * Math.pow(A, 4) / 24.0 + (61 - 58 * T + Math.pow(T, 2) + 600 * C - 330 * e2) * Math.pow(A, 6) / 720.0));
  
  return { x: Math.round(x), y: Math.round(y) };
};

export default function EmergencySOS() {
  // ====== 分頁控制 ======
  const [activePanel, setActivePanel] = useState("sos"); // sos | contacts | breadcrumb | checklist

  // ====== GPS 定位 ======
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [altitude, setAltitude] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingError, setLocatingError] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState("未知");

  // ====== 警報聲 ======
  const [soundPlaying, setSoundPlaying] = useState(false);
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const soundIntervalRef = useRef(null);

  // ====== 閃光信號 ======
  const [flashActive, setFlashActive] = useState(false);
  const [flashColor, setFlashColor] = useState("transparent");
  const flashTimeoutRef = useRef(null);

  // ====== 電子指南針 ======
  const [heading, setHeading] = useState(null);
  const [cardinalDirection, setCardinalDirection] = useState("");
  const [isCompassActive, setIsCompassActive] = useState(false);
  const [compassError, setCompassError] = useState(null);

  // ====== 黃金救援計時器 ======
  const [sosStartTime, setSosStartTime] = useState(() => {
    const saved = localStorage.getItem(SOS_TIMER_KEY);
    return saved ? parseInt(saved, 10) : null;
  });
  const [sosElapsed, setSosElapsed] = useState(0);

  // ====== 緊急聯絡人 ======
  const [contacts, setContacts] = useState(loadContacts);
  const [newContact, setNewContact] = useState({ name: "", phone: "", lineId: "", satPhone: "" });

  // ====== 足跡回溯 ======
  const [breadcrumbs, setBreadcrumbs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BREADCRUMB_KEY)) || []; } catch { return []; }
  });
  const [isBreadcrumbActive, setIsBreadcrumbActive] = useState(false);
  const breadcrumbIntervalRef = useRef(null);

  // ====== 安全檢查表 ======
  const [checklist, setChecklist] = useState(loadChecklist);

  // ====== 超級省電模式 ======
  const [isPowerSaving, setIsPowerSaving] = useState(false);

  // ====================================================
  // 電子指南針邏輯
  // ====================================================
  const getCardinal = (deg) => {
    const directions = [
      { label: "北", min: 337.5, max: 360 }, { label: "北", min: 0, max: 22.5 },
      { label: "東北", min: 22.5, max: 67.5 }, { label: "東", min: 67.5, max: 112.5 },
      { label: "東南", min: 112.5, max: 157.5 }, { label: "南", min: 157.5, max: 202.5 },
      { label: "西南", min: 202.5, max: 247.5 }, { label: "西", min: 247.5, max: 292.5 },
      { label: "西北", min: 292.5, max: 337.5 }
    ];
    const d = (deg + 360) % 360;
    return (directions.find(dir => d >= dir.min && d < dir.max) || {}).label || "未知";
  };

  const handleOrientation = (event) => {
    let headingVal = null;
    if (event.webkitCompassHeading !== undefined) headingVal = event.webkitCompassHeading;
    else if (event.alpha !== null) headingVal = (360 - event.alpha) % 360;
    if (headingVal !== null) {
      setHeading(Math.round(headingVal));
      setCardinalDirection(getCardinal(headingVal));
    }
  };

  const toggleCompass = async () => {
    if (isCompassActive) {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
      setIsCompassActive(false); setHeading(null); setCardinalDirection("");
    } else {
      setCompassError(null);
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        try {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm === "granted") registerCompassListener();
          else setCompassError("權限遭拒：iOS 需授權動作與方向感應器。");
        } catch { setCompassError("需要授權動作與方向權限以啟用羅盤。"); }
      } else { registerCompassListener(); }
    }
  };

  const registerCompassListener = () => {
    if ("ondeviceorientationabsolute" in window) window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    else if ("ondeviceorientation" in window) window.addEventListener("deviceorientation", handleOrientation, true);
    else { setCompassError("此裝置不支援羅盤朝向感應。"); return; }
    setIsCompassActive(true);
  };

  // ====================================================
  // 電量偵測
  // ====================================================
  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        setBatteryLevel(`${Math.round(battery.level * 100)}%`);
        battery.addEventListener("levelchange", () => setBatteryLevel(`${Math.round(battery.level * 100)}%`));
      });
    }
  }, []);

  // ====================================================
  // GPS 定位
  // ====================================================
  const getGPSLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocatingError("您的瀏覽器不支援 GPS 定位。"); return; }
    setIsLocating(true); setLocatingError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy);
        setAltitude(pos.coords.altitude);
        setIsLocating(false);
      },
      (err) => {
        let msg = "無法獲取定位資料。";
        if (err.code === err.PERMISSION_DENIED) msg = "權限遭拒：請允許位置權限。";
        else if (err.code === err.POSITION_UNAVAILABLE) msg = "GPS 訊號太弱，請到開闊戶外。";
        else if (err.code === err.TIMEOUT) msg = "定位超時：搜尋衛星時間過長。";
        setLocatingError(msg); setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // ====================================================
  // 語音朗讀 / 複製 / 簡訊
  // ====================================================
  const speakCoordinates = () => {
    if (!coords || !window.speechSynthesis) return;
    const twd97Coord = wgs84ToTwd97(coords.lat, coords.lng);
    const formatDMS = (val) => {
      const abs = Math.abs(val);
      const d = Math.floor(abs);
      const m = Math.floor((abs - d) * 60);
      const s = Math.round((abs - d - m/60) * 3600);
      return `${d}度 ${m}分 ${s}秒`;
    };
    const text = `我的座標為：北緯 ${formatDMS(coords.lat)}。東經 ${formatDMS(coords.lng)}。二度分帶坐標：X：${twd97Coord.x}。Y：${twd97Coord.y}。${altitude ? `海拔約 ${Math.round(altitude)}公尺。` : ""}`;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-TW"; u.rate = 0.85;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  };

  const copyToClipboard = () => {
    if (!coords) return;
    const twd97Coord = wgs84ToTwd97(coords.lat, coords.lng);
    const dmsLat = toDMS(coords.lat, true);
    const dmsLng = toDMS(coords.lng, false);
    const text = `【緊急定位資訊】
WGS84 (十進位): ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}
WGS84 (度分秒): ${dmsLat}, ${dmsLng}
TWD97 (二度分帶): X ${twd97Coord.x}, Y ${twd97Coord.y}
海拔高度: ${altitude ? `${Math.round(altitude)}m` : "未知"}
定位精度: ±${Math.round(accuracy || 0)}m
手機電量: ${batteryLevel}`;
    navigator.clipboard.writeText(text);
    alert("完整定位資訊（含雙座標與高度）已複製到剪貼簿！");
  };

  const getSMSBody = () => {
    if (!coords) return "";
    const twd97Coord = wgs84ToTwd97(coords.lat, coords.lng);
    const dmsLat = toDMS(coords.lat, true);
    const dmsLng = toDMS(coords.lng, false);
    return `【山域緊急求救】我需要救助。GPS座標：WGS84度分秒: ${dmsLat}, ${dmsLng} (十進位: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)})；TWD97二度分帶: X ${twd97Coord.x}, Y ${twd97Coord.y}；海拔約 ${altitude ? `${Math.round(altitude)}m` : "未知"}，誤差約 ${Math.round(accuracy || 0)}m，手機電量：${batteryLevel}。`;
  };

  const handleSendSMS = (phoneNum = "112") => {
    if (!coords) return;
    window.location.href = `sms:${phoneNum}?body=${encodeURIComponent(getSMSBody())}`;
  };

  // ====================================================
  // 聲光警報
  // ====================================================
  const toggleSoundAlert = () => {
    if (soundPlaying) {
      if (oscillatorRef.current) { oscillatorRef.current.stop(); oscillatorRef.current.disconnect(); oscillatorRef.current = null; }
      if (soundIntervalRef.current) { clearInterval(soundIntervalRef.current); soundIntervalRef.current = null; }
      setSoundPlaying(false);
    } else {
      try {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(2500, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.connect(gain); gain.connect(ctx.destination); osc.start();
        oscillatorRef.current = osc;
        
        let isBeep = false;
        soundIntervalRef.current = setInterval(() => {
          if (isBeep) {
            gain.gain.setValueAtTime(0, ctx.currentTime);
          } else {
            gain.gain.setValueAtTime(0.8, ctx.currentTime);
            osc.frequency.setValueAtTime(2500 + Math.random() * 100 - 50, ctx.currentTime);
          }
          isBeep = !isBeep;
        }, 500);
        
        setSoundPlaying(true);
      } catch { alert("音訊播放失敗！"); }
    }
  };

  const startSOSFlash = () => {
    setFlashActive(true);
    const pattern = [
      { l: true, d: 200 }, { l: false, d: 200 }, { l: true, d: 200 }, { l: false, d: 200 }, { l: true, d: 200 }, { l: false, d: 600 },
      { l: true, d: 600 }, { l: false, d: 200 }, { l: true, d: 600 }, { l: false, d: 200 }, { l: true, d: 600 }, { l: false, d: 600 },
      { l: true, d: 200 }, { l: false, d: 200 }, { l: true, d: 200 }, { l: false, d: 200 }, { l: true, d: 200 }, { l: false, d: 1400 },
    ];
    let idx = 0;
    const run = () => {
      const c = pattern[idx];
      setFlashColor(c.l ? (idx % 2 === 0 ? "#ff0000" : "#ffffff") : "transparent");
      flashTimeoutRef.current = setTimeout(() => { idx = (idx + 1) % pattern.length; run(); }, c.d);
    };
    run();
  };

  const stopSOSFlash = () => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlashActive(false); setFlashColor("transparent");
  };

  // ====================================================
  // 黃金救援倒數計時器 (Task 6)
  // ====================================================
  const startSOSTimer = () => {
    const now = Date.now();
    setSosStartTime(now);
    localStorage.setItem(SOS_TIMER_KEY, String(now));
  };

  const stopSOSTimer = () => {
    setSosStartTime(null);
    setSosElapsed(0);
    localStorage.removeItem(SOS_TIMER_KEY);
  };

  useEffect(() => {
    if (!sosStartTime) return;
    const tick = () => setSosElapsed(Math.floor((Date.now() - sosStartTime) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sosStartTime]);

  const formatElapsed = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}小時 ${String(m).padStart(2, "0")}分 ${String(s).padStart(2, "0")}秒`;
  };

  // ====================================================
  // 緊急聯絡人管理 (Task 7)
  // ====================================================
  const addContact = (e) => {
    e.preventDefault();
    if (!newContact.name.trim() || (!newContact.phone.trim() && !newContact.lineId.trim() && !newContact.satPhone.trim())) return;
    const updated = [...contacts, { ...newContact, id: Date.now() }];
    setContacts(updated); saveContacts(updated);
    setNewContact({ name: "", phone: "", lineId: "", satPhone: "" });
  };

  const removeContact = (id) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated); saveContacts(updated);
  };

  // ====================================================
  // 離線足跡回溯 (Task 8)
  // ====================================================
  const startBreadcrumb = () => {
    setIsBreadcrumbActive(true);
    breadcrumbIntervalRef.current = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setBreadcrumbs(prev => {
            const newPoint = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              alt: pos.coords.altitude,
              time: Date.now()
            };
            const updated = [...prev, newPoint].slice(-500); // 最多 500 點
            localStorage.setItem(BREADCRUMB_KEY, JSON.stringify(updated));
            return updated;
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }, 60000); // 每 60 秒記錄一次

    // 立即記錄第一個點
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setBreadcrumbs(prev => {
          const newPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude, time: Date.now() };
          const updated = [...prev, newPoint];
          localStorage.setItem(BREADCRUMB_KEY, JSON.stringify(updated));
          return updated;
        });
      }, () => {}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }
  };

  const stopBreadcrumb = () => {
    setIsBreadcrumbActive(false);
    if (breadcrumbIntervalRef.current) clearInterval(breadcrumbIntervalRef.current);
  };

  const clearBreadcrumbs = () => {
    if (window.confirm("確定清除所有足跡記錄嗎？")) {
      setBreadcrumbs([]);
      localStorage.removeItem(BREADCRUMB_KEY);
    }
  };

  // ====================================================
  // 安全檢查表 (Task 10)
  // ====================================================
  const toggleCheckItem = (id) => {
    const updated = checklist.map(c => c.id === id ? { ...c, checked: !c.checked } : c);
    setChecklist(updated); saveChecklist(updated);
  };

  const resetChecklist = () => {
    const reset = DEFAULT_CHECKLIST.map(c => ({ ...c }));
    setChecklist(reset); saveChecklist(reset);
  };

  const checklistComplete = checklist.every(c => c.checked);
  const checklistProgress = Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100);

  // ====================================================
  // 清理
  // ====================================================
  useEffect(() => {
    return () => {
      if (oscillatorRef.current) { oscillatorRef.current.stop(); oscillatorRef.current.disconnect(); }
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (breadcrumbIntervalRef.current) clearInterval(breadcrumbIntervalRef.current);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
    };
  }, []);

  // ====================================================
  // 省電模式樣式
  // ====================================================
  const psStyles = isPowerSaving ? {
    background: "#000", color: "#ff3333", minHeight: "100vh", padding: "24px"
  } : {};

  const cardBg = isPowerSaving ? { background: "rgba(30,0,0,0.8)", border: "1px solid #330000", borderRadius: "12px" } : {};

  // ====== 分頁按鈕 ======
  const tabBtnStyle = (isActive) => ({
    padding: "8px 14px", fontSize: "0.8rem", fontWeight: isActive ? "700" : "500",
    borderRadius: "8px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
    background: isActive ? (isPowerSaving ? "#330000" : "var(--primary-glow)") : "transparent",
    color: isActive ? (isPowerSaving ? "#ff3333" : "var(--primary)") : (isPowerSaving ? "#aa3333" : "var(--text-muted)"),
    transition: "all 0.15s ease"
  });

  // ====================================================
  // 超級省電模式渲染
  // ====================================================
  if (isPowerSaving) {
    return (
      <div style={{ ...psStyles, display: "flex", flexDirection: "column", gap: "16px", maxWidth: "500px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", paddingTop: "16px" }}>
          <BatteryLow size={32} style={{ color: "#ff3333" }} />
          <h2 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#ff3333", margin: "8px 0 4px" }}>🔋 超級省電模式</h2>
          <p style={{ fontSize: "0.75rem", color: "#aa3333" }}>僅保留核心求救功能，最大化電池續航。</p>
        </div>

        {/* GPS 座標（省電版） */}
        <div style={{ ...cardBg, padding: "16px" }}>
          <h4 style={{ color: "#ff3333", fontSize: "0.9rem", fontWeight: "700", marginBottom: "10px" }}>📍 GPS 座標</h4>
          {coords ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontFamily: "Outfit", fontSize: "1.1rem", fontWeight: "800", color: "#ff6666" }}>
                N {coords.lat.toFixed(6)}° &nbsp; E {coords.lng.toFixed(6)}°
              </div>
              <div style={{ fontSize: "0.76rem", color: "#ffa3a3", display: "flex", flexDirection: "column", gap: "2px", margin: "4px 0" }}>
                <div>度分秒: {toDMS(coords.lat, true)} / {toDMS(coords.lng, false)}</div>
                <div>TWD97: X {wgs84ToTwd97(coords.lat, coords.lng).x}, Y {wgs84ToTwd97(coords.lat, coords.lng).y}</div>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#aa3333" }}>
                {altitude ? `海拔 ${Math.round(altitude)}m` : ""} &nbsp;|&nbsp; 精度 ±{Math.round(accuracy || 0)}m &nbsp;|&nbsp; 電量 {batteryLevel}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                <button onClick={copyToClipboard} style={{ ...cardBg, padding: "8px", color: "#ff6666", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600" }}>📋 複製</button>
                <button onClick={speakCoordinates} style={{ ...cardBg, padding: "8px", color: "#ff6666", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600" }}>🔊 朗讀</button>
              </div>
            </div>
          ) : (
            <button onClick={getGPSLocation} disabled={isLocating} style={{ width: "100%", ...cardBg, padding: "12px", color: "#ff3333", cursor: "pointer", fontSize: "0.9rem", fontWeight: "700" }}>
              {isLocating ? "搜尋中..." : "開啟 GPS 定位"}
            </button>
          )}
        </div>

        {/* SOS 計時器（省電版） */}
        {sosStartTime && (
          <div style={{ ...cardBg, padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "#aa3333" }}>已發出求救</div>
            <div style={{ fontSize: "1.6rem", fontWeight: "800", fontFamily: "Outfit", color: "#ff6666", margin: "4px 0" }}>{formatElapsed(sosElapsed)}</div>
            {sosElapsed > 0 && sosElapsed % 1800 < 2 && (
              <div style={{ fontSize: "0.8rem", color: "#ffaa00", fontWeight: "600", marginTop: "4px" }}>⚠️ 建議更新 GPS 座標</div>
            )}
          </div>
        )}

        {/* 快速行動按鈕 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <button onClick={() => handleSendSMS("112")} style={{ ...cardBg, padding: "14px 8px", color: "#ff3333", cursor: "pointer", fontSize: "0.85rem", fontWeight: "700" }} disabled={!coords}>
            📱 SOS 簡訊
          </button>
          <a href="tel:112" style={{ ...cardBg, padding: "14px 8px", color: "#ff3333", textDecoration: "none", textAlign: "center", fontSize: "0.85rem", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
            📞 撥打 112
          </a>
        </div>

        {/* 退出省電模式 */}
        <button onClick={() => setIsPowerSaving(false)} style={{ ...cardBg, padding: "10px", color: "#aa3333", cursor: "pointer", fontSize: "0.8rem", textAlign: "center", marginTop: "8px" }}>
          退出省電模式
        </button>
      </div>
    );
  }

  // ====================================================
  // 正常模式渲染
  // ====================================================
  return (
    <div style={{ flex: 1, padding: "24px", maxWidth: "960px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* 閃光全螢幕遮罩 */}
      {flashActive && (
        <div onClick={stopSOSFlash} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: flashColor, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <div style={{ background: "rgba(0,0,0,0.85)", color: "white", padding: "16px 24px", borderRadius: "12px", fontSize: "1.2rem", fontWeight: "700", textAlign: "center" }}>
            🚨 螢幕正在以 SOS 摩斯密碼閃爍 🚨
            <p style={{ fontSize: "0.9rem", color: "#ccc", marginTop: "8px", fontWeight: "400" }}>點擊任何地方關閉</p>
          </div>
        </div>
      )}

      {/* 頂部警示 + 省電模式按鈕 */}
      <div className="mist-card" style={{ padding: "16px 20px", display: "flex", gap: "14px", background: isPowerSaving ? "rgba(30,0,0,0.5)" : "rgba(214, 40, 40, 0.04)", borderLeft: "5px solid var(--diff-c-plus)", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", flex: 1 }}>
          <AlertTriangle size={28} style={{ color: "var(--diff-c-plus)", flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--primary)" }}>山域緊急求救助手</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "2px" }}>
              完全離線運作，利用手機 GPS 晶片精確定位。
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsPowerSaving(true)}
          style={{
            padding: "6px 12px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer",
            background: "rgba(214,40,40,0.08)", border: "1px solid var(--diff-c-plus)", color: "var(--diff-c-plus)",
            display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap"
          }}
        >
          <BatteryLow size={14} /> 省電模式
        </button>
      </div>

      {/* 分頁按鈕列 */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <button onClick={() => setActivePanel("sos")} style={tabBtnStyle(activePanel === "sos")}><ShieldAlert size={14} /> 定位求救</button>
        <button onClick={() => setActivePanel("contacts")} style={tabBtnStyle(activePanel === "contacts")}><Users size={14} /> 緊急聯絡人</button>
        <button onClick={() => setActivePanel("breadcrumb")} style={tabBtnStyle(activePanel === "breadcrumb")}><Navigation size={14} /> 足跡回溯</button>
        <button onClick={() => setActivePanel("checklist")} style={tabBtnStyle(activePanel === "checklist")}><CheckSquare size={14} /> 安全檢查</button>
      </div>

      {/* ====== 定位求救面板 ====== */}
      {activePanel === "sos" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>

          {/* 左側：GPS + 簡訊 + 計時器 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* 黃金救援倒數計時器 */}
            <div className="mist-card" style={{ padding: "16px 20px" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <Clock size={16} /> 黃金救援計時器
              </h4>
              {sosStartTime ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ textAlign: "center", padding: "12px", background: "rgba(214,40,40,0.05)", borderRadius: "10px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>已發出求救，持續等待中</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: "800", fontFamily: "Outfit", color: "var(--diff-c-plus)", margin: "4px 0" }}>
                      {formatElapsed(sosElapsed)}
                    </div>
                    {sosElapsed > 0 && sosElapsed % 1800 < 5 && sosElapsed > 5 && (
                      <div style={{ fontSize: "0.75rem", color: "var(--secondary)", fontWeight: "600", padding: "4px 8px", background: "rgba(168,124,83,0.1)", borderRadius: "6px", marginTop: "4px" }}>
                        ⚠️ 建議重新更新 GPS 座標並再次發送位置
                      </div>
                    )}
                  </div>
                  <button onClick={stopSOSTimer} className="btn-secondary" style={{ padding: "6px", fontSize: "0.8rem", justifyContent: "center", borderColor: "var(--text-muted)", color: "var(--text-muted)" }}>
                    取消計時
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                    發出求救後啟動計時器，每 30 分鐘提醒更新 GPS。資料保存在瀏覽器中，即使重整頁面也不會消失。
                  </p>
                  <button onClick={() => { startSOSTimer(); getGPSLocation(); }} className="btn-primary" style={{ justifyContent: "center", padding: "10px", fontWeight: "600", background: "var(--diff-c-plus)" }}>
                    <Clock size={14} /> 啟動求救計時 + 定位
                  </button>
                </div>
              )}
            </div>

            {/* GPS 座標面板 */}
            <div className="mist-card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Compass size={16} /> 當前精確位置
              </h4>
              {coords ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ padding: "10px", background: "var(--inset-bg)", borderRadius: "8px", textAlign: "center" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>北緯</span>
                      <span style={{ fontSize: "1.15rem", fontWeight: "800", fontFamily: "Outfit", display: "block", color: "var(--primary)" }}>{coords.lat.toFixed(6)}°</span>
                    </div>
                    <div style={{ padding: "10px", background: "var(--inset-bg)", borderRadius: "8px", textAlign: "center" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>東經</span>
                      <span style={{ fontSize: "1.15rem", fontWeight: "800", fontFamily: "Outfit", display: "block", color: "var(--primary)" }}>{coords.lng.toFixed(6)}°</span>
                    </div>
                  </div>
                  
                  {/* 雙座標格式顯示 (WGS84 度分秒 & TWD97 二度分帶) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "var(--inset-bg)", padding: "10px", borderRadius: "8px", fontSize: "0.78rem", border: "1px solid var(--inset-border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: "600" }}>WGS84 度分秒 (DMS):</span>
                      <span style={{ fontFamily: "monospace", color: "var(--text-main)", fontWeight: "700" }}>
                        {toDMS(coords.lat, true)} / {toDMS(coords.lng, false)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: "600" }}>TWD97 二度分帶 (TM2):</span>
                      <span style={{ fontFamily: "monospace", color: "var(--text-main)", fontWeight: "700" }}>
                        X: {wgs84ToTwd97(coords.lat, coords.lng).x}, Y: {wgs84ToTwd97(coords.lat, coords.lng).y}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", fontSize: "0.75rem" }}>
                    <div style={{ padding: "6px", background: "var(--inset-bg)", borderRadius: "6px", textAlign: "center" }}>
                      <div style={{ color: "var(--text-muted)" }}>海拔</div>
                      <div style={{ fontWeight: "700", color: "var(--text-main)" }}>{altitude ? `${Math.round(altitude)}m` : "—"}</div>
                    </div>
                    <div style={{ padding: "6px", background: "var(--inset-bg)", borderRadius: "6px", textAlign: "center" }}>
                      <div style={{ color: "var(--text-muted)" }}>精度</div>
                      <div style={{ fontWeight: "700", color: accuracy <= 10 ? "var(--success)" : "var(--secondary)" }}>±{Math.round(accuracy)}m</div>
                    </div>
                    <div style={{ padding: "6px", background: "var(--inset-bg)", borderRadius: "6px", textAlign: "center" }}>
                      <div style={{ color: "var(--text-muted)" }}>電量</div>
                      <div style={{ fontWeight: "700", color: "var(--text-main)" }}>{batteryLevel}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <button onClick={copyToClipboard} className="btn-secondary" style={{ padding: "6px", fontSize: "0.8rem", justifyContent: "center" }}><Copy size={12} /> 複製</button>
                    <button onClick={speakCoordinates} className="btn-secondary" style={{ padding: "6px", fontSize: "0.8rem", justifyContent: "center" }}><Volume2 size={12} /> 語音</button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "20px", border: "2px dashed var(--inset-border)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>尚未獲取定位</span>
                </div>
              )}
              {locatingError && (
                <div style={{ fontSize: "0.8rem", color: "var(--diff-c-plus)", padding: "8px", background: "rgba(214,40,40,0.05)", borderRadius: "6px", fontWeight: "600" }}>{locatingError}</div>
              )}
              <button onClick={getGPSLocation} className="btn-primary" style={{ justifyContent: "center", padding: "10px", fontWeight: "600" }} disabled={isLocating}>
                <RefreshCw size={14} className={isLocating ? "animate-spin" : ""} /> {isLocating ? "搜尋中..." : coords ? "重新定位" : "開啟 GPS 定位"}
              </button>
            </div>

            {/* 簡訊回報 */}
            <div className="mist-card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <MessageSquare size={16} /> 一鍵求救簡訊
              </h4>
              {coords ? (
                <>
                  <textarea readOnly value={getSMSBody()} rows={3} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-glass)", background: "var(--inset-bg)", fontSize: "0.75rem", color: "var(--text-main)" }} />
                  <button onClick={() => handleSendSMS("112")} className="btn-primary" style={{ background: "var(--diff-c)", justifyContent: "center", padding: "10px", fontWeight: "600" }}>
                    <MessageSquare size={14} /> SOS 簡訊 (112)
                  </button>
                  {/* 發送給緊急聯絡人 */}
                  {contacts.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "600" }}>快速發送給聯絡人：</span>
                      {contacts.filter(c => c.phone).map(c => (
                        <button key={c.id} onClick={() => handleSendSMS(c.phone)} className="btn-secondary" style={{ padding: "6px 10px", fontSize: "0.75rem", justifyContent: "center" }}>
                          📱 {c.name} ({c.phone})
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button className="btn-primary" style={{ background: "var(--text-muted)", justifyContent: "center", padding: "10px" }} disabled>請先取得 GPS</button>
              )}
              <a href="tel:112" className="btn-secondary" style={{ textDecoration: "none", justifyContent: "center", color: "var(--diff-c-plus)", borderColor: "var(--diff-c-plus)", padding: "8px", fontWeight: "600" }}>
                <Phone size={14} /> 撥打 112 緊急電話
              </a>
            </div>
          </div>

          {/* 右側：聲光 + 指南針 + 生存指南 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* 聲光 */}
            <div className="mist-card" style={{ padding: "16px 20px" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <Zap size={16} /> 聲光 S.O.S 發訊
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button onClick={toggleSoundAlert} style={{ padding: "16px 8px", borderRadius: "10px", border: soundPlaying ? "2px solid var(--diff-c-plus)" : "1.5px solid var(--border-glass)", background: soundPlaying ? "rgba(214,40,40,0.06)" : "var(--surface-solid)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <Volume2 size={24} style={{ color: soundPlaying ? "var(--diff-c-plus)" : "var(--primary)" }} />
                  <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-main)" }}>{soundPlaying ? "關閉哨音" : "高頻哨音"}</span>
                </button>
                <button onClick={startSOSFlash} style={{ padding: "16px 8px", borderRadius: "10px", border: "1.5px solid var(--border-glass)", background: "var(--surface-solid)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <Zap size={24} style={{ color: "var(--secondary)" }} />
                  <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-main)" }}>螢幕閃光</span>
                </button>
              </div>
            </div>

            {/* 電子指南針 */}
            <div className="mist-card" style={{ padding: "16px 20px" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <Compass size={16} /> 離線電子指南針
              </h4>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                {isCompassActive && heading !== null ? (
                  <>
                    <div style={{ position: "relative", width: "140px", height: "140px", borderRadius: "50%", background: "var(--surface-solid)", border: "3px solid var(--border-glass)", boxShadow: "0 6px 24px rgba(45,90,39,0.1)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                      <div style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", transition: "transform 0.15s ease-out", transform: `rotate(${-heading}deg)` }}>
                        <span style={{ position: "absolute", top: "8px", left: "50%", transform: "translateX(-50%)", fontWeight: "900", color: "var(--diff-c-plus)", fontSize: "0.9rem" }}>N</span>
                        <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontWeight: "800", color: "var(--primary)", fontSize: "0.8rem" }}>E</span>
                        <span style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", fontWeight: "800", color: "var(--primary)", fontSize: "0.8rem" }}>S</span>
                        <span style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", fontWeight: "800", color: "var(--primary)", fontSize: "0.8rem" }}>W</span>
                        <div style={{ position: "absolute", width: "80%", height: "80%", border: "1px dashed var(--inset-border)", borderRadius: "50%", top: "10%", left: "10%" }} />
                      </div>
                      <div style={{ position: "absolute", top: "6px", width: "3px", height: "35px", background: "linear-gradient(to bottom, #d62828 70%, transparent 100%)", borderRadius: "2px", zIndex: 2 }} />
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3 }}>
                        <span style={{ fontSize: "1.3rem", fontWeight: "800", fontFamily: "Outfit", color: "var(--text-main)", lineHeight: 1 }}>{heading}°</span>
                        <span style={{ fontSize: "0.7rem", fontWeight: "700", color: "var(--primary)", marginTop: "2px" }}>{cardinalDirection}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center" }}>⚠️ 平放手機，遠離金屬物體</div>
                  </>
                ) : (
                  <div style={{ width: "140px", height: "140px", borderRadius: "50%", border: "2px dashed var(--inset-border)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--text-muted)", fontSize: "0.7rem", padding: "16px" }}>
                    等待啟動感應器...
                  </div>
                )}
                {compassError && <div style={{ fontSize: "0.7rem", color: "var(--diff-c-plus)", fontWeight: "600" }}>{compassError}</div>}
                <button onClick={toggleCompass} className="btn-secondary" style={{ padding: "6px 14px", fontSize: "0.8rem", borderColor: isCompassActive ? "var(--diff-c-plus)" : "var(--primary-light)", color: isCompassActive ? "var(--diff-c-plus)" : "var(--primary-light)", fontWeight: "600" }}>
                  <Compass size={12} /> {isCompassActive ? "關閉指南針" : "啟動指南針"}
                </button>
              </div>
            </div>

            {/* 離線生存指南 */}
            <div className="mist-card" style={{ padding: "16px 20px", display: "flex", gap: "12px" }}>
              <ShieldAlert size={22} style={{ color: "var(--secondary)", flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: "700", color: "var(--primary)", marginBottom: "6px" }}>離線生存指南</h4>
                <ol style={{ fontSize: "0.75rem", color: "var(--text-muted)", paddingLeft: "14px", display: "flex", flexDirection: "column", gap: "4px", margin: 0 }}>
                  <li><b>原地待援</b>：切勿盲目下切溪谷，留在稜線等待。</li>
                  <li><b>防止失溫</b>：換乾衣、雨衣防風，物品墊屁股隔離地面。</li>
                  <li><b>省電</b>：省電模式，定時開 GPS 即可。</li>
                  <li><b>蔽護</b>：天黑前搭遮蔽物防風雨。</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== 緊急聯絡人面板 ====== */}
      {activePanel === "contacts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="mist-card" style={{ padding: "20px" }}>
            <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Users size={18} /> 緊急聯絡人管理
            </h4>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "14px" }}>
              預設緊急聯絡人資訊，求救時可快速發送簡訊。支援手機號碼、LINE ID 與衛星電話——點擊號碼即可直接撥號，點 LINE ID 可開啟 LINE 聯絡。
            </p>

            {/* 新增表單 */}
            <form onSubmit={addContact} style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px", background: "var(--inset-bg)", borderRadius: "10px", marginBottom: "14px" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--primary)", marginBottom: "4px" }}><Plus size={14} style={{ display: "inline", verticalAlign: "middle" }} /> 新增聯絡人</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <input type="text" placeholder="姓名 *" value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} required style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-glass)", fontSize: "0.85rem" }} />
                <input type="tel" placeholder="手機號碼" value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-glass)", fontSize: "0.85rem" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <input type="text" placeholder="LINE ID" value={newContact.lineId} onChange={e => setNewContact(p => ({ ...p, lineId: e.target.value }))} style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-glass)", fontSize: "0.85rem" }} />
                <input type="tel" placeholder="衛星電話號碼" value={newContact.satPhone} onChange={e => setNewContact(p => ({ ...p, satPhone: e.target.value }))} style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-glass)", fontSize: "0.85rem" }} />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: "8px", fontSize: "0.85rem", justifyContent: "center" }}><Save size={14} /> 儲存聯絡人</button>
            </form>

            {/* 聯絡人列表 */}
            {contacts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "0.85rem", border: "2px dashed var(--inset-border)", borderRadius: "8px" }}>
                尚未設定緊急聯絡人
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {contacts.map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--inset-bg)", borderRadius: "8px" }}>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "0.9rem", color: "var(--text-main)" }}>{c.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "2px" }}>
                        {c.phone && (
                          <a href={`tel:${c.phone.replace(/\s/g, "")}`} style={{ color: "var(--primary)", textDecoration: "none", fontWeight: "600" }} title="點擊撥號">📱 {c.phone}</a>
                        )}
                        {c.lineId && (
                          <a href={`https://line.me/R/ti/p/~${encodeURIComponent(c.lineId)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#06c755", textDecoration: "none", fontWeight: "600" }} title="點擊用 LINE 加好友／聯絡">LINE: {c.lineId}</a>
                        )}
                        {c.satPhone && (
                          <a href={`tel:${c.satPhone.replace(/\s/g, "")}`} style={{ color: "var(--secondary)", textDecoration: "none", fontWeight: "600" }} title="點擊撥打衛星電話">📡 {c.satPhone}</a>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {c.phone && coords && (
                        <button onClick={() => handleSendSMS(c.phone)} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.7rem" }} title="發送含 GPS 座標的求救簡訊">
                          簡訊
                        </button>
                      )}
                      <button onClick={() => removeContact(c.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }} title="刪除聯絡人">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== 足跡回溯面板 ====== */}
      {activePanel === "breadcrumb" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="mist-card" style={{ padding: "20px" }}>
            <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Navigation size={18} /> 離線足跡回溯追蹤器
            </h4>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "14px" }}>
              啟動後每 60 秒自動記錄 GPS 座標（最多 500 點，約 8 小時路程），迷路時可回溯來時路。
            </p>

            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              {isBreadcrumbActive ? (
                <button onClick={stopBreadcrumb} className="btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem", borderColor: "var(--diff-c-plus)", color: "var(--diff-c-plus)", flex: 1, justifyContent: "center" }}>
                  <Navigation size={14} /> 停止記錄
                </button>
              ) : (
                <button onClick={startBreadcrumb} className="btn-primary" style={{ padding: "8px 14px", fontSize: "0.85rem", flex: 1, justifyContent: "center" }}>
                  <Navigation size={14} /> 開始記錄足跡
                </button>
              )}
              <button onClick={clearBreadcrumbs} className="btn-secondary" style={{ padding: "8px 12px", fontSize: "0.85rem", borderColor: "var(--text-muted)", color: "var(--text-muted)" }} disabled={breadcrumbs.length === 0}>
                <Trash2 size={14} /> 清除
              </button>
            </div>

            {/* 足跡統計 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
              <div style={{ padding: "10px", background: "var(--inset-bg)", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>已記錄點位</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "800", fontFamily: "Outfit", color: "var(--primary)" }}>{breadcrumbs.length}</div>
              </div>
              <div style={{ padding: "10px", background: "var(--inset-bg)", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>記錄狀態</div>
                <div style={{ fontSize: "0.85rem", fontWeight: "700", color: isBreadcrumbActive ? "var(--success)" : "var(--text-muted)" }}>
                  {isBreadcrumbActive ? "🟢 記錄中" : "⚪ 已暫停"}
                </div>
              </div>
              <div style={{ padding: "10px", background: "var(--inset-bg)", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>記錄時長</div>
                <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-main)" }}>
                  {breadcrumbs.length > 1 ? `${Math.round((breadcrumbs[breadcrumbs.length - 1].time - breadcrumbs[0].time) / 60000)} 分鐘` : "—"}
                </div>
              </div>
            </div>

            {/* 最近足跡列表 */}
            {breadcrumbs.length > 0 && (
              <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>最新記錄點（最新 → 最舊）：</div>
                {[...breadcrumbs].reverse().slice(0, 20).map((pt, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: i === 0 ? "var(--primary-glow)" : "var(--inset-bg)", borderRadius: "6px", fontSize: "0.75rem" }}>
                    <span style={{ fontFamily: "Outfit", color: "var(--text-main)" }}>
                      <MapPin size={10} style={{ display: "inline", verticalAlign: "middle" }} /> {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}
                      {pt.alt && <span style={{ color: "var(--text-muted)" }}> ({Math.round(pt.alt)}m)</span>}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{new Date(pt.time).toLocaleTimeString()}</span>
                  </div>
                ))}
                {breadcrumbs.length > 20 && (
                  <div style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--text-muted)", padding: "4px" }}>
                    ...還有 {breadcrumbs.length - 20} 個較早的記錄點
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== 安全檢查表面板 ====== */}
      {activePanel === "checklist" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="mist-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckSquare size={18} /> 出發前安全檢查表
              </h4>
              <button onClick={resetChecklist} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.7rem", borderColor: "var(--text-muted)", color: "var(--text-muted)" }}>
                重置
              </button>
            </div>

            {/* 進度條 */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                <span style={{ color: "var(--text-muted)" }}>完成進度</span>
                <span style={{ fontWeight: "700", color: checklistComplete ? "var(--success)" : "var(--primary)", fontFamily: "Outfit" }}>{checklistProgress}%</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "var(--inset-bg-strong)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${checklistProgress}%`, background: checklistComplete ? "var(--success)" : "var(--primary-light)", borderRadius: "4px", transition: "width 0.4s ease" }} />
              </div>
            </div>

            {/* 檢查項目 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {checklist.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleCheckItem(item.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "8px", cursor: "pointer",
                    background: item.checked ? "rgba(45,90,39,0.06)" : "var(--inset-bg)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{
                    width: "22px", height: "22px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
                    background: item.checked ? "var(--primary)" : "transparent", border: item.checked ? "2px solid var(--primary)" : "2px solid var(--text-muted)",
                    color: "white", fontSize: "14px", fontWeight: "bold", transition: "all 0.15s ease", flexShrink: 0
                  }}>
                    {item.checked && "✓"}
                  </div>
                  <span style={{ fontSize: "0.9rem", fontWeight: item.checked ? "600" : "400", color: item.checked ? "var(--primary)" : "var(--text-main)", textDecoration: item.checked ? "line-through" : "none", opacity: item.checked ? 0.8 : 1 }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* 完成動畫 */}
            {checklistComplete && (
              <div style={{ textAlign: "center", padding: "20px", marginTop: "14px", background: "rgba(45,90,39,0.06)", borderRadius: "12px", animation: "modalFadeIn 0.5s ease" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🎉</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--primary)" }}>安全出發 ✅</div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  所有檢查項目已確認完畢，祝您登山平安！
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .animate-spin { animation: spin 1.2s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
