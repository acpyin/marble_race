export function straightDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}

export function bowlPosition(position,velocity,bowls,radius=.55){
  for(const bowl of bowls){
    const dx=position.x-bowl.x,dz=position.z-bowl.z,r=Math.hypot(dx,dz);
    if(r>bowl.radius+radius||position.y>bowl.rimY+5||position.y<bowl.rimY-4.5-radius)continue;
    return {id:bowl.id,label:bowl.label,exitDistance:r,hole:bowl.hole,
      inwardSpeed:r>1e-5?-(dx*velocity.x+dz*velocity.z)/r:0,
      verticalSpeed:velocity.y,heightAboveOutlet:position.y-(bowl.rimY-4.5),
      parameter:bowl.z+bowl.radius*Math.max(0,Math.min(1,(r-bowl.hole)/(bowl.radius-bowl.hole)))};
  }
  return null;
}

export function rankingParameter(position,raw,bowls,bowlInfo){
  if(bowlInfo)return bowlInfo.parameter;
  for(const bowl of bowls){
    // Landing below the actual hole must stay ahead of everyone still circling it.
    if(Math.hypot(position.x-bowl.x,position.z-bowl.z)<=bowl.radius+.55&&position.y<bowl.rimY-4.5-.55&&raw>bowl.z-.001)return bowl.z-.001;
  }
  return raw;
}

export function racerDistance(a,b){
  if(a.position&&b.position)return straightDistance(a.position,b.position);
  return Math.abs(a.progress-b.progress);
}

export function crossingTime(before,after,line,start,end){
  if(after>=line)return null;
  const fraction=before>line&&before>after?Math.max(0,Math.min(1,(before-line)/(before-after))):0;
  return start+(end-start)*fraction;
}
