// Short modal resonances approximate a glass sphere striking different surfaces.
const profiles={
  wood:{frequencies:[430,1120,2850],decay:.065,noise:.55},
  mdf:{frequencies:[340,890,2400],decay:.045,noise:.7},
  metal:{frequencies:[1680,3270,5430],decay:.24,noise:.16},
  glass:{frequencies:[2400,3910,6240],decay:.15,noise:.1},
  plastic:{frequencies:[780,1690,3100],decay:.085,noise:.35},
  ceramic:{frequencies:[1700,2980,4600],decay:.11,noise:.18},
  rubber:{frequencies:[180,460,1250],decay:.025,noise:.45}
};
export function impactMaterialFor(body,marbleIndex){
  if(Number.isInteger(body.soundIndex))return marbleIndex<body.soundIndex?'glass':null;
  return body.impactSound===true?(body.soundMaterial||'wood'):null;
}
export function glassImpact(context,material,velocity){
  const p=profiles[material]||profiles.wood,now=context.currentTime;
  const strength=Math.min(velocity/9,1),volume=.008+strength*.035;
  const out=context.createGain();out.gain.value=.65;out.connect(context.destination);
  const detune=.985+Math.random()*.03;
  p.frequencies.forEach((frequency,i)=>{
    const osc=context.createOscillator(),gain=context.createGain();
    osc.frequency.value=frequency*detune;
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(volume/(1+i*.8),now+.0015);
    gain.gain.exponentialRampToValueAtTime(.0001,now+p.decay/(1+i*.35));
    osc.connect(gain).connect(out);osc.start(now);osc.stop(now+p.decay+.02);
  });
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.025),context.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(context.sampleRate*.004));
  const noise=context.createBufferSource(),gain=context.createGain();
  noise.buffer=buffer;gain.gain.value=volume*p.noise;noise.connect(gain).connect(out);noise.start(now);
  noise.onended=()=>{noise.disconnect();gain.disconnect();};
  setTimeout(()=>out.disconnect(),(p.decay+.1)*1000);
}
