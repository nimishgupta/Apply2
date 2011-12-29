goog.provide('apply');
goog.require('Cols');
goog.require('F');
goog.require('util');
goog.require('filter');

var console;
/**
 *
 * Stanford JavaScript Crypto Library
 *
 * @type {{ codec: { base64: { fromBits: Function } }, hash: { sha256: { hash : Function } } } }
 */
var sjcl;

/**
 * @typedef {{ appsCap: string, 
 *             materialsCap: string,
 *             readerHighlightsCap: string,
 *             fetchCommentsCap: string,
 *             reviewers: Object }}
 */
var LoginResponse;

/**
 * @typedef {{
 *   embarkId: number
 * }}
 */
var Application;

/**
 * @typedef{{ reviewerName: string, timestamp: number, text: string }}
 */
var AppComment;

/**
 * @typedef{{ comments: Array.<AppComment>, post: string, highlightCap: string,
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
                       .mapE(function(b) { return b ? 'ꜛ' : 'ꜜ'; })
                       .startsWith('ꜛ'));
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
 * @param {AppComment} comment
 * @return {Node}
 */
function dispComment(comment) {
  return DIV({ className: 'comment' },
             DIV(comment.reviewerName),
             DIV(relativeDate(comment.timestamp)),
             DIV(comment.text));
}

function visibility(b) {
  return b ? '' : 'hidden';
}

function highlightPane(reviewers, highlightedBy, highlightCap) {
  
  function mkReq(revId) {
    return function() {
      return {
        url: highlightCap,
        request: 'post',
        fields: { readerId: revId },
        response: 'plain'
      };
    }
  };

  function revSelect(revId) {
    return F.tagRec(['click'], function(click) {
			var star =  F.getWebServiceObjectE(click.onceE().mapE(mkReq(revId)))
			            .constantE(true);
		  star.mapE(function(v) {
				update.sendEvent(true);
			});

      var hasStarred = star.startsWith(highlightedBy.indexOf(revId) !== -1);
      var vis = hasStarred.liftB(visibility);

      return DIV({ style: { cursor: 'pointer' } },
        IMG({ src: 'star.png',
              className: 'star', 
              style: { visibility: vis } }),
        reviewers[revId]);
    });
  }

  return F.tagRec([ 'mouseover', 'mouseout' ], function(over, out) {
    var visible = F.mergeE(over.constantE(true), out.constantE(false))
      .startsWith(false).liftB(function(b) {
        return b ? 'block' : 'none';
      });

    return DIV({ className: 'vbox starringPanel' },
      DIV(IMG({ className: 'star', src: 'star.png' }), 
          'Star application for ...'),
      DIV ({ className: 'vbox', style: { display: visible } },
           Object.keys(reviewers).map(revSelect)));
  });
}

function ratingPane(label, init, setScoreCap) {
	function isValid(v) {
		v = Number(v);
		return v >= 0 && v <= 10;
	}
	function mkReq(v) {
		return {
			url: setScoreCap,
			request: 'post',
			fields: { label: label, score: Number(v) },
			response: 'plain'
		};
	}
  var input = INPUT({ type: 'text', value: init });
	F.getWebServiceObjectE(
			F.$B(input).calmB(500).changes().filterE(isValid).mapE(mkReq))
	.mapE(function() { update.sendEvent(true); });
	var elt = DIV("My Rating: ", input)
	return elt;
}

function infoPane(fields, val) {
	function row(field) {
		return DIV({ className: 'row' },
		  DIV({ className: 'cell' }, field.friendly),
			DIV({ className: 'cell' }, field.display(val)));
	}
	return DIV({ className: 'vbox table' }, fields.map(row));
}

/**
 * arg is the response from fetchCap, which includes caps to post new comments
 * and highlight this application.
 *
 * @return {function(FetchCapResponse):Node}
 */
function dispCommentPane(reviewers, data, fields) { return function(arg) {

  var compose = 
    TEXTAREA({ rows: 5, className: 'fill', placeholder: 'Compose Message' });
  var post = INPUT({ className: 'fill', type: 'button', value: 'Send' });
  var pane = DIV({ className: 'vbox flex1', id: 'commentsPane' }, 
    DIV({ className: 'flex1 scroll' }, arg.comments.map(dispComment)),
    DIV({className: 'hbox' }, 
      DIV({ className: 'flex1' }, DIV({ className: 'ctrl' }, compose)),
      DIV(DIV({ className: 'ctrl' }, post))));
  F.getWebServiceObjectE(F.clicksE(post).mapE(function() {
    return { url: arg.post, request: 'rawPost', body: compose.value,
      response: 'plain' };
  }));

  var initRating = data[arg.appId]['score_rating']
    ? data[arg.appId]['score_rating'][myRevId]
    : '';
	var highlights =
		highlightPane(reviewers, arg.highlightedBy, arg.highlightCap);
	var ratings = ratingPane('rating', initRating, arg.setScoreCap);
  return {
		info: infoPane(fields, data[arg.appId]),
    highlights: highlights,
    comments: pane,
		rating: ratings
  };
}; }


/**
 * @param {Reviewers} reviewers
 * @param {string} fetchCap
 * @param {F.EventStream} appId
 * @return {F.EventStream}
 */
function displayComments(reviewers, fetchCap, appId, data, fields) {
  var comments = F.getWebServiceObjectE(appId.mapE(function(appIdV) {
    return { 
      url: fetchCap, 
      fields: { 'appId': appIdV }, 
      request: 'get', 
      response: 'json' 
    };
  }));

  return comments.mapE(dispCommentPane(reviewers, data, fields));
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
function loadData(loginData, data) { 
  /** @type {Array.<Cols.TextCol>} */
  var fields = [
    new Cols.StarCol('highlight', 'Starred', true),
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
		new Cols.ScoreCol('score_rating', 'Ratings', loginData.reviewers, false)
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
    [ new filter.And(filterCl), new filter.Or(filterCl),
      new filter.Not(filterCl) ]));
  
  var tableFilter;
  if (window.location.hash.length > 1) {
    tableFilter = 
      filter.deserialize(filt, -1,
				 	JSON.parse(unescape(window.location.hash.slice(1))));
  }
  else {
    tableFilter = (new filter.And(filt)).makeFilter();
  }
  F.clicksE(document.getElementById('copyFilters'))
		.snapshotE(tableFilter.ser).mapE(function(ser) {
		window.location.hash = escape(JSON.stringify(ser));
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
      displayComments(loginData.reviewers, loginData.fetchCommentsCap,
				 	selected, dataMap(data), fields);
		return { appTable: appTable, detail: detail, 
      selected: selected.startsWith(acc.selected.valueNow()) }
	}

	var v = data.collectE({ selected: F.constantB('') }, processData);
  F.insertDomE(v.index('appTable'), 'applicantTable');
  // ID of the selected application
  //var selected =
    //selectedApp(F.$E(v.index('appTable').startsWith(null), "click"));
	
  var detail = v.index('detail').switchE();
	F.insertDomE(detail.index('info'), 'infoPane');
  F.insertDomE(detail.index('comments'), 'commentsPane');
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
      password: sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(pass.value))
    }
  };
}

var update = F.receiverE();
/**
 * @param {LoginResponse} loginData
 */
function loggedIn(loginData) {
  var reqData = { url: loginData.appsCap, request: 'get', response: 'json' };
  var reqHL = { url: loginData.readerHighlightsCap, 
                request: 'get', response: 'json' };

	var refresh = F.mergeE(F.oneE(true), F.timerE(30000), update);

  loadData(loginData, F.getWebServiceObjectE(refresh.constantE(reqData)));
}

F.getWebServiceObjectE(loginClicks.mapE(mkLogin)).mapE(function(result) {
  loggedIn(result);
});

document.getElementById('username').focus();

function isFirefox() {
  return navigator.userAgent.match('Gecko') !== null;
}

function firefoxUI() {
  var at = document.getElementById('applicantTable').parentNode
  var ft = document.getElementById('mainPanel').firstElementChild;

  F.$E(window, 'resize').mapE(function(evt) {
   at.style.height = (document.body.clientHeight - ft.clientHeight - 50) + 'px';
  });
}

if (isFirefox()) {
  firefoxUI();
}