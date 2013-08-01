import F = module("./flapjax");
import filter = module("./filter")
import Cols = module("./cols");
import util = module("./util");
import password = module("./password")

// TODO(arjun): why needed?
declare function escape(s : string) : string;
declare function unescape(s : string) : string;

// We parse the URL fragment as a JSON string and expect it to optionally
// contain these members.
interface URLArgs {
  app? : string;
  loginData? : LoginResponse;
  resetCap? : string
}

interface LoginResponse {
  appsCap: string;
  materialsCap: string;
  fetchCommentsCap: string;
  changePasswordCap: string;
  reviewers: { [id : string]: string };
  revId: string;
  friendlyName: string
}

interface Application {
  embarkId: number;
  lastName: string;
}

interface AppComment {
  reviewerName: string;
  timestamp: number;
  text: string;
}

interface FetchCapResponse {
  comments: Array<AppComment>;
  post: string;
  highlightCap: string;
  unhighlightCap: string;
  highlightedBy: Array<string>;
  setScoreCap: string
}

/**
 * @typedef {Object}
 */
var Reviewers;

var myRevId;



function getEltById(x : string) : HTMLElement {
  var elt = window.document.getElementById(x);
  if (elt === null) {
    throw 'element not found';
  }
  return elt;
}

///////////////////////////////////////////////////////////////////////////////

function disp(visStyle, visible) {
  return visible.liftB(function(b) { return b ? visStyle : 'none'; });
}

/**
 * @param {Application} obj
 * @param {Array.<Cols.TextCol>} fields
 * @param {F.Behavior} filter
 *
 * @return {Node}
 */
function displayRow(obj, fields, filter) {
  /**
   * @param {Cols.TextCol} field
   */
  function mkCell(field) {
    return F.DIVSty({ 
      'className': 'cell',
      'style': { 'display': disp('table-cell',field.visible) } 
    },
    [field.display(obj)]);
  }
  var dispWhen = disp('table-row', filter.liftB(function(pred) {
    return pred(obj);
  }));
  return F.DIVSty({ className: 'row',
               'data-appId': obj.embarkId,
                style: { display: dispWhen } },
             fields.map(mkCell));
}

/**
 * @param {function(*,*): number} f
 * @return {function(*,*): number}
 */
function invCompare(f) {
  return function(x, y) { return -1 * f(x, y); };
}

/**
 * @param {Array.<Cols.TextCol>} fields
 * @return {{elt: Node, compare: F.Behavior}}
 */
function headers(fields) {

  function h(fld) {
    function cmp(o1, o2) {
      return fld.compare(o1, o2);
    }
    var toggle = F.tagRec(['click'], function(clickE) {
      return F.SPANSty({ className: 'buttonLink' },
                 [F.text(clickE.collectE(true, function(_, b) { return !b; })
                             .mapE(function(b) { return b ? '▲' : '▼'; })
                             .startsWith('△'))]);
    });

    return {
      elt: F.DIVSty({ className: 'cell',
                 style: { display: disp('table-cell', fld.visible) }
               },
              [F.TEXT(fld.friendly), toggle ? toggle : F.SPAN()]),
      compare: toggle 
                 ? F.clicksE(toggle)
                     .collectE(true, function(_, b) { return !b; })
                      .mapE(function(b) { return b ? cmp : invCompare(cmp); })
                 : F.zeroE()
    };
  }

  var heads = fields.map(h);

  return {
    elt: F.DIVSty({ className: 'row header' }, heads.map(function(h) { return h.elt; })),
    compare: F.mergeE.apply(null, heads.map(function(h) { return h.compare; }))
                   .startsWith(function(_, __) { return 0; })
  }
}

/**
 * @param {Node} newRow
 * @param {Node} oldRow
 * @return {Node}
 */
function highlightSelectedRow(newRow, oldRow) {
  if (oldRow) {
    oldRow.classList.remove('selected');
  }
  newRow.classList.add('selected');
  return newRow;
}

/**
 * @param {F.Behavior} objs
 * @param {Array.<Cols.TextCol>} fields
 * @param {F.Behavior} filter
 */
function displayTable(objs, fields, filter, compare) {
  var rows = F.liftB(function(objsV, compareV) {
    return objsV.sort(compareV)
                .map(function(o) { 
                  return displayRow(o, fields, filter); });
  }, objs, compare);
  var rowGroup = F.DIVSty({ style: { display: 'table-row-group' } }, rows);
  selectedRow(rowGroup).collectE(null, highlightSelectedRow);
  return rowGroup;
}

/**
 * Returns the table row of the selected application.
 *
 * @param {Node} table
 * @return {F.EventStream}
 */

function selectedRow(table) {
  return F.extractEventE(table, 'click').mapE(function(evt) {
    var elt = evt.target;
    // Clicking on a link does not select an application.
    if (elt.tagName === 'A' || elt.classList.contains('buttonLink')) {
      return false;
    }
    // Lets us click on child nodes of the row.
    while  (elt !== table) {
      if (typeof elt['data-appId'] === 'undefined') {
        elt = elt.parentNode;
      }
      else {
        return elt;
      }
    }
    return false;
  })
  .filterE(function(src) { return src !== false; });
}

/**
 * @param {Application} dataById
 */
function createLinks(loginData, dataById, comment) {
  var elts = [ ];
  var i = comment.indexOf('#');
  while (i !== -1) {
    var j = comment.indexOf(';', i);
    if (j === -1) {
      break;
    }
    elts.push(comment.slice(0, i)); // Exclude #
    // To lookup the id, excludes both # and ;
    var maybeLink = comment.slice(i + 1, j); 
    if (dataById[maybeLink]) {
      var href = '/#' + escape(JSON.stringify({ app: maybeLink }));
      // unsafeHref includes this user's capabilities.
      var unsafeHref = 
        '/#' + escape(JSON.stringify({ app: maybeLink,
                                       loginData: loginData }));
      // When anchor is copied, it does not have the user's caps. When anchor
      // is clicked, it's invoked with the user's caps and then rewritten back
      // to href.
      var anchor = F.A({ href: href, target: '_blank' }, 
                     F.TEXT(dataById[maybeLink].lastName));
      anchor.addEventListener('click', function() {
        anchor.href = unsafeHref;
        window.setTimeout(function() { anchor.href = href; }, 0);
      }, false);
      elts.push(anchor);
    }
    else {
      elts.push(comment.slice(i, j + 1)); // Include both # and ; 
    }
    comment = comment.slice(j + 1); // Exclude ;
  }
  elts.push(comment);
  return elts;
}

function dispComment(loginData, dataById) {
  return function(comment) {
    return F.DIVClass('row',
             F.DIVClass('comment cell',
               F.DIV(comment.reviewerName),
               F.DIV(F.TEXT(util.relativeDate(comment.timestamp))),
               F.DIVSty({}, createLinks(loginData, dataById, comment.text))));
  }
}

function highlightPane(reviewers, highlightedBy, highlightCap) {
  function revSelect(revId) {
    var hasStar = highlightedBy.indexOf(revId) !== -1;
    var txt = hasStar ? '★ ' + reviewers[revId] : reviewers[revId];
    return F.OPTION({ value: revId }, txt);
  }
  var opts = Object.keys(reviewers).map(revSelect);
  var elt = F.SELECTSty({}, opts);
  var btn = F.INPUT({ type: 'button', value: '★'});
  F.clicksE(btn).snapshotE(F.$B(elt))
   .mapE(function(revId) { return { readerId: revId }; })
   .JSONStringify()
   .POST(highlightCap)
   .mapE(function() { update.sendEvent(true); });
  return F.DIV(F.TEXT('Set a star for: '), elt, btn);
}

function selfStarPane(loginData, highlightCap, unhighlightCap, highlightedBy) {
  function mkReq(b) {
      return {
        url: b ? highlightCap : unhighlightCap,
        fields: b ? { readerId: loginData.revId } : { },
      };
  };
  var init = highlightedBy.indexOf(loginData.revId) !== -1;
  var initSrc = init ? 'star.png' : 'unstar.png';
  return F.tagRec(['click'], function(clicks) {
    var req = clicks.collectE(init, (_, acc) => !acc).mapE(mkReq);
    var src = 
      req.mapE(x => F.oneE(x.fields).JSONStringify().POST(x.url))
         .switchE()
         .index('response')
         .collectE(initSrc, function(_, acc) {
            return acc === 'star.png' ? 'unstar.png' : 'star.png' });
    src.mapE(function() { update.sendEvent(true); });
    return F.DIV(F.IMG({ src: src.startsWith(initSrc) }));
  });

}

function ratingPane(label, init, setScoreCap) {
  function isValid(v  : string) {
    var n = Number(v);
    return v === '' || (n >= 0 && n <= 10);
  }
  var input = F.INPUT({ type: 'text', style: { width: '40px', fontSize: '15pt' },
                      value: init, placeholder: 'N/A' });
  F.$B(input).calmB(500).changes().filterE(isValid)
   .mapE(function(v) { 
      return { label: label, score: v === '' ? null : Number(v) }; })
   .JSONStringify()
   .POST(setScoreCap)
   .mapE(function() { update.sendEvent(true); });
  var elt = F.DIVClass('vbox', 
              F.DIVSty({ style: { textAlign: 'center' } }, [F.TEXT('Score')]),
              F.DIV(input));
  return elt;
}

function infoPane(fields, val) {
  function row(field) {
    return F.DIVSty({ className: 'row' },
      [F.DIVSty({ className: 'cell' }, [field.friendly]),
       F.DIVSty({ className: 'cell' }, [field.display(val)])]);
  }
  function notStar(field) {
    return !(field instanceof Cols.StarCol);
  }
  return F.DIVClass('vbox table', fields.filter(notStar).map(row));
}

/**
 * arg is the response from fetchCap, which includes caps to post new comments
 * and highlight this application.
 */
function dispCommentPane(loginData, reviewers, data, fields, comments) {
  var dataById = dataMap(data);
  function fn(arg) {
    var post = F.INPUT({ className: 'fill', type: 'button', value: 'Send' });
    var commentDisp = F.DIVSty({ className: 'table' },
      [arg.comments.map(dispComment(loginData, dataById))]);
    var newPosts = F.clicksE(post).mapE(function(){
      var compose = <HTMLTextAreaElement>getEltById('composeTextarea');
      var c = compose.value;
      compose.value = '';
      commentDisp.appendChild(
        dispComment(loginData, dataById)({ 
          reviewerName: loginData.friendlyName,
          text: c,
          timestamp: Math.floor((new Date()).valueOf() / 1000)
        }));
      return c;
    });

    newPosts.POST(arg.post);

    var initRating = dataById[arg.appId]['score_rating']
      ? dataById[arg.appId]['score_rating'][myRevId]
      : '';
    var highlights =
      highlightPane(reviewers, arg.highlightedBy, arg.highlightCap);
    var ratings = ratingPane('rating', initRating, arg.setScoreCap);
    return {
      info: infoPane(fields, dataById[arg.appId]),
      highlights: highlights,
      rating: F.DIVSty({ className: 'hbox boxAlignCenter' },
                    [selfStarPane(loginData, arg.highlightCap, 
                    arg.unhighlightCap, arg.highlightedBy), ratings]),
      commentDisp: commentDisp,
      commentPost: post
    };
  }
  return comments.mapE(fn);
}

/**
 * @param {Reviewers} reviewers
 * @param {string} fetchCap
 * @param {F.EventStream} appId
 * @return {F.EventStream}
 */
function displayComments(loginData : LoginResponse, reviewers, fetchCap, appId, data, fields) {
  var comments = 
    appId.mapE(appIdV => ({ 'appId': appIdV }))
         .GET(fetchCap)
         .index('response')
         .JSONParse();

  return dispCommentPane(loginData, reviewers, data, fields, comments);
}

function makeVis(field) {
  var input = F.INPUT({ type: 'checkbox', 
                      checked: field.initVis ? 'checked' : '' });
  return { elt: F.DIV(input,field.friendly), 
           val: F.$B(input) }
}

function dataMap(data) {
  var m = Object.create(null);
  data.forEach(function(d) { m[d.embarkId] = d; });
  return m;
}

/**
 * @param {LoginResponse} loginData
 * @param {F.EventStream} data
 */
function loadData(urlArgs, loginData, data) { 
  /** @type {Array.<Cols.TextCol>} */
  var fields = [
    new Cols.IdCol('embarkId', 'Link', true),
    new Cols.StarCol(loginData.revId, 'highlight', 'Starred', true),
    new Cols.TextCol('firstName','First Name', false),
    new Cols.TextCol('lastName', 'Last Name', true),
    new Cols.TextCol('url','Email', false),
    new Cols.EnumCol('country', 'Citizen', true),
    new Cols.SetCol('areas', 'Areas', true),
    new Cols.MatsCol('materials','Materials', loginData.materialsCap, true),
    new Cols.MatsCol('recs', 'Recommendations', 
                     loginData.materialsCap, true),
    new Cols.NumCol('expectedRecCount', 'Recs Expected', false),
    new Cols.NumCol('GPA', 'GPA', false),
    new Cols.NumCol('GREMath', 'GRE Math', false),
    new Cols.NumCol('GREVerbal', 'GRE Verbal', false),
    new Cols.ScoreCol('score_rating', 'Ratings', loginData.reviewers, 
                      loginData.revId, false),
    new Cols.NumCol('avgscore_rating', 'Average Rating', false)
  ];
  
  var vises = fields.map(function(f) : Node {
    var r = makeVis(f);
    f.visible = r.val;
    return r.elt;
  });

  var filterCl =  { 
    friendly: "...", 
    makeFilter: function() { return filt.makeFilter(); }
  };
  var filt = new filter.Picker(fields.concat(
    [ new filter.And(filterCl),
      new filter.Or(filterCl),
      new filter.Not(filterCl) ]));
  
  var tableFilter = urlArgs.filter 
    ? filter.deserialize(filt, -1, urlArgs.filter)
    : (new filter.And(filt)).makeFilter();
  F.clicksE(getEltById('copyFilters'))
    .snapshotE(tableFilter.ser).mapE(function(ser) {
    window.location.hash = escape(JSON.stringify({ filter: ser }));
    });

  F.clicksE(getEltById('showHideFilters'))
  .collectE(false, function(_, showHide) {
    var elt = <HTMLElement> getEltById('filterDetail');
    if (showHide) {
      elt.style.display = '';
    }
    else {
      elt.style.display = 'none';
    }
    return !showHide;
  });

  F.insertDomB(F.DIVSty({ id: 'filterPanel' }, [tableFilter.elt]), 'filterPanel');
  F.insertDomB(F.DIVSty({ id: 'visPanel' }, vises), 'vises');
  
  getEltById('loginPanel').style.display = 'none';
  getEltById('mainPanel').style.display = '';
  
  var headerRow = headers(fields);

  function processData(data, acc) {
    var sortedData = F.constantB(data);
    var appTable = displayTable(sortedData, fields, tableFilter.fn.calmB(500),
                                headerRow.compare);
    var selected = 
      F.mergeE(F.oneE(acc.selected.valueNow()),
               selectedRow(appTable)
                 .mapE(function(elt) { return elt['data-appId']; }))
        .filterE(function(v) { return v !== ''; });

    var detail  = 
      displayComments(loginData, loginData.reviewers,
        loginData.fetchCommentsCap, selected, data, fields);
    return { 
      appTable: appTable, 
      detail: detail, 
      selected: selected.startsWith(acc.selected.valueNow()) 
    };
  }

  var v = data.collectE({ selected: F.constantB(urlArgs.app) }, processData);
  F.insertDomB(F.DIVSty(
    { id: 'applicantTable', className: 'table flex1' }, 
    [headerRow.elt, 
     v.index('appTable')
      .startsWith(F.DIV(F.TEXT('Loading, please wait ...')))]),
    'applicantTable');
  
  var detail = v.index('detail').switchE();
  F.insertDomE(detail.index('info'), 'infoPane');
  F.insertDomE(detail.index('commentDisp'), 'commentDisp');
  F.insertDomE(detail.index('commentPost'), 'postComment');
  F.insertDomE(detail.index('highlights'), 'highlightPane');
  F.insertDomE(detail.index('rating'), 'ratingPane');

  if (isFirefox()) {
    firefoxUI();
  }
};

var loginClicks = F.clicksE(getEltById('login'));
var resetClicks = F.clicksE(getEltById('forgot'));

var canLogin = false;

function mkLogin() {
  var user = <HTMLInputElement> getEltById("username");
  var pass = <HTMLInputElement> getEltById("password");
  myRevId = user.value;
  return { username: user.value, password: pass.value };
}

var update = F.receiverE();
/**
 * @param {LoginResponse} loginData
 */
function loggedIn(urlArgs, loginData : LoginResponse) {
  password.setupPasswordChange(loginData);

  getEltById('friendly').appendChild(F.TEXT(loginData.friendlyName));
  var refresh = F.mergeE(F.oneE(true), update);
  loadData(urlArgs, loginData, 
    refresh.mapE(function() { return {}; })
           .GET(loginData.appsCap)
           .index('response')
           .JSONParse());
}

getEltById('logout').addEventListener('click', function(_) {
  window.location.reload();
}, false);

(function() {
  var urlArgs : URLArgs = { app: '' };
  var loginData : LoginResponse;
  if (window.location.hash.length > 1) {
    try {
      urlArgs = JSON.parse(unescape(window.location.hash.slice(1)));
    }
    catch(_) {
    }
    if (typeof urlArgs !== 'object') {
      urlArgs = { };
    }
    if (typeof urlArgs.app !== 'string') {
      urlArgs.app = '';
    }
  }
  window.location.hash = '';

  if (urlArgs.loginData !== undefined) {
    loginData = urlArgs.loginData;
    delete urlArgs.loginData;
    loggedIn(urlArgs, loginData);
  }
  else if (urlArgs.resetCap) {
    password.passwordReset(urlArgs.resetCap);
  }
  else {
    var loginResults = loginClicks.mapE(mkLogin)
      .JSONStringify()
      .POST('/login')
      .index('response')
      .JSONParse();
    var resetResults = resetClicks
      .mapE(function() { 
          return { username: (<HTMLInputElement>getEltById('username')).value }; })
      .JSONStringify()
      .POST('/reset')
      .index('response')
      .JSONParse();

    loginResults.filterE(function(r) {
      return typeof r.appsCap !== 'undefined';
    }).mapE(function(result) {
      loggedIn(urlArgs, result);
    });
    F.insertDomB(
      F.DIV(F.text(F.mergeE(loginResults, resetResults)
                    .mapE(function(r) { return r.msg || ''; })
                    .startsWith(''))),
      'loginPanelOut');
  }

  getEltById('username').focus();
})();

function isFirefox() {
  return navigator.userAgent.match('Firefox') !== null;
}

function firefoxUI() {
  var filterPanel = getEltById('mainPanel').firstElementChild;
  var resizeChildren = getEltById('ffResizeChildren');
  var col3 = getEltById('col3');

  F.extractEventE(window, 'resize').calmE(1000).startsWith(null).liftB(function(evt) {
    var elt = <HTMLElement> (resizeChildren.firstElementChild);
    var h = (document.body.clientHeight - filterPanel.clientHeight - 200)+ 'px';
    var w = Math.floor(document.body.clientWidth / 3 - 50) + 'px';
    while (elt) {
      elt.style.height = h;
      elt = <HTMLElement> (elt.nextElementSibling);
    }
   col3.style.width = w;
  });
}

