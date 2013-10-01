/**
 * Transform a nested lookup table according to the provided `transform`
 * function.
 *
 * @param {Object} lookup - The lookup table that maps key names to values.
 * @param {Function} transform - A function that defines how string values in
 *                               `lookup` ought to be modified. Invoked with
 *                               two arguments for every string value:
 *                               1. the value itself
 *                               2. the key at which it is stored
 *
 * Iterate over each key in a given object. If the corresponding value is a
 * string, supply the key and value to the specified `transform` function and
 * use its value in the "mapped" object. Otherwise, recurse into the nested
 * object.
 */
var deepMap = exports.deepMap = function(lookup, transform) {
  var context = {};
  Object.keys(lookup).forEach(function(key) {
    var value = lookup[key];

    if (typeof value !== 'string') {
      context[key] = deepMap(value, transform);
    } else {
      transform.call(context, key, value);
    }
  });
  return context;
};
