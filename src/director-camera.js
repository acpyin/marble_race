// Select a shot from the commentary event itself, not from words guessed out
// of the generated sentence. This keeps the camera aligned with live events.
const cleanStageName=value=>String(value??'').replace(/^\s*\d+\s*[.．、·:：—-]?\s*/,'').trim();
export function directorCue(kind,values={},text='',sections=[],marbles=[],now=0){
  const duration=Math.max(5500,Math.min(10000,text.length*145));
  const cue={type:'field',kind,until:now+duration};
  const stage=typeof values.stage==='string'?values.stage:'';
  const sectionIndex=stage?sections.findIndex(section=>cleanStageName(section.name)===cleanStageName(stage)):-1;
  if(sectionIndex>=0&&(['stage','keyStageBattle','bowlContest','bowlSolo','bowlInward','bowlOutward','bowlDrop'].includes(kind)||kind.startsWith('keyStage'))){
    cue.type='stage';cue.sectionIndex=sectionIndex;
    cue.z=((sectionIndex?sections[sectionIndex-1].end:46)+sections[sectionIndex].end)/2;
    return cue;
  }
  const index=marbles.findIndex(m=>m.name===values.name);
  if(index>=0){
    cue.type='marble';cue.marbleIndex=index;
    const rival=marbles.findIndex(m=>m.name===values.rival);
    if(rival>=0&&rival!==index)cue.rivalIndex=rival;
  }
  return cue;
}

export function stageRacer(cue,sections,marbles,routeParameter){
  if(cue?.type!=='stage'||!Number.isInteger(cue.sectionIndex))return null;
  const index=cue.sectionIndex,start=index?sections[index-1].end:46,end=sections[index]?.end;
  if(end===undefined)return null;
  return marbles.filter(m=>!m.finished).map(m=>({marble:m,z:routeParameter(m.body.position)}))
    .filter(({z})=>z<=start&&z>=end)
    .sort((a,b)=>Math.abs(a.z-cue.z)-Math.abs(b.z-cue.z))[0]?.marble??null;
}
