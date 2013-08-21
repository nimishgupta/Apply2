import fx = module("./fx")
import tsUnit = module("./tsUnit")


class FxTests extends tsUnit.TestClass {

  public testBind1() {
    var e1 = fx.source(null);
    var e2 = fx.bind(e1, function(v) { return fx.constant(v + 1); });
    e1.send(300);
    this.areIdentical(301, e2.valueNow);
    e1.send(500);
    this.areIdentical(501, e2.valueNow);
    e1.send(null);
    this.areIdentical(null, e2.valueNow);
    e1.send(400);
    this.areIdentical(401, e2.valueNow);
  }

  public testBind2() {
    var e1 = fx.source(null);
    var e2 = fx.bind(e1, function(v) {
      if (v === 100) {
        return fx.constant(100);
      }
      else if (v === 200) {
        return e1;
      }
      else if (v === 300) {
        return e3;
      }
      throw  'unexpected value: ' + v;
    });
    var e3 = fx.bind(e2, function(v) {
      if (v === 300) {
        throw 'infinite loop detected';
      }
      return fx.constant(v + 1);
    });
    e1.send(100);
    this.areIdentical(101, e3.valueNow);
    e1.send(200);
    this.areIdentical(201, e3.valueNow);
    this.throws(() => e1.send(300));
    //var exn = assertThrows(function() { e1.send(300); });
    //this.areIdentical('infinite loop detected', exn);
  }

  public testBind3() {
    var e1 = fx.source(0);
    var e2 = fx.map(function(v) { return v + 1; }, e1);
    var e3 = fx.bind(e1, function(v) {
      if (v === 0) {
        return e1;
      }
      if (v === 500) {
        return fx.map(function(v) { return v + 500; }, e1);
      }
      throw 'unexpected v';
    });
    var e4 = fx.map2(function(v, w) { return v + w; }, e2, e3);
    var e3inter = fx.map(function(v) { return v + 500; }, e1);
    this.areIdentical(1, e2.rank);
    this.areIdentical(1, e3.rank);
    this.areIdentical(1, e4.valueNow);
    e1.send(500);
    this.areIdentical(1000, e3inter.valueNow);
    this.areIdentical(501, e2.valueNow);
    this.areIdentical(1000, e3.valueNow);
    this.areIdentical(1501, e4.valueNow);
  }

  public testBind4() {
    var e1 = fx.source(0);
    var e2 = 
      fx.map(x => x,
        fx.map(x => x, fx.map(function(v) { return v + 1; }, e1)));
    var e3 = fx.bind(e1, function(v) {
      if (v === 0) {
        return e1;
      }
      if (v >= 500) {
        return e2;
      }
      fail('unexpected v');
    });
    var calls = 0;
    var e4 = fx.map2(function(v, w) {
      calls++;
      return v + w;
    }, e2, e3);
    this.areIdentical(1, e4.valueNow);
    this.areIdentical(1, calls);
    e1.send(500);
    this.areIdentical(2, calls);
    this.areIdentical(501, e2.valueNow);
    this.areIdentical(501, e3.valueNow);
    this.areIdentical(1002, e4.valueNow);
    e1.send(600);
    this.areIdentical(3, calls);
    this.areIdentical(601, e2.valueNow);
    this.areIdentical(601, e3.valueNow);
    this.areIdentical(1202, e4.valueNow);
  }

  public testMerge1() {
    var e1 = fx.source(null);
    var e2 = fx.source(null);
    var e3 = fx.merge(e1, e2);
    this.areIdentical(null, e3.valueNow);
    e1.send(100);
    this.areIdentical(100, e3.valueNow);
    e2.send(200);
    this.areIdentical(200, e3.valueNow);
    e1.send(300);
    this.areIdentical(300, e3.valueNow);
  }

  // Merge is left-biased for simultaneous events.
  public testMerge2() {
    var e1 = fx.source(null);
    var e2 = fx.bind(e1, function(v) { return fx.constant(v + 1); });
    var e3 = fx.merge(e1, e2);
    this.areIdentical(null, e3.valueNow);
    e1.send(100);
    this.areIdentical(100, e3.valueNow);
    e1.send(200);
    this.areIdentical(200, e3.valueNow);
    e1.send(300);
    this.areIdentical(300, e3.valueNow);
  }

  /*
  function testDisjointMerge1() {
    var e1 = fx.source(null);
    var e2 = fx.source(null);
    var e3 = fx.disjointMerge(e1, e2);
    assertObjectEquals({ v: null, i: 0 }, e3.valueNow);
    e1.send(100);
    assertObjectEquals({ v: 100, i: 0 }, e3.valueNow);
    e2.send(200);
    assertObjectEquals({ v: 200, i: 1 }, e3.valueNow);
    e1.send(300);
    assertObjectEquals({ v: 300, i: 0 }, e3.valueNow);
  }
  */

  public testApp1() {
    var e1 = fx.source(1);
    var e2 = fx.source(2);
    var e3 = fx.map2(function(x, y) { return x + y; }, e1, e2);
    this.areIdentical(3, e3.valueNow);
    e1.send(10);
    this.areIdentical(12, e3.valueNow);
    e2.send(5);
    this.areIdentical(15, e3.valueNow);
  }


  public testApp2() {
    var e1 = fx.source(1);
    var e2 = fx.map(function(x) { return x * 2; }, e1);
    var e3 = fx.map2(function(x, y) { return x + y; }, e1, e2);
    this.areIdentical(3, e3.valueNow);
    e1.send(10);
    this.areIdentical(30, e3.valueNow);
    e1.send(5);
    this.areIdentical(15, e3.valueNow);
  }

  public testApp3() {
    var e1 = fx.source(1);
    var e2 = fx.map(function(x) { return x * 2; }, e1);
    // e1 and e2 are swapped below from testApp2
    var e3 = fx.map2(function(x, y) { return x + y; }, e2, e1);
    this.areIdentical(3, e3.valueNow);
    e1.send(10);
    this.areIdentical(30, e3.valueNow);
    e1.send(5);
    this.areIdentical(15, e3.valueNow);
  }
/*
  function testAppWithInit1() {
    var e1 = fx.source(1);
    var e2 = fx.source(2);
    var e3 = fx.appWithInit(900, function(x, y) { return x + y; }, e1, e2);
    this.areIdentical(900, e3.valueNow);
    e1.send(10);
    this.areIdentical(12, e3.valueNow);
    e2.send(5);
    this.areIdentical(15, e3.valueNow);
  }

  function testFold1() {
    function f(v, acc) {
      return v + acc;
    }
    var e1 = fx.source(null);
    var e2 = e1.fold(0, f);
    this.areIdentical(0, e2.valueNow);
    e1.send(1);
    this.areIdentical(1, e2.valueNow);
    e1.send(2);
    this.areIdentical(3, e2.valueNow);
    e1.send(3);
    this.areIdentical(6, e2.valueNow);
  }

  function testLetrec1() {
    var es = fx.letrec(function(e) {
      return [ fx.constant(100) ];
    });
    this.areIdentical(100, es[0].valueNow);
  }

  function plus(x, y) {
    if (x === null) {
      x = 0;
    }
    if (y === null) {
      y = 0;
    }
    return x + y;
  }

  function testLetrec2() {
    var keys1 = fx.source(null);
    var keys2 = fx.source(null);
    var es = fx.letrec(function(w1, w2) {
      return [ fx.app(plus, keys1, w2), fx.app(plus, keys2, w1) ];
    });
    this.areIdentical(0, es[0].valueNow);
    this.areIdentical(0, es[1].valueNow);
    keys1.send(500);
    this.areIdentical(500, es[0].valueNow);
    this.areIdentical(0, es[1].valueNow);
    keys2.send(200);
    this.areIdentical(500, es[0].valueNow);
    this.areIdentical(700, es[1].valueNow);
    keys1.send(400);
    this.areIdentical(1100, es[0].valueNow);
    this.areIdentical(700, es[1].valueNow);
  }

  function testIntervalShouldStopTimer() {
    var delay = fx.source(100);
    var calls = 0;
    var lastT = fx.util.now();
    function f(t) {
      calls++;
      assertRoughlyEquals(100, t - lastT, 100);
      lastT = t;
      if (calls === 3) {
        delay.send(null);
        // allow calls > 3 fire if there is a bug
        window.setTimeout(function() { asyncTestCase.continueTesting(); }, 500);
      }
      if (calls > 3) {
        fail('timer did not stop');
      }
    }
    fx.app(f, fx.interval(delay));
    asyncTestCase.waitForAsync();
  }

  function testFilter1() {
    var src = fx.source(0);
    src.filter(function(x) { return x % 2 === 0; }).map(function(v) {
      this.areIdentical(0, v % 2);
    });
    src.send(1);
    src.send(2);
    src.send(null);
    src.send(10);
    src.send(99);
  }

  function testFilter2() {
    var sig = fx.source(1).filter(function(v) { return v % 2 === 0; });
    this.areIdentical(null, sig.valueNow);
  }

  function testWorld1() {
    function recvIncr(w, _) {
      return w + 1;
    }

    function recvReset(w, _) {
      return 0;
    }
    var incr = fx.source(null);
    var reset = fx.source(null);

    var w = fx.world(0, 
                    [[ incr, recvIncr], 
                     [ reset, recvReset]]);
    this.areIdentical(0, w.valueNow);
    incr.send(1);
    this.areIdentical(1, w.valueNow);
    incr.send(1);
    this.areIdentical(2, w.valueNow);
    reset.send('arg ignored');
    this.areIdentical(0, w.valueNow);
  }

  function testDelay0() {
    var start = Date.now();
    var src = fx.source(null);
    var d = fx.source(500);
    src.delay(d).map(function(end) {
                       if (end === null) {
                         return null;
                       }
                       this.areIdentical('hello', end);
                       assertRoughlyEquals(500, Date.now() - start, 50);
                       d.send(null);
                       asyncTestCase.continueTesting();
                         return false;
                       });
    src.send('hello');
    asyncTestCase.waitForAsync();
  }


  function testDelayShouldApproximatelyMatchClock() {
    var src = fx.source('init');
    var d = fx.source(500);
    src.delay(d).map(function(start) {
                       if (start === 'init') {
                         return false;
                       }
                       assertRoughlyEquals(Date.now() - start, 500, 50);
                       asyncTestCase.continueTesting();
                       d.send(null);
                       return false;
                     });
    src.send(Date.now());
    asyncTestCase.waitForAsync();
  }

  function testDelayShouldSignalInitialValue() {
    var start = Date.now();
    fx.constant('zero').delay(0)
      .map(function(v) {
             this.areIdentical('zero', v);
             asyncTestCase.continueTesting();
           });
    asyncTestCase.waitForAsync();
  }

  function testDelayVarying() {
    var d = fx.source(500);
    var src = fx.source(0);
    var count = 0;
    src.delay(d).map(function(v) {
      switch (count++) {
      case 0:
        d.send(200);
        src.send(Date.now());
        break;
      case 1:
        assertRoughlyEquals(v + 200, Date.now(), 200);
        src.send(Date.now());
        break;
      case 2:
        assertRoughlyEquals(v + 200, Date.now(), 200);
        d.send(500);
        src.send(Date.now());
        break;
      case 3:
        assertRoughlyEquals(v + 500, Date.now(), 500);
        d.send(null);
        window.setTimeout(function() { 
                            asyncTestCase.continueTesting();
                          }, 200);
        break;
      default:
        debugger;
        fail('more than 3 iterations');
      }
      return null;
    });

    asyncTestCase.waitForAsync();
  }

  function testDelayShouldDelayRapidChangesCorrectly() {
    var d = fx.source(500);
    var src = fx.source(0);
    var last = Date.now();
    src.delay(d).map(function(v) {
      switch (v) {
      case 0:
        last = Date.now();
        break;
      case 1:
        assertRoughlyEquals(600, Date.now() - last, 50);
        last = Date.now();
        break;
      case 2:
        assertRoughlyEquals(100, Date.now() - last, 50);
        last = Date.now();
        break;
      case 3:
        assertRoughlyEquals(100, Date.now() - last, 50);
        d.send(null);
        asyncTestCase.continueTesting();
        break;
      default:
        fail('too many values');
      }
      return null;
    });
    asyncTestCase.waitForAsync();
    window.setTimeout(function() {
      src.send(1);
      window.setTimeout(function() {
        src.send(2);
        window.setTimeout(function() {
          src.send(3);
        }, 100);
      }, 100);
    }, 100);
  }*/

}

var test = new tsUnit.Test();
test.addTestClass(new FxTests());
test.showResults(document.getElementById("testResults"), test.run());