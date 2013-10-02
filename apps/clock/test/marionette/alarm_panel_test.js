marionette('Alarm Panel', function() {
  var assert = require('./lib/assert');
  var Clock = require('./lib/clock');
  var Alarm = require('./lib/alarm');
  var client = marionette.client();
  var alarm;

  setup(function() {
    alarm = new Alarm(client);

    alarm.launch();
  });

  test('Clock interaction', function() {
    assert(alarm.analogClockDisplayed, 'analog clock is displayed');
    assert(!alarm.digitalClockDisplayed, 'digital clock is not displayed');
    assert(alarm.openFormBtnDisplayed, '"New Alarm" button is displayed');
    assert(!alarm.formDisplayed, 'Alarm form is not displayed');

    alarm.toggleClock();

    assert(
      !alarm.analogClockDisplayed,
      'analog clock is not displayed after toggle'
    );
    assert(
      alarm.digitalClockDisplayed,
      'digital clock is displayed after toggle'
    );

    alarm.toggleClock();

    assert(
      alarm.analogClockDisplayed,
      'analog clock is displayed after toggle'
    );
    assert(
      !alarm.digitalClockDisplayed,
      'digital clock is not displayed after toggle'
    );
  });

  suite('Alarm interaction', function() {
    var twentyFromNow, thirtyFromNow;

    setup(function() {
      twentyFromNow = alarm.fromNow(1000 * 60 * 20);
      thirtyFromNow = alarm.fromNow(1000 * 60 * 30);

      alarm.openForm();
    });

    test('Creation', function() {
      var alarms;

      alarm.fill({
        name: 'coffee break',
        time: twentyFromNow
      });

      alarm.formSubmit();

      alarms = alarm.items();

      assert.equal(alarms.length, 1);
      assert.hasTime(
        alarms[0], twentyFromNow, 'Alarm time is rendered'
      );
      assert(
        alarms[0].indexOf('coffee break'),
        'Alarm title is rendered'
      );
      assert(alarm.countdownBannerDisplayed, 'Countdown banner is displayed');

      this.timeout(Alarm.bannerTimeout);
      alarm.waitForBanner();

      alarm.openForm();

      alarm.fill({
        name: 'quitting time',
        time: thirtyFromNow
      });

      alarm.formSubmit();

      alarms = alarm.items();

      assert.equal(alarms.length, 2);
      assert.hasTime(
        alarms[0],
        thirtyFromNow,
        'Newest alarm title is rendered first'
      );
      assert(
        alarms[0].indexOf('quitting time'),
        'Newest alarm title is rendered first'
      );
      assert.hasTime(
        alarms[1],
        twentyFromNow,
        'Previously-created alarm time is rendered second'
      );
      assert(
        alarms[1].indexOf('coffee break'),
        'Previously-created alarm title is rendered second'
      );
      assert(alarm.countdownBannerDisplayed, 'Countdown banner is displayed');
    });

    test('Closing form', function() {
      alarm.formClose();
      assert(
        alarm.els.panels.alarm.displayed(),
        'Alarm panel is displayed'
      );
    });

    suite('Alarm manipulation', function() {
      var alarmItem;

      setup(function() {
        var alarms;

        alarm.fill({
          name: 'coffee break',
          time: twentyFromNow
        });

        alarm.formSubmit();

        // Ensure the banner is hidden before the tests continue because it
        // obscures the alarm list
        this.timeout(Alarm.bannerTimeout);
        alarm.waitForBanner();

        alarmItem = alarm.items()[0];
      });

      test('updating', function() {
        var vals;

        alarm.openForm(0);
        vals = alarm.readForm('name', 'time');

        assert.equal(
          vals.name,
          'coffee break',
          'Alarm name input field is pre-populated with current value'
        );
        assert.hasTime(
          vals.time,
          twentyFromNow,
          'Alarm time input field is pre-populated with current value'
        );

        alarm.fill({
          name: 'quitting time',
          time: thirtyFromNow
        });

        alarm.formSubmit();

        alarmItem = alarm.items()[0];

        assert(
          alarmItem.indexOf('quitting time') > -1,
          'Alarm description is updated'
        );
        assert.hasTime(alarmItem, thirtyFromNow, 'Alarm time is updated');
        assert(
          alarm.countdownBannerDisplayed,
          'Countdown banner is displayed'
        );
      });

      test('toggling', function() {
        alarm.toggleAlarm(0);

        assert(
          !alarm.countdownBannerDisplayed,
          'Countdown banner is not displayed after disabling an alarm'
        );

        alarm.toggleAlarm(0);

        client.waitFor(function() {
          return alarm.countdownBannerDisplayed;
        });
      });

      test('deletion', function() {
        alarm.openForm(0);
        alarm.formDelete();
        assert.equal(
          alarm.items().length,
          0,
          'deleted alarm is removed from the alarm list'
        );
      });
    });
  });

});
