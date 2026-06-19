import L from "leaflet";
import { getMapTile, saveMapTile } from "./db";

// 離線圖磚層：攔截每張圖磚的載入，優先讀 IndexedDB 快取，
// 沒有快取則抓網路並存入快取（供 InteractiveMap 與 RouteGuard 共用）。
// options 額外支援 onTileCached()：每當有新圖磚被快取時呼叫（用於更新快取張數）。
export function createOfflineTileLayer(urlTemplate, options) {
  const OfflineTileLayer = L.TileLayer.extend({
    createTile: function (coords, done) {
      const tile = document.createElement("img");

      L.DomEvent.on(tile, "load", L.Util.bind(this._tileOnLoad, this, done, tile));
      L.DomEvent.on(tile, "error", L.Util.bind(this._tileOnError, this, done, tile));

      if (this.options.crossOrigin || this.options.crossOrigin === "") {
        tile.crossOrigin = this.options.crossOrigin === true ? "" : this.options.crossOrigin;
      }
      tile.alt = "";

      const url = this.getTileUrl(coords);

      getMapTile(url)
        .then((blob) => {
          if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            tile.src = objectUrl;
            L.DomEvent.on(tile, "unload", () => URL.revokeObjectURL(objectUrl));
          } else {
            // 快取未命中，從網路抓取並存入
            fetch(url)
              .then((res) => {
                if (!res.ok) throw new Error("Tile fetch failed");
                return res.blob();
              })
              .then((b) => {
                saveMapTile(url, b);
                const objectUrl = URL.createObjectURL(b);
                tile.src = objectUrl;
                L.DomEvent.on(tile, "unload", () => URL.revokeObjectURL(objectUrl));
                if (this.options.onTileCached) this.options.onTileCached();
              })
              .catch(() => {
                tile.src = url; // 失敗時的備用方案
              });
          }
        })
        .catch(() => {
          tile.src = url;
        });

      return tile;
    }
  });

  return new OfflineTileLayer(urlTemplate, options);
}
