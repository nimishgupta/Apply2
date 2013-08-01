/**
 * @param {Node} elt
 * @return {F.EventStream}
 */

import F = module("./flapjax");

export function hover(elt : HTMLElement) {
  return F.mergeE(F.extractEventE(elt, 'mouseover').constantE(true),
                  F.extractEventE(elt, 'mouseout').constantE(false));
};

export function relativeDate(unixTime : number) : string {
  var now = Math.floor((new Date()).valueOf() / 1000);
  var delta = now - unixTime; // in seconds
  if (delta < 60) {
    return "seconds ago";
  }
  else if (delta < 120) {
    return "one minute ago";
  }
  else if (delta < 3600) {
    return String(Math.floor(delta / 60)) + " minutes ago";
  }
  else {
    delta = Math.floor(delta / 3600); // in hours
    if (delta < 2) {
      return "one hour ago";
    }
    else if (delta < 24) {
      return String(delta) + " hours ago";
    }
    else if (delta < 48) {
      return "yesterday";
    }
    else {
      return (new Date(unixTime * 1000)).toDateString();
    }
  }
}
