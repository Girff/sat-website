"""Write figure crops and raster images as WebP files."""
import os

import pymupdf
from PIL import Image

PX_PER_PT = 4.0 / 3.0       # CSS px per PDF point at 100%
FIG_ZOOM = 2 * PX_PER_PT     # figures rendered at 2x CSS resolution
MATH_ZOOM = 3 * PX_PER_PT    # small math crops rendered sharper


class Media:
    def __init__(self, doc, out_dir, rel_dir="figures"):
        self.doc, self.out_dir, self.rel_dir = doc, out_dir, rel_dir
        os.makedirs(out_dir, exist_ok=True)
        self._raster_cache = {}

    def _save(self, img, name, lossless=False):
        path = os.path.join(self.out_dir, name + ".webp")
        if lossless:
            img.save(path, "WEBP", lossless=True, method=6)
        else:
            img.save(path, "WEBP", quality=86, method=6)
        return self.rel_dir + "/" + name + ".webp"

    def crop(self, pno, rect, name, zoom=FIG_ZOOM, pad=3.0):
        """Render a page region (page coordinates) to WebP with transparency."""
        page = self.doc[pno]
        r = pymupdf.Rect(rect[0] - pad, rect[1] - pad, rect[2] + pad, rect[3] + pad) & page.rect
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=r, alpha=True)
        img = Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)
        src = self._save(img, name, lossless=zoom >= MATH_ZOOM)
        return dict(src=src, w=round(r.width * PX_PER_PT), h=round(r.height * PX_PER_PT))

    def raster(self, xref, bbox, name):
        """Extract an embedded raster image at native resolution."""
        if xref not in self._raster_cache:
            pix = pymupdf.Pixmap(self.doc, xref)
            if pix.alpha:
                pix = pymupdf.Pixmap(pix, 0)
            if pix.colorspace and pix.colorspace.n not in (1, 3):
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            smask = self.doc.extract_image(xref).get("smask")
            if smask:
                pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(self.doc, smask))
            mode = {1: "L", 2: "LA", 3: "RGB", 4: "RGBA"}[pix.n]
            img = Image.frombytes(mode, (pix.width, pix.height), pix.samples).convert("RGBA")
            self._raster_cache[xref] = self._save(img, name, lossless=True)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        return dict(src=self._raster_cache[xref], w=round(w * PX_PER_PT), h=round(h * PX_PER_PT))
