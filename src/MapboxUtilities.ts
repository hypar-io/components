export module MapboxUtilities
{
    // Conversion utilities ported from https://github.com/mapbox/mapbox-unity-sdk/blob/develop/sdkproject/Assets/Mapbox/Unity/Utilities/Conversions.cs#L105
    /// <summary>according to https://wiki.openstreetmap.org/wiki/Zoom_levels</summary>
    let EarthRadius = 6378137 //no seams with globe example
    // let EarthRadius = 6372798.2
    let OriginShift = 2 * Math.PI * EarthRadius / 2
    let WebMercMax = 20037508.342789244

    function tileXToNWLongitude(x: number, zoom: number): number {
        var n = Math.pow(2.0, zoom)
        var lon_deg = x / n * 360.0 - 180.0
        return lon_deg
    }

    function tileYToNWLatitude(y: number, zoom: number): number {
        var n = Math.pow(2.0, zoom)
        var lat_rad = Math.atan(Math.sin(Math.PI * (1 - 2 * y / n)))
        var lat_deg = lat_rad * 180.0 / Math.PI
        return lat_deg
    }

    function tileIdToBounds(x: number, y: number, zoom: number): [number[], number[]] {
        let sw = [tileYToNWLatitude(y, zoom), tileXToNWLongitude(x + 1, zoom)]
        let ne = [tileYToNWLatitude(y + 1, zoom), tileXToNWLongitude(x, zoom)]
        return [sw, ne]
    }

    function tileIdToCenterLatitudeLongitude(x: number, y: number, zoom: number): [number, number] {
        var bb = tileIdToBounds(x, y, zoom)
        var center = [(bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2]	//center
        return [center[0], center[1]]
    }

    function tileIdToCenterWebMercator(x: number, y: number, zoom: number): [number, number] {
        let tileCnt = Math.pow(2, zoom)
        let centerX = x + 0.5
        let centerY = y + 0.5
    
        centerX = ((centerX / tileCnt * 2) - 1) * WebMercMax
        centerY = (1 - (centerY / tileCnt * 2)) * WebMercMax
        return [centerX, centerY]
    }

    export function latLonToMeters(lat: number, lon: number): [number, number] {
        var posx = lon * OriginShift / 180
        var posy = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180)
        posy = posy * OriginShift / 180
        return [posx, posy]
    }

    export function getOffsetFromCenterToPointMeters(tileX: number, tileY: number, point: [number, number], zoom: number): [number, number] {
        let center = tileIdToCenterWebMercator(tileX, tileY, zoom)
        let world = latLonToMeters(point[1], point[0])
        return [world[0] - center[0], world[1] - center[1]]
    }

    function geoToWorldPosition(lat: number, lon: number, refPoint: [number, number], scale = 1): [number, number] {
        var posx = lon * OriginShift / 180.0
        var posy = Math.log(Math.tan((90.0 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0)
        posy = posy * OriginShift / 180.0
        return [(posx - refPoint[0]) * scale, (posy - refPoint[1]) * scale]
    }

    export function getTileSizeMeters(zoom: number): number {
        // Circumference of the earth divided by 2^zoom
        // return (2* Math.PI * EarthRadius)/ Math.pow(2,zoom)
        return 40075016.685578 / Math.pow(2, zoom)
        // return 40075017 / Math.pow(2, zoom)
    }

    export function getTileIdsForPosition(origin: [number,number], zoom: number, gridWidth: number): Array<[number, number]> {
        if (gridWidth == 0) {
            throw "The map tile grid must have a grid width that is odd and at least 1."
        }
        let tileX = long2tile(origin[0], zoom)
        let tileY = lat2tile(origin[1], zoom)

        let tileIds = new Array<[number, number]>()
        let halfW = (gridWidth - 1) / 2
        for (let x = -halfW; x <= halfW; x++) {
            for (let y = halfW; y >= -halfW; y--) {
                tileIds.push([tileX - x, tileY + y])
            }
        }
    
        return tileIds
    }

    function long2tile(lon: number, zoom: number) : number {
        let result = Math.floor((lon + 180.0) / 360 * Math.pow(2, zoom))
        return result
    }

    function lat2tile(lat: number, zoom: number) : number {
        return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180.0) + 1 / Math.cos(lat * Math.PI / 180.0)) / Math.PI) / 2 * Math.pow(2, zoom))
    }

    export function getElevationFromPixel(imageData, x: number, y: number): number {
		let pixelData = getPixel(imageData, x, y)
		let height = -10000 + ((pixelData.r * 256 * 256 + pixelData.g * 256 + pixelData.b) * 0.1)
		return height
    }

    export function loadTopoData(topoMapId: string, 
        zoom: number, 
        id: number[], 
        accessToken: string, 
        styleId: string, 
        resolutionExponent: number) : Promise<[number[],number,number]>
    {
        return new Promise((resolve,reject) => {

            if(resolutionExponent > 9)
            {
                reject("The resolution exponent must be smaller than 9.")
            }

            let url = `https://api.mapbox.com/v4/${topoMapId}/${zoom}/${id[0]}/${id[1]}@2x.pngraw?access_token=${accessToken}&style=${styleId}`
            let imageSize = 512
            var minE = Number.MAX_VALUE
            var maxE = Number.MIN_VALUE
            let r = Math.pow(2, resolutionExponent)
            let image = document.createElement("img")
            
            image.crossOrigin = "Anonymous";
            image.onload = ()=>{
                var imageData = getImageData(image)
                let x = 0
                let y = 0
                let heights = []
                for (var i = 0; i < imageData.data.length/r; i+=r*4) {	
                    let height = MapboxUtilities.getElevationFromPixel(imageData, x, y)			
                    heights.push(height)
                    minE = Math.min(minE, height)
                    maxE = Math.max(maxE, height)
                    x += r
                    if (x >= imageSize) {
                        x = 0
                        y += r
                    }
                }
                resolve([heights,minE,maxE])
            }
            image.onerror = ()=>{
                reject("There was an error loading the topo image.")
            }
            image.src = url
        })
    }

    function getImageData(image) {

		var canvas = document.createElement('canvas')
		canvas.width = image.width
		canvas.height = image.height

		var context = canvas.getContext('2d')
		context.drawImage(image, 0, 0)

		return context.getImageData(0, 0, image.width, image.height)
	}
    
    function getPixel(imagedata: ImageData, x: number, y: number) {
        let position = (x + imagedata.width * y) * 4
        let data = imagedata.data
		return { r: data[position], g: data[position + 1], b: data[position + 2], a: data[position + 3] }
	}
}
