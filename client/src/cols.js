goog.provide('Cols');
goog.require('goog.string');

/**
 * A text column
 *
 * @param {string} label name
 * @param {string} friendly name
 * @constructor
 */
Cols.TextCol = function (label, friendly, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.initVis = initVis;
}

/**
 * @param {string=} init
 * @return {{ fn: F.Behavior, elt: Node }}
 */
Cols.TextCol.prototype.makeFilter = function(init) {
  var elt = INPUT({ type: 'text', placeholder: this.friendly, value: init });
  var label = this.label_;
  var text = F.$B(elt);
  var fn = text.liftB(function(search) {
    return function(obj) {
      if (search === '') { return true; }
      else { return obj[label].indexOf(search) !== -1; }
    };
  });
  var ser = text.liftB(function(t) { return { t: 'Text', v: t } });
  return { fn: fn, elt: elt, ser: ser, disabled: F.constantB(false) };
};

Cols.TextCol.prototype.compare = function(o1, o2) {
  var v1 = o1[this.label_], 
      v2 = o2[this.label_];
  if (v1 < v2) { return -1; }
  else if (v1 > v2) { return 1; }
  else { return 0; }
};

/**
 * @return {Node}
 */
Cols.TextCol.prototype.display = function(obj) {
  var val = obj[this.label_];
  if (typeof val === 'string') {
    if (goog.string.isEmpty(val)) {
      return DIV({ className: 'err' }, 'Missing Value') ;
    }
    else {
      return DIV(val);
    }
  }
  else {
    return SPAN({ className: 'err' }, 'Unexpected value');
  }
};

/**
 * @constructor
 * @extends {Cols.TextCol}
 * @param {string} label
 * @param {string} friendly
 */
Cols.EnumCol = function(label, friendly, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.elems_ = Object.create(null);
  this.initVis = initVis;
}
goog.inherits(Cols.EnumCol, Cols.TextCol);

/**
 * @return {Node}
 */
Cols.EnumCol.prototype.display = function(obj) {
  this.elems_[obj[this.label_]] = true;
  var val = obj[this.label_];
  if (typeof val === 'string') {
    if (goog.string.isEmpty(val)) {
      return DIV({ className: 'err' }, 'Missing Value') ;
    }
    else {
      return DIV(val);
    }
  }
  else {
    return SPAN({ className: 'err' }, 'Unexpected value');
  }
};

Cols.EnumCol.prototype.makeFilter = function(init) {
  var label = this.label_;
  var opts = Object.keys(this.elems_).map(function(s) { 
    if (init === s) {
      return OPTION({ value: s, selected: 'selected' }, s);
    }
    else {
      return OPTION({ value: s }, s);
    }  
  });
  var select = SELECT(opts);
  var sel = F.$B(select);
  var fn = sel.liftB(function(selection) {
    return function(obj) { 
      return obj[label] === selection;
      };     
  });
  var elt = DIV(this.friendly, select);
  return { 
    fn: fn, 
    elt: elt,
    disabled: F.constantB(false),
    ser:  sel.liftB(function(selV) { return { t: 'Enum', v: selV }; })
  };
};

/**
 * @constructor
 * @extends {Cols.TextCol}
 * @param {string} label
 * @param {string} friendly
 */
Cols.SetCol = function(label, friendly, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.elems_ = Object.create(null);
  this.initVis = initVis;
}
goog.inherits(Cols.SetCol, Cols.TextCol);

Cols.SetCol.prototype.display = function(val) {
  var this_ = this;
  val[this.label_].forEach(function(v) {
    this_.elems_[v] = true;
  });
  return DIV({ className: 'set' }, 
      DIV(val[this.label_].map(function(v) {
        return DIV(String(v));
      })));
};

Cols.SetCol.prototype.makeFilter = function(init) {
  var label = this.label_;
  var opts = Object.keys(this.elems_).map(function(s) {
    if (init === s) {
      return OPTION({ value: s, selected: 'selected' }, s);
    }
    else {
      return OPTION({ value: s }, s);
    }  
  });
  var select = SELECT(opts);
  var sel = F.$B(select);
  var fn = sel.liftB(function(selection) {
    return function(obj) { 
      return obj[label].indexOf(selection) !== -1;
      };     
  });
  var elt = DIV(this.friendly, select);
  return { fn: fn, elt: elt,
    disabled: F.constantB(false),
    ser:  sel.liftB(function(selV) { return { t: 'Enum', v: selV }; })
  };
};

Cols.SetCol.prototype.compare = function(o1, o2) {
  // TODO: fixme
  throw 'cannot compare SetCol';
};

/**
 * A number column
 *
 * @param {string} label field name
 * @param {string} friendly column name
 * @constructor
 * @extends {Cols.TextCol}
 */
Cols.NumCol = function(label, friendly, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.initVis = initVis;
}
goog.inherits(Cols.NumCol, Cols.TextCol);

/**
 *
 * @param {{min: string, max: string}=} init
 */
Cols.NumCol.prototype.makeFilter = function(init) {
  var label = this.label_;

  var min = INPUT({ type: 'text', placeholder: 'min',
                    value: init ? init.min : ''  });
  var max = INPUT({ type: 'text', placeholder: 'max',
                    value: init ? init.max : ''  });
  var minB = F.$B(min);
  var maxB = F.$B(max);
  var fn = F.liftB(function(minV, maxV) {
    minV = parseFloat(minV);
    maxV = parseFloat(maxV);
    return function(obj) { 
      var passesMin = isNaN(minV) || obj[label] >= minV;
      var passesMax = isNaN(maxV) || obj[label] <= maxV;
      return passesMin && passesMax;
    };
  }, minB, maxB);
  var ser = F.liftB(function(minV, maxV) {
    return { t: 'Num', v: { min: minV, max: maxV } };
  }, minB, maxB);
  var elt = DIV(this.friendly, ': [', min, ', ', max, ']');
  return { 
    fn: fn, 
    elt: elt,
    disabled: F.constantB(false),
    ser: ser
  };
};

Cols.NumCol.prototype.display = function(obj) {
  var val = obj[this.label_];
  if (typeof val === 'number') {
    return DIV({ className: 'num' }, String(val));
  }
  else if (val === null) {
    return SPAN({ className: 'err' }, 'Missing');
  }
  else {
    return SPAN({ className: 'err' }, 'NaN');
  }
};

/**
 * A column of links
 *
 * @param {string} label field name
 * @param {string} friendly column name
 * @param {string} materialsCap
 * @constructor
 * @extends {Cols.TextCol}
 */
Cols.MatsCol = function(label, friendly, materialsCap, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.materialsCap_ = materialsCap;
  this.initVis = initVis;
}
goog.inherits(Cols.MatsCol, Cols.TextCol);

Cols.MatsCol.prototype.display = function(val) {
  var materialsCap = this.materialsCap_;
  function dispLink(v) {
    return DIV(DIV(A({ target: '_blank', href: materialsCap + "?" + v.url }, 
            v.text)));
  }

  function isValidLink(link) {
    return typeof link.url === 'string';
  }

  return DIV({ className: 'set' }, 
    val[this.label_].filter(isValidLink).map(dispLink));
}

Cols.MatsCol.prototype.makeFilter = function() {
  return { 
    fn: F.constantB(function() { return true; }), 
    elt: DIV("Cannot filter on materials"),
    disabled: F.constantB(true),
    ser: { t: 'Mats' }
  };
};

/**
 * A column of stars
 *
 * @param {string} label field name
 * @param {string} friendly column name
 * @constructor
 * @extends {Cols.TextCol}
 */
Cols.StarCol = function(label, friendly, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.initVis = initVis;
}
goog.inherits(Cols.StarCol, Cols.TextCol);

/**
 * @param {boolean=} init
 * @return {{ fn: F.Behavior, elt: Node }}
 */
Cols.StarCol.prototype.makeFilter = function(init) {
  var this_ = this;
  var input = INPUT({ type: 'checkbox', 
                      checked: init === undefined ? true : init });
  var elt = SPAN(input, this.friendly);
  var checked = F.$B(input);
  var fn = checked.liftB(function(sel) {
    return function(obj) {
      return obj[this_.label_] === true;
    };
  });

  return { fn: fn, elt: elt, disabled: F.constantB(false),
    ser: checked.liftB(function(v) { return { t: 'Star', v: v } }) };
};

Cols.StarCol.prototype.compare = function(o1, o2) {
  var v1 = o1[this.label_];
  var v2 = o2[this.label_];
  if (v1 === true && v2 === false) { return 1; }
  else if (v1 === false && v2 === true) { return -1; }
  else { return 0; }
};

Cols.StarCol.prototype.display = function(val) {
  if (val[this.label_]) {
    return IMG({ src: 'star.png', className: 'star', alt: 'Highlighted' });
  }
  else {
    return DIV();
  }
};

/**
 * @constructor
 * @extends{Cols.TextCol}
 */
Cols.ScoreCol = function(label, friendly, reviewers, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.reviewers_ = reviewers;
  this.initVis = initVis;
}
goog.inherits(Cols.ScoreCol, Cols.TextCol);

Cols.ScoreCol.prototype.display = function(val) {
  var this_ = this;
  return DIV({ className: 'set' },
      Object.keys(this.reviewers_).map(function(revId) {
        var dict = val[this_.label_];
        if (!dict) {
          return DIV();
        }
        var score = dict[revId];
        if (score === undefined) {
          return DIV();
        }
        return DIV(this_.reviewers_[revId] + ": " + score);
      }));
}

