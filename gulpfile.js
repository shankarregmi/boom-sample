var gulp = require('gulp');
var fs = require('fs');
var spawn = require('child_process').spawn;
var node;
var populateDummyData = require('./server/populate-dummy-data');

// gulp task for running main application
gulp.task('run', function() {
  if (node) node.kill()
  node = spawn('node', ['.'], {
    stdio: 'inherit'
  })
  node.on('close', function(code) {
    if (code === 8) {
      console.log('Error detected, waiting for changes...');
    }
  });
})

// gulp watcher, watch for file changes and re runs node
gulp.task('watcher', function() {
  var watcher = gulp.watch(['./common/**/*.js', './common/**/*.json', './server/**/*.js', './server/**/*.json'], ['run']);
  watcher.on('change', function(event) {
    console.log('File changed rerunning task ..');
  });
});

gulp.task('populate-dummy-data', function() {
  populateDummyData.populator();
});
// gulp default task , runs everytime 'gulp' command is issued
gulp.task('default', ['run', 'watcher']);


gulp.task('browserify', function() {
  var browserify = require('browserify');
  var boot = require('loopback-boot');
  var appDir = 'server/';
  var b = browserify({
    basedir: appDir,
  });
  // add the main application file
  b.require('./browser-app.js', {
    expose: 'loopback-app'
  });
  // add boot instructions
  boot.compileToBrowserify(appDir, b);
  // create the bundle
  var out = fs.createWriteStream('browser-bundle.js');
  b.bundle().pipe(out);
  // handle out.on('error') and out.on('close')
});
