goog.provide('apply');
goog.require('Cols');
goog.require('F');
goog.require('util');
goog.require('filter');

var console;

/**
 * @typedef {{
 *  appsCap: string, 
 *  materialsCap: string,
 *  fetchCommentsCap: string,
 *  reviewers: !Object.<string, string>,
 *  revId: string,
 *  friendlyName: string
 * }}
 */
var LoginResponse;

/**
 * @typedef {{
 *   embarkId: number,
 *   lastName: string
 * }}
 */
var Application;

/**
 * @typedef{{ reviewerName: string, timestamp: number, text: string }}
 */
var AppComment;

/**
 * @typedef{{ comments: Array.<AppComment>, post: string, 
 *   highlightCap: string,
 *   unhighlightCap: string,
 *            highlightedBy: Array.<string>, setScoreCap: string }}
 */
var FetchCapResponse;

/**
 * @typedef {Object}
 */
var Reviewers;

var myRevId;


/**
 * @param {number} unixTime
 * @return {string}
 */
function relativeDate(unixTime) {
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
      return (new Date(unixTime)).toDateString();
    }
  }
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
    return DIV({ 
      'className': 'cell',
      'data-appId': obj.embarkId,
      'style': { 'display': disp('table-cell',field.visible) } 
    },
    field.display(obj));
  }
  var dispWhen = disp('table-row', filter.liftB(function(pred) {
    return pred(obj);
  }));
  return DIV({ className: 'row',
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
    var cmp = fld.compare.bind(fld);
    var toggle = F.tagRec(['click'], function(clickE) {
      return SPAN({ className: 'buttonLink' },
                 clickE.collectE(true, function(_, b) { return !b; })
                       .mapE(function(b) { return b ? '▲' : '▼'; })
                       .startsWith('△'));
    });

    return {
      elt: DIV({ className: 'cell',
                 style: { display: disp('table-cell', fld.visible) }
               },
              fld.friendly, toggle ? toggle : SPAN()),
      compare: toggle 
                 ? F.clicksE(toggle)
                     .collectE(true, function(_, b) { return !b; })
                      .mapE(function(b) { return b ? cmp : invCompare(cmp); })
                 : F.zeroE()
    };
  }

  var heads = fields.map(h);

  return {
    elt: DIV({ className: 'row header' }, heads.map(function(h) { return h.elt; })),
    compare: F.mergeE.apply(null, heads.map(function(h) { return h.compare; }))
                   .startsWith(function(_, __) { return 0; })
  }
}

/**
 * @param {Event} evt
 * @param {Node} oldRow
 * @return {Node} newRow
 */
function highlightSelectedRow(evt, oldRow) {
  if (evt.target.className !== 'cell') {
    return oldRow;
  }

  var newRow = evt.target.parentNode; // assumes it is row
  if (oldRow) {
    oldRow.classList.remove('selected');
  }
  newRow.classList.add('selected');
  return newRow;
}

function displayTable(objs, fields, filter) {
  var head = headers(fields);

  var rows = F.liftB(function(objsV, compareV) {
    return objsV.sort(compareV)
                .map(function(o) { 
                  return displayRow(o, fields, filter); });
  }, objs, head.compare);

  var rowGroup = DIV({ style: { display: 'table-row-group' } }, rows);
  F.clicksE(rowGroup).collectE(null, highlightSelectedRow);

  
  return DIV({ id: 'applicantTable', className: 'table flex1' },
             head.elt, rowGroup);
}

/**
 * Returns the ID of the selected application.
 *
 * @param {F.EventStream} evt
 * @return {F.EventStream}
 */
function selectedApp(evt) {
  return evt.mapE(function(evt) { return evt.target["data-appId"]; })
            .filterE(function(src) { return typeof src === "string"; });
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
      var anchor = A({ href: href, target: '_blank' }, 
                     dataById[maybeLink].lastName);
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
    return DIV({ className: 'row' },
             DIV({ className: 'comment cell' },
               DIV(comment.reviewerName),
               DIV(relativeDate(comment.timestamp)),
               DIV(createLinks(loginData, dataById, comment.text))));
  }
}

function visibility(b) {
  return b ? '' : 'hidden';
}

function highlightPane(reviewers, highlightedBy, highlightCap) {
  function mkReq(revId) {
      return {
        url: highlightCap,
        request: 'post',
        fields: { readerId: revId },
        response: 'plain'
      };
  };
  function revSelect(revId) {
    var hasStar = highlightedBy.indexOf(revId) !== -1;
    var txt = hasStar ? '★ ' + reviewers[revId] : reviewers[revId];
    return OPTION({ value: revId }, txt);
  }
  var opts = Object.keys(reviewers).map(revSelect);
  var elt = SELECT(opts);
  var btn = INPUT({ type: 'button', value: '★'});
  F.getWebServiceObjectE(F.clicksE(btn).snapshotE(F.$B(elt)).mapE(mkReq))
    .mapE(function() { update.sendEvent(true); });
  return DIV('Set a star for: ', elt, btn);
}

function selfStarPane(loginData, highlightCap, unhighlightCap, highlightedBy) {
  function mkReq(b) {
      return {
        url: b ? highlightCap : unhighlightCap,
        request: 'post',
        fields: b ? { readerId: loginData.revId } : { },
        response: 'plain'
      };
  };
  var init = highlightedBy.indexOf(loginData.revId) !== -1;
  var initSrc = init ? 'star.png' : 'unstar.png';
  return F.tagRec(['click'], function(clicks) {
    var src = 
      F.getWebServiceObjectE(clicks.collectE(init, function(_, acc) { 
        return !acc; }).mapE(mkReq))
      .collectE(initSrc, function(_, acc) {
        return acc === 'star.png' ? 'unstar.png' : 'star.png' });
    src.mapE(function() { update.sendEvent(true); });
    return DIV(IMG({ src: src.startsWith(initSrc) }));
  });

}

function ratingPane(label, init, setScoreCap) {
  function isValid(v) {
    var n = Number(v);
    return v === '' || (n >= 0 && n <= 10);
  }
  function mkReq(v) {
    return {
      url: setScoreCap,
      request: 'post',
      fields: { label: label, score: v === '' ? null : Number(v) },
      response: 'plain'
    };
  }
  var input = INPUT({ type: 'text', style: { width: '40px', fontSize: '15pt' },                      value: init, placeholder: 'N/A' });
  F.getWebServiceObjectE(
      F.$B(input).calmB(500).changes().filterE(isValid).mapE(mkReq))
  .mapE(function() { update.sendEvent(true); });
  var elt = DIV({ className: 'vbox' }, 
              DIV({ style: { textAlign: 'center' } }, 'Score'),
              DIV(input));
  return elt;
}

function infoPane(fields, val) {
  function row(field) {
    return DIV({ className: 'row' },
      DIV({ className: 'cell' }, field.friendly),
      DIV({ className: 'cell' }, field.display(val)));
  }
  function notStar(field) {
    return !(field instanceof Cols.StarCol);
  }
  return DIV({ className: 'vbox table' }, fields.filter(notStar).map(row));
}

/**
 * arg is the response from fetchCap, which includes caps to post new comments
 * and highlight this application.
 */
function dispCommentPane(loginData, reviewers, data, fields, comments) {
  var dataById = dataMap(data);
  function fn(arg) {
    var compose = 
      TEXTAREA({ id: 'composeTextarea', 
                 rows: 5, className: 'fill', placeholder: 'Compose Message' });
    var post = INPUT({ className: 'fill', type: 'button', value: 'Send' });
    var commentDisp = DIV({ className: 'table' },
      arg.comments.map(dispComment(loginData, dataById)));
    var commentCompose =
      DIV({className: 'hbox' }, 
        DIV({ className: 'flex1' }, DIV({ className: 'ctrl' }, compose)),
        DIV(post));
    F.getWebServiceObjectE(F.clicksE(post).mapE(function() {
      var c = compose.value;
      compose.value = '';
      commentDisp.appendChild(
        dispComment(loginData, dataById)({ 
          reviewerName: loginData.friendlyName,
          text: c,
          timestamp: Math.floor((new Date()).valueOf() / 1000)
        }));
      return { url: arg.post, request: 'rawPost', body: c, response: 'plain' };
    }));
    var initRating = dataById[arg.appId]['score_rating']
      ? dataById[arg.appId]['score_rating'][myRevId]
      : '';
    var highlights =
      highlightPane(reviewers, arg.highlightedBy, arg.highlightCap);
    var ratings = ratingPane('rating', initRating, arg.setScoreCap);
    return {
      info: infoPane(fields, dataById[arg.appId]),
      highlights: highlights,
      rating: DIV({ className: 'hbox boxAlignCenter' },
                  selfStarPane(loginData, arg.highlightCap, 
                    arg.unhighlightCap, arg.highlightedBy), ratings),
      commentDisp: commentDisp,
      commentCompose: commentCompose
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
function displayComments(loginData, reviewers, fetchCap, appId, data, fields) {
  var comments = F.getWebServiceObjectE(appId.mapE(function(appIdV) {
    return { 
      url: fetchCap, 
      fields: { 'appId': appIdV }, 
      request: 'get', 
      response: 'json' 
    };
  }));

  return dispCommentPane(loginData, reviewers, data, fields, comments);
}

function makeVis(field) {
  var input = INPUT({ type: 'checkbox', 
                      checked: field.initVis ? 'checked' : '' });
  return { elt: DIV(input,field.friendly), 
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
    new Cols.MatsCol('recommendations', 'Recommendations', 
                     loginData.materialsCap, true),
    new Cols.NumCol('expectedRecCount', 'Recs Expected', false),
    new Cols.NumCol('GPA', 'GPA', false),
    new Cols.NumCol('GREMath', 'GRE Math', false),
    new Cols.NumCol('GREVerbal', 'GRE Verbal', false),
    new Cols.ScoreCol('score_rating', 'Ratings', loginData.reviewers, 
                      loginData.revId, false)
  ];
  
  var vises = fields.map(function(f) {
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
  F.clicksE(document.getElementById('copyFilters'))
    .snapshotE(tableFilter.ser).mapE(function(ser) {
    window.location.hash = escape(JSON.stringify({ filter: ser }));
    });

  F.clicksE(document.getElementById('showHideFilters'))
  .collectE(false, function(_, showHide) {
    if (showHide) {
      document.getElementById('filterDetail').style.display = '';
    }
    else {
      document.getElementById('filterDetail').style.display = 'none';
    }
    return !showHide;
  });

  F.insertDomB(DIV({ id: 'filterPanel' }, tableFilter.elt), 'filterPanel');
  F.insertDomB(DIV({ id: 'visPanel' }, vises), 'vises');
  
  document.getElementById('loginPanel').style.display = 'none';
  document.getElementById('mainPanel').style.display = '';

  function processData(data, acc) {
    var sortedData = F.constantB(data);
    var appTable = displayTable(sortedData, fields, tableFilter.fn.calmB(500));
    var selected = 
      F.mergeE(F.oneE(acc.selected.valueNow()),
               selectedApp(F.$E(appTable, "click")))
      .filterE(function(v) { return v !== ''; });

    var detail  = 
      displayComments(loginData, loginData.reviewers, loginData.fetchCommentsCap,
           selected, data, fields);
    return { appTable: appTable, detail: detail, 
      selected: selected.startsWith(acc.selected.valueNow()) }
  }

  var v = data.collectE({ selected: F.constantB(urlArgs.app) }, processData);
  F.insertDomE(v.index('appTable'), 'applicantTable');
  // ID of the selected application
  //var selected =
    //selectedApp(F.$E(v.index('appTable').startsWith(null), "click"));
  
  var detail = v.index('detail').switchE();
  F.insertDomE(detail.index('info'), 'infoPane');
  F.insertDomE(detail.index('commentDisp'), 'commentDisp');
  F.insertDomE(detail.index('commentCompose'), 'commentCompose');
  F.insertDomE(detail.index('highlights'), 'highlightPane');
  F.insertDomE(detail.index('rating'), 'ratingPane');
};

var loginClicks = F.$E(document.getElementById("login"), 'click');

var canLogin = false;

function mkLogin() {
  var user = document.getElementById("username");
  var pass = document.getElementById("password");
  myRevId = user.value;
  return {
    url: '/login',
    request: 'post',
    response: 'json', 
    fields: {
      username: user.value,
      password: pass.value
    }
  };
}

var update = F.receiverE();
/**
 * @param {LoginResponse} loginData
 */
function loggedIn(urlArgs, loginData) {
  document.getElementById('friendly').appendChild(TEXT(loginData.friendlyName));
  var reqData = { url: loginData.appsCap, request: 'get', response: 'json' };
  var refresh = F.mergeE(F.oneE(true), update);
  loadData(urlArgs, loginData, 
    F.getWebServiceObjectE(refresh.constantE(reqData)));
}

document.getElementById('logout').addEventListener('click', function(_) {
  window.location.reload();
}, false);

(function() {
  var urlArgs = { app: '' };
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

  if (urlArgs.loginData) {
    var loginData = urlArgs.loginData;
    delete urlArgs.loginData;
    loggedIn(urlArgs, loginData);
  }
  else {
    F.getWebServiceObjectE(loginClicks.mapE(mkLogin)).mapE(function(result) {
      loggedIn(urlArgs, result);
    });
  }

  document.getElementById('username').focus();
})();

function isFirefox() {
  return navigator.userAgent.match('Gecko') !== null;
}

function firefoxUI() {
  var at = document.getElementById('ffResizeChildren');
  var ft = document.getElementById('mainPanel').firstElementChild;

  F.$E(window, 'resize').mapE(function(evt) {
   var h = (document.body.clientHeight - ft.clientHeight - 50) + 'px';
   at.firstElementChild.style.height = h;
   document.getElementById('commentsPane').style.width =
     (ft.clientWidth / 3 - 30) + 'px';
  });
}

if (isFirefox()) {
  firefoxUI();
}
