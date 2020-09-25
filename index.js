require('dotenv').config()
const exec = require('child_process').exec;
const crypto = require('crypto')
const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3005;
const app = express()
app.use(bodyParser.json())
const secret = process.env.SERCET;

var deploys = {}
var ready = false

getDeployers()
  .then(CheckAllRepos)
  .catch(handleError);

app.post('/github', verifyPostData, function (req, res) {

  if (ready) {
    
    let payload = req.body
    let { ref, repository } = payload;
    let { name, full_name, html_url } = repository;
    let deploy = deploys[name]
    branch = ref.split('/')[2]

    console.log(full_name)

    if (html_url === process.env.DEPLOYERS) {
      if (isValidPush(branch, 'master')) {
        run('DEPLOYERS/', `git pull`)
          .then(() => res.status(200).send('updated from latest commit'))
          .then(CheckAllRepos)
          .catch(error => { handleError(error); res.status(500).send(error) })
      } else {
        res.status(500).send('commit isnt to trigger branch')
      }
    } else {

      if (isValidPush(branch, deploy.trigger)) {

        console.log('pulling and restarting', name)

        run(deploy.path, `${deploy.stop} && git pull && ${deploy.install} && ${deploy.start}`)
          .then(() => { console.log('updated', name); res.status(200).send('updated from latest commit'); })
          .catch(error => { handleError(error); res.status(500).send(error) })

      } else {
        res.status(500).send('commit isnt to trigger branch')
      }
    }

  }

})

app.use((err, req, res, next) => {
  if (err) console.error(err)
  res.status(403).send('Request body was not signed or verification failed')
})

app.listen(port, () => console.log('listening on', port))

function isValidPush(branch, trigger) {
  if (branch === trigger || trigger === '*' || trigger === 'all') {
    return true
  }
  return false
}

function CheckAllRepos() {
  readAllDeploys()
    .then(cloneAll)
    .then(startNewDeploys)
    .then(deployers => deployers.forEach(deploy => deploy.then(info => deploys[info.name] = info)))
    .then(() => ready = true)
    .catch(handleError);
}


function handleError(error) {
  console.error('error', error)
}

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


function fromDir(startPath, filter) {

  // https://stackoverflow.com/questions/25460574/find-files-by-extension-html-under-a-folder-in-nodejs

  return new Promise((resolve, reject) => {
    try {
      let foundFiles = []

      if (!fs.existsSync(startPath)) {
        resolve([])
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

      resolve(foundFiles)

    } catch (error) {
      reject(error)
    }

  })

};

function getDeployers() {
  return clone(process.env.DEPLOYERS, "DEPLOYERS")
}

function clone(repo, path) {
  return new Promise((resolve, reject) => {
    if (!(fs.existsSync(path))) {
      run('./', `git clone ${repo} ${path}`)
        .then(() => resolve({ isNew: true, path, repo }))
        .catch(reject)
    } else {
      resolve({ isNew: false, path, repo });
    }
  })

}

function cloneAll(deployers) {
  return Object.keys(deployers).map(key => { return { promise: clone(deployers[key].repo, "DEPLOYS/" + deployers[key].name), json: deployers[key] } })
}

function readAllDeploys() {
  return new Promise((resolve, reject) => {

    let deployers = {}

    try {
      fromDir("DEPLOYERS", ".json")
        .then(files => {
          files.forEach(file => {
            let data = JSON.parse(fs.readFileSync(file));
            deployers[data.name] = data;
          })
          resolve(deployers);
        }).catch(reject)
    } catch (error) {
      reject(error)
    }
  })

}

function startNewDeploys(deployers) {
  return deployers.map(deploy =>
    deploy.promise.then(info => {
      if (info.isNew) { return startNewDeploy({ ...info, ...deploy.json }) }
      else { return { ...info, ...deploy.json, isRunning: true } }
    })
  )
}

function startNewDeploy(deploy) {
  return new Promise((resolve, reject) => {
    run(deploy.path, `${deploy.install} && ${deploy.create}`)
      .then(() => resolve({ ...deploy, isRunning: true }))
      .catch(reject)
  })

}

function run(path, cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: path }, console.log)
      .on("exit", resolve)
      .on("error", reject);
  })
}