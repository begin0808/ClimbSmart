import React from "react";
import { BookOpen, LayoutDashboard, Map, Briefcase, BarChart3, Route, ShieldAlert, Mail, MessageSquare, Compass, Info, Shield, HelpCircle, HardDrive } from "lucide-react";

// 自訂 GitHub 圖示，避開不同版本套件缺失問題
const GithubIcon = ({ size = 16 }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function UserGuide() {
  return (
    <div style={{ flex: 1, padding: "24px", maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>
      
      {/* 標頭 */}
      <div className="mist-card" style={{ padding: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{
          width: "50px",
          height: "50px",
          borderRadius: "12px",
          background: "var(--primary-glow)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--primary-light)"
        }}>
          <BookOpen size={28} />
        </div>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--primary)" }}>智行百岳 ClimbSmart 詳細說明手冊</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2px" }}>
            本手冊詳述本平台六大功能模組之操作步驟，以及安全、隱私與部署之技術細節。
          </p>
        </div>
      </div>

      {/* 六大核心模組詳細指南 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* 1. 百岳與小百岳儀表板 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <LayoutDashboard size={24} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0 }}>1. 完登記錄儀表板與資料集切換</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**操作指南**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**百岳 / 小百岳切換**：利用側邊欄（或手機版頂部）的切換鈕，可即時在「100座百岳」與「100座小百岳」資料集之間進行切換，全站地圖及統計會同步更新。</li>
              <li>**完登打卡與照片上傳**：點擊任意山峰卡片或勾選框，即可設定登頂日期並上傳登頂照。為節省空間，照片在上傳時會自動在瀏覽器內進行無損壓縮，隨後儲存在您的本機資料庫。</li>
              <li>**多維度搜尋與篩選**：支援以山名、高度、縣市關鍵字進行搜尋；並能透過山脈地區、難度（A/B/C/C+）及完登狀態進行三合一複合過濾。</li>
            </ol>
          </div>
        </div>

        {/* 2. 互動式地圖 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <Map size={24} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0 }}>2. 等高線地圖操作與離線圖磚下載</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**地圖功能與離線下載**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**平滑定位（FlyTo）**：在儀表板點擊山峰卡片右側的 **「MapPin」定位圖示**，系統會平滑切換至地圖分頁並動態飛越對焦到該座標，方便掌握周邊地形。</li>
              <li>**地圖下載與快取（重要防迷）**：在右側「離線地圖快取管理」中，將地圖移動至即將前往的山區，選擇「細節層級」後點擊 **「下載目前畫面範圍」**，地圖等高線圖磚會快取至本地端。山區無訊號時，地圖仍可離線顯示。</li>
              <li>**圖層切換**：點選地圖右上角圖層按鈕，可自由在「地形等高線圖」、「道路圖」或「衛星影像」間進行切換。</li>
            </ol>
          </div>
        </div>

        {/* 3. 裝備規劃器 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <Briefcase size={24} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0 }}>3. 輕量化裝備規劃與天氣預報</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**裝備配重與Waypoint天氣**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**裝備清單與基礎重量 (Base Weight)**：載入建議範本後勾選已打包裝備。系統會為您扣除消耗品（水、食物），計算出科學「基礎重量」。若多日行程超重（大於 8 公斤），系統會發出紅色超重警告。</li>
              <li>**高山天氣點位切換**：可在天氣卡片中下拉切換該路線的 Waypoints（如「塔塔加登山口」、「排雲山莊」、「玉山主峰頂」），系統會依不同點位的海拔經緯度呼叫高解析度氣象 API 並顯示 5 日天氣，同時附有中央氣象署 (CWA) 山岳氣象直達連結。</li>
            </ol>
          </div>
        </div>

        {/* 4. 統計分析 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <BarChart3 size={24} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0 }}>4. 個人完登統計分析與高度折算</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**數據統計解讀**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**累計登頂海拔**：自動加總您已完登的所有山峰高度，並以趣味方式換算成「累計高度相當於攀登了多少座珠穆朗瑪峰（8848m）」，將您的汗水與成就具象化。</li>
              <li>**山脈與難度分布圖表**：以視覺化比例條展示您在各大山脈（如中央山脈、雪山山脈等）以及各難度分級的完登分布百分比，便於科學化評估與規劃下一階段的登山路線。</li>
            </ol>
          </div>
        </div>

        {/* 5. 路線守護 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <Route size={24} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0 }}>5. 路線守護與 GPX 偏移警示使用說明</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**離線防迷操作指引**（安全核心）：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**匯入航跡與開啟 GPS**：行前匯入標準 GPX 軌跡檔。抵達登山口後，開啟「GPS守護定位」並允許瀏覽器取得您的 GPS 位置。</li>
              <li>**防迷偏移警示**：當您實際行走路徑與計畫 GPX 軌跡偏離超過設定範圍（預設 50 公尺）時，瀏覽器會即時觸發語音、警報音與震動警告。</li>
            </ol>
            <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px", marginTop: "10px", borderLeft: "4px solid var(--diff-c-plus)" }}>
              ⚠️ **注意**：部分行動裝置在螢幕休眠時會限制 GPS 獲取頻率。**建議在通過危險岔路或氣候不佳時維持螢幕開啟**，或隨時點亮螢幕利用本平台作為離線地圖核對當前位置。
            </div>
          </div>
        </div>

        {/* 6. 野外求救 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <ShieldAlert size={24} style={{ color: "var(--diff-c-plus)" }} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0, color: "var(--diff-c-plus)" }}>6. 離線緊急求救與雙座標報讀</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**離線緊急求救指引**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**雙座標顯示**：迷路或受困時，點擊進入「野外求救」頁面。GPS 會離線獲取晶片資料顯示精確座標。系統會同時呈現直升機吊掛適用的 **WGS84 格式（度分秒）** 以及消防搜救小組常用的 **TWD97 二度分帶座標**。</li>
              <li>**報讀示範**：撥打 112 求救時，請清晰報讀：「**我的 WGS84 座標為：北緯 XX 度 XX 分 XX 秒，東經 XX 度 XX 分 XX 秒，誤差範圍 X 公尺**」，協助搜救人員在最短時間內精確定位。</li>
            </ol>
          </div>
        </div>

        {/* 7. 主題與備份 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <HardDrive size={24} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0 }}>7. 智慧時間感知主題與資料備份還原</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**系統功能說明**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**智慧時間感知偵測主題**：本平台的預設主題採用貼近戶外實用場景的「時間感應」機制：
                <ul style={{ paddingLeft: "20px", margin: "4px 0", listStyleType: "circle" }}>
                  <li>**白天（06:00 ～ 18:00）**：自動切換為高對比度的「山系自然風亮色主題」，便於日光下閱讀。</li>
                  <li>**夜間（18:00 ～ 06:00）**：自動切換為溫和不刺眼的「深邃星夜藍暗色主題」，保護您在山上夜登時的雙眼。</li>
                  <li>**手動控制**：可點選 Logo 旁的太陽/月亮按鈕手動鎖定；若想切回時間感應，點選下方出現的「自動」字樣即可。</li>
                </ul>
              </li>
              <li>**本地備份匯入與匯出**：所有個人打卡、文字心得、照片及匯入的 GPX 全數儲存在您的瀏覽器內部（LocalStorage 與 IndexedDB）。請定期點選側邊欄左下角的「匯出」將數據下載為 `.json` 備份；若要移轉裝置，點擊「匯入」即可無縫還原所有進度。</li>
            </ol>
          </div>
        </div>

      </div>

      {/* 專案安全、隱私與衍生費用常見問答 */}
      <div className="mist-card" style={{ padding: "24px", border: "1.5px solid var(--primary-light)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary)", marginBottom: "16px" }}>
          <HelpCircle size={24} />
          <h3 style={{ fontWeight: "800", fontSize: "1.25rem", margin: 0 }}>🔒 專案安全性、隱私與費用常見問答</h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontSize: "0.85rem", lineHeight: "1.6", color: "var(--text-main)" }}>
          
          <div>
            <h4 style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
              <HardDrive size={16} /> Q1. 使用者打開網頁後，資料儲存在哪裡？
            </h4>
            <p>
              **完全儲存在使用者自己的手機或電腦載具上**。本專案為 **Local-First (本地優先)** 架構，沒有任何雲端資料庫。
              文字與狀態記錄儲存在瀏覽器的 `LocalStorage`，大容量的登頂相片與軌跡則存於 `IndexedDB` 隔離沙盒內。任何其他人都無法取得這些隱私檔案。
            </p>
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed rgba(0,0,0,0.06)" }} />

          <div>
            <h4 style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Shield size={16} /> Q2. 專案發佈到 GitHub，任何人點擊網址就能在手機使用嗎？安全嗎？
            </h4>
            <p>
              **是的，任何人只要點擊部署後的網址即可使用**（且可以將網頁「加入主畫面」作為 PWA 離線 APP 安裝）。
              **安全性極高**。因為我們沒有後端伺服器與資料庫，表示**沒有駭客可以入侵我們的後端取得用戶資料，也沒有資料庫洩露的風險**。所有運算（包括座標轉換、GPX 偏移計算）都是在用戶的手機晶片上離線執行。
            </p>
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed rgba(0,0,0,0.06)" }} />

          <div>
            <h4 style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Info size={16} /> Q3. 本專案發佈後，會產生任何伺服器或 API 費用嗎？
            </h4>
            <p>
              **完全不需要，衍生費用為 $0 元**：
            </p>
            <ul style={{ paddingLeft: "20px", marginTop: "4px" }}>
              <li>**網站託管費用 ($0)**：使用 Vercel、GitHub Pages 或 Netlify 託管此靜態 React 網站均為永久免費。</li>
              <li>**天氣 API 費用 ($0)**：本站串接的 Open-Meteo API 對非商業用途每日提供高達 10,000 次的免費呼叫。由於 API 請求是**直接由使用者的手機瀏覽器發送**，限制是根據「個別使用者的 IP 位址」計算，而非由您的網站統一付費，因此即使有十萬人使用，您也**完全不需要支付任何費用**。</li>
              <li>**地圖圖資費用 ($0)**：使用的 Leaflet 及 OpenStreetMap (OSM) 均為免費開源圖資，沒有 Google Maps API 等昂貴的帳單費用。</li>
            </ul>
          </div>

        </div>
      </div>

      {/* GitHub / Email 聯絡區 */}
      <div className="mist-card" style={{ padding: "24px", background: "var(--primary-glow)", border: "1px solid var(--primary-light)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)", marginBottom: "12px" }}>
          <MessageSquare size={22} />
          <h3 style={{ fontWeight: "800", fontSize: "1.1rem", margin: 0 }}>🐛 功能回報與社群聯絡</h3>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.5", marginBottom: "16px" }}>
          本平台為開源公益專案，旨在維護山友登山安全。如果您在使用中發現 Bug 或有建議，歡迎隨時與我們聯絡：
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          <a
            href="mailto:begin0808@gmail.com?subject=%5B%E6%99%BA%E8%A1%8C%E7%99%BE%E5%B2%B3%20%E5%9B%9E%E5%A0%B1%5D%20%E5%8A%9F%E8%83%BD%E5%BB%BA%E8%AD%B0"
            style={{
              flex: 1,
              minWidth: "220px",
              background: "rgba(255,255,255,0.7)",
              border: "1.5px solid var(--border-glass)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              textDecoration: "none",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              fontWeight: "600",
              transition: "transform 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            <Mail size={24} style={{ color: "var(--primary-light)" }} />
            <div>
              <span style={{ display: "block", color: "var(--primary)", fontWeight: "700" }}>Email 聯絡信箱</span>
              begin0808@gmail.com
            </div>
          </a>

          <a
            href="https://github.com/begin0808/ClimbSmart/issues"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              minWidth: "220px",
              background: "rgba(255,255,255,0.7)",
              border: "1.5px solid var(--border-glass)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              textDecoration: "none",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              fontWeight: "600",
              transition: "transform 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            <GithubIcon size={24} style={{ color: "var(--primary-light)" }} />
            <div>
              <span style={{ display: "block", color: "var(--primary)", fontWeight: "700" }}>GitHub Issues 專區</span>
              begin0808/ClimbSmart
            </div>
          </a>
        </div>
      </div>
      
    </div>
  );
}
