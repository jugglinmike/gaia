/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
(function(exports) {
  'use strict';

  function Picker(opts) {
    var context = document.getElementById(opts.context);
    var unit = 'picker-unit';
    var startHour = 0;
    var endHour = 23;
    var hours = [];
    var minutes = [];
    var seconds = [];


    this.hour = null;
    this.minute = null;
    this.second = null;

    this.selector = {
      hour: context.querySelector('.value-picker-hours'),
      minute: context.querySelector('.value-picker-minutes'),
      second: context.querySelector('.value-picker-seconds')
    };

    for (var i = opts.ranges.hour[0]; i < opts.ranges.hour[1]; i++) {
      hours.push(i);
    }

    for (var i = opts.ranges.minute[0]; i < opts.ranges.minute[1]; i++) {
      minutes.push((i < 10) ? '0' + i : i);
    }

    for (var i = opts.ranges.second[0]; i < opts.ranges.second[1]; i++) {
      seconds.push((i < 10) ? '0' + i : i);
    }

    this.hour = new ValuePicker(this.selector.hour, {
      valueDisplayedText: hours,
      className: unit
    });

    this.minute = new ValuePicker(this.selector.minute, {
      valueDisplayedText: minutes,
      className: unit
    });

    this.second = new ValuePicker(this.selector.second, {
      valueDisplayedText: seconds,
      className: unit
    });
  }

  Picker.prototype = {
    get value() {
      var hour = this.hour.getSelectedDisplayedText();
      var minute = this.minute.getSelectedDisplayedText();
      var second = this.second.getSelectedDisplayedText();

      return hour + ':' + minute + ':' + second;
    },

    refresh: function() {
      ['hour', 'minute', 'second'].forEach(function(pick) {
        this[pick].refresh();
      }, this);
    }
  };

  // Picker.init = function() {
  //   var picker = new Picker({
  //     context: 'time-picker',
  //     ranges: {
  //       hour: [0, 24],
  //       minute: [0, 60],
  //       second: [0, 60]
  //     }
  //   });

  //   // this.picker.hour.setSelectedIndex(time.hours);
  //   // this.picker.minute.setSelectedIndex(time.minutes);
  //   // this.picker.second.setSelectedIndex(time.seconds);
  // };

  exports.Picker = Picker;
}(this));
