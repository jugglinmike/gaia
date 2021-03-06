'use strict';

var path = require('path');
var sh = require('child_process').exec;
var fs = require('fs');
var AdmZip = require('adm-zip');

function joinPath() {
  var src = path.join.apply(this, arguments);
  console.log(src);
  return src;
}

function getFile() {
  var src = path.join.apply(this, arguments);
  var fileStat;
  try {
    fileStat = fs.statSync(src);
  } catch (e) {
    // In order to have compability with xpcshell interface,
    // we just simply let fileStat undefined and don't need
    // to do anything here.
  }
  return {
    exists: function() {
      return !!fileStat;
    },
    isDirectory: function() {
      return !!fileStat && fileStat.isDirectory();
    },
    isFile: function() {
      return !!fileStat && fileStat.isFile();
    },
    path: src
  };
}

function getFileContent(file) {
  if (file.exists() && file.isFile()){
    return fs.readFileSync(file.path, {encoding: 'utf-8'});
  }
}

function Commander(cmd) {

  this.initPath = function(){};

  this.run = function(args) {
    var cmds = args.join(' ');

    // In *nix and OSX version commands are run via sh -c YOUR_COMMAND,
    // but in Windows commands are run via cmd /C YOUR_COMMAND,
    // so, we just let execSync module to handle the difference.
    if (cmd === 'sh') {
      cmds = cmds.replace(/^-c/, '');
    } else {
      cmds = cmd + ' ' + cmds;
    }
    console.log(cmds);
    // XXX: Most cmds should run synchronously, we should use either promise
    //      pattern inside each script or find a sync module which doesn't
    //      require recompile again since TPBL doesn't support that.
    sh(cmds);
  };
}

function readZipManifest(file) {
  var zip = new AdmZip(joinPath(file.path, 'application.zip'));
  var zipEntries = zip.getEntries();
  var content = {};
  for (var i = 0; i < zipEntries.length; i++) {
    var zipEntry = zipEntries[i];
    if (zipEntry.entryName == "manifest.webapp") {
      content = JSON.parse(zipEntry.getData().toString('utf8'));
      break;
    }
  }
  return content;
}

exports.joinPath = joinPath;
exports.getFile = getFile;
exports.getFileContent = getFileContent;
exports.Commander = Commander;
exports.getEnvPath = function() {};
exports.readZipManifest = readZipManifest;
exports.log = console.log;
