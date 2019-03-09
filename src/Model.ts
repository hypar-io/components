export interface ElementType {
    description: string
    id: string
    name: string
    typy: string
}

export interface Parameter {
    type: number
    value: number|string
}

export interface Element {
    parameters: Map<string,object>
    sub_elements: Array<Element>
    type: string
}

export interface Color {
    alpha: number
    blue: number
    green: number
    red: number
}

export interface Material {
    color: Color
    glossiness_factor: number
    id: string
    name: string
    specular_factor: number
}

export interface Polygon {
    vertices: Array<number>
}

export interface Profile {
    id:string
    perimeter: Polygon
}

export interface Model {
    element_types: Map<string,ElementType>
    elements: Map<string,Element>
    materials: Map<string,Material>
    profiles: Map<string,Profile>
}