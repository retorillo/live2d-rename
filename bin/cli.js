#!/usr/bin/env node

const fs = require('fs').promises;
const os = require('os');
const cpexec = require('util').promisify(require('child_process').exec);
const deepkey = require('deep-key');
const deleteEmpty = require('delete-empty');
const glob = require('glob');
const iconv = require('iconv-lite');
const path = require('path');
const regexEscape = require('escape-string-regexp');
const chardet = require('chardet');
const copydir = require('copy-dir');
const exists = require('path-exists');
const del = require('del');
const gnuopt = require('gnu-option');
const optmap = {
  's': '&src',
  'src': '&source',
  'source': 'string',  
  'd': '&dest',
  'dest': '&destination',
  'destination': 'string',
  'N': '&no-dupl',
  'no-dupl': '&no-duplication',
  'no-duplication': 'switch',
  'f': '&force',
  'force': 'switch',
  'i': '&icon-label',
  'icon-label': 'switch',
  'I': '&install',
  'install': 'switch',
};
const options = gnuopt.parse(optmap);

async function prompt(msg, choices) {
  var choice = -1;
  choices = choices.toLowerCase().split(/(?=.)/);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(`${msg} [${choices.join('/')}]: `);
  var awaiter_callback = (resolve) => {
    if (choice != -1) resolve(); 
    else setTimeout(awaiter_callback.bind(this, resolve), 50);
  }
  var awaiter = new Promise(awaiter_callback);
  // TODO: BUG: 'data' event may be registered in duplication when called repatedly
  process.stdin.on('data', chunk => {
    if (choice != -1) return;
    choice = choices.indexOf(chunk.toString().toLowerCase());
    console.log(chunk.toString());
  });
  await awaiter;
  process.stdin.pause();
  return choices[choice];
}
function detectCharCode(file) {
  return new Promise((resolve, reject) => {
    chardet.detectFileAll(file, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
async function handleCfg(dir, before, after, prefix) {
  const before_cfg = path.join(dir, `${prefix}${before}.cfg`);
  const after_cfg = path.join(dir, `${prefix}${after}.cfg`);
  if (!await exists(before_cfg)) {
    console.log(`[WARNING] ${prefix}${before}.cfg is not found, operation is skipped`);
    return;
  }
  const fenc = (await detectCharCode(before_cfg))[0];
  await fs.rename(before_cfg, after_cfg);
  console.log(`${before}.cfg is renamed to ${after}.cfg`);
  var data = await fs.readFile(after_cfg);
  data = iconv.decode(data, fenc.name);
  var dos = /\r\n/.test(data);
  console.log(`${after}.cfg is opened in ${fenc.name} (confidence: ${fenc.confidence}%)`);
  var replaced = 0;
  data = data.split(/\r?\n/).map(l => {
    const regex = new RegExp(`([0-9a-z_]+\\s+)${regexEscape(before)}`, 'i');
    if (!regex.test(l)) return l;
    replaced++;
    return l.replace(regex, `$1${after}`);
  }).join(dos ? '\r\n' : '\n');
  await fs.writeFile(after_cfg, data, { encoding: 'utf-8' });
  console.log(`${after}.cfg is replaced (${replaced} lines)`);
}
async function handleJson(dir, before, after, ext) {
  var affectedItems = [];
  const before_cfg = path.format({ dir: dir, base: before + ext });
  const after_cfg = path.format({ dir: dir, base: after + ext } );
  if (!await exists(before_cfg)) {
    console.log(`[WARNING] ${before}${ext} is not found. operation is skipped`);
    return affectedItems;
  }
  const fenc = (await detectCharCode(before_cfg))[0];
  await fs.rename(before_cfg, after_cfg);
  console.log(`${before}${ext} is renamed to ${after}${ext}`);
  var data = await fs.readFile(after_cfg);
  data = iconv.decode(data, fenc.name);
  console.log(`${after}${ext} is opened in ${fenc.name} (confidence: ${fenc.confidence}%)`);
  var count = 0;
  var json = JSON.parse(data);
  var regex = new RegExp(regexEscape(before) + '(\\.)');
  var replace = (value) => {
    if (!regex.test(value)) return value;
    var replaced = value.replace(regex, `${after}$1`);
    affectedItems.push({ before: value, after: replaced });
    count++;
    return replaced;
  }
  for (dkey of deepkey.keys(json)) {
    var value = deepkey.get(json, dkey);
    if (typeof(value) === 'string')
      deepkey.set(json, dkey, replace(value));
  }
  await fs.writeFile(after_cfg, JSON.stringify(json, null, 2), { encoding: 'utf-8' });
  console.log(`${after}${ext} is replaced (${count} string objects)`);
  return affectedItems;
}
async function handleIcon(dir, before, after, iconlabel) {
  var beforepath = path.join(dir, `ico_${before}.png`);
  var afterpath = path.join(dir, `ico_${after}.png`);
  if (!await exists(beforepath)) { 
    console.log(`[WARNING] ico_${before}.png is not found, operation is skipped`);
    return;
  }
  var lbl = /([a-z0-9]*)$/.exec(after);
  if (lbl && iconlabel) {
    lbl = lbl[1];
    var lblpath = path.join(dir, `ico_${before}_lbl.png`);
    var bkgpath = path.join(dir, `ico_${before}_bkg.png`);
    var cmp1path = path.join(dir, `ico_${before}_cmp1.png`);
    var cmp2path = path.join(dir, `ico_${before}_cmp2.png`);
    const pt = 32;
    const padding = '8x8';
    await cpexec(`magick convert -background transparent -fill white -family "courier new"`
      + ` -gravity southeast -splice ${padding} -gravity northwest -splice ${padding}`
      + ` -pointsize ${pt} label:"${lbl}" "${lblpath}"`);
    await cpexec(`magick convert "${lblpath}" -fill black -draw "color 0,0 reset" "${bkgpath}"`);
    await cpexec(`magick composite -gravity southwest -geometry +0+8 -blend 50 "${bkgpath}" "${beforepath}" "${cmp1path}"`);
    await cpexec(`magick composite -gravity southwest -geometry +0+8 "${lblpath}" "${cmp1path}" "${cmp2path}"`);
    fs.unlink(cmp1path);
    fs.unlink(lblpath);
    fs.unlink(bkgpath);
    await fs.unlink(beforepath);
    await fs.rename(cmp2path, beforepath);
    console.log(`ico_${before}.png is labeled: ${lbl}`);
  }
  await fs.rename(beforepath, afterpath);
  console.log(`ico_${before}.png is renamed to ico_${after}.png`);
}
async function move(dir, before, after) {
  var bpath = path.join(dir, before);
  var apath = path.join(dir, after);
  await fs.mkdir(path.dirname(apath), { recursive: true });
  await fs.rename(bpath, apath);
  console.log(`${before} is renamed to ${after}`);
}
async function exec() {
  var src = options.source;
  var dest = options.destination;
  var force = options.force;
  var nodupl = options['no-duplication'];
  var iconlabel = options['icon-label'];
  var inst = options.install;

  if (!src)
    throw '--src option is mandatory';
  if (!dest)
    throw '--dest option is mandatory';

  if (!await exists(src))
    throw `Path not found: ${src}`; 
  var srcstat = await fs.stat(src)
  if (!srcstat.isDirectory())
    throw `Is not directory: ${src}`;
  if (await exists(dest)) {
    var c = force ? 'y' : await prompt(`${dest} already exists, remove it and continue operation?`, 'yn');
    if (c == 'y') {
      await del(dest);
      console.log(`${dest} is deleted`);
    }
    else
      throw 'Operation is canceled';
  }
  console.log(`copying ${src} to ${dest}`);
  copydir.sync(src, dest);

  const before = path.basename(src);
  const after = path.basename(dest);

  var affectedItems = await handleJson(dest, before, after, '.model3.json');
  for (var i of affectedItems)
    await move(dest, i.before, i.after);

  await handleCfg(dest, before, after, 'cc_');
  await handleCfg(dest, before, after, 'cc_names_');
  await handleIcon(dest, before, after, iconlabel);
  await deleteEmpty(dest);

  if (nodupl) {
    await del(src);
    console.log(`${src} is deleted`);
  }
  if (inst) {
    await install(dest, force);
  }
}
async function install(dir, force) {
  if (os.platform() !== 'win32') {
    console.log('[WARNING] --install switch is avaiable only on Windows, operation is skipped');
    return; 
  }
  var pdir = process.env[os.arch() == 'x64' ? 'ProgramFiles(x86)' : 'ProgramFiles'];
  pdir = path.join(pdir, 'Steam\\steamapps\\common\\FaceRig\\Mod\\VP\\PC_CustomData\\Objects');
  if (!await exists(pdir)) {
    console.log('[WARNING] FaceRig install directory is not found, operation is skipped')
    return;
  }
  var dest = path.join(pdir, path.basename(dir));
  if (await exists(pdir)) {
    var p = force ? 'y' : await prompt(`${dest} already exists, remove it and continue operation?`, 'yn')
    if (p == 'n') {
      console.log('[WARNING] Install operation is canceled by user');
      return;
    }
  }
  copydir.sync(dir, dest);
  console.log(`installation is completed:\n=> ${dest}`);
}
exec();
