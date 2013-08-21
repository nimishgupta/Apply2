// Copyright (c) 2006-2012, Brown University
// Copyright (c) 2013, University of Massachusetts, Amherst

export interface KV {
  k: number
}

// Priority, where elements have a field 'k' that determines ordering.
export class PQ<T extends KV> {
  val : Array<T> ;
  
  constructor() {
    this.val = []
  }

  public insert(kv : T) {
    this.val.push(kv);
    var kvpos = this.val.length-1;
    while(kvpos > 0 && kv.k < this.val[Math.floor((kvpos-1)/2)].k) {
      var oldpos = kvpos;
      kvpos = Math.floor((kvpos-1)/2);
      this.val[oldpos] = this.val[kvpos];
      this.val[kvpos] = kv;
    }
  }

  public isEmpty() : bool {
    return this.val.length === 0; 
  }
  
  public pop() : T {
    if(this.val.length === 1) {
      return this.val.pop();
    }
    var ret = this.val.shift();
    this.val.unshift(this.val.pop());
    var kvpos = 0;
    var kv = this.val[0];
    while(1) { 
      var leftChild = (kvpos*2+1 < this.val.length ? this.val[kvpos*2+1].k : kv.k+1);
      var rightChild = (kvpos*2+2 < this.val.length ? this.val[kvpos*2+2].k : kv.k+1);
      if(leftChild > kv.k && rightChild > kv.k)
      break;

      if(leftChild < rightChild) {
        this.val[kvpos] = this.val[kvpos*2+1];
        this.val[kvpos*2+1] = kv;
        kvpos = kvpos*2+1;
      }
      else {
        this.val[kvpos] = this.val[kvpos*2+2];
        this.val[kvpos*2+2] = kv;
        kvpos = kvpos*2+2;
      }
    }
    return ret;
  }
}