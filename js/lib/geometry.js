'use strict';

var Geometry = (function() {

  function Geometry(config) {
    var defaults = {
      "fixedCellWidth": 16, // the target dimensions of each cell in THREE.js scene
      "fixedCellHeight": 16,
      "indexOffset": 0
    };
    this.opt = _.extend({}, defaults, config);
    this.init();
  }

  Geometry.prototype.init = function(){
    var _this = this;
    var maxInstancedCount = this.opt.indices.length;
    var imageW = this.opt.textureProps.width;
    var imageH = this.opt.textureProps.height;
    var fixedCellWidth = this.opt.fixedCellWidth;
    var fixedCellHeight = this.opt.fixedCellHeight;
    var cellW = this.opt.textureProps.cellWidth;
    var cellH = this.opt.textureProps.cellHeight;
    var scale = fixedCellWidth / cellW;
    var cols = parseInt(imageW / cellW);
    var rows = parseInt(imageH / cellH);

    var positions = this.getPositions(this.opt.positions);
    // console.log(positions)

    // load geometry
    var planeGeom = new THREE.PlaneBufferGeometry(1, 1);
    var geom = new THREE.InstancedBufferGeometry();
    geom.copy(planeGeom);
    geom.maxInstancedCount = maxInstancedCount;
    var uvAttr = geom.getAttribute('uv');
    uvAttr.needsUpdate = true;
    for (var i = 0; i < uvAttr.array.length; i++) {
      uvAttr.array[i] /= imageW;
    }

    // define the shader attributes topology
    var attributes = [
      {name: 'uvOffset', size: 2},
      {name: 'translate', size: 3},
      {name: 'translateDest', size: 3},
      {name: 'actualSize', size: 3},
      {name: 'scale', size: 3},
      {name: 'color', size: 3},
      {name: 'colorDest', size: 3},
      {name: 'alpha', size: 1},
      {name: 'alphaDest', size: 1},
      {name: 'randSeed', size: 1}
    ];

    this.attributeLookup = {};
    for (var attr of attributes) {
      // allocate the buffer
      var buffer = new Float32Array(geom.maxInstancedCount * attr.size);
      var buffAttr = new THREE.InstancedBufferAttribute(buffer, attr.size, false, 1);
      if( !_.has(attributes, 'isStatic') ){
        buffAttr.setUsage(THREE.DynamicDrawUsage);
      }
      geom.setAttribute(attr.name, buffAttr);
      // and save a reference in the attr dictionary
      this.attributeLookup[attr.name] = buffAttr;
    }

    // set tween and alpha
    var alphaArr = geom.getAttribute('alpha').array;
    var alphaDestArr = geom.getAttribute('alphaDest').array;
    var randArr = geom.getAttribute('randSeed').array;
    var seed = this.opt.seed + this.opt.indexOffset;
    for (var i=0; i<maxInstancedCount; i++) {
      var n = 1.0 * i / maxInstancedCount;
      alphaArr[i] = 0;
      alphaDestArr[i] = 0;
      randArr[i] = MathUtil.lerp(0.5, 1, n); // used for creating item-level variability when transitioning
    }

    // set uv offset
    var uvOffsetArr = geom.getAttribute('uvOffset').array;
    var yt = 1.0/cols;
    for (var i=0; i<maxInstancedCount; i++) {
      var i0 = i*2;
      var y = parseInt(i / cols) / cols;
      var x = (i % cols) / cols;
      uvOffsetArr[i0] = x;
      uvOffsetArr[i0 + 1] = Math.max(1.0-y-yt, 0.0);
    }

    // set translates and colors
    var sizeArr = geom.getAttribute('actualSize').array;
    var scaleArr = geom.getAttribute('scale').array;
    var translateArr = geom.getAttribute('translate').array;
    var translateDestArr = geom.getAttribute('translateDest').array;
    var colorArr = geom.getAttribute('color').array;
    var colorDestArr = geom.getAttribute('colorDest').array;

    for (var i=0; i<maxInstancedCount; i++) {
      var i0 = i*3;

      sizeArr[i0] = cellW * scale;
      sizeArr[i0+1] = cellH * scale;
      sizeArr[i0+2] = 1;
      scaleArr[i0] = scale;
      scaleArr[i0+1] = scale;
      scaleArr[i0+2] = 1;

      translateArr[i0] = positions[i].x;
      translateArr[i0+1] = positions[i].y;
      translateArr[i0+2] = positions[i].z;
      translateDestArr[i0] = positions[i].x;
      translateDestArr[i0+1] = positions[i].y;
      translateDestArr[i0+2] = positions[i].z;

      colorArr[i0] = 1;
      colorArr[i0+1] = 1;
      colorArr[i0+2] = 1;
      colorDestArr[i0] = 1;
      colorDestArr[i0+1] = 1;
      colorDestArr[i0+2] = 1;
    }

    for (var attr of attributes) {
      geom.getAttribute(attr.name).needsUpdate = true
    }

    this.threeGeometry = geom;
  };

  Geometry.prototype.getPositions = function(positionOptions, multiplier) {
    multiplier = multiplier || 1.0;
    // filter and map positions
    var layout = positionOptions.layout;

    // automatically populate values if not set
    if (!positionOptions.values) {
      var arrSize = this.opt.itemCount * 3;
      var values = new Float32Array(arrSize);
      for (var i=0; i<arrSize; i++) {
        values[i] = 0.5;
      }
      positionOptions.values = values;
    }

    var positionSize = parseInt(positionOptions.values.length / this.opt.itemCount);
    var allPositions = _.chunk(positionOptions.values, positionSize);
    var canvasWidth = positionOptions.width ? positionOptions.width : Math.ceil(Math.sqrt(this.opt.itemCount)) * this.opt.fixedCellWidth * 2;
    var canvasHeight = positionOptions.height ? positionOptions.height : Math.ceil(Math.sqrt(this.opt.itemCount)) * this.opt.fixedCellHeight * 2;
    var canvasDepth = positionOptions.depth ? positionOptions.depth : canvasWidth;
    // check for grid options
    if (positionOptions.gridWidth && positionOptions.gridHeight) {
      canvasWidth = positionOptions.gridWidth * this.opt.fixedCellWidth;
      canvasHeight = positionOptions.gridHeight * this.opt.fixedCellHeight;
    }
    if (positionOptions.gridDepth) {
      canvasDepth = positionOptions.gridDepth * fixedCellWidth;
    }

    // console.log('Canvas: ', canvasWidth, canvasHeight, canvasDepth)
    return _.map(this.opt.indices, function(index, i){
      var x = MathUtil.lerp(-canvasWidth/2, canvasWidth/2, allPositions[index][0]);
      var y = MathUtil.lerp(canvasHeight/2, -canvasHeight/2, allPositions[index][1]);
      var z = positionSize > 2 ? MathUtil.lerp(-canvasDepth/2, canvasDepth/2, allPositions[index][2]): 0;
      // var z = positionSize > 2 ? allPositions[index][2] * canvasDepth : 0;
      var ny = allPositions[index][1];
      var isHighlighted = ny > 1; // a bit of a hack

      // random point in sphere if sphere layout
      if (layout === 'spheres') {
        var minRad = canvasHeight/20;
        var maxRad = canvasHeight/2;
        var radius = MathUtil.lerp(minRad, maxRad, ny) * multiplier;
        var newPoint = MathUtil.randomPointInSphere([x, z, 0], radius);
        // if highlighted, place point above sphere
        if (isHighlighted) {
          y = MathUtil.lerp(minRad, maxRad, ny-1) * multiplier;
        } else {
          x = newPoint[0];
          z = newPoint[1];
          y = newPoint[2];
        }

      // random point in cylinder if bar layout
      } else if (layout === 'bars') {
        var minRadius = Math.max(canvasHeight/120, 1);
        var maxRadius = canvasHeight/6;
        var minHeight = Math.max(canvasHeight/60, 1);

        // if is highlighted, place it above the cylinder
        if (isHighlighted) {
          y = MathUtil.lerp(minHeight, canvasHeight, ny-1);

        } else {
          var radius = MathUtil.lerp(minRadius, maxRadius, ny) * multiplier;
          var height = MathUtil.lerp(minHeight, canvasHeight, ny);
          var newPoint = MathUtil.randomPointInCylinder([x, z, 0], radius, height);
          x = newPoint[0];
          z = newPoint[1];
          y = newPoint[2];
        }

      }

      return {
        'x': x,
        'y': y,
        'z': z
      }
    });
  };

  Geometry.prototype.getThree = function(){
    return this.threeGeometry;
  };

  Geometry.prototype.updateAlpha = function(fromAlpha, toAlpha, transitionDuration){
    // console.log(fromAlpha, toAlpha, transitionDuration)
    var fromAttr = this.attributeLookup['alpha'];
    var toAttr = this.attributeLookup['alphaDest'];

    var fromIsNumber = !isNaN(fromAlpha);
    var toIsNumber = !isNaN(toAlpha);

    var alphaArr = fromAttr.array;
    var alphaDestArr = toAttr.array;

    _.each(this.opt.indices, function(index, i){
      if (fromAlpha === false) alphaArr[i] = alphaDestArr[i];
      else if (fromIsNumber) alphaArr[i] = fromAlpha;
      else alphaArr[i] = fromAlpha[index];

      if (toIsNumber) alphaDestArr[i] = toAlpha;
      else alphaDestArr[i] = toAlpha[index];
    });

    fromAttr.needsUpdate = true;
    toAttr.needsUpdate = true;
    renderNeeded = true;
  };

  Geometry.prototype.updatePositions = function(positionOptions, transitionDuration, multiplier){
    // console.log(positionOptions, transitionDuration)
    var fromAttr = this.attributeLookup['translate'];
    var toAttr = this.attributeLookup['translateDest'];

    var translateArr = fromAttr.array;
    var translateDestArr = toAttr.array;
    var positions = this.getPositions(positionOptions, multiplier);
    var maxInstancedCount = this.threeGeometry.maxInstancedCount;

    for (var i=0; i<maxInstancedCount; i++) {
      var i0 = i*3;

      translateArr[i0] = translateDestArr[i0];
      translateArr[i0+1] = translateDestArr[i0+1];
      translateArr[i0+2] = translateDestArr[i0+2];

      translateDestArr[i0] = positions[i].x;
      translateDestArr[i0+1] = positions[i].y;
      translateDestArr[i0+2] = positions[i].z;
    }

    fromAttr.needsUpdate = true;
    toAttr.needsUpdate = true;
    renderNeeded = true;

    return positions;
  };

  return Geometry;

})();
