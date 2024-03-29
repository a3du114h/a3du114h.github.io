'use strict';

var Mesh = (function() {

  function Mesh(config) {
    var defaults = {
      indexOffset: 0
    };
    this.opt = _.extend({}, defaults, config);
    this.init();
  }

  Mesh.prototype.init = function(){
    var _this = this;

    var geometry = new Geometry({
      'indices': this.opt.indices,
      'indexOffset': this.opt.indexOffset,
      'itemCount': this.opt.itemCount,
      'textureProps': this.opt.textureProps,
      'positions': this.opt.positions
    });
    var material = new Material({
      'texture': this.opt.texture
    });

    var mesh = new THREE.Mesh(geometry.getThree(), material.getThree());
    mesh.frustumCulled = false;
    this.threeMesh = mesh;
    this.geometry = geometry;
    this.material = material;
  };

  Mesh.prototype.getThree = function(){
    return this.threeMesh;
  };

  Mesh.prototype.update = function(now){
    this.material.update(now);
  };

  Mesh.prototype.updateAlpha = function(fromAlpha, toAlpha, transitionDuration){
    this.geometry.updateAlpha(fromAlpha, toAlpha, transitionDuration);
    this.material.transitionAlpha(transitionDuration);
  };

  Mesh.prototype.updatePositions = function(newPositions, transitionDuration, multiplier){
    this.geometry.updatePositions(newPositions, transitionDuration, multiplier);
    this.material.transitionPosition(transitionDuration);
  };

  return Mesh;

})();
