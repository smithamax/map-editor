//KeyLib v1

var Key = { 
	_keys:[], LEFT:37, RIGHT:39, UP:38, DOWN:40, BACKSPACE:8, CAPSLOCK:20, CONTROL:17, DELETEKEY:46, 
	END:35, ENTER:13, ESCAPE:27, HOME:36, INSERT:45, TAB:9, PGDN:34, PGUP:33, SPACE:32, SHIFT:16
};

Key.onKeyDown = function () {};
Key.onKeyUp = function () {};

Key.isDown = function (key) {
	return this._keys[key];
};

Key.addListener = function (o) {
	if (typeof o.onKeyDown == "function") document.addEventListener("keydown", o.onKeyDown, false);
	if (typeof o.onKeyUp == "function") document.addEventListener("keyup", o.onKeyUp, false);
};

Key.removeListener = function (o) {
	if (typeof o.onKeyDown == "function") document.removeEventListener("keydown", o.onKeyDown, false);
	if (typeof o.onKeyUp == "function") document.removeEventListener("keyup", o.onKeyUp, false);
};

Key.init = function () {
	if (!document.addEventListener && document.attachEvent) {
		document.addEventListener = function (t, f) {
			document.attachEvent("on"+ t, f);
		};
		document.removeEventListener = function (t, f) {
			document.detachEvent("on"+ t, f);
		};
	}
	document.onkeydown = function (e) {
		e = e?e:event;
		Key._keys[e.keyCode] = true;
		Key.onKeyDown(e);
	};
	document.onkeyup = function (e) {
		e = e?e:event;
		Key._keys[e.keyCode] = false;
		Key.onKeyUp(e);
	};
	for (var num = 0; num < 256; num++) {
		this._keys[num] = false;
	}
};

Key.init();