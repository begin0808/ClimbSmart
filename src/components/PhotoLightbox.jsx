import React, { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Calendar, BookOpen, Compass } from "lucide-react";

export default function PhotoLightbox({
  isOpen,
  activePeakId,
  onClose,
  peaks,
  records,
  photos
}) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // 篩選出所有有照片的百岳
  const peaksWithPhotos = peaks.filter((p) => records[p.id] && photos[p.id]);

  // 當打開燈箱或傳入的 activePeakId 改變時，設定 index
  useEffect(() => {
    if (isOpen && activePeakId !== null) {
      const idx = peaksWithPhotos.findIndex((p) => p.id === activePeakId);
      setCurrentIndex(idx);
    }
  }, [isOpen, activePeakId, peaksWithPhotos.length]);

  // 監聽鍵盤事件
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, peaksWithPhotos.length]);

  if (!isOpen || currentIndex === -1 || peaksWithPhotos.length === 0) return null;

  const currentPeak = peaksWithPhotos[currentIndex];
  const currentPhoto = photos[currentPeak.id];
  const currentRecord = records[currentPeak.id];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : peaksWithPhotos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < peaksWithPhotos.length - 1 ? prev + 1 : 0));
  };

  // 滑動手勢處理
  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diffX = touchStartX.current - touchEndX.current;
    if (diffX > 50) {
      // 向左滑，下一張
      handleNext();
    } else if (diffX < -50) {
      // 向右滑，上一張
      handlePrev();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(10, 15, 30, 0.9)",
        backdropFilter: "blur(20px)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px",
        color: "white",
        fontFamily: "var(--font-family)"
      }}
      onClick={onClose}
    >
      {/* 頂部列：山峰基本資訊與關閉按鈕 */}
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{currentPeak.name}</span>
            <span style={{ fontSize: "0.8rem", background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: "10px" }}>
              #{String(currentPeak.id).padStart(3, "0")}
            </span>
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
            海拔 {currentPeak.elevation}m &bull; {currentPeak.range} &bull; {currentPeak.county}
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          className="lightbox-close-btn"
          title="關閉 (Esc)"
        >
          <X size={24} />
        </button>
      </div>

      {/* 中部：照片與左右切換箭頭 */}
      <div
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "1100px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          margin: "20px 0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左側箭頭 */}
        <button
          onClick={handlePrev}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            border: "none",
            borderRadius: "50%",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            zIndex: 10,
            transition: "all 0.2s"
          }}
          className="lightbox-arrow-btn"
          title="上一張 (←)"
        >
          <ChevronLeft size={28} />
        </button>

        {/* 圖片展示主區 */}
        <div
          style={{
            flex: 1,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden"
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={currentPhoto}
            alt={currentPeak.name}
            style={{
              maxWidth: "100%",
              maxHeight: "70vh",
              objectFit: "contain",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              transition: "transform 0.3s ease"
            }}
          />
        </div>

        {/* 右側箭頭 */}
        <button
          onClick={handleNext}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            border: "none",
            borderRadius: "50%",
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            zIndex: 10,
            transition: "all 0.2s"
          }}
          className="lightbox-arrow-btn"
          title="下一張 (→)"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* 底部：心得備忘面板與縮圖導覽條 */}
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          zIndex: 10
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 完登心得與日期面板 */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.07)",
            backdropFilter: "blur(10px)",
            borderRadius: "14px",
            padding: "16px 20px",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", color: "#70d6ff", fontWeight: "700", marginBottom: "8px" }}>
            <Calendar size={14} />
            <span>完登日期：{currentRecord?.date || "未登錄"}</span>
          </div>

          <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: "1.6", color: "#e0e0e0" }}>
            {currentRecord?.note || "（無填寫登山心得備忘）"}
          </p>
        </div>

        {/* 縮圖導覽條 (Thumbnail quick bar) */}
        {peaksWithPhotos.length > 1 && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              padding: "4px 4px 10px 4px",
              justifyContent: peaksWithPhotos.length < 10 ? "center" : "flex-start",
              width: "100%",
              scrollbarWidth: "thin"
            }}
            className="lightbox-thumb-bar"
          >
            {peaksWithPhotos.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setCurrentIndex(idx)}
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "6px",
                  overflow: "hidden",
                  border: idx === currentIndex ? "2px solid var(--primary-light)" : "2px solid transparent",
                  padding: 0,
                  opacity: idx === currentIndex ? 1 : 0.4,
                  transition: "all 0.2s",
                  cursor: "pointer",
                  flexShrink: 0,
                  background: "none"
                }}
              >
                <img src={photos[p.id]} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .lightbox-close-btn:hover, .lightbox-arrow-btn:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          transform: scale(1.05);
        }
        .lightbox-thumb-bar::-webkit-scrollbar {
          height: 6px;
        }
        .lightbox-thumb-bar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .lightbox-thumb-bar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
