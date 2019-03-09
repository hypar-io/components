import * as THREE from "three"
import * as JSZip from "jszip"
import { Vector3, PerspectiveCamera, WebGLRenderer, Scene, LoadingManager, Box3, Raycaster, Sphere, PlaneGeometry } from 'three'
import { Model, Parameter } from "./Model"
import { MapboxUtilities } from "./MapboxUtilities"
import { ColorScale } from "./ColorScale"

let SunCalc = require("suncalc")

// Set the THREE global. Required for things like OrbitControls.
let w: any = window
w.THREE = THREE
let oc = require("../node_modules/three/examples/js/controls/OrbitControls.js")
let gltf = require("../node_modules/three/examples/js/loaders/GLTFLoader.js")

export class HyparView {
	private _camera: PerspectiveCamera
	private _scene: Scene
	private _gltfScene: Scene
	private _mapScene: Scene
	private _renderer: WebGLRenderer
	private _controls: any
	private _container: HTMLElement
	private _directionalLight: THREE.DirectionalLight
	private _enableShadows = true
	private _showLightHelpers = false
	private _showAxes = false
	private _hasBeenFit = false
	private _mousedown = 0
	private _navigating = false
	private _info = <HTMLCanvasElement>document.getElementsByClassName("info")[0]
	private _onScreenUpdate: any
	private _labelParameter = ""
	private _loadTopography = false
	private _bounds: Sphere
	private _mapboxStyleUrl: string
	private _mapboxAccessToken: string
	private _origin: [number,number]
	private _defaultDate: Date
	private _maxAllowableSlope = 45.0
	private _groundTiles: THREE.Mesh[][]

	/**
	 * The model associated with the view.
	 */
	model: Model

	/**
	 * Construct a 3D view for visualizing a model.
	 * @param uid The id of the div in which to place the view.
	 * @param loadTopography Should topography be loaded?
	 * @param mapboxAccessToken A mapbox access token for loading location data.
	 * @param mapboxStyleUrl A mapbox style url for loading location data.
	 * @param defaultDate The date used to set the sun's default position.
	 * @param origin The world origin of the model. Described as [longitude,latitude]
	 */
	constructor(uid: string,
		loadTopography: boolean,
		mapboxAccessToken: string,
		mapboxStyleUrl: string,
		defaultDate: Date,
		origin: [number,number]) {

		this.initScene(uid)
		this.animate()

		this._mapboxAccessToken = mapboxAccessToken
		this._mapboxStyleUrl = mapboxStyleUrl
		this._loadTopography = loadTopography;
		this._info.height = this._container.clientHeight
		this._info.width = this._container.clientWidth
		this._defaultDate = defaultDate
		this._origin = origin

		this.addEventListeners()

		this._mapScene = new Scene()
		this._scene.add(this._mapScene)
	}

	/**
	 * Set the position of the sun.
	 * @param longitude The longitude of the site.
	 * @param latitude The latitude of the site.
	 * @param dayPercent The percentage of the day between 0.0 and 1.0 from sunrise to sunset.
	 * @param date The date.
	 */
	setSunPosition(longitude: number, latitude: number, date: Date, dayPercent: number) {
		let d = this._bounds.radius
		let center = this._bounds.center
		let r = this._bounds.radius

		if (this._enableShadows) {
			this._directionalLight.shadow.camera.left = -d
			this._directionalLight.shadow.camera.right = d
			this._directionalLight.shadow.camera.top = d
			this._directionalLight.shadow.camera.bottom = -d
			this._directionalLight.shadow.camera.near = 1
			this._directionalLight.shadow.camera.far = 1000
			this._directionalLight.shadow.bias = -0.00001
			let map: any = this._directionalLight.shadow.map
			map.dispose()
			this._directionalLight.shadow.map = null
		}

		let times = SunCalc.getTimes(date, latitude, longitude)

		let time = new Date(times.sunrise.getTime() + (times.sunset.getTime() - times.sunrise.getTime()) * dayPercent)
		let sunPosition = SunCalc.getPosition(time, latitude, longitude)

		// https://www.mathworks.com/help/phased/ug/spherical-coordinates.html
		// We correct the angle here as SunCalc measures azimuth from S to W.
		let x = r * Math.cos(sunPosition.altitude) * Math.cos(Math.PI / 2 + sunPosition.azimuth)
		let y = r * Math.cos(sunPosition.altitude) * Math.sin(Math.PI / 2 + sunPosition.azimuth)
		let z = r * Math.sin(sunPosition.altitude)

		this._directionalLight.position.set(center.x + x, center.y + z, center.z + y)
		this._directionalLight.target.position.set(center.x, center.y, center.z)
	}

	/**
	 * Set the maximum allowable slope.
	 * @param angle The maximum allowable slope.
	 */
	setMaxAllowableSlope(angle: number)
	{
		this._maxAllowableSlope = angle
		this.setSlopeAngleColoring()
	}

	/**
	 * Load a glTF model.
	 * @param modelData A binary blob containing the model data.
	 */
	loadModel = (modelData: Blob) => {
		let z = new JSZip()
		z.loadAsync(modelData, { base64: false }).then((contents: JSZip) => {
			Promise.all([
				contents.files["model0.glb"].async("blob")
			]).then((result) => {
				let blobs = new Map<string, Blob>()
				blobs.set("model0.glb", new Blob([result[0]]))

				let objectURLs = new Array<string>()
				let manager: any = new LoadingManager()
				manager.setURLModifier((url) => {
					url = w.URL.createObjectURL(blobs.get(url))
					objectURLs.push(url)
					return url
				})

				let loader = new w.THREE.GLTFLoader(manager)
				loader.load(
					"model0.glb",
					(gltf) => {

						let scene = gltf.scene

						scene.traverse((o) => {
							if (o instanceof THREE.Object3D) {
								if (o instanceof THREE.Mesh && (<THREE.Material>o.material).opacity == 1.0) {
									if (this._enableShadows) {
										o.castShadow = true
										o.receiveShadow = true
									}
								}
							}
						})

						let box = new Box3().setFromObject(scene)

						if (!this._hasBeenFit) {
							this.zoomToFit(box)
							this._hasBeenFit = true
						}

						this._bounds = new Sphere().setFromPoints([box.min, box.max])
						this.setDefaultSunPosition()

						objectURLs.forEach((url) => w.URL.revokeObjectURL(url))

						this._gltfScene = scene
						this._scene.add(this._gltfScene)
						
						let event = new CustomEvent('model-loaded', { detail: 'The model has been loaded.' })

						if (this._loadTopography) {
							let tileIds = null
							let zoom = 17
							if (this._loadTopography) {
								tileIds = MapboxUtilities.getTileIdsForPosition(this._origin, zoom, 3)
							} else {
								tileIds = MapboxUtilities.getTileIdsForPosition(this._origin, zoom, 5)
							}
							let sideLength = MapboxUtilities.getTileSizeMeters(zoom)
							let originTile = (tileIds.length - 1) / 2
							let offset = MapboxUtilities.getOffsetFromCenterToPointMeters(tileIds[originTile][0], tileIds[originTile][1], this._origin, zoom)
							let resolutionExponent = 3
							this.loadMapTiles(this._mapScene, zoom, tileIds, sideLength, offset, 512, resolutionExponent).then(()=>{
								console.debug("Dispatching model loaded event after map tile load.")
								document.dispatchEvent(event)
							}).catch((reason)=>{
								console.debug(reason)
							})
						} else {
							console.debug("Dispatching model loaded event after model load.")
							document.dispatchEvent(event)
						}

						
						this.drawLabels(this._labelParameter)
					},
					(xhr: { loaded: number; total: number; }) => {
						console.log((xhr.loaded / xhr.total * 100) + '% loaded')
					},
					(error: any) => {
						console.warn(error)
					}
				)
			})
		})
	}

	/**
	 * Dispose all scene assets.
	 */
	dispose() {
		if (this._gltfScene) {
			//Cleanup the previous scene
			this._scene.remove(this._gltfScene)
			this._gltfScene.traverse((o: any) => {
				if (o.hasOwnProperty("geometry")) {
					o.geometry.dispose()
					if (o.material) {
						// This cast to any is simply to avoid 
						// a skew in the type declarations and three v.0.93
						let mat: any = o.material
						mat.dispose()
					}
				}
			})
		}

		if (this._mapScene) {
			this._mapScene.traverse((o: any) => {
				if (o.hasOwnProperty("geometry")) {
					o.geometry.dispose()
					if (o.material) {
						// This cast to any is simply to avoid 
						// a skew in the type declarations and three v.0.93
						let mat: any = o.material
						mat.dispose()
					}
				}
			})
		}
	}

	/**
	 * Display labels for every element with the selected property.
	 * @param property The property for which to display labels.
	 */
	displayLabelsForProperty(property: string) {
		this._labelParameter = property
		this.drawLabels(this._labelParameter)
	}

	private setDefaultSunPosition() {
		this.setSunPosition(this._origin[0], this._origin[1], this._defaultDate, 0.65)
	}

	private addEventListeners() {
		// Tracking mouse events to disambiguate events that
		// are related to orbiting and panning, and selection events.
		this._container.addEventListener('mousedown', () => {
			++this._mousedown
			this._navigating = this._mousedown > 0 ? true : false
			this._info.className = "info"
		})
		this._container.addEventListener('mouseup', () => {
			--this._mousedown
			this._navigating = this._mousedown > 0 ? true : false
			this.drawLabels(this._labelParameter)
		})
		this._container.addEventListener('mousemove', () => {
			this._navigating = this._mousedown > 0 ? true : false
		})
		this._container.addEventListener('wheel', () => {
			this.drawLabels(this._labelParameter)
		})
	}

	private initScene = (uid: string) => {
		// dom
		let div = document.getElementById(uid)
		if (!div) {
			throw "Could not find the scene element."
		}
		this._container = div

		this._camera = new PerspectiveCamera(70, this._container.clientWidth / this._container.clientHeight, 1.0, 500000.0)

		// controls
		let test:any = THREE
		this._controls = new test.OrbitControls(this._camera, this._container)
		this._controls.rotateSpeed = 2.0
		this._controls.zoomSpeed = 1.2
		this._controls.enableZoom = true
		this._controls.enablePan = true
		this._controls.addEventListener('change', this.render)
		this._controls.update()
		this._controls.screenSpacePanning = true

		// scene
		this._scene = new Scene()

		this._renderer = new WebGLRenderer({ antialias: true, alpha: true })
		this._renderer.physicallyCorrectLights = true
		this._renderer.gammaInput = true
		this._renderer.gammaOutput = true
		this._renderer.gammaFactor = 2.2
		this._renderer.toneMappingExposure = 1.2

		this._renderer.setSize(this._container.clientWidth, this._container.clientHeight)

		this._renderer.shadowMap.enabled = true
		// this._renderer.shadowMap.type = THREE.BasicShadowMap // default 
		this._renderer.shadowMap.type = THREE.PCFShadowMap

		// Lights
		this.createLights()

		if (this._showAxes) {
			let axesHelper = new THREE.AxesHelper(10000)
			this._scene.add(axesHelper)
		}

		this._container.appendChild(this._renderer.domElement)

		window.addEventListener('resize', this.onWindowResize, false)
	}

	private createLights() {

		let ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.3)
		this._scene.add(ambientLight)

		let light = new THREE.DirectionalLight(0xFFFFFF, 2.0)// 0.8 * Math.PI)
		// let light = new THREE.DirectionalLight(0xFFFFFF, 0.8)

		this._scene.add(light)
		this._scene.add(light.target)

		if (this._enableShadows) {
			light.castShadow = true
			light.shadow.mapSize.width = 2048
			light.shadow.mapSize.height = 2048

			let d = 50
			light.shadow.camera.left = -d
			light.shadow.camera.right = d
			light.shadow.camera.top = d
			light.shadow.camera.bottom = -d
			light.shadow.camera.far = 200
			light.shadow.camera.near = 1
			if (this._showLightHelpers) {
				var helper = new THREE.CameraHelper(light.shadow.camera)
				this._scene.add(helper)
			}
		}

		if (this._showLightHelpers) {
			let dirLightHeper = new THREE.DirectionalLightHelper(light, 1)
			this._scene.add(dirLightHeper)
		}

		this._directionalLight = light
		this._directionalLight.position.set(20, 20, 10)
		this._directionalLight.target.position.set(0, 0, 0)
	}

	private onWindowResize = () => {
		let width = this._container.clientWidth
		let height = this._container.clientHeight
		this._camera.aspect = width / height
		this._camera.updateProjectionMatrix()
		this._renderer.setSize(width, height)
		this.render()
		this._info.height = height
		this._info.width = width
		this.drawLabels(this._labelParameter)
	}

	private animate = () => {
		requestAnimationFrame(this.animate)
		this._controls.update()
		this.render()
	}

	private render = () => {
		this._renderer.render(this._scene, this._camera)
	}

	private zoomToFit(box: Box3) {
		let sphere = new Sphere().setFromPoints([box.min, box.max])
		let r = sphere.radius * 1.25
		let center = sphere.center

		let halfFovRad = ((70 / 2) * Math.PI) / 180
		let far = r / Math.tan(halfFovRad)

		let cx = r * Math.cos(Math.PI / 4) * Math.sin(Math.PI / 4)
		let cy = r * Math.sin(Math.PI / 4) * Math.sin(Math.PI / 4)
		let cz = r * Math.cos(Math.PI / 4)

		this._camera.position.set(cx + center.x, cy + center.y, cz + center.z)
		this._camera.lookAt(center)
		let camDir = new Vector3()
		this._camera.getWorldDirection(camDir)
		this._camera.translateZ(far - r)

		this._controls.target = center
		this._controls.saveState()
	}

	private loadMapTiles(scene: THREE.Scene, 
		zoom: number, 
		tileIds: Array<[number, number]>, 
		tileSideLength: number, 
		offset: [number, number], 
		imageSize: number,
		resolutionExponent: number): Promise<void> {
		
		return new Promise((resolve,reject)=>{
			let originTile = tileIds[(tileIds.length - 1) / 2]
			let resolution = Math.pow(2, resolutionExponent)
			let w = imageSize / resolution
			let h = imageSize / resolution

			// Style url will be of the form mapbox://styles/ikeough/cjge9pg0l00172snp0nn21889
			// Get just the last two components
			var styleId = this._mapboxStyleUrl.split('mapbox://styles/')[1]
			
			this._groundTiles = this.createGroundTiles(Math.sqrt(tileIds.length), tileSideLength, w, h, this._loadTopography)

			let promises = []
			tileIds.forEach(id => {
				let loadPromise = this.loadMapTile(id, tileSideLength, originTile, 
					zoom, scene, offset, imageSize, styleId, tileIds.length).then((p:THREE.Mesh)=>{
					if(this._loadTopography){
						return this.loadTopographyForTile(zoom, id, p, this._mapboxAccessToken, this._mapboxStyleUrl, resolutionExponent)
					}
					return loadPromise
				})
				promises.push(loadPromise)
			})
			Promise.all(promises).then((results)=>{
				this.setTileElevations()
				this.sewTileEdges()
				resolve()
			}).catch((error)=>{
				reject(error)
			})
		})
	}

	private loadMapTile(id: [number,number], 
		tileSideLength: number, 
		originTile: [number,number], 
		zoom: number, 
		scene: THREE.Scene, 
		offset: [number, number],
		imageSize:number,
		styleId:string,
		tileCount:number) : Promise<THREE.Mesh>
	{
		return new Promise((resolve,reject)=>{
			let loader = new THREE.TextureLoader()

			// Load a style as a raster tile
			let imageTileUrl = `https://api.mapbox.com/styles/v1/${styleId}/tiles/${imageSize}/${zoom}/${id[0]}/${id[1]}@2x?access_token=${this._mapboxAccessToken}`

			loader.load(imageTileUrl, (imageTexture: THREE.Texture) => {
				// let tileMaterial = new THREE.MeshLambertMaterial({ map: imageTexture, vertexColors: THREE.VertexColors })
				let tileMaterial = new THREE.MeshPhongMaterial({map: imageTexture, vertexColors: THREE.VertexColors, shininess: 0})
				
				// Find the offset to the center
				let idxOffset = (Math.sqrt(tileCount)-1)/2
				let plane = this._groundTiles[id[0] - originTile[0] + idxOffset][id[1] - originTile[1] + idxOffset]
				plane.material = tileMaterial

				// Adjust the plane for Z Up
				plane.setRotationFromAxisAngle(new Vector3(1, 0, 0), - Math.PI / 2.0)

				let lonOffset = id["0"] - originTile["0"]
				let latOffset = id["1"] - originTile["1"]

				// TODO: Figure out why offset X needs to be negative.
				plane.position.set((lonOffset * tileSideLength) - offset[0], 0, (latOffset * tileSideLength) + offset[1])
				plane.receiveShadow = true
				scene.add(plane)

				resolve(plane)
			})
		})
	}

	private createGroundTiles(width: number, tileSideLength: number, tileImageWidth: number, 
		tileImageHeight: number, loadTopography: boolean): Array<Array<THREE.Mesh>>{
		let tiles = new Array<Array<THREE.Mesh>>()
		for(let i=0; i<width; i++){
			let row = new Array<THREE.Mesh>()
			for(let j=0; j<width; j++)
			{
				let plane: PlaneGeometry
				if (loadTopography) {
					// Create a plane with enough grid divisions to support
					// topography displacement.
					plane = new THREE.PlaneGeometry(tileSideLength, tileSideLength, tileImageWidth - 1, tileImageHeight - 1)
				} else {
					// Create a plane with only one grid cell.
					plane = new THREE.PlaneGeometry(tileSideLength, tileSideLength)
				}
				let tile = new THREE.Mesh(plane)
				tile.frustumCulled = false
				row.push(tile)
			}
			tiles.push(row)
		}
		return tiles
	}

	private loadTopographyForTile(zoom: number, 
		id: [number, number], 
		mesh: THREE.Mesh, 
		accessToken: string, 
		styleId: string, 
		resolutionExponent: number) : Promise<THREE.PlaneGeometry>{

		let topoMapId = "mapbox.terrain-rgb"
		let geom = <PlaneGeometry>mesh.geometry
		return new Promise((resolve,reject)=>{
			MapboxUtilities.loadTopoData(topoMapId, zoom, id, accessToken, 
				styleId, resolutionExponent).then((elevationData: [number[], number, number]) => {
				for (var i = 0; i < geom.vertices.length; i++) {
					geom.vertices[i].z = elevationData[0][i]
				}
				geom.computeFaceNormals();
				geom.computeVertexNormals();
				resolve(geom)
			})
		})
	}

	private sewTileEdges()
	{
		var w = this._groundTiles.length

		for(let i=0; i<w; i++){
			for(let j=0; j<w; j++){
				let o = this._groundTiles[i][j]
				let t = <THREE.PlaneGeometry>o.geometry
				let tileSize = Math.sqrt(t.vertices.length);
				
				// Tiles are arrayed as followed with the
				// origin tile at 1,1
				// 0,0 1,0 2,0
				// 0,1 1,1 2,1
				// 0,2 1,2 2,2
				//   t
				// l o r
				//   b
				let bottom = j < (w-1) ? <PlaneGeometry>this._groundTiles[i][j+1].geometry : null
				let right = i < (w-1) ? <PlaneGeometry>this._groundTiles[i+1][j].geometry : null 

				if(bottom){
					for(let k=0; k<tileSize; k++)
					{
						let v = t.vertices[t.vertices.length - tileSize + k]
						let vt = bottom.vertices[k]
						let avg = (v.z + vt.z)/2
						v.z = avg
						vt.z = avg
					}
				}

				if(right){
					for(let k=tileSize-1; k<=t.vertices.length; k+=tileSize)
					{
						let v = t.vertices[k]
						let vr = right.vertices[k-(tileSize-1)]
						let avg = (v.z + vr.z)/2
						v.z = avg
						vr.z = avg
					}
				}
				
				t.elementsNeedUpdate = true
			}
		}
	}

	private setTileElevations() {
		for(let i=0; i<this._groundTiles.length; i++){
			let row =this._groundTiles[i]
			for(let j=0; j<row.length; j++){
				let ground = this._groundTiles[i][j]
				let geom: any = ground.geometry
				for(var k=0; k<geom.vertices.length; k++)
				{
					geom.vertices[k].z = geom.vertices[k].z
				}
				geom.elementsNeedUpdate = true
			}
		}
	}

	private setEdgeColoring()
	{
		for(let i=0; i<this._groundTiles.length; i++){
			let row =this._groundTiles[i]
			for(let j=0; j<row.length; j++){
				let ground = this._groundTiles[i][j]
				let geom: any = ground.geometry
				var width = Math.sqrt(geom.vertices.length)*2
				for(var k=0; k<geom.faces.length; k++)
				{
					if(k<width)
					{
						let c = new THREE.Color(1, k/width, 0);
						geom.faces[k].vertexColors[0] = c
						geom.faces[k].vertexColors[1] = c
						geom.faces[k].vertexColors[2] = c
					} else
					{
						let c = new THREE.Color(i/(this._groundTiles.length-1), 0, j/(row.length-1));
						geom.faces[k].vertexColors[0] = c
						geom.faces[k].vertexColors[1] = c
						geom.faces[k].vertexColors[2] = c
					}
					
				}
				geom.elementsNeedUpdate = true
			}
		}
	}

	private setSlopeAngleColoring()
	{
		for(let i=0; i<this._groundTiles.length; i++){
			let row =this._groundTiles[i]
			for(let j=0; j<row.length; j++){
				let ground = this._groundTiles[i][j]
				let geom: any = ground.geometry
				var up = new Vector3(0,0,1);
				for(var k=0; k<geom.faces.length; k++)
				{
					let a = geom.faces[k].vertexNormals[0].angleTo(up) * 180/Math.PI
					let b = geom.faces[k].vertexNormals[1].angleTo(up) * 180/Math.PI
					let c = geom.faces[k].vertexNormals[2].angleTo(up) * 180/Math.PI
					geom.faces[k].vertexColors[0] = ColorScale.Slope(a, this._maxAllowableSlope)
					geom.faces[k].vertexColors[1] = ColorScale.Slope(b, this._maxAllowableSlope)
					geom.faces[k].vertexColors[2] = ColorScale.Slope(c, this._maxAllowableSlope)
				}
				geom.elementsNeedUpdate = true
			}
		}
	}

	private getDevicePixelRatio() {
		var ctx: any = this._info.getContext("2d"),
			dpr = window.devicePixelRatio || 1,
			bsr = ctx.webkitBackingStorePixelRatio ||
				ctx.mozBackingStorePixelRatio ||
				ctx.msBackingStorePixelRatio ||
				ctx.oBackingStorePixelRatio ||
				ctx.backingStorePixelRatio || 1

		return dpr / bsr
	}

	private drawLabels(labelProperty: string): void {

		var ctx = this._info.getContext("2d")

		// Set canvas scaling for retina displays.
		let ratio = this.getDevicePixelRatio()
		this._info.width = this._info.clientWidth * ratio
		this._info.height = this._info.clientHeight * ratio
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

		ctx.font = "18px Arial"
		ctx.fillStyle = "white"
		ctx.textAlign = "center"
		ctx.textBaseline = "middle"
		ctx.fillStyle = "black"
		ctx.clearRect(0, 0, this._info.width * ratio, this._info.height * ratio)

		if (!this._gltfScene) {
			return
		}

		if (labelProperty == "None") {
			return
		}

		window.clearTimeout(this._onScreenUpdate)
		this._info.className = "info"

		this._onScreenUpdate = setTimeout(() => {
			if (this._navigating) {
				return
			}

			var raycaster = new THREE.Raycaster()

			this._gltfScene.traverse((o) => {
				if (o instanceof THREE.Object3D) {
					if (this.model) {
						let element: any = this.model.elements[o.name.split('_')[0]]
						if (element) {
							try {
								// TODO: Remove this check when all executions have a 'properties' property.
								let properties = element.parameters != null ? element.parameters : element.properties
								let parameter: Parameter = properties[labelProperty]
								if (parameter) {
									let bbox = new Box3()
									bbox.setFromObject(o)
									let center = new THREE.Vector3()
									bbox.getCenter(center)

									let v = center.project(this._camera)

									if (v.x > 0.95 || v.x < -0.95 || v.y > 0.95 || v.y < -0.95) {
										// The element is off screen. Do nothing.
									} else {
										raycaster.setFromCamera(v, this._camera)
										let intersects = raycaster.intersectObjects(this._gltfScene.children, true)
										let limit = Math.min(intersects.length, 3)
										let hit = false
										for (let i = 0; i < limit; i++) {
											if (intersects[i].object == o) {
												hit = true
											}
										}
										if (!hit) {
											return
										}

										let left = this._container.clientLeft + this._container.clientWidth / 2 + v.x * (this._container.clientWidth / 2)
										let top = this._container.clientTop + this._container.clientHeight / 2 - v.y * (this._container.clientHeight / 2)

										let suffix = ""
										switch (parameter.type) {
											// case "none":
											// case "text":
											case 0:
											case 6:
												suffix = ""
												break
											// case "volume":
											case 3:
												suffix = " m\u00B3"
												break
											// case "area":
											case 2:
												suffix = " m\u00B2"
												break
											// case "force":
											case 5:
												suffix = " N"
												break
											// case "distance":
											case 1:
												suffix = " m"
												break
											// case "mass":
											case 4:
												suffix = " kg"
												break
										}

										let value = parameter.value + suffix
										if (typeof (parameter.value) == "number") {
											value = parameter.value.toFixed(3) + suffix
										}
										ctx.fillText(value, left, top)
									}
								}
							}
							catch{
								console.warn("There was an error drawing a label.")
							}
						}
					}
				}
			})
			this._info.className = "info show"
		}, 1000)
	}
}