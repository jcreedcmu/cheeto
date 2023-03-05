import * as fs from 'fs';
import assert from 'assert';
import * as math from 'mathjs';
import * as svd from 'svd-js';

const DEBUG = true;
type Ppoint = [number, number];

// These are the pixel positions of the four corners of the base of the sculpture
const ux_source: Ppoint[] = [[660, 1162], [1992, 726], [123, 917], [1441, 630]];

// Here are the pixel positions of the other identified points on the base of
// the sculpture that I'm interested in. These come in three triples. Let's call
// them [pab, po, pcd, pab', po', pcd'] I expect from my understanding of the
// sculpture that pab -- po -- pcd and pab' -- po' -- pcd' are right triangles.
const ux_in_pts: Ppoint[] = [[531, 941], [737, 974], [987, 842], [1283, 808], [1481, 830], [1647, 697]];

// The size of the photo in pixels
const img: Ppoint = [1920, 1280];

// These are uv coordinates that I want to find a homography to
const target: Ppoint[] = [[0, 0], [1, 0], [0, 1], [1, 1]];

function xform(v: Ppoint): Ppoint {
  const base = math.divide(math.subtract(v, math.divide(img, 2)), img[0] / 2) as Ppoint;
  return [base[0], -base[1]];
}

const source: Ppoint[] = ux_source.map(xform);
const in_pts: Ppoint[] = ux_in_pts.map(xform);

// These coefficients are taken from
// https://math.stackexchange.com/questions/494238/how-to-compute-homography-matrix-h-from-corresponding-points-2d-2d-planar-homog
// but
// https://ai.stackexchange.com/questions/21042/how-do-you-find-the-homography-matrix-given-4-points-in-both-images
// also has some good explanation and links to textbooks explaining
// how they can be derived.
const M: number[][] = Array(8).fill([]).map(x => Array(9).fill(0));
for (let i = 0; i < 4; i++) {
  M[2 * i][0] = -source[i][0];
  M[2 * i][1] = -source[i][1];
  M[2 * i][2] = -1;
  M[2 * i][6] = source[i][0] * target[i][0];
  M[2 * i][7] = source[i][1] * target[i][0];
  M[2 * i][8] = target[i][0];

  M[2 * i + 1][3] = -source[i][0];
  M[2 * i + 1][4] = -source[i][1];
  M[2 * i + 1][5] = -1;
  M[2 * i + 1][6] = source[i][0] * target[i][1];
  M[2 * i + 1][7] = source[i][1] * target[i][1];
  M[2 * i + 1][8] = target[i][1];
}

if (DEBUG)
  console.log(M);
const eigs = math.eigs(math.multiply(math.transpose(M), M));

const nullvec = (math.transpose(math.column(eigs.vectors, 0)) as math.MathNumericType[][])[0];
const eigenvalue = (eigs.values as math.MathArray)[0] as number;
assert(Math.abs(eigenvalue) < 1e-15);

if (DEBUG)
  console.log(nullvec);
// Take the 9 coefficients of the vector that characterizes the
// 1-dimensional nullspace of M and convert them back into a 3x3
// matrix that is the desired homography.
const homog: number[][] = [nullvec.slice(0, 3), nullvec.slice(3, 6), nullvec.slice(6, 9)] as number[][];

if (DEBUG)
  console.log(homog);
// This function takes p, a point in screen space,
// and returns uv coordinates in rect space
function get_uv(p: Ppoint): Ppoint {
  const v = math.multiply(homog, [p[0], p[1], 1]);
  return [v[0] / v[2], v[1] / v[2]];
}

// Check this really works
for (let i = 0; i < 4; i++) {
  const s = get_uv(source[i]);
  const t = target[i];
  assert(Math.abs(s[0] - t[0]) < 1e-13);
  assert(Math.abs(s[1] - t[1]) < 1e-13);
}

// The inverse map. Takes in a point in uv space,
// and returns a point in 3d space, up to an unknown
// scaling of the z coordinate.
function inv_uv(p: Ppoint): [number, number, number] {
  return math.multiply(math.inv(homog), [p[0], p[1], 1]) as [number, number, number];
}

const pts: Ppoint[] = [[0, 0], [0, 1], [1, 0], [1, 1]];
const ipts = pts.map(inv_uv);
const [org, vax, uax] = ipts;

const [ud, vd] = [uax, vax].map(x => math.subtract(x, org));

// This is the amount I want to scale every point by to ensure that the base is actually a rectangle.
// The reasoning is: we expect (ud.x, ud.y, λud.z) and (vd.x, vd.y, λvd.z) to be orthogonal.
// Therefore (ud.x * vd.x) + (ud.y * vd.y) + λ² (ud.z * vd.z) = 0.
// Therefore λ = √((ud.x * vd.x + ud.y * vd.y) / -(ud.z * vd.z))
const lam = Math.sqrt((ud[0] * vd[0] + ud[1] * vd[1]) / -(ud[2] * vd[2]));

// We can use this to figure out the fov of the camera:
const fov_deg = 2 * 360 * Math.atan(1 / lam) / (2 * Math.PI);
if (DEBUG)
  console.log(`field of view: ${fov_deg}°`);

// base points are points in 3d space, scaled by lambda so that they
// form a rectangle.
const base_pts: number[][] = [];
if (DEBUG)
  console.log(`outer rectangle points:`);
ipts.forEach(ipt => {
  const base_pt = [ipt[0], ipt[1], -lam * ipt[2]];
  base_pts.push(base_pt);
  if (DEBUG)
    console.log(base_pt);
});

// These are the vectors along edges of the base. u_edge is the longer of the two.
const u_edge = math.subtract(base_pts[2], base_pts[0]);
const v_edge = math.subtract(base_pts[1], base_pts[0]);

//////////////////
// These are the lengths of the base, in somewhat arbitrary units
export const baseLengths: [number, number] = [math.norm(u_edge) as number, math.norm(v_edge) as number];
if (DEBUG)
  console.log('baseLengths', baseLengths);

const u_edge_unit = math.divide(u_edge, baseLengths[0]) as number[];
const v_edge_unit = math.divide(v_edge, baseLengths[1]) as number[];

// Here is the 3x3 orthonormal transformation that takes coordinates (u, v, z) where u is "distance along the long edge of the base",
// v is "distance along the short edge of the base", z is "upward distance" to coordinates in the scene where
// the camera points down.
const scene_of_base3 = math.matrix([u_edge_unit, v_edge_unit, math.cross(u_edge_unit, v_edge_unit) as number[]]);
if (DEBUG)
  console.log("estimate of base aspect ratio:", baseLengths[0] / baseLengths[1]);

//////////////////
// The 4x4 transform that includes translation
export const scene_of_base4 = scene_of_base3.resize([4, 4]);
for (let i = 0; i < 4; i++)
  scene_of_base4.set([3, i], i == 3 ? 1 : base_pts[0][i]);

if (DEBUG) {
  console.log("scene_of_base", scene_of_base4);
  console.log("scene_of_base⁻¹", math.inv(scene_of_base4));
}

const ip = in_pts.map(ipt => get_uv(ipt)).map(ipt => [ipt[0] * baseLengths[0], ipt[1] * baseLengths[1]]);
if (DEBUG)
  console.log("interior points in 2d space", ip);

//////////////////
// The "aperture" or "sensor size" in mm
// aka H in the forumla fov = 2 atan(H / 2f) where f is focal length
export const aperture = 36;

//////////////////
// The focal length, in mm
export const focalLength = aperture * lam / 2;

//////////////////
// The 4x4 transform that we want to apply to the camera
// I don't really understand why this transpose??
export const base_of_scene4 = math.transpose(math.inv(scene_of_base4));

function translate(vec3: number[]): math.Matrix {
  const M = math.identity(4) as math.Matrix;
  for (let i = 0; i < 3; i++) {
    M.set([i, 3], vec3[i]);
  }
  return M;
}

const depth = 0.25;

export const base_block_xform = math.multiply(
  translate([0, 0, -depth]),
  math.matrix(math.diag([baseLengths[0], baseLengths[1], depth, 1])),
);

const a1 = math.norm(math.subtract(ip[0], ip[1])) as number;
const a2 = math.norm(math.subtract(ip[3], ip[4])) as number;
const a = a1;
const b = math.norm(math.subtract(ip[1], ip[2])) as number / Math.sqrt(2);
const c = math.norm(math.subtract(ip[4], ip[5])) as number / Math.sqrt(2);

if (DEBUG) {
  console.log('a1, a2, b, c', a1, a2, b, c);
}

function rotate4(theta: number, axis: number[]): math.Matrix {
  const M = math.resize(math.rotationMatrix(theta, math.matrix(axis)), [4, 4]);
  M.set([3, 3], 1);
  return M;
}

function get_orange_block_xform(pos1: number[], pos2: number[]): math.Matrix {
  const displacement = math.subtract(pos2, pos1);
  return [
    translate([pos1[0], pos1[1], 0]),
    rotate4(Math.atan2(displacement[1], displacement[0]), [0, 0, 1]),
    rotate4(Math.PI / 4, [1, 0, 0]),
    math.matrix(math.diag([a, b, c, 1])),
  ].reduce((x, y) => math.multiply(x, y));
}

function scale_to(v: number[], len: number): number[] {
  return math.multiply(v, len / (math.norm(v) as number)) as number[];
}

function rot90(v: number[]): number[] {
  return [-v[1], v[0]];
}

// These are squidged so that the blocks osculate accurately.
// Instead of two triples I have two quadruples:
// On the base these look like:
//   0 3
//   1 2    4 7
//          5 6
function interior_pts_revised(): number[][] {
  const ipr: number[][] = [ip[0], ip[1]];
  const s10 = math.subtract(ip[1], ip[0]);
  ipr[2] = math.add(ip[1], scale_to(rot90(s10), Math.sqrt(2) * b));
  ipr[3] = math.subtract(ipr[2], s10);
  ipr[4] = ip[3]; // not a typo, is a result of change from triples to quads
  ipr[5] = math.add(ipr[4], s10);
  ipr[6] = math.add(ipr[5], scale_to(rot90(s10), Math.sqrt(2) * c));
  ipr[7] = math.subtract(ipr[6], s10);
  return ipr;
}

const ipr = interior_pts_revised();

export const orange_block_xforms = [
  get_orange_block_xform(ipr[0], ipr[1]),
  get_orange_block_xform(ipr[2], ipr[3]),

  get_orange_block_xform(ipr[5], ipr[4]),
  get_orange_block_xform(ipr[7], ipr[6]),
];
