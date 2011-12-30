goog.provide('filter');

filter.deserialize = function(rec, i, ser) {
  switch (ser.t) {
    case 'And':
      return (new filter.And(rec))
        .makeFilter(ser.a.map(function(s) {
           return filter.deserialize(rec, i, s);
        }));
    case 'Or':
      return (new filter.Or(rec))
        .makeFilter(ser.a.map(function(s) {
           return filter.deserialize(rec, i, s);
        }));
    case 'Picker':
      return (new filter.Picker(rec.filters_))
        .makeFilter(filter.deserialize(rec, ser.i, ser.a));
    case 'neg':
      return false;
    default:
      return rec.filters_[i].makeFilter(ser.v);
  }
};

/**
 * @constructor
 */
filter.Nil = function() {
  this.friendly = "Nil filter";
}

/**
 * @param {*=} init
 * @return {Cols.Filter}
 */
filter.Nil.prototype.makeFilter = function(init) {
  return {
    fn: F.constantB(function(_) { return true; }),
    elt: DIV({ className: 'err' }, 'Error: Nil filter selected'),
    disabled: F.constantB(true),
    ser: F.constantB({ t: 'nil' })
  };
};

/**
 * @constructor
 * @extends {filter.Nil}
 * @param {subFilter} filter.Nil
 */
filter.Not = function(subFilter) {
  this.subFilter_ = subFilter;
  this.friendly = "Not " + subFilter.friendly;
};
goog.inherits(filter.Not, filter.Nil);

/**
 * @param {!Cols.Filter=} init
 * @return {!Cols.Filter}
 */
filter.Not.prototype.makeFilter = function(init) {
  var sub = init ? init : this.subFilter_.makeFilter();
  return {
    fn: sub.filter.liftB(function(f) { return function(x) { return !f(x); }; }),
    elt: DIV({ className: 'filterPanel' }, 'not', sub.elt),
    disabled: sub.disabled,
    ser: sub.liftB(function(sub) { return { t: 'not', v: sub } })
  };
};

/**
 * @param {filter.Nil} defaultSubFilter
 * @param {boolean} isAnd
 * @param {Array.<filter.Nil>=} inits
 * @return {Cols.Filter}
 */
filter.genericMakeFilter = function(defaultSubFilter, isAnd, inits) {
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

  var elt = DIV({}, arr.liftB(function(arrV) {  
    var fn = function() { return Array.prototype.slice.call(arguments); };
    var la = [fn].concat(arrV.map(function(v) { 
      var del = A({ href: '#', className: 'buttonLink' }, '⊗');
      F.$E(del, 'click').mapE(function(_) { edit.sendEvent({ delete_: v }); });
      return DIV({ className: 'filterPanel' }, DIV(DIV(del), DIV(v.elt))); }));
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


  var disabled = arr.liftB(function(arrV) {
    return arrV[arrV.length - 1].disabled;
  }).switchB();

  disabled.changes().mapE(function(disabledV) {
    if (!disabledV) { edit.sendEvent('new'); } });

  var serFn = F.constantB(function(var_args) {
    return { t: isAnd ? 'And' : 'Or', a: F.mkArray(arguments) };
  });
  var ser = arr.liftB(function(arrV) {
    return serFn.ap.apply(serFn, arrV.map(function(v) { return v.ser; }));
  }).switchB();
  
  return {
    fn: filter,
    elt: DIV({ className: 'filterPanel' }, 
             DIV(DIV(isAnd ? 'and' : 'or'), 
             DIV({ className: 'lbracket' }, elt))),
    disabled: disabled,
    ser: ser
  };
};

/**
 * @constructor
 * @extends {filter.Nil}
 * @param {filter.Nil} subFilter
 */
filter.And = function(subFilter) {
  this.subFilter_ = subFilter;
  this.friendly = "And " + subFilter.friendly;
};
goog.inherits(filter.And, filter.Nil);

/**
 * @param {Array.<filter.Nil>=} inits
 * @return {Cols.Filter}
 */
filter.And.prototype.makeFilter = function(inits) {
  return filter.genericMakeFilter(this.subFilter_, true, inits);
};

/**
 * @constructor
 * @extends {filter.Nil}
 * @param {filter.Nil} subFilter
 */
filter.Or = function(subFilter) {
  this.subFilter_ = subFilter;
  this.friendly = "Or " + subFilter.friendly;
};
goog.inherits(filter.Or, filter.Nil);

/**
 * @param {Array.<filter.Nil>=} inits
 * @return {Cols.Filter}
 */
filter.Or.prototype.makeFilter = function(inits) {
  return filter.genericMakeFilter(this.subFilter_, false, inits);
};

/**
 * @constructor
 * @extends {filter.Nil}
 * @param {Array.<filter.Nil>=} filters
 */
filter.Picker = function(filters) {
  this.friendly = "Select ...";
  this.filters_ = filters;
};
goog.inherits(filter.Picker, filter.Nil);

/**
 * @param {Cols.Filter=} init
 * @return {Cols.Filter}
 */
filter.Picker.prototype.makeFilter = function(init) {
  var filters = this.filters_;
  var ix = 0;
  var opts = this.filters_.map(function(fld) {
    return OPTION({ value: ix++ }, fld.friendly);
  });
  var sel = SELECT([OPTION({ value: -1 }, '(select filter)')].concat(opts));
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
    elt: DIV(subFilter.mapE(function(v) { return v.elt; })
                  .startsWith(init.elt)),
    disabled: selE.mapE(function(ix) { return ix === '-1'; })
              .startsWith(init.disabled.valueNow()),
    ser: ser
  };
}
