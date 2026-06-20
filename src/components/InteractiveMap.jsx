import React, { useState, useEffect, useRef, useMemo } from "react";
import { Compass, ZoomIn, ZoomOut, CheckCircle2, Circle, Eye, MapPin, Database, Trash2, DownloadCloud, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import L from "leaflet";
import { getMapTile, saveMapTile, clearMapTiles, getMapTileCount, requestPersistentStorage, getStorageEstimate } from "../utils/db";
import { createOfflineTileLayer } from "../utils/offlineTileLayer";
import RouteElevationProfile from "./RouteElevationProfile";

// Leaflet 標記自訂樣式生成 - 亮橘紅點（已爬）與珍珠白黑框點（未爬），高山地圖上對比鮮明
const createMarkerIcon = (isClimbed, difficulty) => {
  const dotColor = isClimbed ? "#f94144" : "#ffffff";
  const borderStroke = isClimbed ? "white" : "#1b4332";
  const glowShadow = isClimbed ? "box-shadow: 0 0 6px #f94144, 0 0 12px #f94144;" : "box-shadow: 0 1px 3px rgba(0,0,0,0.15);";
  const pulseClass = isClimbed ? "leaflet-marker-pulse" : "";

  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="position: relative; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">
        ${isClimbed ? `<div class="pulse-ring" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 2px solid #f94144; animation: leaflet-pulse 2s infinite ease-in-out;"></div>` : ""}
        <div class="inner-dot" style="width: 8px; height: 8px; border-radius: 50%; background-color: ${dotColor}; border: 1.5px solid ${borderStroke}; ${glowShadow}"></div>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

// ====== 主動式區域下載：Slippy Tile 數學工具 ======
const lng2tileX = (lng, z) => Math.floor(((lng + 180) / 360) * Math.pow(2, z));
const lat2tileY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * Math.pow(2, z));
};

// 依 Leaflet 相同規則組出圖磚 URL（含 {s} 子網域選擇），確保快取 key 與被動快取一致
const buildTileUrl = (template, subdomains, x, y, z) => {
  const subs = subdomains || "abc";
  const s = subs[Math.abs(x + y) % subs.length];
  return template
    .replace("{s}", s)
    .replace("{z}", z)
    .replace("{x}", x)
    .replace("{y}", y)
    .replace("{r}", "");
};

// 計算某 bounds 在 [zMin, zMax] 各縮放層級需要的所有圖磚座標
const enumerateTiles = (bounds, zMin, zMax) => {
  const tiles = [];
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const east = bounds.getEast();
  for (let z = zMin; z <= zMax; z++) {
    const xMin = lng2tileX(west, z);
    const xMax = lng2tileX(east, z);
    const yMin = lat2tileY(north, z); // 緯度越高 y 越小
    const yMax = lat2tileY(south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ x, y, z });
      }
    }
  }
  return tiles;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function InteractiveMap({ peaks, dataset, records, onOpenRecord, focusedCoords, setMapFocusedCoords }) {
  const isMini = dataset === "mini";
  const [selectedRange, setSelectedRange] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // 被聚焦/定位的百岳狀態
  const [focusedPeakId, setFocusedPeakId] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isProfileCollapsed, setIsProfileCollapsed] = useState(() => window.innerWidth < 768);
  const hoverMarkerRef = useRef(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const tempMarkerRef = useRef(null);
  const activeLayerRef = useRef(null); // 目前使用中的底圖層（供區域下載取得 URL 模板）

  const [cacheCount, setCacheCount] = useState(0);

  const focusedPeakRecord = useMemo(() => {
    return focusedPeakId ? records[focusedPeakId] : null;
  }, [focusedPeakId, records]);

  const focusedPeakName = useMemo(() => {
    const peak = peaks.find((p) => p.id === focusedPeakId);
    return peak ? peak.name : "";
  }, [peaks, focusedPeakId]);

  // 主動式區域下載狀態
  const [detailExtra, setDetailExtra] = useState(2); // 在目前縮放層級之上額外下載幾層細節
  const [download, setDownload] = useState({ active: false, total: 0, done: 0, failed: 0, cancelled: false });
  const downloadCancelRef = useRef(false);

  // 山脈/地區選項（依資料集動態）
  const rangeOptions = useMemo(() => [...new Set(peaks.map((p) => p.range))], [peaks]);

  // 切換資料集時重置篩選，避免套用到不存在的山脈/地區
  useEffect(() => {
    setSelectedRange("all");
    setSelectedDifficulty("all");
    setFocusedPeakId(null);
    setHoveredIndex(null);
  }, [dataset]);

  const updateCacheCount = async () => {
    const count = await getMapTileCount();
    setCacheCount(count);
  };

  // 持久化儲存狀態（快取是否受系統保護、目前用量）
  const [persisted, setPersisted] = useState(null); // null=未知, true=已受保護, false=未保護
  const [usageMB, setUsageMB] = useState(null);
  const refreshStorage = async () => {
    try {
      if (navigator.storage && navigator.storage.persisted) {
        setPersisted(await navigator.storage.persisted());
      }
    } catch { /* 略 */ }
    const est = await getStorageEstimate();
    if (est) setUsageMB(Math.round((est.usage || 0) / 1048576));
  };
  // 使用者手勢觸發鎖定（核准率較分頁自動請求高）
  const handleLockStorage = async () => {
    await requestPersistentStorage();
    await refreshStorage();
  };

  const updateCacheCountRef = useRef(updateCacheCount);
  useEffect(() => {
    updateCacheCountRef.current = updateCacheCount;
  }, [updateCacheCount]);

  useEffect(() => {
    updateCacheCount();
    refreshStorage();
  }, []);

  const handleClearCache = async () => {
    const success = await clearMapTiles();
    if (success) {
      setCacheCount(0);
      alert("離線地圖快取已清空！");
      refreshStorage();
    }
  };

  // 計算目前畫面 + 選定細節層級會下載的圖磚範圍
  const getDownloadPlan = () => {
    const map = mapInstanceRef.current;
    if (!map) return null;
    const baseZoom = Math.round(map.getZoom());
    const zMax = Math.min(15, baseZoom + detailExtra); // 不超過地圖 maxZoom
    const zMin = baseZoom;
    const tiles = enumerateTiles(map.getBounds(), zMin, zMax);
    return { tiles, zMin, zMax };
  };

  // 主動式下載目前可視範圍的離線地圖圖磚
  const handleDownloadRegion = async () => {
    const map = mapInstanceRef.current;
    const layer = activeLayerRef.current;
    if (!map || !layer) return;

    const plan = getDownloadPlan();
    if (!plan || plan.tiles.length === 0) return;
    const { tiles, zMin, zMax } = plan;

    // 圖磚伺服器（OSM / OpenTopoMap）對大量下載有使用限制，超量時提醒
    if (tiles.length > 2500) {
      const ok = window.confirm(
        `預計下載 ${tiles.length} 張圖磚（縮放 ${zMin}–${zMax}）。\n數量較多會較慢，且公用圖磚伺服器禁止大量抓取。\n建議先放大地圖縮小範圍，或降低細節層級。\n\n仍要繼續嗎？`
      );
      if (!ok) return;
    }

    const template = layer._url;
    const subdomains = layer.options.subdomains || "abc";

    // 下載前先請求持久化儲存（此處由使用者點擊觸發，核准率較高），保護即將下載的圖磚
    await requestPersistentStorage();

    downloadCancelRef.current = false;
    setDownload({ active: true, total: tiles.length, done: 0, failed: 0, cancelled: false });

    let done = 0;
    let failed = 0;
    const queue = tiles.slice();

    const worker = async () => {
      while (queue.length > 0 && !downloadCancelRef.current) {
        const t = queue.shift();
        const url = buildTileUrl(template, subdomains, t.x, t.y, t.z);
        try {
          const existing = await getMapTile(url);
          if (!existing) {
            const res = await fetch(url);
            if (res.ok) {
              const blob = await res.blob();
              await saveMapTile(url, blob);
            } else {
              failed++;
            }
            await sleep(60); // 禮貌節流：僅在實際對外下載時延遲
          }
        } catch {
          failed++;
        }
        done++;
        if (done % 5 === 0 || done === tiles.length) {
          setDownload((d) => ({ ...d, done, failed }));
        }
      }
    };

    const POOL = 4; // 限制並行數，避免觸發伺服器限制
    await Promise.all(Array.from({ length: POOL }, () => worker()));

    setDownload((d) => ({ ...d, active: false, done, failed, cancelled: downloadCancelRef.current }));
    updateCacheCount();
    refreshStorage();
  };

  const handleCancelDownload = () => {
    downloadCancelRef.current = true;
  };

  // 處理跨分頁航點聚焦定位
  useEffect(() => {
    if (focusedCoords && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const { lat, lng, name, elevation } = focusedCoords;

      // 移除舊的暫時標記
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
      }

      // 建立新的暫時標記（高對比橘黃色）
      const tempIcon = L.divIcon({
        className: "custom-temp-marker",
        html: `
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
            <div class="pulse-ring" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 3px solid #f39c12; animation: locator-pulse 1.5s infinite ease-in-out;"></div>
            <div style="width: 14px; height: 14px; border-radius: 50%; background-color: #f39c12; border: 2px solid white; box-shadow: 0 0 6px #f39c12;"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const tempMarker = L.marker([lat, lng], { icon: tempIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: var(--font-family); padding: 4px; line-height: 1.4;">
            <div style="font-weight: 700; color: #d35400;">📍 規劃路線地標：${name}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">海拔高度：${elevation}m</div>
          </div>
        `)
        .openPopup();

      tempMarkerRef.current = tempMarker;

      // 平滑飛越
      map.setView([lat, lng], 13, {
        animate: true,
        duration: 1.2
      });

      // 飛越完成後清空 App.jsx 的狀態
      setMapFocusedCoords(null);
    }
  }, [focusedCoords, setMapFocusedCoords]);

  // 1. 篩選百岳數據
  const mapPeaks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return peaks.filter((p) => {
      const matchRange = selectedRange === "all" || p.range === selectedRange;
      const matchDifficulty = selectedDifficulty === "all" || p.difficulty === selectedDifficulty;
      
      const isClimbed = !!records[p.id];
      const matchStatus =
        selectedStatus === "all" ||
        (selectedStatus === "done" && isClimbed) ||
        (selectedStatus === "todo" && !isClimbed);

      let matchSearch = true;
      if (query) {
        const peakIdStr = String(p.id);
        const peakIdPadded = peakIdStr.padStart(3, "0");
        matchSearch =
          p.name.toLowerCase().includes(query) ||
          peakIdStr.includes(query) ||
          peakIdPadded.includes(query) ||
          p.range.toLowerCase().includes(query) ||
          (p.group && p.group.toLowerCase().includes(query)) ||
          p.county.toLowerCase().includes(query);
      }

      return matchRange && matchDifficulty && matchStatus && matchSearch;
    });
  }, [peaks, records, selectedRange, selectedDifficulty, selectedStatus, searchQuery]);

  // 2. 初始化 Leaflet 地圖
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      const map = L.map(mapRef.current, {
        center: [23.75, 121.0],
        zoom: 8,
        minZoom: 7,
        maxZoom: 15,
        zoomControl: false
      });

      mapInstanceRef.current = map;

      // 移除 Leaflet 自我宣傳前綴（保留各圖層的資料來源版權標示即可）
      map.attributionControl.setPrefix(false);

      // 圖層 A: OpenTopoMap
      const topoTiles = createOfflineTileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        attribution: "Map style: &copy; OpenTopoMap (CC-BY-SA) | Map data: &copy; OSM contributors",
        className: "map-tile-invertible",
        onTileCached: () => {
          if (updateCacheCountRef.current) {
            updateCacheCountRef.current();
          }
        }
      });

      // 圖層 B: OpenStreetMap
      const osmTiles = createOfflineTileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
        className: "map-tile-invertible",
        onTileCached: () => {
          if (updateCacheCountRef.current) {
            updateCacheCountRef.current();
          }
        }
      });

      // 圖層 C: 臺灣登山魯地圖
      const rudyTiles = createOfflineTileLayer("https://tile.happyman.idv.tw/map/moi_osm/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "Rudy Map &copy; 魯地圖登山開源社群",
        className: "map-tile-invertible",
        onTileCached: () => {
          if (updateCacheCountRef.current) {
            updateCacheCountRef.current();
          }
        }
      });

      // 圖層 D: 國土測繪中心 官方通用版電子地圖（NLSC，官方維運最穩定）
      const nlscTiles = createOfflineTileLayer("https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution: "&copy; 內政部國土測繪中心 NLSC",
        className: "map-tile-invertible",
        onTileCached: () => {
          if (updateCacheCountRef.current) {
            updateCacheCountRef.current();
          }
        }
      });

      // 圖層 E: 衛星影像圖
      const satelliteTiles = createOfflineTileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, and the GIS User Community",
        onTileCached: () => {
          if (updateCacheCountRef.current) {
            updateCacheCountRef.current();
          }
        }
      });

      topoTiles.addTo(map);
      activeLayerRef.current = topoTiles;

      // 追蹤使用者切換底圖，讓區域下載使用正確的 URL 模板
      map.on("baselayerchange", (e) => {
        activeLayerRef.current = e.layer;
      });

      const baseMaps = {
        "地形等高線圖": topoTiles,
        "標準道路地圖": osmTiles,
        "國土測繪電子地圖": nlscTiles,
        "衛星影像地圖": satelliteTiles,
        "臺灣登山魯地圖": rudyTiles
      };
      L.control.layers(baseMaps, null, { position: "topleft" }).addTo(map);
      L.control.zoom({ position: "topright" }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ====== 處理剖面圖 Hover 的 Pulsing Marker 連動 ======
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.remove();
      hoverMarkerRef.current = null;
    }

    if (hoveredIndex !== null && focusedPeakRecord && focusedPeakRecord.gpxTrack && focusedPeakRecord.gpxTrack[hoveredIndex]) {
      const pt = focusedPeakRecord.gpxTrack[hoveredIndex];
      
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
  }, [hoveredIndex, focusedPeakRecord]);

  // ====== 當地圖容器大小因剖面圖展開/收合改變時，重新計算地圖尺寸 ======
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isProfileCollapsed, focusedPeakRecord]);

  // 3. 當百岳資料、完登狀態、聚焦山頭或篩選器改變時，重新繪製標記與軌跡
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    markersLayer.clearLayers(); // 清空舊標記

    mapPeaks.forEach((peak) => {
      const record = records[peak.id];
      const isClimbed = !!record;
      const isFocused = peak.id === focusedPeakId;

      // 繪製定位器 (Locator Ring)
      if (isFocused) {
        const locatorIcon = L.divIcon({
          className: "custom-leaflet-locator",
          html: `
            <div style="width: 32px; height: 32px; border-radius: 50%; border: 3px double #0077b6; background: rgba(0, 119, 182, 0.2); display: flex; align-items: center; justify-content: center; animation: locator-pulse 1.5s infinite ease-in-out;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #0077b6;"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        const locatorMarker = L.marker([peak.lat, peak.lng], { icon: locatorIcon });
        locatorMarker.addTo(markersLayer);

        // 如果該山峰有匯入 GPX 軌跡，則在此時繪製路線軌跡，並自動縮放到路線範圍
        if (record?.gpxTrack && record.gpxTrack.length > 0) {
          const polyline = L.polyline(record.gpxTrack, {
            color: "#0077b6",
            weight: 4,
            opacity: 0.85,
            lineJoin: "round"
          });
          polyline.addTo(markersLayer);

          // 雙向連動：滑鼠滑過地圖上的軌跡線時，尋找最近點以同步高度圖
          polyline.on("mousemove", (e) => {
            const mouseLatLng = e.latlng;
            let minDist = Infinity;
            let closestIdx = 0;

            record.gpxTrack.forEach((pt, idx) => {
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
          
          // 自動縮放到軌跡範圍
          try {
            map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 14 });
          } catch (e) {
            console.error("Fit bounds failed", e);
          }
        }
      }

      // 繪製百岳核心點
      const icon = createMarkerIcon(isClimbed, peak.difficulty);
      const marker = L.marker([peak.lat, peak.lng], { icon });

      // 綁定精美的懸浮 Tooltip
      marker.bindTooltip(`
        <div style="font-family: var(--font-family); padding: 4px 6px; line-height: 1.4;">
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); display: flex; align-items: center; gap: 6px;">
            #${String(peak.num || peak.id).padStart(3, "0")} ${peak.name}
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--secondary); font-family: Outfit;">${peak.elevation}m</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
            ${peak.range} &bull; ${peak.difficulty}級 &bull; ${peak.county}
          </div>
          ${peak.group ? `<div style="font-size: 0.7rem; color: var(--secondary); font-weight: 600; margin-top: 2px;">${peak.group}</div>` : ""}
          ${isClimbed ? `<div style="color: #f94144; font-size: 0.75rem; font-weight: 700; margin-top: 4px; display: flex; align-items: center; gap: 2px;">✓ ${record.date} 已完登</div>` : ""}
          ${isClimbed && record?.gpxTrack ? `<div style="color: #0077b6; font-size: 0.7rem; font-weight: 700; margin-top: 2px;">📍 內含已匯入 GPX 軌跡</div>` : ""}
          <div style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.7; margin-top: 4px; border-top: 1px dashed rgba(0,0,0,0.06); padding-top: 4px;">點擊開啟山峰百科與紀錄</div>
        </div>
      `, {
        direction: "top",
        offset: [0, -5],
        opacity: 0.96
      });

      // 點擊事件
      marker.on("click", () => {
        setFocusedPeakId(peak.id);
        onOpenRecord(peak);
      });

      marker.addTo(markersLayer);
    });
  }, [mapPeaks, records, focusedPeakId, onOpenRecord]);

  // 4. 地圖飛越定位
  const handleFlyToPeak = (peak) => {
    setFocusedPeakId(peak.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([peak.lat, peak.lng], 12, {
        animate: true,
        duration: 1.2
      });
    }
  };

  return (
    <div style={{ flex: 1, padding: "24px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 篩選面板 */}
      <div
        className="mist-card"
        style={{
          padding: "16px 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Compass size={20} style={{ color: "var(--primary-light)" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--primary)" }}>{isMini ? "臺灣小百岳等高線地形圖" : "臺灣百岳等高線地形圖"}</h3>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="搜尋名稱、編號或地區..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-glass)",
              background: "rgba(255, 255, 255, 0.7)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              width: "180px",
              outline: "none"
            }}
          />
          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-glass)",
              background: "rgba(255, 255, 255, 0.7)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            <option value="all">{isMini ? "所有地區" : "所有山脈"}</option>
            {rangeOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-glass)",
              background: "rgba(255, 255, 255, 0.7)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            <option value="all">所有難度</option>
            <option value="A">A 級 (入門)</option>
            <option value="B">B 級 (中階)</option>
            <option value="C">C 級 (挑戰)</option>
            <option value="C+">C+ 級 (特殊)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-glass)",
              background: "rgba(255, 255, 255, 0.7)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            <option value="all">所有完登狀態</option>
            <option value="done">已完登</option>
            <option value="todo">未完登</option>
          </select>
        </div>
      </div>

      {/* 地圖與側邊欄排版 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          alignItems: "stretch"
        }}
      >
        {/* Leaflet 地圖容器 */}
        <div
          className="mist-card"
          style={{
            height: "580px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            zIndex: 1
          }}
        >
          <div
            ref={mapRef}
            style={{
              width: "100%",
              height: focusedPeakRecord?.gpxTrack?.length > 0 
                ? (isProfileCollapsed ? "530px" : "380px") 
                : "580px",
              transition: "height 0.3s ease",
              flexShrink: 0
            }}
          />

          {/* 高度剖面面板 */}
          {focusedPeakRecord?.gpxTrack && focusedPeakRecord.gpxTrack.length > 0 && (
            <div
              style={{
                borderTop: "1.5px solid var(--border-glass)",
                padding: isProfileCollapsed ? "8px 16px" : "12px 16px",
                background: "var(--inset-bg)",
                display: "flex",
                flexDirection: "column",
                gap: isProfileCollapsed ? "0px" : "8px",
                flex: 1,
                overflow: "hidden",
                boxSizing: "border-box"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-main)" }}>
                    ⛰️ {focusedPeakName} 路線高度剖面
                  </span>
                  <span style={{ fontSize: "0.68rem", background: "rgba(0,119,182,0.12)", color: "#0077b6", padding: "1px 5px", borderRadius: "3px", fontWeight: "600" }}>
                    GPX 軌跡連動
                  </span>
                </div>
                <button
                  onClick={() => setIsProfileCollapsed(!isProfileCollapsed)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary-light)",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    padding: "2px 6px",
                    borderRadius: "4px"
                  }}
                  className="eye-btn"
                >
                  {isProfileCollapsed ? (
                    <>展開剖面圖 <ChevronDown size={14} /></>
                  ) : (
                    <>收合剖面圖 <ChevronUp size={14} /></>
                  )}
                </button>
              </div>
              {!isProfileCollapsed && (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <RouteElevationProfile
                    points={focusedPeakRecord.gpxTrack}
                    hoveredIndex={hoveredIndex}
                    onHoverPointChange={(idx) => setHoveredIndex(idx)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 側邊圖例與山岳列表 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* 圖例說明 */}
          <div className="mist-card" style={{ padding: "20px" }}>
            <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "12px" }}>地圖功能與圖例</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f94144", border: "2px solid white", boxShadow: "0 0 6px #f94144" }} />
                <span>已完登百岳（紅色發光點與漣漪）</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ffffff", border: "1.5px solid #1b4332", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                <span>未完登百岳（高對比珍珠白黑邊點）</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: "2px double #0077b6", background: "rgba(0,119,182,0.1)" }} />
                <span>點選聚焦百岳的定位雷達圈</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "20px", height: "3px", background: "#0077b6" }} />
                <span>已上傳之 GPX 路線軌跡線</span>
              </div>
            </div>
          </div>

          {/* 離線地圖快取管理 */}
          <div className="mist-card" style={{ padding: "20px" }}>
            <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Database size={18} style={{ color: "var(--primary-light)" }} />
              離線地圖快取管理
            </h4>
            <div style={{ fontSize: "0.85rem", color: "var(--text-main)", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>已下載圖磚：</span>
                <span style={{ fontWeight: "700", color: "var(--primary)", fontFamily: "Outfit", fontSize: "1rem" }}>
                  {cacheCount} 張
                </span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
                有網路時瀏覽過的區域會自動快取為 Blob，可在山區完全無網時離線讀取地形圖。
              </p>

              {/* ===== 持久化儲存狀態 ===== */}
              <div style={{ borderTop: "1px dashed var(--inset-border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: "700", color: persisted ? "var(--success)" : persisted === false ? "var(--diff-c-plus)" : "var(--text-muted)" }}>
                    {persisted === null ? "儲存保護：檢查中…" : persisted ? "🔒 離線快取已受保護" : "⚠️ 快取未受保護"}
                  </span>
                  {usageMB != null && <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "Outfit" }}>已用 {usageMB} MB</span>}
                </div>
                {persisted === false && (
                  <>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                      在瀏覽器分頁中，系統空間不足或重開機時可能自動清除離線地圖。請點下方鎖定；或用瀏覽器「<b>加入主畫面</b>」安裝成 App 後再下載，保護最完整。
                    </p>
                    <button onClick={handleLockStorage} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid var(--primary)", background: "transparent", color: "var(--primary)", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}>
                      🔒 鎖定離線快取（防止被系統清除）
                    </button>
                  </>
                )}
                {persisted === true && (
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                    系統已承諾不會自動清除你的離線資料（除非你手動清除或解除安裝 App）。
                  </p>
                )}
              </div>

              {/* ===== 主動式區域下載 ===== */}
              <div style={{ borderTop: "1px dashed var(--inset-border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontWeight: "700", color: "var(--primary)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                  <DownloadCloud size={15} /> 預先下載目前範圍
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
                  把地圖移動/縮放到要去的路線範圍，先下載起來，山上無網也能用。
                </p>

                {/* 細節層級 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-main)" }}>細節層級</span>
                  <select
                    value={detailExtra}
                    onChange={(e) => setDetailExtra(Number(e.target.value))}
                    disabled={download.active}
                    style={{ padding: "6px 10px", borderRadius: "8px", border: "1.5px solid var(--border-glass)", background: "var(--surface-solid)", color: "var(--text-main)", fontSize: "0.78rem", cursor: "pointer" }}
                  >
                    <option value={1}>省流量（+1 層）</option>
                    <option value={2}>標準（+2 層）</option>
                    <option value={3}>高細節（+3 層）</option>
                  </select>
                </div>

                {download.active ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: "600", color: "var(--text-main)" }}>
                      <span>下載中…</span>
                      <span style={{ fontFamily: "Outfit", color: "var(--primary)" }}>
                        {download.done} / {download.total}
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "var(--inset-bg-strong)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${download.total ? Math.round((download.done / download.total) * 100) : 0}%`, background: "var(--primary-light)", borderRadius: "4px", transition: "width 0.3s ease" }} />
                    </div>
                    <button
                      onClick={handleCancelDownload}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid var(--diff-c-plus)", background: "transparent", color: "var(--diff-c-plus)", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}
                    >
                      <XCircle size={14} /> 取消下載
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDownloadRegion}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px 12px", borderRadius: "8px", border: "none", background: "var(--primary)", color: "white", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}
                    className="btn-hover-effect"
                  >
                    <DownloadCloud size={14} /> 下載目前畫面範圍
                  </button>
                )}

                {!download.active && download.total > 0 && (
                  <div style={{ fontSize: "0.72rem", color: download.cancelled ? "var(--secondary)" : "var(--success)", fontWeight: "600" }}>
                    {download.cancelled
                      ? `已取消，完成 ${download.done} / ${download.total} 張`
                      : `✓ 完成！下載 ${download.total} 張${download.failed > 0 ? `（${download.failed} 張失敗）` : ""}`}
                  </div>
                )}
              </div>

              <button
                onClick={handleClearCache}
                disabled={cacheCount === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: cacheCount === 0 ? "rgba(0,0,0,0.05)" : "var(--primary)",
                  color: cacheCount === 0 ? "var(--text-muted)" : "white",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  cursor: cacheCount === 0 ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease"
                }}
                className={cacheCount === 0 ? "" : "btn-hover-effect"}
              >
                <Trash2 size={14} />
                清空快取地圖
              </button>
            </div>
          </div>

          {/* 目前過濾出的百岳列表（支援地圖飛越定位與點開） */}
          <div className="mist-card" style={{ padding: "20px", display: "flex", flexDirection: "column", flex: 1, maxHeight: "380px" }}>
            <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--primary)", marginBottom: "8px" }}>
              目前篩選山峰 ({mapPeaks.length})
            </h4>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "12px" }}>
              點擊項目可<b>快速飛越定位與繪製軌跡</b>，點擊右方 <Eye size={12} style={{ display: "inline" }} /> 編輯。
            </p>
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              {mapPeaks.map((peak) => {
                const record = records[peak.id];
                const isClimbed = !!record;
                const isFocused = peak.id === focusedPeakId;

                return (
                  <div
                    key={peak.id}
                    onClick={() => handleFlyToPeak(peak)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: isFocused 
                        ? "rgba(0, 119, 182, 0.08)" 
                        : isClimbed 
                          ? "rgba(249, 65, 68, 0.04)" 
                          : "rgba(0,0,0,0.02)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      transition: "all 0.15s ease",
                      border: isFocused ? "1px solid #0077b6" : "1px solid transparent"
                    }}
                    className="map-list-item"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {isClimbed ? (
                        <CheckCircle2 size={14} style={{ color: "#f94144" }} />
                      ) : (
                        <Circle size={14} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
                      )}
                      <span style={{ fontWeight: "700", color: "var(--text-main)", fontFamily: "Outfit", fontSize: "0.8rem", opacity: 0.75 }}>
                        #{String(peak.num || peak.id).padStart(3, "0")}
                      </span>
                      <span style={{ fontWeight: "700", color: "var(--text-main)" }}>{peak.name}</span>
                      {isClimbed && record.gpxTrack && (
                        <span style={{ fontSize: "0.65rem", background: "rgba(0,119,182,0.15)", color: "#0077b6", padding: "1px 4px", borderRadius: "3px", fontWeight: "600" }}>
                          GPX
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontFamily: "Outfit", fontSize: "0.8rem", color: isClimbed ? "#f94144" : "var(--primary-light)", fontWeight: "700" }}>
                        {peak.elevation}m
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRecord(peak);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                          padding: "2px"
                        }}
                        className="eye-btn"
                        title="查看百科與編輯紀錄"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SVG & Leaflet 動畫樣式注入 */}
      <style>{`
        /* 避免地圖氣泡樣式衝突 */
        .leaflet-tooltip {
          background: rgba(255, 255, 255, 0.96) !important;
          border: 1px solid var(--primary-light) !important;
          box-shadow: 0 4px 16px rgba(45, 90, 39, 0.15) !important;
          border-radius: 8px !important;
          padding: 6px 10px !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: var(--primary-light) !important;
        }

        /* 已完登標記波動發光 */
        @keyframes leaflet-pulse {
          0% {
            transform: scale(0.9);
            opacity: 0.85;
          }
          60% {
            transform: scale(2.2);
            opacity: 0;
          }
          100% {
            transform: scale(0.9);
            opacity: 0;
          }
        }

        /* 點選聚焦標記波動發光 */
        @keyframes locator-pulse {
          0% {
            transform: scale(0.85);
            opacity: 1;
            box-shadow: 0 0 0 0px rgba(0, 119, 182, 0.4);
          }
          70% {
            transform: scale(1.05);
            opacity: 0.9;
            box-shadow: 0 0 0 10px rgba(0, 119, 182, 0);
          }
          100% {
            transform: scale(0.85);
            opacity: 1;
            box-shadow: 0 0 0 0px rgba(0, 119, 182, 0.4);
          }
        }
        
        .map-list-item:hover {
          background: rgba(45,90,39,0.06) !important;
          border-color: var(--primary-light) !important;
        }
        .eye-btn:hover {
          color: var(--primary-light) !important;
        }
      `}</style>
    </div>
  );
}
