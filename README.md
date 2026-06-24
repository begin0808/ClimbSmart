# 🏔️ ClimbSmart 智行百岳

**English** · [繁體中文](README.zh-TW.md)

> **Taiwan Alpine Smart Planner & Guard (臺灣登山規劃與安全守護平台)**
>
> Version: `V20260619` | Repository: [begin0808/ClimbSmart](https://github.com/begin0808/ClimbSmart)
>
> 🔗 Live demo: <https://climbsmart.vercel.app/>

---

**ClimbSmart** is an all-in-one, **Local-First** Progressive Web App (PWA) built for hikers of Taiwan's high mountains. It combines a peak-bagging logbook for the **100 Peaks (百岳)** and **Little 100 Peaks (小百岳)**, backpack weight analysis, offline GPX off-route alerts, offline wilderness-rescue coordinate conversion, and live alpine weather forecasts — your companion for both trip planning and on-trail safety.

---

## 🌟 Core Features

*   **🏆 Peak-Bagging Dashboard (100 Peaks & Little 100 Peaks)**
    *   Coordinates, elevation, mountain range, difficulty and trivia for all **100 Peaks and 100 Little Peaks** across Taiwan.
    *   Log summit dates, upload your own summit photos and notes, and watch a polished completion-progress ring.
    *   One-click backup/export of every record and album (`.json`) so your data is never lost.
*   **🗺️ Interactive Topographic & Satellite Maps**
    *   Every peak marked on an interactive map, with filtering and search.
    *   "Smooth fly-to" — tap a peak in the dashboard to instantly focus its location on the map.
*   **🎒 Gear Planner & Weather Forecast**
    *   Templates for popular routes (multi-day heavy, single-day light, etc.).
    *   Dynamically computes **Base Weight** and **total pack weight**, with overweight warnings based on route difficulty.
    *   **Multi-point alpine weather**: powered by the Open-Meteo high-resolution mountain weather API — switch between **trailhead**, **mountain hut** and **summit** 5-day forecasts, with a quick link to Taiwan's official **CWA mountain weather**.
*   **📈 Personal Completion Statistics**
    *   Automatically totals your cumulative ascent, playfully converted into "how many Everests you've climbed".
    *   Charts your completion percentage across major ranges and difficulty levels.
*   **🧭 Offline Route Guard & Off-Route Alert**
    *   Load a standard GPX track before you go and read your live GPS position even with no signal.
    *   When you stray beyond a safe threshold (e.g. 50 m) from the planned track, it triggers a voice + audible alert to prevent getting lost.
    *   Real-time elevation-profile comparison of your current vs. planned altitude.
*   **🚨 Offline Wilderness SOS**
    *   With no signal but a working GPS chip, instantly shows your precise coordinates.
    *   **Dual coordinate conversion**: the **WGS84 briefing format** and the **TWD97 (Taiwan 2-degree TM2 grid)** most used by search-and-rescue teams.
    *   Built-in golden-hour rescue checklist and survival guidance for getting lost or hypothermia.

---

## 🔒 Privacy & Safety

This project uses a completely **serverless**, Local-First storage architecture:

1. **Absolute data privacy & security**
   - Photos are stored in the browser's `IndexedDB`; logs in `LocalStorage`.
   - Your photos and GPX tracks are **never uploaded to any cloud server**. With no backend, there is **no risk of intrusion or database leaks** — everything runs on your own device, offline.
   - *Tip: periodically tap "Export" in the sidebar to back up your records, in case the browser cache is cleared.*
2. **Install-free, instant use (PWA)**
   - Just open the URL to start; use "Add to Home Screen" to install it as an offline PWA for a near-native app experience.
3. **$0 maintenance cost**
   - **Hosting**: deployed on Vercel / GitHub Pages — static hosting is free forever.
   - **Weather & maps**: Open-Meteo requests are sent directly from the user's device IP; maps use open-source Leaflet + OpenStreetMap (OSM) — **no extra server or API fees**.

---

## 🏷️ Versioning

Versions use a **date-encoded scheme**, e.g.:
*   `Version V20260619` — the build updated on 19 June 2026.
*   This helps hikers and contributors quickly tell whether their cached PWA is up to date.

---

## 💬 Feedback & Support

We value every hiker's feedback! If you hit a bug or have an idea:

1.  **GitHub Issues** (technical / public discussion): submit at the [Issues page](https://github.com/begin0808/ClimbSmart/issues).
2.  **Email**: `begin0808@gmail.com` — please prefix the subject with `[ClimbSmart]`.

---

## 📄 License

Released under the **MIT License**.

© 2026 Studio0808. All rights reserved.
