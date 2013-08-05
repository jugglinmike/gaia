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
    alarmForm: '#alarm'
  };

  setup(function() {
    client.apps.launch(CLOCK_ORIGIN);
    client.apps.switchToApp(CLOCK_ORIGIN);
    this.elems = {};
    Object.keys(selectors).forEach(function(key) {
      this.elems[key] = client.findElement(selectors[key]);
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
    // (currently, the Marionette JavaScript client models the "tap" Action as a
    // "press" Action followed by a "release" Action, so "touch start" never
    // occurs.
    /*var subject = new Actions(client);
    subject.tap(this.elems.analogClock).perform();
    assert.ok(!this.elems.analogClock.displayed(),
      'analog clock is not displayed after tap');
    assert.ok(this.elems.digitalClock.displayed(),
      'digital clock is displayed after tap');*/
  });

  suite('alarm creation', function() {

    setup(function() {
      this.elems.alarmFormBtn.click();
      assert.ok(this.elems.alarmForm.displayed(),
        'Alarm form is displayed after clicking "New Alarm" button');
    });

    test('this is a test', function(done) {
      setTimeout(done, 2000);
    });

  });

});
