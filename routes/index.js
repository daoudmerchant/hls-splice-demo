var express = require("express");
const { body, validationResult } = require("express-validator");
const HLSSpliceVod = require("@eyevinn/hls-splice");

// TEST
const fs = require("fs");

var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index");
});

router.post("/", [
  // validate and sanitise text inputs
  body("content")
    .trim()
    .isURL()
    .withMessage("Main video mmust be a valid URL")
    .matches(/m3u8$/)
    .withMessage("Main video must be a valid playlist file"),
  body("ad")
    .trim()
    .isURL()
    .withMessage("Advert must be a valid URL")
    .matches(/m3u8$/)
    .withMessage("Advert must be a valid playlist file"),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Has errors, rerender form
      res.render("index", { ...req.body, errors: errors.array() });
      return;
    }
    // No errors, proceed with splicing
    const { content, ad, time } = req.body;
    const hlsVod = new HLSSpliceVod(content);
    await hlsVod.load();
    await hlsVod.insertAdAt(time, ad);
    const mediaManifest = hlsVod.getMediaManifest(4928000);
    const formattedManifest = mediaManifest.replace(/\s/g, "\n");
    // TEST CODE
    fs.writeFile("test.m3u8", formattedManifest, (err) => {
      if (err) alert("Error!");
    });
    res.send(formattedManifest);
    // save mediaManifest to m3u8 file
  },
]);

module.exports = router;
