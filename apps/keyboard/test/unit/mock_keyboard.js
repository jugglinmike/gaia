const LAYOUT_PAGE_DEFAULT = 'Default';
// TODO: Name correctly. (This doesn't mock the keyboard, it mocks the "IM"m
// whatever that is.
// TODO: Make this a class
var MockKeyboard = {
  state: {
    // We accumulate the IM's output here.
    output: '',
    // State we maintain to work with the im
    isUpperCase: false
  },
  // Call this before each test to reset the state to the default
  reset: function() {
    // Convenience alias
    var s = MockKeyboard.state;
    s.output = '';
    s.isUpperCase = false;
  },
  resetUpperCase: function() {

  },
  sendKey: function(keycode) {
    // Convenience alias
    var s = MockKeyboard.state;
    if (keycode === 8) { // backspace
      s.output = s.output.substring(0, s.output.length-1);
    }
    else {
      s.output += String.fromCharCode(keycode);
    }
  },
  sendString: function(s) {
    MockKeyboard.state.output += s;
  },
  sendCandidates: function(words) {
    // gotSuggestions(words);
  },
  setUpperCase: function(uc) {
    MockKeyboard.state.isUpperCase = uc;
  },
  setLayoutPage: function() {

  }
};
