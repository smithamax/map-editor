/*jshint browser: true, jquery: true */


$(function() {
	var layer0 = document.getElementById("layer0");
	var ctx0 = layer0.getContext("2d");
	var $layer0 = $(layer0);
	var doc = $(document);
	var DRAG_KEY = Key.SPACE;
	var UNIT = 24;
	var mode = 'edit';
	var hardmode = 'edit';
	var topleft = {x:0,y:0};
	var currentTile;

	//UI base element
	function UiListElement(){
		this.domElement = $('<ul>');
		this.addLi = function(content) {
			var li = $('<li>');
			li.append($(content));
			this.domElement.append(li);
		};
	}


	//Tiles
	var tiles = [];
	
	tiles.ui = new UiListElement();
	
	tiles.addTile = function(tile){
		var image;
		tile.typeint = this.length;
		this.push(tile);

		if(tile.img){
			image = tile.img;
		}else{
			image = document.createElement('canvas');
			image.width = image.height = UNIT;
			tile.draw(image.getContext('2d'));
		}
		this.ui.addLi(image);
		$(image).click(function() {
			currentTile = tile;
			$(this).parent().addClass("selected").siblings().removeClass("selected");
		});
	};

	//Minimap
	var minimap = {
		canvas: document.createElement('canvas'),
		viewbox: document.createElement('canvas'),
		redraw: function() {
			this.canvas.width = layer0.width/UNIT;
			this.canvas.height = layer0.height/UNIT;
			this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
			this.ctx.save();
			this.ctx.drawImage(layer0,0,0,this.canvas.width,this.canvas.height);
			this.ctx.restore();
			this.rebox();
		},
		rebox: function() {
			this.viewbox.width = Math.ceil(doc.width()/UNIT);
			this.viewbox.height = Math.ceil(doc.height()/UNIT);
			var ctx = this.viewbox.getContext('2d');

			ctx.clearRect(0,0,this.viewbox.width,this.viewbox.height);
			ctx.save();
			ctx.strokeStyle = 'red';
			ctx.lineWidth = 1.0;
			ctx.lineJoin = 'miter';
			ctx.rect(0,0,this.viewbox.width,this.viewbox.height);
			ctx.stroke();
			ctx.restore();

			this.movebox();

		},
		movebox: function(){
			var p = $layer0.offset();
			$(this.viewbox).css('position', 'absolute');
			$(this.viewbox).css('left',-p.left/UNIT);
			$(this.viewbox).css('top',-p.top/UNIT);
		}
	};

	minimap.domElement = $('<div id="minimap-box">').css('position', 'relative')
		.append(minimap.canvas)
		.append(minimap.viewbox);
	minimap.ctx = minimap.canvas.getContext('2d');

	//UI builder
	var UI = {
		tools: {
			tiles:tiles.ui,
			title: "Tools"
		},
		minimap:{
			title:"MINIMAP",
			minimap:minimap
		}
	};

	function setupUI(UI){
		var $overlay = $("#overlay");
		var id, obj, el, h = 2;

		var process = function(el, obj, id, h){
			if(obj.domElement){
				el.append(obj.domElement);
			}else{
				if(obj.title){
					el.append($('<h'+h+'>'+obj.title+'</h'+h+'>'));
				}
				for(var subid in obj){
					if(obj[subid] !== obj.title){
						process(el,obj[subid],subid, h+1);
					}
				}
			}
		};

		for(id in UI){
			obj = UI[id];
			if(obj.domElement){
				el = obj.domElement;
			}else{
				if(obj.title){
					el = $('<aside id="'+id+'">');
				}else{
					el = $('<div id="'+id+'">');
				}
				process(el, obj, id, h);
			}
			$overlay.append(el);
		}
	}
	setupUI(UI);

	$( "#overlay > aside" ).draggable({ handle: 'h2' });

	// size canvas
	layer0.width = doc.width();
	layer0.height = doc.height();


	function unitify (n) {
		return Math.floor(n/UNIT);
	}

	function Grid () {
		this.grid = {};
	}
	Grid.prototype = {
		addSquare: function(sqr) {
			this.grid[sqr.x+"x"+sqr.y] = sqr;
		},
		squareAt: function(x,y){
			return this.grid[x+"x"+y];
		},
		removeSquare: function(x,y){
			delete this.grid[x+"x"+y];
		},
		forEach: function(callback) {
			for(var s in this.grid){
				callback(this.grid[s],s,this.grid);
			}
		},
		draw: function(ctx){
			this.forEach(function(sqr) {
				sqr.draw(ctx);
			});
		},
		getArray: function() {
			var minx = 1e99, miny = 1e99, maxx = -1e99, maxy = -1e99;
			var out = [], csqr;
			this.forEach(function(sqr) {
				minx = Math.min(minx,sqr.x);
				miny = Math.min(miny,sqr.y);
				maxx = Math.max(maxx,sqr.x);
				maxy = Math.max(maxy,sqr.y);
			});

			for (var x = 0; x < maxx - minx +1; x++) {
				/*jshint boss: true*/
				out[x] = [];
				for (var y = 0; y < maxy - miny +1; y++) {
					if(csqr = this.squareAt(x+minx,y+miny)){
						out[x][y] = csqr.typeint;
					}else{
						out[x][y] = -1;
					}
				}
			}
			return out;
		},
		toJSON: function() {
			var out = [];
			this.forEach(function(sqr) {
				out.push(JSON.parse(JSON.stringify(sqr,['x','y','typeint'])));
			});
			return JSON.stringify(out).replace(/\}\,/g,"},\n");
		}
	};
	// constructor constructor - inception!!
	function Tile() {
		/*jshint sub: true */
		var con = function Square(x,y) {
			this.x = x;
			this.y = y;
			this.img = undefined;
		};
		// so __proto__ is kinda evil I know,
		// if you dont want to use it you can use
		// Object.create(Tile.prototype);
		// instead of the next two lines
		// you will lose the ability to call myTile.draw()
		con.prototype = con;
		con['__proto__'] = Tile.prototype; 

		return con;
	}
	Tile.prototype = {
		draw: function(ctx,x,y){
			x = x || this.x || 0;
			y = y || this.y || 0;
			ctx.save();
			ctx.translate(this.x*UNIT,this.y*UNIT);
			ctx.fillStyle = this.color;
			if(this.img){
				ctx.drawImage(this.img,0,0);
			}else{
				ctx.fillRect(0,0,UNIT,UNIT);
			}
			ctx.restore();
		},
		color: 'white'
	};

	var currentGrid = new Grid();
	currentTile = new Tile();
	var blueTile = new Tile();
	blueTile.color = 'blue';
	tiles.addTile(currentTile);
	tiles.addTile(blueTile);

	//click handling
	function doStuffAt(x,y){
		ctx0.save();
		ctx0.translate(-topleft.x,-topleft.y);
		if(mode == 'addtile'){
			var newSquare = new currentTile(x,y);
			currentGrid.addSquare(newSquare);
			newSquare.draw(ctx0);
		}else if(mode == 'removetile'){
			ctx0.clearRect(x*UNIT,y*UNIT,UNIT,UNIT);
			currentGrid.removeSquare(x,y);
		}
		ctx0.restore();
	}

	function restoreMode () {
		if(mode != 'drag'){
			mode = hardmode;
			minimap.redraw();
		}
	}
	doc.mousemove(function(e) {
		var pos = $layer0.offset();
		var x = unitify(e.pageX - (pos.left-topleft.x));
		var y = unitify(e.pageY - (pos.top-topleft.y));
		if(mode == 'addtile' || mode == 'removetile'){
			doStuffAt(x,y);
		}

	});

	$layer0.mousedown(function(e) {
		var pos = $layer0.offset();
		var x = unitify(e.pageX - (pos.left-topleft.x));
		var y = unitify(e.pageY - (pos.top-topleft.y));	
		if (mode == 'edit'){
			if(currentGrid.squareAt(x,y) === undefined){
				mode = 'addtile';
			}else{
				mode = 'removetile';
			}
			doStuffAt(x,y);
		}
	});

	doc.mouseup(restoreMode);
	doc.mouseenter(restoreMode);



	//Drag map

	var fixSize = function (){ //TODO: probably want to break this up
		var p, imagedata,
		leftDelta, leftmove, leftPos,
		topDelta, topmove, topPos;

		p = $layer0.offset();
		
		if(p.left > 0){
			leftDelta = p.left;
			topleft.x -= p.left;
			leftmove = p.left;
			leftPos = 0;
		}else{
			if (doc.width() > layer0.width + p.left){
				leftDelta = doc.width() - (layer0.width + p.left);
			}else{
				leftDelta = 0;
			}
			leftmove = 0;
			leftPos = p.left;
		}

		if(p.top > 0){
			topDelta = p.top;
			topleft.y -= p.top;
			topmove = p.top;
			topPos = 0;
		}else{
			if (doc.height() > layer0.height + p.top){
				topDelta = doc.height() - (layer0.height + p.top);
			}else{
				topDelta = 0;
			}
			topmove = 0;
			topPos = p.top;
		}

		imagedata = ctx0.getImageData(0, 0, layer0.width, layer0.height);

		layer0.width = layer0.width + leftDelta;
		layer0.height = layer0.height + topDelta;
		$layer0.offset({left:leftPos,top:topPos});

		ctx0.putImageData(imagedata, leftmove, topmove);
	};

	$layer0.draggable({
		stop: function(e, ui){
			fixSize();
			minimap.redraw();
		},
		drag: function(){
			minimap.movebox();
		},
		//cursor: 'move',
		disabled: true
	});

	doc.bind("keydown", function(e) {
		var key = e.keyCode || e.which;
		if(key == DRAG_KEY){
			$layer0.draggable('enable');
			$layer0.css( 'cursor', 'move' );
			mode = 'drag';
		}
	});

	doc.bind("keyup", function(e) {
		var key = e.keyCode || e.which;
		if(key == DRAG_KEY){
			$layer0.draggable('disable');
			$layer0.css( 'cursor', 'default' );
			mode = hardmode;
		}
	});

	$(window).resize(fixSize);

	//Exporter
	var exporter = {};
	
	exporter.getCSV = function(grid) {
		var ary = grid.getArray();
		var out = '';
		for (var x = 0; x < ary.length; x++) {
			for (var y = 0; y < ary[x].length-1; y++) {
				out += ary[x][y] +",";
			}
			out += ary[x][ary[x].length-1]+"\n";
		}
		return out;
	};
	exporter.getCSV.ext = ".csv";

	exporter.getJSON = function(grid) {return JSON.stringify(grid);};
	exporter.getJSON.ext = ".json";

	exporter.getIntArray = function(grid) {
		var ary = grid.getArray();
		var out = "[\n" + JSON.stringify(ary[0]);

		for (var i = 1; i < ary.length; i++) {
			out += ",\n" + JSON.stringify(ary[i]);
		}
		out += "\n]";
		return out;
	};
	exporter.getIntArray.ext = ".array.json";

	exporter.createFile = function(input) { //returns URL
		var MIME_TYPE = 'text/plain';
		
		window.URL = window.webkitURL || window.URL;
		window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder ||
							window.MozBlobBuilder;
	
		var bb = new BlobBuilder();
		bb.append(input);
		return window.URL.createObjectURL(bb.getBlob(MIME_TYPE));
	
		
	};

	exporter.destroyFile = function(url) {
		window.URL.revokeObjectURL(url);
	};
	exporter.createLink = function(grid, stringer) {
		var MIME_TYPE = 'text/plain';

		var makeurl = function(){
			var str = stringer(grid);
			var file = exporter.createFile(str);
			return file;
		};
		
		document.body.addEventListener('dragstart', function(e) {
			var a = e.target;
			var downloadurl = [MIME_TYPE, a.download, a.href = makeurl()].join(':');
			if (a.classList.contains('dragout')) {
				e.dataTransfer.setData('DownloadURL', downloadurl);
			}
		}, false);
		 
		document.body.addEventListener('dragend', function(e) {
			var a = e.target;
			if (a.classList.contains('dragout')) {
				setTimeout(function() {
					exporter.destroyFile(a.href);
				}, 1500);
			}
		}, false);
		
		var a = document.createElement('a');
		a.download = (grid.name || 'map') + stringer.ext;
		a.href = a.download;
		a.textContent = a.download;
		a.draggable = true; // Don't really need, but good practice.
		a.classList.add('dragout');
	
		a.onclick = function(e) {
			this.href = makeurl();
			setTimeout(function() {
				exporter.destroyFile(this.href);
			}, 1500);
			//return false;
		};

		return a;
	};
	exporter.ui = new UiListElement();
	exporter.ui.addLi(exporter.createLink(currentGrid,exporter.getCSV));
	exporter.ui.addLi(exporter.createLink(currentGrid,exporter.getJSON));
	exporter.ui.addLi(exporter.createLink(currentGrid,exporter.getIntArray));
	$('#tools').append('<h3>exporter<h3>');
	$('#tools').append(exporter.ui.domElement);



});
