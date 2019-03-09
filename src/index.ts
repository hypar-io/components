import { HyparView } from "./HyparView"

function init() {
	console.debug("Initializing Hypar View")

	let element = document.createElement('div');
	document.body.appendChild(element);
	element.id = "view"
	element.style.width = "100vw"
	element.style.height = "100vh"
	element.style.backgroundImage = "linear-gradient(whitesmoke, lightgray)"

	let info = document.createElement('canvas')
	info.className = "info"
	info.style.position = "absolute"
	info.style.left = "0px"
	info.style.top = "0px"
    info.style.userSelect= "none"
    info.style.pointerEvents= "none"
	document.body.appendChild(info)

	element.addEventListener('dragover', handleDragOver, false);
  	element.addEventListener('drop', (evt)=>{
		evt.stopPropagation();
		evt.preventDefault();
		var file = evt.dataTransfer.files[0]
		view.loadModel(file)
	}, false)

	// let token = "your mapbox token"
	// let style = "mapbox://styles/mapbox/light-v9"
	let view = new HyparView("view", false, null, null, new Date(1977,4,12,12,12,12), [-118.0,34.0])
}

function handleDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'copy';
}

init()
  
  