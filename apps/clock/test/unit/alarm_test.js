if (typeof asyncStorage === 'undefined') {
  require('/shared/js/async_storage.js');
}

if (typeof loadBodyHTML === 'undefined') {
  require('/shared/test/unit/load_body_html_helper.js');
}

requireApp('clock/js/alarmsdb.js');
requireApp('clock/js/alarm_edit.js');
requireApp('clock/js/alarm_list.js');
requireApp('clock/js/alarm_manager.js');
requireApp('clock/js/utils.js');

requireApp('clock/test/unit/mocks/mock_alarm_list.js');
requireApp('clock/test/unit/mocks/mock_alarm_manager.js');
requireApp('clock/test/unit/mocks/mock_asyncstorage.js');
requireApp('clock/test/unit/mocks/mock_navigator_mozl10n.js');


suite('AlarmEditView', function() {
  var al, am, nml;
  var id = 1;

  suiteSetup(function() {
    al = AlarmList;
    am = AlarmManager;
    nml = navigator.mozL10n;

    AlarmList = MockAlarmList;
    AlarmManager = MockAlarmManager;
    navigator.mozL10n = MockmozL10n;

    loadBodyHTML('/index.html');
  });

  suiteTeardown(function() {
    AlarmList = al;
    AlarmManager = am;
    navigator.mozL10n = nml;
  });


  setup(function() {
    // shim the edit alarm view
    delete AlarmEdit.labelInput;
    AlarmEdit.labelInput = document.createElement('input');
    delete AlarmEdit.timeSelect;
    AlarmEdit.timeSelect = document.createElement('input');
    AlarmEdit.initTimeSelect();


    this.sinon.stub(AlarmEdit, 'getSoundSelect');
    this.sinon.stub(AlarmEdit, 'getVibrateSelect');
    this.sinon.stub(AlarmEdit, 'getSnoozeSelect');
    this.sinon.stub(AlarmEdit, 'getRepeatSelect');

    this.sinon.stub(AlarmManager, 'toggleAlarm');

    this.sinon.stub(AlarmManager, 'putAlarm', function(alarm, callback) {
      alarm.id = id++;
      callback(alarm);
    });

    this.sinon.stub(AlarmManager, 'delete', function(alarm, callback) {
      callback(alarm);
    });

    AlarmEdit.alarm = AlarmEdit.getDefaultAlarm();

    // Define the stubs to return the same values set in the
    // default alarm object.
    AlarmEdit.getSoundSelect.returns(AlarmEdit.alarm.sound);
    AlarmEdit.getVibrateSelect.returns(AlarmEdit.alarm.vibrate);
    AlarmEdit.getSnoozeSelect.returns(AlarmEdit.alarm.snooze);
    AlarmEdit.getRepeatSelect.returns(AlarmEdit.alarm.repeat);
  });

  test('should save and delete an alarm', function(done) {
    this.sinon.stub(AlarmList, 'refresh');

    AlarmEdit.save(function(alarm) {
      assert.ok(alarm.id);
      assert.ok(AlarmList.refresh.calledOnce);
      assert.ok(AlarmManager.putAlarm.calledOnce);
      assert.ok(AlarmManager.toggleAlarm.calledOnce);

      AlarmEdit.alarm = alarm;
      AlarmEdit.element.dataset.id = alarm.id;

      AlarmEdit.delete(function() {
        assert.ok(AlarmList.refresh.calledTwice);
        done();
      });
    });
  });

  test('should add an alarm with sound, no vibrate', function(done) {
    this.sinon.stub(AlarmList, 'refresh');

    // mock the view to turn off vibrate
    AlarmEdit.getVibrateSelect.returns(0);
    AlarmEdit.save(function(alarm) {
      assert.ok(alarm.id);
      assert.ok(AlarmList.refresh.calledOnce);
      assert.ok(AlarmManager.putAlarm.calledOnce);
      assert.ok(AlarmManager.toggleAlarm.calledOnce);


      assert.equal(alarm.vibrate, 0);
      assert.notEqual(alarm.sound, 0);

      done();
    });
  });

  test('should update existing alarm with no sound, vibrate', function(done) {
    this.sinon.stub(AlarmList, 'refresh');

    // mock the view to turn sound on and vibrate off
    AlarmEdit.getVibrateSelect.returns(0);
    AlarmEdit.save(function(alarm) {
      assert.ok(alarm.id);
      assert.ok(AlarmList.refresh.calledOnce);
      assert.ok(AlarmManager.putAlarm.calledOnce);
      assert.ok(AlarmManager.toggleAlarm.calledOnce);

      AlarmEdit.getVibrateSelect.returns(1);
      AlarmEdit.getSoundSelect.returns(0);

      AlarmEdit.alarm = alarm;
      AlarmEdit.element.dataset.id = alarm.id;

      AlarmEdit.save(function(alarm) {
        assert.ok(alarm.id);
        assert.ok(AlarmList.refresh.calledTwice);
        assert.ok(AlarmManager.putAlarm.calledTwice);
        assert.ok(AlarmManager.toggleAlarm.calledTwice);

        assert.equal(alarm.vibrate, 1);
        assert.equal(alarm.sound, 0);
        done();
      });
    });
  });
});
