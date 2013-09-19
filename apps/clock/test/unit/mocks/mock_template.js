var Template = function() {
   if (id !== 'picker-unit-tmpl') {
     throw new Error('Only allowed Template is picker-unit-tmpl');
   }
   this.interpolate = sandbox.spy(function(data) {
     return '<div class="picker-unit">' + data.unit + '</div>';
   });
};
