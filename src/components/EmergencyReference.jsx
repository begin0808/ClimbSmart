import { PhoneCall, Satellite, HeartPulse, Thermometer, Activity, AlertCircle } from "lucide-react";

// 臺灣山域緊急電話（僅列出全國通用、可信的號碼，不杜撰各處專線）
const PHONES = [
  { num: "112", label: "國際緊急號碼", desc: "無自家電信訊號時，只要有任一電信訊號即可撥通（部分情況免 SIM 卡）。山區求救首選。", color: "var(--diff-c-plus)" },
  { num: "119", label: "消防／救護／山難", desc: "山難、傷病、火災救援。可同時請求消防特搜與直升機後送評估。", color: "var(--diff-c)" },
  { num: "110", label: "警察", desc: "報案、協尋、轉介搜救。", color: "var(--primary)" },
];

const FIRST_AID = [
  {
    icon: <Thermometer size={18} />, title: "失溫（低體溫症）", color: "var(--accent-sky)",
    points: [
      "辨識：輕度＝發抖、意識清醒；中重度＝停止發抖、意識混亂、步態不穩（危險）。",
      "處置：立即移除濕衣換乾衣、與地面隔絕（坐墊／背包）、軀幹核心保暖優先。",
      "意識清醒才給溫熱含糖飲；勿用力摩擦四肢、勿直接烤火。",
    ],
  },
  {
    icon: <AlertCircle size={18} />, title: "嚴重出血", color: "var(--diff-c-plus)",
    points: [
      "直接、持續加壓傷口（乾淨布料／紗布），不要一直掀開查看。",
      "傷肢可抬高至心臟以上。",
      "壓迫無法止住的大出血才使用止血帶，綁在傷口近心端並『記下上止血帶的時間』。",
    ],
  },
  {
    icon: <Activity size={18} />, title: "骨折／扭傷（RICE）", color: "var(--secondary)",
    points: [
      "固定為主、不嘗試復位；用夾板（登山杖／睡墊）固定傷處上下兩個關節。",
      "Rest 休息、Ice 冰敷、Compression 加壓包紮、Elevation 抬高。",
      "開放性骨折先覆蓋止血、勿將外露骨頭推回。",
    ],
  },
  {
    icon: <HeartPulse size={18} />, title: "心肺復甦 CPR", color: "var(--diff-c-plus)",
    points: [
      "確認無反應、無正常呼吸 → 立即胸部按壓。",
      "按壓速率 100–120 次／分、深度 5–6 公分、讓胸廓完全回彈。",
      "節奏可跟著《Stayin' Alive》哼唱；持續到傷者有反應或救援接手。",
    ],
  },
];

export default function EmergencyReference() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* 臺灣山域緊急電話 */}
      <div className="mist-card" style={{ padding: "20px" }}>
        <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
          <PhoneCall size={18} /> 臺灣山域緊急電話
        </h4>
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "12px" }}>
          點擊號碼即可直接撥號。山區優先撥 <b>112</b>（可跨電信、訊號最容易接通）。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {PHONES.map((p) => (
            <a
              key={p.num}
              href={`tel:${p.num}`}
              style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "var(--inset-bg)", borderRadius: "10px", textDecoration: "none", borderLeft: `4px solid ${p.color}` }}
            >
              <span style={{ fontSize: "1.5rem", fontWeight: "800", fontFamily: "Outfit", color: p.color, minWidth: "54px" }}>{p.num}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: "700", fontSize: "0.9rem", color: "var(--text-main)" }}>{p.label}</span>
                <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4, marginTop: "2px" }}>{p.desc}</span>
              </span>
              <PhoneCall size={16} style={{ color: p.color, flexShrink: 0 }} />
            </a>
          ))}
        </div>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "10px", lineHeight: 1.5 }}>
          💡 各國家公園管理處／林業署林管處設有專線，出發前請查詢並記入「緊急聯絡人」。
        </p>
      </div>

      {/* 手機衛星 SOS / 無訊號通訊 */}
      <div className="mist-card" style={{ padding: "20px" }}>
        <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Satellite size={18} /> 完全無訊號時的求救管道
        </h4>
        <ul style={{ fontSize: "0.8rem", color: "var(--text-main)", lineHeight: 1.7, paddingLeft: "18px", margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          <li><b>iPhone 14 以上</b>：無行動訊號時可用內建「<b>衛星 SOS</b>」傳送求救與位置（依朝向天空操作指示）。</li>
          <li><b>部分 Android</b>（如 Pixel 9 系列、新款三星）亦陸續支援衛星 SOS／訊息。</li>
          <li><b>專業裝備</b>：衛星通訊器（Garmin inReach 等）、<b>PLB 個人指位無線電示標</b>，不依賴地面基地台，是長程縱走最可靠的後援。</li>
          <li>本 App 的簡訊求救仍<b>需要行動訊號</b>；無訊號時請改用上述衛星方式，並善用聲光信號與原地待援。</li>
        </ul>
      </div>

      {/* 離線急救快速指引 */}
      <div className="mist-card" style={{ padding: "20px" }}>
        <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
          <HeartPulse size={18} /> 離線急救快速指引
        </h4>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "12px" }}>
          僅供緊急參考，非專業醫療建議；情況許可請尋求專業協助並儘速後送。
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
          {FIRST_AID.map((f) => (
            <div key={f.title} style={{ padding: "12px 14px", background: "var(--inset-bg)", borderRadius: "10px", borderTop: `3px solid ${f.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: f.color, fontWeight: "700", fontSize: "0.9rem", marginBottom: "6px" }}>
                {f.icon} {f.title}
              </div>
              <ul style={{ fontSize: "0.74rem", color: "var(--text-main)", lineHeight: 1.55, paddingLeft: "16px", margin: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
                {f.points.map((pt, i) => <li key={i}>{pt}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
