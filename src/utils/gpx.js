import { gcj02ToWgs84 } from './geo.js'
import { parsePolyline } from './math.js'
function escXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
export function buildGpxTrk(segments, homeName, workName, distMeters) {
  let trkpts = ''
  for (const seg of segments || []) {
    if (!seg.polyline) continue
    for (const pt of parsePolyline(seg.polyline)) {
      const w = gcj02ToWgs84(pt.lng, pt.lat)
      trkpts += `      <trkpt lat="${w.lat.toFixed(6)}" lon="${w.lng.toFixed(6)}">\n        <ele>0</ele>\n      </trkpt>\n`
    }
  }
  const name = `${escXml(homeName)} → ${escXml(workName)} (${(distMeters / 1000).toFixed(1)}km)`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="漫途" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>\n${trkpts}    </trkseg></trk></gpx>`
}
