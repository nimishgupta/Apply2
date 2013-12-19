import F = module("./flapjax");
import Filter = module("./filter")

export class TextFilter implements Filter.Filter {
  public elt : HTMLElement;
  public fn : any;
  public ser : any;
  public disabled : any;

  constructor(init : string, friendly : string, label : string) {
    this.elt = F.INPUT({ type: 'text', placeholder: friendly, value: init });
    var text = F.$B(this.elt);
    this.fn = text.liftB(function(search) {
      return function(obj) {
        if (search === '') { 
          return true;
        }
        return obj[label].toLowerCase().indexOf(search.toLowerCase()) !== -1;
      };
      });
    this.ser = text.liftB(function(t) { return { t: 'Text', v: t } });
    this.disabled = F.constantB(false);
  }
}


export class EnumFilter implements Filter.Filter {
  public elt : HTMLElement;
  public fn : any;
  public ser : any;
  public disabled : any;

  constructor(init : string, friendly : string, label : string, elems : any) {
    var opts = Object.keys(elems).map(function(s) { 
      if (init === s) {
        return F.OPTION({ value: s, selected: 'selected' }, F.TEXT(s));
      }
      else {
        return F.OPTION({ value: s }, F.TEXT(s));
      }  
      });
    var select = F.SELECTSty({}, opts);
    var sel = F.$B(select);
    this.fn = sel.liftB(function(selection) {
      return function(obj) { 
        return obj[label] === selection;
      };     
      });
    this.elt = F.DIV(F.TEXT(friendly), select);
    this.disabled = F.constantB(false),
    this.ser = sel.liftB(function(selV) { return { t: 'Enum', v: selV }; });
  }
}

export class SetFilter implements Filter.Filter {
  public elt : HTMLElement;
  public fn : any;
  public ser : any;
  public disabled : any;

  constructor(init : string, friendly : string, label : string, elems : any) {
    var opts = Object.keys(elems).sort().map(function(s) {
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
    var elt = F.DIV(F.TEXT(friendly), select);
    return { fn: fn, elt: elt,
      disabled: F.constantB(false),
      // TODO(arjun): shouldn't it be t: 'Set' ??
      ser:  sel.liftB(function(selV) { return { t: 'Enum', v: selV }; })
    };
  }
}

export class NumFilter implements Filter.Filter {
  public elt : HTMLElement;
  public fn : any;
  public ser : any;
  public disabled : any;

  // @param {{min: string, max: string}=} init
  constructor (init, friendly : string, label : string) {
    var min = F.INPUT({
      type: 'text',
      placeholder: 'min', 
      value: init ? init.min : ''
    });
    var max = F.INPUT({
      type: 'text', 
      placeholder: 'max',
      value: init ? init.max : '' 
    });
    var minB = F.$B(min);
    var maxB = F.$B(max);
    this.fn = F.liftB(function(minV, maxV) {
      minV = parseFloat(minV);
      maxV = parseFloat(maxV);
      return function(obj) { 
        var passesMin = isNaN(minV) || obj[label] >= minV;
        var passesMax = isNaN(maxV) || obj[label] <= maxV;
        return passesMin && passesMax;
      };
      }, minB, maxB);
    this.ser = F.liftB(function(minV, maxV) {
      return { t: 'Num', v: { min: minV, max: maxV } };
      }, minB, maxB);
    this.elt = F.DIV(F.TEXT(friendly), 
      F.TEXT(': ['), min, F.TEXT(', '), max, F.TEXT(']'));
    this.disabled = F.constantB(false);
  }
}

export class CannotFilter implements Filter.Filter {
  public elt : HTMLElement;
  public fn : any;
  public ser : any;
  public disabled : any;

  // @param {{min: string, max: string}=} init
  constructor (typ : string, message : string) {
    this.fn = F.constantB(function() { return true; }), 
    this.elt = F.DIV(F.TEXT(message));
    this.disabled = F.constantB(true);
    this.ser = F.constantB({ t: typ });
  }
}

export class StarFilter implements Filter.Filter {
  public elt : HTMLElement;
  public fn : any;
  public ser : any;
  public disabled : any;

  /**
  * @param {boolean=} init
  * @return {{ fn: F.Behavior, elt: Node }}
  */
  constructor(init : bool, friendly : string, label : string) {
    var input = F.INPUT({
      type: 'checkbox', 
      checked: init === undefined ? true : init
    });
    var checked = F.$B(input);
    this.elt = F.SPAN(input, F.TEXT(friendly));    
    this.fn = checked.liftB(function(sel) {
      return function(obj) {
        return (obj[label].length > 0) === sel;
      };
    });
    this.disabled = F.constantB(false);
    this.ser = checked.liftB(function(v) { return { t: 'Star', v: v } });
  }
}

export class ScoreFilter implements Filter.Filter {
  public elt : HTMLElement;
  public fn : any;
  public ser : any;
  public disabled : any;

  /**
   * @param {{min: string, max: string, rev: string}=} init
   */
   constructor(init, friendly : string, label : string, reviewers, myRevId) {
    var min = F.INPUT({ type: 'text',placeholder: 'min',
     value: init ? init.min : ''  });
    var max = F.INPUT({ type: 'text', placeholder: 'max',
      value: init ? init.max : ''  });
    var initRev = init ? init.rev : myRevId;
    var rev = F.SELECTSty({}, Object.keys(reviewers).map(function(id) {
      var s = id === initRev ? 'selected' : '';
      return F.OPTION({ value: id, selected: s }, reviewers[id]); 
      }));
    var minB = F.$B(min);
    var maxB = F.$B(max);
    var revB = F.$B(rev);
    this.fn = F.liftB(function(minV, maxV, revV) {
      minV = parseFloat(minV);
      maxV = parseFloat(maxV);
      return function(obj) { 
        if (obj[label] === undefined) {
          return false;
        }
        var score = obj[label][revV];
        if (score === undefined) {
          return false;
        }
        var passesMin = isNaN(minV) || score  >= minV;
        var passesMax = isNaN(maxV) || score <= maxV;
        return passesMin && passesMax;
      };
      }, minB, maxB, revB);
    this.ser = F.liftB(function(minV, maxV, revV) {
      return { t: 'Num', v: { min: minV, max: maxV, rev: revV } };
      }, minB, maxB, revB);
    this.elt = F.DIV(F.TEXT(friendly), 
      F.TEXT(': ['), min, F.TEXT(', '), 
      max, F.TEXT('] by '), rev);
    this.disabled = F.constantB(false);
  }
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

  makeFilter(init) : Filter.Filter {
    return new TextFilter(init, this.friendly, this.label_);
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

/**
 * @constructor
 * @extends {TextCol}
 * @param {string} label
 * @param {string} friendly
 * @param {boolean} initVis
 */
 export class EnumCol extends TextCol {

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

  makeFilter(init) : Filter.Filter {
    return new EnumFilter(init, this.friendly, this.label_, this.elems_);
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
    return new SetFilter(init, this.friendly, this.label_, this.elems_);
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

  makeFilter(init) {
    return new NumFilter(init, this.friendly, this.label_);
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
    return F.DIVSty({ className: 'num' },
      [F.TEXT(String(val).match(truncTwo)[0])]);
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
    return new CannotFilter("Mats", "Cannot filter on materials");
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

  makeFilter(init) {
    return new StarFilter(init, this.friendly, this.label_);
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
   makeFilter(init) {
     return new ScoreFilter(init, this.friendly, this.label_,
      this.reviewers_, this.myRevId_);
  }

}
