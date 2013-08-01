import F = module("./flapjax");

function getEltById(x : string) : HTMLElement {
  var elt = window.document.getElementById(x);
  if (elt === null) {
    throw 'element not found';
  }
  return elt;
}

export function passwordReset(resetCap : string) {
  var passwordPanel = getEltById('resetPanel');
  var pwNew1 = getEltById('pwResetNew1');
  var pwNew2 = getEltById('pwResetNew2');
  var pwStatus = getEltById('pwResetStatus');
  var pwSet = getEltById('pwResetSet');
  var pwBack = getEltById('pwResetBack');

  passwordPanel.style.display = '';
  getEltById('loginPanel').style.display = 'none';

  var new1B = F.$B(pwNew1);
  var new2B = F.$B(pwNew2);
  
  F.extractEventE(pwBack, 'click').mapE(function(_) { window.location.reload(); });
  var enabled = F.liftB(function(new1, new2) {
    return new1 === new2 && new1.length > 5 ? '' : 'disabled';
  }, new1B, new2B);

  F.insertValueB(enabled, pwSet, 'disabled');
  
  function mkReq(newPw) {
      return {
        url: resetCap,
        request: 'post',
        fields: { password: newPw },
        response: 'plain'
      };
  }

  var reqs = F.clicksE(pwSet).snapshotE(F.liftB(mkReq, new1B));
  F.insertDomB(F.DIV(F.getWebServiceObjectE(reqs).startsWith('')),
               'pwResetStatus');
}

export function setupPasswordChange(loginData) {
  var mainPanel = getEltById('mainPanel');
  var passwordPanel = getEltById('passwordPanel');
  var pass = <HTMLInputElement> getEltById('pass');
  var pwNew1 = <HTMLInputElement> getEltById('pwNew1');
  var pwNew2 = <HTMLInputElement> getEltById('pwNew2');
  var pwOld =<HTMLInputElement>  getEltById('pwOld');
  var pwStatus = getEltById('pwStatus');
  var pwSet = getEltById('pwSet');
  var pwBack = getEltById('pwBack');

  var new1B = F.$B(pwNew1);
  var new2B = F.$B(pwNew2);
  var oldB = F.$B(pwOld);
  
  F.extractEventE(pass, 'click').mapE(function(_) {
    mainPanel.style.display = 'none';
    passwordPanel.style.display = '';
  });
  F.extractEventE(pwBack, 'click').mapE(function(_) {
    mainPanel.style.display = '';
    passwordPanel.style.display = 'none';
    pwNew1.value = pwNew2.value = pwOld.value = '';
    new1B.sendBehavior('');
    new2B.sendBehavior('');
    oldB.sendBehavior('');
    pwStatus.innerText = '';
  });
  var enabled = F.liftB(function(new1, new2) {
    return new1 === new2 && new1.length > 5 ? '' : 'disabled';
  }, new1B, new2B);

  F.insertValueB(enabled, pwSet, 'disabled');
  
  function mkReq(oldPw, newPw) {
      return {
        url: loginData.changePasswordCap,
        request: 'post',
        fields: { oldPassword: oldPw, newPassword: newPw },
        response: 'plain'
      };
  }

  var reqs = F.clicksE(pwSet).snapshotE(F.liftB(mkReq, oldB, new1B));
  F.insertDomB(F.DIV(F.getWebServiceObjectE(reqs).startsWith('')), 'pwStatus');
}
