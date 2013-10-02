var selectors = require('./selectors');
var utils = require('./utils');

function Clock(client) {
  this.client = client;

  // Heads up! Magic here: key names that end with a capital S will be used to
  // select element collections and will therefor return an array.
  this.els = utils.deepMap(selectors, function(key, value) {
    var getOne = function() {
      return client.findElement(value);
    };
    var getMany = function() {
      return client.findElements(value);
    };
    Object.defineProperty(this, key, {
      get: /S$/.test(key) ? getMany : getOne
    });
  });
}

module.exports = Clock;

Clock.ORIGIN = 'app://clock.gaiamobile.org';

/**
 * Create a Date object whose value is the supplied number of milliseconds from
 * the current system time.
 *
 * @param {Number} ms - The number of milliseconds from the current time to
 *                      create the Date. Optional (defaults to 0). May be
 *                      negative.
 * @return {Date}
 */
Clock.prototype.fromNow = function(ms) {
  ms = ms || 0;
  ms += this.client.executeScript(function() {
    return Date.now();
  });
  return new Date(ms);
};

Clock.prototype.launch = function() {
  this.client.apps.launch(Clock.ORIGIN);
  this.client.apps.switchToApp(Clock.ORIGIN);

  this.client.waitFor(ready.bind(this));
};

function ready() {
  return this.els.analogClock.displayed() || this.els.digitalClock.displayed();
}

Clock.prototype.navigate = function(panelName) {
  var button, panel;
  if (panelName === 'alarmForm') {
    button = this.els.alarmFormBtn;
    panel = this.els.alarmForm;
  } else {
    button = this.els.tabs[panelName];
    panel = this.els.panels[panelName];
  }

  button.tap();
  this.waitForSlideEnd(panel);
};

Clock.prototype.waitForSlideEnd = function(element) {
  this.client.waitFor(function() {
    return element.scriptWith(function(element) {
      return !!element.className.match(/\bslide-(in|out)-(right|left)\b/);
    });
  });

  this.client.waitFor(function() {
    return element.scriptWith(function(element) {
      return !element.className.match(/\bslide-(in|out)-(right|left)\b/);
    });
  });
};
