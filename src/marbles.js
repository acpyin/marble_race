// Marble catalog, material/pattern factory and 2D preview rendering.
// The original eight entries keep their exact colors and styles so existing
// races look unchanged; later designs add millefiori glass, ancient eye beads,
// gems, minerals, Chinese ceramics and a full Sun-plus-nine-planets family.
import * as THREE from 'three';

// [nameKey, color, style]
export const MARBLE_CATALOG = [
  // original eight
  ['青岚', 0x20c4c9, 'glass'], ['紫罗', 0x9d4bd2, 'glass'], ['星渊', 0x342277, 'stars'], ['银河', 0x4779cf, 'galaxy'],
  ['烈焰', 0xe44324, 'fire'], ['甜旋', 0xff4f91, 'candy'], ['金辉', 0xe5b51d, 'metal'], ['翠羽', 0x38b97c, 'glass'],
  // new twenty
  ['极光', 0x2fe6b0, 'aurora'], ['琥珀', 0xff9e2c, 'amber'], ['深海', 0x1b6fd6, 'deepsea'], ['樱雪', 0xff9ec4, 'sakura'],
  ['薄荷', 0x6ef0c0, 'mint'], ['星云', 0xa24bff, 'nebula'], ['千花', 0xff4fa3, 'millefiori'], ['极夜', 0x2b2a7a, 'polar'],
  ['光谱', 0xff5fc8, 'spectrum'], ['黑洞', 0x2a2440, 'void'], ['木星', 0xd9a86a, 'jupiter'], ['波点', 0xe0344f, 'dots'],
  ['糖虹', 0xff8ad8, 'prism'], ['云纹', 0xcdd4e6, 'marble'], ['欧泊', 0xbfeaff, 'opal'], ['铬金', 0xd6dde8, 'chrome'],
  ['玫瑰金', 0xe0a080, 'rosegold'], ['青铜', 0xa9712f, 'bronze'], ['珍珠', 0xf0e9f5, 'pearl'], ['蜻蜓眼', 0x16b3c6, 'eyebead'],
  // second twenty: glass art, gems, minerals and planetary spheres
  ['水晶', 0xe8fbff, 'crystal'], ['猫眼', 0x23b7ad, 'catseye'], ['青金', 0x1d3a9e, 'lapis'],
  ['绿松', 0x2fb5a8, 'turquoise'], ['龙鳞', 0x7a4fd1, 'scales'], ['珐琅', 0x1471b8, 'cloisonne'],
  // Chinese ceramics: an eight-piece porcelain family led by blue-and-white.
  ['青花瓷', 0x2f6fc4, 'porcelain'], ['汝窑', 0x9fc4bd, 'ruyao'], ['钧窑', 0x8aa8d8, 'junyao'], ['官窑', 0xb8d0b8, 'guanyao'],
  ['哥窑', 0xe6d5b0, 'geyao'], ['龙泉青瓷', 0x4f9c7f, 'longquan'], ['釉里红', 0xd8503f, 'underglaze'], ['唐三彩', 0xd99a2b, 'sancai'],
  ['冰裂', 0xbfe9ff, 'crackle'], ['土星', 0xe2c17a, 'saturn'], ['地球', 0x2f7fd4, 'earth'],
  ['月球', 0xa8aab3, 'moon'], ['海王星', 0x1b4fbd, 'neptune'], ['金星', 0xe7c98a, 'venus'], ['拉长石', 0x3a4d73, 'labradorite'],
  ['月光石', 0xd7e9ff, 'moonstone'], ['紫晶', 0x8a45c9, 'amethyst'], ['黑曜', 0x16151f, 'obsidian'], ['脉冲星', 0x23d6ff, 'pulsar'],
  // Solar System: the Sun plus the nine planets, making one complete family.
  ['太阳', 0xff9a3c, 'sun'], ['水星', 0x9a8f88, 'mercury'], ['火星', 0xc1502e, 'mars'],
  ['天王星', 0x7fdfe0, 'uranus'], ['冥王星', 0xd8b48c, 'pluto'],
];

const GLASS_STYLES = new Set(['glass', 'crystal', 'aurora', 'amber', 'deepsea', 'sakura', 'mint', 'pearl']);
const METAL_STYLES = new Set(['metal', 'chrome', 'rosegold', 'bronze']);

// The catalog is split into four self-contained themes. Every race draws its
// eight marbles from a single group, so themes never mix on the track.
export const MARBLE_GROUPS = [
  { id: 'solid', names: ['青岚', '紫罗', '金辉', '翠羽', '深海', '薄荷', '铬金', '玫瑰金', '青铜', '珍珠', '水晶', '黑曜', '琥珀', '极夜'] },
  { id: 'pattern', names: ['甜旋', '千花', '波点', '糖虹', '云纹', '欧泊', '蜻蜓眼', '猫眼', '龙鳞', '珐琅', '冰裂', '星渊', '银河', '极光', '星云', '光谱', '黑洞', '月球', '脉冲星', '烈焰', '樱雪', '青金', '绿松', '拉长石', '月光石', '紫晶'] },
  { id: 'cosmic', names: ['太阳', '水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星', '冥王星'] },
  { id: 'porcelain', names: ['青花瓷', '汝窑', '钧窑', '官窑', '哥窑', '龙泉青瓷', '釉里红', '唐三彩'] },
];

const GROUP_OF = new Map(MARBLE_GROUPS.flatMap(group => group.names.map(name => [name, group.id])));
export function groupOf(name) { return GROUP_OF.get(name) ?? null; }

function rgbOf(color) { return [color >> 16 & 255, color >> 8 & 255, color & 255]; }
function shade(rgb, f) { return `rgb(${Math.min(255, rgb[0] * f) | 0},${Math.min(255, rgb[1] * f) | 0},${Math.min(255, rgb[2] * f) | 0})`; }
function rgba(rgb, a) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

function wavePath(x, width, y, amplitude, frequency, phase, step = 16) {
  for (let px = -20; px <= width + 20; px += step) {
    const py = y + Math.sin(px * frequency + phase) * amplitude;
    px === -20 ? x.moveTo(px, py) : x.lineTo(px, py);
  }
}

function speckles(x, canvas, rnd, count, colorFn, maxRadius = 2) {
  for (let i = 0; i < count; i++) {
    x.fillStyle = colorFn(rnd, i);
    x.beginPath(); x.arc(rnd() * canvas.width, rnd() * canvas.height, .4 + rnd() * maxRadius, 0, Math.PI * 2); x.fill();
  }
}

function blobPath(x, cx, cy, rx, ry, points, rnd, jitter = .3) {
  x.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = i / points * Math.PI * 2;
    const scale = 1 + (rnd() - .5) * jitter;
    const px = cx + Math.cos(angle) * rx * scale, py = cy + Math.sin(angle) * ry * scale;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
}

export function makePatternTexture(style, color = 0xffffff) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 384; const x = c.getContext('2d');
  const rgb = rgbOf(color);
  let seed = 407; const rnd = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;

  if (style === 'candy') {
    x.fillStyle = '#fff7e8'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#ef377d'; x.lineWidth = 58;
    for (let n = -5; n < 12; n++) { x.beginPath(); for (let px = 0; px <= 768; px += 8) { const py = n * 86 + px * .55 + Math.sin(px * .018) * 22; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  } else if (style === 'millefiori') {
    // Venetian cane slices fused into clear glass: overlapping flower rosettes.
    x.fillStyle = '#f7fbff'; x.fillRect(0, 0, c.width, c.height);
    const canes = [
      ['#ff4f91', '#ffd45e', '#fff2d1'],
      ['#24b8b1', '#0d5d8c', '#eafcff'],
      ['#9a63e8', '#ff9f45', '#fff0d0'],
      ['#4bbf5c', '#e83d68', '#fff8d8'],
    ];
    const drawFlower = (cx, cy, radius, palette) => {
      for (let ring = 0; ring < 2; ring++) {
        const count = ring ? 6 : 9;
        const ringRadius = radius * (ring ? .56 : .92);
        for (let i = 0; i < count; i++) {
          const angle = i / count * Math.PI * 2 + ring * .35;
          x.save();
          x.translate(cx + Math.cos(angle) * ringRadius * .52, cy + Math.sin(angle) * ringRadius * .52);
          x.rotate(angle);
          x.fillStyle = palette[ring]; x.strokeStyle = 'rgba(34,27,63,.34)'; x.lineWidth = 2;
          x.beginPath(); x.ellipse(0, 0, radius * (ring ? .25 : .34), radius * (ring ? .48 : .62), 0, 0, Math.PI * 2); x.fill(); x.stroke();
          x.restore();
        }
      }
      x.fillStyle = palette[2]; x.beginPath(); x.arc(cx, cy, radius * .2, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(cx - radius * .06, cy - radius * .07, radius * .06, 0, Math.PI * 2); x.fill();
    };
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
      const cx = col * 128 + 64 + (row % 2 ? 34 : 0) + (rnd() - .5) * 16;
      const cy = row * 128 + 52 + (rnd() - .5) * 18;
      const radius = 43 + rnd() * 9;
      x.fillStyle = 'rgba(255,255,255,.74)'; x.beginPath(); x.arc(cx, cy, radius + 5, 0, Math.PI * 2); x.fill();
      drawFlower(cx, cy, radius, canes[Math.floor(rnd() * canes.length)]);
    }
    x.strokeStyle = 'rgba(110,185,220,.22)'; x.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const y0 = rnd() * 384; x.beginPath(); x.moveTo(-20, y0);
      for (let px = 0; px <= 788; px += 24) x.lineTo(px, y0 + Math.sin(px * .012 + i) * 18);
      x.stroke();
    }
  } else if (style === 'jupiter') {
    // Banded gas giant with a Great Red Spot, kept away from the fire palette.
    const sky = x.createLinearGradient(0, 0, 0, 384);
    sky.addColorStop(0, '#6d4a33'); sky.addColorStop(.5, '#e7c697'); sky.addColorStop(1, '#8a5c3e');
    x.fillStyle = sky; x.fillRect(0, 0, c.width, c.height);
    const bands = ['#f5dfb4', '#c88b55', '#efc48b', '#9b5f3e', '#f7e5c2', '#d99b61', '#b9744a', '#f1d3a4'];
    let y = -20;
    for (let i = 0; y < 404; i++) {
      const height = 18 + rnd() * 34;
      x.fillStyle = bands[i % bands.length];
      x.beginPath(); x.moveTo(-20, y);
      for (let px = -20; px <= 788; px += 16) x.lineTo(px, y + Math.sin(px * .012 + i * 1.7) * (5 + rnd() * 7));
      x.lineTo(788, y + height);
      for (let px = 788; px >= -20; px -= 16) x.lineTo(px, y + height + Math.sin(px * .01 + i) * 4);
      x.closePath(); x.fill();
      y += height;
    }
    x.save(); x.translate(470, 218); x.rotate(-.08);
    for (const [rx, ry, color] of [[92, 46, '#a8462e'], [72, 34, '#d46b3f'], [50, 23, '#f0a06a'], [24, 10, '#ffe0b0']]) {
      x.fillStyle = color; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); x.fill();
    }
    x.restore();
    for (let i = 0; i < 16; i++) {
      x.fillStyle = `rgba(255,247,225,${.25 + rnd() * .35})`;
      x.beginPath(); x.ellipse(rnd() * 768, rnd() * 384, 6 + rnd() * 18, 2 + rnd() * 5, (rnd() - .5) * .4, 0, Math.PI * 2); x.fill();
    }
  } else if (style === 'opal') {
    // Milky opal body with play-of-color flashes and translucent veins.
    const base = x.createLinearGradient(0, 0, 768, 384);
    base.addColorStop(0, '#ffffff'); base.addColorStop(.45, '#dff6ff'); base.addColorStop(1, '#f7e9ff');
    x.fillStyle = base; x.fillRect(0, 0, c.width, c.height);
    const flashes = ['#ff5f8d', '#ffd34e', '#4fe0a6', '#4aa8ff', '#b46bff'];
    for (let i = 0; i < 54; i++) {
      const cx = rnd() * 768, cy = rnd() * 384, size = 12 + rnd() * 38;
      x.globalAlpha = .28 + rnd() * .35;
      x.fillStyle = flashes[Math.floor(rnd() * flashes.length)];
      x.beginPath();
      const points = 5 + Math.floor(rnd() * 4);
      for (let p = 0; p < points; p++) {
        const angle = p / points * Math.PI * 2;
        const radius = size * (.55 + rnd() * .6);
        const px = cx + Math.cos(angle) * radius, py = cy + Math.sin(angle) * radius * .55;
        p ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.fill();
    }
    x.globalAlpha = 1;
    x.strokeStyle = 'rgba(255,255,255,.68)'; x.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const y0 = rnd() * 384; x.beginPath(); x.moveTo(-20, y0);
      for (let px = -20; px <= 788; px += 20) x.lineTo(px, y0 + Math.sin(px * .009 + i * .8) * 22);
      x.stroke();
    }
    for (let i = 0; i < 120; i++) {
      x.fillStyle = `rgba(255,255,255,${.35 + rnd() * .5})`;
      x.beginPath(); x.arc(rnd() * 768, rnd() * 384, .6 + rnd() * 1.4, 0, Math.PI * 2); x.fill();
    }
  } else if (style === 'eyebead') {
    // Ancient dragonfly-eye bead: concentric turquoise/cream/gold eyes on deep glass.
    const bg = x.createRadialGradient(384, 192, 30, 384, 192, 460);
    bg.addColorStop(0, '#184f70'); bg.addColorStop(.65, '#102f52'); bg.addColorStop(1, '#071527');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 120; i++) {
      x.fillStyle = `rgba(238,199,109,${.12 + rnd() * .3})`;
      x.beginPath(); x.arc(rnd() * 768, rnd() * 384, .5 + rnd() * 1.6, 0, Math.PI * 2); x.fill();
    }
    const drawEye = (cx, cy, radius) => {
      for (const [scale, color] of [[1.18, 'rgba(212,175,93,.88)'], [1, '#f3f6ee'], [.78, '#18a9b8'], [.55, '#e9f6ff'], [.34, '#123b63'], [.16, '#071527']]) {
        x.fillStyle = color; x.beginPath(); x.arc(cx, cy, radius * scale, 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(cx - radius * .1, cy - radius * .12, radius * .08, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(238,199,109,.6)'; x.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const angle = i / 12 * Math.PI * 2;
        x.beginPath();
        x.moveTo(cx + Math.cos(angle) * radius * 1.08, cy + Math.sin(angle) * radius * 1.08);
        x.lineTo(cx + Math.cos(angle) * radius * 1.32, cy + Math.sin(angle) * radius * 1.32);
        x.stroke();
      }
    };
    for (const [cx, cy, radius] of [[170, 92, 44], [430, 118, 50], [660, 78, 38], [105, 282, 38], [360, 295, 52], [635, 300, 44]]) drawEye(cx, cy, radius);
  } else if (style === 'catseye') {
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#062d3a'); g.addColorStop(.5, shade(rgb, .95)); g.addColorStop(1, '#02161f');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.save(); x.translate(384, 192); x.rotate(-.28);
    const band = x.createLinearGradient(0, -60, 0, 60);
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(.34, 'rgba(255,236,170,.45)');
    band.addColorStop(.5, 'rgba(255,255,255,.92)'); band.addColorStop(.66, 'rgba(80,240,210,.55)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = band; x.beginPath(); x.ellipse(0, 0, 430, 58, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#062633'; x.beginPath(); x.ellipse(0, 0, 300, 8, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 2;
    for (let i = 0; i < 9; i++) { x.beginPath(); wavePath(x, 860, -45 + i * 11, 6 + i * .4, .03, i * .7, 20); x.stroke(); }
    x.restore();
  } else if (style === 'lapis') {
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#0b1e63'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#081344');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = 'rgba(225,235,255,.16)'; x.lineWidth = 5;
    for (let i = 0; i < 9; i++) { x.beginPath(); wavePath(x, 768, rnd() * 384, 18, .015, i * 1.3, 20); x.stroke(); }
    for (let i = 0; i < 230; i++) {
      const px = rnd() * 768, py = rnd() * 384, radius = .8 + rnd() * 3;
      x.fillStyle = rnd() < .7 ? 'rgba(240,196,74,.9)' : 'rgba(255,235,150,.7)';
      x.beginPath();
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2, r = radius * (.7 + rnd() * .6);
        p ? x.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r) : x.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
      x.closePath(); x.fill();
    }
  } else if (style === 'turquoise') {
    const g = x.createRadialGradient(300, 170, 20, 384, 192, 430);
    g.addColorStop(0, '#56d6c4'); g.addColorStop(.6, shade(rgb, 1)); g.addColorStop(1, '#0d6b73');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = 'rgba(72,48,34,.7)'; x.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      let px = rnd() * 768, py = rnd() * 384;
      x.beginPath(); x.moveTo(px, py);
      for (let j = 0; j < 7; j++) { px += (rnd() - .5) * 90; py += (rnd() - .5) * 70; x.lineTo(px, py); }
      x.stroke();
    }
    speckles(x, c, rnd, 170, () => 'rgba(35,45,42,.35)', 3);
  } else if (style === 'scales') {
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#3a1f6e'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#122f6b');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    const colors = ['rgba(255,255,255,.16)', 'rgba(120,230,210,.22)', 'rgba(255,180,240,.18)'];
    for (let row = 0; row < 7; row++) for (let col = 0; col < 12; col++) {
      const cx = col * 70 + (row % 2 ? 35 : 0) - 20, cy = row * 60 + 8;
      x.fillStyle = colors[(row + col) % 3]; x.strokeStyle = 'rgba(255,255,255,.32)'; x.lineWidth = 2;
      x.beginPath(); x.arc(cx, cy, 38, Math.PI, 0); x.lineTo(cx + 38, cy + 34);
      x.quadraticCurveTo(cx, cy + 54, cx - 38, cy + 34); x.closePath(); x.fill(); x.stroke();
    }
  } else if (style === 'cloisonne') {
    x.fillStyle = '#0b3f86'; x.fillRect(0, 0, c.width, c.height);
    const enamels = ['#16a6a0', '#e34f5b', '#f2d060', '#f4f1e6', '#3aa0dd'];
    for (let i = 0; i < 26; i++) {
      const cx = rnd() * 768, cy = rnd() * 384, radius = 22 + rnd() * 32;
      x.fillStyle = enamels[i % enamels.length]; x.strokeStyle = 'rgba(240,190,80,.95)'; x.lineWidth = 4;
      x.beginPath();
      for (let p = 0; p < 6; p++) {
        const a = p / 6 * Math.PI * 2;
        const px = cx + Math.cos(a) * radius * (.8 + rnd() * .4), py = cy + Math.sin(a) * radius * (.6 + rnd() * .4);
        p ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.fill(); x.stroke();
    }
    x.strokeStyle = 'rgba(255,214,110,.85)'; x.lineWidth = 5;
    for (let i = 0; i < 12; i++) { x.beginPath(); wavePath(x, 768, rnd() * 384, 14, .02, i, 20); x.stroke(); }
  } else if (style === 'porcelain') {
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.55, '#f4f7fb'); g.addColorStop(1, '#e4edf6');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    const blossom = (cx, cy, radius) => {
      x.fillStyle = 'rgba(47,111,196,.72)';
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2;
        x.save(); x.translate(cx + Math.cos(a) * radius * .55, cy + Math.sin(a) * radius * .55); x.rotate(a);
        x.beginPath(); x.ellipse(0, 0, radius * .34, radius * .62, 0, 0, Math.PI * 2); x.fill();
        x.restore();
      }
      x.fillStyle = '#1f4f9c'; x.beginPath(); x.arc(cx, cy, radius * .22, 0, Math.PI * 2); x.fill();
    };
    for (const [cx, cy, radius] of [[170, 110, 38], [480, 90, 30], [620, 250, 42], [300, 290, 34]]) blossom(cx, cy, radius);
    x.strokeStyle = 'rgba(38,86,160,.6)'; x.lineWidth = 3;
    for (let i = 0; i < 6; i++) { x.beginPath(); wavePath(x, 768, 40 + i * 62, 9, .012, i * .8, 20); x.stroke(); }
  } else if (style === 'ruyao') {
    // Ru ware: pale sky-blue celadon with fine ice-crackle glaze.
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#a8c9c4'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#7fa8a6');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      let px = rnd() * 768, py = rnd() * 384;
      x.strokeStyle = `rgba(245,252,248,${.3 + rnd() * .35})`; x.lineWidth = 1 + rnd() * 1.5;
      x.beginPath(); x.moveTo(px, py);
      for (let j = 0; j < 7; j++) { px += (rnd() - .5) * 130; py += (rnd() - .5) * 110; x.lineTo(px, py); }
      x.stroke();
    }
    speckles(x, c, rnd, 70, () => 'rgba(255,255,255,.35)', 1.4);
  } else if (style === 'junyao') {
    // Jun ware: blue glaze transformed by vivid purple-red kiln flushes.
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#7fa8d8'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#b9c9e8');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    const flushes = ['#9b4a8e', '#c2537b', '#7b3f8f', '#e08a9b'];
    for (let i = 0; i < 16; i++) {
      const cx = rnd() * 768, cy = rnd() * 384, radius = 60 + rnd() * 80;
      const halo = x.createRadialGradient(cx, cy, 4, cx, cy, radius);
      halo.addColorStop(0, flushes[i % flushes.length]); halo.addColorStop(1, 'rgba(160,120,190,0)');
      x.globalAlpha = .3 + rnd() * .45; x.fillStyle = halo;
      x.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    x.globalAlpha = 1;
  } else if (style === 'guanyao') {
    // Guan ware: soft powder-green glaze with broad dark crackles.
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#c7dcc9'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#9cb89f');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = 'rgba(70,80,62,.42)'; x.lineWidth = 2.2; x.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      let px = rnd() * 768, py = rnd() * 384;
      x.beginPath(); x.moveTo(px, py);
      for (let j = 0; j < 6; j++) { px += (rnd() - .5) * 180; py += (rnd() - .5) * 140; x.lineTo(px, py); }
      x.stroke();
    }
  } else if (style === 'geyao') {
    // Ge ware: creamy glaze with the classic "gold thread, iron wire" crackles.
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#efe2c4'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#d8c7a0');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.lineCap = 'round';
    for (const [color, width, count] of [['rgba(60,48,32,.6)', 2.4, 18], ['rgba(190,140,70,.55)', 1, 26]]) {
      x.strokeStyle = color; x.lineWidth = width;
      for (let i = 0; i < count; i++) {
        let px = rnd() * 768, py = rnd() * 384;
        x.beginPath(); x.moveTo(px, py);
        for (let j = 0; j < 7; j++) { px += (rnd() - .5) * 160; py += (rnd() - .5) * 120; x.lineTo(px, py); }
        x.stroke();
      }
    }
  } else if (style === 'longquan') {
    // Longquan celadon: plum-green glaze with incised lotus petals and ripples.
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#5f9e86'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#3f735f');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = 'rgba(215,240,220,.4)'; x.lineWidth = 3;
    for (const [cx, cy, r] of [[180, 150, 70], [520, 230, 90], [680, 90, 55]]) {
      for (let p = 0; p < 7; p++) {
        const a = p / 7 * Math.PI * 2;
        x.beginPath(); x.ellipse(cx + Math.cos(a) * r * .5, cy + Math.sin(a) * r * .5, r * .35, r * .68, a, 0, Math.PI * 2); x.stroke();
      }
    }
    x.strokeStyle = 'rgba(220,245,230,.28)'; x.lineWidth = 2;
    for (let i = 0; i < 9; i++) { x.beginPath(); wavePath(x, 768, rnd() * 384, 8, .016, i, 20); x.stroke(); }
  } else if (style === 'underglaze') {
    // Underglaze red: copper-red plum blossoms bleeding into a warm white glaze.
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#fdf8ef'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#e8dcc6');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    const reds = ['#b8342a', '#d9533f', '#8f2420', '#e07a5f'];
    for (const [cx, cy, r] of [[160, 120, 36], [420, 240, 44], [640, 140, 38], [300, 320, 30]]) {
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2;
        x.fillStyle = reds[p % reds.length]; x.globalAlpha = .72;
        x.beginPath(); x.ellipse(cx + Math.cos(a) * r * .6, cy + Math.sin(a) * r * .6, r * .42, r * .62, a, 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1; x.fillStyle = '#7d201c'; x.beginPath(); x.arc(cx, cy, r * .24, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(150,45,35,.45)'; x.lineWidth = 3;
    for (let i = 0; i < 6; i++) { x.beginPath(); wavePath(x, 768, 60 + i * 56, 10, .013, i * .9, 20); x.stroke(); }
  } else if (style === 'sancai') {
    // Tang sancai: free-flowing amber, green and brown glazes.
    x.fillStyle = '#f4e6c8'; x.fillRect(0, 0, c.width, c.height);
    const glazes = ['#d99a2b', '#4f9e63', '#8a4a28', '#e8c25a', '#3d7f6a'];
    for (let i = 0; i < 46; i++) {
      x.globalAlpha = .35 + rnd() * .45; x.fillStyle = glazes[i % glazes.length];
      blobPath(x, rnd() * 768, rnd() * 384, 30 + rnd() * 90, 20 + rnd() * 60, 11, rnd, .4); x.fill();
    }
    x.globalAlpha = 1;
    x.strokeStyle = 'rgba(120,75,30,.35)'; x.lineWidth = 2;
    for (let i = 0; i < 10; i++) { x.beginPath(); wavePath(x, 768, rnd() * 384, 10, .015, i, 20); x.stroke(); }
  } else if (style === 'crackle') {
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#eafaff'); g.addColorStop(.5, '#b9e7fa'); g.addColorStop(1, '#dff4ff');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      let px = rnd() * 768, py = -10;
      x.strokeStyle = `rgba(255,255,255,${.5 + rnd() * .4})`; x.lineWidth = 2 + rnd() * 2;
      x.beginPath(); x.moveTo(px, py);
      for (let j = 0; j < 9; j++) { px += (rnd() - .5) * 110; py += 42 + rnd() * 28; x.lineTo(px, py); }
      x.stroke();
      x.strokeStyle = 'rgba(70,135,175,.28)'; x.lineWidth = 1; x.stroke();
    }
    speckles(x, c, rnd, 90, () => 'rgba(255,255,255,.6)', 1.6);
  } else if (style === 'saturn') {
    const g = x.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, '#8d6a42'); g.addColorStop(.5, '#f0d9a4'); g.addColorStop(1, '#a07a4a');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    const bands = ['#f7e8c3', '#cfa46c', '#f2d49e', '#b88755', '#fff3d2'];
    let y = -16;
    for (let i = 0; y < 400; i++) {
      const height = 24 + rnd() * 30;
      x.fillStyle = bands[i % bands.length]; x.beginPath();
      for (let px = -20; px <= 788; px += 18) {
        const py = y + Math.sin(px * .009 + i * .6) * 6;
        px === -20 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      for (let px = 788; px >= -20; px -= 18) x.lineTo(px, y + height + Math.sin(px * .01 + i) * 5);
      x.closePath(); x.fill();
      y += height;
    }
    x.save(); x.translate(384, 192); x.rotate(-.24);
    x.strokeStyle = 'rgba(255,246,218,.9)'; x.lineWidth = 52; x.beginPath(); x.ellipse(0, 0, 372, 68, 0, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(120,92,64,.55)'; x.lineWidth = 18; x.beginPath(); x.ellipse(0, 0, 372, 68, 0, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 8; x.beginPath(); x.ellipse(0, 0, 372, 82, 0, 0, Math.PI * 2); x.stroke();
    x.restore();
  } else if (style === 'earth') {
    const ocean = x.createLinearGradient(0, 0, 768, 384);
    ocean.addColorStop(0, '#0b3f8c'); ocean.addColorStop(.5, '#2479cc'); ocean.addColorStop(1, '#0a2e72');
    x.fillStyle = ocean; x.fillRect(0, 0, c.width, c.height);
    const land = ['#4f9c5a', '#7b8e48', '#b09a63'];
    for (const [cx, cy, rx, ry, idx] of [[300, 180, 120, 80, 0], [520, 250, 90, 60, 1], [640, 120, 70, 45, 2], [120, 280, 80, 50, 0]]) {
      x.fillStyle = land[idx]; blobPath(x, cx, cy, rx, ry, 9, rnd, .35); x.fill();
    }
    // Irregular cloud banks and soft polar caps, with no latitude-style lines.
    for (let i = 0; i < 16; i++) {
      x.fillStyle = `rgba(255,255,255,${.26 + rnd() * .46})`;
      blobPath(x, rnd() * 768, rnd() * 384, 34 + rnd() * 74, 9 + rnd() * 20, 11, rnd, .48); x.fill();
    }
    const ice = x.createLinearGradient(0, 0, 0, 70);
    ice.addColorStop(0, 'rgba(245,251,255,.8)'); ice.addColorStop(1, 'rgba(245,251,255,0)');
    x.fillStyle = ice; x.fillRect(0, 0, 768, 70);
  } else if (style === 'moon') {
    const g = x.createRadialGradient(300, 150, 20, 384, 192, 420);
    g.addColorStop(0, '#d9dbe2'); g.addColorStop(.6, shade(rgb, 1)); g.addColorStop(1, '#4a4d57');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 7; i++) {
      x.fillStyle = 'rgba(60,64,74,.35)'; blobPath(x, 160 + rnd() * 500, 90 + rnd() * 220, 40 + rnd() * 60, 30 + rnd() * 40, 10, rnd, .3); x.fill();
    }
    for (let i = 0; i < 70; i++) {
      const cx = rnd() * 768, cy = rnd() * 384, radius = 4 + rnd() * 22;
      x.fillStyle = 'rgba(35,38,47,.38)'; x.beginPath(); x.arc(cx, cy, radius, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.beginPath(); x.arc(cx - 1, cy - 1, radius * .9, -2.5, .8); x.stroke();
    }
  } else if (style === 'neptune') {
    const g = x.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, '#0a2a8a'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#071a5e');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    // Wispy cloud patches and a great dark spot; no latitude/longitude grid.
    for (let i = 0; i < 20; i++) {
      x.fillStyle = `rgba(160,210,255,${.1 + rnd() * .22})`;
      blobPath(x, rnd() * 768, rnd() * 384, 42 + rnd() * 92, 8 + rnd() * 24, 10, rnd, .45); x.fill();
    }
    x.fillStyle = 'rgba(4,12,54,.85)'; blobPath(x, 520, 210, 78, 38, 12, rnd, .28); x.fill();
    x.strokeStyle = 'rgba(130,190,255,.6)'; x.lineWidth = 4; blobPath(x, 520, 210, 86, 44, 12, rnd, .28); x.stroke();
  } else if (style === 'venus') {
    const g = x.createRadialGradient(384, 192, 20, 384, 192, 430);
    g.addColorStop(0, '#fff6d8'); g.addColorStop(.6, shade(rgb, 1)); g.addColorStop(1, '#a8733d');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 16; i++) {
      x.strokeStyle = i % 2 ? 'rgba(255,247,215,.6)' : 'rgba(191,132,61,.45)'; x.lineWidth = 10 + (i % 3) * 5;
      x.beginPath();
      for (let a = 0; a <= Math.PI * 4; a += .08) {
        const r = 24 + a * 23, px = 384 + Math.cos(a + i * .4) * r, py = 192 + Math.sin(a + i * .4) * r * .52;
        a ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.stroke();
    }
  } else if (style === 'sun') {
    // The Sun: molten photosphere with granulation, sunspots and a soft corona.
    const g = x.createRadialGradient(384, 176, 24, 384, 192, 440);
    g.addColorStop(0, '#fffce2'); g.addColorStop(.34, '#ffd44a'); g.addColorStop(.7, '#ff8a1e'); g.addColorStop(1, '#b93a06');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 280; i++) {
      x.fillStyle = `rgba(255,${200 + (rnd() * 55 | 0)},${80 + (rnd() * 130 | 0)},${.12 + rnd() * .22})`;
      x.beginPath(); x.arc(rnd() * 768, rnd() * 384, 3 + rnd() * 10, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 5; i++) {
      const cx = 100 + rnd() * 560, cy = 90 + rnd() * 200, r = 8 + rnd() * 20;
      x.fillStyle = 'rgba(92,26,0,.55)'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(255,225,130,.55)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r * 1.4, 0, Math.PI * 2); x.stroke();
    }
    x.strokeStyle = 'rgba(255,246,196,.5)'; x.lineWidth = 7;
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2, r0 = 316, r1 = 344 + rnd() * 40;
      x.beginPath(); x.moveTo(384 + Math.cos(a) * r0, 192 + Math.sin(a) * r0);
      x.lineTo(384 + Math.cos(a) * r1, 192 + Math.sin(a) * r1); x.stroke();
    }
  } else if (style === 'mercury') {
    // Mercury: grey-brown, heavily cratered, with bright rays around young impacts.
    const g = x.createRadialGradient(300, 150, 20, 384, 192, 430);
    g.addColorStop(0, '#bcb0a4'); g.addColorStop(.6, shade(rgb, 1)); g.addColorStop(1, '#453e37');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 140; i++) {
      const cx = rnd() * 768, cy = rnd() * 384, r = 3 + rnd() * 26;
      x.fillStyle = 'rgba(38,32,28,.42)'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(242,236,226,.34)'; x.lineWidth = 2;
      x.beginPath(); x.arc(cx - 1, cy - 1, r * .86, -2.4, .7); x.stroke();
    }
  } else if (style === 'mars') {
    // Mars: rust-red deserts, dark albedo features and white polar caps.
    const g = x.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, '#e9b28c'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#8b3a1d');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 9; i++) {
      x.fillStyle = 'rgba(88,38,24,.36)';
      blobPath(x, rnd() * 768, 60 + rnd() * 260, 40 + rnd() * 84, 18 + rnd() * 40, 11, rnd, .4); x.fill();
    }
    for (let i = 0; i < 44; i++) {
      const cx = rnd() * 768, cy = 70 + rnd() * 250, r = 4 + rnd() * 14;
      x.fillStyle = 'rgba(70,30,20,.3)'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
    const ice = x.createLinearGradient(0, 0, 0, 62);
    ice.addColorStop(0, 'rgba(255,252,248,.88)'); ice.addColorStop(1, 'rgba(255,252,248,0)');
    x.fillStyle = ice; x.fillRect(0, 0, 768, 62);
  } else if (style === 'uranus') {
    // Uranus: pale cyan methane haze with faint bands and a thin tilted ring.
    const g = x.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, '#d2f6f3'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#59b4c2');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 12; i++) {
      x.fillStyle = `rgba(255,255,255,${.05 + rnd() * .11})`;
      blobPath(x, rnd() * 768, rnd() * 384, 90 + rnd() * 130, 7 + rnd() * 16, 10, rnd, .35); x.fill();
    }
    x.strokeStyle = 'rgba(228,252,255,.32)'; x.lineWidth = 3;
    x.beginPath(); x.ellipse(384, 192, 358, 52, -.2, 0, Math.PI * 2); x.stroke();
  } else if (style === 'pluto') {
    // Pluto: pale tan plains, dark tholin patches and the bright heart-shaped ice field.
    const g = x.createRadialGradient(300, 160, 20, 384, 192, 430);
    g.addColorStop(0, '#f2dfc4'); g.addColorStop(.55, shade(rgb, 1)); g.addColorStop(1, '#63492f');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = 'rgba(86,52,32,.4)';
      blobPath(x, rnd() * 768, rnd() * 384, 42 + rnd() * 72, 24 + rnd() * 42, 10, rnd, .35); x.fill();
    }
    x.fillStyle = 'rgba(255,249,236,.78)';
    x.beginPath(); x.arc(322, 150, 44, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(398, 150, 44, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(282, 162); x.lineTo(438, 162); x.lineTo(360, 268); x.closePath(); x.fill();
  } else if (style === 'labradorite') {
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#1c2338'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#141a2b');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    const flashes = ['#43d9ff', '#7ef0c0', '#f6d76b', '#b98cff'];
    for (let i = 0; i < 34; i++) {
      const cx = rnd() * 768, cy = rnd() * 384, width = 40 + rnd() * 100, height = 8 + rnd() * 22;
      x.globalAlpha = .35 + rnd() * .45; x.fillStyle = flashes[i % flashes.length];
      x.beginPath(); x.moveTo(cx - width, cy); x.lineTo(cx - width * .3, cy - height);
      x.lineTo(cx + width, cy - height * .4); x.lineTo(cx + width * .4, cy + height); x.closePath(); x.fill();
    }
    x.globalAlpha = 1;
    x.strokeStyle = 'rgba(180,200,235,.25)'; x.lineWidth = 1;
    for (let i = 0; i < 16; i++) { x.beginPath(); wavePath(x, 768, rnd() * 384, 8, .03, i, 20); x.stroke(); }
  } else if (style === 'moonstone') {
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#eef5ff'); g.addColorStop(.5, '#dbe9fb'); g.addColorStop(1, '#f8fbff');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    const halo = x.createRadialGradient(420, 180, 10, 420, 180, 260);
    halo.addColorStop(0, 'rgba(120,190,255,.55)'); halo.addColorStop(.5, 'rgba(160,220,255,.22)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = halo; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 4;
    for (let i = 0; i < 10; i++) { x.beginPath(); wavePath(x, 768, 80 + i * 26, 12, .012, i * .9, 22); x.stroke(); }
    speckles(x, c, rnd, 60, () => 'rgba(150,205,255,.35)', 1.6);
  } else if (style === 'amethyst') {
    const g = x.createLinearGradient(0, 0, 768, 384);
    g.addColorStop(0, '#3d155f'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#1d0b35');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 42; i++) {
      const cx = rnd() * 768, cy = rnd() * 384, size = 24 + rnd() * 60;
      x.fillStyle = i % 2 ? 'rgba(255,255,255,.14)' : 'rgba(90,30,150,.35)'; x.strokeStyle = 'rgba(235,210,255,.35)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(cx, cy - size); x.lineTo(cx + size * .8, cy); x.lineTo(cx, cy + size); x.lineTo(cx - size * .8, cy); x.closePath(); x.fill(); x.stroke();
    }
  } else if (style === 'obsidian') {
    const g = x.createRadialGradient(300, 140, 10, 384, 192, 430);
    g.addColorStop(0, '#2b2a3a'); g.addColorStop(.5, shade(rgb, 1)); g.addColorStop(1, '#030308');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 24; i++) {
      const cx = rnd() * 768, cy = rnd() * 384, radius = 40 + rnd() * 110;
      x.strokeStyle = i % 3 ? 'rgba(120,140,190,.22)' : 'rgba(200,210,255,.28)'; x.lineWidth = 1 + rnd() * 3;
      x.beginPath(); x.arc(cx, cy, radius, rnd() * Math.PI, rnd() * Math.PI + Math.PI * 1.2); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(300, 110, 60, 18, -.4, 0, Math.PI * 2); x.fill();
  } else if (style === 'pulsar') {
    x.fillStyle = '#03040c'; x.fillRect(0, 0, c.width, c.height);
    speckles(x, c, rnd, 220, r => `rgba(255,255,255,${.3 + r() * .6})`, 1.4);
    x.save(); x.translate(384, 192); x.rotate(-.5);
    const beamA = x.createLinearGradient(-420, 0, 420, 0);
    beamA.addColorStop(0, 'rgba(35,214,255,0)'); beamA.addColorStop(.5, 'rgba(35,214,255,.85)'); beamA.addColorStop(1, 'rgba(35,214,255,0)');
    x.fillStyle = beamA; x.beginPath(); x.ellipse(0, 0, 430, 16, 0, 0, Math.PI * 2); x.fill();
    x.restore();
    x.save(); x.translate(384, 192); x.rotate(.9);
    const beamB = x.createLinearGradient(-420, 0, 420, 0);
    beamB.addColorStop(0, 'rgba(255,95,200,0)'); beamB.addColorStop(.5, 'rgba(255,95,200,.8)'); beamB.addColorStop(1, 'rgba(255,95,200,0)');
    x.fillStyle = beamB; x.beginPath(); x.ellipse(0, 0, 420, 13, 0, 0, Math.PI * 2); x.fill();
    x.restore();
    x.strokeStyle = 'rgba(180,240,255,.55)'; x.lineWidth = 3;
    for (let i = 1; i <= 4; i++) { x.beginPath(); x.arc(384, 192, i * 42, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(384, 192, 18, 0, Math.PI * 2); x.fill();
  } else if (style === 'dots') {
    x.fillStyle = shade(rgb, 1); x.fillRect(0, 0, c.width, c.height);
    for (let row = 0; row < 6; row++) for (let col = 0; col < 13; col++) {
      x.beginPath(); x.arc(col * 62 + (row % 2 ? 31 : 0) + 10, row * 68 + 22, 17, 0, Math.PI * 2);
      x.fillStyle = 'rgba(255,252,244,.94)'; x.fill();
    }
  } else if (style === 'marble') {
    x.fillStyle = '#f4f5f8'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 34; i++) {
      const y0 = rnd() * 384; x.strokeStyle = rgba(rgb, .12 + rnd() * .4); x.lineWidth = 1 + rnd() * 5;
      x.beginPath(); x.moveTo(-20, y0);
      for (let px = 0; px <= 768; px += 16) x.lineTo(px, y0 + Math.sin(px * (.006 + rnd() * .01) + i) * (12 + rnd() * 26));
      x.stroke();
    }
  } else if (style === 'void') {
    const g = x.createRadialGradient(384, 192, 20, 384, 192, 430);
    g.addColorStop(0, '#000'); g.addColorStop(.5, '#050409'); g.addColorStop(.82, shade(rgb, .7)); g.addColorStop(1, '#000');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = rgba(rgb, .85); x.lineWidth = 30; x.beginPath(); x.ellipse(384, 192, 250, 78, -.18, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(255,224,160,.6)'; x.lineWidth = 10; x.beginPath(); x.ellipse(384, 192, 250, 78, -.18, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 160; i++) { x.beginPath(); x.arc(rnd() * 768, rnd() * 384, rnd() < .05 ? 1.8 : .6, 0, Math.PI * 2); x.fillStyle = `rgba(255,255,255,${.3 + rnd() * .6})`; x.fill(); }
  } else if (style === 'spectrum' || style === 'prism') {
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    const bands = style === 'spectrum' ? ['#ff4f91', '#ffb53d', '#5ce1a0', '#48a8ff', '#b06bff'] : [shade(rgb, 1), '#ffd0ee', '#fff'];
    x.lineWidth = 46;
    for (let n = -6; n < 14; n++) {
      x.strokeStyle = bands[((n % bands.length) + bands.length) % bands.length]; x.beginPath();
      for (let px = 0; px <= 768; px += 8) { const py = n * 84 + px * .52 + Math.sin(px * .02) * 18; px ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
  } else {
    // fire-like and nebula/star-like families
    const g = x.createLinearGradient(0, 0, 768, 384);
    if (style === 'fire') {
      g.addColorStop(0, shade(rgb, .16)); g.addColorStop(.38, shade(rgb, .7)); g.addColorStop(.72, shade(rgb, 1.3)); g.addColorStop(1, '#ffe36a');
    } else if (style === 'galaxy' || style === 'nebula') {
      g.addColorStop(0, shade(rgb, .1)); g.addColorStop(.38, shade(rgb, .45)); g.addColorStop(.62, shade(rgb, 1.15)); g.addColorStop(1, style === 'nebula' ? '#3a1b8f' : '#136bc6');
    } else {
      g.addColorStop(0, shade(rgb, .06)); g.addColorStop(.52, shade(rgb, .35)); g.addColorStop(1, shade(rgb, .1));
    }
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    if (style === 'fire') {
      for (let i = 0; i < 75; i++) { const px = rnd() * 768, base = 380 + rnd() * 35, h = 45 + rnd() * 180; x.beginPath(); x.moveTo(px - 18, base); x.quadraticCurveTo(px - 35, base - h * .55, px, base - h); x.quadraticCurveTo(px + 35, base - h * .45, px + 18, base); x.fillStyle = `rgba(255,${80 + rnd() * 150},0,${.24 + rnd() * .5})`; x.fill(); }
    } else {
      for (let i = 0; i < 300; i++) { const r = rnd() < .04 ? 2.2 : .5 + rnd(); x.beginPath(); x.arc(rnd() * 768, rnd() * 384, r, 0, Math.PI * 2); x.fillStyle = `rgba(${190 + rnd() * 65},${205 + rnd() * 50},255,${.45 + rnd() * .55})`; x.fill(); }
      if (style === 'galaxy' || style === 'nebula') { x.strokeStyle = rgba(rgb, .38); x.lineWidth = 36; x.beginPath(); x.moveTo(-30, 330); x.bezierCurveTo(190, 20, 520, 370, 800, 30); x.stroke(); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export function makeMarbleMaterial(color, style) {
  if (style === 'crystal') return new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: .015, transmission: .96, transparent: true, opacity: .42, thickness: .45, ior: 1.52, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.3, specularIntensity: 1 });
  if (GLASS_STYLES.has(style)) {
    const mat = new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: .07, transmission: .72, transparent: true, opacity: .88, thickness: 1.1, ior: 1.48, clearcoat: 1, envMapIntensity: 1.7 });
    if (style === 'aurora' || style === 'pearl') { mat.iridescence = 1; mat.iridescenceIOR = 1.4; mat.iridescenceThicknessRange = [120, 520]; mat.roughness = .13; }
    return mat;
  }
  if (METAL_STYLES.has(style)) return new THREE.MeshPhysicalMaterial({ color, metalness: .82, roughness: .12, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.8 });
  if (style === 'opal') return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: makePatternTexture('opal', color), metalness: .05, roughness: .08, clearcoat: 1, clearcoatRoughness: .03, iridescence: .75, iridescenceIOR: 1.35, iridescenceThicknessRange: [140, 420], envMapIntensity: 1.5 });
  if (style === 'sun') { const map = makePatternTexture('sun', color); return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, emissive: 0xff7a18, emissiveMap: map, emissiveIntensity: .55, metalness: .08, roughness: .42, clearcoat: .5, clearcoatRoughness: .2, envMapIntensity: 1.1 }); }
  if (style === 'void') return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: makePatternTexture('void', color), metalness: .75, roughness: .18, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.7 });
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: makePatternTexture(style, color), metalness: style === 'stars' || style === 'polar' ? .34 : .12, roughness: .12, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.65 });
}

export function marblePreview(color, style, material) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
  const x = canvas.getContext('2d'), radius = 43, cx = 48, cy = 48;
  const [red, green, blue] = rgbOf(color);
  x.save(); x.beginPath(); x.arc(cx, cy, radius, 0, Math.PI * 2); x.clip();
  if (material.map?.image) {
    const source = material.map.image;
    for (let px = -radius; px < radius; px += 2) {
      const longitude = Math.asin(Math.max(-1, Math.min(1, (px + 1) / radius)));
      const sx = Math.max(0, Math.min(source.width - 2, (0.5 + longitude / (Math.PI * 2)) * source.width));
      x.drawImage(source, sx, 0, Math.max(2, source.width / 180), source.height, cx + px, cy - radius, 2, radius * 2);
    }
  } else if (style === 'crystal') {
    const clear = x.createRadialGradient(34, 27, 3, 50, 52, 52);
    clear.addColorStop(0, 'rgba(255,255,255,.92)'); clear.addColorStop(.32, 'rgba(226,248,255,.24)');
    clear.addColorStop(.7, 'rgba(150,205,235,.1)'); clear.addColorStop(1, 'rgba(90,150,200,.42)');
    x.fillStyle = clear; x.fillRect(0, 0, 96, 96);
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 3; x.beginPath(); x.arc(48, 49, 35, -2.4, 1.1); x.stroke();
    x.strokeStyle = 'rgba(170,220,255,.5)'; x.lineWidth = 2; x.beginPath(); x.ellipse(55, 58, 26, 15, .6, 0, Math.PI * 2); x.stroke();
  } else {
    const base = x.createRadialGradient(29, 24, 4, 53, 55, 58);
    base.addColorStop(0, `rgb(${Math.min(255, red + 92)},${Math.min(255, green + 92)},${Math.min(255, blue + 92)})`);
    base.addColorStop(.33, `rgb(${red},${green},${blue})`);
    base.addColorStop(.76, `rgb(${Math.round(red * .65)},${Math.round(green * .65)},${Math.round(blue * .65)})`);
    base.addColorStop(1, `rgb(${Math.round(red * .25)},${Math.round(green * .25)},${Math.round(blue * .25)})`);
    x.fillStyle = base; x.fillRect(0, 0, 96, 96);
    if (GLASS_STYLES.has(style)) { x.strokeStyle = 'rgba(245,255,255,.34)'; x.lineWidth = 6; x.beginPath(); x.arc(48, 49, 33, .9, 2.9); x.stroke(); }
  }
  const shadeGrad = x.createRadialGradient(34, 28, 5, 49, 50, 51);
  shadeGrad.addColorStop(0, 'rgba(255,255,255,.46)'); shadeGrad.addColorStop(.27, 'rgba(255,255,255,.06)');
  shadeGrad.addColorStop(.7, 'rgba(8,10,19,.07)'); shadeGrad.addColorStop(1, 'rgba(3,5,12,.68)');
  x.fillStyle = shadeGrad; x.fillRect(0, 0, 96, 96);
  x.fillStyle = 'rgba(255,255,255,.74)'; x.beginPath(); x.ellipse(32, 26, 12, 6, -.45, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.ellipse(62, 67, 11, 4, -.45, 0, Math.PI * 2); x.fill();
  x.restore();
  x.strokeStyle = 'rgba(255,255,255,.31)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, radius - .7, 0, Math.PI * 2); x.stroke();
  return canvas.toDataURL('image/png');
}

function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

// Pick one theme at random, then draw the roster from that group alone. Each
// group holds at least eight marbles, so a race is always thematically pure.
export function pickMarbles(count = 8, random = Math.random) {
  const group = MARBLE_GROUPS[Math.floor(random() * MARBLE_GROUPS.length)];
  const pool = shuffle(group.names.map(name => MARBLE_CATALOG.find(marble => marble[0] === name)), random);
  return pool.slice(0, count);
}
