# Hypar
Custom components to build web applications for the Hypar platform.

## Installation
```
$ npm install hypar-aec
```

### Motivation
Hypar is platform that enables the Architecture, Engineering, and Construction industries to build applications which generate, analyze, and test the built environment. These components facilitate the creation of web applications to visualize 3D data, generate options, and execute user-defined functions on the Hypar platform. 

Using the Hypar platform is not required though. These components build on open standards like WebGL, glTF, IFC, and GeoJSON. Go ahead and use them to construct applications which build on those standards. 

### **Caution**
This package is an early beta release of these components. Please do not use them in production applications.

### Common Usage
Add the following to the head of the your html document:
```html
<script src="unpkg.com/hypar-aec@0.0.1-beta1/hypar-aec.js"></script>
```

### Development
#### Getting Started
```
npm install
```

#### Building
```
npm run build
````

#### Develop
The development server will start and open a browser to `localhost:9000`. You can edit `test/index.html` live.  
```
npm start
```