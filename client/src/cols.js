goog.provide('Cols');
goog.require('goog.string');
goog.require('F');

/**
 * @typedef {{ fn: !F.Behavior, elt: !Node, ser: !F.Behavior, 
 *             disabled: !F.Behavior }}
 */
Cols.Filter;

/**
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
 * @param {*=} init
 * @return {Cols.Filter}
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

/**
 * @param {Object} o1
 * @param {Object} o2
 * @return {number}
 */
Cols.TextCol.prototype.compare = function(o1, o2) {
  var v1 = o1[this.label_];
  var v2 = o2[this.label_];
  if (typeof v1 === 'string' && typeof v2 === 'string') {
    v1 = v1.toLowerCase();
    v2 = v2.toLowerCase();
  }
  if (v1 === v2) {
    return 0;
  }
  else if (v1 < v2) {
    return -1;
  }
  else {
    return 1;
  }
};

/**
 * @param {Object} obj
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
 * @param {string} label
 * @param {string} friendly
 * @param {boolean} initVis
 * @constructor {IdCol}
 * @extends {Cols.TextCol}
 */
Cols.IdCol = function (label, friendly, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.initVis = initVis;
}
goog.inherits(Cols.IdCol, Cols.TextCol);

Cols.IdCol.prototype.display = function(obj) {
  var val = obj[this.label_];
  var link = DIV({ className: 'buttonLink' }, val);
  F.$E(link, 'click').mapE(function() {
    var compose = document.getElementById('composeTextarea');
    if (compose) {
      compose.value = compose.value + ' #' + val + '; ';
    }
  });
  return link;
};

/**
 * @constructor
 * @extends {Cols.TextCol}
 * @param {string} label
 * @param {string} friendly
 * @param {boolean} initVis
 */
Cols.EnumCol = function(label, friendly, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.elems_ = Object.create(null);
  this.initVis = initVis;
}
goog.inherits(Cols.EnumCol, Cols.TextCol);

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
 * @param {boolean} initVis
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
    val[this.label_].map(function(v) {
      return DIV(String(v));
    }));
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
  var v1 = o1[this.label_];
  var v2 = o2[this.label_];
  // TODO: discriminate further when lengths are equal
  return v1.length - v2.length;
};

/**
 * @param {string} label field name
 * @param {string} friendly column name
 * @param {boolean} initVis
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
    return DIV(A({ target: '_blank', href: materialsCap + "?" + v.url }, 
            v.text));
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
    elt: DIV("Cannot filter on materials"), // TODO: fixme
    disabled: F.constantB(true),
    ser: F.constantB({ t: 'Mats' })
  };
};

Cols.MatsCol.prototype.compare = function(o1, o2) {
  var v1 = o1[this.label_];
  var v2 = o2[this.label_];
  return v1.length - v2.length;
};

/**
 * @param {string} myId
 * @param {string} label field name
 * @param {string} friendly column name
 * @param {boolean} initVis
 * @constructor
 * @extends {Cols.TextCol}
 */
Cols.StarCol = function(myId, label, friendly, initVis) {
  this.myId_ = myId
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
      return (obj[this_.label_].length > 0) === sel;
    };
  });

  return { fn: fn, elt: elt, disabled: F.constantB(false),
    ser: checked.liftB(function(v) { return { t: 'Star', v: v } }) };
};

Cols.StarCol.prototype.display = function(val) {
  if (val[this.label_].indexOf(this.myId_) !== -1) {
    return IMG({ src: 'star.png', className: 'star', alt: 'Highlighted' });
  }
  else if (val[this.label_].length > 0) {
    return IMG({ src: 'otherstar.png', className: 'star', alt: 'Highlighted' });
  }
  else {
    return DIV();
  }
};

/**
 * @constructor
 * @extends{Cols.TextCol}
 * @param {string} label
 * @param {string} friendly
 * @param {!Object.<string,string>} reviewers
 * @param {string} myRevId
 * @param {boolean} initVis
 */
Cols.ScoreCol = function(label, friendly, reviewers, myRevId, initVis) {
  this.label_ = label;
  this.friendly = friendly;
  this.reviewers_ = reviewers;
  this.myRevId_ = myRevId;
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
};

// TODO: sorting and filtering on scores
/**
 * @param {{min: string, max: string, rev: string}=} init
 */
Cols.ScoreCol.prototype.makeFilter = function(init) {
  var this_ = this;
  var label = this.label_;

  var min = INPUT({ type: 'text', placeholder: 'min',
                    value: init ? init.min : ''  });
  var max = INPUT({ type: 'text', placeholder: 'max',
                    value: init ? init.max : ''  });
  var initRev = init ? init.rev : this_.myRevId_;
  var rev = SELECT(Object.keys(this.reviewers_).map(function(id) {
    var s = id === initRev ? 'selected' : '';
    return OPTION({ value: id, selected: s }, this_.reviewers_[id]); 
  }));
  var minB = F.$B(min);
  var maxB = F.$B(max);
  var revB = F.$B(rev);
  var fn = F.liftB(function(minV, maxV, revV) {
    minV = parseFloat(minV);
    maxV = parseFloat(maxV);
    return function(obj) { 
      if (obj[this_.label_] === undefined) {
        return false;
      }
      var score = obj[this_.label_][revV];
      if (score === undefined) {
        return false;
      }
      var passesMin = isNaN(minV) || score  >= minV;
      var passesMax = isNaN(maxV) || score <= maxV;
      return passesMin && passesMax;
    };
  }, minB, maxB, revB);
  var ser = F.liftB(function(minV, maxV, revV) {
    return { t: 'Num', v: { min: minV, max: maxV, rev: revV } };
  }, minB, maxB, revB);
  var elt = DIV(this.friendly, ': [', min, ', ', max, '] by ', rev);
  return { 
    fn: fn, 
    elt: elt,
    disabled: F.constantB(false),
    ser: ser
  };
};
