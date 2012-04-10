Takes a list of tiles in JSON format (see `samples` folder) for a certain zoom level, downloads them and generates a palette that represents all colors on those tiles. The output is in JSON format, simply as an array of all RGB(A) colors. They can be loaded by node-blend with `blend.Palette.fromJSON(arr)`.