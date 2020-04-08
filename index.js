require('dotenv').config()
const exec = require('child_process').exec;
const crypto = require('crypto')
const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3000;
const app = express()
app.use(bodyParser.json())
const secret = process.env.SERCET;

const deployers = {}

clone(process.env.DEPLOYERS, "DEPLOYERS")

fromDir("DEPLOYERS", ".json")
  .forEach(file => {
    deployers[deployer] = JSON.parse(fs.readFileSync(file));
  })

console.log(deployers)

Object.keys(deployers).forEach(key => { clone(deployers[key].repo, "DEPLOYS/" + deployers[key].name); })

app.post('/github', verifyPostData, function (req, res) {

  let payload = req.body

  let { zen, repository } = payload;

  let { name, full_name, html_url } = repository;

  console.log(zen)

  console.log(deployers[name])

  if (html_url === process.env.DEPLOYERS) {
    exec(`cd DEPLOYERS && git pull`, console.log);
  } else {
    exec(`cd DEPLOYS/${name} && git pull`, console.log);
  }

  res.status(200).send('commit has been deployed')
})

app.use((err, req, res, next) => {
  if (err) console.error(err)
  res.status(403).send('Request body was not signed or verification failed')
})

app.listen(port, () => console.log('listening on', port))

function verifyPostData(req, res, next) {

  // https://gist.github.com/stigok/57d075c1cf2a609cb758898c0b202428

  const payload = JSON.stringify(req.body)
  if (!payload) {
    return next('Request body empty')
  }

  const sig = req.get('X-Hub-Signature') || ''
  const hmac = crypto.createHmac('sha1', secret)
  const digest = Buffer.from('sha1=' + hmac.update(payload).digest('hex'), 'utf8')
  const checksum = Buffer.from(sig, 'utf8')
  if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
    return next(`Request body digest (${digest}) did not match (${checksum})`)
  }
  return next()
}


function fromDir(startPath, filter, callback) {

  // https://stackoverflow.com/questions/25460574/find-files-by-extension-html-under-a-folder-in-nodejs

  let foundFiles = []

  if (!fs.existsSync(startPath)) {
    return foundFiles;
  }

  var files = fs.readdirSync(startPath);
  for (var i = 0; i < files.length; i++) {
    var filename = path.join(startPath, files[i]);
    var stat = fs.lstatSync(filename);
    if (stat.isDirectory()) {
      fromDir(filename, filter); //recurse
    }
    else if (filename.indexOf(filter) >= 0) {
      foundFiles.push(filename)
    };
  };

  return foundFiles
};

function clone(url, path) {
  if (!(fs.existsSync(path))) {
    exec(`git clone ${url} ${path}`, console.log);
  }
}