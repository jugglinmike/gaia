var Clock = require('./clock');

function Alarm() {
  Clock.apply(this, arguments);
}

module.exports = Alarm;

Alarm.prototype = Object.create(Clock.prototype);

// Amount of time to wait for Alarm creation banner to be hidden
Alarm.bannerTimeout = 5 * 1000;

[
  'analogClock', 'digitalClock', 'openFormBtn', 'form', 'countdownBanner'
].forEach(function(name) {
  Object.defineProperty(Alarm.prototype, name + 'Displayed', {
    get: function() {
      return this.els.alarm[name].displayed();
    }
  });
});

// Ensure that the 'Countdown banner' element is eventually hidden.
Alarm.prototype.waitForBanner = function() {
   this.client.waitFor(function() {
     return !this.els.alarm.countdownBanner.displayed();
   }.bind(this), {
     timeout: Clock.bannerTimeout
   });
};

Alarm.prototype.items = function() {
  return this.els.alarm.listItemS.map(function(el) {
    return el.text();
  });
};

Alarm.prototype.toggleClock = function() {
  var target;

  ['analog', 'digital'].forEach(function(clockType) {
    var el = this.els.alarm[clockType + 'Clock'];
    if (el.displayed()) {
      target = el;
    }
  }, this);

  if (!target) {
    throw new Error('Unable to toggle clock face: no clock is displayed.');
  }

  target.tap();
};

Alarm.prototype.fill = function(settings) {
  Object.keys(settings).forEach(function(name) {
    var value = settings[name];
    this.client.forms.fill(this.els.alarm[name + 'Input'], value);
  }, this);
};

Alarm.prototype.readForm = function() {
  var vals = {};
  Array.prototype.forEach.call(arguments, function(name) {
    vals[name] = this.els.alarm[name + 'Input'].getAttribute('value');
  }, this);
  return vals;
};

Alarm.prototype.toggleAlarm = function(alarmIdx) {
  var alarm = this.els.alarm.enablerS[alarmIdx];
  alarm.tap();
};

// Open the alarm form for the given alarm item. If unspecified, open the
// "Create Alarm" form.
Alarm.prototype.openForm = function(alarmIdx) {
  var openButton = this.els.alarm.openFormBtn;

  if (arguments.length) {
    openButton = this.els.alarm.listItemS[alarmIdx];
  }

  openButton.tap();
  this.waitForSlideEnd(this.els.alarm.form);
};

Alarm.prototype.formSubmit = function() {
  dismissForm.call(this, 'doneBtn');
};

Alarm.prototype.formClose = function() {
  dismissForm.call(this, 'closeFormBtn');
};

Alarm.prototype.formDelete = function() {
  dismissForm.call(this, 'deleteBtn');
};

function dismissForm(btnName) {
  this.els.alarm[btnName].tap();
  this.waitForSlideEnd(this.els.alarm.form);
}
