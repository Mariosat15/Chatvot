// Storage is optional. This queue remains authoritative for the running page,
// including file:// browsers and private sessions that deny localStorage.
export class TrackRotation {
  constructor(ids, shuffle, storage) {
    this.ids=ids;this.shuffle=shuffle;this.storage=storage;this.last=null;this.bag=[];
    try { const state=JSON.parse(storage?.getItem('volt-rotation-v6')||'null');
      if(state&&Array.isArray(state.bag)){this.bag=[...new Set(state.bag)].filter(id=>ids.includes(id));this.last=ids.includes(state.last)?state.last:null;}
    } catch { /* malformed or unavailable storage is recoverable */ }
  }
  save(){try{this.storage?.setItem('volt-rotation-v6',JSON.stringify({bag:this.bag,last:this.last}));}catch{}}
  choose(seed,requested){
    if(this.ids.includes(requested)){if(!this.bag.length)this.bag=this.shuffle(seed);this.last=requested;this.bag=this.bag.filter(id=>id!==requested);this.save();return requested;}
    if(!this.bag.length){this.bag=this.shuffle(seed);if(this.bag.at(-1)===this.last)[this.bag[0],this.bag[this.bag.length-1]]=[this.bag.at(-1),this.bag[0]];}
    // A manual selection may have consumed the next slot.
    if(this.bag.at(-1)===this.last&&this.bag.length>1)[this.bag[0],this.bag[this.bag.length-1]]=[this.bag.at(-1),this.bag[0]];
    const next=this.bag.pop();this.last=next;this.save();return next;
  }
}
