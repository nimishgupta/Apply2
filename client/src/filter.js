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
 * @return {{fn : F.Behavior, elt: Node, disabled: F.Behavior }}
 */
filter.Nil.prototype.makeFilter = function() {
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
 * @param {Object=} init
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
 * @constructor
 * @extends {filter.Nil}
 */
filter.And = function(subFilter) {
  this.subFilter_ = subFilter;
  this.friendly = "And " + subFilter.friendly;
};
goog.inherits(filter.And, filter.Nil);

/**
 * @param {Array.<filter.Nil>=} inits
 * @return {{ fn: F.Behavior, elt: Node }}
 */
filter.And.prototype.makeFilter = function(inits) {
  var edit = F.receiverE();
  var this_ = this;

	// TODO: init is now misnamed, should be empty
  var init = inits ? inits : [ this.subFilter_.makeFilter() ];
  var arr = edit.collectE(init, function(v, arr) {
    if (v === 'new') {
      return arr.concat([ this_.subFilter_.makeFilter() ]);
    }
    else if (v.delete_) {
      arr = arr.filter(function(w) { return w !== v.delete_; });
      return arr.length === 0 ? [ this_.subFilter_.makeFilter() ] : arr;
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
      return args.every(function(f) { return f(obj); });
    };
  };
  var filter = arr.liftB(function(arr_v) {
    return F.liftB.apply(null, [fn_and].concat(arr_v.map(function(f) {
      return f.disabled.liftB(function(disabledV) {
        if (disabledV) {
          return F.constantB(function() { return true; });
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
    return { t: 'And', a: F.mkArray(arguments) };
	});
  var ser = arr.liftB(function(arrV) {
		return serFn.ap.apply(serFn, arrV.map(function(v) { return v.ser; }));
	}).switchB();
  
  return {
    fn: filter,
    elt: DIV({ className: 'filterPanel' }, 
             DIV(DIV('and'), DIV({ className: 'lbracket' }, elt))),
    disabled: disabled,
		ser: ser
  };
};

/**
 * @constructor
 * @extends {filter.Nil}
 */
filter.Or = function(subFilter) {
  this.subFilter_ = subFilter;
  this.friendly = "Or " + subFilter.friendly;
};
goog.inherits(filter.Or, filter.Nil);

filter.Or.prototype.makeFilter = function(inits) {
  var edit = F.receiverE();
  var this_ = this;

  var init = inits ? inits : [ this.subFilter_.makeFilter() ];
  var arr = edit.collectE(init, function(v, arr) {
    if (v === 'new') {
      return arr.concat([ this_.subFilter_.makeFilter() ]);
    }
    else if (v.delete_) {
      arr = arr.filter(function(w) { return w !== v.delete_; });
      return arr.length === 0 ? [ this_.subFilter_.makeFilter() ] : arr;
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
      return args.some(function(f) { return f(obj); });
    };
  };
  var filter = arr.liftB(function(arr_v) {
    return F.liftB.apply(null, [fn_and].concat(arr_v.map(function(f) { 
      return f.disabled.liftB(function(disabledV) {
        if (disabledV) {
          return F.constantB(function() { return false; });
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
    return { t: 'Or', a: F.mkArray(arguments) };
	});
  var ser = arr.liftB(function(arrV) {
		return serFn.ap.apply(serFn, arrV.map(function(v) { return v.ser; }));
	}).switchB();
  
  return {
    fn: filter,
    elt: DIV({ className: 'filterPanel' }, 
             DIV(DIV('or'), DIV({ className: 'lbracket' }, elt))),
    disabled: disabled,
		ser: ser
  };
};

/**
 * @constructor Picker
 * @extends {filter.Nil}
 */
filter.Picker = function(filters) {
  this.friendly = "Select ...";
  this.filters_ = filters;
};
goog.inherits(filter.Picker, filter.Nil);

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
	var ser = subFilter.startsWith(init).index('ser').switchB().liftB(function(subSer) {
		return { t: 'Picker', i: selB.valueNow(), a: subSer };
	});
  return {
		// TODO: glitch bug exposed if fn/elt/disabled are changed!
    fn: subFilter.mapE(function(v) { return v.fn; })
                     .startsWith(init.fn)
                     .switchB(),
    elt: subFilter.mapE(function(v) { return v.elt; })
                  .startsWith(init.elt),
    disabled: selE.mapE(function(ix) { return ix === '-1'; })
			        .startsWith(init.disabled),
		ser: ser
  };
}
