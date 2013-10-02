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
    assert(
      alarm.els.analogClock.displayed(),
      'analog clock is displayed'
    );
    assert(
      !alarm.els.digitalClock.displayed(),
      'digital clock is not displayed'
    );
    assert(
      alarm.els.alarmFormBtn.displayed(),
      '"New Alarm" button is displayed'
    );
    assert(
      !alarm.els.alarmForm.displayed(),
      'Alarm form is not displayed'
    );

    alarm.els.analogClock.tap();

    assert(
      !alarm.els.analogClock.displayed(),
      'analog clock is not displayed after tap'
    );
    assert(
      alarm.els.digitalClock.displayed(),
      'digital clock is displayed after tap'
    );

    alarm.els.digitalClock.tap();

    assert(
      alarm.els.analogClock.displayed(),
      'analog clock is displayed after tap'
    );
    assert(
      !alarm.els.digitalClock.displayed(),
      'digital clock is not displayed after tap'
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

      alarm.els.alarmNameInput.sendKeys(['coffee break']);
      client.forms.fill(alarm.els.timeInput, twentyFromNow);

      alarm.submit();

      alarms = alarm.els.alarmListItemS;

      assert.equal(alarms.length, 1);
      assert.hasTime(
        alarms[0].text(), twentyFromNow, 'Alarm time is rendered'
      );
      assert(
        alarms[0].text().indexOf('coffee break'),
        'Alarm title is rendered'
      );
      assert(
        alarm.els.countdownBanner.displayed(),
        'Countdown banner is displayed'
      );

      this.timeout(Alarm.bannerTimeout);
      alarm.waitForBanner();

      alarm.openForm();

      alarm.els.alarmNameInput.sendKeys(['quitting time']);
      client.forms.fill(alarm.els.timeInput, thirtyFromNow);

      alarm.submit();

      alarms = alarm.els.alarmListItemS;

      assert.equal(alarms.length, 2);
      assert.hasTime(
        alarms[0].text(),
        thirtyFromNow,
        'Newest alarm title is rendered first'
      );
      assert(
        alarms[0].text().indexOf('quitting time'),
        'Newest alarm title is rendered first'
      );
      assert.hasTime(
        alarms[1].text(),
        twentyFromNow,
        'Previously-created alarm time is rendered second'
      );
      assert(
        alarms[1].text().indexOf('coffee break'),
        'Previously-created alarm title is rendered second'
      );
      assert(
        alarm.els.countdownBanner.displayed(),
        'Countdown banner is displayed'
      );
    });

    test('Closing form', function() {
      alarm.els.alarmFormCloseBtn.tap();

      client.waitFor(function() {
        return !alarm.els.alarmForm.displayed();
      });
      assert(
        alarm.els.panels.alarm.displayed(),
        'Alarm panel is displayed'
      );
    });

    suite('Alarm manipulation', function() {
      var alarmItem;

      setup(function() {
        var alarms;
        alarm.els.alarmNameInput.sendKeys(['coffee break']);
        client.forms.fill(alarm.els.timeInput, twentyFromNow);

        alarm.submit();

        // Ensure the banner is hidden before the tests continue because it
        // obscures the alarm list
        this.timeout(Alarm.bannerTimeout);
        alarm.waitForBanner();

        alarmItem = alarm.els.alarmListItemS[0];
      });

      test('updating', function() {
        alarm.openForm(alarmItem);

        assert.equal(
          alarm.els.alarmNameInput.getAttribute('value'),
          'coffee break',
          'Alarm name input field is pre-populated with current value'
        );
        assert.hasTime(
          alarm.els.timeInput.getAttribute('value'),
          twentyFromNow,
          'Alarm time input field is pre-populated with current value'
        );

        alarm.els.alarmNameInput.sendKeys([' delayed']);
        client.forms.fill(alarm.els.timeInput, thirtyFromNow);

        alarm.submit();

        alarmItem = alarm.els.alarmListItemS[0];

        assert(
          alarmItem.text().indexOf('coffee break delayed') > -1,
          'Alarm description is updated'
        );
        assert.hasTime(
          alarmItem.text(),
          thirtyFromNow,
          'Alarm time is updated'
        );
        assert(
          alarm.els.countdownBanner.displayed(),
          'Countdown banner is displayed'
        );
      });

      test('toggling', function() {
        alarm.els.alarmEnablerS[0].tap();

        assert(
          !alarm.els.countdownBanner.displayed(),
          'Countdown banner is not displayed after disabling an alarm'
        );

        alarm.els.alarmEnablerS[0].tap();

        client.waitFor(function() {
          return alarm.els.countdownBanner.displayed();
        });
      });

      test('deletion', function() {
        alarm.openForm(alarmItem);
        alarm.els.alarmDeleteBtn.tap();
        client.waitFor(function() {
          return !alarm.els.alarmForm.displayed();
        });
        assert.equal(
          alarm.els.alarmListItemS.length,
          0,
          'deleted alarm is removed from the alarm list'
        );
      });
    });
  });

});
