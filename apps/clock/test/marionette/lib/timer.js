var Clock = require('./clock');
var Actions = require('marionette-client').Actions;
var MAXFLICK = 1200;

function Timer(client) {
  Clock.apply(this, arguments);
  this._actions = new Actions(client);
}

module.exports = Timer;

Timer.prototype = Object.create(Clock.prototype);

Timer.prototype.launch = function() {
  Clock.prototype.launch.call(this);
  this.navigate('timer');
};

Timer.prototype.setDuration = function(hours, minutes, seconds) {
  setSpinnerValue.call(this, 'hour', hours);
  setSpinnerValue.call(this, 'minute', minutes);
  setSpinnerValue.call(this, 'second', seconds);
};

Timer.prototype.start = function() {
  var createBtn = this.els.timer.createBtn;
  var countdown = this.els.timer.countdown;

  this.client.waitFor(function() {
    createBtn.tap();
    return countdown.displayed() && /[1-9]/.test(countdown.text());
  });
};

function getCenterEl(name) {
  var containerEl = this.els.timer.spinner[name + 's'];
  var valEls = this.els.timer.spinner[name + 'S'];
  var size = containerEl.size();
  var location = containerEl.location();
  var center = location.y + 0.5 * size.height;
  var closestOffset = Infinity;
  var closest;

  valEls.forEach(function(valEl) {
    var valCenter = valEl.location().y + 0.5 * valEl.size().height;
    var dist = Math.abs(valCenter - center);
    if (dist < closestOffset) {
      closest = valEl;
      closestOffset = dist;
    }
  });

  return closest;
}

function getSpinnerValue(name) {
  return parseInt(getCenterEl.call(this, name).text(), 10);
}

function setSpinnerValue(name, val) {
  var a = this._actions;
  var flickAmt = MAXFLICK;
  var dir = -1;
  var current = -Infinity;
  var centerEl, size, prev, center;

  if (getSpinnerValue.call(this, name) === val) {
    return;
  }

  do {
    target = getCenterEl.call(this, name);
    size = target.size();
    center = {
      x: size.width / 2,
      y: size.height / 2
    };

    a.flick(target, center.x, center.y, center.x, center.y + dir * flickAmt);
    // Settle time for inertial motion
    a.wait(0.5);
    a.perform();

    prev = current;
    current = getSpinnerValue.call(this, name);

    // If the most recent flick has passed over the target value, reverse
    // direction and decrease the flick strength.
    if ([prev, val, current].sort(compareNumbers)[1] === val) {
      flickAmt /= 1.5;
      dir *= -1;
    }
  } while (current !== val);
}

// Used to sort array of numbers in setSpinnerValue
function compareNumbers(a, b) {
  return a - b;
}
