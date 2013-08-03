// TODO: Kill b2g instance when tests crash
var Actions = require('marionette-client').Actions;

marionette('launch and switch to clock', function() {
  var CLOCK_ORIGIN = 'app://clock.gaiamobile.org';
  var assert = require('assert');
  var client = marionette.client();
  var selectors = {
    analogClock: '#analog-clock',
    digitalClock: '#digital-clock'
  };

  setup(function() {
    client.apps.launch(CLOCK_ORIGIN);
    client.apps.switchToApp(CLOCK_ORIGIN);
    this.elems = {
      analogClock: client.findElement(selectors.analogClock),
      digitalClock: client.findElement(selectors.digitalClock)
    };
  });

  test('startup', function() {
    assert.ok(this.elems.analogClock.displayed(),
      'analog clock is displayed');
    assert.ok(!this.elems.digitalClock.displayed(),
      'digital clock is not displayed');
  });

  // TODO: Enable this test when "tap" action triggers a "touch start" event
  // (currently, the Marionette JavaScript client models the "tap" Action as a
  // "press" Action followed by a "release" Action, so "touch start" never
  // occurs.
  test('tap to toggle clock'/*, function() {
    var subject = new Actions(client);
    subject.tap(this.elems.analogClock).perform();
    assert.ok(!this.elems.analogClock.displayed(),
      'analog clock is not displayed');
    assert.ok(this.elems.digitalClock.displayed(),
      'digital clock is displayed');
  }*/);

});
