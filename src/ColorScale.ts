import * as THREE from "three";

export module ColorScale
{
    export function Slope(value: number, maxAllowable: number)
    {
        if(maxAllowable > 90)
        {
            throw("A maximum allowable slope of greater than 90.0d is not allowed.")
        }
        let a = new THREE.Color("#69ce82") // green
        let b = new THREE.Color("#d6d863") // orange
        let c = new THREE.Color("#ce7e69") // red
        let colors = [a,b,c]
        let max = Math.min(value, maxAllowable)
        let t = max / maxAllowable;
        return colors[bucket(colors.length-1, t)]
    }

    function bucket(slots: number, t: number)
    {
        return Math.floor(slots*t)
    }

    function interpolate(min: THREE.Color , mid: THREE.Color, max: THREE.Color , t: number): THREE.Color
    {
        let a = 0.5
        let y = a * Math.pow(t-0.5,2)
        var r = (max.r - min.r) * t + min.r;
        var g = (max.g - min.g) * t + min.g;
        var b = (max.b - min.b) * t + min.b;
        return new THREE.Color(r,g,b);
    }
}