// Locale-aware view over the commentary corpora. The Chinese stage labels stay the
// internal keys: every translation is looked up through them.
import { commentaryData, stripStageNumber, t } from './index.js';

export function liveLines(kind) {
  return commentaryData().live?.[kind] || [];
}

export function keyStageFocusMap() {
  return commentaryData().keyStageFocus || {};
}

export function stageDetail(stage) {
  const data = commentaryData();
  const number = parseInt(stage, 10);
  const label = stripStageNumber(stage);
  if (number === 3) return data.openingDetails?.[label] || data.stageDetails?.[2];
  if (number >= 30 && number <= 37) {
    const details = data.moduleDetails || {};
    if (/乱石|异形/.test(label)) return details.trianglePins;
    if (/S形|S槽|蛇槽/.test(label)) return details.serpentine;
    if (/交叉漏斗/.test(label)) return details.funnel;
    if (/转轮|拨杆|旋杆/.test(label)) return details.rotor;
    if (/波浪|汇流/.test(label)) return details.splitter;
    return details.generic;
  }
  if (number === 38) return data.moduleDetails?.sprint;
  if (number === 39) return data.moduleDetails?.finish;
  return data.stageDetails?.[number - 1];
}

export function describeGap(distance) {
  if (distance < 1.2) return t('stats.gapTiny');
  if (distance < 3) return t('stats.gapSmall');
  if (distance < 8) return t('stats.gapSeveral');
  if (distance < 20) return t('stats.gapLittle');
  if (distance < 45) return t('stats.gapSome');
  if (distance < 100) return t('stats.gapLong');
  return t('stats.gapHuge');
}
