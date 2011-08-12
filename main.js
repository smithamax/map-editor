/*jshint browser: true, jquery: true, white: true, maxerr: 5*/


$(function () {
	var doc = $(document);
	var DRAG_KEY = 32; //Key.SPACE;
	var UNIT = 24;
	var mode = 'edit';
	var hardmode = 'edit';
	var currentTile;


	//UI base element
	function UiListElement() {
		this.domElement = $('<ul>');
		this.onclick = function () {};

		this.addLi = function (content) {
			var li = $('<li>');
			li.append($(content));
			this.domElement.append(li);
			return li;
		};
		var self = this;

		this.domElement.delegate('li', 'click', function (e) {
			$(this).addClass("selected").siblings().removeClass("selected");
			self.onclick.apply(this, e);
		});
	}


	//Minimap
	var minimap = {
		canvas: document.createElement('canvas'),
		viewbox: document.createElement('canvas'),
		redraw: function () {
			this.canvas.width = layers.current.canvas.width / UNIT;
			this.canvas.height = layers.current.canvas.height / UNIT;
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.ctx.save();
			this.ctx.drawImage(layers.current.canvas, 0, 0, this.canvas.width, this.canvas.height);
			this.ctx.restore();
			this.rebox();
		},
		rebox: function () {
			this.viewbox.width = Math.ceil(doc.width() / UNIT);
			this.viewbox.height = Math.ceil(doc.height() / UNIT);
			var ctx = this.viewbox.getContext('2d');

			ctx.clearRect(0, 0, this.viewbox.width, this.viewbox.height);
			ctx.save();
			ctx.strokeStyle = 'red';
			ctx.lineWidth = 1.0;
			ctx.lineJoin = 'miter';
			ctx.rect(0, 0, this.viewbox.width, this.viewbox.height);
			ctx.stroke();
			ctx.restore();

			this.movebox();

		},
		movebox: function () {
			var p = layers.getPos();
			$(this.viewbox).css('position', 'absolute');
			$(this.viewbox).css('left', -p.left / UNIT);
			$(this.viewbox).css('top', -p.top / UNIT);
		}
	};

	minimap.domElement = $('<div id="minimap-box">').css('position', 'relative')
		.append(minimap.canvas)
		.append(minimap.viewbox);
	minimap.ctx = minimap.canvas.getContext('2d');


	function unitify(n) {
		return Math.floor(n / UNIT);
	}

	function Grid() {
		this.grid = {};
	}
	Grid.prototype = {
		addSquare: function (sqr) {
			this.grid[sqr.x + "x" + sqr.y] = sqr;
		},
		squareAt: function (x, y) {
			return this.grid[x + "x" + y];
		},
		removeSquare: function (x, y) {
			delete this.grid[x + "x" + y];
		},
		forEach: function (callback) {
			for (var s in this.grid) {
				callback(this.grid[s], s, this.grid);
			}
		},
		draw: function (ctx) {
			this.forEach(function (sqr) {
				sqr.draw(ctx);
			});
		},
		getArray: function () {
			var minx = 1e99, miny = 1e99, maxx = -1e99, maxy = -1e99;
			var out = [], csqr;
			this.forEach(function (sqr) {
				minx = Math.min(minx, sqr.x);
				miny = Math.min(miny, sqr.y);
				maxx = Math.max(maxx, sqr.x);
				maxy = Math.max(maxy, sqr.y);
			});

			for (var x = 0; x < maxx - minx + 1; x++) {
				/*jshint boss: true*/
				out[x] = [];
				for (var y = 0; y < maxy - miny + 1; y++) {
					if (csqr = this.squareAt(x + minx, y + miny)) {
						out[x][y] = csqr.typeint;
					} else {
						out[x][y] = -1;
					}
				}
			}
			return out;
		},
		toJSON: function () {
			var out = [];
			this.forEach(function (sqr) {
				out.push(JSON.parse(JSON.stringify(sqr, ['x', 'y', 'typeint'])));
			});
			return out;
		}
	};

	// constructor constructor - inception!!
	function Tile() {
		/*jshint sub: true */
		var con = function Square(x, y) {
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
		draw: function (ctx, x, y) {
			x = x || this.x || 0;
			y = y || this.y || 0;
			ctx.save();
			ctx.translate(this.x * UNIT, this.y * UNIT);
			ctx.fillStyle = this.color;
			if (this.img) {
				ctx.drawImage(this.img, 0, 0);
			} else {
				ctx.fillRect(0, 0, UNIT, UNIT);
			}
			ctx.restore();
		},
		color: 'white'
	};

	//tileset
	var tileset = [];

	tileset.ui = new UiListElement();

	tileset.addTile = function (tile) {
		var image;
		tile.typeint = this.length;
		this.push(tile);

		if (tile.img) {
			image = new Image();
			image.src = tile.img.src;
		} else {
			image = document.createElement('canvas');
			image.width = image.height = UNIT;
			tile.draw(image.getContext('2d'));
		}
		this.ui.addLi(image);
		$(image).click(function () {
			currentTile = tile;
			$(this).parent().addClass("selected").siblings().removeClass("selected");
		});
	};
	tileset.importFromImage = function (img) {
		var tile = new Tile();

		tile.img = new Image();
		tile.img.src = img.src;

		this.addTile(tile);
	};

	// Layers
	var layers = (function () {
		var layerList = [];
		var top = 0, left = 0, width, height;
		width = Math.ceil(doc.width() / UNIT) * UNIT;
		height = Math.ceil(doc.height() / UNIT) * UNIT;

		var container = $('<div id="layers-container">');
		container.css('position', 'relative');
		container.css('top', 0).css('left', 0);
		$('#container').append(container);
		var uiList = new UiListElement();

		var pub = {
			addLayer: function (name) {
				var layer;
				var canvas = document.createElement('canvas');
				var ctx = canvas.getContext('2d');

				canvas.width = width;
				canvas.height = height;
				canvas.layerName = name || 'untitled';
				$(canvas).css('position', 'relative');
				$(canvas).css('top', 0).css('left', 0);
				ctx.topleft = {x: left, y: top};

				var li = uiList.addLi(name);
				li.num = layerList.length;
				container.append(canvas);

				layer = {
					canvas: canvas,
					ctx: ctx
				};

				layerList.push(layer);
			},
			ui: {
				list: uiList,
				adder: {domElement: $('<button>')[0]},
				container: container
			},
			show: function (n) {
				$(layerList[n]).removeClass('hidden');
			},
			hide: function (n) {
				$(layerList[n]).addClass('hidden');
			},
			setCurrent: function (n) {
				pub.current = layerList[n];
			},
			current: {},
			addTop: function (topDelta) {
				top -= topDelta;
				height += topDelta;

				layerList.forEach(function (layer) {
					var ctx = layer.ctx;
					var imagedata = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);

					ctx.topleft = {x: left, y: top};
					layer.canvas.height = height;
					ctx.putImageData(imagedata, 0, topDelta);
				});
			},
			addLeft: function (leftDelta) {
				left -= leftDelta;
				width += leftDelta;

				layerList.forEach(function (layer) {
					var ctx = layer.ctx;
					var imagedata = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);

					ctx.topleft = {x: left, y: top};
					layer.canvas.width = width;
					ctx.putImageData(imagedata, leftDelta, 0);
				});
			},
			addBottom: function (bottomDelta) {
				height += bottomDelta;

				layerList.forEach(function (layer) {
					layer.canvas.height = height;
				});
			},
			addRight: function (rightDelta) {
				width += rightDelta;

				layerList.forEach(function (layer) {
					layer.canvas.width = width;
				});
			},
			setPos: function (x, y) {
				container.css('top', y).css('left', x);
				if (pub.autoresize) {
					pub.resize();
				}
			},
			getPos: function () {
				return container.position();
			},
			resize: function () {
				var p = pub.getPos();
				if (p.left > 0) {
					console.log('left');
					pub.addLeft(p.left);
					pub.setPos(0, p.top);
				}
				if (p.top > 0) {
					console.log('top', container.css('top'));
					pub.addTop(p.top);
					pub.setPos(p.left, 0);
				}
				if (doc.width() > width + p.left) {
					console.log('right', doc.width() - (width + p.left));
					pub.addRight(doc.width() - (width + p.left));
				}
				if (doc.height() > height + p.top) {
					console.log('bottom', doc.height() - (height + p.top));
					pub.addBottom(doc.height() - (height + p.top));
				}
				console.log(p.top, p.left, height, width);

			},
			autoresize: true
		};

		uiList.onclick = function () {
			pub.setCurrent(this.num);
		};

		return pub;
	})();

	layers.addLayer('layer1');
	layers.setCurrent(0);
	layers.resize();

	//UI builder
	var UI = {
		tools: {
			tiles: tileset.ui,
			title: "Tools"
		},
		minimap: {
			title: "MINIMAP",
			minimap: minimap
		}
	};

	function setupUI(UI) {
		var $overlay = $("#overlay");
		var id, obj, el, h = 2;

		var process = function (el, obj, id, h) {
			if (obj.domElement) {
				el.append(obj.domElement);
			} else {
				if (obj.title) {
					el.append($('<h' + h + '>' + obj.title + '</h' + h + '>'));
				}
				for (var subid in obj) {
					if (obj[subid] !== obj.title) {
						process(el, obj[subid], subid, h + 1);
					}
				}
			}
		};

		for (id in UI) {
			obj = UI[id];
			if (obj.domElement) {
				el = obj.domElement;
			} else {
				if (obj.title) {
					el = $('<aside id="' + id + '">');
				} else {
					el = $('<div id="' + id + '">');
				}
				process(el, obj, id, h);
			}
			$overlay.append(el);
		}
	}
	setupUI(UI);

	$("#overlay > aside").draggable({ handle: 'h2' });

	var currentGrid = new Grid();
	currentTile = new Tile();
	var blueTile = new Tile();
	blueTile.color = 'blue';
	tileset.addTile(currentTile);
	tileset.addTile(blueTile);

	//click handling
	function doStuffAt(x, y, ctx) {
		ctx.save();
		ctx.translate(-ctx.topleft.x, -ctx.topleft.y);
		if (mode == 'addtile') {
			var newSquare = new currentTile(x, y);
			currentGrid.addSquare(newSquare);
			newSquare.draw(ctx);
		} else if (mode == 'removetile') {
			ctx.clearRect(x * UNIT, y * UNIT, UNIT, UNIT);
			currentGrid.removeSquare(x, y);
		}
		ctx.restore();
	}

	function restoreMode() {
		if (mode != 'drag') {
			mode = hardmode;
			minimap.redraw();
		}
	}
	doc.mousemove(function (e) {
		var pos = layers.getPos();
		var ctx = layers.current.ctx;

		var x = unitify(e.pageX - (pos.left - ctx.topleft.x));
		var y = unitify(e.pageY - (pos.top - ctx.topleft.y));
		if (mode == 'addtile' || mode == 'removetile') {
			doStuffAt(x, y, ctx);
		}

	});

	layers.ui.container.mousedown(function (e) {
		var pos = layers.getPos();
		var ctx = layers.current.ctx;
		console.log(pos, ctx);
		var x = unitify(e.pageX - (pos.left - ctx.topleft.x));
		var y = unitify(e.pageY - (pos.top - ctx.topleft.y));
		if (mode == 'edit') {
			if (currentGrid.squareAt(x, y) === undefined) {
				mode = 'addtile';
			} else {
				mode = 'removetile';
			}
			doStuffAt(x, y, ctx);
		}
	});

	doc.mouseup(restoreMode);
	doc.mouseenter(restoreMode);



	//Drag map

	var fixSize = function (canvas) { //TODO: probably want to break this up
		var p, imagedata, ctx = canvas.getContext('2d'),
		leftDelta, leftmove, leftPos,
		topDelta, topmove, topPos;

		p = $(canvas).offset();

		if (p.left > 0) {
			leftDelta = p.left;
			ctx.topleft.x -= p.left;
			leftmove = p.left;
			leftPos = 0;

		} else {
			if (doc.width() > canvas.width + p.left) {
				leftDelta = doc.width() - (canvas.width + p.left);
			} else {
				leftDelta = 0;
			}
			leftmove = 0;
			leftPos = p.left;
		}

		if (p.top > 0) {
			topDelta = p.top;
			ctx.topleft.y -= p.top;
			topmove = p.top;
			topPos = 0;

		} else {
			if (doc.height() > canvas.height + p.top) {
				topDelta = doc.height() - (canvas.height + p.top);
			} else {
				topDelta = 0;
			}
			topmove = 0;
			topPos = p.top;
		}

		imagedata = ctx.getImageData(0, 0, canvas.width, canvas.height);

		canvas.width = canvas.width + leftDelta;
		canvas.height = canvas.height + topDelta;
		$(canvas).offset({left: leftPos, top: topPos});

		ctx.putImageData(imagedata, leftmove, topmove);
	};

	layers.ui.container.draggable({
		stop: function (e, ui) {
			layers.resize();
			minimap.redraw();
		},
		drag: function () {
			minimap.movebox();
		},
		//cursor: 'move',
		disabled: true
	});

	doc.bind("keydown", function (e) {
		var key = e.keyCode || e.which;

		if (key == DRAG_KEY) {
			layers.ui.container.draggable('enable');
			layers.ui.container.css('cursor', 'move');
			mode = 'drag';
		}
	});

	doc.bind("keyup", function (e) {
		var key = e.keyCode || e.which;

		if (key == DRAG_KEY) {
			layers.ui.container.draggable('disable');
			layers.ui.container.css('cursor', 'default');
			mode = hardmode;
		}
	});

	$(window).resize(function () {
		layers.resize();
	});

	//Exporter
	var exporter = {};

	exporter.getCSV = function (grid) {
		var ary = grid.getArray();
		var out = '';

		if (!ary.length) {
			return '';
		}

		for (var y = 0; y < ary[0].length; y++) {
			for (var x = 0; x < ary.length - 1; x++) {
				out += ary[x][y] + ",";
			}
			out += ary[ary.length - 1][y] + "\n";
		}
		return out;
	};
	exporter.getCSV.ext = ".csv";

	exporter.getJSON = function (grid) {
		return JSON.stringify(grid);
	};
	exporter.getJSON.ext = ".json";

	exporter.getIntArray = function (grid) {
		var ary = grid.getArray();
		var out = "[\n" + JSON.stringify(ary[0]);

		for (var i = 1; i < ary.length; i++) {
			out += ",\n" + JSON.stringify(ary[i]);
		}
		out += "\n]";
		return out;
	};
	exporter.getIntArray.ext = ".array.json";

	exporter.createFile = function (input) { //returns URL
		var MIME_TYPE = 'text/plain';

		window.URL = window.webkitURL || window.URL;
		window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder ||
							window.MozBlobBuilder;

		var bb = new window.BlobBuilder();

		bb.append(input);
		return window.URL.createObjectURL(bb.getBlob(MIME_TYPE));


	};

	exporter.destroyFile = function (url) {
		window.URL.revokeObjectURL(url);
	};

	// this is a massive peice of shit
	// tried to be a smart ass and it kind of worked but mostly sucks
	exporter.createLink = function (grid, stringer) {
		var MIME_TYPE = 'text/plain';

		var makeurl = function () {
			var str = stringer(grid);
			var file = exporter.createFile(str);
			return file;
		};

		document.body.addEventListener('dragstart', function (e) {
			var a = e.target;
			var downloadurl = [MIME_TYPE, a.download, a.href = makeurl()].join(':');
			if (a.classList.contains('dragout')) {
				e.dataTransfer.setData('DownloadURL', downloadurl);
			}
		}, false);

		document.body.addEventListener('dragend', function (e) {
			var a = e.target;
			if (a.classList.contains('dragout')) {
				setTimeout(function () {
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

		a.onclick = function (e) {
			this.href = makeurl();
			setTimeout(function () {
				exporter.destroyFile(this.href);
			}, 1500);
			//return false;
		};
		return a;

	};
	exporter.ui = new UiListElement();
	exporter.ui.addLi(exporter.createLink(currentGrid, exporter.getCSV));
	exporter.ui.addLi(exporter.createLink(currentGrid, exporter.getJSON));
	exporter.ui.addLi(exporter.createLink(currentGrid, exporter.getIntArray));
	$('#tools').append('<h3>exporter<h3>');
	$('#tools').append(exporter.ui.domElement);



});
