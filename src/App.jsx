import React, { useState, useEffect, useCallback } from "react";
import { PEAKS } from "./data/peaks";
import { MINI_PEAKS } from "./data/miniPeaks";
import {
  loadRecords,
  saveRecord,
  savePhoto,
  deletePhoto,
  getAllPhotos,
  exportAllData,
  importAllData,
  requestPersistentStorage
} from "./utils/db";

// 載入子組件
import Dashboard from "./components/Dashboard";
import InteractiveMap from "./components/InteractiveMap";
import GearPlanner from "./components/GearPlanner";
import PeakRecordModal from "./components/PeakRecordModal";
import EmergencySOS from "./components/EmergencySOS";
import Statistics from "./components/Statistics";
import RouteGuard from "./components/RouteGuard";
import UserGuide from "./components/UserGuide";
import PhotoLightbox from "./components/PhotoLightbox";

// 載入圖示
import { LayoutDashboard, Map, Briefcase, Download, Upload, Mountain, ShieldAlert, Sun, Moon, BarChart3, Route, BookOpen } from "lucide-react";

// 判斷是否為夜間（18:00 ~ 06:00）
const isNightTime = () => {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
};

// 取得初始主題：優先讀取 localStorage，否則根據時間自動判斷
const getInitialTheme = () => {
  const saved = localStorage.getItem("tw100peaks_theme");
  if (saved === "dark" || saved === "light") return saved;
  // auto mode
  return isNightTime() ? "dark" : "light";
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, map, gear
  const [records, setRecords] = useState({});
  const [photos, setPhotos] = useState({});

  // ====== 資料集切換：百岳 / 小百岳 ======
  const [dataset, setDataset] = useState(() =>
    localStorage.getItem("tw100peaks_dataset") === "mini" ? "mini" : "peaks"
  );
  const activePeaks = dataset === "mini" ? MINI_PEAKS : PEAKS;
  const switchDataset = useCallback((ds) => {
    setDataset(ds);
    localStorage.setItem("tw100peaks_dataset", ds);
  }, []);
  
  // 跨分頁定位同步狀態
  const [mapFocusedCoords, setMapFocusedCoords] = useState(null);
  
  const handleLocateOnMap = (coords) => {
    setMapFocusedCoords(coords);
    setActiveTab("map");
  };

  // ====== 夜間模式管理 ======
  const [theme, setTheme] = useState(getInitialTheme);
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem("tw100peaks_theme_mode") || "auto"; // auto | manual
  });

  // 套用主題到 <html> 元素
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // 如果是 auto 模式，每分鐘偵測時間
  useEffect(() => {
    if (themeMode !== "auto") return;
    const checkTime = () => {
      const shouldBeDark = isNightTime();
      setTheme(shouldBeDark ? "dark" : "light");
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [themeMode]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    setThemeMode("manual");
    localStorage.setItem("tw100peaks_theme", newTheme);
    localStorage.setItem("tw100peaks_theme_mode", "manual");
  }, [theme]);

  const resetToAutoTheme = useCallback(() => {
    localStorage.removeItem("tw100peaks_theme");
    localStorage.setItem("tw100peaks_theme_mode", "auto");
    setThemeMode("auto");
    setTheme(isNightTime() ? "dark" : "light");
  }, []);
  
  // 完登彈窗控制
  const [selectedPeak, setSelectedPeak] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 全域相簿燈箱控制
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxActivePeakId, setLightboxActivePeakId] = useState(null);

  // 資料定期備份提示
  const [needsBackupReminder, setNeedsBackupReminder] = useState(false);

  const handleOpenLightbox = (peakId) => {
    setLightboxActivePeakId(peakId);
    setIsLightboxOpen(true);
  };

  // 初始化載入資料
  useEffect(() => {
    // 讀取完登紀錄文字
    const loadedRecords = loadRecords();
    setRecords(loadedRecords);

    // 讀取 IndexedDB 的所有登頂照片
    getAllPhotos()
      .then((loadedPhotos) => {
        setPhotos(loadedPhotos || {});
      })
      .catch((err) => {
        console.error("無法載入 IndexedDB 照片:", err);
      });

    // 啟用瀏覽器持久化儲存保護 (Persistent Storage)
    requestPersistentStorage();
  }, []);

  // 定期備份偵測提醒
  useEffect(() => {
    const recordCount = Object.keys(records).length;
    if (recordCount === 0) {
      setNeedsBackupReminder(false);
      return;
    }
    const lastBackup = localStorage.getItem("tw100peaks_last_backup_time");
    if (!lastBackup) {
      setNeedsBackupReminder(true);
    } else {
      const diffMs = Date.now() - parseInt(lastBackup, 10);
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      setNeedsBackupReminder(diffDays > 30);
    }
  }, [records]);

  // 當使用者點選某座百岳以進行完登登錄
  const handleOpenRecord = (peak) => {
    setSelectedPeak(peak);
    setIsModalOpen(true);
  };

  // 儲存紀錄（包含照片、心得與 GPX 軌跡）
  const handleSaveRecord = async (peakId, recordData, base64Photo, gpxTrack = null) => {
    try {
      // 1. 儲存文字與軌跡紀錄到 localStorage
      saveRecord(peakId, recordData, gpxTrack);

      // 2. 儲存照片到 IndexedDB
      if (base64Photo) {
        await savePhoto(peakId, base64Photo);
      } else {
        // 若使用者移除了照片，則將照片刪除
        await deletePhoto(peakId);
      }

      // 3. 重新整理 App 狀態
      const updatedRecords = loadRecords();
      const updatedPhotos = await getAllPhotos();
      
      setRecords(updatedRecords);
      setPhotos(updatedPhotos || {});
      
      // 關閉彈窗
      setIsModalOpen(false);
      setSelectedPeak(null);
    } catch (e) {
      console.error("儲存紀錄失敗:", e);
      alert("儲存失敗，請重試！");
    }
  };

  // 刪除紀錄
  const handleDeleteRecord = async (peakId) => {
    try {
      // 1. 從 localStorage 刪除
      saveRecord(peakId, null);

      // 2. 從 IndexedDB 刪除照片
      await deletePhoto(peakId);

      // 3. 重新整理 App 狀態
      const updatedRecords = loadRecords();
      const updatedPhotos = await getAllPhotos();

      setRecords(updatedRecords);
      setPhotos(updatedPhotos || {});

      // 關閉彈窗
      setIsModalOpen(false);
      setSelectedPeak(null);
    } catch (e) {
      console.error("刪除紀錄失敗:", e);
      alert("刪除失敗，請重試！");
    }
  };

  // 匯出備份資料
  const handleExportBackup = async () => {
    try {
      await exportAllData();
      localStorage.setItem("tw100peaks_last_backup_time", Date.now().toString());
      setNeedsBackupReminder(false);
    } catch (e) {
      alert("備份失敗！");
    }
  };

  // 匯入備份資料
  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const success = await importAllData(event.target.result);
        if (success) {
          // 重新載入全站狀態
          setRecords(loadRecords());
          setPhotos(await getAllPhotos());
          alert("資料備份匯入成功！");
        }
      } catch (err) {
        alert("匯入失敗，請確認檔案格式是否正確。");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-container">
      {/* 背景點綴格線 */}
      <div className="topo-bg" />

      {/* 側邊導覽列 */}
      <aside
        style={{
          width: "260px",
          background: "var(--bg-glass)",
          backdropFilter: "blur(12px)",
          borderRight: "1px solid var(--border-glass)",
          padding: "20px 18px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 10,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto"
        }}
        className="sidebar"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Logo 區 + 主題切換 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white"
                }}
              >
                <Mountain size={20} />
              </div>
              <div>
                <h1 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--primary)" }}>智行百岳</h1>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "1px" }}>CLIMBSMART</span>
              </div>
            </div>

            {/* 日/月主題切換按鈕 */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "切換為亮色模式" : "切換為暗色模式"}
                style={{
                  background: "var(--primary-glow)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px",
                  cursor: "pointer",
                  color: theme === "dark" ? "#f0c040" : "var(--primary)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {themeMode === "manual" && (
                <button
                  onClick={resetToAutoTheme}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.55rem",
                    color: "var(--text-muted)",
                    padding: 0,
                    whiteSpace: "nowrap"
                  }}
                  title="恢復為依據時間自動切換"
                >
                  自動
                </button>
              )}
            </div>
          </div>

          {/* 資料集切換：百岳 / 小百岳 */}
          <div style={{ display: "flex", background: "var(--inset-bg)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
            {[
              { key: "peaks", label: "臺灣百岳" },
              { key: "mini", label: "臺灣小百岳" }
            ].map((ds) => (
              <button
                key={ds.key}
                onClick={() => switchDataset(ds.key)}
                style={{
                  flex: 1,
                  padding: "7px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: "700",
                  background: dataset === ds.key ? "var(--primary)" : "transparent",
                  color: dataset === ds.key ? "#fff" : "var(--text-muted)",
                  transition: "all 0.2s ease"
                }}
              >
                {ds.label}
              </button>
            ))}
          </div>

          {/* 導覽按鈕 */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={() => setActiveTab("dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === "dashboard" ? "var(--primary-glow)" : "transparent",
                color: activeTab === "dashboard" ? "var(--primary)" : "var(--text-muted)",
                fontWeight: activeTab === "dashboard" ? "700" : "500",
                fontSize: "0.95rem",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              className="nav-link"
            >
              <LayoutDashboard size={18} />
              <span>百岳儀表板</span>
            </button>
 
            <button
              onClick={() => setActiveTab("map")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === "map" ? "var(--primary-glow)" : "transparent",
                color: activeTab === "map" ? "var(--primary)" : "var(--text-muted)",
                fontWeight: activeTab === "map" ? "700" : "500",
                fontSize: "0.95rem",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              className="nav-link"
            >
              <Map size={18} />
              <span>互動式地圖</span>
            </button>
 
            <button
              onClick={() => setActiveTab("gear")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === "gear" ? "var(--primary-glow)" : "transparent",
                color: activeTab === "gear" ? "var(--primary)" : "var(--text-muted)",
                fontWeight: activeTab === "gear" ? "700" : "500",
                fontSize: "0.95rem",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              className="nav-link"
            >
              <Briefcase size={18} />
              <span>裝備規劃器</span>
            </button>
 
            <button
              onClick={() => setActiveTab("stats")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === "stats" ? "var(--primary-glow)" : "transparent",
                color: activeTab === "stats" ? "var(--primary)" : "var(--text-muted)",
                fontWeight: activeTab === "stats" ? "700" : "500",
                fontSize: "0.95rem",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              className="nav-link"
            >
              <BarChart3 size={18} />
              <span>統計分析</span>
            </button>
 
            <button
              onClick={() => setActiveTab("route")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === "route" ? "var(--primary-glow)" : "transparent",
                color: activeTab === "route" ? "var(--primary)" : "var(--text-muted)",
                fontWeight: activeTab === "route" ? "700" : "500",
                fontSize: "0.95rem",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              className="nav-link"
            >
              <Route size={18} />
              <span>路線守護</span>
            </button>
 
            <button
              onClick={() => setActiveTab("guide")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === "guide" ? "var(--primary-glow)" : "transparent",
                color: activeTab === "guide" ? "var(--primary)" : "var(--text-muted)",
                fontWeight: activeTab === "guide" ? "700" : "500",
                fontSize: "0.95rem",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              className="nav-link"
            >
              <BookOpen size={18} />
              <span>使用說明</span>
            </button>
 
            <button
              onClick={() => setActiveTab("sos")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === "sos" ? "rgba(214, 40, 40, 0.08)" : "transparent",
                color: activeTab === "sos" ? "var(--diff-c-plus)" : "var(--text-muted)",
                fontWeight: activeTab === "sos" ? "700" : "500",
                fontSize: "0.95rem",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              className="nav-link"
            >
              <ShieldAlert size={18} style={{ color: "var(--diff-c-plus)" }} />
              <span style={{ color: "var(--diff-c-plus)" }}>野外求救</span>
            </button>
          </nav>
        </div>

        {/* 底部備份備忘與資料備份功能 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              padding: "8px 10px",
              background: "rgba(0,0,0,0.02)",
              borderRadius: "8px",
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              lineHeight: "1.4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            {needsBackupReminder 
              ? "⚠️ 完登紀錄尚未備份，建議立即匯出！" 
              : "💡 資料已持久化儲存在本地瀏覽器快取。"}
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <button
              onClick={handleExportBackup}
              className="btn-secondary"
              style={{
                padding: "6px 4px",
                fontSize: "0.75rem",
                justifyContent: "center",
                gap: "4px",
                borderColor: needsBackupReminder ? "var(--diff-c-plus)" : "rgba(0,0,0,0.1)",
                color: needsBackupReminder ? "var(--diff-c-plus)" : "var(--text-main)",
                boxShadow: needsBackupReminder ? "0 0 8px rgba(214, 40, 40, 0.2)" : "none",
                fontWeight: needsBackupReminder ? "700" : "500"
              }}
              title="將完登紀錄與相簿下載成 JSON 備份檔"
            >
              <Download size={12} /> 匯出
            </button>

            <button
              onClick={() => document.getElementById("import-file-input").click()}
              className="btn-secondary"
              style={{
                padding: "6px 4px",
                fontSize: "0.75rem",
                justifyContent: "center",
                gap: "4px",
                borderColor: "rgba(0,0,0,0.1)",
                color: "var(--text-main)"
              }}
              title="匯入之前下載的 JSON 備份檔"
            >
              <Upload size={12} /> 匯入
            </button>
            <input
              id="import-file-input"
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              style={{ display: "none" }}
            />
          </div>
          
          <div style={{ 
            fontSize: "0.65rem", 
            color: "var(--text-muted)", 
            textAlign: "center", 
            marginTop: "6px",
            opacity: 0.95,
            lineHeight: "1.4"
          }}>
            © 2026 Studio0808 智造實驗室.<br/>
            All rights reserved.<br/>
            <a 
              href="mailto:begin0808@gmail.com?subject=%5B%E6%99%BA%E8%A1%8C%E7%99%BE%E5%B3%B3%E5%9B%9E%E5%A0%B1%5D" 
              style={{ 
                color: "var(--primary-light)", 
                textDecoration: "none", 
                fontWeight: "600", 
                display: "inline-flex", 
                alignItems: "center", 
                gap: "2px",
                margin: "4px 0"
              }}
              className="email-link"
            >
              ✉ 寫信給我
            </a><br/>
            <span style={{ fontSize: "0.58rem", opacity: 0.85 }}>Version V20260619</span>
          </div>
        </div>
      </aside>

      {/* 手機版頂部導覽列（只在小螢幕時用 CSS 控制顯示，這裡用 JS 支援基本的適應性佈局） */}
      <header
        style={{
          background: "var(--bg-glass)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-glass)",
          padding: "12px 16px",
          zIndex: 10,
          display: "none"
        }}
        className="mobile-header"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Mountain size={18} style={{ color: "var(--primary)" }} />
            <h1 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--primary)" }}>智行百岳</h1>
          </div>
          
          {/* 小按鈕群 */}
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => setActiveTab("dashboard")}
              style={{
                background: activeTab === "dashboard" ? "var(--primary-glow)" : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "6px",
                color: activeTab === "dashboard" ? "var(--primary)" : "var(--text-muted)"
              }}
            >
              <LayoutDashboard size={16} />
            </button>
            <button
              onClick={() => setActiveTab("map")}
              style={{
                background: activeTab === "map" ? "var(--primary-glow)" : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "6px",
                color: activeTab === "map" ? "var(--primary)" : "var(--text-muted)"
              }}
            >
              <Map size={16} />
            </button>
            <button
              onClick={() => setActiveTab("gear")}
              style={{
                background: activeTab === "gear" ? "var(--primary-glow)" : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "6px",
                color: activeTab === "gear" ? "var(--primary)" : "var(--text-muted)"
              }}
            >
              <Briefcase size={16} />
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              style={{
                background: activeTab === "stats" ? "var(--primary-glow)" : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "6px",
                color: activeTab === "stats" ? "var(--primary)" : "var(--text-muted)"
              }}
            >
              <BarChart3 size={16} />
            </button>
            <button
              onClick={() => setActiveTab("route")}
              style={{
                background: activeTab === "route" ? "var(--primary-glow)" : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "6px",
                color: activeTab === "route" ? "var(--primary)" : "var(--text-muted)"
              }}
            >
              <Route size={16} />
            </button>
            <button
              onClick={() => setActiveTab("guide")}
              style={{
                background: activeTab === "guide" ? "var(--primary-glow)" : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "6px",
                color: activeTab === "guide" ? "var(--primary)" : "var(--text-muted)"
              }}
            >
              <BookOpen size={16} />
            </button>
            <button
              onClick={() => setActiveTab("sos")}
              style={{
                background: activeTab === "sos" ? "rgba(214, 40, 40, 0.08)" : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "6px",
                color: activeTab === "sos" ? "var(--diff-c-plus)" : "var(--text-muted)"
              }}
            >
              <ShieldAlert size={16} />
            </button>

            {/* 手機版主題切換 */}
            <button
              onClick={toggleTheme}
              style={{
                background: "var(--primary-glow)",
                border: "none",
                borderRadius: "6px",
                padding: "6px",
                color: theme === "dark" ? "#f0c040" : "var(--primary)"
              }}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* 手機版資料集切換 */}
        <div style={{ display: "flex", background: "var(--inset-bg)", borderRadius: "8px", padding: "2px", gap: "2px", marginTop: "10px" }}>
          {[
            { key: "peaks", label: "臺灣百岳" },
            { key: "mini", label: "臺灣小百岳" }
          ].map((ds) => (
            <button
              key={ds.key}
              onClick={() => switchDataset(ds.key)}
              style={{
                flex: 1,
                padding: "6px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: "700",
                background: dataset === ds.key ? "var(--primary)" : "transparent",
                color: dataset === ds.key ? "#fff" : "var(--text-muted)"
              }}
            >
              {ds.label}
            </button>
          ))}
        </div>
      </header>

      {/* 主內容區 */}
      <main style={{ flex: 1, overflowY: "auto", position: "relative" }} className="main-content">
        {activeTab === "dashboard" && (
          <Dashboard
            peaks={activePeaks}
            dataset={dataset}
            records={records}
            photos={photos}
            onOpenRecord={handleOpenRecord}
            onOpenLightbox={handleOpenLightbox}
          />
        )}

        {activeTab === "map" && (
          <InteractiveMap
            peaks={activePeaks}
            dataset={dataset}
            records={records}
            onOpenRecord={handleOpenRecord}
            focusedCoords={mapFocusedCoords}
            setMapFocusedCoords={setMapFocusedCoords}
          />
        )}

        {activeTab === "gear" && (
          <GearPlanner 
            dataset={dataset}
            onLocateOnMap={handleLocateOnMap}
          />
        )}

        {activeTab === "stats" && <Statistics peaks={activePeaks} dataset={dataset} records={records} />}

        {activeTab === "route" && <RouteGuard />}

        {activeTab === "sos" && <EmergencySOS />}

        {activeTab === "guide" && <UserGuide />}
      </main>

      {/* 編輯完登紀錄彈窗 */}
      <PeakRecordModal
        peak={selectedPeak}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPeak(null);
        }}
        initialRecord={selectedPeak ? records[selectedPeak.id] : null}
        initialPhoto={selectedPeak ? photos[selectedPeak.id] : null}
        onSave={handleSaveRecord}
        onDelete={handleDeleteRecord}
        onOpenLightbox={handleOpenLightbox}
      />

      {/* 全螢幕照片輪播燈箱 */}
      <PhotoLightbox
        isOpen={isLightboxOpen}
        activePeakId={lightboxActivePeakId}
        onClose={() => {
          setIsLightboxOpen(false);
          setLightboxActivePeakId(null);
        }}
        peaks={activePeaks}
        records={records}
        photos={photos}
      />

      {/* 微小響應式 RWD 嵌入樣式 */}
      <style>{`
        .nav-link:hover {
          background: rgba(45, 90, 39, 0.04) !important;
          color: var(--primary) !important;
        }
        .email-link:hover {
          text-decoration: underline !important;
          color: var(--primary) !important;
        }
        @media (max-width: 768px) {
          .sidebar {
            display: none !important;
          }
          .mobile-header {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
