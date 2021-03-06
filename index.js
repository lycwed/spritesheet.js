#!/usr/bin/env node
var generator = require("./lib/generator");
var async = require("async");
var fs = require("fs");
var path = require("path");
var glob = require("glob");
var optimist = require("optimist");

module.exports = generate;

var FORMATS = {
  json: { template: "json.template", extension: "json", trim: false },
  yaml: { template: "yaml.template", extension: "yaml", trim: false },
  jsonarray: { template: "jsonarray.template", extension: "json", trim: false },
  "pixi.js": { template: "json.template", extension: "json", trim: true },
  starling: { template: "starling.template", extension: "xml", trim: true },
  sparrow: { template: "starling.template", extension: "xml", trim: true },
  "easel.js": { template: "easeljs.template", extension: "json", trim: false },
  egret: { template: "egret.template", extension: "json", trim: false },
  zebkit: { template: "zebkit.template", extension: "js", trim: false },
  cocos2d: { template: "cocos2d.template", extension: "plist", trim: false },
  "cocos2d-v3": { template: "cocos2d-v3.template", extension: "plist", trim: false },
  css: { template: "css.template", extension: "css", trim: false },
};

if (!module.parent) {
  var argv = optimist
    .usage("Usage: $0 [options] <files>")
    .options("f", {
      alias: "format",
      describe: "format of spritesheet (starling, sparrow, json, yaml, pixi.js, easel.js, egret, zebkit, cocos2d)",
      default: "pixi.js",
    })
    .options("cf", {
      alias: "customFormat",
      describe: "path to external format template",
      default: "",
    })
    .options("n", {
      alias: "name",
      describe: "name of generated spritesheet, by default the `assets_directory` name",
      default: null,
    })
    .options("p", {
      alias: "path",
      describe: "path to export directory",
      default: "export",
    })
    .options("ext", {
      describe: "files extension",
      default: "png",
    })
    .options("fullpath", {
      describe: "include path in file name",
      default: false,
      boolean: true,
    })
    .options("prefix", {
      describe: "prefix for image paths",
      default: "",
    })
    .options("trim", {
      describe: "removes transparent whitespaces around images",
      default: false,
      boolean: true,
    })
    .options("square", {
      describe: "texture should be s square",
      default: false,
      boolean: true,
    })
    .options("powerOfTwo", {
      describe: "texture width and height should be power of two",
      default: false,
      boolean: true,
    })
    .options("validate", {
      describe: "check algorithm returned data",
      default: false,
      boolean: true,
    })
    .options("scale", {
      describe: "percentage scale",
      default: null,
    })
    .options("fuzz", {
      describe: "percentage fuzz factor (usually value of 1% is a good choice)",
      default: null,
    })
    .options("tinify", {
      describe: "TinyPNG API key (allows to optimize spritesheet size)",
      default: null,
    })
    .options("algorithm", {
      describe:
        "packing algorithm: growing-binpacking (default), binpacking (requires passing --width and --height options), vertical or horizontal",
      default: "growing-binpacking",
    })
    .options("width", {
      describe: "width for binpacking",
      default: null,
    })
    .options("height", {
      describe: "height for binpacking",
      default: null,
    })
    .options("padding", {
      describe: "padding between images in spritesheet",
      default: 0,
    })
    .options("sort", {
      describe: "Sort method: maxside (default), area, width or height",
      default: "maxside",
    })
    .options("divisibleByTwo", {
      describe: "every generated frame coordinates should be divisible by two",
      default: false,
      boolean: true,
    })
    .options("cssOrder", {
      describe: "specify the exact order of generated css class names",
      default: "",
    })
    .check(function(argv) {
      if (argv.algorithm !== "binpacking" || (!isNaN(Number(argv.width)) && !isNaN(Number(argv.height)))) {
        return true;
      }

      throw new Error("Width and/or height are not defined for binpacking");
    })
    .demand(1).argv;

  if (argv._.length === 0) {
    optimist.showHelp();
    return;
  }
  generate(argv._, argv, function(err) {
    if (err) throw err;
  });
}

/**
 * generates spritesheet
 * @param {string} dir assets directory
 * @param {object} options
 * @param {string} options.format format of spritesheet (starling, sparrow, json, yaml, pixi.js, zebkit, easel.js, cocos2d)
 * @param {string} options.customFormat external format template
 * @param {string} options.name name of the generated spritesheet
 * @param {string} options.path path to the generated spritesheet
 * @param {string} options.ext files extension
 * @param {string} options.prefix prefix for image paths
 * @param {boolean} options.fullpath include path in file name
 * @param {boolean} options.trim removes transparent whitespaces around images
 * @param {boolean} options.square texture should be square
 * @param {boolean} options.powerOfTwo texture's size (both width and height) should be a power of two
 * @param {string} options.algorithm packing algorithm: growing-binpacking (default), binpacking (requires passing width and height options), vertical or horizontal
 * @param {boolean} options.padding padding between images in spritesheet
 * @param {string} options.sort Sort method: maxside (default), area, width, height or none
 * @param {boolean} options.divisibleByTwo every generated frame coordinates should be divisible by two
 * @param {string} options.cssOrder specify the exact order of generated css class names
 * @param {function} callback
 */
function generate(dir, options, callback) {
  options = options || {};

  var files = glob.sync(dir + "/*." + options.ext);
  if (files.length === 0) {
    return callback(new Error("no files found..."));
  }

  if (Array.isArray(options.format)) {
    options.format = options.format.map(function(x) {
      return FORMATS[x];
    });
  }
  else if (options.format || !options.customFormat) {
    options.format = [
      FORMATS[options.format] || FORMATS["pixi.js"],
    ];
  }

  var parentPath = path.dirname(files[0]);

  options.name = options.name || parentPath.split("/").pop();
  options.path = path.resolve(options.path || "export");
  options.fullpath = options.hasOwnProperty("fullpath") ? options.fullpath : false;
  options.square = options.hasOwnProperty("square") ? options.square : false;
  options.powerOfTwo = options.hasOwnProperty("powerOfTwo") ? options.powerOfTwo : false;
  options.extension = options.hasOwnProperty("extension") ? options.extension : options.format[0].extension;
  options.trim = options.hasOwnProperty("trim") ? options.trim : options.format[0].trim;
  // options.scale = options.hasOwnProperty('scale') ? options.scale : null;
  // options.fuzz = options.hasOwnProperty('fuzz') ? options.fuzz : null;
  // options.width = options.hasOwnProperty('width') ? options.width : null;
  // options.height = options.hasOwnProperty('height') ? options.height : null;
  // options.tinify = options.hasOwnProperty('tinify') ? options.tinify : null;
  options.validate = options.hasOwnProperty("validate") ? options.validate : false;
  options.algorithm = options.hasOwnProperty("algorithm") ? options.algorithm : "growing-binpacking";
  options.sort = options.hasOwnProperty("sort") ? options.sort : "maxside";
  options.padding = options.hasOwnProperty("padding") ? parseInt(options.padding, 10) : 0;
  options.prefix = options.hasOwnProperty("prefix") ? options.prefix : "";
  options.divisibleByTwo = options.hasOwnProperty("divisibleByTwo") ? options.divisibleByTwo : false;
  options.cssOrder = options.hasOwnProperty("cssOrder") ? options.cssOrder : null;

  files = files.map(function(item, index) {
    var resolvedItem = path.resolve(item);
    var name = "";
    if (options.fullpath) {
      name = item.substring(0, item.lastIndexOf("."));
    }
    else {
      name =
        options.prefix + resolvedItem.substring(resolvedItem.lastIndexOf(path.sep) + 1, resolvedItem.lastIndexOf("."));
    }
    return {
      index: index,
      path: resolvedItem,
      name: name,
      extension: path.extname(resolvedItem),
    };
  });

  if (!fs.existsSync(options.path)) {
    if (options.path !== "") {
      fs.mkdirSync(options.path);
    }
  }
  else {
    spritesheetPNG = path.resolve(options.path + "/" + options.name + ".png");
    if (fs.existsSync(spritesheetPNG)) {
      fs.unlinkSync(spritesheetPNG.replace(/\\ /g, " "));
    }
    spritesheetJSON = path.resolve(options.path + "/" + options.name + ".json");
    if (fs.existsSync(spritesheetJSON)) {
      fs.unlinkSync(spritesheetJSON.replace(/\\ /g, " "));
    }
  }

  async.waterfall(
    [
      function(callback) {
        generator.treatImages(files, options, callback);
      },
      function(callback) {
        generator.getImagesSizes(files, options, callback);
      },
      function(files, callback) {
        generator.determineCanvasSize(files, options, callback);
      },
      function(options, callback) {
        generator.generateImage(files, options, callback);
      },
      function(callback) {
        generator.generateData(files, options, callback);
      },
    ],
    callback,
  );
}
