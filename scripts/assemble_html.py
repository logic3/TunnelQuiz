#!/usr/bin/env python3
"""Assemble TunnelQuiz index.html with inlined transit map SVG."""

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


def main():
    svg_path = "src/data/transit_map.svg"
    if not os.path.exists(svg_path):
        print(f"Error: {svg_path} missing — run generate_transit_assets.py first")
        return

    with open(svg_path, "r", encoding="utf-8") as f:
        svg_content = f.read().strip()

    bbox = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg_content)
    width = bbox.group(1) if bbox else "700"
    height = bbox.group(2) if bbox else "600"

    # Ensure root SVG has transit class
    if 'class="transit-map-svg"' not in svg_content:
        svg_content = svg_content.replace("<svg ", '<svg class="transit-map-svg" ', 1)

    html = f'''<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>TunnelQuiz – U- & S-Bahn spielerisch lernen</title>
  <meta name="description" content="TunnelQuiz: Lerne spielerisch Hamburger U- und S-Bahn-Stationen und Linien auf der geografischen Karte — interaktiv und mobiloptimiert.">
  <meta name="theme-color" content="#0f1118">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="TunnelQuiz">
  <meta name="format-detection" content="telephone=no">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="icons/icon.svg">
  <link rel="stylesheet" href="src/style.css">
</head>
<body>
  <div class="app-container">
    <header class="app-header">
      <div class="brand">
        <h1>TunnelQuiz 🚇</h1>
        <span class="badge">U- & S-Bahn</span>
      </div>
      <div class="stats-bar">
        <div class="stat-pill streak-pill" title="Deine aktuelle Antwortserie">
          <div class="streak-info">
            <div class="streak-current">
              <span class="label">Serie 🔥:</span>
              <span class="value" id="stat-streak">0x</span>
            </div>
            <div class="streak-best" id="stat-best-streak">Beste: 0x</div>
          </div>
        </div>
        <div class="stat-pill xp-pill" title="Deine Erfahrungspunkte">
          <span class="label">XP:</span>
          <span class="value" id="stat-xp">0</span>
        </div>
        <div class="level-tracker">
          <div class="level-info">
            <span class="rank-name" id="stat-rank">Steig-Neuling</span>
          </div>
          <div class="progress-bg">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
        </div>
        <button class="audio-toggle" id="btn-mute" title="Sound ein/ausschalten">🔊</button>
        <button class="audio-toggle" id="btn-history" title="Spielverlauf">📋</button>
        <button class="audio-toggle" id="btn-settings" title="Einstellungen">⚙️</button>
      </div>
    </header>

    <main class="dashboard-grid">
      <section class="console-panel">
        <div class="segment-selector">
          <button class="segment-btn active" id="btn-segment-stations">
            <span>🚉 Stationen lernen</span>
          </button>
          <button class="segment-btn" id="btn-segment-lines">
            <span>🛤️ Linien lernen</span>
          </button>
        </div>

        <div class="glass-card mode-selector">
          <h3>Spielmodus wählen</h3>
          <div class="modes-list">
            <button class="mode-btn active" data-mode="EXPLORER" id="mode-explorer">
              <span class="mode-icon">🗺️</span>
              <div style="display:flex; flex-direction:column;">
                <span style="font-weight:700;">Entdecker-Modus</span>
                <span style="font-size:0.75rem; font-weight:400; opacity:0.8;">Frei erkunden & Infos lernen</span>
              </div>
            </button>
            <button class="mode-btn" data-mode="LOCATE" id="mode-locate">
              <span class="mode-icon">🕵️</span>
              <div style="display:flex; flex-direction:column;">
                <span style="font-weight:700;">Stations-Detektiv</span>
                <span style="font-size:0.75rem; font-weight:400; opacity:0.8;">Finde die Station auf der Karte</span>
              </div>
            </button>
            <button class="mode-btn" data-mode="QUIZ" id="mode-quiz">
              <span class="mode-icon">⚡</span>
              <div style="display:flex; flex-direction:column;">
                <span style="font-weight:700;">Karten-Quiz</span>
                <span style="font-size:0.75rem; font-weight:400; opacity:0.8;">Erkenne die blinkende Station</span>
              </div>
            </button>
            <button class="mode-btn" data-mode="TYPE_NAME" id="mode-typename">
              <span class="mode-icon">⌨️</span>
              <div style="display:flex; flex-direction:column;">
                <span style="font-weight:700;">Namen eingeben</span>
                <span style="font-size:0.75rem; font-weight:400; opacity:0.8;">Blinkende Station eintippen</span>
              </div>
            </button>
            <button class="mode-btn" data-mode="NAME_ALL" id="mode-nameall">
              <span class="mode-icon">⏱️</span>
              <div style="display:flex; flex-direction:column;">
                <span style="font-weight:700;">Nenne alle Stationen</span>
                <span style="font-size:0.75rem; font-weight:400; opacity:0.8;">Sporcle-Challenge gegen die Zeit</span>
              </div>
            </button>
          </div>
        </div>

        <div class="glass-card game-play-area" id="game-play-area-card">
          <div id="game-play-area"></div>
        </div>

        <div class="glass-card unlocker-card" id="unlocker-card-container">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; margin-bottom:0.5rem;">
            <h3 style="font-family:var(--font-display); font-size:1rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.05em;">Linien-Fortschritt</h3>
          </div>
          <div class="district-progress-list" id="line-progress-list"></div>
        </div>

        <div class="glass-card" style="padding: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 700; font-size: 0.85rem; color: #fff;">Alle Linien freischalten</span>
            <span style="font-size: 0.75rem; color: var(--text-secondary);">Bypass für Profis (keine Progression)</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-progression">
            <span class="slider"></span>
          </label>
        </div>
      </section>

      <section class="map-panel">
        <div class="map-container-wrapper" id="map-wrapper">
          {svg_content}
          <div class="map-prompt-bar" id="map-prompt-bar" hidden>
            <div class="map-prompt-title" id="map-prompt-title"></div>
            <div class="map-prompt-target" id="map-prompt-target"></div>
            <div class="map-prompt-sub" id="map-prompt-sub"></div>
          </div>
          <div class="map-tooltip" id="map-tooltip"></div>
        </div>
        <div class="map-controls">
          <div class="zoom-btns">
            <button class="control-btn" id="btn-zoom-in" title="Vergrößern">+</button>
            <button class="control-btn" id="btn-zoom-out" title="Verkleinern">-</button>
            <button class="control-btn" id="btn-zoom-reset" title="Originalgröße und Zentrierung" style="color: var(--color-neutral-glow); font-weight: 800; border-color: rgba(0, 162, 255, 0.3);">🏠 Zentrieren & Reset</button>
          </div>
          <div class="map-hint" id="map-hint-text">
            💡 Tipp: Ziehe zum Verschieben. Pinch oder Mausrad zum Zoomen.
          </div>
        </div>
      </section>
    </main>

    <footer class="app-footer">
      <p class="privacy-notice">
        <strong>Datenschutz:</strong> Keine Server, keine Accounts — dein Spielstand (XP, Streak, Fortschritt) wird nur lokal im Browser gespeichert (<code>tq_*</code> Keys).
      </p>
      <p class="footer-credit">Fahrplandaten: HVV Open Data (GTFS) · Courtesy of Jeremiah J. Lauer, LL.M.</p>
    </footer>
  </div>

  <script src="src/data/transit_data.js"></script>
  <script src="src/app.js"></script>
</body>
</html>
'''

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Assembled index.html")


if __name__ == "__main__":
    main()
