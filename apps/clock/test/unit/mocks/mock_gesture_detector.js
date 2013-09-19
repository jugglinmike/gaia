(function(exports) {
'use strict';

function MockGestureDetector() {
  this.element = element;
  this.startDetecting = sandbox.spy();

  var startDetecting = this.startDetecting = function() {
    startDetecting.called = true;
  };
};

exports.GestureDetector = MockGestureDetector;

}(this));
