import React, { useState, useEffect } from "react";
import { X, Calendar, Edit3, Camera, Trash2, Check, BookOpen, Compass, Info } from "lucide-react";
import { compressImage, parseGPX } from "../utils/db";

export default function PeakRecordModal({
  peak,
  isOpen,
  onClose,
  initialRecord,
  initialPhoto,
  onSave,
  onDelete
}) {
  const [activeTab, setActiveTab] = useState("profile"); // profile, record
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [gpxTrack, setGpxTrack] = useState(null);
  const [gpxFilename, setGpxFilename] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);

  // 當打開彈窗或 peak 改變時，初始化與重設狀態
  useEffect(() => {
    if (isOpen && peak) {
      setDate(initialRecord?.date || new Date().toISOString().split("T")[0]);
      setNote(initialRecord?.note || "");
      setPhoto(initialPhoto || null);
      setGpxTrack(initialRecord?.gpxTrack || null);
      setGpxFilename(initialRecord?.gpxTrack ? "已載入登山軌跡" : "");
      // 若已完登，預設切換到紀錄分頁；若未完登，預設切換到山峰小百科分頁
      setActiveTab(initialRecord ? "record" : "profile");
    }
  }, [isOpen, peak, initialRecord, initialPhoto]);

  if (!isOpen || !peak) return null;

  // 處理相片上傳與前端壓縮
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressedBase64 = await compressImage(file, 1000, 1000, 0.65);
      setPhoto(compressedBase64);
    } catch (err) {
      console.error("圖片壓縮失敗:", err);
      alert("圖片讀取失敗，請更換一張試試！");
    } finally {
      setIsCompressing(false);
    }
  };

  // 處理 GPX 軌跡上傳
  const handleGpxChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const points = parseGPX(event.target.result);
        setGpxTrack(points);
        setGpxFilename(file.name);
        alert(`GPX 軌跡解析成功，共載入 ${points.length} 個航點！`);
      } catch (err) {
        alert("GPX 檔案解析失敗，請確認檔案內容是否為標準 XML / GPX 格式。");
      }
    };
    reader.readAsText(file);
  };

  // 移除相片
  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPhoto(null);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSave(peak.id, { date, note }, photo, gpxTrack);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content mist-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "0",
          overflow: "hidden",
          maxWidth: "600px",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* 頂部橫幅區 */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
            color: "white",
            padding: "20px 24px",
            position: "relative"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "1.6rem", fontWeight: "800", margin: "0" }}>{peak.name}</h2>
                <span className={`difficulty-badge diff-${peak.difficulty.replace("+", "-plus")}`} style={{ scale: "0.9" }}>
                  {peak.difficulty} 級
                </span>
                {peak.group && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      background: "rgba(255, 255, 255, 0.2)",
                      padding: "2px 8px",
                      borderRadius: "20px",
                      fontWeight: "700"
                    }}
                  >
                    {peak.group.split("-")[0]}
                  </span>
                )}
              </div>
              <p style={{ opacity: "0.85", fontSize: "0.85rem", marginTop: "6px", margin: "0" }}>
                #{String(peak.id).padStart(3, "0")} &bull; 海拔高度 {peak.elevation}m &bull; {peak.range} &bull; {peak.county}
              </p>
            </div>
            
            <button
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                cursor: "pointer"
              }}
              title="關閉"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 分頁 Tab 切換列 */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
            background: "rgba(255, 255, 255, 0.95)"
          }}
        >
          <button
            onClick={() => setActiveTab("profile")}
            style={{
              flex: 1,
              padding: "14px",
              border: "none",
              background: "none",
              fontSize: "0.95rem",
              fontWeight: activeTab === "profile" ? "700" : "500",
              color: activeTab === "profile" ? "var(--primary)" : "var(--text-muted)",
              borderBottom: activeTab === "profile" ? "3px solid var(--primary)" : "3px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            <BookOpen size={16} />
            <span>山峰小百科</span>
          </button>

          <button
            onClick={() => setActiveTab("record")}
            style={{
              flex: 1,
              padding: "14px",
              border: "none",
              background: "none",
              fontSize: "0.95rem",
              fontWeight: activeTab === "record" ? "700" : "500",
              color: activeTab === "record" ? "var(--primary)" : "var(--text-muted)",
              borderBottom: activeTab === "record" ? "3px solid var(--primary)" : "3px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            <Calendar size={16} />
            <span>我的完登紀錄 {initialRecord && "✓"}</span>
          </button>
        </div>

        {/* 內容展現區 */}
        <div style={{ padding: "24px", overflowY: "auto", maxHeight: "420px" }}>
          
          {/* TAB 1: 山峰百科 */}
          {activeTab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* 核心介紹段落 */}
              <div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Info size={16} /> 山峰特徵與簡介
                </h4>
                <p style={{ fontSize: "0.9rem", color: "var(--text-main)", lineHeight: "1.6", background: "rgba(0,0,0,0.02)", padding: "12px 16px", borderRadius: "10px", margin: "0" }}>
                  {peak.intro || "暫無詳細介紹資訊。"}
                </p>
              </div>

              {/* 地理與攀登指標數據 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ padding: "10px 14px", background: "var(--bg-glass)", border: "1px solid var(--border-glass)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>建議攀登天數</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary-light)" }}>{peak.suggestedDays || "資料整理中"}</span>
                </div>
                <div style={{ padding: "10px 14px", background: "var(--bg-glass)", border: "1px solid var(--border-glass)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>主要登山口</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--primary-light)" }} title={peak.trailhead}>{peak.trailhead || "資料整理中"}</span>
                </div>
                <div style={{ padding: "10px 14px", background: "var(--bg-glass)", border: "1px solid var(--border-glass)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>WGS84 緯度 (Latitude)</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: "600", fontFamily: "Outfit", color: "var(--text-main)" }}>{peak.lat}° N</span>
                </div>
                <div style={{ padding: "10px 14px", background: "var(--bg-glass)", border: "1px solid var(--border-glass)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>WGS84 經度 (Longitude)</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: "600", fontFamily: "Outfit", color: "var(--text-main)" }}>{peak.lng}° E</span>
                </div>
              </div>

              {/* 導航按鈕（快速導向登錄分頁） */}
              {!initialRecord && (
                <button
                  onClick={() => setActiveTab("record")}
                  className="btn-primary"
                  style={{ justifyContent: "center", marginTop: "10px" }}
                >
                  <Calendar size={16} /> 我已登頂，填寫登頂紀錄！
                </button>
              )}
            </div>
          )}

          {/* TAB 2: 我的完登紀錄 */}
          {activeTab === "record" && (
            <form onSubmit={handleFormSubmit}>
              {/* 完登日期 */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    color: "var(--text-main)",
                    marginBottom: "6px"
                  }}
                >
                  <Calendar size={16} style={{ color: "var(--primary-light)" }} /> 完登日期
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1.5px solid var(--border-glass)",
                    background: "rgba(255, 255, 255, 0.8)",
                    color: "var(--text-main)",
                    fontSize: "0.95rem",
                    fontFamily: "var(--font-family)"
                  }}
                />
              </div>

              {/* GPX 軌跡上傳 */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    color: "var(--text-main)",
                    marginBottom: "6px"
                  }}
                >
                  <Compass size={16} style={{ color: "var(--primary-light)" }} /> GPX 登山軌跡檔 (選填)
                </label>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => document.getElementById("gpx-input").click()}
                    style={{ padding: "8px 12px", fontSize: "0.8rem" }}
                  >
                    選擇 GPX 檔案
                  </button>
                  <input
                    id="gpx-input"
                    type="file"
                    accept=".gpx"
                    onChange={handleGpxChange}
                    style={{ display: "none" }}
                  />

                  {gpxTrack ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "var(--primary-light)", fontWeight: "600" }}>
                      <span>✓ {gpxFilename || "已載入軌跡"} ({gpxTrack.length} 點)</span>
                      <button
                        type="button"
                        onClick={() => {
                          setGpxTrack(null);
                          setGpxFilename("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--diff-c-plus)",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          textDecoration: "underline"
                        }}
                      >
                        清除
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>未載入軌跡檔</span>
                  )}
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px", margin: "0" }}>
                  匯入標準 .gpx 檔，完登後可在地圖上繪製您的真實攀登路徑！
                </p>
              </div>

              {/* 登頂照片 */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    color: "var(--text-main)",
                    marginBottom: "6px"
                  }}
                >
                  <Camera size={16} style={{ color: "var(--primary-light)" }} /> 登頂紀念相片
                </label>

                <div
                  className="photo-uploader"
                  onClick={() => document.getElementById("photo-input").click()}
                >
                  <input
                    id="photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                  />

                  {isCompressing ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      <div style={{
                        width: "24px",
                        height: "24px",
                        border: "3px solid rgba(45, 90, 39, 0.2)",
                        borderTopColor: "var(--primary)",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        margin: "0 auto 8px"
                      }} />
                      <span>圖片處理中...</span>
                    </div>
                  ) : photo ? (
                    <>
                      <img src={photo} alt="登頂照片" className="photo-preview" />
                      <div
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          display: "flex",
                          gap: "8px"
                        }}
                      >
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          style={{
                            background: "rgba(214, 40, 40, 0.9)",
                            color: "white",
                            border: "none",
                            borderRadius: "50%",
                            width: "32px",
                            height: "32px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                          }}
                          title="刪除相片"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                      <Camera size={32} style={{ margin: "0 auto 8px", opacity: 0.6, color: "var(--primary-light)" }} />
                      <p style={{ fontSize: "0.9rem", fontWeight: "500" }}>點擊上傳登頂照</p>
                      <p style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: "2px" }}>支援 JPG/PNG，將自動在本地壓縮</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 登山筆記 */}
              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    color: "var(--text-main)",
                    marginBottom: "6px"
                  }}
                >
                  <Edit3 size={16} style={{ color: "var(--primary-light)" }} /> 登山心得與備忘
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="分享您登頂時的天氣、難忘的事，或是步道路況心得..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1.5px solid var(--border-glass)",
                    background: "rgba(255, 255, 255, 0.8)",
                    color: "var(--text-main)",
                    fontSize: "0.95rem",
                    fontFamily: "var(--font-family)",
                    resize: "vertical"
                  }}
                />
              </div>

              {/* 動作按鈕 */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                {initialRecord ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (window.confirm(`確定要刪除 ${peak.name} 的登頂紀錄嗎？`)) {
                        onDelete(peak.id);
                      }
                    }}
                    style={{
                      color: "var(--diff-c-plus)",
                      borderColor: "var(--diff-c-plus)",
                      padding: "10px 16px"
                    }}
                  >
                    <Trash2 size={16} /> 刪除紀錄
                  </button>
                ) : (
                  <div />
                )}

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClose}
                    style={{ padding: "10px 18px", border: "1.5px solid var(--text-muted)", color: "var(--text-main)" }}
                  >
                    取消
                  </button>
                  <button type="submit" className="btn-primary" style={{ padding: "10px 20px" }}>
                    <Check size={16} /> 儲存紀錄
                  </button>
                </div>
              </div>
            </form>
          )}

        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
