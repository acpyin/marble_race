import assert from 'node:assert/strict';
import {newAccount,placeBet,settleBet,abandonBet} from '../src/betting.js';
const initial=newAccount();assert.equal(initial.balance,1000);
let one=placeBet(initial,[2],8,'a');assert.equal(one.balance,995);
assert.throws(()=>placeBet(one,[3],8,'a'));
assert.equal(settleBet(one,2,'wrong').balance,995);
one=settleBet(one,2,'a');assert.equal(one.balance,1035);
assert.equal(settleBet(one,2,'a').balance,1035);
for(let count=1;count<=4;count++){
 const picks=Array.from({length:count},(_,i)=>i);
 const bet=placeBet(initial,picks,8,'b');assert.equal(bet.balance,1000-count*5);
 assert.equal(settleBet(bet,0,'b').balance,1040-count*5);
 assert.equal(settleBet(bet,7,'b').balance,1000-count*5);
 assert.equal(settleBet(bet,-1,'b').balance,1000-count*5);
 assert.equal(abandonBet(bet).balance,bet.balance);assert.equal(abandonBet(bet).active,null);
}
assert.equal(placeBet({...initial,balance:5},[0],8,'c').balance,0);
assert.throws(()=>placeBet({...initial,balance:4},[0],8,'c'));
assert.throws(()=>placeBet(initial,[],8,'d'));
assert.throws(()=>placeBet(initial,[0,1,2,3,4],8,'d'));
assert.throws(()=>placeBet(initial,[8],8,'e'));
assert.equal(placeBet(initial,[2,2],8,'f').balance,995);
console.log('1000 珠初始余额、每球 5 珠、最多 4 球、无入场费及单次结算检查通过');
