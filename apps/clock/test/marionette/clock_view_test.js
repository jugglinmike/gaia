marionette('launch and switch to clock', function() {
  var CLOCK_ORIGIN = 'app://clock.gaiamobile.org';
  var assert = require('assert');
  var client = marionette.client();

  setup(function() {
    client.apps.launch(CLOCK_ORIGIN);
    client.apps.switchToApp(CLOCK_ORIGIN);
  });

  suite('startup', function() {

    test('analog clock displayed (sync)', function() {
      var elem = client.findElement('#analog-clock');
      assert.ok(elem.displayed());
    });

    test('digital clock not displayed (sync)', function() {
      var elem = client.findElement('#digital-clock');
      assert.ok(!elem.displayed());
    });

  });

});
