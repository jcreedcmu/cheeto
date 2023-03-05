import { Point } from './lib';
import { vlen, vminus, vplus, vrot, vscale, vsetlen, vsub } from './vutil';
import * as fs from 'fs';
import * as path from 'path';

const light_blue = "#24adfd";
const orange_paint = "#fd9210";
const model_picture = 'file://' + path.join(__dirname, "../assets/love-of-two-oranges.jpg");

// Default thickness of tabs, in points.
const TAB = 20;
const BLEED = TAB * 1.1;

// This measurement determines the scale of everything else in the
// model. It is the length of the short edge of the sculpture base,
// measured in points (1/72 in) as intended for an 8.5" × 11" page.

// This is the scaling factor that we multiply to convert "base
// coordinates" which are in the rectangle { x: [0,lambda], y: [0,1] }
// to "page coordinates" which are in the in rectangle { x: [0,S*lambda], y: [0,S] }
const S = 170;

// Width of base divided by height of base (unitless)
const lambda = 2.3157917459854422;

// Reference points [pab, po, pcd, pab', po', pcd'] of where sculpture
// connects to base. pab--po--pcd and pab'--po'--pcd' are right
// triangles, with po and po' being the vertex having the right angle.

const ppoints: [number, number][] = [
  [0.269865539324868, 0.6080939260638484],
  [0.3576361370411738, 0.36218118853795983],
  [0.8824496433973053, 0.5559648330405657],
  [1.2564957293154624, 0.41009824689730384],
  [1.3501458915933955, 0.16779649653242185],
  [2.1265728118677876, 0.4577002762569027]
];

const points: Point[] = ppoints.map(([x, y]) => ({ x: S * x, y: S * (1 - y) }));
const [pab, po, pcd, pab2, po2, pcd2] = points;

// Here z is the "up" direction, and y is the shorter dimension in the
// xy place. I'm not actually intending for the z measurement to be
// accurate to the original sculpture. For ease of construction, it's
// a bit bigger in the model.
const blue = { x: lambda * S, y: S, z: 30 };

// The orange rectangular prisms' measurements. I'm calling them a, b, c
// in increasing size.
const orange = {
  // We actually have two estimates of a available from the two different sculpture pieces
  // It turns out they're very close, so just arbitrarily pick one.
  a: vlen(vsub(pab, po)),
  a2: vlen(vsub(pab2, po2)),
  // We're dividing by sqrt(2) here due to the geometry of the
  // sculpture. There is a right triangle of negative space lying
  // above (i.e. in the z direction) the segments pcd--po and
  // pcd2--po2 such that those segments are the respective
  // hypotenuses.
  b: vlen(vsub(pcd, po)) / Math.sqrt(2),
  c: vlen(vsub(pcd2, po2)) / Math.sqrt(2),
};
console.log('orange', orange);
console.log('blue', blue);
console.log(`Different estimates of orange.a differ by ${Math.round(1000 * 100 * (orange.a - orange.a2) / orange.a2) / 1000}%`);

function getCss(): string {
  return `
.page {
       page-break-after: always;
        position: relative;
        top: 0px;
        bottom: 0px;
        width: 8.5in;
        height: 11in;
        background-color: #fec;
      }

      @media print {
        .page {
          background-color: #fff;
        }
        @page {
          margin: 0px;
        }
        body {
          margin: 0px;
        }
        header, footer, aside, nav {
          display: none !important;
        }
      }

      .content { position: absolute;
                 top: 0.25in; right: 0.25in;
                 left: 0.25in; bottom: 0.25in;
                 background-color: white; }
      .divider {
        background-color:#777;
        height: 0.5em;
      };
`;
}
const X_SIZE = (8.5 - 0.5) * 72;
const Y_SIZE = (11 - 0.5) * 72;
const image_width = 260;
const image_offset = X_SIZE - image_width;

function getHtml(svgs: string[]) {
  const css = getCss();
  const pages = svgs.map(svg => {
    return `
    <div class="page">
      <div class="content">
        <div style="background-color: white;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${X_SIZE} ${Y_SIZE}">
            <style>
              .center {text-anchor: middle; dominant-baseline: middle; font-family: 'Amarante';}
            </style>
            ${svg}
          </svg>
        </div>
      </div>
    </div>
`;
  });

  return `
<html>
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Amarante" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet"/>
    <style>
      ${css}
    </style>
  </head>
  <body>${pages.join("")}</body>
</html>
`;
}

type FillOrStroke = { t: 'fill', color: string, bleed: number } | { t: 'stroke' };
function bleedRect(x: number, y: number, w: number, h: number, fillOrStroke: FillOrStroke): string {
  switch (fillOrStroke.t) {
    case 'fill': {
      const { bleed, color } = fillOrStroke;
      return `<rect width="${w + 2 * bleed}" height="${h + 2 * bleed}" x="${x - bleed}" y="${y - bleed}" fill="${color}" />`;
    }
    case 'stroke': {
      return `<rect width="${w}" height="${h}" x="${x}" y="${y}" style="stroke:black;stroke-opacity:50%;stroke-width:0.25;"/>`;
    }
  }

}

function rect(x: number, y: number, w: number, h: number, extra_opt?: string): string {
  const extra = extra_opt ?? '';
  return `<rect width="${w}" height="${h}" x="${x}" y="${y}"
 style="stroke:black;stroke-opacity:50%;stroke-width:0.25;"${extra}/>`;
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
 style="fill:none;stroke:black;stroke-opacity:50%;stroke-width:0.25;"/>`;
}

function dline(p1: Point, p2: Point, color_opt?: string): string {
  const color = color_opt == undefined ? 'white' : color_opt;
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
stroke-dasharray="3" style="stroke:${color}; stroke-width:0.4;"/>`;
}

function pline(p1: Point, p2: Point): string {
  return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"
 style="fill:none;stroke:black;stroke-opacity:50%;stroke-width:0.25;"/>`;
}


function lines(...p: Point[]): string {
  const rv: string[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    rv.push(pline(p[i], p[i + 1]));
  }
  return rv.join('\n');
}

function together(...x: string[]): string {
  return x.join('\n');
}

function translate(p: Point & { extra?: string }, ...x: string[]): string {
  const body = x.join('\n');
  const extra = p.extra ?? '';
  return `<g transform="translate(${p.x} ${p.y})"${extra}>${body}</g>`
}

function transform(xform: string, ...x: string[]): string {
  const body = x.join('\n');
  return `<g transform="${xform}">${body}</g>`
}

function scale(p: Point, ...x: string[]): string {
  const body = x.join('\n');
  return `<g transform="scale(${p.x} ${p.y})">${body}</g>`
}




function polyline(ps: Point[], fill: string): string {
  const points = ps.map(p => `${p.x},${p.y}`).join(" ");
  const style = `fill:${fill};stroke:black;stroke-opacity:50%;stroke-width:0.25;`
  return `<polyline points="${points}" style="${style}"/>`
}

function tabLine(src: Point, tgt: Point, tabScale: number, fill_opt?: string): string {
  const fill = fill_opt ?? 'none';
  const f = tabScale < 0 ? -1 : 1;
  tabScale = Math.abs(tabScale);
  const p1 = vplus(src, vsetlen(vrot(vsub(tgt, src), f * Math.PI / 4), tabScale));
  const p2 = vplus(tgt, vsetlen(vrot(vsub(tgt, src), f * (3 * Math.PI / 4)), tabScale));
  return together(
    polyline([src, p1, p2, tgt, src], fill)
  );
}

function conditional(cond: boolean, ...x: string[]): string {
  return cond ? x.join('') : '';
}

function figure(page: number): string {
  function base(fos: FillOrStroke): string {
    return translate({ x: 110, y: 525, extra: `fill=none` },
      transform('rotate(-90)',
        bleedRect(0, 0, blue.x, blue.y, fos),

        bleedRect(0, blue.y, blue.x, blue.z, fos),
        bleedRect(0, blue.z + blue.y, blue.x, blue.y, fos),
        bleedRect(0, -blue.z, blue.x, blue.z, fos),
        bleedRect(-blue.z, 0, blue.z, blue.y, fos),
        bleedRect(blue.x, 0, blue.z, blue.y, fos),

        conditional(fos.t == 'stroke',
          tabLine({ x: 0, y: -blue.z }, { x: 0, y: 0 }, TAB),
          tabLine({ x: 0, y: blue.y }, { x: 0, y: blue.y + blue.z }, TAB),
          tabLine({ x: 0, y: blue.y + blue.z }, { x: 0, y: 2 * blue.y + blue.z }, TAB),

          tabLine({ x: blue.x, y: -blue.z }, { x: blue.x, y: 0 }, -TAB),
          tabLine({ x: blue.x, y: blue.y }, { x: blue.x, y: blue.y + blue.z }, -TAB),
          tabLine({ x: blue.x, y: blue.y + blue.z }, { x: blue.x, y: 2 * blue.y + blue.z }, -TAB),

          tabLine({ x: 0, y: -blue.z }, { x: blue.x, y: -blue.z }, -TAB),

          // Markers for where to attach orange bits
          tabLine(pab, po, TAB),
          tabLine(vsub(vplus(pab, pcd), po), pcd, -TAB),

          tabLine(pab2, po2, -TAB),
          tabLine(vsub(vplus(pab2, pcd2), po2), pcd2, TAB),
        ),
      )
    );
  }

  function cheeto1half(fos: FillOrStroke) {
    return together(
      bleedRect(0, 0, orange.b, orange.c, fos),
      bleedRect(orange.b, 0, orange.a, orange.c, fos),
      bleedRect(orange.b + orange.a, 0, orange.b, orange.c, fos),
      bleedRect(2 * orange.b + orange.a, 0, orange.a, orange.c, fos),

      bleedRect(orange.b, -orange.b, orange.a, orange.b, fos),
      bleedRect(orange.b, orange.c, orange.a, orange.b, fos),

      conditional(fos.t == 'stroke',
        tabLine({ x: 0, y: 0 }, { x: 0, y: orange.c }, TAB),

        tabLine({ x: 0, y: 0 }, { x: orange.b, y: 0 }, -TAB),
        tabLine({ x: orange.b, y: -orange.b }, { x: orange.b + orange.a, y: -orange.b }, -TAB),
        tabLine({ x: orange.b + orange.a, y: 0 }, { x: 2 * orange.b + orange.a, y: 0 }, -TAB),

        tabLine({ x: 0, y: orange.c }, { x: orange.b, y: orange.c }, TAB),
        tabLine({ x: orange.b, y: orange.c + orange.b }, { x: orange.b + orange.a, y: orange.c + orange.b }, TAB),
        tabLine({ x: orange.b + orange.a, y: orange.c }, { x: 2 * orange.b + orange.a, y: orange.c }, TAB),

        tabLine({ x: 2 * orange.b + orange.a, y: 0 }, { x: 2 * orange.b + 2 * orange.a, y: 0 }, -TAB, light_blue),
        dline({ x: 2 * orange.b + orange.a, y: 0 }, { x: 2 * orange.b + 2 * orange.a, y: 0 }, light_blue),
      )
    );
  }

  function cheeto1(fos: FillOrStroke) {
    return together(
      cheeto1half(fos),
      translate({ x: 4 * orange.b + 3 * orange.a, y: 2 * orange.c }, transform('rotate(180)', cheeto1half(fos))),
    );
  }

  const actualCheeto1 = translate({ x: 150, y: 200, extra: `fill="none"` },
    cheeto1({ t: 'fill', bleed: BLEED, color: orange_paint }),
    cheeto1({ t: 'stroke' }),
    dline({ x: 2 * orange.b + orange.a, y: orange.c }, { x: 2 * orange.b + 2 * orange.a, y: orange.c }, orange_paint),
  );

  function cheeto2half(fos: FillOrStroke): string {
    return together(
      bleedRect(0, 0, orange.b, orange.c, fos),
      bleedRect(orange.b, 0, orange.a, orange.c, fos),
      bleedRect(orange.b + orange.a, 0, orange.b, orange.c, fos),
      bleedRect(2 * orange.b + orange.a, 0, orange.a, orange.c, fos),

      bleedRect(orange.b, -orange.b, orange.a, orange.b, fos),
      bleedRect(0, orange.c, orange.b, orange.a, fos),

      conditional(fos.t == 'stroke',
        tabLine({ x: 0, y: 0 }, { x: 0, y: orange.c }, TAB),
        tabLine({ x: 0, y: 0 }, { x: orange.b, y: 0 }, -TAB),
        tabLine({ x: orange.b, y: -orange.b }, { x: orange.b + orange.a, y: -orange.b }, -TAB),
        tabLine({ x: orange.b + orange.a, y: 0 }, { x: 2 * orange.b + orange.a, y: 0 }, -TAB),

        tabLine({ x: 0, y: orange.c }, { x: 0, y: orange.c + orange.a }, TAB),
        tabLine({ x: orange.b, y: orange.c }, { x: orange.b, y: orange.c + orange.a }, -TAB),
        tabLine({ x: orange.b, y: orange.c }, { x: orange.b + orange.a, y: orange.c }, TAB, light_blue),
        dline({ x: orange.b, y: orange.c }, { x: orange.b + orange.a, y: orange.c }, light_blue),

        tabLine({ x: orange.b + orange.a, y: orange.c }, { x: 2 * orange.b + orange.a, y: orange.c }, TAB),
      ),
    );
  }

  function cheeto2(fos: FillOrStroke): string {
    return together(
      cheeto2half(fos),
      translate({ x: 4 * orange.b + 3 * orange.a, y: 2 * orange.c }, transform('rotate(180)', cheeto2half(fos))),
    );
  }

  const actualCheeto2 = translate({ x: 30, y: 460, extra: `fill="none"` },
    cheeto2({ t: 'fill', bleed: BLEED, color: orange_paint }),
    cheeto2({ t: 'stroke' }),
    dline({ x: 2 * orange.b + orange.a, y: orange.c }, { x: 2 * orange.b + 2 * orange.a, y: orange.c }, orange_paint),
  );

  if (page == 1) {
    return together(
      actualCheeto1,
      actualCheeto2,
      `<image href="${model_picture}" width="${image_width}" x="${image_offset}" />`,
      `<style>text { font-family: roboto; } .big { font-size: 18px; }
            .small {font-size: 12px; } .gray { fill: #777; }
    </style>`,
      `<text x="20" y="35" class="big">The Love of Two Oranges</text>`,
      `<text x="20" y="55" class="small">Clark Winter (1969)</text>`,
      `<text x="480" y="725" class="small gray">(jcreed, 2023)</text>`,
    );
  }
  else if (page == 2) {
    return together(
      base({ t: 'fill', color: light_blue, bleed: BLEED }),
      base({ t: 'stroke' })
    );
  }
  throw new Error(`Unknown page ${page}`);
}

const filename = '/tmp/cheeto.html';
fs.writeFileSync(filename, getHtml([figure(1), figure(2)]), 'utf8');
console.log(`Wrote to ${filename}`);
