// Copyright (c) 2006-2012, Brown University
// Copyright (c) 2013, University of Massachusetts, Amherst

export interface HTMLAttribs {
  className?: string;
  style?: {

  }
}
///////////////////////////////////////////////////////////////////////////////
// Miscellaneous functions

// Sentinel value returned by updaters to stop propagation.
var doNotPropagate = { };

/**
 * @returns {Array}
 */
 var mkArray = function(arrayLike) {
  return Array.prototype.slice.call(arrayLike);
};

//////////////////////////////////////////////////////////////////////////////
// Flapjax core

/**
 * Stamp * Path * Obj
 * @constructor Pulse
 * @private
 */
 var Pulse = function (stamp, value) {
  // Timestamps are used by liftB (and ifE).  Since liftB may receive multiple
  // update signals in the same run of the evaluator, it only propagates the 
  // signal if it has a new stamp.
  this.stamp = stamp;
  this.value = value;
};

/**
 * @constructor PQ
 * @private
 */
 var PQ = function () {
  var ctx = this;
  ctx.val = [];
  this.insert = function (kv) {
    ctx.val.push(kv);
    var kvpos = ctx.val.length-1;
    while(kvpos > 0 && kv.k < ctx.val[Math.floor((kvpos-1)/2)].k) {
      var oldpos = kvpos;
      kvpos = Math.floor((kvpos-1)/2);
      ctx.val[oldpos] = ctx.val[kvpos];
      ctx.val[kvpos] = kv;
    }
  };
  this.isEmpty = function () { 
    return ctx.val.length === 0; 
  };
  this.pop = function () {
    if(ctx.val.length === 1) {
      return ctx.val.pop();
    }
    var ret = ctx.val.shift();
    ctx.val.unshift(ctx.val.pop());
    var kvpos = 0;
    var kv = ctx.val[0];
    while(1) { 
      var leftChild = (kvpos*2+1 < ctx.val.length ? ctx.val[kvpos*2+1].k : kv.k+1);
      var rightChild = (kvpos*2+2 < ctx.val.length ? ctx.val[kvpos*2+2].k : kv.k+1);
      if(leftChild > kv.k && rightChild > kv.k)
      break;

      if(leftChild < rightChild) {
        ctx.val[kvpos] = ctx.val[kvpos*2+1];
        ctx.val[kvpos*2+1] = kv;
        kvpos = kvpos*2+1;
      }
      else {
        ctx.val[kvpos] = ctx.val[kvpos*2+2];
        ctx.val[kvpos*2+2] = kv;
        kvpos = kvpos*2+2;
      }
    }
    return ret;
  };
};

var lastRank = 0;
var stamp = 1;
var nextStamp = function () { return ++stamp; };

//propagatePulse: Pulse * Array Node -> 
//Send the pulse to each node 
var propagatePulse = function (pulse, node) {
  var queue = new PQ(); //topological queue for current timestep

  queue.insert({k:node.rank,n:node,v:pulse});

  while (!queue.isEmpty()) {
    var qv = queue.pop();
    var nextPulse = qv.n.updater(new Pulse(qv.v.stamp, qv.v.value));

    if (nextPulse != doNotPropagate) {
      for (var i = 0; i < qv.n.sendsTo.length; i++) {
        queue.insert({k:qv.n.sendsTo[i].rank,n:qv.n.sendsTo[i],v:nextPulse});
      }
    }
  }
};

/**
 * Event: Array Node b * ( (Pulse a -> Void) * Pulse b -> Void)
 * @constructor
 * @param {Array.<EventStream>} nodes
 */
 function EventStream(nodes,updater) {
  this.updater = updater;
  
  this.sendsTo = []; //forward link
  
  this.rank = ++lastRank;

  for (var i = 0; i < nodes.length; i++) {
    nodes[i].attachListener(this);
  }
  
};

/**
 * note: does not add flow as counting for rank nor updates parent ranks
 * @param {EventStream} dependent
 */
 EventStream.prototype.attachListener = function(dependent) {
  if (!(dependent instanceof EventStream)) {
    throw 'attachListener: expected an EventStream';
  }
  this.sendsTo.push(dependent);
  
  if(this.rank > dependent.rank) {
    var q = [dependent];
    while(q.length) {
      var cur = q.splice(0,1)[0];
      cur.rank = ++lastRank;
      q = q.concat(cur.sendsTo);
    }
  }
};

//note: does not remove flow as counting for rank nor updates parent ranks
EventStream.prototype.removeListener = function (dependent) {
  if (!(dependent instanceof EventStream)) {
    throw 'removeListener: expected an EventStream';
  }

  var foundSending = false;
  for (var i = 0; i < this.sendsTo.length && !foundSending; i++) {
    if (this.sendsTo[i] === dependent) {
      this.sendsTo.splice(i, 1);
      foundSending = true;
    }
  }
  
  return foundSending;
};

/**
 *An internalE is a node that propagates all pulses it receives.  It's used
 * internally by various combinators.
 *
 * @param {Array.<EventStream>=} dependsOn
 */
 var internalE = function(dependsOn? : Array) {
  return new EventStream(dependsOn || [ ],function(pulse) { return pulse; });
};

/**
 * Create an event stream that never fires any events.
 * 
 * @returns {EventStream}
 */
 export function zeroE() {
  return new EventStream([],function(pulse) {
    throw ('zeroE : received a value; zeroE should not receive a value; the value was ' + pulse.value);
    });
};


/** 
 * Create an event stream that fires just one event with the value val.
 *
 * <p>Note that oneE does not immediately fire val. The event is queued and
 * fired after the current event has finished propagating.</p>
 *
 * <p>The following code prints "first", "second" and "third" in order:</p>
 *
 * @example
 * console.log('first');
 * oneE('third').mapE(function(val) { console.log(val); });
 * console.log('second');
 *
 * @param {*} val 
 * @returns {EventStream}
 */
 export function oneE(val) { 
  var sent = false; 
  var evt = new EventStream([],function(pulse) {
    if (sent) { throw ('oneE : received an extra value'); } sent = true; 
    return pulse; }); 
  window.setTimeout(function() {
    sendEvent(evt,val); },0); 
  return evt;
};


/**
 * Triggers when any of the argument event stream trigger; carries the signal
 * from the last event stream that triggered.
 *
 * @param {...EventStream} var_args
 * @returns {EventStream}
 */
 export function mergeE(...args) {
  if (args.length === 0) {
    return zeroE();
  }

  return internalE(args);
};

EventStream.prototype.mergeE = function(...args) {
  return internalE([this].concat(args));
};

/**
 * Transforms this event stream to produce only <code>constantValue</code>.
 *
 * @param {*} constantValue
 * @returns {EventStream}
 */
 EventStream.prototype.constantE = function(constantValue) {
  return new EventStream([this],function(pulse) {
    pulse.value = constantValue;
    return pulse;
    });
};


/**
 * Creates an event stream that can be imperatively triggered with 
 * <code>sendEvent</code>.
 *
 * Useful for integrating Flapajx with callback-driven JavaScript code.
 */
 export function receiverE() {
  var evt = internalE();
  evt.sendEvent = function(value) {
    propagatePulse(new Pulse(nextStamp(), value),evt);
  };
  return evt;
};

//note that this creates a new timestamp and new event queue
function sendEvent(node, value) {
  if (!(node instanceof EventStream)) { throw 'sendEvent: expected Event as first arg'; } //SAFETY
  
  propagatePulse(new Pulse(nextStamp(), value),node);
};

// bindE :: EventStream a * (a -> EventStream b) -> EventStream b
EventStream.prototype.bindE = function(k) {
  /* m.sendsTo resultE
   * resultE.sendsTo prevE
   * prevE.sendsTo returnE
   */
   var m = this;
   var prevE;

   var outE = new EventStream([],function(pulse) { return pulse; });
   outE.name = "bind outE";

   var inE = new EventStream([m], function (pulse) {
    if (prevE) {
      prevE.removeListener(outE, true);
      
    }
    prevE = k(pulse.value);
    if (prevE instanceof EventStream) {
      prevE.attachListener(outE);
    }
    else {
      throw "bindE : expected EventStream";
    }

    return doNotPropagate;
    });
   inE.name = "bind inE";

   return outE;
 };

/**
 * @param {function(*):*} f
 * @returns {!EventStream}
 */
 EventStream.prototype.mapE = function(f) {
  if (!(f instanceof Function)) {
    throw ('mapE : expected a function as the first argument; received ' + f);
  };
  
  return new EventStream([this],function(pulse) {
    pulse.value = f(pulse.value);
    return pulse;
    });
};

/**
 * @returns {EventStream}
 */
 EventStream.prototype.notE = function() { 
  return this.mapE(function(v) { 
    return !v; 
    }); 
};

/**
 * Only produces events that match the given predicate.
 *
 * @param {function(*):boolean} pred
 * @returns {EventStream}
 */
 EventStream.prototype.filterE = function(pred) {
  if (!(pred instanceof Function)) {
    throw ('filterE : expected predicate; received ' + pred);
  };
  
  // Can be a bindE
  return new EventStream([this], function(pulse) {
    return pred(pulse.value) ? pulse : doNotPropagate;
    });
};

/**
 * Only triggers on the first event on this event stream.
 *
 * @returns {EventStream}
 */
 EventStream.prototype.onceE = function() {
  var done = false;
  return this.filterE(function(_) {
    if (!done) {
      done = true;
      return true;
    }
    return false;
    });
};

/**
 * Does not trigger on the first event on this event stream.
 *
 * @returns {EventStream}
 */
 EventStream.prototype.skipFirstE = function() {
  var skipped = false;
  return this.filterE(function(_) {
    if (!skipped) {
      skipped = true;
      return false;
    }
    return true;
    });
};

/**
 * Transforms this event stream to produce the result accumulated by
 * <code>combine</code>.
 *
 * <p>The following example accumulates a list of values with the latest
 * at the head:</p>
 *
 * @example
 * original.collectE([],function(new,arr) { return [new].concat(arr); });
 *
 * @param {*} init
 * @param {Function} combine <code>combine(acc, val)</code> 
 * @returns {EventStream}
 */
 EventStream.prototype.collectE = function(init, combine) {
  var acc = init;
  return this.mapE(
    function (n) {
      var next = combine(n, acc);
      acc = next;
      return next;
      });
};

/**
 * Given a stream of event streams, fires events from the most recent event
 * stream.
 * 
 * @returns {EventStream}
 */
 EventStream.prototype.switchE = function() {
  return this.bindE(function(v) { return v; });
};

var recE = function(fn) {
  var inE = receiverE(); 
  var outE = fn(inE); 
  outE.mapE(function(x) { 
    inE.sendEvent(x); }); 
  return outE; 
};

var delayStaticE = function (event, time) {

  var resE = internalE();
  
  new EventStream([event], function (p) { 
    setTimeout(function () { sendEvent(resE, p.value);},  time ); 
    return doNotPropagate;
    });
  
  return resE;
};

/**
 * Propagates signals from this event stream after <code>time</code>
 * milliseconds.
 * 
 * @param {Behavior|number} time
 * @returns {EventStream}
 */
 EventStream.prototype.delayE = function (time) {
  var event = this;
  
  if (time instanceof Behavior) {

    var receiverEE = internalE();
    var link = 
    {
      from: event, 
      towards: delayStaticE(event, time.valueNow())
    };
    
    //TODO: Change semantics such that we are always guaranteed to get an event going out?
    var switcherE = 
    new EventStream(
      [time.changes()],
      function (p) {
        link.from.removeListener(link.towards); 
        link =
        {
          from: event, 
          towards: delayStaticE(event, p.value)
        };
        sendEvent(receiverEE, link.towards);
        return doNotPropagate;
        });
    
    var resE = receiverEE.switchE();
    
    sendEvent(switcherE, time.valueNow());
    return resE;
    
    } else { return delayStaticE(event, time); }
  };

//mapE: ([Event] (. Array a -> b)) . Array [Event] a -> [Event] b
var mapE = function (fn /*, [node0 | val0], ...*/) {
  //      if (!(fn instanceof Function)) { throw 'mapE: expected fn as second arg'; } //SAFETY
  
  var valsOrNodes = mkArray(arguments);
  //selectors[i]() returns either the node or real val, optimize real vals
  var selectors = [];
  var selectI = 0;
  var nodes = [];
  for (var i = 0; i < valsOrNodes.length; i++) {
    if (valsOrNodes[i] instanceof EventStream) {
      nodes.push(valsOrNodes[i]);
      selectors.push( 
        (function(ii) {
          return function(realArgs) { 
            return realArgs[ii];
          };
          })(selectI));
      selectI++;
      } else {
        selectors.push( 
          (function(aa) { 
            return function () {
              return aa;
            }; 
            })(valsOrNodes[i]));
      } 
    }

    var nofnodes = selectors.slice(1);

    if (nodes.length === 0) {
      return oneE(fn.apply(null, valsOrNodes));
      } else if ((nodes.length === 1) && (fn instanceof Function)) {
        return nodes[0].mapE(
          function () {
            var args = arguments;
            return fn.apply(
              null, 
              nofnodes.map(function (s) {return s(args);}));
            });
        } else if (nodes.length === 1) {
          return fn.mapE(
            function (v) {
              var args = arguments;
              return v.apply(
                null, 
                nofnodes.map(function (s) {return s(args);}));
              });                
        }
        else {
          throw 'unknown mapE case';
        }
      };

/** 
 * Produces values from <i>valueB</i>, which are sampled when <i>sourceE</i>
 * is triggered.
 *
 * @param {Behavior} valueB
 * @returns {EventStream}
 */
 EventStream.prototype.snapshotE = function (valueB) {
  return new EventStream([this], function (pulse) {
    pulse.value = valueB.valueNow(); // TODO: glitch
    return pulse;
    });
};

/**
 * Filters out repeated events that are equal (JavaScript's <code>===</code>).
 *
 * @param {*=} optStart initial value (optional)
 * @returns {EventStream}
 */
 EventStream.prototype.filterRepeatsE = function(optStart) {
  var hadFirst = optStart === undefined ? false : true;
  var prev = optStart;

  return this.filterE(function (v) {
    if (!hadFirst || prev !== v) {
      hadFirst = true;
      prev = v;
      return true;
    }
    else {
      return false;
    }
    });
};

/**
 * <i>Calms</i> this event stream to fire at most once every <i>time</i> ms.
 *
 * Events that occur sooner are delayed to occur <i>time</i> milliseconds after
 * the most recently-fired event.  Only the  most recent event is delayed.  So,
 * if multiple events fire within <i>time</i>, only the last event will be
 * propagated.
 *
 * @param {!number|Behavior} time
 * @returns {EventStream}
 */
 EventStream.prototype.calmE = function(time) {
  if (!(time instanceof Behavior)) {
    time = constantB(time);
  }

  var out = internalE();
  new EventStream(
    [this],
    function() {
      var towards = null;
      return function (p) {
        if (towards !== null) { clearTimeout(towards); }
        towards = setTimeout( function () { 
          towards = null;
          sendEvent(out,p.value); }, time.valueNow());
        return doNotPropagate;
      };
      }());
  return out;
};

/**
 * Only triggers at most every <code>time</code> milliseconds. Higher-frequency
 * events are thus ignored.
 *
 * @param {!number|Behavior} time
 * @returns {EventStream}
 */
 EventStream.prototype.blindE = function (time) {
  return new EventStream(
    [this],
    function () {
      var intervalFn = 
      time instanceof Behavior?
      function () { return time.valueNow(); }
      : function () { return time; };
      var lastSent = (new Date()).getTime() - intervalFn() - 1;
      return function (p) {
        var curTime = (new Date()).getTime();
        if (curTime - lastSent > intervalFn()) {
          lastSent = curTime;
          return p;
        }
        else { return doNotPropagate; }
      };
      }());
};

/**
 * @param {*} init
 * @returns {!Behavior}
 */
 EventStream.prototype.startsWith = function(init) {
  return new Behavior(this,init);
};

/**
 * @constructor
 * @param {EventStream} event
 * @param {*} init
 * @param {Function=} updater
 */
 var Behavior = function (event, init, updater?) {
  if (!(event instanceof EventStream)) { 
    throw 'Behavior: expected event as second arg'; 
  }
  
  var behave = this;
  this.last = init;
  
  //sendEvent to this might impact other nodes that depend on this event
  //sendBehavior defaults to this one
  this.underlyingRaw = event;
  
  //unexposed, sendEvent to this will only impact dependents of this behaviour
  this.underlying = new EventStream([event], updater 
    ? function (p) {
      behave.last = updater(p.value); 
      p.value = behave.last; return p;
    } 
    : function (p) {
      behave.last = p.value;
      return p;
      });
};

Behavior.prototype.index = function(fieldName) {
  return this.liftB(function(obj) { return obj[fieldName]; });
};

/**
 * Returns the presently stored value.
 */
 Behavior.prototype.valueNow = function() {
  return this.last;
};

/**
 * @returns {EventStream}
 */
 Behavior.prototype.changes = function() {
  return this.underlying;
};

/**
 * @returns {!Behavior}
 */
 Behavior.prototype.switchB = function() {
  var behaviourCreatorsB = this;
  var init = behaviourCreatorsB.valueNow();
  
  var prevSourceE = null;
  
  var receiverE = internalE();
  
  //XXX could result in out-of-order propagation! Fix!
  var makerE = 
  new EventStream(
    [behaviourCreatorsB.changes()],
    function (p) {
      if (!(p.value instanceof Behavior)) { throw 'switchB: expected Behavior as value of Behavior of first argument'; } //SAFETY
      if (prevSourceE != null) {
        prevSourceE.removeListener(receiverE);
      }
      
      prevSourceE = p.value.changes();
      prevSourceE.attachListener(receiverE);
      
      sendEvent(receiverE, p.value.valueNow());
      return doNotPropagate;
      });
  
  if (init instanceof Behavior) {
    sendEvent(makerE, init);
  }
  
  return receiverE.startsWith(init instanceof Behavior? init.valueNow() : init);
};

//TODO test, signature
Behavior.prototype.delayB = function (time, init) {
  var triggerB = this;
  if (!(time instanceof Behavior)) {
    time = constantB(time);
  }
  return triggerB.changes()
  .delayE(time)
  .startsWith(arguments.length > 3 ? init : triggerB.valueNow());
};

//artificially send a pulse to underlying event node of a behaviour
//note: in use, might want to use a receiver node as a proxy or an identity map
Behavior.prototype.sendBehavior = function(val) {
  sendEvent(this.underlyingRaw,val);
};

Behavior.prototype.ifB = function(trueB,falseB) {
  var testB = this;
  //TODO auto conversion for behaviour funcs
  if (!(trueB instanceof Behavior)) { trueB = constantB(trueB); }
  if (!(falseB instanceof Behavior)) { falseB = constantB(falseB); }
  return liftB(function(te,t,f) { return te ? t : f; },testB,trueB,falseB);
};


/**
 * @param {...Behavior} var_args
 * @returns {Behavior}
 */
 Behavior.prototype.ap = function(var_args) {
  var args = [this].concat(mkArray(arguments));
  return liftB.apply(null, args);
};

/**
 * @param {Behavior|Function} fn
 * @returns {!Behavior}
 */
 Behavior.prototype.liftB = function(fn) {
  return liftB(fn, this);
};

/**
 * @param {...Behavior} var_args
 */
 Behavior.prototype.andB = function (var_args) {
  return liftB.apply({},[function() {
    for(var i=0; i<arguments.length; i++) {if(!arguments[i]) return false;}
    return true;
    }].concat(mkArray(arguments)));
};

/**
 * @param {...Behavior} var_args
 */
 Behavior.prototype.orB = function (var_args) {
  return liftB.apply({},[function() {
    for(var i=0; i<arguments.length; i++) {if(arguments[i]) return true;}
    return false;
    }].concat(mkArray(arguments)));
};

/**
 * @returns {Behavior}
 */
 Behavior.prototype.notB = function() {
  return this.liftB(function(v) { return !v; });
};

Behavior.prototype.blindB = function (intervalB) {
  return this.changes().blindE(intervalB).startsWith(this.valueNow());
};

Behavior.prototype.calmB = function (intervalB) {
  return this.changes().calmE(intervalB).startsWith(this.valueNow());
};


/**
 * @param {!Behavior|number} interval
 * @returns {Behavior}
 */
 var timerB = function(interval) {
  return timerE(interval).startsWith((new Date()).getTime());
};


/** 
 * condB: . [Behavior boolean, Behavior a] -> Behavior a
 * 
 * Evaluates to the first <i>resultB</i> whose associated <i>conditionB</i> is
 * <code>True</code>
 *
 * @param {Array.<Array.<Behavior>>} var_args
 * @returns {Behavior}
 */
 var condB = function (var_args ) {
  var pairs = mkArray(arguments);
  return liftB.apply({},[function() {
    for(var i=0;i<pairs.length;i++) {
      if(arguments[i]) return arguments[pairs.length+i];
    }
    return undefined;
    }].concat(pairs.map(function(pair) {return pair[0];})
      .concat(pairs.map(function(pair) {return pair[1];}))));
};

/**
 * @param {*} val
 * @returns {!Behavior.<*>}
 */
 export function constantB(val) {
  return new Behavior(internalE(), val);
};

/**
 * @param {Function|Behavior} fn
 * @param {...Behavior} var_args
 * @returns !Behavior
 */
 export function liftB(fn, ...args) {

  //dependencies
  var constituentsE =
  mkArray(arguments)
  .filter(function (v) { return v instanceof Behavior; })
  .map(function (b) { return b.changes(); });
  
  //calculate new vals
  var getCur = function (v) {
    return v instanceof Behavior ? v.last : v;
  };
  
  var getRes = function () {
    return getCur(fn).apply(null, args.map(getCur));
  };

  if(constituentsE.length === 1) {
    return new Behavior(constituentsE[0],getRes(),getRes);
  }

  //gen/send vals @ appropriate time
  var prevStamp = -1;
  var mid = new EventStream(constituentsE, function (p) {
    if (p.stamp != prevStamp) {
      prevStamp = p.stamp;
      return p; 
    }
    else {
      return doNotPropagate;
    }
    });
  
  return new Behavior(mid,getRes(),getRes);
};



///////////////////////////////////////////////////////////////////////////////
// DOM Utilities

module dom_ {

/**
 * assumes IDs already preserved
 *
 * @param {Node|string} replaceMe
 * @param {Node|string} withMe
 * @returns {Node}
 */
 export function swapDom(replaceMe, withMe) {
  if ((replaceMe === null) || (replaceMe === undefined)) { throw ('swapDom: expected dom node or id, received: ' + replaceMe); } //SAFETY
  
  var replaceMeD = dom_.getObj(replaceMe);
  if (!(replaceMeD.nodeType > 0)) { throw ('swapDom expected a Dom node as first arg, received ' + replaceMeD); } //SAFETY
  
  if (withMe) {
    var withMeD = dom_.getObj(withMe);
    if (!(withMeD.nodeType > 0)) { throw 'swapDom: can only swap with a DOM object'; } //SAFETY
    try {
      if (replaceMeD.parentNode === null) { return withMeD; }
      if(withMeD != replaceMeD) replaceMeD.parentNode.replaceChild(withMeD, replaceMeD);
      } catch (e) {
        throw('swapDom error in replace call: withMeD: ' + withMeD + ', replaceMe Parent: ' + replaceMeD + ', ' + e + ', parent: ' + replaceMeD.parentNode);                    
      }
      } else {
    replaceMeD.parentNode.removeChild(replaceMeD); //TODO isolate child and set innerHTML to "" to avoid psuedo-leaks?
  }
  return replaceMeD;
};

//getObj: String U Dom -> Dom
//throws 
//  'getObj: expects a Dom obj or Dom id as first arg'
//  'getObj: flapjax: cannot access object'
//  'getObj: no obj to get
//also known as '$'
export function getObj(name) {
  if (typeof(name) === 'object') {
    return name; 
  }
  else if (typeof(name) === 'null' || typeof(name) === 'undefined') {
    throw 'getObj: expects a Dom obj or Dom id as first arg';
  } 
  else {
    return document.getElementById(name);
  }
};


/**
 * helper to reduce obj look ups
 * getDynObj: domNode . Array (id) -> domObj
 * obj * [] ->  obj
 * obj * ['position'] ->  obj
 * obj * ['style', 'color'] ->  obj.style
 *
 * @param {Node|string} domObj
 * @param {Array.<string>} indices
 * @returns {Object}
 */
 export function getMostDom(domObj, indices) {
  var acc = dom_.getObj(domObj);
  if ( (indices === null) || (indices === undefined) || (indices.length < 1)) {
    return acc;
    } else {
      for (var i = 0; i < indices.length - 1; i++) {
        acc = acc[indices[i]];
      }
      return acc;
    }       
  };

  export function getDomVal(domObj, indices) {
    var val = dom_.getMostDom(domObj, indices);
    if (indices && indices.length > 0) {
      val = val[indices[indices.length - 1]];
    }
    return val;
  };

  export function extractEventDynamicE(eltB, eventName, useCapture) {
    if (typeof useCapture === 'undefined') {
      useCapture = false;
    }
    var eventStream = receiverE();
    var callback = function(evt) {
      eventStream.sendEvent(evt); 
    };
    var currentElt;
    eltB.liftB(function(elt) {
      if (currentElt) {
        currentElt.removeEventListener(eventName, callback, useCapture); 
      }
      currentElt = elt;
      if (elt && elt.addEventListener && elt.removeEventListener) {
        elt.addEventListener(eventName, callback, useCapture);
      }
      });
    return eventStream;
  };

  export function extractEventStaticE(elt, eventName, useCapture) {
    if (typeof useCapture === 'undefined') {
      useCapture = false;
    }
    var eventStream = receiverE();
    var callback = function(evt) {
      eventStream.sendEvent(evt); 
    };
    elt.addEventListener(eventName, callback, useCapture);
    return eventStream;
  };



// Applies f to each element of a nested array.
export function deepEach(arr, f) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] instanceof Array) {
      dom_.deepEach(arr[i], f);
    }
    else {
      f(arr[i]);
    }
  }
};


export function mapWithKeys(obj, f) {
  for (var ix in obj) {
    if (!(Object.prototype && Object.prototype[ix] === obj[ix])) {
      f(ix, obj[ix]);
    }
  }
};


/**
 * @param {Node} parent
 * @param {Node} newChild
 * @param {Node} refChild
 */
 function insertAfter(parent, newChild, refChild) {
  if (typeof refChild != "undefined" && refChild.nextSibling) {
    parent.insertBefore(newChild, refChild.nextSibling);
  }
  else {
    // refChild == parent.lastChild
    parent.appendChild(newChild);
  }
};

/**
 * @param {Node} parent
 * @param {Array.<Node>} existingChildren
 * @param {Array.<Node>} newChildren
 */
 function swapChildren(parent, existingChildren, newChildren) {
  var end = Math.min(existingChildren.length, newChildren.length);
  var i;

  for (i = 0; i < end; i++) {
    parent.replaceChild(newChildren[i], existingChildren[i]);
  }

  var lastInsertedChild = existingChildren[i - 1];

  if (end < existingChildren.length) {
    for (i = end; i < existingChildren.length; i++) {
      parent.removeChild(existingChildren[i]);
    }
  }
  else if (end < newChildren.length) {
    for (i = end; i < newChildren.length; i++) {
      insertAfter(parent, newChildren[i], newChildren[i - 1]);
    }
  }
};

/**
 * not a word
 *
 * @param {*} maybeElement
 * @returns {Node}
 *
 * @suppress {checkTypes} the nodeType check does not get by the typechecker
 */
 function elementize(maybeElement) {
  return (maybeElement.nodeType > 0) 
  ? maybeElement
           : document.createTextNode(maybeElement.toString()); // TODO: toString!!
         };


/**
 * @param {Object} obj
 * @param {string} prop
 * @param {*} val
 */
 export function staticEnstyle(obj, prop, val) {
  if (val instanceof Object) {
    // TODO: enstyle is missing? I think this should be staticEnstyle.
    // mapWithKeys(val, function(k, v) { enstyle(obj[prop], k, v); });
  }
  else {
    obj[prop] = val;
  }
};


/**
 * @param {Object} obj
 * @param {string} prop
 * @param {Behavior|*} val
 */
 function dynamicEnstyle(obj, prop, val) {
  if (val instanceof Behavior) {
    // TODO: redundant? liftB will call anyway ...
    dom_.staticEnstyle(obj, prop, val.valueNow()); 
    val.liftB(function(v) {
      dom_.staticEnstyle(obj, prop, v);
      });
  }
  else if (val instanceof Object) {
    dom_.mapWithKeys(val, function(k, v) {
      dynamicEnstyle(obj[prop], k, v);
      });
  }
  else {
    obj[prop] = val;
  }
};


export function makeTagB(tagName : string) { 
  return function(attribs : HTMLAttribs, ...children : Array<Node>) : HTMLElement {

  var elt = document.createElement(tagName);

  dom_.mapWithKeys(attribs, function(name, val) {
    if (val instanceof Behavior) {
      elt[name] = val.valueNow();
      val.liftB(function(v) { 
        dom_.staticEnstyle(elt, name, v); });
    }
    else {
      dynamicEnstyle(elt, name, val);
    }
    });

  dom_.deepEach(children, function(child) {
    if (child instanceof Behavior) {
      var lastVal = child.valueNow();
      if (lastVal instanceof Array) {
        lastVal = lastVal.map(elementize);
        lastVal.forEach(function(dynChild) { elt.appendChild(dynChild); });
        child.liftB(function(currentVal) {
          currentVal = currentVal.map(elementize);
          swapChildren(elt, lastVal, currentVal);
          lastVal = currentVal;
          });
      }
      else {
        lastVal = elementize(lastVal);
        elt.appendChild(lastVal);
        var lastValIx = elt.childNodes.length - 1; 
        child.liftB(function(currentVal) {
          currentVal = elementize(currentVal);
          if (lastVal.parentNode != elt) {
            elt.appendChild(currentVal); }
            else {
              elt.replaceChild(currentVal, lastVal); }
              lastVal = currentVal;
              });
      }
    }
    else {
      elt.appendChild(elementize(child));
    }
    });

  return elt;
  }; };


//into[index] = deepValueNow(from) via descending from object and mutating each field
export function deepStaticUpdate(into, from, index) {
  var fV = (from instanceof Behavior)? from.valueNow() : from;
  if (typeof(fV) === 'object') {
    for (var i in fV) {
      if (!(Object.prototype) || !(Object.prototype[i])) {
        dom_.deepStaticUpdate(index? into[index] : into, fV[i], i);
      }
    }
    } else {
      var old = into[index];
      into[index] = fV;
    }
  };

//note: no object may be time varying, just the fields
//into[index] = from
//only updates on changes
export function deepDynamicUpdate(into, from, index) {
  var fV = (from instanceof Behavior)? from.valueNow() : from;
  if (typeof(fV) === 'object') {
    if (from instanceof Behavior) {
      throw 'deepDynamicUpdate: dynamic collections not supported';
    }
    for (var i in fV) {
      if (!(Object.prototype) || !(Object.prototype[i])) {
        dom_.deepDynamicUpdate(index? into[index] : into, fV[i], i);
      }
    }
    } else {
      if (from instanceof Behavior) {
        new EventStream(
          [from.changes()],
          function (p) {
            if (index) { 
              var old = into[index];
              into[index] = p.value;
            }
          else { into = p.value; } //TODO notify topE?
          return doNotPropagate;
          });
      }
    }
  };

//insertDom: dom 
//          * dom 
//          [* (null | undefined | 'over' | 'before' | 'after' | 'leftMost' | 'rightMost' | 'beginning' | 'end']
//          -> void
// TODO: for consistency, switch replaceWithD, hookD argument order
export function insertDomInternal(hookD, replaceWithD, optPosition) {
  switch (optPosition)
  {
    case undefined:
    case null:
    case 'over':
    dom_.swapDom(hookD,replaceWithD);
    break;
    case 'before':  
    hookD.parentNode.insertBefore(replaceWithD, hookD);
    break;
    case 'after':
    if (hookD.nextSibling) {
      hookD.parentNode.insertBefore(replaceWithD, hookD.nextSibling);
      } else {
        hookD.parentNode.appendChild(replaceWithD);
      }
      break;
      case 'leftMost':
      if (hookD.parentNode.firstChild) { 
        hookD.parentNode.insertBefore(
          replaceWithD, 
          hookD.parentNode.firstChild);
        } else { hookD.parentNode.appendChild(replaceWithD); }
        break;
        case 'rightMost':
        hookD.parentNode.appendChild(replaceWithD);
        break;
        case 'beginning':
        if (hookD.firstChild) { 
          hookD.insertBefore(
            replaceWithD, 
            hookD.firstChild);
          } else { hookD.appendChild(replaceWithD); }
          break;
          case 'end':
          hookD.appendChild(replaceWithD);
          break;
          default:
          throw ('domInsert: unknown position: ' + optPosition);
        }
      };
/**
 * If no trigger for extraction is specified, guess one
 *
 * @param {Node} domObj
 * @param {EventStream=} triggerE
 * @returns {!Behavior}
 */
 export function extractValueStaticB(domObj, triggerE?) {

  var objD;
  try {
    objD = dom_.getObj(domObj);
    //This is for IE
    if(typeof(domObj) === 'string' && objD.id != domObj) {
      throw 'Make a radio group';
    }
    } catch (e) {
      objD = {type: 'radio-group', name: domObj};
    }

  var getter; // get value at any current point in time
  
  var result;

  switch (objD.type)  {
    //TODO: checkbox.value instead of status?
    case 'checkbox': 
    result = extractDomFieldOnEventE(
      triggerE ? triggerE : 
      extractEventsE(
        objD, 
        'click', 'keyup', 'change'),
      objD,
      'checked').filterRepeatsE(objD.checked).startsWith(objD.checked);
    break; 
    case 'select-one':
    getter = function () {                         
      return objD.selectedIndex > -1 ? 
      (objD.options[objD.selectedIndex].value ?
        objD.options[objD.selectedIndex].value :
        objD.options[objD.selectedIndex].innerText)
      : undefined;
    };
    result = (triggerE ? triggerE :
      extractEventsE(
        objD,
        'click', 'keyup', 'change')).mapE(getter).filterRepeatsE().startsWith(getter());
    break;
    case 'select-multiple':
    //TODO ryan's cfilter adapted for equality check
    getter = function () {
      var res = [];
      for (var i = 0; i < objD.options.length; i++) {
        if (objD.options[i].selected) {
          res.push(objD.options[i].value ? objD.options[i].value : objD.options[i].innerText);
        }
      }
      return res;
    };
    result = 
    (triggerE ? triggerE : 
      extractEventsE(
        objD,
        'click', 'keyup', 'change')).mapE(getter).startsWith(getter());
    break;
    
    case 'text':
    case 'textarea':
    case 'hidden':
    case 'password':
    result = extractDomFieldOnEventE(
      triggerE ? triggerE :
      extractEventsE(
        objD, 
        'click', 'keyup', 'change'),
      objD,
      'value').filterRepeatsE(objD.value).startsWith(objD.value);
    break;
    
  case 'button': //same as above, but don't filter repeats
  result = extractDomFieldOnEventE(
    triggerE ? triggerE :
    extractEventsE(
      objD, 
      'click', 'keyup', 'change'),
    objD,
    'value').startsWith(objD.value);
  break;

  case 'radio': 
  case 'radio-group':

    //TODO returns value of selected button, but if none specified,
    //      returns 'on', which is ambiguous. could return index,
    //      but that is probably more annoying
    
    var radiosAD = 
    mkArray(document.getElementsByTagName('input'))
    .filter(
      function (elt) { 
        return (elt.type === 'radio') &&
        (elt.getAttribute('name') === objD.name); 
        });
    
    getter = 
    objD.type === 'radio' ?
    
    function () {
      return objD.checked;
      } :

      function () {
        for (var i = 0; i < radiosAD.length; i++) {
          if (radiosAD[i].checked) {
            return radiosAD[i].value; 
          }
        }
      return undefined; //TODO throw exn? 
    };
    
    var actualTriggerE = triggerE ? triggerE :
    mergeE.apply(
      null,
      radiosAD.map(
        function (radio) { 
          return extractEventsE(
            radio, 
            'click', 'keyup', 'change'); }));
    
    result =
    actualTriggerE.mapE(getter).filterRepeatsE(getter()).startsWith(getter());
    break;
    default:
    throw ('extractValueStaticB: unknown value type "' + objD.type + '"');
  }

  return result;
};
}

// TODO: should be richer
var $ = dom_.getObj;

/**
 * An event stream that fires every <code>intervalB</code> ms.
 *
 * The interval itself may be time-varying. The signal carried is the current
 * time, in milliseconds.
 *
 * @param {!Behavior|number} intervalB
 * @returns {EventStream}
 */
 var timerE = function(intervalB) {
  if (!(intervalB instanceof Behavior)) {
    intervalB = constantB(intervalB);
  }
  var eventStream = receiverE();
  var callback = function() {
    eventStream.sendEvent((new Date()).getTime());
  };
  var timerID = null;
  intervalB.liftB(function(interval) {
    if (timerID) {
      clearInterval(timerID);
      timerID = null;
    }
    if (typeof interval === 'number' && interval > 0) {
      timerID =  setInterval(callback, interval);
    }
    });
  return eventStream;
};

/**
 * Creates a DOM element with time-varying children.
 *
 * @param {!string} tag
 * @param {!string|Object|Node=} opt_style
 * @param {...(string|Node|Array.<Node>|Behavior)} var_args
 * @returns {!HTMLElement}
 */
 var elt = function(tag, opt_style, var_args) {
  return dom_.makeTagB(tag).apply(null, mkArray(arguments).slice(1));
};

//TEXTB: Behavior a -> Behavior Dom TextNode
export function text(strB) {

  // TODO: Create a static textnode and set the data field?
  //      if (!(strB instanceof Behavior || typeof(strB) == 'string')) { throw 'TEXTB: expected Behavior as second arg'; } //SAFETY
  if (!(strB instanceof Behavior)) { strB = constantB(strB); }
  
  return strB.changes().mapE(
    function (txt) { return document.createTextNode(txt); })
  .startsWith(document.createTextNode(strB.valueNow()));
};

function makeDom(tag : string) {
  var make = dom_.makeTagB(tag);
  return function(...args : Array<Node>) {
    return make.apply(null, [{ }].concat(args));
  }
}

function makeDom0(tag : string) {
  var make = dom_.makeTagB(tag);
  return function(sty : HTMLAttribs) {
    return make(sty);
  }
}

function makeDom1 (tag : string) {
  var make = dom_.makeTagB(tag);
  return function(sty : HTMLAttribs, child0 : Node)  {
    return make(sty, child0);
  }
}

function makeDomSty(tag : string) {
  var make = dom_.makeTagB(tag);
  return function(sty : HTMLAttribs, args : Array<Node>) {
    return make.apply(null, [sty].concat(args));
  }
}

export interface Elt<T> {
  (...args:Array<Node>) : T
}

export interface Elt0<T> {
  (attribs:HTMLAttribs) : T
}

export interface Elt1<T> {
  (attribs:HTMLAttribs, Node) : T
}


export interface EltSty<T> {
  (attribs:HTMLAttribs, children:Array<Node>) : T
}

export var DIV = <Elt<HTMLDivElement>> makeDom('div');
export var SPAN = <Elt<HTMLSpanElement>> makeDom('span');
export var TEXTAREA = <Elt<HTMLTextAreaElement>> dom_.makeTagB('textarea');
export var PRE = <Elt<HTMLPreElement>> makeDom('pre');
export var IMG = <Elt0<HTMLImgElement>> makeDom0('img');
export var INPUT = <Elt0<HTMLInputElement>> makeDom0('input');
export var SELECT = <Elt<HTMLSelectElement>> makeDom('SELECT');
export var OPTION = <Elt1<HTMLOptionElement>> makeDom1('option');
export var A = <Elt1<HTMLAnchorElement>> makeDom1('a');

export var DIVSty = <EltSty<HTMLDivElement>> makeDomSty('div');
export var SELECTSty = <EltSty<HTMLSelectElement>> makeDomSty('select');
export var SPANSty = <EltSty<HTMLSpanElement>> makeDomSty('span');

export function DIVClass(className : string, ...args : Array<Node>) : HTMLDivElement {
  return DIVSty({ className: className }, args);
}

export function TEXT(str) {
  return document.createTextNode(str);
};

///////////////////////////////////////////////////////////////////////////////
// Reactive DOM

/**
 * [EventName] * (EventStream DOMEvent, ... -> Element) -> Element
 *

 * <p>An element may be a function of some event and behaviours, while those
 * same events and behaviours might als be functions of the tag. <i>tagRec</i>
 * is a convenience method for writing such cyclic dependencies. Also, as
 * certain updates may cause a tag to be destroyed and recreated, this
 * guarentees the extracted events are for the most recently constructed DOM
 * node.</p>
 * 
 * <p>This example create a tags whose background color is white on mouse 
 * over and black on mouseout, starting as black.</p>
 *
 * @example
 * tagRec(
 *  ['mouseover', 'mouseout'],
 *  function (overE, outE) {
 *    return elt('div',
 *      { style: {
 *        color:
 *          mergeE(overE.constantE('#FFF'), outE.constantE('#000')).
 *          startsWith('#000')}},
 *      'mouse over me to change color!');
 *  });
 * 
 */
 export function tagRec(eventNames, maker) {
  if (!(eventNames instanceof Array)) { throw 'tagRec: expected array of event names as first arg'; } //SAFETY
  if (!(maker instanceof Function)) { throw 'tagRec: expected function as second arg'; } //SAFETY
  
  var numEvents = eventNames.length;

  var receivers = [ ];
  var i;
  for (i = 0; i < numEvents; i++) {
    receivers.push(internalE());
  }

  var elt = maker.apply(null, receivers);

  for (i = 0; i < numEvents; i++) {
    extractEventE(elt, eventNames[i]).attachListener(receivers[i]);
  }

  return elt;
};



/**
 * A signal carrying DOM events, which triggers on each event.
 * 
 * The argument <code>elt</code> may be a behavior of DOM nodes or 
 * <code>false</code>.
 * 
 * @param {Behavior|Node|Window} elt
 * @param {string} eventName
 * @param {boolean=} useCapture
 * @returns {EventStream}
 */
 export function extractEventE(elt, eventName, useCapture? : bool) {
  if (elt instanceof Behavior) {
    return dom_.extractEventDynamicE(elt, eventName, useCapture);
  }
  else {
    return dom_.extractEventStaticE(elt, eventName, useCapture);
  }
};

/**
 *
 * Extracts just one event from elt.
 *
 * oneEvent detaches the underlying DOM callback after receiving the event.
 *
 * @param {Node} elt
 * @param {string} eventName
 * @returns {EventStream}
 */
 var oneEvent = function(elt, eventName) {
  return recE(function(evts) {
    return extractEventE(evts.constantE(false).startsWith(elt),
      eventName);
    });
};

/**
 * @param {Behavior} domObj
 * @param {...string} var_args
 * @returns {EventStream}
 */
 var extractEventsE = function (domObj, ...var_args) {
  var eventNames = Array.prototype.slice.call(arguments, 1);
  
  var events = (eventNames.length === 0 ? [] : eventNames)
  .map(function (eventName) {
   return extractEventE(domObj, eventName); 
   });
  
  return mergeE.apply(null, events);
};

/**extractDomFieldOnEventE: Event * Dom U String . Array String -> Event a
 *
 * @param {EventStream} triggerE
 * @param {Node} domObj
 * @param {...*} var_args
 */
 var extractDomFieldOnEventE = function (triggerE, domObj, var_args) {
  if (!(triggerE instanceof EventStream)) { throw 'extractDomFieldOnEventE: expected Event as first arg'; } //SAFETY
  var indices = Array.prototype.slice.call(arguments, 2);
  var res =
  triggerE.mapE(
    function () { return dom_.getDomVal(domObj, indices); });
  return res;
};

var extractValueE = function (domObj) {
  return extractValueB.apply(null, arguments).changes();
};

//extractValueOnEventB: Event * DOM -> Behavior
// value of a dom form object, polled during trigger
var extractValueOnEventB = function (triggerE, domObj) {
  return dom_.extractValueStaticB(domObj, triggerE);
};



/**
 * Signal carries the value of the form element <code>domObj</code>.
 *
 * The signal triggers when a change event fires, which depends on the
 * type of <code>domObj</code>.
 *
 * @param {!Behavior|!Node} domObj
 * @returns {!Behavior}
 */
 var extractValueB = function (domObj) {
  if (domObj instanceof Behavior) {
    return domObj.liftB(function (dom) { return dom_.extractValueStaticB(dom); })
    .switchB();
    } else {
      return dom_.extractValueStaticB(domObj);
    }
  };

/**
 * @param {!Behavior|!Node} domObj
 * @returns {!Behavior}
 */
 export var $B = extractValueB;




 var insertValue = function (val, domObj /* . indices */) {
  var indices = Array.prototype.slice.call(arguments, 2);
  var parent = dom_.getMostDom(domObj, indices);
  dom_.deepStaticUpdate(parent, val, 
    indices ? indices[indices.length - 1] : undefined);      
};

//TODO convenience method (default to firstChild nodeValue) 
var insertValueE = function (triggerE, domObj /* . indices */) {
  if (!(triggerE instanceof EventStream)) { throw 'insertValueE: expected Event as first arg'; } //SAFETY
  
  var indices = Array.prototype.slice.call(arguments, 2);
  var parent = dom_.getMostDom(domObj, indices);
  
  triggerE.mapE(function (v) {
    dom_.deepStaticUpdate(parent, v, indices? indices[indices.length - 1] : undefined);
    });
};

//insertValueB: Behavior * domeNode . Array (id) -> void
//TODO notify adapter of initial state change?
/**
 * Inserts each event in <i>triggerB</i> into the field <i>field</i> of the 
 * elmeent <i>dest</i></p>.
 *
 * @param {Behavior} triggerB
 * @param {Node} domObj
 * @param {...string} var_args
 */
 export function insertValueB(triggerB, domObj, ...indices) {

  var parent = dom_.getMostDom(domObj, indices);
  
  
  //NOW
  dom_.deepStaticUpdate(parent, triggerB, indices ? indices[indices.length - 1] : undefined);
  
  //LATER
  dom_.deepDynamicUpdate(parent, triggerB, indices? indices[indices.length -1] : undefined);
  
};

//TODO copy dom event call backs of original to new? i don't thinks so
//  complication though: registration of call backs should be scoped
export function insertDomE(triggerE, domObj) {

  if (!(triggerE instanceof EventStream)) { throw 'insertDomE: expected Event as first arg'; } //SAFETY
  
  var objD = dom_.getObj(domObj);
  
  var res = triggerE.mapE(
    function (newObj) {
      //TODO safer check
      if (!((typeof(newObj) === 'object') && (newObj.nodeType === 1))) { 
        newObj = SPAN(newObj);
      }
      dom_.swapDom(objD, newObj);
      objD = newObj;
      return newObj; // newObj;
      });
  
  return res;
};



//insertDom: dom 
//          * dom U String domID 
//          [* (null | undefined | 'over' | 'before' | 'after' | 'leftMost' | 'rightMost' | 'beginning' | 'end']
//          -> void
var insertDom = function (replaceWithD, hook, optPosition) {
  //TODO span of textnode instead of textnode?
  dom_.insertDomInternal(
    dom_.getObj(hook), 
    ((typeof(replaceWithD) === 'object') && (replaceWithD.nodeType > 0)) ? replaceWithD :
    document.createTextNode(replaceWithD),      
    optPosition);           
};

/**
 * if optID not specified, id must be set in init val of trigger
 * if position is not specified, default to 'over'
 *
 * @param {Behavior|Node} initTriggerB
 * @param {string=} optID
 * @param {string=} optPosition
 */
 export function insertDomB(initTriggerB, optID, optPosition?) {

  if (!(initTriggerB instanceof Behavior)) { 
    initTriggerB = constantB(initTriggerB);
  }
  
  var triggerB = initTriggerB.liftB(function (d) { 
    if ((typeof(d) === 'object') && (d.nodeType >  0)) {
      return d;
      } else {
        var res = document.createElement('span'); //TODO createText instead
        res.appendChild(document.createTextNode(d));
        return res;
      }
      });
  
  var initD = triggerB.valueNow();
  if (!((typeof(initD) === 'object') && (initD.nodeType === 1))) { throw ('insertDomB: initial value conversion failed: ' + initD); } //SAFETY  
  
  dom_.insertDomInternal(
    optID === null || optID === undefined ? dom_.getObj(initD.getAttribute('id')) : dom_.getObj(optID), 
    initD, 
    optPosition);
  
  var resB = insertDomE(triggerB.changes(), initD).startsWith(initD);
  
  return resB;
};

/**
 * @param {Node} elem
 * @returns {EventStream}
 */
 var mouseE = function(elem) {
  return extractEventE(elem,'mousemove')
  .mapE(function(evt) {
    if (evt.pageX | evt.pageY) {
      return { left: evt.pageX, top: evt.pageY };
    }
    else if (evt.clientX || evt.clientY) {
      return { left : evt.clientX + document.body.scrollLeft,
       top: evt.clientY + document.body.scrollTop };
     }
     else {
      return { left: 0, top: 0 };
    }
    });
};

/**
 * Triggered when the mouse moves, carrying the mouse coordinates.
 *
 * @param {Node} elem
 * @returns {Behavior} <code>{ left: number, top: number }</code>
 */
 var mouseB = function(elem) {
  return mouseE(elem).startsWith({ left: 0, top: 0 });
};

/**
 * @param {Node} elem
 * @returns {EventStream}
 */
 export function clicksE(elem) {
  return extractEventE(elem,'click');
};


//////////////////////////////////////////////////////////////////////////////
// Combinators for web services

module xhr_ {

  export var encodeREST = function(obj) {
    var str = "";
    for (var field in obj) {
    if (typeof(obj[field]) !== 'function') { // skips functions in the object
      if (str != '') { str += '&'; }
      str += field + '=' + encodeURIComponent(obj[field]);
    }
  }
  return str;
};

}

/**
 * Must be an event stream of bodies
 * 
 * @private
 * @param {!string} method PUT or POST
 * @param {!string} url URL to POST to
 * @returns {EventStream} an event stream carrying objects with three
 * fields: the request, the response, and the xhr object.
 */
 EventStream.prototype.xhrWithBody_ = function(method, url) {
  var respE = receiverE();
  this.mapE(function(body) {
    var xhr = new XMLHttpRequest();
    function callback() {
      if (xhr.readyState !== 4) {
        return;
      }
      respE.sendEvent({ request: body, response: xhr.responseText, xhr: xhr });
    }
    xhr.onload = callback;
    // We only do async. Build your own for synchronous.
    xhr.open(method, url, true);
    xhr.send(body);
    });
  return respE; 
};

/**
 * POST the body to url. The resulting event stream carries objects with three
 * fields: <code>{request: string, response: string, xhr: XMLHttpRequest}</code>
 *
 * @param {!string} url
 * @returns {EventStream}
 */
 EventStream.prototype.POST = function(url) {
  return this.xhrWithBody_('POST', url);
};

 EventStream.prototype.GET = function(url : string) {
  var respE = receiverE();
  this.mapE(function(urlParams) {
    var xhr = new XMLHttpRequest();
    function callback() {
      if (xhr.readyState !== 4) {
        return;
      }
      respE.sendEvent({ request: urlParams,
                        response: xhr.responseText, 
                        xhr: xhr });
    }
    xhr.onload = callback;
    xhr.open('GET', url + '?' + xhr_.encodeREST(urlParams), true);
    xhr.send('');
    });
    return respE; 
};

/**
 * Transforms a  stream of objects, <code>obj</code>, to a stream of fields
 * <code>obj[name]</code>.
 *
 * @param {!string} name
 * @returns {EventStream}
 */
 EventStream.prototype.index = function(name) {
  return this.mapE(function(obj) {
    if (typeof obj !== 'object' && obj !== null) {
      throw 'expected object';
    }
    return obj[name];
    });
};

/**
 * Parses a steram of JSON-serialized strings.
 *
 * @returns {EventStream}
 */
 EventStream.prototype.JSONParse = function() {
  return this.mapE(function(val) {
    return JSON.parse(val);
    });
};

/**
 * Serializes a stream of values.
 *
 * @returns {EventStream}
 */
 EventStream.prototype.JSONStringify = function() {
  return this.mapE(function(val) {
    return JSON.stringify(val);
    });
};

