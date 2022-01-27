var express = require("express");
const { body, validationResult } = require("express-validator");

var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

router.post("/", [
  // validate and sanitise text inputs
  body("content")
    .trim()
    .isURL()
    .withMessage("Main video mmust be a valid URL")
    .matches(/m3u8$/)
    .withMessage("Main video must be a valid playlist file")
    .escape(),
  body("ad")
    .trim()
    .isURL()
    .withMessage("Advert must be a valid URL")
    .matches(/,3u8$/)
    .withMessage("Advert must be a valid playlist file")
    .escape(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Has errors, rerender form
      res.render("index", { ...req.body, errors: errors.array() });
      return;
    }
    // No errors, proceed with splicing
  },
]);

module.exports = router;
