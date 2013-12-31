import F = module("./flapjax");

export interface Filter {
  fn : any;
  elt : HTMLElement;
  ser : any;
  disabled: any
}

export function deserialize(rec, i, ser) {
  switch (ser.t) {
    case 'And':
      return (new And(rec))
        .makeFilter(ser.a.map(function(s) {
           return deserialize(rec, i, s);
        }));
    case 'Or':
      return (new Or(rec))
        .makeFilter(ser.a.map(function(s) {
           return deserialize(rec, i, s);
        }));
    case 'Picker':
      return (new Picker(rec.filters_))
        .makeFilter(deserialize(rec, ser.i, ser.a));
    case 'not':
     return (new Not(rec.filters_))
       .makeFilter(deserialize(rec, i, ser.v));
    case 'neg':
      return false;
    default:
      return rec.filters_[i].makeFilter(ser.v);
  }
};

/**
 * @constructor
 */
export function Nil() {
  this.friendly = "Nil filter";
}

/**
 * @param {*=} init
 * @return {Cols.Filter}
 */
Nil.prototype.makeFilter = function(init) {
  return {
    fn: F.constantB(function(_) { return true; }),
    elt: F.DIVSty({ className: 'err' }, [F.TEXT('Error: Nil filter selected')]),
    disabled: F.constantB(true),
    ser: F.constantB({ t: 'nil' })
  };
};

/**
 * @constructor
 * @extends {Nil}
 * @param {subFilter} Nil
 */
export function Not(subFilter) {
  this.subFilter_ = subFilter;
  this.friendly = "Not " + this.subFilter_.friendly;
};
Not.prototype = new Nil();

/**
 * @param {!Cols.Filter=} init
 * @return {!Cols.Filter}
 */
Not.prototype.makeFilter = function(init) {
  var sub = init ? init : this.subFilter_.makeFilter();
  return {
    fn: sub.fn.liftB(function(f) { return function(x) { return !f(x); }; }),
    elt: F.DIVSty({ className: 'filterPanel' }, [F.TEXT('not'), sub.elt]),
    disabled: sub.disabled,
    ser: sub.ser.liftB(function(sub) { return { t: 'not', v: sub } })
  };
};

/**
 * @param {Nil} defaultSubFilter
 * @param {boolean} isAnd
 * @param {Array.<Nil>=} inits
 * @return {Cols.Filter}
 */
function genericMakeFilter(defaultSubFilter, isAnd, inits) {
  var edit = F.receiverE();

  // TODO: init is now misnamed, should be empty
  var init = inits ? inits : [ defaultSubFilter.makeFilter() ];
  var arr = edit.collectE(init, function(v, arr) {
    if (v === 'new') {
      return arr.concat([ defaultSubFilter.makeFilter() ]);
    }
    else if (v.delete_) {
      arr = arr.filter(function(w) { return w !== v.delete_; });
      return arr.length === 0 ? [ defaultSubFilter.makeFilter() ] : arr;
    }
    else {
      return arr;
    }
  }).startsWith(init);

  var elt = F.DIVSty({}, arr.liftB(function(arrV) {  
    var fn = function() { return Array.prototype.slice.call(arguments); };
    var la = [fn].concat(arrV.map(function(v) { 
      var del = F.A({ href: '#', className: 'buttonLink' }, F.TEXT('⊗'));
      F.extractEventE(del, 'click').mapE(function(_) { edit.sendEvent({ delete_: v }); });
      return F.DIVSty({ className: 'filterPanel' },
        [F.DIV(F.DIV(del), F.DIV(v.elt))]); }));
    return F.liftB.apply(null, la);
  }).switchB());

  var fn_and = function() {
    var args = Array.prototype.slice.call(arguments);
    return function(obj) {
      if (isAnd) {
        return args.every(function(f) { return f(obj); });
      }
      else {
        return args.some(function(f) { return f(obj); });
      }
    };
  };
  var filter = arr.liftB(function(arr_v) {
    return F.liftB.apply(null, [fn_and].concat(arr_v.map(function(f) {
      return f.disabled.liftB(function(disabledV) {
        if (disabledV) {
          return F.constantB(function() { return isAnd; });
        }
        else {
          return f.fn;
        }
      }).switchB();
    })));
   }).switchB();


  var disabled = arr.liftB(function(...args) {
    function isAllDisabled() {
      return args.every(function(v) { return v; });
    }
    var subDisabled = args.map(function(v) { return v.disabled; });
    return F.liftB.apply(null, [isAllDisabled].concat(subDisabled));
  }).switchB();

  arr.liftB(function(arrV) {
    var last = arrV[arrV.length - 1];
    if (last === undefined) {
      return F.constantB(false);
    }
    return F.liftB(function(lastDisabled, lastSer) {
      return lastDisabled === false;
    }, last.disabled, last.ser)
  }).switchB().liftB(function(needNew) {
    if (needNew) {
      edit.sendEvent('new');
    }
  });

  var serFn = F.constantB(function(...args) {
    return { t: isAnd ? 'And' : 'Or', a: args };
  });
  var ser = arr.liftB(function(arrV) {
    return serFn.ap.apply(serFn, arrV.map(function(v) { return v.ser; }));
  }).switchB();
  
  return {
    fn: filter,
    elt: F.DIVSty({ className: 'filterPanel' }, 
             [F.DIV(F.TEXT(isAnd ? "and" : "or"),
              F.DIVSty({ className: 'lbracket' }, [elt]))]),
    disabled: disabled,
    ser: ser
  };
};

/**
 * @constructor
 * @extends {Nil}
 * @param {Nil} subFilter
 */
export function And(subFilter) {
  this.subFilter_ = subFilter;
  this.friendly = "And " + subFilter.friendly;
};
And.prototype = new Nil();

/**
 * @param {Array.<Nil>=} inits
 * @return {Cols.Filter}
 */
And.prototype.makeFilter = function(inits) {
  return genericMakeFilter(this.subFilter_, true, inits);
};

/**
 * @constructor
 * @extends {Nil}
 * @param {Nil} subFilter
 */
export function Or(subFilter) {
  this.subFilter_ = subFilter;
  this.friendly = "Or " + subFilter.friendly;
};
Or.prototype = new Nil();

/**
 * @param {Array.<Nil>=} inits
 * @return {Cols.Filter}
 */
Or.prototype.makeFilter = function(inits) {
  return genericMakeFilter(this.subFilter_, false, inits);
};

/**
 * @constructor
 * @extends {Nil}
 * @param {Array.<Nil>=} filters
 */
export function Picker(filters) {
  this.friendly = "F.SELECT ...";
  this.filters_ = filters;
};
Picker.prototype = new Nil();

/**
 * @param {Cols.Filter=} init
 * @return {Cols.Filter}
 */
Picker.prototype.makeFilter = function(init) {
  var filters = this.filters_;
  var ix = 0;
  var opts = this.filters_.map(function(fld) {
    return F.OPTION({ value: ix++ }, fld.friendly);
  });
  var sel = F.SELECTSty({}, [F.OPTION({ value: -1 }, F.TEXT('(select filter)'))].concat(opts));
  var selB = F.$B(sel);
  var selE = selB.changes();

  var negFilter = {
        fn: F.constantB(function(_) { return true; }), // TODO: Use Nil?
        elt: sel,
        disabled: F.constantB(true),
        ser: F.constantB({ t: 'neg' })
      };

  var subFilter = selE.mapE(function(ix) { 
    if (ix === '-1') {
      return negFilter;
    }
    else {
      return filters[ix].makeFilter(); 
    }
  });

  init = init ? init : negFilter;
  var ser = subFilter.startsWith(init).index('ser').switchB()
    .liftB(function(subSer) {
      return { t: 'Picker', i: selB.valueNow(), a: subSer };
    });
  return {
    // TODO: glitch bug exposed if fn/elt/disabled are changed!
    fn: subFilter.mapE(function(v) { return v.fn; })
                     .startsWith(init.fn)
                     .switchB(),
    elt: F.DIVSty({}, subFilter.mapE(function(v) { return v.elt; })
                  .startsWith(init.elt)),
    disabled: selE.mapE(function(ix) { return ix === '-1'; })
              .startsWith(init.disabled.valueNow()),
    ser: ser
  };
}
