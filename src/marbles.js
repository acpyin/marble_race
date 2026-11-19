// Marble catalog, material/pattern factory and 2D preview rendering.
// The original eight entries keep their exact colors and styles so existing
// races look unchanged; twenty new designs extend the pattern set.
import * as THREE from 'three';

// [nameKey, color, style]
export const MARBLE_CATALOG = [
  // original eight
  ['青岚', 0x20c4c9, 'glass'], ['紫罗', 0x9d4bd2, 'glass'], ['星渊', 0x342277, 'stars'], ['银河', 0x4779cf, 'galaxy'],
  ['烈焰', 0xe44324, 'fire'], ['甜旋', 0xff4f91, 'candy'], ['金辉', 0xe5b51d, 'metal'], ['翠羽', 0x38b97c, 'glass'],
  // new twenty
  ['极光', 0x2fe6b0, 'aurora'], ['琥珀', 0xff9e2c, 'amber'], ['深海', 0x1b6fd6, 'deepsea'], ['樱雪', 0xff9ec4, 'sakura'],
  ['薄荷', 0x6ef0c0, 'mint'], ['星云', 0xa24bff, 'nebula'], ['陨星', 0xd84a3a, 'meteor'], ['极夜', 0x2b2a7a, 'polar'],
  ['光谱', 0xff5fc8, 'spectrum'], ['黑洞', 0x2a2440, 'void'], ['斑马', 0xeceef2, 'zebra'], ['波点', 0xe0344f, 'dots'],
  ['糖虹', 0xff8ad8, 'prism'], ['云纹', 0xcdd4e6, 'marble'], ['虎纹', 0xe8841c, 'tiger'], ['铬金', 0xd6dde8, 'chrome'],
  ['玫瑰金', 0xe0a080, 'rosegold'], ['青铜', 0xa9712f, 'bronze'], ['珍珠', 0xf0e9f5, 'pearl'], ['熔岩', 0xf2551c, 'lava'],
];

const GLASS_STYLES = new Set(['glass', 'aurora', 'amber', 'deepsea', 'sakura', 'mint', 'pearl']);
const METAL_STYLES = new Set(['metal', 'chrome', 'rosegold', 'bronze']);

function rgbOf(color) { return [color >> 16 & 255, color >> 8 & 255, color & 255]; }
function shade(rgb, f) { return `rgb(${Math.min(255, rgb[0] * f) | 0},${Math.min(255, rgb[1] * f) | 0},${Math.min(255, rgb[2] * f) | 0})`; }
function rgba(rgb, a) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

export function makePatternTexture(style, color = 0xffffff) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 384; const x = c.getContext('2d');
  const rgb = rgbOf(color);
  let seed = 407; const rnd = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;

  if (style === 'candy') {
    x.fillStyle = '#fff7e8'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#ef377d'; x.lineWidth = 58;
    for (let n = -5; n < 12; n++) { x.beginPath(); for (let px = 0; px <= 768; px += 8) { const py = n * 86 + px * .55 + Math.sin(px * .018) * 22; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  } else if (style === 'zebra' || style === 'tiger') {
    x.fillStyle = style === 'zebra' ? '#f6f5f2' : shade(rgb, 1.05); x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = style === 'zebra' ? '#15151a' : '#2a1508';
    for (let n = -6; n < 16; n++) {
      x.beginPath();
      for (let py = 0; py <= 384; py += 10) { const px = n * 92 + py * .85 + Math.sin(py * .03 + n) * 16; py ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.lineTo(n * 92 + 384 * .85 + 40, 384); x.lineTo(n * 92 - 20, 384); x.closePath(); x.fill();
    }
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
    if (style === 'fire' || style === 'meteor' || style === 'lava') {
      g.addColorStop(0, shade(rgb, .16)); g.addColorStop(.38, shade(rgb, .7)); g.addColorStop(.72, shade(rgb, 1.3)); g.addColorStop(1, '#ffe36a');
    } else if (style === 'galaxy' || style === 'nebula') {
      g.addColorStop(0, shade(rgb, .1)); g.addColorStop(.38, shade(rgb, .45)); g.addColorStop(.62, shade(rgb, 1.15)); g.addColorStop(1, style === 'nebula' ? '#3a1b8f' : '#136bc6');
    } else {
      g.addColorStop(0, shade(rgb, .06)); g.addColorStop(.52, shade(rgb, .35)); g.addColorStop(1, shade(rgb, .1));
    }
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    if (style === 'fire' || style === 'meteor' || style === 'lava') {
      for (let i = 0; i < 75; i++) { const px = rnd() * 768, base = 380 + rnd() * 35, h = 45 + rnd() * 180; x.beginPath(); x.moveTo(px - 18, base); x.quadraticCurveTo(px - 35, base - h * .55, px, base - h); x.quadraticCurveTo(px + 35, base - h * .45, px + 18, base); x.fillStyle = `rgba(255,${80 + rnd() * 150},0,${.24 + rnd() * .5})`; x.fill(); }
    } else {
      for (let i = 0; i < 300; i++) { const r = rnd() < .04 ? 2.2 : .5 + rnd(); x.beginPath(); x.arc(rnd() * 768, rnd() * 384, r, 0, Math.PI * 2); x.fillStyle = `rgba(${190 + rnd() * 65},${205 + rnd() * 50},255,${.45 + rnd() * .55})`; x.fill(); }
      if (style === 'galaxy' || style === 'nebula') { x.strokeStyle = rgba(rgb, .38); x.lineWidth = 36; x.beginPath(); x.moveTo(-30, 330); x.bezierCurveTo(190, 20, 520, 370, 800, 30); x.stroke(); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export function makeMarbleMaterial(color, style) {
  if (GLASS_STYLES.has(style)) {
    const mat = new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: .07, transmission: .72, transparent: true, opacity: .88, thickness: 1.1, ior: 1.48, clearcoat: 1, envMapIntensity: 1.7 });
    if (style === 'aurora' || style === 'pearl') { mat.iridescence = 1; mat.iridescenceIOR = 1.4; mat.iridescenceThicknessRange = [120, 520]; mat.roughness = .13; }
    return mat;
  }
  if (METAL_STYLES.has(style)) return new THREE.MeshPhysicalMaterial({ color, metalness: .82, roughness: .12, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.8 });
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

// Fisher-Yates: draw `count` distinct marbles from the full catalog.
export function pickMarbles(count = 8, random = Math.random) {
  const pool = MARBLE_CATALOG.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}
