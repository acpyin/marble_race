export const INITIAL_BALANCE=1000,ENTRY_FEE=0,STAKE_PER_PICK=5,HOUSE_EDGE=.05,DAILY_BONUS=100;
export const championReward=ballCount=>Math.floor(STAKE_PER_PICK*ballCount*(1-HOUSE_EDGE));
export function newAccount(){return {balance:INITIAL_BALANCE,active:null,lastResult:null,lastDailyClaim:null};}
export function claimDaily(account,dateKey){
  if(!dateKey||account.lastDailyClaim===dateKey)return {account,claimed:false};
  return {account:{...account,balance:account.balance+DAILY_BONUS,lastDailyClaim:dateKey},claimed:true};
}
export function placeBet(account,selections,ballCount,raceId){
  const picks=[...new Set(selections)];
  if(account.active)throw new Error('本场已下注');
  if(picks.length<1||picks.length>4||picks.some(i=>!Number.isInteger(i)||i<0||i>=ballCount))throw new Error('请选择 1 至 4 颗弹珠');
  const cost=ENTRY_FEE+picks.length*STAKE_PER_PICK;
  if(account.balance<cost)throw new Error('余额不足以押注');
  return {...account,balance:account.balance-cost,active:{raceId,picks,reward:championReward(ballCount),cost},lastResult:null};
}
export function settleBet(account,winner,raceId){
  if(!account.active||account.active.raceId!==raceId)return account;
  const won=account.active.picks.includes(winner),reward=won?account.active.reward:0;
  return {...account,balance:account.balance+reward,active:null,lastResult:{won,reward,cost:account.active.cost,raceId}};
}
export function abandonBet(account){return {...account,active:null};}
