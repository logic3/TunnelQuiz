#!/usr/bin/env python3
"""Apply transit-specific patches to ported app.js."""

import re
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "src" / "app.js"

TRANSIT_HELPERS = '''
  getLineById(lineId) {
    return TRANSIT_LINES.find(l => l.id === lineId);
  }

  getStationByName(name) {
    return TRANSIT_STATIONS.find(s => s.name === name);
  }

  getStationById(id) {
    return TRANSIT_STATIONS.find(s => s.id === id);
  }

  getStationElementByName(name) {
    if (!this.svg || !name) return null;
    const st = this.getStationByName(name);
    const id = st?.id || name;
    return this.svg.querySelector(`.station-hit[data-id="${CSS.escape(id)}"], .station-dot[data-id="${CSS.escape(id)}"]`);
  }

  getLineElement(lineId) {
    if (!this.svg) return null;
    return this.svg.querySelector(`.line-path[data-line="${CSS.escape(lineId)}"]`);
  }

  highlightLine(lineId, cls = 'active') {
    document.querySelectorAll('.line-path').forEach(p => {
      p.classList.toggle(cls, p.getAttribute('data-line') === lineId);
      p.classList.toggle('dimmed', lineId && p.getAttribute('data-line') !== lineId);
    });
  }

  clearLineHighlights() {
    document.querySelectorAll('.line-path').forEach(p => {
      p.classList.remove('active', 'dimmed', 'blink', 'selected', 'round-correct', 'round-incorrect');
    });
  }

  getLineCssKey(lineId) {
    return (lineId || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  getLineColor(lineId) {
    const line = this.getLineById(lineId);
    return line?.color || '#009640';
  }

  getSegmentPool() {
    return this.activeSegment === 'LINES'
      ? TRANSIT_LINES.map(l => ({ name: l.id, id: l.id, lines: [l.id], type: l.mode }))
      : TRANSIT_STATIONS;
  }

'''

MAP_METHODS = '''
  updateMapStates() {
    const unlockedLines = this.getUnlockedLines();

    document.querySelectorAll('.station-group, .station-hit, .station-dot').forEach(el => {
      const lines = (el.getAttribute('data-lines') || '').split(',').filter(Boolean);
      const isUnlocked = this.progressionMode
        ? lines.some(l => unlockedLines.includes(l))
        : true;
      el.classList.toggle('locked-path', !isUnlocked);
      el.classList.toggle('unlocked-line', isUnlocked);
      const name = el.getAttribute('data-name');
      const showDiscovered = this.currentMode === 'EXPLORER' && !this.inRound && !this.nameAllIsActive;
      let discovered = false;
      if (showDiscovered && name) {
        for (const lid of lines) {
          if (this.lineProgress[lid]?.solved.has(name)) { discovered = true; break; }
        }
      }
      el.classList.toggle('discovered', discovered);
    });

    document.querySelectorAll('.line-path').forEach(path => {
      const lid = path.getAttribute('data-line');
      const isUnlocked = !this.progressionMode || unlockedLines.includes(lid);
      path.classList.toggle('locked-path', !isUnlocked);
      path.style.pointerEvents = isUnlocked ? '' : 'none';
    });
  }

  resetMapClasses() {
    document.querySelectorAll('.station-hit, .station-dot').forEach(el => {
      el.classList.remove('selected', 'blink', 'correct-flash', 'incorrect-flash', 'round-correct', 'round-incorrect', 'line-excluded');
    });
    this.clearLineHighlights();
    this.activeSelectPath = null;
  }

  applyActiveLineFilter(activeLines) {
    if (!activeLines?.length) return;
    const all = this.getUnlockedLines();
    if (activeLines.length >= all.length) return;
    document.querySelectorAll('.station-group').forEach(g => {
      const lines = (g.getAttribute('data-lines') || '').split(',').filter(Boolean);
      const visible = lines.some(l => activeLines.includes(l));
      g.classList.toggle('line-excluded', !visible);
      g.querySelectorAll('.station-hit').forEach(h => {
        h.style.pointerEvents = visible ? '' : 'none';
      });
    });
  }

  initMapPaths() {
    document.querySelectorAll('.station-hit').forEach(hit => {
      hit.addEventListener('mousemove', (e) => this.showStationTooltip(hit, e.clientX, e.clientY));
      hit.addEventListener('mouseleave', () => { if (this.tooltip) this.tooltip.style.display = 'none'; });
      hit.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        this.showStationTooltip(hit, e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      hit.addEventListener('mousedown', () => { if (this.mapNav) this.mapNav.didDrag = false; });
      hit.addEventListener('click', (e) => {
        if (this.mapNav?.didDrag) return;
        const name = hit.getAttribute('data-name');
        const id = hit.getAttribute('data-id');
        if (hit.classList.contains('locked-path') && !this.nameAllIsActive) {
          this.sounds.init(); this.sounds.playIncorrect(); return;
        }
        if (this.currentMode === 'EXPLORER' && this.activeSegment === 'STATIONS') {
          this.selectStation(hit, name, id);
        } else if (this.inRound && this.currentMode === 'LOCATE' && this.activeSegment === 'STATIONS') {
          this.handleStationLocateClick(hit, name);
        } else if (this.inRound && this.currentMode === 'QUIZ' && this.activeSegment === 'STATIONS') {
          this.handleRoundAnswer(name, null);
        }
      });
    });

    document.querySelectorAll('.line-path').forEach(path => {
      path.addEventListener('mousemove', (e) => this.showLineTooltip(path, e.clientX, e.clientY));
      path.addEventListener('mouseleave', () => { if (this.tooltip) this.tooltip.style.display = 'none'; });
      path.addEventListener('mousedown', () => { if (this.mapNav) this.mapNav.didDrag = false; });
      path.addEventListener('click', () => {
        if (this.mapNav?.didDrag) return;
        const lineId = path.getAttribute('data-line');
        if (path.classList.contains('locked-path') && !this.nameAllIsActive) {
          this.sounds.init(); this.sounds.playIncorrect(); return;
        }
        if (this.currentMode === 'EXPLORER' && this.activeSegment === 'LINES') {
          this.selectLine(lineId);
        } else if (this.inRound && this.currentMode === 'LOCATE' && this.activeSegment === 'LINES') {
          this.handleLineLocateClick(lineId);
        } else if (this.inRound && this.currentMode === 'QUIZ' && this.activeSegment === 'LINES') {
          this.handleRoundAnswer(lineId, null);
        }
      });
    });
  }

  reorderMapLayers() {
    if (!this.svg) return;
    const bg = this.svg.querySelector('.map-bg-group');
    const lines = this.svg.querySelector('.lines-group');
    const stations = this.svg.querySelector('.stations-group');
    const labels = this.svg.querySelector('#map-labels-group');
    if (bg) this.svg.insertBefore(bg, this.svg.firstChild);
    if (lines && stations) this.svg.insertBefore(lines, stations);
    if (labels) this.svg.appendChild(labels);
  }

  showStationTooltip(el, clientX, clientY) {
    if (!this.shouldShowMapTooltip() || !this.tooltip) return;
    const name = el.getAttribute('data-name');
    const lines = (el.getAttribute('data-lines') || '').replace(/,/g, ', ');
    if (el.classList.contains('locked-path')) {
      this.tooltip.innerHTML = '<div>🔒 Linie gesperrt</div><div class="tooltip-bezirk">Lerne weiter zum Freischalten</div>';
    } else {
      this.tooltip.innerHTML = `<div>${name}</div><div class="tooltip-bezirk">${lines}</div>`;
    }
    this.positionMapTooltip(clientX, clientY);
    this.tooltip.style.display = 'block';
  }

  showLineTooltip(path, clientX, clientY) {
    if (!this.shouldShowMapTooltip() || !this.tooltip) return;
    const lineId = path.getAttribute('data-line');
    const line = this.getLineById(lineId);
    const count = line?.stationIds?.length || 0;
    this.tooltip.innerHTML = `<div>Linie ${lineId}</div><div class="tooltip-bezirk">${count} Stationen · ${line?.mode === 'ubahn' ? 'U-Bahn' : 'S-Bahn'}</div>`;
    this.positionMapTooltip(clientX, clientY);
    this.tooltip.style.display = 'block';
  }

  selectStationByName(name) {
    const el = this.getStationElementByName(name);
    if (el) this.selectStation(el, name, el.getAttribute('data-id'));
  }

  selectStation(el, name, id) {
    this.playSelectionSound();
    this.resetMapClasses();
    el.classList.add('selected');
    this.activeSelectPath = el;
    const info = this.getStationByName(name) || { lines: [], type: 'both' };
    const lines = info.lines || [];
    const typeLabel = info.type === 'both' ? 'U- & S-Bahn' : (info.type === 'ubahn' ? 'U-Bahn' : 'S-Bahn');
    const container = document.getElementById('game-play-area');
    container.innerHTML = `
      <div class="info-details">
        <div class="detail-header">
          <h2>${name}</h2>
          <span class="bezirk-tag" style="background: rgba(0,114,188,0.15); color: #7ec8ff; border: 1px solid rgba(0,114,188,0.3)">${typeLabel}</span>
        </div>
        <div class="detail-stats-grid">
          <div class="detail-stat"><div class="ds-label">Linien</div><div class="ds-value">${lines.join(', ') || '—'}</div></div>
          <div class="detail-stat"><div class="ds-label">Umsteigen</div><div class="ds-value">${lines.length > 1 ? 'Ja' : 'Nein'}</div></div>
        </div>
        <div class="detail-trivia">${lines.length > 1 ? `Wichtiger Umsteigeknoten — ${lines.length} Linien.` : `Station der Linie ${lines[0] || '?'}.`}</div>
      </div>`;
  }

  selectLine(lineId) {
    this.playSelectionSound();
    this.resetMapClasses();
    this.highlightLine(lineId, 'selected');
    const line = this.getLineById(lineId);
    const stations = (line?.stationIds || []).map(id => this.getStationById(id)?.name).filter(Boolean);
    const container = document.getElementById('game-play-area');
    container.innerHTML = `
      <div class="info-details">
        <div class="detail-header">
          <h2>Linie ${lineId}</h2>
          <span class="bezirk-tag" style="background: ${line?.color || '#009640'}22; color: ${line?.color || '#009640'}; border: 1px solid ${line?.color || '#009640'}55">${line?.mode === 'ubahn' ? 'U-Bahn' : 'S-Bahn'}</span>
        </div>
        <div class="detail-stat"><div class="ds-label">Stationen (${stations.length})</div>
          <div style="font-size:0.78rem; max-height:120px; overflow-y:auto; color:var(--text-secondary); line-height:1.35; padding-top:0.2rem;">${stations.join(' → ')}</div>
        </div>
      </div>`;
  }

  handleStationLocateClick(el, name) {
    this.handleRoundAnswer(name, null);
  }

  handleLineLocateClick(lineId) {
    this.handleRoundAnswer(lineId, null);
  }
'''


def main():
    text = APP.read_text(encoding="utf-8")

    # Remove KiezQuiz-specific blocks
    text = re.sub(r"const SPECIFIC_TRIVIA = \{.*?\n\};\n\n", "", text, flags=re.DOTALL)
    text = re.sub(r"\n  buildBezirkBoundaries\(\) \{.*?\n  \}\n", "\n", text, flags=re.DOTALL)
    text = re.sub(r"\n  updateNeuwerkBadge\(\) \{.*?\n  \}\n", "\n", text, flags=re.DOTALL)
    text = re.sub(r"\n  checkParadiseTrophy\(.*?\n  \}\n", "\n", text, flags=re.DOTALL)
    text = re.sub(r"\n  getBezirkHue\(.*?\n  \}\n", "\n", text, flags=re.DOTALL)
    text = re.sub(r"\n  raiseWaterLayerForNameAll\(.*?\n  \}\n", "\n", text, flags=re.DOTALL)
    text = re.sub(r"\n  showMapTooltipForPath\(.*?\n  \}\n", "\n", text, flags=re.DOTALL)

    # Remove old map method bodies (replace wholesale)
    for method in [
        "updateMapStates", "resetMapClasses", "applyActiveLineFilter", "applyActiveBezirkFilter",
        "initMapPaths", "reorderMapLayers", "selectStationByName", "selectStation", "selectLine",
        "handleStationLocateClick", "handleLineLocateClick", "getStationElementByName",
        "getLineCssKey", "isStationUnlocked", "markStationSolved",
    ]:
        text = re.sub(rf"\n  {method}\([^{{]*\) \{{.*?\n  \}}\n", "\n", text, flags=re.DOTALL)

    # Remove neuwerk init block in setupUIListeners
    text = re.sub(
        r"\n    // Neuwerk Island Special Anchor.*?this\.unlockTrophy\([^\)]+\);\n      \}\);\n    \}\n",
        "\n",
        text,
        flags=re.DOTALL,
    )

    # Fix init()
    text = text.replace("    this.buildBezirkBoundaries();\n", "")
    text = text.replace("    this.updateNeuwerkBadge();\n", "")

    # Insert helpers after constructor closing brace area - before init()
    text = text.replace(
        "    this.loadState();\n  }\n\n  init() {",
        "    this.loadState();\n  }\n" + TRANSIT_HELPERS + "\n  init() {",
    )

    # Insert map methods before initExplorerMode
    text = text.replace(
        "  // --- MODE: EXPLORER (ENTDECKER) ---\n  initExplorerMode",
        MAP_METHODS + "\n  // --- MODE: EXPLORER (ENTDECKER) ---\n  initExplorerMode",
    )

    # Fix progression helpers
    text = text.replace(
        "return this.getUnlockedLines().includes(info.bezirk);",
        "return (info.lines || []).some(l => this.getUnlockedLines().includes(l));",
    )
    text = text.replace(
        "if (!info || info.is_island) return;\n    const progress = this.lineProgress[info.bezirk];",
        "if (!info) return;\n    (info.lines || []).forEach(lid => {\n    const progress = this.lineProgress[lid];",
    )
    # close forEach in markStationSolved - need manual fix

    text = text.replace("this.activeSegment = 'STATIONS'; // STATIONS or BEZIRKE", "this.activeSegment = 'STATIONS'; // STATIONS or LINES")
    text = text.replace("this.roundLineFilter = 'Altona'", "this.roundLineFilter = 'U1'")
    text = text.replace("getLastUnlockedLine() {\n    return LINE_PROGRESSION[this.unlockedLineIndex]?.name || LINE_PROGRESSION[0].name;",
                        "getLastUnlockedLine() {\n    return LINE_PROGRESSION[this.unlockedLineIndex]?.id || LINE_PROGRESSION[0].id;")

    text = text.replace(".filter(d => d.bezirk === line.id && !d.is_island)", ".filter(d => (d.lines || []).includes(line.id))")
    text = text.replace("this.lineProgress[line.id].solved.size", "this.lineProgress[line.id]?.solved.size || 0")

    text = text.replace("this.checkParadiseTrophy(", "// checkParadiseTrophy removed: this.checkParadiseTrophy(")

    APP.write_text(text, encoding="utf-8")
    print(f"Patched {APP}")


if __name__ == "__main__":
    main()
