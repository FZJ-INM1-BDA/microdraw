const fs = require('fs')

module.exports = new Promise((resolve,reject)=>{
    fs.readdir(__dirname,(err,files)=>{
        if(err)reject(err)
        Promise.all(files
            .filter(file=>!['allTools.js'].find(ig=>ig===file))
            .map(file=>new Promise((rs,rj)=>{
                fs.readFile(__dirname + '/' + file,'utf-8',(err2,data)=>{
                    if(err2)rj(err2)
                    rs(data)
                })
            })))
            .then(arr=>resolve(arr))
            .catch(e=>reject(e))
    })
})
