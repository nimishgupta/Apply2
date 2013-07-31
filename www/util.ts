/**
 * @param {Node} elt
 * @return {F.EventStream}
 */

import F = module("./flapjax");

export function hover(elt : HTMLElement) {
  return F.mergeE(F.extractEventE(elt, 'mouseover').constantE(true),
                  F.extractEventE(elt, 'mouseout').constantE(false));
};
