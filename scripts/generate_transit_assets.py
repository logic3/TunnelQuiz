#!/usr/bin/env python3
"""Generate TunnelQuiz transit map and data from HVV GTFS feed."""

import csv
import io
import json
import math
import os
import re
import shutil
import urllib.request
import zipfile
from html import unescape

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
CACHE_DIR = os.path.join(SCRIPT_DIR, ".cache")
GTFS_ZIP = os.path.join(CACHE_DIR, "hvv_gtfs.zip")
GTFS_DIR = os.path.join(CACHE_DIR, "gtfs")

LINE_COLORS = {
    "U1": "#0072BC",
    "U2": "#ED1C24",
    "U3": "#FFDD00",
    "U4": "#00A651",
}
S_BAHN_COLOR = "#009640"

BASE_LINE_PROGRESSION = [
    {"id": "U1", "xpNeeded": 0},
    {"id": "U2", "xpNeeded": 50},
    {"id": "U3", "xpNeeded": 150},
    {"id": "U4", "xpNeeded": 300},
    {"id": "S1", "xpNeeded": 500},
    {"id": "S11", "xpNeeded": 650},
    {"id": "S2", "xpNeeded": 800},
    {"id": "S21", "xpNeeded": 950},
    {"id": "S3", "xpNeeded": 1150},
    {"id": "S31", "xpNeeded": 1350},
]

USER_AGENT = "TunnelQuiz/1.0 (GTFS pipeline; contact: lauer.team)"


def slugify(name):
    s = name.lower().strip()
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "station"


def fetch_url(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    if dest:
        with open(dest, "wb") as f:
            f.write(data)
    return data


def find_gtfs_download_url():
    """Resolve latest HVV GTFS ZIP via Transparenzportal CKAN API."""
    search_url = (
        "https://suche.transparenz.hamburg.de/api/3/action/package_search"
        "?q=HVV+Fahrplandaten+GTFS&rows=10&sort=publishing_date+desc"
    )
    try:
        req = urllib.request.Request(search_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode())
        for pkg in payload.get("result", {}).get("results", []):
            name = (pkg.get("name") or "").lower()
            title = (pkg.get("title") or "").lower()
            if "gtfs" not in name and "gtfs" not in title:
                continue
            for res in pkg.get("resources", []):
                url = res.get("url") or res.get("download_url")
                fmt = (res.get("format") or res.get("mimetype") or "").lower()
                if url and ("zip" in fmt or url.lower().endswith(".zip")):
                    print(f"Found GTFS on Transparenzportal: {url}")
                    return url
    except Exception as e:
        print(f"Transparenzportal CKAN lookup failed: {e}")

    # Known stable fallback (March 2026 feed)
    fallback = (
        "https://daten.transparenz.hamburg.de/Dataport.HmbTG.ZS.Webservice.GetRessource100/"
        "GetRessource100.svc/fcfa37ca-403b-4056-b24a-a4b6250fa335/"
        "Upload__hvv_Rohdaten_GTFS_Fpl_20260325_Update.ZIP"
    )
    try:
        req = urllib.request.Request(fallback, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status < 400:
                print(f"Using fallback GTFS URL: {fallback}")
                return fallback
    except Exception as e:
        print(f"Fallback URL check failed: {e}")

    raise RuntimeError("Could not locate HVV GTFS download URL")


def download_gtfs():
    os.makedirs(CACHE_DIR, exist_ok=True)
    if not os.path.exists(GTFS_ZIP) or os.path.getsize(GTFS_ZIP) < 100000:
        url = find_gtfs_download_url()
        print(f"Downloading GTFS to {GTFS_ZIP}...")
        fetch_url(url, GTFS_ZIP)
    if os.path.isdir(GTFS_DIR):
        shutil.rmtree(GTFS_DIR)
    os.makedirs(GTFS_DIR, exist_ok=True)
    with zipfile.ZipFile(GTFS_ZIP, "r") as zf:
        zf.extractall(GTFS_DIR)
    print(f"GTFS extracted to {GTFS_DIR}")


def read_csv(name):
    path = os.path.join(GTFS_DIR, name)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def index_stop_times(stop_times):
    by_trip = {}
    for st in stop_times:
        tid = st.get("trip_id")
        if not tid:
            continue
        by_trip.setdefault(tid, []).append(st)
    for tid in by_trip:
        by_trip[tid].sort(key=lambda s: int(s.get("stop_sequence", 0)))
    return by_trip


def is_target_line(short_name):
    if short_name in ("U1", "U2", "U3", "U4"):
        return True
    return bool(re.match(r"^S\d+$", short_name or ""))


def load_geojson():
    url = "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/hamburg.geojson"
    print(f"Downloading GeoJSON from {url}...")
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode())


def build_projection(geo_data, extra_lons, extra_lats):
    lons, lats = [], []

    def collect_coords(coords):
        if isinstance(coords[0], (int, float)):
            lons.append(coords[0])
            lats.append(coords[1])
        else:
            for c in coords:
                collect_coords(c)

    for f in geo_data["features"]:
        collect_coords(f["geometry"]["coordinates"])

    lons.extend(extra_lons)
    lats.extend(extra_lats)

    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    # Expand bbox slightly for outer S-Bahn stops
    pad_lon = (max_lon - min_lon) * 0.06
    pad_lat = (max_lat - min_lat) * 0.06
    min_lon -= pad_lon
    max_lon += pad_lon
    min_lat -= pad_lat
    max_lat += pad_lat

    lat_center = (min_lat + max_lat) / 2.0
    cos_lat = math.cos(math.radians(lat_center))
    lon_diff = max_lon - min_lon
    lat_diff = max_lat - min_lat

    height = 600
    width = int(round(height * (lon_diff * cos_lat) / lat_diff))
    height = int(height)

    def project(lon, lat):
        x = (lon - min_lon) / lon_diff * width
        y = height - (lat - min_lat) / lat_diff * height
        return x, y

    def coords_to_path(coords, geom_type):
        parts = []
        if geom_type == "Polygon":
            rings = coords
        elif geom_type == "MultiPolygon":
            rings = [ring for poly in coords for ring in poly]
        else:
            return ""
        for ring in rings:
            pts = [project(p[0], p[1]) for p in ring]
            parts.append("M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y in pts) + " Z")
        return " ".join(parts)

    return {
        "width": width,
        "height": height,
        "project": project,
        "coords_to_path": coords_to_path,
    }


def get_representative_trip_stops(route_id, trips, stop_times_by_trip):
    route_trips = [t for t in trips if t.get("route_id") == route_id]
    if not route_trips:
        return []
    best = None
    best_len = -1
    for trip in route_trips:
        seq = stop_times_by_trip.get(trip["trip_id"], [])
        if len(seq) > best_len:
            best_len = len(seq)
            best = seq
    return best or []


def main():
    print("Starting TunnelQuiz transit asset generation...")
    os.makedirs(os.path.join(ROOT, "src", "data"), exist_ok=True)

    download_gtfs()

    routes = read_csv("routes.txt")
    trips = read_csv("trips.txt")
    stop_times = read_csv("stop_times.txt")
    stops_raw = read_csv("stops.txt")
    print(f"Loaded GTFS: {len(routes)} routes, {len(trips)} trips, {len(stop_times)} stop_times")
    stop_times_by_trip = index_stop_times(stop_times)

    # Build stop lookup — prefer parent stations
    stops_by_id = {s["stop_id"]: s for s in stops_raw}
    parent_map = {}
    for s in stops_raw:
        if s.get("location_type") == "1":
            parent_map[s["stop_id"]] = s
    for s in stops_raw:
        pid = s.get("parent_station")
        if pid and pid in parent_map:
            parent_map[pid]["_child_ids"] = parent_map[pid].get("_child_ids", []) + [s["stop_id"]]

    def resolve_stop(stop_id):
        s = stops_by_id.get(stop_id)
        if not s:
            return None
        pid = s.get("parent_station")
        if pid and pid in stops_by_id:
            return stops_by_id[pid]
        return s

    filtered_routes = []
    for r in routes:
        short = (r.get("route_short_name") or "").strip()
        if is_target_line(short):
            filtered_routes.append(r)

    filtered_routes.sort(key=lambda r: (
        0 if r["route_short_name"].startswith("U") else 1,
        r["route_short_name"],
    ))

    print(f"Filtered {len(filtered_routes)} U/S routes")

    stations_map = {}
    lines = []

    for route in filtered_routes:
        line_id = route["route_short_name"].strip()
        mode = "ubahn" if line_id.startswith("U") else "sbahn"
        color = LINE_COLORS.get(line_id, S_BAHN_COLOR)

        trip_stops = get_representative_trip_stops(route["route_id"], trips, stop_times_by_trip)
        station_ids_ordered = []
        seen = set()

        for st in trip_stops:
            resolved = resolve_stop(st.get("stop_id"))
            if not resolved:
                continue
            name = resolved.get("stop_name", "").strip()
            if not name or re.match(r"^\d+$", name):
                continue
            sid = slugify(name)
            base_id = sid
            n = 2
            while sid in stations_map and stations_map[sid]["name"] != name:
                sid = f"{base_id}-{n}"
                n += 1

            lat = float(resolved.get("stop_lat") or 0)
            lon = float(resolved.get("stop_lon") or 0)

            if sid not in stations_map:
                stations_map[sid] = {
                    "id": sid,
                    "name": name,
                    "lat": lat,
                    "lon": lon,
                    "lines": [],
                    "type": mode,
                }
            else:
                stations_map[sid]["lat"] = lat
                stations_map[sid]["lon"] = lon

            if line_id not in stations_map[sid]["lines"]:
                stations_map[sid]["lines"].append(line_id)

            # Update type
            st_obj = stations_map[sid]
            has_u = any(l.startswith("U") for l in st_obj["lines"])
            has_s = any(l.startswith("S") for l in st_obj["lines"])
            if has_u and has_s:
                st_obj["type"] = "both"
            elif has_u:
                st_obj["type"] = "ubahn"
            else:
                st_obj["type"] = "sbahn"

            if sid not in seen:
                station_ids_ordered.append(sid)
                seen.add(sid)

        lines.append({
            "id": line_id,
            "name": line_id,
            "color": color,
            "mode": mode,
            "stationIds": station_ids_ordered,
        })

    stations = sorted(stations_map.values(), key=lambda s: s["name"])
    for s in stations:
        s["lines"] = sorted(s["lines"], key=lambda x: (0 if x.startswith("U") else 1, x))

    print(f"Extracted {len(stations)} stations, {len(lines)} lines")

    extra_lons = [s["lon"] for s in stations]
    extra_lats = [s["lat"] for s in stations]
    geo_data = load_geojson()
    proj = build_projection(geo_data, extra_lons, extra_lats)

    # Background paths
    bg_paths = []
    for f in geo_data["features"]:
        geom = f["geometry"]
        d = proj["coords_to_path"](geom["coordinates"], geom["type"])
        if d:
            bg_paths.append(f'<path class="map-bg-path" d="{d}" />')

    # Line paths
    line_path_els = []
    for line in lines:
        coords = []
        for sid in line["stationIds"]:
            st = stations_map.get(sid)
            if st:
                coords.append(proj["project"](st["lon"], st["lat"]))
        if len(coords) < 2:
            continue
        d = "M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y in coords)
        line["pathD"] = d
        line_path_els.append(
            f'<path class="line-path" data-line="{line["id"]}" stroke="{line["color"]}" d="{d}" />'
        )

    # Station circles
    station_els = []
    for st in stations:
        x, y = proj["project"](st["lon"], st["lat"])
        st["x"] = round(x, 2)
        st["y"] = round(y, 2)
        lines_attr = ",".join(st["lines"])
        station_els.append(f'''<g class="station-group" data-name="{st["name"]}" data-id="{st["id"]}" data-lines="{lines_attr}" data-type="{st["type"]}">
  <circle class="station-hit" cx="{x:.2f}" cy="{y:.2f}" r="12" data-name="{st["name"]}" data-id="{st["id"]}" />
  <circle class="station-dot" cx="{x:.2f}" cy="{y:.2f}" r="4" data-name="{st["name"]}" data-id="{st["id"]}" />
</g>''')

    w, h = proj["width"], proj["height"]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" class="transit-map-svg">
  <g class="map-bg-group">
    {"".join(chr(10) + "    " + p for p in bg_paths)}
  </g>
  <g class="lines-group">
    {"".join(chr(10) + "    " + p for p in line_path_els)}
  </g>
  <g class="stations-group">
    {"".join(chr(10) + "    " + p for p in station_els)}
  </g>
  <g id="map-labels-group" style="pointer-events: none;"></g>
</svg>'''

    svg_path = os.path.join(ROOT, "src", "data", "transit_map.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Wrote {svg_path}")

    # JSON outputs (strip internal x/y for JSON)
    stations_json = [{k: v for k, v in s.items() if k not in ("x", "y")} for s in stations]
    lines_json = [{k: v for k, v in l.items()} for l in lines]

    with open(os.path.join(ROOT, "src", "data", "stations.json"), "w", encoding="utf-8") as f:
        json.dump(stations_json, f, ensure_ascii=False, indent=2)
    with open(os.path.join(ROOT, "src", "data", "lines.json"), "w", encoding="utf-8") as f:
        json.dump(lines_json, f, ensure_ascii=False, indent=2)

    # LINE_PROGRESSION — base + any extra S lines from GTFS
    prog_ids = {p["id"] for p in BASE_LINE_PROGRESSION}
    progression = list(BASE_LINE_PROGRESSION)
    last_xp = progression[-1]["xpNeeded"]
    for line in lines:
        lid = line["id"]
        if lid not in prog_ids:
            last_xp += 200
            progression.append({"id": lid, "xpNeeded": last_xp})
            prog_ids.add(lid)

    js_path = os.path.join(ROOT, "src", "data", "transit_data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by scripts/generate_transit_assets.py — do not edit manually\n")
        f.write(f"const TRANSIT_STATIONS = {json.dumps(stations_json, ensure_ascii=False, indent=2)};\n\n")
        f.write(f"const TRANSIT_LINES = {json.dumps(lines_json, ensure_ascii=False, indent=2)};\n\n")
        f.write(f"const LINE_PROGRESSION = {json.dumps(progression, ensure_ascii=False, indent=2)};\n")

    print(f"Wrote {js_path}")
    print(f"Done: {len(stations)} stations, {len(lines)} lines")


if __name__ == "__main__":
    main()
