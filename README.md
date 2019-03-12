# Hypar
Custom components to build web applications for the Hypar platform.

## Installation
```
$ npm install hypar-aec
```

### Motivation
Hypar is platform that enables the Architecture, Engineering, and Construction industries to build applications which generate, analyze, and test the built environment. These components facilitate the creation of web applications to visualize 3D data, generate options, and execute user-defined functions on the Hypar platform. They're built on open standards like WebGL, glTF, IFC, and GeoJSON.

### Caution
This package is an early beta release of these components. Please do not use them in production applications.

### Common Usage
Add the following to the head of the your html document:
```html
<!doctype html>
<html>
  <head>
    <title>Hypar Components Example</title>
    <script src="unpkg.com/hypar-aec@0.0.1-beta1/hypar-aec.js"></script>
  </head>
  <body>
      <hypar-view time="June 21, 2019 12:00:00 " longitude="-118.0" latitude="34.0" model="/models/Truss.glb"></hypar-view>
  </body>
</html>
```

### Development

#### Building
```
npm run build
````

#### Develop
The development server will start and open a browser to `localhost:9000`. You can edit `test/index.html` live.  
```
npm start
```
