goog.provide('util');
goog.require('F');

/**
 * @param {Node} elt
 * @return {F.EventStream}
 */
util.hover = function(elt) {
  return F.mergeE(F.$E(elt, 'mouseover').constantE(true),
                  F.$E(elt, 'mouseout').constantE(false));
};
