import PQ = module("./priorityQueue2")

class Pair<A,B> {
  fst : A;
  snd : B
}

function iota(n : number) : number[] {
  var arr = [ ];
  for (var i = 0; i < n; i++) {
    arr.push(i);
  }
  return arr;
}

function find<T>(f : (x:T) => bool, arr : T[], notFound : T) : T {
  for (var i = 0; i < arr.length; i++) {
    if (f(arr[i]) === true) {
      return arr[i];
    }
  }
  return notFound;
}

function now() {
  return (new Date()).valueOf();
}

function removeAll<T>(arr : Array<T>, elt : T) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] == elt) {
      arr.splice(i, 1);
    }
  }
}

function propagate(q : PQ.PQ<Producer>) {
  var item;
  while (!q.isEmpty()) {
    item = q.dequeue();
    item.produce(q);
  }
};

export interface Producer {
  produce : (q : PQ.PQ<Producer>) => void;
}

export interface Consumer {
  rankChanged : (n:number) => void;
  consume : (q : PQ.PQ<Producer>) => void;
}

export interface Stream<T> {
  valueNow : T;
  rank : number;
  connect : (consumer : Consumer) => void;
  disconnect : (consumer : Consumer) => void;
}

class Map<S,T> implements Stream<T> {
  private f : (x:S) => T;
  private x : Stream<S>;
  private sendsTo : Array<Consumer>;
  private queuedNow : bool;
  valueNow : T;
  rank : number;

  constructor (x : Stream<S>, f : (x:S) => T) {
    this.sendsTo = [];
    this.queuedNow = false;
    this.valueNow = x.valueNow === null ? null : f(x.valueNow);
    this.rank = x.rank + 1;
    this.f = f;
    this.x = x;
    this.x.connect(this);
  }

  public connect(consumer : Consumer) {
    this.sendsTo.push(consumer);
  }

  public rankChanged(newChildRank : number) {
    if (newChildRank < this.rank) {
      return;
    }
    var newRank = newChildRank + 1;
    this.rank = newRank;
    this.sendsTo.forEach(child => child.rankChanged(newRank));
  }

  public produce(q : PQ.PQ<Producer>) {
    this.valueNow = this.x.valueNow === null ? null : this.f(this.x.valueNow);
    this.queuedNow = false;
    this.sendsTo.forEach(child => child.consume(q));
  }

  public consume(q : PQ.PQ<Producer>) {
    if (!this.queuedNow) {
      this.queuedNow = true;
      q.enqueue(this.rank, this);
    }
  }

  public disconnect(consumer : Consumer) {
    removeAll(this.sendsTo, consumer);
  }
}

class Map2<U,S,T> implements Stream<T> {
  private f : (x:U, y:S) => T;
  private x : Stream<U>;
  private y : Stream<S>;
  private sendsTo : Array<Consumer>;
  private queuedNow : bool;
  valueNow : T;
  rank : number;

  constructor (x : Stream<U>, y : Stream<S>, f : (x:U, y:S) => T) {
    this.sendsTo = [];
    this.queuedNow = false;
    this.f = f;
    this.x = x;
    this.y = y;    
    this.valueNow = 
      x.valueNow === null || y.valueNow === null ? 
        null : f(x.valueNow, y.valueNow);
    this.rank = 1 + Math.max(x.rank, y.rank);
    var self = this;
    this.x.connect({
      rankChanged: (x : number) => self.rankChanged(x),
      consume : function(q : PQ.PQ<Producer>) {
        if (!self.queuedNow) {
          self.queuedNow = true;
          q.enqueue(self.rank, self);
        }
      }
    });
    this.y.connect({
      rankChanged: (x : number) => self.rankChanged(x),
      consume : function(q : PQ.PQ<Producer>) {
        if (!self.queuedNow) {
          self.queuedNow = true;
          q.enqueue(self.rank, self);
        }
      }
    });
  }

  public connect(consumer : Consumer) {
    this.sendsTo.push(consumer);
  }

  public rankChanged(newChildRank : number) {
    if (newChildRank < this.rank) {
      return;
    }
    var newRank = newChildRank + 1;
    this.rank = newRank;
    this.sendsTo.forEach(child => child.rankChanged(newRank));
  }

  public produce(q : PQ.PQ<Producer>) {
    this.valueNow = 
      this.x.valueNow === null || this.y.valueNow === null ? 
        null : this.f(this.x.valueNow, this.y.valueNow);
    this.queuedNow = false;
    this.sendsTo.forEach(child => child.consume(q));
  }

  public disconnect(consumer : Consumer) {
    removeAll(this.sendsTo, consumer);
  }
}

class Merge<T> implements Stream<T> {
  private x : Stream<T>;
  private y : Stream<T>;
  private sendsTo : Array<Consumer>;
  private queuedNow : bool;
  valueNow : T;
  rank : number;
  private nextValue : T;

  constructor (x : Stream<T>, y : Stream<T>) {
    this.sendsTo = [];
    this.queuedNow = false;
    this.x = x;
    this.y = y;    
    this.valueNow = x.valueNow === null ? y.valueNow : x.valueNow;
    this.rank = 1 + Math.max(x.rank, y.rank);
    this.nextValue = null;
    var self = this;

    this.x.connect({
      rankChanged: (x : number) => self.rankChanged(x),
      consume : function(q : PQ.PQ<Producer>) {
        if (!self.queuedNow) {
          self.queuedNow = true;
          q.enqueue(self.rank, self);
          self.nextValue = self.x.valueNow;
        }
      }
    });
    this.y.connect({
      rankChanged: (x : number) => self.rankChanged(x),
      consume : function(q : PQ.PQ<Producer>) {
        if (!self.queuedNow) {
          self.queuedNow = true;
          q.enqueue(self.rank, self);
          self.nextValue = self.y.valueNow;
        }
      }
    });
  }

  public connect(consumer : Consumer) {
    this.sendsTo.push(consumer);
  }

  public rankChanged(newChildRank : number) {
    if (newChildRank < this.rank) {
      return;
    }
    var newRank = newChildRank + 1;
    this.rank = newRank;
    this.sendsTo.forEach(child => child.rankChanged(newRank));
  }

  public produce(q : PQ.PQ<Producer>) {
    this.valueNow = this.nextValue;
    this.nextValue = null;
    this.queuedNow = false;
    this.sendsTo.forEach(child => child.consume(q));
  }

  public disconnect(consumer : Consumer) {
    removeAll(this.sendsTo, consumer);
  }
}

class Bind<U,T> implements Stream<T> {
  private m : Stream<U>;
  private k : (x:U) => Stream<T>;
  private r : Stream<T>;
  private sendsTo : Array<Consumer>;
  private queuedNow : bool;
  valueNow : T;
  rank : number;

  constructor (m : Stream<U>, k : (x:U) => Stream<Stream<T>>) {
    this.sendsTo = [];
    this.queuedNow = false;
    this.m = m;
    this.k = k;
    this.r = this.m.valueNow === null ? constant(null) : this.k(m.valueNow);
    this.valueNow = this.r.valueNow;
    this.rank = 1 + Math.max(this.m.rank, this.r.rank);

    var that = this;

    var rConsume = function(q : PQ.PQ<Producer>) {
      that.valueNow = that.r.valueNow;
      if (that.valueNow != null) {
        q.enqueue(that.rank, that);
      }
      return;
    }

    var rConsumer = { 
      rankChanged: (x : number) => that.rankChanged(x), 
      consume: rConsume 
    };
    var mConsume = function(q : PQ.PQ<Producer>) {
      var v = that.m.valueNow;
      that.r.disconnect(rConsumer);
      that.r = v === null ? constant(null) : that.k(v);
      that.rankChanged(that.r.rank);
      that.valueNow = that.r.valueNow;
      q.enqueue(that.rank, that);
      that.r.connect(rConsumer);
    }
    
    this.m.connect({ 
      rankChanged: (x : number) => that.rankChanged(x), 
      consume: mConsume
    });
    this.r.connect(rConsumer);

  }

  public rankChanged(newChildRank : number) {
    if (newChildRank < this.rank) {
      return;
    }
    var newRank = newChildRank + 1;
    this.rank = newRank;
    this.sendsTo.forEach(child => child.rankChanged(newRank));
  }

  public produce(q : PQ.PQ<Producer>) {
    var this_ = this;
    this.queuedNow = false;
    this.sendsTo.forEach(child => child.consume(q));
  }

  public connect(consumer : Consumer) {
    this.sendsTo.push(consumer);
  }

  public disconnect(consumer : Consumer) {
    removeAll(this.sendsTo, consumer);
  }
}

class Const<T> implements Stream<T> {
  valueNow : T;
  rank : number;

  constructor(x : T) {
    this.valueNow = x;
    this.rank = 0;
  }

  public connect(x : Consumer) {
  }

  public disconnect(x : Consumer) {
  }
}

export class Source<T> implements Stream<T> {
  valueNow : T;
  rank : number;
  private sendsTo : Array<Consumer>;

  constructor(x : T) {
    this.valueNow = x;
    this.rank = 0;
    this.sendsTo = [];
  }

  public connect(x : Consumer) {
    this.sendsTo.push(x);
  }

  public disconnect(x : Consumer) {
    removeAll(this.sendsTo, x);
  }

  public produce(q : PQ.PQ<Producer>) {
    this.sendsTo.forEach(child => child.consume(q));
  }

  public send(x : T) {
    this.valueNow = x;
    var q = new PQ.PQ();
    q.enqueue(0, this);
    propagate(q);
  }
}

export function source<T>(x : T) : Source<T> {
  return new Source(x);
}

export function map<A,B>(f : (x:A) => B, x : Stream<A>) : Stream<B> {
  return new Map(x, f);
}

export function mapInit<A,B>(init : B, f : (x:A) => B, 
  x : Stream<A>) : Stream<B> {
  var node = new Map(x, f);
  node.valueNow = init;
  return node;
}


export function map2<A,B,C>(f : (x:A, y:B) => C, x : Stream<A>, 
  y : Stream<B>) : Stream<C> {
  return new Map2(x, y, f);
}

export function merge<A>(x : Stream<A>, y : Stream<A>) : Stream<A> {
  return new Merge(x, y);
}

export function bind<A,B>(m : Stream<A>, k : (a:A) => Stream<B>) : Stream<B> {
  return new Bind(m, k);
}
export function constant<A>(x : A) : Stream<A> {
  return new Const(x);
}