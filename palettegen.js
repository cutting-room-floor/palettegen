#!/usr/bin/env node
var fs = require('fs');
var get = require('get');
var blend = require('blend');
var async = require('async');

try { var file = fs.readFileSync(process.argv[2], 'utf8'); }
catch (err) { console.warn('Usage: palettegen.js file.json'); process.exit(1); }

generatePalettes(JSON.parse(file));


function generatePalettes(json) {
    var palettes = {};
    async.forEachSeries(Object.keys(json.zooms), function(key, next) {
        async.waterfall([
            function(next) { loadTiles(json.url, json.zooms[key].samples, next); },
            function(tiles, next) { blendImage(tiles, json.zooms[key].colors, next); },
            function(image, warnings, next) { getPalette(image, next); },
            function(palette, next) { palettes[key] = palette; next(); }
        ], next);
    }, function(err) {
        if (err) throw err;
        console.log('{');
        var last = Object.keys(palettes).pop();
        for (var key in palettes) {
            console.log ('    ' + JSON.stringify(key) + ': ' + JSON.stringify(palettes[key]) + (key === last ? '' : ','));
        }
        console.log('}');
    });
}

function loadTiles(tpl, coords, callback) {
    async.map(coords, function(c, next) {
        var url = tpl.replace('{z}', c[0]).replace('{x}', c[1]).replace('{y}', c[2]);
        new get(url).asBuffer(next);
    }, callback);
}

function blendImage(tiles, colors, callback) {
    var dimension = Math.ceil(Math.sqrt(tiles.length));
    var size = dimension * 256;
    var x = 0, y = 0;
    var input = tiles.map(function(tile) {
        var spec = { x: x * 256, y: y * 256, buffer: tile };
        if (++x >= dimension) { x = 0; y++; }
        return spec;
    });
    blend(input, {
        matte: 'ffffff',
        quality: colors,
        width: size,
        height: size
    }, callback);
}

function getPalette(png, callback) {
    if (png[0] !== 137 || png[1] !== 80 || png[2] !== 78 || png[3] !== 71 ||
        png[4] !== 13  || png[5] !== 10 || png[6] !== 26 || png[7] !== 10) return callback(new Error('Image is not a PNG file'));

    var PLTE, tRNS;
    var i = 8;
    while (i < png.length) {
        var length = png.readUInt32BE(i);
        var type = png.toString('ascii', i + 4, i + 8);
        i += 8; // Skip length + chunk type
        if (type === 'PLTE') PLTE = png.slice(i, i + length);
        if (type === 'tRNS') tRNS = png.slice(i, i + length);
        i += length + 4; // Skip payload + crc32.
    }

    if (!PLTE) return callback(new Error('Image does not have a palette'));
    if (!tRNS) tRNS = new Buffer(0);

    // Convert the RGB palette to RGBA and potentially merge in the tRNS chunk as well.
    var palette = [];
    for (var p = 0, t = 0; p < PLTE.length; p += 3, t++) {
        palette.push([
            hex2(PLTE[p + 0]),
            hex2(PLTE[p + 1]),
            hex2(PLTE[p + 2]),
            t < tRNS.length ? hex2(tRNS[t]) : ''
        ].join(''));
    }

    callback(null, palette);
}

function paletteFromJSON(json) {
    var palette = json.map(function(str) {
        return str.length === 6 ? str + 'ff' : str;
    }).join('');
    return new blend.Palette(new Buffer(palette, 'hex'), 'rgba')
}

function hex2(num) {
    return num < 16 ? '0' + num.toString(16) : num.toString(16);
}
