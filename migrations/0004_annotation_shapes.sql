-- Rich review markup: freehand pen, highlighter, boxes, ellipses and arrows.
--
-- The Worker validates and stores the geometry as versioned JSON
-- ({"v":1,"shapes":[...]}) with every coordinate normalised to 0..1 of the
-- media frame, so markup lines up at any screen size. x/y/width/height keep
-- holding the markup's bounding box so the row stays queryable and older
-- readers still see a sensible anchor point.
ALTER TABLE annotations ADD COLUMN shape_json TEXT;
