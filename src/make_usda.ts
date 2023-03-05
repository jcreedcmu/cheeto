import * as fs from 'fs';
import { focalLength, aperture, base_of_scene4, base_block_xform, orange_block_xforms } from './node-computation';
import { Matrix } from 'mathjs';
import * as math from 'mathjs';

function stringOfMatrix(matrix: Matrix) {
  const m = math.transpose(matrix);
  const size = m.size();
  const arr = m.toArray() as number[][];
  return '( ' + arr.map(row => '(' + row.join(',') + ')').join(', ') + ' )';
}

type CubeSpec = [name: string, transform: Matrix];
const cubes: CubeSpec[] =
  [
    ['base', base_block_xform],
    ...orange_block_xforms.map<CubeSpec>((xform, ix) => [`orange${ix}`, xform])
  ];

function cube(name: string, transform: Matrix): string {
  return `
def Xform "${name}"
{
    matrix4d xformOp:transform = ${stringOfMatrix(transform)}
    uniform token[] xformOpOrder = ["xformOp:transform"]

    def Mesh "${name}mesh"
    {
        int[] faceVertexCounts = [4, 4, 4, 4, 4, 4]
        int[] faceVertexIndices = [0, 1, 3, 2, 2, 3, 7, 6, 6, 7, 5, 4, 4, 5, 1, 0, 2, 6, 4, 0, 7, 3, 1, 5]
        normal3f[] normals = [(-1, 0, 0), (-1, 0, 0), (-1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, 1, 0), (0, 1, 0), (0, 1, 0), (1, 0, 0), (1, 0, 0), (1, 0, 0), (1, 0, 0), (0, -1, 0), (0, -1, 0), (0, -1, 0), (0, -1, 0), (0, 0, -1), (0, 0, -1), (0, 0, -1), (0, 0, -1), (0, 0, 1), (0, 0, 1), (0, 0, 1), (0, 0, 1)] (
            interpolation = "faceVarying"
        )
        point3f[] points = [(0, 0, 0), (0, 0, 1), (0, 1, 0), (0, 1, 1), (1, 0, 0), (1, 0, 1), (1, 1, 0), (1, 1, 1)]
        texCoord2f[] primvars:UVMap = [(0.375, 0), (0.625, 0), (0.625, 0.25), (0.375, 0.25), (0.375, 0.25), (0.625, 0.25), (0.625, 0.5), (0.375, 0.5), (0.375, 0.5), (0.625, 0.5), (0.625, 0.75), (0.375, 0.75), (0.375, 0.75), (0.625, 0.75), (0.625, 1), (0.375, 1), (0.125, 0.5), (0.375, 0.5), (0.375, 0.75), (0.125, 0.75), (0.625, 0.5), (0.875, 0.5), (0.875, 0.75), (0.625, 0.75)] (
            interpolation = "faceVarying"
        )
        uniform token subdivisionScheme = "none"
    }
}
`
}

const usda = `#usda 1.0
(
    doc = "Blender v3.4.1"
    metersPerUnit = 1
    upAxis = "Z"
)

def Xform "Camera"
{
    matrix4d xformOp:transform = ${stringOfMatrix(base_of_scene4)}
    uniform token[] xformOpOrder = ["xformOp:transform"]

    def Camera "Camera"
    {
        float2 clippingRange = (0.1, 100)
        float focalLength = ${focalLength}
        float horizontalAperture = ${aperture}
        float horizontalApertureOffset = 0
        token projection = "perspective"
        float verticalAperture = 20.5
        float verticalApertureOffset = 0
    }
}

${cubes.map(x => cube(...x)).join('')}

def "_materials"
{
    def Material "Material"
    {
        token outputs:surface.connect = </_materials/Material/preview/Principled_BSDF.outputs:surface>

        def Scope "preview"
        {
            def Shader "Principled_BSDF"
            {
                uniform token info:id = "UsdPreviewSurface"
                float inputs:clearcoat = 0
                float inputs:clearcoatRoughness = 0.03
                float3 inputs:diffuseColor = (0.8, 0.8, 0.8)
                float inputs:ior = 1.45
                float inputs:metallic = 0
                float inputs:opacity = 1
                float inputs:roughness = 0.5
                float inputs:specular = 0.5
                token outputs:surface
            }
        }
    }
}
`;

const filename = '/tmp/cheeto.usda';
fs.writeFileSync(filename, usda, 'utf8');
console.log(`Wrote to ${filename}`);
