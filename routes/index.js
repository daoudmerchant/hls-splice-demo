const express = require("express");
const { body, validationResult } = require("express-validator");
const HLSSpliceVod = require("@eyevinn/hls-splice");
const { Octokit } = require("@octokit/rest");
const { Base64 } = require("js-base64");
// const AWS = require("aws-sdk");

const router = express.Router();

const octokit = new Octokit({
  // Test account, would normally store credentials privately
  auth: "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",
});

// GET home page
router.get("/", function (req, res) {
  res.render("index");
});

// POST form
router.post("/", [
  // validate and sanitise text inputs
  body("content")
    .trim()
    .isURL()
    .withMessage("Main content must be a valid URL")
    .matches(/m3u8$/)
    .withMessage("Main content must be a valid playlist file"),
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

    // Format manifest (TODO: fix insertion of absolute paths)
    const formatManifest = (manifest) => {
      let splitManifest = manifest.split("DISCONTINUITY");
      [0, 2].forEach(
        (i) =>
          (splitManifest[i] = splitManifest[i].replace(
            /,\n/g,
            `,\n${content.slice(0, content.lastIndexOf("/"))}/2000/` // FIX
          ))
      );
      return splitManifest.join("DISCONTINUITY");
    };

    const formattedManifest = formatManifest(mediaManifest);

    // Prepare for upload
    const timestamp = Date.now();
    const fileName = `${timestamp}.m3u8`;
    const encodedManifest = Base64.encode(formattedManifest);

    // Upload to Github
    try {
      await octokit.repos.createOrUpdateFileContents({
        owner: "videosplicedemo",
        repo: "splicedmanifests",
        path: fileName,
        message: `New spliced manifest uploaded at ${timestamp.toString()}`,
        content: encodedManifest,
      });
      const url = `https://raw.githubusercontent.com/videosplicedemo/splicedmanifests/main/${timestamp}.m3u8`;
      res.render("link", { url });
    } catch (err) {
      if (err) return next(err);
    }

    // FIX: Amazon S3 - constant signing error, reasons include:
    //   - Invalid credentials (checked)
    //   - Invalid character in credentials (checked)
    //   - Mismatch between server and S3 time zones

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
  },
]);

module.exports = router;
