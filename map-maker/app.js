// ===== State =====
const S = {
  tool: 'select', markerType: 'parking', elements: [], undoStack: [],
  refImg: null, refOpacity: 0.3, showRef: true, showGrid: true, showCompass: false,
  roadWidth: 10, roadColor: '#ffffff',
  drawing: false, currentPts: [], dragEl: null, dragOff: null, selectedIdx: -1,
  multiSelectedIdxs: [], // Shift+click で複数選択したインデックス
  textPos: null, pendingRoad: null,
  // Viewport
  viewScale: 1, viewOff: { x: 0, y: 0 },
  panning: false, panStart: null,
  // Compass
  compassX: null, compassY: null, compassAngle: 0, compassDragging: false,
  // Advanced handles
  dragEndpoint: null,   // { el, which: 'start'|'end' }
  resizeCorner: null    // { el, corner: 'tl'|'tr'|'bl'|'br' }
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

function resize() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  render();
}
window.addEventListener('resize', resize);

// ===== Coord helpers =====
function screenToWorld(sx, sy) {
  return { x: (sx - S.viewOff.x) / S.viewScale, y: (sy - S.viewOff.y) / S.viewScale };
}

// ===== Render =====
function render() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);

  // Grid (drawn in screen space, outside viewport)
  if (S.showGrid) drawGrid(w, h);

  // Apply viewport transform for all map content
  ctx.save();
  ctx.setTransform(S.viewScale, 0, 0, S.viewScale, S.viewOff.x, S.viewOff.y);

  if (S.refImg && S.showRef) {
    ctx.globalAlpha = S.refOpacity;
    const scale = Math.min(w / S.refImg.width, h / S.refImg.height);
    const iw = S.refImg.width * scale, ih = S.refImg.height * scale;
    ctx.drawImage(S.refImg, (w - iw) / 2, (h - ih) / 2, iw, ih);
    ctx.globalAlpha = 1;
  }

  S.elements.forEach((el, i) => {
    const isSelected = i === S.selectedIdx || S.multiSelectedIdxs.includes(i);
    drawElement(el, isSelected);
  });

  if (S.currentPts.length > 0 && S.tool === 'road') drawRoadPreview();

  ctx.restore();

  // Compass (screen space)
  if (S.showCompass) drawCompass(w, h);

  // Zoom indicator
  if (S.viewScale !== 1) {
    ctx.fillStyle = 'rgba(30,41,59,0.7)'; ctx.font = '12px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`x${S.viewScale.toFixed(2)}`, 10, h - 10);
  }
}

function drawGrid(w, h) {
  ctx.strokeStyle = '#e8ecf0';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function drawCompass(w, h) {
  const cx = S.compassX ?? w - 55;
  const cy = S.compassY ?? 55;
  const r = 26;
  const ang = (S.compassAngle || 0) * Math.PI / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  // Outer circle
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.stroke();
  // North arrow (filled black triangle, pointing up)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath(); ctx.moveTo(0, -r+3); ctx.lineTo(-5, 4); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
  // South half (open triangle, white)
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, r-3); ctx.lineTo(-5, -4); ctx.lineTo(5, -4); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Cross lines
  ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 0.8; ctx.setLineDash([2,2]);
  ctx.beginPath(); ctx.moveTo(-r,0); ctx.lineTo(r,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(0,r); ctx.stroke();
  ctx.setLineDash([]);
  // N label (stays aligned to north, drawn in rotated space)
  ctx.fillStyle = '#1e293b'; ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -r - 10);
  // Drag handle indicator (small circle)
  if (S.showCompass) {
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
    ctx.setLineDash([2,2]);
    ctx.beginPath(); ctx.arc(0, 0, r+4, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawRoadShape(pts, width, color, border, cap) {
  if (pts.length < 2) return;
  const lc = cap || 'round';
  ctx.lineCap = lc; ctx.lineJoin = 'round';
  ctx.strokeStyle = border || '#374151'; ctx.lineWidth = width + 3;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function drawRoadPreview() {
  drawRoadShape(S.currentPts, S.roadWidth, S.roadColor, '#9ca3af');
}

function drawElement(el, selected) {
  ctx.save();
  if (el.type === 'trace') {
    if (el._img) {
      // multiply合成: 黒線 → そのまま黒、白地 → 下の参照画像が透けて見える
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(el._img, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else if (el.type === 'symbol') {
    drawMapSymbol(el);
  } else if (el.type === 'road') {
    const cap = el._vecGenerated ? 'square' : 'round';
    drawRoadShape(el.points, el.width, el.color, undefined, cap);
    if (el.label) {
      const mid = Math.floor(el.points.length / 2);
      const p = el.points[mid];
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(el.label, p.x, p.y - el.width / 2 - 4);
    }
  } else if (el.type === 'building') {
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((el.angle || 0) * Math.PI / 180);
    ctx.fillStyle = '#e5e7eb'; ctx.strokeStyle = '#374151'; ctx.lineWidth = 2;
    ctx.fillRect(-el.w/2, -el.h/2, el.w, el.h);
    ctx.strokeRect(-el.w/2, -el.h/2, el.w, el.h);
    // ── 斜線ハッチング ───────────────────────────────
    ctx.save();
    ctx.beginPath(); ctx.rect(-el.w/2, -el.h/2, el.w, el.h); ctx.clip();
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1;
    for (let d = -(el.w + el.h); d < el.w + el.h; d += 8) {
      ctx.beginPath();
      ctx.moveTo(d - el.h, -el.h/2);
      ctx.lineTo(d + el.h, el.h/2);
      ctx.stroke();
    }
    ctx.restore();
    // 再度外枠を上から描画
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 2;
    ctx.strokeRect(-el.w/2, -el.h/2, el.w, el.h);
    if (el.label) {
      const fs = Math.min(el.w, el.h) * 0.25;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-fs * el.label.length * 0.38, -fs * 0.7, fs * el.label.length * 0.76, fs * 1.4);
      ctx.fillStyle = '#374151'; ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.label, 0, 0);
    }
    ctx.setTransform(1,0,0,1,0,0); // reset before drawing selection box
  } else if (el.type === 'text') {
    const fs = el.fontSize || 14;
    ctx.font = `${fs}px sans-serif`; ctx.fillStyle = '#111827';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(el.text, el.x, el.y);
  } else if (el.type === 'marker') {
    drawMarker(el);
  } else if (el.type === 'distance') {
    drawDistance(el);
  } else if (el.type === 'railroad') {
    drawRailroad(el);
  } else if (el.type === 'boundary') {
    drawBoundary(el, selected);
  } else if (el.type === 'scalebar') {
    drawScaleBar(el);
  }
  if (selected) drawSelectionBox(el);
  ctx.restore();
}

function drawMarker(el) {
  const r = 16;
  const s = el.scale || 1;
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.scale(s, s);
  if (el.markerType === 'parking') {
    ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('P', 0, 1);
  } else if (el.markerType === 'residence') {
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏠', 0, 0);
  } else if (el.markerType === 'pin') {
    // Simple location pin: filled black circle + stem
    const pr = 7 * s;
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI*2); ctx.fill();
    // White inner dot
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, pr * 0.35, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Stem
    ctx.save(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(el.x, el.y + pr); ctx.lineTo(el.x, el.y + pr + 14 * s); ctx.stroke();
    ctx.restore();
    // Label
    const lbl2 = el.label || '';
    if (lbl2) {
      ctx.save(); ctx.fillStyle = '#111'; ctx.font = `${12*s}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(lbl2, el.x, el.y + pr + 16 * s); ctx.restore();
    }
    return;
  } else if (el.markerType === 'arrow') {
    // 矢印マーカー（回転对応）
    const ang = (el.angle || 0) * Math.PI / 180;
    ctx.rotate(ang);
    const L = 36 * s; // 全長
    const hw = 14 * s; // 矢尻幅
    const tw = 6 * s;  // 軌幅
    ctx.fillStyle = el.color || '#dc2626';
    ctx.beginPath();
    ctx.moveTo(L, 0);
    ctx.lineTo(L - hw, -hw * 0.7);
    ctx.lineTo(L - hw, -tw / 2);
    ctx.lineTo(-L / 2, -tw / 2);
    ctx.lineTo(-L / 2, tw / 2);
    ctx.lineTo(L - hw, tw / 2);
    ctx.lineTo(L - hw, hw * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(0, 0, r-2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 0);
  }
  ctx.restore();
  // Label (not scaled)
  const labelMap = { parking: '保管場所', residence: '使用の本拠' };
  const lbl = el.label || labelMap[el.markerType] || '';
  if (lbl) {
    ctx.save();
    const color = el.markerType === 'parking' ? '#2563eb' : el.markerType === 'residence' ? '#dc2626' : '#16a34a';
    ctx.fillStyle = color; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(lbl, el.x, el.y + r * s + 4); ctx.restore();
  }
}

// ===== Railroad Drawing =====
function drawRailroad(el) {
  const pts = el.points;
  if (!pts || pts.length < 2) return;
  const W = el.width || 16; // track width
  ctx.save();
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round';

  // 1. Outer black track bed
  ctx.strokeStyle = '#111'; ctx.lineWidth = W;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // 2. Inner white fill (creates rail outline)
  ctx.strokeStyle = '#fff'; ctx.lineWidth = W - 4;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // 3. Cross ties / sleepers along path
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  // Walk along segments and draw perpendicular ticks
  for (let s = 0; s < pts.length - 1; s++) {
    const ax = pts[s].x, ay = pts[s].y;
    const bx = pts[s+1].x, by = pts[s+1].y;
    const segLen = Math.sqrt((bx-ax)**2 + (by-ay)**2);
    const nx = -(by - ay) / segLen, ny = (bx - ax) / segLen; // perpendicular unit
    const step = 8;
    const steps = Math.floor(segLen / step);
    for (let k = 0; k <= steps; k++) {
      const t = (k * step) / segLen;
      const tx = ax + (bx - ax) * t, ty = ay + (by - ay) * t;
      const hw = W / 2 + 1;
      ctx.beginPath();
      ctx.moveTo(tx + nx * hw, ty + ny * hw);
      ctx.lineTo(tx - nx * hw, ty - ny * hw);
      ctx.stroke();
    }
  }

  // 4. Rail lines (two thin black lines at edges)
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5;
  const railOff = W / 2 - 2;
  [1, -1].forEach(sign => {
    ctx.beginPath();
    for (let s = 0; s < pts.length; s++) {
      const segIdx = Math.min(s, pts.length - 2);
      const ax = pts[segIdx].x, ay = pts[segIdx].y;
      const bx = pts[segIdx+1].x, by = pts[segIdx+1].y;
      const segLen = Math.sqrt((bx-ax)**2 + (by-ay)**2);
      const nx = -(by - ay) / segLen * sign * railOff;
      const ny = (bx - ax) / segLen * sign * railOff;
      if (s === 0) ctx.moveTo(pts[0].x + nx, pts[0].y + ny);
      else ctx.lineTo(pts[s].x + nx, pts[s].y + ny);
    }
    ctx.stroke();
  });

  ctx.restore();
}

function drawDistance(el) {
  const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;
  const angle = Math.atan2(dy, dx);
  // Perpendicular unit vector (rotate 90°)
  const px = -dy / dist, py = dx / dist;
  const col = '#1e293b';

  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([]);

  // Dimension line (solid)
  ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();

  // End tick marks (perpendicular)
  [[el.x1, el.y1], [el.x2, el.y2]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(x + px * 7, y + py * 7);
    ctx.lineTo(x - px * 7, y - py * 7);
    ctx.stroke();
  });

  // Arrowheads along the line
  const arrowLen = 8, arrowW = 4;
  const ux = dx / dist, uy = dy / dist; // unit along line
  [[el.x1, el.y1, 1], [el.x2, el.y2, -1]].forEach(([x, y, dir]) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ux * arrowLen * dir + px * arrowW, y + uy * arrowLen * dir + py * arrowW);
    ctx.moveTo(x, y);
    ctx.lineTo(x + ux * arrowLen * dir - px * arrowW, y + uy * arrowLen * dir - py * arrowW);
    ctx.stroke();
  });

  // Label: offset perpendicular, rotated parallel to line
  const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
  const label = el.label || `${Math.round(dist)}px`;
  const offsetDist = 14; // px away from line
  const lx = mx + px * offsetDist, ly = my + py * offsetDist;

  ctx.save();
  ctx.translate(lx, ly);
  // Keep text readable: flip if angle makes it upside-down
  let textAngle = angle;
  if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) textAngle += Math.PI;
  ctx.rotate(textAngle);
  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = col;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // White background for readability
  const tw = ctx.measureText(label).width + 6;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(-tw/2, -9, tw, 18);
  ctx.fillStyle = col;
  ctx.fillText(label, 0, 0);
  ctx.restore();

  ctx.restore();
}

// ===== Map Symbol Drawing =====
function drawMapSymbol(el) {
  const x = el.x, y = el.y;
  const s = el.scale || 1;
  const r = 18;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // White background box
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5 / s;
  ctx.beginPath(); ctx.roundRect(-r, -r, r*2, r*2, 3); ctx.fill(); ctx.stroke();
  ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  switch(el.symType) {
    case 'signal':
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(-10, 0, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(0,   0, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(10,  0, 4, 0, Math.PI*2); ctx.fill();
      break;
    case 'crossing':
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5/s;
      ctx.beginPath(); ctx.moveTo(-10,-10); ctx.lineTo(10,10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10,-10); ctx.lineTo(-10,10); ctx.stroke();
      ctx.lineWidth = 2/s; ctx.beginPath(); ctx.moveTo(-12,-14); ctx.lineTo(12,-14); ctx.stroke();
      break;
    case 'school':
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 18px serif'; ctx.fillText('文', 0, 1); break;
    case 'post':
      ctx.fillStyle = '#dc2626'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('〒', 0, 1); break;
    case 'gas':
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('GS', 0, 1); break;
    case 'park':
      ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.arc(0, -5, 9, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#92400e'; ctx.fillRect(-2.5, 4, 5, 9); break;
    case 'store':
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('CVS', 0, 1); break;
    case 'police':
      ctx.fillStyle = '#1d4ed8'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('警', 0, 1); break;
    case 'hospital':
      ctx.fillStyle = '#dc2626'; ctx.lineWidth = 3/s;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke(); break;
    case 'shrine':
      ctx.fillStyle = '#dc2626'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('⛩', 0, 2); break;
    default:
      ctx.fillStyle = '#1e293b'; ctx.fillText('?', 0, 1);
  }
  ctx.restore();
  // Label below (not scaled)
  if (el.label) {
    ctx.save(); ctx.fillStyle = '#1e293b'; ctx.font = '10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(el.label, x, y + r * s + 3); ctx.restore();
  }
}

function drawSelectionBox(el) {
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
  const b = getBounds(el);
  ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
  ctx.setLineDash([]);

  // ── Building handles ──────────────────────────────────────────────
  if (el.type === 'building') {
    const cx = el.x + el.w/2, cy = el.y + el.h/2;
    const ang = (el.angle || 0) * Math.PI / 180;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const rotPt = (ox, oy) => ({ x: cx + ox*cosA - oy*sinA, y: cy + ox*sinA + oy*cosA });

    // Rotation handle (blue ↻) - above center
    const rh = rotPt(0, -(el.h/2 + 28));
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
    const rBase = rotPt(0, -(el.h/2 + 6));
    ctx.beginPath(); ctx.moveTo(rBase.x, rBase.y); ctx.lineTo(rh.x, rh.y); ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(rh.x, rh.y, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('↻', rh.x, rh.y+1);

    // Corner resize handles (orange ◼)
    [[-el.w/2, -el.h/2], [el.w/2, -el.h/2], [-el.w/2, el.h/2], [el.w/2, el.h/2]].forEach(([ox, oy]) => {
      const p = rotPt(ox, oy);
      ctx.fillStyle = '#f97316';
      ctx.beginPath(); ctx.rect(p.x-6, p.y-6, 12, 12); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(p.x-6, p.y-6, 12, 12); ctx.stroke();
    });
  }

  // ── Distance endpoint handles (blue ●) ───────────────────────────
  if (el.type === 'distance') {
    [[el.x1, el.y1], [el.x2, el.y2]].forEach(([x, y]) => {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.stroke();
    });
  }

  // ── Road endpoint handles (green ● at start/end) ─────────────────
  if (el.type === 'road' && el.points && el.points.length >= 2) {
    [el.points[0], el.points[el.points.length - 1]].forEach(pt => {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, Math.PI*2); ctx.stroke();
    });
  }

  // ── Symbol/Marker resize handle (orange ⤡) ───────────────────────
  if (el.type === 'symbol' || el.type === 'marker') {
    const baseR = el.type === 'symbol' ? 18 : 16;
    const s = el.scale || 1;
    const hx = el.x + baseR * s + 10, hy = el.y + baseR * s + 10;
    ctx.fillStyle = '#f97316';
    ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⤡', hx, hy + 1);
  }

  // ── Text font-size handles (A+ / A-) ─────────────────────────────
  if (el.type === 'text') {
    const fs = el.fontSize || 14;
    ctx.font = `${fs}px sans-serif`;
    const tw = ctx.measureText(el.text).width;
    // A+ handle (right of text)
    const hpx = el.x + tw + 14, hpy = el.y - 2;
    ctx.fillStyle = '#f97316';
    ctx.beginPath(); ctx.arc(hpx, hpy, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('A+', hpx, hpy);
    // A- handle (below A+)
    const hmx = hpx, hmy = el.y + fs + 6;
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.arc(hmx, hmy, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('A-', hmx, hmy);
  }

  // ── Arrow rotation handle at tip (blue ↻) ────────────────────────
  if (el.type === 'marker' && el.markerType === 'arrow') {
    const s = el.scale || 1;
    const ang = (el.angle || 0) * Math.PI / 180;
    const L = 36 * s;
    const tipX = el.x + L * Math.cos(ang);
    const tipY = el.y + L * Math.sin(ang);
    // Line from center to tip
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.setLineDash([]);
    // Rotation handle circle at tip
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(tipX, tipY, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('↻', tipX, tipY + 1);
  }
}

function getBounds(el) {
  if (el.type === 'trace') return { x: 0, y: 0, w: canvas.width, h: canvas.height };
  if (el.type === 'symbol') {
    const s = el.scale || 1;
    return { x: el.x - 18*s, y: el.y - 18*s, w: 36*s, h: 36*s };
  }
  if (el.type === 'marker') {
    const s = el.scale || 1;
    return { x: el.x - 16*s, y: el.y - 16*s, w: 32*s, h: 50*s };
  }
  if (el.type === 'road' || el.type === 'railroad') {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    el.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (el.type === 'building') return { x: el.x, y: el.y, w: el.w, h: el.h };
  if (el.type === 'text') return { x: el.x, y: el.y, w: ctx.measureText(el.text).width, h: 16 };
  if (el.type === 'marker') {
    const s = el.scale || 1;
    return { x: el.x - 16*s, y: el.y - 16*s, w: 32*s, h: 50*s };
  }
  if (el.type === 'distance') {
    const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2);
    return { x, y, w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

// ===== Hit Test =====
function hitTest(mx, my) {
  for (let i = S.elements.length - 1; i >= 0; i--) {
    const b = getBounds(S.elements[i]);
    if (mx >= b.x - 10 && mx <= b.x + b.w + 10 && my >= b.y - 10 && my <= b.y + b.h + 10) return i;
  }
  return -1;
}

// ===== Undo/Redo =====
function pushUndo() { S.undoStack.push(JSON.stringify(S.elements)); if (S.undoStack.length > 50) S.undoStack.shift(); }
function undo() { if (!S.undoStack.length) return; const prev = S.undoStack.pop(); S.elements = JSON.parse(prev); S.selectedIdx = -1; render(); }
function addElement(el) { pushUndo(); S.elements.push(el); render(); }

// ===== Export Helper =====
function exportCanvas(srcCanvas, onDone) {
  srcCanvas.toBlob(blob => {
    if (!blob || blob.size < 100) {
      alert('出力エラー: キャンバスが空です。');
      if (onDone) onDone();
      return;
    }
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const datetime = now.toISOString().slice(0, 10) + '_' +
      now.toTimeString().slice(0, 8).replace(/:/g, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shoanzumap_' + datetime + '.png';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (onDone) onDone();
  }, 'image/png');
}

// ===== Mouse Handlers =====
let mouseX = 0, mouseY = 0;
let spaceDown = false;
document.addEventListener('keydown', e => { if (e.code === 'Space') { spaceDown = true; canvas.style.cursor = 'grab'; e.preventDefault(); } });
document.addEventListener('keyup',   e => { if (e.code === 'Space') { spaceDown = false; canvas.style.cursor = S.tool === 'select' ? 'default' : 'crosshair'; } });

// Wheel zoom (centered on mouse)
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const delta = e.deltaY < 0 ? 1.12 : 0.9;
  const newScale = Math.max(0.1, Math.min(20, S.viewScale * delta));
  S.viewOff.x = sx - (sx - S.viewOff.x) * (newScale / S.viewScale);
  S.viewOff.y = sy - (sy - S.viewOff.y) * (newScale / S.viewScale);
  S.viewScale = newScale;
  render();
}, { passive: false });

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

  // Compass drag (screen space)
  if (S.showCompass) {
    const cx = S.compassX ?? canvas.width - 55;
    const cy = S.compassY ?? 55;
    if (Math.sqrt((sx-cx)**2 + (sy-cy)**2) < 36) {
      S.compassDragging = true;
      canvas.style.cursor = 'grabbing'; return;
    }
  }

  // Pan mode: space+drag or middle button
  if (spaceDown || e.button === 1) {
    S.panning = true; S.panStart = { x: sx - S.viewOff.x, y: sy - S.viewOff.y };
    canvas.style.cursor = 'grabbing'; return;
  }
  const { x: mx, y: my } = screenToWorld(sx, sy);

  if (S.tool === 'select') {
    // Check rotation handle first
    if (S.selectedIdx >= 0) {
      const el = S.elements[S.selectedIdx];
      // Resize handle (symbol / marker)
      if (el.type === 'symbol' || el.type === 'marker') {
        const baseR = el.type === 'symbol' ? 18 : 16;
        const s = el.scale || 1;
        const hx = el.x + baseR * s + 10, hy = el.y + baseR * s + 10;
        if (Math.sqrt((mx-hx)**2 + (my-hy)**2) < 12) {
          S.resizing = true; S.resizeEl = el; S.resizeBase = baseR;
          pushUndo(); return;
        }
      }
      // Building: corner resize handles (orange) + rotation handle (blue)
      if (el.type === 'building') {
        const bcx = el.x + el.w/2, bcy = el.y + el.h/2;
        const ang = (el.angle || 0) * Math.PI / 180;
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        const rotPt = (ox, oy) => ({ x: bcx + ox*cosA - oy*sinA, y: bcy + ox*sinA + oy*cosA });
        // Check corner handles first
        const corners = [
          [-el.w/2, -el.h/2, 'tl'], [el.w/2, -el.h/2, 'tr'],
          [-el.w/2, el.h/2, 'bl'],  [el.w/2, el.h/2, 'br']
        ];
        let hitCorner = false;
        for (const [ox, oy, corner] of corners) {
          const p = rotPt(ox, oy);
          if (Math.sqrt((mx-p.x)**2 + (my-p.y)**2) < 10) {
            S.resizeCorner = { el, corner }; pushUndo(); hitCorner = true; break;
          }
        }
        if (hitCorner) return;
        // Check rotation handle
        const rh = rotPt(0, -(el.h/2 + 28));
        if (Math.sqrt((mx-rh.x)**2 + (my-rh.y)**2) < 10) {
          S.rotating = true; S.rotatEl = el;
          S.rotateCenter = { x: bcx, y: bcy };
          pushUndo(); return;
        }
      }
      // Distance: endpoint handles
      if (el.type === 'distance') {
        if (Math.sqrt((mx-el.x1)**2 + (my-el.y1)**2) < 10) {
          S.dragEndpoint = { el, which: 'start' }; pushUndo(); return;
        }
        if (Math.sqrt((mx-el.x2)**2 + (my-el.y2)**2) < 10) {
          S.dragEndpoint = { el, which: 'end' }; pushUndo(); return;
        }
      }
      // Road: endpoint handles (green ●)
      if (el.type === 'road' && el.points && el.points.length >= 2) {
        const p0 = el.points[0], pN = el.points[el.points.length - 1];
        if (Math.sqrt((mx-p0.x)**2 + (my-p0.y)**2) < 12) {
          S.dragEndpoint = { el, which: 'road-start' }; pushUndo(); return;
        }
        if (Math.sqrt((mx-pN.x)**2 + (my-pN.y)**2) < 12) {
          S.dragEndpoint = { el, which: 'road-end' }; pushUndo(); return;
        }
      }
      // Text: A+ / A- font size handles
      if (el.type === 'text') {
        const fs = el.fontSize || 14;
        ctx.save(); ctx.font = `${fs}px sans-serif`;
        const tw = ctx.measureText(el.text).width; ctx.restore();
        const hpx = el.x + tw + 14, hpy = el.y - 2;
        const hmx = hpx, hmy = el.y + fs + 6;
        if (Math.sqrt((mx-hpx)**2 + (my-hpy)**2) < 12) {
          el.fontSize = Math.min(72, (el.fontSize || 14) + 2); render(); return;
        }
        if (Math.sqrt((mx-hmx)**2 + (my-hmy)**2) < 12) {
          el.fontSize = Math.max(6,  (el.fontSize || 14) - 2); render(); return;
        }
      }
      // Arrow marker: click near TIP = rotate, otherwise drag (handled by normal flow below)
      if (el.type === 'marker' && el.markerType === 'arrow') {
        const s = el.scale || 1;
        const ang = (el.angle || 0) * Math.PI / 180;
        const L = 36 * s;
        const tipX = el.x + L * Math.cos(ang);
        const tipY = el.y + L * Math.sin(ang);
        if (Math.sqrt((mx-tipX)**2 + (my-tipY)**2) < 14) {
          S.rotating = true; S.rotatEl = el;
          S.rotateCenter = { x: el.x, y: el.y };
          pushUndo(); return;
        }
        // Falls through to normal drag
      }
    }
    if (e.shiftKey) {
      // Shift+click: toggle multi-selection (no drag)
      const hitIdx = hitTest(mx, my);
      if (hitIdx >= 0) {
        if (S.multiSelectedIdxs.includes(hitIdx)) {
          S.multiSelectedIdxs = S.multiSelectedIdxs.filter(i => i !== hitIdx);
          if (S.selectedIdx === hitIdx) S.selectedIdx = S.multiSelectedIdxs[0] ?? -1;
        } else {
          S.multiSelectedIdxs.push(hitIdx);
          if (S.selectedIdx < 0) S.selectedIdx = hitIdx;
        }
      }
    } else {
      S.multiSelectedIdxs = [];
      S.selectedIdx = hitTest(mx, my);
      if (S.selectedIdx >= 0) {
        S.multiSelectedIdxs = [S.selectedIdx];
        S.dragEl = S.elements[S.selectedIdx];
        S.dragOff = { x: mx, y: my };
        pushUndo();
      }
    }
    updateMergeBtn();
    render();
  } else if (S.tool === 'road') {
    S.currentPts.push({ x: mx, y: my });
    render();
  } else if (S.tool === 'building') {
    S.drawing = true;
    S.buildStart = { x: mx, y: my };
  } else if (S.tool === 'marker') {
    if (S.markerType === 'landmark' || S.markerType === 'pin') {
      const mtype = S.markerType;
      showModal('text-modal', txt => {
        addElement({ type: 'marker', x: mx, y: my, markerType: mtype, label: txt || '' });
      });
    } else {
      addElement({ type: 'marker', x: mx, y: my, markerType: S.markerType });
    }
  } else if (S.tool === 'text') {
    S.textPos = { x: mx, y: my };
    showModal('text-modal', txt => { if (txt) addElement({ type: 'text', x: mx, y: my, text: txt, fontSize: 14 }); });
  } else if (S.tool === 'distance') {
    if (!S.drawing) {
      S.drawing = true;
      S.distStart = { x: mx, y: my };
    } else {
      S.drawing = false;
      showModal('text-modal', txt => {
        addElement({ type: 'distance', x1: S.distStart.x, y1: S.distStart.y, x2: mx, y2: my, label: txt || '' });
      });
    }
  } else if (S.tool === 'symbol') {
    addElement({ type: 'symbol', x: mx, y: my, symType: currentSymType });
  } else if (S.tool === 'railroad') {
    S.currentPts.push({ x: mx, y: my });
    render();
  } else if (S.tool === 'boundary') {
    S.currentPts.push({ x: mx, y: my });
    render();
  } else if (S.tool === 'scalebar') {
    if (!S.drawing) {
      S.drawing = true;
      S.distStart = { x: mx, y: my };
    } else {
      S.drawing = false;
      const dx = mx - S.distStart.x, dy = my - S.distStart.y;
      const len = Math.sqrt(dx*dx + dy*dy);
      showModal('text-modal', txt => {
        addElement({ type: 'scalebar', x1: S.distStart.x, y1: S.distStart.y, x2: S.distStart.x + len, y2: S.distStart.y, label: txt || '10m' });
      });
    }
  }
});

// Double-click: finalize road/railroad
canvas.addEventListener('dblclick', e => {
  if ((S.tool === 'road' || S.tool === 'railroad') && S.currentPts.length >= 2) {
    const pts = [...S.currentPts];
    S.currentPts = [];
    if (S.tool === 'road') {
      showModal('road-modal', lbl => addElement({ type: 'road', points: pts, width: S.roadWidth, color: S.roadColor, label: lbl || '' }));
    } else {
      addElement({ type: 'railroad', points: pts, width: 16 });
    }
  } else if (S.tool === 'boundary' && S.currentPts.length >= 3) {
    const pts = [...S.currentPts];
    S.currentPts = [];
    addElement({ type: 'boundary', points: pts });
  }
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  // Compass drag (screen space)
  if (S.compassDragging) {
    S.compassX = sx; S.compassY = sy; render(); return;
  }
  // Pan
  if (S.panning && S.panStart) {
    S.viewOff.x = sx - S.panStart.x;
    S.viewOff.y = sy - S.panStart.y;
    render(); return;
  }
  const { x: wx, y: wy } = screenToWorld(sx, sy);
  mouseX = wx; mouseY = wy;
  document.getElementById('status-pos').textContent = `X: ${Math.round(wx)}, Y: ${Math.round(wy)}`;

  if (S.tool === 'select' && S.resizing && S.resizeEl) {
    const el = S.resizeEl;
    const dist = Math.sqrt((wx - el.x)**2 + (wy - el.y)**2);
    el.scale = Math.max(0.4, Math.min(6, dist / (S.resizeBase * 1.4)));
    render();
  } else if (S.tool === 'select' && S.resizeCorner) {
    // Building corner resize
    const { el, corner } = S.resizeCorner;
    const bcx = el.x + el.w/2, bcy = el.y + el.h/2;
    const ang = (el.angle || 0) * Math.PI / 180;
    const cosA = Math.cos(-ang), sinA = Math.sin(-ang);
    const dx = wx - bcx, dy = wy - bcy;
    const lx = dx*cosA - dy*sinA, ly = dx*sinA + dy*cosA;
    const newW = Math.max(20, Math.abs(lx) * 2);
    const newH = Math.max(20, Math.abs(ly) * 2);
    el.w = newW; el.h = newH;
    // Keep center fixed
    el.x = bcx - newW/2; el.y = bcy - newH/2;
    render();
  } else if (S.tool === 'select' && S.dragEndpoint) {
    const { el, which } = S.dragEndpoint;
    if (which === 'start') { el.x1 = wx; el.y1 = wy; }
    else if (which === 'end') { el.x2 = wx; el.y2 = wy; }
    else if (which === 'road-start' && el.points) { el.points[0] = { x: wx, y: wy }; }
    else if (which === 'road-end'   && el.points) { el.points[el.points.length - 1] = { x: wx, y: wy }; }
    render();
  } else if (S.tool === 'select' && S.rotating && S.rotatEl) {
    const dx2 = wx - S.rotateCenter.x, dy2 = wy - S.rotateCenter.y;
    const el = S.rotatEl;
    if (el.type === 'marker' && el.markerType === 'arrow') {
      // 矢印は右向きを0°として計算
      el.angle = Math.round(Math.atan2(dy2, dx2) * 180 / Math.PI);
    } else {
      // 建物など: 上向きを0°として計算
      el.angle = Math.round(Math.atan2(dx2, -dy2) * 180 / Math.PI);
    }
    render();
  } else if (S.tool === 'select' && S.dragEl) {
    const dx = wx - S.dragOff.x, dy = wy - S.dragOff.y;
    const el = S.dragEl;
    if (el.type === 'road' || el.type === 'railroad' || el.type === 'boundary') el.points.forEach(p => { p.x += dx; p.y += dy; });
    else if (el.type === 'building') { el.x += dx; el.y += dy; }
    else if (el.type === 'text' || el.type === 'marker' || el.type === 'symbol') { el.x += dx; el.y += dy; }
    else if (el.type === 'distance' || el.type === 'scalebar') { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy; }
    S.dragOff = { x: wx, y: wy };
    render();
  } else if (S.tool === 'road' && S.currentPts.length > 0) {
    render();
    ctx.save(); ctx.setTransform(S.viewScale, 0, 0, S.viewScale, S.viewOff.x, S.viewOff.y);
    const pts = [...S.currentPts, { x: wx, y: wy }];
    drawRoadShape(pts, S.roadWidth, S.roadColor, '#9ca3af');
    ctx.restore();
  } else if (S.tool === 'railroad' && S.currentPts.length > 0) {
    render();
    ctx.save(); ctx.setTransform(S.viewScale, 0, 0, S.viewScale, S.viewOff.x, S.viewOff.y);
    drawRailroad({ points: [...S.currentPts, { x: wx, y: wy }], width: 16 });
    ctx.restore();
  } else if (S.tool === 'building' && S.drawing) {
    render();
    ctx.save(); ctx.setTransform(S.viewScale, 0, 0, S.viewScale, S.viewOff.x, S.viewOff.y);
    const x = Math.min(S.buildStart.x, wx), y = Math.min(S.buildStart.y, wy);
    const w = Math.abs(wx - S.buildStart.x), h = Math.abs(wy - S.buildStart.y);
    ctx.fillStyle = 'rgba(229,231,235,0.5)'; ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    ctx.restore();
  } else if (S.tool === 'distance' && S.drawing) {
    render();
    ctx.save(); ctx.setTransform(S.viewScale, 0, 0, S.viewScale, S.viewOff.x, S.viewOff.y);
    ctx.strokeStyle = '#a5b4fc'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(S.distStart.x, S.distStart.y); ctx.lineTo(wx, wy); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  } else if (S.tool === 'boundary' && S.currentPts.length > 0) {
    render();
    ctx.save(); ctx.setTransform(S.viewScale, 0, 0, S.viewScale, S.viewOff.x, S.viewOff.y);
    ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 2; ctx.setLineDash([12, 3, 3, 3]);
    ctx.beginPath();
    ctx.moveTo(S.currentPts[0].x, S.currentPts[0].y);
    S.currentPts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(wx, wy);
    ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  } else if (S.tool === 'scalebar' && S.drawing) {
    render();
    ctx.save(); ctx.setTransform(S.viewScale, 0, 0, S.viewScale, S.viewOff.x, S.viewOff.y);
    const dx = mx - S.distStart.x, dy = my - S.distStart.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    ctx.strokeStyle = '#0f766e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(S.distStart.x, S.distStart.y); ctx.lineTo(S.distStart.x + len, S.distStart.y);
    ctx.stroke(); ctx.restore();
  }
});

canvas.addEventListener('mouseup', e => {
  if (S.compassDragging) { S.compassDragging = false; canvas.style.cursor = S.tool==='select'?'default':'crosshair'; return; }
  if (S.panning) { S.panning = false; S.panStart = null; canvas.style.cursor = spaceDown ? 'grab' : (S.tool==='select'?'default':'crosshair'); return; }
  if (S.tool === 'select') { S.dragEl = null; S.rotating = false; S.rotatEl = null; S.resizing = false; S.resizeEl = null; S.resizeCorner = null; S.dragEndpoint = null; }
  if (S.tool === 'building' && S.drawing) {
    S.drawing = false;
    const rect2 = canvas.getBoundingClientRect();
    const { x: mx, y: my } = screenToWorld(e.clientX - rect2.left, e.clientY - rect2.top);
    const x = Math.min(S.buildStart.x, mx), y = Math.min(S.buildStart.y, my);
    const w = Math.abs(mx - S.buildStart.x), h = Math.abs(my - S.buildStart.y);
    if (w > 5 && h > 5) {
      showModal('text-modal', txt => {
        addElement({ type: 'building', x, y, w, h, label: txt || '' });
      });
    }
  }
});

canvas.addEventListener('dblclick', () => {
  if (S.tool === 'road' && S.currentPts.length >= 2) {
    S.currentPts.pop(); // remove duplicate last point
    finishRoad();
  }
});

function finishRoad() {
  if (S.currentPts.length < 2) { S.currentPts = []; render(); return; }
  const pts = [...S.currentPts];
  const roadW = S.roadWidth;
  const roadC = S.roadColor;
  S.currentPts = [];
  showModal('road-modal', label => {
    addElement({ type: 'road', points: pts, width: roadW, color: roadC, label: label || '' });
  });
}

// ===== 配置図: 境界線描画 =====
function drawBoundary(el, selected) {
  if (!el.points || el.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 3, 3, 3]); // 一点鎖線
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  // 頂点マーカー（選択時）
  if (selected) {
    ctx.fillStyle = '#b91c1c';
    el.points.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
  }
  ctx.restore();
}

// ===== 配置図: 縮尺バー描画 =====
function drawScaleBar(el) {
  if (el.x1 === undefined) return;
  const len = Math.abs(el.x2 - el.x1);
  const x = Math.min(el.x1, el.x2);
  const y = el.y1;
  const tick = 8; // 端のティックの高さ
  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  // 水平バー
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + len, y);
  ctx.stroke();
  // 左ティック
  ctx.beginPath();
  ctx.moveTo(x, y - tick / 2); ctx.lineTo(x, y + tick / 2);
  ctx.stroke();
  // 右ティック
  ctx.beginPath();
  ctx.moveTo(x + len, y - tick / 2); ctx.lineTo(x + len, y + tick / 2);
  ctx.stroke();
  // ラベル（バーの上中央）
  ctx.fillText(el.label || '', x + len / 2, y - tick / 2 - 2);
  ctx.restore();
}


// ===== Keyboard =====
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'Enter') {
    if (S.tool === 'road' && S.currentPts.length >= 2) finishRoad();
    if (S.tool === 'boundary' && S.currentPts.length >= 3) {
      const pts = [...S.currentPts]; S.currentPts = [];
      addElement({ type: 'boundary', points: pts }); render();
    }
  }
  if (e.key === 'Delete' && S.selectedIdx >= 0) {
    pushUndo();
    S.elements.splice(S.selectedIdx, 1);
    S.selectedIdx = -1;
    render();
  }
  if (e.key === 'Escape') {
    S.currentPts = [];
    S.drawing = false;
    S.selectedIdx = -1;
    render();
  }
});

// ===== Paste/Drop =====
document.addEventListener('paste', e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      loadImageFromBlob(item.getAsFile());
      break;
    }
  }
});

container.addEventListener('dragover', e => { e.preventDefault(); container.classList.add('drag-hover'); });
container.addEventListener('dragleave', () => container.classList.remove('drag-hover'));
container.addEventListener('drop', e => {
  e.preventDefault();
  container.classList.remove('drag-hover');
  const file = e.dataTransfer.files[0];
  if (file?.type.startsWith('image/')) loadImageFromBlob(file);
});

function loadImageFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => { S.refImg = img; hideDropZone(); render(); };
  img.src = url;
}

function hideDropZone() { document.getElementById('drop-zone').classList.add('hidden'); }

// ===== Modal helpers =====
let modalCb = null;
function showModal(id, cb) {
  modalCb = cb;
  const modal = document.getElementById(id);
  modal.style.display = 'flex';
  const input = modal.querySelector('input[type="text"]');
  if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }
}

function closeModal(id, value) {
  document.getElementById(id).style.display = 'none';
  if (modalCb) { modalCb(value); modalCb = null; }
}

// Text modal
document.getElementById('text-ok').onclick = () => closeModal('text-modal', document.getElementById('text-input').value);
document.getElementById('text-cancel').onclick = () => closeModal('text-modal', null);
document.getElementById('text-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('text-ok').click(); });

// Road label modal
document.getElementById('road-label-ok').onclick = () => closeModal('road-modal', document.getElementById('road-label-input').value);
document.getElementById('road-label-skip').onclick = () => closeModal('road-modal', '');
document.getElementById('road-label-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('road-label-ok').click(); });

// ===== UI Bindings =====
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.tool = btn.dataset.tool;
    S.currentPts = []; S.drawing = false;
    document.getElementById('status-tool').textContent = `ツール: ${btn.querySelector('.tool-label').textContent}`;
    document.getElementById('road-options').style.display = S.tool === 'road' ? '' : 'none';
    document.getElementById('marker-options').style.display = S.tool === 'marker' ? '' : 'none';
    document.getElementById('symbol-options').style.display = S.tool === 'symbol' ? '' : 'none';
    canvas.style.cursor = S.tool === 'select' ? 'default' : 'crosshair';
  });
});

// Symbol type selection
let currentSymType = 'signal';
document.querySelectorAll('.symbol-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.symbol-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSymType = btn.dataset.sym;
  });
});

document.querySelectorAll('.marker-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.marker-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.markerType = btn.dataset.marker;
  });
});

document.getElementById('road-width').oninput = e => { S.roadWidth = +e.target.value; document.getElementById('road-width-val').textContent = e.target.value; };
document.getElementById('road-color').onchange = e => { S.roadColor = e.target.value; };
document.getElementById('ref-opacity').oninput = e => { S.refOpacity = e.target.value / 100; document.getElementById('ref-opacity-val').textContent = e.target.value + '%'; render(); };
document.getElementById('ref-visible').onchange = e => { S.showRef = e.target.checked; render(); };
// Smooth slider
const smoothEl = document.getElementById('smooth-level');
const smoothVal = document.getElementById('smooth-level-val');
if (smoothEl && smoothVal) smoothEl.oninput = e => { smoothVal.textContent = e.target.value + 'px'; };

// Vectorize slider bindings
const vecSliders = [
  { id: 'vec-sensitivity', valId: 'vec-sensitivity-val', suffix: '' },
  { id: 'vec-blur',        valId: 'vec-blur-val',        suffix: 'px' },
  { id: 'vec-epsilon',     valId: 'vec-epsilon-val',     suffix: '' },
  { id: 'vec-minlen',      valId: 'vec-minlen-val',      suffix: 'px' },
  { id: 'vec-snap',        valId: 'vec-snap-val',        suffix: 'px' },
];
vecSliders.forEach(({ id, valId, suffix }) => {
  const el = document.getElementById(id);
  const valEl = document.getElementById(valId);
  if (el && valEl) el.oninput = e => { valEl.textContent = e.target.value + suffix; };
});
document.getElementById('show-grid').onchange = e => { S.showGrid = e.target.checked; render(); };
document.getElementById('show-compass').onchange = e => {
  S.showCompass = e.target.checked;
  document.getElementById('compass-controls').style.display = e.target.checked ? '' : 'none';
  render();
};
document.getElementById('compass-angle').oninput = e => {
  S.compassAngle = +e.target.value;
  document.getElementById('compass-angle-val').textContent = e.target.value + '°';
  render();
};
document.getElementById('btn-compass-reset').onclick = () => {
  S.compassX = null; S.compassY = null; render();
};

// Zoom buttons
function zoomAt(delta) {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const newScale = Math.max(0.1, Math.min(20, S.viewScale * delta));
  S.viewOff.x = cx - (cx - S.viewOff.x) * (newScale / S.viewScale);
  S.viewOff.y = cy - (cy - S.viewOff.y) * (newScale / S.viewScale);
  S.viewScale = newScale;
  render();
}
document.getElementById('btn-zoom-in').onclick    = () => zoomAt(1.25);
document.getElementById('btn-zoom-out').onclick   = () => zoomAt(0.8);
document.getElementById('btn-zoom-reset').onclick = () => { S.viewScale = 1; S.viewOff = { x: 0, y: 0 }; render(); };

document.getElementById('btn-undo').onclick = undo;
document.getElementById('btn-redo').onclick = () => {};

// Clear button - double click safety
const clearBtn = document.getElementById('btn-clear');
let clearPending = false;
clearBtn.onclick = () => {
  if (!clearPending) {
    clearPending = true;
    clearBtn.textContent = '⚠ 本当に消去？';
    clearBtn.style.background = '#7f1d1d';
    setTimeout(() => { clearPending = false; clearBtn.textContent = '🗑 全消去'; clearBtn.style.background = ''; }, 3000);
  } else {
    pushUndo(); S.elements = []; S.selectedIdx = -1;
    clearPending = false; clearBtn.textContent = '🗑 全消去'; clearBtn.style.background = '';
    render();
  }
};

// File input
const fileInput = document.getElementById('file-input');
document.getElementById('btn-load-ref').onclick = () => fileInput.click();
document.getElementById('btn-browse').onclick = () => fileInput.click();
document.getElementById('btn-skip').onclick = hideDropZone;
fileInput.onchange = e => { if (e.target.files[0]) loadImageFromBlob(e.target.files[0]); };

// Export
document.getElementById('btn-export').onclick = () => {
  const origRef = S.showRef, origGrid = S.showGrid, origSel = S.selectedIdx;
  S.showRef = false; S.showGrid = false; S.selectedIdx = -1;
  render();
  exportCanvas(canvas, () => {
    S.showRef = origRef; S.showGrid = origGrid; S.selectedIdx = origSel;
    render();
  });
};

// ===== Auto Simplify =====
function autoSimplify(mapTypeOverride) {
  if (!S.refImg) { alert('先に参照画像を読み込んでください'); return; }
  const mapType = mapTypeOverride || document.querySelector('.map-type-btn.active')?.dataset.maptype || 'google';
  const w = canvas.width, h = canvas.height;
  const scale = Math.min(w / S.refImg.width, h / S.refImg.height);
  const iw = S.refImg.width * scale, ih = S.refImg.height * scale;
  const ox = (w - iw) / 2, oy = (h - ih) / 2;

  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const oc = off.getContext('2d');
  oc.fillStyle = '#fff'; oc.fillRect(0, 0, w, h);
  // Pre-blur: 0.5px on source to stabilize thin lines before thresholding
  oc.filter = 'blur(0.5px)';
  oc.drawImage(S.refImg, ox, oy, iw, ih);
  oc.filter = 'none';

  const src = oc.getImageData(0, 0, w, h);
  const d = src.data;

  const mTop = Math.floor(h * 0.10);
  const mBot = Math.floor(h * 0.08);
  const mLR  = Math.floor(w * 0.03);

  const binary = new Uint8Array(w * h);

  if (mapType === 'gsi') {
    // ── 地理院地図ベクターモード ──────────────────────────────────────
    // Lines are thin black on white. After scaling, thin lines become gray.
    const mLeft   = Math.floor(w * 0.28);
    const mTopGSI = Math.floor(h * 0.18);
    for (let y = mTopGSI; y < h - mBot; y++) {
      for (let x = mLeft; x < w - mLR; x++) {
        const i = y * w + x;
        const bright = (d[i*4] + d[i*4+1] + d[i*4+2]) / 3;
        binary[i] = bright < 220 ? 1 : 0;
      }
    }

  } else if (mapType === 'haichizu') {
    // ── 配置図専用: Googleマップ高ズームから道路外周+建物輪郭 ──────────
    const sz = w * h;
    const maskR = new Uint8Array(sz);
    const maskB = new Uint8Array(sz);
    for (let y=1; y<h-1; y++) for (let x=1; x<w-1; x++) {
      const i=y*w+x, r=d[i*4], g=d[i*4+1], b=d[i*4+2];
      const bright=(r+g+b)/3;
      const isRoad = b>r+5 && bright>110 && bright<235;
      const spread = Math.max(r,g,b)-Math.min(r,g,b);
      if (isRoad) maskR[i]=1;
      else if (spread<22 && bright>155 && bright<228) maskB[i]=1;
    }
    // 道路: 外周のみ（BFS穴埋めで内側エッジを除去）
    const extF=new Uint8Array(sz), ffq2=[];
    for (let x=0; x<w; x++) {
      if (!maskR[x])         { extF[x]=1;         ffq2.push(x); }
      if (!maskR[(h-1)*w+x]) { extF[(h-1)*w+x]=1; ffq2.push((h-1)*w+x); }
    }
    for (let y=1; y<h-1; y++) {
      if (!maskR[y*w])     { extF[y*w]=1;     ffq2.push(y*w); }
      if (!maskR[y*w+w-1]) { extF[y*w+w-1]=1; ffq2.push(y*w+w-1); }
    }
    for (let qi=0; qi<ffq2.length; qi++) {
      const idx=ffq2[qi], cy=Math.floor(idx/w), cx=idx%w;
      if (cy>0   && !maskR[idx-w] && !extF[idx-w]) { extF[idx-w]=1; ffq2.push(idx-w); }
      if (cy<h-1 && !maskR[idx+w] && !extF[idx+w]) { extF[idx+w]=1; ffq2.push(idx+w); }
      if (cx>0   && !maskR[idx-1] && !extF[idx-1]) { extF[idx-1]=1; ffq2.push(idx-1); }
      if (cx<w-1 && !maskR[idx+1] && !extF[idx+1]) { extF[idx+1]=1; ffq2.push(idx+1); }
    }
    const intL2=new Int32Array(sz).fill(-1), intS2=[]; let ilb2=0;
    for (let i=0; i<sz; i++) {
      if (maskR[i]||extF[i]||intL2[i]>=0) continue;
      const iq=[i]; intL2[i]=ilb2; let isz=0,qi2=0;
      while (qi2<iq.length) {
        const idx=iq[qi2++]; isz++;
        const cy=Math.floor(idx/w), cx=idx%w;
        if (cy>0   && !maskR[idx-w] && !extF[idx-w] && intL2[idx-w]<0) { intL2[idx-w]=ilb2; iq.push(idx-w); }
        if (cy<h-1 && !maskR[idx+w] && !extF[idx+w] && intL2[idx+w]<0) { intL2[idx+w]=ilb2; iq.push(idx+w); }
        if (cx>0   && !maskR[idx-1] && !extF[idx-1] && intL2[idx-1]<0) { intL2[idx-1]=ilb2; iq.push(idx-1); }
        if (cx<w-1 && !maskR[idx+1] && !extF[idx+1] && intL2[idx+1]<0) { intL2[idx+1]=ilb2; iq.push(idx+1); }
      }
      intS2[ilb2]=isz; ilb2++;
    }
    const filled2=new Uint8Array(sz);
    for (let i=0; i<sz; i++) {
      if (maskR[i]) { filled2[i]=1; continue; }
      if (extF[i])  { filled2[i]=0; continue; }
      const lb=intL2[i];
      filled2[i]=(lb>=0 && intS2[lb]<=300)?1:0;
    }
    for (let y=1; y<h-1; y++) for (let x=1; x<w-1; x++) {
      const i=y*w+x;
      if (filled2[i]&&(!filled2[i-1]||!filled2[i+1]||!filled2[i-w]||!filled2[i+w])) binary[i]=1;
    }
    // 建物: 全輪郭
    for (let y=1; y<h-1; y++) for (let x=1; x<w-1; x++) {
      const i=y*w+x;
      if (maskB[i]&&(!maskB[i-1]||!maskB[i+1]||!maskB[i-w]||!maskB[i+w])) binary[i]=1;
    }

  } else if (mapType === 'itsumonavi_road' || mapType === 'itsumonavi_river' || mapType === 'itsumonavi') {
    // ── いつもNAVI モード ─────────────────────────────────────────────
    // 道路：純白 (RGB ≈ 255,255,255)、背景グレー(≈235,235,235)から明確に区別
    // 河川：水色シアン (B≫R, G≫R、B+G>370 でヘッダー紺色を除外)
    const useRoad  = mapType === 'itsumonavi_road'  || mapType === 'itsumonavi';
    const useRiver = mapType === 'itsumonavi_river' || mapType === 'itsumonavi';
    const maskRoad  = new Uint8Array(w * h);
    const maskRiver = new Uint8Array(w * h);
    for (let y = mTop; y < h - mBot; y++) {
      for (let x = mLR; x < w - mLR; x++) {
        const i = y * w + x;
        const r = d[i*4], g = d[i*4+1], b = d[i*4+2];
        // 道路（白）
        if (useRoad && r > 248 && g > 248 && b > 248) maskRoad[i] = 1;
        // 河川（水色）: R≈125, G≈200, B≈220 付近
        if (useRiver && b > 175 && g > 148 && r < 168
                     && b > r + 50 && g > r + 30
                     && b + g > 370) maskRiver[i] = 1;
      }
    }
    // 道路エッジ検出: 内部領域をサイズで分類してドット除去
    // 小領域（道路標示・文字）→ 塗りつぶし → ドット消去
    // 大領域（道路間の背景）  → 外部と同様扱い → 両面エッジ検出
    if (useRoad) {
      const DOT_HOLE_MAX = 500; // この画素数以下の内部穴 = 道路標示
      const sz2 = w * h;

      // Step1: 画像端BFSで外部非道路を特定
      const extFill = new Uint8Array(sz2);
      const ffq = [];
      for (let x = 0; x < w; x++) {
        if (!maskRoad[x])         { extFill[x]=1;         ffq.push(x); }
        if (!maskRoad[(h-1)*w+x]) { extFill[(h-1)*w+x]=1; ffq.push((h-1)*w+x); }
      }
      for (let y = 1; y < h-1; y++) {
        if (!maskRoad[y*w])     { extFill[y*w]=1;      ffq.push(y*w); }
        if (!maskRoad[y*w+w-1]) { extFill[y*w+w-1]=1;  ffq.push(y*w+w-1); }
      }
      for (let qi=0; qi<ffq.length; qi++) {
        const idx=ffq[qi], cy=Math.floor(idx/w), cx=idx%w;
        if (cy>0   && !maskRoad[idx-w] && !extFill[idx-w]) { extFill[idx-w]=1; ffq.push(idx-w); }
        if (cy<h-1 && !maskRoad[idx+w] && !extFill[idx+w]) { extFill[idx+w]=1; ffq.push(idx+w); }
        if (cx>0   && !maskRoad[idx-1] && !extFill[idx-1]) { extFill[idx-1]=1; ffq.push(idx-1); }
        if (cx<w-1 && !maskRoad[idx+1] && !extFill[idx+1]) { extFill[idx+1]=1; ffq.push(idx+1); }
      }

      // Step2: 内部領域（外部にもdashRoadにも属さない）をBFSでラベリング・サイズ計測
      const intLabel = new Int32Array(sz2).fill(-1);
      const intSizes = [];
      let ilb = 0;
      for (let i = 0; i < sz2; i++) {
        if (maskRoad[i] || extFill[i] || intLabel[i] >= 0) continue;
        const iq = [i]; intLabel[i] = ilb;
        let isz = 0, qi2 = 0;
        while (qi2 < iq.length) {
          const idx=iq[qi2++]; isz++;
          const cy=Math.floor(idx/w), cx=idx%w;
          if (cy>0   && !maskRoad[idx-w] && !extFill[idx-w] && intLabel[idx-w]<0) { intLabel[idx-w]=ilb; iq.push(idx-w); }
          if (cy<h-1 && !maskRoad[idx+w] && !extFill[idx+w] && intLabel[idx+w]<0) { intLabel[idx+w]=ilb; iq.push(idx+w); }
          if (cx>0   && !maskRoad[idx-1] && !extFill[idx-1] && intLabel[idx-1]<0) { intLabel[idx-1]=ilb; iq.push(idx-1); }
          if (cx<w-1 && !maskRoad[idx+1] && !extFill[idx+1] && intLabel[idx+1]<0) { intLabel[idx+1]=ilb; iq.push(idx+1); }
        }
        intSizes[ilb] = isz; ilb++;
      }

      // Step3: filled配列作成（道路 + 小内部穴 = 1、外部 + 大内部領域 = 0）
      const filled = new Uint8Array(sz2);
      for (let i = 0; i < sz2; i++) {
        if (maskRoad[i]) { filled[i] = 1; continue; }
        if (extFill[i])  { filled[i] = 0; continue; }
        const lb = intLabel[i];
        filled[i] = (lb >= 0 && intSizes[lb] <= DOT_HOLE_MAX) ? 1 : 0;
      }

      // Step4: filledのエッジ検出
      for (let y=1; y<h-1; y++) for (let x=1; x<w-1; x++) {
        const i=y*w+x;
        if (filled[i] && (!filled[i-1]||!filled[i+1]||!filled[i-w]||!filled[i+w])) binary[i]=1;
      }
    }
    // 河川 → 塗りつぶし（河川面積を可視化）
    if (useRiver) {
      for (let i = 0; i < w * h; i++) { if (maskRiver[i]) binary[i] = 1; }
    }

  } else {
    // ── Googleマップ系モード ─────────────────────────────────────────
    // Road: blue-gray (B>R+6), Building: neutral gray (low spread, no blue tint)
    const mask = new Uint8Array(w * h);
    for (let y = mTop; y < h - mBot; y++) {
      for (let x = mLR; x < w - mLR; x++) {
        const i = y * w + x;
        const r = d[i*4], g = d[i*4+1], b = d[i*4+2];
        const bright = (r + g + b) / 3;
        const isRoad     = b > r + 6 && b > g + 2 && bright > 120 && bright < 230;
        const spread     = Math.max(r,g,b) - Math.min(r,g,b);
        const isBuilding = spread < 22 && bright > 155 && bright < 230 && !isRoad;

        if      (mapType === 'road')     { if (isRoad)                mask[i] = 1; }
        else if (mapType === 'building') { if (isBuilding)            mask[i] = 1; }
        else                             { if (isRoad || isBuilding)  mask[i] = 1; }
      }
    }
    // For building-only mode: fill entire building area (not just outline)
    if (mapType === 'building') {
      for (let i = 0; i < w * h; i++) { if (mask[i]) binary[i] = 1; }
    } else {
      // Outline only (boundary pixels)
      for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
        const i = y*w+x;
        if (mask[i] && (!mask[i-1]||!mask[i+1]||!mask[i-w]||!mask[i+w])) binary[i] = 1;
      }
    }
  }

  // ── BFS: remove tiny blobs + bounding box tracking ─────────────────
  const labels = new Int32Array(w * h).fill(-1);
  const sizes  = [];
  const bboxX0 = [], bboxX1 = [], bboxY0 = [], bboxY1 = [];
  let label = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y*w+x;
      if (binary[start]===0 || labels[start]!==-1) continue;
      const queue=[start]; labels[start]=label;
      let size=0, qi=0;
      let x0=x, x1=x, y0=y, y1=y;
      while (qi<queue.length) {
        const idx=queue[qi++]; size++;
        const cy=Math.floor(idx/w), cx=idx%w;
        if (cx<x0) x0=cx; if (cx>x1) x1=cx;
        if (cy<y0) y0=cy; if (cy>y1) y1=cy;
        for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
          if (dy===0&&dx===0) continue;
          const ny=cy+dy, nx=cx+dx;
          if (ny<0||ny>=h||nx<0||nx>=w) continue;
          const nidx=ny*w+nx;
          if (binary[nidx]===1&&labels[nidx]===-1) { labels[nidx]=label; queue.push(nidx); }
        }
      }
      sizes[label]=size;
      bboxX0[label]=x0; bboxX1[label]=x1;
      bboxY0[label]=y0; bboxY1[label]=y1;
      label++;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  const minSize = mapType === 'gsi'              ? 30
                : mapType === 'itsumonavi_road'  ? 50
                : mapType === 'itsumonavi_river' ? 80
                : mapType === 'itsumonavi'       ? 50
                : 60;

  // いつもNAVI道路モード: 「閉ループ判定」でドットを除去
  // 道路エッジ = 開いたパス（4方向隣接が1個以下の端点ピクセルが存在）→ 保持
  // ドット    = 閉じたループ（全ピクセルが2個以上の4方向隣接を持つ）   → 除去
  const isRoadDotMode = mapType === 'itsumonavi_road' || mapType === 'itsumonavi';
  const hasEndpoint = new Uint8Array(label);
  if (isRoadDotMode) {
    for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
      const i = y*w+x;
      const lb = labels[i];
      if (lb < 0 || hasEndpoint[lb]) continue;
      let n = 0;
      if (binary[i-1]) n++;
      if (binary[i+1]) n++;
      if (binary[i-w]) n++;
      if (binary[i+w]) n++;
      if (n <= 1) hasEndpoint[lb] = 1; // 端点または孤立ピクセル → 開いたパス
    }
  }
  const validLabel = new Uint8Array(label);
  for (let lb = 0; lb < label; lb++) {
    const sz = sizes[lb];
    if (sz < minSize) { validLabel[lb] = 0; continue; }
    if (isRoadDotMode && sz < 800 && !hasEndpoint[lb]) {
      // 小さい閉ループ（端点なし）= ドット → 除去
      // 念のため縦横比も確認（縦横比が大きければ細長い → 保持）
      const bw = bboxX1[lb] - bboxX0[lb] + 1;
      const bh = bboxY1[lb] - bboxY0[lb] + 1;
      const elongation = Math.min(bw,bh) > 0 ? Math.max(bw,bh) / Math.min(bw,bh) : 99;
      if (elongation < 3.0) { validLabel[lb] = 0; continue; }
    }
    validLabel[lb] = 1;
  }

  const out = oc.createImageData(w, h);
  for (let i=0; i<w*h; i++) {
    const v = (labels[i]>=0 && validLabel[labels[i]]) ? 0 : 255;
    out.data[i*4]=v; out.data[i*4+1]=v; out.data[i*4+2]=v; out.data[i*4+3]=255;
  }
  oc.putImageData(out, 0, 0);

  // ── Smoothing: blur → re-threshold ────────────────────────────────
  const smoothEl2 = document.getElementById('smooth-level');
  const smoothLevel = smoothEl2 ? parseFloat(smoothEl2.value ?? 1.5) : 1.5;
  if (smoothLevel > 0) {
    const sm = document.createElement('canvas');
    sm.width = w; sm.height = h;
    const sc2 = sm.getContext('2d');
    sc2.filter = `blur(${smoothLevel}px)`;
    sc2.drawImage(off, 0, 0);
    sc2.filter = 'none';
    const smData = sc2.getImageData(0, 0, w, h);
    const smOut = sc2.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = smData.data[i*4] < 128 ? 0 : 255;
      smOut.data[i*4] = v; smOut.data[i*4+1] = v; smOut.data[i*4+2] = v; smOut.data[i*4+3] = 255;
    }
    sc2.putImageData(smOut, 0, 0);
    // Bake smoothed canvas
    pushUndo();
    S.elements = S.elements.filter(el => el.type !== 'trace');
    const traceImg2 = new Image();
    traceImg2.onload = () => {
      S.elements.unshift({ type: 'trace', _img: traceImg2 });
      render();
    };
    traceImg2.src = sm.toDataURL();
    return;
  }

  pushUndo();
  S.elements = S.elements.filter(el => el.type !== 'trace');
  const traceImg = new Image();
  traceImg.onload = () => {
    S.elements.unshift({ type: 'trace', _img: traceImg });
    render();
  };
  traceImg.src = off.toDataURL();
}

// ===== Auto Vectorize (Case A) =====
// Pipeline: Color classify → Morphology → Zhang-Suen skeleton → Path trace → Douglas-Peucker → road elements

function autoVectorize() {
  if (!S.refImg) { alert('先に参照画像を読み込んでください'); return; }

  const btn = document.getElementById('btn-vectorize');
  if (btn) { btn.textContent = '⏳ 処理中...'; btn.disabled = true; }

  // Use setTimeout to allow UI to update before heavy processing
  setTimeout(() => {
    try {
      _doVectorize();
    } finally {
      if (btn) { btn.textContent = '🛣️ ベクタートレース'; btn.disabled = false; }
    }
  }, 50);
}

function _doVectorize() {
  const w = canvas.width, h = canvas.height;
  const scale = Math.min(w / S.refImg.width, h / S.refImg.height);
  const iw = S.refImg.width * scale, ih = S.refImg.height * scale;
  const ox = (w - iw) / 2, oy = (h - ih) / 2;

  // ── STEP 1: Draw reference image with text-suppression blur ──────────
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const oc = off.getContext('2d');
  oc.fillStyle = '#fff'; oc.fillRect(0, 0, w, h);

  const blurPx = parseFloat(document.getElementById('vec-blur')?.value ?? 2);
  oc.filter = `blur(${blurPx}px)`;
  oc.drawImage(S.refImg, ox, oy, iw, ih);
  oc.filter = 'none';

  const src = oc.getImageData(0, 0, w, h).data;

  // ── STEP 2: Pixel classification (road / water / railroad) ──────────
  const mTop = Math.floor(h * 0.12);
  const mBot = Math.floor(h * 0.08);
  const mLR  = Math.floor(w * 0.04);

  const roadMask  = new Uint8Array(w * h);
  const waterMask = new Uint8Array(w * h);
  const railMask  = new Uint8Array(w * h);

  const sensitivity = parseFloat(document.getElementById('vec-sensitivity')?.value ?? 4);

  for (let y = mTop; y < h - mBot; y++) {
    for (let x = mLR; x < w - mLR; x++) {
      const i = y * w + x;
      const r = src[i*4], g = src[i*4+1], b = src[i*4+2];
      const brightness = (r + g + b) / 3;
      const spread = Math.max(r,g,b) - Math.min(r,g,b);

      // Railroad: dark neutral gray thin lines
      if (brightness < 95 && spread < 35 && brightness > 15) {
        railMask[i] = 1; continue;
      }
      // Water/river: cyan-blue (BOTH G and B well above R)
      // Google Maps rivers: R≈150, G≈200, B≈216 → g-r≈50, b-r≈66
      // Google Maps roads:  R≈176, G≈196, B≈216 → g-r≈20, b-r≈40
      // Key distinction: rivers have g > r+25, roads have g <= r+25
      if (g > r + 25 && b > r + 20 && brightness > 130 && brightness < 240) {
        waterMask[i] = 1; continue;
      }
      // Road: blue-gray (B above R by sensitivity threshold, G NOT as elevated as water)
      if (b > r + sensitivity && brightness > 100 && brightness < 230) {
        roadMask[i] = 1;
      }
    }
  }

  // ── STEP 3: Morphological closing per mask ────────────────────────────
  function dilateR(mask, rad) {
    const out = new Uint8Array(w * h);
    for (let y = rad; y < h - rad; y++) for (let x = rad; x < w - rad; x++) {
      outer: for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (mask[(y+dy)*w+(x+dx)]) { out[y*w+x] = 1; break outer; }
      }
    }
    return out;
  }
  function erodeR(mask, rad) {
    const out = new Uint8Array(w * h);
    for (let y = rad; y < h - rad; y++) for (let x = rad; x < w - rad; x++) {
      let all = true;
      outer: for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (!mask[(y+dy)*w+(x+dx)]) { all = false; break outer; }
      }
      if (all) out[y*w+x] = 1;
    }
    return out;
  }
  function removeTinyBlobs(mask, minSize) {
    const visited = new Uint8Array(w * h), out = new Uint8Array(w * h);
    for (let start = 0; start < w * h; start++) {
      if (!mask[start] || visited[start]) continue;
      const queue = [start], blob = [start]; visited[start] = 1; let qi = 0;
      while (qi < queue.length) {
        const idx = queue[qi++]; const cy = Math.floor(idx/w), cx = idx%w;
        for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
          if (!dy&&!dx) continue;
          const ny=cy+dy,nx=cx+dx;
          if (ny<0||ny>=h||nx<0||nx>=w) continue;
          const ni=ny*w+nx;
          if (mask[ni]&&!visited[ni]){visited[ni]=1;queue.push(ni);blob.push(ni);}
        }
      }
      if (blob.length >= minSize) blob.forEach(i => { out[i]=1; });
    }
    return out;
  }

  // Road: closing r=5 (larger radius fills intersection gaps better)
  let cleanRoad  = removeTinyBlobs(erodeR(dilateR(roadMask, 5), 5), 80);
  // Water: closing r=2
  let cleanWater = removeTinyBlobs(erodeR(dilateR(waterMask, 2), 2), 40);
  // Railroad: NO dilation (preserve thin lines), just remove tiny noise
  let cleanRail  = removeTinyBlobs(railMask, 15);

  // ── STEP 4: Zhang-Suen Thinning ─────────────────────────────────────
  function zhangSuenThin(mask) {
    const img = new Uint8Array(mask);
    const toRemove = [];
    function p(y,x){return(y>=0&&y<h&&x>=0&&x<w)?img[y*w+x]:0;}
    function transitions(y,x){
      const n=[p(y-1,x),p(y-1,x+1),p(y,x+1),p(y+1,x+1),
               p(y+1,x),p(y+1,x-1),p(y,x-1),p(y-1,x-1),p(y-1,x)];
      let t=0; for(let i=0;i<8;i++) if(n[i]===0&&n[i+1]===1)t++; return t;
    }
    function nbCount(y,x){return p(y-1,x)+p(y-1,x+1)+p(y,x+1)+p(y+1,x+1)+p(y+1,x)+p(y+1,x-1)+p(y,x-1)+p(y-1,x-1);}
    let changed=true, iter=0;
    while(changed&&iter<200){
      iter++; changed=false; toRemove.length=0;
      for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){
        if(!img[y*w+x])continue;
        const n2=nbCount(y,x),tr=transitions(y,x);
        if(n2>=2&&n2<=6&&tr===1&&p(y-1,x)*p(y,x+1)*p(y+1,x)===0&&p(y,x+1)*p(y+1,x)*p(y,x-1)===0)
          toRemove.push(y*w+x);
      }
      toRemove.forEach(i=>{img[i]=0;changed=true;}); toRemove.length=0;
      for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){
        if(!img[y*w+x])continue;
        const n2=nbCount(y,x),tr=transitions(y,x);
        if(n2>=2&&n2<=6&&tr===1&&p(y-1,x)*p(y,x+1)*p(y,x-1)===0&&p(y-1,x)*p(y+1,x)*p(y,x-1)===0)
          toRemove.push(y*w+x);
      }
      toRemove.forEach(i=>{img[i]=0;changed=true;});
    }
    return img;
  }

  // ── STEP 5: Path tracing (greedy walk) ───────────────────────────────
  function tracePaths(skel) {
    const visited = new Uint8Array(w * h), paths = [];
    function at(y,x){return(y>=0&&y<h&&x>=0&&x<w)?skel[y*w+x]:0;}
    function nb(y,x){let c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dy&&!dx)continue;if(at(y+dy,x+dx))c++;}return c;}
    function walk(sy,sx){
      const pts=[{x:sx,y:sy}]; visited[sy*w+sx]=1;
      let cy=sy,cx=sx;
      while(true){
        // Prefer 4-connected (smoother), then 8-connected
        let ny=-1,nx=-1;
        for(const[dy,dx] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]){
          const ry=cy+dy,rx=cx+dx;
          if(ry<0||ry>=h||rx<0||rx>=w)continue;
          if(skel[ry*w+rx]&&!visited[ry*w+rx]){ny=ry;nx=rx;break;}
        }
        if(ny<0)break;
        visited[ny*w+nx]=1; pts.push({x:nx,y:ny}); cy=ny; cx=nx;
      }
      return pts;
    }
    // Start from endpoints first (1 neighbor), then remaining
    for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){
      if(!skel[y*w+x]||visited[y*w+x])continue;
      if(nb(y,x)<=1){const pts=walk(y,x);if(pts.length>=5)paths.push(pts);}
    }
    for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){
      if(!skel[y*w+x]||visited[y*w+x])continue;
      const pts=walk(y,x); if(pts.length>=5)paths.push(pts);
    }
    return paths;
  }

  // ── STEP 6: Douglas-Peucker ──────────────────────────────────────────
  function douglasPeucker(pts, eps) {
    if(pts.length<=2)return pts;
    let maxD=0,maxI=0;
    const p1=pts[0],p2=pts[pts.length-1];
    const dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.sqrt(dx*dx+dy*dy)||1;
    for(let i=1;i<pts.length-1;i++){
      const d=Math.abs(dy*pts[i].x-dx*pts[i].y+p2.x*p1.y-p2.y*p1.x)/len;
      if(d>maxD){maxD=d;maxI=i;}
    }
    if(maxD>eps){
      return[...douglasPeucker(pts.slice(0,maxI+1),eps).slice(0,-1),...douglasPeucker(pts.slice(maxI),eps)];
    }
    return[pts[0],pts[pts.length-1]];
  }

  // ── STEP 7: Generate elements ────────────────────────────────────────
  const epsilon    = parseFloat(document.getElementById('vec-epsilon')?.value ?? 3);
  const minPathLen = parseInt(document.getElementById('vec-minlen')?.value ?? 15);
  const snapRadius = parseFloat(document.getElementById('vec-snap')?.value ?? 15);

  function buildElements(skel, minLen, eps, makeEl) {
    const result = [];
    tracePaths(skel).forEach(pts => {
      if (pts.length < minLen) return;
      const s = douglasPeucker(pts, eps);
      if (s.length >= 2) result.push(makeEl(s));
    });
    return result;
  }

  // ── STEP 7b: Endpoint snapping (connects fragmented road segments) ────
  // After simplification, nearby endpoints (within snapRadius px) are merged.
  // This fixes the gaps that occur when path tracing stops at junction pixels.
  function snapEndpoints(elems, radius) {
    if (radius <= 0) return;
    const r2 = radius * radius;
    // Build list of all endpoints
    const eps = [];
    elems.forEach((el, ei) => {
      const pts = el.points;
      if (!pts || pts.length < 2) return;
      eps.push({ ei, isStart: true,  x: pts[0].x,            y: pts[0].y });
      eps.push({ ei, isStart: false, x: pts[pts.length-1].x, y: pts[pts.length-1].y });
    });
    // For each endpoint, snap to nearest other endpoint within radius
    eps.forEach((a, ai) => {
      let bestDist = r2, bestBi = -1;
      eps.forEach((b, bi) => {
        if (ai === bi || a.ei === b.ei) return;
        const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        if (d2 < bestDist) { bestDist = d2; bestBi = bi; }
      });
      if (bestBi >= 0) {
        const b = eps[bestBi];
        const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        // Update BOTH endpoints to the same midpoint position
        const ptsA = elems[a.ei].points;
        if (a.isStart) ptsA[0] = { x: midX, y: midY };
        else ptsA[ptsA.length - 1] = { x: midX, y: midY };
        const ptsB = elems[b.ei].points;
        if (b.isStart) ptsB[0] = { x: midX, y: midY };
        else ptsB[ptsB.length - 1] = { x: midX, y: midY };
        // Update cached positions
        a.x = midX; a.y = midY;
        b.x = midX; b.y = midY;
      }
    });
  }

  const roadEls  = buildElements(zhangSuenThin(cleanRoad),  minPathLen,                    epsilon,
    s => ({ type:'road', points:s, width:6, color:'#ffffff', label:'', _vecGenerated:true }));

  // Apply endpoint snapping to roads only (water/rail less needed)
  snapEndpoints(roadEls, snapRadius);

  // ── STEP 7c: Merge segments at degree-2 nodes ────────────────────────
  // If exactly 2 road segments share an endpoint, they belong to the same
  // road and should be one element. Repeat until no more merges possible.
  function mergeAtDegree2(elems) {
    let changed = true;
    while (changed) {
      changed = false;
      // Use tolerance-based matching (1px) for floating point robustness
      const rk = pt => `${Math.round(pt.x)},${Math.round(pt.y)}`;
      const epMap = new Map();
      elems.forEach((el, ei) => {
        const pts = el.points;
        if (!pts || pts.length < 2) return;
        [[pts[0], true], [pts[pts.length-1], false]].forEach(([pt, isStart]) => {
          // Register under all 4 nearby integer keys to handle ±0.5 rounding
          const rx = Math.round(pt.x), ry = Math.round(pt.y);
          const k = `${rx},${ry}`;
          if (!epMap.has(k)) epMap.set(k, []);
          epMap.get(k).push({ei, isStart});
        });
      });
      const removed = new Set();
      epMap.forEach(conns => {
        if (conns.length !== 2) return;
        const [a, b] = conns;
        if (a.ei === b.ei || removed.has(a.ei) || removed.has(b.ei)) return;
        const pA = elems[a.ei].points, pB = elems[b.ei].points;
        let merged;
        if      (!a.isStart && b.isStart)  merged = [...pA, ...pB.slice(1)];
        else if (!a.isStart && !b.isStart) merged = [...pA, ...[...pB].reverse().slice(1)];
        else if ( a.isStart && b.isStart)  merged = [...[...pA].reverse(), ...pB.slice(1)];
        else                               merged = [...pB, ...pA.slice(1)];
        elems[a.ei].points = douglasPeucker(merged, epsilon);
        removed.add(b.ei);
        changed = true;
      });
      for (let i = elems.length-1; i >= 0; i--) {
        if (removed.has(i)) elems.splice(i, 1);
      }
    }
  }
  const beforeMerge = roadEls.length;
  mergeAtDegree2(roadEls);

  // collinearMerge: 同方向の近接セグメントをさらに結合（分断解消）
  // 端点が snapRadius*2 以内 かつ 方向角が 45° 以内のもののみ結合
  function collinearMerge(elems, snapR, angleDeg) {
    const snap2 = (snapR * 2) ** 2;
    const cosT  = Math.cos(angleDeg * Math.PI / 180);

    // セグメント端のローカル方向（外向き）を求める
    function outDir(pts, atEnd) {
      const n = Math.min(4, pts.length - 1);
      let dx, dy;
      if (atEnd) {
        dx = pts[pts.length-1].x - pts[pts.length-1-n].x;
        dy = pts[pts.length-1].y - pts[pts.length-1-n].y;
      } else {
        dx = pts[0].x - pts[n].x;
        dy = pts[0].y - pts[n].y;
      }
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx/len, y: dy/len };
    }

    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < elems.length; i++) {
        const pA = elems[i].points;
        if (!pA || pA.length < 2) continue;
        const aEnd = pA[pA.length-1], aStart = pA[0];
        const dAend = outDir(pA, true), dAstart = outDir(pA, false);

        for (let j = i+1; j < elems.length; j++) {
          const pB = elems[j].points;
          if (!pB || pB.length < 2) continue;
          const bStart = pB[0], bEnd = pB[pB.length-1];
          const dBstart = outDir(pB, false), dBend = outDir(pB, true);

          // [A末尾→B先頭] 両者の外向きが逆方向 ≈ 連続
          const d1 = (aEnd.x-bStart.x)**2+(aEnd.y-bStart.y)**2;
          if (d1 < snap2 && dAend.x*(-dBstart.x)+dAend.y*(-dBstart.y) > cosT) {
            elems[i].points = douglasPeucker([...pA, ...pB.slice(1)], epsilon);
            elems.splice(j, 1); changed = true; break outer;
          }
          // [A末尾→B末尾] Bを逆向きに連結
          const d2 = (aEnd.x-bEnd.x)**2+(aEnd.y-bEnd.y)**2;
          if (d2 < snap2 && dAend.x*dBend.x+dAend.y*dBend.y > cosT) {
            elems[i].points = douglasPeucker([...pA, ...[...pB].reverse().slice(1)], epsilon);
            elems.splice(j, 1); changed = true; break outer;
          }
          // [A先頭→B末尾] Bを前に追加
          const d3 = (aStart.x-bEnd.x)**2+(aStart.y-bEnd.y)**2;
          if (d3 < snap2 && dAstart.x*(-dBend.x)+dAstart.y*(-dBend.y) > cosT) {
            elems[i].points = douglasPeucker([...pB, ...pA.slice(1)], epsilon);
            elems.splice(j, 1); changed = true; break outer;
          }
          // [A先頭→B先頭] 逆向きBを前に追加
          const d4 = (aStart.x-bStart.x)**2+(aStart.y-bStart.y)**2;
          if (d4 < snap2 && dAstart.x*dBstart.x+dAstart.y*dBstart.y > cosT) {
            elems[i].points = douglasPeucker([...[...pB].reverse(), ...pA.slice(1)], epsilon);
            elems.splice(j, 1); changed = true; break outer;
          }
        }
      }
    }
  }
  collinearMerge(roadEls, snapRadius, 45);
  console.log(`[VEC] snap=${snapRadius}px  before=${beforeMerge} → after merge=${roadEls.length}`);

  const waterEls = buildElements(zhangSuenThin(cleanWater), Math.max(5, minPathLen * 0.5), epsilon * 0.7,
    s => ({ type:'road',     points:s, width:5, color:'#9ecde0', label:'', _vecGenerated:true, _isWater:true }));

  const railEls  = buildElements(zhangSuenThin(cleanRail),  Math.max(8, minPathLen * 0.3), epsilon,
    s => ({ type:'railroad', points:s, width:14, _vecGenerated:true }));

  const allNew = [...roadEls, ...waterEls, ...railEls];
  if (allNew.length === 0) {
    alert('何も検出できませんでした。\n感度スライダーを調整してみてください。'); return;
  }

  pushUndo();
  S.elements = S.elements.filter(el => !el._vecGenerated);
  S.elements = [...allNew, ...S.elements];
  S.selectedIdx = -1;
  S.multiSelectedIdxs = [];
  S.showRef = true;
  document.getElementById('ref-visible').checked = true;
  render();

  const statusEl = document.getElementById('vec-status');
  if (statusEl) statusEl.textContent =
    `✅ 道路${roadEls.length}本 / 河川${waterEls.length}本 / 線路${railEls.length}本（Shift+クリックで結合可）`;
}

// ===== 道路結合（複数選択 → 1本化）=====

function updateMergeBtn() {
  const panel = document.getElementById('merge-panel');
  const countEl = document.getElementById('merge-count');
  if (!panel) return;
  const roadIdxs = S.multiSelectedIdxs.filter(
    i => i >= 0 && S.elements[i]?.type === 'road' && S.elements[i]?.points?.length >= 2
  );
  if (roadIdxs.length >= 2) {
    panel.style.display = 'block';
    countEl.textContent = `${roadIdxs.length}本の道路を選択中`;
  } else {
    panel.style.display = 'none';
  }
}

function mergeSelectedRoads() {
  const roadIdxs = S.multiSelectedIdxs.filter(
    i => i >= 0 && S.elements[i]?.type === 'road' && S.elements[i]?.points?.length >= 2
  );
  if (roadIdxs.length < 2) { alert('道路を2本以上Shift+クリックで選択してください'); return; }

  pushUndo();
  const ptDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // 選択順を維持しつつ、各接続では4パターン(先頭/末尾 × 正/逆)の最短距離を選ぶ
  let chain = [...S.elements[roadIdxs[0]].points];

  for (let k = 1; k < roadIdxs.length; k++) {
    const pts = S.elements[roadIdxs[k]].points;
    const cEnd   = chain[chain.length - 1], cStart = chain[0];
    const pStart = pts[0], pEnd = pts[pts.length - 1];
    const opts = [
      { d: ptDist(cEnd,   pStart), c: [...chain,          ...pts.slice(1)] },          // A末→B先
      { d: ptDist(cEnd,   pEnd),   c: [...chain,          ...[...pts].reverse().slice(1)] }, // A末→B末(逆)
      { d: ptDist(cStart, pEnd),   c: [...pts,            ...chain.slice(1)] },          // B末→A先
      { d: ptDist(cStart, pStart), c: [...[...pts].reverse(), ...chain.slice(1)] },      // B先(逆)→A先
    ];
    const best = opts.reduce((b, o) => o.d < b.d ? o : b);
    chain = best.c;
  }

  const mergedEl = { ...S.elements[roadIdxs[0]], points: chain };
  const sorted = [...roadIdxs].sort((a, b) => b - a);
  sorted.forEach(i => S.elements.splice(i, 1));
  S.elements.unshift(mergedEl);

  S.selectedIdx = 0;
  S.multiSelectedIdxs = [];
  updateMergeBtn();
  render();
}

document.getElementById('btn-merge-roads')?.addEventListener('click', mergeSelectedRoads);

// Map type toggle

document.querySelectorAll('.map-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});



// ===== Crop/Trim =====
let cropMode = false;
let cropRect = null;
let cropDragging = false;
let cropStart = null;

document.getElementById('btn-crop').onclick = () => {
  cropMode = true;
  cropRect = null;
  document.getElementById('crop-bar').style.display = 'flex';
  canvas.style.cursor = 'crosshair';
};

document.getElementById('crop-cancel').onclick = exitCrop;
document.getElementById('crop-apply').onclick = applyCrop;

function exitCrop() {
  cropMode = false;
  cropRect = null;
  cropDragging = false;
  document.getElementById('crop-bar').style.display = 'none';
  canvas.style.cursor = S.tool === 'select' ? 'default' : 'crosshair';
  render();
}

// Override mouse handlers for crop mode
const origMouseDown = canvas.onmousedown;
canvas.addEventListener('mousedown', e => {
  if (!cropMode) return;
  e.stopImmediatePropagation();
  const r = canvas.getBoundingClientRect();
  cropStart = { x: e.clientX - r.left, y: e.clientY - r.top };
  cropDragging = true;
}, true);

canvas.addEventListener('mousemove', e => {
  if (!cropMode || !cropDragging) return;
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  cropRect = {
    x: Math.min(cropStart.x, mx),
    y: Math.min(cropStart.y, my),
    w: Math.abs(mx - cropStart.x),
    h: Math.abs(my - cropStart.y)
  };
  renderCropOverlay();
}, true);

canvas.addEventListener('mouseup', e => {
  if (!cropMode) return;
  cropDragging = false;
}, true);

function renderCropOverlay() {
  render(); // draw base
  if (!cropRect || cropRect.w < 2) return;
  const w = canvas.width, h = canvas.height;
  // Dim outside
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, w, cropRect.y); // top
  ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.h); // left
  ctx.fillRect(cropRect.x + cropRect.w, cropRect.y, w - cropRect.x - cropRect.w, cropRect.h); // right
  ctx.fillRect(0, cropRect.y + cropRect.h, w, h - cropRect.y - cropRect.h); // bottom
  // Border
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  ctx.setLineDash([]);
  // Size label
  ctx.fillStyle = '#3b82f6';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(cropRect.w)} × ${Math.round(cropRect.h)}`, cropRect.x + cropRect.w / 2, cropRect.y - 8);
}

function applyCrop() {
  if (!cropRect || cropRect.w < 10 || cropRect.h < 10) { exitCrop(); return; }

  // Render without grid/ref, then crop
  const origRef = S.showRef, origGrid = S.showGrid, origSel = S.selectedIdx;
  S.showRef = false; S.showGrid = false; S.selectedIdx = -1;
  render();

  // Extract cropped area
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = cropRect.w;
  tmpCanvas.height = cropRect.h;
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h);

  // Export
  exportCanvas(tmpCanvas, () => {
    // Restore
    S.showRef = origRef; S.showGrid = origGrid; S.selectedIdx = origSel;
    exitCrop();
  });
}

// ===== Case Integration =====
(function initCaseIntegration() {
  const urlParams = new URLSearchParams(window.location.search);
  const caseId = urlParams.get('caseId');
  if (caseId) {
    // Show the "📤 案件に保存" button
    const saveBtn = document.getElementById('btn-save-case');
    if (saveBtn) {
      saveBtn.style.display = 'block';
      saveBtn.onclick = () => saveMapToCase(caseId);
    }
    
    // Auto-load vector elements from localStorage if they exist
    const savedVector = localStorage.getItem('gyosei_case_map_vector_' + caseId);
    if (savedVector) {
      try {
        S.elements = JSON.parse(savedVector);
        setTimeout(render, 100);
      } catch (e) {
        console.error('Failed to parse saved vector map data:', e);
      }
    }
  }
})();

function saveMapToCase(caseId) {
  // Save vector shapes
  localStorage.setItem('gyosei_case_map_vector_' + caseId, JSON.stringify(S.elements));
  
  // Hide UI helpers before exporting the image
  const origRef = S.showRef, origGrid = S.showGrid, origSel = S.selectedIdx;
  S.showRef = false; S.showGrid = false; S.selectedIdx = -1;
  render();
  
  canvas.toBlob(blob => {
    // Restore helper UI
    S.showRef = origRef; S.showGrid = origGrid; S.selectedIdx = origSel;
    render();

    if (!blob || blob.size < 100) {
      alert('保存エラー: キャンバスが空です。');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      
      // Save PNG data URL to localStorage
      localStorage.setItem('gyosei_case_map_png_' + caseId, dataUrl);
      
      // Post message to parent if opener window is active
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'MAP_SAVED',
          caseId: caseId,
          mapDataUrl: dataUrl
        }, '*');
      }
      
      alert('✅ 所在図・配置図を案件データに保存しました！\nダッシュボードの案件編集フォームで保存ボタンを押すと変更が確定されます。');
    };
    reader.readAsDataURL(blob);
  }, 'image/png');
}

// ===== Init =====
resize();
