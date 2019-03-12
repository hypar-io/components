let tmpl = document.createElement('template');
tmpl.innerHTML = `
  <style>
	#view {
		width: 100vw;
		height: 100vh;
		background-image: linear-gradient(whitesmoke, lightgray)
	},
	#info {
		position: absolute;
		left: 0px;
		top: 0px;
		userSelect: "none";
		pointerEvents: "none";
	}
  </style>
  <div id="view"></div>
  <canvas id="info"></canvas>
  <slot></slot>
`;

import {HyparView} from "./HyparView"

export class HyparViewComponent extends HTMLElement {
	get latitude() {
		return parseFloat(this.getAttribute('latitude'))
	}

	set latitude(newValue) {
		this.setAttribute('latitude', newValue)
	}

	get longitude() {
		return parseFloat(this.getAttribute('longitude'));
	}

	set longitude(newValue) {
		this.setAttribute('longitude', newValue)
	}

	get time() {
		return new Date(this.getAttribute('time'));
	}
	
	set time(newValue) {
		this.setAttribute('time', newValue);
	}

	get model() {
		return this.getAttribute('model')
	}

	set model(newValue) {
		this.setAttribute('model', newValue)
	}

	constructor() {
		super();
		let shadowRoot = this.attachShadow({mode: 'open'});
		shadowRoot.appendChild(tmpl.content.cloneNode(true));
	}

	handleDragOver(evt) {
		evt.stopPropagation();
		evt.preventDefault();
		evt.dataTransfer.dropEffect = 'copy';
	}

	connectedCallback() {

		let element = this.shadowRoot.getElementById('view');
		let info = this.shadowRoot.getElementById('info')
		
		let cameraPosition = null
		if(location.hash) {
			cameraPosition = JSON.parse(decodeURIComponent(location.hash.substr(1)))
		}
		this.view = new HyparView(false, null, null, new Date(this.time), [this.longitude, this.latitude], element, info, cameraPosition)
		this.view.loadModelLocal(this.model)
	}

	disconnectedCallback() {

	}

	static get observedAttributes() {
		return ['time','longitude','latitude'];
	}

	attributeChangedCallback(attrName, oldVal, newVal) {
		
		if(this.view && 
			(attrName == 'latitude' || 
			attrName == 'longitude' || 
			attrName == 'time')) {
			this.view.setSunPosition(this.longitude, this.latitude, this.time)
		}

		switch (attrName) {
			case 'time':
			  console.log(`Time value changed from ${oldVal} to ${newVal}`);
			  break;
		  }
	}
}

window.customElements.define('hypar-view', HyparViewComponent);