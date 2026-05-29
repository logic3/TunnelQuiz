#!/usr/bin/env python3
"""Port KiezQuiz app.js to TunnelQuiz app.js with transit-specific adaptations."""

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIEZ = os.path.join(os.path.dirname(ROOT), "KiezQuiz", "src", "app.js")
OUT = os.path.join(ROOT, "src", "app.js")

HEADER = """/* -------------------------------------------------------------
 * TunnelQuiz — U- & S-Bahn learning game (adapted from KiezQuiz)
 * ------------------------------------------------------------- */

"""

RANKS_BLOCK = """const RANKS = [
  { level: 1, name: "Steig-Neuling", minXp: 0, maxXp: 249 },
  { level: 2, name: "Umsteiger", minXp: 250, maxXp: 749 },
  { level: 3, name: "Gleiskenner", minXp: 750, maxXp: 1499 },
  { level: 4, name: "Netzplan-Profi", minXp: 1500, maxXp: 2499 },
  { level: 5, name: "HVV-Experte", minXp: 2500, maxXp: Infinity }
];

"""

TROPHY_BLOCK = """function buildTrophyCatalog() {
  const specials = [
    { id: 'first_ubahn', name: 'Erste U-Bahn', icon: '🚇', desc: 'Schalte deine erste U-Bahn-Linie frei.' },
    { id: 'all_ubahn', name: 'U-Bahn-Komplett', icon: '🔵', desc: 'Meistere alle vier U-Bahn-Linien.' },
    { id: 'first_sbahn', name: 'Erste S-Bahn', icon: '🚆', desc: 'Schalte deine erste S-Bahn-Linie frei.' },
    { id: 'streak_10', name: '10er-Serie', icon: '🔥', desc: 'Erreiche eine Antwortserie von 10.' },
    { id: 'meister_alle_stationen', name: 'Netzplan-König', icon: '👑', desc: 'Benenne alle Stationen in der Sporcle-Challenge.' },
    { id: 'meister_alle_linien', name: 'Linien-Kapitän', icon: '🛤️', desc: 'Benenne alle Linien in der Challenge.' },
    { id: 'u1_speed', name: 'U1-Sprint', icon: '⚡', desc: 'Benenne alle U1-Stationen in unter 5 Minuten.' }
  ];
  const lineTrophies = (typeof LINE_PROGRESSION !== 'undefined' ? LINE_PROGRESSION : []).map(line => ({
    id: `master_${line.id.toLowerCase()}`,
    name: `${line.id}-Entdecker`,
    icon: line.id.startsWith('U') ? '🚇' : '🚆',
    desc: `Meistere alle Stationen der Linie ${line.id}.`
  }));
  return [...specials, ...lineTrophies];
}

"""

MODE_LABELS = """const MODE_LABELS = {
  EXPLORER: 'Entdecker-Modus',
  LOCATE: 'Stations-Detektiv',
  QUIZ: 'Karten-Quiz',
  TYPE_NAME: 'Namen eingeben',
  NAME_ALL: 'Nenne alle Stationen'
};

const LINES_SEGMENT_HIDDEN_MODES = [];

"""


def main():
    with open(KIEZ, "r", encoding="utf-8") as f:
        src = f.read()

    # Strip old header through MODE_LABELS / trivia blocks
    src = re.sub(r"/\* -+\n \* Cyber-Alster.*?\*/\n\n", "", src, count=1, flags=re.DOTALL)
    src = re.sub(r"const RANKS = \[.*?\];\n\n", "", src, count=1, flags=re.DOTALL)
    src = re.sub(r"const BEZIRKE_PROGRESSION = \[.*?\];\n\n", "", src, count=1, flags=re.DOTALL)
    src = re.sub(r"function buildTrophyCatalog\(\) \{.*?\n\}\n\nconst TROPHY_CATALOG = buildTrophyCatalog\(\);\n\n", "", src, count=1, flags=re.DOTALL)
    src = re.sub(r"const BEZIRKE_SEGMENT_HIDDEN_MODES = \[.*?\];\n\n", "", src, count=1, flags=re.DOTALL)
    src = re.sub(r"const MODE_LABELS = \{.*?\};\n\n", "", src, count=1, flags=re.DOTALL)
    src = re.sub(r"// Hardcoded interesting trivia.*?\n\};\n\n", "", src, count=1, flags=re.DOTALL)

    # Bulk renames
    repl = [
        ("HamburgGame", "TunnelGame"),
        ("window.hamburgGame", "window.tunnelGame"),
        ("hamburg_muted", "tq_muted"),
        ("hh_", "tq_"),
        ("BEZIRKE_PROGRESSION", "LINE_PROGRESSION"),
        ("HAMBURG_DATA", "TRANSIT_STATIONS"),
        ("BEZIRKE_SEGMENT_HIDDEN_MODES", "LINES_SEGMENT_HIDDEN_MODES"),
        ("'STADTTEILE'", "'STATIONS'"),
        ("'BEZIRKE'", "'LINES'"),
        ("STADTTEILE", "STATIONS"),
        ("bezirkProgress", "lineProgress"),
        ("unlockedBezirkIndex", "unlockedLineIndex"),
        (".hamburg-map-svg", ".transit-map-svg"),
        ("getLastUnlockedBezirk", "getLastUnlockedLine"),
        ("tryUnlockNextBezirk", "tryUnlockNextLine"),
        ("getUnlockedBezirke", "getUnlockedLines"),
        ("getFrontierRoundScore", "getFrontierRoundScore"),
        ("isStadtteilUnlocked", "isStationUnlocked"),
        ("markStadtteilSolved", "markStationSolved"),
        ("recordRoundProgress", "recordRoundProgress"),
        ("getBezirkCssKey", "getLineCssKey"),
        ("selectNeighbourhood", "selectStation"),
        ("selectNeighbourhoodByName", "selectStationByName"),
        ("getPathByNeighbourhoodName", "getStationElementByName"),
        ("handleLocateClick", "handleStationLocateClick"),
        ("selectBezirk", "selectLine"),
        ("handleBezirkLocateClick", "handleLineLocateClick"),
        ("applyActiveBezirkFilter", "applyActiveLineFilter"),
        ("getSelectedRoundBezirke", "getSelectedRoundLines"),
        ("getSelectedNameAllBezirke", "getSelectedNameAllLines"),
        ("nameAllActiveBezirke", "nameAllActiveLines"),
        ("roundDistrict", "roundLineFilter"),
        ("Stadtteil-Detektiv", "Stations-Detektiv"),
        ("Stadtteil benennen", "Station benennen"),
        ("Stadtteilname eingeben", "Stationsname eingeben"),
        ("Finde den Stadtteil", "Finde die Station"),
        ("Welcher Stadtteil blinkt", "Welche Station blinkt"),
        ("Welcher Bezirk blinkt", "Welche Linie ist hervorgehoben"),
        ("Finde den Bezirk", "Finde die Linie"),
        ("Bezirks-Detektiv", "Linien-Detektiv"),
        ("Bezirksname eingeben", "Linienname eingeben"),
        ("Bezirks-Fortschritt", "Linien-Fortschritt"),
        ("Alle Bezirke freischalten", "Alle Linien freischalten"),
        ("btn-segment-stadtteile", "btn-segment-stations"),
        ("btn-segment-bezirke", "btn-segment-lines"),
        ("district-progress-list", "line-progress-list"),
        ("district-progress-row", "line-progress-row"),
        ("bezirk-picker", "line-picker"),
        ("bezirk-picker-item", "line-picker-item"),
        ("nameall-bezirk-picker", "nameall-line-picker"),
        ("segment-stadtteile", "segment-stations"),
        ("segment-bezirke", "segment-lines"),
        ("Nenne alle Orte", "Nenne alle Stationen"),
        ("König von Hamburg", "Netzplan-König"),
        ("Bezirks-Kapitän", "Linien-Kapitän"),
        ("meister_alle_stadtteile", "meister_alle_stationen"),
        ("meister_alle_bezirke", "meister_alle_linien"),
        ("Quiddje", "Steig-Neuling"),
        ("Fischkopp", "Umsteiger"),
        ("Hamburger Jung / Deern", "Gleiskenner"),
        ("Elbkapitän", "Netzplan-Profi"),
        ("Hamburg-Experte", "HVV-Experte"),
    ]
    for old, new in repl:
        src = src.replace(old, new)

    # LINE_PROGRESSION uses id field — fix iteration variable names only
    src = src.replace("LINE_PROGRESSION.map(b => b.id)", "LINE_PROGRESSION.map(line => line.id)")
    src = src.replace("LINE_PROGRESSION.map(b => b.name)", "LINE_PROGRESSION.map(line => line.id)")
    src = src.replace("BEZIRKE_PROGRESSION.map(b => b.name)", "LINE_PROGRESSION.map(line => line.id)")
    src = src.replace("BEZIRKE_PROGRESSION.map(b => ({ name: b.name", "LINE_PROGRESSION.map(line => ({ name: line.id")
    src = src.replace("BEZIRKE_PROGRESSION.find(b =>", "LINE_PROGRESSION.find(line =>")
    src = src.replace("nextBezirk.name", "nextLine.id")
    src = src.replace("const nextBezirk = LINE_PROGRESSION", "const nextLine = LINE_PROGRESSION")

    # Fix progression iteration in loadState
    src = src.replace(
        "LINE_PROGRESSION.forEach(bz => {\n      this.lineProgress[bz.name] = { solved: new Set() };",
        "LINE_PROGRESSION.forEach(line => {\n      this.lineProgress[line.id] = { solved: new Set() };"
    )
    src = src.replace(
        "const saved = localStorage.getItem(`tq_progress_${bz.name}`);",
        "const saved = localStorage.getItem(`tq_progress_${line.id}`);"
    )
    src = src.replace(
        "JSON.parse(saved).forEach(st => this.lineProgress[bz.name].solved.add(st));",
        "JSON.parse(saved).forEach(st => this.lineProgress[line.id].solved.add(st));"
    )
    src = src.replace(
        "LINE_PROGRESSION.forEach(bz => {\n      localStorage.setItem(`tq_progress_${bz.name}`",
        "LINE_PROGRESSION.forEach(line => {\n      localStorage.setItem(`tq_progress_${line.id}`"
    )
    src = src.replace(
        "JSON.stringify([...this.lineProgress[bz.name].solved]));",
        "JSON.stringify([...this.lineProgress[line.id].solved]));"
    )

    out = HEADER + RANKS_BLOCK + TROPHY_BLOCK + "const TROPHY_CATALOG = buildTrophyCatalog();\n\n" + MODE_LABELS + src

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"Wrote {OUT} ({len(out)} bytes)")


if __name__ == "__main__":
    main()
