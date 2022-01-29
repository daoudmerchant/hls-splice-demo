const express = require("express");
const { body, validationResult } = require("express-validator");
const HLSSpliceVod = require("@eyevinn/hls-splice");
const { Octokit } = require("@octokit/rest");
const { Base64 } = require("js-base64");

// const AWS = require("aws-sdk");

const octokit = new Octokit({
  auth: "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",
});

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
     * - Write to new .m3u8 file on Github
     * - On success, pass URL of new file to link view
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

    // Upload to GitHub

    const timestamp = Date.now();
    const fileName = `${timestamp}.m3u8`;
    const encodedManifest = Base64.encode(formattedManifest);
    try {
      await octokit.repos.createOrUpdateFileContents({
        owner: "videosplicedemo",
        repo: "splicedmanifests",
        path: fileName,
        message: `New spliced manifest uploaded at ${timestamp.toString()}`,
        content: encodedManifest,
      });
      const url = `https://raw.githubusercontent.com/videosplicedemo/splicedmanifests/main/${timestamp}.m3u8`;
      const copyText = () => {
        navigator.clipboard.write(url);
      };
      res.render("link", {
        url,
        copyText,
      });
    } catch (err) {
      if (err) return next(err);
    }

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
  },
]);

module.exports = router;
