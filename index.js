require('dotenv').config()
const exec = require('child_process').exec;
const crypto = require('crypto')
const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3000;

const secret = process.env.SERCET;

const deployers = []

if (!(fs.existsSync("DEPLOYERS"))) {
  exec(`git clone ${process.env.DEPLOYERS} DEPLOYERS`, console.log);
}

fromDir("DEPLOYERS", ".json")
  .forEach(file => {
    let rawdata = fs.readFileSync(file);
    let deployer = JSON.parse(rawdata);
    deployers.push(deployer);
  })

console.log(deployers)

const app = express()
app.use(bodyParser.json())



app.post('/github', verifyPostData, function (req, res) {

  fs.writeFile('body.json', req.body, function (err, data) {
    if (err) {
      return console.log(err);
    }
    console.log(data);
  });

  res.status(200).send('Request body was signed')
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
