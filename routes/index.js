const express = require("express");
const { body, validationResult } = require("express-validator");
const HLSSpliceVod = require("@eyevinn/hls-splice");
const AWS = require("aws-sdk");
AWS.config.update({
  accessKey: "AKIAXPBOKAZ6LE2NLP5G",
  secretAccessKey: "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",
});

// TEST
const fs = require("fs");
const path = require("path");

const router = express.Router();

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

    /*
     * - Replace relative .ts file paths of main content with absolute file paths
     * - Write to new .m3u8 file on Amazon S3
     * - On success, render URL to new file
     */

    const formatManifest = (manifest) => {
      let splitManifest = manifest.split("DISCONTINUITY");
      [0, 2].forEach(
        (i) =>
          (splitManifest[i] = splitManifest[i].replace(
            /,\n/g,
            `,\n${content.slice(0, content.lastIndexOf("/"))}/2000/` // FIX: improve fixed URL logic
          ))
      );
      return splitManifest.join("DISCONTINUITY");
    };

    const formattedManifest = formatManifest(mediaManifest);

    // Amazon S3 - constant signing error, content type doesn't exist? Wrong timezone?
    // https://www.ibm.com/docs/en/aspera-on-cloud?topic=resources-aws-s3-content-types

    // const s3 = new AWS.S3({
    //   endpoint: "s3-eu-north-1.amazonaws.com",
    //   signatureVersion: "v4",
    //   region: "eu-north-1",
    // });
    // const timestamp = Date.now().toString();
    // const fileParams = {
    //   Bucket: "eyevinn",
    //   Key: `${timestamp}.m3u8`,
    //   Body: formattedManifest,
    //   Expires: 300,
    //   ContentType: "application/x-mpegURL",
    //   ACL: "public-read",
    // };

    // s3.getSignedUrl("putObject", fileParams, (err, data) => {
    //   res.send(data);
    //   return;
    // });

    const fileName = `${Date.now().toString()}.m3u8`;
    const filePath = path.join(__dirname, "..", "..", "tmp", fileName);
    alert(filePath);
    fs.writeFile(filePath, formattedManifest, (err) => {
      if (err) return next(err);
      alert("File write success");
    });
    fs.readFile(filePath, (err, data) => {
      if (err) return next(err);
      alert("File read success");
      res.send(data.toString());
    });
    // res.render("link", { link: url });
  },
]);

module.exports = router;
