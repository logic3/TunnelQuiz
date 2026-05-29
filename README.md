# TunnelQuiz

Gamifiziertes Lernen der Hamburger **U- und S-Bahn** — Stationen und Linien auf einer geografischen Karte.

**Live:** [https://tunnelquiz.lauer.team](https://tunnelquiz.lauer.team)

## Features

- Geografische Karte mit Hamburg-Umriss, Linienverläufen und Stationspunkten
- Zwei Lernsegmente: **Stationen** und **Linien**
- Fünf Spielmodi: Entdecker, Detektiv, Quiz, Namen eingeben, Sporcle-Challenge
- Linien-Fortschritt mit XP-Rängen und Trophäen
- PWA-fähig, rein clientseitig (localStorage `tq_*`)

## Lokale Entwicklung

```bash
npm install   # optional — dev nutzt npx http-server
npm run build:data   # GTFS → stations.json, transit_map.svg, transit_data.js
npm run build:html   # index.html aus SVG bauen
npm run dev          # http://localhost:3000
```

## Datenquelle

Fahrplandaten im [GTFS-Format](https://gtfs.org/) vom **HVV** über das [Transparenzportal Hamburg](https://suche.transparenz.hamburg.de/dataset?esq_not_all_versions=true&q=HVV+Fahrplandaten+GTFS) (monatliche Updates).

Attribution: Hamburger Verkehrsverbund GmbH — Open Data.

## Datenschutz

Keine Server, keine Accounts. Spielstand wird ausschließlich lokal im Browser gespeichert.

## Lizenz

App-Code: ISC · Kartendaten: HVV GTFS (siehe Portal-Lizenz)
