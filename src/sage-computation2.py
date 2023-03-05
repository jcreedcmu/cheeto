
# These are the pixel positions of the four corners of the base of the sculpture
ux_source = [[660,1162],[1992,726],[123,917],[1441,630]]

# Here are the pixel positions of the other identified points on the base of
# the sculpture that I'm interested in. These come in three triples. Let's call
# them [pab, po, pcd, pab', po', pcd'] I expect from my understanding of the
# sculpture that pab -- po -- pcd and pab' -- po' -- pcd' are right triangles.
ux_in_pts = [[531,941], [737,974], [987,842], [1283,808], [1481,830], [1647,697]]

# The size of the photo in pixels
img = vector([1920,1280])

def xform(p):
    base = (vector(p) - img/2)/(img[0]/2)
    return vector([float(base[0]), -base[1]])  # invert y, scale

source = [xform(v) for v in ux_source]
in_pts = [xform(v) for v in ux_in_pts]

# These are uv coordinates that I want to find a homography to
target = [[0,0],[1,0],[0,1],[1,1]]

# We set up an 8x9 matrix whose null-space will be the coefficients
# (up to projective scale) of the matrix representation of the desired homography.

M = Matrix(CDF,8,9)

# These coefficients are taken from
# https://math.stackexchange.com/questions/494238/how-to-compute-homography-matrix-h-from-corresponding-points-2d-2d-planar-homog
# but
# https://ai.stackexchange.com/questions/21042/how-do-you-find-the-homography-matrix-given-4-points-in-both-images
# also has some good explanation and links to textbooks explaining how they can
# be derived.
for i in range(4):
    M[2*i,0] = -source[i][0]
    M[2*i,1] = -source[i][1]
    M[2*i,2] = -1
    M[2*i,6] = source[i][0] * target[i][0]
    M[2*i,7] = source[i][1] * target[i][0]
    M[2*i,8] = target[i][0]

    M[2*i+1,3] = -source[i][0]
    M[2*i+1,4] = -source[i][1]
    M[2*i+1,5] = -1
    M[2*i+1,6] = source[i][0] * target[i][1]
    M[2*i+1,7] = source[i][1] * target[i][1]
    M[2*i+1,8] = target[i][1]


# [2] because M.SVD() returns the three matrices (U,D,V) of the singular value decomposition,
# where U : Matrix(8,8), D : Matrix(8,9), and V : Matrix(9,9), and we want V.
# .transpose()[8] because we want the last column of V, because it corresponds to the nullspace.
coeffs = M.SVD()[2].transpose()[8]

# Take these 9 coefficients and convert them back into a 3x3 matrix that is the
# desired homography.
homog = Matrix([coeffs[0:3],coeffs[3:6],coeffs[6:9]])

# This function takes p, a point in screen space,
# and returns uv coordinates in rect space
def get_uv(p):
    v = homog * vector([p[0],p[1],1])
    return (v[0]/v[2], v[1]/v[2])

# The inverse map. Takes in a point in uv space,
# and returns a point in 3d space, up to an unknown
# scaling of the z coordinate.
def inv_uv(p):
    v = homog.inverse() * vector([p[0],p[1],1])
    return v

# TEST: Check that get_uv maps source to target correctly.

# import unittest
# tc = unittest.TestCase()
# for i in range(4):
#     uv = get_uv(source[i])
#     tc.assertAlmostEqual(float(uv[0]), float(target[i][0]))



print (homog.inverse())

pts = [inv_uv(vv) for vv in [[0,0],[0,1],[1,0],[1,1]]]
[org, vax, uax, *others] = pts

print("org, vax, uax", org, vax, uax)
ud = uax - org
vd = vax - org
print("ud", ud)
print("vd", vd)


# This is the amount I want to scale every point by to ensure that the base is actually a rectangle.
# The reasoning is: we expect (ud.x, ud.y, λud.z) and (vd.x, vd.y, λvd.z) to be orthogonal.
# Therefore (ud.x * vd.x) + (ud.y * vd.y) + λ² (ud.z * vd.z) = 0.
# Therefore λ = √((ud.x * vd.x + ud.y * vd.y) / -(ud.z * vd.z))
lam = sqrt((ud[0] * vd[0] + ud[1] * vd[1]) / -(ud[2] * vd[2]))
# print("lambda", lam)

# We can use this to figure out the fov of the camera:
print("fov:", float(2 * 360  * atan(1/lam) / (2 * pi)))

M = Matrix([[pt[0], pt[1], pt[2] * lam] for pt in pts]) # the four rows are (u,v) = (0,0), (0,1), (1,0), (1,1) points
print ("points:", [[x for x in v] for v in M])

q1 = M[1]-M[0]
q2 = M[2]-M[0]

print("estimate of base aspect ratio:", sqrt(q2*q2) / sqrt(q1*q1))

print(in_pts)
