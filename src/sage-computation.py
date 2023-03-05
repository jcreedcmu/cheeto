
# These are the pixel positions of the four corners of the base of the sculpture
source = [[660,1162],[1992,726],[123,917],[1441,630]]

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

# TEST: Check that get_uv maps source to target correctly.

# import unittest
# tc = unittest.TestCase()
# for i in range(4):
#     uv = get_uv(source[i])
#     tc.assertAlmostEqual(float(uv[0]), float(target[i][0]))

# Here are the other points on the base of the sculpture that I'm interested
# in. These come in three triples. Let's call them [pab, po, pcd, pab', po',
# pcd'] I expect from my understanding of the sculpture that pab -- po -- pcd
# and pab' -- po' -- pcd' are right triangles.
in_pts = [[531,941], [737,974], [987,842], [1283,808], [1481,830], [1647,697]]

# Since the unique homography that maps any quadrilateral onto a square doesn't
# determine the aspect ratio of the actual rectangle of the sculpture's base, I
# let my assumption that pab -- po -- pcd is a right triangle determine the
# aspect ratio. There is a unique factor λ by which I can scale everything in
# the x direction that makes po -- pab orthogonal to po -- pcd.
#
# Put po at the origin, and let (a,b) be the original coordinates of pab and
# (c,d) be the original coordinates of pcd. If I introduce a scaling factor of
# λ then I get (λa, b) and (λc, d). If these two segments are to be orthogonal,
# then the dot product (λa, b) · (λc, d) = λ²ac + bd is zero. So λ = √(-bd/ac).
def getλ(off):
    # off is the offset into in_pts, since we want to compute this
    # for the two triples.
    po = vector(get_uv(in_pts[off + 1]))
    pab = vector(get_uv(in_pts[off]))
    pcd = vector(get_uv(in_pts[off + 2]))

    qab = pab-po
    qcd = pcd-po

    return sqrt(-qab[1] * qcd[1] / (qab[0] * qcd[0]))

# Compute two estimates of λ
lam_approx1 = getλ(0) # 2.3554372776676202
lam_approx2 = getλ(3) # 2.2761462143032642

# They're reasonably (~4%) close, so take their mean, I guess:
lam_approx = (lam_approx1 + lam_approx2) / 2.0 # 2.3157917459854422

print(f'lambda = {lam_approx};')
print (f'points = {[[lam_approx * x, y] for v in in_pts for (x,y) in [get_uv(v)]]}')
