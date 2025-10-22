import '@testing-library/jest-dom'

// Provide a minimal canvas 2D context and Image stub for tests so
// libraries like matter-js that call `canvas.getContext` don't throw
// "Not implemented" in the default JSDOM environment.
// Always provide a getContext implementation to avoid JSDOM's "Not implemented".
if (typeof HTMLCanvasElement !== 'undefined') {
	// Minimal 2D context mock
	HTMLCanvasElement.prototype.getContext = function (type) {
		if (type !== '2d') return null;
		return {
			// drawing state
			fillStyle: '#000',
			strokeStyle: '#000',
			lineWidth: 1,
			globalAlpha: 1,
			globalCompositeOperation: 'source-over',
			// path methods
			beginPath: () => {},
			closePath: () => {},
			moveTo: () => {},
			lineTo: () => {},
			arc: () => {},
			rect: () => {},
			fill: () => {},
			stroke: () => {},
			fillRect: () => {},
			clearRect: () => {},
			measureText: (text) => ({ width: String(text).length * 6 }),
			// transformations
			translate: () => {},
			rotate: () => {},
			save: () => {},
			restore: () => {},
			setTransform: () => {},
			// image methods
			drawImage: () => {},
			createLinearGradient: () => ({ addColorStop: () => {} }),
			// canvas element reference helpers used by some libs
			canvas: this,
		};
	};
}

// Provide a minimal Image implementation for environments that expect it
if (typeof global !== 'undefined' && typeof (global).Image === 'undefined') {
	// @ts-ignore
	global.Image = class {
		width = 0;
		height = 0;
		onload = null;
		src = '';
		constructor() {
			setTimeout(() => this.onload && this.onload(), 0);
		}
	};
}