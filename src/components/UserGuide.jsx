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
        
        {/* 1. 百岳儀表板 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <LayoutDashboard size={24} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0 }}>1. 完登記錄儀表板使用細則</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**操作步驟**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**完登打卡與上傳照片**：滑鼠點擊任意山峰卡片（或勾選核取方塊）將開啟編輯彈窗。您可以選擇登頂日期，並在「登頂照片」區塊拖放或選取您的登頂照。</li>
              <li>**圖片本地壓縮**：為避免瀏覽器快取儲存空間限制，系統在您選取相片時會自動進行高畫質本地壓縮，隨後轉為 Base64 編碼，寫入瀏覽器的本機 `IndexedDB` 資料庫。</li>
              <li>**搜尋與篩選**：您可以在上方搜尋框輸入「山名」、「高度」或「縣市」（如輸入「南投」可找出所有在南投的山峰）。右方則提供「山脈/地區」、「難度等級 (A/B/C/C+)」與「完登狀態」三合一篩選。</li>
            </ol>
            <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px", marginTop: "10px", borderLeft: "4px solid var(--secondary)" }}>
              📌 **備份重要性**：由於資料完全儲存在您的瀏覽器內部快取。若使用系統優化軟體清理瀏覽器，或更換手機，資料將會遺失。請定期點選側邊欄最下方的 **「匯出」** 按鈕，下載您的 `.json` 紀錄檔案妥善保存；需要還原時，點選 **「匯入」** 即可。
            </div>
          </div>
        </div>

        {/* 2. 互動式地圖 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <Map size={24} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0 }}>2. 等高線互動式地圖操作</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**操作步驟與特色**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**平滑定位（FlyTo）**：在地圖右上角或左側欄切換百岳／小百岳。點選地圖上的藍色（百岳）或綠色（小百岳）圖標，會彈出該山峰的高度與難度資訊，點選彈窗中的「完登紀錄」可直接進行編輯。</li>
              <li>**跨分頁飛越定位**：當您在首頁儀表板點選山峰卡片中的 **「MapPin」定位圖示** 時，系統會自動平滑切換至地圖分頁，並以 3D 動態飛越至該座標，讓您一眼看清該山峰的地形位置。</li>
              <li>**圖層變更**：點選地圖右上角圖層按鈕，可切換「地形等高線圖（特別適合登山判讀）」、「標準街道圖」與「衛星影像圖」。</li>
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
            <p>**操作步驟與科學指標**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**極限負重試算**：點選上方路線按鈕（如：玉山兩天一夜），系統會載入官方建議裝備範本。勾選已打包項目，配重條會即時更新。</li>
              <li>**基礎重量 (Base Weight)**：背包內「排除消耗品（水、食物、瓦斯）」後的總重量。國際輕量化指標建議多日行程應控制在 **6 至 8 公斤**以內，系統若偵測超重會顯示紅色「⚠️ 超出負擔」警告。</li>
              <li>**高山天氣點位切換**：在右側天氣預報卡片中，您可以透過下拉選單選擇「該路線上的不同Waypoint」（例如玉山路線可看「塔塔加登山口」、「排雲山莊」、「玉山主峰頂」），系統會依據其精確海拔與座標重新發送 Open-Meteo API 查詢氣溫與降雨機率，並獨立快取。</li>
              <li>**氣象署連結**：點選右側的「CWA 氣象署山岳氣象」，可直達中央氣象署的專業氣象警報頁面，雙重確認是否有豪雨特報。</li>
            </ol>
          </div>
        </div>

        {/* 5. 路線守護 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <Route size={24} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0 }}>4. 路線守護與 GPX 偏移警示使用說明</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**離線防迷操作指引**（極為重要）：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**行前匯入**：在有網路的環境下，點擊「選擇 GPX 檔案」載入目標山區軌跡，頁面會隨即繪製該路線的距離海拔剖面圖。</li>
              <li>**山區開啟**：抵達登山口後，點擊 **「開啟 GPS 守護定位」**。瀏覽器會向您索取定位權限，請務必選擇「永遠允許」。</li>
              <li>**偏移偵測**：當您實際走偏並距離計畫軌跡超出安全距離（預設為 50 公尺，可手動調整）時，手機會發出警示嗶嗶聲與網頁震動。</li>
            </ol>
            <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px", marginTop: "10px", borderLeft: "4px solid var(--diff-c-plus)" }}>
              ⚠️ **注意**：部分行動裝置（如 iOS Safari）在螢幕休眠時，會限制瀏覽器的 GPS 定位頻率以省電。**建議在通過複雜岔路或氣候惡劣時，將手機螢幕維持開啟**，或使用本平台作為離線地圖位置核對工具。
            </div>
          </div>
        </div>

        {/* 6. 野外求救 */}
        <div className="mist-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary-light)", marginBottom: "14px" }}>
            <ShieldAlert size={24} style={{ color: "var(--diff-c-plus)" }} />
            <h3 style={{ fontWeight: "800", fontSize: "1.2rem", margin: 0, color: "var(--diff-c-plus)" }}>5. 離線緊急求救與座標報讀</h3>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: "1.6" }}>
            <p>**離線緊急避險指南**：</p>
            <ol style={{ paddingLeft: "20px", margin: "8px 0" }}>
              <li>**座標生成**：在迷路或遭遇山難時，請儘量移至空曠、無樹冠遮擋的高處。開啟本分頁，GPS 會離線讀取晶片數據，即時顯示您的座標。</li>
              <li>**WGS84 格式**：即一般的度分秒格式（如 `23°28'13"N, 120°57'27"E`），適合報讀給直升機搜救隊。</li>
              <li>**TWD97 橫軸墨卡托二度分帶座標**：顯示為 6 位與 7 位數字（如 `X: 242850, Y: 2596950`），此格式不受山區地形偏角干擾，是地面消防搜救小組定位最精準的格式。</li>
              <li>**報讀範例**：若撥打 112 求救電話，請以電話通訊清楚報讀：「**我的 WGS84 座標為：北緯23度28分13秒，東經120度57分27秒，誤差範圍 X 公尺**」。</li>
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
