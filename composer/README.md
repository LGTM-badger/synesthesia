# Synesthesia Composer

This is the composer part of the synesthesia project.

## Building / Usage

The main way in which to use this project is as a chrome extension (but the
html files output in `dist/` can also be used directly).

To Build:

* Run `npm install && gulp` if you have `gulp` installed globally
* Or run `npm install && ./node_modules/gulp/bin/gulp.js`

This output of the build is put in `dist/`, and you can either open
`dist/index.html` directly in your browser, or install the `dist/` directory as
a chrome extension (which gives you more functionality such as connecting to
google play music).

## TODO list

Please see the [GitHub issues](/samlanning/synesthesia/issues) for the list of
tasks.

## Special Thanks

The style of this app has been heavily inspired by the
[Vertex Theme for GTK](https://github.com/horst3180/vertex-theme)
