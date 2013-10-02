var Clock = require('./clock');

function Stopwatch(client) {
  Clock.apply(this, arguments);
}

module.exports = Stopwatch;

Stopwatch.prototype = Object.create(Clock.prototype);

Stopwatch.prototype.launch = function() {
  Clock.prototype.launch.call(this);
  this.navigate('stopwatch');
};
