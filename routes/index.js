var express = require("express");
const { body, validationResult } = require("express-validator");

var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

router.post("/", [
  // validate and sanitise text inputs
  body("content", "Invalid main video link")
    .trim()
    .isURL()
    .matches(/m3u8$/)
    .escape(),
  body("ad", "Invalid advert video link")
    .trim()
    .isURL()
    .matches(/,3u8$/)
    .escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render("index", { ...req.body, errors: errors.array() });
      return;
    }
  },
]);

module.exports = router;
