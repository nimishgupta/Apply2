import F = module("./flapjax");
import Filter = module("./filter")

export interface Filter {
  fn : any;
  elt : HTMLElement;
  ser : any;
  disabled: any
}

/**
 * @param {string} label name
 * @param {string} friendly name
 * @constructor
 */
 export class TextCol {
  label_: string;
  public friendly: string;
  public initVis: bool;

  constructor (label, friendly, initVis) {
    this.label_ = label;
    this.friendly = friendly;
    this.initVis = initVis;
  }

  makeFilter(init) : Filter {
    var elt = F.INPUT({ type: 'text', placeholder: this.friendly, value: init });
    var label = this.label_;
    var text = F.$B(elt);
    var fn = text.liftB(function(search) {
      return function(obj) {
        if (search === '') { 
          return true;
        }
        return obj[label].toLowerCase().indexOf(search.toLowerCase()) !== -1;
      };
      });
    var ser = text.liftB(function(t) { return { t: 'Text', v: t } });
    return { fn: fn, elt: elt, ser: ser, disabled: F.constantB(false) };
  }

  compare(o1, o2) : number {
    var o1Has = o1.hasOwnProperty(this.label_);
    var o2Has = o2.hasOwnProperty(this.label_);
    if (!o1Has && o2Has) {
      return -1;
    }
    if (o1Has && !o2Has) {
      return 1;
    }
    if (!o1Has && !o1Has) {
      return 0;
    }
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
  }

  display(obj) : HTMLElement {
    var val = obj[this.label_];
    if (typeof val === 'string') {
    // TODO(arjun): used to use goog.string.isEmpty
    if (val === "") {
      return F.DIVSty({ className: 'err' }, [F.TEXT('Missing Value')]);
    }
    else {
      return F.DIV(val);
    }
  }
  else {
    return F.SPANSty({ className: 'err' }, [F.TEXT('Unexpected value')]);
  }
}

}

export class IdCol extends TextCol {

  constructor(label, friendly, initVis) {
    super(label, friendly, initVis);
  }

  display(obj) : HTMLElement {
    var val = obj[this.label_];
    var link = F.DIVSty({ className: 'buttonLink' }, [val]);
    F.extractEventE(link, 'click').mapE(function() {
    // TODO(arjun): remove this feature
    var compose = <HTMLTextAreaElement> document.getElementById('composeTextarea');
    if (compose) {
      compose.value = compose.value + ' #' + val + '; ';
    }
    });
    return link;
  }

}

/**
 * @constructor
 * @extends {TextCol}
 * @param {string} label
 * @param {string} friendly
 * @param {boolean} initVis
 */
 export class EnumCol extends IdCol {

  elems_: { [id: string] : any };

  constructor(label, friendly, initVis) {
    super(label, friendly, initVis);
    this.elems_ = Object.create(null);
  }

  display(obj) : HTMLElement {
    this.elems_[obj[this.label_]] = true;
    var val = obj[this.label_];
    if (typeof val === 'string') {
    // TODO(arjun): goog.string.isEmpty
    if (val === "") {
      return F.DIVSty({ className: 'err' }, [F.TEXT('Missing Value')]) ;
    }
    else {
      return F.DIV(val);
    }
    }
    else {
      return F.SPANSty({ className: 'err' }, [F.TEXT('Unexpected value')]);
    }
  }

  makeFilter(init) : Filter {
    var label = this.label_;
    var opts = Object.keys(this.elems_).map(function(s) { 
      if (init === s) {
        return F.OPTION({ value: s, selected: 'selected' }, F.TEXT(s));
      }
      else {
        return F.OPTION({ value: s }, F.TEXT(s));
      }  
      });
    var select = F.SELECTSty({}, opts);
    var sel = F.$B(select);
    var fn = sel.liftB(function(selection) {
      return function(obj) { 
        return obj[label] === selection;
      };     
      });
    var elt = F.DIV(F.TEXT(this.friendly), select);
    return { 
      fn: fn, 
      elt: elt,
      disabled: F.constantB(false),
      ser:  sel.liftB(function(selV) { return { t: 'Enum', v: selV }; })
    };
  }
}

export class SetCol extends TextCol {

 elems_: { [id: string] : any };

  constructor(label, friendly, initVis) {
    super(label, friendly, initVis);
    this.elems_ = Object.create(null);
  }

  display (val) {
    var this_ = this;
    val[this.label_].forEach(function(v) {
      this_.elems_[v] = true;
      });
    return F.DIVSty({ className: 'set' }, 
      val[this.label_].map(function(v) {
        return F.DIV(F.TEXT(String(v)));
        }));
  }

  makeFilter (init) {
    var label = this.label_;
    var opts = Object.keys(this.elems_).map(function(s) {
      if (init === s) {
        return F.OPTION({ value: s, selected: 'selected' }, F.TEXT(s));
      }
      else {
        return F.OPTION({ value: s }, F.TEXT(s));
      }  
      });
    var select = F.SELECTSty({}, opts);
    var sel = F.$B(select);
    var fn = sel.liftB(function(selection) {
      return function(obj) { 
        return obj[label].indexOf(selection) !== -1;
      };     
      });
    var elt = F.DIV(F.TEXT(this.friendly), select);
    return { fn: fn, elt: elt,
      disabled: F.constantB(false),
      ser:  sel.liftB(function(selV) { return { t: 'Enum', v: selV }; })
    };
  }

  compare(o1, o2) {
    var v1 = o1[this.label_];
    var v2 = o2[this.label_];
  // TODO: discriminate further when lengths are equal
  return v1.length - v2.length;
}

}

/**
 * @param {string} label field name
 * @param {string} friendly column name
 * @param {boolean} initVis
 * @constructor
 * @extends {TextCol}
 */
 export class NumCol extends TextCol {

  constructor(label, friendly, initVis) {
    super(label, friendly, initVis);
  }


/**
 * @param {{min: string, max: string}=} init
 */
 makeFilter(init) {
  var label = this.label_;

  var min = F.INPUT({ 
    type: 'text', placeholder: 'min', value: init ? init.min : ''
    });
  var max = F.INPUT({
    type: 'text', 
    placeholder: 'max',
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
  var elt = F.DIV(F.TEXT(this.friendly), 
    F.TEXT(': ['), min, F.TEXT(', '), max, F.TEXT(']'));
  return { 
    fn: fn, 
    elt: elt,
    disabled: F.constantB(false),
    ser: ser
  };
}

display(obj) {
  if (!obj.hasOwnProperty(this.label_)) {
    return F.SPANSty({ className: 'err' }, [F.TEXT('Missing')]);
  }
  var val = obj[this.label_];
  if (typeof val !== 'number') {
    return F.SPANSty({ className: 'err' }, [F.TEXT('Unexpected value')]);
  }
  // TODO: do this numerically?
  var truncTwo = '[0-9]+(\\.[0-9]{0,2})?';
  return F.DIVSty({ className: 'num' }, [F.TEXT(String(val).match(truncTwo)[0])]);
}

}


/**
 * F.A column of links
 *
 * @param {string} label field name
 * @param {string} friendly column name
 * @param {string} materialsCap
 * @constructor
 * @extends {TextCol}
 */
 export class MatsCol extends TextCol {

  materialsCap_ : string;
  constructor (label, friendly, materialsCap, initVis) {
    super(label, friendly, initVis);
    this.materialsCap_ = materialsCap;
  }

  display(val) {
    var materialsCap = this.materialsCap_;
    function dispLink(v) {
      return F.DIV(F.A({ target: '_blank', href: materialsCap + "?" + v.url }, 
        F.TEXT(v.text)));
    }

    function isValidLink(link) {
      return typeof link.url === 'string';
    }

    return F.DIVSty({ className: 'set' }, 
      val[this.label_].filter(isValidLink).map(dispLink));
  }

  makeFilter() {
    return { 
      fn: F.constantB(function() { return true; }), 
    elt: F.DIV(F.TEXT("Cannot filter on materials")), // TODO: fixme
    disabled: F.constantB(true),
    ser: F.constantB({ t: 'Mats' })
  };
}

compare(o1, o2) {
  var v1 = o1[this.label_];
  var v2 = o2[this.label_];
  return v1.length - v2.length;
}

}

/**
 * @param {string} myId
 * @param {string} label field name
 * @param {string} friendly column name
 * @param {boolean} initVis
 * @constructor
 * @extends {TextCol}
 */
 export class StarCol extends TextCol {

  myId_: string;

  constructor (myId : string, label, friendly, initVis) {
    super(label, friendly, initVis);    
    this.myId_ = myId;

  }

/**
 * @param {boolean=} init
 * @return {{ fn: F.Behavior, elt: Node }}
 */
 makeFilter(init) {
  var this_ = this;
  var input = F.INPUT({ type: 'checkbox', 
    checked: init === undefined ? true : init });
  var elt = F.SPAN(input, F.TEXT(this.friendly));
  var checked = F.$B(input);
  var fn = checked.liftB(function(sel) {
    return function(obj) {
      return (obj[this_.label_].length > 0) === sel;
    };
    });

  return { fn: fn, elt: elt, disabled: F.constantB(false),
    ser: checked.liftB(function(v) { return { t: 'Star', v: v } }) };
  }

  display(val) : HTMLElement {
    if (val[this.label_].indexOf(this.myId_) !== -1) {
      return F.IMG({ src: 'star.png', className: 'star', alt: 'Highlighted' });
    }
    else if (val[this.label_].length > 0) {
      return F.IMG({ src: 'otherstar.png', className: 'star', alt: 'Highlighted' });
    }
    else {
      return F.DIV();
    }
  }

}

/**
 * @constructor
 * @extends{TextCol}
 * @param {string} label
 * @param {string} friendly
 * @param {!Object.<string,string>} reviewers
 * @param {string} myRevId
 * @param {boolean} initVis
 */
 export class ScoreCol extends TextCol {

  myRevId_ : string;
  reviewers_ : { [id : string] : any };

  constructor (label, friendly, reviewers, myRevId, initVis) {
    super(label, friendly, initVis);
    this.reviewers_ = reviewers;
    this.myRevId_ = myRevId;

  }

  display(val) : HTMLElement {
    var this_ = this;
    return F.DIVSty({ className: 'set' },
      Object.keys(this.reviewers_).map(function(revId) {
        var dict = val[this_.label_];
        if (!dict) {
          return F.DIV();
        }
        var score = dict[revId];
        if (score === undefined) {
          return F.DIV();
        }
        return F.DIV(F.TEXT(this_.reviewers_[revId] + ": " + score));
        }));
  }

// TODO: sorting and filtering on scores
/**
 * @param {{min: string, max: string, rev: string}=} init
 */
 makeFilter(init) {
  var this_ = this;
  var label = this.label_;

  var min = F.INPUT({ type: 'text', placeholder: 'min',
    value: init ? init.min : ''  });
  var max = F.INPUT({ type: 'text', placeholder: 'max',
    value: init ? init.max : ''  });
  var initRev = init ? init.rev : this_.myRevId_;
  var rev = F.SELECTSty({}, Object.keys(this.reviewers_).map(function(id) {
    var s = id === initRev ? 'selected' : '';
    return F.OPTION({ value: id, selected: s }, this_.reviewers_[id]); 
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
  var elt = F.DIV(F.TEXT(this.friendly), 
    F.TEXT(': ['), min, F.TEXT(', '), 
    max, F.TEXT('] by '), rev);
  return { 
    fn: fn, 
    elt: elt,
    disabled: F.constantB(false),
    ser: ser
  };
}

}
