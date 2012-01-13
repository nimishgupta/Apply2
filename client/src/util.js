goog.provide('util');
goog.require('F');

/**
 * @param {Node} elt
 * @return {F.EventStream}
 */
util.hover = function(elt) {
  return F.mergeE(F.extractEventE(elt, 'mouseover').constantE(true),
                  F.extractEventE(elt, 'mouseout').constantE(false));
};
