import fx = module("./fx")

export function event(elt : Node, evt : string) : fx.Stream<Event> {
  var stream = fx.source(null);
  function callback(evt) {
    stream.send(evt);
  }
  elt.addEventListener(evt, callback);
  return stream;
}

export function value(elt : any) : fx.Stream<any> {
  switch (elt.type)  {
    case 'text':
    case 'textarea':
    case 'hidden':
    case 'password':
    case 'button':    
      return fx.mapInit(elt.value, evt => elt.value, event(elt, 'change'));
      break;
    default:
      throw ("fxdom.value, unknown type " + elt.type);
  }
}

export interface HTMLAttribs {
  className?: string;
  style?: {

  }
}

/**
 * @param {Object} obj
 * @param {string} prop
 * @returns {function(*)}
 * @private
 */
function staticEnstyle(obj, prop) {
  return function(val) {
    if (val === null) {
      delete obj[prop];
    }
    else {
      obj[prop] = val;
    }
  };
}

/**
 * @private
 */
function enstyle(target, obj) {
  Object.keys(obj).forEach(function(key) {
    var val = obj[key];
    if (val.valueNow !== null) {
      fx.map(staticEnstyle(target, key), val);
    }
    else if (typeof val === 'object') {
      enstyle(target[key], val);
    }
    else {
      target[key] = val;
    }
  });
}

function insertAfter(parent : Node, newChild : Node, refChild : Node) {
  if (typeof refChild != "undefined" && refChild.nextSibling) {
    parent.insertBefore(newChild, refChild.nextSibling);
  }
  else {
    // refChild == parent.lastChild
    parent.appendChild(newChild);
  }
};

function swapChildren(parent : Node, existingChildren : Node[],
  newChildren : Node[]) {
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
}

/**
 * @private
 */
function appendDynChild(parent, child) {
  var lastVal = [];
  fx.map(function(childV) {
          // TODO: flapjax.js msut have a bug when the time-varying array is empty
          if (childV === null || childV.length === 0) {
            childV = [document.createTextNode('')];
          }
          else if (!(childV instanceof Array)) {
            childV = [childV];
          }

          if (lastVal.length === 0) {
            childV.forEach(function(e) {
                             parent.appendChild(e);
                           });
          }
          else {
            swapChildren(parent, lastVal, childV);
          }
          lastVal = childV;
        }, child);
};

/**
 * @private
 */
function appendChild(parent, child) {
  if (child instanceof Array) {
    child.forEach(function(ch) { appendChild(parent, ch); });
  }
  else if (child.valueNow) {
    appendDynChild(parent, child);
  }
  else {
    parent.appendChild(child);
  }
};

/**
 * An HTML element with attributes and children defined by signals.
 *
 * @param {string} tagName
 * @param {Object} attribs
 * @param {Array.<F.Node|Node>} children
 * @returns {HTMLElement}
 */
export function elt(tagName : string, attribs : any , ...children : Array<Node>) {
  var elt = document.createElement(tagName);
  enstyle(elt, attribs);
  children.forEach(child => appendChild(elt, child));
  return elt;
};
