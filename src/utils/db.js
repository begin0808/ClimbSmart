// IndexedDB 名稱與設定
const DB_NAME = "TW100PeaksDB";
const STORE_NAME = "peak_photos";
const DB_VERSION = 1;

// 初始化 IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// 寫入照片
export async function savePhoto(peakId, base64Data) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(base64Data, peakId);

    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(e.target.error);
  });
}

// 取得照片
export async function getPhoto(peakId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(peakId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

// 刪除照片
export async function deletePhoto(peakId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(peakId);

    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(e.target.error);
  });
}

// 獲取所有照片（備份用）
export async function getAllPhotos() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    const photos = {};

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        photos[cursor.key] = cursor.value;
        cursor.continue();
      } else {
        resolve(photos);
      }
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

// 批量寫入照片（匯入備份用）
export async function importPhotos(photosMap) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // 清空現有照片
    store.clear();

    const keys = Object.keys(photosMap);
    if (keys.length === 0) {
      resolve(true);
      return;
    }

    let completed = 0;
    let failed = false;

    keys.forEach((key) => {
      const peakId = parseInt(key, 10);
      const request = store.put(photosMap[key], peakId);

      request.onsuccess = () => {
        completed++;
        if (completed === keys.length && !failed) {
          resolve(true);
        }
      };

      request.onerror = (e) => {
        failed = true;
        reject(e.target.error);
      };
    });
  });
}

// ----------------------------------------------------
// LocalStorage 部分（儲存文字紀錄與裝備清單）
// ----------------------------------------------------

const KEY_RECORDS = "tw100peaks_records";
const KEY_GEAR_PLANS = "tw100peaks_gear_plans";

// 讀取完登紀錄
export function loadRecords() {
  try {
    const data = localStorage.getItem(KEY_RECORDS);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Failed to load records:", e);
    return {};
  }
}

// 儲存完登紀錄
export function saveRecord(peakId, recordData, gpxTrack = null) {
  const records = loadRecords();
  if (!recordData) {
    delete records[peakId];
  } else {
    records[peakId] = {
      date: recordData.date || "",
      note: recordData.note || "",
      gpxTrack: gpxTrack || records[peakId]?.gpxTrack || null
    };
  }
  localStorage.setItem(KEY_RECORDS, JSON.stringify(records));
}

// 解析 GPX 軌跡 XML 檔案並進行抽稀點位，以符合 localStorage 大小限制
export function parseGPX(gpxString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxString, "application/xml");
    
    // 檢查 XML 語法錯誤
    const parseError = xmlDoc.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      throw new Error("Invalid XML format");
    }

    const trkpts = xmlDoc.getElementsByTagName("trkpt");
    const points = [];

    for (let i = 0; i < trkpts.length; i++) {
      const lat = parseFloat(trkpts[i].getAttribute("lat"));
      const lon = parseFloat(trkpts[i].getAttribute("lon"));
      if (!isNaN(lat) && !isNaN(lon)) {
        points.push([lat, lon]);
      }
    }

    // 抽稀點位：如果點位超過 300 個點，進行等距抽樣以維持效能與 localStorage 限制
    const maxPoints = 300;
    if (points.length > maxPoints) {
      const step = Math.ceil(points.length / maxPoints);
      const decimated = [];
      for (let i = 0; i < points.length; i += step) {
        decimated.push(points[i]);
      }
      return decimated;
    }

    return points;
  } catch (e) {
    console.error("GPX 解析失敗:", e);
    throw e;
  }
}

// 讀取裝備清單
export function loadGearPlans() {
  try {
    const data = localStorage.getItem(KEY_GEAR_PLANS);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Failed to load gear plans:", e);
    return {};
  }
}

// 儲存某條路線的裝備清單
export function saveGearPlan(routeId, planData) {
  const plans = loadGearPlans();
  plans[routeId] = planData;
  localStorage.setItem(KEY_GEAR_PLANS, JSON.stringify(plans));
}

// ----------------------------------------------------
// 匯出 / 匯入 備份檔案
// ----------------------------------------------------

// 匯出全站 JSON 檔案
export async function exportAllData() {
  const records = loadRecords();
  const gearPlans = loadGearPlans();
  const photos = await getAllPhotos();

  const backupData = {
    version: 1,
    exportDate: new Date().toISOString(),
    records,
    gearPlans,
    photos,
  };

  const blob = new Blob([JSON.stringify(backupData)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `tw100peaks_backup_${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 匯入全站 JSON 檔案
export async function importAllData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version || !data.records) {
      throw new Error("Invalid backup file format");
    }

    // 匯入 records 到 localStorage
    localStorage.setItem(KEY_RECORDS, JSON.stringify(data.records));

    // 匯入 gearPlans 到 localStorage
    if (data.gearPlans) {
      localStorage.setItem(KEY_GEAR_PLANS, JSON.stringify(data.gearPlans));
    }

    // 匯入 photos 到 IndexedDB
    if (data.photos) {
      await importPhotos(data.photos);
    } else {
      await importPhotos({});
    }

    return true;
  } catch (e) {
    console.error("Import failed:", e);
    throw e;
  }
}

// 圖片壓縮輔助函數
export function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // 輸出為 compressed base64
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// ----------------------------------------------------
// MapTilesDB 部分（快取離線地圖圖磚）
// ----------------------------------------------------

const TILE_DB_NAME = "MapTilesDB";
const TILE_STORE_NAME = "tiles";
const TILE_DB_VERSION = 1;

function initMapTilesDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TILE_DB_NAME, TILE_DB_VERSION);

    request.onerror = (event) => {
      console.error("MapTilesDB error:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(TILE_STORE_NAME)) {
        db.createObjectStore(TILE_STORE_NAME);
      }
    };
  });
}

// 儲存地圖圖磚
export async function saveMapTile(key, blob) {
  try {
    const db = await initMapTilesDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TILE_STORE_NAME], "readwrite");
      const store = transaction.objectStore(TILE_STORE_NAME);
      const request = store.put(blob, key);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (error) {
    console.error("saveMapTile error:", error);
    return false;
  }
}

// 取得地圖圖磚 Blob
export async function getMapTile(key) {
  try {
    const db = await initMapTilesDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TILE_STORE_NAME], "readonly");
      const store = transaction.objectStore(TILE_STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (error) {
    console.error("getMapTile error:", error);
    return null;
  }
}

// 清空所有地圖快取
export async function clearMapTiles() {
  try {
    const db = await initMapTilesDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TILE_STORE_NAME], "readwrite");
      const store = transaction.objectStore(TILE_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (error) {
    console.error("clearMapTiles error:", error);
    return false;
  }
}

// 統計當前已快取的圖磚數量
export async function getMapTileCount() {
  try {
    const db = await initMapTilesDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TILE_STORE_NAME], "readonly");
      const store = transaction.objectStore(TILE_STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (error) {
    console.error("getMapTileCount error:", error);
    return 0;
  }
}

