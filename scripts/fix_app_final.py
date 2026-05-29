#!/usr/bin/env python3
"""Final fixes for TunnelQuiz app.js after port + patch."""

from pathlib import Path
import re

APP = Path(__file__).resolve().parents[1] / "src" / "app.js"

MISSING_METHODS = '''
  isStationUnlocked(name) {
    const info = this.getStationByName(name);
    if (!info) return false;
    return (info.lines || []).some(l => this.getUnlockedLines().includes(l));
  }

  markStationSolved(name) {
    const info = this.getStationByName(name);
    if (!info) return;
    (info.lines || []).forEach(lid => {
      if (!this.lineProgress[lid]) this.lineProgress[lid] = { solved: new Set() };
      this.lineProgress[lid].solved.add(name);
    });
    this.saveState();
  }
'''

FIXES = [
    (r"LINE_PROGRESSION\.map\(b => line\.id\)", "LINE_PROGRESSION.map(line => line.id)"),
    (r"LINE_PROGRESSION\.find\(b =>", "LINE_PROGRESSION.find(line =>"),
    (r"LINE_PROGRESSION\.forEach\(bz =>", "LINE_PROGRESSION.forEach(line =>"),
    (r"unlocked\.includes\(line\.id\)", "unlocked.includes(line.id)"),
    (r"forEach\(line => \{\s*const isUnlocked = unlocked\.includes\(line\.id\);", "forEach(line => {\n      const isUnlocked = unlocked.includes(line.id);"),
    (r"nextBezirk\.name", "nextLine.id"),
    (r"const nextBezirk =", "const nextLine ="),
    (r"q\.bezirk === frontierBezirk", "(q.lines || []).includes(frontierBezirk)"),
    (r"const frontierBezirk =", "const frontierLine ="),
    (r"frontierBezirk", "frontierLine"),
    (r"!d\.is_island && bezirke\.includes\(d\.bezirk\)", "selectedLines.some(l => (d.lines || []).includes(l))"),
    (r"const bezirke = Array\.isArray\(districtSelection\)", "const selectedLines = Array.isArray(districtSelection)"),
    (r"LINE_PROGRESSION\.map\(b => \(\{ id: line\.id", "LINE_PROGRESSION.map(line => ({ name: line.id"),
    (r"rankName\.textContent = currentRank \? currentRank\.name : \"Hamburger\"", 'rankName.textContent = currentRank ? currentRank.name : "Steig-Neuling"'),
    (r"🔒 75% im vorherigen Bezirk", "🔒 75% in vorheriger Linie"),
    (r"Meistere alle Stadtteile im Bezirk", "Meistere alle Stationen der Linie"),
    (r"Bezirke schaltest du separat", "Linien schaltest du separat"),
    (r"\(Bezirke\)", "(Linien)"),
    (r"Finde den Ort auf der Karte", "Finde die Station auf der Karte"),
    (r"Ort \$\{", "Frage ${"),
    (r"Liegt im Bezirk \$\{this\.currentTarget\.bezirk\}", "Linien: ${(this.currentTarget.lines || []).join(', ')}"),
    (r"❔ Blinkender Stadtteil ❔", "❔ Blinkende Station ❔"),
    (r"❔ Blinkender Bezirk ❔", "❔ Hervorgehobene Linie ❔"),
    (r"Bezirk benennen", "Linie benennen"),
    (r"Bitte wähle mindestens einen Bezirk", "Bitte wähle mindestens eine Linie"),
    (r"Keine Fragen im ausgewählten Bezirk", "Keine Fragen für die ausgewählten Linien"),
    (r"Wähle deinen Bezirk", "Wähle deine Linien"),
    (r"Bezirke einbeziehen", "Linien einbeziehen"),
    (r"Schalte den nächsten Bezirk frei", "Schalte die nächste Linie frei"),
    (r"im zuletzt freigeschalteten Bezirk", "in der zuletzt freigeschalteten Linie"),
    (r"TRANSIT_STATIONS\.filter\(d => !d\.is_island", "TRANSIT_STATIONS.filter(d => d.name"),
    (r"!d\.is_island &&", ""),
]


def fix_stadtteil_paths(text):
    """Replace stadtteil-path DOM ops with transit equivalents."""
    replacements = [
        (
            r"document\.querySelectorAll\('\.stadtteil-path'\)\.forEach\(p => p\.classList\.remove\('blink', 'selected'\)\);",
            "document.querySelectorAll('.station-hit, .station-dot, .line-path').forEach(p => p.classList.remove('blink', 'selected'));",
        ),
        (
            r"document\.querySelectorAll\(`\.stadtteil-path\[data-bezirk=\"\$\{this\.currentTarget\.name\}\"\]`\)\.forEach\(p => p\.classList\.add\('blink'\)\);",
            "const blinkLine = this.getLineElement(this.currentTarget.name); if (blinkLine) blinkLine.classList.add('blink');",
        ),
        (
            r"document\.querySelectorAll\(`\.stadtteil-path\[data-bezirk=\"\$\{this\.currentTarget\.name\}\"\]`\)\.forEach\(p => p\.classList\.remove\('blink'\)\);",
            "const unblinkLine = this.getLineElement(this.currentTarget.name); if (unblinkLine) unblinkLine.classList.remove('blink');",
        ),
        (
            r"document\.querySelectorAll\(`\.stadtteil-path\[data-bezirk=\"\$\{correctAnswer\}\"\]`\)\.forEach\(p => \{\s*p\.classList\.add\('round-correct'\);\s*\}\);",
            "const correctLine = this.getLineElement(correctAnswer); if (correctLine) correctLine.classList.add('round-correct');",
        ),
        (
            r"document\.querySelectorAll\(`\.stadtteil-path\[data-bezirk=\"\$\{targetName\}\"\]`\)\.forEach\(p => \{\s*p\.classList\.add\('round-incorrect'\);\s*\}\);",
            "const missedLine = this.getLineElement(targetName); if (missedLine) missedLine.classList.add('round-incorrect');",
        ),
        (
            r"document\.querySelectorAll\('\.stadtteil-path\.round-correct, \.stadtteil-path\.round-incorrect'\)\.forEach\(p => \{\s*if \(isBz\) \{\s*answered\.add\(p\.getAttribute\('data-bezirk'\)\);\s*\} else \{\s*answered\.add\(p\.getAttribute\('data-name'\)\);\s*\}\s*\}\);",
            """document.querySelectorAll('.line-path.round-correct, .line-path.round-incorrect').forEach(p => {
      if (isBz) answered.add(p.getAttribute('data-line'));
    });
    document.querySelectorAll('.station-hit.round-correct, .station-hit.round-incorrect').forEach(p => {
      if (!isBz) answered.add(p.getAttribute('data-name'));
    });""",
        ),
    ]
    for old, new in replacements:
        text = re.sub(old, new, text, flags=re.DOTALL)
    return text


def fix_onboarding(text):
    old = re.search(r"showOnboarding\(.*?\n  \}\n", text, flags=re.DOTALL)
    if not old:
        return text
    new_onboarding = '''showOnboarding(force = false) {
    if (!force && localStorage.getItem('tq_onboarded')) return;
    openOverlayModal(`
      <div class="overlay-card onboarding-card">
        <h2>Willkommen bei TunnelQuiz 🚇</h2>
        <p>Lerne spielerisch die Hamburger U- und S-Bahn — Stationen und Linien auf der geografischen Karte.</p>
        <ul>
          <li><strong>Stationen lernen:</strong> Haltestellen finden, benennen und merken.</li>
          <li><strong>Linien lernen:</strong> U1–U4 und S-Bahn-Verläufe auf der Karte.</li>
          <li><strong>5 Spielmodi:</strong> Entdecker, Detektiv, Quiz, Tippen, Sporcle-Challenge.</li>
        </ul>
        <button class="primary-btn" id="btn-close-onboarding">Los geht's!</button>
      </div>
    `, { closeOnBackdrop: true });
    document.getElementById('btn-close-onboarding')?.addEventListener('click', () => {
      localStorage.setItem('tq_onboarded', '1');
      closeOverlayModal(document.querySelector('.overlay-modal'));
    });
  }
'''
    return text[:old.start()] + new_onboarding + text[old.end():]


def main():
    text = APP.read_text(encoding="utf-8")

    if "markStationSolved(name)" not in text:
        text = text.replace(
            "  isModeAllowedForSegment(mode) {",
            MISSING_METHODS + "\n  isModeAllowedForSegment(mode) {",
        )

    for pattern, repl in FIXES:
        text = re.sub(pattern, repl, text)

    text = fix_stadtteil_paths(text)
    text = fix_onboarding(text)

    # initExplorerMode text
    text = text.replace(
        "Klicke auf einen ${isBz ? 'Bezirk' : 'Stadtteil'} der Karte",
        "Klicke auf ${isBz ? 'eine Linie' : 'eine Station'} auf der Karte",
    )
    text = text.replace(
        "um spannende Metadaten und hanseatische Fakten anzuzeigen!",
        "um Linien, Umsteigeinfos und Fakten anzuzeigen!",
    )

    APP.write_text(text, encoding="utf-8")
    print(f"Fixed {APP}")


if __name__ == "__main__":
    main()
