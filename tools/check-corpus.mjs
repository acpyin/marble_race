import assert from 'node:assert/strict';
import {commentaryCorpus,corpusLines} from '../src/commentary-corpus.js';
import {extraCommentaryCorpus} from '../src/commentary-corpus-extra.js';
import {RaceCommentary} from '../src/race-commentary.js';
import {liveCorpus} from '../src/live-commentary-corpus.js';
const templates=Object.values(commentaryCorpus).flat();
assert.equal(Object.values(extraCommentaryCorpus).flat().length,198);
assert.equal(templates.length,298);
assert.equal(new Set(templates).size,298);
for(const [category,lines] of Object.entries(commentaryCorpus)){
  assert.equal(lines.length,category==='start'?28:30);
  const rendered=corpusLines(category,{name:'银河',rank:3,gain:2});
  assert.ok(rendered.every(text=>!/[{}]|银河：|undefined/.test(text)));
}
const commentator=new RaceCommentary(()=>.999,{adaptive:false});
assert.equal(commentator.update([{id:0,name:'银河',progress:1}],0,'racing'),liveCorpus.start.at(-1));
assert.equal(commentator.update([{id:0,name:'银河',progress:2,finished:true}],5000,'racing'),liveCorpus.winner.at(-1).replace('{name}','银河'));
const live=Object.values(liveCorpus).flat();assert.equal(new Set(live).size,live.length);
console.log('旧版归档（开场精简后 298 条）及新版实时赛况语料实际接入检查通过');
