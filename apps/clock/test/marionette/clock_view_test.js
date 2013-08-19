// TODO: Kill b2g instance when tests crash
var Actions = require('marionette-client').Actions;

marionette('launch and switch to clock', function() {
  var CLOCK_ORIGIN = 'app://clock.gaiamobile.org';
  var assert = require('assert');
  var client = marionette.client();
  var selectors = {
    analogClock: '#analog-clock',
    digitalClock: '#digital-clock',
    alarmFormBtn: '#alarm-new',
    alarmForm: '#alarm',
    alarmFormCloseBtn: '#alarm-close',
    alarmCreateBtn: '#alarm-done',
    alarmNameInput: '#edit-alarm [name="alarm.label"]',
    timeInput: '#time-select',
    alarmList: '#alarms',
    alarmListItem: '.alarm-cell',
    countdownBanner: '#banner-countdown'
  };

  function padZeros(num) {
    num = String(num);
    while (num.length < 2) {
      num = '0' + num;
    }
    return num;
  }

  function setValue(element, value) {
    var type = element.getAttribute('type');
    if (value instanceof Date) {
      if (type === 'time') {
        value = [value.getHours(), value.getMinutes(), value.getSeconds()]
          .map(padZeros).join(':');
      } else {
        value = [values.date.getMonth() + 1, date.getDay(), date.getFullYear()]
          .map(padZeros).join('-');
      }
    }
    element.client.executeScript(function(elem, value) {
      elem.value = value;
    }, [element, value]);
  }

  setup(function() {
    client.apps.launch(CLOCK_ORIGIN);
    client.apps.switchToApp(CLOCK_ORIGIN);
    this.elems = {};
    Object.keys(selectors).forEach(function(key) {
      Object.defineProperty(this.elems, key, {
        get: function() {
          return client.findElement(selectors[key]);
        }
      });
    }.bind(this));
  });

  test('default clock view', function() {
    assert.ok(this.elems.analogClock.displayed(),
      'analog clock is displayed');
    assert.ok(!this.elems.digitalClock.displayed(),
      'digital clock is not displayed');
    assert.ok(this.elems.alarmFormBtn.displayed(),
      '"New Alarm" button is displayed');
    assert.ok(!this.elems.alarmForm.displayed(),
      'Alarm form is not displayed');

    // TODO: Enable this test when "tap" action triggers a "touch start" event
    // (currently, Marionette models the "tap" Action as a "press" Action
    // followed by a "release" Action, so "touch start" never occurs.
    /*this.elems.analogClock.tap();
    assert.ok(!this.elems.analogClock.displayed(),
      'analog clock is not displayed after tap');
    assert.ok(this.elems.digitalClock.displayed(),
      'digital clock is displayed after tap');*/
  });

  suite('New Alarm', function() {

    setup(function() {
      this.elems.alarmFormBtn.click();
      assert.ok(this.elems.alarmForm.displayed(), 'Alarm form is displayed');
      client.waitFor(function() {
        return this.elems.alarmCreateBtn.displayed();
      }.bind(this));
    });

    test('creation', function(done) {
      var time = new Date();
      // Allow for a longer timeout to account for the long-lived 'Countdown
      // banner'.
      var timeout = 10 * 1000;
      var alarms;

      time.setHours(3);
      time.setMinutes(42);
      this.timeout(timeout);

      assert.ok(
        this.elems.alarmNameInput.displayed(),
        'Alarm name input is displayed'
      );

      this.elems.alarmNameInput.sendKeys(['coffee break']);
      setValue(this.elems.timeInput, time);

      this.elems.alarmCreateBtn.click();

      // The alarm form closes with an animation, so the test must be suspended
      // until it is completely hidden.
      client.waitFor(function() {
        return !this.elems.alarmForm.displayed();
      }.bind(this));

      alarms = client.findElements(selectors.alarmListItem);

      assert.equal(alarms.length, 1);
      assert.ok(
        alarms[0].text().indexOf('3:42') > -1,
        'Alarm time is rendered'
      );
      assert.ok(
        alarms[0].text().indexOf('coffee break'),
        'Alarm title is rendered'
      );
      assert.ok(
        this.elems.countdownBanner.displayed(),
        'Countdown banner is displayed'
      );

      // Ensure that the 'Countdown banner' element is eventually hidden.
      client.waitFor(function() {
        return !this.elems.countdownBanner.displayed();
      }.bind(this), {
        timeout: timeout
      }, done);
    });

    test('Closing form', function() {
      assert.ok(this.elems.alarmFormCloseBtn.displayed(),
        '"Close" button is displayed');

      // Close alarm form
      this.elems.alarmFormCloseBtn.click();
      assert.ok(this.elems.alarmFormBtn.displayed(),
        '"New Alarm" button is displayed');
      client.waitFor(function() {
        return !this.elems.alarmForm.displayed();
      }.bind(this));
      assert.ok(!this.elems.alarmForm.displayed(),
        'Alarm form is not displayed');
    });

  });

});
